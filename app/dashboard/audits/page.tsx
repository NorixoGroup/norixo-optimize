import Link from "next/link";
import { listAudits } from "@/lib/mock-db";

function formatAuditDate(value?: string) {
  if (!value) return "–";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";

  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default function AuditsPage() {
  const audits = listAudits();

  return (
    <div className="space-y-8 text-sm">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-3xl space-y-2">
          <p className="nk-kicker-muted">Historique</p>
          <h1 className="nk-heading-xl">Audits</h1>
          <p className="nk-body-muted">
            Retrouvez ici tous les audits générés pour vos annonces avec leur
            score global, leur date de création et un accès direct au rapport
            détaillé.
          </p>
        </div>

        <Link
          href="/dashboard/listings/new"
          className="nk-primary-btn"
        >
          Lancer un nouvel audit
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/80 shadow-[0_22px_80px_rgba(15,23,42,0.95)]">
        <div className="border-b border-slate-800/80 px-5 py-4">
          <p className="nk-table-header">
            Historique des audits
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="border-b border-slate-800/80 bg-black/40 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Audit</th>
                <th className="px-5 py-3 font-medium">Score</th>
                <th className="px-5 py-3 font-medium">Créé le</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {audits.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    Aucun audit pour le moment. Lance ton premier audit depuis la
                    page des annonces.
                  </td>
                </tr>
              ) : (
                audits.map((audit) => {
                  const overallScore = Number(audit.result?.overallScore ?? 0);

                  return (
                    <tr
                      key={audit.id}
                      className="border-t border-slate-800/70 nk-table-row-hover"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-50">
                            Audit de l’annonce {audit.listingId.slice(0, 6)}…
                          </span>
                          <span className="text-xs text-slate-500">
                            ID audit : {audit.id.slice(0, 12)}…
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <span className="nk-badge-emerald">
                          {overallScore.toFixed(1)}/10
                        </span>
                      </td>

                      <td className="px-5 py-4 align-top text-xs text-slate-400">
                        {formatAuditDate(audit.createdAt)}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <Link
                          href={`/dashboard/audits/${audit.id}`}
                          className="nk-ghost-btn text-[11px]"
                        >
                          Voir l’audit
                        </Link>
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