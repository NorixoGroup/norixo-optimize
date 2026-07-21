import { createHash } from "node:crypto";

import type {
  OccupancyBenchmarkArtifactPayload,
} from "@/lib/intelligenceV2/occupancyBenchmarkBuilder";
import { validateOccupancyBenchmarkArtifact } from "@/lib/intelligenceV2/occupancyBenchmarkArtifact";
import type { PricingBenchmarkArtifactPayload } from "@/lib/intelligenceV2/pricingBenchmarkBuilder";
import type { PublicMarketOverviewArtifact } from "@/lib/intelligenceV2/publicMarketOverviewContract";
import type { CoordinationJsonObject } from "../distributedCoordination";
import type {
  PublicMarketFact,
  RegistryPopulationContribution,
  RegistryPopulationDiagnostic,
  RegistryPopulationMarket,
  RegistryPopulationSkippedInput,
} from "../registryPopulation";

export type PricingBenchmarkPopulationInput = Readonly<{
  source: "public_market_dataset";
  datasetType: "pricing_benchmark";
  payload: PricingBenchmarkArtifactPayload;
  metadata?: Record<string, unknown>;
}>;

export type OccupancyBenchmarkPopulationInput = Readonly<{
  source: "public_market_dataset";
  datasetType: "occupancy_benchmark";
  payload: OccupancyBenchmarkArtifactPayload;
  metadata?: Record<string, unknown>;
}>;

export type PublicMarketOverviewPopulationInput = Readonly<{
  source: "public_market_dataset";
  datasetType: "market_overview";
  artifact: PublicMarketOverviewArtifact;
  metadata?: Record<string, unknown>;
}>;

export type PublicSafePopulationInput =
  | PricingBenchmarkPopulationInput
  | OccupancyBenchmarkPopulationInput
  | PublicMarketOverviewPopulationInput;

export type PublicSafePopulationArtifacts = Readonly<{
  facts: readonly PublicMarketFact[];
  contributions: readonly RegistryPopulationContribution[];
  diagnostics: readonly RegistryPopulationDiagnostic[];
  skipped: RegistryPopulationSkippedInput | null;
}>;

type BuildArtifactsOptions = Readonly<{
  generatedAt: string;
}>;

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value != null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort((left, right) => compareStrings(left[0], right[0]))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashFingerprint(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function sanitizeIdentifier(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function freezeMetadata(
  metadata: CoordinationJsonObject | undefined,
): CoordinationJsonObject {
  return Object.freeze({ ...(metadata ?? {}) });
}

function sortStringRecord(
  input: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(input).sort((left, right) => compareStrings(left[0], right[0])),
    ),
  );
}

function addDays(timestamp: string, days: number): string {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function mapConfidenceBand(input: string): "unknown" | "low" | "moderate" | "high" | "very_high" {
  switch (input) {
    case "very_high":
      return "very_high";
    case "high":
      return "high";
    case "moderate":
    case "standard":
      return "moderate";
    case "low":
    case "very_low":
      return "low";
    default:
      return "unknown";
  }
}

function buildMarket(input: Readonly<{
  country: string;
  city: string;
  marketCellKey: string;
  locale?: string | null;
}>): RegistryPopulationMarket {
  return Object.freeze({
    country: input.country,
    city: input.city,
    citySlug: sanitizeSegment(input.city),
    marketCellKey: input.marketCellKey,
    locale: input.locale ?? null,
  });
}

function buildOverviewMarketKey(
  artifact: PublicMarketOverviewArtifact,
): string {
  return [
    sanitizeSegment(artifact.country),
    sanitizeSegment(artifact.city),
    sanitizeSegment(artifact.platform),
    sanitizeSegment(artifact.propertyType),
    "all_capacities",
  ].join(":");
}

function buildDiagnostic(
  input: Readonly<{
    code:
      | "invalid_source_input"
      | "missing_market_identity"
      | "private_field_detected"
      | "stale_source"
      | "unsupported_metric"
      | "contribution_skipped";
    severity: "info" | "warning" | "error";
    marketCellKey?: string | null;
    assetKey?: string | null;
    message: string;
  }>,
): RegistryPopulationDiagnostic {
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    source: "public_market_dataset",
    marketCellKey: input.marketCellKey ?? null,
    assetKey: input.assetKey ?? null,
    path: null,
    message: input.message,
    metadata: Object.freeze({}),
  });
}

function buildSkipped(
  input: PublicSafePopulationInput,
  reasonCode:
    | "invalid_source_input"
    | "missing_market_identity"
    | "contribution_skipped",
  message: string,
  marketCellKey?: string | null,
): RegistryPopulationSkippedInput {
  return Object.freeze({
    source: input.source,
    inputFingerprint: hashFingerprint("ipp_population_input", input),
    reasonCode,
    marketCellKey: marketCellKey ?? null,
    message,
    metadata: Object.freeze({
      datasetType: input.datasetType,
    }),
  });
}

