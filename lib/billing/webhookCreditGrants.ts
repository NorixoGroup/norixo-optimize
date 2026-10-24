/**
 * Credit grants of the Stripe webhook (S5.4 payment fix). These functions were moved out of
 * app/api/stripe/webhook/route.ts WITHOUT changing their behaviour so that the grant and replay logic can be executed
 * against an in-memory client in tests. The route keeps the signature, workspace-binding and price checks and maps a
 * failed result to the same 500 responses as before.
 *
 * Rules kept here: the webhook only GRANTS credits (a lot with nothing consumed, plus a usage event); consumption happens
 * only in /api/audits and /api/listings behind the reservation. A replay of the same Stripe session finds its usage
 * event, or hits the unique lot (source_type, source_ref), and grants nothing more.
 */
import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const WEBHOOK_SECURITY = "[stripe][webhook][security]";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export function logStripeCreditWorkspaceBindingAccepted(params: {
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

export async function recordUsageEvent(
  supabaseAdmin: AdminClient,
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

export async function recordAuditCreditLotGrant(
  supabaseAdmin: AdminClient,
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

export async function fetchAuditCreditLotTotals(
  supabaseAdmin: AdminClient,
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

/** A failed read is NOT "no grant yet": callers must stop instead of granting again. */
export class UsageEventLookupError extends Error {}

export async function findUsageEventByMetadata(params: {
  supabaseAdmin: AdminClient;
  workspaceId: string;
  eventType: string;
  sessionId?: string | null;
  generatedAt?: string | null;
  auditId?: string | null;
}) {
  const { supabaseAdmin, workspaceId, eventType, sessionId, generatedAt, auditId } =
    params;

  // A Stripe session is looked up directly on the event metadata, not in the "last 50 events" window: a replayed old
  // session must still find its usage event, otherwise a duplicate event would inflate the usage-based balance.
  if (sessionId && !generatedAt && !auditId) {
    const { data: bySession, error: bySessionError } = await supabaseAdmin
      .from("usage_events")
      .select("id, metadata")
      .eq("workspace_id", workspaceId)
      .eq("event_type", eventType)
      .eq("metadata->>stripe_session_id", sessionId)
      .limit(1);

    if (bySessionError) {
      console.error("Failed to load usage event by session for idempotence check", {
        error: bySessionError,
        workspaceId,
        eventType,
        sessionId,
      });
      throw new UsageEventLookupError("usage_event_lookup_failed");
    }

    return ((bySession ?? []) as UsageEventRow[])[0] ?? null;
  }

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
    throw new UsageEventLookupError("usage_event_lookup_failed");
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


type GrantBase = {
  supabaseAdmin: AdminClient;
  workspaceId: string;
  userId?: string | null;
  sessionRef: string;
  customerId: string | null;
  subscriptionStripeCustomerForDb: string | null;
  checkoutIntentIdMeta: string | null;
  eventType: string;
  eventId: string;
};

export type GrantResult =
  | { ok: true; outcome: "granted" | "already_granted" | "nothing_to_grant" }
  | { ok: false; error: "stripe_webhook_lot_failed" | "stripe_webhook_grant_failed" | "stripe_webhook_idempotency_lookup_failed" };

/** Pack purchases (Pro 5, Scale 15, Starter pack 1): one lot + one `audit_credit_granted` usage event per Stripe session. */
export async function grantPackCheckoutCredit(
  params: GrantBase & {
    planFromMetadata: string;
    grantQuantity: number;
    currentPeriodEnd: string | null;
    subscriptionId: string | null;
  }
): Promise<GrantResult> {
  const { supabaseAdmin, workspaceId, userId, sessionRef, customerId, subscriptionStripeCustomerForDb, checkoutIntentIdMeta, planFromMetadata, grantQuantity, currentPeriodEnd, subscriptionId } = params;
  const creditGrantSource =
    planFromMetadata === "scale" || planFromMetadata === "pro" || planFromMetadata === "starter"
      ? "pack_checkout"
      : "subscription_checkout";
  const creditLotSourceType = "stripe_checkout_pack";

  let existingPackGrant: Awaited<ReturnType<typeof findUsageEventByMetadata>>;
  try {
    existingPackGrant = await findUsageEventByMetadata({
      supabaseAdmin,
      workspaceId,
      eventType: "audit_credit_granted",
      sessionId: sessionRef,
  });
  } catch (error) {
    if (error instanceof UsageEventLookupError) return { ok: false, error: "stripe_webhook_idempotency_lookup_failed" };
    throw error;
  }

  if (existingPackGrant?.id) {
    console.info("[billing][grant][idempotency] pack_grant_usage_event_exists", {
      workspaceId,
      planCode: planFromMetadata,
      sessionId: sessionRef,
      eventId: params.eventId,
      usageEventId: existingPackGrant.id,
    });
  } else if (grantQuantity > 0) {
    const totalsBeforeGrant = await fetchAuditCreditLotTotals(supabaseAdmin, workspaceId);

    console.info("[billing][grant] inserting_pack_grant", {
      workspaceId,
      planCode: planFromMetadata,
      sessionId: sessionRef,
      eventId: params.eventId,
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
      return { ok: false, error: "stripe_webhook_lot_failed" };
    }

    logStripeCreditWorkspaceBindingAccepted({
      eventType: params.eventType,
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
      return { ok: false, error: "stripe_webhook_grant_failed" };
    }

    const totalsAfterGrant = await fetchAuditCreditLotTotals(supabaseAdmin, workspaceId);

    console.info("[billing][grant] pack_checkout_credits_applied", {
      workspaceId,
      planCode: planFromMetadata,
      sessionId: sessionRef,
      eventId: params.eventId,
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

  return { ok: true, outcome: existingPackGrant?.id ? "already_granted" : grantQuantity > 0 ? "granted" : "nothing_to_grant" };
}

/** Starter bought through the guest/audit_test checkout: one lot + one `audit_test_purchased` usage event per session. */
export async function grantStarterCheckoutCredit(
  params: GrantBase & { auditQuantity: number }
): Promise<GrantResult> {
  const { supabaseAdmin, workspaceId, userId, sessionRef, customerId, subscriptionStripeCustomerForDb, checkoutIntentIdMeta, auditQuantity } = params;
  const planFromMetadata = "audit_test";

  let existingStarterGrant: Awaited<ReturnType<typeof findUsageEventByMetadata>>;
  try {
    existingStarterGrant = await findUsageEventByMetadata({
      supabaseAdmin,
      workspaceId,
      eventType: "audit_test_purchased",
      sessionId: sessionRef,
  });
  } catch (error) {
    if (error instanceof UsageEventLookupError) return { ok: false, error: "stripe_webhook_idempotency_lookup_failed" };
    throw error;
  }

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
      return { ok: false, error: "stripe_webhook_lot_failed" };
    }

    logStripeCreditWorkspaceBindingAccepted({
      eventType: params.eventType,
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
      return { ok: false, error: "stripe_webhook_grant_failed" };
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

  return { ok: true, outcome: existingStarterGrant?.id ? "already_granted" : "granted" };
}
