import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateSharedIntelligencePrivacy } from "./privacyValidator";
import {
  DEBUG_INTELLIGENCE_V2,
  getIntelligenceV2FeatureFlags,
  type IntelligenceV2FeatureFlagEnv,
} from "./featureFlags";
import { buildMarketCellKey } from "./marketCell";
import {
  buildBenchmarkArtifactKey,
  type BenchmarkArtifactIdentityInput,
} from "./benchmarkArtifactIdentity";
import {
  INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
  INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
  INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
  INTELLIGENCE_V2_COHORT_DEFINITION_VERSION,
  INTELLIGENCE_V2_COHORT_POLICY_VERSION,
  INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
  INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
  INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
} from "./policyVersions";

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
const SOURCE_CLASS_VALUES = [
  "authenticated_audit",
  "authenticated_listing",
] as const;
const SOURCE_DIVERSITY_VALUES = ["unknown", "low", "moderate"] as const;
const CONFIDENCE_LEVEL_VALUES = [
  "very_low",
  "low",
  "moderate",
  "high",
  "very_high",
] as const;
const APPROVAL_STATUS_VALUES = [
  "insufficient",
  "exploratory",
  "internal_approved",
  "audit_approved",
] as const;
const SOURCE_QUALITY_VALUES = ["unknown", "low", "moderate", "high"] as const;
const FRESHNESS_INPUT_VALUES = [
  "unknown",
  "fresh",
  "recent",
  "aging",
  "stale",
] as const;
const CONFIDENCE_INPUT_VALUES = ["unknown", "low", "moderate", "high"] as const;
const LIMITATION_CODE_VALUES = [
  "small_sample",
  "low_source_diversity",
  "unknown_property_type",
  "unknown_capacity",
  "aging_data",
] as const;

export const PRICING_BENCHMARK_TYPE = "pricing_distribution";

type PricingBenchmarkPlatform = (typeof PLATFORM_VALUES)[number];
type PricingBenchmarkPropertyType = (typeof PROPERTY_TYPE_VALUES)[number];
type PricingBenchmarkCapacityBand = (typeof CAPACITY_BAND_VALUES)[number];
type PricingBenchmarkSourceClass = (typeof SOURCE_CLASS_VALUES)[number];
type PricingBenchmarkSourceDiversityBand = (typeof SOURCE_DIVERSITY_VALUES)[number];
export type PricingBenchmarkConfidenceLevel =
  (typeof CONFIDENCE_LEVEL_VALUES)[number];
export type PricingBenchmarkApprovalStatus =
  (typeof APPROVAL_STATUS_VALUES)[number];
export type PricingBenchmarkLimitationCode =
  (typeof LIMITATION_CODE_VALUES)[number];
export type PricingBenchmarkBuilderStatus =
  | "disabled"
  | "dry_run"
  | "inserted"
  | "already_exists"
  | "insufficient"
  | "failed";
export type PricingBenchmarkBuilderReasonCode =
  | "flag_disabled"
  | "invalid_input"
  | "no_facts_found"
  | "market_cell_mismatch"
  | "incompatible_policy_versions"
  | "invalid_fact_row"
  | "empty_after_validation"
  | "database_read_error"
  | "artifact_already_exists"
  | "supersession_lookup_error"
  | "database_insert_error";

type SourceQualityBand = (typeof SOURCE_QUALITY_VALUES)[number];
type FreshnessInputBand = (typeof FRESHNESS_INPUT_VALUES)[number];
type ConfidenceInputBand = (typeof CONFIDENCE_INPUT_VALUES)[number];

export type PricingBenchmarkBuilderInput = Readonly<{
  marketCellKey: string;
  capturePeriodBucket: string;
  dryRun?: boolean;
  force?: boolean;
}>;

export type PricingBenchmarkDistribution = Readonly<{
  p10Price: number;
  p25Price: number;
  medianPrice: number;
  p75Price: number;
  p90Price: number;
}>;

export type PricingBenchmarkBuilderResult = Readonly<{
  status: PricingBenchmarkBuilderStatus;
  marketCellKey: string;
  capturePeriodBucket: string;
  rawSampleSize: number;
  includedSampleSize: number;
  excludedOutlierCount: number;
  sourceClassCount: number;
  sourceDiversityBand: PricingBenchmarkSourceDiversityBand;
  confidenceLevel: PricingBenchmarkConfidenceLevel | null;
  approvalStatus: PricingBenchmarkApprovalStatus | null;
  limitations: PricingBenchmarkLimitationCode[];
  artifactKey: string | null;
  inserted: boolean;
  supersedesArtifactId: string | null;
  reasonCodes: PricingBenchmarkBuilderReasonCode[];
  p10Price: number | null;
  p25Price: number | null;
  medianPrice: number | null;
  p75Price: number | null;
  p90Price: number | null;
}>;

export type PricingBenchmarkBuilderDependencies = Readonly<{
  env?: IntelligenceV2FeatureFlagEnv;
  admin?: ReturnType<typeof createSupabaseAdminClient>;
  now?: Date;
}>;

type AnonymousFactGroupSourceRow = Readonly<{
  country: string;
  city: string;
  platform: string;
  property_type: string;
  capacity_band: string;
  currency: string;
  market_cell_key: string;
  normalized_nightly_price: number;
  source_class: string;
  fact_contract_version: string;
  transformation_policy_version: string;
  eligibility_policy_version: string;
  deduplication_policy_version: string;
  market_cell_policy_version: string;
  pricing_normalization_policy_version: string;
  confidence_policy_version: string;
  freshness_policy_version: string;
  source_quality_band: string;
  freshness_input_band: string;
  confidence_input_band: string;
}>;

