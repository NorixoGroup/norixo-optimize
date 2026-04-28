import { NextRequest, NextResponse } from "next/server";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";

export const runtime = "nodejs";

const PERIODS = [7, 30, 90] as const;

type PeriodDays = (typeof PERIODS)[number];

type BillingPaymentRow = {
  workspace_id: string;
  plan_code: string | null;
  payment_type: string | null;
  source: string | null;
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  paid_at: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
};

type WorkspaceRow = {
  id: string;
  name: string | null;
  slug: string | null;
  owner_user_id: string | null;
};

type AuditCreditLotRow = {
  granted_quantity: number | null;
  consumed_quantity: number | null;
  source_type: string | null;
  created_at: string | null;
};

const STRIPE_CREDIT_LOT_SOURCES = new Set([
  "stripe_checkout_pack",
  "stripe_checkout_audit_test",
]);

type NormalizedPayment = {
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
  /** Paiement compté dans le CA Stripe (hors manual / adjustment). */
  countsTowardStripeRevenue: boolean;
};

type KpiValues = {
  totalRevenue: number;
  totalSales: number;
  totalAuditsSold: number;
  averageBasket: number;
  paidWorkspaces: number;
  averageRevenuePerSale: number;
};

type KpiTrend = "up" | "down" | "neutral" | "new";

function getPeriodDays(request: NextRequest): PeriodDays {
  const raw = Number(request.nextUrl.searchParams.get("period") ?? 30);
  return PERIODS.includes(raw as PeriodDays) ? (raw as PeriodDays) : 30;
}

function parseAmount(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
  }
  return 0;
}

function getPaymentDate(row: BillingPaymentRow) {
  return row.paid_at ?? row.created_at ?? null;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isInPeriod(value: string | null, start: Date, end: Date) {
  const date = parseDate(value);
  return Boolean(date && date >= start && date <= end);
}

function isInPreviousPeriod(value: string | null, start: Date, end: Date) {
  const date = parseDate(value);
  return Boolean(date && date >= start && date < end);
}

function isSucceeded(status: string | null) {
  return (status ?? "").toLowerCase() === "succeeded";
}

/** CA Stripe : exclut ajustements manuels et enregistrements hors checkout/abonnement Stripe. */
function isStripeRevenuePayment(row: BillingPaymentRow) {
  const ptype = (row.payment_type ?? "").toLowerCase();
  if (ptype === "adjustment") return false;
  const src = (row.source ?? "").toLowerCase().trim();
  if (src === "manual") return false;
  if (src === "checkout" || src === "subscription") return true;
  if (!src || src === "unknown") return true;
  return false;
}

function mapOfferByAmount(amount: number) {
  const rounded = Math.round(amount);
  if (rounded === 9) return "Starter";
  if (rounded === 39) return "Pack 5 audits";
  if (rounded === 99) return "Pack 15 audits";
  return "Autre";
}

function mapAuditsSold(row: BillingPaymentRow) {
  const amount = Math.round(parseAmount(row.amount));
  if (amount === 9) return 1;
  if (amount === 39) return 5;
  if (amount === 99) return 15;

  const metadataQuantityRaw = row.metadata?.audit_quantity;
  const metadataQuantity =
    typeof metadataQuantityRaw === "number"
      ? metadataQuantityRaw
      : typeof metadataQuantityRaw === "string"
        ? Number(metadataQuantityRaw)
        : null;

  if (metadataQuantity && Number.isFinite(metadataQuantity) && metadataQuantity > 0) {
    return metadataQuantity;
  }

  switch ((row.plan_code ?? "").toLowerCase()) {
    case "starter":
    case "audit_test":
      return 1;
    case "pro":
    case "pack_5":
      return 5;
    case "scale":
    case "pack_15":
      return 15;
    default:
      return 0;
  }
}

function mapTypeLabel(paymentType: string | null) {
  switch ((paymentType ?? "").toLowerCase()) {
    case "one_shot":
      return "Audit unique";
    case "subscription":
      return "Abonnement";
    case "pack":
      return "Pack";
    case "credit":
      return "Crédit";
    case "adjustment":
      return "Ajustement";
    default:
      return paymentType ?? "—";
  }
}

function mapStatusBucket(status: string) {
  switch (status.toLowerCase()) {
    case "succeeded":
      return "Succès";
    case "failed":
      return "Échec";
    case "refunded":
    case "partially_refunded":
      return "Remboursé";
    default:
      return "Autre";
  }
}

function getDominantOffer(rows: NormalizedPayment[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.offer, (totals.get(row.offer) ?? 0) + row.amount);
  }

  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Autre";
}

