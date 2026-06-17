"use client";

import Link from "next/link";
import { HowItWorksSections } from "@/components/marketing/HowItWorksSections";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { useTranslation } from "@/components/i18n/useTranslation";
import { homeI18n } from "@/data/marketing/homeI18n";

export function HomeContent() {
  const { copy } = useTranslation(homeI18n);

  return (
    <MarketingPageShell>
      <main className="nk-section space-y-10 md:space-y-12">
      {/* HERO */}
      <section className="grid gap-8 rounded-[28px] nk-border bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.12),transparent_58%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_56%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] p-6 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:grid-cols-[minmax(0,1.6fr)_minmax(0,420px)] md:p-8">
        <div className="space-y-6 md:space-y-8">
          <div className="space-y-4 md:space-y-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-500">
              NORIXO OPTIMIZE
            </p>
            <h1 className="max-w-3xl text-balance bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl md:text-6xl">
              {copy.hero.titleLine1}
              <span className="block">
                {copy.hero.titleLine2}
              </span>
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-slate-600">
              {copy.hero.subtitle}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5">
            <Link
              href="/sign-in?next=/audit/new"
              className="nk-primary-btn w-full px-8 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.2em] shadow-[0_18px_40px_rgba(59,130,246,0.35)] sm:w-auto"
            >
              {copy.hero.primaryCta}
            </Link>
            <Link
              href="/demo"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-colors hover:bg-slate-50 sm:w-auto"
            >
              {copy.hero.secondaryCta}
            </Link>
            </div>
            <p className="text-xs text-gray-500">
              {copy.hero.reassurance}
            </p>
            <div className="text-xs text-gray-500">
              {copy.hero.proof}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[11px] leading-5 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                {copy.hero.badgeOne}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[11px] leading-5 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                {copy.hero.badgeTwo}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[11px] leading-5 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                {copy.hero.badgeThree}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.hero.whyTitle}
              </p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.hero.whyText}
              </p>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            {copy.hero.quickLine}
          </div>
        </div>

        {/* Product preview in hero */}
        <aside className="nk-card flex h-full flex-col justify-end border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-6 ring-2 ring-emerald-200/70 shadow-[0_30px_80px_rgba(16,185,129,0.15)] scale-[1.01]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.reportPreview.eyebrow}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {copy.reportPreview.listing}
                </p>
              </div>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {copy.reportPreview.aiReport}
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-sky-100 bg-[linear-gradient(135deg,rgba(239,246,255,1),rgba(219,234,254,0.98))] px-4 py-4 shadow-[0_16px_34px_rgba(30,64,175,0.18)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.reportPreview.globalScore}
              </p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600">
                6.4<span className="text-base text-emerald-500"> / 10</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {copy.reportPreview.scoreHint}
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.reportPreview.marketPosition}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-slate-900">{copy.reportPreview.competitive}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-3 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.10)] ring-1 ring-emerald-300">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.reportPreview.estimatedImpact}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-emerald-700">{copy.reportPreview.estimatedImpactValue}</p>
                <p className="mt-1 text-[11px] text-emerald-700">
                  {copy.reportPreview.similarListings}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(209,250,229,0.96))] px-3 py-3 shadow-[0_16px_34px_rgba(16,185,129,0.22)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  {copy.reportPreview.revenueImpact}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-emerald-900">{copy.reportPreview.revenueImpactValue}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.reportPreview.recommendationsTitle}
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-800">
                <li>{copy.reportPreview.recommendations[0]}</li>
                <li>{copy.reportPreview.recommendations[1]}</li>
                <li>{copy.reportPreview.recommendations[2]}</li>
              </ul>
            </div>
          </div>
        </aside>
      </section>

      {/* INSTANT PREVIEW SECTION (from onboarding, condensed) */}
      <section className="grid gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="nk-card rounded-2xl border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {copy.instantPreview.eyebrow}
          </p>
          <h2 className="mt-2 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-slate-900">
            {copy.instantPreview.title}
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-slate-600">
            {copy.instantPreview.text}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-100/90 px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.instantPreview.initialState}
              </p>
              <p className="mt-1 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {copy.instantPreview.pending}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-3 shadow-[0_8px_20px_rgba(16,185,129,0.10)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {copy.instantPreview.activeState}
              </p>
              <p className="mt-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100/80 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                {copy.instantPreview.ready}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-sky-200 bg-[linear-gradient(180deg,rgba(239,246,255,1)_0%,rgba(248,250,252,1)_100%)] p-4 shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                {copy.instantPreview.scoreTitle}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-slate-600">
                {copy.instantPreview.cardOne}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                {copy.instantPreview.benchmarkTitle}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-slate-600">
                {copy.instantPreview.cardTwo}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-slate-50/90 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                {copy.instantPreview.recommendationsTitle}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-slate-600">
                {copy.instantPreview.cardThree}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.9)_0%,rgba(220,252,231,0.7)_100%)] p-4 shadow-[0_12px_30px_rgba(16,185,129,0.14)]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                {copy.reportPreview.estimatedImpact}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-emerald-700">
                {copy.instantPreview.cardFour}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="nk-card border border-red-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(254,242,242,0.7)_100%)] p-7 shadow-[0_16px_40px_rgba(15,23,42,0.10)] ring-1 ring-red-100/60">
          <p className="nk-section-title text-red-600">{copy.problem.eyebrow}</p>
          <div className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-600">
            {copy.problem.title}
          </div>
          <h2 className="mt-3 text-[22px] font-semibold leading-[1.15] tracking-[-0.04em] text-slate-950 md:text-[26px]">
            {copy.problem.headline}
          </h2>
          <p className="mt-3 text-[14px] leading-7 text-slate-600 md:text-[15px]">
            {copy.problem.text}
          </p>
          <ul className="mt-4 space-y-2 text-[13px] leading-6 text-slate-700">
            <li>{copy.problem.bullets[2]}</li>
            <li>{copy.problem.bullets[0]}</li>
            <li>{copy.problem.bullets[1]}</li>
          </ul>
        </div>

        <div className="nk-card grid gap-3 border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] p-5 text-sm text-slate-800 shadow-[0_16px_38px_rgba(15,23,42,0.09)] sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[2px]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.problem.cardOneTitle}
              </p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.problem.cardOne}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[2px]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.problem.cardTwoTitle}
              </p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.problem.cardTwo}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[2px]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.problem.cardThreeTitle}
              </p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.problem.cardThree}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[2px]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.problem.conclusionTitle}
              </p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {copy.problem.conclusion}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BEFORE / AFTER SECTION */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)]">
        <div className="nk-card border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
          <p className="nk-section-title">{copy.beforeAfter.eyebrow}</p>
          <h2 className="mt-3 text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-900 md:text-[26px]">
            {copy.beforeAfter.title}
          </h2>
          <p className="mt-3 text-[14px] leading-7 text-slate-600 md:text-[15px]">
            {copy.beforeAfter.text}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(255,255,255,1)_100%)] p-4 text-slate-700 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Avant optimisation
              </p>
              <div className="mt-3 flex gap-3">
                <div className="h-16 w-20 rounded-xl bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-4/5 rounded-full bg-slate-300" />
                  <div className="h-2.5 w-full rounded-full bg-slate-200" />
                  <div className="h-2.5 w-3/5 rounded-full bg-slate-200" />
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {copy.beforeAfter.beforeText}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-emerald-100 to-white p-4 shadow-[0_16px_34px_rgba(16,185,129,0.24)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                {copy.beforeAfter.afterTitle}
              </p>
              <div className="mt-3 flex gap-3">
                <div className="h-16 w-20 rounded-xl bg-gradient-to-br from-emerald-200 to-emerald-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-4/5 rounded-full bg-emerald-200" />
                  <div className="h-2.5 w-full rounded-full bg-emerald-100" />
                  <div className="h-2.5 w-3/5 rounded-full bg-emerald-100" />
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-emerald-900">
                {copy.beforeAfter.afterText}
              </p>
            </div>
          </div>
        </div>

        <div className="nk-card border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.09)]">
          <p className="nk-section-title">{copy.beforeAfter.productReadingEyebrow}</p>
          <h3 className="mt-3 text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-900 md:text-[26px]">
            {copy.beforeAfter.productReadingTitle}
          </h3>
          <p className="mt-3 text-[14px] leading-7 text-slate-600 md:text-[15px]">
            {copy.beforeAfter.reportSummary}
          </p>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {copy.beforeAfter.scoreLabel}
                </p>
                <p className="mt-1 text-3xl font-semibold text-emerald-600">7.3 / 10</p>
                <p className="mt-1 text-[11px] text-slate-600">{copy.beforeAfter.performanceLevel}</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(240,249,255,0.9)_100%)] px-3 py-4 shadow-[0_12px_28px_rgba(56,189,248,0.10)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {copy.beforeAfter.weakPoints}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-700">
                  {copy.beforeAfter.clarity}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(209,250,229,0.96))] px-3 py-4 shadow-[0_16px_32px_rgba(16,185,129,0.22)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  {copy.reportPreview.estimatedImpact}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-emerald-900">
                  {copy.beforeAfter.acceleration}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs leading-5 text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {copy.beforeAfter.actionPlanExcerpt}
              </p>
              <ul className="mt-2 space-y-1.5">
                <li>{copy.beforeAfter.actions[0]}</li>
                <li>{copy.beforeAfter.actions[1]}</li>
                <li>{copy.beforeAfter.actions[2]}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      </main>
    </MarketingPageShell>
  );
}
