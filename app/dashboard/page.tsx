import Link from "next/link";
import { listListingsWithLatestAudit } from "@/lib/mock-db";

export default function DashboardPage() {
  const listings = listListingsWithLatestAudit();

  const totalAudits = listings.filter((l) => l.latestAudit).length;

  const averageScore = listings.length
    ? (
        listings.reduce(
          (sum, l) => sum + Number(l.latestAudit?.result?.overallScore ?? 0),
          0
        ) / listings.length
      ).toFixed(1)
    : "–";

  const bestScore =
    listings.length > 0
      ? Math.max(
          ...listings.map((l) => Number(l.latestAudit?.result?.overallScore ?? 0))
        ).toFixed(1)
      : "–";

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Aperçu
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Suivez vos annonces, vos audits récents et votre niveau global de
            conversion. Cette vue donne un résumé rapide de votre espace de
            travail.
          </p>
        </div>

        <Link
          href="/dashboard/listings/new"
          className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
        >
          Lancer un nouvel audit
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 shadow-lg shadow-black/20">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">
            Annonces
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {listings.length}
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            Nombre total d’annonces suivies dans cet espace.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 shadow-lg shadow-black/20">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">
            Annonces auditées
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">{totalAudits}</p>
          <p className="mt-2 text-sm text-neutral-400">
            Annonces ayant au moins un audit disponible.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 shadow-lg shadow-black/20">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">
            Score moyen
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {averageScore}
            {averageScore !== "–" && <span className="text-xl">/10</span>}
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            Moyenne des scores sur les derniers audits.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 shadow-lg shadow-black/20">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">
            Meilleur score
          </p>
          <p className="mt-3 text-3xl font-semibold text-emerald-300">
            {bestScore}
            {bestScore !== "–" && <span className="text-xl">/10</span>}
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            Meilleure performance actuelle parmi vos annonces.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_380px]">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                Résumé rapide
              </p>
              <h2 className="mt-2 text-base font-semibold text-white">
                Situation actuelle
              </h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
              <p className="text-xs font-medium text-neutral-300">
                Si vous avez peu d’audits
              </p>
              <p className="mt-2 text-xs leading-6 text-neutral-400">
                Commencez par ajouter 2 à 3 annonces pour comparer les résultats
                et mieux identifier les points faibles récurrents.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
              <p className="text-xs font-medium text-neutral-300">
                Si votre score est bas
              </p>
              <p className="mt-2 text-xs leading-6 text-neutral-400">
                Priorisez les photos, les équipements et les premières lignes de
                description avant tout le reste.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
              <p className="text-xs font-medium text-neutral-300">
                Si votre score est déjà bon
              </p>
              <p className="mt-2 text-xs leading-6 text-neutral-400">
                Travaillez surtout le positionnement marché et l’écart avec les
                concurrents comparables à proximité.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 shadow-lg shadow-black/20">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">
            Recommandation
          </p>
          <h2 className="mt-2 text-base font-semibold text-white">
            Prochaine action
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-400">
            Ajoutez une nouvelle annonce ou relancez un audit pour mesurer son
            positionnement face aux concurrents proches.
          </p>

          <div className="mt-5">
            <Link
              href="/dashboard/listings/new"
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
            >
              Ajouter une annonce
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}