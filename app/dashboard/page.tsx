"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getMockIsPro } from "@/lib/mock-subscription";

type DashboardListingRow = {
  id: string;
  audits: {
    overall_score: number | null;
    created_at: string;
    result_payload: any;
  }[];
};

export default function DashboardPage() {
  const [isPro, setIsPro] = useState(false);
  const [listings, setListings] = useState<DashboardListingRow[]>([]);

  useEffect(() => {
    setIsPro(getMockIsPro());

    async function loadListings() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from("listings")
        .select(
          `id,
           audits (
             overall_score,
             created_at,
             result_payload
           )`
        )
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        setListings(data as DashboardListingRow[]);
      }
    }

    loadListings();
  }, []);

  const totalAudits = listings.filter(
    (l) => Array.isArray(l.audits) && l.audits.length > 0
  ).length;

  const averageScore = listings.length
    ? (
        listings.reduce((sum, l) => {
          const latestAudit = Array.isArray(l.audits)
            ? [...l.audits].sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              )[0]
            : undefined;

          const overallScore = Number(latestAudit?.overall_score ?? 0);
          return sum + overallScore;
        }, 0) / listings.length
      ).toFixed(1)
    : "–";

  const bestScore =
    listings.length > 0
      ? Math.max(
          ...listings.map((l) => {
            const latestAudit = Array.isArray(l.audits)
              ? [...l.audits].sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                )[0]
              : undefined;

            return Number(latestAudit?.overall_score ?? 0);
          })
        ).toFixed(1)
      : "–";

  return (
    <div className="space-y-8 text-sm">
      <div className="nk-card nk-card-hover nk-page-header-card px-6 py-7 md:flex md:items-center md:justify-between md:gap-10 md:px-8">
        <div className="max-w-3xl space-y-3">
          <p className="nk-kicker-muted">Vue d’ensemble</p>
          <h1 className="nk-heading-xl text-2xl font-semibold text-slate-900 md:text-3xl lg:text-4xl">
            Aperçu de votre workspace
          </h1>
          <p className="nk-body-muted text-[15px] leading-relaxed text-slate-700">
            Suivez vos annonces, vos audits récents et votre niveau global de conversion. Cette vue
            donne un résumé rapide de l’état de votre espace de travail.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 font-medium text-slate-50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {isPro ? "Pro active (mock)" : "Free plan (mock)"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              {listings.length} annonce{listings.length === 1 ? "" : "s"} suivie{listings.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {totalAudits} audit{totalAudits === 1 ? "" : "s"} disponible{totalAudits === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="mt-5 text-right md:mt-0">
          {isPro ? (
            <>
              <Link
                href="/dashboard/audits"
                className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
              >
                Lancer un nouvel audit
              </Link>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Profitez du mode Pro pour auditer vos annonces clés.
              </p>
            </>
          ) : (
            <>
              <Link
                href="/dashboard/billing"
                className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
              >
                Découvrir le plan Pro
              </Link>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Passez en Pro pour débloquer l’Optimized Listing et d’autres insights.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="nk-card nk-card-hover p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Annonces suivies
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{listings.length}</p>
          <p className="mt-2 text-sm text-slate-700">
            Nombre total d’annonces suivies dans cet espace.
          </p>
        </div>

        <div className="nk-card nk-card-hover p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Annonces auditées
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{totalAudits}</p>
          <p className="mt-2 text-sm text-slate-700">
            Annonces ayant au moins un audit disponible.
          </p>
        </div>

        <div className="nk-card nk-card-hover p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Score moyen
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {averageScore}
            {averageScore !== "–" && <span className="text-xl">/10</span>}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Moyenne des scores sur les derniers audits.
          </p>
        </div>

        <div className="nk-card nk-card-hover p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Meilleur score
          </p>
          <p className="mt-3 text-3xl font-semibold text-emerald-600">
            {bestScore}
            {bestScore !== "–" && <span className="text-xl">/10</span>}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Meilleure performance actuelle parmi vos annonces.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_380px]">
        <div className="nk-card nk-card-hover p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="nk-section-title">Résumé rapide</p>
              <h2 className="mt-2 text-base font-semibold text-slate-900">Situation actuelle</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-900">
                Si vous avez peu d’audits
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-700">
                Commencez par ajouter 2 à 3 annonces pour comparer les résultats et mieux
                identifier les points faibles récurrents.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-900">
                Si votre score est bas
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-700">
                Priorisez les photos, les équipements et les premières lignes de description avant
                tout le reste.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-900">
                Si votre score est déjà bon
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-700">
                Travaillez surtout le positionnement marché et l’écart avec les concurrents
                comparables à proximité.
              </p>
            </div>
          </div>
        </div>

        <div className="nk-card nk-card-hover p-6">
          <p className="nk-section-title">Recommandation</p>
          <h2 className="mt-2 text-base font-semibold text-slate-900">Prochaine action</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Ajoutez une nouvelle annonce ou relancez un audit pour mesurer son positionnement face
            aux concurrents proches.
          </p>

          <div className="mt-5">
            <Link
              href="/dashboard/listings"
              className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
            >
              Ajouter une annonce
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}