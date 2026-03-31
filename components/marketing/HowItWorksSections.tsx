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
  primaryActionLabel = "Lancer un audit gratuit (sans inscription)",
  primaryActionHref = "/audit/new",
  onPrimaryAction,
}: HowItWorksSectionsProps) {
  return (
    <div className="space-y-16 md:space-y-20">
      <section
        id={includeAnchorId ? "how-it-works" : undefined}
        className="nk-card p-6"
      >
        <p className="nk-section-title">La solution</p>
        <h2 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
          Un audit de conversion complet qui révèle ce qui bloque vos réservations.
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-slate-700">
          Listing Conversion Optimizer analyse votre annonce comme le ferait un
          excellent opérateur, mais avec des données. Chaque élément qui influence
          la conversion est évalué et synthétisé dans un rapport clair.
        </p>
        <div className="mt-4 grid gap-4 text-sm text-slate-800 sm:grid-cols-4">
          <div>
            <p className="font-semibold text-slate-900">Score de conversion</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Un score global sur 10 pour comprendre immédiatement votre niveau de performance.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Comparaison concurrentielle</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Comprenez comment vous vous situez face aux annonces similaires qui ciblent les mêmes voyageurs.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Recommandations d’optimisation</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Une checklist priorisée sur les photos, le texte, les équipements et la réassurance.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Estimation d’impact revenu</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Une projection de gain en réservations et en revenus après mise en œuvre.
            </p>
          </div>
        </div>
      </section>

      <section className="nk-card p-6">
        <p className="nk-section-title">Fonctionnalités</p>
        <div className="mt-4 grid gap-4 text-sm text-slate-800 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">Score de conversion</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Un score clair de 0 à 10 avec détails par catégorie pour savoir où agir en priorité.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">Benchmark concurrentiel</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Visualisez votre position sur les photos, la description, les équipements et le prix face aux annonces voisines.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">Indice qualité annonce</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Un indicateur de 0 à 100 qui combine qualité, compétitivité et potentiel de conversion.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">Suggestions IA</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Obtenez des idées prêtes à l’emploi pour le texte, l’ordre des photos et les équipements.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">Estimateur d’impact revenu</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Mesurez le potentiel de gain mensuel afin de prioriser les bonnes annonces.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">Pensé pour les portefeuilles</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Conçu pour gérer plusieurs annonces et comparer la performance à l’échelle du portefeuille.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="nk-card p-6">
          <p className="nk-section-title">Aperçu produit</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
            Un rapport structuré, pensé pour les opérateurs.
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            Au lieu d’un simple bloc de texte, vous obtenez une vue structurée :
            score de conversion, indice qualité annonce, recommandations prioritaires
            et estimation d’impact revenu, le tout au même endroit.
          </p>
          <ul className="mt-4 space-y-2 text-[13px] leading-6 text-slate-700">
            <li>• Résumé exécutif avec score global et indice qualité annonce.</li>
            <li>• Analyse détaillée : photos, description, équipements, réassurance.</li>
            <li>• Actions concrètes à appliquer immédiatement dans votre OTA.</li>
          </ul>
        </div>

        <div className="nk-card space-y-3 bg-slate-50 p-5">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Score global de conversion
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">
                7.2<span className="text-sm text-emerald-500"> / 10</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Au-dessus de la moyenne du marché</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Indice qualité annonce
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                82<span className="text-sm text-slate-500"> / 100</span>
              </p>
              <p className="mt-1 text-[11px] text-emerald-600">Très bon niveau</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Actions recommandées
              </p>
              <ul className="mt-3 space-y-1.5 text-[12px] leading-5 text-slate-800">
                <li>• Placer la photo du salon en première position.</li>
                <li>• Ajouter “idéal pour le télétravail” dans le titre.</li>
                <li>• Mettre en avant la remise hebdomadaire et le check-in flexible.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Impact revenu
              </p>
              <p className="mt-2 text-xl font-semibold text-emerald-800">
                +€340 to +€540 / month
              </p>
              <p className="mt-1 text-[11px] text-emerald-700">
                Estimation basée sur des annonces comparables optimisées dans cette zone.
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

      <section className="nk-card flex flex-col gap-4 bg-slate-900 px-6 py-7 text-white md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold md:text-2xl">
            Analysez votre annonce dès maintenant.
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-200">
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