type ValidSourceRow = Readonly<{
  country: string;
  city: string;
  platform: PricingBenchmarkPlatform;
  propertyType: PricingBenchmarkPropertyType;
  capacityBand: PricingBenchmarkCapacityBand;
  currency: string;
  marketCellKey: string;
  normalizedNightlyPrice: number;
  sourceClass: PricingBenchmarkSourceClass;
  factContractVersion: string;
  transformationPolicyVersion: string;
  eligibilityPolicyVersion: string;
  deduplicationPolicyVersion: string;
  marketCellPolicyVersion: string;
  pricingNormalizationPolicyVersion: string;
  confidencePolicyVersion: string;
  freshnessPolicyVersion: string;
  sourceQualityBand: SourceQualityBand;
  freshnessInputBand: FreshnessInputBand;
  confidenceInputBand: ConfidenceInputBand;
}>;

type BenchmarkPolicyFamily = Readonly<{
  factContractVersion: string;
  transformationPolicyVersion: string;
  eligibilityPolicyVersion: string;
  deduplicationPolicyVersion: string;
  marketCellPolicyVersion: string;
  pricingNormalizationPolicyVersion: string;
  confidencePolicyVersion: string;
  freshnessPolicyVersion: string;
}>;

export type PricingBenchmarkArtifactPayload = Readonly<{
  artifact_key: string;
  artifact_contract_version: string;
  benchmark_type: typeof PRICING_BENCHMARK_TYPE;
  approval_status: PricingBenchmarkApprovalStatus;
  country: string;
  city: string;
  platform: PricingBenchmarkPlatform;
  property_type: PricingBenchmarkPropertyType;
  capacity_band: PricingBenchmarkCapacityBand;
  currency: string;
  market_cell_key: string;
  capture_period_bucket: string;
  source_period_start: string;
  source_period_end: string;
  cohort_definition_version: string;
  source_class_count: number;
  source_diversity_band: PricingBenchmarkSourceDiversityBand;
  p10_price: number;
  p25_price: number;
  median_price: number;
  p75_price: number;
  p90_price: number;
  raw_sample_size: number;
  included_sample_size: number;
  excluded_outlier_count: number;
  outlier_policy_version: string;
  confidence_level: PricingBenchmarkConfidenceLevel;
  confidence_policy_version: string;
  valid_from: string;
  valid_until: string;
  freshness_policy_version: string;
  approved_for_internal: boolean;
  approved_for_audit: boolean;
  limitations: PricingBenchmarkLimitationCode[];
  cohort_policy_version: string;
  aggregation_policy_version: string;
  approval_policy_version: string;
  market_cell_policy_version: string;
  supersedes_artifact_id: string | null;
}>;

export type PricingBenchmarkPreviewResult =
  | Readonly<{
      ok: true;
      payload: PricingBenchmarkArtifactPayload;
      policyFamily: BenchmarkPolicyFamily;
      rawSampleSize: number;
      includedSampleSize: number;
      excludedOutlierCount: number;
      sourceClassCount: number;
      sourceDiversityBand: PricingBenchmarkSourceDiversityBand;
      confidenceLevel: PricingBenchmarkConfidenceLevel;
      approvalStatus: PricingBenchmarkApprovalStatus;
      limitations: PricingBenchmarkLimitationCode[];
      artifactKey: string;
      reasonCodes: PricingBenchmarkBuilderReasonCode[];
      distribution: PricingBenchmarkDistribution;
    }>
  | Readonly<{
      ok: false;
      marketCellKey: string;
      capturePeriodBucket: string;
      rawSampleSize: number;
      includedSampleSize: number;
      excludedOutlierCount: number;
      sourceClassCount: number;
      sourceDiversityBand: PricingBenchmarkSourceDiversityBand;
      confidenceLevel: PricingBenchmarkConfidenceLevel | null;
      approvalStatus: PricingBenchmarkApprovalStatus | null;
      limitations: PricingBenchmarkLimitationCode[];
      artifactKey: string | null;
      reasonCodes: PricingBenchmarkBuilderReasonCode[];
      distribution: PricingBenchmarkDistribution | null;
    }>;

type ExistingArtifactRow = Readonly<{
  id: string;
  artifact_key: string | null;
  created_at: string;
}>;

function isOneOf<T extends readonly string[]>(
  values: T,
  candidate: string,
): candidate is T[number] {
  return (values as readonly string[]).includes(candidate);
}

function normalizeRequiredString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isMonthBucket(value: string): boolean {
  return MONTH_BUCKET_REGEX.test(value);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function previousOrSameConfidenceLevel(
  value: PricingBenchmarkConfidenceLevel,
): PricingBenchmarkConfidenceLevel {
  const levels: PricingBenchmarkConfidenceLevel[] = [
    "very_low",
    "low",
    "moderate",
    "high",
    "very_high",
  ];
  const index = levels.indexOf(value);
  if (index <= 0) return "very_low";
  return levels[index - 1] ?? "very_low";
}

function buildReasonCodes(
  codes: Iterable<PricingBenchmarkBuilderReasonCode>,
): PricingBenchmarkBuilderReasonCode[] {
  return [...new Set(codes)].sort();
}

function buildDistributionResult(
  distribution: PricingBenchmarkDistribution | null,
): Pick<
  PricingBenchmarkBuilderResult,
  "p10Price" | "p25Price" | "medianPrice" | "p75Price" | "p90Price"
> {
  return {
    p10Price: distribution?.p10Price ?? null,
    p25Price: distribution?.p25Price ?? null,
    medianPrice: distribution?.medianPrice ?? null,
    p75Price: distribution?.p75Price ?? null,
    p90Price: distribution?.p90Price ?? null,
  };
}

function buildResult(
  result: PricingBenchmarkBuilderResult,
): PricingBenchmarkBuilderResult {
  return {
    ...result,
    limitations: [...result.limitations].sort(),
    reasonCodes: buildReasonCodes(result.reasonCodes),
  };
}

export function getPricingBenchmarkPeriodBounds(capturePeriodBucket: string): Readonly<{
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  validFrom: string;
  validUntil: string;
}> | null {
  if (!isMonthBucket(capturePeriodBucket)) {
    return null;
  }

  const [yearText, monthText] = capturePeriodBucket.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }

  const sourcePeriodStart = new Date(Date.UTC(year, month - 1, 1));
  const sourcePeriodEnd = new Date(Date.UTC(year, month, 0));
  const validFrom = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const validUntil = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return Object.freeze({
    sourcePeriodStart: sourcePeriodStart.toISOString().slice(0, 10),
    sourcePeriodEnd: sourcePeriodEnd.toISOString().slice(0, 10),
    validFrom: validFrom.toISOString(),
    validUntil: validUntil.toISOString(),
  });
}

