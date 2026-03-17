import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractListing } from "@/lib/extractors";
import { searchCompetitorsAroundTarget } from "@/lib/competitors/searchCompetitors";
import { runAudit } from "@/ai/runAudit";
import { canCreateAudit } from "@/lib/billing/canCreateAudit";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    listingId?: string;
  };

  if (!body.listingId) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  }

  try {
    const { data: listingRow, error: listingError } = await supabase
      .from("listings")
      .select("id, workspace_id, created_by, source_url, source_platform")
      .eq("id", body.listingId)
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
    const quota = await canCreateAudit(listingRow.workspace_id);

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

    // 5. Persist audit in Supabase (reuse structure from /api/listings)
    const { data: auditRow, error: auditError } = await supabase
      .from("audits")
      .insert({
        workspace_id: listingRow.workspace_id,
        listing_id: listingRow.id,
        created_by: listingRow.created_by,
        overall_score: auditResult.overallScore ?? null,
        listing_quality_index: auditResult.listingQualityIndex?.score ?? null,
        market_score: auditResult.marketPosition?.score ?? null,
        potential_score:
          auditResult.listingQualityIndex?.components?.conversionPotential ?? null,
        booking_lift_low: auditResult.estimatedBookingLift?.low ?? null,
        booking_lift_high: auditResult.estimatedBookingLift?.high ?? null,
        revenue_impact_low: auditResult.estimatedRevenueImpact?.lowMonthly ?? null,
        revenue_impact_high: auditResult.estimatedRevenueImpact?.highMonthly ?? null,
        result_payload: {
          ...auditResult,
          competitorsMeta: {
            attempted: competitorBundle.attempted,
            selected: competitorBundle.selected,
            radiusKm: competitorBundle.radiusKm,
            maxResults: competitorBundle.maxResults,
          },
        },
      })
      .select()
      .single();

    if (auditError || !auditRow) {
      throw new Error(auditError?.message || "Failed to create audit");
    }

    // 6. Record usage event (best effort)
    const { error: usageError } = await supabase.from("usage_events").insert({
      workspace_id: listingRow.workspace_id,
      user_id: listingRow.created_by,
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
