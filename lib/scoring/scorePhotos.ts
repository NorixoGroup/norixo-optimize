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
      reasons: ["Aucune photo n’a été trouvée : sans visuels, le voyageur évalue difficilement le logement."],
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
    volumeReason = "La galerie contient de nombreuses photos, ce qui facilite la projection du voyageur.";
  } else if (count >= 12) {
    base = 8;
    volumeReason = "La galerie présente un bon volume de photos, utile pour rassurer avant réservation.";
  } else if (count >= 8) {
    base = 7;
    volumeReason = "Le nombre de photos est correct, mais quelques vues supplémentaires renforceraient la compréhension du logement.";
  } else if (count >= 4) {
    base = 5;
    volumeReason = "La galerie reste limitée ; des informations visuelles clés peuvent manquer pour le voyageur.";
  } else {
    base = 3;
    volumeReason = "Le nombre de photos est insuffisant, ce qui rend l’évaluation du logement plus difficile.";
  }

  let adjustment = 0;
  const reasons: string[] = [];

  // --- Duplicate URLs (string equality only; not visual duplicate detection)
  if (duplicateUrls > 0) {
    adjustment -= Math.min(1.1, 0.18 * duplicateUrls);
    reasons.push(
      `Certaines images semblent répétées (${duplicateUrls} doublon${duplicateUrls === 1 ? "" : "s"} ; ${uniqueCount} URL distincte${uniqueCount === 1 ? "" : "s"}).`
    );
  }

  // --- Many textual selling points vs a short gallery (completeness proxy)
  if (featureSignals >= 3 && count < 10) {
    adjustment -= Math.min(1.2, 0.15 * featureSignals * (1 + (10 - count) / 10));
    reasons.push(
      "Plusieurs atouts sont mentionnés, mais la galerie reste courte au regard de la promesse de l’annonce."
    );
  } else if (featureSignals >= 2 && count < 6) {
    adjustment -= 0.55;
    reasons.push(
      "Des points forts sont annoncés alors que la galerie est réduite ; des photos dédiées renforceraient la crédibilité."
    );
  }

  // --- Long description / many amenities vs few images (coherence, not “quality”)
  if (descWords >= 220 && count < 8) {
    adjustment -= 0.45;
    reasons.push(
      "La description est riche, mais la galerie reste limitée ; le contenu visuel peut sembler sous-représenté."
    );
  } else if (amenityLines >= 14 && count < 10) {
    adjustment -= 0.35;
    reasons.push(
      "Beaucoup d’équipements sont listés par rapport aux photos, ce qui peut créer un décalage perçu."
    );
  }

  // --- Positive coherence: fuller gallery + some textual signals, few duplicates
  if (count >= 12 && featureSignals >= 1 && duplicateUrls === 0 && descWords >= 60) {
    adjustment += 0.35;
    reasons.push("Le volume de photos, leur diversité et le contenu de l’annonce sont globalement cohérents.");
  } else if (count >= 18 && duplicateUrls <= 1 && featureSignals >= 2) {
    adjustment += 0.25;
    reasons.push("La galerie est large, avec peu de répétitions, et soutient bien les atouts mis en avant.");
  }

  // --- Platform: soft context only (does not claim image quality)
  if (listing.platform === "booking" && featureSignals >= 2 && count < 12) {
    reasons.push("Sur des plateformes très comparatives, une galerie plus fournie aide souvent à mieux convertir.");
  }

  let score = base + adjustment;
  score = Math.max(0, Math.min(10, Number(score.toFixed(1))));

  reasons.unshift(volumeReason);
  reasons.push(
    `L’annonce contient ${count} photo${count === 1 ? "" : "s"} (${uniqueCount} URL distincte${uniqueCount === 1 ? "" : "s"}) et mentionne ${featureSignals} atout${featureSignals === 1 ? "" : "s"} d’après le texte.`
  );

  return {
    score,
    reasons,
  };
}
