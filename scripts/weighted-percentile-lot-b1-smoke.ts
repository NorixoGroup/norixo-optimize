import assert from "node:assert/strict";

import {
  PRICING_WEIGHTED_PERCENTILE_DEFAULT_AGE_TIERS,
  computeAgeWeightedPricingPercentile,
  computeEffectiveSampleSize,
  computeWeightedPercentile,
  resolveAgeTierWeight,
  type WeightedPercentileObservation,
} from "../lib/intelligenceV2/weightedPercentile";
import { computeContinuousPercentile } from "../lib/intelligenceV2/pricingBenchmarkBuilder";

// Documented tolerance for the equal-weight compatibility proof: the
// weighted formula reaches the same positions via sums/ratios rather than
// a bare integer index, so floating-point rounding can differ from the
// historical function in the last 1-2 ULPs. This is an explicit,
// test-only tolerance, not part of the module's exported contract.
const EQUAL_WEIGHT_TOLERANCE = 1e-9;

function toEqualWeightObservations(
  values: ReadonlyArray<number>,
  weight = 1,
): WeightedPercentileObservation[] {
  return values.map((value) => ({ value, weight }));
}

function assertCloseTo(actual: number, expected: number, message: string) {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= EQUAL_WEIGHT_TOLERANCE,
    `${message} (actual=${actual}, expected=${expected}, diff=${diff})`,
  );
}

/**
 * Combined absolute + relative tolerance, for comparisons involving
 * extreme-magnitude numbers (overflow-robustness regressions) where a
 * fixed absolute tolerance alone is meaningless at either very large or
 * very small scales.
 */
function assertApproximately(
  actual: number,
  expected: number,
  message: string,
  { absolute = 1e-9, relative = 1e-9 }: { absolute?: number; relative?: number } = {},
) {
  const diff = Math.abs(actual - expected);
  const scale = Math.max(Math.abs(actual), Math.abs(expected));
  const allowed = Math.max(absolute, relative * scale);
  assert.ok(
    diff <= allowed,
    `${message} (actual=${actual}, expected=${expected}, diff=${diff}, allowed=${allowed})`,
  );
}