function formatBucketLabel(date: Date, weekly: boolean) {
  if (weekly) {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date);
  }

  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date);
}

function buildRevenueSeries(rows: NormalizedPayment[], periodDays: PeriodDays, now: Date) {
  const weekly = periodDays === 90;
  const bucketCount = weekly ? 13 : periodDays;
  const bucketMs = (weekly ? 7 : 1) * 24 * 60 * 60 * 1000;
  const start = new Date(now.getTime() - (bucketCount - 1) * bucketMs);
  start.setUTCHours(0, 0, 0, 0);

  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(start.getTime() + index * bucketMs);
    return {
      key: bucketStart.toISOString(),
      label: formatBucketLabel(bucketStart, weekly),
      revenue: 0,
      sales: 0,
    };
  });

  for (const row of rows) {
    const date = parseDate(row.date);
    if (!date) continue;
    const index = Math.floor((date.getTime() - start.getTime()) / bucketMs);
    if (index < 0 || index >= buckets.length) continue;
    buckets[index].revenue += row.amount;
    buckets[index].sales += 1;
  }

  return buckets;
}

function buildKpiValues(rows: NormalizedPayment[]): KpiValues {
  const totalRevenue = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalSales = rows.length;
  const totalAuditsSold = rows.reduce((sum, row) => sum + row.auditsSold, 0);
  const averageBasket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const paidWorkspaces = new Set(rows.map((row) => row.workspaceId).filter(Boolean)).size;

  return {
    totalRevenue,
    totalSales,
    totalAuditsSold,
    averageBasket,
    paidWorkspaces,
    averageRevenuePerSale: totalSales > 0 ? totalRevenue / totalSales : 0,
  };
}

function sumGranted(lots: AuditCreditLotRow[]) {
  return lots.reduce((sum, lot) => sum + Math.max(0, Number(lot.granted_quantity ?? 0)), 0);
}

function isStripeCreditLotSource(sourceType: string | null) {
  return STRIPE_CREDIT_LOT_SOURCES.has((sourceType ?? "").toLowerCase());
}

function isManualCreditLotSource(sourceType: string | null) {
  return (sourceType ?? "").toLowerCase() === "manual_adjustment";
}

function buildKpiMetric(current: number, previous: number) {
  if (previous === 0) {
    return {
      current,
      previous,
      deltaPct: current > 0 ? null : 0,
      trend: (current > 0 ? "new" : "neutral") as KpiTrend,
    };
  }

  const deltaPct = ((current - previous) / previous) * 100;
  const trend: KpiTrend = deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "neutral";

  return {
    current,
    previous,
    deltaPct,
    trend,
  };
}

