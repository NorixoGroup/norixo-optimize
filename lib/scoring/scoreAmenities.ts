import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

/**
 * Amenity “families” for breadth scoring. Each pattern is tested on a normalized haystack
 * (EN/FR-friendly); one match covers the whole family.
 */
const AMENITY_FAMILIES: ReadonlyArray<{ id: string; label: string; pattern: RegExp }> = [
  {
    id: "connectivity",
    label: "connectivity",
    pattern:
      /\b(wifi|wi-?fi|wlan|internet|broadband|fibre|fiber|haut[\s-]?débit|connexion|sans[\s-]?fil)\b/i,
  },
  {
    id: "kitchen",
    label: "kitchen & food prep",
    pattern:
      /\b(kitchen|cuisine|microwave|micro[\s-]?ondes|réfrig|refriger|fridge|freezer|congélateur|cooktop|stove|oven|four|plaque|nespresso|coffee\s+machine|machine\s+à\s+café|kettle|bouilloire|dishwasher|lave[\s-]?vaisselle|dishes|vaisselle)\b/i,
  },
  {
    id: "climate",
    label: "heating & cooling",
    pattern:
      /\b(air\s+conditioning|clim(?:atisation)?|a\/?\s*c\b|heating|chauffage|radiator|radiateur|fan|ventilateur|central\s+heat)\b/i,
  },
  {
    id: "laundry",
    label: "laundry",
    pattern: /\b(washer|washing\s+machine|lave[\s-]?linge|dryer|sèche[\s-]?linge|laundry|laverie|iron|fer\s+à\s+repasser)\b/i,
  },
  {
    id: "parking",
    label: "parking",
    pattern: /\b(parking|stationnement|garage|car\s+space|place\s+de\s+parking)\b/i,
  },
  {
    id: "outdoor",
    label: "outdoor & leisure",
    pattern:
      /\b(pool|piscine|terrace|terrasse|balcon|balcony|patio|deck|jardin|garden|courtyard|bbq|barbecue|rooftop|jacuzzi|hot\s+tub)\b/i,
  },
  {
    id: "comfort_interior",
    label: "indoor comfort & workspace",
    pattern:
      /\b(tv|télévision|television|workspace|work\s+space|desk|bureau|ergonomic|streaming|netflix|sound\s+system|blackout|store|rideaux|sofa|canapé)\b/i,
  },
  {
    id: "practical",
    label: "practical & accessibility",
    pattern:
      /\b(elevator|lift|ascenseur|smoke\s+detector|détecteur|safe|coffre|first[\s-]?aid|luggage|bagages|self[\s-]?check|digicode|code\s+d'accès)\b/i,
  },
];

const FAMILY_COUNT = AMENITY_FAMILIES.length;

function looksNegatedOnlyLine(line: string): boolean {
  const t = line.trim();
  return /^(?:no|sans|not|without|pas\s+de|non\s+inclus|excluded)\b/i.test(t);
}

function normalizeAmenityLines(raw: string[]): { lines: string[]; haystack: string } {
  const lines = raw
    .map((a) => a.toLowerCase().trim())
    .filter(Boolean)
    .filter((a) => !looksNegatedOnlyLine(a));
  return { lines, haystack: lines.join(" | ") };
}

function collectFamilyHits(haystack: string): { ids: Set<string>; labels: string[]; missingLabels: string[] } {
  const ids = new Set<string>();
  const labels: string[] = [];
  for (const { id, label, pattern } of AMENITY_FAMILIES) {
    if (pattern.test(haystack)) {
      ids.add(id);
      labels.push(label);
    }
  }
  const missingLabels = AMENITY_FAMILIES.filter((f) => !ids.has(f.id)).map((f) => f.label);
  return { ids, labels, missingLabels };
}

export function scoreAmenities(listing: NormalizedListing): ScoreResult {
  const raw = Array.isArray(listing.amenities) ? listing.amenities : [];
  const { lines: amenities, haystack } = normalizeAmenityLines(
    raw.map((a) => (typeof a === "string" ? a : ""))
  );
  const count = amenities.length;

  if (count === 0) {
    return {
      score: 2,
      reasons: ["No amenities detected. Ensure basic amenities are listed."],
    };
  }

  const { ids: hitFamilies, labels: hitLabels, missingLabels } = collectFamilyHits(haystack);
  const familyCount = hitFamilies.size;

  /** Breadth-first score: how many practical areas are represented. */
  let score = 1.4 + (familyCount / FAMILY_COUNT) * 6.2;

  /** Extra tags beyond distinct families: modest signal of detail (not dominant). */
  const extraTags = Math.max(0, count - familyCount);
  score += Math.min(1.2, extraTags / 22);

  /** Tight list but many families = efficient coverage. */
  if (familyCount >= 6 && count <= 14) {
    score += 0.35;
  }

  /** Long tag lists with shallow thematic spread — often noisy for guests. */
  if (count >= 16 && familyCount <= 4) {
    score -= 0.85;
  } else if (count >= 22 && familyCount <= 5) {
    score -= 0.45;
  }

  /** Strong breadth + substantial list. */
  if (familyCount >= 6 && count >= 12) {
    score += 0.35;
  }

  score = Math.max(0, Math.min(10, Number(score.toFixed(1))));

  const reasons: string[] = [];

  reasons.push(
    `Amenity breadth: ${familyCount}/${FAMILY_COUNT} practical areas detected from labels (connectivity, kitchen, climate, laundry, parking, outdoor, indoor comfort, practical).`
  );

  if (familyCount >= 6) {
    reasons.push(
      `Several amenity themes are visible (${hitLabels.slice(0, 6).join(", ")}${hitLabels.length > 6 ? ", …" : ""}); this usually helps guests filter with confidence.`
    );
  } else if (familyCount >= 3) {
    reasons.push(
      `Moderate thematic coverage (${hitLabels.slice(0, 5).join(", ")}); consider filling obvious gaps guests compare on (climate, connectivity, laundry, parking when relevant).`
    );
  } else {
    reasons.push(
      "The list reads narrow across themes; even a short list can cover connectivity, climate control, and key practical items with clearer labels."
    );
  }

  if (missingLabels.length > 0 && familyCount < FAMILY_COUNT) {
    reasons.push(
      `Possible gaps to review (not all apply to every home): ${missingLabels.slice(0, 4).join(", ")}${missingLabels.length > 4 ? ", …" : ""}.`
    );
  }

  if (count >= 18 && familyCount <= 5) {
    reasons.push(
      "Many amenity tags but limited thematic variety; guests may struggle to see what truly differentiates the stay."
    );
  } else if (familyCount >= 5 && count <= 10) {
    reasons.push("Compact list with relatively broad thematic coverage—useful if labels stay accurate.");
  }

  reasons.push(
    `${count} amenity label${count === 1 ? "" : "s"} parsed (heuristic matching on text; not a guarantee every item is accurate or available).`
  );

  return {
    score,
    reasons,
  };
}
