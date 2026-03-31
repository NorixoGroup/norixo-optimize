import type { ExtractedListing } from "@/lib/extractors/types";
import { normalizeListing } from "@/lib/listings/normalizeListing";
import { scorePhotos } from "@/lib/scoring/scorePhotos";
import { scoreDescription } from "@/lib/scoring/scoreDescription";
import { scoreAmenities } from "@/lib/scoring/scoreAmenities";
import { scoreSeo } from "@/lib/scoring/scoreSeo";
import { scoreTrust } from "@/lib/scoring/scoreTrust";
import { scorePricing } from "@/lib/scoring/scorePricing";
import { scoreOverall } from "@/lib/scoring/scoreOverall";
import { buildActionPlan } from "@/lib/recommendations/buildActionPlan";
import { buildTextSuggestions } from "@/lib/recommendations/buildTextSuggestions";
import { buildPhotoSuggestions } from "@/lib/recommendations/buildPhotoSuggestions";
import { estimateBookingLift } from "@/lib/impact/estimateBookingLift";
import { estimateRevenueImpact } from "@/lib/impact/estimateRevenueImpact";
import { computeMarketPosition } from "@/lib/market/computeMarketPosition";
import { computeListingQualityIndex } from "@/lib/indexes/computeListingQualityIndex";

export type AuditImprovement = {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
};

export type AuditResult = {
  overallScore: number;
  photoQuality: number;
  photoOrder: number;
  descriptionQuality: number;
  amenitiesCompleteness: number;
  seoStrength: number;
  conversionStrength: number;

  strengths: string[];
  weaknesses: string[];
  improvements: AuditImprovement[];

  suggestedOpening: string;
  photoOrderSuggestions: string[];
  missingAmenities: string[];

  competitorSummary: {
    competitorCount: number;
    averageOverallScore: number;
    targetVsMarketPosition: string;
    keyGaps: string[];
    keyAdvantages: string[];
  };

  estimatedBookingLift?: {
    low: number;
    high: number;
    label: string;
    summary: string;
  };

  estimatedRevenueImpact?: {
    lowMonthly: number | null;
    highMonthly: number | null;
    summary: string;
  };

  impactSummary?: string;

  marketPosition?: {
    score: number;
    label: "underperforming" | "below_market" | "competitive" | "top_performer";
    summary: string;
    avgCompetitorPrice: number | null;
    avgCompetitorScore: number | null;
    avgCompetitorRating: number | null;
    priceDeltaPercent: number | null;
  };

  listingQualityIndex?: {
    score: number;
    label:
      | "needs_work"
      | "improving"
      | "competitive"
      | "strong_performer"
      | "market_leader";
    summary: string;
    components: {
      listingQuality: number;
      marketCompetitiveness: number;
      conversionPotential: number;
    };
  };
};

export type RunAuditInput = {
  target: ExtractedListing;
  competitors?: ExtractedListing[];
};

const STANDARD_AMENITY_RULES = [
  {
    key: "wifi",
    labels: ["wifi", "wi-fi", "wireless internet", "internet"],
    fallback: "Wi‑Fi fiable",
  },
  {
    key: "kitchen",
    labels: ["kitchen", "cuisine", "kitchenette", "cooking basics"],
    fallback: "Cuisine équipée",
  },
  {
    key: "aircon",
    labels: ["air conditioning", "clim", "climatisation", "ac"],
    fallback: "Climatisation",
  },
  {
    key: "heating",
    labels: ["heating", "chauffage"],
    fallback: "Chauffage",
  },
  {
    key: "parking",
    labels: ["parking", "garage", "car park"],
    fallback: "Stationnement",
  },
  {
    key: "washer",
    labels: ["washer", "washing machine", "laverie", "machine a laver"],
    fallback: "Lave-linge",
  },
  {
    key: "workspace",
    labels: ["desk", "workspace", "office", "bureau"],
    fallback: "Espace de travail",
  },
];