export async function GET(request: NextRequest) {
  const requestClient = createRequestSupabaseClient(request);
  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminPrivateEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const periodDays = getPeriodDays(request);
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const previousPeriodStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from("billing_payments")
    .select(
      "workspace_id, plan_code, payment_type, source, amount, currency, status, paid_at, created_at, metadata"
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  if (paymentsError) {
    console.error("[admin][sales] failed to load billing_payments", paymentsError);
    return NextResponse.json(
      { error: "Unable to load sales data" },
      { status: 500 }
    );
  }

  const paymentRows = ((payments ?? []) as BillingPaymentRow[]).filter((row) =>
    isInPeriod(getPaymentDate(row), previousPeriodStart, now)
  );

  const workspaceIds = Array.from(
    new Set(paymentRows.map((row) => row.workspace_id).filter(Boolean))
  );

  const workspaceMap = new Map<string, WorkspaceRow>();

  if (workspaceIds.length > 0) {
    const { data: workspaces, error: workspacesError } = await supabaseAdmin
      .from("workspaces")
      .select("id,name,slug,owner_user_id")
      .in("id", workspaceIds);

    if (workspacesError) {
      console.error("[admin][sales] failed to load workspaces", workspacesError);
    } else {
      for (const workspace of (workspaces ?? []) as WorkspaceRow[]) {
        workspaceMap.set(workspace.id, workspace);
      }
    }
  }

  const ownerIds = Array.from(
    new Set(
      Array.from(workspaceMap.values())
        .map((workspace) => workspace.owner_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const ownerEmailMap = new Map<string, string>();

  await Promise.all(
    ownerIds.map(async (ownerId) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(ownerId);
      if (error) {
        console.warn("[admin][sales] failed to resolve owner email", {
          ownerId,
          error,
        });
        return;
      }

      const email = data.user?.email;
      if (email) {
        ownerEmailMap.set(ownerId, email);
      }
    })
  );

  const { data: creditLots, error: creditLotsError } = await supabaseAdmin
    .from("audit_credit_lots")
    .select("granted_quantity, consumed_quantity, source_type, created_at")
    .order("created_at", { ascending: false })
    .limit(15000);

  if (creditLotsError) {
    console.warn("[admin][sales] failed to load audit_credit_lots", creditLotsError);
  }

  const lotRows = (creditLots ?? []) as AuditCreditLotRow[];

  const lotsCurrentPeriod = lotRows.filter((lot) => isInPeriod(lot.created_at, periodStart, now));
  const lotsPreviousPeriod = lotRows.filter((lot) =>
    isInPreviousPeriod(lot.created_at, previousPeriodStart, periodStart)
  );

  const stripeCreditsGrantedPeriod = sumGranted(
    lotsCurrentPeriod.filter((lot) => isStripeCreditLotSource(lot.source_type))
  );
  const manualCreditsGrantedPeriod = sumGranted(
    lotsCurrentPeriod.filter((lot) => isManualCreditLotSource(lot.source_type))
  );

  console.info("[admin][credits-period]", {
    selectedPeriodDays: periodDays,
    periodStartDate: periodStart.toISOString(),
    creditLotsBefore: lotRows.length,
    creditLotsAfter: lotsCurrentPeriod.length,
    stripeCreditsPeriod: stripeCreditsGrantedPeriod,
    manualCreditsPeriod: manualCreditsGrantedPeriod,
  });

  const stripeCreditsGrantedPreviousPeriod = sumGranted(
    lotsPreviousPeriod.filter((lot) => isStripeCreditLotSource(lot.source_type))
  );
  const manualCreditsGrantedPreviousPeriod = sumGranted(
    lotsPreviousPeriod.filter((lot) => isManualCreditLotSource(lot.source_type))
  );

  const totalGrantedAllLots = lotRows.reduce(
    (sum, lot) => sum + Math.max(0, Number(lot.granted_quantity ?? 0)),
    0
  );
  const totalConsumedAllLots = lotRows.reduce(
    (sum, lot) => sum + Math.max(0, Number(lot.consumed_quantity ?? 0)),
    0
  );
  const creditsRemainingGlobal = Math.max(totalGrantedAllLots - totalConsumedAllLots, 0);

  const normalizedRows = paymentRows
    .map((row) => {
      const workspace = workspaceMap.get(row.workspace_id);
      const amount = parseAmount(row.amount);
      const auditsSold = mapAuditsSold(row);
      const customerEmail =
        typeof row.metadata?.customer_email === "string"
          ? row.metadata.customer_email
          : typeof row.metadata?.customerEmail === "string"
            ? row.metadata.customerEmail
            : null;

      return {
        date: getPaymentDate(row),
        workspaceId: row.workspace_id,
        workspaceName:
          workspace?.name?.trim() || workspace?.slug?.trim() || row.workspace_id || "Workspace inconnu",
        buyerEmail: customerEmail ?? (workspace?.owner_user_id ? (ownerEmailMap.get(workspace.owner_user_id) ?? null) : null),
        offer: mapOfferByAmount(amount),
        planCode: row.plan_code,
        type: mapTypeLabel(row.payment_type),
        paymentType: row.payment_type,
        auditsSold,
        amount,
        currency: (row.currency ?? "eur").toLowerCase(),
        status: row.status ?? "unknown",
        countsTowardStripeRevenue: isStripeRevenuePayment(row),
      };
    })
    .sort((a, b) => (parseDate(b.date)?.getTime() ?? 0) - (parseDate(a.date)?.getTime() ?? 0));

  const currentRows = normalizedRows.filter((row) => isInPeriod(row.date, periodStart, now));
  const previousRows = normalizedRows.filter((row) =>
    isInPreviousPeriod(row.date, previousPeriodStart, periodStart)
  );
  const successfulRows = currentRows.filter((row) => isSucceeded(row.status));
  const previousSuccessfulRows = previousRows.filter((row) => isSucceeded(row.status));
  const successfulStripeRows = successfulRows.filter((row) => row.countsTowardStripeRevenue);
  const previousSuccessfulStripeRows = previousSuccessfulRows.filter(
    (row) => row.countsTowardStripeRevenue
  );

  const currentKpis = buildKpiValues(successfulStripeRows);
  const previousKpis = buildKpiValues(previousSuccessfulStripeRows);

  const offerBreakdown = ["Starter", "Pack 5 audits", "Pack 15 audits", "Autre"].map((label) => {
    const offerRows = successfulStripeRows.filter((row) => row.offer === label);
    const revenue = offerRows.reduce((sum, row) => sum + row.amount, 0);
    return {
      label,
      sales: offerRows.length,
      revenue,
      percent: currentKpis.totalSales > 0 ? (offerRows.length / currentKpis.totalSales) * 100 : 0,
    };
  }).filter((item) => item.sales > 0 || item.label !== "Autre");

  const statusBreakdown = ["Succès", "Échec", "Remboursé", "Autre"].map((label) => {
    const count = currentRows.filter((row) => mapStatusBucket(row.status) === label).length;
    return {
      label,
      count,
      percent: currentRows.length > 0 ? (count / currentRows.length) * 100 : 0,
    };
  });

  const workspaceGroups = new Map<string, NormalizedPayment[]>();
  for (const row of successfulStripeRows) {
    const group = workspaceGroups.get(row.workspaceId) ?? [];
    group.push(row);
    workspaceGroups.set(row.workspaceId, group);
  }

  const topWorkspaces = Array.from(workspaceGroups.entries())
    .map(([workspaceId, rows]) => {
      const revenue = rows.reduce((sum, row) => sum + row.amount, 0);
      const sales = rows.length;
      const latestPayment = rows
        .map((row) => row.date)
        .filter(Boolean)
        .sort((a, b) => (parseDate(b)?.getTime() ?? 0) - (parseDate(a)?.getTime() ?? 0))[0] ?? null;

      return {
        workspaceId,
        workspaceName: rows[0]?.workspaceName ?? workspaceId,
        sales,
        revenue,
        averageBasket: sales > 0 ? revenue / sales : 0,
        latestPayment,
        dominantOffer: getDominantOffer(rows),
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    adminEmail: user.email ?? null,
    period: {
      days: periodDays,
      start: periodStart.toISOString(),
      end: now.toISOString(),
    },
    stripeKpis: {
      revenue: buildKpiMetric(currentKpis.totalRevenue, previousKpis.totalRevenue),
      sales: buildKpiMetric(currentKpis.totalSales, previousKpis.totalSales),
      avgBasket: buildKpiMetric(currentKpis.averageBasket, previousKpis.averageBasket),
      paidWorkspaces: buildKpiMetric(currentKpis.paidWorkspaces, previousKpis.paidWorkspaces),
      auditsSold: buildKpiMetric(currentKpis.totalAuditsSold, previousKpis.totalAuditsSold),
      revenuePerSale: buildKpiMetric(currentKpis.averageRevenuePerSale, previousKpis.averageRevenuePerSale),
    },
    creditPool: {
      lotsRowCount: lotRows.length,
      lotsTruncated: lotRows.length >= 15000,
      lots: lotsCurrentPeriod.map((lot) => ({
        created_at: lot.created_at,
        source_type: lot.source_type,
        granted_quantity: lot.granted_quantity,
      })),
      period: {
        stripeCreditsGranted: stripeCreditsGrantedPeriod,
        manualCreditsGranted: manualCreditsGrantedPeriod,
        stripeCreditsGrantedTrend: buildKpiMetric(
          stripeCreditsGrantedPeriod,
          stripeCreditsGrantedPreviousPeriod
        ),
        manualCreditsGrantedTrend: buildKpiMetric(
          manualCreditsGrantedPeriod,
          manualCreditsGrantedPreviousPeriod
        ),
      },
      global: {
        totalGranted: totalGrantedAllLots,
        totalConsumed: totalConsumedAllLots,
        creditsRemaining: creditsRemainingGlobal,
      },
    },
    offerBreakdown,
    statusBreakdown,
    revenueSeries: buildRevenueSeries(successfulStripeRows, periodDays, now),
    topWorkspaces,
    rows: currentRows.slice(0, 50),
  });
}
