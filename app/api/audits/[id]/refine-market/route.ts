import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { StructuredAuditResultPayload } from "@/lib/audits/formatResultPayload";
import type { ExtractedListing, SupportedPlatform } from "@/lib/extractors/types";
import { extractListing } from "@/lib/extractors";
import {
  rankRefinedComparables,
  isPremiumRefinementMode,
  type RefinementInput,
  type RefinedComparableResult,
} from "@/lib/competitors/scoreRefinedComparable";
import {
  buildPremiumDiscoverySignals,
  applyPremiumSignalsToAirbnbUrl,
  applyPremiumSignalsToBookingQueries,
} from "@/lib/competitors/buildPremiumDiscoverySignals";
import { searchBookingPremiumUrlsEarlyStop } from "@/lib/competitors/booking-search";

// ─── Local DB row types (mirrors market_snapshots / market_comparables schema) ─

type SnapshotRow = {
  id: string;
  created_at: string;
  comparable_count: number | null;
  metadata: Record<string, unknown> | null;
};

type ComparableRow = {
  id: string;
  snapshot_id: string;
  platform: string | null;
  url: string | null;
  title: string | null;
  nightly_price: number | null;
  currency: string | null;
  property_type: string | null;
  latitude: number | null;
  longitude: number | null;
  raw: Record<string, unknown> | null;
};

// ─── Route input / output types ───────────────────────────────────────────────

type RefineMarketInput = {
  propType?: string;
  bedrooms?: string;
  bathrooms?: string;
  guests?: string;
  beds?: string;
  minStay?: string;
  marketTier?: string;
  attributes?: string[];
  /** "diagnostic" (default) = no Playwright; "active" = premium discovery enabled if premiumMode */
  mode?: "diagnostic" | "active";
};

type MergedTargetPreview = {
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  accommodates: number | null;
  beds: number | null;
  minNights: number | null;
  marketTier: string | null;
  attributes: string[];
};

type SnapshotMatchInfo = {
  snapshotId: string;
  comparableCount: number;
  matchedBy: "source_url" | "metadata_listing_id";
};

type ComparableScoringResult =
  | {
      status: "skipped";
      reason: string;
      checkedFields: string[];
      premiumMode: boolean;
      count: 0;
      topScores: [];
      notes: string[];
    }
  | {
      status: "skipped_no_snapshot" | "skipped_snapshot_empty";
      reason: string;
      premiumMode: boolean;
      count: 0;
      topScores: [];
      notes: string[];
    }
  | {
      status: "scored" | "scored_from_market_memory";
      premiumMode: boolean;
      count: number;
      snapshotId?: string;
      matchedBy?: string;
      topScores: Array<{ url: string | null; score: number; breakdown: unknown }>;
      notes: string[];
    };

// ─── Score threshold ──────────────────────────────────────────────────────────

const SCORE_THRESHOLD = 60;

// ─── Premium discovery experimental limits (hardcoded, not overridable by caller) ─

/** Hard cap on candidate URLs returned by experimental premium discovery. */
const PREMIUM_DISCOVERY_CAP = 8;
/** Stop as soon as this many post-gate valid listing URLs are found. */
const PREMIUM_DISCOVERY_EARLY_STOP_MIN = 6;
/**
 * Cooperative abort timeout (ms) for premium discovery active dev mode.
 * Intentionally larger than the 6C value to accommodate the early-stop flow,
 * which reliably returns after ~41 s on real Booking sessions.
 * Never reached in production — gated behind mode: "active" + DEBUG_AUDIT_UI.
 */
const PREMIUM_DISCOVERY_TIMEOUT_MS = 45_000;

/**
 * Per-URL timeout for sequential light extraction.
 * 8 parallel BrightData CDP calls saturate the connection pool; sequential
 * with a generous per-URL budget lets each call complete independently.
 * Dev-only: gated behind mode: "active".
 */
const PREMIUM_EXTRACTION_TIMEOUT_MS = 25_000;
/**
 * How many URLs to attempt AND how many valid extractions to stop at.
 * Sequential mode: we stop as soon as CAP valid extractions are collected,
 * so wall time ≈ CAP × TIMEOUT_MS worst case (3 × 25s = 75s).
 */
const PREMIUM_EXTRACTION_CAP = 3;
const PREMIUM_REFINE_CACHE_MAX_AGE_MINUTES = 180;

// ─── Refined market preview ───────────────────────────────────────────────────

type RefinedMarketPreview = {
  status: "ok" | "insufficient_refined_comparables";
  selectedComparableCount: number;
  medianNightlyPrice: number | null;
  avgNightlyPrice: number | null;
  confidencePreview: "high" | "medium" | "low";
  reason: string | null;
};

type RefinedPremiumMarketPreview = {
  status: "ok" | "insufficient_premium_extracted_comparables";
  selectedComparableCount: number;
  adjustedAvgNightlyPrice: number | null;
  adjustedMedianNightlyPrice: number | null;
  minAdjustedNightlyPrice: number | null;
  maxAdjustedNightlyPrice: number | null;
  confidencePreview: "high" | "medium" | "low";
  proxyComparableCount: number;
  directComparableCount: number;
  reason: string | null;
  admissionDebugSummary: {
    evaluatedCount: number;
    admittedCount: number;
    rejectedCount: number;
    rejectionCountsByReason: Record<string, number>;
  };
};

// ─── Premium discovery result ─────────────────────────────────────────────────

type PremiumDiscoveryResult = {
  status: "skipped" | "success" | "timeout" | "error" | "no_candidates";
  candidateCount: number;
  /** Raw URLs only — no extraction, no scoring, never persisted. */
  candidateUrls: string[];
  prioritizedCandidateUrls: Array<{
    url: string;
    score: number;
    inferredBedroomsFromUrl: number | null;
    inferredCapacityRangeFromUrl: string | null;
    inferenceReasonsFromUrl: string[];
  }>;
  source: "booking" | "booking_premium_early_stop";
  elapsedMs: number;
  /** True when discovery produced 0 results — market_comparables data remains authoritative. */
  fallbackUsed: boolean;
};

type PremiumRefineCacheInfo = {
  hit: boolean;
  written: boolean;
  source?: "audits.result_payload.premiumRefineCache";
  ageMinutes?: number | null;
  refinementSignature: string;
};

// ─── Premium extraction result ────────────────────────────────────────────────

type PremiumExtractionComparable = {
  url: string;
  title: string | null;
  propertyType: string | null;
  price: number | null;
  adjustedNightlyPrice: number | null;
  adjustedReason:
    | "room_unit_scaled_for_target_bedrooms"
    | "premium_hotel_price_kept"
    | "villa_price_kept"
    | "price_missing";
  bedrooms: number | null;
  capacity: number | null;
  inferredLuxuryProperty: boolean;
  inferredBedrooms: number | null;
  inferredCapacityRange: string | null;
  inferredComparableStrength: "weak" | "medium" | "strong";
  inferenceReasons: string[];
  score: number;
  breakdown: unknown;
};

type PremiumStructureInference = {
  inferredLuxuryProperty: boolean;
  inferredBedrooms: number | null;
  inferredCapacityRange: string | null;
  inferredComparableStrength: "weak" | "medium" | "strong";
  inferenceReasons: string[];
};

type PremiumNormalizedListing = ExtractedListing & {
  __premiumStructureInference?: PremiumStructureInference;
};

type PremiumExtractionResult = {
  status: "ok" | "no_candidates" | "all_failed";
  extractedCount: number;
  failedCount: number;
  attemptedCount: number;
  cap: number;
  timeoutMs: number;
  mode: "sequential";
  comparables: PremiumExtractionComparable[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseIntField(value: string | undefined): number | null {
  if (!value || value.endsWith("+")) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function safePositiveNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function safeFiniteNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function buildPremiumRefinementSignature(input: {
  auditId: string;
  listingId: string;
  refinement: RefinementInput;
  target: ExtractedListing | null;
}): string {
  const targetLocation =
    (typeof input.target?.locationLabel === "string" && input.target.locationLabel.trim()) ||
    (typeof input.target?.title === "string" && input.target.title.trim()) ||
    null;

  const signaturePayload = {
    auditId: input.auditId,
    listingId: input.listingId,
    propType: input.refinement.propType ?? null,
    bedrooms: input.refinement.bedrooms ?? null,
    bathrooms: input.refinement.bathrooms ?? null,
    guests: input.refinement.guests ?? null,
    beds: input.refinement.beds ?? null,
    minStay: input.refinement.minStay ?? null,
    attributes: [...(input.refinement.attributes ?? [])].sort(),
    targetPrice:
      typeof input.target?.price === "number" && Number.isFinite(input.target.price)
        ? input.target.price
        : null,
    targetPlatform: input.target?.platform ?? null,
    targetLocation,
  };

  return createHash("sha256").update(stableStringify(signaturePayload)).digest("hex");
}

function normalizeCachedPremiumDiscoveryResult(raw: unknown): PremiumDiscoveryResult | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const status = obj["status"];
  const source = obj["source"];
  if (
    status !== "skipped" &&
    status !== "success" &&
    status !== "timeout" &&
    status !== "error" &&
    status !== "no_candidates"
  ) {
    return null;
  }
  if (source !== "booking" && source !== "booking_premium_early_stop") {
    return null;
  }

  const rawPrioritized = Array.isArray(obj["prioritizedCandidateUrls"])
    ? (obj["prioritizedCandidateUrls"] as unknown[])
    : [];

  return {
    status,
    candidateCount:
      typeof obj["candidateCount"] === "number" && Number.isFinite(obj["candidateCount"])
        ? obj["candidateCount"]
        : 0,
    candidateUrls: Array.isArray(obj["candidateUrls"])
      ? (obj["candidateUrls"] as unknown[]).filter((value): value is string => typeof value === "string")
      : [],
    prioritizedCandidateUrls: rawPrioritized
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        if (typeof row["url"] !== "string") return null;
        return {
          url: row["url"],
          score:
            typeof row["score"] === "number" && Number.isFinite(row["score"]) ? row["score"] : 0,
          inferredBedroomsFromUrl: safeFiniteNum(row["inferredBedroomsFromUrl"]),
          inferredCapacityRangeFromUrl:
            typeof row["inferredCapacityRangeFromUrl"] === "string"
              ? row["inferredCapacityRangeFromUrl"]
              : null,
          inferenceReasonsFromUrl: Array.isArray(row["inferenceReasonsFromUrl"])
            ? (row["inferenceReasonsFromUrl"] as unknown[]).filter(
                (value): value is string => typeof value === "string"
              )
            : [],
        };
      })
      .filter(
        (
          item
        ): item is {
          url: string;
          score: number;
          inferredBedroomsFromUrl: number | null;
          inferredCapacityRangeFromUrl: string | null;
          inferenceReasonsFromUrl: string[];
        } => item !== null
      ),
    source,
    elapsedMs:
      typeof obj["elapsedMs"] === "number" && Number.isFinite(obj["elapsedMs"])
        ? obj["elapsedMs"]
        : 0,
    fallbackUsed: obj["fallbackUsed"] === true,
  };
}

