export type ListingQualityIndexLabel =
  | "needs_work"
  | "improving"
  | "competitive"
  | "strong_performer"
  | "market_leader";

export type ListingQualityIndexResult = {
  score: number; // 0 to 100
  label: ListingQualityIndexLabel;
  summary: string;
  components: {
    listingQuality: number; // 0 to 100
    marketCompetitiveness: number; // 0 to 100
    conversionPotential: number; // 0 to 100
  };
};

export type ComputeListingQualityIndexInput = {
  overallScore: number;
  marketScore?: number | null;
  currentScore?: number;
  potentialScore?: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toTenScale(value: unknown): number {
  if (!isFiniteNumber(value)) return 0;
  return clamp(value, 0, 10);
}

function labelForScore(score: number): ListingQualityIndexLabel {
  if (score < 40) return "needs_work";
  if (score < 60) return "improving";
  if (score < 75) return "competitive";
  if (score < 90) return "strong_performer";
  return "market_leader";
}

function summaryForLabel(label: ListingQualityIndexLabel): string {
  switch (label) {
    case "needs_work":
      return "This listing needs substantial improvement to compete effectively.";
    case "improving":
      return "This listing is becoming more competitive but still has clear optimization upside.";
    case "competitive":
      return "This listing is competitive and in a good position in its market.";
    case "strong_performer":
      return "This listing performs strongly and is well positioned in its market.";
    case "market_leader":
      return "This listing operates at a market-leading level on quality and positioning.";
  }
}

export function computeListingQualityIndex(
  input: ComputeListingQualityIndexInput,
): ListingQualityIndexResult {
  // Listing quality component is driven directly from the overall optimization score.
  const overall = toTenScale(input.overallScore);
  const listingQuality = Math.round(overall * 10); // 0–100

  // Market competitiveness: use marketScore when provided, otherwise neutral.
  const hasMarketScore = isFiniteNumber(input.marketScore);
  const marketTen = hasMarketScore ? toTenScale(input.marketScore as number) : 5; // neutral ~5/10
  const marketCompetitiveness = Math.round(marketTen * 10); // 0–100

  // Conversion potential: based on the gap between current vs potential scores.
  let conversionPotential: number;
  if (isFiniteNumber(input.currentScore) && isFiniteNumber(input.potentialScore)) {
    const current = toTenScale(input.currentScore as number);
    const potential = toTenScale(input.potentialScore as number);
    const gap = clamp(potential - current, 0, 4); // treat 0–4 points as the meaningful range
    const normalizedGap = gap / 4; // 0–1
    // Base at 30/100 so very small gaps still yield some potential, large gaps approach 100.
    const rawPotential = 30 + normalizedGap * 70;
    conversionPotential = clamp(Math.round(rawPotential), 0, 100);
  } else {
    // Neutral potential when we cannot reliably estimate the gap.
    conversionPotential = 50;
  }

  // Weighted combination into final LQI.
  const weighted =
    listingQuality * 0.45 + marketCompetitiveness * 0.3 + conversionPotential * 0.25;

  const score = clamp(Math.round(weighted), 0, 100);
  const label = labelForScore(score);
  const summary = summaryForLabel(label);

  return {
    score,
    label,
    summary,
    components: {
      listingQuality,
      marketCompetitiveness,
      conversionPotential,
    },
  };
}
