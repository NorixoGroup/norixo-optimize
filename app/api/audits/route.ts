import { NextRequest, NextResponse } from "next/server";
import { extractListing } from "@/lib/extractors";
import {
  BOOKING_EXTRACTION_UNAVAILABLE_BODY,
  isUnreliableBookingExtraction,
  logBookingTargetExtractionUnreliableNoCredit,
  logBookingTargetExtractionUnreliable,
} from "@/lib/extractors/bookingExtractionReliability";
import { searchAirbnbCompetitorCandidates } from "@/lib/competitors/airbnb-search";
import {
  enrichAirbnbCompetitorPrices,
  searchCompetitorsAroundTarget,
} from "@/lib/competitors/searchCompetitors";
import type { ExtractedListing } from "@/lib/extractors/types";
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
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

// ✅ NEW
import { normalizeListing } from "@/lib/audits/normalizeListing";
import { normalizeListing as normalizeListingForScoring } from "@/lib/listings/normalizeListing";
import { computeScore } from "@/lib/audits/computeScore";
import { logMarketPipelineStage } from "@/lib/competitors/marketPipelineDebug";
import { auditPerfLog } from "@/lib/audits/auditPerfLog";
import {
  mapPropertyTypeOverrideToListingPropertyType,
  parsePropertyTypeOverride,
  type PropertyTypeOverrideSlug,
} from "@/lib/listings/propertyTypeOverrideOptions";
import { saveMarketSnapshot } from "@/lib/marketMemory/saveMarketSnapshot";

type AuditTargetTitleFlowPayload = {
  stage: string;
  url: string | null;
  extractedRawTitle: string | null;
  normalizedTitle: string | null;
  payloadTitle: string | null;
  dbTitle: string | null;
  fallbackTargetMode: boolean;
  hasChallengeSignal: boolean;
  propertyTypeOverride: string | null;
};

function logAuditTargetTitleFlow(payload: AuditTargetTitleFlowPayload) {
  console.log("[audit][target-title-flow]", JSON.stringify(payload));
}

function logAuditBookingUrlTitleCandidate(url: string | null) {
  if (!url) {
    console.log(
      "[audit][booking-url-title-candidate]",
      JSON.stringify({ url: null, pathname: null, slug: null, derivedTitleCandidate: null })
    );
    return;
  }
  try {
    const u = new URL(url);
    const pathname = u.pathname;
    const segments = pathname.split("/").filter(Boolean);
    const slug = segments.length > 0 ? (segments[segments.length - 1] ?? "") : "";
    const derivedTitleCandidate =
      slug && slug.toLowerCase() !== "html"
        ? decodeURIComponent(slug.replace(/\+/g, " "))
            .replace(/-/g, " ")
            .replace(/_/g, " ")
            .slice(0, 240)
        : null;
    console.log(
      "[audit][booking-url-title-candidate]",
      JSON.stringify({ url, pathname, slug: slug || null, derivedTitleCandidate })
    );
  } catch {
    console.log(
      "[audit][booking-url-title-candidate]",
      JSON.stringify({ url, pathname: null, slug: null, derivedTitleCandidate: null })
    );
  }
}

