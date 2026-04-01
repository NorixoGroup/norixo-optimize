import type { AuditResult as RawAuditResult } from "@/ai/runAudit";
import type { ExtractedListing } from "@/lib/extractors/types";

export type StructuredAuditResultPayload = {
  score: number | null;
  metrics: {
    photoCount: number | null;
    reviewCount: number | null;
    rating: number | null;
    avgPrice: number | null;
    currency: string | null;
  };
  scoreBreakdown: {
    photos: number | null;
    photoOrder: number | null;
    description: number | null;
    amenities: number | null;
    seo: number | null;
    conversion: number | null;
  };
  market: {
    position: "below" | "average" | "above" | null;
    score: number | null;
    comparableCount: number | null;
    avgCompetitorPrice: number | null;
    priceDelta: number | null;
  };
  business: {
    bookingPotential: number | null;
    estimatedRevenueLow: number | null;
    estimatedRevenueHigh: number | null;
  };
  content: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    insights: string[];
  };
  recommendations: {
    critical: string[];
    highImpact: string[];
    improvements: string[];
  };
  listingQualityIndex?: RawAuditResult["listingQualityIndex"] | null;
};

type RestorePreview = {
  score?: number;
  summary?: string | null;
  insights?: string[];
  recommendations?: string[];
  marketPositioning?: {
    comparableCount?: number;
    status?: string;
  } | null;
  scoreBreakdown?: {
    photos?: number | null;
    photoOrder?: number | null;
    description?: number | null;
    amenities?: number | null;
    seo?: number | null;
    conversion?: number | null;
  } | null;
  subScores?: Array<{
    key?: string;
    label?: string;
    score?: number | null;
  }>;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function roundToOne(value: number | null) {
  return value == null ? null : Number(value.toFixed(1));
}

function uniqueStrings(values: Array<unknown>) {
  return [...new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean))];
}

function normalizeRatingToTen(rating: number | null, scale: number | null) {
  if (rating == null) return null;
  if (scale != null && scale > 0) {
    return roundToOne((rating / scale) * 10);
  }
  if (rating <= 5) {
    return roundToOne((rating / 5) * 10);
  }
  if (rating <= 10) {
    return roundToOne(rating);
  }
  return null;
}

function mapMarketPosition(
  label: RawAuditResult["marketPosition"] extends { label: infer T } ? T : string | null | undefined
): "below" | "average" | "above" | null {
  if (label === "top_performer") return "above";
  if (label === "competitive") return "average";
  if (label === "below_market" || label === "underperforming") return "below";
  return null;
}

function formatImprovement(item: { title?: string; description?: string }) {
  const title = item.title?.trim() ?? "";
  const description = item.description?.trim() ?? "";
  if (title && description) return `${title}: ${description}`;
  return title || description || "";
}

function readPreviewSubScore(
  preview: RestorePreview,
  ...needles: string[]
) {
  const subScores = Array.isArray(preview.subScores) ? preview.subScores : [];
  const match = subScores.find((item) => {
    const key = item.key?.toLowerCase() ?? "";
    const label = item.label?.toLowerCase() ?? "";
    return needles.some((needle) => key.includes(needle) || label.includes(needle));
  });
  return toFiniteNumber(match?.score);
}

export function summarizeStructuredAuditPayload(payload: unknown) {
  const value =
    payload && typeof payload === "object"
      ? (payload as Partial<StructuredAuditResultPayload>)
      : null;

  const criticalCount = value?.recommendations?.critical?.length ?? 0;
  const highImpactCount = value?.recommendations?.highImpact?.length ?? 0;
  const lowImpactImprovementsCount =
    value?.recommendations?.improvements?.length ?? 0;

  return {
    score: value?.score ?? null,
    metrics: value?.metrics ?? null,
    scoreBreakdown: value?.scoreBreakdown ?? null,
    market: value?.market ?? null,
    business: value?.business ?? null,
    contentSummary: value?.content?.summary ?? "",
    strengthsCount: value?.content?.strengths?.length ?? 0,
    weaknessesCount: value?.content?.weaknesses?.length ?? 0,
    insightsCount: value?.content?.insights?.length ?? 0,
    criticalCount,
    highImpactCount,
    improvementsCount:
      criticalCount + highImpactCount + lowImpactImprovementsCount,
  };
}

