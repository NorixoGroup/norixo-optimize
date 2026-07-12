import { createHash } from "node:crypto";

import type {
  OccupancyBenchmarkApprovalStatus,
  OccupancyBenchmarkConfidenceLevel,
  OccupancyBenchmarkDistribution,
  OccupancyBenchmarkLimitationCode,
  OccupancyBenchmarkSourceDiversityBand,
} from "./occupancyBenchmarkArtifact";

export type OccupancyBenchmarkArtifactIdentityInput =
  Readonly<{
    benchmarkType: "occupancy_distribution";
    marketCellKey: string;
    capturePeriodBucket: string;
    sourcePeriodStart: string;
    sourcePeriodEnd: string;

    distribution: OccupancyBenchmarkDistribution;

    rawSampleSize: number;
    includedSampleSize: number;
    excludedOutlierCount: number;
    sourceClassCount: number;
    sourceDiversityBand:
      OccupancyBenchmarkSourceDiversityBand;
    confidenceLevel:
      OccupancyBenchmarkConfidenceLevel;
    approvalStatus:
      OccupancyBenchmarkApprovalStatus;
    limitations:
      ReadonlyArray<OccupancyBenchmarkLimitationCode>;

    artifactContractVersion: string;
    cohortDefinitionVersion: string;
    cohortPolicyVersion: string;
    aggregationPolicyVersion: string;
    outlierPolicyVersion: string;
    confidencePolicyVersion: string;
    freshnessPolicyVersion: string;
    approvalPolicyVersion: string;
    marketCellPolicyVersion: string;
  }>;

export type OccupancyBenchmarkArtifactIdentityResult =
  | Readonly<{
      ok: true;
      artifactKey: string;
    }>
  | Readonly<{
      ok: false;
      reason:
        | "invalid_artifact_identity_input"
        | "invalid_distribution"
        | "invalid_policy_versions";
    }>;

function normalizeRequiredString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDateOnly(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeRequiredString(value);

  if (
    normalized == null ||
    !/^\d{4}-\d{2}-\d{2}$/.test(normalized)
  ) {
    return null;
  }

  const parsed = new Date(
    `${normalized}T00:00:00.000Z`,
  );

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !==
      normalized
  ) {
    return null;
  }

  return normalized;
}

