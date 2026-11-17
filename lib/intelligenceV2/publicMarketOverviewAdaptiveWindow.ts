// Lot A (NORIXO 24-month benchmark project): a pure, self-contained
// selector for the lookback window a public market overview artifact
// should use. Deliberately NOT wired into publicMarketOverviewBuilder.ts,
// publicMarketOverviewContract.ts, publicMarketOverviewGovernance.ts or
// any generation/reading path -- this module has no imports from, and no
// importers in, the live pipeline. It does not touch Supabase, does not
// read the clock itself, and performs no I/O.
//
// The additive contract types below (the three new rolling_*_days window
// literals) exist only inside this module for this lot, so that adding
// it cannot change the behaviour of anything that already reads
// PublicMarketOverviewAggregationWindow ("rolling_90_days" only) from
// publicMarketOverviewContract.ts. Folding these types into that file,
// and actually selecting a window during real generation, is Lot C's
// job, not this one's.

export const PUBLIC_MARKET_OVERVIEW_ADAPTIVE_WINDOW_CANDIDATES_DAYS = [
  90, 180, 365, 730,
] as const;

export type PublicMarketOverviewAdaptiveWindowDays =
  (typeof PUBLIC_MARKET_OVERVIEW_ADAPTIVE_WINDOW_CANDIDATES_DAYS)[number];

/**
 * Additive alongside, never a replacement for,
 * PublicMarketOverviewAggregationWindow ("rolling_90_days") in
 * publicMarketOverviewContract.ts. The 90-day member here is the same
 * string on purpose, so Lot C can map one-to-one onto the existing
 * literal without inventing a second spelling for the unchanged case.
 */
export type PublicMarketOverviewAdaptiveAggregationWindow =
  | "rolling_90_days"
  | "rolling_180_days"
  | "rolling_365_days"
  | "rolling_730_days";

export function toPublicMarketOverviewAdaptiveAggregationWindow(
  windowDays: PublicMarketOverviewAdaptiveWindowDays,
): PublicMarketOverviewAdaptiveAggregationWindow {
  switch (windowDays) {
    case 90:
      return "rolling_90_days";
    case 180:
      return "rolling_180_days";
    case 365:
      return "rolling_365_days";
    case 730:
      return "rolling_730_days";
  }
}

/**
 * Mirrors (does not import) the minimum included-sample-size threshold
 * currently inline in publicMarketOverviewGovernance.ts
 * (`includedSampleSize < 5` -> reasonCode "insufficient_sample_size").
 * Duplicated on purpose for this lot's isolation: Lot A must not import
 * from, or be imported by, the live governance/aggregation code. The
 * Phase 2A report flags this duplication explicitly -- deduplicate into
 * one shared, exported constant when Lot C wires this module in, so the
 * two thresholds cannot silently drift apart.
 *
 * This is a count of raw included observations only. It does not claim
 * or verify statistical independence between them -- a single,
 * frequently re-audited listing can contribute more than one of them.
 * That guarantee (a per-listing concentration cap) is a separate,
 * not-yet-built concern, out of scope for this lot.
 */
export const PUBLIC_MARKET_OVERVIEW_ADAPTIVE_WINDOW_MINIMUM_SAMPLE_SIZE = 5;

export type PublicMarketOverviewAdaptiveWindowSelectionInput = Readonly<{
  /**
   * Age in days of each available observation, relative to "now" (the
   * caller computes this; this module never reads the clock). Must be
   * finite and >= 0. A non-finite or negative entry is treated as not
   * present rather than thrown on, matching this codebase's general
   * preference for defensive normalization over exceptions on bad input.
   */
  observationAgesDays: readonly number[];
}>;

export type PublicMarketOverviewAdaptiveWindowSelectionResult =
  | Readonly<{
      status: "selected";
      windowDays: PublicMarketOverviewAdaptiveWindowDays;
      aggregationWindow: PublicMarketOverviewAdaptiveAggregationWindow;
      includedSampleSize: number;
    }>
  | Readonly<{
      status: "insufficient";
      reasonCode: "insufficient_sample_size";
      maxWindowDaysTried: PublicMarketOverviewAdaptiveWindowDays;
      includedSampleSizeAtMaxWindow: number;
    }>;

function isUsableObservationAge(age: number): boolean {
  return Number.isFinite(age) && age >= 0;
}

/**
 * Inclusive on both ends: an observation exactly `windowDays` old counts
 * as inside that window (matches "within the last N days" as commonly
 * understood, and is the boundary this lot's tests exercise explicitly).
 */
function countObservationsWithinWindow(
  observationAgesDays: readonly number[],
  windowDays: number,
): number {
  let count = 0;
  for (const age of observationAgesDays) {
    if (isUsableObservationAge(age) && age <= windowDays) {
      count += 1;
    }
  }
  return count;
}

/**
 * Chooses the shortest candidate window (90 -> 180 -> 365 -> 730 days)
 * whose included sample size already meets the minimum threshold.
 * 730 days is a search ceiling, never a guarantee: when even that widest
 * window is insufficient, this returns an explicit "insufficient" result
 * rather than silently selecting 730 days anyway.
 */
export function selectPublicMarketOverviewAdaptiveWindow(
  input: PublicMarketOverviewAdaptiveWindowSelectionInput,
): PublicMarketOverviewAdaptiveWindowSelectionResult {
  let lastWindowDays: PublicMarketOverviewAdaptiveWindowDays =
    PUBLIC_MARKET_OVERVIEW_ADAPTIVE_WINDOW_CANDIDATES_DAYS[0];
  let lastCount = 0;

  for (const windowDays of PUBLIC_MARKET_OVERVIEW_ADAPTIVE_WINDOW_CANDIDATES_DAYS) {
    const includedSampleSize = countObservationsWithinWindow(
      input.observationAgesDays,
      windowDays,
    );
    lastWindowDays = windowDays;
    lastCount = includedSampleSize;

    if (
      includedSampleSize >=
      PUBLIC_MARKET_OVERVIEW_ADAPTIVE_WINDOW_MINIMUM_SAMPLE_SIZE
    ) {
      return Object.freeze({
        status: "selected",
        windowDays,
        aggregationWindow:
          toPublicMarketOverviewAdaptiveAggregationWindow(windowDays),
        includedSampleSize,
      });
    }
  }

  return Object.freeze({
    status: "insufficient",
    reasonCode: "insufficient_sample_size",
    maxWindowDaysTried: lastWindowDays,
    includedSampleSizeAtMaxWindow: lastCount,
  });
}
