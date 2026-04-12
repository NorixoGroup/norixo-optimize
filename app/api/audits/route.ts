import { NextRequest, NextResponse } from "next/server";
import { extractListing } from "@/lib/extractors";
import { searchCompetitorsAroundTarget } from "@/lib/competitors/searchCompetitors";
import { runAudit } from "@/ai/runAudit";
import { canCreateAudit } from "@/lib/billing/canCreateAudit";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
import {
  consumeWorkspaceAuditCredits,
  NO_AUDIT_CREDITS_MESSAGE,
} from "@/lib/billing/consumeWorkspaceAuditCredits";
import {
  buildStructuredAuditPayloadFromRunAudit,
  summarizeStructuredAuditPayload,
} from "@/lib/audits/formatResultPayload";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

// ✅ NEW
import { normalizeListing } from "@/lib/audits/normalizeListing";
import { computeScore } from "@/lib/audits/computeScore";

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

    console.log("[AUDIT API DEBUG]", {
      workspaceId: workspace.id,
      userId: user.id,
    });

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

    const credits = await getWorkspaceAuditCredits(listingRow.workspace_id, client);

    if (credits.available < 1) {
      return NextResponse.json(
        {
          error: NO_AUDIT_CREDITS_MESSAGE,
          code: "quota_exceeded",
          credits,
        },
        { status: 403 }
      );
    }

    // ✅ QUOTA CHECK
    const quota = await canCreateAudit(listingRow.workspace_id, client);

    console.log("[AUDIT API DECISION]", {
      resolvedPlan: quota.planCode,
      auditCount: quota.currentCount,
      limit: quota.limit,
      canCreateAudit: quota.allowed,
    });

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

    // ✅ 1. Extraction
    const extractedRaw = await extractListing(listingRow.source_url as string);

    // ✅ 2. NORMALIZATION (ANTI BUG + STRUCTURE)
    const extracted = normalizeListing(extractedRaw);

    // ✅ 3. Competitors
    const competitorBundle = await searchCompetitorsAroundTarget({
      target: extracted,
      maxResults: 15,
      radiusKm: 1,
    });

    // ✅ 4. AI AUDIT (ton système actuel)
    const auditResult = await runAudit({
      target: extracted,
      competitors: competitorBundle.competitors,
    });

    // ✅ 5. SCORE ENGINE (NOUVEAU - SAFE)
    const computedScore = computeScore(extracted);

    console.log("[SCORE ENGINE]", computedScore);

    // ✅ 6. PAYLOAD
    const structuredPayload = buildStructuredAuditPayloadFromRunAudit({
      auditResult,
      target: extracted,
    });

    console.info("[api/audits] generated audit payload", {
      listingId: listingRow.id,
      workspaceId: listingRow.workspace_id,
      ...summarizeStructuredAuditPayload(structuredPayload),
    });

    // ✅ 7. INSERT (AVEC FALLBACK SAFE)
    const { data: auditRow, error: auditError } = await client
      .from("audits")
      .insert({
        workspace_id: listingRow.workspace_id,
        listing_id: listingRow.id,
        created_by: user.id,

        // ⚠️ fallback computeScore si IA vide
        overall_score:
          auditResult.overallScore ??
          computedScore.overallScore ??
          null,

        listing_quality_index:
          auditResult.listingQualityIndex?.score ??
          computedScore.listingQuality ??
          null,

        market_score:
          auditResult.marketPosition?.score ?? null,

        potential_score:
          auditResult.listingQualityIndex?.components?.conversionPotential ??
          computedScore.conversion ??
          null,

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

    const creditConsumption = await consumeWorkspaceAuditCredits(
      listingRow.workspace_id,
      client,
      1
    );

    if (!creditConsumption.success) {
      const { error: deleteAuditError } = await client
        .from("audits")
        .delete()
        .eq("id", auditRow.id);

      if (deleteAuditError) {
        console.error("[api/audits] failed to rollback audit after credit lock failure", {
          workspaceId: listingRow.workspace_id,
          auditId: auditRow.id,
          deleteAuditError,
        });
      }

      return NextResponse.json(
        {
          error: NO_AUDIT_CREDITS_MESSAGE,
          code: "quota_exceeded",
        },
        { status: 403 }
      );
    }

    // ✅ DEBUG DB WRITE
    const { data: persistedAudit } = await client
      .from("audits")
      .select("id, overall_score, result_payload")
      .eq("id", auditRow.id)
      .maybeSingle();

    console.info("[DB CHECK]", persistedAudit);

    // ✅ USAGE EVENTS (journal secondaire)
    const { error: usageError } = await client.from("usage_events").insert([
      {
        workspace_id: listingRow.workspace_id,
        user_id: user.id,
        event_type: "audit_created",
        quantity: 1,
        metadata: {
          audit_id: auditRow.id,
          listing_id: listingRow.id,
        },
      },
      {
        workspace_id: listingRow.workspace_id,
        user_id: user.id,
        event_type: "audit_credit_consumed",
        quantity: 1,
        metadata: {
          audit_id: auditRow.id,
          listing_id: listingRow.id,
          source: "api_audits_create",
        },
      },
    ]);

    if (usageError) {
      console.warn("[api/audits] failed to record usage events", {
        workspaceId: listingRow.workspace_id,
        auditId: auditRow.id,
        usageError,
      });
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
