import Link from "next/link";
import { HowItWorksSections } from "@/components/marketing/HowItWorksSections";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default function Home() {
  return (
    <MarketingPageShell>
      <main className="nk-section space-y-16 md:space-y-20">
      {/* HERO */}
      <section className="grid gap-8 rounded-[28px] border border-slate-800/70 bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.14),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.12),transparent_55%),linear-gradient(145deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94))] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.55)] md:grid-cols-[minmax(0,1.6fr)_minmax(0,420px)] md:p-8">
        <div className="space-y-8">
          <div className="space-y-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
              NORIXO OPTIMIZE
            </p>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl md:text-6xl">
              Transformez vos annonces
              <span className="block bg-gradient-to-r from-orange-400 via-amber-300 to-emerald-300 bg-clip-text text-transparent">
                en moteurs de revenu.
              </span>
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-slate-300">
              Révélez ce qui freine vos réservations et concentrez-vous sur les actions qui génèrent réellement du revenu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            <Link
              href="/audit/new"
              className="nk-primary-btn px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] shadow-[0_18px_40px_rgba(249,115,22,0.35)]"
            >
              Lancer un audit
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/70 px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 shadow-[0_10px_24px_rgba(2,6,23,0.35)] transition-colors hover:border-slate-500/80 hover:bg-slate-800/80"
            >
              Voir la démo
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 px-3.5 py-2.5 text-[11px] leading-5 text-slate-200 shadow-[0_12px_28px_rgba(2,6,23,0.32)]">
              +18% à +32% de réservations potentielles
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 px-3.5 py-2.5 text-[11px] leading-5 text-slate-200 shadow-[0_12px_28px_rgba(2,6,23,0.32)]">
              Recommandations activables immédiatement
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 px-3.5 py-2.5 text-[11px] leading-5 text-slate-200 shadow-[0_12px_28px_rgba(2,6,23,0.32)]">
              Lecture claire des freins à la conversion
            </div>
          </div>
        </div>

        {/* Product preview in hero */}
        <aside className="nk-card flex flex-col justify-between bg-[linear-gradient(145deg,rgba(248,250,252,0.99),rgba(239,246,255,0.97))] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  APERÇU DU RAPPORT
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Lisbonne · 2 chambres avec balcon
                </p>
              </div>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Rapport IA
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-sky-100 bg-[linear-gradient(135deg,rgba(239,246,255,1),rgba(219,234,254,0.98))] px-4 py-4 shadow-[0_16px_34px_rgba(30,64,175,0.18)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Score global
              </p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600">
                6.4<span className="text-base text-emerald-500"> / 10</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Priorité aux leviers les plus impactants pour améliorer la conversion.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Position marché
                </p>
                <p className="mt-1 text-[13px] font-semibold text-slate-900">Compétitif</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Impact estimé
                </p>
                <p className="mt-1 text-[13px] font-semibold text-emerald-700">+18% à +32%</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(209,250,229,0.96))] px-3 py-3 shadow-[0_16px_34px_rgba(16,185,129,0.22)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Revenu mensuel
                </p>
                <p className="mt-1 text-[13px] font-semibold text-emerald-900">+280€ à +620€</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.12)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recommandations prioritaires
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-800">
                <li>Réorganiser les photos pour mettre en avant la terrasse et la vue.</li>
                <li>Réécrire le paragraphe d’ouverture avec plus de réassurance.</li>
                <li>Ajouter les équipements attendus à ce niveau de prix.</li>
              </ul>
            </div>
          </div>
        </aside>
      </section>

      {/* PROBLEM SECTION */}
      <section className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="nk-card bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(226,232,240,0.96))] p-6 shadow-[0_20px_48px_rgba(15,23,42,0.12)]">
          <p className="nk-section-title">LE PROBLÈME</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
            Votre annonce génère des vues, mais pas assez de réservations.
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            Sans lecture claire de la conversion, les décisions restent dispersées et peu mesurables.
          </p>
          <ul className="mt-4 space-y-2 text-[13px] leading-6 text-slate-700">
            <li>• Positionnement concurrentiel peu lisible.</li>
            <li>• Difficulté à relier actions et résultats.</li>
            <li>• Priorités d’optimisation floues.</li>
          </ul>
        </div>

        <div className="nk-card grid gap-3 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(226,232,240,0.9))] p-5 text-sm text-slate-800 shadow-[0_18px_44px_rgba(15,23,42,0.10)] sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Fuites de conversion invisibles
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              En quelques secondes, photo, titre et accroche déterminent la suite du parcours.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Manque de contexte concurrentiel
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Les écarts avec les annonces comparables restent souvent difficiles à objectiver.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Décisions sans données
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Sans rapport structuré, les actions à fort impact passent au second plan.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pas de feuille de route claire
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Vous avez besoin d’un plan priorisé, pas d’une liste générique.
            </p>
          </div>
        </div>
      </section>

      {/* BEFORE / AFTER SECTION */}
      <section className="grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)]">
        <div className="nk-card bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(239,246,255,0.96))] p-6 shadow-[0_22px_52px_rgba(15,23,42,0.14)]">
          <p className="nk-section-title">AVANT / APRÈS OPTIMISATION</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
            Avant / après : ce que change un audit bien priorisé
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            L’objectif n’est pas de tout refaire, mais de renforcer la clarté, la réassurance et la performance avec des priorités nettes.
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
                Promesse diffuse, signaux de confiance faibles et hiérarchie visuelle peu lisible.
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
                Points forts visibles en premier, message d’ouverture clarifié et réassurance renforcée.
              </p>
            </div>
          </div>
        </div>

        <div className="nk-card bg-slate-50/95 p-6 shadow-[0_22px_52px_rgba(15,23,42,0.12)]">
          <p className="nk-section-title">LECTURE PRODUIT</p>
          <h3 className="mt-3 text-xl font-semibold text-slate-900">
            Lecture produit en un coup d’œil
          </h3>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            Norixo Optimize centralise les signaux clés dans un rapport clair : niveau actuel, freins prioritaires et impact estimé.
          </p>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.10)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Score
                </p>
                <p className="mt-1 text-3xl font-semibold text-emerald-600">7.3 / 10</p>
                <p className="mt-1 text-[11px] text-slate-600">Niveau actuel de performance.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Points faibles
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-700">
                  Clarté visuelle, réassurance et structure de message.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(209,250,229,0.96))] px-3 py-4 shadow-[0_16px_34px_rgba(16,185,129,0.30)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Impact estimé
                </p>
                <p className="mt-1 text-[13px] leading-5 text-emerald-900">
                  Accélérer les réservations avec les bons leviers, sans complexité.
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