export function computeContinuousPercentile(
  values: ReadonlyArray<number>,
  percentile: number,
): number | null {
  if (values.length === 0 || !Number.isFinite(percentile)) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lowerValue = sorted[lowerIndex];
  const upperValue = sorted[upperIndex];

  if (
    lowerValue == null ||
    upperValue == null ||
    !Number.isFinite(lowerValue) ||
    !Number.isFinite(upperValue)
  ) {
    return null;
  }

  if (lowerIndex === upperIndex) {
    return lowerValue;
  }

  const weight = index - lowerIndex;
  return lowerValue + (upperValue - lowerValue) * weight;
}

export function computePricingDistribution(
  values: ReadonlyArray<number>,
): PricingBenchmarkDistribution | null {
  if (values.length === 0) {
    return null;
  }

  const rawP10 = computeContinuousPercentile(values, 0.1);
  const rawP25 = computeContinuousPercentile(values, 0.25);
  const rawMedian = computeContinuousPercentile(values, 0.5);
  const rawP75 = computeContinuousPercentile(values, 0.75);
  const rawP90 = computeContinuousPercentile(values, 0.9);

  if (
    rawP10 == null ||
    rawP25 == null ||
    rawMedian == null ||
    rawP75 == null ||
    rawP90 == null
  ) {
    return null;
  }

  const p10Price = roundCurrency(rawP10);
  const p25Price = Math.max(p10Price, roundCurrency(rawP25));
  const medianPrice = Math.max(p25Price, roundCurrency(rawMedian));
  const p75Price = Math.max(medianPrice, roundCurrency(rawP75));
  const p90Price = Math.max(p75Price, roundCurrency(rawP90));

  return Object.freeze({
    p10Price,
    p25Price,
    medianPrice,
    p75Price,
    p90Price,
  });
}

export function deriveSourceDiversityBand(
  sourceClassCount: number,
): PricingBenchmarkSourceDiversityBand {
  if (!Number.isInteger(sourceClassCount) || sourceClassCount <= 0) {
    return "unknown";
  }
  if (sourceClassCount === 1) {
    return "low";
  }
  return "moderate";
}

export function derivePricingBenchmarkConfidenceLevel(input: Readonly<{
  includedSampleSize: number;
  sourceClassCount: number;
  propertyType: PricingBenchmarkPropertyType;
  capacityBand: PricingBenchmarkCapacityBand;
}>): PricingBenchmarkConfidenceLevel {
  let level: PricingBenchmarkConfidenceLevel;
  if (input.includedSampleSize < 5) {
    level = "very_low";
  } else if (input.includedSampleSize < 10) {
    level = "low";
  } else if (input.includedSampleSize < 20) {
    level = "moderate";
  } else if (input.includedSampleSize < 40) {
    level = "high";
  } else {
    level = "very_high";
  }

  if (input.sourceClassCount < 2) {
    level = previousOrSameConfidenceLevel(level);
  }
  if (input.propertyType === "unknown") {
    level = previousOrSameConfidenceLevel(level);
  }
  if (input.capacityBand === "unknown") {
    level = previousOrSameConfidenceLevel(level);
  }

  return level;
}

export function buildPricingBenchmarkLimitations(input: Readonly<{
  includedSampleSize: number;
  sourceClassCount: number;
  propertyType: PricingBenchmarkPropertyType;
  capacityBand: PricingBenchmarkCapacityBand;
  validUntil: string;
  now?: Date;
}>): PricingBenchmarkLimitationCode[] {
  const limitations = new Set<PricingBenchmarkLimitationCode>();
  const now = input.now ?? new Date();
  const validUntil = new Date(input.validUntil);

  if (input.includedSampleSize < 20) {
    limitations.add("small_sample");
  }
  if (input.sourceClassCount < 2) {
    limitations.add("low_source_diversity");
  }
  if (input.propertyType === "unknown") {
    limitations.add("unknown_property_type");
  }
  if (input.capacityBand === "unknown") {
    limitations.add("unknown_capacity");
  }
  if (!Number.isNaN(validUntil.getTime()) && validUntil.getTime() <= now.getTime()) {
    limitations.add("aging_data");
  }

  return [...limitations].sort();
}

export function derivePricingBenchmarkApproval(
  input: Readonly<{
    includedSampleSize: number;
    confidenceLevel: PricingBenchmarkConfidenceLevel;
    sourceClassCount: number;
    propertyType: PricingBenchmarkPropertyType;
    capacityBand: PricingBenchmarkCapacityBand;
  }>,
): Readonly<{
  approvalStatus: PricingBenchmarkApprovalStatus;
  approvedForInternal: boolean;
  approvedForAudit: boolean;
}> {
  if (input.includedSampleSize < 5) {
    return {
      approvalStatus: "insufficient",
      approvedForInternal: false,
      approvedForAudit: false,
    };
  }
  if (input.includedSampleSize < 10) {
    return {
      approvalStatus: "exploratory",
      approvedForInternal: true,
      approvedForAudit: false,
    };
  }
  if (input.includedSampleSize < 20) {
    return {
      approvalStatus: "internal_approved",
      approvedForInternal: true,
      approvedForAudit: false,
    };
  }

  const confidenceRank: Record<PricingBenchmarkConfidenceLevel, number> = {
    very_low: 0,
    low: 1,
    moderate: 2,
    high: 3,
    very_high: 4,
  };

  if (
    confidenceRank[input.confidenceLevel] >= confidenceRank.high &&
    input.sourceClassCount >= 2 &&
    input.propertyType !== "unknown" &&
    input.capacityBand !== "unknown"
  ) {
    return {
      approvalStatus: "audit_approved",
      approvedForInternal: true,
      approvedForAudit: true,
    };
  }

  return {
    approvalStatus: "internal_approved",
    approvedForInternal: true,
    approvedForAudit: false,
  };
}

