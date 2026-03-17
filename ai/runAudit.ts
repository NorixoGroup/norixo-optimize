import { openai } from "@/lib/openai";
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

  const prompt = `
You are an expert in short-term rental listing optimization.

Analyze the target listing against up to 15 nearby competitor listings.

Return ONLY strict JSON.

TARGET LISTING:
${JSON.stringify(input.target, null, 2)}

COMPETITORS:
${JSON.stringify(competitors, null, 2)}

Return ONLY JSON with this exact structure:

{
  "overallScore": number,
  "photoQuality": number,
  "photoOrder": number,
  "descriptionQuality": number,
  "amenitiesCompleteness": number,
  "seoStrength": number,
  "conversionStrength": number,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "improvements": [
    {
      "title": "string",
      "description": "string",
      "impact": "high" | "medium" | "low"
    }
  ],
  "suggestedOpening": "string",
  "photoOrderSuggestions": ["string"],
  "missingAmenities": ["string"],
  "competitorSummary": {
    "competitorCount": number,
    "averageOverallScore": number,
    "targetVsMarketPosition": "string",
    "keyGaps": ["string"],
    "keyAdvantages": ["string"]
  }
}

Rules:
- all scores must be between 0 and 10
- be realistic and critical
- focus on conversion, trust, clarity, and booking performance
- compare target listing against the competitors when competitors are available
- if competitors are weak or missing, still produce a useful audit
- do not invent amenities unless clearly inferable
- improvements must be practical and prioritized
- competitorCount must equal the number of competitors received
- averageOverallScore must be between 0 and 10
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          "You are a short-term rental optimization expert. Always return strict JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  // -----------------------------
  // 6. Build final audit result
  // -----------------------------
  // Helper to merge language-model output with deterministic scoring and recommendations
  function buildFinalAudit(parsed: AuditResult): AuditResult {
    const parsedImprovements = Array.isArray(parsed.improvements)
      ? parsed.improvements
      : [];

    const planImprovements: AuditImprovement[] = recommendations.actionPlan.map((item) => ({
      title: item.title,
      description: item.description,
      impact: item.impact,
    }));

    const combinedImprovements: AuditImprovement[] = [];
    const seenImprovementTitles = new Set<string>();

    for (const improvement of [...planImprovements, ...parsedImprovements]) {
      const title = improvement.title?.trim();
      if (!title) continue;
      const key = title.toLowerCase();
      if (seenImprovementTitles.has(key)) continue;
      seenImprovementTitles.add(key);
      combinedImprovements.push(improvement);
      if (combinedImprovements.length >= 12) break;
    }

    const originalWeaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [];

    const textTips = recommendations.textSuggestions.improvementTips.slice(0, 3);
    const photoTips = recommendations.photoSuggestions.improvementTips
      .slice(0, 3)
      .map((tip) => `Photos: ${tip}`);
    const coverageWarnings = recommendations.photoSuggestions.coverageWarnings
      .slice(0, 3)
      .map((warning) => `Photos: ${warning}`);

    const extraWeaknesses = [...textTips, ...photoTips, ...coverageWarnings];

    const combinedWeaknesses: string[] = [];
    const seenWeaknesses = new Set<string>();

    for (const w of [...originalWeaknesses, ...extraWeaknesses]) {
      const value = (w ?? "").trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seenWeaknesses.has(key)) continue;
      seenWeaknesses.add(key);
      combinedWeaknesses.push(value);
      if (combinedWeaknesses.length >= 20) break;
    }

    const suggestedOpening =
      recommendations.textSuggestions.suggestedOpeningParagraph || parsed.suggestedOpening || "";

    const photoOrderSuggestions =
      recommendations.photoSuggestions.suggestedPhotoOrder.length > 0
        ? recommendations.photoSuggestions.suggestedPhotoOrder
        : parsed.photoOrderSuggestions;

    const impactSummary =
      impact.revenueImpact.lowMonthlyImpact != null &&
      impact.revenueImpact.highMonthlyImpact != null
        ? impact.revenueImpact.summary
        : impact.bookingLift.summary;

    const auditResult: AuditResult = {
      ...parsed,
      // Override numeric scores with deterministic internal scoring
      overallScore,
      photoQuality: photoScore.score,
      // Keep photoOrder and conversionStrength from the language model for now
      descriptionQuality: descriptionScore.score,
      amenitiesCompleteness: amenitiesScore.score,
      seoStrength: seoScore.score,
      // Enrich recommendation fields while preserving overall shape
      improvements:
        combinedImprovements.length > 0 ? combinedImprovements : parsedImprovements,
      weaknesses:
        combinedWeaknesses.length > 0 ? combinedWeaknesses : originalWeaknesses,
      suggestedOpening,
      photoOrderSuggestions,
      estimatedBookingLift: {
        low: impact.bookingLift.lowPercent,
        high: impact.bookingLift.highPercent,
        label: impact.bookingLift.label,
        summary: impact.bookingLift.summary,
      },
      estimatedRevenueImpact: {
        lowMonthly: impact.revenueImpact.lowMonthlyImpact,
        highMonthly: impact.revenueImpact.highMonthlyImpact,
        summary: impact.revenueImpact.summary,
      },
      impactSummary,
      marketPosition: {
        score: market.position.marketScore,
        label: market.position.positionLabel,
        summary: market.position.summary,
        avgCompetitorPrice: market.position.avgCompetitorPrice,
        avgCompetitorScore: market.position.avgCompetitorScore,
        avgCompetitorRating: market.position.avgCompetitorRating,
        priceDeltaPercent: market.position.priceDeltaPercent,
      },
      listingQualityIndex: {
        score: listingQualityIndex.score,
        label: listingQualityIndex.label,
        summary: listingQualityIndex.summary,
        components: listingQualityIndex.components,
      },
    };

    return auditResult;
  }

  try {
    const parsed = JSON.parse(content) as AuditResult;
    return buildFinalAudit(parsed);
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error("Invalid JSON returned by OpenAI:", content);
      throw new Error("OpenAI returned invalid JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]) as AuditResult;
    return buildFinalAudit(parsed);
  }
}