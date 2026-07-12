import { NextRequest, NextResponse } from "next/server";
import {
  extractListing,
  InvalidBookingTargetUrlError,
  INVALID_BOOKING_TARGET_URL_MESSAGE,
} from "@/lib/extractors";
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
import {
  buildShadowReuseComparison,
  buildStrictReuseCompetitorsFromShadowComparables,
  canReuseMarketMemorySeasonalStrict,
  canReuseMarketMemoryStrict,
  lookupMarketSnapshot,
} from "@/lib/marketMemory/lookupMarketSnapshot";
import { saveMarketSnapshot } from "@/lib/marketMemory/saveMarketSnapshot";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getIntelligenceV2FeatureFlags } from "@/lib/intelligenceV2/featureFlags";
import { writeAnonymousPricingFacts } from "@/lib/intelligenceV2/pricingFactWriter";
import { buildPrivateComparableIdentity } from "@/lib/intelligenceV2/privateComparableIdentity";

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

const DEBUG_MARKET_MEMORY_ROUTE =
  process.env.DEBUG_MARKET_MEMORY === "true" ||
  process.env.DEBUG_MARKET_PIPELINE === "true" ||
  process.env.DEBUG_BOOKING_PIPELINE === "true";

function routeMarketMemoryStageLog(kind: string, payload: Record<string, unknown>) {
  if (!DEBUG_MARKET_MEMORY_ROUTE) return;
  console.warn(`[market-memory][${kind}] ${JSON.stringify(payload)}`);
}

function routeMarketMemoryLog(payload: Record<string, unknown>) {
  routeMarketMemoryStageLog("route-lookup", payload);
}

function shouldShadowReuseSnapshot(
  result: Awaited<ReturnType<typeof lookupMarketSnapshot>>
): boolean {
  return (
    result.shouldReuse &&
    result.reuseKind === "same_platform_comparables" &&
    result.samePlatformComparableCount >= 3 &&
    (result.freshnessDays == null || result.freshnessDays <= 30)
  );
}

function routeLookupLocation(listing: ExtractedListing): { city: string | null; country: string | null } {
  const candidate = (listing as ExtractedListing & { location?: { city?: unknown; country?: unknown } | null })
    .location;
  const rawCity = typeof candidate?.city === "string" && candidate.city.trim() ? candidate.city.trim() : null;
  const country =
    typeof candidate?.country === "string" && candidate.country.trim() ? candidate.country.trim() : null;

  const normalizedCity = rawCity?.trim().toLowerCase() ?? null;
  const pollutedAirbnbCity =
    String(listing.platform ?? "").toLowerCase() === "airbnb" &&
    normalizedCity != null &&
    [
      "studio",
      "apartment",
      "appartement",
      "grand",
      "greater",
      "logement",
      "rental",
      "private",
      "deluxe",
      "room",
      "home",
    ].includes(normalizedCity);

  return { city: pollutedAirbnbCity ? null : rawCity, country };
}

function routeLookupStayWindow(listing: ExtractedListing): {
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
} {
  const nights =
    typeof listing.stayNights === "number" && Number.isFinite(listing.stayNights) && listing.stayNights > 0
      ? Math.floor(listing.stayNights)
      : null;
  try {
    const sp = new URL(listing.url ?? listing.sourceUrl ?? "").searchParams;
    const checkIn = sp.get("checkin");
    const checkOut = sp.get("checkout");
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    return {
      checkIn: checkIn && iso.test(checkIn) ? checkIn : null,
      checkOut: checkOut && iso.test(checkOut) ? checkOut : null,
      nights,
    };
  } catch {
    return { checkIn: null, checkOut: null, nights };
  }
}

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

function isInvalidAirbnbAuditUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  return (
    /airbnb\./i.test(url) &&
    (
      /\/hosting\/listings\//i.test(url) ||
      /\/login/i.test(url) ||
      /\/signup/i.test(url) ||
      /view-your-space/i.test(url) ||
      !/\/rooms\//i.test(url)
    )
  );
}

type IntelligenceV2RouteComparable = ExtractedListing & {
  sourceKind?: "market_memory_seed" | null;
  city?: string | null;
  country?: string | null;
};

function routeNormalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function routePositiveNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function routePositiveInteger(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

function routeComparableLocation(
  comparable: IntelligenceV2RouteComparable,
): { city: string | null; country: string | null } {
  const city = routeNormalizeText(comparable.city);
  const country = routeNormalizeText(comparable.country);

  if (city != null || country != null) {
    return { city, country };
  }

  return routeLookupLocation(comparable);
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
  let auditComputedBeforePersistFailure = false;

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
      console.error("[api/audits][listing-load-error]", listingError);
      return NextResponse.json(
        { error: "Impossible de charger l’annonce." },
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

    const sourcePlatform = String(
      listingRow.source_platform ?? ""
    ).toLowerCase();

    if (
      !billingAdminBypass &&
      (sourcePlatform === "vrbo" || sourcePlatform === "expedia")
    ) {
      return NextResponse.json(
        {
          error: "Cette plateforme sera disponible prochainement.",
          code: "platform_not_available_yet",
        },
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
    const competitorMaxResults = isBookingListing ? 4 : 25;

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

    if (isInvalidAirbnbAuditUrl(listingRow.source_url)) {
      console.log(
        "[audit][invalid-airbnb-url-blocked]",
        listingRow.source_url
      );

      return NextResponse.json(
        {
          error: "URL Airbnb invalide",
          message:
            "Cette URL Airbnb n’est pas une URL publique d’annonce. Veuillez utiliser le lien public Airbnb contenant /rooms/...",
          code: "INVALID_AIRBNB_PUBLIC_URL",
        },
        { status: 400 }
      );
    }

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
    console.log(
      "[audit][fallback-flow-debug]",
      JSON.stringify({
        stage: "after_extract",
        platform: extractedRaw.platform ?? null,
        isBookingListing,
        propertyTypeOverride,
        extractedRawExists: extractedRaw != null,
        hasWarnings: Array.isArray(extractedRaw.extractionMeta?.warnings),
        warnings: Array.isArray(extractedRaw.extractionMeta?.warnings)
          ? extractedRaw.extractionMeta.warnings
          : [],
        price:
          typeof extractedRaw.price === "number" && Number.isFinite(extractedRaw.price)
            ? extractedRaw.price
            : null,
        title: typeof extractedRaw.title === "string" ? extractedRaw.title : null,
        photosCount:
          typeof extractedRaw.photosCount === "number" && Number.isFinite(extractedRaw.photosCount)
            ? Math.max(0, Math.floor(extractedRaw.photosCount))
            : Array.isArray(extractedRaw.photos)
              ? extractedRaw.photos.filter(Boolean).length
              : 0,
      })
    );

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

    const isAirbnbPlaceholderExtraction =
      String(extractedRaw.platform ?? "").toLowerCase() === "airbnb" &&
      typeof extractedRaw.title === "string" &&
      /^stay\s+tuned$/i.test(extractedRaw.title.trim()) &&
      (extractedRaw.latitude == null || extractedRaw.longitude == null) &&
      !extractedRaw.locationLabel &&
      !extractedRaw.structure?.locationLabel;

    if (isAirbnbPlaceholderExtraction) {
      console.warn(
        "[audit][target-extraction-blocked-airbnb-placeholder]",
        JSON.stringify({
          route: "api_audits",
          url: listingRow.source_url ?? null,
          title: extractedRaw.title ?? null,
          latitude: extractedRaw.latitude ?? null,
          longitude: extractedRaw.longitude ?? null,
          locationLabel: extractedRaw.locationLabel ?? null,
          structureLocationLabel: extractedRaw.structure?.locationLabel ?? null,
          reason: "airbnb_placeholder_without_geo",
        })
      );

      return NextResponse.json(
        {
          error: "EXTRACTION_UNAVAILABLE",
          code: "AIRBNB_PLACEHOLDER_WITHOUT_GEO",
          message:
            "L’annonce Airbnb n’a pas pu être extraite correctement pour le moment. Veuillez réessayer dans quelques minutes.",
        },
        { status: 503 }
      );
    }

    const extractionWarnings = Array.isArray(extractedRaw.extractionMeta?.warnings)
      ? extractedRaw.extractionMeta.warnings
      : [];
    const hasChallengeSignal = extractionWarnings.includes("booking_challenge_detected");
    const challenge = hasChallengeSignal && extractedRaw.price == null;
    console.log(
      "[audit][fallback-flow-debug]",
      JSON.stringify({
        stage: "before_fallback_block",
        platform: extractedRaw.platform ?? null,
        isBookingListing,
        propertyTypeOverride,
        extractedRawExists: extractedRaw != null,
        hasWarnings: extractionWarnings.length > 0,
        warnings: extractionWarnings,
        price:
          typeof extractedRaw.price === "number" && Number.isFinite(extractedRaw.price)
            ? extractedRaw.price
            : null,
        title: typeof extractedRaw.title === "string" ? extractedRaw.title : null,
        photosCount:
          typeof extractedRaw.photosCount === "number" && Number.isFinite(extractedRaw.photosCount)
            ? Math.max(0, Math.floor(extractedRaw.photosCount))
            : Array.isArray(extractedRaw.photos)
              ? extractedRaw.photos.filter(Boolean).length
              : 0,
      })
    );
    const unreliableBookingExtraction = isUnreliableBookingExtraction(extractedRaw);
    const challengeFallbackCountryLabel =
      typeof extractedRaw.locationLabel === "string" && extractedRaw.locationLabel.trim()
        ? extractedRaw.locationLabel.trim()
        : typeof extractedRaw.structure?.locationLabel === "string" &&
            extractedRaw.structure.locationLabel.trim()
          ? extractedRaw.structure.locationLabel.trim()
          : null;
    const challengeFallbackBookingMoroccoUrl = /\/hotel\/ma\//i.test(
      String(listingRow.source_url ?? "")
    );
    const challengeFallbackMoroccoEligible =
      /^(morocco|maroc)$/i.test(String(effectiveMarketCountryOverride ?? "").trim()) ||
      /\b(morocco|maroc)\b/i.test(String(challengeFallbackCountryLabel ?? "").trim()) ||
      challengeFallbackBookingMoroccoUrl;
    const challengeFallbackEligible =
      String(extractedRaw.platform ?? "").toLowerCase() === "booking" &&
      challenge &&
      propertyTypeOverride != null &&
      challengeFallbackMoroccoEligible;
    console.log(
      "[audit][fallback-entry-debug]",
      JSON.stringify({
        platform: extractedRaw.platform ?? null,
        price:
          typeof extractedRaw.price === "number" && Number.isFinite(extractedRaw.price)
            ? extractedRaw.price
            : null,
        propertyTypeOverride,
        hasChallengeSignal,
        challenge,
        challengeFallbackEligible,
        isUnreliableBookingExtraction: unreliableBookingExtraction,
      })
    );

    if (unreliableBookingExtraction) {

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
    } else if (challengeFallbackEligible) {
      fallbackTargetMode = true;
      console.warn(
        "[audit][fallback-target-mode-enabled]",
        JSON.stringify({
          url: listingRow.source_url ?? null,
          platform: extractedRaw.platform ?? null,
          propertyTypeOverride,
          hasChallengeSignal,
          reason: "booking-challenge-missing-price-airbnb-comparables-only",
        })
      );
    }

    // ✅ 2. NORMALIZATION (ANTI BUG + STRUCTURE)
    console.log(
      "[audit][fallback-flow-debug]",
      JSON.stringify({
        stage: "before_normalize",
        platform: extractedRaw.platform ?? null,
        isBookingListing,
        propertyTypeOverride,
        extractedRawExists: extractedRaw != null,
        hasWarnings: extractionWarnings.length > 0,
        warnings: extractionWarnings,
        price:
          typeof extractedRaw.price === "number" && Number.isFinite(extractedRaw.price)
            ? extractedRaw.price
            : null,
        title: typeof extractedRaw.title === "string" ? extractedRaw.title : null,
        photosCount:
          typeof extractedRaw.photosCount === "number" && Number.isFinite(extractedRaw.photosCount)
            ? Math.max(0, Math.floor(extractedRaw.photosCount))
            : Array.isArray(extractedRaw.photos)
              ? extractedRaw.photos.filter(Boolean).length
              : 0,
      })
    );
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
    console.log(
      "[audit][fallback-flow-debug]",
      JSON.stringify({
        stage: "before_competitor_bundle",
        platform: extractedRaw.platform ?? null,
        isBookingListing,
        propertyTypeOverride,
        extractedRawExists: extractedRaw != null,
        hasWarnings: extractionWarnings.length > 0,
        warnings: extractionWarnings,
        price:
          typeof extractedRaw.price === "number" && Number.isFinite(extractedRaw.price)
            ? extractedRaw.price
            : null,
        title: typeof extractedRaw.title === "string" ? extractedRaw.title : null,
        photosCount:
          typeof extractedRaw.photosCount === "number" && Number.isFinite(extractedRaw.photosCount)
            ? Math.max(0, Math.floor(extractedRaw.photosCount))
            : Array.isArray(extractedRaw.photos)
              ? extractedRaw.photos.filter(Boolean).length
              : 0,
      })
    );

    let competitorBundle: Awaited<ReturnType<typeof searchCompetitorsAroundTarget>>;
    let pricingFactCollectionMode: "live" | "memory_reuse" = "live";
    if (fallbackTargetMode && isBookingListing && propertyTypeOverride != null) {
      const routeLookupGeo = routeLookupLocation(extracted);
      const routeLookupStay = routeLookupStayWindow(extracted);
      routeMarketMemoryStageLog("lookup-bypassed", {
        route: "api_audits",
        reason: "fallback_target_mode",
        platform: extracted.platform,
        city: effectiveMarketCityOverride ?? routeLookupGeo.city,
        country: effectiveMarketCountryOverride ?? routeLookupGeo.country,
        propertyType: mapPropertyTypeOverrideToListingPropertyType(propertyTypeOverride),
        checkIn: routeLookupStay.checkIn,
        checkOut: routeLookupStay.checkOut,
        nights: routeLookupStay.nights,
        fallbackTargetMode,
        challengeOnBookingTarget,
        propertyTypeOverride,
      });
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

      const moroccoSlugCity = (() => {
        try {
          const path = decodeURIComponent(new URL(srcUrl).pathname).toLowerCase();
          if (/\bfes\b|\bfez\b|\bfès\b/.test(path)) return "Fes";
          if (/\bmarrakech\b|\bmarrakesh\b/.test(path)) return "Marrakech";
          if (/\bagadir\b/.test(path)) return "Agadir";
          if (/\btanger\b|\btangier\b/.test(path)) return "Tanger";
          if (/\brabat\b/.test(path)) return "Rabat";
          if (/\bcasablanca\b/.test(path)) return "Casablanca";
          if (/\bessaouira\b/.test(path)) return "Essaouira";
          return null;
        } catch {
          return null;
        }
      })();

      if (moroccoSlugCity && !city) {
        city = moroccoSlugCity;
      }
      if (moroccoSlugCity && !country) {
        country = "Morocco";
      }

      const moroccoDetected = moroccoFromBookingUrl || marrakechSlugSignals || moroccoSlugCity != null;

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

      const hydratedFallbackTarget: ExtractedListing = {
        ...extracted,
        rating: extractedRaw.rating ?? extracted.rating,
        ratingValue: extractedRaw.ratingValue ?? extracted.ratingValue,
        ratingScale: extractedRaw.ratingScale ?? extracted.ratingScale,
        reviewCount: extractedRaw.reviewCount ?? extracted.reviewCount,
        photosCount: extractedRaw.photosCount ?? extracted.photosCount,
        extractionMeta: extractedRaw.extractionMeta ?? extracted.extractionMeta,
        description:
          typeof extracted.description === "string" &&
          extracted.description.trim().length > 40
            ? extracted.description
            : extracted.title,
        amenities:
          Array.isArray(extracted.amenities) &&
          extracted.amenities.length > 0
            ? extracted.amenities
            : [
                "wifi",
                "air conditioning",
                "kitchen",
              ],
        photos:
          Array.isArray(extracted.photos) &&
          extracted.photos.length > 0
            ? extracted.photos
            : ["fallback-booking-challenge-photo"],
        highlights:
          Array.isArray(extracted.highlights) &&
          extracted.highlights.length > 0
            ? extracted.highlights
            : ["booking challenge fallback"],
        locationDetails:
          Array.isArray(extracted.locationDetails) &&
          extracted.locationDetails.length > 0
            ? extracted.locationDetails
            : locationLabelResolved
              ? [locationLabelResolved]
              : [],
        // Preserve target nightly price for downstream payload/UI when Booking fallback mode hydrates the target.
        price: preservedTargetPrice,
        normalizedNightlyPrice: preservedTargetPrice,
        rawStayPrice:
          typeof extracted.rawStayPrice === "number" && Number.isFinite(extracted.rawStayPrice)
            ? extracted.rawStayPrice
            : null,
        stayNights:
          typeof extracted.stayNights === "number" && Number.isFinite(extracted.stayNights)
            ? extracted.stayNights
            : null,
        priceBasis: preservedTargetPrice != null ? extracted.priceBasis ?? "unknown" : "unknown",
      };

      const airbnbSearchTarget: ExtractedListing = {
        ...hydratedFallbackTarget,
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
          Math.max(competitorMaxResults * 4, 12)
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
      const fallbackType = String(propertyTypeOverride ?? "").toLowerCase();
      const targetWantsUrbanUnit =
        fallbackType.includes("apartment") ||
        fallbackType.includes("appartement") ||
        fallbackType.includes("studio");

      const airbnbFallbackBlock = /\b(villa|riad|ryad|palace|hotel|hôtel|resort|spa|5\s*bedrooms?|4\s*bedrooms?|whole\s+home|entire\s+home)\b/i;
      const airbnbFallbackUrbanUnit =
        /\b(apartment|appartement|studio|flat|condo|apt|[1-3]\s*[-]?\s*bed(room)?s?|one\s+bedroom|two\s+bedrooms?|three\s+bedrooms?|\d\s*bdr|\bbdr\b|1br|2br|3br)\b/i;

      const airbnbFallbackFilterRejectionStats = {
        no_effective_price: 0,
        block_type: 0,
        wrong_zone_or_large_unit: 0,
        missing_urban_signal: 0,
        premium_price_gate: 0,
        below_floor_45: 0,
        below_target_055: 0,
        accepted: 0,
      };

      const filteredAirbnbFallbackListings = airbnbListings.filter((listing) => {
        const title = `${listing.title ?? ""} ${listing.airbnbComparableClassificationText ?? ""}`;
        const effectiveNightlyPrice =
          typeof listing.price === "number" && Number.isFinite(listing.price) && listing.price > 0
            ? listing.price
            : typeof listing.rawStayPrice === "number" &&
                Number.isFinite(listing.rawStayPrice) &&
                listing.rawStayPrice > 0 &&
                typeof listing.stayNights === "number" &&
                Number.isFinite(listing.stayNights) &&
                listing.stayNights > 0
              ? Math.round((listing.rawStayPrice / listing.stayNights) * 100) / 100
              : null;

        if (effectiveNightlyPrice == null) {
          airbnbFallbackFilterRejectionStats.no_effective_price += 1;
          return false;
        }

        if (targetWantsUrbanUnit) {
          const targetPrice =
            typeof preservedTargetPrice === "number" && Number.isFinite(preservedTargetPrice)
              ? preservedTargetPrice
              : null;

          const lowQualityOrWrongZone =
            /\b(medina|jemaa|jamaa|hostel|shared|dortoir|riad|ryad|villa|palace|hotel|hôtel|4\s*beds?|5\s*beds?|4\s*bedrooms?|5\s*bedrooms?)\b/i;

          const premiumAreaOrFeature =
            /\b(gueliz|guéliz|hivernage|carr[eé]\s*eden|standing|modern|moderne|pool|piscine|parking|clim|wifi)\b/i;

          if (airbnbFallbackBlock.test(title)) {
            airbnbFallbackFilterRejectionStats.block_type += 1;
            return false;
          }
          if (lowQualityOrWrongZone.test(title)) {
            airbnbFallbackFilterRejectionStats.wrong_zone_or_large_unit += 1;
            return false;
          }
          const hasUrbanSignal = airbnbFallbackUrbanUnit.test(title);
          const hasPremiumSignal = premiumAreaOrFeature.test(title);

          if (!hasUrbanSignal && !hasPremiumSignal) {
            airbnbFallbackFilterRejectionStats.missing_urban_signal += 1;
            return false;
          }

          if (
            !hasPremiumSignal &&
            targetPrice != null &&
            effectiveNightlyPrice < targetPrice * 0.7
          ) {
            airbnbFallbackFilterRejectionStats.premium_price_gate += 1;
            return false;
          }

          if (effectiveNightlyPrice < 45) {
            airbnbFallbackFilterRejectionStats.below_floor_45 += 1;
            return false;
          }
          if (targetPrice != null && effectiveNightlyPrice < targetPrice * 0.55) {
            airbnbFallbackFilterRejectionStats.below_target_055 += 1;
            return false;
          }

          if (
            typeof listing.price !== "number" ||
            !Number.isFinite(listing.price) ||
            listing.price <= 0
          ) {
            listing.price = effectiveNightlyPrice;
            listing.priceBasis = "nightly";
          }
        }

        airbnbFallbackFilterRejectionStats.accepted += 1;
        return true;
      });

      console.log(
        "[audit-route][airbnb-fallback-filter-debug]",
        JSON.stringify({
          attempted: airbnbListings.length,
          retained: filteredAirbnbFallbackListings.length,
          targetWantsUrbanUnit,
          stats: airbnbFallbackFilterRejectionStats,
        })
      );

      const capped = filteredAirbnbFallbackListings.slice(
        0,
        Math.min(Math.max(competitorMaxResults, 1), 5)
      );
      console.log(
        "[audit-route][airbnb-fallback-branch-final]",
        JSON.stringify({
          attempted: airbnbCandidates.length,
          afterEnrich: airbnbListings.length,
          afterFilter: filteredAirbnbFallbackListings.length,
          selected: capped.length,
          stats: airbnbFallbackFilterRejectionStats,
        })
      );
      competitorBundle = {
        target: hydratedFallbackTarget,
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
      const routeLookupGeo = routeLookupLocation(extracted);
      const routeLookupStay = routeLookupStayWindow(extracted);
      routeMarketMemoryStageLog("lookup-bypassed", {
        route: "api_audits",
        reason: "challenge_on_target",
        platform: extracted.platform,
        city: effectiveMarketCityOverride ?? routeLookupGeo.city,
        country: effectiveMarketCountryOverride ?? routeLookupGeo.country,
        propertyType:
          propertyTypeOverride != null
            ? mapPropertyTypeOverrideToListingPropertyType(propertyTypeOverride)
            : extracted.propertyType ?? null,
        checkIn: routeLookupStay.checkIn,
        checkOut: routeLookupStay.checkOut,
        nights: routeLookupStay.nights,
        fallbackTargetMode,
        challengeOnBookingTarget,
        propertyTypeOverride,
      });
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
      const routeLookupGeo = routeLookupLocation(extracted);
      const routeLookupStay = routeLookupStayWindow(extracted);
      const routeLookupResult = await lookupMarketSnapshot({
        platform: extracted.platform,
        city: effectiveMarketCityOverride ?? routeLookupGeo.city,
        country: effectiveMarketCountryOverride ?? routeLookupGeo.country,
        propertyType:
          propertyTypeOverride != null
            ? mapPropertyTypeOverrideToListingPropertyType(propertyTypeOverride)
            : extracted.propertyType ?? null,
        checkIn: routeLookupStay.checkIn,
        checkOut: routeLookupStay.checkOut,
        nights: routeLookupStay.nights,
        latitude: extracted.latitude ?? null,
        longitude: extracted.longitude ?? null,
        sourceUrl: extracted.url ?? extracted.sourceUrl ?? listingRow.source_url ?? null,
        route: "api_audits",
      });
      routeMarketMemoryLog({
        route: "api_audits",
        shouldReuse: routeLookupResult.shouldReuse,
        reason: routeLookupResult.reason,
        score: routeLookupResult.score,
        snapshotsFound: routeLookupResult.snapshotsFound,
        comparablesFound: routeLookupResult.comparablesFound,
        samePlatformComparableCount: routeLookupResult.samePlatformComparableCount,
        crossPlatformComparableCount: routeLookupResult.crossPlatformComparableCount,
        countsByPlatform: routeLookupResult.countsByPlatform,
        reuseKind: routeLookupResult.reuseKind,
        bestSnapshotId: routeLookupResult.bestSnapshotId ?? null,
        freshnessDays: routeLookupResult.freshnessDays ?? null,
      });
      const shadowReuseCandidate = shouldShadowReuseSnapshot(routeLookupResult);
      const strictReuse = canReuseMarketMemoryStrict(routeLookupResult);
      const seasonalStrictReuse = canReuseMarketMemorySeasonalStrict(routeLookupResult);
      if (shadowReuseCandidate) {
        routeMarketMemoryStageLog("shadow-reuse-candidate", {
          route: "api_audits",
          bestSnapshotId: routeLookupResult.bestSnapshotId ?? null,
          reuseKind: routeLookupResult.reuseKind,
          samePlatformComparableCount: routeLookupResult.samePlatformComparableCount,
          crossPlatformComparableCount: routeLookupResult.crossPlatformComparableCount,
          countsByPlatform: routeLookupResult.countsByPlatform,
          freshnessDays: routeLookupResult.freshnessDays ?? null,
        });
      }
      if (strictReuse || seasonalStrictReuse) {
        pricingFactCollectionMode = "memory_reuse";
        let reuseCompetitors = buildStrictReuseCompetitorsFromShadowComparables(
          routeLookupResult.shadowComparables,
          extracted.platform
        ).slice(0, Math.min(Math.max(competitorMaxResults, 1), routeLookupResult.shadowComparables.length));
        // Premium villa segment mismatch — detect when cached comparables are budget-tier vs a premium villa target.
        // applyPremiumVillaComparablePostFilter lives inside searchCompetitorsAroundTarget which is skipped in reuse
        // mode, so we replicate the detection here and tag competitors so runAudit.ts can downgrade confidence.
        {
          const tPrice =
            typeof extracted.price === "number" && Number.isFinite(extracted.price) && extracted.price > 0
              ? extracted.price
              : null;
          const villaSignalText = [
            typeof extracted.propertyType === "string" ? extracted.propertyType : "",
            typeof extracted.title === "string" ? extracted.title : "",
            typeof extracted.url === "string" ? extracted.url : "",
          ]
            .join(" ")
            .toLowerCase();
          const overrideTypeForReuseSegment =
            propertyTypeOverride != null
              ? mapPropertyTypeOverrideToListingPropertyType(propertyTypeOverride)
              : null;
          const isVillaLikeTarget =
            overrideTypeForReuseSegment != null
              ? /\bvilla\b/i.test(overrideTypeForReuseSegment)
              : /\bvilla\b/.test(villaSignalText);
          const reusePrices = reuseCompetitors
            .map((c) =>
              typeof c.price === "number" && Number.isFinite(c.price) && c.price > 0 ? c.price : null
            )
            .filter((p): p is number => p !== null);
          const reusePricedCount = reusePrices.length;
          const sorted = reusePrices.slice().sort((a, b) => a - b);
          const reuseMedianPrice =
            reusePricedCount > 0
              ? reusePricedCount % 2 === 1
                ? sorted[Math.floor(reusePricedCount / 2)]
                : (sorted[reusePricedCount / 2 - 1]! + sorted[reusePricedCount / 2]!) / 2
              : null;
          const ratioToTarget =
            tPrice !== null && reuseMedianPrice !== null
              ? Math.round((reuseMedianPrice / tPrice) * 1000) / 1000
              : null;
          const mismatchTriggered =
            isVillaLikeTarget &&
            tPrice !== null &&
            tPrice >= 250 &&
            reusePricedCount >= 3 &&
            reuseMedianPrice !== null &&
            reuseMedianPrice < tPrice * 0.4;
          const checkReason = !isVillaLikeTarget
            ? "not_villa_like_target"
            : tPrice === null
              ? "missing_target_price"
              : tPrice < 250
                ? "target_below_premium_floor"
                : reusePricedCount < 3
                  ? "insufficient_priced_comparables"
                  : reuseMedianPrice !== null && reuseMedianPrice >= tPrice * 0.4
                    ? "median_within_segment_range"
                    : "mismatch_triggered";
          console.log(
            "[market-memory][premium-villa-reuse-segment-check]",
            JSON.stringify({
              isVillaLikeTarget,
              targetNightlyPrice: tPrice,
              reusePricedCount,
              reuseMedianPrice,
              ratioToTarget,
              triggered: mismatchTriggered,
              reason: checkReason,
            })
          );
          if (mismatchTriggered) {
            reuseCompetitors = reuseCompetitors.map(
              (c) =>
                ({
                  ...c,
                  premiumVillaSegmentMismatch: true,
                  premiumVillaSegmentMismatchSource: "market_memory_reuse",
                }) as unknown as ExtractedListing
            );
            console.warn(
              "[market-memory][premium-villa-reuse-segment-mismatch]",
              JSON.stringify({
                targetUrl: typeof extracted.url === "string" ? extracted.url.slice(0, 200) : null,
                targetTitle: typeof extracted.title === "string" ? extracted.title.slice(0, 100) : null,
                targetNightlyPrice: tPrice,
                reusePricedCount,
                reuseMedianPrice,
                ratioToTarget,
                strictReuse,
                seasonalStrictReuse,
                taggedCompetitorCount: reuseCompetitors.length,
                reason: "reuse_comparables_below_premium_villa_segment",
              })
            );
          }
        }
        competitorBundle = {
          target: extracted,
          competitors: reuseCompetitors,
          attempted: reuseCompetitors.length,
          selected: reuseCompetitors.length,
          radiusKm: 1,
          maxResults: Math.min(Math.max(competitorMaxResults, 1), routeLookupResult.shadowComparables.length),
        };
        if (strictReuse) {
          routeMarketMemoryStageLog("strict-reuse-live-skip", {
            route: "api_audits",
            platform: extracted.platform,
            city: effectiveMarketCityOverride ?? routeLookupGeo.city,
            country: effectiveMarketCountryOverride ?? routeLookupGeo.country,
            propertyType:
              propertyTypeOverride != null
                ? mapPropertyTypeOverrideToListingPropertyType(propertyTypeOverride)
                : extracted.propertyType ?? null,
            samePlatformComparableCount: routeLookupResult.samePlatformComparableCount,
            freshnessDays: routeLookupResult.freshnessDays,
            bestSnapshotId: routeLookupResult.bestSnapshotId ?? null,
          });
        } else {
          routeMarketMemoryStageLog("seasonal-strict-reuse-live-skip", {
            route: "api_audits",
            platform: extracted.platform,
            city: effectiveMarketCityOverride ?? routeLookupGeo.city,
            country: effectiveMarketCountryOverride ?? routeLookupGeo.country,
            propertyType:
              propertyTypeOverride != null
                ? mapPropertyTypeOverrideToListingPropertyType(propertyTypeOverride)
                : extracted.propertyType ?? null,
            reuseTier: routeLookupResult.reuseTier ?? "insufficient",
            sameSeasonWindow: routeLookupResult.sameSeasonWindow ?? false,
            samePlatformComparableCount: routeLookupResult.samePlatformComparableCount,
            freshnessDays: routeLookupResult.freshnessDays,
            bestSnapshotId: routeLookupResult.bestSnapshotId ?? null,
          });
        }
      } else {
        const routeLookupCountryForSeed = String(
          effectiveMarketCountryOverride ?? routeLookupGeo.country ?? ""
        ).toLowerCase();
        const routeLookupTypeForSeed = String(
          propertyTypeOverride != null
            ? mapPropertyTypeOverrideToListingPropertyType(propertyTypeOverride)
            : extracted.propertyType ?? ""
        ).toLowerCase();

        const normalizedExtractedPlatformForSeed = String(extracted.platform ?? "").toLowerCase();

        const allowCrossPlatformMemorySeed =
          routeLookupResult.crossPlatformComparableCount >= 1 &&
          (routeLookupResult.freshnessDays ?? 999) <= 30 &&
          Boolean(routeLookupResult.bestSnapshotId) &&
          /studio|appartement|apartment|villa|riad|hotel|room|chambre/.test(routeLookupTypeForSeed) &&
          (
            normalizedExtractedPlatformForSeed === "airbnb" ||
            normalizedExtractedPlatformForSeed === "booking" ||
            normalizedExtractedPlatformForSeed === "agoda" ||
            normalizedExtractedPlatformForSeed === "expedia" ||
            normalizedExtractedPlatformForSeed === "vrbo"
          );

        const memorySeedComparables =
          !strictReuse &&
          !seasonalStrictReuse &&
          (routeLookupResult.samePlatformPricedComparableCount > 0 || allowCrossPlatformMemorySeed)
            ? buildStrictReuseCompetitorsFromShadowComparables(
                routeLookupResult.shadowComparables,
                extracted.platform
              ).filter((competitor) => {
                const hasPrice =
                  typeof competitor.price === "number" &&
                  Number.isFinite(competitor.price) &&
                  competitor.price > 0;

                if (!hasPrice) return false;

                if (allowCrossPlatformMemorySeed) {
                  return true;
                }

                return competitor.platform === extracted.platform;
              })
            : [];

        if (allowCrossPlatformMemorySeed && memorySeedComparables.length > 0) {
          routeMarketMemoryStageLog("cross-platform-memory-seed", {
            route: "api_audits",
            platform: extracted.platform,
            country: routeLookupCountryForSeed,
            propertyType: routeLookupTypeForSeed,
            seedCount: memorySeedComparables.length,
            crossPlatformComparableCount: routeLookupResult.crossPlatformComparableCount,
            freshnessDays: routeLookupResult.freshnessDays ?? null,
            reuseKind: routeLookupResult.reuseKind,
            bestSnapshotId: routeLookupResult.bestSnapshotId ?? null,
          });
        }

        competitorBundle = await searchCompetitorsAroundTarget({
          target: extracted,
          maxResults: competitorMaxResults,
          radiusKm: 1,
          ...(marketComparables || memorySeedComparables.length > 0
            ? {
                comparables: {
                  ...(marketComparables ?? {}),
                  ...(memorySeedComparables.length > 0 ? { seedComparables: memorySeedComparables } : {}),
                },
              }
            : {}),
          ...(propertyTypeOverride ? { propertyTypeOverride } : {}),
        });
      }
      if (!strictReuse && !seasonalStrictReuse && shadowReuseCandidate) {
        const shadowComparison = buildShadowReuseComparison(routeLookupResult.shadowComparables, competitorBundle.competitors);
        routeMarketMemoryStageLog("shadow-vs-live", {
          route: "api_audits",
          bestSnapshotId: routeLookupResult.bestSnapshotId ?? null,
          freshnessDays: routeLookupResult.freshnessDays ?? null,
          samePlatformComparableCount: routeLookupResult.samePlatformComparableCount,
          ...shadowComparison,
        });
        const hasDivergence =
          shadowComparison.liveComparableCount === 0 ||
          shadowComparison.overlapCount === 0 ||
          shadowComparison.sameDateWindow === false ||
          (shadowComparison.medianDeltaPercent != null && Math.abs(shadowComparison.medianDeltaPercent) >= 25);
        if (hasDivergence) {
          routeMarketMemoryStageLog("shadow-divergence", {
            route: "api_audits",
            bestSnapshotId: routeLookupResult.bestSnapshotId ?? null,
            freshnessDays: routeLookupResult.freshnessDays ?? null,
            samePlatformComparableCount: routeLookupResult.samePlatformComparableCount,
            ...shadowComparison,
          });
        }
      }
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
    // Pass rawStayPrice / stayNights through so runAudit can use the booking nightly price
    // fallback when normalizedTarget.price is null (normalizeListing strips these fields).
    const pricePassthrough = {
      ...(typeof extractedRaw.rawStayPrice === "number" &&
      Number.isFinite(extractedRaw.rawStayPrice)
        ? { rawStayPrice: extractedRaw.rawStayPrice }
        : {}),
      ...(typeof extractedRaw.stayNights === "number" &&
      Number.isFinite(extractedRaw.stayNights)
        ? { stayNights: extractedRaw.stayNights }
        : {}),
      ...(extractedRaw.priceBasis ? { priceBasis: extractedRaw.priceBasis } : {}),
    };
    const auditTargetBase =
      fallbackTargetMode && competitorBundle.target
        ? competitorBundle.target
        : extracted;

    const auditTarget =
      propertyTypeOverride != null
        ? {
            ...auditTargetBase,
            ...pricePassthrough,
            propertyType: mapPropertyTypeOverrideToListingPropertyType(propertyTypeOverride),
          }
        : { ...auditTargetBase, ...pricePassthrough };

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

    console.log(
      "[audit-route][competitor-bundle-debug]",
      JSON.stringify({
        route: "api_audits",
        comparableCount: competitorBundle.competitors.length,
        pricedComparableCount: competitorBundle.competitors.filter(
          (competitor) =>
            typeof competitor.price === "number" &&
            Number.isFinite(competitor.price) &&
            competitor.price > 0
        ).length,
        attempted: competitorBundle.attempted,
        selected: competitorBundle.selected,
        radiusKm: competitorBundle.radiusKm,
        sample: competitorBundle.competitors.slice(0, 8).map((competitor) => ({
          url: competitor.url ?? null,
          title: competitor.title ?? null,
          price:
            typeof competitor.price === "number" && Number.isFinite(competitor.price)
              ? competitor.price
              : null,
          currency: competitor.currency ?? null,
          rawStayPrice:
            typeof competitor.rawStayPrice === "number" && Number.isFinite(competitor.rawStayPrice)
              ? competitor.rawStayPrice
              : null,
          stayNights:
            typeof competitor.stayNights === "number" && Number.isFinite(competitor.stayNights)
              ? competitor.stayNights
              : null,
          priceBasis: competitor.priceBasis ?? null,
          platform: competitor.platform ?? null,
        })),
      })
    );

    console.time("[audit] phase:run_audit");
    const runAuditT0 = Date.now();
    const auditResult = await runAudit({
      target: auditTarget,
      competitors: competitorBundle.competitors,
    });
    auditComputedBeforePersistFailure = true;
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
      observedFallbackComparables: competitorBundle.observedFallbackComparables,
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
        ? (() => {
            const market = structuredPayloadBase.market;
            const comparableCount =
              typeof market.comparableCount === "number" && Number.isFinite(market.comparableCount)
                ? market.comparableCount
                : 0;
            const pricedComparableCount =
              typeof market.pricedComparableCount === "number" &&
              Number.isFinite(market.pricedComparableCount)
                ? market.pricedComparableCount
                : 0;
            const avgCompetitorPrice =
              typeof market.avgCompetitorPrice === "number" && Number.isFinite(market.avgCompetitorPrice)
                ? market.avgCompetitorPrice
                : null;
            const robustCrossPlatformFallback =
              market.marketSourceQuality === "cross_platform_fallback" &&
              comparableCount >= 3 &&
              pricedComparableCount >= 3 &&
              avgCompetitorPrice != null &&
              avgCompetitorPrice > 0;

            console.log(
              "[audit-route][fallback-market-override-debug]",
              JSON.stringify({
                robustCrossPlatformFallback,
                comparableCount,
                pricedComparableCount,
                avgCompetitorPrice,
                marketSourceQuality: market.marketSourceQuality ?? null,
                marketConfidenceBefore: market.marketConfidence ?? null,
                fallbackLevelBefore: market.fallbackLevel ?? null,
              })
            );

            return {
              ...structuredPayloadBase,
              market: robustCrossPlatformFallback
                ? {
                    ...market,
                    reliabilityBadge: "Lecture cross-platform",
                    reliabilityTitle: "Annonce cible partiellement indisponible",
                    reliabilityMessage:
                      "Booking a limité l'accès à l'annonce cible. Le marché reste exploitable grâce à des comparables cross-platform cohérents, mais doit être interprété avec prudence.",
                  }
                : {
                    ...market,
                    fallbackLevel: "target_unavailable",
                    marketConfidence: "low",
                    reliabilityBadge: "Mode dégradé",
                    reliabilityTitle: "Annonce cible partiellement indisponible",
                    reliabilityMessage:
                      "Booking a limité l'accès à l'annonce cible. L'audit reste généré avec des comparables de secours, mais les estimations de marché doivent être interprétées avec prudence.",
                  },
            };
          })()
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

    const persistClient = createSupabaseAdminClient();
    console.log(
      "[audit-route][structured-payload-market-before-persist]",
      JSON.stringify({
        market: structuredPayload.market ?? null,
      })
    );
    console.log(
      "[audit][persist-start]",
      JSON.stringify({
        listingId: listingRow.id,
        workspaceId: listingRow.workspace_id,
        userId: user.id,
        competitorCount: competitorBundle.competitors.length,
      })
    );

    const { data: listingTitleBeforeAuditInsert } = await persistClient
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
    const { data: auditRow, error: auditError } = await persistClient
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
      console.error(
        "[audit][persist-failed]",
        JSON.stringify({
          stage: "insert_audits",
          listingId: listingRow.id,
          workspaceId: listingRow.workspace_id,
          userId: user.id,
          error: auditError?.message ?? "Failed to create audit",
        })
      );
      throw new Error(auditError?.message || "Failed to create audit");
    }


    console.log("[AUDIT TRACE] after insert", {
      auditId: auditRow.id,
      billingAdminBypass,
    });

    console.log(
      "[audit][persist-success]",
      JSON.stringify({
        id: auditRow.id,
        workspace_id: auditRow.workspace_id,
        user_id: auditRow.created_by ?? null,
      })
    );

    if (!billingAdminBypass) {
      const { data: consumeLedgerRow, error: consumeLedgerError } = await persistClient
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
          await persistClient.from("audits").delete().eq("id", auditRow.id);
          return NextResponse.json(
            {
              error: "Ce débit de crédit est déjà enregistré pour cet audit.",
              code: "audit_credit_already_recorded",
            },
            { status: 409 }
          );
        }
        await persistClient.from("audits").delete().eq("id", auditRow.id);
        console.error(
          "[audit][persist-failed]",
          JSON.stringify({
            stage: "insert_usage_events_credit_consumed",
            auditId: auditRow.id,
            listingId: listingRow.id,
            workspaceId: listingRow.workspace_id,
            userId: user.id,
            error: consumeLedgerError.message || "Failed to record credit consumption ledger",
          })
        );
        throw new Error("Failed to record credit consumption ledger");
      }

      const creditConsumption = await consumeWorkspaceAuditCredits(
        listingRow.workspace_id,
        persistClient,
        1
      );

      if (!creditConsumption.success) {
        if (consumeLedgerRow?.id) {
          await persistClient.from("usage_events").delete().eq("id", consumeLedgerRow.id);
        }
        const { error: deleteAuditError } = await persistClient
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

    const intelligenceV2Flags = getIntelligenceV2FeatureFlags();

    if (
      intelligenceV2Flags.ENABLE_INTELLIGENCE_FACT_TRANSFORMATION &&
      pricingFactCollectionMode === "live"
    ) {
      const routeLookupGeo = routeLookupLocation(extracted);
      const fallbackCountry =
        effectiveMarketCountryOverride ?? routeLookupGeo.country;
      const fallbackCity = effectiveMarketCityOverride ?? routeLookupGeo.city;
      const fallbackPropertyType =
        propertyTypeOverride != null
          ? mapPropertyTypeOverrideToListingPropertyType(propertyTypeOverride)
          : extracted.propertyType ?? null;
      const capturedAt = new Date().toISOString();
      const observations = competitorBundle.competitors.flatMap((competitor) => {
        const comparable = competitor as IntelligenceV2RouteComparable;
        if (comparable.sourceKind === "market_memory_seed") {
          return [];
        }

        const nightlyPrice = routePositiveNumber(comparable.price);
        const currency = routeNormalizeText(comparable.currency);
        const platform = routeNormalizeText(comparable.platform);

        if (nightlyPrice == null || currency == null || platform == null) {
          return [];
        }

        const identity = buildPrivateComparableIdentity({
          platform,
          url: comparable.url ?? null,
          sourceUrl: comparable.sourceUrl ?? null,
          canonicalUrl: comparable.canonicalUrl ?? null,
          sourceId: comparable.externalId ?? null,
          title: comparable.title ?? null,
          locationLabel: comparable.locationLabel ?? comparable.structure?.locationLabel ?? null,
          latitude: comparable.latitude ?? null,
          longitude: comparable.longitude ?? null,
        });

        if (!identity.ok) {
          return [];
        }

        const comparableGeo = routeComparableLocation(comparable);

        return [
          {
            privateComparableSignature: identity.privateComparableSignature,
            capturedAt,
            platform,
            country: comparableGeo.country ?? fallbackCountry,
            city: comparableGeo.city ?? fallbackCity,
            propertyType:
              routeNormalizeText(comparable.propertyType) ?? fallbackPropertyType,
            capacity: routePositiveInteger(comparable.capacity),
            guestCapacity: routePositiveInteger(comparable.guestCapacity),
            currency,
            nightlyPrice,
            sourceKind: "live_comparable" as const,
            comparableQuality: comparable.comparableQuality,
          },
        ];
      });

      if (observations.length > 0) {
        try {
          await writeAnonymousPricingFacts({
            sourceClass: "authenticated_audit",
            collectionMode: "live",
            observations,
          });
        } catch {
          if (intelligenceV2Flags.DEBUG_INTELLIGENCE_V2) {
            console.warn("[INTELLIGENCE_V2_AUDIT_CONTRIBUTION_FAILED]");
          }
        }
      }
    }

    // ✅ DEBUG DB WRITE
    const { data: persistedAudit } = await persistClient
      .from("audits")
      .select("id, overall_score, result_payload")
      .eq("id", auditRow.id)
      .maybeSingle();

    console.info("[DB CHECK]", persistedAudit);

    const { error: usageError } = await persistClient.from("usage_events").insert({
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
    if (auditComputedBeforePersistFailure) {
      console.error(
        "[audit][computed-but-persist-failed]",
        JSON.stringify({
          error: "Une erreur est survenue pendant le traitement de l’audit.",
        })
      );
    }
    console.error(
      "[audit][persist-failed]",
      JSON.stringify({
        stage: "route_catch",
        error: "Une erreur est survenue pendant le traitement de l’audit.",
        auditComputedBeforePersistFailure,
      })
    );
    if (error instanceof InvalidBookingTargetUrlError) {
      return NextResponse.json(
        {
          error: INVALID_BOOKING_TARGET_URL_MESSAGE,
        },
        { status: 400 }
      );
    }

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
        details: undefined,
      },
      { status: 500 }
    );
  }
}
