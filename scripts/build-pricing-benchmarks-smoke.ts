import assert from "node:assert/strict";

import {
  formatPricingBenchmarkBackfillDryRunReport,
  parsePricingBenchmarkBackfillCliArgs,
  runPricingBenchmarkBackfillApply,
  runPricingBenchmarkBackfillDryRun,
  type PricingBenchmarkBackfillCliOptions,
  type PricingBenchmarkBackfillFactRow,
} from "../lib/intelligenceV2/pricingBenchmarkBackfill";
import {
  buildMarketCellKey,
  type IntelligenceV2CapacityBand,
  type IntelligenceV2Platform,
  type IntelligenceV2PropertyType,
} from "../lib/intelligenceV2/marketCell";
import type { PricingBenchmarkBuilderResult } from "../lib/intelligenceV2/pricingBenchmarkBuilder";
import type { PricingBenchmarkGovernanceResult } from "../lib/intelligenceV2/pricingBenchmarkGovernance";

function buildOptions(
  overrides: Partial<PricingBenchmarkBackfillCliOptions> = {},
): PricingBenchmarkBackfillCliOptions {
  return {
    country: null,
    city: null,
    platform: null,
    propertyType: null,
    capacityBand: null,
    currency: null,
    capturePeriodBucket: null,
    limit: null,
    mode: "dry_run",
    confirmWrite: false,
    ...overrides,
  };
}

function buildRow(
  overrides: Partial<PricingBenchmarkBackfillFactRow> = {},
): PricingBenchmarkBackfillFactRow {
  const country = overrides.country ?? "ma";
  const city = overrides.city ?? "marrakech";
  const platform = (overrides.platform ?? "airbnb") as IntelligenceV2Platform;
  const propertyType = (overrides.property_type ??
    "unknown") as IntelligenceV2PropertyType;
  const capacityBand = (overrides.capacity_band ??
    "unknown") as IntelligenceV2CapacityBand;
  const currency = overrides.currency ?? "EUR";

  return {
    market_cell_key:
      overrides.market_cell_key ??
      buildMarketCellKey({
        country,
        city,
        platform,
        propertyType,
        capacityBand,
        currency,
      }),
    country,
    city,
    platform,
    property_type: propertyType,
    capacity_band: capacityBand,
    currency,
    capture_period_bucket: "2026-05",
    normalized_nightly_price: 120,
    source_class: "authenticated_audit",
    confidence_input_band: "unknown",
    freshness_input_band: "recent",
    transformation_policy_version: "v1",
    created_at: "2026-05-20T00:00:00.000Z",
    fact_contract_version: "v1",
    eligibility_policy_version: "v1",
    deduplication_policy_version: "v1",
    market_cell_policy_version: "v1",
    pricing_normalization_policy_version: "v1",
    confidence_policy_version: "v1",
    freshness_policy_version: "v1",
    source_quality_band: "unknown",
    ...overrides,
  };
}

function buildBuilderResult(
  overrides: Partial<PricingBenchmarkBuilderResult> = {},
): PricingBenchmarkBuilderResult {
  return {
    status: "dry_run",
    marketCellKey: "v1|ma|marrakech|airbnb|unknown|unknown|EUR",
    capturePeriodBucket: "2026-05",
    rawSampleSize: 9,
    includedSampleSize: 9,
    excludedOutlierCount: 0,
    sourceClassCount: 1,
    sourceDiversityBand: "low",
    confidenceLevel: "moderate",
    approvalStatus: "exploratory",
    limitations: ["small_sample", "low_source_diversity", "unknown_property_type", "unknown_capacity"],
    artifactKey: "artifact-key",
    inserted: false,
    supersedesArtifactId: null,
    reasonCodes: [],
    p10Price: 100,
    p25Price: 110,
    medianPrice: 120,
    p75Price: 130,
    p90Price: 140,
    ...overrides,
  };
}

function buildGovernance(
  overrides: Partial<PricingBenchmarkGovernanceResult> = {},
): PricingBenchmarkGovernanceResult {
  return {
    accepted: true,
    decision: "internal_only",
    approvedUses: ["internal_analysis"],
    riskLevel: "moderate",
    qualityBand: "moderate",
    stabilityBand: "stable",
    representativenessBand: "low",
    freshnessBand: "aging",
    reasonCodes: ["artifact_not_audit_approved", "low_source_diversity"],
    limitationCodes: ["small_sample", "low_source_diversity"],
    policyVersions: {
      governanceContractVersion: "v1",
      qualityPolicyVersion: "v1",
      usagePolicyVersion: "v1",
    },
    evaluatedAt: "2026-07-14T00:00:00.000Z",
    ...overrides,
  } as PricingBenchmarkGovernanceResult;
}

