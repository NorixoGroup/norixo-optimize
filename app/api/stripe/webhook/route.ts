import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/stripe/server";
import { alertIfWorkspaceIsAnomaly } from "@/lib/billing/alertIfWorkspaceIsAnomaly";
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type CheckoutSessionEvent = {
  id?: string;
  customer?: string | null;
  subscription?: string | null;
  metadata?: {
    workspace_id?: string;
    workspaceId?: string;
    user_id?: string;
    userId?: string;
    plan?: string;
    plan_code?: string;
    credit_quantity?: string;
    billing_interval?: string;
    audit_listing_url?: string;
    audit_title?: string;
    audit_platform?: string;
    audit_generated_at?: string;
    audit_score?: string;
    audit_summary?: string;
    audit_quantity?: string;
    checkout_intent_id?: string;
  } | null;
};

type SubscriptionEvent = {
  id?: string;
  customer?: string;
  status?: string;
  current_period_end?: number;
  items?: {
    data?: Array<{
      current_period_end?: number;
      price?: {
        id?: string;
        recurring?: {
          interval?: string;
        } | null;
      } | null;
    }>;
  };
  metadata?: {
    workspace_id?: string;
    user_id?: string;
    plan?: string;
    billing_interval?: string;
  } | null;
};

type InvoiceEvent = {
  id?: string;
  subscription?: string | null;
  customer?: string | null;
  status?: string | null;
  amount_paid?: number | null;
  currency?: string | null;
  payment_intent?: string | null;
};

const WEBHOOK_SECURITY = "[stripe][webhook][security]";

function logStripeCreditWorkspaceBindingAccepted(params: {
  eventType: string;
  sessionId: string | null;
  metadataWorkspaceId: string;
  customerId: string | null;
  planCode: string;
  grantedQuantity: number;
  insertedWorkspaceId: string;
  /** Paiement Checkout `mode: payment` validé sans `session.customer` (métadonnées + intent + accès workspace) */
  oneShotCustomerAbsentAccepted?: boolean;
}) {
  console.info("[stripe][webhook][credit_workspace_binding]", params);
}

function parseCheckoutMetadataPlan(
  raw: string | undefined | null
): "audit_test" | "pro" | "scale" | "starter" | null {
  if (raw === "audit_test" || raw === "pro" || raw === "scale" || raw === "starter") {
    return raw;
  }
  return null;
}

function expectedCheckoutPriceIdForPlan(
  plan: "audit_test" | "pro" | "scale" | "starter"
): string | null {
  if (plan === "audit_test" || plan === "starter") {
    return process.env.STRIPE_AUDIT_TEST_PRICE_ID ?? process.env.STRIPE_STARTER_PRICE_ID ?? null;
  }
  if (plan === "pro") {
    return process.env.STRIPE_PACK_5_PRICE_ID ?? null;
  }
  return process.env.STRIPE_PACK_15_PRICE_ID ?? null;
}

async function workspaceUserMayAccessWorkspace(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { data: member } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (member?.workspace_id) {
    return true;
  }

  const { data: owned } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  return Boolean(owned?.id);
}

function isCheckoutIntentUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function syncCheckoutIntentCompletedBySessionId(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  sessionId: string,
  stripeCustomerId: string | null
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: "completed",
    completed_at: new Date().toISOString(),
  };
  if (stripeCustomerId) {
    patch.stripe_customer_id = stripeCustomerId;
  }
  const { error } = await supabaseAdmin
    .from("checkout_intents")
    .update(patch)
    .eq("stripe_checkout_session_id", sessionId)
    .neq("status", "completed");

  if (error) {
    console.warn(`${WEBHOOK_SECURITY} checkout_intent_sync_completed_failed`, {
      sessionId,
      error,
    });
  }
}

async function markCheckoutIntentCompleted(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  intentId: string,
  stripeCustomerId: string | null
): Promise<boolean> {
  const updateRow: Record<string, string> = {
    status: "completed",
    completed_at: new Date().toISOString(),
  };
  if (stripeCustomerId) {
    updateRow.stripe_customer_id = stripeCustomerId;
  }

  const { error } = await supabaseAdmin.from("checkout_intents").update(updateRow).eq("id", intentId);

  if (error) {
    console.error(`${WEBHOOK_SECURITY} checkout_intent_complete_failed`, { intentId, error });
    return false;
  }
  return true;
}

function unwrapStripeSubscription(
  subscription: Stripe.Subscription | Stripe.Response<Stripe.Subscription>
): Stripe.Subscription {
  return "data" in subscription
    ? (subscription.data as Stripe.Subscription)
    : subscription;
}

function getStripeSubscriptionCurrentPeriodEnd(
  subscription: Stripe.Subscription
): number | null {
  const itemPeriodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");

  if (itemPeriodEnds.length === 0) {
    return null;
  }

  return Math.max(...itemPeriodEnds);
}

function getPlanCodeFromPlan(
  plan: string | null | undefined,
  status: string | null | undefined
) {
  if (status !== "active" && status !== "trialing") {
    return "free";
  }

  return plan === "scale" ? "scale" : "pro";
}

function getCreditGrantQuantityForPlan(plan: string | null | undefined): number {
  if (plan === "scale") return 15;
  if (plan === "pro") return 5;
  if (plan === "starter") return 1;
  return 0;
}

function parseMetadataPositiveInt(
  raw: string | null | undefined
): number | null {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getPlanCodeFromPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;

  const scalePriceIds = [
    process.env.STRIPE_PACK_15_PRICE_ID,
    process.env.STRIPE_SCALE_MONTHLY_PRICE_ID,
    process.env.STRIPE_SCALE_YEARLY_PRICE_ID,
  ].filter(Boolean) as string[];

  const proPriceIds = [
    process.env.STRIPE_PACK_5_PRICE_ID,
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    process.env.STRIPE_PRO_PRICE_ID,
  ].filter(Boolean) as string[];

  if (scalePriceIds.includes(priceId)) return "scale";
  if (proPriceIds.includes(priceId)) return "pro";

  return null;
}

function getBillingIntervalFromSubscription(subscription: SubscriptionEvent) {
  return (
    subscription?.metadata?.billing_interval ??
    subscription?.items?.data?.[0]?.price?.recurring?.interval ??
    null
  );
}

function getPlanCodeFromSubscription(subscription: SubscriptionEvent) {
  return (
    subscription?.metadata?.plan ??
    getPlanCodeFromPriceId(subscription?.items?.data?.[0]?.price?.id) ??
    null
  );
}

