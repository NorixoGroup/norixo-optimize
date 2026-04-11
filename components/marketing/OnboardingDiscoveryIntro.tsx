"use client";

type OnboardingDiscoveryIntroProps = {
  onStartAudit: () => void;
};

export function OnboardingDiscoveryIntro({
  onStartAudit,
}: OnboardingDiscoveryIntroProps) {
  return (
    <div className="space-y-16 md:space-y-20">
      <section className="grid gap-10 rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_22px_80px_rgba(15,23,42,0.08)] md:grid-cols-[minmax(0,1.6fr)_minmax(0,420px)] md:p-10">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="nk-kicker-muted">LCO by NkriDari</p>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Optimisez votre annonce Airbnb
              <span className="block bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500 bg-clip-text text-transparent">
                comme un professionnel.
              </span>
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-slate-700">
              Obtenez un audit complet de conversion de votre annonce et identifiez
              précisément ce qui freine vos réservations : photos peu engageantes,
              manque de réassurance, mauvais positionnement ou tarification mal ajustée.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onStartAudit}
              className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
            >
              Démarrer votre premier audit
            </button>
            <a
              href="#onboarding-discovery-problem"
              className="nk-ghost-btn text-xs font-semibold uppercase tracking-[0.18em]"
            >
              Voir comment ça marche
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="nk-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Conçu pour
              </p>
              <p className="mt-3 text-sm font-medium text-slate-900">
                Les hôtes, investisseurs et gestionnaires qui veulent plus de
                réservations, pas seulement des métriques flatteuses.
              </p>
            </div>
            <div className="nk-card p-5 ring-1 ring-orange-400/40">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                Résultat
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">+18% à +32%</p>
              <p className="mt-1 text-xs text-slate-600">
                Hausse moyenne des réservations après application des recommandations
                les plus impactantes.
              </p>
            </div>
            <div className="nk-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Mise en route
              </p>
              <p className="mt-3 text-sm font-medium text-slate-900">
                Collez une URL, obtenez un audit complet et un plan d’optimisation
                en quelques minutes.
              </p>
            </div>
          </div>
        </div>

        <aside className="nk-card flex flex-col justify-between bg-slate-50 p-6">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Aperçu d’audit
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Lisbonne · 2 chambres avec balcon
                </p>
              </div>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Rapport IA
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Score de conversion
                </p>
                <p className="mt-2 text-3xl font-semibold text-emerald-600">
                  6.4<span className="text-base text-emerald-500"> / 10</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Comparé aux annonces similaires à proximité.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Indice qualité annonce
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  78<span className="text-sm text-slate-500"> / 100</span>
                </p>
                <p className="mt-1 text-[11px] text-emerald-600">Compétitif avec potentiel</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recommandations prioritaires
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-800">
                <li>Réorganiser les photos pour mettre en avant la terrasse et la vue.</li>
                <li>Réécrire le paragraphe d’ouverture avec plus de réassurance.</li>
                <li>Ajouter les équipements attendus à ce niveau de prix.</li>
              </ul>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50 px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Impact revenu estimé
                </p>
                <p className="mt-1 text-sm font-medium text-emerald-800">
                  +€280 to +€620 / month
                </p>
              </div>
              <span className="text-[11px] text-emerald-700">
                Basé sur des annonces optimisées similaires.
              </span>
            </div>
          </div>
        </aside>
      </section>

      <section
        id="onboarding-discovery-problem"
        className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
      >
        <div className="nk-card p-6">
          <p className="nk-section-title">Le problème</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
            Votre annonce génère des vues, mais pas assez de réservations.
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            La plupart des hôtes ne savent pas exactement pourquoi une annonce
            sous-performe. Vous ajustez le prix, changez quelques photos ou ajoutez
            une phrase dans la description, mais cela reste souvent de l’intuition.
          </p>
          <ul className="mt-4 space-y-2 text-[13px] leading-6 text-slate-700">
            <li>• Difficile de voir comment vous vous positionnez face aux concurrents proches.</li>
            <li>• Aucun lien clair entre les changements effectués et les réservations obtenues.</li>
            <li>• Peu de visibilité sur l’annonce à optimiser en priorité dans votre portefeuille.</li>
          </ul>
        </div>

        <div className="nk-card grid gap-3 p-5 text-sm text-slate-800 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Fuites de conversion invisibles
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Les voyageurs décident en quelques secondes. Si votre photo principale,
              votre titre ou votre accroche ne convainquent pas, ils n’iront pas plus loin.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Manque de contexte concurrentiel
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Vous voyez rarement votre annonce à côté des 10 offres les plus similaires
              que vos voyageurs comparent réellement.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Décisions sans données
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Sans audit structuré, impossible de savoir quels ajustements auront le plus d’impact.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pas de feuille de route claire
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Vous avez besoin d’un plan d’action priorisé, pas d’une liste infinie de conseils génériques.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
