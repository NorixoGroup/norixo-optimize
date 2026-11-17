import assert from "node:assert/strict";

import {
  PUBLIC_MARKET_OVERVIEW_ADAPTIVE_WINDOW_CANDIDATES_DAYS,
  PUBLIC_MARKET_OVERVIEW_ADAPTIVE_WINDOW_MINIMUM_SAMPLE_SIZE,
  selectPublicMarketOverviewAdaptiveWindow,
  toPublicMarketOverviewAdaptiveAggregationWindow,
} from "../lib/intelligenceV2/publicMarketOverviewAdaptiveWindow";
import type {
  PublicMarketOverviewAggregationWindow,
} from "../lib/intelligenceV2/publicMarketOverviewContract";

function main() {
  // No observations at all.
  {
    const result = selectPublicMarketOverviewAdaptiveWindow({
      observationAgesDays: [],
    });
    assert.equal(result.status, "insufficient");
    assert.equal(
      (result as { reasonCode: string }).reasonCode,
      "insufficient_sample_size",
    );
    assert.equal((result as { maxWindowDaysTried: number }).maxWindowDaysTried, 730);
    assert.equal(
      (result as { includedSampleSizeAtMaxWindow: number })
        .includedSampleSizeAtMaxWindow,
      0,
    );
  }

  // Four observations within 730 days -- still one short everywhere.
  {
    const result = selectPublicMarketOverviewAdaptiveWindow({
      observationAgesDays: [10, 100, 400, 700],
    });
    assert.equal(result.status, "insufficient");
    assert.equal((result as { maxWindowDaysTried: number }).maxWindowDaysTried, 730);
    assert.equal(
      (result as { includedSampleSizeAtMaxWindow: number })
        .includedSampleSizeAtMaxWindow,
      4,
    );
  }

  // Exactly five observations, all within 90 days.
  {
    const result = selectPublicMarketOverviewAdaptiveWindow({
      observationAgesDays: [0, 10, 30, 60, 89],
    });
    assert.equal(result.status, "selected");
    assert.equal((result as { windowDays: number }).windowDays, 90);
    assert.equal((result as { includedSampleSize: number }).includedSampleSize, 5);
  }

  // 90 days insufficient (4), 180 days sufficient (5th observation at 150 days).
  {
    const result = selectPublicMarketOverviewAdaptiveWindow({
      observationAgesDays: [5, 20, 40, 80, 150],
    });
    assert.equal(result.status, "selected");
    assert.equal((result as { windowDays: number }).windowDays, 180);
    assert.equal((result as { includedSampleSize: number }).includedSampleSize, 5);
  }

  // 180 days insufficient (4), 365 days sufficient.
  {
    const result = selectPublicMarketOverviewAdaptiveWindow({
      observationAgesDays: [5, 20, 100, 170, 300],
    });
    assert.equal(result.status, "selected");
    assert.equal((result as { windowDays: number }).windowDays, 365);
    assert.equal((result as { includedSampleSize: number }).includedSampleSize, 5);
  }

  // 365 days insufficient (4), 730 days sufficient.
  {
    const result = selectPublicMarketOverviewAdaptiveWindow({
      observationAgesDays: [5, 50, 200, 360, 600],
    });
    assert.equal(result.status, "selected");
    assert.equal((result as { windowDays: number }).windowDays, 730);
    assert.equal((result as { includedSampleSize: number }).includedSampleSize, 5);
  }

  // Boundary: observation exactly at 90, 180, 365 and 730 days old must
  // count as inside that same-numbered window (inclusive boundary,
  // documented in the module).
  {
    const exactlyAt90 = selectPublicMarketOverviewAdaptiveWindow({
      observationAgesDays: [90, 90, 90, 90, 90],
    });
    assert.equal(exactlyAt90.status, "selected");
    assert.equal((exactlyAt90 as { windowDays: number }).windowDays, 90);

    const oneDayPast90 = selectPublicMarketOverviewAdaptiveWindow({
      observationAgesDays: [91, 91, 91, 91, 91],
    });
    assert.equal(oneDayPast90.status, "selected");
    assert.equal((oneDayPast90 as { windowDays: number }).windowDays, 180);

    const exactlyAt730 = selectPublicMarketOverviewAdaptiveWindow({
      observationAgesDays: [730, 730, 730, 730, 730],
    });
    assert.equal(exactlyAt730.status, "selected");
    assert.equal((exactlyAt730 as { windowDays: number }).windowDays, 730);

    const oneDayPast730 = selectPublicMarketOverviewAdaptiveWindow({
      observationAgesDays: [731, 731, 731, 731, 731],
    });
    assert.equal(oneDayPast730.status, "insufficient");
  }

  // Negative/non-finite ages are ignored, not thrown on, and never
  // falsely counted as present.
  {
    const result = selectPublicMarketOverviewAdaptiveWindow({
      observationAgesDays: [-5, Number.NaN, Number.POSITIVE_INFINITY, 10, 20, 30],
    });
    assert.equal(result.status, "insufficient");
    assert.equal(
      (result as { includedSampleSizeAtMaxWindow: number })
        .includedSampleSizeAtMaxWindow,
      3,
    );
  }

  // Fixed tiers, exactly as specified.
  assert.deepEqual(
    [...PUBLIC_MARKET_OVERVIEW_ADAPTIVE_WINDOW_CANDIDATES_DAYS],
    [90, 180, 365, 730],
  );
  assert.equal(PUBLIC_MARKET_OVERVIEW_ADAPTIVE_WINDOW_MINIMUM_SAMPLE_SIZE, 5);

  // The 90-day member of the new type is the same literal string as the
  // existing, untouched PublicMarketOverviewAggregationWindow.
  const existingWindowLiteral: PublicMarketOverviewAggregationWindow =
    "rolling_90_days";
  assert.equal(
    toPublicMarketOverviewAdaptiveAggregationWindow(90),
    existingWindowLiteral,
  );

  console.log("PASS -- public market overview adaptive window (Lot A)");
}

main();
