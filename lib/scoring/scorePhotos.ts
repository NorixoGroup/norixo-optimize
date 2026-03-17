import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

export function scorePhotos(listing: NormalizedListing): ScoreResult {
  const photos = Array.isArray(listing.photos) ? listing.photos.filter(Boolean) : [];
  const count = photos.length;

  if (count === 0) {
    return {
      score: 0,
      reasons: ["No photos detected. Add high-quality images to make the listing viable."],
    };
  }

  let score: number;
  const reasons: string[] = [];

  if (count >= 18) {
    score = 9.5;
    reasons.push("Strong photo coverage with many images.");
  } else if (count >= 12) {
    score = 8;
    reasons.push("Good number of photos for most listings.");
  } else if (count >= 8) {
    score = 7;
    reasons.push("Decent coverage, but adding a few more photos could help.");
  } else if (count >= 4) {
    score = 5;
    reasons.push("Minimal but acceptable photo set; consider adding more angles.");
  } else {
    score = 3;
    reasons.push("Very few photos; guests may struggle to understand the space.");
  }

  reasons.push(`Detected ${count} photo${count === 1 ? "" : "s"}.`);

  return {
    score: Math.max(0, Math.min(10, Number(score.toFixed(1)))),
    reasons,
  };
}
