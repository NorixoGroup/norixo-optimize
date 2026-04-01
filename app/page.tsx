import Link from "next/link";
import { HowItWorksSections } from "@/components/marketing/HowItWorksSections";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default function Home() {
  return (
    <MarketingPageShell>
      <main className="nk-section space-y-16 md:space-y-20">
      {/* HERO */}
      <section className="grid gap-10 rounded-[28px] border border-slate-200/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.96))] p-8 shadow-[0_28px_90px_rgba(15,23,42,0.16)] md:grid-cols-[minmax(0,1.6fr)_minmax(0,420px)] md:p-10">
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
            <Link
              href="/onboarding"
              className="nk-primary-btn px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] shadow-[0_18px_40px_rgba(249,115,22,0.35)]"
            >
              Démarrer votre premier audit
            </Link>
            <Link
              href="/demo"
              className="nk-ghost-btn text-xs font-semibold uppercase tracking-[0.18em]"
            >
              Voir un exemple d’audit
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="nk-card bg-slate-50/95 p-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Conçu pour
              </p>
              <p className="mt-3 text-sm font-medium text-slate-900">
                Les hôtes, investisseurs et gestionnaires qui veulent plus de
                réservations, pas seulement des métriques flatteuses.
              </p>
            </div>
            <div className="nk-card bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(254,243,199,0.96))] p-5 ring-1 ring-orange-400/50 shadow-[0_18px_40px_rgba(180,83,9,0.22)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                Résultat
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">+12–25%</p>
              <p className="mt-1 text-xs text-slate-600">
                Hausse moyenne des réservations après application des recommandations
                les plus impactantes.
              </p>
            </div>
            <div className="nk-card bg-slate-50/95 p-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
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

        {/* Product preview in hero */}
        <aside className="nk-card flex flex-col justify-between bg-[linear-gradient(145deg,rgba(248,250,252,0.98),rgba(239,246,255,0.96))] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
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

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-sky-100 bg-[linear-gradient(135deg,rgba(239,246,255,1),rgba(219,234,254,0.98))] px-4 py-4 shadow-[0_16px_34px_rgba(30,64,175,0.18)]">
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

              <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(226,232,240,0.96))] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Indice qualité annonce
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  78<span className="text-sm text-slate-500"> / 100</span>
                </p>
                <p className="mt-1 text-[11px] text-emerald-600">Compétitif avec potentiel</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.12)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recommandations prioritaires
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-800">
                <li>Réorganiser les photos pour mettre en avant la terrasse et la vue.</li>
                <li>Réécrire le paragraphe d’ouverture avec plus de réassurance.</li>
                <li>Ajouter les équipements attendus à ce niveau de prix.</li>
              </ul>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/60 bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(209,250,229,0.96))] px-4 py-3 shadow-[0_16px_34px_rgba(16,185,129,0.26)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Impact revenu estimé
                </p>
                <p className="mt-1 text-sm font-medium text-emerald-800">
                  +€280 to +€620 / month
                </p>
              </div>
              <span className="text-[11px] text-emerald-700">Basé sur des annonces optimisées similaires.</span>
            </div>
          </div>
        </aside>
      </section>

      {/* PROBLEM SECTION */}
      <section className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="nk-card bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(226,232,240,0.96))] p-6 shadow-[0_20px_48px_rgba(15,23,42,0.12)]">
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

        <div className="nk-card grid gap-3 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(226,232,240,0.9))] p-5 text-sm text-slate-800 shadow-[0_18px_44px_rgba(15,23,42,0.10)] sm:grid-cols-2">
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

      {/* BEFORE / AFTER SECTION */}
      <section className="grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)]">
        <div className="nk-card bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(239,246,255,0.96))] p-6 shadow-[0_22px_52px_rgba(15,23,42,0.14)]">
          <p className="nk-section-title">Avant / après optimisation</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
            A quoi ressemble une annonce avant et après un audit LCO ?
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            L’objectif n’est pas de refaire toute votre fiche, mais de corriger en priorité
            ce qui bloque la conversion : perception, réassurance et clarté de la promesse.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-800/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,64,175,0.94))] p-4 text-slate-100 shadow-[0_22px_50px_rgba(15,23,42,0.6)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                Avant optimisation
              </p>
              <div className="mt-3 flex gap-3">
                <div className="h-16 w-20 rounded-xl bg-slate-700/80" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-4/5 rounded-full bg-slate-700/80" />
                  <div className="h-2.5 w-full rounded-full bg-slate-800/80" />
                  <div className="h-2.5 w-3/5 rounded-full bg-slate-800/80" />
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-200">
                Galerie peu claire, texte générique, peu de signaux de réassurance. Difficile
                de comprendre rapidement pourquoi ce logement vaut le prix demandé.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-emerald-100 to-white p-4 shadow-[0_22px_50px_rgba(16,185,129,0.35)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                Après recommandations ciblées
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
                Photos réorganisées autour des points forts, message d’ouverture plus clair,
                éléments de réassurance visibles. L’annonce donne une impression plus solide
                dès les premières secondes.
              </p>
            </div>
          </div>
        </div>

        <div className="nk-card bg-slate-50/95 p-6 shadow-[0_22px_52px_rgba(15,23,42,0.12)]">
          <p className="nk-section-title">Lecture produit en un coup d’œil</p>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            LCO présente les signaux clés de votre annonce dans une interface unique : score,
            recommandations et impact estimé sur vos réservations.
          </p>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.10)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Score
                </p>
                <p className="mt-1 text-3xl font-semibold text-emerald-600">7.3 / 10</p>
                <p className="mt-1 text-[11px] text-slate-600">Niveau actuel de l’annonce.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Points faibles
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-700">
                  Photos peu lisibles, manque de réassurance, description peu structurée.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(209,250,229,0.96))] px-3 py-4 shadow-[0_16px_34px_rgba(16,185,129,0.30)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Impact potentiel
                </p>
                <p className="mt-1 text-[13px] leading-5 text-emerald-900">
                  Mieux convertir les recherches déjà existantes avant de toucher aux prix.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs leading-5 text-slate-800 shadow-[0_14px_32px_rgba(15,23,42,0.10)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Plan d’action extrait
              </p>
              <ul className="mt-2 space-y-1.5">
                <li>1. Réorganiser les 5 premières photos autour du principal point fort.</li>
                <li>2. Clarifier la promesse dans les deux premières lignes du texte.</li>
                <li>3. Mettre en avant 3 éléments de réassurance concrets.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <HowItWorksSections includeAnchorId />
      </main>
    </MarketingPageShell>
  );
}
