export type BookingLiftEstimate = {
  lowPercent: number;
  highPercent: number;
  label: string;
  summary: string;
};

export type EstimateBookingLiftInput = {
  currentScore: number;
  potentialScore: number;
  highPriorityCount?: number;
  mediumPriorityCount?: number;
};

function clampScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 10) return 10;
  return value;
}

function toNonNegativeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  return Math.floor(value);
}

function baseRangeForGap(gap: number): { low: number; high: number } {
  if (gap <= 0.25) {
    return { low: 0, high: 4 };
  }
  if (gap <= 1) {
    return { low: 3, high: 8 };
  }
  if (gap <= 2.5) {
    return { low: 6, high: 14 };
  }
  // Large improvement potential
  return { low: 10, high: 22 };
}

function labelForRange(low: number, high: number): string {
  if (high <= 5) return "Limited upside";
  if (high <= 12) return "Moderate upside";
  if (high <= 20) return "Strong upside";
  return "High upside potential";
}

export function estimateBookingLift(input: EstimateBookingLiftInput): BookingLiftEstimate {
  const current = clampScore(input.currentScore);
  const potential = clampScore(input.potentialScore);
  const highCount = toNonNegativeInt(input.highPriorityCount);
  const mediumCount = toNonNegativeInt(input.mediumPriorityCount);

  // If scores are missing or equal, treat as very limited incremental upside.
  const rawGap = Math.max(0, potential - current);
  const gap = Number.isFinite(rawGap) ? rawGap : 0;

  const base = baseRangeForGap(gap);

  // Intensity of work: more high-priority and medium-priority items suggest
  // a broader potential impact, within realistic bounds.
  const intensityScore = highCount * 1.5 + mediumCount * 0.5; // simple weighting
  const cappedIntensity = Math.min(6, intensityScore); // cap so ranges stay realistic

  const lowBoost = Math.round(cappedIntensity / 3); // up to +2 pts
  const highBoost = Math.round(cappedIntensity); // up to +6 pts

  let low = base.low + lowBoost;
  let high = base.high + highBoost;

  // Keep ranges within a conservative 0–30% window and ensure ordering.
  if (low < 0) low = 0;
  if (high < low + 1) {
    high = low + 1;
  }
  if (high > 30) {
    high = 30;
    if (low > high - 5) {
      low = high - 5;
    }
    if (low < 0) low = 0;
  }

  const label = labelForRange(low, high);

  let summary: string;
  if (gap < 0.5 && highCount === 0 && mediumCount === 0) {
    summary =
      "This listing is already close to its current conversion potential; only limited additional booking lift is expected from optimizations.";
  } else {
    summary = `Based on the current score, improvement gap and priority actions, bookings could increase by roughly ${low}% to ${high}% if the key recommendations are implemented consistently.`;
  }

  return {
    lowPercent: low,
    highPercent: high,
    label,
    summary,
  };
}