function airbnbQueryTokenFromPropertyOverride(slug: PropertyTypeOverrideSlug): string {
  switch (slug) {
    case "studio":
      return "studio";
    case "apartment":
      return "apartment";
    case "villa":
      return "villa";
    case "riad":
      return "riad";
    case "room":
      return "room";
    case "hotel":
      return "hotel";
    default:
      return "studio";
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    listingId?: string;
    marketCountryOverride?: string | null;
    marketCityOverride?: string | null;
    propertyTypeOverride?: string | null;
  };

  if (!body.listingId) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  }

  const marketCountryOverrideBody =
    typeof body.marketCountryOverride === "string" ? body.marketCountryOverride.trim() : "";
  const marketCityOverrideBody =
    typeof body.marketCityOverride === "string" ? body.marketCityOverride.trim() : "";

  console.log(
    "[api/audits][geo-overrides-body]",
    JSON.stringify({
      marketCountryOverride: marketCountryOverrideBody || null,
      marketCityOverride: marketCityOverrideBody || null,
      listingId: body.listingId,
    })
  );

  let auditPerfT0: number | null = null;

  try {
    auditPerfT0 = Date.now();
    let fallbackTargetMode = false;
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

    const billingAdminBypass = isAdminPrivateEmail(user.email);

    const { data: listingRow, error: listingError } = await client
      .from("listings")
      .select(
        "id, workspace_id, created_by, source_url, source_platform, market_country_override, market_city_override"
      )
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

    if (!billingAdminBypass) {
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
    } else {
      console.info("[billing][gate][admin_bypass]", {
        userId: user.id,
        workspaceId: listingRow.workspace_id,
        email: user.email ?? null,
      });
    }

    const isBookingListing =
      String(listingRow.source_platform ?? "").toLowerCase() === "booking" ||
      /booking\./i.test(String(listingRow.source_url ?? ""));
    const competitorMaxResults = isBookingListing ? 4 : 15;

    const rowCountry =
      typeof listingRow.market_country_override === "string"
        ? listingRow.market_country_override.trim()
        : "";
    const rowCity =
      typeof listingRow.market_city_override === "string"
        ? listingRow.market_city_override.trim()
        : "";
    const effectiveMarketCountryOverride =
      marketCountryOverrideBody || rowCountry || null;
    const effectiveMarketCityOverride = marketCityOverrideBody || rowCity || null;
    const propertyTypeOverride = parsePropertyTypeOverride(body.propertyTypeOverride);

    console.log(
      "[api/audits][geo-overrides-effective]",
      JSON.stringify({
        effectiveMarketCountryOverride,
        effectiveMarketCityOverride,
        listingId: listingRow.id,
      })
    );

    const marketComparables =
      effectiveMarketCountryOverride && effectiveMarketCityOverride
        ? { city: effectiveMarketCityOverride, country: effectiveMarketCountryOverride }
        : undefined;

    const auditTitleFlowUrl = listingRow.source_url ?? null;
    if (isBookingListing && auditTitleFlowUrl) {
      logAuditBookingUrlTitleCandidate(auditTitleFlowUrl);
    }

    // ✅ 1. Extraction
    console.time("[audit] phase:extract_target");
    const targetExtractT0 = Date.now();
    const extractedRaw = await extractListing(listingRow.source_url as string);
    const targetExtractMs = Date.now() - targetExtractT0;
    console.timeEnd("[audit] phase:extract_target");
    auditPerfLog({
      step: "target-extraction",
      durationMs: targetExtractMs,
      countIn: null,
      countOut: null,
      platform: extractedRaw.platform ?? null,
      note: null,
    });

    const titleFlowWarnings = Array.isArray(extractedRaw.extractionMeta?.warnings)
      ? extractedRaw.extractionMeta.warnings
      : [];
    const titleFlowHasChallengeSignal = titleFlowWarnings.includes("booking_challenge_detected");
    const extractedRawTitleFrozen =
      typeof extractedRaw.title === "string" ? extractedRaw.title : null;
    const propertyTypeOverrideLog = propertyTypeOverride ?? null;

    logAuditTargetTitleFlow({
      stage: "after_extract_raw",
      url: auditTitleFlowUrl,
      extractedRawTitle: extractedRawTitleFrozen,
      normalizedTitle: null,
      payloadTitle: null,
      dbTitle: null,
      fallbackTargetMode,
      hasChallengeSignal: titleFlowHasChallengeSignal,
      propertyTypeOverride: propertyTypeOverrideLog,
    });

    if (isUnreliableBookingExtraction(extractedRaw)) {
      const extractionWarnings = Array.isArray(extractedRaw.extractionMeta?.warnings)
        ? extractedRaw.extractionMeta.warnings
        : [];
      const hasChallengeSignal = extractionWarnings.includes("booking_challenge_detected");
      const challenge = hasChallengeSignal && extractedRaw.price == null;

      logBookingTargetExtractionUnreliable(
        "api_audits",
        listingRow.source_url ?? null,
        extractedRaw
      );

      if (propertyTypeOverride == null) {
        console.warn(
          "[audit][target-extraction-blocked-before-comparables]",
          JSON.stringify({
            route: "api_audits",
            platform: extractedRaw.platform ?? null,
            url: listingRow.source_url ?? null,
            title: extractedRaw.title ?? null,
            price:
              typeof extractedRaw.price === "number" && Number.isFinite(extractedRaw.price)
                ? extractedRaw.price
                : null,
            rawStayPrice:
              typeof extractedRaw.rawStayPrice === "number" &&
              Number.isFinite(extractedRaw.rawStayPrice)
                ? extractedRaw.rawStayPrice
                : null,
            stayNights:
              typeof extractedRaw.stayNights === "number" &&
              Number.isFinite(extractedRaw.stayNights)
                ? extractedRaw.stayNights
                : null,
            hasChallengeSignal,
            challenge,
            targetType: extractedRaw.propertyType ?? null,
            propertyTypeOverride: null,
            reason: "target-extraction-unreliable-no-override",
            competitorsStepReached: false,
            fallbackStepReached: false,
          })
        );
        logBookingTargetExtractionUnreliableNoCredit({
          route: "api_audits",
          url: listingRow.source_url ?? null,
          reason: "target-extraction-unreliable",
        });
        return NextResponse.json({ ...BOOKING_EXTRACTION_UNAVAILABLE_BODY }, { status: 503 });
      }

      fallbackTargetMode = true;
      console.warn(
        "[audit][fallback-target-mode-enabled]",
        JSON.stringify({
          url: listingRow.source_url ?? null,
          platform: extractedRaw.platform ?? null,
          propertyTypeOverride,
          hasChallengeSignal,
          reason: "target-extraction-unreliable-airbnb-comparables-only",
        })
      );
    }

    // ✅ 2. NORMALIZATION (ANTI BUG + STRUCTURE)
    const extracted = normalizeListing(extractedRaw);

    logAuditTargetTitleFlow({
      stage: "after_normalize",
      url: auditTitleFlowUrl,
      extractedRawTitle: extractedRawTitleFrozen,
      normalizedTitle: typeof extracted.title === "string" ? extracted.title : null,
      payloadTitle: null,
      dbTitle: null,
      fallbackTargetMode,
      hasChallengeSignal: titleFlowHasChallengeSignal,
      propertyTypeOverride: propertyTypeOverrideLog,
    });

    const listingSyncPatch: Record<string, unknown> = {
      raw_payload: extractedRaw,
    };
    if (typeof extractedRaw.title === "string" && extractedRaw.title.trim()) {
      listingSyncPatch.title = extractedRaw.title.trim();
    }
    if (effectiveMarketCountryOverride) {
      listingSyncPatch.market_country_override = effectiveMarketCountryOverride;
    }
    if (effectiveMarketCityOverride) {
      listingSyncPatch.market_city_override = effectiveMarketCityOverride;
    }
    const { error: listingSyncError } = await client
      .from("listings")
      .update(listingSyncPatch)
      .eq("id", listingRow.id)
      .eq("workspace_id", workspace.id);
    if (listingSyncError) {
      console.warn("[api/audits] failed to sync listing after extract", listingSyncError);
    }

    // ✅ 3. Competitors
    console.time("[audit] phase:competitors");
    const challengeOnBookingTarget =
      isBookingListing &&
      extractedRaw.platform === "booking" &&
      Array.isArray(extractedRaw.extractionMeta?.warnings) &&
      extractedRaw.extractionMeta.warnings.includes("booking_challenge_detected") &&
      extractedRaw.price == null;

    let competitorBundle: Awaited<ReturnType<typeof searchCompetitorsAroundTarget>>;
    if (fallbackTargetMode && isBookingListing && propertyTypeOverride != null) {
      const preservedTargetPrice =
        typeof extracted.price === "number" && Number.isFinite(extracted.price)
          ? extracted.price
          : null;
      const typeToken = airbnbQueryTokenFromPropertyOverride(propertyTypeOverride);
      const srcUrl = listingRow.source_url ?? "";
      const urlLow = srcUrl.toLowerCase();

      let city =
        effectiveMarketCityOverride && effectiveMarketCityOverride.trim()
          ? effectiveMarketCityOverride.trim()
          : null;
      let country =
        effectiveMarketCountryOverride && effectiveMarketCountryOverride.trim()
          ? effectiveMarketCountryOverride.trim()
          : null;
      let usedMoroccoHeuristic = false;

      const moroccoFromBookingUrl =
        /\/hotel\/ma\//i.test(srcUrl) ||
        /\.ma\//i.test(urlLow) ||
        /\bmarrakech\b|\bmarrakesh\b/i.test(urlLow);

      let marrakechSlugSignals = false;
      try {
        const path = decodeURIComponent(new URL(srcUrl).pathname).toLowerCase();
        marrakechSlugSignals =
          /\bmarrakech\b|\bmarrakesh\b/.test(path) ||
          path.includes("gueliz") ||
          path.includes("carre-eden");
      } catch {
        marrakechSlugSignals =
          /\bmarrakech\b|\bmarrakesh\b/i.test(urlLow) ||
          urlLow.includes("gueliz") ||
          urlLow.includes("carre-eden");
      }

      const moroccoDetected = moroccoFromBookingUrl || marrakechSlugSignals;

      let airbnbQuery = [typeToken, city, country]
        .filter((p): p is string => Boolean(p && p.trim()))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      let locationLabelForAirbnb = [city, country].filter(Boolean).join(", ").trim() || null;

      const queryIsOnlyTypeToken =
        airbnbQuery === typeToken ||
        airbnbQuery.toLowerCase() === typeToken.toLowerCase();

      if (moroccoDetected && !city && !country) {
        usedMoroccoHeuristic = true;
        city = "Marrakech";
        country = "Morocco";
        airbnbQuery = `${typeToken} Marrakech Morocco`.trim();
        locationLabelForAirbnb = "Marrakech, Morocco";
      } else if (moroccoDetected && queryIsOnlyTypeToken) {
        usedMoroccoHeuristic = true;
        airbnbQuery = `${typeToken} Marrakech Morocco`.trim();
        locationLabelForAirbnb = locationLabelForAirbnb || "Marrakech, Morocco";
      }

      if (!airbnbQuery) {
        airbnbQuery = typeToken;
      }
      const titleForAirbnb = /^untitled/i.test(airbnbQuery)
        ? `${typeToken} vacation rental`
        : airbnbQuery;
      const locationLabelResolved =
        locationLabelForAirbnb ??
        (usedMoroccoHeuristic ? "Marrakech, Morocco" : null);

      console.warn(
        "[audit][fallback-target-airbnb-query]",
        JSON.stringify({
          query: airbnbQuery,
          city,
          country,
          propertyTypeOverride,
          source: "fallback_target_mode",
          usedMoroccoHeuristic,
          locationLabel: locationLabelResolved,
        })
      );

      const airbnbSearchTarget: ExtractedListing = {
        ...extracted,
        title: titleForAirbnb,
        locationLabel: locationLabelResolved ?? undefined,
        price: preservedTargetPrice,
        rawStayPrice: null,
        stayNights: null,
        priceBasis: preservedTargetPrice != null ? extracted.priceBasis ?? "unknown" : "unknown",
        propertyType: mapPropertyTypeOverrideToListingPropertyType(propertyTypeOverride),
      };
      let airbnbCandidates: Awaited<ReturnType<typeof searchAirbnbCompetitorCandidates>> = [];
      try {
        airbnbCandidates = await searchAirbnbCompetitorCandidates(
          airbnbSearchTarget,
          competitorMaxResults
        );
      } catch (airbnbErr) {
        console.warn("[api/audits] airbnb-only fallback discovery failed", airbnbErr);
      }
      const airbnbListings: ExtractedListing[] = [];
      for (const row of airbnbCandidates) {
        const u = row.url?.trim();
        if (!u) continue;
        airbnbListings.push({
          url: u,
          platform: "airbnb",
          title: row.title?.trim() || "Airbnb listing",
          description: "",
          amenities: [],
          photos: [],
          price: row.price ?? null,
          currency: "EUR",
          airbnbComparableClassificationText: row.title ?? null,
        });
      }
      if (airbnbListings.length > 0) {
        try {
          await enrichAirbnbCompetitorPrices(airbnbListings);
        } catch (enrichErr) {
          console.warn("[api/audits] airbnb-only fallback enrich failed", enrichErr);
        }
      }
      const capped = airbnbListings.slice(0, Math.min(Math.max(competitorMaxResults, 1), 5));
      competitorBundle = {
        target: extracted,
        competitors: capped,
        attempted: airbnbCandidates.length,
        selected: capped.length,
        radiusKm: 1,
        maxResults: Math.min(Math.max(competitorMaxResults, 1), 5),
      };
      logMarketPipelineStage({
        stage: "api_audits_booking_unreliable_airbnb_comparables",
        targetUrl: listingRow.source_url ?? null,
        airbnbDiscovered: airbnbCandidates.length,
        airbnbAfterEnrich: airbnbListings.length,
        airbnbInjected: capped.length,
      });
    } else if (challengeOnBookingTarget) {
      console.warn("[market][booking-skip]", { reason: "challenge_on_target" });
      competitorBundle = {
        target: extracted,
        competitors: [],
        attempted: 0,
        selected: 0,
        radiusKm: 1,
        maxResults: Math.min(Math.max(competitorMaxResults, 1), 5),
      };
      logMarketPipelineStage({
        stage: "api_audits_competitors_skipped",
        targetUrl: listingRow.source_url ?? null,
        reason: "challenge_on_target",
        countCompetitorsToRunAudit: 0,
      });
    } else {
      competitorBundle = await searchCompetitorsAroundTarget({
        target: extracted,
        maxResults: competitorMaxResults,
        radiusKm: 1,
        ...(marketComparables ? { comparables: marketComparables } : {}),
        ...(propertyTypeOverride ? { propertyTypeOverride } : {}),
      });
      logMarketPipelineStage({
        stage: "api_audits_competitors_bundle",
        targetUrl: listingRow.source_url ?? null,
        countCompetitorsToRunAudit: competitorBundle.competitors.length,
        attempted: competitorBundle.attempted,
        selected: competitorBundle.selected,
      });
    }
    console.timeEnd("[audit] phase:competitors");

    // ✅ 4. AI AUDIT (ton système actuel)
    const auditTarget =
      propertyTypeOverride != null
        ? {
            ...extracted,
            propertyType: mapPropertyTypeOverrideToListingPropertyType(propertyTypeOverride),
          }
        : extracted;

    logAuditTargetTitleFlow({
      stage: "before_run_audit",
      url: auditTitleFlowUrl,
      extractedRawTitle: extractedRawTitleFrozen,
      normalizedTitle: typeof auditTarget.title === "string" ? auditTarget.title : null,
      payloadTitle: null,
      dbTitle: null,
      fallbackTargetMode,
      hasChallengeSignal: titleFlowHasChallengeSignal,
      propertyTypeOverride: propertyTypeOverrideLog,
    });

    console.time("[audit] phase:run_audit");
    const runAuditT0 = Date.now();
    const auditResult = await runAudit({
      target: auditTarget,
      competitors: competitorBundle.competitors,
    });
    const runAuditMs = Date.now() - runAuditT0;
    console.timeEnd("[audit] phase:run_audit");
    auditPerfLog({
      step: "run-audit",
      durationMs: runAuditMs,
      countIn: competitorBundle.competitors.length,
      countOut: null,
      platform: extracted.platform ?? null,
      note: null,
    });

    logAuditTargetTitleFlow({
      stage: "after_run_audit",
      url: auditTitleFlowUrl,
      extractedRawTitle: extractedRawTitleFrozen,
      normalizedTitle: normalizeListingForScoring(auditTarget).title || null,
      payloadTitle: null,
      dbTitle: null,
      fallbackTargetMode,
      hasChallengeSignal: titleFlowHasChallengeSignal,
      propertyTypeOverride: propertyTypeOverrideLog,
    });

    await saveMarketSnapshot({
      target: auditTarget,
      competitors: competitorBundle.competitors,
      bundle: {
        attempted: competitorBundle.attempted,
        selected: competitorBundle.selected,
        radiusKm: competitorBundle.radiusKm,
        maxResults: competitorBundle.maxResults,
      },
      extraMetadata: {
        route: "api_audits",
        listing_id: listingRow.id,
        workspace_id: listingRow.workspace_id,
        market_comparables_override: marketComparables ?? null,
      },
    });

    // ✅ 5. SCORE ENGINE (NOUVEAU - SAFE)
    const computedScore = computeScore(extracted);

    console.log("[SCORE ENGINE]", computedScore);

    // ✅ 6. PAYLOAD
    const structuredPayloadBase = buildStructuredAuditPayloadFromRunAudit({
      auditResult,
      target: auditTarget,
    });
    const structuredPayload =
      fallbackTargetMode && structuredPayloadBase.market
        ? {
            ...structuredPayloadBase,
            market: {
              ...structuredPayloadBase.market,
              fallbackLevel: "target_unavailable",
              marketConfidence: "low",
              reliabilityBadge: "Mode dégradé",
              reliabilityTitle: "Annonce cible partiellement indisponible",
              reliabilityMessage:
                "Booking a limité l'accès à l'annonce cible. L'audit reste généré avec des comparables de secours, mais les estimations de marché doivent être interprétées avec prudence.",
            },
          }
        : structuredPayloadBase;

    logMarketPipelineStage({
      stage: "api_audits_payload_counts",
      targetUrl: listingRow.source_url ?? null,
      competitorSummaryCompetitorCount: auditResult.competitorSummary?.competitorCount ?? null,
      resultPayloadMarketComparableCount: structuredPayload.market?.comparableCount ?? null,
    });

    console.info("[api/audits] generated audit payload", {
      listingId: listingRow.id,
      workspaceId: listingRow.workspace_id,
      ...summarizeStructuredAuditPayload(structuredPayload),
    });

    const { data: listingTitleBeforeAuditInsert } = await client
      .from("listings")
      .select("title")
      .eq("id", listingRow.id)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    const dbTitleBeforeAuditInsert =
      typeof listingTitleBeforeAuditInsert?.title === "string"
        ? listingTitleBeforeAuditInsert.title
        : null;

    logAuditTargetTitleFlow({
      stage: "before_persist",
      url: auditTitleFlowUrl,
      extractedRawTitle: extractedRawTitleFrozen,
      normalizedTitle: typeof auditTarget.title === "string" ? auditTarget.title : null,
      payloadTitle: null,
      dbTitle: dbTitleBeforeAuditInsert,
      fallbackTargetMode,
      hasChallengeSignal: titleFlowHasChallengeSignal,
      propertyTypeOverride: propertyTypeOverrideLog,
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

    console.log(
      "[audit][create][db-write]",
      JSON.stringify({
        id: auditRow.id,
        workspace_id: auditRow.workspace_id,
        user_id: auditRow.created_by ?? null,
      })
    );

    if (!billingAdminBypass) {
      const { data: consumeLedgerRow, error: consumeLedgerError } = await client
        .from("usage_events")
        .insert({
          workspace_id: listingRow.workspace_id,
          user_id: user.id,
          event_type: "audit_credit_consumed",
          quantity: 1,
          metadata: {
            audit_id: auditRow.id,
            listing_id: listingRow.id,
            source: "api_audits_create",
          },
        })
        .select("id")
        .single();

      if (consumeLedgerError) {
        const code =
          typeof consumeLedgerError === "object" &&
          consumeLedgerError !== null &&
          "code" in consumeLedgerError
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
        listingRow.workspace_id,
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
    }

    // ✅ DEBUG DB WRITE
    const { data: persistedAudit } = await client
      .from("audits")
      .select("id, overall_score, result_payload")
      .eq("id", auditRow.id)
      .maybeSingle();

    console.info("[DB CHECK]", persistedAudit);

    const { error: usageError } = await client.from("usage_events").insert({
      workspace_id: listingRow.workspace_id,
      user_id: user.id,
      event_type: "audit_created",
      quantity: 1,
      metadata: {
        audit_id: auditRow.id,
        listing_id: listingRow.id,
        ...(billingAdminBypass ? { billing_admin_bypass: true as const } : {}),
      },
    });

    if (usageError) {
      console.warn("[api/audits] failed to record usage events", {
        workspaceId: listingRow.workspace_id,
        auditId: auditRow.id,
        usageError,
      });
    }

    if (auditPerfT0 != null) {
      auditPerfLog({
        step: "total",
        durationMs: Date.now() - auditPerfT0,
        countIn: null,
        countOut: null,
        platform: extracted.platform ?? null,
        note: "success_including_persist",
      });
    }

    logAuditTargetTitleFlow({
      stage: "response_payload",
      url: auditTitleFlowUrl,
      extractedRawTitle: extractedRawTitleFrozen,
      normalizedTitle: typeof auditTarget.title === "string" ? auditTarget.title : null,
      payloadTitle: null,
      dbTitle: dbTitleBeforeAuditInsert,
      fallbackTargetMode,
      hasChallengeSignal: titleFlowHasChallengeSignal,
      propertyTypeOverride: propertyTypeOverrideLog,
    });

    return NextResponse.json({ auditId: auditRow.id });
  } catch (error) {
    console.error("Failed to run audit for listing:", error);

    if (auditPerfT0 != null) {
      auditPerfLog({
        step: "total",
        durationMs: Date.now() - auditPerfT0,
        countIn: null,
        countOut: null,
        platform: null,
        note: "handler_error",
      });
    }

    return NextResponse.json(
      {
        error: "Failed to run audit",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