export function buildStructuredAuditPayloadFromRunAudit(params: {
  auditResult: RawAuditResult;
  target: ExtractedListing;
}): StructuredAuditResultPayload {
  const { auditResult, target } = params;

  const ratingValue =
    toFiniteNumber(target.ratingValue) ?? toFiniteNumber(target.rating);
  const ratingScale =
    toFiniteNumber(target.ratingScale) ??
    (ratingValue != null && ratingValue <= 5 ? 5 : ratingValue != null && ratingValue <= 10 ? 10 : null);
  const photoCount =
    toFiniteNumber(target.photosCount) ??
    (Array.isArray(target.photos) ? target.photos.filter(Boolean).length : null);
  const reviewCount = toFiniteNumber(target.reviewCount);
  const avgPrice = toFiniteNumber(target.price);
  const currency = typeof target.currency === "string" && target.currency.trim()
    ? target.currency.trim()
    : null;

  const insights = uniqueStrings([
    auditResult.impactSummary,
    auditResult.marketPosition?.summary,
    auditResult.estimatedBookingLift?.summary,
    auditResult.estimatedRevenueImpact?.summary,
    auditResult.competitorSummary?.targetVsMarketPosition,
  ]).slice(0, 5);

  const summary =
    uniqueStrings([
      auditResult.impactSummary,
      auditResult.marketPosition?.summary,
      insights[0],
    ])[0] ?? "";

  const bookingPotentialFromLqi =
    auditResult.listingQualityIndex?.components?.conversionPotential != null
      ? roundToOne(auditResult.listingQualityIndex.components.conversionPotential / 10)
      : null;

  const bookingPotentialFromBusiness =
    toFiniteNumber(auditResult.business?.bookingPotential) != null
      ? roundToOne(toFiniteNumber(auditResult.business?.bookingPotential))
      : null;

  const estimatedRevenueLowFromBusiness = roundToOne(
    toFiniteNumber(auditResult.business?.estimatedRevenueLow),
  );
  const estimatedRevenueHighFromBusiness = roundToOne(
    toFiniteNumber(auditResult.business?.estimatedRevenueHigh),
  );

  const mappedMarketPosition = mapMarketPosition(
    auditResult.marketPosition?.label,
  );

  const rawMarketScoreFromResult = toFiniteNumber(auditResult.market?.score);
  const rawMarketScoreFromCompetitors = toFiniteNumber(
    auditResult.marketPosition?.avgCompetitorScore,
  );

  const marketScore = roundToOne(
    rawMarketScoreFromResult ?? rawMarketScoreFromCompetitors,
  );

  return {
    score: roundToOne(toFiniteNumber(auditResult.overallScore)),
    metrics: {
      photoCount,
      reviewCount,
      rating: normalizeRatingToTen(ratingValue, ratingScale),
      avgPrice,
      currency,
    },
    scoreBreakdown: {
      photos: roundToOne(toFiniteNumber(auditResult.photoQuality)),
      photoOrder: roundToOne(toFiniteNumber(auditResult.photoOrder)),
      description: roundToOne(toFiniteNumber(auditResult.descriptionQuality)),
      amenities: roundToOne(toFiniteNumber(auditResult.amenitiesCompleteness)),
      seo: roundToOne(toFiniteNumber(auditResult.seoStrength)),
      conversion: roundToOne(toFiniteNumber(auditResult.conversionStrength)),
    },
    market: {
      position: mappedMarketPosition,
      score: marketScore,
      comparableCount: toFiniteNumber(auditResult.competitorSummary?.competitorCount),
      avgCompetitorPrice: roundToOne(toFiniteNumber(auditResult.marketPosition?.avgCompetitorPrice)),
      priceDelta: roundToOne(toFiniteNumber(auditResult.marketPosition?.priceDeltaPercent)),
    },
    business: {
      bookingPotential:
        bookingPotentialFromBusiness ?? bookingPotentialFromLqi,
      estimatedRevenueLow:
        estimatedRevenueLowFromBusiness ??
        roundToOne(toFiniteNumber(auditResult.estimatedRevenueImpact?.lowMonthly)),
      estimatedRevenueHigh:
        estimatedRevenueHighFromBusiness ??
        roundToOne(toFiniteNumber(auditResult.estimatedRevenueImpact?.highMonthly)),
    },
    content: {
      summary,
      strengths: uniqueStrings(auditResult.strengths ?? []),
      weaknesses: uniqueStrings(auditResult.weaknesses ?? []),
      insights,
    },
    recommendations: {
      critical: (auditResult.improvements ?? [])
        .filter((item) => item.impact === "high")
        .map(formatImprovement)
        .filter(Boolean),
      highImpact: (auditResult.improvements ?? [])
        .filter((item) => item.impact === "medium")
        .map(formatImprovement)
        .filter(Boolean),
      improvements: (auditResult.improvements ?? [])
        .filter((item) => item.impact === "low")
        .map(formatImprovement)
        .filter(Boolean),
    },
    listingQualityIndex: auditResult.listingQualityIndex ?? null,
  };
}

export function buildStructuredAuditPayloadFromPreview(
  preview: RestorePreview
): StructuredAuditResultPayload {
  const summary =
    typeof preview.summary === "string" ? preview.summary.trim() : "";
  const insights = uniqueStrings(preview.insights ?? []).slice(0, 5);

  return {
    score: roundToOne(toFiniteNumber(preview.score)),
    metrics: {
      photoCount: null,
      reviewCount: null,
      rating: null,
      avgPrice: null,
      currency: null,
    },
    scoreBreakdown: {
      photos:
        roundToOne(readPreviewSubScore(preview, "photo", "photos")) ??
        roundToOne(toFiniteNumber(preview.scoreBreakdown?.photos)),
      photoOrder:
        roundToOne(readPreviewSubScore(preview, "photo_order", "ordre", "order")) ??
        roundToOne(toFiniteNumber(preview.scoreBreakdown?.photoOrder)),
      description:
        roundToOne(readPreviewSubScore(preview, "description", "desc")) ??
        roundToOne(toFiniteNumber(preview.scoreBreakdown?.description)),
      amenities:
        roundToOne(readPreviewSubScore(preview, "amenit", "equip")) ??
        roundToOne(toFiniteNumber(preview.scoreBreakdown?.amenities)),
      seo:
        roundToOne(readPreviewSubScore(preview, "seo", "visib")) ??
        roundToOne(toFiniteNumber(preview.scoreBreakdown?.seo)),
      conversion:
        roundToOne(readPreviewSubScore(preview, "conversion", "book")) ??
        roundToOne(toFiniteNumber(preview.scoreBreakdown?.conversion)),
    },
    market: {
      position: null,
      score: null,
      comparableCount: toFiniteNumber(preview.marketPositioning?.comparableCount),
      avgCompetitorPrice: null,
      priceDelta: null,
    },
    business: {
      bookingPotential: null,
      estimatedRevenueLow: null,
      estimatedRevenueHigh: null,
    },
    content: {
      summary,
      strengths: [],
      weaknesses: [],
      insights,
    },
    recommendations: {
      critical: [],
      highImpact: [],
      improvements: uniqueStrings(preview.recommendations ?? []),
    },
  };
}