function normalizeCachedPremiumExtractionResult(raw: unknown): PremiumExtractionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const status = obj["status"];
  if (status !== "ok" && status !== "no_candidates" && status !== "all_failed") {
    return null;
  }
  const rawComparables = Array.isArray(obj["comparables"]) ? (obj["comparables"] as unknown[]) : [];
  const comparables = rawComparables.reduce<PremiumExtractionComparable[]>((acc, item) => {
    if (!item || typeof item !== "object") return acc;
    const row = item as Record<string, unknown>;
    if (typeof row["url"] !== "string") return acc;

    const comparable: PremiumExtractionComparable = {
      url: row["url"],
      title: typeof row["title"] === "string" ? row["title"] : null,
      propertyType: typeof row["propertyType"] === "string" ? row["propertyType"] : null,
      price: safePositiveNum(row["price"]),
      adjustedNightlyPrice: safePositiveNum(row["adjustedNightlyPrice"]),
      adjustedReason:
        row["adjustedReason"] === "room_unit_scaled_for_target_bedrooms" ||
        row["adjustedReason"] === "premium_hotel_price_kept" ||
        row["adjustedReason"] === "villa_price_kept" ||
        row["adjustedReason"] === "price_missing"
          ? row["adjustedReason"]
          : "price_missing",
      bedrooms: safeFiniteNum(row["bedrooms"]),
      capacity: safeFiniteNum(row["capacity"]),
      inferredLuxuryProperty: row["inferredLuxuryProperty"] === true,
      inferredBedrooms: safeFiniteNum(row["inferredBedrooms"]),
      inferredCapacityRange:
        typeof row["inferredCapacityRange"] === "string" ? row["inferredCapacityRange"] : null,
      inferredComparableStrength:
        row["inferredComparableStrength"] === "strong" ||
        row["inferredComparableStrength"] === "medium" ||
        row["inferredComparableStrength"] === "weak"
          ? row["inferredComparableStrength"]
          : "weak",
      inferenceReasons: Array.isArray(row["inferenceReasons"])
        ? (row["inferenceReasons"] as unknown[]).filter(
            (value): value is string => typeof value === "string"
          )
        : [],
      score: safeFiniteNum(row["score"]) ?? 0,
      breakdown: row["breakdown"] ?? null,
    };

    acc.push(comparable);
    return acc;
  }, []);

  return {
    status,
    extractedCount:
      typeof obj["extractedCount"] === "number" && Number.isFinite(obj["extractedCount"])
        ? obj["extractedCount"]
        : comparables.length,
    failedCount:
      typeof obj["failedCount"] === "number" && Number.isFinite(obj["failedCount"])
        ? obj["failedCount"]
        : 0,
    attemptedCount:
      typeof obj["attemptedCount"] === "number" && Number.isFinite(obj["attemptedCount"])
        ? obj["attemptedCount"]
        : comparables.length,
    cap: typeof obj["cap"] === "number" && Number.isFinite(obj["cap"]) ? obj["cap"] : PREMIUM_EXTRACTION_CAP,
    timeoutMs:
      typeof obj["timeoutMs"] === "number" && Number.isFinite(obj["timeoutMs"])
        ? obj["timeoutMs"]
        : PREMIUM_EXTRACTION_TIMEOUT_MS,
    mode: "sequential",
    comparables,
  };
}

function readPremiumRefineCacheFromPayload(
  rawPayload: Partial<StructuredAuditResultPayload> | null,
  refinementSignature: string
): {
  premiumDiscoveryResult: PremiumDiscoveryResult | null;
  premiumExtractedComparables: PremiumExtractionResult | null;
  ageMinutes: number;
} | null {
  const payloadRecord =
    rawPayload && typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>) : null;
  const rawCache = payloadRecord?.["premiumRefineCache"];
  const hasResultPayload = payloadRecord !== null;
  const resultPayloadKeys = payloadRecord ? Object.keys(payloadRecord).slice(0, 40) : [];
  const hasPremiumRefineCache = !!rawCache && typeof rawCache === "object";

  if (!rawCache || typeof rawCache !== "object") {
    console.log(
      "[refine-market][premium-refine-cache-read-diagnostic]",
      JSON.stringify({
        hasResultPayload,
        resultPayloadKeys,
        hasPremiumRefineCache,
        cacheKeys: [],
        cacheCreatedAt: null,
        cacheAgeMinutes: null,
        currentRefinementSignature: refinementSignature,
        cachedRefinementSignature: null,
        signatureMatches: false,
        cacheFreshEnough: false,
        payloadNormalizable: false,
        cacheRejectReason: hasResultPayload ? "premium_refine_cache_missing" : "result_payload_missing",
      })
    );
    return null;
  }

  const cache = rawCache as Record<string, unknown>;
  const cacheKeys = Object.keys(cache).slice(0, 40);
  const cacheCreatedAt = typeof cache["createdAt"] === "string" ? cache["createdAt"] : null;
  const cachedRefinementSignature =
    typeof cache["refinementSignature"] === "string" ? cache["refinementSignature"] : null;
  const signatureMatches = cachedRefinementSignature === refinementSignature;

  if (!signatureMatches) {
    console.log(
      "[refine-market][premium-refine-cache-read-diagnostic]",
      JSON.stringify({
        hasResultPayload,
        resultPayloadKeys,
        hasPremiumRefineCache,
        cacheKeys,
        cacheCreatedAt,
        cacheAgeMinutes: null,
        currentRefinementSignature: refinementSignature,
        cachedRefinementSignature,
        signatureMatches,
        cacheFreshEnough: false,
        payloadNormalizable: false,
        cacheRejectReason: "refinement_signature_mismatch",
      })
    );
    return null;
  }

  if (typeof cache["createdAt"] !== "string") {
    console.log(
      "[refine-market][premium-refine-cache-read-diagnostic]",
      JSON.stringify({
        hasResultPayload,
        resultPayloadKeys,
        hasPremiumRefineCache,
        cacheKeys,
        cacheCreatedAt,
        cacheAgeMinutes: null,
        currentRefinementSignature: refinementSignature,
        cachedRefinementSignature,
        signatureMatches,
        cacheFreshEnough: false,
        payloadNormalizable: false,
        cacheRejectReason: "cache_created_at_missing_or_invalid_type",
      })
    );
    return null;
  }

  const createdAtMs = Date.parse(cache["createdAt"]);
  if (!Number.isFinite(createdAtMs)) {
    console.log(
      "[refine-market][premium-refine-cache-read-diagnostic]",
      JSON.stringify({
        hasResultPayload,
        resultPayloadKeys,
        hasPremiumRefineCache,
        cacheKeys,
        cacheCreatedAt,
        cacheAgeMinutes: null,
        currentRefinementSignature: refinementSignature,
        cachedRefinementSignature,
        signatureMatches,
        cacheFreshEnough: false,
        payloadNormalizable: false,
        cacheRejectReason: "cache_created_at_unparseable",
      })
    );
    return null;
  }
  const ageMinutes = Math.max(0, Math.round((Date.now() - createdAtMs) / 60000));
  const cacheFreshEnough = ageMinutes <= PREMIUM_REFINE_CACHE_MAX_AGE_MINUTES;
  if (!cacheFreshEnough) {
    console.log(
      "[refine-market][premium-refine-cache-read-diagnostic]",
      JSON.stringify({
        hasResultPayload,
        resultPayloadKeys,
        hasPremiumRefineCache,
        cacheKeys,
        cacheCreatedAt,
        cacheAgeMinutes: ageMinutes,
        currentRefinementSignature: refinementSignature,
        cachedRefinementSignature,
        signatureMatches,
        cacheFreshEnough,
        payloadNormalizable: false,
        cacheRejectReason: "cache_too_old",
      })
    );
    return null;
  }

  const premiumDiscoveryResult = normalizeCachedPremiumDiscoveryResult(cache["premiumDiscoveryResult"]);
  const premiumExtractedComparables = normalizeCachedPremiumExtractionResult(
    cache["premiumExtractedComparables"]
  );
  const payloadNormalizable =
    premiumDiscoveryResult !== null || premiumExtractedComparables !== null;
  if (!payloadNormalizable) {
    console.log(
      "[refine-market][premium-refine-cache-read-diagnostic]",
      JSON.stringify({
        hasResultPayload,
        resultPayloadKeys,
        hasPremiumRefineCache,
        cacheKeys,
        cacheCreatedAt,
        cacheAgeMinutes: ageMinutes,
        currentRefinementSignature: refinementSignature,
        cachedRefinementSignature,
        signatureMatches,
        cacheFreshEnough,
        payloadNormalizable,
        cacheRejectReason: "cached_payload_not_normalizable",
      })
    );
    return null;
  }

  console.log(
    "[refine-market][premium-refine-cache-read-diagnostic]",
    JSON.stringify({
      hasResultPayload,
      resultPayloadKeys,
      hasPremiumRefineCache,
      cacheKeys,
      cacheCreatedAt,
      cacheAgeMinutes: ageMinutes,
      currentRefinementSignature: refinementSignature,
      cachedRefinementSignature,
      signatureMatches,
      cacheFreshEnough,
      payloadNormalizable,
      cacheRejectReason: null,
    })
  );

  return {
    premiumDiscoveryResult,
    premiumExtractedComparables,
    ageMinutes,
  };
}

