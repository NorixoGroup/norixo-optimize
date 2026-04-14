"use client";

import Link from "next/link";

type HowItWorksSectionsProps = {
  includeAnchorId?: boolean;
  primaryActionLabel?: string;
  primaryActionHref?: string;
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
      href={href ?? "/audit/new"}
      className="nk-primary-btn w-full text-xs font-semibold uppercase tracking-[0.18em] sm:w-auto"
    >
      {label}
    </Link>
  );
}

export function HowItWorksSections({
  includeAnchorId = false,
  primaryActionLabel = "Lancer mon audit",
  primaryActionHref = "/audit/new",
  onPrimaryAction,
  showHeroPersuasionNote = false,
}: HowItWorksSectionsProps) {
  return (
    <div className="space-y-10 md:space-y-12">
      <section
        id={includeAnchorId ? "how-it-works" : undefined}
        className="nk-card nk-card-hover grid gap-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.05fr)] md:p-7"
      >
        <div className="flex flex-col justify-between gap-6">
          <div className="max-w-xl space-y-3.5 md:space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">SOLUTION</p>
            <h1 className="text-balance text-[2rem] font-extrabold leading-[0.95] tracking-tight bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 bg-clip-text text-transparent md:text-[2.8rem]">
              Un audit de conversion complet
              <span className="block">
                qui révèle ce qui bloque vos réservations.
              </span>
            </h1>
            <p className="mt-2 text-[14px] leading-7 text-slate-600">
              Identifiez en quelques secondes ce qui bloque vos réservations et corrigez-le avec des actions concrètes.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <PrimaryAction
                label={primaryActionLabel}
                href={primaryActionHref}
                onClick={onPrimaryAction}
              />
              <Link
                href="/demo"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50 sm:w-auto"
              >
                Voir la démo
              </Link>
            </div>
            <p className="text-xs text-gray-500">
              Aucun engagement • Résultats en moins de 30 secondes
            </p>
            <div className="text-xs text-gray-500">
              +2 000 annonces analysées • Résultats concrets mesurables
            </div>
          </div>

          <div className="mt-3 space-y-2.5 text-[13px] leading-6 text-slate-700">
            {/* Bloc scores */}
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white to-sky-50/70 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-sky-100/70">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Score de conversion
                  </p>
                  <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-slate-950">
                    Score <span className="text-[18px] text-slate-500">/ 10</span>
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500/80">
                    Lecture immédiate de votre niveau de performance.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/70 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-blue-100/70">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Indice qualité annonce
                  </p>
                  <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-slate-950">
                    Indice <span className="text-[18px] text-slate-500">/ 100</span>
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500/80">
                    Vue synthétique de la qualité perçue de l’annonce.
                  </p>
                </div>
              </div>
            </div>

            {/* Bloc recommandations */}
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/70 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.07)] ring-1 ring-amber-100/70">
              <div className="relative pl-4">
                <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  RECOMMANDATIONS PRIORITAIRES
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Actions concrètes à fort impact</p>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-6 text-slate-700/90">
                  <li>• Réordonner les photos pour mettre les points forts en premier.</li>
                  <li>• Clarifier la promesse dès le titre et les premières lignes.</li>
                  <li>• Renforcer la réassurance sur les éléments décisifs.</li>
                </ul>
              </div>
            </div>

            {/* Bloc impact */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-[13px] leading-6 text-emerald-900 shadow-[0_12px_30px_rgba(16,185,129,0.10)] ring-1 ring-emerald-300">
              <div className="relative pl-4">
                <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Impact estimé
                </p>
                <p className="mt-1 text-[23px] font-semibold tracking-tight text-emerald-900">
                  +18% à +32% de réservations potentielles
                </p>
                <p className="mt-1 text-[11px] text-emerald-700">
                  basé sur des annonces similaires optimisées
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            Collez votre annonce → obtenez vos recommandations immédiatement
          </div>
        </div>

        <div className="nk-card nk-card-hover flex flex-col gap-3.5 border-slate-200/80 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-5 text-slate-700 ring-2 ring-emerald-200/70 shadow-[0_30px_80px_rgba(16,185,129,0.15)] scale-[1.01]">
          <div className="flex items-center justify-between gap-3.5 border-b border-slate-200 pb-2.5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  APERÇU DU RAPPORT
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Lisbonne · 2 chambres avec balcon
              </p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Rapport IA
            </span>
          </div>

          <div className="mt-2 grid gap-2.5 text-[12px] leading-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
              <div className="relative pl-4">
                <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Score de conversion
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-600">
                  6.4<span className="text-sm text-emerald-500"> / 10</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Comparé aux annonces similaires à proximité.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
              <div className="relative pl-4">
                <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Indice qualité annonce
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  82<span className="text-sm text-slate-500"> / 100</span>
                </p>
                <p className="mt-1 text-[11px] text-emerald-700">Solide avec marge d’amélioration.</p>
              </div>
            </div>
          </div>

          <div className="mt-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-2.5 shadow-[0_10px_24px_rgba(16,185,129,0.14)] ring-1 ring-emerald-300">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
              <div className="flex items-center justify-between gap-3.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    IMPACT ESTIMÉ
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">+18% à +32% de potentiel de réservations</p>
                </div>
                <div className="h-9 w-24 overflow-hidden rounded-full bg-emerald-500/20">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-300 to-sky-300" />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-emerald-800/80">
                basé sur des annonces similaires optimisées
              </p>
            </div>
          </div>

          {showHeroPersuasionNote ? (
            <div className="mt-1 border-t border-slate-200/80 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Pourquoi cet audit fonctionne
              </p>
              <ul className="mt-2 space-y-1.5 pl-4 text-[12px] leading-5 text-slate-700">
                <li className="list-disc">Analyse des signaux visibles en quelques secondes</li>
                <li className="list-disc">Priorisation des actions à plus fort impact</li>
                <li className="list-disc">Basé sur des annonces réellement performantes</li>
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="nk-card nk-card-hover rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">FONCTIONNALITÉS</p>
        <div className="mt-5 grid gap-5 text-sm text-slate-800 md:grid-cols-3">
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-sky-200 bg-gradient-to-br from-white to-sky-50/70 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-sky-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
              <p className="font-semibold text-slate-900">Score de conversion</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Mesurez rapidement le niveau actuel de performance de chaque annonce.
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/70 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-blue-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
              <p className="font-semibold text-slate-900">Benchmark concurrentiel</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Positionnez votre annonce face aux offres comparables de votre zone.
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/70 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-indigo-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-indigo-400/70" />
              <p className="font-semibold text-slate-900">Indice qualité annonce</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Obtenez une vue consolidée de la qualité perçue de votre annonce.
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50/70 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-violet-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
              <p className="font-semibold text-slate-900">Suggestions IA</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Recevez des recommandations concrètes prêtes à être appliquées.
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/70 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-emerald-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
              <p className="font-semibold text-slate-900">Estimateur d’impact revenu</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Estimez le potentiel de revenu pour prioriser les actions utiles.
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-dashed border-amber-200 bg-gradient-to-br from-white to-amber-50/60 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-amber-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
              <p className="font-semibold text-slate-900">Pensé pour les portefeuilles</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Comparez vos annonces et concentrez vos efforts là où l’impact est réel.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="nk-card nk-card-hover rounded-[28px] border border-slate-200 bg-white p-5 md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">POUR QUI</p>
        <div className="mt-4 grid gap-4 text-sm text-slate-800 md:grid-cols-4">
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/60 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ring-1 ring-amber-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
              <p className="text-sm font-semibold text-slate-900">Hôtes indépendants</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Renforcez vos annonces clés et augmentez vos réservations sans complexité.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ring-1 ring-emerald-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
              <p className="text-sm font-semibold text-slate-900">Investisseurs</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Validez rapidement le potentiel de revenu avant d’arbitrer vos décisions.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white to-sky-50/60 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ring-1 ring-sky-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
              <p className="text-sm font-semibold text-slate-900">Property managers</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Priorisez les unités qui nécessitent une action immédiate.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50/60 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ring-1 ring-violet-100/70">
            <div className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
              <p className="text-sm font-semibold text-slate-900">Conciergeries</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Structurez une offre d’optimisation premium pour vos clients.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="nk-card flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] px-5 py-6 text-slate-900 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="max-w-xl rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">PASSER À L’ACTION</p>
          <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
            Prêt à passer de la lecture à l’action ?
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-600">
            Lancez votre premier audit et appliquez les priorités révélées par Norixo Optimize.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <PrimaryAction
            label={primaryActionLabel}
            href={primaryActionHref}
            onClick={onPrimaryAction}
          />
          <Link
            href="/demo"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50"
          >
            Voir la démo
          </Link>
        </div>
      </section>
    </div>
  );
}