type AuditMarketPositionLabel = NonNullable<AuditResult["marketPosition"]>["label"];
type AuditListingQualityIndexLabel = NonNullable<AuditResult["listingQualityIndex"]>["label"];
type AuditListingQualityIndexComponents = NonNullable<
  AuditResult["listingQualityIndex"]
>["components"];

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function roundToOne(value: number): number {
  return Number(value.toFixed(1));
}

function detectPropertyType(target: ExtractedListing, normalizedTitle: string): string {
  const explicit =
    target.propertyType ??
    target.structure?.propertyType ??
    null;

  if (explicit && explicit.trim()) {
    return explicit.trim().toLowerCase();
  }

  const title = normalizedTitle.toLowerCase();
  const heuristics = ["riad", "villa", "studio", "loft", "suite", "maison", "house", "room"];

  for (const value of heuristics) {
    if (title.includes(value)) {
      return value;
    }
  }

  return "appartement";
}

function buildPhotoOrderScore(photoCount: number, photoScore: number): number {
  if (photoCount <= 0) return 0;

  let score = photoScore;

  if (photoCount < 5) score -= 2;
  else if (photoCount < 8) score -= 1;
  else if (photoCount >= 12) score += 0.5;

  return roundToOne(clamp(score, 0, 10));
}

function buildConversionStrength(scores: {
  description: number;
  seo: number;
  trust: number;
  pricing: number;
  amenities: number;
}): number {
  const weighted =
    scores.description * 0.3 +
    scores.seo * 0.15 +
    scores.trust * 0.25 +
    scores.pricing * 0.15 +
    scores.amenities * 0.15;

  return roundToOne(clamp(weighted, 0, 10));
}

function localizeBookingLiftLabel(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("limited")) return "Potentiel limité";
  if (normalized.includes("moderate")) return "Potentiel modéré";
  if (normalized.includes("strong")) return "Potentiel élevé";
  if (normalized.includes("high")) return "Potentiel important";
  return "Potentiel estimé";
}

function buildBookingLiftSummary(
  overallScore: number,
  low: number,
  high: number,
  highPriorityCount: number,
): string {
  if (high <= 4) {
    return "L’annonce est déjà proche de son niveau actuel de conversion. Les gains attendus restent surtout incrémentaux.";
  }

  if (overallScore < 5.5) {
    return `Le niveau actuel laisse un vrai potentiel de rattrapage. En traitant les priorités visibles, les réservations peuvent progresser d’environ ${low}% à ${high}%.`;
  }

  if (highPriorityCount >= 2) {
    return `Plusieurs leviers à fort impact restent ouverts. Une mise à niveau cohérente peut soutenir un gain de ${low}% à ${high}% de réservations.`;
  }

  return `Le potentiel reste surtout lié à quelques optimisations ciblées. Le gain estimé se situe autour de ${low}% à ${high}% de réservations.`;
}

function buildRevenueImpactSummary(
  lowMonthly: number | null,
  highMonthly: number | null,
  currency: string | null,
): string {
  const displayCurrency = currency ?? "EUR";
  const formatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: displayCurrency,
    maximumFractionDigits: 0,
  });

  if (lowMonthly == null || highMonthly == null) {
    return "Le revenu additionnel ne peut pas être chiffré précisément sans base tarifaire fiable, mais une meilleure conversion doit mécaniquement améliorer le potentiel de revenu.";
  }

  if (lowMonthly <= 0 && highMonthly <= 0) {
    return "Le potentiel de revenu additionnel reste limité avec les hypothèses actuelles.";
  }

  if (lowMonthly <= 0) {
    return `Le potentiel de revenu supplémentaire peut atteindre environ ${formatter.format(highMonthly)} par mois après optimisation.`;
  }

  return `Le potentiel de revenu supplémentaire est estimé entre ${formatter.format(lowMonthly)} et ${formatter.format(highMonthly)} par mois dans un scénario d’exécution cohérent.`;
}

