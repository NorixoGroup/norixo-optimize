import assert from "node:assert/strict";

import {
  buildMarketCellKey,
} from "../lib/intelligenceV2/marketCell";
import {
  buildOccupancyDistributionBenchmark,
  type OccupancyAnonymousFactGroupSourceRow,
} from "../lib/intelligenceV2/occupancyBenchmarkBuilder";

const MARKET_CELL_KEY = buildMarketCellKey({
  country: "Morocco",
  city: "Marrakech",
  platform: "booking",
  propertyType: "apartment",
  capacityBand: "4_6",
  currency: "unknown",
});

const BASE_ROW: OccupancyAnonymousFactGroupSourceRow = Object.freeze({
  country: "Morocco",
  city: "Marrakech",
  platform: "booking",
  property_type: "apartment",
  capacity_band: "4_6",
  currency: "UNKNOWN",
  market_cell_key: MARKET_CELL_KEY,
  metric_family: "occupancy",
  observed_days_band: "30_59",
  unavailability_rate_band: "40_59",
  capture_period_bucket: "2026-07",
  source_class: "authenticated_audit",
  source_quality_band: "high",
  fact_contract_version: "v1",
  transformation_policy_version: "v1",
  eligibility_policy_version: "v1",
  deduplication_policy_version: "v1",
  market_cell_policy_version: "v1",
  confidence_policy_version: "v1",
  freshness_policy_version: "v1",
  normalized_nightly_price: null,
  price_band: null,
  pricing_normalization_policy_version: null,
});

function buildRow(
  index: number,
  overrides: Partial<OccupancyAnonymousFactGroupSourceRow> = {},
): OccupancyAnonymousFactGroupSourceRow {
  return Object.freeze({
    ...BASE_ROW,
    source_class:
      index % 2 === 0
        ? "authenticated_audit"
        : "authenticated_listing",
    observed_days_band:
      index % 3 === 0 ? "14_29" : "30_59",
    unavailability_rate_band:
      index % 4 === 0 ? "60_79" : "40_59",
    ...overrides,
  });
}

function buildRows(
  count: number,
  overrides: Partial<OccupancyAnonymousFactGroupSourceRow> = {},
): ReadonlyArray<OccupancyAnonymousFactGroupSourceRow> {
  return Array.from({ length: count }, (_, index) =>
    buildRow(index, overrides),
  );
}

function buildEnv(
  enabled: boolean,
): Readonly<Record<string, string | undefined>> {
  return {
    ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION: enabled
      ? "true"
      : "false",
    DEBUG_INTELLIGENCE_V2: "false",
  };
}

async function main() {
  let invalidInputLoadCalls = 0;
  const invalidInput =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: "",
        capturePeriodBucket: "2026-07",
      },
      {
        loadFacts: async () => {
          invalidInputLoadCalls += 1;
          return { ok: true, rows: [] };
        },
      },
    );
  assert.equal(invalidInput.status, "failed");
  assert.deepEqual(
    invalidInput.reasonCodes,
    ["invalid_input"],
  );
  assert.equal(invalidInputLoadCalls, 0);

  let disabledLoadCalls = 0;
  const disabled =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
      },
      {
        env: buildEnv(false),
        loadFacts: async () => {
          disabledLoadCalls += 1;
          return { ok: true, rows: buildRows(20) };
        },
      },
    );
  assert.equal(disabled.status, "disabled");
  assert.deepEqual(disabled.reasonCodes, [
    "flag_disabled",
  ]);
  assert.equal(disabledLoadCalls, 0);

  const writeRejected =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
        dryRun: false,
      },
      {
        env: buildEnv(true),
      },
    );
  assert.equal(writeRejected.status, "failed");
  assert.deepEqual(
    writeRejected.reasonCodes,
    ["invalid_input"],
  );

  const missingLoader =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
      },
      {
        env: buildEnv(true),
      },
    );
  assert.equal(missingLoader.status, "failed");
  assert.deepEqual(
    missingLoader.reasonCodes,
    ["database_read_error"],
  );

  const loadFailure =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({ ok: false }),
      },
    );
  assert.equal(loadFailure.status, "failed");
  assert.deepEqual(
    loadFailure.reasonCodes,
    ["database_read_error"],
  );

  const loadThrow =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
      },
      {
        env: buildEnv(true),
        loadFacts: async () => {
          throw new Error("boom");
        },
      },
    );
  assert.equal(loadThrow.status, "failed");
  assert.deepEqual(
    loadThrow.reasonCodes,
    ["database_read_error"],
  );

  const noFacts =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: [],
        }),
      },
    );
  assert.equal(noFacts.status, "failed");
  assert.deepEqual(noFacts.reasonCodes, [
    "no_facts_found",
  ]);
  assert.equal(noFacts.rawSampleSize, 0);
  assert.equal(noFacts.includedSampleSize, 0);

  const invalidRow =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: [
            buildRow(0),
            buildRow(1, { currency: "EUR" }),
          ],
        }),
      },
    );
  assert.equal(invalidRow.status, "failed");
  assert.deepEqual(invalidRow.reasonCodes, [
    "invalid_fact_row",
  ]);
  assert.equal(invalidRow.rawSampleSize, 2);
  assert.equal(invalidRow.includedSampleSize, 1);

  const previewMismatch =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: buildRows(20, {
            capture_period_bucket: "2026-06",
          }),
        }),
      },
    );
  assert.equal(previewMismatch.status, "failed");
  assert.deepEqual(
    previewMismatch.reasonCodes,
    ["capture_period_mismatch"],
  );

  const validRows = buildRows(20);
  const success =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: validRows,
        }),
      },
    );
  assert.equal(success.status, "dry_run");
  assert.deepEqual(success.reasonCodes, []);
  assert.equal(success.inserted, false);
  assert.equal(success.supersedesArtifactId, null);
  assert.ok(success.artifactKey);
  assert.ok(success.distribution);
  assert.equal(success.rawSampleSize, 20);
  assert.equal(success.includedSampleSize, 20);

  const deterministic =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: validRows,
        }),
      },
    );
  assert.deepEqual(success, deterministic);

  const serialized = JSON.stringify(success);
  for (const forbidden of [
    "normalized_nightly_price",
    "privateOccupancySignature",
    "listingId",
    "workspaceId",
    "userId",
    "sourceUrl",
    "http://",
    "https://",
  ]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `Builder result leaks forbidden field: ${forbidden}`,
    );
  }

  console.log(
    "PASS — Intelligence v2 Occupancy Benchmark Builder smoke",
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );
  process.exit(1);
});
