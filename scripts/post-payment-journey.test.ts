import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Harmless placeholders so that modules that create a Supabase client at import time can load. Nothing connects to it:
// every test uses an in-memory fake client or reads source text.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:9";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "placeholder-not-a-key";

import { draftHasRealResult } from "../lib/guestAudit/draftResult";
import { BILLING_PATH, getAuditEntryDestinations } from "../lib/guestAudit/entryDestination";
import {
  POST_PAYMENT_AUDIT_PATH,
  POST_PAYMENT_CONFIRMATION_WAIT_MS,
  getPostPaymentAuditUrl,
  nextPostPaymentStep,
  resolvePostPaymentState,
} from "../lib/billing/postPayment";

/**
 * Post-payment journey (credits, confirmation, e-mail link, entry page). Deterministic: no payment, no Stripe key, no
 * Supabase connection, no model call, no network. Route handlers cannot be run without their services, so their
 * guarantees are checked on their source text and labelled as such.
 *
 *   npx tsx scripts/post-payment-journey.test.ts
 */

const read = (path: string) => readFileSync(path, "utf8");
const WEBHOOK = read("app/api/stripe/webhook/route.ts");
const BILLING_PAGE = read("app/(default)/dashboard/billing/page.tsx");
const AUDIT_NEW = read("app/(default)/audit/new/AuditNewContent.tsx");
const GRANTS = read("lib/billing/webhookCreditGrants.ts");
const MIGRATION = read("supabase/migrations/20260714110000_create_audit_entitlement_reservations.sql");

type Lot = { granted_quantity: number; consumed_quantity: number };

/** In-memory stand-in for the Supabase client: only what canCreateAudit and the credit balance read. */
function fakeClient(options: { plan: string; audits: number; lots: Lot[] }) {
  const resolveTable = (table: string) => {
    if (table === "audits") return { count: options.audits, data: null, error: null };
    if (table === "audit_credit_lots") return { data: options.lots, error: null };
    if (table === "usage_events") return { data: [], error: null };
    return { data: null, error: null };
  };
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order", "limit"]) builder[method] = () => builder;
    builder.maybeSingle = async () =>
      table === "subscriptions"
        ? { data: { id: "sub", workspace_id: "w1", plan_code: options.plan, status: "active", stripe_subscription_id: null, current_period_end: null, created_at: "", updated_at: "" }, error: null }
        : { data: null, error: null };
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(resolveTable(table)).then(resolve, reject);
    return builder;
  };
  return { from } as never;
}

const quiet = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const { log, info, warn } = console;
  console.log = console.info = console.warn = () => {};
  try {
    return await fn();
  } finally {
    Object.assign(console, { log, info, warn });
  }
};

test("1-2. a confirmed purchase (Starter and packs) is 'credit available' only when the intent is completed", () => {
  const completed = { status: "completed", completed_at: "2026-10-23T10:00:00Z" };
  for (const plan of ["audit_test", "starter", "pro", "scale"]) {
    assert.equal(resolvePostPaymentState({ ...completed }), "confirmed", plan);
    assert.equal(nextPostPaymentStep("confirmed", 0), "show_credit_available");
  }
  // webhook order (source text; the grant itself is executed in post-payment-behavior.test.ts): both grants are awaited
  // BEFORE the intent is marked completed, and a failed grant answers 500 instead of continuing
  const starterCall = WEBHOOK.indexOf("await grantStarterCheckoutCredit(");
  const packCall = WEBHOOK.indexOf("await grantPackCheckoutCredit(");
  const completedCall = WEBHOOK.indexOf("markCheckoutIntentCompleted(", Math.max(starterCall, packCall));
  assert.ok(starterCall > 0 && packCall > 0 && completedCall > Math.max(starterCall, packCall), "grants precede completion");
  assert.match(WEBHOOK, /if \(!grant\.ok\)|\.ok\)\s*\{[\s\S]{0,120}status: 500/);
  assert.match(GRANTS, /sourceType: "stripe_checkout_audit_test"/);
  assert.match(GRANTS, /const creditLotSourceType = "stripe_checkout_pack"/);
});

