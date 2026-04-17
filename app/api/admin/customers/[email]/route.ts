import { NextRequest, NextResponse } from "next/server";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";

export const runtime = "nodejs";

type BillingPaymentRow = {
  workspace_id: string;
  plan_code: string | null;
  payment_type: string | null;
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
  created_at?: string | null;
};

type AuditRow = {
  id: string;
  workspace_id: string;
  listing_id: string | null;
  overall_score: number | null;
  created_at: string | null;
};

type ListingRow = {
  id: string;
  title: string | null;
};

function parseAmount(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
  }
  return 0;
}

function paymentDate(row: BillingPaymentRow) {
  return row.paid_at ?? row.created_at ?? null;
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

  const raw = row.metadata?.audit_quantity;
  const quantity = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : 0;
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
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
    default:
      return paymentType ?? "—";
  }
}

function metadataEmail(row: BillingPaymentRow) {
  const raw = row.metadata?.customer_email ?? row.metadata?.customerEmail;
  return typeof raw === "string" ? raw.trim().toLowerCase() : null;
}

function parseDate(value: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ email: string }> }
) {
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

  const { email } = await context.params;
  const customerEmail = decodeURIComponent(email).trim().toLowerCase();

  if (!customerEmail) {
    return NextResponse.json({ error: "Missing customer email" }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from("billing_payments")
    .select("workspace_id, plan_code, payment_type, amount, currency, status, paid_at, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (paymentsError) {
    console.error("[admin][customer] failed to load payments", paymentsError);
    return NextResponse.json({ error: "Unable to load customer data" }, { status: 500 });
  }

  const paymentRows = (payments ?? []) as BillingPaymentRow[];
  const workspaceIds = Array.from(new Set(paymentRows.map((row) => row.workspace_id).filter(Boolean)));
  const workspaceMap = new Map<string, WorkspaceRow>();

  if (workspaceIds.length > 0) {
    const { data: workspaces, error: workspacesError } = await supabaseAdmin
      .from("workspaces")
      .select("id,name,slug,owner_user_id,created_at")
      .in("id", workspaceIds);

    if (workspacesError) {
      console.warn("[admin][customer] failed to load workspaces", workspacesError);
    } else {
      for (const workspace of (workspaces ?? []) as WorkspaceRow[]) {
        workspaceMap.set(workspace.id, workspace);
      }
    }
  }

  const ownerIds = Array.from(
    new Set(Array.from(workspaceMap.values()).map((workspace) => workspace.owner_user_id).filter((value): value is string => Boolean(value)))
  );
  const ownerEmailMap = new Map<string, string>();

  await Promise.all(
    ownerIds.map(async (ownerId) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(ownerId);
      const email = data.user?.email?.trim().toLowerCase();
      if (email) ownerEmailMap.set(ownerId, email);
    })
  );

  const customerPayments = paymentRows
    .filter((row) => {
      const workspace = workspaceMap.get(row.workspace_id);
      const ownerEmail = workspace?.owner_user_id ? ownerEmailMap.get(workspace.owner_user_id) : null;
      return metadataEmail(row) === customerEmail || ownerEmail === customerEmail;
    })
    .map((row) => {
      const amount = parseAmount(row.amount);
      const workspace = workspaceMap.get(row.workspace_id);
      return {
        date: paymentDate(row),
        workspaceId: row.workspace_id,
        workspaceName: workspace?.name?.trim() || workspace?.slug?.trim() || row.workspace_id || "Workspace inconnu",
        offer: mapOfferByAmount(amount),
        type: mapTypeLabel(row.payment_type),
        auditsSold: mapAuditsSold(row),
        amount,
        currency: (row.currency ?? "eur").toLowerCase(),
        status: row.status ?? "unknown",
      };
    })
    .sort((a, b) => parseDate(b.date) - parseDate(a.date));

  const customerWorkspaceIds = Array.from(new Set(customerPayments.map((row) => row.workspaceId).filter(Boolean)));
  const customerWorkspaces = customerWorkspaceIds.map((id) => {
    const workspace = workspaceMap.get(id);
    return {
      id,
      name: workspace?.name?.trim() || workspace?.slug?.trim() || id,
      slug: workspace?.slug ?? null,
      createdAt: workspace?.created_at ?? null,
    };
  });

  const { data: auditsData, error: auditsError } = customerWorkspaceIds.length > 0
    ? await supabaseAdmin
        .from("audits")
        .select("id,workspace_id,listing_id,overall_score,created_at")
        .in("workspace_id", customerWorkspaceIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };

  if (auditsError) {
    console.warn("[admin][customer] failed to load audits", auditsError);
  }

  const auditRows = (auditsData ?? []) as AuditRow[];
  const listingIds = Array.from(new Set(auditRows.map((audit) => audit.listing_id).filter((value): value is string => Boolean(value))));
  const listingMap = new Map<string, string>();

  if (listingIds.length > 0) {
    const { data: listings } = await supabaseAdmin
      .from("listings")
      .select("id,title")
      .in("id", listingIds);

    for (const listing of (listings ?? []) as ListingRow[]) {
      listingMap.set(listing.id, listing.title ?? "Annonce sans titre");
    }
  }

  const audits = auditRows.map((audit) => ({
    id: audit.id,
    workspaceId: audit.workspace_id,
    workspaceName: workspaceMap.get(audit.workspace_id)?.name ?? workspaceMap.get(audit.workspace_id)?.slug ?? audit.workspace_id,
    listingTitle: audit.listing_id ? listingMap.get(audit.listing_id) ?? "Annonce sans titre" : "Annonce sans titre",
    createdAt: audit.created_at,
    score: audit.overall_score,
  }));

  const successfulPayments = customerPayments.filter((payment) => payment.status.toLowerCase() === "succeeded");
  const revenue = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const auditsSold = successfulPayments.reduce((sum, payment) => sum + payment.auditsSold, 0);

  return NextResponse.json({
    email: customerEmail,
    summary: {
      totalSales: successfulPayments.length,
      revenue,
      auditsSold,
      lastPaymentAt: customerPayments[0]?.date ?? null,
    },
    workspaces: customerWorkspaces,
    payments: customerPayments,
    audits,
  });
}
