import {
  buildBenchmarkArtifactKey,
  type BenchmarkArtifactIdentityInput,
} from "../lib/intelligenceV2/benchmarkArtifactIdentity";
import {
  buildPricingBenchmarkLimitations,
  buildPricingBenchmarkPreview,
  computeContinuousPercentile,
  computePricingDistribution,
  derivePricingBenchmarkApproval,
  derivePricingBenchmarkConfidenceLevel,
  getPricingBenchmarkPeriodBounds,
} from "../lib/intelligenceV2/pricingBenchmarkBuilder";
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
} from "../lib/intelligenceV2/policyVersions";

function fail(message: string): never {
  throw new Error(message);
}

function expect(condition: boolean, message: string): void {
  if (!condition) {
    fail(message);
  }
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  expect(actual === expected, `${message}: expected ${expected}, got ${actual}`);
}

function buildIdentityInput(
  overrides: Partial<BenchmarkArtifactIdentityInput> = {},
): BenchmarkArtifactIdentityInput {
  return {
    benchmarkType: "pricing_distribution",
    marketCellKey: "v1|morocco|marrakech|booking|apartment|4_6|eur",
    capturePeriodBucket: "2026-07",
    sourcePeriodStart: "2026-07-01",
    sourcePeriodEnd: "2026-07-31",
    p10Price: 100,
    p25Price: 125,
    medianPrice: 150,
    p75Price: 175,
    p90Price: 200,
    rawSampleSize: 20,
    includedSampleSize: 20,
    excludedOutlierCount: 0,
    sourceClassCount: 2,
    sourceDiversityBand: "moderate",
    confidenceLevel: "high",
    approvalStatus: "audit_approved",
    limitations: [],
    artifactContractVersion: INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
    cohortDefinitionVersion: INTELLIGENCE_V2_COHORT_DEFINITION_VERSION,
    cohortPolicyVersion: INTELLIGENCE_V2_COHORT_POLICY_VERSION,
    aggregationPolicyVersion: INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
    outlierPolicyVersion: INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
    confidencePolicyVersion: INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
    freshnessPolicyVersion: INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
    approvalPolicyVersion: INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
    marketCellPolicyVersion: INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
    ...overrides,
  };
}

function buildSourceRow(
  nightlyPrice: number,
  overrides: Partial<Record<string, string | number>> = {},
) {
  return {
    country: "Morocco",
    city: "Marrakech",
    platform: "booking",
    property_type: "apartment",
    capacity_band: "4_6",
    currency: "EUR",
    market_cell_key: "v1|morocco|marrakech|booking|apartment|4_6|eur",
    normalized_nightly_price: nightlyPrice,
    source_class: "authenticated_audit",
    fact_contract_version: "v1",
    transformation_policy_version: "v1",
    eligibility_policy_version: "v1",
    deduplication_policy_version: "v1",
    market_cell_policy_version: "v1",
    pricing_normalization_policy_version: "v1",
    confidence_policy_version: "v1",
    freshness_policy_version: "v1",
    source_quality_band: "high",
    freshness_input_band: "fresh",
    confidence_input_band: "high",
    ...overrides,
  };
}