async function main() {
  const parsed = parsePricingBenchmarkBackfillCliArgs([]);
  assert.equal(parsed.mode, "dry_run");

  assert.throws(
    () => parsePricingBenchmarkBackfillCliArgs(["--apply"]),
    /Apply mode requires --confirm-write\./,
  );
  assert.throws(
    () =>
      parsePricingBenchmarkBackfillCliArgs([
        "--apply",
        "--confirm-write",
      ]),
    /Apply mode requires an explicit perimeter/,
  );
  assert.throws(
    () =>
      parsePricingBenchmarkBackfillCliArgs([
        "--dry-run",
        "--apply",
        "--confirm-write",
        "--country=ma",
        "--city=marrakech",
        "--platform=airbnb",
      ]),
    /`--dry-run` and `--apply` cannot be used together\./,
  );

  const rows = Array.from({ length: 9 }, (_, index) =>
    buildRow({ normalized_nightly_price: 100 + index * 10 }),
  );

  const dryRunReport = await runPricingBenchmarkBackfillDryRun({
    options: buildOptions({
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
    }),
    rows,
    dependencies: {
      pricingBuilder: async () => buildBuilderResult(),
      evaluateGovernance: () => buildGovernance(),
    },
  });

  assert.equal(dryRunReport.cellsScanned, 1);
  assert.equal(dryRunReport.cells[0]?.factsCount, 9);
  assert.equal(dryRunReport.cells[0]?.approvalStatus, "exploratory");
  assert.equal(dryRunReport.cells[0]?.exposure, "internal_only");
  assert.equal(dryRunReport.cells[0]?.wouldWriteArtifact, true);

  const insufficientRows = Array.from({ length: 3 }, (_, index) =>
    buildRow({
      property_type: "villa",
      capacity_band: "10_plus",
      capture_period_bucket: "2026-07",
      normalized_nightly_price: 200 + index * 25,
    }),
  );
  const insufficientReport = await runPricingBenchmarkBackfillDryRun({
    options: buildOptions({
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
    }),
    rows: insufficientRows,
    dependencies: {
      pricingBuilder: async () =>
        buildBuilderResult({
          capturePeriodBucket: "2026-07",
          marketCellKey: "v1|ma|marrakech|airbnb|villa|10_plus|EUR",
          rawSampleSize: 3,
          includedSampleSize: 3,
          sourceClassCount: 1,
          approvalStatus: "insufficient",
          confidenceLevel: "very_low",
          limitations: ["small_sample"],
          p10Price: 200,
          p25Price: 212.5,
          medianPrice: 225,
          p75Price: 237.5,
          p90Price: 245,
        }),
      evaluateGovernance: () =>
        buildGovernance({
          accepted: false,
          decision: "quarantined",
          approvedUses: [],
          riskLevel: "high",
          qualityBand: "low",
          freshnessBand: "aging",
          reasonCodes: ["sample_too_small"],
        }),
    },
  });
  assert.equal(insufficientReport.cells[0]?.wouldWriteArtifact, false);
  assert.equal(insufficientReport.cells[0]?.artifactStatus, "insufficient");

  const multiSourceRows = [
    buildRow(),
    buildRow({ source_class: "authenticated_listing" }),
  ];
  const multiSourceReport = await runPricingBenchmarkBackfillDryRun({
    options: buildOptions({
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
    }),
    rows: multiSourceRows,
    dependencies: {
      pricingBuilder: async () =>
        buildBuilderResult({
          rawSampleSize: 2,
          includedSampleSize: 2,
          sourceClassCount: 2,
          sourceDiversityBand: "moderate",
          approvalStatus: "insufficient",
        }),
      evaluateGovernance: () =>
        buildGovernance({
          accepted: false,
          decision: "quarantined",
          approvedUses: [],
          riskLevel: "high",
          qualityBand: "low",
          reasonCodes: ["sample_too_small"],
        }),
    },
  });
  assert.equal(multiSourceReport.cells[0]?.sourceClassCount, 2);

  const applyReport = await runPricingBenchmarkBackfillApply({
    options: buildOptions({
      mode: "apply",
      confirmWrite: true,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
    }),
    rows,
    dependencies: {
      pricingBuilder: async () =>
        buildBuilderResult({
          status: "inserted",
          inserted: true,
        }),
      evaluateGovernance: () => buildGovernance(),
    },
  });
  assert.equal(applyReport.inserted, 1);
  assert.equal(applyReport.writeAttempted, 1);

  const secondApplyReport = await runPricingBenchmarkBackfillApply({
    options: buildOptions({
      mode: "apply",
      confirmWrite: true,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
    }),
    rows,
    dependencies: {
      pricingBuilder: async () =>
        buildBuilderResult({
          status: "already_exists",
          inserted: false,
          reasonCodes: ["artifact_already_exists"],
        }),
      evaluateGovernance: () => buildGovernance(),
    },
  });
  assert.equal(secondApplyReport.alreadyExisting, 1);
  assert.equal(secondApplyReport.inserted, 0);

  const failedApplyReport = await runPricingBenchmarkBackfillApply({
    options: buildOptions({
      mode: "apply",
      confirmWrite: true,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
    }),
    rows,
    dependencies: {
      pricingBuilder: async () =>
        buildBuilderResult({
          status: "failed",
          inserted: false,
          reasonCodes: ["database_insert_error"],
        }),
      evaluateGovernance: () => buildGovernance(),
    },
  });
  assert.equal(failedApplyReport.failed, 1);

  const reportText = formatPricingBenchmarkBackfillDryRunReport(dryRunReport);
  assert.ok(!reportText.includes("fact_key"));
  assert.ok(!reportText.includes("http://"));
  assert.ok(!reportText.includes("listing_id"));

  const backfillSource = await import("../lib/intelligenceV2/pricingBenchmarkBackfill");
  assert.ok(backfillSource);

  console.log("PASS — Pricing benchmark build smoke");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