function buildPricingFacts(
  input: PricingBenchmarkPopulationInput,
): readonly PublicMarketFact[] {
  const payload = input.payload;
  const market = buildMarket({
    country: payload.country,
    city: payload.city,
    marketCellKey: payload.market_cell_key,
    locale: "en",
  });
  const sourceFingerprint = payload.artifact_key;
  const base = {
    source: input.source,
    market,
    periodBucket: payload.capture_period_bucket,
    platform: payload.platform,
    propertyType: payload.property_type,
    capacityBand: payload.capacity_band,
    sampleSizeBand:
      payload.included_sample_size >= 50
        ? "strong"
        : payload.included_sample_size >= 15
          ? "sufficient"
          : "limited",
    confidenceBand: mapConfidenceBand(payload.confidence_level),
    sourceClass: "aggregated_benchmark",
    sourceFingerprint,
    capturedAt: payload.valid_from,
    policyVersions: sortStringRecord({
      confidence_policy: payload.confidence_policy_version,
      freshness_policy: payload.freshness_policy_version,
      aggregation_policy: payload.aggregation_policy_version,
      approval_policy: payload.approval_policy_version,
      market_cell_policy: payload.market_cell_policy_version,
    }),
    metadata: Object.freeze({
      artifactKey: payload.artifact_key,
      includedSampleSize: payload.included_sample_size,
      rawSampleSize: payload.raw_sample_size,
      limitations: [...payload.limitations].sort(),
    }),
  };

  return Object.freeze(
    [
      {
        factId: hashFingerprint("ipp_public_fact", {
          artifactKey: payload.artifact_key,
          metricKey: "pricing.p25",
        }),
        metricFamily: "pricing",
        metricKey: "pricing.p25",
        value: payload.p25_price,
        unit: payload.currency,
        band: "p25",
      },
      {
        factId: hashFingerprint("ipp_public_fact", {
          artifactKey: payload.artifact_key,
          metricKey: "pricing.median",
        }),
        metricFamily: "pricing",
        metricKey: "pricing.median",
        value: payload.median_price,
        unit: payload.currency,
        band: "median",
      },
      {
        factId: hashFingerprint("ipp_public_fact", {
          artifactKey: payload.artifact_key,
          metricKey: "pricing.p75",
        }),
        metricFamily: "pricing",
        metricKey: "pricing.p75",
        value: payload.p75_price,
        unit: payload.currency,
        band: "p75",
      },
    ].map((metric) =>
      Object.freeze({
        ...base,
        ...metric,
      }),
    ),
  );
}

function buildOccupancyFacts(
  input: OccupancyBenchmarkPopulationInput,
): readonly PublicMarketFact[] {
  const payload = input.payload;
  const market = buildMarket({
    country: payload.country,
    city: payload.city,
    marketCellKey: payload.market_cell_key,
    locale: "en",
  });
  const sourceFingerprint = payload.artifact_key;
  const base = {
    source: input.source,
    market,
    periodBucket: payload.capture_period_bucket,
    platform: payload.platform,
    propertyType: payload.property_type,
    capacityBand: payload.capacity_band,
    sampleSizeBand:
      payload.included_sample_size >= 50
        ? "strong"
        : payload.included_sample_size >= 15
          ? "sufficient"
          : "limited",
    confidenceBand: mapConfidenceBand(payload.confidence_level),
    sourceClass: "aggregated_benchmark",
    sourceFingerprint,
    capturedAt: payload.valid_from,
    policyVersions: sortStringRecord({
      confidence_policy: payload.confidence_policy_version,
      freshness_policy: payload.freshness_policy_version,
      aggregation_policy: payload.aggregation_policy_version,
      approval_policy: payload.approval_policy_version,
      market_cell_policy: payload.market_cell_policy_version,
    }),
    metadata: Object.freeze({
      artifactKey: payload.artifact_key,
      includedSampleSize: payload.included_sample_size,
      rawSampleSize: payload.raw_sample_size,
      limitations: [...payload.limitations].sort(),
    }),
  };

  return Object.freeze(
    [
      {
        factId: hashFingerprint("ipp_public_fact", {
          artifactKey: payload.artifact_key,
          metricKey: "occupancy.dominant_observed_days_band",
        }),
        metricFamily: "occupancy",
        metricKey: "occupancy.dominant_observed_days_band",
        value: payload.dominant_observed_days_band,
        unit: null,
        band: payload.dominant_observed_days_band,
      },
      {
        factId: hashFingerprint("ipp_public_fact", {
          artifactKey: payload.artifact_key,
          metricKey: "occupancy.dominant_unavailability_rate_band",
        }),
        metricFamily: "occupancy",
        metricKey: "occupancy.dominant_unavailability_rate_band",
        value: payload.dominant_unavailability_rate_band,
        unit: null,
        band: payload.dominant_unavailability_rate_band,
      },
    ].map((metric) =>
      Object.freeze({
        ...base,
        ...metric,
      }),
    ),
  );
}

