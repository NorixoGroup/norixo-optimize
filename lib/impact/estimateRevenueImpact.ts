export type RevenueImpactEstimate = {
  lowMonthlyImpact: number | null;
  highMonthlyImpact: number | null;
  summary: string;
  /** Prix nocturne réellement utilisé dans `baselineRevenue` (gain additionnel = baseline × lift %). */
  baselineNightlyPriceUsed: number | null;
  /** Nuits réservées / mois utilisées dans le calcul ; null si aucune base chiffrée. */
  baselineBookedNightsUsed: number | null;
};

export type EstimateRevenueImpactInput = {
  nightlyPrice: number | null;
  bookingLiftLowPercent: number;
  bookingLiftHighPercent: number;
  baselineBookedNightsPerMonth?: number;
};

function normalizePrice(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function normalizeBaselineNights(value: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  // Default when caller omits explicit occupancy (prefer an explicit value from runAudit)
  return 18;
}

export function estimateRevenueImpact(
  input: EstimateRevenueImpactInput,
): RevenueImpactEstimate {
  const nightlyPrice = normalizePrice(input.nightlyPrice);

  const lowPercentRaw = clampPercent(input.bookingLiftLowPercent);
  const highPercentRaw = clampPercent(input.bookingLiftHighPercent);

  const lowPercent = Math.min(lowPercentRaw, highPercentRaw);
  const highPercent = Math.max(lowPercentRaw, highPercentRaw);

  // If nightly price is missing, we cannot compute a numeric impact.
  if (nightlyPrice === null) {
    return {
      lowMonthlyImpact: null,
      highMonthlyImpact: null,
      summary:
        "Nightly price is missing, so an exact revenue upside cannot be estimated, but improving conversion should still translate into higher earnings if pricing is set appropriately.",
      baselineNightlyPriceUsed: null,
      baselineBookedNightsUsed: null,
    };
  }

  const baselineNights = normalizeBaselineNights(input.baselineBookedNightsPerMonth);
  const baselineRevenue = nightlyPrice * baselineNights;

  const lowImpactRaw = (baselineRevenue * lowPercent) / 100;
  const highImpactRaw = (baselineRevenue * highPercent) / 100;

  const lowMonthlyImpact = Math.round(lowImpactRaw);
  const highMonthlyImpact = Math.round(highImpactRaw);

  let summary: string;
  if (highMonthlyImpact <= 0) {
    summary =
      "Based on the current inputs, only limited additional monthly revenue is expected from these optimizations.";
  } else if (lowMonthlyImpact <= 0) {
    summary = `Estimated monthly upside could reach around ${highMonthlyImpact} in additional booking revenue if the main optimizations are implemented.`;
  } else {
    summary = `Estimated monthly upside is roughly ${lowMonthlyImpact} to ${highMonthlyImpact} in additional booking revenue, assuming about ${baselineNights} booked nights per month and the projected booking lift is achieved.`;
  }

  return {
    lowMonthlyImpact,
    highMonthlyImpact,
    summary,
    baselineNightlyPriceUsed: nightlyPrice,
    baselineBookedNightsUsed: baselineNights,
  };
}
