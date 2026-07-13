import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  DEBUG_INTELLIGENCE_V2,
  getIntelligenceV2FeatureFlags,
  type IntelligenceV2FeatureFlagEnv,
} from "./featureFlags";
import type {
  AnonymousOccupancyFact,
  IntelligenceV2OccupancySourceClass,
  IntelligenceV2OccupancySourceQualityBand,
  IntelligenceV2ObservedDaysBand,
  IntelligenceV2UnavailabilityRateBand,
} from "./occupancyFact";
import type {
  OccupancyBenchmarkApprovalStatus,
  OccupancyBenchmarkArtifact,
  OccupancyBenchmarkConfidenceLevel,
  OccupancyBenchmarkLimitationCode,
  OccupancyBenchmarkSourceDiversityBand,
} from "./occupancyBenchmarkArtifact";
import {
  buildOccupancyBenchmarkPreview,
} from "./occupancyBenchmarkPreview";

const MONTH_BUCKET_REGEX = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

const PLATFORM_VALUES = [
  "airbnb",
  "booking",
  "expedia",
  "agoda",
  "vrbo",
] as const;

const PROPERTY_TYPE_VALUES = [
  "studio",
  "apartment",
  "villa",
  "riad",
  "room",
  "hotel",
  "unknown",
] as const;

const CAPACITY_BAND_VALUES = [
  "unknown",
  "1_3",
  "4_6",
  "7_9",
  "10_plus",
] as const;

const OBSERVED_DAYS_BAND_VALUES = [
  "1_6",
  "7_13",
  "14_29",
  "30_59",
  "60_plus",
] as const;

const UNAVAILABILITY_RATE_BAND_VALUES = [
  "0_19",
  "20_39",
  "40_59",
  "60_79",
  "80_100",
] as const;

const SOURCE_CLASS_VALUES = [
  "authenticated_audit",
  "authenticated_listing",
] as const;

const SOURCE_QUALITY_BAND_VALUES = [
  "unknown",
  "low",
  "moderate",
  "high",
] as const;

const PREVIEW_REASON_CODE_VALUES = [
  "invalid_input",
  "no_facts_found",
  "market_cell_mismatch",
  "capture_period_mismatch",
  "incompatible_policy_versions",
  "invalid_source_class",
  "distribution_failed",
  "artifact_identity_failed",
  "artifact_validation_failed",
] as const;

type OccupancyBenchmarkPlatform = (typeof PLATFORM_VALUES)[number];
type OccupancyBenchmarkPropertyType = (typeof PROPERTY_TYPE_VALUES)[number];
type OccupancyBenchmarkCapacityBand = (typeof CAPACITY_BAND_VALUES)[number];
type AuthenticatedOccupancySourceClass = (typeof SOURCE_CLASS_VALUES)[number];
type OccupancyBenchmarkAdminClient =
  ReturnType<typeof createSupabaseAdminClient>;

type OccupancyExistingArtifactRow = Readonly<{
  id: string;
  artifactKey: string | null;
  createdAt: string;
}>;

type LoadFactsResult =
  | Readonly<{
      ok: true;
      rows: ReadonlyArray<OccupancyAnonymousFactGroupSourceRow>;
    }>
  | Readonly<{ ok: false }>;

type FindArtifactResult =
  | Readonly<{
      ok: true;
      row: OccupancyExistingArtifactRow | null;
    }>
  | Readonly<{ ok: false }>;

export type OccupancyBenchmarkBuilderInput = Readonly<{
  marketCellKey: string;
  capturePeriodBucket: string;
  dryRun?: boolean;
  force?: boolean;
}>;

export type OccupancyBenchmarkBuilderStatus =
  | "disabled"
  | "dry_run"
  | "inserted"
  | "already_exists"
  | "insufficient"
  | "failed";

export type OccupancyBenchmarkBuilderReasonCode =
  | "flag_disabled"
  | "invalid_input"
  | "invalid_fact_row"
  | "no_facts_found"
  | "market_cell_mismatch"
  | "capture_period_mismatch"
  | "incompatible_policy_versions"
  | "invalid_source_class"
  | "database_read_error"
  | "artifact_already_exists"
  | "supersession_lookup_error"
  | "database_insert_error"
  | "distribution_failed"
  | "artifact_identity_failed"
  | "artifact_validation_failed";

export type OccupancyBenchmarkBuilderResult = Readonly<{
  status: OccupancyBenchmarkBuilderStatus;
  marketCellKey: string;
  capturePeriodBucket: string;
  rawSampleSize: number;
  includedSampleSize: number;
  excludedOutlierCount: number;
  sourceClassCount: number;
  sourceDiversityBand: OccupancyBenchmarkSourceDiversityBand;
  confidenceLevel: OccupancyBenchmarkConfidenceLevel | null;
  approvalStatus: OccupancyBenchmarkApprovalStatus | null;
  limitations: OccupancyBenchmarkLimitationCode[];
  artifactKey: string | null;
  inserted: boolean;
  supersedesArtifactId: string | null;
  reasonCodes: OccupancyBenchmarkBuilderReasonCode[];
  distribution: OccupancyBenchmarkArtifact["distribution"] | null;
}>;

