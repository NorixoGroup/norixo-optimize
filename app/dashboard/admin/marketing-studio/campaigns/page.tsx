"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { supabase } from "@/lib/supabase";

type CampaignRow = {
  id: string;
  name: string | null;
  objective: string;
  status: string;
  created_at: string;
  updated_at: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MarketingCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCampaigns() {
      setLoading(true);

      const { data, error } = await supabase
        .from("marketing_campaigns")
        .select("id, name, objective, status, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[marketing-studio] campaigns load failed", error);
        setCampaigns([]);
      } else {
        setCampaigns(data ?? []);
      }

      setLoading(false);
    }

    void loadCampaigns();
  }, []);

  return (
    <DashboardShell>
      <div className="space-y-8">
        <section className="nk-card rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Marketing Studio
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                Bibliothèque des campagnes
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Retrouvez toutes les campagnes enregistrées dans Marketing Studio.
              </p>
            </div>

            <Link
              href="/dashboard/admin/marketing-studio"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Créer une campagne
            </Link>
          </div>
        </section>

        <section className="nk-card rounded-3xl border border-slate-200 bg-white p-6">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-xl font-semibold text-slate-950">
              Campagnes enregistrées
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Brouillons et campagnes sauvegardées pour Norixo.io.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-slate-600">Chargement...</p>
          ) : campaigns.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="font-semibold text-slate-950">
                Aucune campagne enregistrée.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Générez une campagne puis enregistrez-la comme brouillon.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Campagne</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="bg-white">
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(campaign.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-950">
                          {campaign.name ?? "Campagne sans nom"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {campaign.objective}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/admin/marketing-studio?campaign=${campaign.id}`}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        >
                          Ouvrir
                        </Link>

                        <button
                          onClick={async () => {
                            const {
                              data: { session },
                            } = await supabase.auth.getSession();

                            const response = await fetch("/api/admin/marketing-studio/duplicate", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                              },
                              body: JSON.stringify({
                                campaignId: campaign.id,
                              }),
                            });

                            const data = await response.json();

                            if (!response.ok || !data.ok) {
                              console.error("duplicate response", data);
                              alert(JSON.stringify(data, null, 2));
                              return;
                            }

                            location.reload();
                          }}
                          className="ml-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        >
                          Dupliquer
                        </button>

                        <button
                          onClick={async () => {
                            if (!confirm("Supprimer cette campagne ? Cette action est définitive.")) {
                              return;
                            }

                            const {
                              data: { session },
                            } = await supabase.auth.getSession();

                            const response = await fetch("/api/admin/marketing-studio/delete", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                              },
                              body: JSON.stringify({
                                campaignId: campaign.id,
                              }),
                            });

                            const data = await response.json();

                            if (!response.ok || !data.ok) {
                              console.error("delete response", data);
                              alert(JSON.stringify(data, null, 2));
                              return;
                            }

                            location.reload();
                          }}
                          className="ml-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300 hover:bg-rose-50"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
