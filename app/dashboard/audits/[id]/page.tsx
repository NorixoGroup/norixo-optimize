"use client";

import { useEffect, useMemo, useState } from "react";
import { buildMarketPositionSummary } from "@/ai/marketPosition";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AuditResult = {
  overallScore?: number;
  photoQuality?: number;
  photoOrder?: number;
  descriptionQuality?: number;
  amenitiesCompleteness?: number;
  seoStrength?: number;
  conversionStrength?: number;
  strengths?: string[];
  weaknesses?: string[];
  improvements?: {
    id?: string;
    title?: string;
    description?: string;
    impact?: string;
    orderIndex?: number;
  }[];
  suggestedOpening?: string;
  photoOrderSuggestions?: string[];
  missingAmenities?: string[];
  competitorSummary?: {
    competitorCount?: number;
    averageOverallScore?: number;
    targetVsMarketPosition?: string;
    keyGaps?: string[];
    keyAdvantages?: string[];
  };
  listingQualityIndex?: {
    score?: number;
    label?: string;
    summary?: string;
    components?: {
      listingQuality?: number;
      marketCompetitiveness?: number;
      conversionPotential?: number;
    };
  };
};

type ListingJoin =
  | {
      id: string;
      title: string | null;
      source_platform: string | null;
      source_url: string | null;
    }
  | {
      id: string;
      title: string | null;
      source_platform: string | null;
      source_url: string | null;
    }[]
  | null;

type AuditRecord = {
  id: string;
  listing_id: string;
  created_at: string;
  overall_score: number | null;
  result_payload: AuditResult | null;
  listings: ListingJoin;
};

function normalizeListingJoin(listing: ListingJoin) {
  if (!listing) return null;
  return Array.isArray(listing) ? listing[0] ?? null : listing;
}

function buildAiDescription(options: {
  title?: string;
  location?: string;
  amenities?: string[];
  baseDescription?: string;
}) {
  const { title, location, amenities, baseDescription } = options;

  const displayTitle = title || "this listing";
  const displayLocation = location || "your target area";

  const highlightedAmenities = (amenities || []).slice(0, 4).join(", ");

  const amenitiesSentence = highlightedAmenities
    ? `Guests enjoy key amenities such as ${highlightedAmenities}, making the stay both comfortable and practical.`
    : "Guests enjoy all the essentials for a comfortable and practical stay.";

  const base = baseDescription
    ? `We started from your existing description and clarified the value of ${displayTitle} in ${displayLocation}.`
    : `This description focuses on clearly explaining why ${displayTitle} is a strong option in ${displayLocation}.`;

  return [
    `${displayTitle} is positioned as a welcoming, conversion-focused stay in ${displayLocation}, ideal for guests who want a smooth, well-equipped experience from arrival to checkout.`,
    base,
    amenitiesSentence,
    "The copy highlights who the space is perfect for, what makes it stand out versus nearby alternatives, and removes friction by being transparent about layout, comfort and practical details.",
    "You can adapt the tone to your brand, but this version is structured to maximise clarity, trust and booking intent.",
  ].join(" ");
}

function buildAiKeywords(options: { title?: string; location?: string }) {
  const { title, location } = options;
  const keywords: string[] = [];

  if (title) {
    keywords.push(title.toLowerCase());
  }

  if (location) {
    keywords.push(`${location} stay`.toLowerCase());
    keywords.push(`${location} airbnb`.toLowerCase());
  }

  if (keywords.length === 0) {
    keywords.push(
      "modern airbnb listing",
      "conversion focused stay",
      "high booking potential"
    );
  }

  return keywords.slice(0, 4);
}

function impactClass(impact?: string) {
  switch (impact) {
    case "high":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "low":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-neutral-700 bg-neutral-800/80 text-neutral-300";
  }
}

function marketLabelClass(label?: string) {
  switch (label) {
    case "above_market":
      return "text-emerald-400";
    case "below_market":
      return "text-red-400";
    default:
      return "text-amber-300";
  }
}

function marketLabelText(label?: string) {
  switch (label) {
    case "above_market":
      return "Above market";
    case "below_market":
      return "Below market";
    default:
      return "Near market";
  }
}