function buildPolicyFamilyKey(row: ValidSourceRow): string {
  return [
    row.factContractVersion,
    row.transformationPolicyVersion,
    row.eligibilityPolicyVersion,
    row.deduplicationPolicyVersion,
    row.marketCellPolicyVersion,
    row.pricingNormalizationPolicyVersion,
    row.confidencePolicyVersion,
    row.freshnessPolicyVersion,
  ].join("|");
}

function validateSourceRow(
  row: AnonymousFactGroupSourceRow,
): Readonly<{ ok: true; row: ValidSourceRow }> | Readonly<{
  ok: false;
  reason: "invalid_fact_row" | "market_cell_mismatch";
}> {
  const country = normalizeRequiredString(row.country);
  const city = normalizeRequiredString(row.city);
  const platform = normalizeRequiredString(row.platform);
  const propertyType = normalizeRequiredString(row.property_type);
  const capacityBand = normalizeRequiredString(row.capacity_band);
  const currency = normalizeRequiredString(row.currency);
  const marketCellKey = normalizeRequiredString(row.market_cell_key);
  const sourceClass = normalizeRequiredString(row.source_class);
  const factContractVersion = normalizeRequiredString(row.fact_contract_version);
  const transformationPolicyVersion = normalizeRequiredString(
    row.transformation_policy_version,
  );
  const eligibilityPolicyVersion = normalizeRequiredString(
    row.eligibility_policy_version,
  );
  const deduplicationPolicyVersion = normalizeRequiredString(
    row.deduplication_policy_version,
  );
  const marketCellPolicyVersion = normalizeRequiredString(
    row.market_cell_policy_version,
  );
  const pricingNormalizationPolicyVersion = normalizeRequiredString(
    row.pricing_normalization_policy_version,
  );
  const confidencePolicyVersion = normalizeRequiredString(
    row.confidence_policy_version,
  );
  const freshnessPolicyVersion = normalizeRequiredString(
    row.freshness_policy_version,
  );
  const sourceQualityBand = normalizeRequiredString(row.source_quality_band);
  const freshnessInputBand = normalizeRequiredString(row.freshness_input_band);
  const confidenceInputBand = normalizeRequiredString(row.confidence_input_band);

  if (
    country == null ||
    city == null ||
    platform == null ||
    propertyType == null ||
    capacityBand == null ||
    currency == null ||
    marketCellKey == null ||
    sourceClass == null ||
    factContractVersion == null ||
    transformationPolicyVersion == null ||
    eligibilityPolicyVersion == null ||
    deduplicationPolicyVersion == null ||
    marketCellPolicyVersion == null ||
    pricingNormalizationPolicyVersion == null ||
    confidencePolicyVersion == null ||
    freshnessPolicyVersion == null ||
    sourceQualityBand == null ||
    freshnessInputBand == null ||
    confidenceInputBand == null
  ) {
    return { ok: false, reason: "invalid_fact_row" };
  }

  if (
    !isOneOf(PLATFORM_VALUES, platform) ||
    !isOneOf(PROPERTY_TYPE_VALUES, propertyType) ||
    !isOneOf(CAPACITY_BAND_VALUES, capacityBand) ||
    !isOneOf(SOURCE_CLASS_VALUES, sourceClass) ||
    !isOneOf(SOURCE_QUALITY_VALUES, sourceQualityBand) ||
    !isOneOf(FRESHNESS_INPUT_VALUES, freshnessInputBand) ||
    !isOneOf(CONFIDENCE_INPUT_VALUES, confidenceInputBand) ||
    !/^[A-Z]{3}$/.test(currency) ||
    currency === "UNKNOWN" ||
    !Number.isFinite(row.normalized_nightly_price) ||
    row.normalized_nightly_price <= 0
  ) {
    return { ok: false, reason: "invalid_fact_row" };
  }

  const rebuiltMarketCellKey = buildMarketCellKey({
    country,
    city,
    platform,
    propertyType,
    capacityBand,
    currency,
  });

  if (rebuiltMarketCellKey !== marketCellKey) {
    return { ok: false, reason: "market_cell_mismatch" };
  }

  return {
    ok: true,
    row: {
      country,
      city,
      platform,
      propertyType,
      capacityBand,
      currency,
      marketCellKey,
      normalizedNightlyPrice: row.normalized_nightly_price,
      sourceClass,
      factContractVersion,
      transformationPolicyVersion,
      eligibilityPolicyVersion,
      deduplicationPolicyVersion,
      marketCellPolicyVersion,
      pricingNormalizationPolicyVersion,
      confidencePolicyVersion,
      freshnessPolicyVersion,
      sourceQualityBand,
      freshnessInputBand,
      confidenceInputBand,
    },
  };
}

