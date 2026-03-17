import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

export function scoreTrust(listing: NormalizedListing): ScoreResult {
  const rating = typeof listing.rating === "number" ? listing.rating : null;
  const reviews = typeof listing.reviewsCount === "number" ? listing.reviewsCount : null;

  if (rating == null || reviews == null) {
    return {
      score: 5,
      reasons: [
        "Insufficient review data. Consider collecting more reviews to build guest trust.",
      ],
    };
  }

  let score: number;
  const reasons: string[] = [];

  if (rating >= 4.8 && reviews >= 50) {
    score = 9.5;
    reasons.push("Excellent rating with strong review volume.");
  } else if (rating >= 4.6 && reviews >= 20) {
    score = 9;
    reasons.push("Very good rating and solid review count.");
  } else if (rating >= 4.3 && reviews >= 10) {
    score = 8;
    reasons.push("Good guest satisfaction with reasonable review volume.");
  } else if (rating >= 4.0 && reviews >= 5) {
    score = 7;
    reasons.push("Decent rating; more reviews would strengthen trust.");
  } else if (rating >= 3.5) {
    score = 5.5;
    reasons.push("Mixed reviews; investigate common issues and address them.");
  } else {
    score = 4;
    reasons.push("Low rating; conversion may suffer until issues are resolved.");
  }

  reasons.push(`Rating ${rating.toFixed(1)} from ${reviews} review${reviews === 1 ? "" : "s"}.`);

  return {
    score: Math.max(0, Math.min(10, Number(score.toFixed(1)))),
    reasons,
  };
}
