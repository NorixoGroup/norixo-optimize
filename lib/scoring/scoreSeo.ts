import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

const PROPERTY_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(apartment|appartement|studio|house|maison|villa|suite|loft|cabin|chalet|condo|riad|room|chambre|duplex)\b/i,
];

const VALUE_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(terrace|terrasse|balcony|balcon|pool|piscine|parking|garage|rooftop|vue|view|sea\s*view|ocean\s*view|mountain\s*view|city\s*view)\b/i,
];

const LOCATION_CUE_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(city\s*center|downtown|old\s*town|centre\s*ville|centre-ville|proche|near|close\s*to|walking\s*distance|à\s*pied|minutes?\s*from|à\s*quelques\s*minutes|beach|plage|mountain|montagne)\b/i,
];

function tokenizeTitle(title: string): string[] {
  return title
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

function countMatches(patterns: ReadonlyArray<RegExp>, text: string): number {
  let hits = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) hits += 1;
  }
  return hits;
}

export function scoreSeo(listing: NormalizedListing): ScoreResult {
  const raw = listing.title ?? "";
  const title = raw.trim();
  const lower = title.toLowerCase();

  if (!title) {
    return {
      score: 2,
      reasons: ["Aucun titre n’a été trouvé : sans intitulé clair, la visibilité et le taux de clic peuvent baisser."],
    };
  }

  const words = tokenizeTitle(title);
  const wordCount = words.length;

  let score: number;
  const reasons: string[] = [];

  if (wordCount < 4) {
    score = 3.8;
    reasons.push("Le titre est trop court et ne décrit pas suffisamment l’offre pour donner envie de cliquer.");
  } else if (wordCount < 7) {
    score = 6.4;
    reasons.push("Le titre est exploitable mais manque encore de contexte utile pour convaincre rapidement.");
  } else if (wordCount <= 12) {
    score = 7.8;
    reasons.push("La longueur du titre est bien équilibrée pour rester lisible et apporter des informations utiles.");
  } else if (wordCount <= 16) {
    score = 7.1;
    reasons.push("Le titre est détaillé, mais il peut devenir un peu dense pour une lecture rapide.");
  } else {
    score = 6.0;
    reasons.push("Le titre semble trop chargé, ce qui peut réduire sa lisibilité et son impact.");
  }

  const hasPropertyType = countMatches(PROPERTY_PATTERNS, lower) > 0;
  const hasValueCue = countMatches(VALUE_PATTERNS, lower) > 0;
  const hasLocationCue = countMatches(LOCATION_CUE_PATTERNS, lower) > 0;
  const hasCity = listing.city ? lower.includes(listing.city.toLowerCase()) : false;
  const hasUsefulLocation = hasCity || hasLocationCue;

  if (hasPropertyType && hasValueCue) {
    score += 0.7;
    reasons.push("Le titre indique clairement le type de bien et un atout différenciant, ce qui renforce l’attractivité.");
  } else if (hasPropertyType || hasValueCue) {
    score += 0.35;
    reasons.push("Le titre contient un repère utile, mais il peut encore mieux valoriser l’offre.");
  }

  if (hasUsefulLocation) {
    score += 0.3;
    reasons.push("Le titre inclut des éléments de localisation utiles pour le référencement et la compréhension.");
  }

  const separatorCount = (title.match(/[|/]/g) ?? []).length + (title.match(/\s[-–—]\s/g) ?? []).length;
  if (separatorCount >= 3) {
    score -= 0.5;
    reasons.push("Le titre utilise beaucoup de séparateurs, ce qui peut le rendre plus difficile à parcourir.");
  }

  const normalizedWords = words.map((w) => w.toLowerCase());
  const repeatedSet = new Set<string>();
  const seen = new Set<string>();
  for (const w of normalizedWords) {
    if (w.length < 4) continue;
    if (seen.has(w)) repeatedSet.add(w);
    seen.add(w);
  }
  if (repeatedSet.size > 0) {
    score -= Math.min(0.4, repeatedSet.size * 0.2);
    reasons.push("Certains termes se répètent, ce qui peut donner une impression de mots-clés empilés.");
  }

  if (wordCount >= 6 && wordCount <= 13 && hasPropertyType && hasUsefulLocation && hasValueCue && separatorCount < 3) {
    score += 0.4;
    reasons.push("Le titre est clair, structuré et informatif, avec un bon potentiel de conversion.");
  } else if (!hasPropertyType && !hasUsefulLocation && !hasValueCue) {
    score -= 0.8;
    reasons.push("Le titre reste trop générique et manque d’éléments différenciants.");
  }

  return {
    score: Math.max(0, Math.min(10, Number(score.toFixed(1)))),
    reasons,
  };
}