function buildPreviewFailure(input: Readonly<{
  marketCellKey: string;
  capturePeriodBucket: string;
  rawSampleSize: number;
  reasonCodes: PricingBenchmarkBuilderReasonCode[];
  includedSampleSize?: number;
  excludedOutlierCount?: number;
  sourceClassCount?: number;
  sourceDiversityBand?: PricingBenchmarkSourceDiversityBand;
  confidenceLevel?: PricingBenchmarkConfidenceLevel | null;
  approvalStatus?: PricingBenchmarkApprovalStatus | null;
  limitations?: PricingBenchmarkLimitationCode[];
  artifactKey?: string | null;
  distribution?: PricingBenchmarkDistribution | null;
}>): PricingBenchmarkPreviewResult {
  return {
    ok: false,
    marketCellKey: input.marketCellKey,
    capturePeriodBucket: input.capturePeriodBucket,
    rawSampleSize: input.rawSampleSize,
    includedSampleSize: input.includedSampleSize ?? 0,
    excludedOutlierCount: input.excludedOutlierCount ?? 0,
    sourceClassCount: input.sourceClassCount ?? 0,
    sourceDiversityBand: input.sourceDiversityBand ?? "unknown",
    confidenceLevel: input.confidenceLevel ?? null,
    approvalStatus: input.approvalStatus ?? null,
    limitations: [...(input.limitations ?? [])].sort(),
    artifactKey: input.artifactKey ?? null,
    reasonCodes: buildReasonCodes(input.reasonCodes),
    distribution: input.distribution ?? null,
  };
}

export function buildPricingBenchmarkPreview(input: Readonly<{
  marketCellKey: string;
  capturePeriodBucket: string;
  rows: ReadonlyArray<AnonymousFactGroupSourceRow>;
  now?: Date;
}>): PricingBenchmarkPreviewResult {
  if (
    normalizeRequiredString(input.marketCellKey) == null ||
    !isMonthBucket(input.capturePeriodBucket)
  ) {
    return buildPreviewFailure({
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: 0,
      reasonCodes: ["invalid_input"],
    });
  }

  if (input.rows.length === 0) {
    return buildPreviewFailure({
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: 0,
      reasonCodes: ["no_facts_found"],
    });
  }

  const reasonCodes = new Set<PricingBenchmarkBuilderReasonCode>();
  const validRows: ValidSourceRow[] = [];

  for (const row of input.rows) {
    const validated = validateSourceRow(row);
    if (!validated.ok) {
      reasonCodes.add(validated.reason);
      continue;
    }
    validRows.push(validated.row);
  }

  if (validRows.length === 0) {
    if (reasonCodes.size === 0) {
      reasonCodes.add("empty_after_validation");
    } else {
      reasonCodes.add("empty_after_validation");
    }
    return buildPreviewFailure({
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: input.rows.length,
      includedSampleSize: 0,
      excludedOutlierCount: 0,
      sourceClassCount: 0,
      sourceDiversityBand: "unknown",
      reasonCodes: [...reasonCodes],
    });
  }

  const policyFamilies = new Map<string, BenchmarkPolicyFamily>();
  for (const row of validRows) {
    const key = buildPolicyFamilyKey(row);
    if (!policyFamilies.has(key)) {
      policyFamilies.set(key, {
        factContractVersion: row.factContractVersion,
        transformationPolicyVersion: row.transformationPolicyVersion,
        eligibilityPolicyVersion: row.eligibilityPolicyVersion,
        deduplicationPolicyVersion: row.deduplicationPolicyVersion,
        marketCellPolicyVersion: row.marketCellPolicyVersion,
        pricingNormalizationPolicyVersion: row.pricingNormalizationPolicyVersion,
        confidencePolicyVersion: row.confidencePolicyVersion,
        freshnessPolicyVersion: row.freshnessPolicyVersion,
      });
    }
  }

  if (policyFamilies.size !== 1) {
    return buildPreviewFailure({
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: input.rows.length,
      includedSampleSize: validRows.length,
      excludedOutlierCount: 0,
      sourceClassCount: 0,
      sourceDiversityBand: "unknown",
      reasonCodes: [...reasonCodes, "incompatible_policy_versions"],
    });
  }

  const periodBounds = getPricingBenchmarkPeriodBounds(input.capturePeriodBucket);
  if (periodBounds == null) {
    return buildPreviewFailure({
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: input.rows.length,
      includedSampleSize: validRows.length,
      excludedOutlierCount: 0,
      sourceClassCount: 0,
      sourceDiversityBand: "unknown",
      reasonCodes: [...reasonCodes, "invalid_input"],
    });
  }

  const prices = validRows.map((row) => row.normalizedNightlyPrice);
  const distribution = computePricingDistribution(prices);
  if (distribution == null) {
    return buildPreviewFailure({
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: input.rows.length,
      includedSampleSize: validRows.length,
      excludedOutlierCount: 0,
      sourceClassCount: 0,
      sourceDiversityBand: "unknown",
      reasonCodes: [...reasonCodes, "invalid_fact_row"],
    });
  }

  const firstRow = validRows[0];
  if (firstRow == null) {
    return buildPreviewFailure({
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: input.rows.length,
      reasonCodes: [...reasonCodes, "empty_after_validation"],
    });
  }

  const distinctSourceClasses = new Set(validRows.map((row) => row.sourceClass));
  const sourceClassCount = distinctSourceClasses.size;
  const sourceDiversityBand = deriveSourceDiversityBand(sourceClassCount);
  const confidenceLevel = derivePricingBenchmarkConfidenceLevel({
    includedSampleSize: validRows.length,
    sourceClassCount,
    propertyType: firstRow.propertyType,
    capacityBand: firstRow.capacityBand,
  });
  const limitations = buildPricingBenchmarkLimitations({
    includedSampleSize: validRows.length,
    sourceClassCount,
    propertyType: firstRow.propertyType,
    capacityBand: firstRow.capacityBand,
    validUntil: periodBounds.validUntil,
    now: input.now,
  });
  const approval = derivePricingBenchmarkApproval({
    includedSampleSize: validRows.length,
    confidenceLevel,
    sourceClassCount,
    propertyType: firstRow.propertyType,
    capacityBand: firstRow.capacityBand,
  });

  const artifactIdentityInput: BenchmarkArtifactIdentityInput = {
    benchmarkType: PRICING_BENCHMARK_TYPE,
    marketCellKey: input.marketCellKey,
    capturePeriodBucket: input.capturePeriodBucket,
    sourcePeriodStart: periodBounds.sourcePeriodStart,
    sourcePeriodEnd: periodBounds.sourcePeriodEnd,
    p10Price: distribution.p10Price,
    p25Price: distribution.p25Price,
    medianPrice: distribution.medianPrice,
    p75Price: distribution.p75Price,
    p90Price: distribution.p90Price,
    rawSampleSize: validRows.length,
    includedSampleSize: validRows.length,
    excludedOutlierCount: 0,
    sourceClassCount,
    sourceDiversityBand,
    confidenceLevel,
    approvalStatus: approval.approvalStatus,
    limitations,
    artifactContractVersion: INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
    cohortDefinitionVersion: INTELLIGENCE_V2_COHORT_DEFINITION_VERSION,
    cohortPolicyVersion: INTELLIGENCE_V2_COHORT_POLICY_VERSION,
    aggregationPolicyVersion: INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
    outlierPolicyVersion: INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
    confidencePolicyVersion: INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
    freshnessPolicyVersion: INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
    approvalPolicyVersion: INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
    marketCellPolicyVersion: INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  };

  const artifactKeyResult = buildBenchmarkArtifactKey(artifactIdentityInput);
  if (!artifactKeyResult.ok) {
    return buildPreviewFailure({
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: input.rows.length,
      includedSampleSize: validRows.length,
      excludedOutlierCount: 0,
      sourceClassCount,
      sourceDiversityBand,
      confidenceLevel,
      approvalStatus: approval.approvalStatus,
      limitations,
      reasonCodes: [...reasonCodes, "invalid_input"],
      distribution,
    });
  }

  const payload: PricingBenchmarkArtifactPayload = {
    artifact_key: artifactKeyResult.artifactKey,
    artifact_contract_version: INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
    benchmark_type: PRICING_BENCHMARK_TYPE,
    approval_status: approval.approvalStatus,
    country: firstRow.country,
    city: firstRow.city,
    platform: firstRow.platform,
    property_type: firstRow.propertyType,
    capacity_band: firstRow.capacityBand,
    currency: firstRow.currency,
    market_cell_key: input.marketCellKey,
    capture_period_bucket: input.capturePeriodBucket,
    source_period_start: periodBounds.sourcePeriodStart,
    source_period_end: periodBounds.sourcePeriodEnd,
    cohort_definition_version: INTELLIGENCE_V2_COHORT_DEFINITION_VERSION,
    source_class_count: sourceClassCount,
    source_diversity_band: sourceDiversityBand,
    p10_price: distribution.p10Price,
    p25_price: distribution.p25Price,
    median_price: distribution.medianPrice,
    p75_price: distribution.p75Price,
    p90_price: distribution.p90Price,
    raw_sample_size: validRows.length,
    included_sample_size: validRows.length,
    excluded_outlier_count: 0,
    outlier_policy_version: INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
    confidence_level: confidenceLevel,
    confidence_policy_version: INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
    valid_from: periodBounds.validFrom,
    valid_until: periodBounds.validUntil,
    freshness_policy_version: INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
    approved_for_internal: approval.approvedForInternal,
    approved_for_audit: approval.approvedForAudit,
    limitations,
    cohort_policy_version: INTELLIGENCE_V2_COHORT_POLICY_VERSION,
    aggregation_policy_version: INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
    approval_policy_version: INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
    market_cell_policy_version: INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
    supersedes_artifact_id: null,
  };

  const privacyValidation = validateSharedIntelligencePrivacy(payload);
  if (!privacyValidation.valid) {
    return buildPreviewFailure({
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: input.rows.length,
      includedSampleSize: validRows.length,
      excludedOutlierCount: 0,
      sourceClassCount,
      sourceDiversityBand,
      confidenceLevel,
      approvalStatus: approval.approvalStatus,
      limitations,
      artifactKey: artifactKeyResult.artifactKey,
      reasonCodes: [...reasonCodes, "invalid_input"],
      distribution,
    });
  }

  return {
    ok: true,
    payload,
    policyFamily: policyFamilies.values().next().value as BenchmarkPolicyFamily,
    rawSampleSize: validRows.length,
    includedSampleSize: validRows.length,
    excludedOutlierCount: 0,
    sourceClassCount,
    sourceDiversityBand,
    confidenceLevel,
    approvalStatus: approval.approvalStatus,
    limitations,
    artifactKey: artifactKeyResult.artifactKey,
    reasonCodes: buildReasonCodes(reasonCodes),
    distribution,
  };
}