function normalizePremiumCandidateUrlHaystack(url: string): string {
  const raw = url.trim();
  if (!raw) return "";

  const compact = (() => {
    try {
      const parsed = new URL(raw);
      const decodedPath = decodeURIComponent(parsed.pathname);
      return `${parsed.hostname} ${decodedPath}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      return raw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  })();

  return compact;
}

function scorePremiumCandidateUrl(
  url: string,
  target: ExtractedListing,
  refinement: RefinementInput
): number {
  const haystack = normalizePremiumCandidateUrlHaystack(url);
  if (!haystack) return 0;

  let score = 0;
  const includes = (token: string) => haystack.includes(token);

  if (includes("villa")) score += 40;
  if (includes("palais")) score += 35;
  if (includes("tigmiza")) score += 35;
  if (includes("dar rhizlane")) score += 35;
  if (includes("golf")) score += 30;
  if (includes("luxury") || includes("luxe")) score += 25;
  if (includes("spa")) score += 15;
  if (includes("maison")) score += 20;
  if (includes("pool") || includes("piscine")) score += 20;

  if (includes("riad")) score -= 15;
  if (includes("hotel")) score -= 10;
  if (includes("apartment") || includes("appartement")) score -= 40;
  if (includes("1 bdr") || includes("one bedroom") || includes("1 bedroom")) score -= 40;

  const targetPropertyType = String(
    refinement.propType ?? target.propertyType ?? ""
  ).toLowerCase();
  if (targetPropertyType.includes("villa")) {
    if (includes("villa")) score += 10;
    if (includes("palais")) score += 5;
    if (includes("maison")) score += 5;
  }

  return score;
}

function prioritizePremiumCandidateUrls(
  candidateUrls: string[],
  target: ExtractedListing,
  refinement: RefinementInput
): Array<{
  url: string;
  score: number;
  inferredBedroomsFromUrl: number | null;
  inferredCapacityRangeFromUrl: string | null;
  inferenceReasonsFromUrl: string[];
}> {
  return candidateUrls
    .map((url, index) => {
      const inferredBedroomsFromUrl = inferBedroomsFromText(url);
      return {
        url,
        score: scorePremiumCandidateUrl(url, target, refinement),
        inferredBedroomsFromUrl,
        inferredCapacityRangeFromUrl: inferCapacityRangeFromBedrooms(inferredBedroomsFromUrl),
        inferenceReasonsFromUrl:
          inferredBedroomsFromUrl !== null ? ["bedrooms_inferred_from_url_title"] : [],
        index,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map(
      ({
        url,
        score,
        inferredBedroomsFromUrl,
        inferredCapacityRangeFromUrl,
        inferenceReasonsFromUrl,
      }) => ({
        url,
        score,
        inferredBedroomsFromUrl,
        inferredCapacityRangeFromUrl,
        inferenceReasonsFromUrl,
      })
    );
}

function roundPriceForDebug(value: number): number {
  return Math.round(value * 100) / 100;
}

function getListingBedrooms(listing: ExtractedListing | null): number | null {
  if (!listing) return null;
  return (
    safeFiniteNum(listing.bedrooms) ??
    safeFiniteNum(listing.bedroomCount) ??
    null
  );
}

function buildPremiumComparableTypeHaystack(listing: ExtractedListing): string {
  return [
    listing.propertyType,
    listing.title,
    listing.url,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPremiumComparableTextForParsing(
  input: ExtractedListing | string
): string {
  const rawParts =
    typeof input === "string"
      ? [input]
      : [input.url, input.title];

  return rawParts
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildPremiumAmenitiesHaystack(listing: ExtractedListing): string {
  return (Array.isArray(listing.amenities) ? listing.amenities : [])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCapacityRangeFromBedrooms(bedrooms: number | null): string | null {
  if (bedrooms === null || !Number.isFinite(bedrooms) || bedrooms <= 0) return null;
  if (bedrooms >= 5) return "10+ guests";
  if (bedrooms >= 4) return "8-12 guests";
  if (bedrooms === 3) return "6-8 guests";
  if (bedrooms === 2) return "4-6 guests";
  return "2-4 guests";
}

function inferBedroomsFromText(input: ExtractedListing | string): number | null {
  const text = buildPremiumComparableTextForParsing(input);
  if (!text) return null;

  const patterns = [
    /(\d+)[-\s]?suite\b/g,
    /(\d+)[-\s]?suites\b/g,
    /(\d+)[-\s]?ch\b/g,
    /(\d+)\s*chambres?\b/g,
    /(\d+)\s*bedrooms?\b/g,
    /(\d+)[-\s]?bedroom\b/g,
  ];

  let best: number | null = null;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const parsed = Number.parseInt(match[1] ?? "", 10);
      if (!Number.isFinite(parsed) || parsed < 2 || parsed > 15) continue;
      best = best === null ? parsed : Math.max(best, parsed);
    }
  }

  return best;
}

function buildPremiumStructureInference(
  comparable: ExtractedListing,
  target: ExtractedListing,
  _refinement?: RefinementInput
): PremiumStructureInference {
  const haystack = buildPremiumComparableTypeHaystack(comparable);
  const amenitiesHaystack = buildPremiumAmenitiesHaystack(comparable);
  const price = safePositiveNum(comparable.price);
  const rawBedrooms = getListingBedrooms(comparable);
  const targetBedrooms = getListingBedrooms(target);
  const parsedBedroomsFromText = inferBedroomsFromText(comparable);

  const inferenceReasons: string[] = [];

  const mentionVilla = haystack.includes("villa");
  const mentionPalais = haystack.includes("palais");
  const mentionMaison = haystack.includes("maison");
  const mentionTigmiza = haystack.includes("tigmiza");
  const mentionDarRhizlane = haystack.includes("dar rhizlane");
  const mentionGolf = haystack.includes("golf");
  const mentionSpa = haystack.includes("spa");
  const mentionResort = haystack.includes("resort");
  const mentionRiad = haystack.includes("riad");
  const mentionHotel = haystack.includes("hotel");
  const mentionRoom = haystack.includes("room") || haystack.includes("chambre") || haystack.includes("suite");
  const mentionRiadAndSpa = mentionRiad && mentionSpa;

  const amenitySignals = [
    { key: "pool", reason: "amenities_include_pool" },
    { key: "piscine", reason: "amenities_include_piscine" },
    { key: "spa", reason: "amenities_include_spa" },
    { key: "terrace", reason: "amenities_include_terrace" },
    { key: "garden", reason: "amenities_include_garden" },
    { key: "parking", reason: "amenities_include_parking" },
  ].filter((signal) => amenitiesHaystack.includes(signal.key));

  if (mentionVilla) inferenceReasons.push("url_or_title_mentions_villa");
  if (mentionPalais) inferenceReasons.push("url_or_title_mentions_palais");
  if (mentionMaison) inferenceReasons.push("url_or_title_mentions_maison");
  if (mentionTigmiza) inferenceReasons.push("url_or_title_mentions_tigmiza");
  if (mentionDarRhizlane) inferenceReasons.push("url_or_title_mentions_dar_rhizlane");
  if (mentionGolf) inferenceReasons.push("url_or_title_mentions_golf");
  if (mentionSpa) inferenceReasons.push("url_or_title_mentions_spa");
  if (mentionResort) inferenceReasons.push("url_or_title_mentions_resort");
  if (mentionRiadAndSpa) inferenceReasons.push("url_or_title_mentions_riad_and_spa");
  for (const signal of amenitySignals) inferenceReasons.push(signal.reason);

  if (price !== null && price >= 700) {
    inferenceReasons.push("price_ge_700_strong_luxury_signal");
  } else if (price !== null && price >= 450) {
    inferenceReasons.push("price_ge_450_premium_signal");
  }

  if (rawBedrooms !== null && rawBedrooms <= 1 && targetBedrooms !== null && targetBedrooms >= 4) {
    inferenceReasons.push("raw_bedrooms_le_1_but_target_ge_4_suspect_unit_price");
  }

  const proxyType =
    mentionHotel ||
    mentionRiad ||
    mentionRoom ||
    haystack.includes("hotel_like") ||
    haystack.includes("riad_like") ||
    haystack.includes("room_like");

  const premiumTextSignalCount = [
    mentionVilla,
    mentionPalais,
    mentionMaison,
    mentionTigmiza,
    mentionDarRhizlane,
    mentionGolf,
    mentionSpa,
    mentionResort,
    mentionRiadAndSpa,
  ].filter(Boolean).length;
  const amenitySignalCount = amenitySignals.length;
  const strongLuxurySignal =
    mentionVilla ||
    mentionPalais ||
    mentionTigmiza ||
    mentionDarRhizlane ||
    mentionResort ||
    mentionRiadAndSpa;

  if (proxyType && (strongLuxurySignal || (price !== null && price >= 700) || premiumTextSignalCount + amenitySignalCount >= 3)) {
    inferenceReasons.push("proxy_premium_possible_despite_hotel_riad_room_shape");
  }

  let inferredComparableStrength: "weak" | "medium" | "strong" = "weak";
  if (price !== null && price >= 700 && (strongLuxurySignal || premiumTextSignalCount + amenitySignalCount >= 3)) {
    inferredComparableStrength = "strong";
  } else if (
    (price !== null && price >= 450) ||
    premiumTextSignalCount >= 2 ||
    amenitySignalCount >= 3 ||
    premiumTextSignalCount + amenitySignalCount >= 3
  ) {
    inferredComparableStrength = "medium";
  }

  const inferredLuxuryProperty = inferredComparableStrength !== "weak" || strongLuxurySignal;

  let inferredBedrooms: number | null = rawBedrooms ?? null;
  if (
    targetBedrooms !== null &&
    targetBedrooms >= 4 &&
    rawBedrooms !== null &&
    rawBedrooms <= 1 &&
    inferredLuxuryProperty
  ) {
    inferredBedrooms = Math.min(targetBedrooms, price !== null && price >= 700 ? 6 : 4);
    inferenceReasons.push("diagnostic_inferred_bedrooms_from_target_and_premium_signals");
  }

  if (parsedBedroomsFromText !== null) {
    inferredBedrooms =
      inferredBedrooms === null
        ? parsedBedroomsFromText
        : Math.max(inferredBedrooms, parsedBedroomsFromText);
    inferenceReasons.push("bedrooms_inferred_from_url_title");
  }

  if (
    inferredComparableStrength === "medium" &&
    inferredBedrooms !== null &&
    targetBedrooms !== null &&
    inferredBedrooms >= targetBedrooms - 1 &&
    ((price !== null && price >= 400) || premiumTextSignalCount >= 1 || strongLuxurySignal)
  ) {
    inferredComparableStrength = "strong";
    inferenceReasons.push("strength_upgraded_from_inferred_bedrooms_alignment");
  }

  const inferredCapacityRange = inferCapacityRangeFromBedrooms(inferredBedrooms);

  return {
    inferredLuxuryProperty,
    inferredBedrooms,
    inferredCapacityRange,
    inferredComparableStrength,
    inferenceReasons,
  };
}

function computePremiumAdjustedNightlyPrice(
  comparable: ExtractedListing,
  target: ExtractedListing
): {
  adjustedNightlyPrice: number | null;
  adjustedReason:
    | "room_unit_scaled_for_target_bedrooms"
    | "premium_hotel_price_kept"
    | "villa_price_kept"
    | "price_missing";
} {
  const basePrice = safePositiveNum(comparable.price);
  if (basePrice === null) {
    return {
      adjustedNightlyPrice: null,
      adjustedReason: "price_missing",
    };
  }

  const targetBedrooms = getListingBedrooms(target);
  const comparableBedrooms = getListingBedrooms(comparable);
  const targetPrice = safePositiveNum(target.price);
  const haystack = buildPremiumComparableTypeHaystack(comparable);

  const comparableIsRoomUnitRisk =
    haystack.includes("hotel_like") ||
    haystack.includes("hotel") ||
    haystack.includes("riad_like") ||
    haystack.includes("riad") ||
    haystack.includes("room_like") ||
    haystack.includes("room") ||
    haystack.includes("chambre") ||
    haystack.includes("suite");

  const shouldScale =
    targetBedrooms !== null &&
    targetBedrooms >= 4 &&
    (comparableIsRoomUnitRisk || (comparableBedrooms !== null && comparableBedrooms <= 1));

  if (!shouldScale) {
    return {
      adjustedNightlyPrice: basePrice,
      adjustedReason: "villa_price_kept",
    };
  }

  let adjusted = basePrice;
  let adjustedReason:
    | "room_unit_scaled_for_target_bedrooms"
    | "premium_hotel_price_kept" = "premium_hotel_price_kept";

  if (basePrice >= 700) {
    adjusted = basePrice;
  } else if (basePrice >= 300) {
    adjusted = basePrice * 1.8;
    adjustedReason = "room_unit_scaled_for_target_bedrooms";
  } else {
    adjusted = basePrice * Math.min(targetBedrooms, 4) * 0.75;
    adjustedReason = "room_unit_scaled_for_target_bedrooms";
  }

  const cap = targetPrice !== null ? targetPrice * 1.3 : null;
  if (cap !== null && adjusted > cap) {
    adjusted = cap;
    adjustedReason = "room_unit_scaled_for_target_bedrooms";
  }

  return {
    adjustedNightlyPrice: roundPriceForDebug(adjusted),
    adjustedReason,
  };
}

function buildMergedTargetPreview(
  target: ExtractedListing | null,
  input: RefineMarketInput
): MergedTargetPreview {
  const raw = target as Record<string, unknown> | null;

  const propertyType =
    input.propType?.trim() || (typeof raw?.propertyType === "string" ? raw.propertyType : null);

  const bedrooms =
    parseIntField(input.bedrooms) ??
    (typeof raw?.bedrooms === "number" && Number.isFinite(raw.bedrooms) ? (raw.bedrooms as number) : null);

  const bathrooms =
    parseIntField(input.bathrooms) ??
    (typeof raw?.bathrooms === "number" && Number.isFinite(raw.bathrooms) ? (raw.bathrooms as number) : null);

  const accommodates =
    parseIntField(input.guests) ??
    (typeof raw?.accommodates === "number" && Number.isFinite(raw.accommodates) ? (raw.accommodates as number) : null);

  const beds =
    parseIntField(input.beds) ??
    (typeof raw?.beds === "number" && Number.isFinite(raw.beds) ? (raw.beds as number) : null);

  const minNights =
    parseIntField(input.minStay) ??
    (typeof raw?.minimumNights === "number" && Number.isFinite(raw.minimumNights) ? (raw.minimumNights as number) : null);

  return {
    propertyType: propertyType || null,
    bedrooms,
    bathrooms,
    accommodates,
    beds,
    minNights,
    marketTier: input.marketTier?.trim() || null,
    attributes: Array.isArray(input.attributes) ? input.attributes.filter((a) => typeof a === "string") : [],
  };
}

function toRefinementInput(input: RefineMarketInput): RefinementInput {
  return {
    propType: input.propType ?? null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    guests: input.guests ?? null,
    beds: input.beds ?? null,
    minStay: input.minStay ?? null,
    marketTier: input.marketTier ?? null,
    attributes: Array.isArray(input.attributes) ? input.attributes : [],
  };
}

function computeRefinedMarketPreview(
  ranked: RefinedComparableResult[],
  _target: ExtractedListing | null
): RefinedMarketPreview {
  const qualified = ranked.filter((r) => r.score >= SCORE_THRESHOLD);

  if (qualified.length === 0) {
    return {
      status: "insufficient_refined_comparables",
      selectedComparableCount: 0,
      medianNightlyPrice: null,
      avgNightlyPrice: null,
      confidencePreview: "low",
      reason: "no_comparable_above_score_threshold",
    };
  }

  const prices = qualified
    .map((r) => safePositiveNum(r.comparable.price))
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return {
      status: "insufficient_refined_comparables",
      selectedComparableCount: qualified.length,
      medianNightlyPrice: null,
      avgNightlyPrice: null,
      confidencePreview: "low",
      reason: "no_comparable_above_score_threshold_with_price",
    };
  }

  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 1
      ? prices[mid]!
      : (prices[mid - 1]! + prices[mid]!) / 2;
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const confidencePreview: "high" | "medium" | "low" =
    prices.length >= 4 ? "high" : prices.length >= 2 ? "medium" : "low";

  return {
    status: "ok",
    selectedComparableCount: qualified.length,
    medianNightlyPrice: Math.round(median * 100) / 100,
    avgNightlyPrice: Math.round(avg * 100) / 100,
    confidencePreview,
    reason: null,
  };
}

function computeRefinedPremiumMarketPreview(
  premiumExtraction: PremiumExtractionResult | null
): RefinedPremiumMarketPreview {
  const emptyAdmissionDebugSummary = {
    evaluatedCount: 0,
    admittedCount: 0,
    rejectedCount: 0,
    rejectionCountsByReason: {} as Record<string, number>,
  };

  if (premiumExtraction?.status !== "ok" || premiumExtraction.comparables.length === 0) {
    return {
      status: "insufficient_premium_extracted_comparables",
      selectedComparableCount: 0,
      adjustedAvgNightlyPrice: null,
      adjustedMedianNightlyPrice: null,
      minAdjustedNightlyPrice: null,
      maxAdjustedNightlyPrice: null,
      confidencePreview: "low",
      proxyComparableCount: 0,
      directComparableCount: 0,
      reason: "no_premium_extracted_comparables",
      admissionDebugSummary: emptyAdmissionDebugSummary,
    };
  }

  const admissionDiagnostics = premiumExtraction.comparables.map((comparable) => {
    const adjustedPrice = safePositiveNum(comparable.adjustedNightlyPrice);
    const isProxyComparable = comparable.adjustedReason !== "villa_price_kept";
    const isDirectComparable = comparable.adjustedReason === "villa_price_kept";
    const rejectionReasons: string[] = [];
    const admissionScoreBonusReasons: string[] = [];

    let admissionScore = comparable.score;
    if (comparable.inferredComparableStrength === "strong") {
      admissionScore += 25;
      admissionScoreBonusReasons.push("strong_inferred_comparable_bonus");
    } else if (comparable.inferredComparableStrength === "medium") {
      admissionScore += 15;
      admissionScoreBonusReasons.push("medium_inferred_comparable_bonus");
    }
    if (comparable.inferredLuxuryProperty === true) {
      admissionScore += 15;
      admissionScoreBonusReasons.push("inferred_luxury_property_bonus");
    }
    if (adjustedPrice !== null && adjustedPrice >= 450) {
      admissionScore += 10;
      admissionScoreBonusReasons.push("adjusted_price_ge_450_bonus");
    }
    if (
      comparable.inferenceReasons.some((reason) =>
        [
          "amenities_include_piscine",
          "amenities_include_pool",
          "amenities_include_spa",
          "url_or_title_mentions_palais",
          "url_or_title_mentions_tigmiza",
          "url_or_title_mentions_dar_rhizlane",
        ].includes(reason)
      )
    ) {
      admissionScore += 10;
      admissionScoreBonusReasons.push("premium_signal_reason_bonus");
    }
    admissionScore = Math.min(admissionScore, 60);

    if (adjustedPrice === null) rejectionReasons.push("adjusted_price_missing");
    if (comparable.inferredComparableStrength === "weak") {
      rejectionReasons.push("weak_inferred_comparable");
    }
    if (
      comparable.inferredLuxuryProperty !== true &&
      comparable.inferredBedrooms === null &&
      comparable.inferredCapacityRange === null
    ) {
      rejectionReasons.push("unknown_structure");
    }
    if (admissionScore < 35) rejectionReasons.push("score_below_threshold");
    if (
      comparable.inferredComparableStrength === "weak" &&
      (adjustedPrice === null || adjustedPrice < 450)
    ) {
      rejectionReasons.push("weak_inferred_comparable_low_price_hard_reject");
    }

    const admissible =
      adjustedPrice !== null &&
      admissionScore >= 35 &&
      !(
        comparable.inferredComparableStrength === "weak" &&
        (adjustedPrice === null || adjustedPrice < 450)
      );

    console.log(
      "[refine-market][premium-comparable-admission]",
      JSON.stringify({
        url: comparable.url,
        title: comparable.title,
        price: comparable.price,
        adjustedNightlyPrice: comparable.adjustedNightlyPrice,
        adjustedReason: comparable.adjustedReason,
        score: comparable.score,
        rawScore: comparable.score,
        admissionScore,
        admissionScoreBonusReasons,
        admissible,
        rejectionReasons,
        propertyType: comparable.propertyType,
        bedrooms: comparable.bedrooms,
        capacity: comparable.capacity,
        inferredLuxuryProperty: comparable.inferredLuxuryProperty,
        inferredBedrooms: comparable.inferredBedrooms,
        inferredCapacityRange: comparable.inferredCapacityRange,
        inferredComparableStrength: comparable.inferredComparableStrength,
        isProxyComparable,
        isDirectComparable,
        thresholdUsed:
          "adjustedNightlyPrice_finite_and_admissionScore_gte_35_with_weak_low_price_hard_reject",
      })
    );

    return {
      comparable,
      admissible,
      admissionScore,
      rejectionReasons,
      isProxyComparable,
      isDirectComparable,
    };
  });

  const rejectionCountsByReason = admissionDiagnostics
    .filter((item) => !item.admissible)
    .reduce<Record<string, number>>((acc, item) => {
      for (const reason of item.rejectionReasons) {
        acc[reason] = (acc[reason] ?? 0) + 1;
      }
      return acc;
    }, {});

  const admissionDebugSummary = {
    evaluatedCount: admissionDiagnostics.length,
    admittedCount: admissionDiagnostics.filter((item) => item.admissible).length,
    rejectedCount: admissionDiagnostics.filter((item) => !item.admissible).length,
    rejectionCountsByReason,
  };

  const eligible = admissionDiagnostics
    .filter((item) => item.admissible)
    .map((item) => item.comparable);

  if (eligible.length === 0) {
    return {
      status: "insufficient_premium_extracted_comparables",
      selectedComparableCount: 0,
      adjustedAvgNightlyPrice: null,
      adjustedMedianNightlyPrice: null,
      minAdjustedNightlyPrice: null,
      maxAdjustedNightlyPrice: null,
      confidencePreview: "low",
      proxyComparableCount: 0,
      directComparableCount: 0,
      reason: "no_admissible_premium_extracted_comparable",
      admissionDebugSummary,
    };
  }

  const prices = eligible
    .map((comparable) => safePositiveNum(comparable.adjustedNightlyPrice))
    .filter((price): price is number => price !== null)
    .sort((a, b) => a - b);

  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 1
      ? prices[mid]!
      : (prices[mid - 1]! + prices[mid]!) / 2;
  const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;

  const proxyComparableCount = eligible.filter(
    (comparable) => comparable.adjustedReason !== "villa_price_kept"
  ).length;
  const directComparableCount = eligible.filter(
    (comparable) => comparable.adjustedReason === "villa_price_kept"
  ).length;
  const reliableComparableCount = admissionDiagnostics.filter(
    (item) => item.admissible && item.admissionScore >= 50
  ).length;

  let confidencePreview: "high" | "medium" | "low" = "medium";
  if (eligible.length === 1) {
    confidencePreview = "low";
  } else if (eligible.length === 2) {
    confidencePreview = "medium";
  } else if (reliableComparableCount >= 3) {
    confidencePreview = "high";
  }

  const allProxy = proxyComparableCount === eligible.length;
  if (allProxy && confidencePreview === "high") {
    confidencePreview = "medium";
  }

  return {
    status: "ok",
    selectedComparableCount: eligible.length,
    adjustedAvgNightlyPrice: roundPriceForDebug(avg),
    adjustedMedianNightlyPrice: roundPriceForDebug(median),
    minAdjustedNightlyPrice: roundPriceForDebug(prices[0]!),
    maxAdjustedNightlyPrice: roundPriceForDebug(prices[prices.length - 1]!),
    confidencePreview,
    proxyComparableCount,
    directComparableCount,
    reason: allProxy ? "premium_proxy_market_only" : null,
    admissionDebugSummary,
  };
}

// ─── market_comparables row → ExtractedListing ───────────────────────────────

function rowToExtractedListing(row: ComparableRow): ExtractedListing {
  const rb = (row.raw ?? {}) as Record<string, unknown>;

  const platform = ((row.platform ?? rb.platform ?? "other") as SupportedPlatform);
  const url = row.url ?? (typeof rb.url === "string" ? rb.url : "") ?? "";
  const title = row.title ?? (typeof rb.title === "string" ? rb.title : "");
  const description = typeof rb.description === "string" ? rb.description : "";
  const amenities = Array.isArray(rb.amenities)
    ? (rb.amenities as unknown[]).filter((a): a is string => typeof a === "string")
    : [];
  const photos = Array.isArray(rb.photos)
    ? (rb.photos as unknown[]).filter((p): p is string => typeof p === "string").slice(0, 10)
    : [];

  // Price: column nightly_price is authoritative; fallback to raw.price
  const price = safePositiveNum(row.nightly_price) ?? safePositiveNum(rb.price) ?? undefined;
  const currency = row.currency ?? (typeof rb.currency === "string" ? rb.currency : undefined);
  const propertyType = row.property_type ?? (typeof rb.propertyType === "string" ? rb.propertyType : undefined);

  // Capacity fields from raw (not in dedicated columns)
  const bedrooms = safeFiniteNum(rb.bedrooms) ?? safeFiniteNum(rb.bedroomCount) ?? undefined;
  const bathrooms = safeFiniteNum(rb.bathrooms) ?? safeFiniteNum(rb.bathroomCount) ?? undefined;
  const capacity = safePositiveNum(rb.capacity) ?? safePositiveNum(rb.guestCapacity) ?? undefined;

  return {
    url,
    platform,
    title,
    description,
    amenities,
    photos,
    price: price ?? null,
    currency: currency ?? null,
    propertyType: propertyType ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    bedrooms: bedrooms ?? null,
    bathrooms: bathrooms ?? null,
    capacity: capacity ?? null,
    airbnbComparableClassificationText:
      typeof rb.airbnbComparableClassificationText === "string"
        ? rb.airbnbComparableClassificationText
        : null,
    locationLabel:
      typeof rb.locationLabel === "string" ? rb.locationLabel : null,
  };
}

// ─── Snapshot lookup (read-only, admin client) ────────────────────────────────

async function findBestSnapshotForListing(
  sourceUrl: string | null,
  listingId: string
): Promise<SnapshotMatchInfo | null> {
  const admin = createSupabaseAdminClient();

  // Tier 1 — exact source_url match (most precise: same listing URL)
  if (sourceUrl) {
    const { data } = await admin
      .from("market_snapshots")
      .select("id, created_at, comparable_count, metadata")
      .eq("source_url", sourceUrl)
      .order("created_at", { ascending: false })
      .limit(5);

    const best = ((data ?? []) as SnapshotRow[])
      .filter((s) => (s.comparable_count ?? 0) >= 1)
      .sort((a, b) => (b.comparable_count ?? 0) - (a.comparable_count ?? 0))[0];

    if (best) {
      return {
        snapshotId: best.id,
        comparableCount: best.comparable_count ?? 0,
        matchedBy: "source_url",
      };
    }
  }

  // Tier 2 — metadata->>'listing_id' match (stored by saveMarketSnapshot extraMetadata)
  const { data: data2 } = await admin
    .from("market_snapshots")
    .select("id, created_at, comparable_count, metadata")
    .contains("metadata", { listing_id: listingId })
    .order("created_at", { ascending: false })
    .limit(5);

  const best2 = ((data2 ?? []) as SnapshotRow[])
    .filter((s) => (s.comparable_count ?? 0) >= 1)
    .sort((a, b) => (b.comparable_count ?? 0) - (a.comparable_count ?? 0))[0];

  if (best2) {
    return {
      snapshotId: best2.id,
      comparableCount: best2.comparable_count ?? 0,
      matchedBy: "metadata_listing_id",
    };
  }

  return null;
}

async function loadSnapshotComparables(snapshotId: string): Promise<ComparableRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("market_comparables")
    .select("id, snapshot_id, platform, url, title, nightly_price, currency, property_type, latitude, longitude, raw")
    .eq("snapshot_id", snapshotId)
    .limit(20);

  if (error) {
    console.error("[refine-market][comparable-load-error]", { snapshotId, error: error.message });
    return [];
  }
  return (data ?? []) as ComparableRow[];
}

// ─── result_payload check (fast, in-memory, always first) ────────────────────

function extractComparablesFromPayload(
  payload: Partial<StructuredAuditResultPayload> | null
): { comparables: ExtractedListing[] | null; checkedFields: string[] } {
  const checkedFields = [
    "result_payload.market",
    "result_payload.businessInsights.pricing",
    "result_payload.competitorSummary",
    "result_payload.competitors",
  ];

  const rawAsRecord = payload as Record<string, unknown> | null;
  if (rawAsRecord && Array.isArray(rawAsRecord["competitors"]) && rawAsRecord["competitors"].length > 0) {
    return { comparables: rawAsRecord["competitors"] as ExtractedListing[], checkedFields };
  }
  return { comparables: null, checkedFields };
}

// ─── Scoring runner ───────────────────────────────────────────────────────────

function runComparableScoring(
  comparables: ExtractedListing[] | null,
  checkedFields: string[],
  target: ExtractedListing | null,
  refinement: RefinementInput,
  snapshotMatch: SnapshotMatchInfo | null,
  source: "result_payload" | "market_memory" | null
): ComparableScoringResult {
  const premiumMode = target ? isPremiumRefinementMode(target, refinement) : false;

  if (!comparables || comparables.length === 0 || !target) {
    if (source === null && snapshotMatch === null) {
      return {
        status: "skipped_no_snapshot",
        reason: "no_snapshot_matched_listing",
        premiumMode,
        count: 0,
        topScores: [],
        notes: [
          "checked: result_payload (no individual comparables)",
          "checked: market_snapshots by source_url and metadata.listing_id — no match",
          `premium_mode_would_be: ${premiumMode}`,
        ],
      };
    }
    if (snapshotMatch !== null) {
      return {
        status: "skipped_snapshot_empty",
        reason: "snapshot_found_but_no_comparables_loaded",
        premiumMode,
        count: 0,
        topScores: [],
        notes: [
          `snapshot_id: ${snapshotMatch.snapshotId}`,
          `matched_by: ${snapshotMatch.matchedBy}`,
          `comparable_count_in_snapshot: ${snapshotMatch.comparableCount}`,
        ],
      };
    }
    return {
      status: "skipped",
      reason: "no_individual_comparables_in_result_payload",
      checkedFields,
      premiumMode,
      count: 0,
      topScores: [],
      notes: [
        "individual_comparables_not_persisted_in_result_payload",
        `premium_mode_would_be: ${premiumMode}`,
      ],
    };
  }

  const ranked = rankRefinedComparables(comparables, target, refinement);
  const topScores = ranked.slice(0, 5).map((r) => ({
    url: r.comparable.url ?? null,
    score: r.score,
    breakdown: r.breakdown,
  }));
  const notes = ranked.slice(0, 3).flatMap((r) => r.breakdown.notes);

  const status = source === "market_memory" ? "scored_from_market_memory" : "scored";

  return {
    status,
    premiumMode,
    count: ranked.length,
    ...(snapshotMatch ? { snapshotId: snapshotMatch.snapshotId, matchedBy: snapshotMatch.matchedBy } : {}),
    topScores,
    notes,
  };
}

// ─── Premium discovery runner ─────────────────────────────────────────────────

async function runPremiumBookingDiscovery(
  enrichedTarget: ExtractedListing
): Promise<PremiumDiscoveryResult> {
  type EarlyStopResult = Awaited<ReturnType<typeof searchBookingPremiumUrlsEarlyStop>>;

  const startedAt = Date.now();
  const controller = new AbortController();

  let abortTimerId: ReturnType<typeof setTimeout> | null = null;
  let hardWallTimerId: ReturnType<typeof setTimeout> | null = null;

  abortTimerId = setTimeout(() => controller.abort(), PREMIUM_DISCOVERY_TIMEOUT_MS);

  // Hard wall 3 s after cooperative abort — safety net for stuck Playwright awaits.
  const hardWall = new Promise<EarlyStopResult>((resolve) => {
    hardWallTimerId = setTimeout(
      () => resolve({ urls: [], stoppedEarly: false, queriesRun: 0 }),
      PREMIUM_DISCOVERY_TIMEOUT_MS + 3000
    );
  });

  try {
    const { urls, stoppedEarly, queriesRun } = await Promise.race([
      searchBookingPremiumUrlsEarlyStop(enrichedTarget, {
        cap: PREMIUM_DISCOVERY_CAP,
        earlyStopMin: PREMIUM_DISCOVERY_EARLY_STOP_MIN,
        abortSignal: controller.signal,
      }),
      hardWall,
    ]);

    const elapsedMs = Date.now() - startedAt;
    const aborted = controller.signal.aborted;

    console.log(
      "[refine-market][premium-discovery-early-stop]",
      JSON.stringify({
        queryIndex: null,
        phase: "route_result",
        collectedRawCount: null,
        validListingCandidatesCount: urls.length,
        returnedCount: urls.length,
        elapsedMs,
        stoppedEarly,
        queriesRun,
        aborted,
      })
    );

    if (urls.length === 0) {
      if (aborted) {
        console.log(
          "[refine-market][premium-discovery-route-timeout]",
          JSON.stringify({ timeoutMs: PREMIUM_DISCOVERY_TIMEOUT_MS, elapsedMs, queriesRun })
        );
      }
      return {
        status: aborted ? "timeout" : "no_candidates",
        candidateCount: 0,
        candidateUrls: [],
        prioritizedCandidateUrls: [],
        source: "booking",
        elapsedMs,
        fallbackUsed: true,
      };
    }

    return {
      status: "success",
      candidateCount: urls.length,
      candidateUrls: urls,
      prioritizedCandidateUrls: [],
      source: stoppedEarly ? "booking_premium_early_stop" : "booking",
      elapsedMs,
      fallbackUsed: false,
    };
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    console.error("[refine-market][premium-discovery-error]", {
      error: err instanceof Error ? err.message : String(err),
      elapsedMs,
    });
    return {
      status: "error",
      candidateCount: 0,
      candidateUrls: [],
      prioritizedCandidateUrls: [],
      source: "booking",
      elapsedMs,
      fallbackUsed: true,
    };
  } finally {
    if (abortTimerId !== null) clearTimeout(abortTimerId);
    if (hardWallTimerId !== null) clearTimeout(hardWallTimerId);
  }
}

// ─── Premium light extraction ─────────────────────────────────────────────────

/**
 * Defensively unwraps the raw result of extractListing.
 * Tries direct access first, then common wrapper keys (listing / data / result / extracted).
 * Forces url = fallbackUrl when absent. Returns null if no usable object is found.
 */
function normalizeExtractedListingResult(
  raw: unknown,
  fallbackUrl: string
): ExtractedListing | null {
  const candidates: unknown[] = [raw];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    candidates.push(o["listing"], o["data"], o["result"], o["extracted"]);
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const obj = candidate as Record<string, unknown>;
    const hasTitle = typeof obj["title"] === "string" && (obj["title"] as string).trim().length > 0;
    const hasPrice =
      (typeof obj["price"] === "number" && Number.isFinite(obj["price"] as number)) ||
      (typeof obj["rawStayPrice"] === "number" && Number.isFinite(obj["rawStayPrice"] as number));
    const hasUrl = typeof obj["url"] === "string" && (obj["url"] as string).length > 0;
    const hasPropType = typeof obj["propertyType"] === "string";

    if (hasTitle || hasPrice || hasUrl || hasPropType) {
      // Patch url if missing; cast to ExtractedListing — structure is compatible at runtime.
      if (!hasUrl) obj["url"] = fallbackUrl;
      return obj as unknown as ExtractedListing;
    }
  }
  return null;
}

async function runPremiumExtraction(
  candidateUrls: string[],
  target: ExtractedListing,
  refinement: RefinementInput
): Promise<PremiumExtractionResult> {
  // Sequential experimental mode: try candidate URLs one by one and stop as soon
  // as we have enough valid extractions to inspect in refine-market.
  const urls = [...candidateUrls];
  if (urls.length === 0) {
    return {
      status: "no_candidates", extractedCount: 0, failedCount: 0,
      attemptedCount: 0, cap: PREMIUM_EXTRACTION_CAP,
      timeoutMs: PREMIUM_EXTRACTION_TIMEOUT_MS, mode: "sequential", comparables: [],
    };
  }

  const withTimeout = (url: string): Promise<unknown> =>
    Promise.race([
      extractListing(url, { skipBookingPriceRecovery: true }) as Promise<unknown>,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`extraction_timeout_${PREMIUM_EXTRACTION_TIMEOUT_MS}ms`)),
          PREMIUM_EXTRACTION_TIMEOUT_MS
        )
      ),
    ]);

  const extracted: PremiumNormalizedListing[] = [];
  let attemptedCount = 0;

  for (const url of urls) {
    // Stop as soon as we have enough valid extractions.
    if (extracted.length >= PREMIUM_EXTRACTION_CAP) break;

    attemptedCount++;
    let raw: unknown;
    let settled: { status: "fulfilled"; value: unknown } | { status: "rejected"; reason: unknown };

    try {
      raw = await withTimeout(url);
      settled = { status: "fulfilled", value: raw };
    } catch (err) {
      settled = { status: "rejected", reason: err };
    }

    if (settled.status === "fulfilled") {
      const raw = settled.value;
      const normalized = normalizeExtractedListingResult(raw, url);

      const normalizedTitle = normalized?.title ?? null;
      const normalizedPrice =
        typeof normalized?.price === "number" && Number.isFinite(normalized.price)
          ? normalized.price
          : null;
      const normalizedRawStayPrice =
        typeof (normalized as Record<string, unknown> | null)?.["rawStayPrice"] === "number"
          ? ((normalized as Record<string, unknown>)["rawStayPrice"] as number)
          : null;
      const propertyType = normalized?.propertyType ?? null;
      const bedrooms =
        typeof normalized?.bedrooms === "number" ? normalized.bedrooms : null;
      const capacity =
        typeof normalized?.capacity === "number" ? normalized.capacity : null;

      const hasTitle = typeof normalizedTitle === "string" && normalizedTitle.trim().length > 0;
      const hasPrice = normalizedPrice !== null || normalizedRawStayPrice !== null;
      const ok = normalized !== null && (hasTitle || hasPrice);
      const reason = ok
        ? null
        : normalized === null
          ? "normalize_returned_null"
          : "missing_title_and_price";

      const inferred =
        ok && normalized !== null
          ? buildPremiumStructureInference(normalized, target, refinement)
          : null;

      console.log(
        "[refine-market][premium-extraction-result]",
        JSON.stringify({
          url: url.slice(0, 120),
          ok,
          rawType: typeof raw,
          keys:
            raw && typeof raw === "object"
              ? Object.keys(raw as object).slice(0, 12)
              : [],
          normalizedTitle: normalizedTitle?.slice(0, 60) ?? null,
          normalizedPrice,
          normalizedRawStayPrice,
          propertyType,
          bedrooms,
          capacity,
          inferredBedrooms: inferred?.inferredBedrooms ?? null,
          inferredCapacityRange: inferred?.inferredCapacityRange ?? null,
          inferredComparableStrength: inferred?.inferredComparableStrength ?? null,
          inferenceReasons: inferred?.inferenceReasons ?? [],
          reason,
        })
      );

      if (ok && normalized !== null) {
        const enrichedComparable: PremiumNormalizedListing = Object.assign(normalized, {
          __premiumStructureInference: inferred ?? undefined,
        });
        extracted.push(enrichedComparable);
      }
    } else {
      const reason =
        settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
      console.log(
        "[refine-market][premium-extraction-result]",
        JSON.stringify({
          url: url.slice(0, 120),
          ok: false,
          rawType: null,
          keys: [],
          normalizedTitle: null,
          normalizedPrice: null,
          normalizedRawStayPrice: null,
          propertyType: null,
          bedrooms: null,
          capacity: null,
          inferredBedrooms: null,
          inferredCapacityRange: null,
          inferredComparableStrength: null,
          inferenceReasons: [],
          reason,
        })
      );
    }
  }

  const failedCount = attemptedCount - extracted.length;
  const meta = {
    attemptedCount,
    cap: PREMIUM_EXTRACTION_CAP,
    timeoutMs: PREMIUM_EXTRACTION_TIMEOUT_MS,
    mode: "sequential" as const,
  };

  if (extracted.length === 0) {
    return { status: "all_failed", extractedCount: 0, failedCount, ...meta, comparables: [] };
  }

  const ranked = rankRefinedComparables(extracted, target, refinement);

  const comparables: PremiumExtractionComparable[] = ranked.map((r) => {
    const adjusted = computePremiumAdjustedNightlyPrice(r.comparable, target);
    const inferred =
      (r.comparable as PremiumNormalizedListing).__premiumStructureInference ??
      buildPremiumStructureInference(r.comparable, target, refinement);
    return {
      url: r.comparable.url ?? "",
      title: r.comparable.title ?? null,
      propertyType: r.comparable.propertyType ?? null,
      price: typeof r.comparable.price === "number" ? r.comparable.price : null,
      adjustedNightlyPrice: adjusted.adjustedNightlyPrice,
      adjustedReason: adjusted.adjustedReason,
      bedrooms: typeof r.comparable.bedrooms === "number" ? r.comparable.bedrooms : null,
      capacity: typeof r.comparable.capacity === "number" ? r.comparable.capacity : null,
      inferredLuxuryProperty: inferred.inferredLuxuryProperty,
      inferredBedrooms: inferred.inferredBedrooms,
      inferredCapacityRange: inferred.inferredCapacityRange,
      inferredComparableStrength: inferred.inferredComparableStrength,
      inferenceReasons: inferred.inferenceReasons,
      score: r.score,
      breakdown: r.breakdown,
    };
  });

  console.log(
    "[refine-market][premium-extraction-done]",
    JSON.stringify({
      extractedCount: extracted.length,
      failedCount,
      attemptedCount,
      topScore: comparables[0]?.score ?? null,
      topPrice: comparables[0]?.price ?? null,
      topAdjustedNightlyPrice: comparables[0]?.adjustedNightlyPrice ?? null,
      topAdjustedReason: comparables[0]?.adjustedReason ?? null,
      topInferredLuxuryProperty: comparables[0]?.inferredLuxuryProperty ?? null,
      topInferredBedrooms: comparables[0]?.inferredBedrooms ?? null,
      topInferredCapacityRange: comparables[0]?.inferredCapacityRange ?? null,
      topInferredComparableStrength: comparables[0]?.inferredComparableStrength ?? null,
      topInferenceReasons: comparables[0]?.inferenceReasons?.slice(0, 5) ?? [],
    })
  );

  return { status: "ok", extractedCount: extracted.length, failedCount, ...meta, comparables };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await context.params;

  if (!auditId || typeof auditId !== "string") {
    return NextResponse.json({ error: "Missing audit id" }, { status: 400 });
  }

  const { client, user, workspace } = await getRequestUserAndWorkspace(request);
  if (!user || !client || !workspace) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let refinementInput: RefineMarketInput = {};
  try {
    const body = await request.json();
    if (body && typeof body === "object") {
      refinementInput = body as RefineMarketInput;
    }
  } catch {
    // empty body is fine for diagnostic
  }

  // Load audit (ownership check via workspace_id)
  const { data: auditRow, error: auditError } = await client
    .from("audits")
    .select("id, listing_id, result_payload")
    .eq("id", auditId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (auditError) {
    console.error("[refine-market][audit-load-error]", { auditId, error: auditError.message });
    return NextResponse.json({ error: "Impossible de charger l’audit." }, { status: 500 });
  }
  if (!auditRow) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const listingId: string | null = auditRow.listing_id ?? null;
  if (!listingId) {
    return NextResponse.json({ error: "Audit has no listing_id" }, { status: 422 });
  }

  const rawPayload = auditRow.result_payload as Partial<StructuredAuditResultPayload> | null;
  const currentMarket = rawPayload?.market ?? null;

  // Load listing (extracted target + source_url for snapshot lookup)
  const { data: listingRow, error: listingError } = await client
    .from("listings")
    .select("id, source_url, source_platform, title, raw_payload")
    .eq("id", listingId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (listingError) {
    console.error("[refine-market][listing-load-error]", { listingId, error: listingError.message });
    return NextResponse.json({ error: "Impossible de charger l’annonce." }, { status: 500 });
  }

  const extractedTarget = (listingRow?.raw_payload ?? null) as ExtractedListing | null;
  const mergedTargetPreview = buildMergedTargetPreview(extractedTarget, refinementInput);
  const refinement = toRefinementInput(refinementInput);
  const refinementSignature = buildPremiumRefinementSignature({
    auditId,
    listingId,
    refinement,
    target: extractedTarget,
  });
  let premiumRefineCache: PremiumRefineCacheInfo = {
    hit: false,
    written: false,
    refinementSignature,
  };

  // Premium discovery signals — pure computation, no network, no Playwright
  const premiumDiscoverySignals = extractedTarget
    ? buildPremiumDiscoverySignals(extractedTarget, refinement)
    : null;

  // Diagnostic URL / query previews — not sent to any real request
  const airbnbUrlPreview = (() => {
    if (!premiumDiscoverySignals) return null;
    const loc = (extractedTarget?.locationLabel ?? extractedTarget?.title ?? "location").trim();
    return applyPremiumSignalsToAirbnbUrl(
      `https://www.airbnb.com/s/${encodeURIComponent(loc)}/homes`,
      premiumDiscoverySignals
    );
  })();

  const bookingQueriesPreview = (() => {
    if (!premiumDiscoverySignals) return [];
    const samples = [extractedTarget?.locationLabel, extractedTarget?.title]
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, 2);
    return applyPremiumSignalsToBookingQueries(samples, premiumDiscoverySignals);
  })();

  // Pass 1 — check result_payload (fast, in-memory)
  const { comparables: payloadComparables, checkedFields } = extractComparablesFromPayload(rawPayload);

  // Pass 2 — if result_payload has no individuals, query market_comparables DB
  let dbComparables: ExtractedListing[] | null = null;
  let snapshotMatch: SnapshotMatchInfo | null = null;

  if (!payloadComparables || payloadComparables.length === 0) {
    const sourceUrl = (listingRow?.source_url as string | null | undefined) ?? null;
    snapshotMatch = await findBestSnapshotForListing(sourceUrl, listingId);

    if (snapshotMatch) {
      const rows = await loadSnapshotComparables(snapshotMatch.snapshotId);
      if (rows.length > 0) {
        dbComparables = rows.map(rowToExtractedListing);
      }
    }
  }

  const comparablesToScore = payloadComparables ?? dbComparables;
  const scoringSource: "result_payload" | "market_memory" | null =
    payloadComparables ? "result_payload" : dbComparables ? "market_memory" : null;

  const comparableScoring = runComparableScoring(
    comparablesToScore,
    checkedFields,
    extractedTarget,
    refinement,
    snapshotMatch,
    scoringSource
  );

  const ranked: RefinedComparableResult[] =
    comparablesToScore && comparablesToScore.length > 0 && extractedTarget
      ? rankRefinedComparables(comparablesToScore, extractedTarget, refinement)
      : [];

  const refinedMarketPreview = computeRefinedMarketPreview(ranked, extractedTarget);

  // ── Premium discovery (mode: "active" only, never in diagnostic) ────────────
  let premiumDiscoveryResult: PremiumDiscoveryResult | null = null;
  let premiumExtractedComparables: PremiumExtractionResult | null = null;

  if (refinementInput.mode === "active") {
    const cachedPremiumRefine = readPremiumRefineCacheFromPayload(rawPayload, refinementSignature);
    if (cachedPremiumRefine) {
      premiumDiscoveryResult = cachedPremiumRefine.premiumDiscoveryResult;
      premiumExtractedComparables = cachedPremiumRefine.premiumExtractedComparables;
      premiumRefineCache = {
        hit: true,
        written: false,
        source: "audits.result_payload.premiumRefineCache",
        ageMinutes: cachedPremiumRefine.ageMinutes,
        refinementSignature,
      };
      console.log(
        "[refine-market][premium-refine-cache-hit]",
        JSON.stringify({
          source: premiumRefineCache.source,
          ageMinutes: premiumRefineCache.ageMinutes,
          refinementSignature,
          cachedDiscoveryStatus: premiumDiscoveryResult?.status ?? null,
          cachedExtractionStatus: premiumExtractedComparables?.status ?? null,
        })
      );
    } else if (premiumDiscoverySignals?.premiumMode === true && extractedTarget) {
      const premiumEnrichedTarget: ExtractedListing = {
        ...extractedTarget,
        ...(refinement.propType ? { propertyType: refinement.propType } : {}),
        ...(premiumDiscoverySignals.minBedrooms !== null
          ? { bedrooms: premiumDiscoverySignals.minBedrooms }
          : {}),
        ...(premiumDiscoverySignals.minGuests !== null
          ? { capacity: premiumDiscoverySignals.minGuests }
          : {}),
      };
      premiumDiscoveryResult = await runPremiumBookingDiscovery(premiumEnrichedTarget);
    } else {
      // mode active but premiumMode is false — skip silently
      premiumDiscoveryResult = {
        status: "skipped",
        candidateCount: 0,
        candidateUrls: [],
        prioritizedCandidateUrls: [],
        source: "booking",
        elapsedMs: 0,
        fallbackUsed: true,
      };
    }

    // ── Premium light extraction: runs only when discovery succeeded ──────────
    if (
      premiumRefineCache.hit !== true &&
      premiumDiscoveryResult?.status === "success" &&
      premiumDiscoveryResult.candidateUrls.length > 0 &&
      extractedTarget
    ) {
      const prioritizedCandidateUrls = prioritizePremiumCandidateUrls(
        premiumDiscoveryResult.candidateUrls,
        extractedTarget,
        refinement
      );
      premiumDiscoveryResult = {
        ...premiumDiscoveryResult,
        prioritizedCandidateUrls: prioritizedCandidateUrls.slice(0, 8),
      };
      console.log(
        "[refine-market][premium-extraction-priority]",
        JSON.stringify({
          candidateCount: premiumDiscoveryResult.candidateUrls.length,
          prioritizedTop: premiumDiscoveryResult.prioritizedCandidateUrls,
        })
      );
      premiumExtractedComparables = await runPremiumExtraction(
        prioritizedCandidateUrls.map((item) => item.url),
        extractedTarget,
        refinement
      );
    }
  }

  const refinedPremiumMarketPreview =
    computeRefinedPremiumMarketPreview(premiumExtractedComparables);

  const shouldWritePremiumRefineCache =
    refinementInput.mode === "active" &&
    premiumRefineCache.hit !== true &&
    premiumDiscoveryResult?.status === "success" &&
    premiumExtractedComparables?.status === "ok" &&
    refinedPremiumMarketPreview.status === "ok";

  if (shouldWritePremiumRefineCache) {
    const existingPayload =
      rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
        ? (rawPayload as Record<string, unknown>)
        : {};

    const nextPayload: Record<string, unknown> = {
      ...existingPayload,
      premiumRefineCache: {
        createdAt: new Date().toISOString(),
        refinementSignature,
        premiumDiscoveryResult,
        premiumExtractedComparables,
        refinedPremiumMarketPreview,
      },
    };

    const { error: cacheWriteError } = await client
      .from("audits")
      .update({ result_payload: nextPayload })
      .eq("id", auditId)
      .eq("workspace_id", workspace.id);

    if (cacheWriteError) {
      console.warn(
        "[refine-market][premium-refine-cache-write-warning]",
        JSON.stringify({
          auditId,
          listingId,
          refinementSignature,
          error: cacheWriteError.message,
        })
      );
      premiumRefineCache = {
        ...premiumRefineCache,
        hit: false,
        written: false,
        refinementSignature,
      };
    } else {
      premiumRefineCache = {
        ...premiumRefineCache,
        hit: false,
        written: true,
        refinementSignature,
      };
    }
  }

  console.log(
    "[refine-market][diagnostic]",
    JSON.stringify({
      auditId,
      listingId,
      platform: extractedTarget?.platform ?? null,
      targetPrice: typeof extractedTarget?.price === "number" ? extractedTarget.price : null,
      currentMarketConfidence: currentMarket?.marketConfidence ?? null,
      currentComparableCount: currentMarket?.comparableCount ?? null,
      refinementInput,
      mergedTargetPreview,
      comparableScoringStatus: comparableScoring.status,
      comparableScoringPremiumMode: comparableScoring.premiumMode,
      comparableScoringCount: comparableScoring.count,
      snapshotMatchedBy: snapshotMatch?.matchedBy ?? null,
      premiumDiscoveryPremiumMode: premiumDiscoverySignals?.premiumMode ?? false,
      premiumDiscoveryQueryKeywords: premiumDiscoverySignals?.queryKeywords ?? [],
      premiumDiscoverySoftMinPrice: premiumDiscoverySignals?.softMinPrice ?? null,
      premiumDiscoveryStatus: premiumDiscoveryResult?.status ?? null,
      premiumDiscoverySource: premiumDiscoveryResult?.source ?? null,
      premiumDiscoveryCandidateCount: premiumDiscoveryResult?.candidateCount ?? null,
      premiumDiscoveryFallbackUsed: premiumDiscoveryResult?.fallbackUsed ?? null,
      premiumRefineCacheHit: premiumRefineCache.hit,
      premiumRefineCacheWritten: premiumRefineCache.written,
      premiumRefineCacheSource: premiumRefineCache.source ?? null,
      premiumRefineCacheAgeMinutes: premiumRefineCache.ageMinutes ?? null,
      premiumRefineCacheRefinementSignature: premiumRefineCache.refinementSignature,
      premiumDiscoveryTopPrioritized:
        premiumDiscoveryResult?.prioritizedCandidateUrls?.slice(0, 3) ?? [],
      premiumExtractionStatus: premiumExtractedComparables?.status ?? null,
      premiumExtractionExtractedCount: premiumExtractedComparables?.extractedCount ?? null,
      premiumExtractionFailedCount: premiumExtractedComparables?.failedCount ?? null,
      premiumExtractionTopScore: premiumExtractedComparables?.comparables[0]?.score ?? null,
      premiumExtractionTopPrice: premiumExtractedComparables?.comparables[0]?.price ?? null,
      premiumExtractionTopAdjustedNightlyPrice:
        premiumExtractedComparables?.comparables[0]?.adjustedNightlyPrice ?? null,
      premiumExtractionTopAdjustedReason:
        premiumExtractedComparables?.comparables[0]?.adjustedReason ?? null,
      premiumExtractionTopInferredLuxuryProperty:
        premiumExtractedComparables?.comparables[0]?.inferredLuxuryProperty ?? null,
      premiumExtractionTopInferredBedrooms:
        premiumExtractedComparables?.comparables[0]?.inferredBedrooms ?? null,
      premiumExtractionTopInferredCapacityRange:
        premiumExtractedComparables?.comparables[0]?.inferredCapacityRange ?? null,
      premiumExtractionTopInferredComparableStrength:
        premiumExtractedComparables?.comparables[0]?.inferredComparableStrength ?? null,
      premiumExtractionTopInferenceReasons:
        premiumExtractedComparables?.comparables[0]?.inferenceReasons?.slice(0, 5) ?? [],
      refinedPremiumMarketPreviewStatus: refinedPremiumMarketPreview.status,
      refinedPremiumMarketPreviewSelectedComparableCount:
        refinedPremiumMarketPreview.selectedComparableCount,
      refinedPremiumMarketPreviewAdjustedMedianNightlyPrice:
        refinedPremiumMarketPreview.adjustedMedianNightlyPrice,
      refinedPremiumMarketPreviewAdjustedAvgNightlyPrice:
        refinedPremiumMarketPreview.adjustedAvgNightlyPrice,
      refinedPremiumMarketPreviewConfidence: refinedPremiumMarketPreview.confidencePreview,
      refinedPremiumMarketPreviewProxyComparableCount:
        refinedPremiumMarketPreview.proxyComparableCount,
      refinedPremiumMarketPreviewDirectComparableCount:
        refinedPremiumMarketPreview.directComparableCount,
      refinedPremiumMarketPreviewReason: refinedPremiumMarketPreview.reason,
      refinedPremiumMarketPreviewAdmissionEvaluatedCount:
        refinedPremiumMarketPreview.admissionDebugSummary.evaluatedCount,
      refinedPremiumMarketPreviewAdmissionAdmittedCount:
        refinedPremiumMarketPreview.admissionDebugSummary.admittedCount,
      refinedPremiumMarketPreviewAdmissionRejectedCount:
        refinedPremiumMarketPreview.admissionDebugSummary.rejectedCount,
      refinedPremiumMarketPreviewAdmissionRejectionCountsByReason:
        refinedPremiumMarketPreview.admissionDebugSummary.rejectionCountsByReason,
    })
  );

  return NextResponse.json({
    auditId,
    listingId,
    target: extractedTarget,
    market: currentMarket,
    refinementInput,
    mergedTargetPreview,
    comparableScoring,
    refinedMarketPreview,
    refinedPremiumMarketPreview,
    premiumDiscoverySignals,
    airbnbUrlPreview,
    bookingQueriesPreview,
    premiumRefineCache,
    ...(premiumDiscoveryResult !== null ? { premiumDiscoveryResult } : {}),
    ...(premiumExtractedComparables !== null ? { premiumExtractedComparables } : {}),
    message: "diagnostic_only" as const,
  });
}
