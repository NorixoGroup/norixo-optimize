import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type ListingPageRow = {
  id: string;
  source_url: string | null;
  source_platform: string | null;
  title: string | null;
  created_at: string;
  audits: {
    id: string;
    overall_score: number | null;
    created_at: string;
    result_payload: any;
  }[];
};

function formatAuditDate(value?: string) {
  if (!value) return "–";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";

  return date.toISOString().slice(0, 16).replace("T", " ");
}

function lqiBadgeClass(label?: string) {
  switch (label) {
    case "needs_work":
      return "border-red-200 bg-red-50 text-red-700";
    case "improving":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "competitive":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "strong_performer":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "market_leader":
      return "border-emerald-300 bg-emerald-100 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function lqiLabelText(label?: string) {
  switch (label) {
    case "needs_work":
      return "Needs work";
    case "improving":
      return "Improving";
    case "competitive":
      return "Competitive";
    case "strong_performer":
      return "Strong performer";
    case "market_leader":
      return "Market leader";
    default:
      return "No audit yet";
  }
}

async function getListings() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("listings")
    .select(`
      id,
      source_url,
      source_platform,
      title,
      created_at,
      audits (
        id,
        overall_score,
        created_at,
        result_payload
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load listings:", error);
    return [];
  }

  return (data ?? []) as ListingPageRow[];
}

export default async function ListingsPage() {
  const listings = await getListings();

  return (
    <div className="space-y-8 text-sm">
      <div className="nk-card nk-card-hover nk-page-header-card py-7 md:flex md:items-center md:justify-between md:gap-10">
        <div className="max-w-3xl space-y-3">
          <p className="nk-kicker-muted">Inventaire</p>
          <h1 className="nk-heading-xl text-2xl font-semibold text-slate-900 md:text-3xl lg:text-4xl">
            Annonces suivies
          </h1>
          <p className="nk-body-muted text-[15px] leading-relaxed text-slate-700">
            Pilotez toutes les annonces auditées depuis un seul endroit: plateforme, dernier
            score et accès direct au rapport détaillé.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              {listings.length} listing{listings.length === 1 ? "" : "s"} tracked
            </span>
          </div>
        </div>

        <div className="mt-5 text-right md:mt-0">
          <Link
            href="/dashboard/listings/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Add listing to analyze
          </Link>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Start with your most strategic listing to see how it compares to nearby competitors.
          </p>
        </div>
      </div>

      <div className="nk-card-hover overflow-hidden rounded-3xl border border-slate-200/70 bg-slate-50/95 shadow-[0_22px_80px_rgba(15,23,42,0.25)]">
        <div className="border-b border-slate-200/80 px-5 py-4">
          <p className="nk-section-title">Liste des annonces suivies</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-900">
            <thead className="border-b border-slate-200/80 bg-slate-100 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Annonce</th>
                <th className="px-5 py-3 font-medium">Plateforme</th>
                <th className="px-5 py-3 font-medium">Dernier score</th>
                <th className="px-5 py-3 font-medium">LQI</th>
                <th className="px-5 py-3 font-medium">Dernier audit</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {listings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10">
                    <div className="flex justify-center">
                      <div className="nk-card nk-card-hover max-w-md border border-dashed border-slate-200 bg-white/95 p-6 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                          <span className="text-lg">＋</span>
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-slate-900">
                          No listings yet
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          Add your first listing to start analyzing its conversion potential and
                          unlock tailored recommendations.
                        </p>
                        <div className="mt-4 flex justify-center">
                          <Link href="/dashboard/listings/new" className="nk-primary-btn text-xs font-semibold">
                            Add first listing
                          </Link>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                listings.map((listing) => {
                  const latestAudit = Array.isArray(listing.audits)
                    ? [...listing.audits].sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      )[0]
                    : undefined;

                  const auditResult = latestAudit?.result_payload ?? {};
                  const overallScore = Number(latestAudit?.overall_score ?? 0);

                  const lqi = auditResult?.listingQualityIndex as
                    | { score?: number; label?: string }
                    | undefined;

                  const lqiScore =
                    typeof lqi?.score === "number" && Number.isFinite(lqi.score)
                      ? lqi.score
                      : null;

                  return (
                    <tr
                      key={listing.id}
                      className="border-t border-slate-200/80 nk-table-row-hover"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-900">
                            {listing.title ?? "Untitled listing"}
                          </span>
                          {listing.source_url ? (
                            <a
                              href={listing.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-orange-600 transition hover:text-orange-500"
                            >
                              Voir l’annonce publique ↗
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">URL non disponible</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <span className="nk-badge-neutral text-[11px] lowercase">
                          {listing.source_platform ?? "unknown"}
                        </span>
                      </td>

                      <td className="px-5 py-4 align-top">
                        {latestAudit ? (
                          <span className="nk-badge-emerald">
                            {overallScore.toFixed(1)}/10
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-500">
                            Aucun audit
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 align-top text-xs">
                        {latestAudit && lqiScore !== null ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-slate-900">
                              {Math.round(lqiScore)}/100
                            </span>
                            <span
                              className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${lqiBadgeClass(
                                lqi?.label
                              )}`}
                            >
                              {lqiLabelText(lqi?.label)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                            <span>—</span>
                            <span>No audit yet</span>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 align-top text-xs text-slate-500">
                        {latestAudit ? formatAuditDate(latestAudit.created_at) : "–"}
                      </td>

                      <td className="px-5 py-4 align-top">
                        {latestAudit ? (
                          <Link
                            href={`/dashboard/audits/${latestAudit.id}`}
                            className="nk-ghost-btn text-[11px] font-semibold uppercase tracking-[0.16em]"
                          >
                            Voir l’audit
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
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