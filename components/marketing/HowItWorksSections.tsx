"use client";

import Link from "next/link";
import { useTranslation } from "@/components/i18n/useTranslation";
import { howItWorksI18n } from "@/data/marketing/howItWorksI18n";

type HowItWorksSectionsProps = {
  includeAnchorId?: boolean;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  primaryActionReassurance?: string;
  onPrimaryAction?: () => void;
  showHeroPersuasionNote?: boolean;
};

function PrimaryAction({
  label,
  href,
  onClick,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="nk-primary-btn w-full text-xs font-semibold uppercase tracking-[0.18em] sm:w-auto"
      >
        {label}
      </button>
    );
  }

  return (
    <Link
      href={href ?? "/sign-in?next=/audit/new"}
      className="nk-primary-btn w-full text-xs font-semibold uppercase tracking-[0.18em] sm:w-auto"
    >
      {label}
    </Link>
  );
}

export function HowItWorksSections({
  includeAnchorId = false,
  primaryActionLabel,
  primaryActionReassurance,
  primaryActionHref = "/sign-in?next=/audit/new",
  onPrimaryAction,
  showHeroPersuasionNote = false,
}: HowItWorksSectionsProps) {
  const { copy } = useTranslation(howItWorksI18n);
  const resolvedPrimaryActionLabel = primaryActionLabel ?? copy.hero.primaryCta;
  const resolvedPrimaryActionReassurance =
    primaryActionReassurance ?? copy.hero.reassurance;

  return (
    <div className="space-y-10 md:space-y-12">
      <section
        id={includeAnchorId ? "how-it-works" : undefined}
        className="nk-card nk-card-hover grid gap-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.05fr)] md:p-7"
      >
        <div className="flex flex-col justify-between gap-6">
          <div className="max-w-xl space-y-3.5 md:space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.hero.eyebrow}</p>
            <h1 className="text-balance text-[2rem] font-extrabold leading-[0.95] tracking-tight bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 bg-clip-text text-transparent md:text-[2.8rem]">
              {copy.hero.titleLine1}
              <span className="block">
                {copy.hero.titleLine2}
              </span>
            </h1>
            <p className="mt-2 text-[14px] leading-7 text-slate-600">
              {copy.hero.subtitle}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <PrimaryAction
                label={resolvedPrimaryActionLabel}
                href={primaryActionHref}
                onClick={onPrimaryAction}
              />
              <Link
                href="/demo"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50 sm:w-auto"
              >
                {copy.hero.secondaryCta}
              </Link>
            </div>
            <p className="text-xs text-gray-500">
              {resolvedPrimaryActionReassurance}
            </p>
            <div className="text-xs text-gray-500">
              {copy.hero.proof}
            </div>
          </div>

          <div className="mt-3 space-y-2.5 text-[13px] leading-6 text-slate-700">
            {/* Bloc scores */}
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white to-sky-50/70 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-sky-100/70">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.shared.conversionScore}
                  </p>
                  <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-slate-950">
                    {copy.shared.scoreLabel} <span className="text-[18px] text-slate-500">/ 10</span>
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500/80">
                    {copy.hero.performanceReading}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/70 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-blue-100/70">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.hero.qualityIndex}
                  </p>
                  <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-slate-950">
                    Indice <span className="text-[18px] text-slate-500">/ 100</span>
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500/80">
                    {copy.hero.qualityIndexText}
                  </p>
                </div>
              </div>
            </div>

            {/* Bloc recommandations */}
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/70 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.07)] ring-1 ring-amber-100/70">
              <div className="relative pl-4">
                <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.shared.priorityRecommendations}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{copy.hero.actionsTitle}</p>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-6 text-slate-700/90">
                  <li>{copy.hero.actions[0]}</li>
                  <li>{copy.hero.actions[1]}</li>
                  <li>{copy.hero.actions[2]}</li>
                </ul>
              </div>
            </div>

            {/* Bloc impact */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-[13px] leading-6 text-emerald-900 shadow-[0_12px_30px_rgba(16,185,129,0.10)] ring-1 ring-emerald-300">
              <div className="relative pl-4">
                <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  {copy.hero.estimatedImpact}
                </p>
                <p className="mt-1 text-[23px] font-semibold tracking-tight text-emerald-900">
                  {copy.hero.potentialBookings}
                </p>
                <p className="mt-1 text-[11px] text-emerald-700">
                  {copy.hero.similarListings}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            {copy.hero.quickLine}
          </div>
        </div>

        <div className="nk-card nk-card-hover flex flex-col gap-3.5 border-slate-200/80 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-5 text-slate-700 ring-2 ring-emerald-200/70 shadow-[0_30px_80px_rgba(16,185,129,0.15)] scale-[1.01]">
          <div className="flex items-center justify-between gap-3.5 border-b border-slate-200 pb-2.5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.reportPreview.eyebrow}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {copy.reportPreview.listing}
              </p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {copy.reportPreview.aiReport}
            </span>
          </div>

          <div className="mt-2 grid gap-2.5 text-[12px] leading-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
              <div className="relative pl-4">
                <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.shared.conversionScore}
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-600">
                  6.4<span className="text-sm text-emerald-500"> / 10</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {copy.reportPreview.similarComparison}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
              <div className="relative pl-4">
                <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.hero.qualityIndex}
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  82<span className="text-sm text-slate-500"> / 100</span>
                </p>
                <p className="mt-1 text-[11px] text-emerald-700">{copy.reportPreview.qualityStatus}</p>
              </div>
            </div>
          </div>

          <div className="mt-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-2.5 shadow-[0_10px_24px_rgba(16,185,129,0.14)] ring-1 ring-emerald-300">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
              <div className="flex items-center justify-between gap-3.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    {copy.reportPreview.estimatedImpact}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">{copy.reportPreview.potentialBookings}</p>
                </div>
                <div className="h-9 w-24 overflow-hidden rounded-full bg-emerald-500/20">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-300 to-sky-300" />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-emerald-800/80">
                {copy.hero.similarListings}
              </p>
            </div>
          </div>

          {showHeroPersuasionNote ? (
            <div className="mt-1 border-t border-slate-200/80 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {copy.reportPreview.trustTitle}
              </p>
              <ul className="mt-2 space-y-1.5 pl-4 text-[12px] leading-5 text-slate-700">
                <li className="list-disc">{copy.reportPreview.visibleSignals}</li>
                <li className="list-disc">{copy.reportPreview.trustBullets[0]}</li>
                <li className="list-disc">{copy.reportPreview.trustBullets[1]}</li>
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="nk-card nk-card-hover rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.features.eyebrow}</p>
        <div className="mt-5 grid gap-5 text-sm text-slate-800 md:grid-cols-3">
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-sky-200 bg-gradient-to-br from-white to-sky-50/70 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-sky-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
              <p className="font-semibold text-slate-900">{copy.shared.conversionScore}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.features.conversionScoreText}
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/70 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-blue-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
              <p className="font-semibold text-slate-900">{copy.features.benchmarkTitle}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.features.benchmarkText}
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/70 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-indigo-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-indigo-400/70" />
              <p className="font-semibold text-slate-900">{copy.hero.qualityIndex}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.features.qualityText}
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50/70 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-violet-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
              <p className="font-semibold text-slate-900">{copy.features.aiSuggestionsTitle}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.features.recommendationsText}
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/70 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-emerald-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
              <p className="font-semibold text-slate-900">{copy.features.revenueImpactTitle}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.features.revenueImpactText}
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-dashed border-amber-200 bg-gradient-to-br from-white to-amber-50/60 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-amber-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
              <p className="font-semibold text-slate-900">{copy.features.portfoliosTitle}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.features.portfoliosText}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="nk-card nk-card-hover rounded-[28px] border border-slate-200 bg-white p-5 md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.audience.eyebrow}</p>
        <div className="mt-4 grid gap-4 text-sm text-slate-800 md:grid-cols-4">
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/60 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ring-1 ring-amber-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
              <p className="text-sm font-semibold text-slate-900">{copy.features.independentHosts}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.features.independentHostsText}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ring-1 ring-emerald-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
              <p className="text-sm font-semibold text-slate-900">{copy.audience.investors}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.features.investorsText}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white to-sky-50/60 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ring-1 ring-sky-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
              <p className="text-sm font-semibold text-slate-900">{copy.audience.propertyManagers}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.features.teamsText}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50/60 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ring-1 ring-violet-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
              <p className="text-sm font-semibold text-slate-900">{copy.audience.conciergeries}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.audience.conciergeriesText}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="nk-card flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] px-5 py-6 text-slate-900 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="max-w-xl rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.finalCta.eyebrow}</p>
          <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
            {copy.finalCta.title}
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-600">
            {copy.finalCta.text}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <PrimaryAction
            label={resolvedPrimaryActionLabel}
            href={primaryActionHref}
            onClick={onPrimaryAction}
          />
          <Link
            href="/demo"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50"
          >
            {copy.hero.secondaryCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