function main() {
  // --- Empty sample ---
  {
    assert.equal(computeWeightedPercentile([], 0.5), null);
    assert.equal(computeEffectiveSampleSize([]), 0);
  }

  // --- Equal-weight compatibility with computeContinuousPercentile,
  // across n = 1, 2, 3, 5, for P25/P50/P75 ---
  {
    const samples: ReadonlyArray<ReadonlyArray<number>> = [
      [100],
      [100, 200],
      [10, 20, 30],
      [5, 12, 47, 90, 133],
    ];
    const percentiles = [0.25, 0.5, 0.75];
    let maxObservedDiff = 0;

    for (const values of samples) {
      for (const p of percentiles) {
        const historical = computeContinuousPercentile(values, p);
        const weighted = computeWeightedPercentile(
          toEqualWeightObservations(values, 1),
          p,
        );
        assert.notEqual(historical, null);
        assert.notEqual(weighted, null);
        const diff = Math.abs((historical as number) - (weighted as number));
        maxObservedDiff = Math.max(maxObservedDiff, diff);
        assertCloseTo(
          weighted as number,
          historical as number,
          `equal-weight mismatch n=${values.length} p=${p}`,
        );
      }
    }
    console.log(
      `equal-weight vs historical max observed diff: ${maxObservedDiff}`,
    );

    // Also check with a constant weight other than 1 (e.g. 0.6) -- the
    // proof in LOT_B1_MATH_READY holds for any constant, not just 1.
    for (const values of samples) {
      for (const p of percentiles) {
        const historical = computeContinuousPercentile(values, p);
        const weighted = computeWeightedPercentile(
          toEqualWeightObservations(values, 0.6),
          p,
        );
        assertCloseTo(
          weighted as number,
          historical as number,
          `equal-nonunit-weight mismatch n=${values.length} p=${p}`,
        );
      }
    }
  }

  // --- n=2 hand-worked example from LOT_B1_MATH_READY ---
  {
    const observations = toEqualWeightObservations([100, 200]);
    assertCloseTo(
      computeWeightedPercentile(observations, 0.25) as number,
      125,
      "n=2 p=0.25",
    );
    assertCloseTo(
      computeWeightedPercentile(observations, 0.5) as number,
      150,
      "n=2 p=0.5",
    );
    assertCloseTo(
      computeWeightedPercentile(observations, 0.75) as number,
      175,
      "n=2 p=0.75",
    );
  }

  // --- Unequal weights shift the result toward the heavier value,
  // monotonically ---
  {
    const lightLow: WeightedPercentileObservation[] = [
      { value: 10, weight: 1 },
      { value: 20, weight: 1 },
      { value: 30, weight: 1 },
    ];
    const heavyHigh: WeightedPercentileObservation[] = [
      { value: 10, weight: 1 },
      { value: 20, weight: 1 },
      { value: 30, weight: 8 },
    ];
    const equalMedian = computeWeightedPercentile(lightLow, 0.5) as number;
    const skewedMedian = computeWeightedPercentile(heavyHigh, 0.5) as number;
    assert.ok(
      skewedMedian > equalMedian,
      `skewed median (${skewedMedian}) should exceed equal-weight median (${equalMedian})`,
    );
  }

  // --- Monotonicity in p for a fixed, unequal-weight dataset ---
  {
    const observations: WeightedPercentileObservation[] = [
      { value: 50, weight: 2 },
      { value: 80, weight: 1 },
      { value: 120, weight: 5 },
      { value: 200, weight: 1 },
    ];
    let previous = -Infinity;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const clamped = Math.min(1, p);
      const result = computeWeightedPercentile(observations, clamped) as number;
      assert.ok(
        result >= previous - 1e-12,
        `monotonicity violated at p=${clamped}: ${result} < ${previous}`,
      );
      previous = result;
    }
  }

  // --- Identical values, varied weights ---
  {
    const observations: WeightedPercentileObservation[] = [
      { value: 20, weight: 1 },
      { value: 20, weight: 5 },
      { value: 20, weight: 2 },
    ];
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      assert.equal(computeWeightedPercentile(observations, p), 20);
    }
  }

  // --- Zero, negative, non-finite and extremely large weights ---
  {
    const observations: WeightedPercentileObservation[] = [
      { value: 10, weight: 0 },
      { value: 20, weight: -5 },
      { value: 30, weight: Number.NaN },
      { value: 40, weight: Number.POSITIVE_INFINITY },
      { value: 50, weight: 1 },
      { value: 60, weight: 1 },
    ];
    // Only {50,1} and {60,1} survive filtering -> equivalent to the
    // 2-value equal-weight case.
    assertCloseTo(
      computeWeightedPercentile(observations, 0.5) as number,
      55,
      "invalid weights filtered correctly",
    );

    // All weights invalid -> empty after filtering -> null.
    const allInvalid: WeightedPercentileObservation[] = [
      { value: 10, weight: 0 },
      { value: 20, weight: -1 },
      { value: 30, weight: Number.NaN },
    ];
    assert.equal(computeWeightedPercentile(allInvalid, 0.5), null);

    // Equal, extremely large weights (sum would overflow to Infinity if
    // computed as a raw, unnormalized sum): the correctif's
    // max-weight normalization keeps every intermediate quantity
    // bounded, so this now correctly returns the finite median instead
    // of failing closed to null (see the dedicated overflow-robustness
    // block below for the exact mechanism).
    const extremeButResolvable: WeightedPercentileObservation[] = [
      { value: 1, weight: Number.MAX_VALUE },
      { value: 2, weight: Number.MAX_VALUE },
    ];
    const extremeResult = computeWeightedPercentile(extremeButResolvable, 0.5);
    assert.ok(Number.isFinite(extremeResult as number));
    assertCloseTo(extremeResult as number, 1.5, "equal extreme weights");
  }

  // --- Non-finite values are filtered, not propagated ---
  {
    const observations: WeightedPercentileObservation[] = [
      { value: Number.NaN, weight: 1 },
      { value: Number.POSITIVE_INFINITY, weight: 1 },
      { value: 100, weight: 1 },
      { value: 200, weight: 1 },
    ];
    assertCloseTo(
      computeWeightedPercentile(observations, 0.5) as number,
      150,
      "non-finite values filtered",
    );
  }

  // --- Percentile outside [0, 1]: documented convention is explicit
  // rejection, matching computeContinuousPercentile's behaviour on the
  // same inputs (verified directly against it) ---
  {
    const values = [10, 20, 30];
    for (const p of [-0.5, -0.0001, 1.0001, 2, Number.NaN]) {
      const historical = computeContinuousPercentile(values, p);
      const weighted = computeWeightedPercentile(
        toEqualWeightObservations(values),
        p,
      );
      assert.equal(historical, null, `historical should be null for p=${p}`);
      assert.equal(weighted, null, `weighted should be null for p=${p}`);
    }
  }

  // --- Determinism: repeated calls with identical inputs produce
  // bit-identical output ---
  {
    const observations: WeightedPercentileObservation[] = [
      { value: 12.5, weight: 0.6 },
      { value: 47.75, weight: 1 },
      { value: 90.1, weight: 0.3 },
    ];
    const first = computeWeightedPercentile(observations, 0.5);
    for (let i = 0; i < 50; i += 1) {
      assert.equal(computeWeightedPercentile(observations, 0.5), first);
    }
  }

  // --- Effective sample size: equals raw count at equal weights, less
  // than raw count when weights are skewed, and never negative/NaN ---
  {
    assert.equal(computeEffectiveSampleSize([1, 1, 1, 1]), 4);
    // Exact, not approximate: normalizing by the max weight makes each
    // of the three equal 0.6 weights divide to exactly 1.0, eliminating
    // the floating-point rounding that a direct (unnormalized) sum of
    // 0.6 + 0.6 + 0.6 would otherwise introduce.
    assert.equal(computeEffectiveSampleSize([0.6, 0.6, 0.6]), 3);

    const skewed = computeEffectiveSampleSize([1, 1, 1, 8]);
    assert.ok(skewed < 4 && skewed > 0);

    // Invalid weights excluded from both numerator and denominator.
    const withInvalid = computeEffectiveSampleSize([1, 1, Number.NaN, -1, 0]);
    assert.equal(withInvalid, 2);

    assert.equal(computeEffectiveSampleSize([]), 0);
  }

  // --- Effective sample size: numerical robustness at extreme scales
  // (correctif ciblé) ---
  {
    const cases: Array<{
      weights: number[];
      expected: number;
      label: string;
    }> = [
      { weights: [1e200, 1e200], expected: 2, label: "[1e200, 1e200]" },
      { weights: [1e-200, 1e-200], expected: 2, label: "[1e-200, 1e-200]" },
      { weights: [1e308, 1], expected: 1, label: "[1e308, 1]" },
      { weights: [0.6, 0.6, 0.6], expected: 3, label: "[0.6, 0.6, 0.6]" },
    ];

    for (const { weights, expected, label } of cases) {
      const result = computeEffectiveSampleSize(weights);
      assert.ok(
        Number.isFinite(result),
        `N_eff must be finite for ${label}, got ${result}`,
      );
      const validCount = weights.filter(
        (w) => Number.isFinite(w) && w > 0,
      ).length;
      assert.ok(
        result > 0 && result <= validCount,
        `0 < N_eff <= ${validCount} violated for ${label}: got ${result}`,
      );
      assertApproximately(result, expected, `N_eff mismatch for ${label}`, {
        absolute: 1e-6,
        relative: 1e-6,
      });
    }
  }

  // --- Age-tier weighting: exact boundaries (inclusive upper bound,
  // mirroring Lot A's window-selection convention) ---
  {
    assert.equal(resolveAgeTierWeight(0), 1);
    assert.equal(resolveAgeTierWeight(90), 1);
    assert.equal(resolveAgeTierWeight(91), 0.6);
    assert.equal(resolveAgeTierWeight(180), 0.6);
    assert.equal(resolveAgeTierWeight(181), 0.3);
    assert.equal(resolveAgeTierWeight(365), 0.3);
    assert.equal(resolveAgeTierWeight(366), 0.1);
    assert.equal(resolveAgeTierWeight(730), 0.1);
    assert.equal(resolveAgeTierWeight(731), 0);
    assert.equal(resolveAgeTierWeight(-1), 0);
    assert.equal(resolveAgeTierWeight(Number.NaN), 0);
    assert.equal(resolveAgeTierWeight(Number.POSITIVE_INFINITY), 0);

    assert.deepEqual(
      [...PRICING_WEIGHTED_PERCENTILE_DEFAULT_AGE_TIERS],
      [
        { maxAgeDays: 90, coefficient: 1 },
        { maxAgeDays: 180, coefficient: 0.6 },
        { maxAgeDays: 365, coefficient: 0.3 },
        { maxAgeDays: 730, coefficient: 0.1 },
      ],
    );
  }

  // --- computeAgeWeightedPricingPercentile composition ---
  {
    const result = computeAgeWeightedPricingPercentile(
      [
        { value: 100, ageDays: 10 }, // weight 1
        { value: 100, ageDays: 10 }, // weight 1
        { value: 300, ageDays: 400 }, // weight 0.1
      ],
      0.5,
    );
    // Heavily down-weighted old observation should not dominate the
    // median of two equal-weight recent observations at the same value.
    assert.equal(result, 100);

    // An observation past the 730-day ceiling contributes nothing.
    const withStale = computeAgeWeightedPricingPercentile(
      [
        { value: 100, ageDays: 10 },
        { value: 999999, ageDays: 800 },
      ],
      0.5,
    );
    assert.equal(withStale, 100);

    // All observations past the ceiling -> no usable weight -> null.
    const allStale = computeAgeWeightedPricingPercentile(
      [
        { value: 100, ageDays: 800 },
        { value: 200, ageDays: 900 },
      ],
      0.5,
    );
    assert.equal(allStale, null);
  }

  // --- computeWeightedPercentile: numerical robustness (correctif
  // ciblé). Extremely unbalanced weights whose sum stays finite must
  // still produce a correct, finite result rather than failing closed
  // to null just because an unnormalized intermediate step would have
  // overflowed. ---
  {
    // Equal, extreme weights (sum is exactly Number.MAX_VALUE, which is
    // finite) -- the unnormalized formula's intermediate
    // `(cumulativeWeight + weight / 2) * n` step overflows to Infinity
    // for the second observation before this fix; normalizing by the
    // max weight keeps every intermediate value near 1 instead.
    const extremeEqualWeights = Number.MAX_VALUE / 2;
    const result = computeWeightedPercentile(
      [
        { value: 10, weight: extremeEqualWeights },
        { value: 20, weight: extremeEqualWeights },
      ],
      0.5,
    );
    assert.notEqual(result, null);
    assert.ok(Number.isFinite(result as number));
    assertCloseTo(result as number, 15, "extreme equal weights, sum finite");

    // Three very large, equal weights (median should land exactly on
    // the middle value, unaffected by the weights' magnitude).
    const threeExtreme = computeWeightedPercentile(
      [
        { value: 1, weight: 1e307 },
        { value: 2, weight: 1e307 },
        { value: 3, weight: 1e307 },
      ],
      0.5,
    );
    assert.notEqual(threeExtreme, null);
    assert.ok(Number.isFinite(threeExtreme as number));
    assertCloseTo(threeExtreme as number, 2, "three extreme equal weights");
  }

  // --- computeWeightedPercentile: interpolation between two finite
  // values of opposite sign and extreme magnitude must not overflow via
  // an intermediate `upper - lower` difference. ---
  {
    const hugePositive = Number.MAX_VALUE * 0.9;
    const hugeNegative = -Number.MAX_VALUE * 0.9;
    const result = computeWeightedPercentile(
      [
        { value: hugeNegative, weight: 1 },
        { value: hugePositive, weight: 1 },
      ],
      0.5,
    );
    assert.notEqual(result, null);
    assert.ok(
      Number.isFinite(result as number),
      `opposite-sign extreme interpolation must be finite, got ${result}`,
    );
    assertApproximately(
      result as number,
      0,
      "opposite-sign extreme interpolation midpoint",
      { absolute: 1, relative: 1e-9 },
    );

    // Same scenario but asymmetric weighting: result must stay finite
    // and shift toward the heavier (positive) extreme.
    const skewedResult = computeWeightedPercentile(
      [
        { value: hugeNegative, weight: 1 },
        { value: hugePositive, weight: 9 },
      ],
      0.5,
    );
    assert.ok(Number.isFinite(skewedResult as number));
    assert.ok((skewedResult as number) > 0);
  }

  // --- Age-tier configuration validation (correctif ciblé) ---
  {
    // Valid custom configuration still works as expected.
    const validCustom = [
      { maxAgeDays: 30, coefficient: 1 },
      { maxAgeDays: 60, coefficient: 0.5 },
    ];
    assert.equal(resolveAgeTierWeight(15, validCustom), 1);
    assert.equal(resolveAgeTierWeight(45, validCustom), 0.5);
    assert.equal(resolveAgeTierWeight(90, validCustom), 0);

    const invalidConfigurations: Array<{
      label: string;
      tiers: Array<{ maxAgeDays: number; coefficient: number }>;
    }> = [
      { label: "empty", tiers: [] },
      {
        label: "negative bound",
        tiers: [{ maxAgeDays: -1, coefficient: 1 }],
      },
      {
        label: "non-finite bound",
        tiers: [{ maxAgeDays: Number.POSITIVE_INFINITY, coefficient: 1 }],
      },
      {
        label: "NaN bound",
        tiers: [{ maxAgeDays: Number.NaN, coefficient: 1 }],
      },
      {
        label: "non-increasing bounds",
        tiers: [
          { maxAgeDays: 90, coefficient: 1 },
          { maxAgeDays: 90, coefficient: 0.6 },
        ],
      },
      {
        label: "decreasing bounds",
        tiers: [
          { maxAgeDays: 180, coefficient: 1 },
          { maxAgeDays: 90, coefficient: 0.6 },
        ],
      },
      {
        label: "negative coefficient",
        tiers: [{ maxAgeDays: 90, coefficient: -0.1 }],
      },
      {
        label: "coefficient above 1",
        tiers: [{ maxAgeDays: 90, coefficient: 1.1 }],
      },
      {
        label: "NaN coefficient",
        tiers: [{ maxAgeDays: 90, coefficient: Number.NaN }],
      },
      {
        label: "non-finite coefficient",
        tiers: [{ maxAgeDays: 90, coefficient: Number.POSITIVE_INFINITY }],
      },
    ];

    for (const { label, tiers } of invalidConfigurations) {
      for (const age of [0, 10, 90, 1000]) {
        assert.equal(
          resolveAgeTierWeight(age, tiers),
          0,
          `invalid tier configuration (${label}) should resolve to weight 0 at age=${age}`,
        );
      }
    }

    // An invalid custom configuration must never alter the defaults:
    // resolving with no tiers argument still uses the unchanged default
    // coefficients.
    assert.equal(resolveAgeTierWeight(90), 1);
    assert.equal(resolveAgeTierWeight(91), 0.6);
  }

  console.log("PASS -- weighted percentile (Lot B1)");
}

main();
