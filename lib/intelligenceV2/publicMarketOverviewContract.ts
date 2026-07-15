import { createHash } from "node:crypto";

import type {
  IntelligenceV2Platform,
  IntelligenceV2PropertyType,
} from "./marketCell";
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
  artifact_key: string;
  artifact_contract_version: string;
  benchmark_type: "pricing_distribution";
  approval_status: "internal_approved";
  country: string;
  city: string;
  platform: Exclude<IntelligenceV2Platform, "unknown">;
  property_type: IntelligenceV2PropertyType;
  capacity_band: "unknown";
  currency: string;
  market_cell_key: string;
  capture_period_bucket: string;
  source_period_start: string;
  source_period_end: string;
  cohort_definition_version: string;
  source_class_count: number;
  source_diversity_band: "low" | "moderate";
  p10_price: number;
  p25_price: number;
  median_price: number;
  p75_price: number;
  p90_price: number;
  raw_sample_size: number;
  included_sample_size: number;
  excluded_outlier_count: number;
  outlier_policy_version: string;
  confidence_level: "moderate" | "high";
  confidence_policy_version: string;
  valid_from: string;
  valid_until: string;
  freshness_policy_version: string;
  approved_for_internal: true;
  approved_for_audit: false;
  limitations: readonly (
    | "small_sample"
    | "broad_fallback"
    | "low_source_diversity"
    | "aging_data"
  )[];
  cohort_policy_version: string;
  aggregation_policy_version: string;
  approval_policy_version: string;
  market_cell_policy_version: string;
  supersedes_artifact_id: null;
  intended_use: "public_market_overview";
  aggregation_window: "rolling_90_days";
  capacity_scope: "all_capacities";
  property_scope: PublicMarketOverviewPropertyScope;
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