function buildOverviewFacts(
  input: PublicMarketOverviewPopulationInput,
): readonly PublicMarketFact[] {
  const artifact = input.artifact;
  const market = buildMarket({
    country: artifact.country,
    city: artifact.city,
    marketCellKey: buildOverviewMarketKey(artifact),
    locale: "en",
  });
  const sourceFingerprint = artifact.artifactKey;
  const base = {
    source: input.source,
    market,
    periodBucket: artifact.capturePeriodBucket,
    platform: artifact.platform,
    propertyType: artifact.propertyType,
    capacityBand: "unknown",
    sampleSizeBand: artifact.sampleBand,
    confidenceBand: mapConfidenceBand(artifact.confidence),
    sourceClass: "public_market_overview",
    sourceFingerprint,
    capturedAt: artifact.windowEndedAt,
    policyVersions: sortStringRecord({
      contract_version: artifact.policyVersions.contractVersion,
      aggregation_policy: artifact.policyVersions.aggregationPolicyVersion,
      governance_policy: artifact.policyVersions.governancePolicyVersion,
      market_cell_policy: artifact.policyVersions.marketCellPolicyVersion,
    }),
    metadata: Object.freeze({
      artifactKey: artifact.artifactKey,
      freshnessStatus: artifact.freshnessStatus,
      exposureStatus: artifact.exposureStatus,
      limitationCodes: [...artifact.limitationCodes].sort(),
    }),
  };

  return Object.freeze(
    [
      {
        factId: hashFingerprint("ipp_public_fact", {
          artifactKey: artifact.artifactKey,
          metricKey: "market_overview.p25",
        }),
        metricFamily: "market_overview",
        metricKey: "market_overview.p25",
        value: artifact.p25,
        unit: artifact.currency,
        band: "p25",
      },
      {
        factId: hashFingerprint("ipp_public_fact", {
          artifactKey: artifact.artifactKey,
          metricKey: "market_overview.median",
        }),
        metricFamily: "market_overview",
        metricKey: "market_overview.median",
        value: artifact.median,
        unit: artifact.currency,
        band: "median",
      },
      {
        factId: hashFingerprint("ipp_public_fact", {
          artifactKey: artifact.artifactKey,
          metricKey: "market_overview.p75",
        }),
        metricFamily: "market_overview",
        metricKey: "market_overview.p75",
        value: artifact.p75,
        unit: artifact.currency,
        band: "p75",
      },
    ].map((metric) =>
      Object.freeze({
        ...base,
        ...metric,
      }),
    ),
  );
}

