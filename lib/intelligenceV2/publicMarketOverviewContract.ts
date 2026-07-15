import { createHash } from "node:crypto";

import type {
  IntelligenceV2Platform,
  IntelligenceV2PropertyType,
} from "./marketCell";
import type { PricingBenchmarkArtifactPayload } from "./pricingBenchmarkBuilder";
import {
  INTELLIGENCE_V2_COHORT_DEFINITION_VERSION,
  INTELLIGENCE_V2_COHORT_POLICY_VERSION,
  INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
  INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_AGGREGATION_POLICY_VERSION,
  INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_CONTRACT_VERSION,
  INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_GOVERNANCE_POLICY_VERSION,
} from "./policyVersions";

export type PublicMarketOverviewIntendedUse = "public_market_overview";
export type PublicMarketOverviewAggregationWindow = "rolling_90_days";
export type PublicMarketOverviewCapacityScope = "all_capacities";
export type PublicMarketOverviewPropertyScope =
  | "exact"
  | "broader_market";
export type PublicMarketOverviewSampleBand = "sufficient" | "strong";
export type PublicMarketOverviewConfidence = "standard" | "high";
export type PublicMarketOverviewExposureStatus =
  | "public_usable"
  | "public_usable_with_limits"
  | "not_public";
export type PublicMarketOverviewFreshnessStatus =
  | "fresh"
  | "aging"
  | "expired";

export type PublicMarketOverviewLimitationCode =
  | "broader_market_segment"
  | "all_capacities_scope"
  | "limited_source_diversity"
  | "limited_sample_size"
  | "aging_data";

export type PublicMarketOverviewReasonCode =
  | "invalid_input"
  | "invalid_window"
  | "unsupported_market"
  | "no_facts_in_window"
  | "mixed_policy_versions"
  | "invalid_distribution"
  | "insufficient_sample_size"
  | "insufficient_period_coverage"
  | "flat_small_cohort"
  | "expired_window";

export type PublicMarketOverviewArtifact = Readonly<{
  publicContractVersion: string;
  artifactKey: string;
  intendedUse: "public_market_overview";
  aggregationWindow: "rolling_90_days";
  capacityScope: "all_capacities";
  propertyScope: PublicMarketOverviewPropertyScope;
  country: string;
  city: string;
  platform: Exclude<IntelligenceV2Platform, "unknown">;
  propertyType: IntelligenceV2PropertyType;
  currency: string;
  capturePeriodBucket: string;
  windowStartedAt: string;
  windowEndedAt: string;
  p25: number;
  median: number;
  p75: number;
  sampleBand: PublicMarketOverviewSampleBand;
  confidence: PublicMarketOverviewConfidence;
  freshnessStatus: Exclude<PublicMarketOverviewFreshnessStatus, "expired">;
  exposureStatus: Exclude<PublicMarketOverviewExposureStatus, "not_public">;
  limitationCodes: readonly PublicMarketOverviewLimitationCode[];
  policyVersions: Readonly<{
    contractVersion: string;
    aggregationPolicyVersion: string;
    governancePolicyVersion: string;
    marketCellPolicyVersion: string;
  }>;
}>;