function formatInteger(
  value: number,
): string | null {
  if (
    !Number.isInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return String(value);
}

function validateCounts(
  counts: Readonly<Record<string, number>>,
  expectedTotal: number,
): boolean {
  const values = Object.values(counts);

  return (
    values.every(
      (value) =>
        Number.isInteger(value) &&
        value >= 0,
    ) &&
    values.reduce(
      (total, value) => total + value,
      0,
    ) === expectedTotal
  );
}

export function buildOccupancyBenchmarkArtifactIdentityMessage(
  input: OccupancyBenchmarkArtifactIdentityInput,
): string | null {
  const benchmarkType =
    normalizeRequiredString(input.benchmarkType);
  const marketCellKey =
    normalizeRequiredString(input.marketCellKey);
  const capturePeriodBucket =
    normalizeRequiredString(
      input.capturePeriodBucket,
    );
  const sourcePeriodStart =
    normalizeDateOnly(input.sourcePeriodStart);
  const sourcePeriodEnd =
    normalizeDateOnly(input.sourcePeriodEnd);

  const rawSampleSize =
    formatInteger(input.rawSampleSize);
  const includedSampleSize =
    formatInteger(input.includedSampleSize);
  const excludedOutlierCount =
    formatInteger(input.excludedOutlierCount);
  const sourceClassCount =
    formatInteger(input.sourceClassCount);

  const sourceDiversityBand =
    normalizeRequiredString(
      input.sourceDiversityBand,
    );
  const confidenceLevel =
    normalizeRequiredString(
      input.confidenceLevel,
    );
  const approvalStatus =
    normalizeRequiredString(
      input.approvalStatus,
    );

  if (
    benchmarkType !==
      "occupancy_distribution" ||
    marketCellKey == null ||
    capturePeriodBucket == null ||
    sourcePeriodStart == null ||
    sourcePeriodEnd == null ||
    rawSampleSize == null ||
    includedSampleSize == null ||
    excludedOutlierCount == null ||
    sourceClassCount == null ||
    sourceDiversityBand == null ||
    confidenceLevel == null ||
    approvalStatus == null
  ) {
    return null;
  }

  if (
    !validateCounts(
      input.distribution.observedDaysCounts,
      input.includedSampleSize,
    ) ||
    !validateCounts(
      input.distribution
        .unavailabilityRateCounts,
      input.includedSampleSize,
    )
  ) {
    return null;
  }

  const policyVersions = [
    normalizeRequiredString(
      input.artifactContractVersion,
    ),
    normalizeRequiredString(
      input.cohortDefinitionVersion,
    ),
    normalizeRequiredString(
      input.cohortPolicyVersion,
    ),
    normalizeRequiredString(
      input.aggregationPolicyVersion,
    ),
    normalizeRequiredString(
      input.outlierPolicyVersion,
    ),
    normalizeRequiredString(
      input.confidencePolicyVersion,
    ),
    normalizeRequiredString(
      input.freshnessPolicyVersion,
    ),
    normalizeRequiredString(
      input.approvalPolicyVersion,
    ),
    normalizeRequiredString(
      input.marketCellPolicyVersion,
    ),
  ];

  if (
    policyVersions.some(
      (value) => value == null,
    )
  ) {
    return null;
  }

  const limitations = [...input.limitations]
    .map(normalizeRequiredString)
    .filter(
      (value): value is string =>
        value != null,
    )
    .sort();

  return [
    `benchmark_type=${benchmarkType}`,
    `market_cell=${marketCellKey}`,
    `capture_period=${capturePeriodBucket}`,
    `source_period_start=${sourcePeriodStart}`,
    `source_period_end=${sourcePeriodEnd}`,

    `observed_days_1_6=${
      input.distribution.observedDaysCounts["1_6"]
    }`,
    `observed_days_7_13=${
      input.distribution.observedDaysCounts["7_13"]
    }`,
    `observed_days_14_29=${
      input.distribution.observedDaysCounts["14_29"]
    }`,
    `observed_days_30_59=${
      input.distribution.observedDaysCounts["30_59"]
    }`,
    `observed_days_60_plus=${
      input.distribution.observedDaysCounts[
        "60_plus"
      ]
    }`,

    `unavailability_0_19=${
      input.distribution
        .unavailabilityRateCounts["0_19"]
    }`,
    `unavailability_20_39=${
      input.distribution
        .unavailabilityRateCounts["20_39"]
    }`,
    `unavailability_40_59=${
      input.distribution
        .unavailabilityRateCounts["40_59"]
    }`,
    `unavailability_60_79=${
      input.distribution
        .unavailabilityRateCounts["60_79"]
    }`,
    `unavailability_80_100=${
      input.distribution
        .unavailabilityRateCounts["80_100"]
    }`,

    `dominant_observed_days_band=${
      input.distribution
        .dominantObservedDaysBand
    }`,
    `dominant_unavailability_rate_band=${
      input.distribution
        .dominantUnavailabilityRateBand
    }`,

    `raw_sample_size=${rawSampleSize}`,
    `included_sample_size=${includedSampleSize}`,
    `excluded_outlier_count=${excludedOutlierCount}`,
    `source_class_count=${sourceClassCount}`,
    `source_diversity_band=${sourceDiversityBand}`,
    `confidence_level=${confidenceLevel}`,
    `approval_status=${approvalStatus}`,
    `limitations=${limitations.join(",")}`,

    `artifact_contract_version=${policyVersions[0]}`,
    `cohort_definition_version=${policyVersions[1]}`,
    `cohort_policy_version=${policyVersions[2]}`,
    `aggregation_policy_version=${policyVersions[3]}`,
    `outlier_policy_version=${policyVersions[4]}`,
    `confidence_policy_version=${policyVersions[5]}`,
    `freshness_policy_version=${policyVersions[6]}`,
    `approval_policy_version=${policyVersions[7]}`,
    `market_cell_policy_version=${policyVersions[8]}`,
  ].join("\n");
}

export function buildOccupancyBenchmarkArtifactKey(
  input: OccupancyBenchmarkArtifactIdentityInput,
): OccupancyBenchmarkArtifactIdentityResult {
  const policyVersions = [
    input.artifactContractVersion,
    input.cohortDefinitionVersion,
    input.cohortPolicyVersion,
    input.aggregationPolicyVersion,
    input.outlierPolicyVersion,
    input.confidencePolicyVersion,
    input.freshnessPolicyVersion,
    input.approvalPolicyVersion,
    input.marketCellPolicyVersion,
  ];

  if (
    policyVersions.some(
      (value) =>
        normalizeRequiredString(value) == null,
    )
  ) {
    return {
      ok: false,
      reason: "invalid_policy_versions",
    };
  }

  if (
    !validateCounts(
      input.distribution.observedDaysCounts,
      input.includedSampleSize,
    ) ||
    !validateCounts(
      input.distribution
        .unavailabilityRateCounts,
      input.includedSampleSize,
    )
  ) {
    return {
      ok: false,
      reason: "invalid_distribution",
    };
  }

  const message =
    buildOccupancyBenchmarkArtifactIdentityMessage(
      input,
    );

  if (message == null) {
    return {
      ok: false,
      reason:
        "invalid_artifact_identity_input",
    };
  }

  return {
    ok: true,
    artifactKey: `ifv2_occupancy_benchmark_${createHash(
      "sha256",
    )
      .update(message)
      .digest("hex")}`,
  };
}
