import { NextRequest, NextResponse } from "next/server";
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import {
  buildStructuredAuditPayloadFromPreview,
  type StructuredAuditResultPayload,
} from "@/lib/audits/formatResultPayload";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type ListingPostRow = {
  id: string;
  workspace_id: string;
  source_platform: string | null;
  source_url: string | null;
  title: string | null;
  created_at: string;
};

type ExistingAuditRow = {
  id: string;
  created_at: string;
  result_payload: StructuredAuditResultPayload | null;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    url?: string;
    title?: string;
    platform?: string;
    generatedAt?: string;
    preview?: {
      score?: number;
      summary?: string | null;
      insights?: string[];
      recommendations?: string[];
      marketPositioning?: {
        comparableCount?: number;
        status?: string;
      } | null;
      subScores?: Array<{
        key?: string;
        score?: number | null;
      }>;
      [key: string]: unknown;
    };
  };

  if (!body.url || !body.preview) {
    return NextResponse.json({ error: "Missing restore payload" }, { status: 400 });
  }

  const { client, user, workspace } = await getRequestUserAndWorkspace(request);

  if (!user || !client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const normalizedUrl = normalizeSourceUrl(body.url);

    const { data: existingListings, error: existingListingsError } = await client
      .from("listings")
      .select("id, workspace_id, source_platform, source_url, title, created_at")
      .eq("workspace_id", workspace.id);

    if (existingListingsError) {
      throw new Error(
        existingListingsError.message || "Impossible de verifier les annonces existantes"
      );
    }

    const existingListing = ((existingListings ?? []) as ListingPostRow[]).find(
      (listing) => normalizeSourceUrl(listing.source_url) === normalizedUrl
    );

    let listingRow: ListingPostRow | null = existingListing ?? null;

    if (!listingRow) {
      const { data: createdListing, error: listingError } = await client
        .from("listings")
        .insert({
          workspace_id: workspace.id,
          created_by: user.id,
          source_platform: body.platform ?? null,
          source_url: body.url,
          title: body.title ?? "Annonce sans titre",
          city: null,
          country: null,
          price: null,
          currency: null,
          rating: null,
          reviews_count: null,
          raw_payload: body.preview,
        })
        .select("id, workspace_id, source_platform, source_url, title, created_at")
        .single();

      if (listingError || !createdListing) {
        throw new Error(listingError?.message || "Impossible de creer l'annonce");
      }

      listingRow = createdListing as ListingPostRow;
    }

    if (!listingRow) {
      throw new Error("Impossible de charger l'annonce");
    }

    const structuredPayload = buildStructuredAuditPayloadFromPreview(body.preview);

    const { data: latestAuditRows, error: latestAuditError } = await client
      .from("audits")
      .select("id, created_at, result_payload")
      .eq("workspace_id", workspace.id)
      .eq("listing_id", listingRow.id)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestAuditError) {
      throw new Error(latestAuditError.message || "Impossible de verifier les audits existants");
    }

    const latestAudit = Array.isArray(latestAuditRows)
      ? ((latestAuditRows[0] as ExistingAuditRow | undefined) ?? null)
      : null;

    if (
      latestAudit?.id &&
      latestAudit.result_payload &&
      JSON.stringify(latestAudit.result_payload) === JSON.stringify(structuredPayload)
    ) {
      return NextResponse.json({ auditId: latestAudit.id, restored: true });
    }

    const { data: auditRow, error: auditError } = await client
      .from("audits")
      .insert({
        workspace_id: workspace.id,
        listing_id: listingRow.id,
        created_by: user.id,
        overall_score: structuredPayload.score,
        listing_quality_index: structuredPayload.scoreBreakdown.photos,
        market_score: structuredPayload.market.score,
        potential_score: structuredPayload.business.bookingPotential,
        booking_lift_low: null,
        booking_lift_high: null,
        revenue_impact_low: structuredPayload.business.estimatedRevenueLow,
        revenue_impact_high: structuredPayload.business.estimatedRevenueHigh,
        result_payload: structuredPayload,
      })
      .select("id")
      .single();

    if (auditError || !auditRow) {
      throw new Error(auditError?.message || "Impossible de persister l'audit");
    }

    return NextResponse.json({ auditId: auditRow.id, restored: false });
  } catch (error) {
    console.error("Failed to restore paid guest audit", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de persister l'audit paye",
      },
      { status: 500 }
    );
  }
}
