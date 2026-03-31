import { NextRequest, NextResponse } from "next/server";
import { extractListing } from "@/lib/extractors";
import { searchCompetitorsAroundTarget } from "@/lib/competitors/searchCompetitors";
import { runAudit } from "@/ai/runAudit";
import { canCreateAudit } from "@/lib/billing/canCreateAudit";
import {
  buildStructuredAuditPayloadFromRunAudit,
  summarizeStructuredAuditPayload,
} from "@/lib/audits/formatResultPayload";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    listingId?: string;
  };

  if (!body.listingId) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  }

  try {
    const { client, user, workspace } = await getRequestUserAndWorkspace(request);

    if (!user || !client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { data: listingRow, error: listingError } = await client
      .from("listings")
      .select("id, workspace_id, created_by, source_url, source_platform")
      .eq("id", body.listingId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    if (listingError) {
      return NextResponse.json(
        { error: listingError.message || "Failed to load listing" },
        { status: 500 }
      );
    }

    if (!listingRow) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (!listingRow.source_url) {
      return NextResponse.json(
        { error: "Listing has no source_url; cannot run audit" },
        { status: 400 }
      );
    }

    // 1. Quota check based on workspace before doing any heavy work
    const quota = await canCreateAudit(listingRow.workspace_id, client);

    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: quota.reason || "Free plan limit reached",
          code: "quota_exceeded",
          quota,
        },
        { status: 403 }
      );
    }

    // 2. Extract listing data from stored URL
    const extracted = await extractListing(listingRow.source_url as string);

    // 3. Search competitors around target
    const competitorBundle = await searchCompetitorsAroundTarget({
      target: extracted,
      maxResults: 15,
      radiusKm: 1,
    });

    // 4. Run audit using existing AI logic
    const auditResult = await runAudit({
      target: extracted,
      competitors: competitorBundle.competitors,
    });
    const structuredPayload = buildStructuredAuditPayloadFromRunAudit({
      auditResult,
      target: extracted,
    });

    console.info("[api/audits] generated audit payload", {
      listingId: listingRow.id,
      workspaceId: listingRow.workspace_id,
      ...summarizeStructuredAuditPayload(structuredPayload),
    });

    // 5. Persist audit in Supabase (reuse structure from /api/listings)
    const { data: auditRow, error: auditError } = await client
      .from("audits")
      .insert({
        workspace_id: listingRow.workspace_id,
        listing_id: listingRow.id,
        created_by: user.id,
        overall_score: auditResult.overallScore ?? null,
        listing_quality_index: auditResult.listingQualityIndex?.score ?? null,
        market_score: auditResult.marketPosition?.score ?? null,
        potential_score:
          auditResult.listingQualityIndex?.components?.conversionPotential ?? null,
        booking_lift_low: auditResult.estimatedBookingLift?.low ?? null,
        booking_lift_high: auditResult.estimatedBookingLift?.high ?? null,
        revenue_impact_low: auditResult.estimatedRevenueImpact?.lowMonthly ?? null,
        revenue_impact_high: auditResult.estimatedRevenueImpact?.highMonthly ?? null,
        result_payload: structuredPayload,
      })
      .select()
      .single();

    if (auditError || !auditRow) {
      throw new Error(auditError?.message || "Failed to create audit");
    }

    const { data: persistedAudit, error: persistedAuditError } = await client
      .from("audits")
      .select("id, result_payload")
      .eq("id", auditRow.id)
      .maybeSingle();

    if (persistedAuditError) {
      console.warn("[api/audits] failed to reload persisted audit", persistedAuditError);
    } else {
      console.info("[api/audits] persisted audit payload", {
        auditId: auditRow.id,
        ...summarizeStructuredAuditPayload(persistedAudit?.result_payload),
      });
    }

    // 6. Record usage event (best effort)
    const { error: usageError } = await client.from("usage_events").insert({
      workspace_id: listingRow.workspace_id,
      user_id: user.id,
      event_type: "audit_created",
      quantity: 1,
      metadata: {
        audit_id: auditRow.id,
        listing_id: listingRow.id,
        source_url: extracted.url ?? listingRow.source_url,
      },
    });

    if (usageError) {
      console.warn("Failed to record usage event from /api/audits:", usageError);
    }

    return NextResponse.json({ auditId: auditRow.id });
  } catch (error) {
    console.error("Failed to run audit for listing:", error);

    return NextResponse.json(
      {
        error: "Failed to run audit",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
