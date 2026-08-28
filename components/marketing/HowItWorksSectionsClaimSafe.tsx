"use client";

import Link from "next/link";
import { useTranslation } from "@/components/i18n/useTranslation";
import { howItWorksI18n } from "@/data/marketing/howItWorksI18n";
import { buildLocalizedPath } from "@/lib/seo/seoUrls";
import { getIllustrativeAuditPreviewCopy } from "@/lib/seo/howItWorksClaimSafety";

type HowItWorksSectionsClaimSafeProps = {
  includeAnchorId?: boolean;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  primaryActionReassurance?: string;
  showHeroPersuasionNote?: boolean;
};

export function HowItWorksSectionsClaimSafe({
  includeAnchorId = false,
  primaryActionLabel,
  primaryActionHref = "/free-audit",
  primaryActionReassurance,
  showHeroPersuasionNote = false,
}: HowItWorksSectionsClaimSafeProps) {
  const { locale, copy } = useTranslation(howItWorksI18n);
  const preview = getIllustrativeAuditPreviewCopy();
  const freeAuditHref = buildLocalizedPath("/free-audit", locale);
  const resolvedPrimaryActionLabel = primaryActionLabel ?? copy.hero.primaryCta;
  const resolvedPrimaryActionReassurance = primaryActionReassurance ?? copy.hero.reassurance;

  return (
    <div className="space-y-10 md:space-y-12">
      <section
        id={includeAnchorId ? "how-it-works" : undefined}
        className="nk-card nk-card-hover grid gap-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] md:p-7"
      >
        <div className="flex flex-col justify-between gap-6">
          <div className="max-w-xl space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.hero.eyebrow}</p>
            <h1 className="text-balance text-[2rem] font-extrabold leading-[0.95] tracking-tight bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 bg-clip-text text-transparent md:text-[2.8rem]">
              {copy.hero.titleLine1}
              <span className="block">{copy.hero.titleLine2}</span>
            </h1>
            <p className="text-[14px] leading-7 text-slate-600">{copy.hero.subtitle}</p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={primaryActionHref} className="nk-primary-btn w-full text-xs font-semibold uppercase tracking-[0.18em] sm:w-auto">
                {resolvedPrimaryActionLabel}
              </Link>
              <Link href="/demo" className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-[1px] hover:bg-slate-50 sm:w-auto">
                {copy.hero.secondaryCta}
              </Link>
            </div>
            <p className="text-xs text-gray-500">{resolvedPrimaryActionReassurance}</p>
            <p className="text-xs text-gray-500">{copy.hero.proof}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white to-sky-50/70 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.shared.conversionScore}</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{preview.scoreValue}</p>
              <p className="mt-1 text-[12px] leading-5 text-slate-500">{preview.scoreScale}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/70 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.hero.qualityIndex}</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{preview.qualityValue}</p>
              <p className="mt-1 text-[12px] leading-5 text-slate-500">{preview.qualityScale}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/70 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.shared.priorityRecommendations}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{copy.hero.actionsTitle}</p>
            <ul className="mt-2 space-y-1.5 text-[13px] leading-6 text-slate-700">
              {copy.hero.actions.slice(0, 3).map((action) => <li key={action}>{action}</li>)}
            </ul>
          </div>
        </div>

        <div className="nk-card nk-card-hover flex flex-col gap-4 border-slate-200/80 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-5 text-slate-700 ring-2 ring-emerald-200/70 shadow-[0_30px_80px_rgba(16,185,129,0.15)]">
          <div className="border-b border-slate-200 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.reportPreview.eyebrow}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Illustrative audit preview</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 ring-1 ring-emerald-300">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{preview.impactLabel}</p>
            <p className="mt-2 text-sm font-semibold text-emerald-900">Pricing · Photos · Copy · Trust · Market positioning</p>
            <p className="mt-2 text-[12px] leading-5 text-emerald-800/80">{preview.impactDetail}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Market context</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Comparable listings and local conditions</p>
              <p className="mt-2 text-[12px] leading-5 text-slate-500">Used as context, not as a guaranteed performance forecast.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recommendations</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Prioritized areas to review</p>
              <p className="mt-2 text-[12px] leading-5 text-slate-500">Final findings depend on the listing and the evidence available during the audit.</p>
            </div>
          </div>

          {showHeroPersuasionNote ? (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Transparent by design</p>
              <ul className="mt-2 space-y-1.5 pl-4 text-[12px] leading-5 text-slate-700">
                <li className="list-disc">No fixed uplift or ranking promise.</li>
                <li className="list-disc">Illustrative preview clearly separated from real audit findings.</li>
                <li className="list-disc">Market context is used to support decisions, not guarantee outcomes.</li>
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="nk-card nk-card-hover rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.features.eyebrow}</p>
        <div className="mt-5 grid gap-5 text-sm text-slate-800 md:grid-cols-3">
          {[
            [copy.shared.conversionScore, copy.features.conversionScoreText],
            [copy.features.benchmarkTitle, copy.features.benchmarkText],
            [copy.hero.qualityIndex, copy.features.qualityText],
            [copy.features.aiSuggestionsTitle, copy.features.recommendationsText],
            [copy.features.revenueImpactTitle, copy.features.revenueImpactText],
            [copy.features.portfoliosTitle, copy.features.portfoliosText],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.07)]">
              <p className="font-semibold text-slate-900">{title}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="nk-card flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white px-5 py-6 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.finalCta.eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">{copy.finalCta.title}</h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-600">{copy.finalCta.text}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={freeAuditHref} className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]">{resolvedPrimaryActionLabel}</Link>
          <Link href="/demo" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">{copy.hero.secondaryCta}</Link>
        </div>
      </section>
    </div>
  );
}
