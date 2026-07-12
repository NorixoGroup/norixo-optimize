import {
  INTELLIGENCE_V2_POLICY_VERSIONS,
  INTELLIGENCE_V2_TRANSFORMATION_POLICY_VERSION,
} from "./policyVersions";
import {
  buildMarketCellV1,
  type IntelligenceV2Platform,
  type MarketCellV1,
} from "./marketCell";
import { validateSharedIntelligencePrivacy } from "./privacyValidator";

export type IntelligenceV2PricingSourceClass =
  | "authenticated_audit"
  | "authenticated_listing"
  | "guest_audit"
  | "historical_backfill";

export type IntelligenceV2PricingEligibilityStatus =
  | "eligible"
  | "rejected"
  | "private_only";

export type IntelligenceV2PricingDuplicateStatus =
  | "unchecked"
  | "unique"
  | "duplicate"
  | "update"
  | "refresh";

export type IntelligenceV2ConfidenceInputBand =
  | "unknown"
  | "low"
  | "moderate"
  | "high";

export type IntelligenceV2FreshnessInputBand =
  | "unknown"
  | "fresh"
  | "recent"
  | "aging"
  | "stale";

export type IntelligenceV2SourceQualityBand =
  | "unknown"
  | "low"
  | "moderate"
  | "high";

export type IntelligenceV2PricingPriceBand = "unclassified";

export type AnonymousPricingFactCandidate = Readonly<{
  sourceClass: IntelligenceV2PricingSourceClass;
  capturedAt: string;
  platform?: string | null;
  country?: string | null;
  city?: string | null;
  propertyType?: string | null;
  capacity?: number | null;
  guestCapacity?: number | null;
  currency?: string | null;
  nightlyPrice?: number | null;
  extractionQuality?: string | null;
  comparableQuality?: string | null;
  freshness?: string | null;
}>;

export type AnonymousPricingFact = Readonly<
  typeof INTELLIGENCE_V2_POLICY_VERSIONS & {
    marketCell: MarketCellV1;
    metricFamily: "pricing";
    normalizedNightlyPrice: number;
    priceBand: IntelligenceV2PricingPriceBand;
    capturePeriodBucket: string;
    sourceClass: IntelligenceV2PricingSourceClass;
    eligibilityStatus: IntelligenceV2PricingEligibilityStatus;
    duplicateStatus: IntelligenceV2PricingDuplicateStatus;
    confidenceInputBand: IntelligenceV2ConfidenceInputBand;
    freshnessInputBand: IntelligenceV2FreshnessInputBand;
    sourceQualityBand: IntelligenceV2SourceQualityBand;
  }
>;

export type AnonymousPricingFactRejectionReason =
  | "guest_source_not_allowed"
  | "historical_backfill_disabled"
  | "missing_country"
  | "missing_city"
  | "unsupported_platform"
  | "missing_currency"
  | "invalid_currency"
  | "invalid_nightly_price"
  | "invalid_capture_date"
  | "privacy_validation_failed";

export type AnonymousPricingFactTransformResult =
  | Readonly<{
      accepted: true;
      fact: AnonymousPricingFact;
    }>
  | Readonly<{
      accepted: false;
      reason: AnonymousPricingFactRejectionReason;
    }>;

export type AnonymousPricingFactIdentityProjection = Readonly<{
  marketCellKey: string;
  metricFamily: "pricing";
  normalizedNightlyPrice: number;
  capturePeriodBucket: string;
  sourceClass: IntelligenceV2PricingSourceClass;
  transformationPolicyVersion: string;
}>;

