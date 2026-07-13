import assert from "node:assert/strict";

import {
  executeBenchmarkCli,
  parseBenchmarkCliArgs,
  runBenchmarkCli,
  validateBenchmarkCliOptions,
  type BenchmarkCliOptions,
  type BenchmarkDiscoveredCell,
} from "../lib/intelligenceV2/benchmarkCli";
import type {
  BenchmarkRuntimeInput,
  BenchmarkRuntimeResult,
  BenchmarkMetric,
} from "../lib/intelligenceV2/benchmarkRuntime";
import type { IntelligenceV2FeatureFlags } from "../lib/intelligenceV2/featureFlags";
import type { PricingBenchmarkBuilderResult } from "../lib/intelligenceV2/pricingBenchmarkBuilder";
import type { OccupancyBenchmarkBuilderResult } from "../lib/intelligenceV2/occupancyBenchmarkBuilder";

function buildFlags(
  enabled: boolean,
): IntelligenceV2FeatureFlags {
  return Object.freeze({
    ENABLE_INTELLIGENCE_FACT_TRANSFORMATION: false,
    ENABLE_INTELLIGENCE_FACT_CONTRIBUTION: false,
    ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION: enabled,
    ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION: false,
    DEBUG_INTELLIGENCE_V2: false,
  });
}

function buildPricingResult(
  overrides: Partial<PricingBenchmarkBuilderResult> = {},
): PricingBenchmarkBuilderResult {
  return Object.freeze({
    status: "dry_run",
    marketCellKey: "pricing-cell",
    capturePeriodBucket: "2026-07",
    rawSampleSize: 40,
    includedSampleSize: 40,
    excludedOutlierCount: 0,
    sourceClassCount: 2,
    sourceDiversityBand: "moderate",
    confidenceLevel: "high",
    approvalStatus: "audit_approved",
    limitations: [],
    artifactKey: "pricing-artifact-key",
    inserted: false,
    supersedesArtifactId: null,
    reasonCodes: [],
    p10Price: 80,
    p25Price: 95,
    medianPrice: 110,
    p75Price: 140,
    p90Price: 175,
    ...overrides,
  });
}

function buildOccupancyResult(
  overrides: Partial<OccupancyBenchmarkBuilderResult> = {},
): OccupancyBenchmarkBuilderResult {
  return Object.freeze({
    status: "dry_run",
    marketCellKey: "occupancy-cell",
    capturePeriodBucket: "2026-07",
    rawSampleSize: 20,
    includedSampleSize: 20,
    excludedOutlierCount: 0,
    sourceClassCount: 2,
    sourceDiversityBand: "moderate",
    confidenceLevel: "high",
    approvalStatus: "audit_approved",
    limitations: [],
    artifactKey: "occupancy-artifact-key",
    inserted: false,
    supersedesArtifactId: null,
    reasonCodes: [],
    distribution: Object.freeze({
      observedDaysCounts: Object.freeze({
        "1_6": 1,
        "7_13": 2,
        "14_29": 3,
        "30_59": 9,
        "60_plus": 5,
      }),
      unavailabilityRateCounts: Object.freeze({
        "0_19": 2,
        "20_39": 3,
        "40_59": 8,
        "60_79": 5,
        "80_100": 2,
      }),
      dominantObservedDaysBand: "30_59",
      dominantUnavailabilityRateBand: "40_59",
    }),
    ...overrides,
  });
}

function buildRuntimeResult(
  metric: "pricing",
  status: PricingBenchmarkBuilderResult["status"],
): BenchmarkRuntimeResult;
function buildRuntimeResult(
  metric: "occupancy",
  status: OccupancyBenchmarkBuilderResult["status"],
): BenchmarkRuntimeResult;
function buildRuntimeResult(
  metric: BenchmarkMetric,
  status:
    | PricingBenchmarkBuilderResult["status"]
    | OccupancyBenchmarkBuilderResult["status"],
): BenchmarkRuntimeResult {
  if (metric === "pricing") {
    return Object.freeze({
      metric: "pricing",
      result: buildPricingResult({
        status,
        inserted: status === "inserted",
      }),
    });
  }

  return Object.freeze({
    metric: "occupancy",
    result: buildOccupancyResult({
      status,
      inserted: status === "inserted",
    }),
  });
}

