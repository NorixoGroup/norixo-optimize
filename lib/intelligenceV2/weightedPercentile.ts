// Lot B1 (NORIXO 24-month benchmark project): a pure, self-contained
// weighted-percentile module, derived from the LOT_B1_MATH_READY design
// note. Deliberately NOT wired into pricingBenchmarkBuilder.ts,
// publicMarketOverviewBuilder.ts, publicMarketOverviewGovernance.ts or any
// generation/reading path -- this module has no imports from, and no
// importers in, the live pipeline. It does not touch Supabase, does not
// read the clock itself, and performs no I/O.
//
// computeContinuousPercentile (pricingBenchmarkBuilder.ts) is read-only
// reference material for this module and is never imported or modified:
// its convention (sort ascending, index = (n-1) * p, linearly interpolate
// between sorted[floor(index)] and sorted[ceil(index)] -- the
// PERCENTILE.INC / NumPy "linear" / Hyndman-Fan type 7 method) is the
// contract this module's equal-weight case is derived to reproduce.

export type WeightedPercentileObservation = Readonly<{
  value: number;
  weight: number;
}>;

function isUsableValue(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * Zero, negative and non-finite weights are all treated as "this
 * observation is absent" -- filtered out before any computation, never
 * propagated as NaN or causing a division by zero. This is a deliberate
 * design choice for this new module (LOT_B1_MATH_READY, point 4), not a
 * behaviour inherited from computeContinuousPercentile.
 */
function isUsableWeight(weight: number): boolean {
  return Number.isFinite(weight) && weight > 0;
}

/**
 * Percentiles outside [0, 1] are explicitly rejected (return null) by this
 * module's contract, rather than silently clamped or extrapolated. This is
 * a documented convention, distinct from computeContinuousPercentile's
 * behaviour (which returns null for the same inputs only incidentally, via
 * an out-of-bounds array access) -- both end up returning null for
 * percentile < 0 or percentile > 1, so this module stays behaviourally
 * compatible with the historical function for those inputs without
 * depending on its internal mechanism.
 */
function isUsablePercentile(percentile: number): boolean {
  return Number.isFinite(percentile) && percentile >= 0 && percentile <= 1;
}

/**
 * Weighted percentile, built to collapse exactly onto
 * computeContinuousPercentile's result when every weight is equal
 * (proved in LOT_B1_MATH_READY, point 3, for n = 1, 2, 3 and the general
 * case; re-verified numerically by this module's smoke test).
 *
 * Method: for sorted observations v_1..v_n with weights w_1..w_n, define
 * cumulative weight S_i = w_1 + ... + w_i (S_0 = 0) and total weight
 * W = S_n. Each observation's position in the same 0-indexed space as
 * computeContinuousPercentile's `index` is:
 *
 *   pos_i = (S_{i-1} + w_i / 2) * (n / W) - 0.5
 *
 * The target index is (n - 1) * percentile, exactly as in
 * computeContinuousPercentile. The result is the linear interpolation
 * between the two observations whose `pos` bracket the target index. If
 * the target index falls outside the full [pos_1, pos_n] range (possible
 * with very uneven weights concentrated away from one extreme -- see
 * LOT_B1_MATH_READY, point 4), the result is clamped to the nearest
 * extreme value rather than extrapolated.
 *
 * Numerical stability: the formula above is scale-invariant in the
 * weights (multiplying every weight by the same constant leaves every
 * pos_i unchanged), so every weight is first normalized by the largest
 * weight in the sample before S_i/W are computed. This keeps every
 * intermediate quantity bounded by roughly n, instead of letting
 * `(cumulativeWeight + weight / 2) * n` transiently overflow for very
 * large (but individually finite, and finitely-summing) weights before
 * the division by the total brings it back down. The final interpolation
 * uses `lower * (1 - t) + upper * t` rather than `lower + (upper -
 * lower) * t`, so two finite values of opposite sign and extreme
 * magnitude never form an intermediate difference that overflows --
 * each term is individually bounded by the corresponding input value's
 * own magnitude. The result is always a finite number or null, never
 * NaN or Infinity.
 */
export function computeWeightedPercentile(
  observations: ReadonlyArray<WeightedPercentileObservation>,
  percentile: number,
): number | null {
  if (!isUsablePercentile(percentile)) {
    return null;
  }

  const usable = observations.filter(
    (observation) =>
      isUsableValue(observation.value) && isUsableWeight(observation.weight),
  );

  if (usable.length === 0) {
    return null;
  }

  const sorted = [...usable].sort((left, right) => left.value - right.value);
  const n = sorted.length;

  let maxWeight = 0;
  for (const observation of sorted) {
    if (observation.weight > maxWeight) {
      maxWeight = observation.weight;
    }
  }

  // sorted is non-empty and every weight was already filtered to be
  // finite and > 0, so maxWeight > 0 here.
  const normalizedWeights: number[] = new Array(n);
  let totalNormalizedWeight = 0;
  for (let i = 0; i < n; i += 1) {
    const normalized = sorted[i].weight / maxWeight;
    normalizedWeights[i] = normalized;
    totalNormalizedWeight += normalized;
  }

  // Overflow / underflow guard: a non-finite or non-positive total
  // (normalized) weight makes the position formula meaningless -- fail
  // closed rather than return a garbage or NaN result.
  if (!Number.isFinite(totalNormalizedWeight) || totalNormalizedWeight <= 0) {
    return null;
  }

  const positions: number[] = new Array(n);
  let cumulativeNormalizedWeight = 0;
  for (let i = 0; i < n; i += 1) {
    const normalized = normalizedWeights[i];
    const position =
      ((cumulativeNormalizedWeight + normalized / 2) * n) /
        totalNormalizedWeight -
      0.5;
    if (!Number.isFinite(position)) {
      return null;
    }
    positions[i] = position;
    cumulativeNormalizedWeight += normalized;
  }

  const targetIndex = (n - 1) * percentile;

  if (targetIndex <= positions[0]) {
    return sorted[0].value;
  }
  if (targetIndex >= positions[n - 1]) {
    return sorted[n - 1].value;
  }

  for (let i = 0; i < n - 1; i += 1) {
    const lowerPosition = positions[i];
    const upperPosition = positions[i + 1];
    if (targetIndex < lowerPosition || targetIndex > upperPosition) {
      continue;
    }
    if (upperPosition === lowerPosition) {
      return sorted[i].value;
    }
    const interpolationWeight =
      (targetIndex - lowerPosition) / (upperPosition - lowerPosition);
    const result =
      sorted[i].value * (1 - interpolationWeight) +
      sorted[i + 1].value * interpolationWeight;
    return Number.isFinite(result) ? result : null;
  }

  // Unreachable given positions is non-decreasing and targetIndex was
  // already bounded above against positions[0] and positions[n - 1].
  return null;
}

/**
 * Effective sample size derived purely from the weight vector:
 * N_eff = (sum w)^2 / sum(w^2). Always <= the raw usable observation
 * count, and equal to it exactly when every usable weight is equal.
 *
 * This is NOT, and must never be presented as, a count of independent
 * listings (LOT_B1_MATH_READY, point 6). It measures how concentrated the
 * weighting is on a few observations; it has no knowledge of, and cannot
 * substitute for, per-listing deduplication (a separate, not-yet-built
 * concern -- Lot B2).
 *
 * Numerical stability: (sum w)^2 / sum(w^2) is scale-invariant (scaling
 * every weight by the same constant leaves the ratio unchanged), so every
 * weight is first normalized by the largest weight in the sample. This
 * keeps both sums bounded by roughly the observation count instead of
 * letting squaring (`weight * weight`) overflow for very large weights,
 * or underflow to exactly 0 for very small ones, before the ratio is
 * taken. The result is always a finite number in (0, usable count], or 0
 * when there is no usable weight.
 */
export function computeEffectiveSampleSize(
  weights: ReadonlyArray<number>,
): number {
  const usable = weights.filter(isUsableWeight);
  if (usable.length === 0) {
    return 0;
  }

  let maxWeight = 0;
  for (const weight of usable) {
    if (weight > maxWeight) {
      maxWeight = weight;
    }
  }

  let sumNormalizedWeights = 0;
  let sumSquaredNormalizedWeights = 0;
  for (const weight of usable) {
    const normalized = weight / maxWeight;
    sumNormalizedWeights += normalized;
    sumSquaredNormalizedWeights += normalized * normalized;
  }

  if (
    !Number.isFinite(sumNormalizedWeights) ||
    !Number.isFinite(sumSquaredNormalizedWeights) ||
    sumSquaredNormalizedWeights <= 0
  ) {
    return 0;
  }

  return (
    (sumNormalizedWeights * sumNormalizedWeights) /
    sumSquaredNormalizedWeights
  );
}

/**
 * Provisional age-tier coefficients from the Lot B1 math mission
 * (0-90 days: 1.0, >90-180: 0.6, >180-365: 0.3, >365-730: 0.1). These
 * remain proposed values, not statistically validated parameters --
 * configurable precisely so a future lot can replace them without
 * touching this module's logic.
 */
export type PricingWeightedPercentileAgeTier = Readonly<{
  maxAgeDays: number;
  coefficient: number;
}>;

export const PRICING_WEIGHTED_PERCENTILE_DEFAULT_AGE_TIERS: ReadonlyArray<PricingWeightedPercentileAgeTier> =
  Object.freeze([
    { maxAgeDays: 90, coefficient: 1 },
    { maxAgeDays: 180, coefficient: 0.6 },
    { maxAgeDays: 365, coefficient: 0.3 },
    { maxAgeDays: 730, coefficient: 0.1 },
  ]);

/**
 * A tier configuration is valid when it has at least one tier, every
 * `maxAgeDays` is finite, non-negative and strictly increasing across the
 * list (so each tier covers a well-defined, non-overlapping range), and
 * every `coefficient` is finite and within [0, 1]. The default tiers
 * above always satisfy this.
 */
function isValidAgeTierConfiguration(
  tiers: ReadonlyArray<PricingWeightedPercentileAgeTier>,
): boolean {
  if (tiers.length === 0) {
    return false;
  }

  let previousMaxAgeDays = -Infinity;
  for (const tier of tiers) {
    if (!Number.isFinite(tier.maxAgeDays) || tier.maxAgeDays < 0) {
      return false;
    }
    if (tier.maxAgeDays <= previousMaxAgeDays) {
      return false;
    }
    if (
      !Number.isFinite(tier.coefficient) ||
      tier.coefficient < 0 ||
      tier.coefficient > 1
    ) {
      return false;
    }
    previousMaxAgeDays = tier.maxAgeDays;
  }

  return true;
}

/**
 * Inclusive upper boundary on each tier (an observation exactly 90 days
 * old gets coefficient 1, not 0.6), mirroring Lot A's inclusive-boundary
 * convention for window selection. An age past the widest tier's ceiling,
 * or a negative/non-finite age, resolves to weight 0 -- which
 * computeWeightedPercentile then filters out entirely, matching Lot A's
 * stance that 730 days is a search ceiling, never a guarantee.
 *
 * A custom `tiers` configuration that fails isValidAgeTierConfiguration
 * (empty, non-finite/negative/non-increasing bounds, or a coefficient
 * outside [0, 1]) is never partially applied: this function returns 0
 * for every age in that case, exactly as if no tier had matched, rather
 * than throwing or guessing which tiers are usable. It has no side
 * effect -- an invalid configuration is simply re-checked on every call.
 */
export function resolveAgeTierWeight(
  ageDays: number,
  tiers: ReadonlyArray<PricingWeightedPercentileAgeTier> = PRICING_WEIGHTED_PERCENTILE_DEFAULT_AGE_TIERS,
): number {
  if (!isValidAgeTierConfiguration(tiers)) {
    return 0;
  }
  if (!Number.isFinite(ageDays) || ageDays < 0) {
    return 0;
  }
  for (const tier of tiers) {
    if (ageDays <= tier.maxAgeDays) {
      return tier.coefficient;
    }
  }
  return 0;
}

export type AgeWeightedPricingObservation = Readonly<{
  value: number;
  ageDays: number;
}>;

/**
 * Convenience composition of resolveAgeTierWeight and
 * computeWeightedPercentile: derives each observation's weight from its
 * age, then computes the weighted percentile. Equivalent to calling the
 * two functions separately; provided so a future caller does not need to
 * duplicate the age-to-weight mapping.
 */
export function computeAgeWeightedPricingPercentile(
  observations: ReadonlyArray<AgeWeightedPricingObservation>,
  percentile: number,
  tiers: ReadonlyArray<PricingWeightedPercentileAgeTier> = PRICING_WEIGHTED_PERCENTILE_DEFAULT_AGE_TIERS,
): number | null {
  const weighted = observations.map((observation) => ({
    value: observation.value,
    weight: resolveAgeTierWeight(observation.ageDays, tiers),
  }));
  return computeWeightedPercentile(weighted, percentile);
}