export type PublicMarketOverviewPersistableArtifactRow = Readonly<{
  artifact_key: PricingBenchmarkArtifactPayload["artifact_key"];
  artifact_contract_version: PricingBenchmarkArtifactPayload["artifact_contract_version"];
  benchmark_type: PricingBenchmarkArtifactPayload["benchmark_type"];
  approval_status: "internal_approved";
  country: PricingBenchmarkArtifactPayload["country"];
  city: PricingBenchmarkArtifactPayload["city"];
  platform: PricingBenchmarkArtifactPayload["platform"];
  property_type: IntelligenceV2PropertyType;
  capacity_band: "unknown";
  currency: PricingBenchmarkArtifactPayload["currency"];
  market_cell_key: PricingBenchmarkArtifactPayload["market_cell_key"];
  capture_period_bucket: PricingBenchmarkArtifactPayload["capture_period_bucket"];
  source_period_start: PricingBenchmarkArtifactPayload["source_period_start"];
  source_period_end: PricingBenchmarkArtifactPayload["source_period_end"];
  cohort_definition_version: PricingBenchmarkArtifactPayload["cohort_definition_version"];
  source_class_count: PricingBenchmarkArtifactPayload["source_class_count"];
  source_diversity_band: Extract<
    PricingBenchmarkArtifactPayload["source_diversity_band"],
    "low" | "moderate"
  >;
  p10_price: PricingBenchmarkArtifactPayload["p10_price"];
  p25_price: PricingBenchmarkArtifactPayload["p25_price"];
  median_price: PricingBenchmarkArtifactPayload["median_price"];
  p75_price: PricingBenchmarkArtifactPayload["p75_price"];
  p90_price: PricingBenchmarkArtifactPayload["p90_price"];
  raw_sample_size: PricingBenchmarkArtifactPayload["raw_sample_size"];
  included_sample_size: PricingBenchmarkArtifactPayload["included_sample_size"];
  excluded_outlier_count: PricingBenchmarkArtifactPayload["excluded_outlier_count"];
  outlier_policy_version: PricingBenchmarkArtifactPayload["outlier_policy_version"];
  confidence_level: "moderate" | "high";
  confidence_policy_version: PricingBenchmarkArtifactPayload["confidence_policy_version"];
  valid_from: PricingBenchmarkArtifactPayload["valid_from"];
  valid_until: PricingBenchmarkArtifactPayload["valid_until"];
  freshness_policy_version: PricingBenchmarkArtifactPayload["freshness_policy_version"];
  approved_for_internal: true;
  approved_for_audit: false;
  limitations: readonly (
    | "small_sample"
    | "broad_fallback"
    | "low_source_diversity"
    | "aging_data"
  )[];
  cohort_policy_version: PricingBenchmarkArtifactPayload["cohort_policy_version"];
  aggregation_policy_version: PricingBenchmarkArtifactPayload["aggregation_policy_version"];
  approval_policy_version: PricingBenchmarkArtifactPayload["approval_policy_version"];
  market_cell_policy_version: PricingBenchmarkArtifactPayload["market_cell_policy_version"];
  supersedes_artifact_id: null;
  intended_use: "public_market_overview";
  aggregation_window: "rolling_90_days";
  capacity_scope: "all_capacities";
  property_scope: PublicMarketOverviewPropertyScope;
}>;

export const PUBLIC_MARKET_OVERVIEW_DATABASE_ROW_COLUMNS = Object.freeze([
  "artifact_key",
  "artifact_contract_version",
  "benchmark_type",
  "approval_status",
  "country",
  "city",
  "platform",
  "property_type",
  "capacity_band",
  "currency",
  "market_cell_key",
  "capture_period_bucket",
  "source_period_start",
  "source_period_end",
  "cohort_definition_version",
  "source_class_count",
  "source_diversity_band",
  "p10_price",
  "p25_price",
  "median_price",
  "p75_price",
  "p90_price",
  "raw_sample_size",
  "included_sample_size",
  "excluded_outlier_count",
  "outlier_policy_version",
  "confidence_level",
  "confidence_policy_version",
  "valid_from",
  "valid_until",
  "freshness_policy_version",
  "approved_for_internal",
  "approved_for_audit",
  "limitations",
  "cohort_policy_version",
  "aggregation_policy_version",
  "approval_policy_version",
  "market_cell_policy_version",
  "supersedes_artifact_id",
  "intended_use",
  "aggregation_window",
  "capacity_scope",
  "property_scope",
] as const);

export type PublicMarketOverviewDatabaseRowInput = Readonly<{
  artifact: PublicMarketOverviewArtifact;
  marketCellKey: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  sourceClassCount: number;
  sourceDiversityBand: "low" | "moderate";
  p10Price: number;
  p25Price: number;
  medianPrice: number;
  p75Price: number;
  p90Price: number;
  rawSampleSize: number;
  includedSampleSize: number;
  excludedOutlierCount: number;
  outlierPolicyVersion: string;
  confidencePolicyVersion: string;
  freshnessPolicyVersion: string;
  cohortDefinitionVersion: string;
  cohortPolicyVersion: string;
  aggregationPolicyVersion: string;
  approvalPolicyVersion: string;
  marketCellPolicyVersion: string;
  validFrom: string;
  validUntil: string;
}>;

