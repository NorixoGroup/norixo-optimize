"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

/** Alias des lignes `audit_credit_lots` renvoyées par `/api/admin/sales` (fenêtre courante). */
type AuditCreditLotRow = {
  created_at: string | null;
  source_type: string | null;
  granted_quantity: number | null;
};

type CreditPoolPayload = {
  lotsRowCount: number;
  lotsTruncated: boolean;
  /** Lots dont `created_at` est dans la période courante (filtre déjà fait côté API ; re-filtré côté client sur `period.start` / `period.end`). */
  lots?: AuditCreditLotRow[];
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
  /** Métadonnées optionnelles si l’API les expose (priorité au pivot offres). */
  offerName?: string | null;
  planName?: string | null;
  priceId?: string | null;
  /** Aligné billing_payments.source lorsque présent. */
  source?: string | null;
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

function parsePeriodDaysFromSearchParams(searchParams: URLSearchParams): PeriodDays {
  const raw = searchParams.get("period");
  const n = raw === null || raw === "" ? NaN : Number(raw);
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}

/** Aligné sur l’API `/api/admin/sales` (`getPaymentDate`, `isSucceeded`, `isStripeRevenuePayment`). */
function parseSalesRowDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isSucceededPaymentRow(status: string): boolean {
  return (status ?? "").toLowerCase() === "succeeded";
}

function isStripeRevenueSalesRow(row: SalesRow): boolean {
  const ptype = (row.paymentType ?? "").toLowerCase();
  if (ptype === "adjustment") return false;
  if (ptype === "manual") return false;
  return true;
}

function salesRowPaidAtInBillingPeriod(row: SalesRow, periodStartIso: string, periodEndIso: string): boolean {
  const d = parseSalesRowDate(row.date);
  if (!d) return false;
  const t = d.getTime();
  return t >= new Date(periodStartIso).getTime() && t <= new Date(periodEndIso).getTime();
}

function auditCreditLotOnOrAfter(lot: AuditCreditLotRow, periodStartDate: Date): boolean {
  if (!lot.created_at) return false;
  const t = new Date(lot.created_at).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= periodStartDate.getTime();
}

/** Pivot offres : offer_name → plan_name → price_id → compat offer/plan_code → sinon Autre */
function paymentOfferGroupLabel(row: SalesRow): string {
  const fromOfferName = row.offerName?.trim();
  if (fromOfferName) return fromOfferName;
  const fromPlanName = row.planName?.trim();
  if (fromPlanName) return fromPlanName;
  const fromPriceId = row.priceId?.trim();
  if (fromPriceId) return fromPriceId;
  const fromOffer = row.offer?.trim();
  if (fromOffer) return fromOffer;
  const fromPlanCode = row.planCode?.trim();
  if (fromPlanCode) return fromPlanCode;
  return "Autre";
}

function buildOfferBreakdownFromRows(rows: SalesRow[]): BreakdownItem[] {
  const total = rows.length;
  if (total === 0) return [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = paymentOfferGroupLabel(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const items = Array.from(counts.entries()).map(([label, count]) => ({
    label,
    sales: count,
    count,
    percent: (count / total) * 100,
  }));

  return items.sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0));
}

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

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedPeriodDays = useMemo(
    () => parsePeriodDaysFromSearchParams(searchParams),
    [searchParams]
  );

  /** Ancre temporelle unique côté client : maintenant − selectedPeriodDays (sans lecture directe billing_payments sur le client). */
  const periodStartDate = useMemo(() => {
    const d = new Date();
    d.setTime(d.getTime() - selectedPeriodDays * 24 * 60 * 60 * 1000);
    return d;
  }, [selectedPeriodDays]);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SalesResponse | null>(null);
  const [customerEmailQuery, setCustomerEmailQuery] = useState("");

  const paymentsDebugPrevRef = useRef<{ payments: number; creditLots: number }>({
    payments: 0,
    creditLots: 0,
  });

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
        const response = await fetch(`/api/admin/sales?period=${selectedPeriodDays}`, {
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

          setPayload(null);
          setError(data?.error ?? "Impossible de charger les données admin.");
          setLoading(false);
          return;
        }

        const data = (await response.json()) as SalesResponse;
        setPayload(data);
        setLoading(false);
      } catch (loadError) {
        if (!mounted) return;
        setPayload(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les données admin."
        );
        setLoading(false);
      }
    }

    void loadSales();

    return () => {
      mounted = false;
    };
  }, [selectedPeriodDays, router]);

  useEffect(() => {
    if (!payload) return;

    const paymentsAfter = payload.rows.length;
    const creditLotsAfter = payload.creditPool.lotsRowCount;

    console.info("[admin][period-filter]", {
      selectedPeriodDays,
      periodStartDate,
      paymentsBefore: paymentsDebugPrevRef.current.payments,
      paymentsAfter,
      creditLotsBefore: paymentsDebugPrevRef.current.creditLots,
      creditLotsAfter,
    });

    paymentsDebugPrevRef.current = {
      payments: paymentsAfter,
      creditLots: creditLotsAfter,
    };
  }, [payload, selectedPeriodDays, periodStartDate]);

  const currency = useMemo(() => {
    const firstCurrency = payload?.rows.find((row) => row.currency)?.currency;
    return firstCurrency ?? "eur";
  }, [payload?.rows]);

  const stripeRevenuePeriodRows = useMemo(() => {
    if (!payload?.period?.start || !payload?.period?.end) return [] as SalesRow[];
    const { start: startIso, end: endIso } = payload.period;
    return payload.rows.filter(
      (row) =>
        isSucceededPaymentRow(row.status) &&
        isStripeRevenueSalesRow(row) &&
        salesRowPaidAtInBillingPeriod(row, startIso, endIso),
    );
  }, [payload?.rows, payload?.period?.start, payload?.period?.end]);

  const stripeRevenueAggregates = useMemo(() => {
    const rows = stripeRevenuePeriodRows;
    let totalRevenue = 0;
    let soldAuditsCount = 0;
    const workspaceIds = new Set<string>();
    for (const row of rows) {
      totalRevenue += row.amount;
      soldAuditsCount += row.auditsSold;
      if (row.workspaceId) workspaceIds.add(row.workspaceId);
    }
    const salesCount = rows.length;
    const averageOrderValue = salesCount > 0 ? totalRevenue / salesCount : 0;
    return {
      totalRevenue,
      salesCount,
      averageOrderValue,
      soldAuditsCount,
      payingWorkspacesCount: workspaceIds.size,
    };
  }, [stripeRevenuePeriodRows]);

  const stripeRevenueKpiCards = useMemo(() => {
    if (!payload) return [] as Array<{
      label: string;
      value: string;
      metric: KpiMetric;
      accent: string;
    }>;
    const kpis = payload.stripeKpis;
    const s = stripeRevenueAggregates;
    return [
      {
        label: "CA Stripe (encaissé)",
        value: formatMoney(s.totalRevenue, currency),
        metric: { ...kpis.revenue, current: s.totalRevenue },
        accent:
          "border-l-emerald-500/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.15),transparent_34%),linear-gradient(180deg,#ffffff_0%,#ecfdf5_100%)]",
      },
      {
        label: "Ventes Stripe",
        value: formatNumber(s.salesCount),
        metric: { ...kpis.sales, current: s.salesCount },
        accent:
          "border-l-sky-500/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)]",
      },
      {
        label: "Panier moyen (Stripe)",
        value: formatMoney(s.averageOrderValue, currency),
        metric: { ...kpis.avgBasket, current: s.averageOrderValue },
        accent:
          "border-l-amber-500/80 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.15),transparent_34%),linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)]",
      },
      {
        label: "Workspaces avec paiement Stripe",
        value: formatNumber(s.payingWorkspacesCount),
        metric: { ...kpis.paidWorkspaces, current: s.payingWorkspacesCount },
        accent:
          "border-l-indigo-500/80 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)]",
      },
      {
        label: "Audits vendus (Stripe)",
        value: formatNumber(s.soldAuditsCount),
        metric: { ...kpis.auditsSold, current: s.soldAuditsCount },
        accent:
          "border-l-cyan-500/80 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#ecfeff_100%)]",
      },
      {
        label: "CA moyen / vente Stripe",
        value: formatMoney(s.averageOrderValue, currency),
        metric: { ...kpis.revenuePerSale, current: s.averageOrderValue },
        accent:
          "border-l-violet-500/80 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.13),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f5f3ff_100%)]",
      },
    ];
  }, [payload, stripeRevenueAggregates, currency]);

  useEffect(() => {
    if (!payload?.period?.start) return;
    const stripePaymentsBefore = payload.rows.filter((row) =>
      salesRowPaidAtInBillingPeriod(row, payload.period.start, payload.period.end),
    ).length;
    const stripePaymentsAfter = stripeRevenuePeriodRows.length;
    console.info("[admin][stripe-revenue-period]", {
      selectedPeriodDays,
      periodStartDate,
      stripePaymentsBefore,
      stripePaymentsAfter,
      totalRevenue: stripeRevenueAggregates.totalRevenue,
      salesCount: stripeRevenueAggregates.salesCount,
      averageOrderValue: stripeRevenueAggregates.averageOrderValue,
      soldAuditsCount: stripeRevenueAggregates.soldAuditsCount,
      payingWorkspacesCount: stripeRevenueAggregates.payingWorkspacesCount,
    });
  }, [
    payload,
    selectedPeriodDays,
    periodStartDate,
    stripeRevenuePeriodRows,
    stripeRevenueAggregates,
  ]);

  const periodCreditLots = useMemo(() => {
    const lots = payload?.creditPool.lots;
    if (lots === undefined) return [] as AuditCreditLotRow[];
    return lots.filter((lot) => auditCreditLotOnOrAfter(lot, periodStartDate));
  }, [payload?.creditPool?.lots, periodStartDate]);

  const creditsPeriodMetrics = useMemo(() => {
    if (!payload?.creditPool) {
      return { stripeCreditsPeriod: 0, manualCreditsPeriod: 0 };
    }
    const pool = payload.creditPool;
    if (pool.lots === undefined) {
      return {
        stripeCreditsPeriod: pool.period.stripeCreditsGranted,
        manualCreditsPeriod: pool.period.manualCreditsGranted,
      };
    }

    let stripeCreditsPeriod = 0;
    let manualCreditsPeriod = 0;

    for (const lot of periodCreditLots) {
      const granted = Math.max(0, Number(lot.granted_quantity ?? 0));
      const src = (lot.source_type ?? "").trim().toLowerCase();
      if (src === "stripe_checkout") stripeCreditsPeriod += granted;
      if (src === "manual_adjustment") manualCreditsPeriod += granted;
    }
    return {
      stripeCreditsPeriod,
      manualCreditsPeriod,
    };
  }, [payload?.creditPool, periodCreditLots]);

  /** équivalent données facturées disponibles dans `payload.rows` (filtre client sur la même ancre que les crédits). */
  const periodStripePayments = useMemo(() => {
    if (!payload?.rows) return [] as SalesRow[];
    return payload.rows.filter((row) => {
      if (!row.date) return false;
      const t = new Date(row.date).getTime();
      if (!Number.isFinite(t) || t < periodStartDate.getTime()) return false;
      if (!isSucceededPaymentRow(row.status)) return false;
      if ((row.source ?? "").toLowerCase() === "manual") return false;
      if ((row.paymentType ?? "").toLowerCase() === "adjustment") return false;
      return true;
    });
  }, [payload?.rows, periodStartDate]);

  const computedOfferBreakdown = useMemo(
    () => buildOfferBreakdownFromRows(periodStripePayments),
    [periodStripePayments],
  );

  useEffect(() => {
    if (!payload) return;
    console.log("[admin][credits-offers-period]", {
      selectedPeriodDays,
      periodStartDate: periodStartDate.toISOString(),
      creditLotsBefore: payload.creditPool.lotsRowCount,
      creditLotsAfter: periodCreditLots.length,
      paymentsBefore: payload.rows.length,
      paymentsAfter: periodStripePayments.length,
      stripeCreditsPeriod: creditsPeriodMetrics.stripeCreditsPeriod,
      manualCreditsPeriod: creditsPeriodMetrics.manualCreditsPeriod,
      offersCount: periodStripePayments.length,
    });
  }, [
    payload,
    selectedPeriodDays,
    periodStartDate,
    periodCreditLots,
    periodStripePayments,
    creditsPeriodMetrics,
  ]);

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

  const { creditPool, rows, revenueSeries, topWorkspaces } = payload;
  const maxRevenue = Math.max(...revenueSeries.map((point) => point.revenue), 1);
  const customerEmails = Array.from(
    new Set(rows.map((row) => row.buyerEmail?.trim().toLowerCase()).filter((email): email is string => Boolean(email)))
  ).sort();
  const selectedCustomerEmail = customerEmailQuery.trim().toLowerCase();

  const creditKpiCards: Array<{
    label: string;
    subtitle: string;
    value: string;
    accent: string;
    metric?: KpiMetric;
  }> = [
    {
      label: "Crédits accordés via Stripe (période)",
      subtitle:
        "Somme des granted_quantity avec source_type = stripe_checkout.",
      value: formatNumber(creditsPeriodMetrics.stripeCreditsPeriod),
      metric: {
        ...creditPool.period.stripeCreditsGrantedTrend,
        current: creditsPeriodMetrics.stripeCreditsPeriod,
      },
      accent:
        "border-l-teal-500/80 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]",
    },
    {
      label: "Crédits manuels accordés (période)",
      subtitle: "Lots source_type = manual_adjustment, sur la période sélectionnée.",
      value: formatNumber(creditsPeriodMetrics.manualCreditsPeriod),
      metric: {
        ...creditPool.period.manualCreditsGrantedTrend,
        current: creditsPeriodMetrics.manualCreditsPeriod,
      },
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
              <Link
                key={item.value}
                href={`/dashboard/admin?period=${item.value}`}
                scroll={false}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  selectedPeriodDays === item.value
                    ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <h2 className="text-sm font-semibold tracking-tight text-slate-950">
            Stripe — chiffre d’affaires
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Source{" "}
            <code className="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 shadow-sm">
              billing_payments
            </code>{" "}
            · statut réussi · exclut{" "}
            <code className="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 shadow-sm">
              source=manual
            </code>{" "}
            et{" "}
            <code className="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 shadow-sm">
              payment_type=adjustment
            </code>
            .
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stripeRevenueKpiCards.map((card) => (
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

      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <h2 className="text-sm font-semibold tracking-tight text-slate-950">
            Crédits — stocks et manuels
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Source{" "}
            <code className="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 shadow-sm">
              audit_credit_lots
            </code>
            {creditPool.lotsTruncated
              ? " · Attention : limite de chargement atteinte, les totaux globaux peuvent être incomplets."
              : ` · ${formatNumber(creditPool.lotsRowCount)} ligne(s) chargée(s).`}
          </p>
        </div>
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
          items={computedOfferBreakdown}
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
              CA Stripe uniquement · agrégation {selectedPeriodDays === 90 ? "par semaine" : "par jour"} sur{" "}
              {selectedPeriodDays} jours.
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

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="nk-card rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Chargement du dashboard admin…
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
