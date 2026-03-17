import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

const CORE_AMENITIES = [
  "wifi",
  "wi-fi",
  "wireless internet",
  "kitchen",
  "air conditioning",
  "ac",
  "heating",
  "parking",
  "free parking",
  "washer",
  "washing machine",
  "laundry",
];

export function scoreAmenities(listing: NormalizedListing): ScoreResult {
  const amenities = Array.isArray(listing.amenities)
    ? listing.amenities.map((a) => a.toLowerCase().trim()).filter(Boolean)
    : [];
  const count = amenities.length;

  if (count === 0) {
    return {
      score: 2,
      reasons: ["No amenities detected. Ensure basic amenities are listed."],
    };
  }

  let score: number;
  const reasons: string[] = [];

  if (count >= 25) {
    score = 9;
    reasons.push("Very rich amenity list.");
  } else if (count >= 15) {
    score = 8;
    reasons.push("Strong amenity coverage.");
  } else if (count >= 8) {
    score = 6.5;
    reasons.push("Decent set of amenities; consider adding more where relevant.");
  } else if (count >= 4) {
    score = 5;
    reasons.push("Basic amenities only; guests may expect more.");
  } else {
    score = 3.5;
    reasons.push("Very limited amenities; listing may feel bare-bones.");
  }

  const missingCore: string[] = [];
  for (const core of CORE_AMENITIES) {
    const token = core.toLowerCase();
    const present = amenities.some((a) => a.includes(token));
    if (!present) {
      missingCore.push(core);
    }
  }

  if (missingCore.length > 0) {
    score -= 1;
    reasons.push(
      `Missing some common amenities guests look for (e.g. ${missingCore
        .slice(0, 4)
        .join(", ")}).`
    );
  } else {
    score += 0.5;
    reasons.push("Core amenities (Wi‑Fi, kitchen, temperature control, laundry/parking) appear covered.");
  }

  reasons.push(`Detected ${count} amenit${count === 1 ? "y" : "ies"}.`);

  return {
    score: Math.max(0, Math.min(10, Number(score.toFixed(1)))),
    reasons,
  };
}