async function main() {
  expectEqual(computeContinuousPercentile([123.45], 0.5), 123.45, "single value percentile");
  expectEqual(computeContinuousPercentile([100, 200], 0.5), 150, "two value median");
  expectEqual(
    computeContinuousPercentile([100, 200, 300, 400], 0.25),
    175,
    "interpolated percentile",
  );

  const distribution = computePricingDistribution([100, 200, 300, 400]);
  expect(distribution != null, "distribution should be computed");
  if (distribution == null) {
    fail("distribution should be computed");
  }
  expect(
    distribution.p10Price <= distribution.p25Price &&
      distribution.p25Price <= distribution.medianPrice &&
      distribution.medianPrice <= distribution.p75Price &&
      distribution.p75Price <= distribution.p90Price,
    "distribution should stay ordered",
  );
  expectEqual(distribution.p10Price, 130, "p10 should round to 2 decimals");

  expectEqual(
    derivePricingBenchmarkApproval({
      includedSampleSize: 4,
      confidenceLevel: "very_low",
      sourceClassCount: 1,
      propertyType: "apartment",
      capacityBand: "4_6",
    }).approvalStatus,
    "insufficient",
    "sample below five should be insufficient",
  );
  expectEqual(
    derivePricingBenchmarkApproval({
      includedSampleSize: 6,
      confidenceLevel: "low",
      sourceClassCount: 1,
      propertyType: "apartment",
      capacityBand: "4_6",
    }).approvalStatus,
    "exploratory",
    "sample five to nine should be exploratory",
  );
  expectEqual(
    derivePricingBenchmarkApproval({
      includedSampleSize: 12,
      confidenceLevel: "moderate",
      sourceClassCount: 2,
      propertyType: "apartment",
      capacityBand: "4_6",
    }).approvalStatus,
    "internal_approved",
    "sample ten to nineteen should be internal approved",
  );
  expectEqual(
    derivePricingBenchmarkApproval({
      includedSampleSize: 24,
      confidenceLevel: "high",
      sourceClassCount: 2,
      propertyType: "apartment",
      capacityBand: "4_6",
    }).approvalStatus,
    "audit_approved",
    "healthy 20+ sample should be audit approved",
  );
  expectEqual(
    derivePricingBenchmarkApproval({
      includedSampleSize: 24,
      confidenceLevel: "high",
      sourceClassCount: 1,
      propertyType: "apartment",
      capacityBand: "4_6",
    }).approvalStatus,
    "internal_approved",
    "20+ with low diversity should remain internal approved",
  );

  expectEqual(
    derivePricingBenchmarkConfidenceLevel({
      includedSampleSize: 25,
      sourceClassCount: 1,
      propertyType: "apartment",
      capacityBand: "4_6",
    }),
    "moderate",
    "low diversity should downgrade confidence",
  );
  expectEqual(
    derivePricingBenchmarkConfidenceLevel({
      includedSampleSize: 25,
      sourceClassCount: 2,
      propertyType: "unknown",
      capacityBand: "4_6",
    }),
    "moderate",
    "unknown property should downgrade confidence",
  );
  expectEqual(
    derivePricingBenchmarkConfidenceLevel({
      includedSampleSize: 25,
      sourceClassCount: 2,
      propertyType: "apartment",
      capacityBand: "unknown",
    }),
    "moderate",
    "unknown capacity should downgrade confidence",
  );

  const limitations = buildPricingBenchmarkLimitations({
    includedSampleSize: 8,
    sourceClassCount: 1,
    propertyType: "unknown",
    capacityBand: "unknown",
    validUntil: "2026-08-31T23:59:59.999Z",
    now: new Date("2026-09-01T00:00:00.000Z"),
  });
  expectEqual(
    limitations.join(","),
    "aging_data,low_source_diversity,small_sample,unknown_capacity,unknown_property_type",
    "limitations should be sorted",
  );

  const stableLeft = buildBenchmarkArtifactKey(buildIdentityInput({ limitations: ["aging_data", "small_sample"] }));
  const stableRight = buildBenchmarkArtifactKey(
    buildIdentityInput({ limitations: ["small_sample", "aging_data"] }),
  );
  expect(stableLeft.ok && stableRight.ok, "artifact keys should build");
  if (!stableLeft.ok || !stableRight.ok) {
    fail("artifact keys should build");
  }
  expectEqual(
    stableLeft.artifactKey,
    stableRight.artifactKey,
    "limitations order should not affect artifact key",
  );

  const changed = buildBenchmarkArtifactKey(buildIdentityInput({ p90Price: 205 }));
  expect(changed.ok, "changed identity should still build");
  if (!changed.ok) {
    fail("changed identity should still build");
  }
  expect(
    changed.artifactKey !== stableLeft.artifactKey,
    "different payload should change artifact key",
  );

  const periodBounds = getPricingBenchmarkPeriodBounds("2026-07");
  expect(periodBounds != null, "period bounds should be built");
  if (periodBounds == null) {
    fail("period bounds should be built");
  }
  expectEqual(periodBounds.sourcePeriodStart, "2026-07-01", "source start should be first day");
  expectEqual(periodBounds.sourcePeriodEnd, "2026-07-31", "source end should be last day");
  expectEqual(
    periodBounds.validFrom,
    "2026-08-01T00:00:00.000Z",
    "valid from should be next month start",
  );
  expectEqual(
    periodBounds.validUntil,
    "2026-08-31T23:59:59.999Z",
    "valid until should be next month end",
  );

  const preview = buildPricingBenchmarkPreview({
    marketCellKey: "v1|morocco|marrakech|booking|apartment|4_6|eur",
    capturePeriodBucket: "2026-07",
    rows: Array.from({ length: 20 }, (_, index) =>
      buildSourceRow(100 + index * 10, {
        source_class: index % 2 === 0 ? "authenticated_audit" : "authenticated_listing",
      }),
    ),
    now: new Date("2026-08-15T12:00:00.000Z"),
  });
  expect(preview.ok, "preview should succeed");
  if (!preview.ok) {
    fail("preview should succeed");
  }
  expectEqual(preview.rawSampleSize, 20, "preview raw size");
  expectEqual(preview.includedSampleSize, 20, "preview included size");
  expectEqual(preview.excludedOutlierCount, 0, "preview should not exclude outliers");
  expectEqual(preview.approvalStatus, "audit_approved", "healthy preview should approve audit");

  console.log("PASS — Intelligence v2 Pricing Benchmark smoke");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
