export type MarketPositionLabel =
  | "underperforming"
  | "below_market"
  | "competitive"
  | "top_performer";

export type MarketPositionResult = {
  marketScore: number;
  positionLabel: MarketPositionLabel;
  avgCompetitorPrice: number | null;
  avgCompetitorScore: number | null;
  avgCompetitorRating: number | null;
  priceDeltaPercent: number | null;
  summary: string;
};

export type ComputeMarketPositionInput = {
  listing: {
    price: number | null;
    rating: number | null;
    score: number;
  };
  competitors: {
    price?: number | null;
    rating?: number | null;
    score?: number | null;
  }[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function clampScore(value: unknown): number {
  if (!isFiniteNumber(value)) return 0;
  if (value < 0) return 0;
  if (value > 10) return 10;
  return value;
}

function clampRating(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  if (value < 0) return 0;
  if (value > 5) return 5;
  return value;
}

function deriveMarketScore(
  listingScore: number,
  avgScore: number | null,
  listingRating: number | null,
  avgRating: number | null,
  priceDeltaPercent: number | null,
): number {
  // Start from the listing's own optimization score
  let score = clampScore(listingScore);

  // Adjust based on relative optimization score vs competitors when available
  if (avgScore != null) {
    const delta = listingScore - avgScore;
    if (delta >= 1.5) {
      score += 1;
    } else if (delta >= 0.5) {
      score += 0.5;
    } else if (delta <= -1.5) {
      score -= 1;
    } else if (delta <= -0.5) {
      score -= 0.5;
    }
  }

  // Adjust based on guest rating vs competitor average when available
  if (listingRating != null && avgRating != null) {
    const delta = listingRating - avgRating;
    if (delta >= 0.3) {
      score += 0.5;
    } else if (delta >= 0.1) {
      score += 0.2;
    } else if (delta <= -0.3) {
      score -= 0.5;
    } else if (delta <= -0.1) {
      score -= 0.2;
    }
  }

  // Adjust based on price competitiveness when price information is available
  if (priceDeltaPercent != null) {
    if (priceDeltaPercent > 0) {
      // Priced above market
      if (priceDeltaPercent > 25) {
        score -= 0.8;
      } else if (priceDeltaPercent > 10) {
        score -= 0.5;
      } else if (priceDeltaPercent > 3) {
        score -= 0.2;
      }
    } else if (priceDeltaPercent < 0) {
      const abs = Math.abs(priceDeltaPercent);
      // Slightly below market can help competitiveness; very low can signal underpricing
      if (abs >= 3 && abs <= 15) {
        score += 0.4;
      } else if (abs > 25) {
        score -= 0.2;
      }
    }
  }

  return clampScore(Number(score.toFixed(1)));
}

function labelForScore(score: number): MarketPositionLabel {
  if (score < 4.5) return "underperforming";
  if (score < 6) return "below_market";
  if (score < 8) return "competitive";
  return "top_performer";
}

export function computeMarketPosition(
  input: ComputeMarketPositionInput,
): MarketPositionResult {
  const competitors = Array.isArray(input.competitors) ? input.competitors : [];

  const competitorPrices = competitors
    .map((c) => (isFiniteNumber(c.price) ? (c.price as number) : null))
    .filter((v): v is number => v != null && v > 0);

  const competitorScores = competitors
    .map((c) => (isFiniteNumber(c.score) ? (c.score as number) : null))
    .filter((v): v is number => v != null);

  const competitorRatings = competitors
    .map((c) => clampRating(c.rating))
    .filter((v): v is number => v != null);

  const avgCompetitorPrice = average(competitorPrices);
  const avgCompetitorScore = average(competitorScores);
  const avgCompetitorRating = average(competitorRatings);

  const listingPrice = isFiniteNumber(input.listing.price) && input.listing.price! > 0
    ? input.listing.price!
    : null;

  let priceDeltaPercent: number | null = null;
  if (listingPrice != null && avgCompetitorPrice != null && avgCompetitorPrice > 0) {
    priceDeltaPercent = ((listingPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100;
    priceDeltaPercent = Number(priceDeltaPercent.toFixed(1));
  }

  const listingRating = clampRating(input.listing.rating);
  const marketScore = deriveMarketScore(
    input.listing.score,
    avgCompetitorScore,
    listingRating,
    avgCompetitorRating,
    priceDeltaPercent,
  );

  const positionLabel = labelForScore(marketScore);

  let summary: string;

  const hasAnyCompetitorData =
    avgCompetitorPrice !== null || avgCompetitorScore !== null || avgCompetitorRating !== null;

  if (!hasAnyCompetitorData) {
    if (marketScore >= 7) {
      summary =
        "There is limited competitor data, but the current optimization score suggests this listing is broadly competitive in its market.";
    } else if (marketScore >= 6) {
      summary =
        "There is limited competitor data; the listing appears average today with room to strengthen its position.";
    } else {
      summary =
        "There is limited competitor data, but the current optimization score indicates the listing is likely underperforming its potential.";
    }
  } else {
    if (positionLabel === "top_performer") {
      summary = "This listing performs strongly compared to nearby competitors.";
    } else if (positionLabel === "competitive") {
      summary = "This listing is competitive with comparable properties in the area.";
    } else if (positionLabel === "below_market") {
      summary = "This listing trails similar listings and has clear room to improve.";
    } else {
      summary = "This listing is underperforming compared to similar listings in the local market.";
    }
  }

  return {
    marketScore,
    positionLabel,
    avgCompetitorPrice: avgCompetitorPrice != null ? Number(avgCompetitorPrice.toFixed(2)) : null,
    avgCompetitorScore: avgCompetitorScore != null ? Number(avgCompetitorScore.toFixed(2)) : null,
    avgCompetitorRating: avgCompetitorRating != null ? Number(avgCompetitorRating.toFixed(2)) : null,
    priceDeltaPercent,
    summary,
  };
}