function normalizePositiveNightlyPrice(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function toCapturePeriodBucket(capturedAt: string): string | null {
  const parsed = new Date(capturedAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizeQualityBand(value: string | null | undefined): IntelligenceV2SourceQualityBand {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "low") return "low";
  if (normalized === "medium" || normalized === "moderate") return "moderate";
  if (normalized === "high") return "high";
  return "unknown";
}

function normalizeFreshnessBand(
  value: string | null | undefined,
): IntelligenceV2FreshnessInputBand {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    normalized === "fresh" ||
    normalized === "recent" ||
    normalized === "aging" ||
    normalized === "stale"
  ) {
    return normalized;
  }
  return "unknown";
}

function selectSourceQualityBand(
  extractionQuality: string | null | undefined,
  comparableQuality: string | null | undefined,
): IntelligenceV2SourceQualityBand {
  const extractionBand = normalizeQualityBand(extractionQuality);
  const comparableBand = normalizeQualityBand(comparableQuality);

  const rank: Record<IntelligenceV2SourceQualityBand, number> = {
    unknown: 0,
    low: 1,
    moderate: 2,
    high: 3,
  };

  if (extractionBand === "unknown") return comparableBand;
  if (comparableBand === "unknown") return extractionBand;
  return rank[extractionBand] <= rank[comparableBand]
    ? extractionBand
    : comparableBand;
}

function toConfidenceInputBand(
  sourceQualityBand: IntelligenceV2SourceQualityBand,
): IntelligenceV2ConfidenceInputBand {
  if (sourceQualityBand === "low") return "low";
  if (sourceQualityBand === "moderate") return "moderate";
  if (sourceQualityBand === "high") return "high";
  return "unknown";
}

function isMissingValue(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

export function buildAnonymousPricingFactIdentityProjection(
  fact: AnonymousPricingFact,
): AnonymousPricingFactIdentityProjection {
  return {
    marketCellKey: fact.marketCell.marketCellKey,
    metricFamily: fact.metricFamily,
    normalizedNightlyPrice: fact.normalizedNightlyPrice,
    capturePeriodBucket: fact.capturePeriodBucket,
    sourceClass: fact.sourceClass,
    transformationPolicyVersion: fact.transformationPolicyVersion,
  };
}

export function transformCandidateToAnonymousPricingFact(
  candidate: AnonymousPricingFactCandidate,
): AnonymousPricingFactTransformResult {
  if (candidate.sourceClass === "guest_audit") {
    return { accepted: false, reason: "guest_source_not_allowed" };
  }
  if (candidate.sourceClass === "historical_backfill") {
    return { accepted: false, reason: "historical_backfill_disabled" };
  }

  const capturePeriodBucket = toCapturePeriodBucket(candidate.capturedAt);
  if (capturePeriodBucket == null) {
    return { accepted: false, reason: "invalid_capture_date" };
  }

  if (isMissingValue(candidate.country)) {
    return { accepted: false, reason: "missing_country" };
  }
  if (isMissingValue(candidate.city)) {
    return { accepted: false, reason: "missing_city" };
  }

  const marketCell = buildMarketCellV1(candidate);
  if (marketCell.country === "unknown") {
    return { accepted: false, reason: "missing_country" };
  }
  if (marketCell.city === "unknown") {
    return { accepted: false, reason: "missing_city" };
  }
  if (marketCell.platform === "unknown") {
    return { accepted: false, reason: "unsupported_platform" };
  }

  if (isMissingValue(candidate.currency)) {
    return { accepted: false, reason: "missing_currency" };
  }
  if (marketCell.currency === "UNKNOWN") {
    return { accepted: false, reason: "invalid_currency" };
  }

  const normalizedNightlyPrice = normalizePositiveNightlyPrice(
    candidate.nightlyPrice,
  );
  if (normalizedNightlyPrice == null) {
    return { accepted: false, reason: "invalid_nightly_price" };
  }

  const sourceQualityBand = selectSourceQualityBand(
    candidate.extractionQuality,
    candidate.comparableQuality,
  );
  const freshnessInputBand = normalizeFreshnessBand(candidate.freshness);
  const confidenceInputBand = toConfidenceInputBand(sourceQualityBand);

  const fact: AnonymousPricingFact = {
    ...INTELLIGENCE_V2_POLICY_VERSIONS,
    marketCell,
    metricFamily: "pricing",
    normalizedNightlyPrice,
    priceBand: "unclassified",
    capturePeriodBucket,
    sourceClass: candidate.sourceClass,
    eligibilityStatus: "eligible",
    duplicateStatus: "unchecked",
    confidenceInputBand,
    freshnessInputBand,
    sourceQualityBand,
  };

  const privacyValidation = validateSharedIntelligencePrivacy(fact);
  if (!privacyValidation.valid) {
    return { accepted: false, reason: "privacy_validation_failed" };
  }

  return {
    accepted: true,
    fact,
  };
}

export function projectAnonymousPricingFactIdempotencyInputs(
  fact: AnonymousPricingFact,
): AnonymousPricingFactIdentityProjection {
  return {
    marketCellKey: fact.marketCell.marketCellKey,
    metricFamily: fact.metricFamily,
    normalizedNightlyPrice: fact.normalizedNightlyPrice,
    capturePeriodBucket: fact.capturePeriodBucket,
    sourceClass: fact.sourceClass,
    transformationPolicyVersion: INTELLIGENCE_V2_TRANSFORMATION_POLICY_VERSION,
  };
}

export function isPricingPlatformSupported(
  platform: IntelligenceV2Platform,
): boolean {
  return platform !== "unknown";
}
