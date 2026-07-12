import assert from "node:assert/strict";

import {
  OCCUPANCY_BENCHMARK_TYPE,
  validateOccupancyBenchmarkArtifact,
  type OccupancyBenchmarkArtifact,
} from "../lib/intelligenceV2/occupancyBenchmarkArtifact";

function buildArtifact(
  overrides: Partial<OccupancyBenchmarkArtifact> = {},
): OccupancyBenchmarkArtifact {
  return {
    artifactKey: "ifv2_occupancy_benchmark_test",
    artifactContractVersion: "v1",
    benchmarkType: OCCUPANCY_BENCHMARK_TYPE,

    approvalStatus: "audit_approved",

    country: "morocco",
    city: "marrakech",
    platform: "booking",
    propertyType: "apartment",
    capacityBand: "4_6",
    currency: "UNKNOWN",
    marketCellKey:
      "v1|morocco|marrakech|booking|apartment|4_6|unknown",

    capturePeriodBucket: "2026-07",
    sourcePeriodStart: "2026-07-01",
    sourcePeriodEnd: "2026-07-31",

    cohortDefinitionVersion: "v1",
    sourceClassCount: 2,
    sourceDiversityBand: "moderate",

    distribution: {
      observedDaysCounts: {
        "1_6": 0,
        "7_13": 0,
        "14_29": 2,
        "30_59": 8,
        "60_plus": 0,
      },
      unavailabilityRateCounts: {
        "0_19": 1,
        "20_39": 2,
        "40_59": 3,
        "60_79": 4,
        "80_100": 0,
      },
      dominantObservedDaysBand: "30_59",
      dominantUnavailabilityRateBand: "60_79",
    },

    rawSampleSize: 10,
    includedSampleSize: 10,
    excludedOutlierCount: 0,

    outlierPolicyVersion: "v1",
    confidenceLevel: "moderate",
    confidencePolicyVersion: "v1",

    validFrom: "2026-08-01T00:00:00.000Z",
    validUntil: "2026-08-31T23:59:59.999Z",
    freshnessPolicyVersion: "v1",

    approvedForInternal: true,
    approvedForAudit: true,
    limitations: ["small_sample"],

    cohortPolicyVersion: "v1",
    aggregationPolicyVersion: "v1",
    approvalPolicyVersion: "v1",
    marketCellPolicyVersion: "v1",

    supersedesArtifactId: null,

    ...overrides,
  };
}

const valid = validateOccupancyBenchmarkArtifact(
  buildArtifact(),
);

assert.deepEqual(valid, { valid: true });

const observedMismatch =
  validateOccupancyBenchmarkArtifact(
    buildArtifact({
      distribution: {
        ...buildArtifact().distribution,
        observedDaysCounts: {
          "1_6": 0,
          "7_13": 0,
          "14_29": 2,
          "30_59": 7,
          "60_plus": 0,
        },
      },
    }),
  );

assert.equal(observedMismatch.valid, false);

if (!observedMismatch.valid) {
  assert.ok(
    observedMismatch.reasonCodes.includes(
      "observed_days_sum_mismatch",
    ),
  );
}

const unavailableMismatch =
  validateOccupancyBenchmarkArtifact(
    buildArtifact({
      distribution: {
        ...buildArtifact().distribution,
        unavailabilityRateCounts: {
          "0_19": 1,
          "20_39": 2,
          "40_59": 3,
          "60_79": 3,
          "80_100": 0,
        },
      },
    }),
  );

assert.equal(unavailableMismatch.valid, false);

if (!unavailableMismatch.valid) {
  assert.ok(
    unavailableMismatch.reasonCodes.includes(
      "unavailability_sum_mismatch",
    ),
  );
}

const negativeCount =
  validateOccupancyBenchmarkArtifact(
    buildArtifact({
      distribution: {
        ...buildArtifact().distribution,
        observedDaysCounts: {
          ...buildArtifact().distribution
            .observedDaysCounts,
          "30_59": -1,
        },
      },
    }),
  );

assert.equal(negativeCount.valid, false);

if (!negativeCount.valid) {
  assert.ok(
    negativeCount.reasonCodes.includes(
      "invalid_observed_days_count",
    ),
  );
}

const invalidApproval =
  validateOccupancyBenchmarkArtifact(
    buildArtifact({
      approvalStatus: "audit_approved",
      approvedForInternal: false,
      approvedForAudit: true,
    }),
  );

assert.equal(invalidApproval.valid, false);

if (!invalidApproval.valid) {
  assert.ok(
    invalidApproval.reasonCodes.includes(
      "invalid_approval_flags",
    ),
  );
}

const invalidPeriod =
  validateOccupancyBenchmarkArtifact(
    buildArtifact({
      capturePeriodBucket: "2026-13",
    }),
  );

assert.equal(invalidPeriod.valid, false);

if (!invalidPeriod.valid) {
  assert.ok(
    invalidPeriod.reasonCodes.includes(
      "invalid_capture_period",
    ),
  );
}

const serialized = JSON.stringify(
  buildArtifact(),
);

for (const forbidden of [
  "p10Price",
  "p25Price",
  "medianPrice",
  "p75Price",
  "p90Price",
  "normalizedNightlyPrice",
  "listingId",
  "workspaceId",
  "userId",
  "sourceUrl",
  "privateOccupancySignature",
  "observedDays\":",
  "unavailableDays\":",
  "availableDays\":",
]) {
  assert.equal(
    serialized.includes(forbidden),
    false,
    `Occupancy benchmark leaks forbidden field: ${forbidden}`,
  );
}

console.log(
  "PASS — Intelligence v2 Occupancy Benchmark Artifact smoke",
);