async function main() {
  const pricingOptions = parseBenchmarkCliArgs([
    "--metric",
    "pricing",
  ]);
  assert.equal(pricingOptions.metric, "pricing");

  const occupancyOptions = parseBenchmarkCliArgs([
    "--metric",
    "occupancy",
  ]);
  assert.equal(occupancyOptions.metric, "occupancy");

  assert.throws(
    () =>
      parseBenchmarkCliArgs([
        "--metric",
        "seo",
      ]),
    /`--metric` must be either `pricing` or `occupancy`\./,
  );

  assert.throws(
    () =>
      parseBenchmarkCliArgs([
        "--unknown",
      ]),
    /Unknown argument: --unknown/,
  );

  assert.throws(
    () =>
      parseBenchmarkCliArgs([
        "--period",
      ]),
    /Missing value after `--period`\./,
  );

  assert.throws(
    () =>
      parseBenchmarkCliArgs([
        "--limit",
        "0",
      ]),
    /`--limit` must be a positive integer\./,
  );

  assert.throws(
    () =>
      validateBenchmarkCliOptions({
        metric: "pricing",
        marketCellKey: "cell",
        capturePeriodBucket: null,
        limit: null,
        dryRun: true,
        force: false,
      }),
    /Single-cell mode requires `--metric`, `--market-cell`, and `--period`\./,
  );

  assert.throws(
    () =>
      validateBenchmarkCliOptions({
        metric: "pricing",
        marketCellKey: null,
        capturePeriodBucket: "2026-07",
        limit: null,
        dryRun: true,
        force: false,
      }),
    /Batch mode requires `--metric`, `--period`, and `--limit`\./,
  );

  assert.throws(
    () =>
      validateBenchmarkCliOptions({
        metric: "pricing",
        marketCellKey: "cell",
        capturePeriodBucket: "2026-07",
        limit: 3,
        dryRun: true,
        force: false,
      }),
    /Single-cell mode does not allow `--limit`\./,
  );

  assert.throws(
    () =>
      validateBenchmarkCliOptions({
        metric: "pricing",
        marketCellKey: "cell",
        capturePeriodBucket: "2026-13",
        limit: null,
        dryRun: true,
        force: false,
      }),
    /`--period` must match YYYY-MM\./,
  );

  const defaultOptions = parseBenchmarkCliArgs([
    "--metric",
    "pricing",
    "--market-cell",
    "cell",
    "--period",
    "2026-07",
  ]);
  assert.equal(defaultOptions.dryRun, true);
  assert.equal(defaultOptions.force, false);

  const writeAndForceOptions = parseBenchmarkCliArgs([
    "--metric",
    "pricing",
    "--market-cell",
    "cell",
    "--period",
    "2026-07",
    "--write",
    "--force",
  ]);
  assert.equal(writeAndForceOptions.dryRun, false);
  assert.equal(writeAndForceOptions.force, true);

  const runtimeCalls: BenchmarkRuntimeInput[] = [];
  let discoveryCalls = 0;
  const singleCellPricing = await executeBenchmarkCli(
    {
      metric: "pricing",
      marketCellKey: "pricing-single",
      capturePeriodBucket: "2026-07",
      limit: null,
      dryRun: true,
      force: false,
    },
    {
      runtime: async (input) => {
        runtimeCalls.push(input);
        return buildRuntimeResult(
          "pricing",
          "dry_run",
        );
      },
      discoverCells: async () => {
        discoveryCalls += 1;
        return [];
      },
      getFlags: () => buildFlags(false),
    },
  );
  assert.equal(runtimeCalls.length, 1);
  assert.equal(discoveryCalls, 0);
  assert.deepEqual(runtimeCalls[0], {
    metric: "pricing",
    marketCellKey: "pricing-single",
    capturePeriodBucket: "2026-07",
    dryRun: true,
    force: false,
  });
  assert.equal(singleCellPricing.results.length, 1);
  assert.equal(singleCellPricing.results[0].metric, "pricing");
  assert.equal(singleCellPricing.exitCode, 0);

  const occupancyRuntimeCalls: BenchmarkRuntimeInput[] = [];
  await executeBenchmarkCli(
    {
      metric: "occupancy",
      marketCellKey: "occupancy-single",
      capturePeriodBucket: "2026-08",
      limit: null,
      dryRun: true,
      force: true,
    },
    {
      runtime: async (input) => {
        occupancyRuntimeCalls.push(input);
        return buildRuntimeResult(
          "occupancy",
          "dry_run",
        );
      },
      getFlags: () => buildFlags(false),
    },
  );
  assert.deepEqual(occupancyRuntimeCalls, [
    {
      metric: "occupancy",
      marketCellKey: "occupancy-single",
      capturePeriodBucket: "2026-08",
      dryRun: true,
      force: true,
    },
  ]);

  const batchCells: ReadonlyArray<BenchmarkDiscoveredCell> =
    Object.freeze([
      Object.freeze({
        marketCellKey: "batch-b",
        capturePeriodBucket: "2026-07",
      }),
      Object.freeze({
        marketCellKey: "batch-a",
        capturePeriodBucket: "2026-07",
      }),
    ]);
  const batchRuntimeCalls: BenchmarkRuntimeInput[] = [];
  let batchDiscoveryInput: {
    metric: BenchmarkMetric;
    capturePeriodBucket: string;
    limit: number;
  } | null = null;
  const batchPricing = await executeBenchmarkCli(
    {
      metric: "pricing",
      marketCellKey: null,
      capturePeriodBucket: "2026-07",
      limit: 2,
      dryRun: true,
      force: false,
    },
    {
      runtime: async (input) => {
        batchRuntimeCalls.push(input);
        return buildRuntimeResult(
          "pricing",
          "inserted",
        );
      },
      discoverCells: async (input) => {
        batchDiscoveryInput = input;
        return batchCells;
      },
      getFlags: () => buildFlags(false),
    },
  );
  assert.deepEqual(batchDiscoveryInput, {
    metric: "pricing",
    capturePeriodBucket: "2026-07",
    limit: 2,
  });
  assert.deepEqual(batchRuntimeCalls, [
    {
      metric: "pricing",
      marketCellKey: "batch-b",
      capturePeriodBucket: "2026-07",
      dryRun: true,
      force: false,
    },
    {
      metric: "pricing",
      marketCellKey: "batch-a",
      capturePeriodBucket: "2026-07",
      dryRun: true,
      force: false,
    },
  ]);
  assert.deepEqual(batchPricing.results, [
    buildRuntimeResult("pricing", "inserted"),
    buildRuntimeResult("pricing", "inserted"),
  ]);

  let batchOccupancyMetric: BenchmarkMetric | null = null;
  await executeBenchmarkCli(
    {
      metric: "occupancy",
      marketCellKey: null,
      capturePeriodBucket: "2026-09",
      limit: 1,
      dryRun: true,
      force: false,
    },
    {
      runtime: async () =>
        buildRuntimeResult(
          "occupancy",
          "dry_run",
        ),
      discoverCells: async (input) => {
        batchOccupancyMetric = input.metric;
        return [
          {
            marketCellKey: "occ-cell",
            capturePeriodBucket: "2026-09",
          },
        ];
      },
      getFlags: () => buildFlags(false),
    },
  );
  assert.equal(batchOccupancyMetric, "occupancy");

  assert.equal(
    (
      await executeBenchmarkCli(
        {
          metric: "pricing",
          marketCellKey: "cell",
          capturePeriodBucket: "2026-07",
          limit: null,
          dryRun: true,
          force: false,
        },
        {
          runtime: async () =>
            buildRuntimeResult(
              "pricing",
              "dry_run",
            ),
          getFlags: () => buildFlags(false),
        },
      )
    ).exitCode,
    0,
  );

  assert.equal(
    (
      await executeBenchmarkCli(
        {
          metric: "pricing",
          marketCellKey: "cell",
          capturePeriodBucket: "2026-07",
          limit: null,
          dryRun: true,
          force: false,
        },
        {
          runtime: async () =>
            buildRuntimeResult(
              "pricing",
              "inserted",
            ),
          getFlags: () => buildFlags(false),
        },
      )
    ).exitCode,
    0,
  );

  assert.equal(
    (
      await executeBenchmarkCli(
        {
          metric: "pricing",
          marketCellKey: "cell",
          capturePeriodBucket: "2026-07",
          limit: null,
          dryRun: true,
          force: false,
        },
        {
          runtime: async () =>
            buildRuntimeResult(
              "pricing",
              "already_exists",
            ),
          getFlags: () => buildFlags(false),
        },
      )
    ).exitCode,
    0,
  );

  assert.equal(
    (
      await executeBenchmarkCli(
        {
          metric: "pricing",
          marketCellKey: "cell",
          capturePeriodBucket: "2026-07",
          limit: null,
          dryRun: true,
          force: false,
        },
        {
          runtime: async () =>
            buildRuntimeResult(
              "pricing",
              "insufficient",
            ),
          getFlags: () => buildFlags(false),
        },
      )
    ).exitCode,
    0,
  );

  assert.equal(
    (
      await executeBenchmarkCli(
        {
          metric: "pricing",
          marketCellKey: "cell",
          capturePeriodBucket: "2026-07",
          limit: null,
          dryRun: true,
          force: false,
        },
        {
          runtime: async () =>
            buildRuntimeResult(
              "pricing",
              "failed",
            ),
          getFlags: () => buildFlags(false),
        },
      )
    ).exitCode,
    1,
  );

  assert.equal(
    (
      await executeBenchmarkCli(
        {
          metric: "occupancy",
          marketCellKey: "cell",
          capturePeriodBucket: "2026-07",
          limit: null,
          dryRun: true,
          force: false,
        },
        {
          runtime: async () =>
            buildRuntimeResult(
              "occupancy",
              "disabled",
            ),
          getFlags: () => buildFlags(false),
        },
      )
    ).exitCode,
    1,
  );

  assert.equal(
    (
      await executeBenchmarkCli(
        {
          metric: "pricing",
          marketCellKey: null,
          capturePeriodBucket: "2026-07",
          limit: 2,
          dryRun: true,
          force: false,
        },
        {
          runtime: async (input) =>
            input.marketCellKey === "bad-cell"
              ? buildRuntimeResult(
                  "pricing",
                  "failed",
                )
              : buildRuntimeResult(
                  "pricing",
                  "dry_run",
                ),
          discoverCells: async () => [
            {
              marketCellKey: "good-cell",
              capturePeriodBucket: "2026-07",
            },
            {
              marketCellKey: "bad-cell",
              capturePeriodBucket: "2026-07",
            },
          ],
          getFlags: () => buildFlags(false),
        },
      )
    ).exitCode,
    1,
  );

  await assert.rejects(
    executeBenchmarkCli(
      {
        metric: "pricing",
        marketCellKey: "cell",
        capturePeriodBucket: "2026-07",
        limit: null,
        dryRun: false,
        force: false,
      },
      {
        runtime: async () =>
          buildRuntimeResult(
            "pricing",
            "inserted",
          ),
        getFlags: () => buildFlags(false),
      },
    ),
    /Cannot run with `--write` while ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION is disabled\./,
  );

  let writeRuntimeCalls = 0;
  await executeBenchmarkCli(
    {
      metric: "pricing",
      marketCellKey: "cell",
      capturePeriodBucket: "2026-07",
      limit: null,
      dryRun: false,
      force: false,
    },
    {
      runtime: async () => {
        writeRuntimeCalls += 1;
        return buildRuntimeResult(
          "pricing",
          "inserted",
        );
      },
      getFlags: () => buildFlags(true),
    },
  );
  assert.equal(writeRuntimeCalls, 1);

  await assert.rejects(
    executeBenchmarkCli(
      {
        metric: "pricing",
        marketCellKey: "cell",
        capturePeriodBucket: "2026-07",
        limit: null,
        dryRun: true,
        force: false,
      },
      {
        runtime: async () => {
          throw new Error("runtime boom");
        },
        getFlags: () => buildFlags(false),
      },
    ),
    /runtime boom/,
  );

  await assert.rejects(
    executeBenchmarkCli(
      {
        metric: "pricing",
        marketCellKey: null,
        capturePeriodBucket: "2026-07",
        limit: 1,
        dryRun: true,
        force: false,
      },
      {
        runtime: async () =>
          buildRuntimeResult(
            "pricing",
            "dry_run",
          ),
        discoverCells: async () => {
          throw new Error("discovery boom");
        },
        getFlags: () => buildFlags(false),
      },
    ),
    /discovery boom/,
  );

  const deterministicOptions: BenchmarkCliOptions =
    Object.freeze({
      metric: "pricing",
      marketCellKey: null,
      capturePeriodBucket: "2026-10",
      limit: 2,
      dryRun: false,
      force: true,
    });
  const deterministicDiscovery = Object.freeze([
    Object.freeze({
      marketCellKey: "deterministic-a",
      capturePeriodBucket: "2026-10",
    }),
    Object.freeze({
      marketCellKey: "deterministic-b",
      capturePeriodBucket: "2026-10",
    }),
  ]);
  const deterministicRuntime = async (
    input: BenchmarkRuntimeInput,
  ): Promise<BenchmarkRuntimeResult> =>
    Object.freeze({
      metric: "pricing",
      result: buildPricingResult({
        status: input.dryRun === false
          ? "inserted"
          : "dry_run",
        inserted: input.dryRun === false,
        marketCellKey: input.marketCellKey,
        capturePeriodBucket: input.capturePeriodBucket,
      }),
    });
  const deterministicLeft =
    await executeBenchmarkCli(deterministicOptions, {
      runtime: deterministicRuntime,
      discoverCells: async () => deterministicDiscovery,
      getFlags: () => buildFlags(true),
    });
  const deterministicRight =
    await runBenchmarkCli(
      [
        "--metric",
        "pricing",
        "--period",
        "2026-10",
        "--limit",
        "2",
        "--write",
        "--force",
      ],
      {
        runtime: deterministicRuntime,
        discoverCells: async () => deterministicDiscovery,
        getFlags: () => buildFlags(true),
      },
    );
  assert.deepEqual(
    deterministicLeft,
    deterministicRight,
  );

  console.log(
    "PASS — Intelligence v2 Benchmark CLI smoke",
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
