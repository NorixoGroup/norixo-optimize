"use client";

import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { useTranslation } from "@/components/i18n/useTranslation";
import { demoI18n } from "@/data/marketing/demoI18n";
import { HeroTitle, SectionLabel, SectionTitle, SectionDescription, KpiGrid, MobileCenteredBlock } from "@/components/ui";

export function DemoContent() {
  const { locale, copy } = useTranslation(demoI18n);

  const marketingVideoSrc =
    locale === "fr"
      ? "/marketing/norixo-demo-fr.mp4"
      : "/marketing/norixo-demo-en.mp4";

  return (
    <MarketingPageShell>
      <main className="nk-section space-y-10 md:space-y-12">
      {/* Demo hero */}
      <section className="relative overflow-hidden rounded-[28px] nk-border bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:p-7 xl:p-8 nk-card-lg backdrop-blur-[4px] md:grid md:grid-cols-2 md:items-center md:gap-10">
        <div className="max-w-xl space-y-4 md:space-y-5">
          <SectionLabel className="text-orange-500">{copy.hero.eyebrow}</SectionLabel>
          <HeroTitle className="mt-1 text-left [text-wrap:balance] drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]">
            {copy.hero.title}
          </HeroTitle>
          <SectionDescription className="mt-2 max-w-xl text-[14px] leading-7 text-slate-600 md:text-[15px]">
            {copy.hero.subtitle}
          </SectionDescription>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              href="/sign-in?next=/audit/new"
              className="rounded-2xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105"
            >
              {copy.hero.primaryCta}
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50"
            >
              {copy.hero.secondaryCta}
            </Link>
          </div>
        </div>

        <div className="mt-6 md:mt-0 md:pl-4">
          <div className="rounded-[28px] border border-slate-100/80 bg-white/95 p-3 shadow-[0_12px_32px_rgba(15,23,42,0.08)] md:p-4">
            <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-950 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
              <video
                className="aspect-video w-full bg-slate-950 object-contain"
                controls
                controlsList="nodownload"
                disablePictureInPicture
                playsInline
                preload="metadata"
                poster="/marketing/norixo-demo-thumbnail.jpg"
              >
                <source
                  src={marketingVideoSrc}
                  type="video/mp4"
                />
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* Example listing analyzed + report preview */}
      <section className="space-y-10 md:space-y-12">
        <div className="flex flex-col justify-between rounded-[28px] nk-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] px-5 py-6 md:p-7 nk-card-lg transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_18px_56px_rgba(15,23,42,0.10)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="space-y-2 max-w-[700px]">
              <SectionLabel className="nk-text-secondary">
                {copy.sampleListing.eyebrow}
              </SectionLabel>
              <SectionTitle className="mt-1 text-[22px] md:text-[26px] leading-[1.15] tracking-[-0.03em] text-slate-950">
                {copy.sampleListing.title}
              </SectionTitle>
              <SectionDescription className="text-[13px] leading-6 nk-text-secondary">
                {copy.sampleListing.location}
              </SectionDescription>
              <SectionDescription className="text-[13px] leading-6 nk-text-secondary">
                {copy.sampleListing.priceLine}
              </SectionDescription>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                  {copy.sampleListing.weakMainPhoto}
                </span>
                <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 font-medium text-sky-700">
                  {copy.sampleListing.genericTitle}
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                  {copy.sampleListing.highOptimizationPotential}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">
                {copy.sampleListing.platform}
              </span>
              <div className="flex items-center gap-1 text-sm font-medium text-amber-500">
                <span>4.7</span>
                <span className="text-xs nk-text-secondary">{copy.sampleListing.reviews}</span>
              </div>
              <p className="mt-1 text-[11px] nk-text-secondary">{copy.sampleListing.realExampleBefore}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 nk-card-sm">
            <SectionLabel>
              {copy.optimizationPriorities.eyebrow}
            </SectionLabel>

            <SectionTitle className="mt-1 text-[17px] leading-7 text-slate-900">
              {copy.optimizationPriorities.title}
            </SectionTitle>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
                  <p className="text-[13px] font-semibold text-amber-600">
                    {copy.optimizationPriorities.cardOneTitle}
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-slate-700">
                    {copy.optimizationPriorities.cardOneText}
                  </p>
                  <p className="mt-1 text-[11px] nk-text-secondary">
                    {copy.optimizationPriorities.cardOneImpact}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                  <p className="text-[13px] font-semibold text-emerald-600">
                    {copy.optimizationPriorities.cardTwoTitle}
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-slate-700">
                    {copy.optimizationPriorities.cardTwoText}
                  </p>
                  <p className="mt-1 text-[11px] nk-text-secondary">
                    {copy.optimizationPriorities.cardTwoImpact}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
                  <p className="text-[13px] font-semibold text-sky-600">
                    {copy.optimizationPriorities.cardThreeTitle}
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-slate-700">
                    {copy.optimizationPriorities.cardThreeText}
                  </p>
                  <p className="mt-1 text-[11px] nk-text-secondary">
                    {copy.optimizationPriorities.cardThreeImpact}
                  </p>
                </div>
              </div>

            </div>
            <div className="mt-4 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100 p-5 nk-card-highlight">
              <div className="relative pl-4">
                <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                <SectionLabel className="text-emerald-700">
                  {copy.optimizationPriorities.resultPreviewEyebrow}
                </SectionLabel>

                <div className="mt-1 flex items-end justify-between">
                  <p className="text-2xl md:text-3xl font-semibold tracking-[-0.02em] text-emerald-900">
                    {copy.optimizationPriorities.resultPreviewTitle}
                  </p>
                  <span className="ml-2 rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {copy.optimizationPriorities.resultPreviewBadge}
                  </span>
                </div>

                <p className="mt-1 text-[13px] leading-6 text-emerald-900/80">
                  {copy.optimizationPriorities.resultPreviewText}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="relative w-full p-2 md:p-3">
              <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-5 md:items-start">
                {/* Colonne gauche : photo principale */}
                <div className="relative flex flex-col gap-5">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white nk-card-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {copy.photoAnalysis.analyzedMainPhoto}
                      </p>
                      <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-slate-500 sm:inline-flex">
                        {copy.photoAnalysis.beforeOptimization}
                      </span>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      {copy.photoAnalysis.weakFirstImpression}
                    </span>
                  </div>
                  <div className="relative h-36 w-full bg-[radial-gradient(circle_at_0_0,rgba(148,163,184,0.18),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(59,130,246,0.20),transparent_55%)] sm:h-48">
                    {/* Mock de photo analysée */}
                    <div className="absolute inset-3 overflow-hidden rounded-xl border border-white/35 bg-[radial-gradient(circle_at_18%_0,rgba(248,250,252,0.96),transparent_55%),radial-gradient(circle_at_85%_100%,rgba(15,23,42,0.9),transparent_60%)] shadow-[0_18px_45px_rgba(15,23,42,0.32)]">
                      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.33),rgba(15,23,42,0.14))] mix-blend-multiply opacity-70" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_0_100%,rgba(15,23,42,0.26),transparent_60%)] opacity-85" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0,rgba(15,23,42,0.15),transparent_55%)] opacity-60" />

                      {/* Volumes principaux de la pièce (mock visuel) */}
                      <div className="absolute left-6 top-6 h-14 w-28 rounded-2xl bg-white/14 shadow-[0_20px_36px_rgba(15,23,42,0.55)] backdrop-blur-[1.5px]" />
                      <div className="absolute left-6 bottom-6 h-10 w-24 rounded-xl bg-white/10 shadow-[0_18px_30px_rgba(15,23,42,0.5)] backdrop-blur-[1.5px]" />
                      <div className="absolute right-10 bottom-7 h-12 w-28 rounded-2xl bg-emerald-200/20 shadow-[0_20px_36px_rgba(15,23,42,0.55)] backdrop-blur-[1.5px]" />

                      {/* Heatmap / focus discret sur la zone basse */}
                      <div className="pointer-events-none absolute bottom-[-8px] left-1/2 h-14 w-40 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.45),transparent_68%)] opacity-55 mix-blend-screen" />
                      <div className="pointer-events-none absolute inset-x-10 bottom-7 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-70" />

                      {/* Voile d'analyse "avant" */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/26 via-slate-900/8 to-slate-900/0" />
                    </div>

                    {/* Badge flottant Avant optimisation */}
                    <div className="absolute left-6 top-4 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-slate-50 shadow-[0_10px_28px_rgba(15,23,42,0.65)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      {copy.photoAnalysis.beforeOptimization}
                    </div>

                    {/* Markers visuels sur la photo */}
                    <div className="absolute left-10 top-10 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(251,191,36,0.45)]" />
                      <div className="rounded-full border border-amber-100 bg-amber-50/95 px-2 py-0.5 text-[10px] font-medium text-amber-800 shadow-[0_10px_26px_rgba(15,23,42,0.25)]">
                        {copy.photoAnalysis.terraceNotVisible}
                      </div>
                    </div>
                    <div className="absolute right-8 top-1/2 flex -translate-y-1/2 items-center gap-2">
                      <div className="rounded-full border border-slate-200 bg-white/92 px-2 py-0.5 text-[10px] text-slate-700 shadow-[0_10px_26px_rgba(15,23,42,0.22)]">
                        {copy.photoAnalysis.keyAssetMissing}
                      </div>
                      <span className="h-2 w-2 rounded-full bg-slate-500 shadow-[0_0_0_4px_rgba(148,163,184,0.45)]" />
                    </div>
                    <div className="absolute left-12 bottom-9 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_0_4px_rgba(56,189,248,0.40)]" />
                      <div className="rounded-full border border-sky-100 bg-sky-50/95 px-2 py-0.5 text-[10px] text-sky-800 shadow-[0_10px_26px_rgba(15,23,42,0.22)]">
                        {copy.photoAnalysis.framingWeak}
                      </div>
                    </div>

                    {/* Bandeau d’analyse compact en bas */}
                    <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/70 bg-white/92 px-3 py-2 text-[10px] text-slate-700 shadow-[0_10px_26px_rgba(15,23,42,0.22)] backdrop-blur-md md:left-1/2 md:right-auto md:w-[82%] md:-translate-x-1/2 md:items-start md:justify-between md:gap-3 md:px-4 md:py-2.5 md:flex">
                      <div className="md:flex-[0.9]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {copy.photoAnalysis.firstImpressionReading}
                        </p>
                        <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-medium text-slate-600">
                              {copy.photoAnalysis.whatGrabsAttention}
                            </p>
                            <div className="mt-0.5 flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                {copy.photoAnalysis.actionOne}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                {copy.photoAnalysis.actionTwo}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                {copy.photoAnalysis.actionThree}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-amber-700">
                              {copy.photoAnalysis.whatIsMissing}
                            </p>
                            <div className="mt-0.5 flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                Terrasse
                              </span>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                Rooftop
                              </span>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                Bassin
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-1.5 md:mt-0 md:flex-1 md:max-w-[42%]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {copy.photoAnalysis.conversionImpact}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-4 text-slate-600">
                          {copy.photoAnalysis.visualImpactText}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100/70 bg-gradient-to-r from-white/95 via-white/85 to-white/0 px-3.5 py-1.5 text-[10px] text-slate-600 backdrop-blur-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {copy.photoAnalysis.visibleFirst}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                        {copy.photoAnalysis.actionOne}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                        {copy.photoAnalysis.actionTwo}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                        {copy.photoAnalysis.actionThree}
                      </span>
                    </div>
                    <span className="hidden text-[10px] text-slate-400 sm:inline">
                      {copy.photoAnalysis.terraceSecondPlane}
                    </span>
                  </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 nk-card-sm">
                    <div className="relative pl-4">
                      <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {copy.photoAnalysis.visualImpactTitle}
                      </p>
                      <p className="text-sm leading-6 text-slate-700">
                        {copy.photoAnalysis.visualImpactText}
                      </p>
                      <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-amber-700">
                        <span className="h-4 w-1 rounded bg-amber-500" />
                        <span>{copy.photoAnalysis.directConsequence}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Colonne droite : cartes d’analyse */}
                <div className="space-y-3 text-xs text-slate-700">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 nk-card-sm">
                    <div className="relative pl-4">
                      <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {copy.photoAnalysis.messageClarityTitle}
                        </p>
                        <span className="text-[11px] font-semibold nk-text-muted">
                          {copy.photoAnalysis.highPriority}
                        </span>
                      </div>
                      <p className="mt-1 text-[15px] leading-7 text-slate-800">
                        {copy.photoAnalysis.messageClarityText}
                      </p>
                      <p className="mt-3 inline-flex items-start gap-2 text-[13px] font-medium text-sky-700">
                        <span className="h-4 w-1 rounded bg-sky-500" />
                        <span>{copy.photoAnalysis.observedImpact}</span>
                      </p>
                      <p className="mt-2 text-xs font-medium nk-text-muted">
                        {copy.photoAnalysis.threePriorityActions}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* After optimization projection */}
        <MobileCenteredBlock>
        <section className="relative rounded-[28px] nk-border bg-[radial-gradient(circle_at_0_0,rgba(16,185,129,0.10),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.08),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(241,245,249,0.99)_100%)] p-5 md:p-7 nk-card-lg ring-1 ring-emerald-50/80">
          <SectionLabel className="text-slate-600">
            {copy.afterOptimization.eyebrow}
          </SectionLabel>
          <SectionTitle className="mt-1 text-[22px] md:text-[24px] leading-[1.15] tracking-[-0.03em] text-slate-950">
            {copy.afterOptimization.title}
          </SectionTitle>

          <div className="mt-6 grid gap-6 md:grid-cols-2 md:items-start">
            {/* Colonne gauche : visuel amélioré */}
            <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(240,253,250,0.96)_100%)] p-4 md:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  {copy.afterOptimization.badge}
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                  {copy.afterOptimization.terraceVisible}
                </span>
              </div>

              <div className="mt-4 relative h-40 w-full overflow-hidden rounded-2xl border border-emerald-200 bg-[radial-gradient(circle_at_0_0,rgba(16,185,129,0.16),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.22),transparent_55%)] sm:h-48">
                <div className="absolute inset-3 rounded-2xl border border-white/40 bg-[radial-gradient(circle_at_20%_0,rgba(248,250,252,0.98),transparent_52%),radial-gradient(circle_at_85%_100%,rgba(16,185,129,0.18),transparent_60%)] shadow-[0_18px_56px_rgba(15,23,42,0.10)]" />
                <div className="absolute inset-x-6 bottom-6 h-16 rounded-2xl border border-emerald-50 bg-white/98 px-3 py-2 text-[11px] text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-md flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {copy.afterOptimization.firstImpression}
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold leading-5 tracking-[-0.01em] text-emerald-900">
                      {copy.afterOptimization.firstImpressionText}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {copy.afterOptimization.mainAssetVisible}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {copy.afterOptimization.expectedCtr}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[13px] leading-6 text-slate-800">
                {copy.afterOptimization.visualNowHighlights}
              </p>
            </div>

            {/* Colonne droite : KPIs après optimisation */}
            <div className="space-y-3 text-sm text-slate-700">
              <KpiGrid density="compact">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 nk-card-sm">
                  <div className="relative pl-4">
                    <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
                    <SectionLabel>
                      {copy.afterOptimization.performanceLevel}
                    </SectionLabel>
                    <p className="mt-1 text-[13px] font-semibold leading-6 text-slate-800">
                      {copy.afterOptimization.strengthenedPerformance}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3 nk-card-sm">
                  <div className="relative pl-4">
                    <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
                    <SectionLabel>
                      {copy.afterOptimization.conversionPotential}
                    </SectionLabel>
                    <p className="mt-1 text-[13px] font-medium leading-6 text-slate-800">
                      {copy.afterOptimization.strong}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-300 bg-[linear-gradient(135deg,rgba(16,185,129,0.06),rgba(16,185,129,0.18))] p-3 nk-card-highlight ring-1 ring-emerald-300/70">
                  <div className="relative pl-4">
                    <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                    <SectionLabel className="text-emerald-700">
                      {copy.afterOptimization.resultAfterOptimization}
                    </SectionLabel>
                    <p className="mt-1 text-[13px] font-semibold leading-6 text-emerald-950">
                      {copy.afterOptimization.measurableBookingImprovement}
                    </p>
                  </div>
                </div>
              </KpiGrid>

              <div className="rounded-2xl border border-slate-100/90 bg-white/98 p-4 text-[13px] leading-6 text-slate-600 nk-card-sm ring-1 ring-emerald-50/80">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
                  <SectionLabel className="text-slate-600">
                    {copy.afterOptimization.prioritizedActionPlan}
                  </SectionLabel>
                  <p className="mt-1">
                    <span className="font-medium text-slate-700">
                      {copy.afterOptimization.blockersAddressedLead}
                    </span>{" "}
                    <span className="text-slate-700">
                      {copy.afterOptimization.blockersAddressedText}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        </MobileCenteredBlock>

      </section>

      {/* Key insights */}
      <section className="rounded-[28px] nk-border bg-gradient-to-br from-white via-slate-50/80 to-white px-5 py-7 md:p-7 nk-card-lg ring-1 ring-white/60">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">
          {copy.conversionLevers.eyebrow}
        </p>
        <p className="mt-2 max-w-2xl text-[14px] leading-7 text-slate-600 md:text-[15px]">
          {copy.conversionLevers.intro}
        </p>
        <div className="relative mt-8 grid gap-6 text-sm text-slate-700 md:grid-cols-2">
          <div className="hidden lg:block absolute top-10 bottom-10 left-1/2 w-[1px] bg-gradient-to-b from-transparent via-slate-300/60 to-transparent" />
          <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-sky-200/70 bg-sky-50/35 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] ring-1 ring-sky-50/70 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md">
            <div className="relative flex h-full flex-col justify-between pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.conversionLevers.listingTitleTitle}
                </p>
                <p className="mt-2 text-[15px] leading-7 font-semibold text-slate-900 transition-colors group-hover:text-slate-900">
                  {copy.conversionLevers.listingTitleText}
                </p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  {copy.conversionLevers.listingTitleHint}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
                  {copy.conversionLevers.strengthen}
                </span>
                <span>{copy.conversionLevers.directPositioningImpact}</span>
              </div>
            </div>
          </div>
          <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/35 bg-gradient-to-r from-amber-50/50 via-amber-50/20 to-transparent p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] ring-1 ring-amber-50/80 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-lg">
            <div className="relative flex h-full flex-col justify-between pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.conversionLevers.photoOrderTitle}
                </p>
                <p className="mt-2 text-[15px] leading-7 font-semibold text-slate-900 transition-colors group-hover:text-slate-900">
                  {copy.conversionLevers.photoOrderText}
                </p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  {copy.conversionLevers.photoOrderHint}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                  {copy.conversionLevers.highPriority}
                </span>
                <span>{copy.conversionLevers.immediateClickImpact}</span>
              </div>
            </div>
          </div>
          <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-emerald-200/75 bg-emerald-50/35 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] ring-1 ring-emerald-50/70 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md">
            <div className="relative flex h-full flex-col justify-between pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.conversionLevers.amenitiesVsCompetitorsTitle}
                </p>
                <p className="mt-2 text-[15px] leading-7 font-semibold text-slate-900 transition-colors group-hover:text-slate-900">
                  {copy.conversionLevers.amenitiesVsCompetitorsText}
                </p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  {copy.conversionLevers.amenitiesVsCompetitorsHint}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                  {copy.conversionLevers.marketSignal}
                </span>
                <span>{copy.conversionLevers.perceivedValueImpact}</span>
              </div>
            </div>
          </div>
          <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/55 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] ring-1 ring-amber-50/75 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md">
            <div className="relative flex h-full flex-col justify-between pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-slate-400/55" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.conversionLevers.descriptionIntroTitle}
                </p>
                <p className="mt-2 text-[15px] leading-7 font-semibold text-slate-900 transition-colors group-hover:text-slate-900">
                  {copy.conversionLevers.descriptionIntroText}
                </p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  {copy.conversionLevers.descriptionIntroHint}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                  {copy.conversionLevers.toFix}
                </span>
                <span>{copy.conversionLevers.finalDecisionImpact}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col gap-4 rounded-[28px] nk-border bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-5 md:flex-row md:items-center md:justify-between md:p-7 nk-card-lg">
        <div className="max-w-xl">
          <SectionTitle className="text-[22px] md:text-[26px] leading-tight text-slate-900">
            {copy.finalCta.title}
          </SectionTitle>
          <SectionDescription className="mt-3 text-[14px] leading-7 text-slate-600 md:text-[15px]">
            {copy.finalCta.text}
          </SectionDescription>
        </div>
        <div className="flex flex-wrap items-center gap-4 md:justify-end">
          <Link
            href="/sign-in?next=/audit/new"
            className="rounded-2xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105"
          >
            {copy.finalCta.primary}
          </Link>
          <Link
            href="/sign-up"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50"
          >
            {copy.finalCta.secondary}
          </Link>
        </div>
      </section>
      </main>
    </MarketingPageShell>
  );
}