async function querySourceRows(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  input: PricingBenchmarkBuilderInput,
): Promise<
  | Readonly<{ ok: true; rows: AnonymousFactGroupSourceRow[] }>
  | Readonly<{ ok: false }>
> {
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
        "normalized_nightly_price",
        "source_class",
        "fact_contract_version",
        "transformation_policy_version",
        "eligibility_policy_version",
        "deduplication_policy_version",
        "market_cell_policy_version",
        "pricing_normalization_policy_version",
        "confidence_policy_version",
        "freshness_policy_version",
        "source_quality_band",
        "freshness_input_band",
        "confidence_input_band",
      ].join(","),
    )
    .eq("metric_family", "pricing")
    .eq("market_cell_key", input.marketCellKey)
    .eq("capture_period_bucket", input.capturePeriodBucket);

  if (error || !Array.isArray(data)) {
    return { ok: false };
  }

  return {
    ok: true,
    rows: data as unknown as AnonymousFactGroupSourceRow[],
  };
}

async function queryExistingArtifactByKey(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  artifactKey: string,
): Promise<
  | Readonly<{ ok: true; row: ExistingArtifactRow | null }>
  | Readonly<{ ok: false }>
> {
  const { data, error } = await admin
    .from("benchmark_artifacts")
    .select("id,artifact_key,created_at")
    .eq("artifact_key", artifactKey)
    .limit(1);

  if (error || !Array.isArray(data)) {
    return { ok: false };
  }

  const row = data[0] as unknown as ExistingArtifactRow | undefined;
  return { ok: true, row: row ?? null };
}

