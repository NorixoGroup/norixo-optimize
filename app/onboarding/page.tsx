'use client';

import Link from "next/link";
import { useState } from "react";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default function OnboardingPage() {
  const [listingUrl, setListingUrl] = useState("");
  const hasUrl = listingUrl.trim().length > 0;
  return (
    <MarketingPageShell>
      <div className="relative min-h-screen">
        <div className="nk-dashboard-bg" />
        <main className="nk-section relative space-y-10 pb-14 pt-8 md:space-y-12 md:pb-16 md:pt-9">
        <div className="w-full">
          <div className="space-y-10 md:space-y-12">
            {/* 1. Bloc progression */}
            <section className="w-full rounded-[28px] border border-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.94)_100%)] p-5 text-slate-900 shadow-[0_16px_44px_rgba(15,23,42,0.09)] ring-1 ring-white/60 backdrop-blur-[6px] md:p-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1.5">
                  <p className="inline-flex items-center rounded-full border border-orange-100 bg-orange-50/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                    Progression
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-[22px]">
                    3 étapes pour obtenir un premier audit exploitable
                  </h2>
                </div>
                <p className="max-w-sm text-[13px] leading-7 text-slate-600">
                  Choisissez un logement, lancez l’analyse, puis explorez un rapport clair et actionnable.
                </p>
              </div>

              <div className="mt-6 relative">
                <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-slate-200/60 -z-10" />
                <div className="relative grid grid-cols-1 gap-5 text-[12px] text-slate-700 md:grid-cols-3">
                <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-[0_10px_35px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
                  <div className="relative pl-4">
                    <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
                    <p className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/80 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      Étape 1
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">Choisir le logement</p>
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-600">
                    Sélectionnez l’annonce sur laquelle vous voulez un diagnostic précis.
                  </p>
                </div>
                <div className="flex h-full flex-col justify-between rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-[0_10px_35px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
                  <div className="relative pl-4">
                    <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
                    <p className="inline-flex items-center rounded-full border border-blue-200/50 bg-blue-50/80 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                      Étape 2
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">Lancer l’analyse</p>
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-600">
                    Collez l’URL de votre annonce et laissez l’IA analyser la page.
                  </p>
                </div>
                <div className="flex h-full flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-[0_10px_35px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
                  <div className="relative pl-4">
                    <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                    <p className="inline-flex items-center rounded-full border border-emerald-200/50 bg-emerald-50/80 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Étape 3
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">Explorer le rapport</p>
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-600">
                    Parcourez le rapport, les priorités et l’impact estimé sur vos réservations.
                  </p>
                </div>
                </div>
              </div>
            </section>

            {/* 2. Hero principal avec aperçu d’audit */}
            <section className="nk-card nk-card-hover w-full rounded-[28px] border border-white/50 bg-[radial-gradient(circle_at_top_left,rgba(248,250,252,0.9),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-5 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur-[6px] md:p-7">
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
                  {/* Colonne gauche hero */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                        LCO by NkriDari
                      </p>
                      <h1 className="text-balance text-[2rem] font-extrabold leading-[0.95] tracking-tight bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 bg-clip-text text-transparent md:text-[2.8rem]">
                        Optimisez votre annonce Airbnb
                        <span className="block">
                          comme un professionnel.
                        </span>
                      </h1>
                      <p className="max-w-2xl text-[16px] leading-8 text-slate-600 md:text-[18px]">
                        Identifiez en quelques minutes ce qui freine vos réservations et obtenez un plan d’action concret pour
                        améliorer vos performances.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href="/audit/new"
                        className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_14px_34px_rgba(249,115,22,0.22)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-orange-400"
                      >
                        Commencer en 30 secondes
                      </Link>
                    </div>

                    <div className="grid gap-4 text-[13px] text-slate-600 sm:grid-cols-3 sm:items-stretch">
                      <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/40 bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(255,249,243,0.96)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_30px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_20px_40px_rgba(15,23,42,0.12)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-8 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.75),transparent)] before:opacity-90">
                        <div className="relative pl-4">
                          <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Conçu pour
                          </p>
                          <p className="mt-2 text-[12px] leading-5 text-slate-600">
                            Les hôtes, investisseurs et gestionnaires qui veulent plus de réservations, pas seulement des
                            métriques flatteuses.
                          </p>
                        </div>
                      </div>
                      <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/40 bg-[linear-gradient(180deg,rgba(240,253,244,1)_0%,rgba(236,253,245,0.9)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_34px_rgba(16,185,129,0.20)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_22px_44px_rgba(16,185,129,0.26)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-8 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.8),transparent)] before:opacity-95">
                        <div className="relative pl-4">
                          <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Résultat
                          </p>
                          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-emerald-600 drop-shadow-[0_2px_6px_rgba(16,185,129,0.25)]">+18% à +32%</p>
                          <p className="mt-1 text-[12px] leading-5 text-slate-600">
                            Hausse moyenne des réservations après application des recommandations les plus impactantes.
                          </p>
                        </div>
                      </div>
                      <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/40 bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(239,246,255,0.96)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_30px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_20px_40px_rgba(15,23,42,0.12)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-8 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.75),transparent)] before:opacity-90">
                        <div className="relative pl-4">
                          <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Mise en route
                          </p>
                          <p className="mt-2 text-[12px] leading-5 text-slate-600">
                            Collez une URL, obtenez un audit complet et un plan d’optimisation en quelques minutes.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Colonne droite aperçu d’audit */}
                  <div className="flex flex-col gap-4 rounded-2xl border border-white/40 bg-[radial-gradient(circle_at_top,rgba(248,250,252,0.95),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-4 text-[13px] text-slate-700 shadow-[0_18px_46px_rgba(15,23,42,0.09)]">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Aperçu d’audit
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          Lisbonne · 2 chambres avec balcon
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-white/15 bg-slate-950/95 px-3.5 py-[5px] text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-50 shadow-[0_10px_26px_rgba(15,23,42,0.55)]">
                        Rapport IA
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                      <div className="rounded-2xl border border-white/40 bg-[linear-gradient(180deg,rgba(239,246,255,1)_0%,rgba(248,250,252,0.95)_100%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_34px_rgba(15,23,42,0.09)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_22px_44px_rgba(15,23,42,0.14)]">
                        <div className="relative pl-4">
                          <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
                          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500/90">
                            Score de conversion
                          </p>
                          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-slate-950">
                            6,4 / 10
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-600">
                            Potentiel important si vous ajustez le positionnement et le contenu.
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/40 bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.92)_100%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_30px_rgba(15,23,42,0.085)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                        <div className="relative pl-4">
                          <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
                          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500/90">
                            Indice qualité annonce
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-slate-950">78 / 100</p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-600">
                            Très bon socle, mais des points bloquants sur les photos et le texte.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_30px_rgba(15,23,42,0.085)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                      <div className="relative pl-4">
                        <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500/90">
                          Recommandations prioritaires
                        </p>
                        <ul className="space-y-1 text-[12px] leading-5 text-slate-600/95">
                          <li>• Clarifier la promesse principale dans le titre et la description courte.</li>
                          <li>• Réorganiser la galerie pour mettre en avant les atouts différenciants.</li>
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/40 bg-[linear-gradient(180deg,rgba(236,253,245,0.98)_0%,rgba(220,252,231,0.92)_100%)] p-3.5 text-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_34px_rgba(16,185,129,0.20)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_22px_44px_rgba(16,185,129,0.28)]">
                      <div className="relative pl-4">
                        <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700">
                          Impact revenu estimé
                        </p>
                        <p className="mt-2 text-[13px] font-semibold tracking-[-0.04em] text-emerald-900 drop-shadow-[0_2px_6px_rgba(16,185,129,0.25)]">
                          +14–22&nbsp;% de revenus potentiels sur 12 mois
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-emerald-800/90">
                          Estimation basée sur des annonces comparables optimisées dans votre zone.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

      {/* 3. Bloc formulaire / CTA principal */}
      <section className="nk-card w-full rounded-[28px] border border-white/50 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,1),rgba(248,250,252,0.9)_60%),linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,250,252,0.95)_100%)] p-5 text-slate-900 shadow-[0_24px_62px_rgba(15,23,42,0.11)] md:p-7">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_420px]">
      {/* Colonne gauche : bloc conversion */}
      <div className="flex flex-col justify-between space-y-5">
        <div className="rounded-2xl border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.12),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500">
            Audit conversion
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
            Optimisez votre annonce en quelques minutes.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
            Identifiez ce qui bloque vos réservations et découvrez exactement quoi améliorer pour générer plus de revenus.
          </p>
          <div className="mt-3 space-y-1.5 text-[12px] leading-5 text-slate-500">
            <p>
              <span className="font-semibold text-slate-700">Avant optimisation</span>
              {" "}
              Score : 5.8 · Peu de clics
            </p>
            <p>
              <span className="font-semibold text-emerald-700">Après optimisation</span>
              {" "}
              Score : 8.4 · +18% à +32% de réservations
            </p>
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] leading-6 text-slate-600">
            <li>✔ Identifiez ce qui bloque vos réservations</li>
            <li>✔ Recevez des recommandations concrètes</li>
            <li>✔ Augmentez votre revenu rapidement</li>
          </ul>
          <div className="mt-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700 shadow-[0_10px_24px_rgba(16,185,129,0.12)]">
            +18% à +32% de réservations en moyenne
          </div>
          <div className="mt-5">
            <Link
              href="/audit/new"
              className="inline-flex h-[3.7rem] w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f97316,#fb923c)] text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_12px_30px_rgba(249,115,22,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_16px_40px_rgba(249,115,22,0.34)]"
            >
              Lancer mon audit
            </Link>
            <p className="mt-2 text-[12px] text-slate-500">
              Analyse en quelques secondes, sans configuration
            </p>
          </div>
        </div>
      </div>

      {/* Colonne droite : aperçu instantané */}
      <div
        className={
          "flex h-full flex-col rounded-[28px] border text-[13px] text-slate-800 backdrop-blur-[4px] shadow-[0_24px_60px_rgba(15,23,42,0.12)] transition-all duration-200 " +
          (hasUrl
            ? "border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(240,253,250,1),rgba(248,250,252,0.96)_55%),linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(240,253,250,0.98)_100%)] p-5"
            : "border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,1),rgba(248,250,252,0.92)_60%),linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,250,252,0.96)_100%)] p-5")
        }
      >
        {/* Header apercu */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              APERÇU INSTANTANÉ
            </p>
            <h3 className="text-[15px] font-semibold text-slate-900">
              Ce que l’audit va révéler
            </h3>
          </div>
          <span
            className={
              (hasUrl
                ? "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,0.05)]"
                : "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 shadow-[0_0_0_1px_rgba(15,23,42,0.02)]")
            }
          >
            {hasUrl ? "Prêt à analyser" : "En attente"}
          </span>
        </div>
        <p className="mt-3 text-[13px] leading-6 text-slate-600">
          {hasUrl
            ? "Nous préparons une première lecture de votre annonce à partir de l’URL renseignée."
            : "Collez une URL Airbnb, Booking ou Vrbo pour voir l’aperçu de votre audit."}
        </p>

        <div className="mt-5 space-y-5">
          {/* Score card */}
          <div className="rounded-2xl border border-sky-200 bg-[linear-gradient(180deg,rgba(239,246,255,1)_0%,rgba(248,250,252,1)_100%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_26px_rgba(15,23,42,0.05)]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Score potentiel
                </p>
                <p className="text-xs font-medium text-slate-500">
                  Avant optimisation
                </p>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="text-3xl font-semibold tracking-[-0.03em] text-slate-900">
                  {hasUrl ? "6.4 / 10" : "--"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {hasUrl ? "Lecture automatique de la page" : "Score affiché après détection"}
                </p>
              </div>
            </div>
          </div>

          {/* Benchmark card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_12px_32px_rgba(15,23,42,0.1)]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                Benchmark local
              </p>
              <p className="mt-1.5 text-[13px] leading-6 text-slate-600">
                {hasUrl
                  ? "Comparaison avec des annonces similaires autour de vous."
                  : "Comparaison avec des annonces similaires en attente de votre URL."}
              </p>
            </div>
          </div>

          {/* Recommandations card */}
          <div className="rounded-2xl border border-white/45 bg-slate-50/90 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_26px_rgba(15,23,42,0.05)]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                Recommandations prioritaires
              </p>
              <div className="mt-2 space-y-1.5">
                {hasUrl ? (
                  <>
                    <p className="text-[13px] leading-5 text-slate-700">
                      • Clarifier la promesse dans le titre
                    </p>
                    <p className="text-[13px] leading-5 text-slate-700">
                      • Réorganiser la galerie photos
                    </p>
                    <p className="text-[13px] leading-5 text-slate-700">
                      • Renforcer les éléments de réassurance
                    </p>
                  </>
                ) : (
                  <div className="space-y-1.5 animate-pulse">
                    <div className="h-2.5 w-3/4 rounded-full bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />
                    <div className="h-2.5 w-4/5 rounded-full bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />
                    <div className="h-2.5 w-2/3 rounded-full bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Impact card */}
          <div className="rounded-2xl border border-emerald-200/60 bg-[linear-gradient(180deg,rgba(236,253,245,0.9)_0%,rgba(220,252,231,0.7)_100%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_30px_rgba(16,185,129,0.18)]">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                  Impact estimé
                </p>
                <p className="text-[11px] font-medium text-emerald-700">
                  {hasUrl ? "Annonce détectée" : "En attente d’une annonce"}
                </p>
              </div>
              <p className="mt-1.5 text-[13px] leading-6 text-emerald-700">
                {hasUrl
                  ? "+18% à +32% de potentiel après optimisation (projection indicative)."
                  : "L’impact estimé s’affichera dès que nous aurons une annonce à analyser."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
      </section>
          </div>
        </div>
        </main>
      </div>
    </MarketingPageShell>
  );
}
