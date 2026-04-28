"use client";

import Link from "next/link";
import {
  buildAuditInsights,
  type AuditInsightsLocale,
} from "@/lib/audits/buildAuditInsights";

type QuickWinCard = {
  title: string;
  impact: string;
};

type AuditInsightsPanelProps = {
  locale: AuditInsightsLocale;
  title: string;
  badgeLabel: string;
  badgeTone: "pro" | "available";
  intro: string;
  heroTitle: string;
  performanceHeadline: string;
  heroIntro: string;
  latestScore: number | null;
  estimatedTopPercent: number | null;
  impactLine: string;
  displayedInsight: string;
  insightLeadFromPayload?: boolean;
  payloadFirstRecommendation?: string | null;
  heroClosing: string;
  impactBusinessLead: string;
  recommendations: string[];
  quickWinCards: QuickWinCard[];
  strengths: string[];
  weaknesses: string[];
  currentRevenueLabel: string;
  optimizedRevenueLabel: string;
  revenueImpactValue: string;
  insightsNarrative: string;
  isPro: boolean;
  limitedRecommendations: string;
  marketTeaser: string | null;
  upgradeHref: string;
};

export default function AuditInsightsPanel({
  locale,
  title,
  badgeLabel,
  badgeTone,
  intro,
  heroTitle,
  performanceHeadline,
  heroIntro,
  latestScore,
  estimatedTopPercent,
  impactLine,
  displayedInsight,
  insightLeadFromPayload = true,
  payloadFirstRecommendation = null,
  heroClosing,
  impactBusinessLead,
  recommendations,
  quickWinCards,
  strengths,
  weaknesses,
  currentRevenueLabel,
  optimizedRevenueLabel,
  revenueImpactValue,
  insightsNarrative,
  isPro,
  limitedRecommendations,
  marketTeaser,
  upgradeHref,
}: AuditInsightsPanelProps) {
  const insights = buildAuditInsights({
    locale,
    overallScore: latestScore,
    estimatedTopPercent,
    impactLine,
    summary: displayedInsight,
    displayedInsight,
    insightLeadFromPayload,
    payloadFirstRecommendation,
    recommendations,
    quickWins: quickWinCards,
    strengths,
    weaknesses,
    marketTeaser,
  });
  const labels =
    locale === "en"
      ? {
          premium: "Premium analysis",
          hero: "Editorial insight",
          diagnostic: "Short diagnostic",
          currentBase: "Current baseline",
          optimized: "After optimization",
          businessRead: "Business read",
          top3: "Top 3",
          priority: "Primary priority",
          advanced: "Advanced reading",
          score: "Global score",
          position: "Estimated position",
          improving: "Improving",
        }
      : {
          premium: "Analyse premium",
          hero: "Lecture editoriale",
          diagnostic: "Diagnostic court",
          currentBase: "Base actuelle",
          optimized: "Apres optimisation",
          businessRead: "Lecture business",
          top3: "Top 3",
          priority: "Priorite principale",
          advanced: "Lecture avancee",
          score: "Score global",
          position: "Position estimee",
          improving: "En progression",
        };

  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.08)]">
      <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_34%),linear-gradient(180deg,#fffaf2_0%,#ffffff_72%)] px-6 py-6 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                {labels.premium}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  badgeTone === "pro"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {badgeLabel}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {title}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                {insights.heroInsight.title || heroTitle}
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-700">
              {insights.heroInsight.text || performanceHeadline}
            </p>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              {heroIntro || intro}
            </p>
          </div>

          <div className="grid min-w-[280px] gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {labels.score}
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                {latestScore !== null ? (
                  <>
                    {latestScore.toFixed(1)}
                    <span className="text-lg font-medium text-slate-400">/10</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {insights.diagnosticShort}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {labels.position}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">
                {estimatedTopPercent !== null ? `Top ${estimatedTopPercent}%` : labels.improving}
              </p>
              <p className="mt-2 text-xs leading-5 text-emerald-800">{insights.projectionLine}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,247,237,0.95)_0%,rgba(255,255,255,1)_46%,rgba(240,253,244,0.9)_100%)] p-6 shadow-[0_20px_55px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
              {labels.hero}
            </p>
            <p className="mt-4 text-base font-medium leading-7 text-slate-900">{displayedInsight}</p>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              {insights.heroInsight.closing || heroClosing}
            </p>
            <div className="mt-5 rounded-2xl border border-white/80 bg-white/90 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {labels.diagnostic}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{insights.diagnosticShort}</p>
            </div>
          </div>

          <div className="rounded-[26px] border border-emerald-200 bg-emerald-50/60 p-6 shadow-[0_18px_45px_rgba(16,185,129,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {insights.businessPotential.title}
            </p>
            <h3 className="mt-4 text-xl font-semibold tracking-tight text-emerald-950">
              {insights.businessPotential.text || impactBusinessLead}
            </h3>
            <p className="mt-4 text-sm leading-7 text-emerald-900">
              {insights.businessPotential.estimate}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {labels.currentBase}
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-900">
                  {currentRevenueLabel}
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {labels.optimized}
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-900">
                  {optimizedRevenueLabel}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-white/70 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {labels.businessRead}
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-950">{revenueImpactValue}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {insights.quickWins.title}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{insights.quickWins.intro}</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700">
                {labels.top3}
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {insights.quickWins.items.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className="rounded-2xl border border-orange-200 bg-orange-50/80 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold leading-6 text-slate-900">
                      {index + 1}. {item.title}
                    </p>
                    <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                      {item.impact}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {insights.analysis.title}
            </p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <p className="text-sm font-semibold text-emerald-800">
                  {insights.analysis.strengthsTitle}
                </p>
                <ul className="mt-3 space-y-2">
                  {insights.analysis.strengths.slice(0, 3).map((item, index) => (
                    <li key={`${item}-${index}`} className="text-sm leading-6 text-emerald-950">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="text-sm font-semibold text-amber-800">
                  {insights.analysis.weaknessesTitle}
                </p>
                <ul className="mt-3 space-y-2">
                  {insights.analysis.weaknesses.slice(0, 3).map((item, index) => (
                    <li key={`${item}-${index}`} className="text-sm leading-6 text-amber-950">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {labels.priority}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-900">
                {insights.analysis.primaryPriority}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {insights.aiInsight.title}
            </p>
            <p className="mt-4 text-base font-medium leading-7 text-slate-900">
              {insights.aiInsight.lead}
            </p>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              {insights.aiInsight.followup || insightsNarrative}
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {labels.advanced}
            </p>
            <p className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
              {isPro
                ? "Vos comparaisons avancées et lectures marché sont disponibles."
                : insights.proTeaser.title || limitedRecommendations}
            </p>
            {isPro ? (
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {marketTeaser ||
                  (locale === "en"
                    ? "No detailed market paragraph is attached to this report yet."
                    : "Aucun paragraphe marche detaille n'est associe a ce rapport pour le moment.")}
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Débloquez une lecture encore plus poussée du marché, des comparaisons avancées et
                  des recommandations plus fines.
                </p>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                  {insights.proTeaser.bullets.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <div className="mt-5">
                  <Link
                    href={upgradeHref}
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-white ring-1 ring-white/10 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] shadow-[0_8px_24px_rgba(59,130,246,0.35)] transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-[0_12px_32px_rgba(59,130,246,0.45)] active:scale-[0.98]"
                  >
                    {insights.proTeaser.cta}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
