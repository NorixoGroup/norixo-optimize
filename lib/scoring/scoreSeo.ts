import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

const PROPERTY_KEYWORDS = [
  "apartment",
  "studio",
  "house",
  "villa",
  "suite",
  "loft",
  "cabin",
  "condo",
  "riad",
  "room",
];

const VALUE_KEYWORDS = [
  "rooftop",
  "terrace",
  "balcony",
  "pool",
  "old town",
  "city center",
  "sea view",
  "mountain view",
  "parking",
];

export function scoreSeo(listing: NormalizedListing): ScoreResult {
  const raw = listing.title ?? "";
  const title = raw.trim();
  const length = title.length;

  if (!title) {
    return {
      score: 2,
      reasons: ["No title detected. A clear, descriptive title is critical for search."],
    };
  }

  let score: number;
  const reasons: string[] = [];

  if (length < 20) {
    score = 4;
    reasons.push("Title is very short; add more descriptive detail.");
  } else if (length <= 60) {
    score = 7.5;
    reasons.push("Good title length for readability and search.");
  } else if (length <= 80) {
    score = 8.5;
    reasons.push("Strong, detailed title while still scannable.");
  } else {
    score = 6.5;
    reasons.push("Title is quite long; consider trimming to key information.");
  }

  const lower = title.toLowerCase();
  const hasPropertyKeyword = PROPERTY_KEYWORDS.some((kw) => lower.includes(kw));
  const hasValueKeyword = VALUE_KEYWORDS.some((kw) => lower.includes(kw));
  const hasCity = listing.city ? lower.includes(listing.city.toLowerCase()) : false;

  if (hasPropertyKeyword) {
    score += 0.4;
    reasons.push("Title mentions the property type (e.g. apartment, house, villa).");
  }

  if (hasValueKeyword) {
    score += 0.3;
    reasons.push("Title highlights a compelling feature (e.g. terrace, pool, view).");
  }

  if (hasCity) {
    score += 0.3;
    reasons.push("Title includes the city name, which helps with search intent.");
  }

  return {
    score: Math.max(0, Math.min(10, Number(score.toFixed(1)))),
    reasons,
  };
}
