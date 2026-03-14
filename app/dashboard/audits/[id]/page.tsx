"use client";

import type { Audit } from "@/types/domain";
import { getStoredAuditById } from "@/lib/client-store";
import { buildMarketPositionSummary } from "@/ai/marketPosition";
import { useParams } from "next/navigation";

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
};

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

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const idValue = params?.id;
  const auditId = Array.isArray(idValue) ? idValue[0] : idValue ?? "";

  const audit: Audit | null = auditId ? getStoredAuditById(auditId) : null;

  if (!audit) {
    return (
      <div className="space-y-4 text-sm text-neutral-300">
        <h1 className="text-xl font-semibold text-white">Audit not available</h1>
        <p className="max-w-2xl text-neutral-400">
          This audit could not be found in the current browser session. Please
          run a new audit from the listings page.
        </p>
      </div>
    );
  }

  const rawResult = (audit as unknown as { result?: AuditResult })?.result;
  const result: AuditResult = rawResult ?? {};

  const overallScore = Number(result.overallScore ?? 0);
  const photoQuality = Number(result.photoQuality ?? 0);
  const photoOrder = Number(result.photoOrder ?? 0);
  const descriptionQuality = Number(result.descriptionQuality ?? 0);
  const amenitiesCompleteness = Number(result.amenitiesCompleteness ?? 0);
  const seoStrength = Number(result.seoStrength ?? 0);
  const conversionStrength = Number(result.conversionStrength ?? 0);

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

  return (
    <div className="space-y-8 text-sm text-neutral-200">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="nk-kicker-muted">Rapport détaillé</p>
          <h1 className="nk-heading-xl">Audit result</h1>
          <p className="nk-body-muted">
            Conversion audit for this listing. Scores and recommendations are
            generated from the extracted listing data and nearby comparable
            listings when available.
          </p>
        </div>

        <div className="min-w-[160px] rounded-2xl border border-emerald-400/35 bg-gradient-to-b from-emerald-500/15 to-emerald-500/5 px-5 py-4 text-right shadow-[0_20px_60px_rgba(16,185,129,0.35)]">
          <p className="nk-table-header text-emerald-300/80">
            Overall score
          </p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">
            {overallScore.toFixed(1)}/10
          </p>
        </div>
      </div>

      {market && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="nk-card nk-card-hover p-5">
            <p className="nk-table-header">
              Market position
            </p>
            <p
              className={`mt-3 text-base font-semibold ${marketLabelClass(
                market.label
              )}`}
            >
              {marketLabelText(market.label)}
            </p>
            <p className="mt-2 text-sm leading-5 text-slate-400">
              {market.message}
            </p>
          </div>

          <div className="nk-card nk-card-hover p-5">
            <p className="nk-table-header">
              Competitors analyzed
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-50">
              {market.competitorCount}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Nearby comparable listings
            </p>
          </div>

          <div className="nk-card nk-card-hover p-5">
            <p className="nk-table-header">
              Local average
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-50">
              {market.averageOverallScore.toFixed(1)}/10
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Average nearby score
            </p>
          </div>

          <div className="nk-card nk-card-hover p-5">
            <p className="nk-table-header">
              Delta vs market
            </p>
            <p
              className={`mt-3 text-3xl font-semibold ${
                market.deltaVsAverage > 0
                  ? "text-emerald-400"
                  : market.deltaVsAverage < 0
                  ? "text-red-400"
                  : "text-white"
              }`}
            >
              {market.deltaVsAverage > 0 ? "+" : ""}
              {market.deltaVsAverage.toFixed(1)}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Difference from nearby average
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="nk-card nk-card-hover p-5">
          <p className="nk-table-header">
            Key gaps vs market
          </p>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-200">
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

        <div className="nk-card nk-card-hover p-5">
          <p className="nk-table-header">
            Key advantages vs market
          </p>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-200">
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

      <div className="grid gap-4 md:grid-cols-3">
        <div className="nk-card nk-card-hover p-5">
          <div className="mb-4 nk-table-header">
            Scores
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Photo quality</dt>
              <dd className="font-medium text-slate-50">{photoQuality}/10</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Photo order</dt>
              <dd className="font-medium text-slate-50">{photoOrder}/10</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Description quality</dt>
              <dd className="font-medium text-slate-50">
                {descriptionQuality}/10
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Amenities completeness</dt>
              <dd className="font-medium text-slate-50">
                {amenitiesCompleteness}/10
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">SEO strength</dt>
              <dd className="font-medium text-slate-50">{seoStrength}/10</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Conversion strength</dt>
              <dd className="font-medium text-slate-50">
                {conversionStrength}/10
              </dd>
            </div>
          </dl>
        </div>

        <div className="nk-card nk-card-hover p-5">
          <div className="mb-4 nk-table-header">
            Strengths
          </div>
          <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-slate-200">
            {strengths.length > 0 ? (
              strengths.map((item, index) => <li key={index}>{item}</li>)
            ) : (
              <li className="text-slate-500">No strengths identified yet.</li>
            )}
          </ul>
        </div>

        <div className="nk-card nk-card-hover p-5">
          <div className="mb-4 nk-table-header">
            Weaknesses
          </div>
          <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-slate-200">
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

      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="nk-card nk-card-hover p-5">
          <div className="mb-4 nk-table-header">
            Prioritized improvements
          </div>
          <ol className="space-y-3 text-sm text-slate-200">
            {improvements.length > 0 ? (
              improvements
                .slice()
                .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                .map((imp, index) => (
                  <li
                    key={imp.id ?? index}
                    className="nk-card-soft p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-slate-50">
                        {imp.title ?? "Improvement"}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide ${impactClass(
                          imp.impact
                        )}`}
                      >
                        {(imp.impact ?? "medium").toString()} impact
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {imp.description}
                    </p>
                  </li>
                ))
            ) : (
              <li className="text-slate-500">
                No prioritized improvements available.
              </li>
            )}
          </ol>
        </div>

        <div className="nk-card nk-card-hover p-5">
          <div className="mb-4 nk-table-header">
            Suggested opening paragraph
          </div>
          <p className="text-sm leading-7 text-slate-200">
            {suggestedOpening || "No suggested opening available yet."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="nk-card nk-card-hover p-5">
          <div className="mb-4 nk-table-header">
            Suggested photo order
          </div>
          {photoOrderSuggestions.length === 0 ? (
            <p className="text-sm text-slate-400">
              No suggested photo order available yet.
            </p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-200">
              {photoOrderSuggestions.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ol>
          )}
        </div>

        <div className="nk-card nk-card-hover p-5">
          <div className="mb-4 nk-table-header">
            Missing amenities checklist
          </div>
          {missingAmenities.length === 0 ? (
            <p className="text-sm text-slate-400">
              No obvious gaps in your amenities list were detected.
            </p>
          ) : (
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-200">
              {missingAmenities.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}