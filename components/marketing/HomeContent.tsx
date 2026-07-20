"use client";

import Link from "next/link";
import { AuthorityTrustLayer } from "@/components/marketing/AuthorityTrustLayer";
import { HowItWorksSections } from "@/components/marketing/HowItWorksSections";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { useTranslation } from "@/components/i18n/useTranslation";
import { articles } from "@/data/articles";
import { cities } from "@/data/cities";
import { guides } from "@/data/guides";
import { authorityTrustI18n } from "@/data/marketing/authorityTrustI18n";
import { homeI18n } from "@/data/marketing/homeI18n";
import { marketReports } from "@/data/marketReports";
import { tools } from "@/data/tools";
import { buildLocalizedPath } from "@/lib/seo/seoUrls";

export function HomeContent() {
  const { locale, copy } = useTranslation(homeI18n);
  const authorityCopy = authorityTrustI18n[locale].home;
  const freeAuditHref = buildLocalizedPath("/free-audit", locale);
  const cityMarketCount = cities.length;
  const countryCount = new Set(cities.map((city) => city.country)).size;
  const publicReportCount = marketReports.length;
  const resourceCount = guides.length + articles.length + tools.length;

  const marketingVideoSrc =
    locale === "fr"
      ? "/marketing/norixo-demo-fr.mp4"
      : "/marketing/norixo-demo-en.mp4";

  const proofStats = [
    {
      value: cityMarketCount.toString(),
      label: copy.proofStats.marketsLabel,
    },
    {
      value: countryCount.toString(),
      label: copy.proofStats.countriesLabel,
    },
    {
      value: publicReportCount.toString(),
      label: copy.proofStats.reportsLabel,
    },
    {
      value: resourceCount.toString(),
      label: copy.proofStats.resourcesLabel,
    },
  ];

  return (
    <MarketingPageShell>
      <main className="nk-section space-y-10 md:space-y-12">
      {/* HERO */}
      <section className="grid gap-8 rounded-[28px] nk-border bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.12),transparent_58%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_56%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] p-6 shadow-[0_18px_52px_rgba(15,23,42,0.12)] sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:p-8">
        <div className="flex max-w-2xl flex-col justify-between gap-6 md:gap-7">
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

          <div className="max-w-md space-y-3">
            <div className="grid gap-2">
              <div className="rounded-2xl border border-orange-200 bg-orange-50/80 px-3.5 py-2 text-[11px] leading-5 text-orange-800 shadow-[0_10px_24px_rgba(251,146,60,0.10)]">
                {copy.hero.badgeOne}
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-3.5 py-2 text-[11px] leading-5 text-sky-800 shadow-[0_10px_24px_rgba(56,189,248,0.10)]">
                {copy.hero.badgeTwo}
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-[11px] leading-5 text-emerald-800 shadow-[0_10px_24px_rgba(16,185,129,0.10)]">
                {copy.hero.badgeThree}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
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

        {/* Demo video in hero */}
        <aside className="nk-card flex h-full flex-col justify-center overflow-hidden border border-slate-200/90 bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(30,41,59,0.96)_100%)] p-4 text-white shadow-[0_30px_80px_rgba(15,23,42,0.25)] ring-2 ring-sky-300/20">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300">
              {copy.demo.eyebrow}
            </p>
            <h2 className="mt-2 text-[20px] font-semibold leading-tight tracking-[-0.04em] md:text-[24px]">
              {copy.demo.title}
            </h2>
            <p className="mt-3 text-[12px] leading-5 text-slate-600">
              {copy.demo.text}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200">
              <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1">{copy.demo.badgeAirbnb}</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1">{copy.demo.badgeBooking}</span>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-emerald-200">{copy.demo.badgeAudit}</span>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-black/35 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
            <video
              className="aspect-video w-full rounded-[18px] bg-slate-950 object-cover"
              controls
              controlsList="nodownload"
              disablePictureInPicture
              playsInline
              preload="metadata"
                poster="/marketing/norixo-demo-thumbnail.jpg"
            >
              <source src={marketingVideoSrc} type="video/mp4" />
            </video>
          </div>
        </aside>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {proofStats.map((item) => (
          <div
            key={`${item.label}-hero-proof`}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
          >
            <p className="text-[20px] font-semibold tracking-[-0.05em] text-slate-950">
              {item.value}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-slate-600">
              {item.label}
            </p>
          </div>
        ))}
      </section>

      <AuthorityTrustLayer copy={authorityCopy} isRtl={locale === "ar"} />

      {/* QUICK PROCESS SECTION */}
      <section className="grid gap-3 md:grid-cols-4">
        {copy.steps.items.map(({ step, title, text }) => (
          <div
            key={step}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.07)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-500">
              {copy.steps.stepLabel} {step}
            </p>
            <h3 className="mt-2 text-[15px] font-semibold text-slate-950">{title}</h3>
            <p className="mt-2 text-[12px] leading-5 text-slate-600">{text}</p>
          </div>
        ))}
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

      <section className="grid gap-6 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="nk-card rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.09)]">
          <p className="nk-section-title text-slate-500">{copy.trust.eyebrow}</p>
          <h2 className="mt-3 text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-950 md:text-[28px]">
            {copy.trust.title}
          </h2>
          <p className="mt-3 text-[14px] leading-7 text-slate-600 md:text-[15px]">
            {copy.trust.intro}
          </p>
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 shadow-[0_12px_28px_rgba(16,185,129,0.10)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {copy.transparency.items[2].title}
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              {copy.transparency.items[2].text}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {copy.trust.cards.map(({ title, text }, index) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-[11px] font-semibold text-white">
                  0{index + 1}
                </span>
                <p className="text-[14px] font-semibold text-slate-950">{title}</p>
              </div>
              <p className="mt-3 text-[13px] leading-6 text-slate-600">
                {text}
              </p>
            </div>
          ))}
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
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="nk-card border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
          <p className="nk-section-title">{copy.beforeAfter.eyebrow}</p>
          <h2 className="mt-3 text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-900 md:text-[26px]">
            {copy.beforeAfter.title}
          </h2>
          <p className="mt-3 text-[14px] leading-7 text-slate-600 md:text-[15px]">
            {copy.beforeAfter.text}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Airbnb
              </p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-[0_14px_34px_rgba(15,23,42,0.10)]">
                <img
                  src="/marketing/airbnb-before.png"
                  alt="Annonce Airbnb avant optimisation"
                  className="h-56 w-full object-cover object-top"
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {copy.beforeAfter.beforeText}
              </p>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-white p-3 text-slate-700 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                Booking
              </p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-sky-200 bg-slate-50 shadow-[0_14px_34px_rgba(15,23,42,0.10)]">
                <img
                  src="/marketing/booking-before.png"
                  alt="Annonce Booking avant optimisation"
                  className="h-56 w-full object-cover object-top"
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {copy.beforeAfter.beforeText}
              </p>
            </div>
          </div>
        </div>

        <div className="nk-card border border-emerald-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(236,253,245,0.74)_100%)] p-6 shadow-[0_18px_46px_rgba(16,185,129,0.16)] ring-1 ring-emerald-100">
          <p className="nk-section-title text-emerald-700">{copy.beforeAfter.productReadingEyebrow}</p>
          <h3 className="mt-3 text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-900 md:text-[26px]">
            {copy.beforeAfter.productReadingTitle}
          </h3>
          <p className="mt-3 text-[14px] leading-7 text-slate-600 md:text-[15px]">
            {copy.beforeAfter.reportSummary}
          </p>

          <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_46px_rgba(15,23,42,0.10)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {copy.reportPreview.aiReport}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {copy.reportPreview.listing}
                </p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                IA
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.16),transparent_58%),linear-gradient(180deg,rgba(255,255,255,1),rgba(236,253,245,0.86))] px-3 py-4 shadow-[0_12px_28px_rgba(16,185,129,0.14)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  {copy.beforeAfter.scoreLabel}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="relative h-16 w-16 shrink-0">
                    <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(226,232,240,1)" strokeWidth="4" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="rgb(16,185,129)"
                        strokeWidth="4"
                        strokeDasharray="73 100"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[15px] font-semibold text-emerald-700">7.3</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-950">7.3 / 10</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-600">{copy.beforeAfter.performanceLevel}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-3 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.beforeAfter.weakPoints}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-slate-700">
                  {copy.beforeAfter.clarity}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  {copy.reportPreview.estimatedImpact}
                </p>
                <p className="mt-2 text-[12px] leading-5 font-semibold text-emerald-900">
                  {copy.beforeAfter.acceleration}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                  {copy.instantPreview.scoreTitle}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-slate-700">
                  {copy.reportPreview.recommendations[0]}
                </p>
              </div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50/80 px-3 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                  {copy.instantPreview.recommendationsTitle}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-slate-700">
                  {copy.reportPreview.recommendations[1]}
                </p>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 px-3 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-700">
                  {copy.reportPreview.marketPosition}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-slate-700">
                  {copy.reportPreview.recommendations[2]}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {copy.reportPreview.aiReport}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  copy.demo.badgeAudit,
                  copy.demo.badgeAirbnb,
                  copy.demo.badgeBooking,
                  copy.reportPreview.marketPosition,
                  copy.reportPreview.revenueImpact,
                  copy.instantPreview.recommendationsTitle,
                ].map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700"
                  >
                    {badge}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    {copy.reportPreview.estimatedImpact}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">
                    {copy.reportPreview.estimatedImpactValue}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                    {copy.reportPreview.revenueImpact}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-amber-900">
                    {copy.reportPreview.revenueImpactValue}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {copy.beforeAfter.actionPlanExcerpt}
                </p>
                <div className="relative mt-3 space-y-3 pl-1">
                  <div className="absolute bottom-4 left-[18px] top-4 w-px bg-slate-200" />
                  {copy.beforeAfter.actions.map((action, index) => (
                    <div key={action} className="relative flex items-start gap-4">
                      <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)] ring-4 ring-white">
                        {index + 1}
                      </span>
                      <p className="pt-1 text-[12px] leading-5 text-slate-700">
                        {action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <div className="nk-card rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.09)]">
          <p className="nk-section-title text-slate-500">{copy.method.eyebrow}</p>
          <h2 className="mt-3 text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-950 md:text-[28px]">
            {copy.method.title}
          </h2>
          <p className="mt-3 text-[14px] leading-7 text-slate-600 md:text-[15px]">
            {copy.method.intro}
          </p>

          <div className="relative mt-6 space-y-4 pl-1">
            <div className="absolute bottom-3 left-[17px] top-3 w-px bg-slate-200" />
            {copy.method.steps.map(({ title, text }, index) => (
              <div key={title} className="relative flex items-start gap-4">
                <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-950 shadow-[0_10px_22px_rgba(15,23,42,0.10)] ring-1 ring-slate-200">
                  0{index + 1}
                </span>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                  <p className="text-[13px] font-semibold text-slate-950">{title}</p>
                  <p className="mt-1 text-[12px] leading-5 text-slate-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="nk-card rounded-[28px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(236,253,245,0.82)_100%)] p-6 shadow-[0_18px_46px_rgba(16,185,129,0.12)]">
            <p className="nk-section-title text-emerald-700">{copy.transparency.eyebrow}</p>
            <h2 className="mt-3 text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-950 md:text-[28px]">
              {copy.transparency.title}
            </h2>
            <p className="mt-3 text-[14px] leading-7 text-slate-700 md:text-[15px]">
              {copy.transparency.intro}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {copy.transparency.items.map(({ title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
              >
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {title}
                </p>
                <p className="mt-2 text-[13px] leading-6 text-slate-600">
                  {text}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-950 px-5 py-4 text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)]">
            <p className="text-[12px] leading-6 text-slate-100">
              {copy.transparency.footer}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white/95 px-5 py-6 shadow-[0_16px_38px_rgba(15,23,42,0.08)] md:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {copy.resources.eyebrow}
        </p>
        <h2 className="mt-3 text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-950 md:text-[26px]">
          {copy.resources.title}
        </h2>
        <p className="mt-3 max-w-3xl text-[14px] leading-7 text-slate-600 md:text-[15px]">
          {copy.resources.text}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium text-slate-700">
          <Link
            href={freeAuditHref}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            {copy.resources.links.freeAudit}
          </Link>
          <Link
            href="/guides"
            className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 transition-colors hover:bg-slate-100"
          >
            {copy.resources.links.guides}
          </Link>
          <Link
            href="/articles"
            className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 transition-colors hover:bg-slate-100"
          >
            {copy.resources.links.articles}
          </Link>
          <Link
            href="/tools"
            className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 transition-colors hover:bg-slate-100"
          >
            {copy.resources.links.tools}
          </Link>
          <Link
            href="/reports"
            className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 transition-colors hover:bg-slate-100"
          >
            {copy.resources.links.reports}
          </Link>
          <Link
            href="/countries"
            className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 transition-colors hover:bg-slate-100"
          >
            {copy.resources.links.countries}
          </Link>
          <Link
            href="/solutions"
            className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 transition-colors hover:bg-slate-100"
          >
            {copy.resources.links.solutions}
          </Link>
        </div>
      </section>

      </main>
    </MarketingPageShell>
  );
}
