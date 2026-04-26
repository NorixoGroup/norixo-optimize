"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PeriodDays = 7 | 30 | 90;

type KpiMetric = {
  current: number;
  previous: number;
  deltaPct: number | null;
  trend: "up" | "down" | "neutral" | "new";
};

type SalesKpis = {
  revenue: KpiMetric;
  sales: KpiMetric;
  avgBasket: KpiMetric;
  paidWorkspaces: KpiMetric;
  auditsSold: KpiMetric;
  revenuePerSale: KpiMetric;
};

type CreditPoolPayload = {
  lotsRowCount: number;
  lotsTruncated: boolean;
  period: {
    stripeCreditsGranted: number;
    manualCreditsGranted: number;
    stripeCreditsGrantedTrend: KpiMetric;
    manualCreditsGrantedTrend: KpiMetric;
  };
  global: {
    totalGranted: number;
    totalConsumed: number;
    creditsRemaining: number;
  };
};

type SalesRow = {
  date: string | null;
  workspaceId: string;
  workspaceName: string;
  buyerEmail: string | null;
  offer: string;
  planCode: string | null;
  type: string;
  paymentType: string | null;
  auditsSold: number;
  amount: number;
  currency: string;
  status: string;
};

type BreakdownItem = {
  label: string;
  sales?: number;
  count?: number;
  revenue?: number;
  percent: number;
};

type RevenuePoint = {
  key: string;
  label: string;
  revenue: number;
  sales: number;
};

type TopWorkspace = {
  workspaceId: string;
  workspaceName: string;
  sales: number;
  revenue: number;
  averageBasket: number;
  latestPayment: string | null;
  dominantOffer: string;
};

type SalesResponse = {
  generatedAt: string;
  adminEmail: string | null;
  period: {
    days: PeriodDays;
    start: string;
    end: string;
  };
  stripeKpis: SalesKpis;
  creditPool: CreditPoolPayload;
  offerBreakdown: BreakdownItem[];
  statusBreakdown: BreakdownItem[];
  revenueSeries: RevenuePoint[];
  topWorkspaces: TopWorkspace[];
  rows: SalesRow[];
};

const periods: { label: string; value: PeriodDays }[] = [
  { label: "7 jours", value: 7 },
  { label: "30 jours", value: 30 },
  { label: "90 jours", value: 90 },
];

const offerColors = ["#f59e0b", "#6366f1", "#10b981", "#94a3b8"];
const statusColors = ["#10b981", "#ef4444", "#f97316", "#64748b"];

function formatMoney(amount: number, currency = "eur") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatDelta(metric: KpiMetric) {
  if (metric.trend === "new") return "+100%";
  const value = metric.deltaPct ?? 0;
  if (value === 0) return "0%";
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  return `${value > 0 ? "+" : "-"}${formatted}%`;
}

function trendClass(metric: KpiMetric) {
  switch (metric.trend) {
    case "up":
      return "border-emerald-300/70 bg-emerald-50 text-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.12)]";
    case "down":
      return "border-rose-300/70 bg-rose-50 text-rose-700 shadow-[0_6px_16px_rgba(244,63,94,0.12)]";
    case "new":
      return "border-emerald-300/70 bg-emerald-50 text-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.12)]";
    default:
      return "border-slate-300/70 bg-slate-50 text-slate-600 shadow-[0_6px_16px_rgba(100,116,139,0.10)]";
  }
}