function buildPricingContribution(
  input: PricingBenchmarkPopulationInput,
  generatedAt: string,
): RegistryPopulationContribution {
  const payload = input.payload;
  const market = buildMarket({
    country: payload.country,
    city: payload.city,
    marketCellKey: payload.market_cell_key,
    locale: "en",
  });
  const content = freezeMetadata({
    benchmarkType: "pricing_distribution",
    currency: payload.currency,
    capturePeriodBucket: payload.capture_period_bucket,
    sourcePeriodStart: payload.source_period_start,
    sourcePeriodEnd: payload.source_period_end,
    distribution: {
      p10: payload.p10_price,
      p25: payload.p25_price,
      median: payload.median_price,
      p75: payload.p75_price,
      p90: payload.p90_price,
    },
    sample: {
      raw: payload.raw_sample_size,
      included: payload.included_sample_size,
      excludedOutliers: payload.excluded_outlier_count,
      sourceClassCount: payload.source_class_count,
      sourceDiversityBand: payload.source_diversity_band,
    },
    approvalStatus: payload.approval_status,
    confidenceLevel: payload.confidence_level,
    limitations: [...payload.limitations].sort(),
  });
  const sourceFingerprint = payload.artifact_key;
  const base = {
    source: input.source,
    sourceFingerprint,
    assetId: `asset_market_pricing_${sanitizeIdentifier(payload.market_cell_key)}`,
    assetKind: "market_pricing_benchmark" as const,
    assetType: "insight_card" as const,
    contentFingerprint: hashFingerprint("ipp_market_pricing_content", content),
    market,
    effectiveAt: payload.valid_from,
    policyVersions: sortStringRecord({
      confidence_policy: payload.confidence_policy_version,
      freshness_policy: payload.freshness_policy_version,
      aggregation_policy: payload.aggregation_policy_version,
      approval_policy: payload.approval_policy_version,
      market_cell_policy: payload.market_cell_policy_version,
    }),
    confidenceBand: mapConfidenceBand(payload.confidence_level),
    assetStatus: "approved" as const,
    assetVisibility: "public" as const,
    versionStatus: "active" as const,
    defaultLocale: "en",
    availableLocales: Object.freeze(["en"]),
    availableChannels: Object.freeze([]),
    canonicalId: `market-pricing-${sanitizeSegment(payload.city)}-${sanitizeSegment(payload.platform)}-${sanitizeSegment(payload.property_type)}-${sanitizeSegment(payload.capacity_band)}`,
    templateId: "tpl_market_pricing_benchmark",
    ownerTeam: "intelligence",
    confidenceAffectsVisibleContent: true,
    policyChangeAffectsVisibleContent: true,
    freshnessExpiryBehavior: "keep_visible" as const,
    content,
    assetMetadata: freezeMetadata({
      marketCellKey: payload.market_cell_key,
      platform: payload.platform,
      propertyType: payload.property_type,
      capacityBand: payload.capacity_band,
      currency: payload.currency,
      source: "pricing_benchmark",
    }),
    versionMetadata: freezeMetadata({
      artifactKey: payload.artifact_key,
      benchmarkType: payload.benchmark_type,
      sourceClassCount: payload.source_class_count,
    }),
    artifactReferences: Object.freeze([
      Object.freeze({
        artifactType: "benchmark" as const,
        artifactId: `benchmark:${payload.market_cell_key}:pricing`,
        artifactFingerprint: payload.artifact_key,
        relationshipType: "supported_by" as const,
        policyVersions: sortStringRecord({
          confidence_policy: payload.confidence_policy_version,
          freshness_policy: payload.freshness_policy_version,
          aggregation_policy: payload.aggregation_policy_version,
          approval_policy: payload.approval_policy_version,
          market_cell_policy: payload.market_cell_policy_version,
        }),
        createdAt: payload.valid_from,
        metadata: freezeMetadata({
          benchmarkType: "pricing_distribution",
        }),
      }),
      ...Object.entries({
        confidence_policy: payload.confidence_policy_version,
        freshness_policy: payload.freshness_policy_version,
        aggregation_policy: payload.aggregation_policy_version,
        approval_policy: payload.approval_policy_version,
        market_cell_policy: payload.market_cell_policy_version,
      }).map(([policyId, version]) =>
        Object.freeze({
          artifactType: "policy" as const,
          artifactId: policyId,
          artifactFingerprint: `${policyId}:${version}`,
          relationshipType: "governed_by" as const,
          policyVersions: sortStringRecord({
            confidence_policy: payload.confidence_policy_version,
            freshness_policy: payload.freshness_policy_version,
            aggregation_policy: payload.aggregation_policy_version,
            approval_policy: payload.approval_policy_version,
            market_cell_policy: payload.market_cell_policy_version,
          }),
          createdAt: payload.valid_from,
          metadata: freezeMetadata({}),
        }),
      ),
    ]),
    freshness: Object.freeze({
      computedAt: payload.valid_from,
      reviewDueAt: addDays(payload.valid_from, 7),
      publishableUntil: payload.valid_until,
      staleAfter: payload.valid_until,
      expiredAfter: payload.valid_until,
      isPublishable: new Date(generatedAt) < new Date(payload.valid_until),
      isStale: new Date(generatedAt) >= new Date(payload.valid_until),
      isExpired: new Date(generatedAt) >= new Date(payload.valid_until),
      evaluatedAt: generatedAt,
    }),
    reportDefinition: null,
  };

  return Object.freeze({
    contributionId: hashFingerprint("ipp_market_pricing_contribution", {
      assetId: base.assetId,
      sourceFingerprint: base.sourceFingerprint,
      contentFingerprint: base.contentFingerprint,
    }),
    ...base,
    versionComparisonFingerprint: hashFingerprint(
      "ipp_market_pricing_version",
      {
        contentFingerprint: base.contentFingerprint,
        sourceFingerprint: base.sourceFingerprint,
        policyVersions: base.policyVersions,
        assetMetadata: base.assetMetadata,
        versionMetadata: base.versionMetadata,
      },
    ),
  });
}

