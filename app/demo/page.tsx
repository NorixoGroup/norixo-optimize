import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default function DemoPage() {
  return (
    <MarketingPageShell>
      <main className="nk-section space-y-12">
      {/* Demo hero */}
      <section className="relative overflow-hidden space-y-6 border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-8 md:p-10 xl:p-12 rounded-[32px] shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-[4px]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-orange-500">Démo produit</p>
        <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.045em] leading-[0.92] text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.4)] [text-wrap:balance] sm:text-6xl xl:text-7xl">
          Découvrez comment fonctionne un
          {" "}
          <span className="bg-gradient-to-r from-orange-500 via-amber-400 to-lime-400 bg-clip-text text-transparent">
            audit d’annonce.
          </span>
        </h1>
        <p className="max-w-3xl text-[18px] leading-8 text-slate-600">
          Découvrez comment Listing Conversion Optimizer analyse une annonce de location courte durée et
          identifie des leviers concrets pour améliorer la conversion et les réservations.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/listings/new"
            className="rounded-2xl bg-orange-500 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_12px_30px_rgba(249,115,22,0.22)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-orange-400"
          >
            Lancer votre premier audit
          </Link>
          <Link
            href="/dashboard"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50"
          >
            Accéder au tableau de bord
          </Link>
        </div>
      </section>

      {/* Example listing analyzed */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_20px_50px_rgba(15,23,42,0.10)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Exemple d’annonce analysée</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                Riad avec rooftop et bassin plongé
              </h2>
              <p className="mt-1 text-sm text-slate-600">Marrakech · Médina · 2 chambres · 4 voyageurs</p>
              <p className="mt-2 text-sm text-slate-600">110&nbsp;€ / nuit · Annulation flexible</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">
                Airbnb
              </span>
              <div className="flex items-center gap-1 text-sm font-medium text-amber-500">
                <span>4.7</span>
                <span className="text-xs text-slate-500">(128 avis)</span>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className="relative h-40 w-full bg-gradient-to-tr from-slate-100 via-slate-50 to-slate-100 sm:h-48">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_0_0,rgba(148,163,184,0.12),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(59,130,246,0.16),transparent_55%)]" />
              <div className="relative flex h-full items-end justify-between p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Aperçu de l’annonce (exemple)
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Terrasse · Patio · Petit bassin · Riad traditionnel
                  </p>
                </div>
                <div className="rounded-full bg-white/90 px-3 py-1 text-[11px] text-slate-700 shadow-[0_6px_16px_rgba(15,23,42,0.10)]">
                  Les voyageurs se décident en quelques secondes à partir de cela.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audit report preview */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_20px_50px_rgba(15,23,42,0.10)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aperçu du rapport d’audit</p>
          <p className="mt-2 text-sm text-slate-600">
            Exemple statique de la forme que prend un audit Listing Conversion Optimizer
            pour cette annonce.
          </p>

          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Score global
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                6.2<span className="text-base text-emerald-500"> / 10</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Comparé aux annonces similaires à proximité.</p>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Score potentiel
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                8.4<span className="text-sm text-slate-500"> après ajustements</span>
              </p>
              <p className="mt-1 text-[11px] text-emerald-600">+2,2&nbsp;pts de progression possible</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,#f0fdf4_0%,#ecfdf5_100%)] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Impact estimé
                </p>
                <p className="mt-1 text-sm text-emerald-800">+18&nbsp;% de potentiel de réservation</p>
              </div>
              <p className="text-[11px] text-emerald-700">Basé sur des annonces similaires déjà optimisées.</p>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" />
            </div>
          </div>

          <div className="mt-4 grid gap-6 text-xs text-slate-600 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Photos
              </p>
              <p className="mt-1 text-[13px] leading-5 text-slate-600">La photo principale ne montre pas l’atout clé.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Texte
              </p>
              <p className="mt-1 text-[13px] leading-5 text-slate-600">Le premier paragraphe est générique et peu précis.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Équipements
              </p>
              <p className="mt-1 text-[13px] leading-5 text-slate-600">3 équipements à fort impact manquent par rapport aux comparables.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key insights */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Points clés détectés</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          L’audit décompose votre annonce en leviers qui influencent réellement
          la conversion et la décision de réservation.
        </p>
        <div className="mt-6 grid gap-6 text-sm text-slate-700 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Titre de l’annonce
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Le titre pourrait mieux mettre en avant les atouts clés et l’audience cible.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              Le titre actuel ne mentionne ni le rooftop ni le bassin et ne précise pas
              pour qui le lieu est idéal.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ordre des photos
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              La première photo ne met pas en avant les pièces les plus fortes.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              Les premières images montrent des couloirs et des pièces secondaires
              au lieu de la terrasse et du bassin qui déclenchent les clics.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Équipements vs. concurrents
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Équipements manquants par rapport aux concurrents locaux.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              Les annonces voisines à prix similaire mettent en avant Wi-Fi rapide,
              espace de travail et départ tardif, qui sont absents ici.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Introduction de la description
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              La description manque d’une accroche forte centrée sur le voyageur.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              Les premières lignes ne disent pas clairement pour qui est l’annonce,
              ce qui la rend unique ni pourquoi réserver maintenant.
            </p>
          </div>
        </div>
      </section>

      {/* Optimization recommendations */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommandations d’optimisation</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Chaque audit s’accompagne d’une checklist priorisée d’actions concrètes
          à mettre en œuvre en une seule session.
        </p>
        <div className="mt-6 grid gap-6 text-sm text-slate-700 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-slate-900">Améliorer la structure du titre</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Inclure ville, atout principal et audience&nbsp;: par ex. «&nbsp;Riad à Marrakech avec
                  rooftop et bassin · idéal pour les couples&nbsp;».
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-slate-900">Réordonner les photos pour une meilleure première impression</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Placer terrasse, bassin et pièce de vie principale dans les 3 premières photos,
                  en phase avec ce qui compte le plus pour les voyageurs.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-slate-900">Ajouter les équipements manquants</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Mettre en avant Wi-Fi rapide, espace de travail dédié et départ flexible si
                  disponibles, pour aligner avec les attentes locales.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-slate-900">Renforcer le premier paragraphe de la description</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Commencer par pour qui est le lieu, le bénéfice principal et ce qui
                  différencie ce riad des autres.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Comment utiliser cette checklist
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">
              La plupart des hôtes peuvent appliquer les 3 recommandations principales en
              moins d’une heure. L’objectif est d’expédier rapidement des améliorations
              significatives, pas de réécrire toute votre annonce.
            </p>
            <p className="mt-3 text-[13px] leading-6 text-slate-600">
              Vous gardez le contrôle&nbsp;: rien n’est modifié automatiquement. LCO vous
              donne le plan d’action&nbsp;; vous décidez quoi appliquer sur Airbnb,
              Booking.com ou VRBO.
            </p>
          </div>
        </div>
      </section>

      {/* Estimated performance improvement */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Amélioration estimée des performances</p>
        <div className="mt-6 grid gap-6 text-sm text-slate-700 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,#f0fdf4_0%,#ecfdf5_100%)] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Hausse de conversion
            </p>
            <p className="mt-2 text-xl font-semibold text-emerald-800">Réservations +15–25&nbsp;%</p>
            <p className="mt-1 text-[13px] leading-6 text-emerald-700">
              Fourchette d’amélioration typique observée après application des
              recommandations à fort impact sur des annonces similaires.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Compétitivité de l’annonce
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Passer d’un niveau moyen à un niveau supérieur.</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              En comblant l’écart sur les photos, les équipements et le message,
              votre annonce devient un choix plus sûr dans les résultats de recherche.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Vitesse de décision
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Savoir exactement quoi corriger en premier.</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              Au lieu de deviner, vous obtenez une liste claire et classée
              des opportunités par impact.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold leading-tight text-slate-900 md:text-3xl">
            Prêt à analyser votre propre annonce ?
          </h2>
          <p className="mt-2 text-[15px] leading-7 text-slate-600">
            Collez une URL, lancez votre premier audit propulsé par l’IA et transformez
            des visiteurs hésitants en réservations confirmées.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href="/dashboard/listings/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Lancer votre premier audit
          </Link>
          <Link
            href="/sign-up"
            className="nk-ghost-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Créer un compte
          </Link>
        </div>
      </section>
      </main>
    </MarketingPageShell>
  );
}
