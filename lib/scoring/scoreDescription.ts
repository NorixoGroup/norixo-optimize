import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

export function scoreDescription(listing: NormalizedListing): ScoreResult {
  const raw = listing.description ?? "";
  const description = raw.trim();
  const length = description.length;

  if (!description) {
    return {
      score: 1,
      reasons: ["No description detected. Add a clear, guest-focused description."],
    };
  }

  let score: number;
  const reasons: string[] = [];

  if (length < 120) {
    score = 4;
    reasons.push("Description is very short; expand with more detail and context.");
  } else if (length < 260) {
    score = 6.5;
    reasons.push("Decent description length; there may still be room for clarity and flair.");
  } else if (length < 700) {
    score = 8.5;
    reasons.push("Strong description length with enough space to explain value.");
  } else {
    score = 7.5;
    reasons.push("Description is long; consider tightening to keep it scannable.");
  }

  const lower = description.toLowerCase();
  if (lower.includes("ideal for") || lower.includes("perfect for")) {
    score += 0.3;
    reasons.push("Mentions who the listing is ideal for.");
  }
  if (lower.includes("walking distance") || lower.includes("minutes from")) {
    score += 0.2;
    reasons.push("References location and proximity to points of interest.");
  }
  if (lower.includes("fast wi-fi") || lower.includes("wifi") || lower.includes("wi-fi")) {
    score += 0.2;
    reasons.push("Highlights connectivity (Wi‑Fi).");
  }

  return {
    score: Math.max(0, Math.min(10, Number(score.toFixed(1)))),
    reasons,
  };
}
