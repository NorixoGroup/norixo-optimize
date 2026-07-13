import assert from "node:assert/strict";

import {
  runBenchmarkRuntime,
  type BenchmarkRuntimeInput,
} from "../lib/intelligenceV2/benchmarkRuntime";
import type {
  PricingBenchmarkBuilderInput,
  PricingBenchmarkBuilderResult,
} from "../lib/intelligenceV2/pricingBenchmarkBuilder";
import type {
  OccupancyBenchmarkBuilderInput,
  OccupancyBenchmarkBuilderResult,
} from "../lib/intelligenceV2/occupancyBenchmarkBuilder";

function buildPricingResult(
  overrides: Partial<PricingBenchmarkBuilderResult> = {},
): PricingBenchmarkBuilderResult {
  return Object.freeze({
    status: "dry_run",
    marketCellKey: "ma_marrakech_booking_apartment_4_6_eur",
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
    marketCellKey: "ma_marrakech_booking_apartment_4_6_unknown",
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

function expectPricingInput(
  input: PricingBenchmarkBuilderInput | null,
  message: string,
): PricingBenchmarkBuilderInput {
  if (input == null) {
    throw new Error(message);
  }

  return input;
}

async function main() {
  const basePricingInput: BenchmarkRuntimeInput = {
    metric: "pricing",
    marketCellKey: "pricing-cell",
    capturePeriodBucket: "2026-07",
    dryRun: false,
    force: true,
  };

  let pricingCalls = 0;
  let pricingReceivedInput:
    | PricingBenchmarkBuilderInput
    | null = null;
  let occupancyCallsInPricingRoute = 0;
  const pricingStubResult = buildPricingResult({
    marketCellKey: "pricing-cell",
    capturePeriodBucket: "2026-07",
    status: "inserted",
    inserted: true,
  });

  const pricingRouteResult = await runBenchmarkRuntime(
    basePricingInput,
    {
      pricingBuilder: async (
        input: PricingBenchmarkBuilderInput,
      ) => {
        pricingCalls += 1;
        pricingReceivedInput = input;
        return pricingStubResult;
      },
      occupancyBuilder: async () => {
        occupancyCallsInPricingRoute += 1;
        return buildOccupancyResult();
      },
    },
  );

  assert.equal(pricingCalls, 1);
  assert.equal(occupancyCallsInPricingRoute, 0);
  assert.deepEqual(pricingReceivedInput, {
    marketCellKey: "pricing-cell",
    capturePeriodBucket: "2026-07",
    dryRun: false,
    force: true,
  });
  assert.equal(pricingRouteResult.metric, "pricing");
  assert.equal(
    pricingRouteResult.result,
    pricingStubResult,
  );
  assert.deepEqual(
    Object.keys(pricingRouteResult).sort(),
    ["metric", "result"],
  );

  const occupancyInput: BenchmarkRuntimeInput = {
    metric: "occupancy",
    marketCellKey: "occupancy-cell",
    capturePeriodBucket: "2026-08",
    dryRun: true,
    force: false,
  };

  let occupancyCalls = 0;
  let occupancyReceivedInput:
    | OccupancyBenchmarkBuilderInput
    | null = null;
  let pricingCallsInOccupancyRoute = 0;
  const occupancyStubResult = buildOccupancyResult({
    marketCellKey: "occupancy-cell",
    capturePeriodBucket: "2026-08",
  });

  const occupancyRouteResult =
    await runBenchmarkRuntime(occupancyInput, {
      pricingBuilder: async () => {
        pricingCallsInOccupancyRoute += 1;
        return buildPricingResult();
      },
      occupancyBuilder: async (
        input: OccupancyBenchmarkBuilderInput,
      ) => {
        occupancyCalls += 1;
        occupancyReceivedInput = input;
        return occupancyStubResult;
      },
    });

  assert.equal(occupancyCalls, 1);
  assert.equal(pricingCallsInOccupancyRoute, 0);
  assert.deepEqual(occupancyReceivedInput, {
    marketCellKey: "occupancy-cell",
    capturePeriodBucket: "2026-08",
    dryRun: true,
    force: false,
  });
  assert.equal(occupancyRouteResult.metric, "occupancy");
  assert.equal(
    occupancyRouteResult.result,
    occupancyStubResult,
  );
  assert.deepEqual(
    Object.keys(occupancyRouteResult).sort(),
    ["metric", "result"],
  );

  let dryRunReceivedInput:
    | PricingBenchmarkBuilderInput
    | null = null;
  await runBenchmarkRuntime(
    {
      metric: "pricing",
      marketCellKey: "dryrun-cell",
      capturePeriodBucket: "2026-09",
    },
    {
      pricingBuilder: async (
        input: PricingBenchmarkBuilderInput,
      ) => {
        dryRunReceivedInput = input;
        return buildPricingResult();
      },
    },
  );
  const capturedDryRunInput = expectPricingInput(
    dryRunReceivedInput,
    "Expected pricing runtime input to be captured",
  );
  assert.equal(capturedDryRunInput.dryRun, undefined);
  assert.equal(capturedDryRunInput.force, undefined);

  const pricingSpecificResult =
    await runBenchmarkRuntime(basePricingInput, {
      pricingBuilder: async () =>
        buildPricingResult({
          p10Price: 70,
          medianPrice: 120,
          p90Price: 190,
        }),
    });
  assert.equal(pricingSpecificResult.metric, "pricing");
  assert.equal(
    pricingSpecificResult.result.p10Price,
    70,
  );
  assert.equal(
    pricingSpecificResult.result.medianPrice,
    120,
  );
  assert.equal(
    pricingSpecificResult.result.p90Price,
    190,
  );

  const occupancySpecificResult =
    await runBenchmarkRuntime(occupancyInput, {
      occupancyBuilder: async () =>
        buildOccupancyResult(),
    });
  assert.equal(
    occupancySpecificResult.metric,
    "occupancy",
  );
  assert.deepEqual(
    occupancySpecificResult.result.distribution,
    buildOccupancyResult().distribution,
  );

  await assert.rejects(
    runBenchmarkRuntime(basePricingInput, {
      pricingBuilder: async () => {
        throw new Error("pricing runtime boom");
      },
    }),
    /pricing runtime boom/,
  );

  await assert.rejects(
    runBenchmarkRuntime(occupancyInput, {
      occupancyBuilder: async () => {
        throw new Error("occupancy runtime boom");
      },
    }),
    /occupancy runtime boom/,
  );

  let deterministicCalls = 0;
  const deterministicBuilder = async (
    input: PricingBenchmarkBuilderInput,
  ): Promise<PricingBenchmarkBuilderResult> => {
    deterministicCalls += 1;
    return buildPricingResult({
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      inserted: input.dryRun === false,
      status:
        input.dryRun === false
          ? "inserted"
          : "dry_run",
    });
  };

  const deterministicInput: BenchmarkRuntimeInput = {
    metric: "pricing",
    marketCellKey: "deterministic-cell",
    capturePeriodBucket: "2026-10",
    dryRun: false,
    force: true,
  };
  const deterministicLeft =
    await runBenchmarkRuntime(deterministicInput, {
      pricingBuilder: deterministicBuilder,
    });
  const deterministicRight =
    await runBenchmarkRuntime(deterministicInput, {
      pricingBuilder: deterministicBuilder,
    });
  assert.equal(deterministicCalls, 2);
  assert.deepEqual(
    deterministicLeft,
    deterministicRight,
  );

  console.log(
    "PASS — Intelligence v2 Benchmark Runtime smoke",
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