function buildImpactSummary(overallScore: number, weakestAreas: string[], bookingLiftHigh: number): string {
  if (overallScore < 5) {
    return `L’annonce perd encore de la conversion sur ses éléments les plus visibles. En corrigeant en priorité ${weakestAreas.slice(0, 2).join(" et ") || "les fondamentaux de présentation"}, le potentiel business devient significatif.`;
  }

  if (overallScore < 7) {
    return `L’annonce repose sur une base saine mais reste freinée par ${weakestAreas.slice(0, 2).join(" et ") || "plusieurs signaux visibles"}. Le potentiel de progression est crédible, avec un gain estimé pouvant aller jusqu’à ${bookingLiftHigh}%.`;
  }

  return `L’annonce est déjà compétitive. Les gains restants viendront surtout d’ajustements plus fins sur ${weakestAreas[0] || "la première impression"} et la clarté de la valeur.`;
}

function buildMarketPositionSummary(options: {
  positionLabel: AuditMarketPositionLabel;
  avgCompetitorPrice: number | null;
  priceDeltaPercent: number | null;
  avgCompetitorRating: number | null;
  hasCompetitors: boolean;
}): string {
  const { positionLabel, avgCompetitorPrice, priceDeltaPercent, avgCompetitorRating, hasCompetitors } =
    options;

  if (!hasCompetitors) {
    if (positionLabel === "top_performer") {
      return "Les comparables sont encore limités, mais les signaux actuels placent l’annonce sur une base déjà compétitive.";
    }

    if (positionLabel === "underperforming" || positionLabel === "below_market") {
      return "Les comparables sont encore limités, mais les signaux actuels indiquent que l’annonce reste en retrait par rapport à son potentiel.";
    }

    return "Les comparables sont encore limités. L’annonce semble proche du marché, avec une marge de progression mesurable.";
  }

  const priceText =
    avgCompetitorPrice != null && priceDeltaPercent != null
      ? priceDeltaPercent > 0
        ? `Le tarif actuel se situe environ ${Math.abs(priceDeltaPercent).toFixed(0)}% au-dessus du prix moyen observé.`
        : priceDeltaPercent < 0
        ? `Le tarif actuel se situe environ ${Math.abs(priceDeltaPercent).toFixed(0)}% sous le prix moyen observé.`
        : "Le tarif actuel est globalement aligné avec le prix moyen observé."
      : "Le positionnement prix reste partiellement estimé faute de comparaison tarifaire complète.";

  const ratingText =
    avgCompetitorRating != null
      ? `La note moyenne concurrente observée est de ${avgCompetitorRating.toFixed(1)}/5.`
      : "La comparaison d’avis reste incomplète à ce stade.";

  switch (positionLabel) {
    case "top_performer":
      return `L’annonce se positionne au-dessus du marché sur ses signaux visibles. ${priceText} ${ratingText}`;
    case "competitive":
      return `L’annonce est globalement alignée avec les offres comparables. ${priceText} ${ratingText}`;
    case "below_market":
      return `L’annonce reste légèrement en dessous du niveau de marché observé. ${priceText} ${ratingText}`;
    default:
      return `L’annonce reste en retrait par rapport au marché observé. ${priceText} ${ratingText}`;
  }
}

function localizeLqiLabel(
  label: AuditListingQualityIndexLabel,
): AuditListingQualityIndexLabel {
  return label;
}

function buildLqiSummary(
  label: AuditListingQualityIndexLabel,
  components: AuditListingQualityIndexComponents,
): string {
  if (label === "market_leader") {
    return "L’annonce se situe à un niveau élevé de qualité et de compétitivité. Le potentiel restant dépend surtout d’optimisations fines.";
  }

  if (label === "strong_performer") {
    return "L’annonce présente une base solide. Elle combine déjà une qualité perçue crédible et une compétitivité locale favorable.";
  }

  if (label === "competitive") {
    return "L’annonce est compétitive, mais certains leviers visibles peuvent encore améliorer la conversion et le positionnement.";
  }

  if (label === "improving") {
    return `L’annonce progresse mais reste encore freinée par quelques points structurants, notamment sur la qualité perçue (${components.listingQuality}/100) et la conversion (${components.conversionPotential}/100).`;
  }

  return "L’annonce doit encore renforcer ses fondamentaux pour devenir réellement compétitive face aux offres comparables.";
}

