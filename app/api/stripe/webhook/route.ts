import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/stripe/server";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
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
    billing_interval?: string;
    audit_listing_url?: string;
    audit_title?: string;
    audit_platform?: string;
    audit_generated_at?: string;
    audit_score?: string;
    audit_summary?: string;
    audit_quantity?: string;
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
  return 0;
}

function getPlanCodeFromPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;

  const scalePriceIds = [
    process.env.STRIPE_SCALE_MONTHLY_PRICE_ID,
    process.env.STRIPE_SCALE_YEARLY_PRICE_ID,
  ].filter(Boolean) as string[];

  const proPriceIds = [
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
) {
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
    return;
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
    }

    return;
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
  }
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
) {
  const { error } = await supabaseAdmin.from("usage_events").insert({
    workspace_id: values.workspaceId,
    user_id: values.userId ?? null,
    event_type: values.eventType,
    quantity: values.quantity ?? 1,
    metadata: values.metadata ?? {},
  });

  if (error) {
    console.error("Failed to insert usage event from Stripe webhook", {
      error,
      values,
    });
  }
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
) {
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
    .upsert(payload, { onConflict: "workspace_id,source_type,source_ref" });

  if (error) {
    console.error("[stripe][webhook][audit_credit_lots] upsert failed", {
      error,
      payload,
    });
  }
}

type AuditCreditLotRow = {
  id: string;
  granted_quantity: number | null;
  consumed_quantity: number | null;
  expires_at: string | null;
  created_at: string;
};

