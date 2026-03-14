import Link from "next/link";
import { listListingsWithLatestAudit } from "@/lib/mock-db";

function formatAuditDate(value?: string) {
  if (!value) return "–";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";

  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default function ListingsPage() {
  const listings = listListingsWithLatestAudit();

  return (
    <div className="space-y-8 text-sm">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Annonces
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Retrouvez ici toutes vos annonces suivies, leur plateforme, leur
            dernier score d’audit et l’accès direct au rapport détaillé.
          </p>
        </div>

        <Link
          href="/dashboard/listings/new"
          className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
        >
          + Nouvelle annonce
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/80 shadow-xl shadow-black/20">
        <div className="border-b border-neutral-800 px-5 py-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">
            Liste des annonces
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-neutral-300">
            <thead className="border-b border-neutral-800 bg-neutral-950/60 text-[11px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Annonce</th>
                <th className="px-5 py-3 font-medium">Plateforme</th>
                <th className="px-5 py-3 font-medium">Dernier score</th>
                <th className="px-5 py-3 font-medium">Dernier audit</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {listings.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-neutral-500"
                  >
                    Aucune annonce pour le moment. Ajoutez votre première annonce
                    pour lancer un audit.
                  </td>
                </tr>
              ) : (
                listings.map((listing) => {
                  const audit = listing.latestAudit;
                  const overallScore = Number(audit?.result?.overallScore ?? 0);

                  return (
                    <tr
                      key={listing.id}
                      className="border-t border-neutral-800 transition hover:bg-neutral-950/40"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-white">
                            {listing.title}
                          </span>
                          <a
                            href={listing.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-emerald-300 transition hover:text-emerald-200"
                          >
                            Voir l’annonce publique ↗
                          </a>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <span className="inline-flex rounded-full border border-neutral-700 bg-neutral-950/80 px-3 py-1 text-xs capitalize text-neutral-300">
                          {listing.platform}
                        </span>
                      </td>

                      <td className="px-5 py-4 align-top">
                        {audit ? (
                          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                            {overallScore.toFixed(1)}/10
                          </span>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 align-top text-xs text-neutral-400">
                        {audit ? formatAuditDate(audit.createdAt) : "–"}
                      </td>

                      <td className="px-5 py-4 align-top">
                        {audit ? (
                          <Link
                            href={`/dashboard/audits/${audit.id}`}
                            className="inline-flex rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                          >
                            Voir l’audit
                          </Link>
                        ) : (
                          <span className="text-xs text-neutral-500">
                            Aucun audit
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}