function buildOccupancyContribution(
  input: OccupancyBenchmarkPopulationInput,
  generatedAt: string,
): RegistryPopulationContribution {
  const payload = input.payload;
  const market = buildMarket({
    country: payload.country,
    city: payload.city,
    marketCellKey: payload.market_cell_key,
    locale: "en",
  });
  const content = freezeMetadata({
    benchmarkType: "occupancy_distribution",
    capturePeriodBucket: payload.capture_period_bucket,
    sourcePeriodStart: payload.source_period_start,
    sourcePeriodEnd: payload.source_period_end,
    dominantObservedDaysBand: payload.dominant_observed_days_band,
    dominantUnavailabilityRateBand:
      payload.dominant_unavailability_rate_band,
    observedDaysCounts: {
      "1_6": payload.observed_days_1_6_count,
      "7_13": payload.observed_days_7_13_count,
      "14_29": payload.observed_days_14_29_count,
      "30_59": payload.observed_days_30_59_count,
      "60_plus": payload.observed_days_60_plus_count,
    },
    unavailabilityRateCounts: {
      "0_19": payload.unavailability_0_19_count,
      "20_39": payload.unavailability_20_39_count,
      "40_59": payload.unavailability_40_59_count,
      "60_79": payload.unavailability_60_79_count,
      "80_100": payload.unavailability_80_100_count,
    },
    sample: {
      raw: payload.raw_sample_size,
      included: payload.included_sample_size,
      excludedOutliers: payload.excluded_outlier_count,
      sourceClassCount: payload.source_class_count,
      sourceDiversityBand: payload.source_diversity_band,
    },
    approvalStatus: payload.approval_status,
    confidenceLevel: payload.confidence_level,
    limitations: [...payload.limitations].sort(),
  });
  const sourceFingerprint = payload.artifact_key;
  const base = {
    source: input.source,
    sourceFingerprint,
    assetId: `asset_market_occupancy_${sanitizeIdentifier(payload.market_cell_key)}`,
    assetKind: "market_occupancy_benchmark" as const,
    assetType: "insight_card" as const,
    contentFingerprint: hashFingerprint("ipp_market_occupancy_content", content),
    market,
    effectiveAt: payload.valid_from,
    policyVersions: sortStringRecord({
      confidence_policy: payload.confidence_policy_version,
      freshness_policy: payload.freshness_policy_version,
      aggregation_policy: payload.aggregation_policy_version,
      approval_policy: payload.approval_policy_version,
      market_cell_policy: payload.market_cell_policy_version,
    }),
    confidenceBand: mapConfidenceBand(payload.confidence_level),
    assetStatus: "approved" as const,
    assetVisibility: "public" as const,
    versionStatus: "active" as const,
    defaultLocale: "en",
    availableLocales: Object.freeze(["en"]),
    availableChannels: Object.freeze([]),
    canonicalId: `market-occupancy-${sanitizeSegment(payload.city)}-${sanitizeSegment(payload.platform)}-${sanitizeSegment(payload.property_type)}-${sanitizeSegment(payload.capacity_band)}`,
    templateId: "tpl_market_occupancy_benchmark",
    ownerTeam: "intelligence",
    confidenceAffectsVisibleContent: true,
    policyChangeAffectsVisibleContent: true,
    freshnessExpiryBehavior: "keep_visible" as const,
    content,
    assetMetadata: freezeMetadata({
      marketCellKey: payload.market_cell_key,
      platform: payload.platform,
      propertyType: payload.property_type,
      capacityBand: payload.capacity_band,
      source: "occupancy_benchmark",
    }),
    versionMetadata: freezeMetadata({
      artifactKey: payload.artifact_key,
      benchmarkType: payload.benchmark_type,
      sourceClassCount: payload.source_class_count,
    }),
    artifactReferences: Object.freeze([
      Object.freeze({
        artifactType: "benchmark" as const,
        artifactId: `benchmark:${payload.market_cell_key}:occupancy`,
        artifactFingerprint: payload.artifact_key,
        relationshipType: "supported_by" as const,
        policyVersions: sortStringRecord({
          confidence_policy: payload.confidence_policy_version,
          freshness_policy: payload.freshness_policy_version,
          aggregation_policy: payload.aggregation_policy_version,
          approval_policy: payload.approval_policy_version,
          market_cell_policy: payload.market_cell_policy_version,
        }),
        createdAt: payload.valid_from,
        metadata: freezeMetadata({
          benchmarkType: "occupancy_distribution",
        }),
      }),
      ...Object.entries({
        confidence_policy: payload.confidence_policy_version,
        freshness_policy: payload.freshness_policy_version,
        aggregation_policy: payload.aggregation_policy_version,
        approval_policy: payload.approval_policy_version,
        market_cell_policy: payload.market_cell_policy_version,
      }).map(([policyId, version]) =>
        Object.freeze({
          artifactType: "policy" as const,
          artifactId: policyId,
          artifactFingerprint: `${policyId}:${version}`,
          relationshipType: "governed_by" as const,
          policyVersions: sortStringRecord({
            confidence_policy: payload.confidence_policy_version,
            freshness_policy: payload.freshness_policy_version,
            aggregation_policy: payload.aggregation_policy_version,
            approval_policy: payload.approval_policy_version,
            market_cell_policy: payload.market_cell_policy_version,
          }),
          createdAt: payload.valid_from,
          metadata: freezeMetadata({}),
        }),
      ),
    ]),
    freshness: Object.freeze({
      computedAt: payload.valid_from,
      reviewDueAt: addDays(payload.valid_from, 7),
      publishableUntil: payload.valid_until,
      staleAfter: payload.valid_until,
      expiredAfter: payload.valid_until,
      isPublishable: new Date(generatedAt) < new Date(payload.valid_until),
      isStale: new Date(generatedAt) >= new Date(payload.valid_until),
      isExpired: new Date(generatedAt) >= new Date(payload.valid_until),
      evaluatedAt: generatedAt,
    }),
    reportDefinition: null,
  };

  return Object.freeze({
    contributionId: hashFingerprint("ipp_market_occupancy_contribution", {
      assetId: base.assetId,
      sourceFingerprint: base.sourceFingerprint,
      contentFingerprint: base.contentFingerprint,
    }),
    ...base,
    versionComparisonFingerprint: hashFingerprint(
      "ipp_market_occupancy_version",
      {
        contentFingerprint: base.contentFingerprint,
        sourceFingerprint: base.sourceFingerprint,
        policyVersions: base.policyVersions,
        assetMetadata: base.assetMetadata,
        versionMetadata: base.versionMetadata,
      },
    ),
  });
}

