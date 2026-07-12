import type { ExtractedListing } from "@/lib/extractors/types";
import { logMarketPipelineStage } from "@/lib/competitors/marketPipelineDebug";
import { normalizeListing } from "@/lib/listings/normalizeListing";
import { scorePhotos } from "@/lib/scoring/scorePhotos";
import { scoreDescription } from "@/lib/scoring/scoreDescription";
import { scoreAmenities } from "@/lib/scoring/scoreAmenities";
import { scoreSeo } from "@/lib/scoring/scoreSeo";
import { scoreTrust } from "@/lib/scoring/scoreTrust";
import { scorePricing } from "@/lib/scoring/scorePricing";
import { scoreOverall } from "@/lib/scoring/scoreOverall";
import {
  buildActionPlan,
  type ActionCategory,
  type ActionPriority,
} from "@/lib/recommendations/buildActionPlan";
import { buildTextSuggestions } from "@/lib/recommendations/buildTextSuggestions";
import { buildPhotoSuggestions } from "@/lib/recommendations/buildPhotoSuggestions";
import { estimateBookingLift } from "@/lib/impact/estimateBookingLift";
import { estimateRevenueImpact } from "@/lib/impact/estimateRevenueImpact";
import { computeMarketPosition } from "@/lib/market/computeMarketPosition";
import { computeListingQualityIndex } from "@/lib/indexes/computeListingQualityIndex";
import {
  generatePricingInsight,
  type PricingBusinessInsight,
} from "@/lib/audits/businessInsights";
import {
  buildMarketIntelligenceV1,
  type MarketIntelligenceV1,
} from "@/lib/marketIntelligence/buildMarketIntelligenceV1";
import {
  buildSeasonalityEngineV1,
  type SeasonalityEngineV1,
} from "@/lib/marketIntelligence/buildSeasonalityEngineV1";
import {
  interpretSeasonality,
  type SeasonalityInsight,
} from "@/lib/marketIntelligence/interpretSeasonality";
import { deriveMarketReliabilityFromComparableCount } from "@/lib/audits/marketReliability";
import { getIntelligenceV2FeatureFlags } from "@/lib/intelligenceV2/featureFlags";
import type { PricingBenchmarkEvidence } from "@/lib/intelligenceV2/pricingBenchmarkEvidence";
import {
  getPricingBenchmarkEvidence,
  type PricingBenchmarkEvidenceSelectorResult,
} from "@/lib/intelligenceV2/pricingBenchmarkEvidenceSelector";
import {
  buildPricingDiagnosticV2,
  type PricingDiagnosticV2,
  type PricingDiagnosticV2Result,
} from "@/lib/intelligenceV2/pricingDiagnosticV2";

const DEBUG_BOOKING_PIPELINE =
  process.env.DEBUG_BOOKING_PIPELINE === "true" || process.env.DEBUG_GUEST_AUDIT === "true";