export type OccupancyAnonymousFactGroupSourceRow = Readonly<{
  country: unknown;
  city: unknown;
  platform: unknown;
  property_type: unknown;
  capacity_band: unknown;
  currency: unknown;
  market_cell_key: unknown;
  metric_family: unknown;
  observed_days_band: unknown;
  unavailability_rate_band: unknown;
  capture_period_bucket: unknown;
  source_class: unknown;
  source_quality_band: unknown;
  fact_contract_version: unknown;
  transformation_policy_version: unknown;
  eligibility_policy_version: unknown;
  deduplication_policy_version: unknown;
  market_cell_policy_version: unknown;
  confidence_policy_version: unknown;
  freshness_policy_version: unknown;
  normalized_nightly_price: unknown;
  price_band: unknown;
  pricing_normalization_policy_version: unknown;
}>;

export type OccupancyBenchmarkArtifactPayload = Readonly<{
  artifact_key: string;
  artifact_contract_version: string;
  benchmark_type: OccupancyBenchmarkArtifact["benchmarkType"];
  approval_status: OccupancyBenchmarkApprovalStatus;
  country: string;
  city: string;
  platform: OccupancyBenchmarkArtifact["platform"];
  property_type: OccupancyBenchmarkArtifact["propertyType"];
  capacity_band: OccupancyBenchmarkArtifact["capacityBand"];
  currency: OccupancyBenchmarkArtifact["currency"];
  market_cell_key: string;
  capture_period_bucket: string;
  source_period_start: string;
  source_period_end: string;
  cohort_definition_version: string;
  source_class_count: number;
  source_diversity_band: OccupancyBenchmarkSourceDiversityBand;
  p10_price: null;
  p25_price: null;
  median_price: null;
  p75_price: null;
  p90_price: null;
  observed_days_1_6_count: number;
  observed_days_7_13_count: number;
  observed_days_14_29_count: number;
  observed_days_30_59_count: number;
  observed_days_60_plus_count: number;
  unavailability_0_19_count: number;
  unavailability_20_39_count: number;
  unavailability_40_59_count: number;
  unavailability_60_79_count: number;
  unavailability_80_100_count: number;
  dominant_observed_days_band: IntelligenceV2ObservedDaysBand;
  dominant_unavailability_rate_band: IntelligenceV2UnavailabilityRateBand;
  raw_sample_size: number;
  included_sample_size: number;
  excluded_outlier_count: number;
  outlier_policy_version: string;
  confidence_level: OccupancyBenchmarkConfidenceLevel;
  confidence_policy_version: string;
  valid_from: string;
  valid_until: string;
  freshness_policy_version: string;
  approved_for_internal: boolean;
  approved_for_audit: boolean;
  limitations: OccupancyBenchmarkLimitationCode[];
  cohort_policy_version: string;
  aggregation_policy_version: string;
  approval_policy_version: string;
  market_cell_policy_version: string;
  supersedes_artifact_id: string | null;
}>;

export type OccupancyBenchmarkBuilderDependencies = Readonly<{
  env?: IntelligenceV2FeatureFlagEnv;
  now?: Date;
  loadFacts?: (
    input: OccupancyBenchmarkBuilderInput,
  ) => Promise<LoadFactsResult>;
  findArtifactByKey?: (
    artifactKey: string,
  ) => Promise<FindArtifactResult>;
  findActiveCompatibleArtifact?: (
    payload: OccupancyBenchmarkArtifactPayload,
  ) => Promise<FindArtifactResult>;
  insertArtifact?: (
    payload: OccupancyBenchmarkArtifactPayload,
  ) => Promise<boolean>;
}>;

