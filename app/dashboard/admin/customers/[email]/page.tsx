"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CustomerPayment = {
  date: string | null;
  workspaceId: string;
  workspaceName: string;
  offer: string;
  type: string;
  auditsSold: number;
  amount: number;
  currency: string;
  status: string;
};

type CustomerAudit = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  listingTitle: string;
  createdAt: string | null;
  score: number | null;
};

type CustomerWorkspace = {
  id: string;
  name: string;
  slug: string | null;
  createdAt: string | null;
};

type CustomerResponse = {
  email: string;
  summary: {
    totalSales: number;
    revenue: number;
    auditsSold: number;
    lastPaymentAt: string | null;
  };
  workspaces: CustomerWorkspace[];
  payments: CustomerPayment[];
  audits: CustomerAudit[];
};

function formatMoney(amount: number, currency = "eur") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatStatus(status: string) {
  switch (status.toLowerCase()) {
    case "succeeded":
      return "Succès";
    case "failed":
      return "Échec";
    case "refunded":
      return "Remboursé";
    case "partially_refunded":
      return "Partiellement remboursé";
    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status.toLowerCase()) {
    case "succeeded":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "refunded":
    case "partially_refunded":
      return "border-orange-200 bg-orange-50 text-orange-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function AdminCustomerDetailPage() {
  const params = useParams<{ email: string }>();
  const router = useRouter();
  const email = useMemo(() => decodeURIComponent(params.email ?? "").trim().toLowerCase(), [params.email]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CustomerResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCustomer() {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace(`/sign-in?next=${encodeURIComponent(`/dashboard/admin/customers/${encodeURIComponent(email)}`)}`);
        return;
      }

      const response = await fetch(`/api/admin/customers/${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      }).catch(() => null);

      if (!mounted) return;

      if (!response) {
        setError("Impossible de charger la fiche client.");
        setLoading(false);
        return;
      }

      if (response.status === 403) {
        router.replace("/dashboard");
        return;
      }

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Impossible de charger la fiche client.");
        setLoading(false);
        return;
      }

      setPayload((await response.json()) as CustomerResponse);
      setLoading(false);
    }

    loadCustomer();

    return () => {
      mounted = false;
    };
  }, [email, router]);

  const currency = payload?.payments.find((payment) => payment.currency)?.currency ?? "eur";

  if (loading) {
    return <div className="nk-card rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">Chargement de la fiche client…</div>;
  }

  if (error || !payload) {
    return <div className="nk-card rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">{error ?? "Fiche client indisponible."}</div>;
  }

  const kpis = [
    { label: "Ventes", value: payload.summary.totalSales.toString() },
    { label: "CA généré", value: formatMoney(payload.summary.revenue, currency) },
    { label: "Audits achetés", value: payload.summary.auditsSold.toString() },
    { label: "Dernier paiement", value: formatDate(payload.summary.lastPaymentAt) },
  ];

  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#eef6ff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <Link href="/dashboard/admin" className="text-xs font-semibold text-slate-500 transition hover:text-slate-900">
          ← Retour admin
        </Link>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Fiche client admin</p>
        <h1 className="mt-2 break-all text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{payload.email}</h1>
        <p className="mt-2 text-sm text-slate-600">Synthèse achats, workspaces et audits liés aux données disponibles.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <article key={item.label} className="nk-card rounded-3xl border border-l-4 border-slate-200/80 border-l-sky-500/80 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.72)_inset]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <h2 className="text-base font-semibold text-slate-950">Workspaces liés</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {payload.workspaces.length > 0 ? payload.workspaces.map((workspace) => (
            <div key={workspace.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="font-semibold text-slate-900">{workspace.name}</p>
              <p className="mt-1 text-xs text-slate-500">{workspace.slug ?? workspace.id}</p>
              <p className="mt-3 text-xs text-slate-500">Créé le {formatDate(workspace.createdAt)}</p>
            </div>
          )) : <p className="text-sm text-slate-500">Aucun workspace lié trouvé dans les paiements disponibles.</p>}
        </div>
      </section>

      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <h2 className="text-base font-semibold text-slate-950">Historique des achats</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50/90 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Offre</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Montant</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold">Audits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {payload.payments.map((payment, index) => (
                <tr key={`${payment.workspaceId}-${payment.date ?? "na"}-${index}`} className="bg-white transition hover:bg-slate-50/80">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(payment.date)}</td>
                  <td className="px-4 py-3">{payment.offer}</td>
                  <td className="px-4 py-3">{payment.type}</td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{formatMoney(payment.amount, payment.currency)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass(payment.status)}`}>{formatStatus(payment.status)}</span></td>
                  <td className="px-4 py-3">{payment.auditsSold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <h2 className="text-base font-semibold text-slate-950">Audits liés</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50/90 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Annonce</th>
                <th className="px-4 py-3 font-semibold">Workspace</th>
                <th className="px-4 py-3 font-semibold">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {payload.audits.length > 0 ? payload.audits.map((audit) => (
                <tr key={audit.id} className="bg-white transition hover:bg-slate-50/80">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(audit.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{audit.listingTitle}</td>
                  <td className="px-4 py-3">{audit.workspaceName}</td>
                  <td className="px-4 py-3">{audit.score !== null ? `${audit.score}/10` : "—"}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Aucun audit lié trouvé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
