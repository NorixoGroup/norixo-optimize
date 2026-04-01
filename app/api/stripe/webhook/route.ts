import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/stripe/server";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
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
  } | null;
};

type SubscriptionEvent = {
  id?: string;
  customer?: string;
  status?: string;
  current_period_end?: number;
  items?: {
    data?: Array<{
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
  subscription?: string | null;
  customer?: string | null;
  status?: string | null;
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

function getPlanCodeFromPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;

  const scalePriceIds = [
    process.env.STRIPE_SCALE_MONTHLY_PRICE_ID,
    process.env.STRIPE_SCALE_YEARLY_PRICE_ID,
  ].filter(Boolean);

  const proPriceIds = [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    process.env.STRIPE_PRO_PRICE_ID,
  ].filter(Boolean);

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
  const { supabaseAdmin, workspaceId, eventType, sessionId, generatedAt, auditId } = params;

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
    console.warn("[stripe][webhook][audit_test] Missing listing URL, skipping audit persistence", {
      workspaceId,
      sessionId,
    });
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

    const duplicateCredits = await getWorkspaceAuditCredits(workspaceId, supabaseAdmin);

    if (duplicateCredits.available < 1) {
      console.warn("[stripe][webhook][audit_test] Existing audit found but no credit available to finalize unlock", {
        workspaceId,
        listingId: listing.id,
        auditId: duplicateAudit.id,
        sessionId,
      });
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

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("Missing Stripe signature or webhook secret");
    return NextResponse.json({ error: "Invalid webhook configuration" }, { status: 400 });
  }

  let event;

  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    console.log("[STRIPE WEBHOOK RECEIVED]");
    console.log("[STRIPE EVENT]", (event as Stripe.Event).type);

    const supabaseAdmin = createSupabaseAdminClient();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as CheckoutSessionEvent;
      const workspaceId = (session?.metadata?.workspace_id ??
        session?.metadata?.workspaceId) as string | undefined;
      const userId = (session?.metadata?.user_id ?? session?.metadata?.userId) as
        | string
        | undefined;
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
        console.error(
          "Stripe webhook checkout.session.completed missing workspace_id in metadata",
          { sessionId: session?.id }
        );
      } else {
        const customerId = (session?.customer as string | null) ?? null;
        const subscriptionId = (session?.subscription as string | null) ?? null;
        let subscriptionStatus: string | null = "active";
        let currentPeriodEnd: string | null = null;

        console.info("[stripe][webhook] workspace resolved for checkout completion", {
          sessionId: session?.id ?? null,
          workspaceId,
          hasCustomerId: Boolean(customerId),
          hasSubscriptionId: Boolean(subscriptionId),
          plan: planFromMetadata,
        });

        if (subscriptionId) {
          try {
            const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
            const subscription = unwrapStripeSubscription(subscriptionResponse);
            subscriptionStatus = subscription.status ?? "active";
            const currentPeriodEndTimestamp =
              getStripeSubscriptionCurrentPeriodEnd(subscription);
            currentPeriodEnd =
              typeof currentPeriodEndTimestamp === "number"
                ? new Date(currentPeriodEndTimestamp * 1000).toISOString()
                : null;
          } catch (error) {
            console.error("Failed to retrieve Stripe subscription after checkout", {
              error,
              subscriptionId,
              workspaceId,
            });
          }
        }

        if (!customerId) {
          console.error(
            "Stripe webhook checkout.session.completed missing customer on session",
            { sessionId: session?.id, workspaceId }
          );
        }

        if (!subscriptionId) {
          console.error(
            "Stripe webhook checkout.session.completed missing subscription on session",
            { sessionId: session?.id, workspaceId }
          );
        }

        if (planFromMetadata === "audit_test") {
          console.info("[stripe][webhook][audit_test] applying one-shot purchase", {
            sessionId: session?.id ?? null,
            workspaceId,
          });
        }

        const resolvedPlanCode =
          planFromMetadata === "audit_test"
            ? "pro"
            : getPlanCodeFromPlan(planFromMetadata, subscriptionStatus);

        console.log("[STRIPE UPDATE SUBSCRIPTION]", {
          workspaceId,
          planCode: resolvedPlanCode,
        });

        await updateWorkspaceSubscriptionByWorkspaceId(supabaseAdmin, workspaceId, {
          plan_code: resolvedPlanCode,
          status: subscriptionStatus ?? "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        });

        console.log("[STRIPE UPDATE DONE]");

        if (planFromMetadata === "audit_test") {
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
              quantity: 1,
              metadata: {
                stripe_session_id: session?.id ?? null,
                stripe_customer_id: customerId,
                plan: planFromMetadata,
              },
            });
            console.info("[stripe][webhook][audit_credits] granted +1", {
              workspaceId,
              sessionId: session?.id ?? null,
              plan: planFromMetadata,
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
      const stripeSubscriptionId = invoice?.subscription ?? null;
      const stripeCustomerId = invoice?.customer ?? null;

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
    }
  } catch (err) {
    console.error("Stripe webhook handler error", err);
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
