import {
  OCCUPANCY_OBSERVED_DAYS_BANDS,
  OCCUPANCY_UNAVAILABILITY_RATE_BANDS,
  type OccupancyBenchmarkDistribution,
  type OccupancyObservedDaysCounts,
  type OccupancyUnavailabilityRateCounts,
} from "./occupancyBenchmarkArtifact";
import type {
  IntelligenceV2ObservedDaysBand,
  IntelligenceV2UnavailabilityRateBand,
} from "./occupancyFact";

export type OccupancyBenchmarkDistributionInput = Readonly<{
  observedDaysBand: IntelligenceV2ObservedDaysBand;
  unavailabilityRateBand: IntelligenceV2UnavailabilityRateBand;
}>;

export type OccupancyBenchmarkDistributionBuildResult =
  | Readonly<{
      ok: true;
      includedSampleSize: number;
      distribution: OccupancyBenchmarkDistribution;
    }>
  | Readonly<{
      ok: false;
      reason:
        | "empty_input"
        | "invalid_observed_days_band"
        | "invalid_unavailability_rate_band";
    }>;

function createObservedDaysCounts(): Record<
  IntelligenceV2ObservedDaysBand,
  number
> {
  return {
    "1_6": 0,
    "7_13": 0,
    "14_29": 0,
    "30_59": 0,
    "60_plus": 0,
  };
}

function createUnavailabilityRateCounts(): Record<
  IntelligenceV2UnavailabilityRateBand,
  number
> {
  return {
    "0_19": 0,
    "20_39": 0,
    "40_59": 0,
    "60_79": 0,
    "80_100": 0,
  };
}

function isObservedDaysBand(
  value: unknown,
): value is IntelligenceV2ObservedDaysBand {
  return (
    typeof value === "string" &&
    (
      OCCUPANCY_OBSERVED_DAYS_BANDS as ReadonlyArray<string>
    ).includes(value)
  );
}

function isUnavailabilityRateBand(
  value: unknown,
): value is IntelligenceV2UnavailabilityRateBand {
  return (
    typeof value === "string" &&
    (
      OCCUPANCY_UNAVAILABILITY_RATE_BANDS as ReadonlyArray<string>
    ).includes(value)
  );
}

export function selectDominantObservedDaysBand(
  counts: OccupancyObservedDaysCounts,
): IntelligenceV2ObservedDaysBand {
  let dominantBand: IntelligenceV2ObservedDaysBand =
    OCCUPANCY_OBSERVED_DAYS_BANDS[0];
  let dominantCount = counts[dominantBand];

  for (
    const band of
    OCCUPANCY_OBSERVED_DAYS_BANDS.slice(1)
  ) {
    const count = counts[band];

    if (count > dominantCount) {
      dominantBand = band;
      dominantCount = count;
    }
  }

  return dominantBand;
}

export function selectDominantUnavailabilityRateBand(
  counts: OccupancyUnavailabilityRateCounts,
): IntelligenceV2UnavailabilityRateBand {
  let dominantBand: IntelligenceV2UnavailabilityRateBand =
    OCCUPANCY_UNAVAILABILITY_RATE_BANDS[0];
  let dominantCount = counts[dominantBand];

  for (
    const band of
    OCCUPANCY_UNAVAILABILITY_RATE_BANDS.slice(1)
  ) {
    const count = counts[band];

    if (count > dominantCount) {
      dominantBand = band;
      dominantCount = count;
    }
  }

  return dominantBand;
}

export function buildOccupancyBenchmarkDistribution(
  observations: ReadonlyArray<OccupancyBenchmarkDistributionInput>,
): OccupancyBenchmarkDistributionBuildResult {
  if (observations.length === 0) {
    return {
      ok: false,
      reason: "empty_input",
    };
  }

  const observedDaysCounts =
    createObservedDaysCounts();
  const unavailabilityRateCounts =
    createUnavailabilityRateCounts();

  for (const observation of observations) {
    if (
      !isObservedDaysBand(
        observation.observedDaysBand,
      )
    ) {
      return {
        ok: false,
        reason: "invalid_observed_days_band",
      };
    }

    if (
      !isUnavailabilityRateBand(
        observation.unavailabilityRateBand,
      )
    ) {
      return {
        ok: false,
        reason:
          "invalid_unavailability_rate_band",
      };
    }

    observedDaysCounts[
      observation.observedDaysBand
    ] += 1;

    unavailabilityRateCounts[
      observation.unavailabilityRateBand
    ] += 1;
  }

  const distribution: OccupancyBenchmarkDistribution =
    Object.freeze({
      observedDaysCounts: Object.freeze({
        ...observedDaysCounts,
      }),
      unavailabilityRateCounts: Object.freeze({
        ...unavailabilityRateCounts,
      }),
      dominantObservedDaysBand:
        selectDominantObservedDaysBand(
          observedDaysCounts,
        ),
      dominantUnavailabilityRateBand:
        selectDominantUnavailabilityRateBand(
          unavailabilityRateCounts,
        ),
    });

  return Object.freeze({
    ok: true,
    includedSampleSize: observations.length,
    distribution,
  });
}