async function updateWorkspaceSubscriptionByWorkspaceId(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  workspaceId: string,
  values: Record<string, unknown>
): Promise<boolean> {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (selectError) {
    console.error("Failed to load existing subscription by workspace_id", {
      selectError,
      workspaceId,
    });
    return false;
  }

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update(values)
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("Failed to update subscription by workspace_id", {
        error,
        workspaceId,
        values,
      });
      return false;
    }

    return true;
  }

  const { error } = await supabaseAdmin.from("subscriptions").insert({
    workspace_id: workspaceId,
    plan_code: "free",
    status: "active",
    ...values,
  });

  if (error) {
    console.error("Failed to insert subscription by workspace_id", {
      error,
      workspaceId,
      values,
    });
    return false;
  }

  return true;
}

async function recordUsageEvent(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  values: {
    workspaceId: string;
    userId?: string | null;
    eventType: string;
    quantity?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  if (values.eventType === "audit_credit_consumed") {
    console.error(`${WEBHOOK_SECURITY} blocked_audit_credit_consumed_via_webhook`, {
      workspaceId: values.workspaceId,
    });
    return false;
  }

  const { error } = await supabaseAdmin.from("usage_events").insert({
    workspace_id: values.workspaceId,
    user_id: values.userId ?? null,
    event_type: values.eventType,
    quantity: values.quantity ?? 1,
    metadata: values.metadata ?? {},
  });

  if (error) {
    console.error(`${WEBHOOK_SECURITY} grant_usage_event_insert_failed`, {
      error,
      workspaceId: values.workspaceId,
      eventType: values.eventType,
    });
    return false;
  }

  return true;
}

async function recordAuditCreditLotGrant(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  values: {
    workspaceId: string;
    sourceType: string;
    sourceRef: string;
    planCode?: string | null;
    grantedQuantity: number;
    periodStart?: string | null;
    periodEnd?: string | null;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  const payload = {
    workspace_id: values.workspaceId,
    source_type: values.sourceType,
    source_ref: values.sourceRef,
    plan_code: values.planCode ?? null,
    granted_quantity: values.grantedQuantity,
    consumed_quantity: 0,
    period_start: values.periodStart ?? null,
    period_end: values.periodEnd ?? null,
    expires_at: values.expiresAt ?? null,
    metadata: values.metadata ?? {},
  };

  const { error } = await supabaseAdmin
    .from("audit_credit_lots")
    .upsert(payload, {
      onConflict: "source_type,source_ref",
      ignoreDuplicates: true,
    });

  if (error) {
    console.error(`${WEBHOOK_SECURITY} audit_credit_lot_upsert_failed`, {
      error,
      workspaceId: values.workspaceId,
      sourceType: values.sourceType,
    });
    return false;
  }

  return true;
}

async function fetchAuditCreditLotTotals(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  workspaceId: string
): Promise<{ granted: number; consumed: number; available: number }> {
  const { data: rows } = await supabaseAdmin
    .from("audit_credit_lots")
    .select("granted_quantity, consumed_quantity")
    .eq("workspace_id", workspaceId);

  let granted = 0;
  let consumed = 0;
  for (const row of rows ?? []) {
    const r = row as { granted_quantity?: unknown; consumed_quantity?: unknown };
    granted += Math.max(Number(r.granted_quantity ?? 0), 0);
    consumed += Math.max(Number(r.consumed_quantity ?? 0), 0);
  }
  const available = Math.max(granted - consumed, 0);
  return { granted, consumed, available };
}

type UsageEventRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

async function findUsageEventByMetadata(params: {
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  workspaceId: string;
  eventType: string;
  sessionId?: string | null;
  generatedAt?: string | null;
  auditId?: string | null;
}) {
  const { supabaseAdmin, workspaceId, eventType, sessionId, generatedAt, auditId } =
    params;

  const { data, error } = await supabaseAdmin
    .from("usage_events")
    .select("id, metadata")
    .eq("workspace_id", workspaceId)
    .eq("event_type", eventType)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to load usage events for idempotence check", {
      error,
      workspaceId,
      eventType,
      sessionId,
      generatedAt,
      auditId,
    });
    return null;
  }

  return ((data ?? []) as UsageEventRow[]).find((row) => {
    const metadata = row.metadata ?? {};
    return (
      (sessionId && metadata.stripe_session_id === sessionId) ||
      (generatedAt && metadata.guest_draft_generated_at === generatedAt) ||
      (auditId && metadata.audit_id === auditId)
    );
  }) ?? null;
}

type ListingRow = {
  id: string;
  source_url: string | null;
  title: string | null;
};

type AuditRow = {
  id: string;
  result_payload: {
    stripe_checkout_session_id?: string;
    guest_draft_generated_at?: string;
  } | null;
};

