import { NextRequest, NextResponse } from "next/server";
import { listListingsWithLatestAudit } from "@/lib/mock-db";
import { extractListing } from "@/lib/extractors";
import { searchCompetitorsAroundTarget } from "@/lib/competitors/searchCompetitors";
import { runAudit } from "@/ai/runAudit";

export async function GET() {
  const listings = listListingsWithLatestAudit();
  return NextResponse.json({ listings });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    url?: string;
    title?: string;
    platform?: string;
  };

  if (!body.url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const extracted = await extractListing(body.url);

    const competitorBundle = await searchCompetitorsAroundTarget({
      target: extracted,
      maxResults: 15,
      radiusKm: 1,
    });

    const auditResult = await runAudit({
      target: extracted,
      competitors: competitorBundle.competitors,
    });

    const listing = {
      id: `listing_${Date.now()}`,
      url: extracted.url,
      title: body.title ?? extracted.title ?? "Untitled listing",
      platform: body.platform ?? extracted.platform,
      description: extracted.description,
      amenities: extracted.amenities,
      photos: extracted.photos,
      createdAt: new Date().toISOString(),
    };

    const audit = {
      id: `audit_${Date.now()}`,
      listingId: listing.id,
      url: extracted.url,
      title: listing.title,
      platform: listing.platform,
      result: auditResult,
      competitorsMeta: {
        attempted: competitorBundle.attempted,
        selected: competitorBundle.selected,
        radiusKm: competitorBundle.radiusKm,
        maxResults: competitorBundle.maxResults,
      },
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      listing,
      audit,
      auditId: audit.id,
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