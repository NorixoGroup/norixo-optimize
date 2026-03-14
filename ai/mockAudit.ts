import type { AuditResult, Improvement, Listing } from "@/types/domain";

type LegacyAuditShape = {
  overallScore: number;
  scores: {
    photoQuality: number;
    photoOrder: number;
    descriptionQuality: number;
    amenitiesCompleteness: number;
    seoStrength: number;
    conversionStrength: number;
  };
  strengths: string[];
  weaknesses: string[];
  prioritizedImprovements: Improvement[];
  suggestedOpeningParagraph: string;
  suggestedPhotoOrder: string[];
  missingAmenities: string[];
};

function clampScore(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function deriveScoresFromListing(listing: Listing) {
  const base = listing.title.length;

  return {
    photoQuality: clampScore(randomBetween(6, 9)),
    photoOrder: clampScore(randomBetween(5, 8)),
    descriptionQuality: clampScore(randomBetween(5, 9)),
    amenitiesCompleteness: clampScore(randomBetween(4, 9)),
    seoStrength: clampScore(base / 12 + randomBetween(3, 8)),
    conversionStrength: clampScore(randomBetween(5, 9)),
  };
}

function overallFromScores(scores: LegacyAuditShape["scores"]): number {
  const sum =
    scores.photoQuality +
    scores.photoOrder +
    scores.descriptionQuality +
    scores.amenitiesCompleteness +
    scores.seoStrength +
    scores.conversionStrength;

  return Math.round((sum / 6) * 10) / 10;
}

function buildStrengths(scores: LegacyAuditShape["scores"]): string[] {
  const strengths: string[] = [];

  if (scores.photoQuality >= 8) {
    strengths.push("Strong, scroll-stopping cover photo.");
  }
  if (scores.descriptionQuality >= 8) {
    strengths.push("Clear and compelling written description.");
  }
  if (scores.amenitiesCompleteness >= 8) {
    strengths.push("Amenities list covers most guest expectations.");
  }
  if (scores.conversionStrength >= 8) {
    strengths.push("Good use of urgency and social proof.");
  }
  if (strengths.length === 0) {
    strengths.push(
      "Solid foundation that can be improved with a few focused tweaks."
    );
  }

  return strengths;
}

function buildWeaknesses(scores: LegacyAuditShape["scores"]): string[] {
  const weaknesses: string[] = [];

  if (scores.photoOrder <= 6) {
    weaknesses.push("Photo order doesn't tell a smooth visual story.");
  }
  if (scores.descriptionQuality <= 6) {
    weaknesses.push(
      "Description is generic and doesn't highlight unique hooks."
    );
  }
  if (scores.amenitiesCompleteness <= 6) {
    weaknesses.push("Important amenities are missing or buried in the list.");
  }
  if (scores.seoStrength <= 6) {
    weaknesses.push("Title and description aren't optimized for search queries.");
  }
  if (scores.conversionStrength <= 6) {
    weaknesses.push(
      "Listing copy is light on clear benefits and calls-to-action."
    );
  }
  if (weaknesses.length === 0) {
    weaknesses.push("Minor optimizations left, mainly around polishing messaging.");
  }

  return weaknesses;
}

function buildImprovements(
  auditId: string,
  scores: LegacyAuditShape["scores"]
): Improvement[] {
  const improvements: Improvement[] = [];
  let index = 0;

  improvements.push({
    id: `${auditId}-imp-${index + 1}`,
    auditId,
    title: "Rewrite the hero section of your description",
    description:
      "Open with 2–3 lines that position who this stay is perfect for, what makes it different locally, and what guests feel as soon as they arrive.",
    impact: scores.conversionStrength <= 7 ? "high" : "medium",
    orderIndex: index + 1,
  });
  index++;

  improvements.push({
    id: `${auditId}-imp-${index + 1}`,
    auditId,
    title: "Reorder photos into a scannable story",
    description:
      "Start with the best wide shot, then living area, kitchen, bedrooms, bathrooms, and finally detail shots. Avoid repeating similar angles early on.",
    impact: scores.photoOrder <= 7 ? "high" : "medium",
    orderIndex: index + 1,
  });
  index++;

  improvements.push({
    id: `${auditId}-imp-${index + 1}`,
    auditId,
    title: "Tighten amenities list and add gaps",
    description:
      "Group amenities logically (sleep, work, family, parking) and explicitly call out gaps like fast Wi-Fi speed, coffee setup, or workspace where relevant.",
    impact: scores.amenitiesCompleteness <= 7 ? "high" : "medium",
    orderIndex: index + 1,
  });

  return improvements;
}

function buildSuggestedOpening(listing: Listing): string {
  const locationPart = listing.city ?? "this destination";
  return `Welcome to ${listing.title}, your base in ${locationPart}. Wake up to natural light, enjoy unhurried breakfasts before exploring, and come back to a calm, well-equipped space that actually feels like home.`;
}

function buildSuggestedPhotoOrder(): string[] {
  return [
    "Best wide shot of the main living area",
    "Hero exterior or view photo",
    "Living room from a second angle",
    "Kitchen and dining overview",
    "Primary bedroom",
    "Secondary sleeping areas",
    "Bathrooms",
    "Workspace / desk setup",
    "Special amenities (hot tub, balcony, garden)",
    "Neighborhood or building context",
  ];
}

function buildMissingAmenities(scores: LegacyAuditShape["scores"]): string[] {
  const missing: string[] = [];

  if (scores.amenitiesCompleteness <= 7) {
    missing.push(
      "Document Wi-Fi speed (e.g. 300 Mbps) and add it to the listing.",
      "Add basics guests search for: coffee maker, workspace, parking, blackout curtains if available.",
      "Call out family-friendly items if you have them: high chair, cot, children's tableware."
    );
  }

  if (scores.conversionStrength <= 7) {
    missing.push('Add a short "Why guests book this place" bullet list.');
  }

  return missing;
}

export function generateMockAudit(listing: Listing): AuditResult {
  const scores = deriveScoresFromListing(listing);
  const overallScore = overallFromScores(scores);
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    overallScore,
    photoQuality: scores.photoQuality,
    photoOrder: scores.photoOrder,
    descriptionQuality: scores.descriptionQuality,
    amenitiesCompleteness: scores.amenitiesCompleteness,
    seoStrength: scores.seoStrength,
    conversionStrength: scores.conversionStrength,
    strengths: buildStrengths(scores),
    weaknesses: buildWeaknesses(scores),
    improvements: buildImprovements(auditId, scores),
    suggestedOpening: buildSuggestedOpening(listing),
    photoOrderSuggestions: buildSuggestedPhotoOrder(),
    missingAmenities: buildMissingAmenities(scores),
    competitorSummary: {
      competitorCount: 0,
      averageOverallScore: 0,
      targetVsMarketPosition: "No competitors analyzed yet",
      keyGaps: [],
      keyAdvantages: [],
    },
  };
}