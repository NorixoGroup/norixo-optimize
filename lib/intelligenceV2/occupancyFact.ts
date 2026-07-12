import {
  INTELLIGENCE_V2_DEDUPLICATION_POLICY_VERSION,
  INTELLIGENCE_V2_ELIGIBILITY_POLICY_VERSION,
  INTELLIGENCE_V2_FACT_CONTRACT_VERSION,
  INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  INTELLIGENCE_V2_TRANSFORMATION_POLICY_VERSION,
} from "./policyVersions";
import {
  buildMarketCellV1,
  type MarketCellV1,
} from "./marketCell";
import { validateSharedIntelligencePrivacy } from "./privacyValidator";

export type IntelligenceV2OccupancySourceClass =
  | "authenticated_audit"
  | "authenticated_listing"
  | "guest_audit"
  | "historical_backfill";

export type IntelligenceV2OccupancyEligibilityStatus =
  | "eligible"
  | "rejected"
  | "private_only";

export type IntelligenceV2OccupancyDuplicateStatus =
  | "unchecked"
  | "unique"
  | "duplicate"
  | "update"
  | "refresh";

export type IntelligenceV2ObservedDaysBand =
  | "1_6"
  | "7_13"
  | "14_29"
  | "30_59"
  | "60_plus";

export type IntelligenceV2UnavailabilityRateBand =
  | "0_19"
  | "20_39"
  | "40_59"
  | "60_79"
  | "80_100";

export type IntelligenceV2OccupancySourceQualityBand =
  | "unknown"
  | "low"
  | "moderate"
  | "high";

export type AnonymousOccupancyFactCandidate = Readonly<{
  sourceClass: IntelligenceV2OccupancySourceClass;
  capturedAt: string;

  platform?: string | null;
  country?: string | null;
  city?: string | null;
  propertyType?: string | null;
  capacity?: number | null;
  guestCapacity?: number | null;

  observedDays?: number | null;
  unavailableDays?: number | null;
  availableDays?: number | null;
  windowDays?: number | null;

  extractionQuality?: string | null;
  freshness?: string | null;
}>;

export type AnonymousOccupancyFact = Readonly<{
  factContractVersion: string;
  transformationPolicyVersion: string;
  eligibilityPolicyVersion: string;
  deduplicationPolicyVersion: string;
  marketCellPolicyVersion: string;

  marketCell: MarketCellV1;
  metricFamily: "occupancy";

  observedDaysBand: IntelligenceV2ObservedDaysBand;
  unavailabilityRateBand: IntelligenceV2UnavailabilityRateBand;
  capturePeriodBucket: string;

  sourceClass: IntelligenceV2OccupancySourceClass;
  eligibilityStatus: IntelligenceV2OccupancyEligibilityStatus;
  duplicateStatus: IntelligenceV2OccupancyDuplicateStatus;
  sourceQualityBand: IntelligenceV2OccupancySourceQualityBand;
}>;

export type AnonymousOccupancyFactRejectionReason =
  | "guest_source_not_allowed"
  | "historical_backfill_disabled"
  | "missing_country"
  | "missing_city"
  | "unsupported_platform"
  | "invalid_capture_date"
  | "invalid_observed_days"
  | "invalid_unavailable_days"
  | "invalid_available_days"
  | "inconsistent_day_counts"
  | "privacy_validation_failed";

export type AnonymousOccupancyFactTransformResult =
  | Readonly<{
      accepted: true;
      fact: AnonymousOccupancyFact;
    }>
  | Readonly<{
      accepted: false;
      reason: AnonymousOccupancyFactRejectionReason;
    }>;

export type AnonymousOccupancyFactIdentityProjection = Readonly<{
  marketCellKey: string;
  metricFamily: "occupancy";
  observedDaysBand: IntelligenceV2ObservedDaysBand;
  unavailabilityRateBand: IntelligenceV2UnavailabilityRateBand;
  capturePeriodBucket: string;
  sourceClass: IntelligenceV2OccupancySourceClass;
  transformationPolicyVersion: string;
}>;

