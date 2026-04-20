import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

/** Distinct “selling points” that usually need visual proof; matched on title + description + amenities (text only). */
const FEATURE_SIGNALS: ReadonlyArray<{ pattern: RegExp; id: string }> = [
  { pattern: /\b(pool|piscine|swimming\s+pool)\b/i, id: "pool" },
  { pattern: /\b(terrace|terrasse|patio|deck)\b/i, id: "terrace" },
  { pattern: /\b(balcony|balcon)\b/i, id: "balcony" },
  {
    pattern:
      /\b(sea|ocean|mountain|lake|garden|city|river)\s+view\b|\bvue(\s+sur)?\b|\b(panoramique|panoramic)\b|\boverlooking\b|\bview\b/i,
    id: "view",
  },
  { pattern: /\b(parking|garage|car\s+space|place\s+de\s+parking)\b/i, id: "parking" },
  { pattern: /\b(garden|jardin|yard)\b/i, id: "garden" },
  { pattern: /\b(beach|plage|sea|mer|ocean|coast|bord\s+de\s+mer)\b/i, id: "waterfront" },
  { pattern: /\b(mountain|montagne|ski(\s+in)?)\b/i, id: "mountain" },
  { pattern: /\b(jacuzzi|spa|hot\s+tub|sauna)\b/i, id: "spa" },
  { pattern: /\b(rooftop|roof\s+terrace|toit[\s-]?terrasse)\b/i, id: "rooftop" },
  { pattern: /\b(outdoor|extérieur|exterior|outside\s+space)\b/i, id: "outdoor" },
];

function countDistinctFeatureSignals(text: string): number {
  const seen = new Set<string>();
  for (const { pattern, id } of FEATURE_SIGNALS) {
    if (pattern.test(text)) seen.add(id);
  }
  return seen.size;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

export function scorePhotos(listing: NormalizedListing): ScoreResult {
  const photos = Array.isArray(listing.photos) ? listing.photos.filter(Boolean) : [];
  const count = photos.length;

  if (count === 0) {
    return {
      score: 0,
      reasons: ["No photos detected. Add images so guests can evaluate the listing."],
    };
  }

  const uniqueCount = new Set(photos).size;
  const duplicateUrls = count - uniqueCount;

  const haystack = [listing.title, listing.description, listing.amenities.join(" ")].join("\n");
  const featureSignals = countDistinctFeatureSignals(haystack);
  const descWords = wordCount(listing.description);
  const amenityLines = listing.amenities.length;

  /** Base score from volume only (same bands as before). */
  let base: number;
  let volumeReason: string;
  if (count >= 18) {
    base = 9.5;
    volumeReason = "Large number of listing images.";
  } else if (count >= 12) {
    base = 8;
    volumeReason = "Solid number of images for most listings.";
  } else if (count >= 8) {
    base = 7;
    volumeReason = "Moderate image count; more angles could still help.";
  } else if (count >= 4) {
    base = 5;
    volumeReason = "Limited image set; guests may miss key angles.";
  } else {
    base = 3;
    volumeReason = "Very few images; the space is hard to assess from the gallery alone.";
  }

  let adjustment = 0;
  const reasons: string[] = [];

  // --- Duplicate URLs (string equality only; not visual duplicate detection)
  if (duplicateUrls > 0) {
    adjustment -= Math.min(1.1, 0.18 * duplicateUrls);
    reasons.push(
      `Some image URLs are repeated (${duplicateUrls} duplicate${duplicateUrls === 1 ? "" : "s"}; ${uniqueCount} distinct URL${uniqueCount === 1 ? "" : "s"}).`
    );
  }

  // --- Many textual selling points vs a short gallery (completeness proxy)
  if (featureSignals >= 3 && count < 10) {
    adjustment -= Math.min(1.2, 0.15 * featureSignals * (1 + (10 - count) / 10));
    reasons.push(
      "Several standout features are mentioned in the text, but the image gallery is still relatively short for that level of detail."
    );
  } else if (featureSignals >= 2 && count < 6) {
    adjustment -= 0.55;
    reasons.push(
      "Multiple highlights appear in the copy while the gallery remains small; consider adding images that support those claims."
    );
  }

  // --- Long description / many amenities vs few images (coherence, not “quality”)
  if (descWords >= 220 && count < 8) {
    adjustment -= 0.45;
    reasons.push(
      "The written description is detailed compared to the number of images; the gallery may under-represent what the text describes."
    );
  } else if (amenityLines >= 14 && count < 10) {
    adjustment -= 0.35;
    reasons.push(
      "Many amenities are listed relative to the image count; guests may expect more visual confirmation."
    );
  }

  // --- Positive coherence: fuller gallery + some textual signals, few duplicates
  if (count >= 12 && featureSignals >= 1 && duplicateUrls === 0 && descWords >= 60) {
    adjustment += 0.35;
    reasons.push("Image count, distinct URLs, and listing copy line up reasonably well for a clear first impression.");
  } else if (count >= 18 && duplicateUrls <= 1 && featureSignals >= 2) {
    adjustment += 0.25;
    reasons.push("Broad gallery with limited URL repetition and multiple highlighted features in the text.");
  }

  // --- Platform: soft context only (does not claim image quality)
  if (listing.platform === "booking" && featureSignals >= 2 && count < 12) {
    reasons.push("On hotel-style platforms, travelers often skim many images when several features are emphasized.");
  }

  let score = base + adjustment;
  score = Math.max(0, Math.min(10, Number(score.toFixed(1))));

  reasons.unshift(volumeReason);
  reasons.push(
    `Gallery: ${count} image URL${count === 1 ? "" : "s"} (${uniqueCount} distinct). Text signals detected for ${featureSignals} highlight area${featureSignals === 1 ? "" : "s"} (from wording only, not image content).`
  );

  return {
    score,
    reasons,
  };
}
