import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

export type PricingMarketData = {
  averagePrice: number;
  lowerBound?: number;
  upperBound?: number;
  currency?: string;
};

export function scorePricing(
  listing: NormalizedListing,
  marketData?: PricingMarketData
): ScoreResult {
  const price = typeof listing.price === "number" ? listing.price : null;

  if (!marketData || typeof marketData.averagePrice !== "number" || marketData.averagePrice <= 0) {
    return {
      score: 5,
      reasons: [
        "No market pricing data available. Using a neutral score until comparable data is provided.",
      ],
    };
  }

  if (price == null || price <= 0) {
    return {
      score: 5,
      reasons: [
        "Listing price missing or invalid. Unable to benchmark; treating pricing as neutral.",
      ],
    };
  }

  const { averagePrice } = marketData;
  const delta = price - averagePrice;
  const percentDiff = (delta / averagePrice) * 100;

  let score: number;
  const reasons: string[] = [];

  if (Math.abs(percentDiff) <= 10) {
    score = 9;
    reasons.push("Pricing is closely aligned with local market averages.");
  } else if (Math.abs(percentDiff) <= 20) {
    score = 7;
    reasons.push("Pricing is somewhat above or below the market; may still be reasonable.");
  } else if (Math.abs(percentDiff) <= 35) {
    score = 5.5;
    reasons.push("Pricing noticeably differs from market; validate positioning vs. quality.");
  } else {
    score = 4;
    reasons.push("Pricing is far from comparable listings; conversion risk may be higher.");
  }

  if (percentDiff > 0) {
    reasons.push(
      `Listing appears priced about ${percentDiff.toFixed(
        0
      )}% above the local average based on current data.`
    );
  } else if (percentDiff < 0) {
    reasons.push(
      `Listing appears priced about ${Math.abs(percentDiff).toFixed(
        0
      )}% below the local average based on current data.`
    );
  } else {
    reasons.push("Listing price matches the current local average.");
  }

  return {
    score: Math.max(0, Math.min(10, Number(score.toFixed(1)))),
    reasons,
  };
}