function buildOverviewContribution(
  input: PublicMarketOverviewPopulationInput,
  generatedAt: string,
): RegistryPopulationContribution {
  const artifact = input.artifact;
  const market = buildMarket({
    country: artifact.country,
    city: artifact.city,
    marketCellKey: buildOverviewMarketKey(artifact),
    locale: "en",
  });
  const content = freezeMetadata({
    benchmarkType: "public_market_overview",
    aggregationWindow: artifact.aggregationWindow,
    platformScope: artifact.platformScope,
    propertyScope: artifact.propertyScope,
    capacityScope: artifact.capacityScope,
    currency: artifact.currency,
    capturePeriodBucket: artifact.capturePeriodBucket,
    windowStartedAt: artifact.windowStartedAt,
    windowEndedAt: artifact.windowEndedAt,
    distribution: {
      p25: artifact.p25,
      median: artifact.median,
      p75: artifact.p75,
    },
    sampleBand: artifact.sampleBand,
    confidence: artifact.confidence,
    freshnessStatus: artifact.freshnessStatus,
    exposureStatus: artifact.exposureStatus,
    limitations: [...artifact.limitationCodes].sort(),
  });
  const sourceFingerprint = artifact.artifactKey;
  const base = {
    source: input.source,
    sourceFingerprint,
    assetId: `asset_market_overview_${sanitizeIdentifier(buildOverviewMarketKey(artifact))}`,
    assetKind: "market_overview" as const,
    assetType: "insight_card" as const,
    contentFingerprint: hashFingerprint("ipp_market_overview_content", content),
    market,
    effectiveAt: artifact.windowEndedAt,
    policyVersions: sortStringRecord({
      contract_version: artifact.policyVersions.contractVersion,
      aggregation_policy: artifact.policyVersions.aggregationPolicyVersion,
      governance_policy: artifact.policyVersions.governancePolicyVersion,
      market_cell_policy: artifact.policyVersions.marketCellPolicyVersion,
    }),
    confidenceBand: mapConfidenceBand(artifact.confidence),
    assetStatus: "approved" as const,
    assetVisibility: "public" as const,
    versionStatus: "active" as const,
    defaultLocale: "en",
    availableLocales: Object.freeze(["en"]),
    availableChannels: Object.freeze([]),
    canonicalId: `market-overview-${sanitizeSegment(artifact.city)}-${sanitizeSegment(artifact.platform)}-${sanitizeSegment(artifact.propertyType)}`,
    templateId: "tpl_market_overview",
    ownerTeam: "intelligence",
    confidenceAffectsVisibleContent: true,
    policyChangeAffectsVisibleContent: true,
    freshnessExpiryBehavior: "keep_visible" as const,
    content,
    assetMetadata: freezeMetadata({
      platform: artifact.platform,
      propertyType: artifact.propertyType,
      currency: artifact.currency,
      source: "public_market_overview",
      exposureStatus: artifact.exposureStatus,
    }),
    versionMetadata: freezeMetadata({
      artifactKey: artifact.artifactKey,
      intendedUse: artifact.intendedUse,
      aggregationWindow: artifact.aggregationWindow,
    }),
    artifactReferences: Object.freeze([
      Object.freeze({
        artifactType: "public_overview" as const,
        artifactId: `overview:${artifact.country}:${artifact.city}:${artifact.platform}:${artifact.propertyType}`,
        artifactFingerprint: artifact.artifactKey,
        relationshipType: "supported_by" as const,
        policyVersions: sortStringRecord({
          contract_version: artifact.policyVersions.contractVersion,
          aggregation_policy: artifact.policyVersions.aggregationPolicyVersion,
          governance_policy: artifact.policyVersions.governancePolicyVersion,
          market_cell_policy: artifact.policyVersions.marketCellPolicyVersion,
        }),
        createdAt: artifact.windowEndedAt,
        metadata: freezeMetadata({
          intendedUse: artifact.intendedUse,
        }),
      }),
      ...Object.entries({
        contract_version: artifact.policyVersions.contractVersion,
        aggregation_policy: artifact.policyVersions.aggregationPolicyVersion,
        governance_policy: artifact.policyVersions.governancePolicyVersion,
        market_cell_policy: artifact.policyVersions.marketCellPolicyVersion,
      }).map(([policyId, version]) =>
        Object.freeze({
          artifactType: "policy" as const,
          artifactId: policyId,
          artifactFingerprint: `${policyId}:${version}`,
          relationshipType: "governed_by" as const,
          policyVersions: sortStringRecord({
            contract_version: artifact.policyVersions.contractVersion,
            aggregation_policy: artifact.policyVersions.aggregationPolicyVersion,
            governance_policy: artifact.policyVersions.governancePolicyVersion,
            market_cell_policy: artifact.policyVersions.marketCellPolicyVersion,
          }),
          createdAt: artifact.windowEndedAt,
          metadata: freezeMetadata({}),
        }),
      ),
    ]),
    freshness: Object.freeze({
      computedAt: artifact.windowEndedAt,
      reviewDueAt: addDays(artifact.windowEndedAt, 7),
      publishableUntil: addDays(artifact.windowEndedAt, 90),
      staleAfter: addDays(artifact.windowEndedAt, 30),
      expiredAfter: addDays(artifact.windowEndedAt, 90),
      isPublishable: true,
      isStale: artifact.freshnessStatus === "aging",
      isExpired: false,
      evaluatedAt: generatedAt,
    }),
    reportDefinition: null,
  };

  return Object.freeze({
    contributionId: hashFingerprint("ipp_market_overview_contribution", {
      assetId: base.assetId,
      sourceFingerprint: base.sourceFingerprint,
      contentFingerprint: base.contentFingerprint,
    }),
    ...base,
    versionComparisonFingerprint: hashFingerprint(
      "ipp_market_overview_version",
      {
        contentFingerprint: base.contentFingerprint,
        sourceFingerprint: base.sourceFingerprint,
        policyVersions: base.policyVersions,
        assetMetadata: base.assetMetadata,
        versionMetadata: base.versionMetadata,
      },
    ),
  });
}