async function queryActiveCompatibleArtifact(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  payload: PricingBenchmarkArtifactPayload,
): Promise<
  | Readonly<{ ok: true; row: ExistingArtifactRow | null }>
  | Readonly<{ ok: false }>
> {
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
    .eq("capture_period_bucket", payload.capture_period_bucket)
    .eq("artifact_contract_version", payload.artifact_contract_version)
    .eq("cohort_definition_version", payload.cohort_definition_version)
    .eq("cohort_policy_version", payload.cohort_policy_version)
    .eq("aggregation_policy_version", payload.aggregation_policy_version)
    .eq("outlier_policy_version", payload.outlier_policy_version)
    .eq("confidence_policy_version", payload.confidence_policy_version)
    .eq("freshness_policy_version", payload.freshness_policy_version)
    .eq("approval_policy_version", payload.approval_policy_version)
    .eq("market_cell_policy_version", payload.market_cell_policy_version)
    .neq("approval_status", "revoked")
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    return { ok: false };
  }

  const candidates = data as unknown as ExistingArtifactRow[];
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
          row &&
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
    candidates.find((row) => !supersededIds.has(row.id)) ?? candidates[0] ?? null;

  return { ok: true, row: activeRow };
}

async function insertArtifact(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  payload: PricingBenchmarkArtifactPayload,
): Promise<boolean> {
  const { error } = await admin.from("benchmark_artifacts").upsert(payload, {
    onConflict: "artifact_key",
    ignoreDuplicates: true,
  });

  return !error;
}

function logBuilderSummary(
  env: IntelligenceV2FeatureFlagEnv,
  result: PricingBenchmarkBuilderResult,
): void {
  if (env[DEBUG_INTELLIGENCE_V2]?.trim().toLowerCase() !== "true") {
    return;
  }

  console.info(
    "[intelligence-v2][pricing-benchmark-builder]",
    JSON.stringify(result),
  );
}

