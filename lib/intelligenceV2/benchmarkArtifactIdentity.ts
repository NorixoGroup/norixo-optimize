import { createHash } from "node:crypto";

export type BenchmarkArtifactIdentityInput = Readonly<{
  benchmarkType: string;
  marketCellKey: string;
  capturePeriodBucket: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  p10Price: number;
  p25Price: number;
  medianPrice: number;
  p75Price: number;
  p90Price: number;
  rawSampleSize: number;
  includedSampleSize: number;
  excludedOutlierCount: number;
  sourceClassCount: number;
  sourceDiversityBand: string;
  confidenceLevel: string;
  approvalStatus: string;
  limitations: ReadonlyArray<string>;
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

export type BenchmarkArtifactIdentityResult =
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

function normalizeRequiredString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDateOnly(value: string | null | undefined): string | null {
  const trimmed = normalizeRequiredString(value);
  if (trimmed == null || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10) === trimmed ? trimmed : null;
}

function formatMoney(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value.toFixed(2);
}

function formatInteger(value: number): string | null {
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  return String(value);
}

export function buildBenchmarkArtifactIdentityMessage(
  input: BenchmarkArtifactIdentityInput,
): string | null {
  const benchmarkType = normalizeRequiredString(input.benchmarkType);
  const marketCellKey = normalizeRequiredString(input.marketCellKey);
  const capturePeriodBucket = normalizeRequiredString(input.capturePeriodBucket);
  const sourcePeriodStart = normalizeDateOnly(input.sourcePeriodStart);
  const sourcePeriodEnd = normalizeDateOnly(input.sourcePeriodEnd);
  const p10Price = formatMoney(input.p10Price);
  const p25Price = formatMoney(input.p25Price);
  const medianPrice = formatMoney(input.medianPrice);
  const p75Price = formatMoney(input.p75Price);
  const p90Price = formatMoney(input.p90Price);
  const rawSampleSize = formatInteger(input.rawSampleSize);
  const includedSampleSize = formatInteger(input.includedSampleSize);
  const excludedOutlierCount = formatInteger(input.excludedOutlierCount);
  const sourceClassCount = formatInteger(input.sourceClassCount);
  const sourceDiversityBand = normalizeRequiredString(input.sourceDiversityBand);
  const confidenceLevel = normalizeRequiredString(input.confidenceLevel);
  const approvalStatus = normalizeRequiredString(input.approvalStatus);

  if (
    benchmarkType == null ||
    marketCellKey == null ||
    capturePeriodBucket == null ||
    sourcePeriodStart == null ||
    sourcePeriodEnd == null ||
    p10Price == null ||
    p25Price == null ||
    medianPrice == null ||
    p75Price == null ||
    p90Price == null ||
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

  const limitations = [...input.limitations]
    .map((value) => normalizeRequiredString(value))
    .filter((value): value is string => value != null)
    .sort();

  const policyVersions = [
    normalizeRequiredString(input.artifactContractVersion),
    normalizeRequiredString(input.cohortDefinitionVersion),
    normalizeRequiredString(input.cohortPolicyVersion),
    normalizeRequiredString(input.aggregationPolicyVersion),
    normalizeRequiredString(input.outlierPolicyVersion),
    normalizeRequiredString(input.confidencePolicyVersion),
    normalizeRequiredString(input.freshnessPolicyVersion),
    normalizeRequiredString(input.approvalPolicyVersion),
    normalizeRequiredString(input.marketCellPolicyVersion),
  ];

  if (policyVersions.some((value) => value == null)) {
    return null;
  }

  return [
    `benchmark_type=${benchmarkType}`,
    `market_cell=${marketCellKey}`,
    `capture_period=${capturePeriodBucket}`,
    `source_period_start=${sourcePeriodStart}`,
    `source_period_end=${sourcePeriodEnd}`,
    `p10_price=${p10Price}`,
    `p25_price=${p25Price}`,
    `median_price=${medianPrice}`,
    `p75_price=${p75Price}`,
    `p90_price=${p90Price}`,
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

export function buildBenchmarkArtifactKey(
  input: BenchmarkArtifactIdentityInput,
): BenchmarkArtifactIdentityResult {
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
      (value) => normalizeRequiredString(value) == null,
    )
  ) {
    return { ok: false, reason: "invalid_policy_versions" };
  }

  if (
    !Number.isFinite(input.p10Price) ||
    !Number.isFinite(input.p25Price) ||
    !Number.isFinite(input.medianPrice) ||
    !Number.isFinite(input.p75Price) ||
    !Number.isFinite(input.p90Price) ||
    input.p10Price <= 0 ||
    input.p25Price <= 0 ||
    input.medianPrice <= 0 ||
    input.p75Price <= 0 ||
    input.p90Price <= 0 ||
    input.p10Price > input.p25Price ||
    input.p25Price > input.medianPrice ||
    input.medianPrice > input.p75Price ||
    input.p75Price > input.p90Price
  ) {
    return { ok: false, reason: "invalid_distribution" };
  }

  const message = buildBenchmarkArtifactIdentityMessage(input);
  if (message == null) {
    return { ok: false, reason: "invalid_artifact_identity_input" };
  }

  return {
    ok: true,
    artifactKey: `ifv2_benchmark_${createHash("sha256").update(message).digest("hex")}`,
  };
}
