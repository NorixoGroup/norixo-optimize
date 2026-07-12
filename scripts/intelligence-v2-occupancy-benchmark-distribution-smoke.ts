import assert from "node:assert/strict";

import {
  buildOccupancyBenchmarkDistribution,
  selectDominantObservedDaysBand,
  selectDominantUnavailabilityRateBand,
} from "../lib/intelligenceV2/occupancyBenchmarkDistribution";

const empty =
  buildOccupancyBenchmarkDistribution([]);

assert.deepEqual(empty, {
  ok: false,
  reason: "empty_input",
});

const result =
  buildOccupancyBenchmarkDistribution([
    {
      observedDaysBand: "30_59",
      unavailabilityRateBand: "60_79",
    },
    {
      observedDaysBand: "30_59",
      unavailabilityRateBand: "40_59",
    },
    {
      observedDaysBand: "14_29",
      unavailabilityRateBand: "60_79",
    },
    {
      observedDaysBand: "30_59",
      unavailabilityRateBand: "60_79",
    },
  ]);

if (!result.ok) {
  throw new Error(
    `Expected distribution success, got ${result.reason}`,
  );
}

assert.equal(result.ok, true);

assert.equal(result.includedSampleSize, 4);

assert.deepEqual(
  result.distribution.observedDaysCounts,
  {
    "1_6": 0,
    "7_13": 0,
    "14_29": 1,
    "30_59": 3,
    "60_plus": 0,
  },
);

assert.deepEqual(
  result.distribution.unavailabilityRateCounts,
  {
    "0_19": 0,
    "20_39": 0,
    "40_59": 1,
    "60_79": 3,
    "80_100": 0,
  },
);

assert.equal(
  result.distribution.dominantObservedDaysBand,
  "30_59",
);

assert.equal(
  result.distribution
    .dominantUnavailabilityRateBand,
  "60_79",
);

assert.equal(
  selectDominantObservedDaysBand({
    "1_6": 2,
    "7_13": 2,
    "14_29": 0,
    "30_59": 0,
    "60_plus": 0,
  }),
  "1_6",
  "canonical first band must win ties",
);

assert.equal(
  selectDominantUnavailabilityRateBand({
    "0_19": 0,
    "20_39": 3,
    "40_59": 3,
    "60_79": 0,
    "80_100": 0,
  }),
  "20_39",
  "canonical first band must win ties",
);

const deterministicLeft =
  buildOccupancyBenchmarkDistribution([
    {
      observedDaysBand: "60_plus",
      unavailabilityRateBand: "80_100",
    },
    {
      observedDaysBand: "1_6",
      unavailabilityRateBand: "0_19",
    },
  ]);

const deterministicRight =
  buildOccupancyBenchmarkDistribution([
    {
      observedDaysBand: "60_plus",
      unavailabilityRateBand: "80_100",
    },
    {
      observedDaysBand: "1_6",
      unavailabilityRateBand: "0_19",
    },
  ]);

assert.deepEqual(
  deterministicLeft,
  deterministicRight,
);

const invalidObserved =
  buildOccupancyBenchmarkDistribution([
    {
      observedDaysBand: "invalid" as never,
      unavailabilityRateBand: "20_39",
    },
  ]);

assert.deepEqual(invalidObserved, {
  ok: false,
  reason: "invalid_observed_days_band",
});

const invalidUnavailability =
  buildOccupancyBenchmarkDistribution([
    {
      observedDaysBand: "14_29",
      unavailabilityRateBand: "invalid" as never,
    },
  ]);

assert.deepEqual(invalidUnavailability, {
  ok: false,
  reason: "invalid_unavailability_rate_band",
});

const serialized = JSON.stringify(result);

for (const forbidden of [
  "normalizedNightlyPrice",
  "p10Price",
  "p25Price",
  "medianPrice",
  "p75Price",
  "p90Price",
  "privateOccupancySignature",
  "listingId",
  "workspaceId",
  "userId",
  "sourceUrl",
]) {
  assert.equal(
    serialized.includes(forbidden),
    false,
    `Distribution leaks forbidden field: ${forbidden}`,
  );
}

console.log(
  "PASS — Intelligence v2 Occupancy Benchmark Distribution smoke",
);
