import { NextRequest, NextResponse } from "next/server";
import { listListingsWithLatestAudit } from "@/lib/mock-db";
import { extractListing } from "@/lib/extractors";
import { searchCompetitorsAroundTarget } from "@/lib/competitors/searchCompetitors";
import { runAudit } from "@/ai/runAudit";
import { supabase } from "@/lib/supabase";
import { canCreateAudit } from "@/lib/billing/canCreateAudit";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("listings")
    .select(`
      id,
      workspace_id,
      source_platform,
      source_url,
      title,
      city,
      country,
      price,
      currency,
      rating,
      reviews_count,
      created_at,
      audits (
        id,
        overall_score,
        listing_quality_index,
        market_score,
        potential_score,
        created_at
      )
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch listings" },
      { status: 500 }
    );
  }

  const listings = (data ?? []).map((item: any) => {
    const latestAudit = Array.isArray(item.audits)
      ? [...item.audits].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
      : null;

    return {
      id: item.id,
      workspaceId: item.workspace_id,
      url: item.source_url,
      platform: item.source_platform,
      title: item.title,
      city: item.city,
      country: item.country,
      price: item.price,
      currency: item.currency,
      rating: item.rating,
      reviewsCount: item.reviews_count,
      createdAt: item.created_at,
      latestAudit: latestAudit
        ? {
            id: latestAudit.id,
            overallScore: latestAudit.overall_score,
            listingQualityIndex: latestAudit.listing_quality_index,
            marketScore: latestAudit.market_score,
            potentialScore: latestAudit.potential_score,
            createdAt: latestAudit.created_at,
          }
        : null,
    };
  });

  return NextResponse.json({ listings });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    url?: string;
    title?: string;
    platform?: string;
    workspaceId?: string;
    userId?: string;
  };

  if (!body.url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  if (!body.workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    // 1. Server-side quota check
    const quota = await canCreateAudit(body.workspaceId);

    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: quota.reason || "Free plan limit reached",
          code: "FREE_PLAN_LIMIT_REACHED",
          quota,
        },
        { status: 403 }
      );
    }

    // 2. Extract listing data
    const extracted = await extractListing(body.url);

    // 3. Search competitors
    const competitorBundle = await searchCompetitorsAroundTarget({
      target: extracted,
      maxResults: 15,
      radiusKm: 1,
    });

    // 4. Run audit
    const auditResult = await runAudit({
      target: extracted,
      competitors: competitorBundle.competitors,
    });

    // 5. Persist listing in Supabase
    const { data: listingRow, error: listingError } = await supabase
      .from("listings")
      .insert({
        workspace_id: body.workspaceId,
        created_by: body.userId,
        source_platform: body.platform ?? extracted.platform ?? null,
        source_url: extracted.url ?? body.url,
        title: body.title ?? extracted.title ?? "Untitled listing",
        // Ces champs ne semblent pas exister dans ton type ExtractedListing
        city: null,
        country: null,
        price: extracted.price ?? null,
        currency: extracted.currency ?? null,
        rating: extracted.rating ?? null,
        reviews_count: extracted.reviewCount ?? null,
        raw_payload: extracted,
      })
      .select()
      .single();

    if (listingError || !listingRow) {
      throw new Error(listingError?.message || "Failed to create listing");
    }

    // 6. Persist audit in Supabase
    const { data: auditRow, error: auditError } = await supabase
      .from("audits")
      .insert({
        workspace_id: body.workspaceId,
        listing_id: listingRow.id,
        created_by: body.userId,
       overall_score: auditResult.overallScore ?? null,
        listing_quality_index: auditResult.listingQualityIndex?.score ?? null,
        market_score: auditResult.marketPosition?.score ?? null,
        // si potentialScore n’existe pas dans ton type, on fallback proprement
        potential_score:
          auditResult.listingQualityIndex?.components?.conversionPotential ?? null,
        booking_lift_low: auditResult.estimatedBookingLift?.low ?? null,
        booking_lift_high: auditResult.estimatedBookingLift?.high ?? null,
        revenue_impact_low:
          auditResult.estimatedRevenueImpact?.lowMonthly ?? null,
        revenue_impact_high:
          auditResult.estimatedRevenueImpact?.highMonthly ?? null,
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

    // 7. Record usage event (best effort)
    const { error: usageError } = await supabase.from("usage_events").insert({
      workspace_id: body.workspaceId,
      user_id: body.userId,
      event_type: "audit_created",
      quantity: 1,
      metadata: {
        audit_id: auditRow.id,
        listing_id: listingRow.id,
        source_url: extracted.url ?? body.url,
      },
    });

    if (usageError) {
      console.warn("Failed to record usage event:", usageError);
    }

    // 8. Response shape kept compatible with current UI
    const listing = {
      id: listingRow.id,
      url: listingRow.source_url,
      title: listingRow.title,
      platform: listingRow.source_platform,
      description: extracted.description,
      amenities: extracted.amenities,
      photos: extracted.photos,
      createdAt: listingRow.created_at,
      workspaceId: listingRow.workspace_id,
    };

    const audit = {
      id: auditRow.id,
      listingId: listingRow.id,
      url: listingRow.source_url,
      title: listingRow.title,
      platform: listingRow.source_platform,
      result: auditResult,
      competitorsMeta: {
        attempted: competitorBundle.attempted,
        selected: competitorBundle.selected,
        radiusKm: competitorBundle.radiusKm,
        maxResults: competitorBundle.maxResults,
      },
      createdAt: auditRow.created_at,
      workspaceId: auditRow.workspace_id,
    };

    return NextResponse.json({
      listing,
      audit,
      auditId: auditRow.id,
    });
  } catch (error) {
    console.error("Audit generation failed:", error);

    return NextResponse.json(
      {
        error: "Failed to generate audit",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}