import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type AuditRow = {
  id: string;
  listing_id: string;
  overall_score: number | null;
  created_at: string;
};

function formatAuditDate(value?: string) {
  if (!value) return "–";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";

  return date.toISOString().slice(0, 16).replace("T", " ");
}

async function getAudits() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("audits")
    .select("id, listing_id, overall_score, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load audits:", error);
    return [];
  }

  return (data ?? []) as AuditRow[];
}

export default async function AuditsPage() {
  const audits = await getAudits();

  return (
    <div className="space-y-8 text-sm">
      <div className="nk-card nk-card-hover nk-page-header-card px-6 py-7 md:flex md:items-center md:justify-between md:gap-10 md:px-8">
        <div className="max-w-3xl space-y-3">
          <p className="nk-kicker-muted">Historique</p>
          <h1 className="nk-heading-xl text-2xl font-semibold text-slate-900 md:text-3xl lg:text-4xl">
            Historique des audits
          </h1>
          <p className="nk-body-muted text-[15px] leading-relaxed text-slate-700">
            Archive de tous les rapports générés pour vos annonces: score global, date de
            création et accès direct au détail de chaque audit.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {audits.length} audit{audits.length === 1 ? "" : "s"} enregistrés
            </span>
          </div>
        </div>

        <div className="mt-5 text-right md:mt-0">
          <Link
            href="/dashboard/listings/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Run conversion audit
          </Link>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Use new audits to track how your scores evolve over time.
          </p>
        </div>
      </div>

      <div className="nk-card nk-card-hover overflow-hidden p-0">
        <div className="border-b border-slate-200/80 px-5 py-4">
          <p className="nk-section-title">Rapports disponibles</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-900">
            <thead className="border-b border-slate-200/80 bg-slate-100 text-[11px] uppercase tracking-[0.18em] text-slate-500">
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
                  <td colSpan={4} className="px-5 py-10">
                    <div className="flex justify-center">
                      <div className="nk-card nk-card-hover max-w-md border border-dashed border-slate-200 bg-white/95 p-6 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                          <span className="text-lg">✓</span>
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-slate-900">
                          No audits yet
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          Run your first conversion audit to get a detailed score and action plan,
                          then come back here to track your history.
                        </p>
                        <div className="mt-4 flex justify-center">
                          <Link href="/dashboard/listings/new" className="nk-primary-btn text-xs font-semibold">
                            Run first conversion audit
                          </Link>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                audits.map((audit) => {
                  const overallScore = Number(audit.overall_score ?? 0);

                  return (
                    <tr
                      key={audit.id}
                      className="border-t border-slate-200/80 nk-table-row-hover"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-900">
                            Audit de l’annonce {audit.listing_id.slice(0, 6)}…
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

                      <td className="px-5 py-4 align-top text-xs text-slate-500">
                        {formatAuditDate(audit.created_at)}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <Link
                          href={`/dashboard/audits/${audit.id}`}
                          className="nk-ghost-btn text-[11px] font-semibold uppercase tracking-[0.16em]"
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