async function persistAuditTestPurchase(params: {
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  workspaceId: string;
  userId?: string | null;
  sessionId?: string | null;
  listingUrl?: string | null;
  title?: string | null;
  platform?: string | null;
  generatedAt?: string | null;
  score?: string | null;
  summary?: string | null;
}) {
  const {
    supabaseAdmin,
    workspaceId,
    userId,
    sessionId,
    listingUrl,
    title,
    platform,
    generatedAt,
    score,
    summary,
  } = params;

  if (!listingUrl) {
    console.warn(
      "[stripe][webhook][audit_test] Missing listing URL, skipping audit persistence",
      {
        workspaceId,
        sessionId,
      }
    );
    return;
  }

  const normalizedUrl = normalizeSourceUrl(listingUrl);

  const { data: listingRows, error: listingsError } = await supabaseAdmin
    .from("listings")
    .select("id, source_url, title")
    .eq("workspace_id", workspaceId);

  if (listingsError) {
    console.error("[stripe][webhook][audit_test] Failed to load listings", {
      listingsError,
      workspaceId,
      sessionId,
    });
    return;
  }

  let listing = ((listingRows ?? []) as ListingRow[]).find(
    (row) => normalizeSourceUrl(row.source_url) === normalizedUrl
  );

  if (!listing) {
    const { data: createdListing, error: listingInsertError } = await supabaseAdmin
      .from("listings")
      .insert({
        workspace_id: workspaceId,
        created_by: userId ?? null,
        source_platform: platform ?? null,
        source_url: listingUrl,
        title: title || "Annonce sans titre",
        city: null,
        country: null,
        price: null,
        currency: null,
        rating: null,
        reviews_count: null,
        raw_payload: {
          source: "stripe_webhook_audit_test",
          restored_after_payment: true,
          summary: summary ?? null,
        },
      })
      .select("id, source_url, title")
      .single();

    if (listingInsertError || !createdListing) {
      console.error("[stripe][webhook][audit_test] Failed to create listing", {
        listingInsertError,
        workspaceId,
        sessionId,
      });
      return;
    }

    listing = createdListing as ListingRow;
  }

  const { data: auditRows, error: auditsError } = await supabaseAdmin
    .from("audits")
    .select("id, result_payload")
    .eq("workspace_id", workspaceId)
    .eq("listing_id", listing.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (auditsError) {
    console.error("[stripe][webhook][audit_test] Failed to load audits", {
      auditsError,
      workspaceId,
      listingId: listing.id,
      sessionId,
    });
    return;
  }

  const duplicateAudit = ((auditRows ?? []) as AuditRow[]).find((row) => {
    const payload = row.result_payload ?? {};
    return (
      (sessionId && payload.stripe_checkout_session_id === sessionId) ||
      (generatedAt && payload.guest_draft_generated_at === generatedAt)
    );
  });

  if (duplicateAudit?.id) {
    console.info("[stripe][webhook][audit_test] Audit already persisted (idempotent, no credit debit)", {
      workspaceId,
      listingId: listing.id,
      auditId: duplicateAudit.id,
      sessionId,
    });
    return;
  }

  const numericScore = score ? Number.parseFloat(score) : null;

  console.info("[stripe][webhook][audit_test] writing audit with workspace_id", {
    workspaceId,
    listingId: listing.id,
    sessionId,
  });

  const { data: insertedAudit, error: auditInsertError } = await supabaseAdmin
    .from("audits")
    .insert({
      workspace_id: workspaceId,
      listing_id: listing.id,
      created_by: userId ?? null,
      overall_score: Number.isFinite(numericScore) ? numericScore : null,
      listing_quality_index: null,
      market_score: null,
      potential_score: null,
      booking_lift_low: null,
      booking_lift_high: null,
      revenue_impact_low: null,
      revenue_impact_high: null,
      result_payload: {
        source: "stripe_webhook_audit_test",
        restored_after_payment: true,
        stripe_checkout_session_id: sessionId ?? null,
        guest_draft_generated_at: generatedAt ?? null,
        listing_url: listingUrl,
        title: title ?? listing.title ?? null,
        platform: platform ?? null,
        score: Number.isFinite(numericScore) ? numericScore : null,
        summary: summary ?? null,
      },
    })
    .select("id")
    .single();

  if (auditInsertError || !insertedAudit) {
    console.error("[stripe][webhook][audit_test] Failed to create audit", {
      auditInsertError,
      workspaceId,
      listingId: listing.id,
      sessionId,
    });
    return;
  }

  console.info("[stripe][webhook][audit_test] Audit persisted (credits unchanged; consumption only via API audit)", {
    workspaceId,
    listingId: listing.id,
    auditId: insertedAudit.id,
    sessionId,
  });
}

async function updateWorkspaceSubscriptionByStripeIds(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  values: Record<string, unknown>,
  options: {
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
  }
) {
  const { stripeSubscriptionId, stripeCustomerId } = options;

  if (stripeSubscriptionId) {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update(values)
      .eq("stripe_subscription_id", stripeSubscriptionId);

    if (!error) {
      return true;
    }

    console.error("Failed to update subscription by stripe_subscription_id", {
      error,
      stripeSubscriptionId,
      stripeCustomerId,
      values,
    });
  }

  if (stripeCustomerId) {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update(values)
      .eq("stripe_customer_id", stripeCustomerId);

    if (!error) {
      return true;
    }

    console.error("Failed to update subscription by stripe_customer_id", {
      error,
      stripeSubscriptionId,
      stripeCustomerId,
      values,
    });
  }

  return false;
}

async function insertBillingPayment(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  values: {
    workspaceId: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeInvoiceId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeCheckoutSessionId?: string | null;
    source: "subscription" | "checkout" | "manual" | "unknown";
    paymentType: "subscription" | "one_shot" | "pack" | "credit" | "adjustment";
    planCode: string | null;
    amount: number;
    currency?: string | null;
    status:
      | "pending"
      | "succeeded"
      | "failed"
      | "refunded"
      | "partially_refunded"
      | "canceled";
    paidAt?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  const payload = {
    workspace_id: values.workspaceId,
    stripe_customer_id: values.stripeCustomerId ?? null,
    stripe_subscription_id: values.stripeSubscriptionId ?? null,
    stripe_invoice_id: values.stripeInvoiceId ?? null,
    stripe_payment_intent_id: values.stripePaymentIntentId ?? null,
    stripe_checkout_session_id: values.stripeCheckoutSessionId ?? null,
    source: values.source,
    payment_type: values.paymentType,
    plan_code: values.planCode,
    amount: values.amount,
    currency: (values.currency ?? "eur").toLowerCase(),
    status: values.status,
    paid_at: values.paidAt ?? null,
    metadata: values.metadata ?? {},
  };

  const { error } = await supabaseAdmin
    .from("billing_payments")
    .insert(payload);

  if (error) {
    console.error(`${WEBHOOK_SECURITY} billing_payments_insert_failed`, {
      error,
      workspaceId: values.workspaceId,
      stripeCheckoutSessionId: values.stripeCheckoutSessionId ?? null,
    });
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("Missing Stripe signature or webhook secret");
    return NextResponse.json(
      { error: "Invalid webhook configuration" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    console.log("[STRIPE WEBHOOK RECEIVED]");
    console.log("[STRIPE EVENT]", event.type);

    const supabaseAdmin = createSupabaseAdminClient();

    if (event.type === "checkout.session.completed") {
      const sessionSnapshot = event.data.object as CheckoutSessionEvent;
      const sessionIdEarly = sessionSnapshot?.id ?? null;

      if (!sessionIdEarly) {
        console.error(`${WEBHOOK_SECURITY} missing_session_id`, { eventId: event.id });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "missing_session_id" },
          { status: 400 }
        );
      }

      const { data: existingBillingRow } = await supabaseAdmin
        .from("billing_payments")
        .select("id")
        .eq("stripe_checkout_session_id", sessionIdEarly)
        .maybeSingle();

      if (existingBillingRow?.id) {
        const earlyCustomerId =
          typeof sessionSnapshot.customer === "string" ? sessionSnapshot.customer : null;
        await syncCheckoutIntentCompletedBySessionId(
          supabaseAdmin,
          sessionIdEarly,
          earlyCustomerId
        );
        console.info("[billing][webhook][idempotency] session_already_processed_skip", {
          sessionId: sessionIdEarly,
          billingPaymentId: existingBillingRow.id,
          eventId: event.id,
        });
        return NextResponse.json({ received: true });
      }

      let fullSession: Stripe.Checkout.Session;
      try {
        fullSession = await stripe.checkout.sessions.retrieve(sessionIdEarly, {
          expand: ["line_items.data.price"],
        });
      } catch (retrieveErr) {
        console.error(`${WEBHOOK_SECURITY} session_retrieve_failed`, {
          sessionId: sessionIdEarly,
          message: retrieveErr instanceof Error ? retrieveErr.message : String(retrieveErr),
        });
        return NextResponse.json(
          { error: "stripe_webhook_session_retrieve_failed" },
          { status: 500 }
        );
      }

      const checkoutIntentIdMeta = (fullSession.metadata?.checkout_intent_id ?? "").trim();
      if (!checkoutIntentIdMeta || !isCheckoutIntentUuid(checkoutIntentIdMeta)) {
        console.error(`${WEBHOOK_SECURITY} missing_or_invalid_checkout_intent_id`, {
          sessionId: sessionIdEarly,
          hasIntentId: Boolean(checkoutIntentIdMeta),
        });
        return NextResponse.json(
          {
            error: "stripe_webhook_validation_failed",
            reason: "missing_or_invalid_checkout_intent_id",
          },
          { status: 400 }
        );
      }

      const { data: checkoutIntentRow, error: checkoutIntentError } = await supabaseAdmin
        .from("checkout_intents")
        .select(
          "id,workspace_id,user_id,plan_code,price_id,status,stripe_checkout_session_id,stripe_customer_id"
        )
        .eq("id", checkoutIntentIdMeta)
        .maybeSingle();

      if (checkoutIntentError || !checkoutIntentRow) {
        console.error(`${WEBHOOK_SECURITY} checkout_intent_load_failed`, {
          sessionId: sessionIdEarly,
          checkoutIntentId: checkoutIntentIdMeta,
          checkoutIntentError,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "checkout_intent_not_found" },
          { status: 400 }
        );
      }

      // Ne pas court-circuiter sur le seul statut « completed » : l’idempotence
      // repose sur billing_payments (session) + usage_events/lot (session). Un retour
      // anticipé ici faisait ignorer des paiements réussis (ex. métadonnées de session
      // désalignées ou reprise après état partiel).
      if (checkoutIntentRow.status === "completed") {
        const linkedSessionId =
          typeof checkoutIntentRow.stripe_checkout_session_id === "string"
            ? checkoutIntentRow.stripe_checkout_session_id.trim()
            : null;
        if (linkedSessionId && linkedSessionId === sessionIdEarly) {
          console.info("[billing][webhook][idempotency] intent_completed_same_session_proceeding", {
            sessionId: sessionIdEarly,
            checkoutIntentId: checkoutIntentIdMeta,
            eventId: event.id,
          });
        } else {
          console.warn("[billing][webhook] intent_marked_completed_session_mismatch_or_unlinked", {
            sessionId: sessionIdEarly,
            linkedSessionId,
            checkoutIntentId: checkoutIntentIdMeta,
            eventId: event.id,
          });
        }
      }

      const intentWorkspaceId = String(checkoutIntentRow.workspace_id ?? "").trim();
      const intentUserId = String(checkoutIntentRow.user_id ?? "").trim();
      const planFromMetadata = parseCheckoutMetadataPlan(checkoutIntentRow.plan_code as string);
      if (!planFromMetadata) {
        console.error(`${WEBHOOK_SECURITY} invalid_checkout_intent_plan`, {
          sessionId: sessionIdEarly,
          checkoutIntentId: checkoutIntentIdMeta,
          rawPlan: checkoutIntentRow.plan_code,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "invalid_checkout_intent_plan" },
          { status: 400 }
        );
      }

      /** Pack crédités uniquement depuis `Stripe session.metadata.workspace_id` (sans fallback camelCase ni autre workspace) */
      const metadataWorkspaceId =
        typeof fullSession.metadata?.workspace_id === "string"
          ? fullSession.metadata.workspace_id.trim()
          : "";
      const metadataUserId =
        typeof fullSession.metadata?.user_id === "string"
          ? fullSession.metadata.user_id.trim()
          : "";

      if (!metadataWorkspaceId) {
        console.error(`${WEBHOOK_SECURITY} missing_stripe_metadata_workspace_id_no_credit`, {
          sessionId: sessionIdEarly,
          checkoutIntentId: checkoutIntentIdMeta,
        });
        return NextResponse.json(
          {
            error: "stripe_webhook_validation_failed",
            reason: "missing_stripe_session_metadata_workspace_id",
          },
          { status: 400 }
        );
      }

      if (!metadataUserId) {
        console.error(`${WEBHOOK_SECURITY} missing_stripe_metadata_user_id_no_credit`, {
          sessionId: sessionIdEarly,
          checkoutIntentId: checkoutIntentIdMeta,
          metadataWorkspaceId,
        });
        return NextResponse.json(
          {
            error: "stripe_webhook_validation_failed",
            reason: "missing_stripe_session_metadata_user_id",
          },
          { status: 400 }
        );
      }

      const camelMetaWorkspace =
        typeof fullSession.metadata?.workspaceId === "string"
          ? fullSession.metadata.workspaceId.trim()
          : "";
      const camelMetaUser =
        typeof fullSession.metadata?.userId === "string"
          ? fullSession.metadata.userId.trim()
          : "";
      if (camelMetaWorkspace && camelMetaWorkspace !== metadataWorkspaceId) {
        console.error(`${WEBHOOK_SECURITY} conflicting_workspace_metadata_keys`, {
          sessionId: sessionIdEarly,
          workspace_id: metadataWorkspaceId,
          workspaceId: camelMetaWorkspace,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "conflicting_workspace_metadata_keys" },
          { status: 400 }
        );
      }
      if (camelMetaUser && camelMetaUser !== metadataUserId) {
        console.error(`${WEBHOOK_SECURITY} conflicting_user_metadata_keys`, {
          sessionId: sessionIdEarly,
          user_id: metadataUserId,
          userId: camelMetaUser,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "conflicting_user_metadata_keys" },
          { status: 400 }
        );
      }

      if (intentWorkspaceId !== metadataWorkspaceId || intentUserId !== metadataUserId) {
        console.error(`${WEBHOOK_SECURITY} checkout_intent_stripe_metadata_workspace_mismatch`, {
          sessionId: sessionIdEarly,
          checkoutIntentId: checkoutIntentIdMeta,
          intentWorkspaceId,
          stripeMetadataWorkspaceId: metadataWorkspaceId,
          intentUserId,
          stripeMetadataUserId: metadataUserId,
        });
        return NextResponse.json(
          {
            error: "stripe_webhook_validation_failed",
            reason: "checkout_intent_stripe_metadata_identity_mismatch",
          },
          { status: 400 }
        );
      }

      /** workspaceId bindings pour créditer : exclusivement Stripe metadata snake_case ci-dessus */
      const workspaceId = metadataWorkspaceId;
      const userId = metadataUserId;

      const { data: workspaceRow, error: workspaceRowError } = await supabaseAdmin
        .from("workspaces")
        .select("id")
        .eq("id", workspaceId)
        .maybeSingle();

      if (workspaceRowError || !workspaceRow?.id) {
        console.error(`${WEBHOOK_SECURITY} workspace_not_found_no_credit`, {
          sessionId: sessionIdEarly,
          workspaceId,
          workspaceRowError,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "workspace_not_found" },
          { status: 400 }
        );
      }

      const userMayAccess = await workspaceUserMayAccessWorkspace(
        supabaseAdmin,
        workspaceId,
        userId
      );
      if (!userMayAccess) {
        console.error(`${WEBHOOK_SECURITY} metadata_user_not_bound_to_workspace_no_credit`, {
          sessionId: sessionIdEarly,
          workspaceId,
          userId,
        });
        return NextResponse.json(
          {
            error: "stripe_webhook_validation_failed",
            reason: "metadata_user_not_workspace_member_or_owner",
          },
          { status: 400 }
        );
      }

      const sessionCustomerEarly = typeof fullSession.customer === "string" ? fullSession.customer : null;
      const { data: workspaceSubscriptionBind, error: workspaceSubscriptionBindError } =
        await supabaseAdmin
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("workspace_id", workspaceId)
          .maybeSingle();

      if (workspaceSubscriptionBindError) {
        console.error(`${WEBHOOK_SECURITY} subscriptions_lookup_failed_no_credit`, {
          sessionId: sessionIdEarly,
          workspaceId,
          workspaceSubscriptionBindError,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "subscriptions_lookup_failed" },
          { status: 500 }
        );
      }

      const subscriptionStoredCustomer =
        workspaceSubscriptionBind && "stripe_customer_id" in workspaceSubscriptionBind
          ? ((workspaceSubscriptionBind.stripe_customer_id as string | null) ?? "").trim()
          : "";

      if (subscriptionStoredCustomer && sessionCustomerEarly && subscriptionStoredCustomer !== sessionCustomerEarly) {
        console.error(`${WEBHOOK_SECURITY} stripe_customer_not_bound_to_workspace_no_credit`, {
          sessionId: sessionIdEarly,
          workspaceId,
          subscriptionStripeCustomerId: subscriptionStoredCustomer,
          sessionStripeCustomerId: sessionCustomerEarly,
        });
        return NextResponse.json(
          {
            error: "stripe_webhook_validation_failed",
            reason: "stripe_customer_workspace_mismatch",
          },
          { status: 400 }
        );
      }

      const metaPlanCodeRaw = fullSession.metadata?.plan_code;
      const metaPlanFromCode = parseCheckoutMetadataPlan(metaPlanCodeRaw);
      const metaPlanFromLegacy = parseCheckoutMetadataPlan(fullSession.metadata?.plan);
      const metaPlan = metaPlanFromCode ?? metaPlanFromLegacy;

      if (
        metaPlanFromCode &&
        metaPlanFromLegacy &&
        metaPlanFromCode !== metaPlanFromLegacy
      ) {
        console.error(`${WEBHOOK_SECURITY} checkout_session_plan_metadata_conflict`, {
          sessionId: sessionIdEarly,
          metaPlanFromCode,
          metaPlanFromLegacy,
        });
        return NextResponse.json(
          {
            error: "stripe_webhook_validation_failed",
            reason: "checkout_session_plan_metadata_conflict",
          },
          { status: 400 }
        );
      }

      if (metaPlan !== planFromMetadata) {
        console.error(`${WEBHOOK_SECURITY} checkout_session_plan_mismatch_vs_intent`, {
          sessionId: sessionIdEarly,
          checkoutIntentId: checkoutIntentIdMeta,
          intentPlan: planFromMetadata,
          sessionMetaPlan: metaPlan ?? null,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "checkout_intent_plan_metadata_mismatch" },
          { status: 400 }
        );
      }

      const normalizedAuditQuantity = Math.min(
        50,
        Math.max(1, Number(fullSession.metadata?.audit_quantity ?? "1") || 1)
      );
      const expectedGrantCredits =
        planFromMetadata === "audit_test"
          ? normalizedAuditQuantity
          : getCreditGrantQuantityForPlan(planFromMetadata);

      const metaCreditQtyParsed = parseMetadataPositiveInt(fullSession.metadata?.credit_quantity);
      if (
        metaCreditQtyParsed !== null &&
        metaCreditQtyParsed !== expectedGrantCredits
      ) {
        console.error(`${WEBHOOK_SECURITY} credit_quantity_metadata_mismatch`, {
          sessionId: sessionIdEarly,
          metaCreditQtyParsed,
          expectedGrantCredits,
          planFromMetadata,
        });
        return NextResponse.json(
          {
            error: "stripe_webhook_validation_failed",
            reason: "credit_quantity_metadata_mismatch",
          },
          { status: 400 }
        );
      }

      const sessionRef = fullSession.id ?? sessionIdEarly;
      const intentSessionId = checkoutIntentRow.stripe_checkout_session_id as string | null;
      if (!intentSessionId) {
        console.error(`${WEBHOOK_SECURITY} checkout_intent_session_not_linked`, {
          sessionId: sessionRef,
          checkoutIntentId: checkoutIntentIdMeta,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "checkout_intent_session_not_linked" },
          { status: 500 }
        );
      }
      if (intentSessionId !== sessionRef) {
        console.error(`${WEBHOOK_SECURITY} checkout_intent_session_mismatch`, {
          sessionId: sessionRef,
          checkoutIntentId: checkoutIntentIdMeta,
          intentSessionId,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "checkout_intent_session_mismatch" },
          { status: 400 }
        );
      }

      if (fullSession.payment_status !== "paid") {
        console.error(`${WEBHOOK_SECURITY} payment_not_paid`, {
          sessionId: sessionIdEarly,
          payment_status: fullSession.payment_status,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "payment_not_paid" },
          { status: 400 }
        );
      }

      if (fullSession.mode !== "payment") {
        console.error(`${WEBHOOK_SECURITY} invalid_checkout_mode`, {
          sessionId: sessionIdEarly,
          mode: fullSession.mode,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "checkout_mode_must_be_payment" },
          { status: 400 }
        );
      }

      const lineItem = fullSession.line_items?.data?.[0];
      const priceObj = lineItem?.price;
      const firstPriceId =
        typeof priceObj === "string" ? priceObj : priceObj && "id" in priceObj ? priceObj.id : null;

      const intentPriceId = checkoutIntentRow.price_id as string;
      const expectedPriceId = expectedCheckoutPriceIdForPlan(planFromMetadata);
      if (
        !expectedPriceId ||
        !firstPriceId ||
        firstPriceId !== expectedPriceId ||
        firstPriceId !== intentPriceId ||
        intentPriceId !== expectedPriceId
      ) {
        console.error(`${WEBHOOK_SECURITY} price_id_mismatch`, {
          sessionId: sessionIdEarly,
          workspaceId,
          plan: planFromMetadata,
          expectedPriceId: expectedPriceId ?? null,
          actualPriceId: firstPriceId,
          intentPriceId,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "price_mismatch" },
          { status: 400 }
        );
      }

      const customerId = typeof fullSession.customer === "string" ? fullSession.customer : null;
      if (!customerId) {
        console.warn(`${WEBHOOK_SECURITY} missing_stripe_customer_allowed_for_one_shot`, {
          sessionId: sessionIdEarly,
          workspaceId,
          userId,
          planFromMetadata,
          mode: fullSession.mode ?? null,
          paymentStatus: fullSession.payment_status ?? null,
        });
      }

      const intentCustomerId = checkoutIntentRow.stripe_customer_id as string | null;
      if (customerId && intentCustomerId && intentCustomerId !== customerId) {
        console.error(`${WEBHOOK_SECURITY} checkout_intent_customer_mismatch`, {
          sessionId: sessionIdEarly,
          checkoutIntentId: checkoutIntentIdMeta,
          intentCustomerId,
          sessionCustomerId: customerId,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "checkout_intent_customer_mismatch" },
          { status: 400 }
        );
      }

      const { data: existingBilling, error: existingBillingError } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_subscription_id, current_period_end, stripe_customer_id, plan_code")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (existingBillingError) {
        console.error("[stripe][webhook] Failed to load existing subscription row", {
          existingBillingError,
          workspaceId,
        });
        return NextResponse.json({ error: "stripe_webhook_db_error" }, { status: 500 });
      }

      const storedCustomerId = (existingBilling?.stripe_customer_id as string | null) ?? null;
      if (customerId && storedCustomerId && storedCustomerId !== customerId) {
        console.error(`${WEBHOOK_SECURITY} stripe_customer_mismatch`, {
          sessionId: sessionIdEarly,
          workspaceId,
          storedCustomerId,
          sessionCustomerId: customerId,
        });
        return NextResponse.json(
          { error: "stripe_webhook_validation_failed", reason: "stripe_customer_mismatch" },
          { status: 400 }
        );
      }

      const subscriptionId = (fullSession.subscription as string | null) ?? null;

      let subscriptionStatus: string | null = "active";
      let currentPeriodEnd: string | null = null;

      if (subscriptionId) {
        try {
          const subRes = await stripe.subscriptions.retrieve(subscriptionId);
          const subscription = unwrapStripeSubscription(subRes);

          subscriptionStatus = subscription.status;

          const ts = getStripeSubscriptionCurrentPeriodEnd(subscription);

          currentPeriodEnd =
            typeof ts === "number" ? new Date(ts * 1000).toISOString() : null;
        } catch (e) {
          console.error("Stripe subscription fetch failed", e);
          return NextResponse.json({ error: "stripe_subscription_fetch_failed" }, { status: 500 });
        }
      }

      let stripeSubscriptionIdForDb = subscriptionId;
      let currentPeriodEndForDb = currentPeriodEnd;

      if (!subscriptionId && existingBilling) {
        if (!stripeSubscriptionIdForDb && existingBilling.stripe_subscription_id) {
          stripeSubscriptionIdForDb = existingBilling.stripe_subscription_id as string;
        }
        if (!currentPeriodEndForDb && existingBilling.current_period_end) {
          currentPeriodEndForDb = existingBilling.current_period_end as string;
        }
      }

      const priorPlanCode = String(
        (existingBilling as { plan_code?: string | null } | null)?.plan_code ?? "free"
      );

      const resolvedPlanCode =
        planFromMetadata === "audit_test"
          ? "pro"
          : planFromMetadata === "starter"
            ? priorPlanCode === "pro" || priorPlanCode === "scale"
              ? priorPlanCode
              : "free"
            : getPlanCodeFromPlan(planFromMetadata, subscriptionStatus);

      const amount =
        planFromMetadata === "audit_test" || planFromMetadata === "starter"
          ? 9
          : planFromMetadata === "scale"
            ? 99
            : 39;

      const normalizedPlanCode =
        planFromMetadata === "audit_test" ? "starter" : planFromMetadata;

      const sessionForPersist = fullSession as unknown as CheckoutSessionEvent;

      console.info("[billing][webhook] checkout.session.completed validated", {
        sessionId: sessionRef,
        workspaceId,
        planCode: planFromMetadata,
        eventId: event.id,
        paymentIntent:
          typeof fullSession.payment_intent === "string"
            ? fullSession.payment_intent
            : fullSession.payment_intent && typeof fullSession.payment_intent === "object"
              ? (fullSession.payment_intent as { id?: string }).id ?? null
            : null,
      });

      /** Ne pas écraser un customer Stripe déjà persisté lorsque session.customer est vide */
      const subscriptionStripeCustomerForDb =
        customerId ??
        storedCustomerId ??
        null;

      const subscriptionUpdatePayload = {
        plan_code: resolvedPlanCode,
        status: subscriptionStatus,
        stripe_customer_id: subscriptionStripeCustomerForDb,
        stripe_subscription_id: stripeSubscriptionIdForDb,
        current_period_end: currentPeriodEndForDb,
        updated_at: new Date().toISOString(),
      };

      const billingInsertBase = {
        workspaceId,
        stripeCustomerId: subscriptionStripeCustomerForDb,
        stripeSubscriptionId: subscriptionId,
        stripeCheckoutSessionId: sessionRef,
        source: subscriptionId ? ("subscription" as const) : ("checkout" as const),
        paymentType:
          planFromMetadata === "audit_test"
            ? ("one_shot" as const)
            : planFromMetadata === "scale" ||
                planFromMetadata === "pro" ||
                planFromMetadata === "starter"
              ? ("pack" as const)
              : ("subscription" as const),
        planCode: normalizedPlanCode,
        amount,
        currency: "eur",
        status: "succeeded" as const,
        paidAt: new Date().toISOString(),
        metadata: {
          event_type: "checkout.session.completed",
          stripe_session_id: sessionRef,
          original_plan: planFromMetadata,
          checkout_intent_id: checkoutIntentIdMeta,
        },
      };

      // Stripe webhook grants credits only. Credit consumption is only allowed in /api/audits and /api/listings.
      // This handler must never insert audit_credit_consumed, call consumeWorkspaceAuditCredits,
      // or increase audit_credit_lots.consumed_quantity (lots are created here with consumed_quantity = 0 only).
      if (planFromMetadata !== "audit_test") {
        const grantQuantity = metaCreditQtyParsed ?? expectedGrantCredits;
        const creditGrantSource =
          planFromMetadata === "scale" ||
          planFromMetadata === "pro" ||
          planFromMetadata === "starter"
            ? "pack_checkout"
            : "subscription_checkout";
        const creditLotSourceType = "stripe_checkout_pack";

        const existingPackGrant = await findUsageEventByMetadata({
          supabaseAdmin,
          workspaceId,
          eventType: "audit_credit_granted",
          sessionId: sessionRef,
        });

        if (existingPackGrant?.id) {
          console.info("[billing][grant][idempotency] pack_grant_usage_event_exists", {
            workspaceId,
            planCode: planFromMetadata,
            sessionId: sessionRef,
            eventId: event.id,
            usageEventId: existingPackGrant.id,
          });
        } else if (grantQuantity > 0) {
          const totalsBeforeGrant = await fetchAuditCreditLotTotals(supabaseAdmin, workspaceId);

          console.info("[billing][grant] inserting_pack_grant", {
            workspaceId,
            planCode: planFromMetadata,
            sessionId: sessionRef,
            eventId: event.id,
            creditsToGrant: grantQuantity,
          });
          const lotOk = await recordAuditCreditLotGrant(supabaseAdmin, {
            workspaceId,
            sourceType: creditLotSourceType,
            sourceRef: sessionRef,
            planCode: planFromMetadata,
            grantedQuantity: grantQuantity,
            periodStart: new Date().toISOString(),
            periodEnd: currentPeriodEnd,
            expiresAt: currentPeriodEnd,
            metadata: {
              stripe_session_id: sessionRef,
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: subscriptionStripeCustomerForDb,
              usage_event_type: "audit_credit_granted",
              checkout_intent_id: checkoutIntentIdMeta,
            },
          });
          if (!lotOk) {
            return NextResponse.json({ error: "stripe_webhook_lot_failed" }, { status: 500 });
          }

          logStripeCreditWorkspaceBindingAccepted({
            eventType: event.type,
            sessionId: sessionRef,
            metadataWorkspaceId: workspaceId,
            customerId,
            planCode: planFromMetadata,
            grantedQuantity: grantQuantity,
            insertedWorkspaceId: workspaceId,
            oneShotCustomerAbsentAccepted: customerId === null,
          });

          const usageOk = await recordUsageEvent(supabaseAdmin, {
            workspaceId,
            userId,
            eventType: "audit_credit_granted",
            quantity: grantQuantity,
            metadata: {
              stripe_session_id: sessionRef,
              stripe_customer_id: subscriptionStripeCustomerForDb,
              plan: planFromMetadata,
              source: creditGrantSource,
              checkout_intent_id: checkoutIntentIdMeta,
            },
          });
          if (!usageOk) {
            return NextResponse.json({ error: "stripe_webhook_grant_failed" }, { status: 500 });
          }

          const totalsAfterGrant = await fetchAuditCreditLotTotals(supabaseAdmin, workspaceId);

          console.info("[billing][grant] pack_checkout_credits_applied", {
            workspaceId,
            planCode: planFromMetadata,
            sessionId: sessionRef,
            eventId: event.id,
            creditsGrantedThisCheckout: grantQuantity,
          });
          console.info("[billing][balance] audit_credit_lots_totals_after_grant", {
            workspaceId,
            sessionId: sessionRef,
            totalGranted: totalsAfterGrant.granted,
            totalConsumed: totalsAfterGrant.consumed,
            available: totalsAfterGrant.available,
          });
          console.info("[billing][security][grant_snapshot]", {
            workspaceId,
            planCode: planFromMetadata,
            sessionId: sessionRef,
            grantQuantity,
            grantedTotal: totalsAfterGrant.granted,
            consumedTotal: totalsAfterGrant.consumed,
            availableTotal: totalsAfterGrant.available,
            availableBeforeGrant: totalsBeforeGrant.available,
          });
          if (totalsAfterGrant.available <= totalsBeforeGrant.available) {
            console.error("[billing][security][grant_without_available_increase]", {
              workspaceId,
              planCode: planFromMetadata,
              sessionId: sessionRef,
              grantQuantity,
              availableBeforeGrant: totalsBeforeGrant.available,
              availableAfterGrant: totalsAfterGrant.available,
            });
          }
        }

        const billingOk = await insertBillingPayment(supabaseAdmin, billingInsertBase);
        if (!billingOk) {
          return NextResponse.json({ error: "stripe_webhook_billing_insert_failed" }, { status: 500 });
        }

        const subOk = await updateWorkspaceSubscriptionByWorkspaceId(
          supabaseAdmin,
          workspaceId,
          subscriptionUpdatePayload
        );
        if (!subOk) {
          return NextResponse.json({ error: "stripe_webhook_subscription_update_failed" }, { status: 500 });
        }

        await alertIfWorkspaceIsAnomaly(workspaceId);

        const intentMarked = await markCheckoutIntentCompleted(
          supabaseAdmin,
          checkoutIntentIdMeta,
          subscriptionStripeCustomerForDb
        );
        if (!intentMarked) {
          return NextResponse.json(
            { error: "stripe_webhook_checkout_intent_finalize_failed" },
            { status: 500 }
          );
        }
      } else {
        const auditQuantity = normalizedAuditQuantity;

        const existingStarterGrant = await findUsageEventByMetadata({
          supabaseAdmin,
          workspaceId,
          eventType: "audit_test_purchased",
          sessionId: sessionRef,
        });

        if (existingStarterGrant?.id) {
          console.info("[stripe][webhook][idempotency] audit_test_grant_exists_completing_billing", {
            workspaceId,
            sessionId: sessionRef,
            usageEventId: existingStarterGrant.id,
          });
        } else {
          const totalsBeforeGrant = await fetchAuditCreditLotTotals(supabaseAdmin, workspaceId);

          const lotOk = await recordAuditCreditLotGrant(supabaseAdmin, {
            workspaceId,
            sourceType: "stripe_checkout_audit_test",
            sourceRef: sessionRef,
            planCode: "starter",
            grantedQuantity: auditQuantity,
            periodStart: new Date().toISOString(),
            metadata: {
              stripe_session_id: sessionRef,
              stripe_customer_id: subscriptionStripeCustomerForDb,
              usage_event_type: "audit_test_purchased",
              checkout_intent_id: checkoutIntentIdMeta,
            },
          });
          if (!lotOk) {
            return NextResponse.json({ error: "stripe_webhook_lot_failed" }, { status: 500 });
          }

          logStripeCreditWorkspaceBindingAccepted({
            eventType: event.type,
            sessionId: sessionRef,
            metadataWorkspaceId: workspaceId,
            customerId,
            planCode: planFromMetadata,
            grantedQuantity: auditQuantity,
            insertedWorkspaceId: workspaceId,
            oneShotCustomerAbsentAccepted: customerId === null,
          });

          const usageOk = await recordUsageEvent(supabaseAdmin, {
            workspaceId,
            userId,
            eventType: "audit_test_purchased",
            quantity: auditQuantity,
            metadata: {
              stripe_session_id: sessionRef,
              stripe_customer_id: subscriptionStripeCustomerForDb,
              plan: planFromMetadata,
              audit_quantity: auditQuantity,
            },
          });
          if (!usageOk) {
            return NextResponse.json({ error: "stripe_webhook_grant_failed" }, { status: 500 });
          }

          const totalsAfterGrant = await fetchAuditCreditLotTotals(supabaseAdmin, workspaceId);

          console.info("[stripe][webhook][audit_credits] granted audit_test", {
            workspaceId,
            sessionId: sessionRef,
            quantity: auditQuantity,
          });
          console.info("[billing][security][grant_snapshot]", {
            workspaceId,
            planCode: "audit_test",
            sessionId: sessionRef,
            grantQuantity: auditQuantity,
            grantedTotal: totalsAfterGrant.granted,
            consumedTotal: totalsAfterGrant.consumed,
            availableTotal: totalsAfterGrant.available,
            availableBeforeGrant: totalsBeforeGrant.available,
          });
          if (totalsAfterGrant.available <= totalsBeforeGrant.available) {
            console.error("[billing][security][grant_without_available_increase]", {
              workspaceId,
              planCode: "audit_test",
              sessionId: sessionRef,
              grantQuantity: auditQuantity,
              availableBeforeGrant: totalsBeforeGrant.available,
              availableAfterGrant: totalsAfterGrant.available,
            });
          }
        }

        const billingOk = await insertBillingPayment(supabaseAdmin, billingInsertBase);
        if (!billingOk) {
          return NextResponse.json({ error: "stripe_webhook_billing_insert_failed" }, { status: 500 });
        }

        await persistAuditTestPurchase({
          supabaseAdmin,
          workspaceId,
          userId,
          sessionId: sessionRef,
          listingUrl: sessionForPersist.metadata?.audit_listing_url ?? null,
          title: sessionForPersist.metadata?.audit_title ?? null,
          platform: sessionForPersist.metadata?.audit_platform ?? null,
          generatedAt: sessionForPersist.metadata?.audit_generated_at ?? null,
          score: sessionForPersist.metadata?.audit_score ?? null,
          summary: sessionForPersist.metadata?.audit_summary ?? null,
        });

        const subOk = await updateWorkspaceSubscriptionByWorkspaceId(
          supabaseAdmin,
          workspaceId,
          subscriptionUpdatePayload
        );
        if (!subOk) {
          return NextResponse.json({ error: "stripe_webhook_subscription_update_failed" }, { status: 500 });
        }

        await alertIfWorkspaceIsAnomaly(workspaceId);

        const intentMarkedAudit = await markCheckoutIntentCompleted(
          supabaseAdmin,
          checkoutIntentIdMeta,
          subscriptionStripeCustomerForDb
        );
        if (!intentMarkedAudit) {
          return NextResponse.json(
            { error: "stripe_webhook_checkout_intent_finalize_failed" },
            { status: 500 }
          );
        }

        console.info("[stripe][webhook][audit_test] purchase recorded", {
          sessionId: sessionRef,
          workspaceId,
        });
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as SubscriptionEvent;
      const stripeSubscriptionId = subscription?.id as string | undefined;
      const stripeCustomerId = subscription?.customer as string | undefined;
      const stripeStatus = (subscription?.status as string | undefined) ?? null;

      const currentPeriodEnd =
        typeof subscription?.current_period_end === "number"
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

      if (!stripeSubscriptionId && !stripeCustomerId) {
        console.error(
          "Stripe webhook subscription event missing both subscription id and customer id",
          { eventType: event.type }
        );
        return NextResponse.json({ received: true });
      }

      if (!stripeStatus) {
        console.error("Stripe webhook subscription event missing status", {
          eventType: event.type,
          stripeSubscriptionId,
          stripeCustomerId,
        });
      }

      const normalizedStatus = stripeStatus ?? "canceled";
      const nextPlanCode = getPlanCodeFromPlan(
        getPlanCodeFromSubscription(subscription),
        normalizedStatus
      );
      const billingInterval = getBillingIntervalFromSubscription(subscription);

      await updateWorkspaceSubscriptionByStripeIds(
        supabaseAdmin,
        {
          plan_code: nextPlanCode,
          status: normalizedStatus,
          stripe_subscription_id: stripeSubscriptionId ?? null,
          stripe_customer_id: stripeCustomerId ?? null,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        },
        {
          stripeSubscriptionId,
          stripeCustomerId,
        }
      );

      if (billingInterval) {
        console.info("Stripe subscription interval received", {
          stripeSubscriptionId,
          stripeCustomerId,
          billingInterval,
        });
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as InvoiceEvent;

      const stripeSubscriptionId = invoice.subscription ?? null;
      const stripeCustomerId = invoice.customer ?? null;

      if (!stripeSubscriptionId && !stripeCustomerId) {
        return NextResponse.json({ received: true });
      }

      let planCode = "pro";
      let currentPeriodEnd: string | null = null;

      if (stripeSubscriptionId) {
        try {
          const subscriptionResponse = await stripe.subscriptions.retrieve(
            stripeSubscriptionId
          );
          const subscription = unwrapStripeSubscription(subscriptionResponse);

          planCode = getPlanCodeFromPlan(
            getPlanCodeFromSubscription(subscription as unknown as SubscriptionEvent),
            subscription.status
          );

          const currentPeriodEndTimestamp =
            getStripeSubscriptionCurrentPeriodEnd(subscription);

          currentPeriodEnd =
            typeof currentPeriodEndTimestamp === "number"
              ? new Date(currentPeriodEndTimestamp * 1000).toISOString()
              : null;
        } catch (error) {
          console.error("Failed to retrieve Stripe subscription for invoice.paid", {
            error,
            stripeSubscriptionId,
            stripeCustomerId,
          });
        }
      }

      const values = {
        plan_code: planCode,
        status: invoice?.status === "paid" ? "active" : "past_due",
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: stripeCustomerId,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      };

      await updateWorkspaceSubscriptionByStripeIds(supabaseAdmin, values, {
        stripeSubscriptionId,
        stripeCustomerId,
      });

      const { data: subscriptionRow } = await supabaseAdmin
        .from("subscriptions")
        .select("workspace_id")
        .or(
          stripeSubscriptionId
            ? `stripe_subscription_id.eq.${stripeSubscriptionId}`
            : `stripe_customer_id.eq.${stripeCustomerId}`
        )
        .limit(1)
        .maybeSingle();

      if (!subscriptionRow?.workspace_id) {
        return NextResponse.json({ received: true });
      }

      const workspaceId = subscriptionRow.workspace_id;
      const amount = (invoice.amount_paid ?? 0) / 100;

      await insertBillingPayment(supabaseAdmin, {
        workspaceId,
        stripeCustomerId,
        stripeSubscriptionId,
        stripeInvoiceId: invoice.id ?? null,
        stripePaymentIntentId: invoice.payment_intent ?? null,
        source: "subscription",
        paymentType: "subscription",
        planCode,
        amount,
        currency: invoice.currency ?? "eur",
        status: "succeeded",
        paidAt: new Date().toISOString(),
        metadata: {
          event_type: "invoice.paid",
        },
      });

      await alertIfWorkspaceIsAnomaly(workspaceId);
    }
  } catch (err) {
    console.error("Stripe webhook handler error", err);
    return NextResponse.json(
      { error: "Webhook handling failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