export type PublicMarketOverviewArtifactKeyInput = Readonly<{
  country: string;
  city: string;
  platform: Exclude<IntelligenceV2Platform, "unknown">;
  propertyType: IntelligenceV2PropertyType;
  currency: string;
  propertyScope: PublicMarketOverviewPropertyScope;
  windowStartedAt: string;
  windowEndedAt: string;
  capturePeriodBucket: string;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  rawSampleSize: number;
  includedSampleSize: number;
  sourceClassCount: number;
  sourceDiversityBand: "low" | "moderate";
  sampleBand: PublicMarketOverviewSampleBand;
  confidence: PublicMarketOverviewConfidence;
  freshnessStatus: Exclude<PublicMarketOverviewFreshnessStatus, "expired">;
  limitationCodes: readonly PublicMarketOverviewLimitationCode[];
}>;

function normalizeRequiredString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export function buildPublicMarketOverviewArtifactKey(
  input: PublicMarketOverviewArtifactKeyInput,
): string | null {
  const country = normalizeRequiredString(input.country);
  const city = normalizeRequiredString(input.city);
  const platform = normalizeRequiredString(input.platform);
  const propertyType = normalizeRequiredString(input.propertyType);
  const currency = normalizeRequiredString(input.currency);
  const windowStartedAt = normalizeRequiredString(input.windowStartedAt);
  const windowEndedAt = normalizeRequiredString(input.windowEndedAt);
  const capturePeriodBucket = normalizeRequiredString(input.capturePeriodBucket);
  const p10 = formatMoney(input.p10);
  const p25 = formatMoney(input.p25);
  const median = formatMoney(input.median);
  const p75 = formatMoney(input.p75);
  const p90 = formatMoney(input.p90);
  const rawSampleSize = formatInteger(input.rawSampleSize);
  const includedSampleSize = formatInteger(input.includedSampleSize);
  const sourceClassCount = formatInteger(input.sourceClassCount);
  const sourceDiversityBand = normalizeRequiredString(input.sourceDiversityBand);
  const sampleBand = normalizeRequiredString(input.sampleBand);
  const confidence = normalizeRequiredString(input.confidence);
  const freshnessStatus = normalizeRequiredString(input.freshnessStatus);

  if (
    country == null ||
    city == null ||
    platform == null ||
    propertyType == null ||
    currency == null ||
    windowStartedAt == null ||
    windowEndedAt == null ||
    capturePeriodBucket == null ||
    p10 == null ||
    p25 == null ||
    median == null ||
    p75 == null ||
    p90 == null ||
    rawSampleSize == null ||
    includedSampleSize == null ||
    sourceClassCount == null ||
    sourceDiversityBand == null ||
    sampleBand == null ||
    confidence == null ||
    freshnessStatus == null
  ) {
    return null;
  }

  const limitations = [...input.limitationCodes].sort().join(",");
  const message = [
    "intended_use=public_market_overview",
    "aggregation_window=rolling_90_days",
    "capacity_scope=all_capacities",
    `property_scope=${input.propertyScope}`,
    `country=${country}`,
    `city=${city}`,
    `platform=${platform}`,
    `property_type=${propertyType}`,
    `currency=${currency}`,
    `capture_period_bucket=${capturePeriodBucket}`,
    `window_started_at=${windowStartedAt}`,
    `window_ended_at=${windowEndedAt}`,
    `p10=${p10}`,
    `p25=${p25}`,
    `median=${median}`,
    `p75=${p75}`,
    `p90=${p90}`,
    `raw_sample_size=${rawSampleSize}`,
    `included_sample_size=${includedSampleSize}`,
    `source_class_count=${sourceClassCount}`,
    `source_diversity_band=${sourceDiversityBand}`,
    `sample_band=${sampleBand}`,
    `confidence=${confidence}`,
    `freshness_status=${freshnessStatus}`,
    `limitations=${limitations}`,
    `contract_version=${INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_CONTRACT_VERSION}`,
    `aggregation_policy_version=${INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_AGGREGATION_POLICY_VERSION}`,
    `governance_policy_version=${INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_GOVERNANCE_POLICY_VERSION}`,
    `market_cell_policy_version=${INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION}`,
  ].join("\n");

  return `ifv2_public_market_overview_${createHash("sha256").update(message).digest("hex")}`;
}