function normalizeOneOf<T extends readonly string[]>(
  values: T,
  candidate: unknown,
): T[number] | null {
  const normalized = normalizeNonEmptyString(candidate);

  if (
    normalized == null ||
    !values.some((value) => value === normalized)
  ) {
    return null;
  }

  return normalized as T[number];
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredString(value: unknown): string | null {
  const normalized = normalizeNonEmptyString(value);
  if (normalized == null || normalized.toLowerCase() === "unknown") {
    return null;
  }
  return normalized;
}

function normalizeMonthBucket(value: unknown): string | null {
  const normalized = normalizeNonEmptyString(value);
  if (normalized == null || !MONTH_BUCKET_REGEX.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeLimitations(
  limitations: ReadonlyArray<OccupancyBenchmarkLimitationCode>,
): OccupancyBenchmarkLimitationCode[] {
  return [...new Set(limitations)].sort();
}

function uniqueSortedReasonCodes(
  reasonCodes: ReadonlyArray<OccupancyBenchmarkBuilderReasonCode>,
): OccupancyBenchmarkBuilderReasonCode[] {
  return [...new Set(reasonCodes)].sort();
}

function buildEmptyResult(
  input: Readonly<{
    status: OccupancyBenchmarkBuilderStatus;
    marketCellKey: string;
    capturePeriodBucket: string;
    reasonCodes: ReadonlyArray<OccupancyBenchmarkBuilderReasonCode>;
    rawSampleSize?: number;
    includedSampleSize?: number;
    excludedOutlierCount?: number;
    sourceClassCount?: number;
    sourceDiversityBand?: OccupancyBenchmarkSourceDiversityBand;
    confidenceLevel?: OccupancyBenchmarkConfidenceLevel | null;
    approvalStatus?: OccupancyBenchmarkApprovalStatus | null;
    limitations?: ReadonlyArray<OccupancyBenchmarkLimitationCode>;
    artifactKey?: string | null;
    inserted?: boolean;
    supersedesArtifactId?: string | null;
    distribution?: OccupancyBenchmarkArtifact["distribution"] | null;
  }>,
): OccupancyBenchmarkBuilderResult {
  return {
    status: input.status,
    marketCellKey: input.marketCellKey,
    capturePeriodBucket: input.capturePeriodBucket,
    rawSampleSize: input.rawSampleSize ?? 0,
    includedSampleSize: input.includedSampleSize ?? 0,
    excludedOutlierCount: input.excludedOutlierCount ?? 0,
    sourceClassCount: input.sourceClassCount ?? 0,
    sourceDiversityBand: input.sourceDiversityBand ?? "unknown",
    confidenceLevel: input.confidenceLevel ?? null,
    approvalStatus: input.approvalStatus ?? null,
    limitations: normalizeLimitations(input.limitations ?? []),
    artifactKey: input.artifactKey ?? null,
    inserted: input.inserted ?? false,
    supersedesArtifactId: input.supersedesArtifactId ?? null,
    reasonCodes: uniqueSortedReasonCodes([...input.reasonCodes]),
    distribution: input.distribution ?? null,
  };
}

function isPreviewReasonCode(
  value: string,
): value is (typeof PREVIEW_REASON_CODE_VALUES)[number] {
  return PREVIEW_REASON_CODE_VALUES.some(
    (candidate) => candidate === value,
  );
}

function normalizePreviewReasonCodes(
  reasonCodes: ReadonlyArray<string>,
): OccupancyBenchmarkBuilderReasonCode[] {
  const normalized = reasonCodes.filter(isPreviewReasonCode);
  if (normalized.length === 0) {
    return ["invalid_input"];
  }
  return uniqueSortedReasonCodes(normalized);
}

function logOccupancyBuilderSummary(
  env: IntelligenceV2FeatureFlagEnv,
  result: OccupancyBenchmarkBuilderResult,
): void {
  if (
    env[DEBUG_INTELLIGENCE_V2]?.trim().toLowerCase() !== "true"
  ) {
    return;
  }

  console.info(
    "[intelligence-v2][occupancy-benchmark-builder]",
    JSON.stringify(result),
  );
}

function mapExistingArtifactRow(
  row: unknown,
): OccupancyExistingArtifactRow | null {
  if (row == null || typeof row !== "object") {
    return null;
  }

  const candidate = row as Readonly<{
    id?: unknown;
    artifact_key?: unknown;
    created_at?: unknown;
  }>;

  const id = normalizeNonEmptyString(candidate.id);
  const createdAt = normalizeNonEmptyString(
    candidate.created_at,
  );
  const artifactKey =
    candidate.artifact_key === null
      ? null
      : normalizeNonEmptyString(candidate.artifact_key);

  if (
    id == null ||
    createdAt == null ||
    candidate.artifact_key === undefined ||
    (candidate.artifact_key !== null &&
      artifactKey == null)
  ) {
    return null;
  }

  return Object.freeze({
    id,
    artifactKey,
    createdAt,
  });
}

async function defaultLoadFacts(
  admin: OccupancyBenchmarkAdminClient,
  input: OccupancyBenchmarkBuilderInput,
): Promise<LoadFactsResult> {
  const { data, error } = await admin
    .from("anonymous_fact_groups")
    .select(
      [
        "country",
        "city",
        "platform",
        "property_type",
        "capacity_band",
        "currency",
        "market_cell_key",
        "metric_family",
        "observed_days_band",
        "unavailability_rate_band",
        "capture_period_bucket",
        "source_class",
        "source_quality_band",
        "fact_contract_version",
        "transformation_policy_version",
        "eligibility_policy_version",
        "deduplication_policy_version",
        "market_cell_policy_version",
        "confidence_policy_version",
        "freshness_policy_version",
        "normalized_nightly_price",
        "price_band",
        "pricing_normalization_policy_version",
      ].join(","),
    )
    .eq("metric_family", "occupancy")
    .eq("market_cell_key", input.marketCellKey)
    .eq(
      "capture_period_bucket",
      input.capturePeriodBucket,
    );

  if (error || !Array.isArray(data)) {
    return { ok: false };
  }

  return {
    ok: true,
    rows:
      data as unknown as ReadonlyArray<OccupancyAnonymousFactGroupSourceRow>,
  };
}

async function defaultFindArtifactByKey(
  admin: OccupancyBenchmarkAdminClient,
  artifactKey: string,
): Promise<FindArtifactResult> {
  const { data, error } = await admin
    .from("benchmark_artifacts")
    .select("id,artifact_key,created_at")
    .eq("artifact_key", artifactKey)
    .limit(1);

  if (error || !Array.isArray(data)) {
    return { ok: false };
  }

  const firstRow = data[0];
  if (firstRow == null) {
    return { ok: true, row: null };
  }

  const mappedRow = mapExistingArtifactRow(firstRow);
  if (mappedRow == null) {
    return { ok: false };
  }

  return { ok: true, row: mappedRow };
}

async function defaultFindActiveCompatibleArtifact(
  admin: OccupancyBenchmarkAdminClient,
  payload: OccupancyBenchmarkArtifactPayload,
): Promise<FindArtifactResult> {
  const { data, error } = await admin
    .from("benchmark_artifacts")
    .select(
      [
        "id",
        "artifact_key",
        "created_at",
      ].join(","),
    )
    .eq("benchmark_type", payload.benchmark_type)
    .eq("market_cell_key", payload.market_cell_key)
    .eq(
      "capture_period_bucket",
      payload.capture_period_bucket,
    )
    .eq(
      "artifact_contract_version",
      payload.artifact_contract_version,
    )
    .eq(
      "cohort_definition_version",
      payload.cohort_definition_version,
    )
    .eq(
      "cohort_policy_version",
      payload.cohort_policy_version,
    )
    .eq(
      "aggregation_policy_version",
      payload.aggregation_policy_version,
    )
    .eq(
      "outlier_policy_version",
      payload.outlier_policy_version,
    )
    .eq(
      "confidence_policy_version",
      payload.confidence_policy_version,
    )
    .eq(
      "freshness_policy_version",
      payload.freshness_policy_version,
    )
    .eq(
      "approval_policy_version",
      payload.approval_policy_version,
    )
    .eq(
      "market_cell_policy_version",
      payload.market_cell_policy_version,
    )
    .neq("approval_status", "revoked")
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    return { ok: false };
  }

  const candidates: OccupancyExistingArtifactRow[] = [];
  for (const row of data) {
    const candidate = mapExistingArtifactRow(row);
    if (candidate == null) {
      return { ok: false };
    }
    candidates.push(candidate);
  }

  if (candidates.length === 0) {
    return { ok: true, row: null };
  }

  const candidateIds = candidates.map((row) => row.id);
  const { data: childData, error: childError } = await admin
    .from("benchmark_artifacts")
    .select("supersedes_artifact_id")
    .in("supersedes_artifact_id", candidateIds);

  if (childError || !Array.isArray(childData)) {
    return { ok: false };
  }

  const supersededIds = new Set(
    childData
      .map((row) => {
        if (
          row != null &&
          typeof row === "object" &&
          "supersedes_artifact_id" in row &&
          typeof row.supersedes_artifact_id === "string"
        ) {
          return row.supersedes_artifact_id;
        }

        return null;
      })
      .filter((value): value is string => value != null),
  );

  const activeRow =
    candidates.find((row) => !supersededIds.has(row.id)) ??
    candidates[0] ??
    null;

  return { ok: true, row: activeRow };
}

async function defaultInsertArtifact(
  admin: OccupancyBenchmarkAdminClient,
  payload: OccupancyBenchmarkArtifactPayload,
): Promise<boolean> {
  const { error } = await admin
    .from("benchmark_artifacts")
    .upsert(payload, {
      onConflict: "artifact_key",
      ignoreDuplicates: true,
    });

  return !error;
}

export function mapOccupancyFactRowToAnonymousFact(
  row: OccupancyAnonymousFactGroupSourceRow,
): AnonymousOccupancyFact | null {
  const country = normalizeRequiredString(row.country);
  const city = normalizeRequiredString(row.city);
  const platform = normalizeOneOf(
    PLATFORM_VALUES,
    row.platform,
  );
  const propertyType = normalizeOneOf(
    PROPERTY_TYPE_VALUES,
    row.property_type,
  );
  const capacityBand = normalizeOneOf(
    CAPACITY_BAND_VALUES,
    row.capacity_band,
  );
  const currency = normalizeNonEmptyString(row.currency);
  const marketCellKey = normalizeNonEmptyString(row.market_cell_key);
  const metricFamily = normalizeNonEmptyString(row.metric_family);
  const observedDaysBand = normalizeOneOf(
    OBSERVED_DAYS_BAND_VALUES,
    row.observed_days_band,
  );
  const unavailabilityRateBand = normalizeOneOf(
    UNAVAILABILITY_RATE_BAND_VALUES,
    row.unavailability_rate_band,
  );
  const capturePeriodBucket = normalizeMonthBucket(
    row.capture_period_bucket,
  );
  const sourceClass = normalizeOneOf(
    SOURCE_CLASS_VALUES,
    row.source_class,
  );
  const sourceQualityBand = normalizeOneOf(
    SOURCE_QUALITY_BAND_VALUES,
    row.source_quality_band,
  );
  const factContractVersion = normalizeNonEmptyString(
    row.fact_contract_version,
  );
  const transformationPolicyVersion = normalizeNonEmptyString(
    row.transformation_policy_version,
  );
  const eligibilityPolicyVersion = normalizeNonEmptyString(
    row.eligibility_policy_version,
  );
  const deduplicationPolicyVersion = normalizeNonEmptyString(
    row.deduplication_policy_version,
  );
  const marketCellPolicyVersion = normalizeNonEmptyString(
    row.market_cell_policy_version,
  );
  const hasValidAuxiliaryPolicyVersions =
    normalizeNonEmptyString(
      row.confidence_policy_version,
    ) != null &&
    normalizeNonEmptyString(
      row.freshness_policy_version,
    ) != null;

  if (
    country == null ||
    city == null ||
    platform == null ||
    propertyType == null ||
    capacityBand == null ||
    currency == null ||
    marketCellKey == null ||
    metricFamily == null ||
    observedDaysBand == null ||
    unavailabilityRateBand == null ||
    capturePeriodBucket == null ||
    sourceClass == null ||
    sourceQualityBand == null ||
    factContractVersion == null ||
    transformationPolicyVersion == null ||
    eligibilityPolicyVersion == null ||
    deduplicationPolicyVersion == null ||
    marketCellPolicyVersion == null ||
    !hasValidAuxiliaryPolicyVersions
  ) {
    return null;
  }

  if (
    metricFamily !== "occupancy" ||
    currency !== "UNKNOWN" ||
    row.normalized_nightly_price !== null ||
    row.price_band !== null ||
    row.pricing_normalization_policy_version !== null
  ) {
    return null;
  }

  const fact: AnonymousOccupancyFact = Object.freeze({
    factContractVersion,
    transformationPolicyVersion,
    eligibilityPolicyVersion,
    deduplicationPolicyVersion,
    marketCellPolicyVersion,
    marketCell: Object.freeze({
      country,
      city,
      platform,
      propertyType,
      capacityBand,
      currency: "unknown",
      marketCellKey,
    }),
    metricFamily: "occupancy",
    observedDaysBand,
    unavailabilityRateBand,
    capturePeriodBucket,
    sourceClass,
    eligibilityStatus: "eligible",
    duplicateStatus: "unchecked",
    sourceQualityBand,
  });

  return fact;
}

export function mapOccupancyArtifactToPayload(
  artifact: OccupancyBenchmarkArtifact,
): OccupancyBenchmarkArtifactPayload {
  return Object.freeze({
    artifact_key: artifact.artifactKey,
    artifact_contract_version:
      artifact.artifactContractVersion,
    benchmark_type: artifact.benchmarkType,
    approval_status: artifact.approvalStatus,
    country: artifact.country,
    city: artifact.city,
    platform: artifact.platform,
    property_type: artifact.propertyType,
    capacity_band: artifact.capacityBand,
    currency: artifact.currency,
    market_cell_key: artifact.marketCellKey,
    capture_period_bucket: artifact.capturePeriodBucket,
    source_period_start: artifact.sourcePeriodStart,
    source_period_end: artifact.sourcePeriodEnd,
    cohort_definition_version:
      artifact.cohortDefinitionVersion,
    source_class_count: artifact.sourceClassCount,
    source_diversity_band:
      artifact.sourceDiversityBand,
    p10_price: null,
    p25_price: null,
    median_price: null,
    p75_price: null,
    p90_price: null,
    observed_days_1_6_count:
      artifact.distribution.observedDaysCounts["1_6"],
    observed_days_7_13_count:
      artifact.distribution.observedDaysCounts["7_13"],
    observed_days_14_29_count:
      artifact.distribution.observedDaysCounts["14_29"],
    observed_days_30_59_count:
      artifact.distribution.observedDaysCounts["30_59"],
    observed_days_60_plus_count:
      artifact.distribution.observedDaysCounts["60_plus"],
    unavailability_0_19_count:
      artifact.distribution.unavailabilityRateCounts["0_19"],
    unavailability_20_39_count:
      artifact.distribution.unavailabilityRateCounts["20_39"],
    unavailability_40_59_count:
      artifact.distribution.unavailabilityRateCounts["40_59"],
    unavailability_60_79_count:
      artifact.distribution.unavailabilityRateCounts["60_79"],
    unavailability_80_100_count:
      artifact.distribution.unavailabilityRateCounts["80_100"],
    dominant_observed_days_band:
      artifact.distribution.dominantObservedDaysBand,
    dominant_unavailability_rate_band:
      artifact.distribution
        .dominantUnavailabilityRateBand,
    raw_sample_size: artifact.rawSampleSize,
    included_sample_size: artifact.includedSampleSize,
    excluded_outlier_count:
      artifact.excludedOutlierCount,
    outlier_policy_version:
      artifact.outlierPolicyVersion,
    confidence_level: artifact.confidenceLevel,
    confidence_policy_version:
      artifact.confidencePolicyVersion,
    valid_from: artifact.validFrom,
    valid_until: artifact.validUntil,
    freshness_policy_version:
      artifact.freshnessPolicyVersion,
    approved_for_internal:
      artifact.approvedForInternal,
    approved_for_audit: artifact.approvedForAudit,
    limitations: normalizeLimitations(
      artifact.limitations,
    ),
    cohort_policy_version:
      artifact.cohortPolicyVersion,
    aggregation_policy_version:
      artifact.aggregationPolicyVersion,
    approval_policy_version:
      artifact.approvalPolicyVersion,
    market_cell_policy_version:
      artifact.marketCellPolicyVersion,
    supersedes_artifact_id:
      artifact.supersedesArtifactId,
  });
}

export async function buildOccupancyDistributionBenchmark(
  input: OccupancyBenchmarkBuilderInput,
  dependencies: OccupancyBenchmarkBuilderDependencies = {},
): Promise<OccupancyBenchmarkBuilderResult> {
  const env = dependencies.env ?? process.env;
  const normalizedMarketCellKey =
    normalizeNonEmptyString(input.marketCellKey);
  const normalizedCapturePeriodBucket =
    normalizeMonthBucket(input.capturePeriodBucket);

  if (
    normalizedMarketCellKey == null ||
    normalizedCapturePeriodBucket == null
  ) {
    const result = buildEmptyResult({
      status: "failed",
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      reasonCodes: ["invalid_input"],
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  const flags = getIntelligenceV2FeatureFlags(env);
  if (!flags.ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION) {
    const result = buildEmptyResult({
      status: "disabled",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      reasonCodes: ["flag_disabled"],
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  const dryRun = input.dryRun ?? true;

  const normalizedInput: OccupancyBenchmarkBuilderInput = {
    marketCellKey: normalizedMarketCellKey,
    capturePeriodBucket: normalizedCapturePeriodBucket,
    dryRun,
    force: input.force,
  };
  let admin: OccupancyBenchmarkAdminClient | null = null;
  const getAdmin = (): OccupancyBenchmarkAdminClient => {
    admin ??= createSupabaseAdminClient();
    return admin;
  };
  const loadFacts =
    dependencies.loadFacts ??
    ((builderInput: OccupancyBenchmarkBuilderInput) =>
      defaultLoadFacts(getAdmin(), builderInput));
  const findArtifactByKey =
    dependencies.findArtifactByKey ??
    ((artifactKey: string) =>
      defaultFindArtifactByKey(getAdmin(), artifactKey));
  const findActiveCompatibleArtifact =
    dependencies.findActiveCompatibleArtifact ??
    ((payload: OccupancyBenchmarkArtifactPayload) =>
      defaultFindActiveCompatibleArtifact(
        getAdmin(),
        payload,
      ));
  const insertArtifact =
    dependencies.insertArtifact ??
    ((payload: OccupancyBenchmarkArtifactPayload) =>
      defaultInsertArtifact(getAdmin(), payload));

  let loadResult: LoadFactsResult;
  try {
    loadResult = await loadFacts(normalizedInput);
  } catch {
    const result = buildEmptyResult({
      status: "failed",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      reasonCodes: ["database_read_error"],
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  if (!loadResult.ok) {
    const result = buildEmptyResult({
      status: "failed",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      reasonCodes: ["database_read_error"],
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  if (loadResult.rows.length === 0) {
    const result = buildEmptyResult({
      status: "failed",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      reasonCodes: ["no_facts_found"],
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  const facts: AnonymousOccupancyFact[] = [];
  let hasInvalidFactRow = false;

  for (const row of loadResult.rows) {
    const fact = mapOccupancyFactRowToAnonymousFact(row);
    if (fact == null) {
      hasInvalidFactRow = true;
      continue;
    }
    facts.push(fact);
  }

  if (hasInvalidFactRow) {
    const result = buildEmptyResult({
      status: "failed",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      rawSampleSize: loadResult.rows.length,
      includedSampleSize: facts.length,
      reasonCodes: ["invalid_fact_row"],
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  const preview = buildOccupancyBenchmarkPreview({
    marketCellKey: normalizedMarketCellKey,
    capturePeriodBucket: normalizedCapturePeriodBucket,
    facts,
  });

  if (!preview.ok) {
    const result = buildEmptyResult({
      status: "failed",
      marketCellKey: preview.marketCellKey,
      capturePeriodBucket: preview.capturePeriodBucket,
      rawSampleSize: preview.rawSampleSize,
      includedSampleSize: preview.includedSampleSize,
      reasonCodes: normalizePreviewReasonCodes(
        preview.reasonCodes,
      ),
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  const previewPayload = mapOccupancyArtifactToPayload(
    preview.artifact,
  );

  let existingByKeyResult: FindArtifactResult;
  try {
    existingByKeyResult = await findArtifactByKey(
      preview.artifact.artifactKey,
    );
  } catch {
    const result = buildEmptyResult({
      status: "failed",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      rawSampleSize: preview.artifact.rawSampleSize,
      includedSampleSize: preview.artifact.includedSampleSize,
      excludedOutlierCount: preview.artifact.excludedOutlierCount,
      sourceClassCount: preview.artifact.sourceClassCount,
      sourceDiversityBand:
        preview.artifact.sourceDiversityBand,
      confidenceLevel: preview.artifact.confidenceLevel,
      approvalStatus: preview.artifact.approvalStatus,
      limitations: preview.artifact.limitations,
      artifactKey: preview.artifact.artifactKey,
      reasonCodes: ["database_read_error"],
      distribution: preview.artifact.distribution,
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  if (!existingByKeyResult.ok) {
    const result = buildEmptyResult({
      status: "failed",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      rawSampleSize: preview.artifact.rawSampleSize,
      includedSampleSize: preview.artifact.includedSampleSize,
      excludedOutlierCount: preview.artifact.excludedOutlierCount,
      sourceClassCount: preview.artifact.sourceClassCount,
      sourceDiversityBand:
        preview.artifact.sourceDiversityBand,
      confidenceLevel: preview.artifact.confidenceLevel,
      approvalStatus: preview.artifact.approvalStatus,
      limitations: preview.artifact.limitations,
      artifactKey: preview.artifact.artifactKey,
      reasonCodes: ["database_read_error"],
      distribution: preview.artifact.distribution,
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  let activeCompatibleResult: FindArtifactResult;
  try {
    activeCompatibleResult =
      await findActiveCompatibleArtifact(previewPayload);
  } catch {
    const result = buildEmptyResult({
      status: "failed",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      rawSampleSize: preview.artifact.rawSampleSize,
      includedSampleSize: preview.artifact.includedSampleSize,
      excludedOutlierCount: preview.artifact.excludedOutlierCount,
      sourceClassCount: preview.artifact.sourceClassCount,
      sourceDiversityBand:
        preview.artifact.sourceDiversityBand,
      confidenceLevel: preview.artifact.confidenceLevel,
      approvalStatus: preview.artifact.approvalStatus,
      limitations: preview.artifact.limitations,
      artifactKey: preview.artifact.artifactKey,
      reasonCodes: ["supersession_lookup_error"],
      distribution: preview.artifact.distribution,
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  if (!activeCompatibleResult.ok) {
    const result = buildEmptyResult({
      status: "failed",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      rawSampleSize: preview.artifact.rawSampleSize,
      includedSampleSize: preview.artifact.includedSampleSize,
      excludedOutlierCount: preview.artifact.excludedOutlierCount,
      sourceClassCount: preview.artifact.sourceClassCount,
      sourceDiversityBand:
        preview.artifact.sourceDiversityBand,
      confidenceLevel: preview.artifact.confidenceLevel,
      approvalStatus: preview.artifact.approvalStatus,
      limitations: preview.artifact.limitations,
      artifactKey: preview.artifact.artifactKey,
      reasonCodes: ["supersession_lookup_error"],
      distribution: preview.artifact.distribution,
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  if (dryRun) {
    const supersedesArtifactId =
      existingByKeyResult.row != null
        ? existingByKeyResult.row.id
        : activeCompatibleResult.row == null ||
            activeCompatibleResult.row.artifactKey ===
              preview.artifact.artifactKey
          ? null
          : activeCompatibleResult.row.id;

    const result = buildEmptyResult({
      status: "dry_run",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      rawSampleSize: preview.artifact.rawSampleSize,
      includedSampleSize: preview.artifact.includedSampleSize,
      excludedOutlierCount: preview.artifact.excludedOutlierCount,
      sourceClassCount: preview.artifact.sourceClassCount,
      sourceDiversityBand:
        preview.artifact.sourceDiversityBand,
      confidenceLevel: preview.artifact.confidenceLevel,
      approvalStatus: preview.artifact.approvalStatus,
      limitations: preview.artifact.limitations,
      artifactKey: preview.artifact.artifactKey,
      inserted: false,
      supersedesArtifactId,
      reasonCodes:
        existingByKeyResult.row != null
          ? ["artifact_already_exists"]
          : [],
      distribution: preview.artifact.distribution,
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  if (preview.artifact.approvalStatus === "insufficient") {
    const result = buildEmptyResult({
      status: "insufficient",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      rawSampleSize: preview.artifact.rawSampleSize,
      includedSampleSize: preview.artifact.includedSampleSize,
      excludedOutlierCount: preview.artifact.excludedOutlierCount,
      sourceClassCount: preview.artifact.sourceClassCount,
      sourceDiversityBand:
        preview.artifact.sourceDiversityBand,
      confidenceLevel: preview.artifact.confidenceLevel,
      approvalStatus: preview.artifact.approvalStatus,
      limitations: preview.artifact.limitations,
      artifactKey: preview.artifact.artifactKey,
      inserted: false,
      supersedesArtifactId: null,
      reasonCodes: [],
      distribution: preview.artifact.distribution,
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  if (existingByKeyResult.row != null) {
    const result = buildEmptyResult({
      status: "already_exists",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      rawSampleSize: preview.artifact.rawSampleSize,
      includedSampleSize: preview.artifact.includedSampleSize,
      excludedOutlierCount: preview.artifact.excludedOutlierCount,
      sourceClassCount: preview.artifact.sourceClassCount,
      sourceDiversityBand:
        preview.artifact.sourceDiversityBand,
      confidenceLevel: preview.artifact.confidenceLevel,
      approvalStatus: preview.artifact.approvalStatus,
      limitations: preview.artifact.limitations,
      artifactKey: preview.artifact.artifactKey,
      inserted: false,
      supersedesArtifactId: existingByKeyResult.row.id,
      reasonCodes: ["artifact_already_exists"],
      distribution: preview.artifact.distribution,
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  const payload: OccupancyBenchmarkArtifactPayload = {
    ...previewPayload,
    supersedes_artifact_id:
      activeCompatibleResult.row?.artifactKey ===
      preview.artifact.artifactKey
        ? null
        : activeCompatibleResult.row?.id ?? null,
  };

  const inserted = await insertArtifact(payload);
  if (!inserted) {
    const result = buildEmptyResult({
      status: "failed",
      marketCellKey: normalizedMarketCellKey,
      capturePeriodBucket: normalizedCapturePeriodBucket,
      rawSampleSize: preview.artifact.rawSampleSize,
      includedSampleSize: preview.artifact.includedSampleSize,
      excludedOutlierCount: preview.artifact.excludedOutlierCount,
      sourceClassCount: preview.artifact.sourceClassCount,
      sourceDiversityBand:
        preview.artifact.sourceDiversityBand,
      confidenceLevel: preview.artifact.confidenceLevel,
      approvalStatus: preview.artifact.approvalStatus,
      limitations: preview.artifact.limitations,
      artifactKey: preview.artifact.artifactKey,
      inserted: false,
      supersedesArtifactId: payload.supersedes_artifact_id,
      reasonCodes: ["database_insert_error"],
      distribution: preview.artifact.distribution,
    });
    logOccupancyBuilderSummary(env, result);
    return result;
  }

  const result = buildEmptyResult({
    status: "inserted",
    marketCellKey: normalizedMarketCellKey,
    capturePeriodBucket: normalizedCapturePeriodBucket,
    rawSampleSize: preview.artifact.rawSampleSize,
    includedSampleSize: preview.artifact.includedSampleSize,
    excludedOutlierCount: preview.artifact.excludedOutlierCount,
    sourceClassCount: preview.artifact.sourceClassCount,
    sourceDiversityBand:
      preview.artifact.sourceDiversityBand,
    confidenceLevel: preview.artifact.confidenceLevel,
    approvalStatus: preview.artifact.approvalStatus,
    limitations: preview.artifact.limitations,
    artifactKey: preview.artifact.artifactKey,
    inserted: true,
    supersedesArtifactId: payload.supersedes_artifact_id,
    reasonCodes: [],
    distribution: preview.artifact.distribution,
  });
  logOccupancyBuilderSummary(env, result);
  return result;
}
