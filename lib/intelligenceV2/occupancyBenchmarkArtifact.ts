import type {
  IntelligenceV2ObservedDaysBand,
  IntelligenceV2UnavailabilityRateBand,
} from "./occupancyFact";

export const OCCUPANCY_BENCHMARK_TYPE =
  "occupancy_distribution" as const;

export const OCCUPANCY_OBSERVED_DAYS_BANDS =
  [
    "1_6",
    "7_13",
    "14_29",
    "30_59",
    "60_plus",
  ] as const satisfies ReadonlyArray<IntelligenceV2ObservedDaysBand>;

export const OCCUPANCY_UNAVAILABILITY_RATE_BANDS =
  [
    "0_19",
    "20_39",
    "40_59",
    "60_79",
    "80_100",
  ] as const satisfies ReadonlyArray<IntelligenceV2UnavailabilityRateBand>;

export type OccupancyBenchmarkPlatform =
  | "airbnb"
  | "booking"
  | "expedia"
  | "agoda"
  | "vrbo";

export type OccupancyBenchmarkPropertyType =
  | "studio"
  | "apartment"
  | "villa"
  | "riad"
  | "room"
  | "hotel"
  | "unknown";

export type OccupancyBenchmarkCapacityBand =
  | "unknown"
  | "1_3"
  | "4_6"
  | "7_9"
  | "10_plus";

export type OccupancyBenchmarkSourceDiversityBand =
  | "unknown"
  | "low"
  | "moderate"
  | "high";

export type OccupancyBenchmarkConfidenceLevel =
  | "very_low"
  | "low"
  | "moderate"
  | "high"
  | "very_high";

export type OccupancyBenchmarkApprovalStatus =
  | "draft"
  | "insufficient"
  | "exploratory"
  | "internal_approved"
  | "audit_approved"
  | "revoked";

export type OccupancyBenchmarkLimitationCode =
  | "small_sample"
  | "broad_fallback"
  | "low_source_diversity"
  | "aging_data"
  | "unknown_property_type"
  | "unknown_capacity";

export type OccupancyObservedDaysCounts = Readonly<
  Record<IntelligenceV2ObservedDaysBand, number>
>;

export type OccupancyUnavailabilityRateCounts = Readonly<
  Record<IntelligenceV2UnavailabilityRateBand, number>
>;

export type OccupancyBenchmarkDistribution = Readonly<{
  observedDaysCounts: OccupancyObservedDaysCounts;
  unavailabilityRateCounts: OccupancyUnavailabilityRateCounts;
  dominantObservedDaysBand: IntelligenceV2ObservedDaysBand;
  dominantUnavailabilityRateBand:
    IntelligenceV2UnavailabilityRateBand;
}>;

export type OccupancyBenchmarkArtifact = Readonly<{
  artifactKey: string;
  artifactContractVersion: string;
  benchmarkType: typeof OCCUPANCY_BENCHMARK_TYPE;

  approvalStatus: OccupancyBenchmarkApprovalStatus;

  country: string;
  city: string;
  platform: OccupancyBenchmarkPlatform;
  propertyType: OccupancyBenchmarkPropertyType;
  capacityBand: OccupancyBenchmarkCapacityBand;
  currency: "UNKNOWN";
  marketCellKey: string;

  capturePeriodBucket: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;

  cohortDefinitionVersion: string;
  sourceClassCount: number;
  sourceDiversityBand:
    OccupancyBenchmarkSourceDiversityBand;

  distribution: OccupancyBenchmarkDistribution;

  rawSampleSize: number;
  includedSampleSize: number;
  excludedOutlierCount: number;

  outlierPolicyVersion: string;
  confidenceLevel: OccupancyBenchmarkConfidenceLevel;
  confidencePolicyVersion: string;

  validFrom: string;
  validUntil: string;
  freshnessPolicyVersion: string;

  approvedForInternal: boolean;
  approvedForAudit: boolean;
  limitations: OccupancyBenchmarkLimitationCode[];

  cohortPolicyVersion: string;
  aggregationPolicyVersion: string;
  approvalPolicyVersion: string;
  marketCellPolicyVersion: string;

  supersedesArtifactId: string | null;
}>;

export type OccupancyBenchmarkArtifactValidationReasonCode =
  | "invalid_artifact_key"
  | "invalid_market_cell"
  | "invalid_capture_period"
  | "invalid_source_period"
  | "invalid_validity_window"
  | "invalid_sample_size"
  | "invalid_source_class_count"
  | "invalid_observed_days_count"
  | "invalid_unavailability_count"
  | "observed_days_sum_mismatch"
  | "unavailability_sum_mismatch"
  | "invalid_dominant_observed_days_band"
  | "invalid_dominant_unavailability_rate_band"
  | "invalid_policy_version"
  | "invalid_approval_flags"
  | "invalid_limitation_code";

export type OccupancyBenchmarkArtifactValidationResult =
  | Readonly<{ valid: true }>
  | Readonly<{
      valid: false;
      reasonCodes:
        OccupancyBenchmarkArtifactValidationReasonCode[];
    }>;

const MONTH_BUCKET_REGEX =
  /^[0-9]{4}-(0[1-9]|1[0-2])$/;

const DATE_ONLY_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const LIMITATION_CODES =
  new Set<OccupancyBenchmarkLimitationCode>([
    "small_sample",
    "broad_fallback",
    "low_source_diversity",
    "aging_data",
    "unknown_property_type",
    "unknown_capacity",
  ]);

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_REGEX.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueSortedReasonCodes(
  values: Iterable<OccupancyBenchmarkArtifactValidationReasonCode>,
): OccupancyBenchmarkArtifactValidationReasonCode[] {
  return [...new Set(values)].sort();
}