async function consumeAuditCreditLot(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  values: {
    workspaceId: string;
    quantity?: number;
  }
) {
  const quantity = Math.max(1, values.quantity ?? 1);
  const nowIso = new Date().toISOString();
  let remaining = quantity;

  // Retry a few passes to handle concurrent updates without global locking.
  for (let pass = 0; pass < 5 && remaining > 0; pass += 1) {
    const { data: lots, error: lotsError } = await supabaseAdmin
      .from("audit_credit_lots")
      .select("id, granted_quantity, consumed_quantity, expires_at, created_at")
      .eq("workspace_id", values.workspaceId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(200);

    if (lotsError) {
      console.warn("[stripe][webhook][audit_credit_lots] open lot lookup failed", {
        lotsError,
        workspaceId: values.workspaceId,
      });
      return;
    }

    const openLots = ((lots ?? []) as AuditCreditLotRow[]).filter((row) => {
      const granted = Math.max(row.granted_quantity ?? 0, 0);
      const consumed = Math.max(row.consumed_quantity ?? 0, 0);
      const hasRemaining = consumed < granted;
      // Future-ready: skip expired lots when expiration starts being used.
      const isExpired = Boolean(row.expires_at && row.expires_at <= nowIso);
      return hasRemaining && !isExpired;
    });

    if (openLots.length === 0) {
      break;
    }

    let consumedThisPass = 0;

    for (const lot of openLots) {
      if (remaining <= 0) break;

      const granted = Math.max(lot.granted_quantity ?? 0, 0);
      const consumed = Math.max(lot.consumed_quantity ?? 0, 0);
      const available = Math.max(granted - consumed, 0);

      if (available <= 0) {
        continue;
      }

      const consumeNow = Math.min(remaining, available);

      const { data: updatedRows, error: updateError } = await supabaseAdmin
        .from("audit_credit_lots")
        .update({
          consumed_quantity: consumed + consumeNow,
          updated_at: nowIso,
        })
        .eq("id", lot.id)
        .eq("consumed_quantity", consumed)
        .select("id")
        .limit(1);

      if (updateError) {
        console.warn("[stripe][webhook][audit_credit_lots] consume update failed", {
          updateError,
          workspaceId: values.workspaceId,
          lotId: lot.id,
        });
        continue;
      }

      if (!updatedRows || updatedRows.length === 0) {
        // Concurrent update on the same lot; retry on next pass with fresh snapshot.
        continue;
      }

      remaining -= consumeNow;
      consumedThisPass += consumeNow;
    }

    if (consumedThisPass <= 0) {
      break;
    }
  }

  const appliedQuantity = quantity - remaining;

  if (appliedQuantity <= 0) {
    console.warn("[stripe][webhook][audit_credit_lots] no consumable lot found", {
      workspaceId: values.workspaceId,
      requestedQuantity: quantity,
    });
    return;
  }

  if (appliedQuantity < quantity) {
    console.warn("[stripe][webhook][audit_credit_lots] partial consume applied", {
      workspaceId: values.workspaceId,
      requestedQuantity: quantity,
      appliedQuantity,
    });
  }
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
    const duplicateConsumption = await findUsageEventByMetadata({
      supabaseAdmin,
      workspaceId,
      eventType: "audit_credit_consumed",
      sessionId,
      generatedAt,
      auditId: duplicateAudit.id,
    });

    if (duplicateConsumption?.id) {
      console.info("[stripe][webhook][audit_test] Audit already persisted", {
        workspaceId,
        listingId: listing.id,
        auditId: duplicateAudit.id,
        sessionId,
      });
      return;
    }

    const duplicateCredits = await getWorkspaceAuditCredits(
      workspaceId,
      supabaseAdmin
    );

    if (duplicateCredits.available < 1) {
      console.warn(
        "[stripe][webhook][audit_test] Existing audit found but no credit available to finalize unlock",
        {
          workspaceId,
          listingId: listing.id,
          auditId: duplicateAudit.id,
          sessionId,
        }
      );
      return;
    }

    await recordUsageEvent(supabaseAdmin, {
      workspaceId,
      userId: userId ?? null,
      eventType: "audit_credit_consumed",
      quantity: 1,
      metadata: {
        stripe_session_id: sessionId ?? null,
        guest_draft_generated_at: generatedAt ?? null,
        audit_id: duplicateAudit.id,
        listing_id: listing.id,
        source: "audit_test_unlock",
      },
    });

    await consumeAuditCreditLot(supabaseAdmin, {
      workspaceId,
      quantity: 1,
    });

    console.info("[stripe][webhook][audit_credits] consumed -1 for existing audit", {
      workspaceId,
      auditId: duplicateAudit.id,
      listingId: listing.id,
      sessionId,
    });
    return;
  }

  const existingConsumption = await findUsageEventByMetadata({
    supabaseAdmin,
    workspaceId,
    eventType: "audit_credit_consumed",
    sessionId,
    generatedAt,
  });

  if (existingConsumption?.id) {
    console.info("[stripe][webhook][audit_test] Credit already consumed for this audit", {
      workspaceId,
      listingId: listing.id,
      sessionId,
      generatedAt,
      usageEventId: existingConsumption.id,
    });
    return;
  }

  const credits = await getWorkspaceAuditCredits(workspaceId, supabaseAdmin);

  console.info("[stripe][webhook][audit_credits] balance before consume", {
    workspaceId,
    granted: credits.granted,
    consumed: credits.consumed,
    available: credits.available,
    sessionId,
  });

  if (credits.available < 1) {
    console.warn("[stripe][webhook][audit_test] Blocking audit unlock without available credit", {
      workspaceId,
      listingId: listing.id,
      sessionId,
      generatedAt,
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

  console.info("[stripe][webhook][audit_test] Audit persisted", {
    workspaceId,
    listingId: listing.id,
    auditId: insertedAudit.id,
    sessionId,
  });

  await recordUsageEvent(supabaseAdmin, {
    workspaceId,
    userId: userId ?? null,
    eventType: "audit_credit_consumed",
    quantity: 1,
    metadata: {
      stripe_session_id: sessionId ?? null,
      guest_draft_generated_at: generatedAt ?? null,
      audit_id: insertedAudit.id,
      listing_id: listing.id,
      source: "audit_test_unlock",
    },
  });

  await consumeAuditCreditLot(supabaseAdmin, {
    workspaceId,
    quantity: 1,
  });

  console.info("[stripe][webhook][audit_credits] consumed -1", {
    workspaceId,
    auditId: insertedAudit.id,
    listingId: listing.id,
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
) {
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
    console.error("[stripe][webhook][billing_payments] insert failed", {
      error,
      payload,
    });
  }
}

async function triggerAirtableSync() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    console.warn("[airtable-sync] NEXT_PUBLIC_APP_URL missing");
    return;
  }

  try {
    await fetch(`${appUrl}/api/sync-airtable`, {
      method: "GET",
      cache: "no-store",
    });

    console.log("[airtable-sync] triggered");
  } catch (error) {
    console.error("[airtable-sync] failed", error);
  }
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
      const session = event.data.object as CheckoutSessionEvent;

      const workspaceId =
        session?.metadata?.workspace_id ?? session?.metadata?.workspaceId;

      const userId =
        session?.metadata?.user_id ?? session?.metadata?.userId;

      const planFromMetadata = session?.metadata?.plan ?? "pro";

      console.log("[STRIPE CHECKOUT COMPLETED]", {
        sessionId: session?.id ?? null,
        customer: session?.customer ?? null,
        metadata: session?.metadata ?? null,
      });

      console.info("[stripe][webhook] checkout.session.completed received", {
        sessionId: session?.id ?? null,
        workspaceId: workspaceId ?? null,
        plan: planFromMetadata,
      });

      if (!workspaceId) {
        console.error("Missing workspace_id in metadata", {
          sessionId: session?.id ?? null,
        });
        return NextResponse.json({ received: true });
      }

      const customerId = (session.customer as string | null) ?? null;
      const subscriptionId = (session.subscription as string | null) ?? null;

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
        }
      }

      const resolvedPlanCode =
        planFromMetadata === "audit_test"
          ? "pro"
          : getPlanCodeFromPlan(planFromMetadata, subscriptionStatus);

      await updateWorkspaceSubscriptionByWorkspaceId(supabaseAdmin, workspaceId, {
        plan_code: resolvedPlanCode,
        status: subscriptionStatus,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      });

      const amount =
        planFromMetadata === "audit_test"
          ? 9
          : planFromMetadata === "scale"
          ? 79
          : 39;

      const normalizedPlanCode =
        planFromMetadata === "audit_test" ? "starter" : planFromMetadata;

      await insertBillingPayment(supabaseAdmin, {
        workspaceId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeCheckoutSessionId: session.id ?? null,
        source: subscriptionId ? "subscription" : "checkout",
        paymentType:
          planFromMetadata === "audit_test" ? "one_shot" : "subscription",
        planCode: normalizedPlanCode,
        amount,
        currency: "eur",
        status: "succeeded",
        paidAt: new Date().toISOString(),
        metadata: {
          event_type: "checkout.session.completed",
          stripe_session_id: session?.id ?? null,
          original_plan: planFromMetadata,
        },
      });

      await triggerAirtableSync();
      await alertIfWorkspaceIsAnomaly(workspaceId);

      if (planFromMetadata !== "audit_test") {
        const grantQuantity = getCreditGrantQuantityForPlan(planFromMetadata);

        if (grantQuantity > 0) {
          const existingGrant = await findUsageEventByMetadata({
            supabaseAdmin,
            workspaceId,
            eventType: "audit_credit_granted",
            sessionId: session?.id ?? null,
          });

          if (existingGrant?.id) {
            console.info(
              "[stripe][webhook][audit_credits] grant already recorded for subscription checkout",
              {
                workspaceId,
                sessionId: session?.id ?? null,
                usageEventId: existingGrant.id,
                plan: planFromMetadata,
              }
            );
          } else {
            await recordUsageEvent(supabaseAdmin, {
              workspaceId,
              userId: userId ?? null,
              eventType: "audit_credit_granted",
              quantity: grantQuantity,
              metadata: {
                stripe_session_id: session?.id ?? null,
                stripe_customer_id: customerId,
                plan: planFromMetadata,
                source: "subscription_checkout",
              },
            });

            await recordAuditCreditLotGrant(supabaseAdmin, {
              workspaceId,
              sourceType: "stripe_checkout_subscription",
              sourceRef: session?.id ?? subscriptionId ?? event.id,
              planCode: planFromMetadata,
              grantedQuantity: grantQuantity,
              periodStart: new Date().toISOString(),
              periodEnd: currentPeriodEnd,
              expiresAt: currentPeriodEnd,
              metadata: {
                stripe_session_id: session?.id ?? null,
                stripe_subscription_id: subscriptionId,
                stripe_customer_id: customerId,
                usage_event_type: "audit_credit_granted",
              },
            });

            console.info(
              "[stripe][webhook][audit_credits] granted from subscription checkout",
              {
                workspaceId,
                sessionId: session?.id ?? null,
                plan: planFromMetadata,
                quantity: grantQuantity,
              }
            );
          }
        }
      }

      if (planFromMetadata === "audit_test") {
        const auditQuantity = Math.min(
          50,
          Math.max(1, Number(session?.metadata?.audit_quantity ?? "1") || 1)
        );

        const existingGrant = await findUsageEventByMetadata({
          supabaseAdmin,
          workspaceId,
          eventType: "audit_test_purchased",
          sessionId: session?.id ?? null,
        });

        if (existingGrant?.id) {
          console.info("[stripe][webhook][audit_credits] grant already recorded", {
            workspaceId,
            sessionId: session?.id ?? null,
            usageEventId: existingGrant.id,
          });
        } else {
          await recordUsageEvent(supabaseAdmin, {
            workspaceId,
            userId: userId ?? null,
            eventType: "audit_test_purchased",
            quantity: auditQuantity,
            metadata: {
              stripe_session_id: session?.id ?? null,
              stripe_customer_id: customerId,
              plan: planFromMetadata,
              audit_quantity: auditQuantity,
            },
          });

          await recordAuditCreditLotGrant(supabaseAdmin, {
            workspaceId,
            sourceType: "stripe_checkout_audit_test",
            sourceRef: session?.id ?? event.id,
            planCode: "starter",
            grantedQuantity: auditQuantity,
            periodStart: new Date().toISOString(),
            metadata: {
              stripe_session_id: session?.id ?? null,
              stripe_customer_id: customerId,
              usage_event_type: "audit_test_purchased",
            },
          });

          console.info("[stripe][webhook][audit_credits] granted", {
            workspaceId,
            sessionId: session?.id ?? null,
            plan: planFromMetadata,
            quantity: auditQuantity,
          });
        }

        await persistAuditTestPurchase({
          supabaseAdmin,
          workspaceId,
          userId: userId ?? null,
          sessionId: session?.id ?? null,
          listingUrl: session?.metadata?.audit_listing_url ?? null,
          title: session?.metadata?.audit_title ?? null,
          platform: session?.metadata?.audit_platform ?? null,
          generatedAt: session?.metadata?.audit_generated_at ?? null,
          score: session?.metadata?.audit_score ?? null,
          summary: session?.metadata?.audit_summary ?? null,
        });

        console.info("[stripe][webhook][audit_test] purchase recorded", {
          sessionId: session?.id ?? null,
          workspaceId,
          action: "subscription_updated_usage_event_inserted_audit_persisted",
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

      await triggerAirtableSync();

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

      await triggerAirtableSync();
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