function validatePricingPayload(payload: PricingBenchmarkArtifactPayload): boolean {
  return (
    typeof payload.artifact_key === "string" &&
    payload.artifact_key.trim().length > 0 &&
    typeof payload.market_cell_key === "string" &&
    payload.market_cell_key.trim().length > 0 &&
    typeof payload.country === "string" &&
    payload.country.trim().length > 0 &&
    typeof payload.city === "string" &&
    payload.city.trim().length > 0 &&
    typeof payload.p25_price === "number" &&
    Number.isFinite(payload.p25_price) &&
    typeof payload.median_price === "number" &&
    Number.isFinite(payload.median_price) &&
    typeof payload.p75_price === "number" &&
    Number.isFinite(payload.p75_price)
  );
}

function validatePublicMarketOverviewArtifact(
  artifact: PublicMarketOverviewArtifact,
): boolean {
  return (
    typeof artifact.artifactKey === "string" &&
    artifact.artifactKey.trim().length > 0 &&
    typeof artifact.country === "string" &&
    artifact.country.trim().length > 0 &&
    typeof artifact.city === "string" &&
    artifact.city.trim().length > 0 &&
    typeof artifact.platform === "string" &&
    artifact.platform.trim().length > 0 &&
    typeof artifact.propertyType === "string" &&
    artifact.propertyType.trim().length > 0 &&
    typeof artifact.currency === "string" &&
    artifact.currency.trim().length > 0 &&
    Number.isFinite(artifact.p25) &&
    Number.isFinite(artifact.median) &&
    Number.isFinite(artifact.p75)
  );
}