function lqiLabelText(label?: string) {
  switch (label) {
    case "market_leader":
      return "Market leader";
    case "strong_performer":
      return "Strong performer";
    case "competitive":
      return "Competitive";
    case "improving":
      return "Improving";
    case "needs_work":
      return "Needs work";
    default:
      return "Listing quality";
  }
}

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const idValue = params?.id;
  const auditId = Array.isArray(idValue) ? idValue[0] : idValue ?? "";

  const [audit, setAudit] = useState<AuditRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(true);
  const [aiDescription, setAiDescription] = useState("");
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadAudit() {
      if (!auditId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("audits")
        .select(
          `
          id,
          listing_id,
          created_at,
          overall_score,
          result_payload,
          listings (
            id,
            title,
            source_platform,
            source_url
          )
        `
        )
        .eq("id", auditId)
        .single();

      if (error) {
        console.error("Failed to load audit:", error);
      }

      if (mounted) {
        setAudit((data as AuditRecord | null) ?? null);
        setLoading(false);
      }
    }

    loadAudit();

    return () => {
      mounted = false;
    };
  }, [auditId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowToast(false), 3200);
    return () => window.clearTimeout(timer);
  }, []);

  const listing = useMemo(() => normalizeListingJoin(audit?.listings ?? null), [audit]);

  const result: AuditResult = audit?.result_payload ?? {};

  const overallScore = Number(result.overallScore ?? audit?.overall_score ?? 0);
  const photoQuality = Number(result.photoQuality ?? 0);
  const photoOrder = Number(result.photoOrder ?? 0);
  const descriptionQuality = Number(result.descriptionQuality ?? 0);
  const amenitiesCompleteness = Number(result.amenitiesCompleteness ?? 0);
  const seoStrength = Number(result.seoStrength ?? 0);
  const conversionStrength = Number(result.conversionStrength ?? 0);

  const scorePercent = Math.max(0, Math.min(100, (overallScore / 10) * 100));
  const potentialScore = Math.min(10, overallScore + 3);
  const potentialScorePercent = Math.max(
    0,
    Math.min(100, (potentialScore / 10) * 100)
  );

  const scoreBarColor =
    overallScore < 4 ? "bg-red-500" : overallScore < 7 ? "bg-orange-500" : "bg-emerald-500";

  const potentialBarColor =
    potentialScore < 4
      ? "bg-red-500"
      : potentialScore < 7
      ? "bg-orange-500"
      : "bg-emerald-500";

  const scoreLevelLabel =
    overallScore < 4 ? "Low" : overallScore < 7 ? "Medium" : "High";

  const scoreLevelBadgeClass =
    overallScore < 4
      ? "border-red-200 bg-red-50 text-red-700"
      : overallScore < 7
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const scoreBadgeClass = (score: number) => {
    if (!Number.isFinite(score)) {
      return "border-slate-200 bg-slate-50 text-slate-700";
    }
    if (score < 4) {
      return "border-red-200 bg-red-50 text-red-700";
    }
    if (score < 7) {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  };

  const strengths = result.strengths ?? [];
  const weaknesses = result.weaknesses ?? [];
  const improvements = result.improvements ?? [];
  const suggestedOpening = result.suggestedOpening ?? "";
  const photoOrderSuggestions = result.photoOrderSuggestions ?? [];
  const missingAmenities = result.missingAmenities ?? [];

  const competitorSummary = {
    competitorCount: Number(result.competitorSummary?.competitorCount ?? 0),
    averageOverallScore: Number(
      result.competitorSummary?.averageOverallScore ?? 0
    ),
    targetVsMarketPosition:
      result.competitorSummary?.targetVsMarketPosition ?? "",
    keyGaps: result.competitorSummary?.keyGaps ?? [],
    keyAdvantages: result.competitorSummary?.keyAdvantages ?? [],
  };

  const listingQualityIndex = result.listingQualityIndex;

  const market = buildMarketPositionSummary({
    overallScore,
    photoQuality,
    photoOrder,
    descriptionQuality,
    amenitiesCompleteness,
    seoStrength,
    conversionStrength,
    strengths,
    weaknesses,
    improvements: improvements.map((imp) => ({
      title: imp.title ?? "Improvement",
      description: imp.description ?? "",
      impact:
        imp.impact === "high" || imp.impact === "medium" || imp.impact === "low"
          ? imp.impact
          : "medium",
    })),
    suggestedOpening,
    photoOrderSuggestions,
    missingAmenities,
    competitorSummary,
  });

  useEffect(() => {
    const listingTitle: string | undefined = listing?.title ?? undefined;

    const description = buildAiDescription({
      title: listingTitle,
      location: undefined,
      amenities: [],
      baseDescription: undefined,
    });

    const keywords = buildAiKeywords({
      title: listingTitle,
      location: undefined,
    });

    setAiDescription(description);
    setAiKeywords(keywords);
  }, [listing]);

  const handleCopyAiDescription = async () => {
    if (!aiDescription) return;
    try {
      await navigator.clipboard.writeText(aiDescription);
    } catch (error) {
      console.warn("Failed to copy AI description", error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 text-sm text-neutral-300">
        <h1 className="text-xl font-semibold text-white">Loading audit…</h1>
        <p className="max-w-2xl text-neutral-400">
          Please wait while we load the audit report.
        </p>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="space-y-4 text-sm text-neutral-300">
        <h1 className="text-xl font-semibold text-white">Audit not available</h1>
        <p className="max-w-2xl text-neutral-400">
          This audit could not be found. Please run a new audit from the listings page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 text-sm text-neutral-200">
      {showToast && (
        <div className="fixed right-6 top-[88px] z-30">
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-50/95 px-4 py-3 text-xs text-emerald-900 shadow-[0_18px_45px_rgba(16,185,129,0.35)]">
            <p className="font-semibold">Audit completed successfully</p>
            <p className="mt-1 text-[11px] text-emerald-800">
              Your listing has been analyzed and is ready to optimize.
            </p>
          </div>
        </div>
      )}

      <div className="sticky top-4 z-20">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/85 px-4 py-2.5 text-[13px] text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            <span className="nk-kicker-muted hidden sm:inline">Rapport</span>
            <p className="truncate font-medium">
              Audit de l’annonce {audit.listing_id.slice(0, 10)}…
            </p>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            <div className="rounded-full border border-emerald-400/60 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Score global {overallScore.toFixed(1)}/10
            </div>

            <Link
              href="/dashboard/listings/new"
              className="nk-ghost-btn hidden text-[11px] font-semibold tracking-wide text-slate-800 sm:inline-flex"
            >
              Nouvel audit
            </Link>
          </div>
        </div>
      </div>

      <div className="nk-card nk-card-hover nk-page-header-card py-7 md:py-9 md:flex md:items-start md:justify-between md:gap-10">
        <div className="max-w-3xl space-y-3">
          <p className="nk-kicker-muted">DETAILED REPORT</p>
          <h1 className="nk-heading-xl text-2xl font-semibold text-slate-900 md:text-3xl lg:text-4xl">
            Audit result
          </h1>
          <p className="nk-body-muted text-[15px] leading-relaxed text-slate-700">
            This report analyzes your listing’s conversion potential compared with
            nearby competitors.
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 font-semibold uppercase tracking-[0.18em] ${scoreLevelBadgeClass}`}
              >
                {scoreLevelLabel} score
              </span>
              <span className="inline-flex items-baseline gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white">
                <span className="uppercase tracking-[0.18em] text-slate-300">
                  Potential impact
                </span>
                <span className="font-semibold">+20% bookings potential</span>
                <span className="hidden text-slate-300 sm:inline">· +420€/month</span>
              </span>
            </div>

            <div>
              <Link
                href="/dashboard/listings"
                className="nk-primary-btn text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                Fix my listing
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-5 flex w-full flex-col items-stretch gap-4 md:mt-0 md:max-w-md">
          <div className="rounded-2xl border border-emerald-400/50 bg-white px-6 py-5 text-right shadow-[0_20px_60px_rgba(16,185,129,0.3)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-500">
              Overall score
            </p>
            <p className="mt-2 text-3xl font-semibold text-emerald-600 md:text-4xl">
              {overallScore.toFixed(1)}
              <span className="text-xl text-emerald-500"> / 10</span>
            </p>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                +20% bookings potential
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-600/10 px-2.5 py-1 font-semibold text-emerald-700">
                +420€/month (mock)
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Compared with nearby listings in your area.
            </p>
            <div className="mt-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Conversion score
            </div>
            <div className="mt-1 w-full rounded-full bg-slate-200/80">
              <div
                className={`h-2 rounded-full ${scoreBarColor}`}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white px-6 py-5 text-right shadow-[0_16px_50px_rgba(15,23,42,0.22)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Potential score
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 md:text-3xl">
              {overallScore.toFixed(1)}
              <span className="text-sm text-slate-500"> → </span>
              <span className="text-emerald-600">{potentialScore.toFixed(1)}</span>
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Improvement: +{Math.max(0, potentialScore - overallScore).toFixed(1)}
            </p>
            <div className="mt-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Potential after applying actions
            </div>
            <div className="mt-1 w-full rounded-full bg-slate-200/80">
              <div
                className={`h-2 rounded-full ${potentialBarColor}`}
                style={{ width: `${potentialScorePercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {listingQualityIndex && typeof listingQualityIndex.score === "number" && (
        <div className="nk-card nk-card-hover border-slate-200/90 bg-white p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="nk-kicker-muted text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                EXECUTIVE METRIC
              </p>
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
                  Listing Quality Index
                </h2>
                {listingQualityIndex.label && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {lqiLabelText(listingQualityIndex.label)}
                  </span>
                )}
              </div>
              {listingQualityIndex.summary && (
                <p className="text-[13px] leading-relaxed text-slate-700">
                  {listingQualityIndex.summary}
                </p>
              )}
            </div>

            <div className="mt-2 flex flex-1 flex-col gap-4 md:mt-0 md:max-w-sm">
              <div className="rounded-2xl border border-slate-200/90 bg-slate-900 px-5 py-4 text-right text-slate-50 shadow-[0_16px_42px_rgba(15,23,42,0.35)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  LQI score
                </p>
                <p className="mt-2 text-3xl font-semibold md:text-4xl">
                  {Math.round(listingQualityIndex.score)}
                  <span className="text-lg text-slate-300"> / 100</span>
                </p>
              </div>

              {listingQualityIndex.components && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-3 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Listing quality
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {Math.round(listingQualityIndex.components.listingQuality ?? 0)}
                      <span className="text-xs text-slate-500"> / 100</span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-3 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Market competitiveness
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {Math.round(
                        listingQualityIndex.components.marketCompetitiveness ?? 0
                      )}
                      <span className="text-xs text-slate-500"> / 100</span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-3 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Conversion potential
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {Math.round(
                        listingQualityIndex.components.conversionPotential ?? 0
                      )}
                      <span className="text-xs text-slate-500"> / 100</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {market && (
        <div className="nk-card nk-card-hover p-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Market overview
              </p>
              <p className="mt-1 text-xl font-semibold text-gray-900 md:text-2xl">
                Market comparison
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Market position
              </p>
              <p
                className={`mt-3 text-2xl font-semibold md:text-3xl ${marketLabelClass(
                  market.label
                )}`}
              >
                {marketLabelText(market.label)}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                {market.message}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Competitors analyzed
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                {market.competitorCount}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                Nearby comparable listings
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Local average
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                {market.averageOverallScore.toFixed(1)}/10
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                Average nearby score
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Delta vs market
              </p>
              <p
                className={`mt-3 text-3xl font-semibold tracking-tight md:text-4xl ${
                  market.deltaVsAverage > 0
                    ? "text-emerald-500"
                    : market.deltaVsAverage < 0
                    ? "text-red-500"
                    : "text-amber-500"
                }`}
              >
                {market.deltaVsAverage > 0 ? "+" : ""}
                {market.deltaVsAverage.toFixed(1)}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                Difference from nearby average
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="nk-card nk-card-hover border-emerald-200/80 bg-emerald-50/95 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Estimated booking impact
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-emerald-900">
              Listings with stronger conversion scores typically receive more bookings in competitive
              markets. These ranges are directional estimates, not guarantees.
            </p>
          </div>
          <div className="mt-2 rounded-2xl border border-emerald-300/80 bg-white px-5 py-4 text-right shadow-md md:mt-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Potential improvement
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700 md:text-3xl">
              +12% to +25% bookings
            </p>
            <p className="mt-1 text-[12px] text-emerald-800">
              Based on patterns observed for similar optimized listings.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-gray-900 md:text-2xl">
            Revenue Optimization
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="nk-card nk-card-hover border-slate-200/90 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Current average price
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              €68
            </p>
            <p className="mt-1 text-[12px] text-slate-600">Per night, recent bookings</p>
          </div>

          <div className="nk-card nk-card-hover border-slate-200/90 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Market optimal price
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              €79
            </p>
            <p className="mt-1 text-[12px] text-slate-600">Median of high-performing peers</p>
          </div>

          <div className="nk-card nk-card-hover border-emerald-200/90 bg-emerald-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Potential price increase
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-emerald-700 md:text-3xl">
              +16%
            </p>
            <p className="mt-1 text-[12px] text-emerald-800">Without hurting conversion</p>
          </div>

          <div className="nk-card nk-card-hover border-emerald-200/90 bg-emerald-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Monthly revenue upside
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-emerald-700 md:text-3xl">
              +€420
            </p>
            <p className="mt-1 text-[12px] text-emerald-800">Based on expected occupancy</p>
          </div>
        </div>

        <div className="nk-card nk-card-hover border-slate-200/90 bg-white p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Pricing suggestions
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-800">
            <li className="ml-4 list-disc">Increase weekend rates by around 12% while monitoring pickup.</li>
            <li className="ml-4 list-disc">Introduce a lighter adjustment on weekdays to stay competitive.</li>
            <li className="ml-4 list-disc">Raise high-season prices in line with top quartile listings.</li>
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-gray-900 md:text-2xl">
            AI Optimized Listing Description
          </p>
        </div>

        <div className="nk-card nk-card-hover relative border-slate-200/90 bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                AI-powered suggestion
              </p>
              <p className="mt-1 text-[13px] leading-6 text-slate-700">
                Use this as a starting point for your Airbnb description, then adapt the tone to
                your brand and host profile.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyAiDescription}
                className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm transition hover:bg-slate-800"
              >
                Copy description
              </button>
              <button
                type="button"
                onClick={() => {
                  const listingTitle: string | undefined = listing?.title ?? undefined;

                  const description = buildAiDescription({
                    title: listingTitle,
                    location: undefined,
                    amenities: [],
                    baseDescription: undefined,
                  });

                  const keywords = buildAiKeywords({
                    title: listingTitle,
                    location: undefined,
                  });

                  setAiDescription(description);
                  setAiKeywords(keywords);
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 shadow-sm transition hover:border-slate-400"
              >
                Regenerate
              </button>
              <a
                href="#optimized-listing"
                className="nk-primary-btn text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                Generate optimized listing
              </a>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-[15px] leading-relaxed text-slate-900">
            {aiDescription || "AI description will appear here once the audit data is available."}
          </div>

          {aiKeywords.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Suggested Airbnb keywords
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                {aiKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-800"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div id="optimized-listing" className="nk-card nk-card-hover p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-gray-900 md:text-2xl">
            Optimized listing
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm transition hover:bg-slate-800"
            >
              Copy all
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 shadow-sm transition hover:border-slate-400"
            >
              Regenerate (mock)
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Title (mock)
              </p>
              <p className="mt-2 text-[15px] font-medium leading-relaxed text-slate-900">
                "Bright, conversion‑ready stay near city center with fast Wi‑Fi & flexible check‑in"
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Description (mock)
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-800">
                This optimized listing focuses on clarity, comfort and trust: guests immediately
                understand who the space is for, what makes it stand out versus nearby options and
                which practical details (check‑in, Wi‑Fi, workspace, parking) remove friction from
                the stay.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Highlights
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-6 text-slate-800">
                <li>Clear promise in the first 2 lines about who the stay is perfect for.</li>
                <li>Grouped amenities that highlight comfort, work and family‑friendly features.</li>
                <li>Transparent notes about layout, stairs and noise to build trust.</li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Keywords (mock)
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-800">
                  city center apartment
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-800">
                  fast wi‑fi workspace
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-800">
                  flexible check‑in
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-800">
                  airbnb conversion
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="nk-card nk-card-hover p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-gray-900 md:text-2xl">
            Action plan
          </p>
        </div>
        <p className="mt-2 text-[13px] leading-6 text-slate-700">
          Starter action plan based on this audit (static for now). Use it as a checklist to turn
          insights into concrete changes on your listing.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-600">
              Critical
            </p>
            <ul className="mt-3 space-y-3 text-sm text-slate-800">
              <li>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">Fix first 5 photos</p>
                    <p className="mt-1 text-[13px] leading-5 text-slate-700">
                      Replace dark or low‑quality shots and ensure the cover photo clearly sells
                      the main value of the stay.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                        Impact · +8% bookings (mock)
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                        Effort · Medium
                      </span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${impactClass(
                      "high"
                    )}`}
                  >
                    High impact
                  </span>
                </div>
              </li>
              <li>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">Clarify who it&apos;s for</p>
                    <p className="mt-1 text-[13px] leading-5 text-slate-700">
                      Add 2–3 lines in the opening that spell out the ideal guest profile and
                      primary use cases.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                        Impact · +6% bookings (mock)
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                        Effort · Low
                      </span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${impactClass(
                      "high"
                    )}`}
                  >
                    High impact
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">
              High impact
            </p>
            <ul className="mt-3 space-y-3 text-sm text-slate-800">
              <li>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">Group amenities by benefit</p>
                    <p className="mt-1 text-[13px] leading-5 text-slate-700">
                      Reorder amenities into logical groups (comfort, work, family) so guests can
                      scan faster.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                        Impact · +4% bookings (mock)
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                        Effort · Medium
                      </span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${impactClass(
                      "medium"
                    )}`}
                  >
                    Medium impact
                  </span>
                </div>
              </li>
              <li>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">Tighten long paragraphs</p>
                    <p className="mt-1 text-[13px] leading-5 text-slate-700">
                      Split dense blocks of text into shorter sections with clear headings.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                        Impact · +3% bookings (mock)
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                        Effort · Low
                      </span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${impactClass(
                      "medium"
                    )}`}
                  >
                    Medium impact
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Nice to have
            </p>
            <ul className="mt-3 space-y-3 text-sm text-slate-800">
              <li>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">Add neighborhood context</p>
                    <p className="mt-1 text-[13px] leading-5 text-slate-700">
                      Include 2–3 lines about what guests can reach on foot within 10 minutes.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                        Impact · +2% bookings (mock)
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                        Effort · Low
                      </span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${impactClass(
                      "low"
                    )}`}
                  >
                    Low impact
                  </span>
                </div>
              </li>
              <li>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">Polish SEO keywords</p>
                    <p className="mt-1 text-[13px] leading-5 text-slate-700">
                      Reuse 2–3 city + property type phrases in the description and title.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                        Impact · +1% bookings (mock)
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                        Effort · Low
                      </span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${impactClass(
                      "low"
                    )}`}
                  >
                    Low impact
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="nk-card nk-card-hover p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-gray-900 md:text-2xl">
            Top priority improvements
          </p>
        </div>
        <p className="mt-2 text-[13px] leading-6 text-slate-700">
          Focus first on the actions with the biggest impact on bookings.
        </p>
        <ol className="mt-5 space-y-4 text-[15px] text-slate-800 md:space-y-5">
          {improvements.length > 0 ? (
            improvements
              .slice()
              .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
              .map((imp, index) => (
                <li
                  key={imp.id ?? index}
                  className="rounded-xl border border-slate-200 bg-white/95 transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/60 hover:shadow-md"
                >
                  <label className="flex items-start gap-4 p-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 peer"
                    />
                    <div className="flex-1 space-y-1 peer-checked:opacity-60 peer-checked:line-through">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Action {index + 1}
                          </p>
                          <p className="mt-1 font-medium text-slate-900">
                            {imp.title ?? "Improvement"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-sm ${impactClass(
                            imp.impact
                          )}`}
                        >
                          {(imp.impact ?? "medium").toString()} impact
                        </span>
                      </div>
                      <p className="mt-1 text-[14px] leading-relaxed text-slate-800">
                        {imp.description}
                      </p>
                    </div>
                  </label>
                </li>
              ))
          ) : (
            <li className="text-sm text-slate-500">
              No prioritized improvements available.
            </li>
          )}
        </ol>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-gray-900 md:text-2xl">
            Score breakdown & qualitative insights
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="nk-card nk-card-hover p-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Détail des scores
            </div>
            <dl className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-slate-600">Photo quality</dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scoreBadgeClass(
                      photoQuality
                    )}`}
                  >
                    {photoQuality}/10
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-slate-600">Photo order</dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scoreBadgeClass(
                      photoOrder
                    )}`}
                  >
                    {photoOrder}/10
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-slate-600">Description quality</dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scoreBadgeClass(
                      descriptionQuality
                    )}`}
                  >
                    {descriptionQuality}/10
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-slate-600">Amenities completeness</dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scoreBadgeClass(
                      amenitiesCompleteness
                    )}`}
                  >
                    {amenitiesCompleteness}/10
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-slate-600">SEO strength</dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scoreBadgeClass(
                      seoStrength
                    )}`}
                  >
                    {seoStrength}/10
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-slate-600">Conversion strength</dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scoreBadgeClass(
                      conversionStrength
                    )}`}
                  >
                    {conversionStrength}/10
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="nk-card nk-card-hover p-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Strengths
            </div>
            <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-slate-800">
              {strengths.length > 0 ? (
                strengths.map((item, index) => <li key={index}>{item}</li>)
              ) : (
                <li className="text-slate-500">No strengths identified yet.</li>
              )}
            </ul>
          </div>

          <div className="nk-card nk-card-hover p-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Weaknesses
            </div>
            <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-slate-800">
              {weaknesses.length > 0 ? (
                weaknesses.map((item, index) => <li key={index}>{item}</li>)
              ) : (
                <li className="text-slate-500">
                  No weaknesses identified yet.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-gray-900 md:text-2xl">
            Market gaps & advantages
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="nk-card nk-card-hover p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Principaux écarts vs marché
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-800">
              {competitorSummary.keyGaps.length > 0 ? (
                competitorSummary.keyGaps.map((gap, index) => (
                  <li key={`${gap}-${index}`} className="ml-4 list-disc">
                    {gap}
                  </li>
                ))
              ) : (
                <li className="text-slate-500">No major gaps identified yet.</li>
              )}
            </ul>
          </div>

          <div className="nk-card nk-card-hover p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Principaux avantages vs marché
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-800">
              {competitorSummary.keyAdvantages.length > 0 ? (
                competitorSummary.keyAdvantages.map((advantage, index) => (
                  <li key={`${advantage}-${index}`} className="ml-4 list-disc">
                    {advantage}
                  </li>
                ))
              ) : (
                <li className="text-slate-500">
                  No clear advantages identified yet.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-gray-900 md:text-2xl">
            Suggested copy & photo order
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="relative nk-card nk-card-hover p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Paragraphe d’ouverture suggéré
            </p>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(suggestedOpening || "")}
              className="absolute right-4 top-4 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700 shadow-sm transition hover:bg-orange-100"
            >
              Copy text
            </button>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-900">
              {suggestedOpening || "No suggested opening available yet."}
            </p>
          </div>

          <div className="nk-card nk-card-hover p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ordre de photos suggéré
            </p>
            {photoOrderSuggestions.length === 0 ? (
              <p className="mt-3 text-[15px] text-slate-900">
                No suggested photo order available yet.
              </p>
            ) : (
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-900">
                {photoOrderSuggestions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-gray-900 md:text-2xl">
            Missing amenities checklist
          </p>
        </div>

        <div className="nk-card nk-card-hover p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Checklist des équipements manquants
          </p>
          {missingAmenities.length === 0 ? (
            <p className="mt-3 text-[15px] leading-relaxed text-slate-900">
              No obvious gaps in your amenities list were detected.
            </p>
          ) : (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-900">
              {missingAmenities.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-gray-900 md:text-2xl">
            Title before / after
          </p>
        </div>

        <div className="nk-card nk-card-hover p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Current title
              </p>
              <p className="mt-2 text-[15px] font-medium leading-relaxed text-slate-900">
                {listing?.title || "No title available for this listing."}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Example optimized title (mock)
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-900">
                "Bright, conversion‑ready stay near city center with fast Wi‑Fi & flexible check‑in"
              </p>
              <p className="mt-1 text-[12px] leading-5 text-slate-600">
                Static example for now — later this block can be powered by your AI title generator.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-orange-200 bg-orange-50 p-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold text-gray-900 md:text-2xl">
            Recommended next step
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-gray-900">
            Apply the highest-impact improvements, then run another audit to
            measure your progress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href="/dashboard/listings/new"
            className="rounded-lg bg-orange-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-orange-600"
          >
            Run another audit
          </Link>
          <Link
            href="/dashboard/audits"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700 underline-offset-4 hover:underline"
          >
            Back to audits
          </Link>
          <Link
            href="/dashboard/listings"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700 underline-offset-4 hover:underline"
          >
            Analyze another listing
          </Link>
        </div>
      </div>
    </div>
  );
}