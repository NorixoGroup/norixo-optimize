import type {
  FreeListingAuditAvailable,
  FreeListingAuditExtractionStatus,
  FreeListingAuditLockedSection,
  FreeListingAuditMarketStatus,
  FreeListingAuditPlatform,
  FreeListingAuditPublicResult,
} from "./publicListingAuditContract";

const LOCKED_SECTIONS = [
  "photos",
  "description",
  "market_positioning",
  "occupancy",
  "conversion",
  "action_plan",
] as const satisfies readonly FreeListingAuditLockedSection[];

type PublicListingAuditSource = Readonly<{
  listing_url?: unknown;
  title?: unknown;
  platform?: unknown;
  propertyType?: unknown;
  score?: unknown;
  summary?: unknown;
  insights?: unknown;
  recommendations?: unknown;
  rating?: unknown;
  reviewCount?: unknown;
  trustBadge?: unknown;
  trustSignals?: unknown;
  marketPositioning?: unknown;
  occupancyObservation?: unknown;
  extractionFailed?: unknown;
  reason?: unknown;
}>;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNonNegativeInteger(value: unknown): number {
  const parsed = asFiniteNumber(value);
  return parsed == null ? 0 : Math.max(0, Math.floor(parsed));
}

function asStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  for (const item of value) {
    const normalized = asNonEmptyString(item);
    if (!normalized || output.includes(normalized)) continue;
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizePlatform(value: unknown): FreeListingAuditPlatform {
  switch (value) {
    case "airbnb":
    case "booking":
    case "expedia":
    case "agoda":
    case "vrbo":
    case "other":
      return value;
    default:
      return "other";
  }
}

function normalizeExtractionStatus(value: unknown): FreeListingAuditExtractionStatus {
  switch (value) {
    case "complete":
    case "partial":
    case "blocked":
      return value;
    default:
      return "partial";
  }
}

function normalizeMarketStatus(value: unknown): FreeListingAuditMarketStatus {
  switch (value) {
    case "ok":
    case "partial":
    case "insufficient_data":
    case "blocked":
      return value;
    default:
      return "insufficient_data";
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildUnavailableReason(source: PublicListingAuditSource): string | null {
  if (source.extractionFailed !== true) return null;
  return asNonEmptyString(source.reason) ?? "listing_extraction_unavailable";
}

export function buildPublicListingAudit(
  source: PublicListingAuditSource
): FreeListingAuditPublicResult {
  const unavailableReason = buildUnavailableReason(source);
  if (unavailableReason) {
    return {
      status: "unavailable",
      reason: unavailableReason,
    };
  }

  const listingUrl = asNonEmptyString(source.listing_url);
  if (!listingUrl) {
    return {
      status: "unavailable",
      reason: "listing_url_unavailable",
    };
  }

  const trustSignals = readRecord(source.trustSignals);
  const marketPositioning = readRecord(source.marketPositioning);
  const occupancyObservation = readRecord(source.occupancyObservation);

  const rating = asFiniteNumber(source.rating) ?? asFiniteNumber(trustSignals.rating);
  const reviewCount =
    asFiniteNumber(source.reviewCount) ?? asFiniteNumber(trustSignals.reviewCount);
  const badge =
    asNonEmptyString(source.trustBadge) ?? asNonEmptyString(trustSignals.trustBadge);

  const marketSummary =
    asNonEmptyString(marketPositioning.summary) ??
    asNonEmptyString((source as Record<string, unknown>).marketComparison);

  const result: FreeListingAuditAvailable = {
    status: "available",
    listing: {
      url: listingUrl,
      title: asNonEmptyString(source.title) ?? "Annonce analysée",
      platform: normalizePlatform(source.platform),
      propertyType: asNonEmptyString(source.propertyType),
    },
    score: asFiniteNumber(source.score) ?? 0,
    summary: asNonEmptyString(source.summary),
    insights: asStringList(source.insights, 3),
    recommendations: asStringList(source.recommendations, 2),
    trust: {
      rating,
      reviewCount: reviewCount == null ? null : Math.max(0, Math.floor(reviewCount)),
      badge,
      extractionStatus: normalizeExtractionStatus(trustSignals.extractionStatus),
    },
    market: {
      status: normalizeMarketStatus(marketPositioning.status),
      comparableCount: asNonNegativeInteger(marketPositioning.comparableCount),
      summary: marketSummary,
    },
    availability: {
      detected: occupancyObservation.status === "available",
    },
    lockedSections: LOCKED_SECTIONS,
  };

  return result;
}