export function buildPublicSafePopulationArtifacts(
  input: PublicSafePopulationInput,
  options: BuildArtifactsOptions,
): PublicSafePopulationArtifacts {
  if (input.datasetType === "pricing_benchmark") {
    if (!validatePricingPayload(input.payload)) {
      return Object.freeze({
        facts: Object.freeze([]),
        contributions: Object.freeze([]),
        diagnostics: Object.freeze([
          buildDiagnostic({
            code: "invalid_source_input",
            severity: "error",
            marketCellKey: input.payload.market_cell_key ?? null,
            message: "Invalid pricing benchmark payload.",
          }),
        ]),
        skipped: buildSkipped(
          input,
          "invalid_source_input",
          "Invalid pricing benchmark payload.",
          input.payload.market_cell_key ?? null,
        ),
      });
    }

    const facts = buildPricingFacts(input);
    const contribution = buildPricingContribution(input, options.generatedAt);
    return Object.freeze({
      facts,
      contributions: Object.freeze([contribution]),
      diagnostics: Object.freeze([]),
      skipped: null,
    });
  }

  if (input.datasetType === "occupancy_benchmark") {
    const validation = validateOccupancyBenchmarkArtifact({
      artifactKey: input.payload.artifact_key,
      artifactContractVersion: input.payload.artifact_contract_version,
      benchmarkType: input.payload.benchmark_type,
      approvalStatus: input.payload.approval_status,
      country: input.payload.country,
      city: input.payload.city,
      platform: input.payload.platform,
      propertyType: input.payload.property_type,
      capacityBand: input.payload.capacity_band,
      currency: "UNKNOWN",
      marketCellKey: input.payload.market_cell_key,
      capturePeriodBucket: input.payload.capture_period_bucket,
      sourcePeriodStart: input.payload.source_period_start,
      sourcePeriodEnd: input.payload.source_period_end,
      cohortDefinitionVersion: input.payload.cohort_definition_version,
      sourceClassCount: input.payload.source_class_count,
      sourceDiversityBand: input.payload.source_diversity_band,
      distribution: {
        observedDaysCounts: {
          "1_6": input.payload.observed_days_1_6_count,
          "7_13": input.payload.observed_days_7_13_count,
          "14_29": input.payload.observed_days_14_29_count,
          "30_59": input.payload.observed_days_30_59_count,
          "60_plus": input.payload.observed_days_60_plus_count,
        },
        unavailabilityRateCounts: {
          "0_19": input.payload.unavailability_0_19_count,
          "20_39": input.payload.unavailability_20_39_count,
          "40_59": input.payload.unavailability_40_59_count,
          "60_79": input.payload.unavailability_60_79_count,
          "80_100": input.payload.unavailability_80_100_count,
        },
        dominantObservedDaysBand: input.payload.dominant_observed_days_band,
        dominantUnavailabilityRateBand:
          input.payload.dominant_unavailability_rate_band,
      },
      rawSampleSize: input.payload.raw_sample_size,
      includedSampleSize: input.payload.included_sample_size,
      excludedOutlierCount: input.payload.excluded_outlier_count,
      outlierPolicyVersion: input.payload.outlier_policy_version,
      confidenceLevel: input.payload.confidence_level,
      confidencePolicyVersion: input.payload.confidence_policy_version,
      validFrom: input.payload.valid_from,
      validUntil: input.payload.valid_until,
      freshnessPolicyVersion: input.payload.freshness_policy_version,
      approvedForInternal: input.payload.approved_for_internal,
      approvedForAudit: input.payload.approved_for_audit,
      limitations: input.payload.limitations,
      cohortPolicyVersion: input.payload.cohort_policy_version,
      aggregationPolicyVersion: input.payload.aggregation_policy_version,
      approvalPolicyVersion: input.payload.approval_policy_version,
      marketCellPolicyVersion: input.payload.market_cell_policy_version,
      supersedesArtifactId: input.payload.supersedes_artifact_id,
    });

    if (!validation.valid) {
      return Object.freeze({
        facts: Object.freeze([]),
        contributions: Object.freeze([]),
        diagnostics: Object.freeze([
          buildDiagnostic({
            code: "invalid_source_input",
            severity: "error",
            marketCellKey: input.payload.market_cell_key ?? null,
            message: "Invalid occupancy benchmark payload.",
          }),
        ]),
        skipped: buildSkipped(
          input,
          "invalid_source_input",
          "Invalid occupancy benchmark payload.",
          input.payload.market_cell_key ?? null,
        ),
      });
    }

    const facts = buildOccupancyFacts(input);
    const contribution = buildOccupancyContribution(input, options.generatedAt);
    return Object.freeze({
      facts,
      contributions: Object.freeze([contribution]),
      diagnostics: Object.freeze([]),
      skipped: null,
    });
  }

  if (!validatePublicMarketOverviewArtifact(input.artifact)) {
    return Object.freeze({
      facts: Object.freeze([]),
      contributions: Object.freeze([]),
      diagnostics: Object.freeze([
        buildDiagnostic({
          code: "invalid_source_input",
          severity: "error",
          marketCellKey: input.artifact.artifactKey ?? null,
          message: "Invalid public market overview artifact.",
        }),
      ]),
      skipped: buildSkipped(
        input,
        "invalid_source_input",
        "Invalid public market overview artifact.",
        input.artifact.artifactKey ?? null,
      ),
    });
  }

  const facts = buildOverviewFacts(input);
  const contribution = buildOverviewContribution(input, options.generatedAt);
  return Object.freeze({
    facts,
    contributions: Object.freeze([contribution]),
    diagnostics: Object.freeze([]),
    skipped: null,
  });
}