export function mapPublicToPersistedLimitationCodes(
  limitations: readonly PublicMarketOverviewLimitationCode[],
): PublicMarketOverviewPersistableArtifactRow["limitations"] {
  const persisted = new Set<
    PublicMarketOverviewPersistableArtifactRow["limitations"][number]
  >();

  for (const limitation of limitations) {
    switch (limitation) {
      case "limited_sample_size":
        persisted.add("small_sample");
        break;
      case "limited_source_diversity":
        persisted.add("low_source_diversity");
        break;
      case "aging_data":
        persisted.add("aging_data");
        break;
      case "broader_market_segment":
        persisted.add("broad_fallback");
        break;
      case "all_capacities_scope":
        break;
    }
  }

  return [...persisted].sort();
}

export function buildPublicMarketOverviewDatabaseRow(
  input: PublicMarketOverviewDatabaseRowInput,
): PublicMarketOverviewPersistableArtifactRow {
  return Object.freeze({
    artifact_key: input.artifact.artifactKey,
    artifact_contract_version:
      INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_CONTRACT_VERSION,
    benchmark_type: "pricing_distribution",
    approval_status: "internal_approved",
    country: input.artifact.country,
    city: input.artifact.city,
    platform: input.artifact.platform,
    property_type: input.artifact.propertyType,
    capacity_band: "unknown",
    currency: input.artifact.currency,
    market_cell_key: input.marketCellKey,
    capture_period_bucket: input.artifact.capturePeriodBucket,
    source_period_start: input.sourcePeriodStart,
    source_period_end: input.sourcePeriodEnd,
    cohort_definition_version: input.cohortDefinitionVersion,
    source_class_count: input.sourceClassCount,
    source_diversity_band: input.sourceDiversityBand,
    p10_price: input.p10Price,
    p25_price: input.p25Price,
    median_price: input.medianPrice,
    p75_price: input.p75Price,
    p90_price: input.p90Price,
    raw_sample_size: input.rawSampleSize,
    included_sample_size: input.includedSampleSize,
    excluded_outlier_count: input.excludedOutlierCount,
    outlier_policy_version: input.outlierPolicyVersion,
    confidence_level: input.artifact.confidence === "high" ? "high" : "moderate",
    confidence_policy_version: input.confidencePolicyVersion,
    valid_from: input.validFrom,
    valid_until: input.validUntil,
    freshness_policy_version: input.freshnessPolicyVersion,
    approved_for_internal: true,
    approved_for_audit: false,
    limitations: mapPublicToPersistedLimitationCodes(
      input.artifact.limitationCodes,
    ),
    cohort_policy_version: input.cohortPolicyVersion,
    aggregation_policy_version: input.aggregationPolicyVersion,
    approval_policy_version: input.approvalPolicyVersion,
    market_cell_policy_version: input.marketCellPolicyVersion,
    supersedes_artifact_id: null,
    intended_use: "public_market_overview",
    aggregation_window: "rolling_90_days",
    capacity_scope: "all_capacities",
    property_scope: input.artifact.propertyScope,
  });
}

export const PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT = Object.freeze({
  publicContractVersion: INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_CONTRACT_VERSION,
  publicAggregationPolicyVersion:
    INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_AGGREGATION_POLICY_VERSION,
  publicGovernancePolicyVersion:
    INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_GOVERNANCE_POLICY_VERSION,
  marketCellPolicyVersion: INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  cohortDefinitionVersion: INTELLIGENCE_V2_COHORT_DEFINITION_VERSION,
  cohortPolicyVersion: INTELLIGENCE_V2_COHORT_POLICY_VERSION,
  outlierPolicyVersion: INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
} as const);