function pickWeakAreas(scores: {
  photos: number;
  description: number;
  amenities: number;
  seo: number;
  trust: number;
  pricing: number;
}): Array<{ key: string; label: string; score: number }> {
  return [
    { key: "photos", label: "les photos", score: scores.photos },
    { key: "description", label: "la description", score: scores.description },
    { key: "amenities", label: "les équipements", score: scores.amenities },
    { key: "seo", label: "le titre et la lisibilité", score: scores.seo },
    { key: "trust", label: "la réassurance", score: scores.trust },
    { key: "pricing", label: "le positionnement tarifaire", score: scores.pricing },
  ].sort((a, b) => a.score - b.score);
}

function buildStrengths(scores: {
  photos: number;
  description: number;
  amenities: number;
  seo: number;
  trust: number;
  pricing: number;
}, marketLabel: AuditMarketPositionLabel): string[] {
  const strengths: string[] = [];

  if (scores.photos >= 7) {
    strengths.push("La présentation visuelle est déjà suffisamment solide pour soutenir une bonne première impression.");
  }
  if (scores.description >= 7) {
    strengths.push("La description repose déjà sur une base claire et exploitable pour la conversion.");
  }
  if (scores.amenities >= 7) {
    strengths.push("Les équipements essentiels sont déjà relativement bien représentés dans l’annonce.");
  }
  if (scores.trust >= 7) {
    strengths.push("Les signaux de confiance sont déjà assez présents pour rassurer les voyageurs.");
  }
  if (marketLabel === "competitive" || marketLabel === "top_performer") {
    strengths.push("Le positionnement global de l’annonce est déjà crédible face au marché observé.");
  }

  if (strengths.length === 0) {
    strengths.push("L’annonce présente déjà assez de matière pour soutenir une amélioration rapide et concrète.");
  }

  return strengths.slice(0, 4);
}

function buildWeaknesses(
  weakestAreas: Array<{ key: string; label: string; score: number }>,
  photoWarnings: string[],
  textTips: string[],
): string[] {
  const weaknesses: string[] = [];

  if (weakestAreas[0]) {
    weaknesses.push(`La conversion reste freinée en priorité par ${weakestAreas[0].label}.`);
  }
  if (weakestAreas[1] && weakestAreas[1].score < 7) {
    weaknesses.push(`Le niveau actuel de ${weakestAreas[1].label} laisse encore une marge de progression visible.`);
  }

  for (const item of [...photoWarnings, ...textTips]) {
    const cleaned = item.trim();
    if (!cleaned) continue;
    weaknesses.push(cleaned);
    if (weaknesses.length >= 5) break;
  }

  return Array.from(new Set(weaknesses)).slice(0, 5);
}

function buildMissingAmenities(amenities: string[]): string[] {
  const haystack = amenities.map((item) => item.toLowerCase());

  const missing = STANDARD_AMENITY_RULES.filter((rule) => {
    return !rule.labels.some((label) => haystack.some((value) => value.includes(label)));
  }).map((rule) => rule.fallback);

  return missing.slice(0, 5);
}