export async function buildPricingDistributionBenchmark(
  input: PricingBenchmarkBuilderInput,
  dependencies: PricingBenchmarkBuilderDependencies = {},
): Promise<PricingBenchmarkBuilderResult> {
  const env = dependencies.env ?? process.env;
  const flags = getIntelligenceV2FeatureFlags(env);
  const dryRun = input.dryRun ?? true;

  const invalidInputResult = buildResult({
    status: "failed",
    marketCellKey: input.marketCellKey,
    capturePeriodBucket: input.capturePeriodBucket,
    rawSampleSize: 0,
    includedSampleSize: 0,
    excludedOutlierCount: 0,
    sourceClassCount: 0,
    sourceDiversityBand: "unknown",
    confidenceLevel: null,
    approvalStatus: null,
    limitations: [],
    artifactKey: null,
    inserted: false,
    supersedesArtifactId: null,
    reasonCodes: ["invalid_input"],
    p10Price: null,
    p25Price: null,
    medianPrice: null,
    p75Price: null,
    p90Price: null,
  });

  if (
    normalizeRequiredString(input.marketCellKey) == null ||
    !isMonthBucket(input.capturePeriodBucket)
  ) {
    logBuilderSummary(env, invalidInputResult);
    return invalidInputResult;
  }

  if (!flags.ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION) {
    const result = buildResult({
      status: "disabled",
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: 0,
      includedSampleSize: 0,
      excludedOutlierCount: 0,
      sourceClassCount: 0,
      sourceDiversityBand: "unknown",
      confidenceLevel: null,
      approvalStatus: null,
      limitations: [],
      artifactKey: null,
      inserted: false,
      supersedesArtifactId: null,
      reasonCodes: ["flag_disabled"],
      p10Price: null,
      p25Price: null,
      medianPrice: null,
      p75Price: null,
      p90Price: null,
    });
    logBuilderSummary(env, result);
    return result;
  }

  const admin = dependencies.admin ?? createSupabaseAdminClient();
  const rowsResult = await querySourceRows(admin, input);
  if (!rowsResult.ok) {
    const result = buildResult({
      status: "failed",
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: 0,
      includedSampleSize: 0,
      excludedOutlierCount: 0,
      sourceClassCount: 0,
      sourceDiversityBand: "unknown",
      confidenceLevel: null,
      approvalStatus: null,
      limitations: [],
      artifactKey: null,
      inserted: false,
      supersedesArtifactId: null,
      reasonCodes: ["database_read_error"],
      p10Price: null,
      p25Price: null,
      medianPrice: null,
      p75Price: null,
      p90Price: null,
    });
    logBuilderSummary(env, result);
    return result;
  }

  const preview = buildPricingBenchmarkPreview({
    marketCellKey: input.marketCellKey,
    capturePeriodBucket: input.capturePeriodBucket,
    rows: rowsResult.rows,
    now: dependencies.now,
  });

  if (!preview.ok) {
    const result = buildResult({
      status: "failed",
      marketCellKey: preview.marketCellKey,
      capturePeriodBucket: preview.capturePeriodBucket,
      rawSampleSize: preview.rawSampleSize,
      includedSampleSize: preview.includedSampleSize,
      excludedOutlierCount: preview.excludedOutlierCount,
      sourceClassCount: preview.sourceClassCount,
      sourceDiversityBand: preview.sourceDiversityBand,
      confidenceLevel: preview.confidenceLevel,
      approvalStatus: preview.approvalStatus,
      limitations: preview.limitations,
      artifactKey: preview.artifactKey,
      inserted: false,
      supersedesArtifactId: null,
      reasonCodes: preview.reasonCodes,
      ...buildDistributionResult(preview.distribution),
    });
    logBuilderSummary(env, result);
    return result;
  }

  const existingByKey = await queryExistingArtifactByKey(admin, preview.artifactKey);
  if (!existingByKey.ok) {
    const result = buildResult({
      status: "failed",
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: preview.rawSampleSize,
      includedSampleSize: preview.includedSampleSize,
      excludedOutlierCount: preview.excludedOutlierCount,
      sourceClassCount: preview.sourceClassCount,
      sourceDiversityBand: preview.sourceDiversityBand,
      confidenceLevel: preview.confidenceLevel,
      approvalStatus: preview.approvalStatus,
      limitations: preview.limitations,
      artifactKey: preview.artifactKey,
      inserted: false,
      supersedesArtifactId: null,
      reasonCodes: [...preview.reasonCodes, "database_read_error"],
      ...buildDistributionResult(preview.distribution),
    });
    logBuilderSummary(env, result);
    return result;
  }

  const activeArtifact = await queryActiveCompatibleArtifact(admin, preview.payload);
  if (!activeArtifact.ok) {
    const result = buildResult({
      status: "failed",
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: preview.rawSampleSize,
      includedSampleSize: preview.includedSampleSize,
      excludedOutlierCount: preview.excludedOutlierCount,
      sourceClassCount: preview.sourceClassCount,
      sourceDiversityBand: preview.sourceDiversityBand,
      confidenceLevel: preview.confidenceLevel,
      approvalStatus: preview.approvalStatus,
      limitations: preview.limitations,
      artifactKey: preview.artifactKey,
      inserted: false,
      supersedesArtifactId: null,
      reasonCodes: [...preview.reasonCodes, "supersession_lookup_error"],
      ...buildDistributionResult(preview.distribution),
    });
    logBuilderSummary(env, result);
    return result;
  }

  if (dryRun) {
    const result = buildResult({
      status: "dry_run",
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: preview.rawSampleSize,
      includedSampleSize: preview.includedSampleSize,
      excludedOutlierCount: preview.excludedOutlierCount,
      sourceClassCount: preview.sourceClassCount,
      sourceDiversityBand: preview.sourceDiversityBand,
      confidenceLevel: preview.confidenceLevel,
      approvalStatus: preview.approvalStatus,
      limitations: preview.limitations,
      artifactKey: preview.artifactKey,
      inserted: false,
      supersedesArtifactId:
        existingByKey.row?.id ??
        (activeArtifact.row?.artifact_key === preview.artifactKey
          ? activeArtifact.row.id
          : activeArtifact.row?.id ?? null),
      reasonCodes: existingByKey.row
        ? [...preview.reasonCodes, "artifact_already_exists"]
        : preview.reasonCodes,
      ...buildDistributionResult(preview.distribution),
    });
    logBuilderSummary(env, result);
    return result;
  }

  if (preview.approvalStatus === "insufficient") {
    const result = buildResult({
      status: "insufficient",
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: preview.rawSampleSize,
      includedSampleSize: preview.includedSampleSize,
      excludedOutlierCount: preview.excludedOutlierCount,
      sourceClassCount: preview.sourceClassCount,
      sourceDiversityBand: preview.sourceDiversityBand,
      confidenceLevel: preview.confidenceLevel,
      approvalStatus: preview.approvalStatus,
      limitations: preview.limitations,
      artifactKey: preview.artifactKey,
      inserted: false,
      supersedesArtifactId: null,
      reasonCodes: preview.reasonCodes,
      ...buildDistributionResult(preview.distribution),
    });
    logBuilderSummary(env, result);
    return result;
  }

  if (existingByKey.row) {
    const result = buildResult({
      status: "already_exists",
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: preview.rawSampleSize,
      includedSampleSize: preview.includedSampleSize,
      excludedOutlierCount: preview.excludedOutlierCount,
      sourceClassCount: preview.sourceClassCount,
      sourceDiversityBand: preview.sourceDiversityBand,
      confidenceLevel: preview.confidenceLevel,
      approvalStatus: preview.approvalStatus,
      limitations: preview.limitations,
      artifactKey: preview.artifactKey,
      inserted: false,
      supersedesArtifactId: existingByKey.row.id,
      reasonCodes: [...preview.reasonCodes, "artifact_already_exists"],
      ...buildDistributionResult(preview.distribution),
    });
    logBuilderSummary(env, result);
    return result;
  }

  const payload: PricingBenchmarkArtifactPayload = {
    ...preview.payload,
    supersedes_artifact_id:
      activeArtifact.row?.artifact_key === preview.artifactKey
        ? null
        : activeArtifact.row?.id ?? null,
  };

  const inserted = await insertArtifact(admin, payload);
  if (!inserted) {
    const result = buildResult({
      status: "failed",
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      rawSampleSize: preview.rawSampleSize,
      includedSampleSize: preview.includedSampleSize,
      excludedOutlierCount: preview.excludedOutlierCount,
      sourceClassCount: preview.sourceClassCount,
      sourceDiversityBand: preview.sourceDiversityBand,
      confidenceLevel: preview.confidenceLevel,
      approvalStatus: preview.approvalStatus,
      limitations: preview.limitations,
      artifactKey: preview.artifactKey,
      inserted: false,
      supersedesArtifactId: payload.supersedes_artifact_id,
      reasonCodes: [...preview.reasonCodes, "database_insert_error"],
      ...buildDistributionResult(preview.distribution),
    });
    logBuilderSummary(env, result);
    return result;
  }

  const result = buildResult({
    status: "inserted",
    marketCellKey: input.marketCellKey,
    capturePeriodBucket: input.capturePeriodBucket,
    rawSampleSize: preview.rawSampleSize,
    includedSampleSize: preview.includedSampleSize,
    excludedOutlierCount: preview.excludedOutlierCount,
    sourceClassCount: preview.sourceClassCount,
    sourceDiversityBand: preview.sourceDiversityBand,
    confidenceLevel: preview.confidenceLevel,
    approvalStatus: preview.approvalStatus,
    limitations: preview.limitations,
    artifactKey: preview.artifactKey,
    inserted: true,
    supersedesArtifactId: payload.supersedes_artifact_id,
    reasonCodes: preview.reasonCodes,
    ...buildDistributionResult(preview.distribution),
  });
  logBuilderSummary(env, result);
  return result;
}