test("3-4. a pending payment never shows 'credit available'", () => {
  for (const intent of [null, undefined, {}, { status: "pending" }, { status: "completed" }, { status: "completed", completed_at: null }, { status: "something_else" }]) {
    assert.equal(resolvePostPaymentState(intent as never), "pending", JSON.stringify(intent));
  }
  assert.equal(nextPostPaymentStep("pending", 0), "keep_waiting");
  assert.equal(nextPostPaymentStep("pending", POST_PAYMENT_CONFIRMATION_WAIT_MS - 1), "keep_waiting");
  assert.equal(nextPostPaymentStep("pending", POST_PAYMENT_CONFIRMATION_WAIT_MS), "show_still_pending");
  assert.equal(resolvePostPaymentState({ status: "failed" }), "failed");
  assert.equal(nextPostPaymentStep("failed", 0), "show_failure");
  // billing page (source): the success banner is set only for the "credit_available" outcome of the waiting loop
  assert.equal((BILLING_PAGE.match(/setCheckoutStatus\("success"\)/g) ?? []).length, 1);
  assert.match(BILLING_PAGE, /outcome === "credit_available"\) \{\s*setCheckoutStatus\("success"\)/);
  assert.match(BILLING_PAGE, /\/api\/billing\/checkout-intent-status\?session_id=/);
  // the status route answers for one session, scoped to the caller's workspace
  const route = read("app/api/billing/checkout-intent-status/route.ts");
  assert.match(route, /findCheckoutIntentForSession\(\s*supabaseAdmin,\s*workspace\.id,\s*sessionId/);
});

test("5. a purchased credit is usable on the free plan, without opening free audits", async () => {
  const { canCreateAudit } = await import("../lib/billing/canCreateAudit");
  const lot = (granted: number, consumed: number): Lot => ({ granted_quantity: granted, consumed_quantity: consumed });
  const check = (plan: string, audits: number, lots: Lot[]) => quiet(() => canCreateAudit("w1", fakeClient({ plan, audits, lots })));

  // free plan, allowance used, one purchased credit: allowed, flagged as credit-backed
  const withCredit = await check("free", 1, [lot(1, 0)]);
  assert.equal(withCredit.allowed, true);
  assert.equal(withCredit.hasAvailableCredits, true);
  // credit already consumed, or never bought: still refused (no free audit)
  assert.equal((await check("free", 1, [lot(1, 1)])).allowed, false);
  assert.equal((await check("free", 3, [])).allowed, false);
  assert.equal((await check("free", 3, [])).hasAvailableCredits, undefined);
  assert.match((await check("free", 1, [lot(5, 5)])).reason ?? "", /Découverte/);
  // unchanged behaviours: first audit of a free workspace, paid plans
  const first = await check("free", 0, []);
  assert.equal(first.allowed, true);
  assert.equal(first.hasAvailableCredits, undefined);
  assert.equal((await check("pro", 9, [])).allowed, true);
  // both routes drop the free-plan gate only for credit-backed workspaces ...
  for (const file of ["app/api/audits/route.ts", "app/api/listings/route.ts"]) {
    assert.match(read(file), /enforceFreePlanLimit: quota\?\.planCode === "free" && !quota\.hasAvailableCredits/, file);
  }
  // ... and the reservation itself still demands an available credit lot for every non-admin audit
  const afterFreeGate = MIGRATION.slice(MIGRATION.indexOf("if not p_billing_admin_bypass then"));
  assert.match(afterFreeGate, /insufficient_credits/);
  assert.match(MIGRATION, /free_plan_limit_reached/);
});

test("6. no fictitious audit or score is created or shown", () => {
  // webhook and billing page no longer create or restore an audit from a guest draft
  assert.ok(!/persistAuditTestPurchase|restored_after_payment|stripe_webhook_audit_test/.test(WEBHOOK));
  assert.ok(!/\.from\("audits"\)\s*\.insert/.test(WEBHOOK));
  assert.ok(!/persistGuestAuditDraftAfterPayment/.test(BILLING_PAGE));
  // the entry page shows a preview only from a draft that carries a real numeric score
  assert.equal(draftHasRealResult({ full_payload: null, preview_payload: null, result: { raw_payload: null } }), false);
  assert.equal(draftHasRealResult({ result: {} }), false);
  assert.equal(draftHasRealResult({ preview_payload: { title: "x" } }), false);
  assert.equal(draftHasRealResult({ preview_payload: { score: "7" } }), false);
  assert.equal(draftHasRealResult({ preview_payload: { score: Number.NaN } }), false);
  assert.equal(draftHasRealResult({ preview_payload: [7] }), false);
  assert.equal(draftHasRealResult({ full_payload: { score: 6.4 } }), true);
  assert.match(AUDIT_NEW, /shouldRestoreDraftResult && draftHasRealResult\(storedDraft\)/);
  // invented placeholder values are gone
  assert.ok(!/"7\.8\/10"|\? String\(signalCount\) : "3"|\? String\(axesCount\) : "2"|draft\.result\.score \?\? 0/.test(AUDIT_NEW.replace(/rawPayload\?\.score \?\? draft\.result\.score \?\? 0/, "")));
  // the page no longer saves a draft or starts anything on submit
  assert.ok(!/saveGuestAuditDraft\(\{\s*guest_token/.test(AUDIT_NEW));
  assert.ok(!/getOrCreateGuestAuditToken/.test(AUDIT_NEW));
});

test("7. no double consumption and no replay: the webhook only grants, once per session", () => {
  assert.ok(!/consumeWorkspaceAuditCredits\(|import[^;]*consumeWorkspaceAuditCredits/.test(WEBHOOK), "the webhook never calls the consumption helper");
  assert.match(GRANTS, /blocked_audit_credit_consumed_via_webhook/, "an attempt to record a consumption through the webhook is refused");
  assert.deepEqual(GRANTS.match(/consumed_quantity:\s*[^,\n]+/g), ["consumed_quantity: 0"], "lots are created with nothing consumed");
  // replay protection (source text; executed in post-payment-behavior.test.ts): lookup per session + unique lot
  assert.match(GRANTS, /findUsageEventByMetadata\(\{[\s\S]{0,120}eventType: "audit_test_purchased"/);
  assert.match(GRANTS, /findUsageEventByMetadata\(\{[\s\S]{0,160}sessionId: sessionRef/);
  assert.match(GRANTS, /onConflict: "source_type,source_ref"/);
  assert.match(GRANTS, /ignoreDuplicates: true/);
  // a completed intent is reported the same way however often it is read
  const completed = { status: "completed", completed_at: "2026-10-23T10:00:00Z" };
  assert.deepEqual([1, 2, 3].map(() => resolvePostPaymentState(completed)), ["confirmed", "confirmed", "confirmed"]);
  // consumption stays in the audit routes, behind the reservation
  for (const file of ["app/api/audits/route.ts", "app/api/listings/route.ts"]) assert.match(read(file), /reserveAuditEntitlement\(/, file);
});

test("8. the e-mail link leads to the dashboard flow, not to /audit/new", () => {
  assert.equal(POST_PAYMENT_AUDIT_PATH, "/dashboard/listings/new");
  assert.equal(getPostPaymentAuditUrl("https://norixo.io"), "https://norixo.io/dashboard/listings/new");
  assert.equal(getPostPaymentAuditUrl("https://norixo.io/"), "https://norixo.io/dashboard/listings/new");
  assert.equal((WEBHOOK.match(/getPostPaymentAuditUrl\(appUrl\)/g) ?? []).length, 2, "text and HTML versions");
  assert.ok(!WEBHOOK.includes("/audit/new"));
  assert.ok(!/rapport (déjà )?généré|your report is ready/i.test(WEBHOOK.slice(WEBHOOK.indexOf("function getPaymentConfirmationCopy"), WEBHOOK.indexOf("function getPaymentConfirmationCopy") + 4000)));
});

test("9-10. sign-in and redirection: no loop, offer kept, nothing injected", () => {
  const guest = getAuditEntryDestinations({ isAuthenticated: false, offer: "pack_5" });
  assert.equal(guest.auditHref, `/sign-in?next=${encodeURIComponent("/dashboard/listings/new")}`);
  assert.equal(guest.billingHref, `/sign-in?next=${encodeURIComponent("/dashboard/billing?offer=pack_5")}`);
  const member = getAuditEntryDestinations({ isAuthenticated: true, offer: "audit_test" });
  assert.equal(member.auditHref, "/dashboard/listings/new");
  assert.equal(member.billingHref, "/dashboard/billing?offer=audit_test");
  assert.equal(getAuditEntryDestinations({ isAuthenticated: true }).billingHref, BILLING_PATH);
  for (const offer of ["x&next=https://evil.example", "pack_5/../..", "", null, undefined, "PACK_5"]) {
    const result = getAuditEntryDestinations({ isAuthenticated: false, offer });
    assert.equal(result.billingHref, `/sign-in?next=${encodeURIComponent(BILLING_PATH)}`, String(offer));
  }
  for (const authenticated of [true, false]) {
    for (const offer of ["audit_test", "pack_5", "pack_15", null]) {
      const { auditHref, billingHref } = getAuditEntryDestinations({ isAuthenticated: authenticated, offer });
      assert.ok(!auditHref.includes("/audit/new") && !decodeURIComponent(billingHref).includes("/audit/new"), "never back to the entry page");
    }
  }
  // the page routes only on a user action: no automatic redirect, no call to the disabled guest audit
  assert.match(AUDIT_NEW, /router\.push\(entryDestinations\.auditHref\)/);
  assert.ok(!/router\.replace/.test(AUDIT_NEW));
  assert.ok(!/api\/guest-audit/.test(AUDIT_NEW));
  assert.match(AUDIT_NEW, /href=\{entryDestinations\.billingHref\}/);
});