function buildCompetitorSummary(options: {
  competitorCount: number;
  avgCompetitorScore: number | null;
  marketLabel: AuditMarketPositionLabel;
  weakestAreas: Array<{ key: string; label: string; score: number }>;
  strengths: string[];
}): AuditResult["competitorSummary"] {
  const { competitorCount, avgCompetitorScore, marketLabel, weakestAreas, strengths } = options;

  const targetVsMarketPosition =
    marketLabel === "top_performer"
      ? "Votre annonce se situe actuellement au-dessus du niveau moyen observé sur le marché."
      : marketLabel === "competitive"
      ? "Votre annonce reste alignée avec le niveau moyen du marché, avec encore quelques leviers d’optimisation."
      : marketLabel === "below_market"
      ? "Votre annonce reste légèrement en retrait par rapport au marché observé."
      : "Votre annonce reste aujourd’hui sous le niveau de marché observé.";

  const keyGaps = weakestAreas
    .filter((item) => item.score < 7)
    .slice(0, 3)
    .map((item) => `Renforcer ${item.label} pour réduire l’écart concurrentiel.`);

  const keyAdvantages = strengths.slice(0, 3);

  return {
    competitorCount,
    averageOverallScore: avgCompetitorScore != null ? roundToOne(avgCompetitorScore) : 0,
    targetVsMarketPosition,
    keyGaps,
    keyAdvantages,
  };
}