function TrendBadge({ metric }: { metric: KpiMetric }) {
  const isDown = metric.trend === "down";
  const isNeutral = metric.trend === "neutral";
  const points = isNeutral ? "2 10 7 10 12 10 18 10" : isDown ? "2 5 7 10 12 8 18 15" : "2 15 7 10 12 12 18 5";
  const iconClass = isNeutral ? "text-slate-500" : isDown ? "text-rose-600" : "text-emerald-600";

  return (
    <span
      title="vs période précédente"
      className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${trendClass(metric)}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 20"
        className={`h-3.5 w-3.5 shrink-0 ${iconClass}`}
        fill="none"
      >
        <polyline
          points={points}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {!isNeutral && (
          <path
            d={isDown ? "M18 15h3v-3M21 15l-5-5" : "M18 5h3v3M21 5l-5 5"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span>{formatDelta(metric)}</span>
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatStatus(status: string) {
  switch (status.toLowerCase()) {
    case "succeeded":
      return "Succès";
    case "pending":
      return "En attente";
    case "failed":
      return "Échec";
    case "refunded":
      return "Remboursé";
    case "partially_refunded":
      return "Partiellement remboursé";
    case "canceled":
      return "Annulé";
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

function offerClass(offer: string) {
  switch (offer) {
    case "Starter":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Pack 5 audits":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "Pack 15 audits":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function buildConicGradient(items: BreakdownItem[], colors: string[]) {
  let cursor = 0;
  const segments = items.map((item, index) => {
    const next = cursor + item.percent;
    const segment = `${colors[index % colors.length]} ${cursor}% ${next}%`;
    cursor = next;
    return segment;
  });

  return segments.length > 0 ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#e2e8f0 0 100%)";
}

function DonutCard({
  title,
  subtitle,
  items,
  colors,
  valueLabel,
}: {
  title: string;
  subtitle: string;
  items: BreakdownItem[];
  colors: string[];
  valueLabel: (item: BreakdownItem) => string;
}) {
  const total = items.reduce((sum, item) => sum + (item.sales ?? item.count ?? 0), 0);

  return (
    <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">{subtitle}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
          {formatNumber(total)}
        </span>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-[132px_1fr] sm:items-center">
        <div
          className="relative mx-auto h-32 w-32 rounded-full shadow-[0_18px_44px_rgba(15,23,42,0.10),0_1px_0_rgba(255,255,255,0.75)_inset]"
          style={{ background: buildConicGradient(items, colors) }}
        >
          <div className="absolute inset-5 rounded-full border border-slate-100 bg-white shadow-inner" />
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div>
              <p className="text-lg font-semibold tracking-tight text-slate-950">{formatNumber(total)}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">total</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white/75 px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                <span className="text-xs font-medium text-slate-700">{item.label}</span>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-950">{valueLabel(item)}</p>
                <p className="text-[10px] text-slate-500">{item.percent.toFixed(0)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SalesResponse | null>(null);
  const [customerEmailQuery, setCustomerEmailQuery] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSales() {
      setLoading(true);
      setError(null);
      setForbidden(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace(`/sign-in?next=${encodeURIComponent("/dashboard/admin")}`);
        return;
      }

      try {
        const response = await fetch(`/api/admin/sales?period=${period}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        if (!mounted) return;

        if (response.status === 401) {
          router.replace(`/sign-in?next=${encodeURIComponent("/dashboard/admin")}`);
          return;
        }

        if (response.status === 403) {
          setForbidden(true);
          setPayload(null);
          setLoading(false);
          return;
        }

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;

          setError(data?.error ?? "Impossible de charger les données admin.");
          setLoading(false);
          return;
        }

        const data = (await response.json()) as SalesResponse;
        setPayload(data);
        setLoading(false);
      } catch (loadError) {
        if (!mounted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les données admin."
        );
        setLoading(false);
      }
    }

    loadSales();

    return () => {
      mounted = false;
    };
  }, [period, router]);

  const currency = useMemo(() => {
    const firstCurrency = payload?.rows.find((row) => row.currency)?.currency;
    return firstCurrency ?? "eur";
  }, [payload?.rows]);

  if (loading && !payload) {
    return (
      <div className="nk-card rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Chargement du dashboard admin…
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="nk-card rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900 shadow-sm">
        Accès refusé. Cette page est réservée à l’administrateur.
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="nk-card rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
        {error ?? "Impossible de charger les données admin."}
      </div>
    );
  }

  const { stripeKpis: kpis, creditPool, rows, revenueSeries, topWorkspaces } = payload;
  const maxRevenue = Math.max(...revenueSeries.map((point) => point.revenue), 1);
  const customerEmails = Array.from(
    new Set(rows.map((row) => row.buyerEmail?.trim().toLowerCase()).filter((email): email is string => Boolean(email)))
  ).sort();
  const selectedCustomerEmail = customerEmailQuery.trim().toLowerCase();

  const kpiCards = [
    {
      label: "CA Stripe (encaissé)",
      value: formatMoney(kpis.revenue.current, currency),
      metric: kpis.revenue,
      accent: "border-l-emerald-500/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.15),transparent_34%),linear-gradient(180deg,#ffffff_0%,#ecfdf5_100%)]",
    },
    {
      label: "Ventes Stripe",
      value: formatNumber(kpis.sales.current),
      metric: kpis.sales,
      accent: "border-l-sky-500/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)]",
    },
    {
      label: "Panier moyen (Stripe)",
      value: formatMoney(kpis.avgBasket.current, currency),
      metric: kpis.avgBasket,
      accent: "border-l-amber-500/80 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.15),transparent_34%),linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)]",
    },
    {
      label: "Workspaces avec paiement Stripe",
      value: formatNumber(kpis.paidWorkspaces.current),
      metric: kpis.paidWorkspaces,
      accent: "border-l-indigo-500/80 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)]",
    },
    {
      label: "Audits vendus (Stripe)",
      value: formatNumber(kpis.auditsSold.current),
      metric: kpis.auditsSold,
      accent: "border-l-cyan-500/80 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#ecfeff_100%)]",
    },
    {
      label: "CA moyen / vente Stripe",
      value: formatMoney(kpis.revenuePerSale.current, currency),
      metric: kpis.revenuePerSale,
      accent: "border-l-violet-500/80 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.13),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f5f3ff_100%)]",
    },
  ];

  const creditKpiCards: Array<{
    label: string;
    subtitle: string;
    value: string;
    accent: string;
    metric?: KpiMetric;
  }> = [
    {
      label: "Crédits accordés via Stripe (période)",
      subtitle: "Somme des granted_quantity des lots stripe_checkout_* créés sur la période.",
      value: formatNumber(creditPool.period.stripeCreditsGranted),
      metric: creditPool.period.stripeCreditsGrantedTrend,
      accent:
        "border-l-teal-500/80 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]",
    },
    {
      label: "Crédits manuels accordés (période)",
      subtitle: "Lots source_type = manual_adjustment, sur la période sélectionnée.",
      value: formatNumber(creditPool.period.manualCreditsGranted),
      metric: creditPool.period.manualCreditsGrantedTrend,
      accent:
        "border-l-orange-500/80 bg-[radial-gradient(circle_at_top_left,rgba(234,88,12,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#fff7ed_100%)]",
    },
    {
      label: "Total crédits accordés (tous lots)",
      subtitle: "Tous workspaces — agrégat sur les lignes audit_credit_lots chargées.",
      value: formatNumber(creditPool.global.totalGranted),
      accent:
        "border-l-slate-500/80 bg-[radial-gradient(circle_at_top_left,rgba(100,116,139,0.10),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]",
    },
    {
      label: "Total crédits consommés",
      subtitle: "Somme des consumed_quantity sur les lots chargés.",
      value: formatNumber(creditPool.global.totalConsumed),
      accent:
        "border-l-rose-500/80 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.10),transparent_34%),linear-gradient(180deg,#ffffff_0%,#fff1f2_100%)]",
    },
    {
      label: "Crédits restants (stock)",
      subtitle: "Σ granted − Σ consumed sur les lots chargés.",
      value: formatNumber(creditPool.global.creditsRemaining),
      accent:
        "border-l-emerald-600/80 bg-[radial-gradient(circle_at_top_left,rgba(5,150,105,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#ecfdf5_100%)]",
    },
  ];

  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.11),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.10),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#eef6ff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
              Admin privé
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Cockpit business Norixo
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              CA et ventes : <strong className="font-semibold text-slate-800">billing_payments</strong>{" "}
              (paiements réussis, hors ajustements manuels). Crédits :{" "}
              <strong className="font-semibold text-slate-800">audit_credit_lots</strong> (Stripe + manuels).
            </p>
          </div>

          <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white/85 p-1 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            {periods.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  period === item.value
                    ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Stripe — chiffre d’affaires</h2>
        <p className="text-xs text-slate-500">
          Source <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">billing_payments</code> · statut
          réussi · exclut <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">source=manual</code> et{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">payment_type=adjustment</code>.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpiCards.map((card) => (
            <article
              key={card.label}
              className={`nk-card relative rounded-3xl border border-l-4 border-slate-200/80 ${card.accent} p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.72)_inset]`}
            >
              <TrendBadge metric={card.metric} />
              <p className="pr-24 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {card.label}
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {card.value}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Crédits — stocks et manuels</h2>
        <p className="text-xs text-slate-500">
          Source <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">audit_credit_lots</code>
          {creditPool.lotsTruncated
            ? " · Attention : limite de chargement atteinte, les totaux globaux peuvent être incomplets."
            : ` · ${formatNumber(creditPool.lotsRowCount)} ligne(s) chargée(s).`}
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {creditKpiCards.map((card) => (
            <article
              key={card.label}
              className={`nk-card relative rounded-3xl border border-l-4 border-slate-200/80 ${card.accent} p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.72)_inset]`}
            >
              {card.metric ? <TrendBadge metric={card.metric} /> : null}
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 ${
                  card.metric ? "pr-24" : "pr-4"
                }`}
              >
                {card.label}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-600">{card.subtitle}</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {card.value}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <DonutCard
          title="Répartition des offres"
          subtitle="Ventes Stripe réussies par offre normalisée."
          items={payload.offerBreakdown}
          colors={offerColors}
          valueLabel={(item) => `${formatNumber(item.sales ?? 0)} vente(s)`}
        />
        <DonutCard
          title="Statut des paiements"
          subtitle="Tous les paiements enregistrés sur la période."
          items={payload.statusBreakdown}
          colors={statusColors}
          valueLabel={(item) => `${formatNumber(item.count ?? 0)} paiement(s)`}
        />
      </section>

      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Évolution du chiffre d’affaires
            </p>
            <p className="mt-2 text-xs text-slate-600">
              CA Stripe uniquement · agrégation {period === 90 ? "par semaine" : "par jour"} sur {period}{" "}
              jours.
            </p>
          </div>
          <p className="text-xs font-semibold text-slate-700">Max {formatMoney(maxRevenue, currency)}</p>
        </div>

        <div className="mt-6 flex h-64 items-end gap-2 overflow-x-auto rounded-3xl border border-slate-200/70 bg-white/70 p-4 shadow-inner">
          {revenueSeries.map((point) => {
            const height = Math.max(4, (point.revenue / maxRevenue) * 100);
            return (
              <div key={point.key} className="flex min-w-9 flex-1 flex-col items-center justify-end gap-2">
                <div className="group relative flex h-48 w-full items-end justify-center">
                  <div
                    className="w-full rounded-t-2xl bg-[linear-gradient(180deg,#2563eb_0%,#06b6d4_100%)] shadow-[0_10px_24px_rgba(37,99,235,0.16)]"
                    style={{ height: `${height}%` }}
                  />
                  <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded-xl border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 shadow-lg group-hover:block">
                    {formatMoney(point.revenue, currency)} · {point.sales} vente(s)
                  </div>
                </div>
                <span className="whitespace-nowrap text-[10px] text-slate-500">{point.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Top workspaces</h2>
            <p className="mt-1 text-xs text-slate-500">Classement par CA décroissant.</p>
          </div>
          <p className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
            {topWorkspaces.length} ligne(s)
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50/90 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Workspace</th>
                <th className="px-4 py-3 font-semibold">Ventes</th>
                <th className="px-4 py-3 font-semibold">CA</th>
                <th className="px-4 py-3 font-semibold">Panier moyen</th>
                <th className="px-4 py-3 font-semibold">Dernier paiement</th>
                <th className="px-4 py-3 font-semibold">Offre dominante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {topWorkspaces.map((workspace) => (
                <tr key={workspace.workspaceId} className="bg-white transition hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-900">{workspace.workspaceName}</td>
                  <td className="px-4 py-3">{workspace.sales}</td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{formatMoney(workspace.revenue, currency)}</td>
                  <td className="px-4 py-3">{formatMoney(workspace.averageBasket, currency)}</td>
                  <td className="px-4 py-3">{formatDate(workspace.latestPayment)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${offerClass(workspace.dominantOffer)}`}>
                      {workspace.dominantOffer}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Dernières ventes</h2>
            <p className="mt-1 text-xs text-slate-500">Paiements récents sur la période active.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              list="admin-customer-emails"
              value={customerEmailQuery}
              onChange={(event) => setCustomerEmailQuery(event.target.value)}
              placeholder="Rechercher un client par email"
              className="h-9 min-w-[260px] rounded-full border border-slate-200 bg-slate-50/80 px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white"
            />
            <datalist id="admin-customer-emails">
              {customerEmails.map((email) => (
                <option key={email} value={email} />
              ))}
            </datalist>
            <Link
              href={selectedCustomerEmail ? `/dashboard/admin/customers/${encodeURIComponent(selectedCustomerEmail)}` : "#"}
              aria-disabled={!selectedCustomerEmail}
              className={`inline-flex h-9 items-center justify-center rounded-full border px-3 text-xs font-semibold transition ${
                selectedCustomerEmail
                  ? "border-slate-800 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
                  : "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
              }`}
            >
              Ouvrir la fiche
            </Link>
            <p className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
              {rows.length} ligne(s)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50/90 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Workspace</th>
                <th className="px-4 py-3 font-semibold">Offre</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Audits</th>
                <th className="px-4 py-3 font-semibold">Montant</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((row, index) => (
                <tr key={`${row.workspaceId}-${row.date ?? "na"}-${index}`} className="bg-white transition hover:bg-slate-50/80">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="px-4 py-3">{row.buyerEmail ?? "Client non identifié"}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.workspaceName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${offerClass(row.offer)}`}>
                      {row.offer}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.type}</td>
                  <td className="px-4 py-3">{row.auditsSold}</td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{formatMoney(row.amount, row.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass(row.status)}`}>
                      {formatStatus(row.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
