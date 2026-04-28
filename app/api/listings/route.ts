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
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type ListingSummaryRow = {
  id: string;
  workspace_id: string;
  source_platform: string | null;
  source_url: string | null;
  title: string | null;
  city: string | null;
  country: string | null;
  price: number | null;
  currency: string | null;
  rating: number | null;
  reviews_count: number | null;
  created_at: string;
  audits:
    | {
        id: string;
        overall_score: number | null;
        listing_quality_index: number | null;
        market_score: number | null;
        potential_score: number | null;
        created_at: string;
      }[]
    | null;
};

type ListingPostRow = {
  id: string;
  workspace_id: string;
  source_platform: string | null;
  source_url: string | null;
  title: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");

  const { client, user, workspace } = await getRequestUserAndWorkspace(request);

  if (!user || !client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (workspaceId && workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Forbidden workspace" }, { status: 403 });
  }

  const { data, error } = await client
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
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch listings" },
      { status: 500 }
    );
  }

  const listings = ((data ?? []) as ListingSummaryRow[]).map((item) => {
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
  };

  if (!body.url) {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  const { client, user, workspace } = await getRequestUserAndWorkspace(request);

  if (!user || !client) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!workspace) {
    return NextResponse.json({ error: "Workspace introuvable" }, { status: 404 });
  }

  if (body.workspaceId && body.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Workspace interdit" }, { status: 403 });
  }

  try {
    // 1. Server-side quota check
    const quota = await canCreateAudit(workspace.id, client);

    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: quota.reason || "Limite du plan Gratuit atteinte",
          code: "FREE_PLAN_LIMIT_REACHED",
          quota,
        },
        { status: 403 }
      );
    }

    const credits = await getWorkspaceAuditCredits(workspace.id, client);

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

    console.info("[api/listings] generated audit payload", {
      workspaceId: workspace.id,
      sourceUrl: extracted.url ?? body.url,
      ...summarizeStructuredAuditPayload(
        buildStructuredAuditPayloadFromRunAudit({
          auditResult,
          target: extracted,
        })
      ),
    });

    // 5. Reuse existing listing for the same workspace + public URL when possible
    const normalizedUrl = normalizeSourceUrl(extracted.url ?? body.url);

    const { data: existingListings, error: existingListingsError } = await client
      .from("listings")
      .select("id, workspace_id, source_platform, source_url, title, created_at")
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null);

    if (existingListingsError) {
      throw new Error(
        existingListingsError.message || "Impossible de vérifier les annonces existantes"
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
          source_platform: body.platform ?? extracted.platform ?? null,
          source_url: extracted.url ?? body.url,
          title: body.title ?? extracted.title ?? "Annonce sans titre",
          city: null,
          country: null,
          price: extracted.price ?? null,
          currency: extracted.currency ?? null,
          rating: extracted.rating ?? null,
          reviews_count: extracted.reviewCount ?? null,
          raw_payload: extracted,
        })
        .select("id, workspace_id, source_platform, source_url, title, created_at")
        .single();

      if (listingError || !createdListing) {
        throw new Error(listingError?.message || "Impossible de créer l’annonce");
      }

      listingRow = createdListing as ListingPostRow;
    }

    if (!listingRow) {
      throw new Error("Impossible de charger l’annonce");
    }

    const structuredPayload = buildStructuredAuditPayloadFromRunAudit({
      auditResult,
      target: extracted,
    });

    // 6. Persist audit in Supabase
    const { data: auditRow, error: auditError } = await client
      .from("audits")
      .insert({
        workspace_id: workspace.id,
        listing_id: listingRow.id,
        created_by: user.id,
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
        result_payload: structuredPayload,
      })
      .select()
      .single();

    if (auditError || !auditRow) {
      throw new Error(auditError?.message || "Failed to create audit");
    }

    const { data: consumeLedgerRow, error: consumeLedgerError } = await client
      .from("usage_events")
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        event_type: "audit_credit_consumed",
        quantity: 1,
        metadata: {
          audit_id: auditRow.id,
          listing_id: listingRow.id,
          source_url: extracted.url ?? body.url,
          source: "api_listings_create",
        },
      })
      .select("id")
      .single();

    if (consumeLedgerError) {
      const code =
        typeof consumeLedgerError === "object" && consumeLedgerError !== null && "code" in consumeLedgerError
          ? String((consumeLedgerError as { code?: string }).code)
          : "";
      if (code === "23505") {
        await client.from("audits").delete().eq("id", auditRow.id);
        return NextResponse.json(
          {
            error: "Ce débit de crédit est déjà enregistré pour cet audit.",
            code: "audit_credit_already_recorded",
          },
          { status: 409 }
        );
      }
      await client.from("audits").delete().eq("id", auditRow.id);
      throw new Error(consumeLedgerError.message || "Failed to record credit consumption ledger");
    }

    const creditConsumption = await consumeWorkspaceAuditCredits(
      workspace.id,
      client,
      1
    );

    if (!creditConsumption.success) {
      if (consumeLedgerRow?.id) {
        await client.from("usage_events").delete().eq("id", consumeLedgerRow.id);
      }
      const { error: deleteAuditError } = await client
        .from("audits")
        .delete()
        .eq("id", auditRow.id);

      if (deleteAuditError) {
        console.error("[api/listings] failed to rollback audit after credit lock failure", {
          workspaceId: workspace.id,
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

    const { data: persistedAudit, error: persistedAuditError } = await client
      .from("audits")
      .select("id, result_payload")
      .eq("id", auditRow.id)
      .maybeSingle();

    if (persistedAuditError) {
      console.warn("[api/listings] failed to reload persisted audit", persistedAuditError);
    } else {
      console.info("[api/listings] persisted audit payload", {
        auditId: auditRow.id,
        ...summarizeStructuredAuditPayload(persistedAudit?.result_payload),
      });
    }

    const { error: usageError } = await client.from("usage_events").insert({
      workspace_id: workspace.id,
      user_id: user.id,
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