export async function runAudit(input: RunAuditInput): Promise<AuditResult> {
  const competitors = (input.competitors ?? []).slice(0, 15);

  // -----------------------------
  // 1. Normalize listing
  // -----------------------------
  // Normalize listing data once so scoring and any future logic have a safe shape
  const normalizedTarget = normalizeListing(input.target);
  const normalizedCompetitors = competitors.map((c) => normalizeListing(c));

  // -----------------------------
  // 2. Compute scores
  // -----------------------------
  // Compute deterministic sub-scores based on normalized listing data
  const photoScore = scorePhotos(normalizedTarget);
  const descriptionScore = scoreDescription(normalizedTarget);
  const amenitiesScore = scoreAmenities(normalizedTarget);
  const seoScore = scoreSeo(normalizedTarget);
  const trustScore = scoreTrust(normalizedTarget);

  // Derive simple market pricing context from competitors when available
  const competitorPrices = normalizedCompetitors
    .map((c) => c.price)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p > 0);

  const pricingScore =
    competitorPrices.length > 0
      ? scorePricing(normalizedTarget, {
          averagePrice:
            competitorPrices.reduce((sum, value) => sum + value, 0) / competitorPrices.length,
          currency: normalizedTarget.currency ?? undefined,
        })
      : scorePricing(normalizedTarget);

  const scores = {
    photos: photoScore,
    description: descriptionScore,
    amenities: amenitiesScore,
    seo: seoScore,
    trust: trustScore,
    pricing: pricingScore,
  };

  const overallScore = scoreOverall({
    photos: scores.photos.score,
    description: scores.description.score,
    amenities: scores.amenities.score,
    seo: scores.seo.score,
    trust: scores.trust.score,
    pricing: scores.pricing.score,
  });

  // -----------------------------
  // 3. Build recommendations
  // -----------------------------
  // Build structured internal recommendations based on deterministic scoring and normalized data
  const actionPlan = buildActionPlan({
    scores: {
      photos: photoScore.score,
      description: descriptionScore.score,
      amenities: amenitiesScore.score,
      seo: seoScore.score,
      trust: trustScore.score,
      pricing: pricingScore.score,
    },
    reasons: {
      photos: photoScore.reasons,
      description: descriptionScore.reasons,
      amenities: amenitiesScore.reasons,
      seo: seoScore.reasons,
      trust: trustScore.reasons,
      pricing: pricingScore.reasons,
    },
  });

  const textSuggestions = buildTextSuggestions({
    title: normalizedTarget.title,
    description: normalizedTarget.description,
    amenities: normalizedTarget.amenities,
    city: normalizedTarget.city,
  });

  const photoSuggestions = buildPhotoSuggestions({
    photos: normalizedTarget.photos,
    title: normalizedTarget.title,
    description: normalizedTarget.description,
  });

  const recommendations = {
    actionPlan,
    textSuggestions,
    photoSuggestions,
  };

  // -----------------------------
  // 4. Estimate impact
  // -----------------------------
  // Estimate booking lift potential based on current vs potential score and action plan intensity
  const highPriorityCount = recommendations.actionPlan.filter(
    (item) => item.priority === "high",
  ).length;
  const mediumPriorityCount = recommendations.actionPlan.filter(
    (item) => item.priority === "medium",
  ).length;

  // Conservatively estimate a potential score if all key improvements are implemented
  const potentialScoreDelta = highPriorityCount * 0.5 + mediumPriorityCount * 0.25;
  const potentialScore = Math.min(10, overallScore + potentialScoreDelta);

  const bookingLift = estimateBookingLift({
    currentScore: overallScore,
    potentialScore,
    highPriorityCount,
    mediumPriorityCount,
  });

  const revenueImpact = estimateRevenueImpact({
    nightlyPrice: normalizedTarget.price,
    bookingLiftLowPercent: bookingLift.lowPercent,
    bookingLiftHighPercent: bookingLift.highPercent,
  });

  const impact = {
    bookingLift,
    revenueImpact,
  };

  // -----------------------------
  // 5. Compute market position
  // -----------------------------

  // Compute market position based on normalized listing data and available competitors
  const marketPosition = computeMarketPosition({
    listing: {
      price: normalizedTarget.price,
      rating: normalizedTarget.rating,
      score: overallScore,
    },
    competitors: normalizedCompetitors.map((c) => ({
      price: c.price,
      rating: c.rating,
      // Per-competitor optimization scores are not currently computed; use null safely.
      score: null,
    })),
  });

  const market = {
    position: marketPosition,
  };

  // Compute Listing Quality Index (LQI) using overall, market, and potential scores
  const listingQualityIndex = computeListingQualityIndex({
    overallScore,
    marketScore: market.position.marketScore,
    currentScore: overallScore,
    potentialScore,
  });
  const weakestAreas = pickWeakAreas({
    photos: photoScore.score,
    description: descriptionScore.score,
    amenities: amenitiesScore.score,
    seo: seoScore.score,
    trust: trustScore.score,
    pricing: pricingScore.score,
  });

  const competitorAverageScoreFromPrices =
    normalizedCompetitors.length > 0
      ? roundToOne(
          clamp(
            overallScore +
              (market.position.positionLabel === "top_performer"
                ? -0.6
                : market.position.positionLabel === "competitive"
                ? 0
                : market.position.positionLabel === "below_market"
                ? 0.7
                : 1.2),
            0,
            10,
          ),
        )
      : null;

  const avgCompetitorPrice =
    market.position.avgCompetitorPrice ??
    (normalizedTarget.price != null ? roundToOne(normalizedTarget.price) : null);
  const avgCompetitorScore =
    market.position.avgCompetitorScore ?? competitorAverageScoreFromPrices;
  const avgCompetitorRating =
    market.position.avgCompetitorRating ??
    (normalizedTarget.rating != null ? roundToOne(clamp(normalizedTarget.rating - 0.1, 0, 5)) : null);
  const priceDeltaPercent =
    market.position.priceDeltaPercent ??
    (normalizedTarget.price != null && avgCompetitorPrice != null && avgCompetitorPrice > 0
      ? roundToOne(((normalizedTarget.price - avgCompetitorPrice) / avgCompetitorPrice) * 100)
      : null);

  const strengths = buildStrengths(
    {
      photos: photoScore.score,
      description: descriptionScore.score,
      amenities: amenitiesScore.score,
      seo: seoScore.score,
      trust: trustScore.score,
      pricing: pricingScore.score,
    },
    market.position.positionLabel,
  );

  const weaknesses = buildWeaknesses(
    weakestAreas,
    recommendations.photoSuggestions.coverageWarnings.slice(0, 3),
    recommendations.textSuggestions.improvementTips.slice(0, 3),
  );

  const missingAmenities = buildMissingAmenities(normalizedTarget.amenities);

  const planImprovements: AuditImprovement[] = recommendations.actionPlan.map((item) => ({
    title: item.title,
    description: item.description,
    impact: item.impact,
  }));

  const fallbackImprovements: AuditImprovement[] = [
    ...recommendations.textSuggestions.improvementTips.slice(0, 2).map((tip) => ({
      title: "Renforcer la clarté de l’annonce",
      description: tip,
      impact: "medium" as const,
    })),
    ...recommendations.photoSuggestions.improvementTips.slice(0, 2).map((tip) => ({
      title: "Améliorer la galerie photos",
      description: tip,
      impact: "medium" as const,
    })),
  ];

  const improvements: AuditImprovement[] = [];
  const seenImprovementTitles = new Set<string>();

  for (const item of [...planImprovements, ...fallbackImprovements]) {
    const title = item.title.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seenImprovementTitles.has(key)) continue;
    seenImprovementTitles.add(key);
    improvements.push(item);
    if (improvements.length >= 5) break;
  }

  const propertyType = detectPropertyType(input.target, normalizedTarget.title);
  const cityLabel = normalizedTarget.city ?? input.target.locationLabel ?? "votre zone";
  const suggestedOpening =
    recommendations.textSuggestions.suggestedOpeningParagraph ||
    `Ce ${propertyType} à ${cityLabel} se distingue par une promesse plus lisible et une expérience pensée pour rassurer les voyageurs dès les premières lignes.`;

  const localizedBookingLiftLabel = localizeBookingLiftLabel(impact.bookingLift.label);
  const bookingLiftSummary = buildBookingLiftSummary(
    overallScore,
    impact.bookingLift.lowPercent,
    impact.bookingLift.highPercent,
    highPriorityCount,
  );
  const revenueImpactSummary = buildRevenueImpactSummary(
    impact.revenueImpact.lowMonthlyImpact,
    impact.revenueImpact.highMonthlyImpact,
    normalizedTarget.currency,
  );
  const impactSummary = buildImpactSummary(
    overallScore,
    weakestAreas.map((item) => item.label),
    impact.bookingLift.highPercent,
  );

  const marketSummary = buildMarketPositionSummary({
    positionLabel: market.position.positionLabel,
    avgCompetitorPrice,
    priceDeltaPercent,
    avgCompetitorRating,
    hasCompetitors: normalizedCompetitors.length > 0,
  });

  const competitorSummary = buildCompetitorSummary({
    competitorCount: normalizedCompetitors.length,
    avgCompetitorScore,
    marketLabel: market.position.positionLabel,
    weakestAreas,
    strengths,
  });

  return {
    overallScore,
    photoQuality: photoScore.score,
    photoOrder: buildPhotoOrderScore(normalizedTarget.photos.length, photoScore.score),
    descriptionQuality: descriptionScore.score,
    amenitiesCompleteness: amenitiesScore.score,
    seoStrength: seoScore.score,
    conversionStrength: buildConversionStrength({
      description: descriptionScore.score,
      seo: seoScore.score,
      trust: trustScore.score,
      pricing: pricingScore.score,
      amenities: amenitiesScore.score,
    }),
    strengths,
    weaknesses,
    improvements,
    suggestedOpening,
    photoOrderSuggestions: recommendations.photoSuggestions.suggestedPhotoOrder,
    missingAmenities,
    competitorSummary,
    estimatedBookingLift: {
      low: impact.bookingLift.lowPercent,
      high: impact.bookingLift.highPercent,
      label: localizedBookingLiftLabel,
      summary: bookingLiftSummary,
    },
    estimatedRevenueImpact: {
      lowMonthly: impact.revenueImpact.lowMonthlyImpact,
      highMonthly: impact.revenueImpact.highMonthlyImpact,
      summary: revenueImpactSummary,
    },
    impactSummary,
    marketPosition: {
      score: market.position.marketScore,
      label: market.position.positionLabel,
      summary: marketSummary,
      avgCompetitorPrice,
      avgCompetitorScore,
      avgCompetitorRating,
      priceDeltaPercent,
    },
    listingQualityIndex: {
      score: listingQualityIndex.score,
      label: localizeLqiLabel(listingQualityIndex.label),
      summary: buildLqiSummary(listingQualityIndex.label, listingQualityIndex.components),
      components: listingQualityIndex.components,
    },
  };
}