function toCapturePeriodBucket(capturedAt: string): string | null {
  const parsed = new Date(capturedAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toNonNegativeInteger(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isInteger(value)
  ) {
    return null;
  }

  return value;
}

function isMissingValue(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function normalizeQualityBand(
  value: string | null | undefined,
): IntelligenceV2OccupancySourceQualityBand {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";

  if (normalized === "low") return "low";
  if (normalized === "medium" || normalized === "moderate") {
    return "moderate";
  }
  if (normalized === "high") return "high";
  return "unknown";
}

export function deriveObservedDaysBand(
  observedDays: number,
): IntelligenceV2ObservedDaysBand {
  if (observedDays <= 6) return "1_6";
  if (observedDays <= 13) return "7_13";
  if (observedDays <= 29) return "14_29";
  if (observedDays <= 59) return "30_59";
  return "60_plus";
}

export function deriveUnavailabilityRateBand(
  unavailableDays: number,
  observedDays: number,
): IntelligenceV2UnavailabilityRateBand {
  const rate = (unavailableDays / observedDays) * 100;

  if (rate < 20) return "0_19";
  if (rate < 40) return "20_39";
  if (rate < 60) return "40_59";
  if (rate < 80) return "60_79";
  return "80_100";
}

export function buildAnonymousOccupancyFactIdentityProjection(
  fact: AnonymousOccupancyFact,
): AnonymousOccupancyFactIdentityProjection {
  return {
    marketCellKey: fact.marketCell.marketCellKey,
    metricFamily: fact.metricFamily,
    observedDaysBand: fact.observedDaysBand,
    unavailabilityRateBand: fact.unavailabilityRateBand,
    capturePeriodBucket: fact.capturePeriodBucket,
    sourceClass: fact.sourceClass,
    transformationPolicyVersion: fact.transformationPolicyVersion,
  };
}

export function transformCandidateToAnonymousOccupancyFact(
  candidate: AnonymousOccupancyFactCandidate,
): AnonymousOccupancyFactTransformResult {
  if (candidate.sourceClass === "guest_audit") {
    return {
      accepted: false,
      reason: "guest_source_not_allowed",
    };
  }

  if (candidate.sourceClass === "historical_backfill") {
    return {
      accepted: false,
      reason: "historical_backfill_disabled",
    };
  }

  const capturePeriodBucket = toCapturePeriodBucket(candidate.capturedAt);
  if (capturePeriodBucket == null) {
    return {
      accepted: false,
      reason: "invalid_capture_date",
    };
  }

  if (isMissingValue(candidate.country)) {
    return {
      accepted: false,
      reason: "missing_country",
    };
  }

  if (isMissingValue(candidate.city)) {
    return {
      accepted: false,
      reason: "missing_city",
    };
  }

  const marketCell = buildMarketCellV1({
    platform: candidate.platform,
    country: candidate.country,
    city: candidate.city,
    propertyType: candidate.propertyType,
    capacity: candidate.capacity,
    guestCapacity: candidate.guestCapacity,
    currency: null,
  });

  if (marketCell.country === "unknown") {
    return {
      accepted: false,
      reason: "missing_country",
    };
  }

  if (marketCell.city === "unknown") {
    return {
      accepted: false,
      reason: "missing_city",
    };
  }

  if (marketCell.platform === "unknown") {
    return {
      accepted: false,
      reason: "unsupported_platform",
    };
  }

  const observedDays = toNonNegativeInteger(candidate.observedDays);
  if (observedDays == null || observedDays <= 0) {
    return {
      accepted: false,
      reason: "invalid_observed_days",
    };
  }

  const unavailableDays = toNonNegativeInteger(
    candidate.unavailableDays,
  );
  if (unavailableDays == null || unavailableDays > observedDays) {
    return {
      accepted: false,
      reason: "invalid_unavailable_days",
    };
  }

  const availableDays = toNonNegativeInteger(candidate.availableDays);
  if (availableDays == null || availableDays > observedDays) {
    return {
      accepted: false,
      reason: "invalid_available_days",
    };
  }

  if (availableDays + unavailableDays !== observedDays) {
    return {
      accepted: false,
      reason: "inconsistent_day_counts",
    };
  }

  const fact: AnonymousOccupancyFact = Object.freeze({
    factContractVersion:
      INTELLIGENCE_V2_FACT_CONTRACT_VERSION,
    transformationPolicyVersion:
      INTELLIGENCE_V2_TRANSFORMATION_POLICY_VERSION,
    eligibilityPolicyVersion:
      INTELLIGENCE_V2_ELIGIBILITY_POLICY_VERSION,
    deduplicationPolicyVersion:
      INTELLIGENCE_V2_DEDUPLICATION_POLICY_VERSION,
    marketCellPolicyVersion:
      INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,

    marketCell,
    metricFamily: "occupancy",

    observedDaysBand: deriveObservedDaysBand(observedDays),
    unavailabilityRateBand:
      deriveUnavailabilityRateBand(
        unavailableDays,
        observedDays,
      ),
    capturePeriodBucket,

    sourceClass: candidate.sourceClass,
    eligibilityStatus: "eligible",
    duplicateStatus: "unchecked",
    sourceQualityBand: normalizeQualityBand(
      candidate.extractionQuality,
    ),
  });

  const privacyValidation =
    validateSharedIntelligencePrivacy(fact);

  if (!privacyValidation.valid) {
    return {
      accepted: false,
      reason: "privacy_validation_failed",
    };
  }

  return {
    accepted: true,
    fact,
  };
}
