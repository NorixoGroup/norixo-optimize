import assert from "node:assert/strict";

import {
  buildMarketCellKey,
} from "../lib/intelligenceV2/marketCell";
import {
  buildOccupancyDistributionBenchmark,
  type OccupancyBenchmarkArtifactPayload,
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

function buildSuccessfulLookups(input: {
  exactRow?: Readonly<{
    id: string;
    artifactKey: string | null;
    createdAt: string;
  }> | null;
  activeRow?: Readonly<{
    id: string;
    artifactKey: string | null;
    createdAt: string;
  }> | null;
  onArtifactKey?: (artifactKey: string) => void;
  onPayload?: (
    payload: OccupancyBenchmarkArtifactPayload,
  ) => void;
}) {
  return {
    findArtifactByKey: async (artifactKey: string) => {
      input.onArtifactKey?.(artifactKey);
      return {
        ok: true as const,
        row: input.exactRow ?? null,
      };
    },
    findActiveCompatibleArtifact: async (
      payload: OccupancyBenchmarkArtifactPayload,
    ) => {
      input.onPayload?.(payload);
      return {
        ok: true as const,
        row: input.activeRow ?? null,
      };
    },
  };
}

function expectPayload(
  payload: OccupancyBenchmarkArtifactPayload | null,
  message: string,
): OccupancyBenchmarkArtifactPayload {
  if (payload == null) {
    throw new Error(message);
  }

  return payload;
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

  const findByKeyFailed =
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
        findArtifactByKey: async () => ({ ok: false }),
      },
    );
  assert.equal(findByKeyFailed.status, "failed");
  assert.deepEqual(
    findByKeyFailed.reasonCodes,
    ["database_read_error"],
  );

  const findByKeyThrow =
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
        findArtifactByKey: async () => {
          throw new Error("find-by-key");
        },
      },
    );
  assert.equal(findByKeyThrow.status, "failed");
  assert.deepEqual(
    findByKeyThrow.reasonCodes,
    ["database_read_error"],
  );

  const activeLookupFailed =
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
        findArtifactByKey: async () => ({
          ok: true,
          row: null,
        }),
        findActiveCompatibleArtifact: async () => ({
          ok: false,
        }),
      },
    );
  assert.equal(activeLookupFailed.status, "failed");
  assert.deepEqual(
    activeLookupFailed.reasonCodes,
    ["supersession_lookup_error"],
  );

  const activeLookupThrow =
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
        findArtifactByKey: async () => ({
          ok: true,
          row: null,
        }),
        findActiveCompatibleArtifact: async () => {
          throw new Error("active-lookup");
        },
      },
    );
  assert.equal(activeLookupThrow.status, "failed");
  assert.deepEqual(
    activeLookupThrow.reasonCodes,
    ["supersession_lookup_error"],
  );

  let successLoadFactsCalls = 0;
  let successFindByKeyCalls = 0;
  let successActiveCalls = 0;
  let successArtifactKey: string | null = null;
  const success =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
      },
      {
        env: buildEnv(true),
        loadFacts: async () => {
          successLoadFactsCalls += 1;
          return {
            ok: true,
            rows: validRows,
          };
        },
        ...buildSuccessfulLookups({
          exactRow: null,
          activeRow: null,
          onArtifactKey: (artifactKey) => {
            successFindByKeyCalls += 1;
            successArtifactKey = artifactKey;
          },
          onPayload: (payload) => {
            successActiveCalls += 1;
            assert.equal(
              payload.benchmark_type,
              "occupancy_distribution",
            );
            assert.equal(payload.p10_price, null);
            assert.equal(payload.median_price, null);
            assert.equal(
              payload.observed_days_30_59_count,
              13,
            );
            assert.equal(payload.currency, "UNKNOWN");
          },
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
  assert.equal(successLoadFactsCalls, 1);
  assert.equal(successFindByKeyCalls, 1);
  assert.equal(successActiveCalls, 1);
  assert.equal(successArtifactKey, success.artifactKey);

  const exactExists =
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
        ...buildSuccessfulLookups({
          exactRow: {
            id: "artifact-exact",
            artifactKey: "existing-key",
            createdAt: "2026-08-01T00:00:00.000Z",
          },
          activeRow: null,
        }),
      },
    );
  assert.equal(exactExists.status, "dry_run");
  assert.deepEqual(exactExists.reasonCodes, [
    "artifact_already_exists",
  ]);
  assert.equal(
    exactExists.supersedesArtifactId,
    "artifact-exact",
  );

  const activeDifferent =
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
        ...buildSuccessfulLookups({
          exactRow: null,
          activeRow: {
            id: "artifact-active",
            artifactKey: "different-key",
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        }),
      },
    );
  assert.equal(activeDifferent.status, "dry_run");
  assert.deepEqual(activeDifferent.reasonCodes, []);
  assert.equal(
    activeDifferent.supersedesArtifactId,
    "artifact-active",
  );

  let sameKeyPayloadSeen = false;
  const activeSameKey =
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
        findArtifactByKey: async () => ({
          ok: true,
          row: null,
        }),
        findActiveCompatibleArtifact: async (
          payload: OccupancyBenchmarkArtifactPayload,
        ) => {
          sameKeyPayloadSeen = true;
          return {
            ok: true as const,
            row: {
              id: "artifact-same",
              artifactKey: payload.artifact_key,
              createdAt: "2026-08-01T00:00:00.000Z",
            },
          };
        },
      },
    );
  assert.equal(activeSameKey.status, "dry_run");
  assert.deepEqual(activeSameKey.reasonCodes, []);
  assert.equal(activeSameKey.supersedesArtifactId, null);
  assert.equal(sameKeyPayloadSeen, true);

  const insufficientRows = buildRows(4);
  const insufficientEvents: string[] = [];
  let insufficientInsertCalls = 0;
  const insufficient =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
        dryRun: false,
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: insufficientRows,
        }),
        findArtifactByKey: async () => {
          insufficientEvents.push("findByKey");
          return {
            ok: true as const,
            row: null,
          };
        },
        findActiveCompatibleArtifact: async () => {
          insufficientEvents.push("findActive");
          return {
            ok: true as const,
            row: null,
          };
        },
        insertArtifact: async () => {
          insufficientInsertCalls += 1;
          return true;
        },
      },
    );
  assert.equal(insufficient.status, "insufficient");
  assert.deepEqual(insufficient.reasonCodes, []);
  assert.equal(insufficient.inserted, false);
  assert.equal(insufficient.supersedesArtifactId, null);
  assert.deepEqual(insufficientEvents, [
    "findByKey",
    "findActive",
  ]);
  assert.equal(insufficientInsertCalls, 0);

  const writeAlreadyExistsEvents: string[] = [];
  let writeAlreadyExistsInsertCalls = 0;
  const writeAlreadyExists =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
        dryRun: false,
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: validRows,
        }),
        findArtifactByKey: async () => {
          writeAlreadyExistsEvents.push("findByKey");
          return {
            ok: true as const,
            row: {
              id: "artifact-write-exact",
              artifactKey: "write-exact-key",
              createdAt: "2026-08-01T00:00:00.000Z",
            },
          };
        },
        findActiveCompatibleArtifact: async () => {
          writeAlreadyExistsEvents.push("findActive");
          return {
            ok: true as const,
            row: null,
          };
        },
        insertArtifact: async () => {
          writeAlreadyExistsInsertCalls += 1;
          return true;
        },
      },
    );
  assert.equal(writeAlreadyExists.status, "already_exists");
  assert.deepEqual(writeAlreadyExists.reasonCodes, [
    "artifact_already_exists",
  ]);
  assert.equal(writeAlreadyExists.inserted, false);
  assert.equal(
    writeAlreadyExists.supersedesArtifactId,
    "artifact-write-exact",
  );
  assert.deepEqual(writeAlreadyExistsEvents, [
    "findByKey",
    "findActive",
  ]);
  assert.equal(writeAlreadyExistsInsertCalls, 0);

  const writeAlreadyExistsForce =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
        dryRun: false,
        force: true,
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: validRows,
        }),
        findArtifactByKey: async () => ({
          ok: true as const,
          row: {
            id: "artifact-write-exact",
            artifactKey: "write-exact-key",
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        }),
        findActiveCompatibleArtifact: async () => ({
          ok: true as const,
          row: null,
        }),
        insertArtifact: async () => {
          throw new Error("force should stay inert");
        },
      },
    );
  assert.deepEqual(
    writeAlreadyExistsForce,
    writeAlreadyExists,
  );

  let failedInsertCalls = 0;
  let failedInsertPayload:
    | OccupancyBenchmarkArtifactPayload
    | null = null;
  const failedInsert =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
        dryRun: false,
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: validRows,
        }),
        ...buildSuccessfulLookups({
          exactRow: null,
          activeRow: {
            id: "artifact-active-failed-insert",
            artifactKey: "different-key",
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        }),
        insertArtifact: async (
          payload: OccupancyBenchmarkArtifactPayload,
        ) => {
          failedInsertCalls += 1;
          failedInsertPayload = payload;
          return false;
        },
      },
    );
  assert.equal(failedInsert.status, "failed");
  assert.deepEqual(failedInsert.reasonCodes, [
    "database_insert_error",
  ]);
  assert.equal(failedInsert.inserted, false);
  assert.equal(
    failedInsert.supersedesArtifactId,
    "artifact-active-failed-insert",
  );
  assert.equal(failedInsertCalls, 1);
  const capturedFailedInsertPayload = expectPayload(
    failedInsertPayload,
    "Expected failed insert payload to be captured",
  );
  assert.equal(
    capturedFailedInsertPayload.benchmark_type,
    "occupancy_distribution",
  );
  assert.equal(
    capturedFailedInsertPayload.currency,
    "UNKNOWN",
  );
  assert.equal(capturedFailedInsertPayload.p10_price, null);
  assert.equal(
    capturedFailedInsertPayload.median_price,
    null,
  );
  assert.equal(
    capturedFailedInsertPayload.observed_days_30_59_count,
    13,
  );
  assert.equal(
    capturedFailedInsertPayload.supersedes_artifact_id,
    "artifact-active-failed-insert",
  );

  await assert.rejects(
    buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
        dryRun: false,
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: validRows,
        }),
        ...buildSuccessfulLookups({
          exactRow: null,
          activeRow: null,
        }),
        insertArtifact: async () => {
          throw new Error("insert boom");
        },
      },
    ),
    /insert boom/,
  );

  let insertedNoSupersessionCalls = 0;
  const insertedNoSupersession =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
        dryRun: false,
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: validRows,
        }),
        ...buildSuccessfulLookups({
          exactRow: null,
          activeRow: null,
        }),
        insertArtifact: async () => {
          insertedNoSupersessionCalls += 1;
          return true;
        },
      },
    );
  assert.equal(insertedNoSupersession.status, "inserted");
  assert.equal(insertedNoSupersession.inserted, true);
  assert.deepEqual(
    insertedNoSupersession.reasonCodes,
    [],
  );
  assert.equal(
    insertedNoSupersession.supersedesArtifactId,
    null,
  );
  assert.equal(insertedNoSupersessionCalls, 1);

  let insertedWithSupersessionCalls = 0;
  let insertedWithSupersessionPayload:
    | OccupancyBenchmarkArtifactPayload
    | null = null;
  const insertedWithSupersession =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
        dryRun: false,
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: validRows,
        }),
        ...buildSuccessfulLookups({
          exactRow: null,
          activeRow: {
            id: "artifact-active-inserted",
            artifactKey: "different-key",
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        }),
        insertArtifact: async (
          payload: OccupancyBenchmarkArtifactPayload,
        ) => {
          insertedWithSupersessionCalls += 1;
          insertedWithSupersessionPayload = payload;
          return true;
        },
      },
    );
  assert.equal(insertedWithSupersession.status, "inserted");
  assert.equal(insertedWithSupersession.inserted, true);
  assert.equal(
    insertedWithSupersession.supersedesArtifactId,
    "artifact-active-inserted",
  );
  assert.equal(insertedWithSupersessionCalls, 1);
  const capturedInsertedWithSupersessionPayload =
    expectPayload(
      insertedWithSupersessionPayload,
      "Expected inserted payload with supersession",
    );
  assert.equal(
    capturedInsertedWithSupersessionPayload.supersedes_artifact_id,
    "artifact-active-inserted",
  );

  let insertedSameKeyPayload:
    | OccupancyBenchmarkArtifactPayload
    | null = null;
  const writeActiveSameKey =
    await buildOccupancyDistributionBenchmark(
      {
        marketCellKey: MARKET_CELL_KEY,
        capturePeriodBucket: "2026-07",
        dryRun: false,
      },
      {
        env: buildEnv(true),
        loadFacts: async () => ({
          ok: true,
          rows: validRows,
        }),
        findArtifactByKey: async () => ({
          ok: true,
          row: null,
        }),
        findActiveCompatibleArtifact: async (
          payload: OccupancyBenchmarkArtifactPayload,
        ) => ({
          ok: true as const,
          row: {
            id: "artifact-write-same",
            artifactKey: payload.artifact_key,
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        }),
        insertArtifact: async (
          payload: OccupancyBenchmarkArtifactPayload,
        ) => {
          insertedSameKeyPayload = payload;
          return true;
        },
      },
    );
  assert.equal(writeActiveSameKey.status, "inserted");
  assert.equal(writeActiveSameKey.inserted, true);
  assert.equal(
    writeActiveSameKey.supersedesArtifactId,
    null,
  );
  const capturedInsertedSameKeyPayload = expectPayload(
    insertedSameKeyPayload,
    "Expected inserted payload for same-key write",
  );
  assert.equal(
    capturedInsertedSameKeyPayload.supersedes_artifact_id,
    null,
  );

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
        ...buildSuccessfulLookups({
          exactRow: null,
          activeRow: null,
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
