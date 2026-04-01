"use client";

import Link from "next/link";
import { pricingPlans } from "@/lib/billing/pricingPlans";

type HowItWorksSectionsProps = {
  includeAnchorId?: boolean;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  onPrimaryAction?: () => void;
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
        className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
      >
        {label}
      </button>
    );
  }

  return (
    <Link
      href={href ?? "/audit/new"}
      className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
    >
      {label}
    </Link>
  );
}

export function HowItWorksSections({
  includeAnchorId = false,
  primaryActionLabel = "Démarrer votre premier audit",
  primaryActionHref = "/audit/new",
  onPrimaryAction,
}: HowItWorksSectionsProps) {
  return (
    <div className="space-y-16 md:space-y-20">
      <section
        id={includeAnchorId ? "how-it-works" : undefined}
        className="nk-card nk-card-hover grid gap-6 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.05fr)] md:p-7"
      >
        <div className="flex flex-col justify-between gap-6">
          <div className="max-w-xl space-y-3.5 md:space-y-4">
            <p className="nk-section-title">La solution</p>
            <h2 className="text-balance text-[1.85rem] font-semibold leading-tight tracking-tight text-slate-950 md:text-[2.25rem] lg:text-[2.4rem]">
              Un audit de conversion complet
              <br className="hidden md:block" />
              qui révèle ce qui bloque vos réservations.
            </h2>
            <p className="mt-1.5 text-[13px] font-medium text-emerald-600">
              Identifiez en quelques minutes les freins majeurs à vos réservations et le
              potentiel de gain associé.
            </p>
            <p className="mt-2 text-[14px] leading-7 text-slate-600">
              Listing Conversion Optimizer analyse votre annonce comme le ferait un
              excellent opérateur, mais avec des données. Chaque élément qui influence
              la conversion est évalué et synthétisé dans un rapport clair.
            </p>
          </div>

          <div className="mt-4 space-y-3 text-[13px] leading-6 text-slate-700">
            {/* Bloc scores */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_14px_40px_rgba(15,23,42,0.1)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Score de conversion
                </p>
                <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-slate-950">
                  Score <span className="text-[18px] text-slate-500">/ 10</span>
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Vision immédiate de votre niveau de performance global.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_14px_40px_rgba(15,23,42,0.1)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Indice qualité annonce
                </p>
                <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-slate-950">
                  Indice <span className="text-[18px] text-slate-500">/ 100</span>
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Lecture synthétique de la qualité et du potentiel de l’annonce.
                </p>
              </div>
            </div>

            {/* Bloc recommandations */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recommandations prioritaires
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Actions concrètes à appliquer</p>
              <ul className="mt-2 space-y-2 text-[13px] leading-6 text-slate-700">
                <li>• Réordonner les photos pour mettre les points forts en avant.</li>
                <li>• Clarifier la promesse et les bénéfices clés dès le titre.</li>
                <li>• Rendre la réassurance (avis, garanties, équipements) plus visible.</li>
              </ul>
            </div>

            {/* Bloc impact */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-[13px] leading-6 text-emerald-900">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Impact estimé
              </p>
              <p className="mt-1 text-[23px] font-semibold tracking-tight text-emerald-900">
                +18 % de réservations potentielles
              </p>
              <p className="mt-1 text-[11px] text-emerald-700">
                Sur des annonces comparables déjà optimisées avec LCO, à titre indicatif.
              </p>
            </div>
          </div>
        </div>

        <div className="nk-card nk-card-hover flex flex-col gap-3.5 border-slate-700/70 bg-[linear-gradient(145deg,rgba(15,23,42,1),rgba(15,23,42,0.96))] p-5 text-slate-100 shadow-[0_20px_56px_rgba(15,23,42,0.6)]">
          <div className="flex items-center justify-between gap-3.5 border-b border-slate-800/80 pb-2.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                Aperçu d’audit
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-50">
                Lisbonne · 2 chambres avec balcon
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Rapport IA
            </span>
          </div>

          <div className="mt-2 grid gap-2.5 text-[12px] leading-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Score de conversion
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-400">
                6.4<span className="text-sm text-emerald-300"> / 10</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Comparé aux annonces similaires à proximité.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Indice qualité annonce
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-50">
                82<span className="text-sm text-slate-400"> / 100</span>
              </p>
              <p className="mt-1 text-[11px] text-emerald-300">Solide avec marge d’amélioration.</p>
            </div>
          </div>

          <div className="mt-2.5 rounded-2xl border border-slate-700/70 bg-slate-900/80 p-2.5">
            <div className="flex items-center justify-between gap-3.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Impact estimé
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">+18 % de potentiel de réservations</p>
              </div>
              <div className="h-9 w-24 overflow-hidden rounded-full bg-emerald-500/15">
                <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-300 to-sky-300" />
              </div>
            </div>
            <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
              Basé sur des annonces comparables déjà optimisées avec LCO.
            </p>
          </div>
        </div>
      </section>

      <section className="nk-card nk-card-hover rounded-[24px] border border-slate-200 bg-white/95 p-6 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:p-7">
        <p className="nk-section-title">Fonctionnalités</p>
        <div className="mt-5 grid gap-5 text-sm text-slate-800 md:grid-cols-3">
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
            <div>
              <p className="font-semibold text-slate-900">Score de conversion</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Un score clair de 0 à 10 avec détails par catégorie pour savoir où agir en priorité.
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
            <div>
              <p className="font-semibold text-slate-900">Benchmark concurrentiel</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Visualisez votre position sur les photos, la description, les équipements et le prix face aux annonces voisines.
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
            <div>
              <p className="font-semibold text-slate-900">Indice qualité annonce</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Un indicateur de 0 à 100 qui combine qualité, compétitivité et potentiel de conversion.
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
            <div>
              <p className="font-semibold text-slate-900">Suggestions IA</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Obtenez des idées prêtes à l’emploi pour le texte, l’ordre des photos et les équipements.
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
            <div>
              <p className="font-semibold text-slate-900">Estimateur d’impact revenu</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Mesurez le potentiel de gain mensuel afin de prioriser les bonnes annonces.
              </p>
            </div>
          </div>
          <div className="flex min-h-[150px] flex-col justify-between rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <div>
              <p className="font-semibold text-slate-900">Pensé pour les portefeuilles</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                Conçu pour gérer plusieurs annonces et comparer la performance à l’échelle du portefeuille.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="nk-card bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(226,232,240,0.96))] p-6 shadow-[0_20px_52px_rgba(15,23,42,0.12)]">
          <p className="nk-section-title">Avant / après optimisation</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
            Ce qui change concrètement avant et après un audit LCO.
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            Avant, la fiche est souvent confuse : promesse floue, réassurance peu visible,
            photos mal ordonnées. Après recommandations ciblées, l’annonce met en avant les
            bons arguments au bon endroit, ce qui facilite la décision du voyageur.
          </p>
          <ul className="mt-4 space-y-2 text-[13px] leading-6 text-slate-700">
            <li>• Avant : annonce peu lisible, signaux de confiance dispersés, conversion fragile.</li>
            <li>• Après : structure claire, bénéfices visibles, éléments rassurants mis en avant.</li>
            <li>• Objectif : transformer les visites existantes en réservations, sans bricoler au hasard.</li>
          </ul>
        </div>

        <div className="nk-card space-y-3 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(239,246,255,0.96))] p-5 shadow-[0_22px_56px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Vue rapide de l’annonce
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Barcelone · Loft design à Gràcia
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Audit prêt
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Avant optimisation */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-900/95 p-4 text-slate-100 shadow-[0_18px_40px_rgba(15,23,42,0.55)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Avant optimisation
              </p>
              <div className="flex gap-3">
                <div className="h-16 w-20 rounded-xl bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-4/5 rounded-full bg-slate-700" />
                  <div className="h-2.5 w-full rounded-full bg-slate-800" />
                  <div className="h-2.5 w-3/5 rounded-full bg-slate-800" />
                </div>
              </div>
              <div className="mt-2 space-y-1.5 text-[11px] leading-5 text-slate-200/90">
                <p>• Promesse floue, message d’ouverture générique.</p>
                <p>• Peu de signaux de confiance visibles.</p>
                <p>• Les points forts ne ressortent pas dans les premières secondes.</p>
              </div>
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-rose-300/90">
                Lecture rapide : risque de conversion faible
              </p>
            </div>

            {/* Après recommandations */}
            <div className="space-y-3 rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-emerald-100 to-white p-4 shadow-[0_22px_50px_rgba(16,185,129,0.35)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                Après recommandations ciblées
              </p>
              <div className="flex gap-3">
                <div className="h-16 w-20 rounded-xl bg-gradient-to-br from-emerald-200 to-emerald-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-4/5 rounded-full bg-emerald-300" />
                  <div className="h-2.5 w-full rounded-full bg-emerald-100" />
                  <div className="h-2.5 w-3/5 rounded-full bg-emerald-100" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Score global
                  </p>
                  <p className="mt-1 text-xl font-semibold text-emerald-700">7.2 / 10</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Position plus claire sur le marché.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Indice qualité
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">82 / 100</p>
                  <p className="mt-0.5 text-[10px] text-emerald-600">Annonce perçue comme solide.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 text-[11px] leading-5 text-slate-800">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Extrait de plan d’action
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  <li>1. Réorganiser les 5 premières photos autour du principal point fort.</li>
                  <li>2. Clarifier la promesse dans les deux premières lignes du texte.</li>
                  <li>3. Mettre en avant 3 éléments de réassurance concrets.</li>
                </ul>
              </div>

              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-800">
                Objectif : transformer plus de visites en réservations
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="nk-card p-6">
        <p className="nk-section-title">Pour qui ?</p>
        <div className="mt-4 grid gap-4 text-sm text-slate-800 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Hôtes Airbnb</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Optimisez votre annonce principale et arrêtez de laisser des réservations
              et du revenu sur la table.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Investisseurs immobiliers</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Validez le potentiel de revenu avant d’acheter, rénover ou repositionner
              un bien.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Property managers</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Identifiez rapidement quelles unités de votre portefeuille nécessitent
              une action prioritaire ce mois-ci.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Agences de location courte durée</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Transformez les audits de conversion en service premium pour vos propriétaires et partenaires.
            </p>
          </div>
        </div>
      </section>

      <section className="nk-card p-6">
        <p className="nk-section-title">Aperçu des offres</p>
        <div className="mt-4 grid gap-4 text-sm text-slate-800 md:grid-cols-3">
          {pricingPlans.map((plan) => {
            const isPro = plan.code === "pro";
            const displayName = plan.code === "free" ? "Starter" : plan.name;

            return (
              <div
                key={plan.code}
                className={
                  isPro
                    ? "rounded-2xl border border-orange-400/60 bg-orange-50 p-5 ring-1 ring-orange-400/50"
                    : "rounded-2xl border border-slate-200 bg-white p-5"
                }
              >
                <p
                  className={
                    isPro
                      ? "text-xs font-semibold uppercase tracking-[0.18em] text-orange-600"
                      : "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  }
                >
                  {displayName}
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{plan.audience}</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-700">{plan.description}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[13px] leading-6 text-slate-500">
          La tarification affichée ici est une préversion. Vous pourrez connecter Stripe
          lorsque vous serez prêt à facturer vos clients.
        </p>
      </section>

      <section className="nk-card flex flex-col gap-5 bg-slate-900 px-6 py-7 text-white md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl rounded-2xl border border-slate-700/70 bg-[radial-gradient(circle_at_0_0,rgba(148,163,184,0.28),transparent_55%),radial-gradient(circle_at_120%_120%,rgba(16,185,129,0.24),transparent_55%)] px-5 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.55)]">
          <h2 className="text-xl font-semibold text-white md:text-2xl">
            Analysez votre annonce dès maintenant.
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-100">
            Collez l’URL de votre annonce, lancez un audit complet et obtenez un plan
            d’action concret pour augmenter vos réservations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <PrimaryAction
            label={primaryActionLabel}
            href={primaryActionHref}
            onClick={onPrimaryAction}
          />
        </div>
      </section>
    </div>
  );
}