function sumCounts(
  values: Readonly<Record<string, number>>,
): number {
  return Object.values(values).reduce(
    (total, value) => total + value,
    0,
  );
}

export function validateOccupancyBenchmarkArtifact(
  artifact: OccupancyBenchmarkArtifact,
): OccupancyBenchmarkArtifactValidationResult {
  const reasonCodes =
    new Set<OccupancyBenchmarkArtifactValidationReasonCode>();

  if (!isNonEmptyString(artifact.artifactKey)) {
    reasonCodes.add("invalid_artifact_key");
  }

  if (
    !isNonEmptyString(artifact.country) ||
    artifact.country.trim().toLowerCase() === "unknown" ||
    !isNonEmptyString(artifact.city) ||
    artifact.city.trim().toLowerCase() === "unknown" ||
    !isNonEmptyString(artifact.marketCellKey)
  ) {
    reasonCodes.add("invalid_market_cell");
  }

  if (
    !MONTH_BUCKET_REGEX.test(
      artifact.capturePeriodBucket,
    )
  ) {
    reasonCodes.add("invalid_capture_period");
  }

  if (
    !isValidDateOnly(artifact.sourcePeriodStart) ||
    !isValidDateOnly(artifact.sourcePeriodEnd) ||
    artifact.sourcePeriodEnd <
      artifact.sourcePeriodStart
  ) {
    reasonCodes.add("invalid_source_period");
  }

  const validFromMs =
    parseTimestamp(artifact.validFrom);
  const validUntilMs =
    parseTimestamp(artifact.validUntil);

  if (
    validFromMs == null ||
    validUntilMs == null ||
    validUntilMs <= validFromMs
  ) {
    reasonCodes.add("invalid_validity_window");
  }

  if (
    !isNonNegativeInteger(artifact.rawSampleSize) ||
    !isNonNegativeInteger(
      artifact.includedSampleSize,
    ) ||
    !isNonNegativeInteger(
      artifact.excludedOutlierCount,
    ) ||
    artifact.includedSampleSize >
      artifact.rawSampleSize ||
    artifact.excludedOutlierCount >
      artifact.rawSampleSize
  ) {
    reasonCodes.add("invalid_sample_size");
  }

  if (
    !isNonNegativeInteger(
      artifact.sourceClassCount,
    )
  ) {
    reasonCodes.add("invalid_source_class_count");
  }

  for (const band of OCCUPANCY_OBSERVED_DAYS_BANDS) {
    if (
      !isNonNegativeInteger(
        artifact.distribution.observedDaysCounts[
          band
        ],
      )
    ) {
      reasonCodes.add(
        "invalid_observed_days_count",
      );
    }
  }

  for (
    const band of
    OCCUPANCY_UNAVAILABILITY_RATE_BANDS
  ) {
    if (
      !isNonNegativeInteger(
        artifact.distribution
          .unavailabilityRateCounts[band],
      )
    ) {
      reasonCodes.add(
        "invalid_unavailability_count",
      );
    }
  }

  if (
    sumCounts(
      artifact.distribution.observedDaysCounts,
    ) !== artifact.includedSampleSize
  ) {
    reasonCodes.add(
      "observed_days_sum_mismatch",
    );
  }

  if (
    sumCounts(
      artifact.distribution
        .unavailabilityRateCounts,
    ) !== artifact.includedSampleSize
  ) {
    reasonCodes.add(
      "unavailability_sum_mismatch",
    );
  }

  if (
    !OCCUPANCY_OBSERVED_DAYS_BANDS.includes(
      artifact.distribution
        .dominantObservedDaysBand,
    )
  ) {
    reasonCodes.add(
      "invalid_dominant_observed_days_band",
    );
  }

  if (
    !OCCUPANCY_UNAVAILABILITY_RATE_BANDS.includes(
      artifact.distribution
        .dominantUnavailabilityRateBand,
    )
  ) {
    reasonCodes.add(
      "invalid_dominant_unavailability_rate_band",
    );
  }

  for (const version of [
    artifact.artifactContractVersion,
    artifact.cohortDefinitionVersion,
    artifact.outlierPolicyVersion,
    artifact.confidencePolicyVersion,
    artifact.freshnessPolicyVersion,
    artifact.cohortPolicyVersion,
    artifact.aggregationPolicyVersion,
    artifact.approvalPolicyVersion,
    artifact.marketCellPolicyVersion,
  ]) {
    if (!isNonEmptyString(version)) {
      reasonCodes.add("invalid_policy_version");
    }
  }

  const auditDisallowedApprovalStatuses:
    ReadonlyArray<OccupancyBenchmarkApprovalStatus> = [
      "draft",
      "insufficient",
      "exploratory",
      "revoked",
    ];

  if (
    (artifact.approvalStatus === "internal_approved" &&
      !artifact.approvedForInternal) ||
    (artifact.approvalStatus === "audit_approved" &&
      (!artifact.approvedForInternal ||
        !artifact.approvedForAudit)) ||
    (auditDisallowedApprovalStatuses.includes(
      artifact.approvalStatus,
    ) &&
      artifact.approvedForAudit)
  ) {
    reasonCodes.add("invalid_approval_flags");
  }

  if (
    artifact.limitations.some(
      (code) => !LIMITATION_CODES.has(code),
    )
  ) {
    reasonCodes.add("invalid_limitation_code");
  }

  if (reasonCodes.size > 0) {
    return {
      valid: false,
      reasonCodes:
        uniqueSortedReasonCodes(reasonCodes),
    };
  }

  return { valid: true };
}