export type AuditImprovement = {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  orderIndex?: number;
  priority?: ActionPriority;
  category?: ActionCategory;
  reason?: string | null;
  source?: "action_plan" | "text_fallback" | "photo_fallback" | "score_fallback" | "preview_restore";
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
    pricedComparableCount?: number;
    averageOverallScore: number;
    targetVsMarketPosition: string;
    keyGaps: string[];
    keyAdvantages: string[];
    /** Comparables issus du fallback « weak market » Booking (non nul si présents). */
    weakBookingFallbackComparableCount?: number;
    /** Comparables budget restaurés après revert du filtre premium villa (segment mismatch). */
    premiumVillaSegmentMismatchComparableCount?: number;
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
    baselineNightlyPrice?: number | null;
    baselineBookedNightsPerMonth?: number | null;
    baselinePriceSource?: "listing" | "market_median" | "market_memory_median";
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

  // Structured fields used by the dashboard payload
  market?: {
    position?: "below" | "average" | "above" | null;
    score?: number | null;
    comparableCount?: number | null;
    pricedComparableCount?: number | null;
    avgCompetitorPrice?: number | null;
    priceDelta?: number | null;
    pricingFallbackSource?: "market_memory_median" | null;
    marketSourceQuality?: "native" | "cross_platform_fallback" | null;
    marketSourceLabel?: string | null;
  };

  business?: {
    bookingPotential?: number | null;
    estimatedRevenueLow?: number | null;
    estimatedRevenueHigh?: number | null;
  };

  scoreBreakdown?: {
    photos?: number | null;
    photoOrder?: number | null;
    description?: number | null;
    amenities?: number | null;
    seo?: number | null;
    conversion?: number | null;
  };

  businessInsights?: {
    pricing: PricingBusinessInsight | null;
  };

  /** Enrichissement marché (Market Memory) — n’alimente pas le scoring existant. */
  marketIntelligence?: MarketIntelligenceV1 | null;

  /** Enrichissement marché uniquement, non utilisé pour le scoring. */
  seasonality?: SeasonalityEngineV1 | null;

  /** Préparation UI / insight produit, non utilisé pour le scoring. */
  seasonalityInsight?: SeasonalityInsight | null;
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

function getLastCompleteUtcMonthBucket(now: Date = new Date()): string {
  const lastCompleteMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = lastCompleteMonth.getUTCFullYear();
  const month = String(lastCompleteMonth.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

/**
 * Dates séjour yyyy-mm-dd uniquement si présentes sur l’URL cible / sourceUrl (query).
 * Pas de dates inventées si absentes.
 */
function stayDatesIsoFromAuditTarget(target: ExtractedListing): {
  checkIn: string | null;
  checkOut: string | null;
} {
  const raw =
    typeof target.url === "string" && target.url.trim()
      ? target.url.trim()
      : typeof target.sourceUrl === "string" && target.sourceUrl.trim()
        ? target.sourceUrl.trim()
        : "";
  if (!raw) return { checkIn: null, checkOut: null };
  try {
    const sp = new URL(raw).searchParams;
    const ci =
      (sp.get("checkin") ?? sp.get("check_in") ?? sp.get("startDate") ?? "").trim();
    const co =
      (sp.get("checkout") ?? sp.get("check_out") ?? sp.get("endDate") ?? "").trim();
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (iso.test(ci) && iso.test(co)) return { checkIn: ci, checkOut: co };
  } catch {
    /* ignore */
  }
  return { checkIn: null, checkOut: null };
}

function medianPositiveNumbers(values: number[]): number | null {
  const sorted = values
    .filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

type BaselineNightlyPriceResolution = {
  price: number | null;
  source: "listing" | "market_median" | "market_memory_median";
};

/**
 * Prix de base pour l’impact revenu : annonce si crédible vs médiane des comparables,
 * sinon médiane (outlier ou prix annonce absent).
 *
 * Seuils adaptatifs par classe de bien :
 * - villa / maison / house : lower ×0.4, upper ×10
 *   (dispersion budget↔luxe large ; faux positifs bas comme extractions partielles à 20-30€)
 * - autres types : lower ×0.25, upper ×4
 */
function resolveBaselineNightlyPriceForImpact(params: {
  listingPrice: number | null | undefined;
  competitorPrices: number[];
  normalizedTargetType?: string | null;
}): BaselineNightlyPriceResolution {
  const listing =
    typeof params.listingPrice === "number" &&
    Number.isFinite(params.listingPrice) &&
    params.listingPrice > 0
      ? params.listingPrice
      : null;

  const median = medianPositiveNumbers(params.competitorPrices);
  const compCount = params.competitorPrices.filter(
    (p) => typeof p === "number" && Number.isFinite(p) && p > 0,
  ).length;

  const typeNorm = (params.normalizedTargetType ?? "").toLowerCase();
  const isVillaClass =
    typeNorm === "villa" ||
    typeNorm === "villa_like" ||
    typeNorm === "maison" ||
    typeNorm === "house";
  const lowerMultiplier = isVillaClass ? 0.4 : 0.25;
  const upperMultiplier = isVillaClass ? 10 : 4;

  if (listing != null) {
    if (compCount >= 2 && median != null) {
      const lowerBound = median * lowerMultiplier;
      const upperBound = median * upperMultiplier;
      const wasRejected = listing < lowerBound || listing > upperBound;
      console.log(
        "[audit][baseline-outlier-guard]",
        JSON.stringify({
          listingPrice: listing,
          median,
          compCount,
          normalizedTargetType: params.normalizedTargetType ?? null,
          lowerMultiplier,
          upperMultiplier,
          lowerBound: Math.round(lowerBound * 100) / 100,
          upperBound: Math.round(upperBound * 100) / 100,
          wasRejected,
          selectedSource: wasRejected ? "market_median" : "listing",
        }),
      );
      if (wasRejected) {
        return { price: median, source: "market_median" };
      }
    }
    return { price: listing, source: "listing" };
  }

  if (compCount >= 1 && median != null) {
    return { price: median, source: "market_median" };
  }

  return { price: null, source: "listing" };
}

/** Hypothèse d’occupation mensuelle par famille de bien (nuits réservées / mois). */
function defaultBaselineBookedNightsForProperty(propertyTypeLabel: string): number {
  const t = propertyTypeLabel.toLowerCase();
  const wholeHomeKeywords = [
    "villa",
    "maison",
    "house",
    "riad",
    "chalet",
    "bungalow",
    "cottage",
  ];
  if (wholeHomeKeywords.some((k) => t.includes(k))) {
    return 15;
  }
  const apartmentLikeKeywords = [
    "appartement",
    "apartment",
    "studio",
    "loft",
    "suite",
    "room",
    "chambre",
    "flat",
  ];
  if (apartmentLikeKeywords.some((k) => t.includes(k))) {
    return 23;
  }
  return 18;
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
    return `L’annonce perd encore de la conversion sur ses éléments les plus visibles. En corrigeant en priorité ${
      weakestAreas.slice(0, 2).join(" et ") || "les fondamentaux de présentation"
    }, le potentiel business devient significatif, avec un gain possible qui se situe dans le haut de la fourchette estimée (${bookingLiftHigh}%).`;
  }

  if (overallScore < 7) {
    return `L’annonce repose sur une base saine mais reste freinée par ${
      weakestAreas.slice(0, 2).join(" et ") || "plusieurs signaux visibles"
    }. Le potentiel de progression est crédible et se traduit par un gain de réservations estimé pouvant aller jusqu’à ${bookingLiftHigh}%.`;
  }

  return `L’annonce est déjà compétitive. Les gains restants viendront surtout d’ajustements plus fins sur ${
    weakestAreas[0] || "la première impression"
  } et la clarté de la valeur, afin de capter une part marginale mais réelle de réservations supplémentaires.`;
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
    return "L’annonce se situe à un niveau élevé de qualité et de compétitivité. Le potentiel restant dépend surtout d’optimisations fines sur la mise en scène de la valeur et la précision des signaux de confiance.";
  }

  if (label === "strong_performer") {
    return "L’annonce présente une base solide, avec une qualité perçue crédible et une compétitivité locale favorable. Les prochains gains viendront d’un meilleur alignement entre photos, description et prix.";
  }

  if (label === "competitive") {
    return "L’annonce est compétitive, mais certains leviers visibles peuvent encore améliorer la conversion et le positionnement, notamment en rendant la promesse plus explicite dès le premier écran.";
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
    if (scores.photos >= 9) {
      strengths.push("La galerie photo atteint un niveau quasi premium : les premières images portent efficacement la première impression.");
    } else {
      strengths.push("La présentation visuelle est déjà suffisamment solide pour soutenir une bonne première impression.");
    }
  }
  if (scores.description >= 7) {
    strengths.push("La description repose déjà sur une base claire, ce qui facilite la compréhension de la promesse et le passage à l’action.");
  }
  if (scores.amenities >= 7) {
    strengths.push("Les équipements essentiels sont déjà bien couverts, ce qui rassure sur le confort et la praticité du séjour.");
  }
  if (scores.trust >= 7) {
    strengths.push("Les signaux de confiance sont suffisamment présents pour sécuriser la décision de réserver.");
  }
  if (marketLabel === "competitive" || marketLabel === "top_performer") {
    strengths.push("Le positionnement global de l’annonce est déjà crédible face au marché observé, ce qui limite le risque de décrochage concurrentiel.");
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
    const main = weakestAreas[0];
    const scoreText = Number.isFinite(main.score) ? ` (score ≈ ${main.score.toFixed(1)}/10)` : "";
    weaknesses.push(
      `La conversion reste principalement freinée par ${main.label}${scoreText}, ce qui crée encore des hésitations avant la réservation.`,
    );
  }
  if (weakestAreas[1] && weakestAreas[1].score < 7) {
    const secondary = weakestAreas[1];
    const scoreText = Number.isFinite(secondary.score)
      ? ` (score ≈ ${secondary.score.toFixed(1)}/10)`
      : "";
    weaknesses.push(
      `Le niveau actuel de ${secondary.label}${scoreText} laisse encore une marge de progression visible sur la perception de qualité.`,
    );
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
  const weakBookingFallbackComparableCount = competitors.reduce((acc, c) => {
    const flag = (c as ExtractedListing & { weakBookingMarketFallback?: boolean })
      .weakBookingMarketFallback;
    return flag === true ? acc + 1 : acc;
  }, 0);
  const premiumVillaSegmentMismatchCount = competitors.reduce((acc, c) => {
    const flag = (c as ExtractedListing & { premiumVillaSegmentMismatch?: boolean })
      .premiumVillaSegmentMismatch;
    return flag === true ? acc + 1 : acc;
  }, 0);

  logMarketPipelineStage({
    stage: "run_audit_input",
    targetUrl: input.target.url ?? null,
    targetPlatform: input.target.platform ?? null,
    countCompetitorsInput: competitors.length,
  });

  // -----------------------------
  // 1. Normalize listing
  // -----------------------------
  // Normalize listing data once so scoring and any future logic have a safe shape
  const normalizedTarget = normalizeListing(input.target);
  const normalizedCompetitors = competitors.map((c) => normalizeListing(c));
  console.log(
    "[audit][runAudit-competitor-input-debug]",
    JSON.stringify({
      rawComparableCount: competitors.length,
      rawPricedComparableCount: competitors.filter(
        (competitor) =>
          typeof competitor.price === "number" &&
          Number.isFinite(competitor.price) &&
          competitor.price > 0
      ).length,
      normalizedComparableCount: normalizedCompetitors.length,
      normalizedPricedComparableCount: normalizedCompetitors.filter(
        (competitor) =>
          typeof competitor.price === "number" &&
          Number.isFinite(competitor.price) &&
          competitor.price > 0
      ).length,
      rawSample: competitors.slice(0, 8).map((competitor) => ({
        url: competitor.url ?? null,
        title: competitor.title ?? null,
        price:
          typeof competitor.price === "number" && Number.isFinite(competitor.price)
            ? competitor.price
            : null,
        currency: competitor.currency ?? null,
        rawStayPrice:
          typeof competitor.rawStayPrice === "number" && Number.isFinite(competitor.rawStayPrice)
            ? competitor.rawStayPrice
            : null,
        stayNights:
          typeof competitor.stayNights === "number" && Number.isFinite(competitor.stayNights)
            ? competitor.stayNights
            : null,
        priceBasis: competitor.priceBasis ?? null,
        platform: competitor.platform ?? null,
      })),
      normalizedSample: normalizedCompetitors.slice(0, 8).map((competitor) => ({
        title: competitor.title ?? null,
        price:
          typeof competitor.price === "number" && Number.isFinite(competitor.price)
            ? competitor.price
            : null,
        currency: competitor.currency ?? null,
        platform: competitor.platform ?? null,
        city: competitor.city ?? null,
      })),
    })
  );
  const propertyType = detectPropertyType(input.target, normalizedTarget.title);
  const targetStayDates = stayDatesIsoFromAuditTarget(input.target);
  const targetStayNights =
    typeof input.target.stayNights === "number" && Number.isFinite(input.target.stayNights)
      ? input.target.stayNights
      : null;
  const targetRawStayPrice =
    typeof input.target.rawStayPrice === "number" && Number.isFinite(input.target.rawStayPrice)
      ? input.target.rawStayPrice
      : null;

  // Fallback nightly price from booking raw stay total / stay nights when normalizedTarget.price is null.
  // Only activates for Booking platform with a valid rawStayPrice + stayNights + reliable currency.
  // Affects only revenue baseline and delta — does NOT influence listing quality scores.
  const bookingExtractedNightlyPrice: number | null = (() => {
    if (normalizedTarget.price != null) return null;
    if (String(input.target.platform ?? "").toLowerCase() !== "booking") return null;
    if (targetRawStayPrice == null || targetRawStayPrice <= 0) return null;
    const currency = normalizedTarget.currency;
    if (!currency || !/^(EUR|USD|GBP|MAD)$/i.test(currency)) return null;
    if (targetStayNights == null || targetStayNights <= 0) return null;
    const nightly = Math.round((targetRawStayPrice / targetStayNights) * 100) / 100;
    return nightly > 0 ? nightly : null;
  })();
  const effectiveListingPrice = normalizedTarget.price ?? bookingExtractedNightlyPrice;

  const loc = (input.target as { location?: { country?: unknown } | null }).location;
  const derivedCountry =
    loc && typeof loc.country === "string" && loc.country.trim()
      ? loc.country.trim().toLowerCase()
      : null;

  let marketIntelligence: MarketIntelligenceV1 | null = null;
  try {
    marketIntelligence = await buildMarketIntelligenceV1({
      city: normalizedTarget.city?.trim().toLowerCase() || null,
      country: derivedCountry,
      propertyType:
        input.target.propertyType?.trim().toLowerCase() || propertyType || null,
      platform: input.target.platform,
    });
  } catch (e) {
    console.warn("[market-intelligence][runAudit][fallback]", e);
  }

  console.log(
    "[audit][market-intelligence]",
    JSON.stringify({
      confidenceScore: marketIntelligence?.confidenceScore ?? null,
      confidenceLabel: marketIntelligence?.confidenceLabel ?? null,
      medianNightlyPrice: marketIntelligence?.medianNightlyPrice ?? null,
      averageNightlyPrice: marketIntelligence?.averageNightlyPrice ?? null,
      comparableCount: marketIntelligence?.comparableCount ?? null,
      snapshotCount: marketIntelligence?.snapshotCount ?? null,
      trend: marketIntelligence?.trend ?? null,
    })
  );

  const { checkIn: seasonCheckIn, checkOut: seasonCheckOut } =
    stayDatesIsoFromAuditTarget(input.target);

  let seasonality: SeasonalityEngineV1 | null = null;
  try {
    seasonality = await buildSeasonalityEngineV1({
      city: normalizedTarget.city?.trim().toLowerCase() || null,
      country: derivedCountry,
      propertyType:
        input.target.propertyType?.trim().toLowerCase() || propertyType || null,
      platform: input.target.platform,
      checkIn: seasonCheckIn,
      checkOut: seasonCheckOut,
    });
  } catch (e) {
    console.warn("[seasonality][runAudit][fallback]", e);
  }

  console.log(
    "[audit][seasonality]",
    JSON.stringify({
      seasonLabel: seasonality?.seasonLabel ?? null,
      seasonalIndex: seasonality?.seasonalIndex ?? null,
      confidenceScore: seasonality?.confidenceScore ?? null,
      confidenceLabel: seasonality?.confidenceLabel ?? null,
      comparableCount: seasonality?.comparableCount ?? null,
      snapshotCount: seasonality?.snapshotCount ?? null,
      stayMonth: seasonality?.stayMonth ?? null,
      isWeekendStay: seasonality?.isWeekendStay ?? null,
    })
  );

  const seasonalityInsight = interpretSeasonality(seasonality);
  console.log(
    "[audit][seasonality-insight]",
    JSON.stringify({
      badgeLabel: seasonalityInsight.badgeLabel,
      pricingPressure: seasonalityInsight.pricingPressure,
      opportunityScore: seasonalityInsight.opportunityScore ?? null,
      isActionable: seasonalityInsight.isActionable,
    })
  );

  const intelligenceV2Flags = getIntelligenceV2FeatureFlags();
  let pricingBenchmarkEvidenceResult: PricingBenchmarkEvidenceSelectorResult | null = null;
  let pricingBenchmarkEvidence: PricingBenchmarkEvidence | null = null;
  let pricingDiagnosticV2Result: PricingDiagnosticV2Result | null = null;
  let pricingDiagnosticV2: PricingDiagnosticV2 | null = null;

  if (intelligenceV2Flags.ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION === true) {
    const pricingBenchmarkCountry = derivedCountry;
    const pricingBenchmarkCity =
      typeof normalizedTarget.city === "string" && normalizedTarget.city.trim().length > 0
        ? normalizedTarget.city.trim().toLowerCase()
        : null;
    const pricingBenchmarkPlatform =
      typeof input.target.platform === "string" && input.target.platform.trim().length > 0
        ? input.target.platform.trim().toLowerCase()
        : null;
    const pricingBenchmarkCurrency =
      typeof input.target.currency === "string" && input.target.currency.trim().length > 0
        ? input.target.currency.trim().toUpperCase()
        : typeof normalizedTarget.currency === "string" && normalizedTarget.currency.trim().length > 0
          ? normalizedTarget.currency.trim().toUpperCase()
          : null;
    const pricingBenchmarkPropertyType =
      typeof input.target.propertyType === "string" && input.target.propertyType.trim().length > 0
        ? input.target.propertyType.trim().toLowerCase()
        : propertyType || null;
    const pricingBenchmarkCapacity =
      typeof input.target.capacity === "number" &&
      Number.isFinite(input.target.capacity) &&
      input.target.capacity > 0
        ? input.target.capacity
        : typeof input.target.structure?.capacity === "number" &&
            Number.isFinite(input.target.structure.capacity) &&
            input.target.structure.capacity > 0
          ? input.target.structure.capacity
          : null;
    const pricingBenchmarkGuestCapacity =
      typeof input.target.guestCapacity === "number" &&
      Number.isFinite(input.target.guestCapacity) &&
      input.target.guestCapacity > 0
        ? input.target.guestCapacity
        : null;

    if (
      pricingBenchmarkCountry != null &&
      pricingBenchmarkCity != null &&
      pricingBenchmarkPlatform != null &&
      pricingBenchmarkCurrency != null
    ) {
      try {
        pricingBenchmarkEvidenceResult = await getPricingBenchmarkEvidence({
          country: pricingBenchmarkCountry,
          city: pricingBenchmarkCity,
          platform: pricingBenchmarkPlatform,
          propertyType: pricingBenchmarkPropertyType,
          capacity: pricingBenchmarkCapacity,
          guestCapacity: pricingBenchmarkGuestCapacity,
          currency: pricingBenchmarkCurrency,
          capturePeriodBucket: getLastCompleteUtcMonthBucket(),
          intendedUse: "private_audit",
        });

        if (pricingBenchmarkEvidenceResult.available) {
          pricingBenchmarkEvidence = pricingBenchmarkEvidenceResult.evidence;
        }
      } catch {
        pricingBenchmarkEvidence = null;
      }
    }

    if (pricingBenchmarkEvidence != null) {
      try {
        const listingNightlyPrice =
          typeof normalizedTarget.price === "number" &&
          Number.isFinite(normalizedTarget.price) &&
          normalizedTarget.price > 0
            ? normalizedTarget.price
            : null;

        if (
          listingNightlyPrice != null &&
          pricingBenchmarkCurrency != null
        ) {
          pricingDiagnosticV2Result = buildPricingDiagnosticV2({
            listingNightlyPrice,
            currency: pricingBenchmarkCurrency,
            pricingBenchmarkEvidence,
          });

          if (pricingDiagnosticV2Result.available) {
            pricingDiagnosticV2 = pricingDiagnosticV2Result.diagnostic;
          }
        }
      } catch {
        pricingDiagnosticV2Result = null;
        pricingDiagnosticV2 = null;
      }
    }

    if (intelligenceV2Flags.DEBUG_INTELLIGENCE_V2 === true && pricingDiagnosticV2Result != null) {
      console.info("[INTELLIGENCE_V2_PRICING_DIAGNOSTIC_SHADOW]", {
        available: pricingDiagnosticV2Result.available,
        status:
          pricingDiagnosticV2Result.available
            ? "available"
            : pricingDiagnosticV2Result.status,
        positionBand:
          pricingDiagnosticV2?.positionBand ?? null,
        pricingSignal:
          pricingDiagnosticV2?.pricingSignal ?? null,
        recommendedAction:
          pricingDiagnosticV2?.recommendedAction ?? null,
      });
    }

    if (intelligenceV2Flags.DEBUG_INTELLIGENCE_V2 === true && pricingBenchmarkEvidenceResult != null) {
      console.info("[INTELLIGENCE_V2_PRICING_EVIDENCE_SHADOW]", {
        available: pricingBenchmarkEvidenceResult?.available === true,
        status:
          pricingBenchmarkEvidenceResult?.available === false
            ? pricingBenchmarkEvidenceResult.status
            : "available",
        evidenceStrength:
          pricingBenchmarkEvidence?.evidenceStrength ?? null,
        fallbackLevel:
          pricingBenchmarkEvidence?.fallbackLevel ?? null,
      });
    }
  }

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
  const pricedCompetitorCount = competitorPrices.length;
  console.log(
    "[audit][avg-price-computation-input]",
    JSON.stringify({
      rawComparableCount: competitors.length,
      normalizedComparableCount: normalizedCompetitors.length,
      competitorPricesCount: competitorPrices.length,
      competitorPricesSample: competitorPrices.slice(0, 12),
      normalizedSample: normalizedCompetitors.slice(0, 8).map((competitor) => ({
        title: competitor.title ?? null,
        price:
          typeof competitor.price === "number" && Number.isFinite(competitor.price)
            ? competitor.price
            : null,
        currency: competitor.currency ?? null,
        platform: competitor.platform ?? null,
        city: competitor.city ?? null,
      })),
    })
  );
  const marketMemoryMedianNightlyPrice =
    marketIntelligence?.medianNightlyPrice != null &&
    Number.isFinite(marketIntelligence.medianNightlyPrice) &&
    marketIntelligence.medianNightlyPrice > 0
      ? roundToOne(marketIntelligence.medianNightlyPrice)
      : null;
  const shouldUseMarketMemoryPricingFallback =
    effectiveListingPrice == null &&
    pricedCompetitorCount === 0 &&
    marketMemoryMedianNightlyPrice != null;

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

  const photoSuggestions = buildPhotoSuggestions({
    photos: normalizedTarget.photos,
    title: normalizedTarget.title,
    description: normalizedTarget.description,
  });

  // -----------------------------
  // 4. Estimate impact
  // -----------------------------
  // Estimate booking lift potential based on current vs potential score and action plan intensity
  const highPriorityCount = actionPlan.filter(
    (item) => item.priority === "high",
  ).length;
  const mediumPriorityCount = actionPlan.filter(
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

  let baselineNightlyResolution = resolveBaselineNightlyPriceForImpact({
    listingPrice: effectiveListingPrice,
    competitorPrices,
    normalizedTargetType: propertyType,
  });
  if (baselineNightlyResolution.price == null && shouldUseMarketMemoryPricingFallback) {
    baselineNightlyResolution = {
      price: marketMemoryMedianNightlyPrice,
      source: "market_memory_median",
    };
  }
  const baselineBookedNightsPerMonth =
    defaultBaselineBookedNightsForProperty(propertyType);

  const revenueImpact = estimateRevenueImpact({
    nightlyPrice: baselineNightlyResolution.price,
    bookingLiftLowPercent: bookingLift.lowPercent,
    bookingLiftHighPercent: bookingLift.highPercent,
    baselineBookedNightsPerMonth,
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

  const textSuggestions = buildTextSuggestions({
    title: normalizedTarget.title,
    description: normalizedTarget.description,
    amenities: normalizedTarget.amenities,
    city: normalizedTarget.city,
    overallScore,
    conversionScore: undefined,
    mainWeaknessLabel: weakestAreas[0]?.label ?? null,
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
  const pricingFallbackSource: "market_memory_median" | null =
    market.position.avgCompetitorPrice == null && shouldUseMarketMemoryPricingFallback
      ? "market_memory_median"
      : null;

  const avgCompetitorPrice =
    market.position.avgCompetitorPrice ??
    marketMemoryMedianNightlyPrice ??
    (effectiveListingPrice != null ? roundToOne(effectiveListingPrice) : null);
  if (
    DEBUG_BOOKING_PIPELINE &&
    market.position.avgCompetitorPrice == null &&
    (marketMemoryMedianNightlyPrice != null || normalizedTarget.price != null) &&
    avgCompetitorPrice != null
  ) {
    console.log("[audit][market][booking_fallback]", {
      note:
        pricingFallbackSource === "market_memory_median"
          ? "avg_competitor_price_absent_used_market_memory_median"
          : "avg_competitor_price_absent_used_listing_price_rounded",
      competitorCount: normalizedCompetitors.length,
      listingPrice: normalizedTarget.price,
      marketMemoryMedianNightlyPrice,
      pricingFallbackSource,
      avgCompetitorPriceFilled: avgCompetitorPrice,
    });
  }
  const avgCompetitorScore =
    market.position.avgCompetitorScore ?? competitorAverageScoreFromPrices;
  const avgCompetitorRating =
    market.position.avgCompetitorRating ??
    (normalizedTarget.rating != null ? roundToOne(clamp(normalizedTarget.rating - 0.1, 0, 5)) : null);
  const priceDeltaPercent =
    market.position.priceDeltaPercent ??
    (effectiveListingPrice != null && avgCompetitorPrice != null && avgCompetitorPrice > 0
      ? roundToOne(((effectiveListingPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100)
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
    photoSuggestions.coverageWarnings.slice(0, 3),
    textSuggestions.improvementTips.slice(0, 3),
  );

  const missingAmenities = buildMissingAmenities(normalizedTarget.amenities);

  const planImprovements: AuditImprovement[] = actionPlan.map((item) => ({
    title: item.title,
    description: item.description,
    impact: item.impact,
    priority: item.priority,
    category: item.category,
    reason: item.reason,
    source: item.source,
  }));

  const safePhotoFallbackTips = photoSuggestions.improvementTips.filter(
    (tip) => !/sombres?|retouch|similaires?/i.test(tip)
  );
  const fallbackImprovements: AuditImprovement[] =
    planImprovements.length > 0
      ? []
      : [
    ...textSuggestions.improvementTips.slice(0, 2).map((tip) => ({
      title: "Renforcer la clarté de l’annonce",
      description: tip,
      impact: "medium" as const,
      priority: "medium" as const,
      category: "description" as const,
      reason: tip,
      source: "text_fallback" as const,
    })),
    ...safePhotoFallbackTips.slice(0, 2).map((tip) => ({
      title: "Améliorer la galerie photos",
      description: tip,
      impact: "medium" as const,
      priority: "medium" as const,
      category: "photos" as const,
      reason: tip,
      source: "photo_fallback" as const,
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

  let resolvedImprovements: AuditImprovement[] = improvements.map((item, index) => ({
    ...item,
    orderIndex: item.orderIndex ?? index + 1,
  }));

  if (resolvedImprovements.length === 0) {
    let orderIndex = 1;
    const auto: AuditImprovement[] = [];

    if (photoScore.score < 6) {
      auto.push({
        title: "Améliorer les photos",
        description:
          "Les photos actuelles peuvent être renforcées pour mieux porter la première impression.",
        impact: "high",
        priority: "high",
        category: "photos",
        reason: `Score photos ${photoScore.score}/10`,
        source: "score_fallback",
        orderIndex: orderIndex++,
      });
    }

    if (descriptionScore.score < 6) {
      auto.push({
        title: "Améliorer la description",
        description:
          "La description peut gagner en clarté, structure et bénéfices concrets.",
        impact: "medium",
        priority: "medium",
        category: "description",
        reason: `Score description ${descriptionScore.score}/10`,
        source: "score_fallback",
        orderIndex: orderIndex++,
      });
    }

    if (amenitiesScore.score < 6) {
      auto.push({
        title: "Ajouter équipements",
        description:
          "Certains équipements clés semblent manquants ou peu visibles dans l’annonce.",
        impact: "medium",
        priority: "medium",
        category: "amenities",
        reason: `Score équipements ${amenitiesScore.score}/10`,
        source: "score_fallback",
        orderIndex: orderIndex++,
      });
    }

    if (seoScore.score < 6) {
      auto.push({
        title: "Optimiser le SEO",
        description:
          "Le titre et la lisibilité commerciale peuvent être optimisés pour mieux capter la demande.",
        impact: "low",
        priority: "low",
        category: "seo",
        reason: `Score SEO ${seoScore.score}/10`,
        source: "score_fallback",
        orderIndex: orderIndex++,
      });
    }

    resolvedImprovements = auto;
  }

  const cityLabel = normalizedTarget.city ?? input.target.locationLabel ?? "votre zone";
  const suggestedOpening =
    textSuggestions.suggestedOpeningParagraph ||
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

  const pricingMarketReliabilityBase = deriveMarketReliabilityFromComparableCount(
    avgCompetitorPrice != null ? pricedCompetitorCount : 0,
    weakBookingFallbackComparableCount,
  );
  const pricingMarketReliabilityInitial =
    premiumVillaSegmentMismatchCount > 0
      ? {
          marketConfidence: "low" as const,
          fallbackLevel: "limited_local" as const,
          reliabilityTitle: "Segment hors marché",
          reliabilityBadge: "Fiabilité faible",
          reliabilityMessage:
            "Les comparables retenus ne correspondent pas au segment tarifaire de la villa cible. Les estimations marché sont indicatives uniquement.",
        }
      : pricingMarketReliabilityBase;

  let guardedAvgCompetitorPrice = avgCompetitorPrice;
  let guardedPriceDeltaPercent = priceDeltaPercent;
  let guardedPricingFallbackSource = pricingFallbackSource;
  let pricingMarketReliability = pricingMarketReliabilityInitial;

  if (pricedCompetitorCount === 0) {
    guardedAvgCompetitorPrice = null;
    guardedPriceDeltaPercent = null;
    guardedPricingFallbackSource = null;
    pricingMarketReliability = {
      marketConfidence: "low" as const,
      fallbackLevel: "insufficient" as const,
      reliabilityTitle: "Marché partiellement disponible",
      reliabilityBadge: "Fiabilité faible",
      reliabilityMessage:
        "Marché partiellement disponible : comparables trouvés, mais aucun prix concurrent exploitable.",
    };
  } else if (pricedCompetitorCount < 3) {
    pricingMarketReliability = {
      marketConfidence: "low" as const,
      fallbackLevel: "limited_local" as const,
      reliabilityTitle: "Lecture tarifaire indicative",
      reliabilityBadge: "Fiabilité faible",
      reliabilityMessage:
        "Lecture tarifaire indicative : prix concurrent exploitable, mais échantillon encore limité.",
    };
    console.log(
      "[audit][priced-market-sample-guard]",
      JSON.stringify({
        comparableCount: normalizedCompetitors.length,
        pricedComparableCount: pricedCompetitorCount,
        avgCompetitorPriceBefore: avgCompetitorPrice,
        avgCompetitorPriceAfter: guardedAvgCompetitorPrice,
        marketConfidenceBefore: pricingMarketReliabilityInitial.marketConfidence,
        marketConfidenceAfter: pricingMarketReliability.marketConfidence,
        fallbackLevelBefore: pricingMarketReliabilityInitial.fallbackLevel,
        fallbackLevelAfter: pricingMarketReliability.fallbackLevel,
        reason: "insufficient_priced_comparables",
      })
    );
  }

  const marketSummary = buildMarketPositionSummary({
    positionLabel: market.position.positionLabel,
    avgCompetitorPrice: guardedAvgCompetitorPrice,
    priceDeltaPercent: guardedPriceDeltaPercent,
    avgCompetitorRating,
    hasCompetitors: normalizedCompetitors.length > 0,
  });

  if (DEBUG_BOOKING_PIPELINE || process.env.DEBUG_MARKET_PIPELINE === "true") {
    console.log(
      "[audit][market-priced-count]",
      JSON.stringify({
        comparableCount: normalizedCompetitors.length,
        pricedComparableCount: pricedCompetitorCount,
        avgCompetitorPrice: guardedAvgCompetitorPrice,
        marketConfidence: pricingMarketReliability.marketConfidence,
        fallbackLevel: pricingMarketReliability.fallbackLevel,
        pricingFallbackSource: guardedPricingFallbackSource,
        premiumVillaSegmentMismatchCount: premiumVillaSegmentMismatchCount > 0 ? premiumVillaSegmentMismatchCount : undefined,
        source: "runAudit",
      }),
    );
  }

  if (DEBUG_BOOKING_PIPELINE) {
    console.log(
      "[audit][price-source-debug]",
      JSON.stringify({
        targetUrl: input.target.url ?? input.target.sourceUrl ?? null,
        checkIn: targetStayDates.checkIn,
        checkOut: targetStayDates.checkOut,
        nights: targetStayNights,
        rawExtractedPrice: targetRawStayPrice,
        normalizedNightlyPrice:
          typeof input.target.price === "number" && Number.isFinite(input.target.price)
            ? input.target.price
            : null,
        currency: input.target.currency ?? normalizedTarget.currency ?? null,
        listingPriceBeforeRunAudit:
          typeof input.target.price === "number" && Number.isFinite(input.target.price)
            ? input.target.price
            : null,
        listingPriceAfterNormalizeListing: normalizedTarget.price,
        bookingExtractedNightlyPriceFallback: bookingExtractedNightlyPrice,
        effectiveListingPrice,
        revenueBaselineNightlyPrice: revenueImpact.baselineNightlyPriceUsed,
        revenueBaselineBookedNightsPerMonth: revenueImpact.baselineBookedNightsUsed,
        revenueBaselinePriceSource: baselineNightlyResolution.source,
        marketAvgCompetitorPrice: guardedAvgCompetitorPrice,
        marketPriceDelta: guardedPriceDeltaPercent,
        pricingFallbackSource: guardedPricingFallbackSource,
        propertyTypeExtracted: input.target.propertyType ?? null,
        propertyTypeDetectedForAudit: propertyType,
        targetPriceBasis: input.target.priceBasis ?? null,
      })
    );
  }

  const competitorSummary: AuditResult["competitorSummary"] = {
    ...buildCompetitorSummary({
      competitorCount: normalizedCompetitors.length,
      avgCompetitorScore,
      marketLabel: market.position.positionLabel,
      weakestAreas,
      strengths,
    }),
    pricedComparableCount: pricedCompetitorCount,
    ...(weakBookingFallbackComparableCount > 0
      ? { weakBookingFallbackComparableCount }
      : {}),
    ...(premiumVillaSegmentMismatchCount > 0
      ? { premiumVillaSegmentMismatchComparableCount: premiumVillaSegmentMismatchCount }
      : {}),
  };

  const photoCount = normalizedTarget.photos.length;
  const photoOrderScore = buildPhotoOrderScore(photoCount, photoScore.score);

  const conversionStrengthScore = buildConversionStrength({
    description: descriptionScore.score,
    seo: seoScore.score,
    trust: trustScore.score,
    pricing: pricingScore.score,
    amenities: amenitiesScore.score,
  });

  const business = {
    bookingPotential: roundToOne(clamp(overallScore, 0, 10)),
    estimatedRevenueLow: impact.revenueImpact.lowMonthlyImpact ?? null,
    estimatedRevenueHigh: impact.revenueImpact.highMonthlyImpact ?? null,
  };

  const minimalMarketScore = roundToOne(
    clamp(
      Number.isFinite(market.position.marketScore)
        ? market.position.marketScore
        : overallScore,
      0,
      10,
    ),
  );
  const competitorCountsByPlatform = normalizedCompetitors.reduce<Record<string, number>>(
    (acc, comparable) => {
      const platform =
        typeof comparable.platform === "string" && comparable.platform.trim().length > 0
          ? comparable.platform.trim().toLowerCase()
          : "other";
      acc[platform] = (acc[platform] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const bookingComparableCount = competitorCountsByPlatform.booking ?? 0;
  const airbnbComparableCount = competitorCountsByPlatform.airbnb ?? 0;
  const marketSourceQuality =
    String(normalizedTarget.platform ?? "").toLowerCase() === "booking" &&
    normalizedCompetitors.length > 0 &&
    bookingComparableCount === 0 &&
    airbnbComparableCount > 0
      ? ("cross_platform_fallback" as const)
      : ("native" as const);
  const marketSourceLabel =
    marketSourceQuality === "cross_platform_fallback"
      ? "Lecture marché cross-platform"
      : null;

  const minimalMarket = {
    position: null as "below" | "average" | "above" | null,
    score: minimalMarketScore,
    comparableCount: normalizedCompetitors.length,
    pricedComparableCount: pricedCompetitorCount,
    avgCompetitorPrice: guardedAvgCompetitorPrice,
    priceDelta: guardedPriceDeltaPercent,
    pricingFallbackSource: guardedPricingFallbackSource,
    marketSourceQuality,
    marketSourceLabel,
  };

  if (pricedCompetitorCount === 0) {
    console.log("[audit][pricing-consistency-guard]", JSON.stringify({
      comparableCount: normalizedCompetitors.length,
      pricedComparableCount: pricedCompetitorCount,
      avgCompetitorPriceBefore: minimalMarket.avgCompetitorPrice,
      avgCompetitorPriceAfter: null,
      priceDeltaBefore: minimalMarket.priceDelta,
      priceDeltaAfter: null,
      reason: "zero_priced_comparables",
    }));
    minimalMarket.avgCompetitorPrice = null;
    minimalMarket.priceDelta = null;
    business.estimatedRevenueLow = null;
    business.estimatedRevenueHigh = null;
  }
  const finalAvgCompetitorPrice = pricedCompetitorCount === 0 ? null : guardedAvgCompetitorPrice;
  const finalPriceDeltaPercent = pricedCompetitorCount === 0 ? null : guardedPriceDeltaPercent;

  const scoreBreakdown = {
    photos: roundToOne(clamp(photoScore.score, 0, 10)),
    photoOrder: photoOrderScore,
    description: roundToOne(clamp(descriptionScore.score, 0, 10)),
    amenities: roundToOne(clamp(amenitiesScore.score, 0, 10)),
    seo: roundToOne(clamp(seoScore.score, 0, 10)),
    conversion: roundToOne(clamp(conversionStrengthScore, 0, 10)),
  };

  const lqiFallbackComponents: AuditListingQualityIndexComponents = {
    listingQuality: roundToOne(
      clamp(
        (photoScore.score + descriptionScore.score + amenitiesScore.score) / 3,
        0,
        10,
      ) * 10,
    ),
    marketCompetitiveness: roundToOne(
      clamp(minimalMarketScore, 0, 10) * 10,
    ),
    conversionPotential: roundToOne(
      clamp(business.bookingPotential ?? overallScore, 0, 10) * 10,
    ),
  };

  const lqiFallbackScore = roundToOne(
    clamp((overallScore ?? 0) * 10, 0, 100),
  );

  const safeLqiComponents = listingQualityIndex.components ?? lqiFallbackComponents;
  const safeLqiLabel: AuditListingQualityIndexLabel =
    listingQualityIndex.label ?? "improving";
  const safeLqiScore = listingQualityIndex.score ?? lqiFallbackScore;

  console.log("[RUNAUDIT MARKET FINAL]", minimalMarket);
  console.log("[RUNAUDIT BUSINESS FINAL]", business);
  console.log("[RUNAUDIT LQI FINAL]", {
    score: safeLqiScore,
    label: safeLqiLabel,
    components: safeLqiComponents,
  });

  logMarketPipelineStage({
    stage: "run_audit_output",
    targetUrl: input.target.url ?? null,
    targetPlatform: input.target.platform ?? null,
    competitorSummaryCompetitorCount: competitorSummary.competitorCount,
    minimalMarketComparableCount: minimalMarket.comparableCount,
  });

  const businessInsights = {
    pricing: pricedCompetitorCount === 0 ? null : generatePricingInsight({
      targetPrice: normalizedTarget.price,
      targetCurrency: normalizedTarget.currency,
      competitors: normalizedCompetitors.map((c) => ({
        price: c.price,
        currency: c.currency,
      })),
    }),
  };

  return {
    overallScore,
    photoQuality: photoScore.score,
    photoOrder: photoOrderScore,
    descriptionQuality: descriptionScore.score,
    amenitiesCompleteness: amenitiesScore.score,
    seoStrength: seoScore.score,
    conversionStrength: conversionStrengthScore,
    strengths,
    weaknesses,
    improvements: resolvedImprovements,
    suggestedOpening,
    photoOrderSuggestions: photoSuggestions.suggestedPhotoOrder,
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
      baselineNightlyPrice: impact.revenueImpact.baselineNightlyPriceUsed,
      baselineBookedNightsPerMonth: impact.revenueImpact.baselineBookedNightsUsed,
      baselinePriceSource: baselineNightlyResolution.source,
    },
    impactSummary,
    marketPosition: {
      score: market.position.marketScore,
      label: market.position.positionLabel,
      summary: marketSummary,
      avgCompetitorPrice: finalAvgCompetitorPrice,
      avgCompetitorScore,
      avgCompetitorRating,
      priceDeltaPercent: finalPriceDeltaPercent,
    },
    listingQualityIndex: {
      score: safeLqiScore,
      label: localizeLqiLabel(safeLqiLabel),
      summary: buildLqiSummary(safeLqiLabel, safeLqiComponents),
      components: safeLqiComponents,
    },
    market: minimalMarket,
    business,
    scoreBreakdown,
    businessInsights,
    marketIntelligence: marketIntelligence ?? null,
    seasonality: seasonality ?? null,
    seasonalityInsight: seasonalityInsight ?? null,
  };
}
