import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:9";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "placeholder-not-a-key";

import { resolvePlanCodeAfterPurchase } from "../lib/billing/planAfterPurchase";
import { hasPaidAuditSignal } from "../lib/audits/paidAuditSignal";
import { findCheckoutIntentForSession } from "../lib/billing/checkoutIntentLookup";
import { POST_PAYMENT_CONFIRMATION_WAIT_MS, resolvePostPaymentState, waitForPostPaymentConfirmation } from "../lib/billing/postPayment";
import { grantPackCheckoutCredit, grantStarterCheckoutCredit } from "../lib/billing/webhookCreditGrants";
import { getAuditEntryDestinations } from "../lib/guestAudit/entryDestination";
import { CREDIT_LOT_UNIQUES, InMemoryDatabase } from "./support/inMemorySupabase";

/**
 * Behavioural tests: the REAL grant / balance / gate / polling functions run against an in-memory database double.
 * Scope, stated honestly: these exercise the functions extracted from the Stripe webhook (grantStarterCheckoutCredit,
 * grantPackCheckoutCredit), canCreateAudit, getWorkspaceAuditCredits, findCheckoutIntentForSession,
 * waitForPostPaymentConfirmation and hasPaidAuditSignal. They are NOT a full webhook test (no Stripe signature, no
 * e-mail, no route) and the SQL reservation RPC (row locks => no double consumption) cannot run without Postgres.
 *
 *   npx tsx scripts/post-payment-behavior.test.ts
 */

const quiet = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const saved = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  console.log = console.info = console.warn = console.error = () => {};
  try {
    return await fn();
  } finally {
    Object.assign(console, saved);
  }
};

const newDb = () => new InMemoryDatabase({ unique: CREDIT_LOT_UNIQUES });
const base = (db: InMemoryDatabase, workspaceId = "w1", sessionRef = "cs_1") => ({
  supabaseAdmin: db.client(),
  workspaceId,
  userId: "u1",
  sessionRef,
  customerId: null,
  subscriptionStripeCustomerForDb: null,
  checkoutIntentIdMeta: "ci_1",
  eventType: "checkout.session.completed",
  eventId: "evt_1",
});
const starter = (db: InMemoryDatabase, workspaceId?: string, sessionRef?: string) =>
  quiet(() => grantStarterCheckoutCredit({ ...base(db, workspaceId, sessionRef), auditQuantity: 1 }));
const pack = (db: InMemoryDatabase, plan: string, qty: number, workspaceId?: string, sessionRef?: string) =>
  quiet(() => grantPackCheckoutCredit({ ...base(db, workspaceId, sessionRef), planFromMetadata: plan, grantQuantity: qty, currentPeriodEnd: null, subscriptionId: null }));
const lots = (db: InMemoryDatabase, workspaceId = "w1") => db.rows("audit_credit_lots").filter((r) => r.workspace_id === workspaceId);
const events = (db: InMemoryDatabase, type: string, workspaceId = "w1") => db.rows("usage_events").filter((r) => r.workspace_id === workspaceId && r.event_type === type);
const balance = async (db: InMemoryDatabase, workspaceId = "w1") => {
  const { getWorkspaceAuditCredits } = await import("../lib/billing/getWorkspaceAuditCredits");
  return quiet(() => getWorkspaceAuditCredits(workspaceId, db.client()));
};
const gate = async (db: InMemoryDatabase, workspaceId = "w1") => {
  const { canCreateAudit } = await import("../lib/billing/canCreateAudit");
  return quiet(() => canCreateAudit(workspaceId, db.client()));
};
const freeWorkspace = (db: InMemoryDatabase, audits: number, workspaceId = "w1") => {
  db.seed("subscriptions", [{ workspace_id: workspaceId, plan_code: "free", status: "active" }]);
  db.seed("audits", Array.from({ length: audits }, () => ({ workspace_id: workspaceId })));
};

test("Starter paid: one lot of 1 credit (nothing consumed), one usage event, credit visible in the balance", async () => {
  const db = newDb();
  assert.deepEqual(await starter(db), { ok: true, outcome: "granted" });
  assert.equal(lots(db).length, 1);
  assert.equal(lots(db)[0].source_type, "stripe_checkout_audit_test");
  assert.equal(lots(db)[0].source_ref, "cs_1");
  assert.equal(lots(db)[0].granted_quantity, 1);
  assert.equal(lots(db)[0].consumed_quantity, 0);
  assert.equal(events(db, "audit_test_purchased").length, 1);
  assert.equal(events(db, "audit_credit_consumed").length, 0, "granting never consumes");
  assert.deepEqual(await balance(db), { granted: 1, consumed: 0, available: 1 });
});

test("pack paid: Pro=5 and Scale=15 credits in one lot each, Starter pack=1; other workspaces untouched", async () => {
  for (const [plan, qty] of [["pro", 5], ["scale", 15], ["starter", 1]] as const) {
    const db = newDb();
    assert.deepEqual(await pack(db, plan, qty), { ok: true, outcome: "granted" }, plan);
    assert.equal(lots(db).length, 1, plan);
    assert.equal(lots(db)[0].source_type, "stripe_checkout_pack");
    assert.equal(lots(db)[0].granted_quantity, qty);
    assert.equal(events(db, "audit_credit_granted").length, 1);
    assert.equal((await balance(db)).available, qty);
    assert.equal((await balance(db, "other")).available, 0, "another workspace gets nothing");
  }
});

test("zero-quantity pack grants nothing", async () => {
  const db = newDb();
  assert.deepEqual(await pack(db, "pro", 0), { ok: true, outcome: "nothing_to_grant" });
  assert.equal(lots(db).length + db.rows("usage_events").length, 0);
});

test("webhook replayed: same session twice (Starter and pack) still gives ONE credit", async () => {
  const db = newDb();
  assert.equal((await starter(db)).ok, true);
  const replay = await starter(db);
  assert.deepEqual(replay, { ok: true, outcome: "already_granted" });
  assert.equal(lots(db).length, 1);
  assert.equal(events(db, "audit_test_purchased").length, 1);
  assert.equal((await balance(db)).available, 1);

  const db2 = newDb();
  await pack(db2, "pro", 5);
  assert.equal((await pack(db2, "pro", 5)).ok, true);
  assert.equal(lots(db2).length, 1);
  assert.equal(events(db2, "audit_credit_granted").length, 1);
  assert.equal((await balance(db2)).available, 5);
});

test("two different sessions give two credits (replay protection is per session, not per workspace)", async () => {
  const db = newDb();
  await starter(db, "w1", "cs_1");
  await starter(db, "w1", "cs_2");
  assert.equal((await balance(db)).available, 2);
});

test("partial failure then Stripe retry: usage-event insert fails, retry completes with a single lot", async () => {
  const db = newDb();
  db.failOnce("usage_events", "insert");
  assert.deepEqual(await starter(db), { ok: false, error: "stripe_webhook_grant_failed" });
  assert.equal(lots(db).length, 1, "lot written before the failure");
  const retry = await starter(db);
  assert.deepEqual(retry, { ok: true, outcome: "granted" });
  assert.equal(lots(db).length, 1, "unique (source_type, source_ref) prevents a second lot");
  assert.equal(events(db, "audit_test_purchased").length, 1);
  assert.equal((await balance(db)).available, 1);
});

test("lot write failure is reported (webhook answers 500 so Stripe retries) and grants nothing", async () => {
  const db = newDb();
  db.failOnce("audit_credit_lots", "upsert");
  assert.deepEqual(await starter(db), { ok: false, error: "stripe_webhook_lot_failed" });
  assert.equal(db.rows("usage_events").length, 0);
  const db2 = newDb();
  db2.failOnce("audit_credit_lots", "upsert");
  assert.deepEqual(await pack(db2, "scale", 15), { ok: false, error: "stripe_webhook_lot_failed" });
  assert.equal(db2.rows("usage_events").length, 0);
});

test("credit on free plan: allowance used + purchased credit => allowed and flagged; no credit / consumed credit => refused", async () => {
  const withCredit = newDb();
  freeWorkspace(withCredit, 1);
  await starter(withCredit);
  const allowed = await gate(withCredit);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.hasAvailableCredits, true);
  assert.equal(allowed.planCode, "free");

  const none = newDb();
  freeWorkspace(none, 1);
  const refused = await gate(none);
  assert.equal(refused.allowed, false);
  assert.equal(refused.hasAvailableCredits, undefined);

  const consumed = newDb();
  freeWorkspace(consumed, 2);
  await starter(consumed);
  lots(consumed)[0].consumed_quantity = 1;
  consumed.rows("usage_events").push({ workspace_id: "w1", event_type: "audit_credit_consumed", quantity: 1 });
  assert.equal((await gate(consumed)).allowed, false);

  const otherWorkspace = newDb();
  freeWorkspace(otherWorkspace, 1);
  await starter(otherWorkspace, "w2", "cs_x");
  assert.equal((await gate(otherWorkspace)).allowed, false, "another workspace's credit does not open this one");
});

test("free plan, allowance not yet used: allowed without credit flag; paid plan: allowed", async () => {
  const fresh = newDb();
  freeWorkspace(fresh, 0);
  const first = await gate(fresh);
  assert.equal(first.allowed, true);
  assert.equal(first.hasAvailableCredits, undefined);
  const paid = newDb();
  paid.seed("subscriptions", [{ workspace_id: "w1", plan_code: "pro", status: "active" }]);
  assert.equal((await gate(paid)).allowed, true);
});

test("session of another workspace: lookup is scoped, foreign or unknown session => null => 'pending', never 'confirmed'", async () => {
  const db = newDb();
  db.seed("checkout_intents", [
    { workspace_id: "wA", stripe_checkout_session_id: "cs_A", status: "completed", plan_code: "audit_test", completed_at: "2026-10-23T10:00:00Z" },
    { workspace_id: "wB", stripe_checkout_session_id: "cs_B", status: "pending", plan_code: "pro", completed_at: null },
  ]);
  const admin = db.client();
  const own = await findCheckoutIntentForSession(admin, "wA", "cs_A");
  assert.equal(resolvePostPaymentState(own.data), "confirmed");
  const foreign = await findCheckoutIntentForSession(admin, "wB", "cs_A");
  assert.equal(foreign.data, null);
  assert.equal(resolvePostPaymentState(foreign.data), "pending");
  const unknown = await findCheckoutIntentForSession(admin, "wA", "cs_nope");
  assert.equal(unknown.data, null);
  assert.equal(resolvePostPaymentState((await findCheckoutIntentForSession(admin, "wB", "cs_B")).data), "pending");
});

test("browser return after payment: waits while pending, confirms only after the intent is completed", async () => {
  let t = 0;
  let polls = 0;
  const db = newDb();
  db.seed("checkout_intents", [{ workspace_id: "w1", stripe_checkout_session_id: "cs_1", status: "pending", completed_at: null }]);
  const outcome = await waitForPostPaymentConfirmation({
    pollMs: 2500,
    now: () => t,
    isActive: () => true,
    sleep: async (ms) => {
      t += ms;
      if (++polls === 3) Object.assign(db.rows("checkout_intents")[0], { status: "completed", completed_at: "2026-10-23T10:00:07Z" });
    },
    fetchState: async () => resolvePostPaymentState((await findCheckoutIntentForSession(db.client(), "w1", "cs_1")).data),
  });
  assert.equal(outcome, "credit_available");
  assert.equal(polls, 3, "kept waiting while pending");
});

test("payment pending: never 'credit_available'; times out as still_pending", async () => {
  let t = 0;
  const outcome = await waitForPostPaymentConfirmation({
    pollMs: 2500, now: () => t, isActive: () => true, sleep: async (ms) => { t += ms; },
    fetchState: async () => resolvePostPaymentState({ status: "pending", completed_at: null }),
  });
  assert.equal(outcome, "still_pending");
  assert.ok(t >= POST_PAYMENT_CONFIRMATION_WAIT_MS);
  // completed status without completed_at (webhook not finished) is still pending
  assert.equal(resolvePostPaymentState({ status: "completed", completed_at: null }), "pending");
});

test("failed / expired / canceled intents end in 'failed'; leaving the page aborts silently", async () => {
  for (const status of ["failed", "expired", "canceled"]) {
    const o = await waitForPostPaymentConfirmation({ pollMs: 1, now: () => 0, isActive: () => true, sleep: async () => {}, fetchState: async () => resolvePostPaymentState({ status }) });
    assert.equal(o, "failed", status);
  }
  let active = true;
  const aborted = await waitForPostPaymentConfirmation({
    pollMs: 1, now: () => 0, isActive: () => active, sleep: async () => {},
    fetchState: async () => { active = false; return "confirmed"; },
  });
  assert.equal(aborted, "aborted", "no success announced after unmount");
});

test("old restored_after_payment audits stay recognised; ordinary audits do not", () => {
  assert.equal(hasPaidAuditSignal([{ result_payload: { restored_after_payment: true } }]), true);
  assert.equal(hasPaidAuditSignal([{ result_payload: { source: "stripe_webhook_audit_test" } }]), true);
  assert.equal(hasPaidAuditSignal([{ result_payload: { stripe_checkout_session_id: "cs_old" } }]), true);
  assert.equal(hasPaidAuditSignal([{ result_payload: null }, { result_payload: {} }, {}]), false);
  assert.equal(hasPaidAuditSignal([]), false);
});

test("an old restored audit does not give or consume any credit: balance and gate depend only on lots", async () => {
  const db = newDb();
  freeWorkspace(db, 1);
  db.seed("audits", [{ workspace_id: "w1", result_payload: { restored_after_payment: true } }]);
  assert.equal((await balance(db)).available, 0);
  assert.equal((await gate(db)).allowed, false);
});

test("replay of an old session after more than 50 purchases: no duplicate usage event, no extra lot, balance unchanged", async () => {
  const db = newDb();
  await starter(db, "w1", "cs_old");
  for (let i = 0; i < 50; i++) await starter(db, "w1", `cs_new_${i}`);
  const before = { lots: lots(db).length, events: events(db, "audit_test_purchased").length, balance: await balance(db) };
  assert.deepEqual(before, { lots: 51, events: 51, balance: { granted: 51, consumed: 0, available: 51 } });
  assert.deepEqual(await starter(db, "w1", "cs_old"), { ok: true, outcome: "already_granted" });
  assert.equal(lots(db).length, 51);
  assert.equal(events(db, "audit_test_purchased").length, 51, "no duplicated usage event");
  assert.deepEqual(await balance(db), before.balance, "displayed balance not inflated");
  // same for packs
  const packDb = newDb();
  await pack(packDb, "pro", 5, "w1", "cs_pack_old");
  for (let i = 0; i < 55; i++) await pack(packDb, "pro", 5, "w1", `cs_pack_${i}`);
  await pack(packDb, "pro", 5, "w1", "cs_pack_old");
  assert.equal(events(packDb, "audit_credit_granted").length, 56);
  assert.equal((await balance(packDb)).available, 56 * 5);
});

test("historical duplicate usage events (already in the data) are counted once per session in the displayed balance", async () => {
  const db = newDb();
  // legacy workspace: usage events only, one of them duplicated for the same session
  db.seed("usage_events", [
    { workspace_id: "w1", event_type: "audit_test_purchased", quantity: 1, metadata: { stripe_session_id: "cs_dup" } },
    { workspace_id: "w1", event_type: "audit_test_purchased", quantity: 1, metadata: { stripe_session_id: "cs_dup" } },
    { workspace_id: "w1", event_type: "audit_credit_granted", quantity: 5, metadata: { stripe_session_id: "cs_other" } },
  ]);
  assert.deepEqual(await balance(db), { granted: 6, consumed: 0, available: 6 });
});

// ---- cumulative purchases (product rule: Starter 1, Pro 5, Scale 15; any order, any number of times) ----
type Offer = "starter" | "pro" | "scale";
const QTY: Record<Offer, number> = { starter: 1, pro: 5, scale: 15 };
let sessionCounter = 0;
async function buy(db: InMemoryDatabase, offer: Offer, workspaceId = "w1") {
  const sessionRef = `cs_buy_${++sessionCounter}`;
  const result = offer === "starter" ? await starter(db, workspaceId, sessionRef) : await pack(db, offer, QTY[offer], workspaceId, sessionRef);
  assert.equal(result.ok, true);
  return sessionRef;
}
/**
 * TEST MODEL of the SQL reservation (supabase/migrations/20260714110000...): one credit per audit, taken from a lot with
 * availability, refused when none. The real function is Postgres and is NOT executed here; this only lets the sequences
 * below check balances after consumption.
 */
function reserveOne(db: InMemoryDatabase, workspaceId = "w1"): boolean {
  const lot = lots(db, workspaceId).find((l) => Number(l.granted_quantity) - Number(l.consumed_quantity) > 0);
  if (!lot) return false;
  lot.consumed_quantity = Number(lot.consumed_quantity) + 1;
  db.rows("usage_events").push({ workspace_id: workspaceId, event_type: "audit_credit_consumed", quantity: 1, metadata: {} });
  return true;
}

for (const [name, sequence, expected] of [
  ["Starter then Starter", ["starter", "starter"], 2],
  ["Starter then Pro", ["starter", "pro"], 6],
  ["Pro then Starter", ["pro", "starter"], 6],
  ["Scale then Starter", ["scale", "starter"], 16],
  ["Pro then Scale then Starter", ["pro", "scale", "starter"], 21],
  ["several identical purchases (Pro x4, Starter x6, Scale x2)", ["pro", "pro", "pro", "pro", "starter", "starter", "starter", "starter", "starter", "starter", "scale", "scale"], 56],
] as const) {
  test(`cumulative purchases: ${name} => ${expected} credits, one lot each, nothing overwritten`, async () => {
    const db = newDb();
    for (const offer of sequence) await buy(db, offer);
    assert.deepEqual(await balance(db), { granted: expected, consumed: 0, available: expected });
    assert.equal(lots(db).length, sequence.length);
  });
}

test("worked example: Starter, Starter, Pro, 3 audits, Starter => 5 credits", async () => {
  const db = newDb();
  await buy(db, "starter");
  await buy(db, "starter");
  await buy(db, "pro");
  for (let i = 0; i < 3; i++) assert.equal(reserveOne(db), true);
  assert.equal((await balance(db)).available, 4);
  await buy(db, "starter");
  assert.deepEqual(await balance(db), { granted: 8, consumed: 3, available: 5 });
});

test("unconsumed credits are kept when buying another offer; the audit gate follows the credits, not the offer name", async () => {
  const db = newDb();
  freeWorkspace(db, 3);
  await buy(db, "pro");
  for (let i = 0; i < 4; i++) reserveOne(db);
  assert.equal((await balance(db)).available, 1);
  await buy(db, "starter"); // account that already holds credits buys again
  assert.equal((await balance(db)).available, 2);
  assert.equal((await gate(db)).allowed, true);
  assert.equal(reserveOne(db), true);
  assert.equal(reserveOne(db), true);
  assert.equal(reserveOne(db), false, "no audit without a credit");
  assert.equal((await gate(db)).allowed, false);
  await buy(db, "scale");
  assert.equal((await gate(db)).allowed, true);
  assert.equal((await balance(db)).available, 15);
});

test("purchase from a free account (never bought before) works for every offer", async () => {
  for (const offer of ["starter", "pro", "scale"] as const) {
    const db = newDb();
    freeWorkspace(db, 1);
    assert.equal((await gate(db)).allowed, false);
    await buy(db, offer);
    assert.equal((await balance(db)).available, QTY[offer]);
    assert.equal((await gate(db)).allowed, true);
  }
});

test("payment pending or failed: nothing is granted, so no credit and no audit", async () => {
  const db = newDb();
  freeWorkspace(db, 1);
  db.seed("checkout_intents", [
    { workspace_id: "w1", stripe_checkout_session_id: "cs_p", status: "pending", completed_at: null },
    { workspace_id: "w1", stripe_checkout_session_id: "cs_f", status: "failed", completed_at: null },
  ]);
  assert.equal(resolvePostPaymentState((await findCheckoutIntentForSession(db.client(), "w1", "cs_p")).data), "pending");
  assert.equal(resolvePostPaymentState((await findCheckoutIntentForSession(db.client(), "w1", "cs_f")).data), "failed");
  assert.equal((await balance(db)).available, 0);
  assert.equal((await gate(db)).allowed, false);
});

test("replay after cumulative purchases never adds credits (every session replayed twice)", async () => {
  const db = newDb();
  const sessions: Array<[Offer, string]> = [];
  for (const offer of ["starter", "pro", "starter", "scale"] as const) sessions.push([offer, await buy(db, offer)]);
  for (const [offer, ref] of sessions) {
    const r = offer === "starter" ? await starter(db, "w1", ref) : await pack(db, offer, QTY[offer], "w1", ref);
    assert.equal(r.ok && r.outcome, "already_granted");
  }
  assert.equal((await balance(db)).available, 22);
  assert.equal(lots(db).length, 4);
});

test("plan_code after a purchase: never lowered, Starter grants no Pro privilege, offers never block each other", () => {
  const resolve = (purchasedPlan: string, priorPlanCode: string | null, subscriptionStatus: string | null = "active") =>
    resolvePlanCodeAfterPurchase({ purchasedPlan, priorPlanCode, subscriptionStatus });
  // Starter (both internal names): free stays free, existing pro/scale untouched
  for (const starterName of ["audit_test", "starter"]) {
    assert.equal(resolve(starterName, "free"), "free", starterName);
    assert.equal(resolve(starterName, null), "free");
    assert.equal(resolve(starterName, "pro"), "pro");
    assert.equal(resolve(starterName, "scale"), "scale");
  }
  // packs: raise to the offer if higher, never lower
  assert.equal(resolve("pro", "free"), "pro");
  assert.equal(resolve("scale", "free"), "scale");
  assert.equal(resolve("scale", "pro"), "scale");
  assert.equal(resolve("pro", "scale"), "scale", "Pro bought after Scale does not demote");
  assert.equal(resolve("pro", "pro"), "pro");
  // inactive status never lowers an existing code and never creates one
  assert.equal(resolve("pro", "scale", "canceled"), "scale");
  assert.equal(resolve("pro", "free", "canceled"), "free");
});

test("e-mail on replay (source text of the webhook route): a processed session is skipped before any grant or e-mail, the first run still sends one", () => {
  const route = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
  const earlySkip = route.indexOf("session_already_processed_skip");
  const firstGrant = route.indexOf("await grantPackCheckoutCredit(");
  const firstEmail = route.indexOf("await sendPaymentConfirmationEmail(");
  const billingInsert = route.indexOf("await insertBillingPayment(supabaseAdmin, billingInsertBase)");
  assert.ok(earlySkip > 0 && earlySkip < firstGrant && earlySkip < firstEmail, "replay returns before grants and e-mails");
  assert.ok(billingInsert > 0 && billingInsert < firstEmail, "e-mail only after the billing row exists (the row that makes later replays skip)");
  assert.equal((route.match(/await sendPaymentConfirmationEmail\(/g) ?? []).length, 2, "one per branch (pack, Starter), no other sender");
  assert.match(route, /billing_payments"\)\s*\.select\("id"\)\s*\.eq\("stripe_checkout_session_id", sessionIdEarly\)/);
});

test("pricing -> sign-in -> billing keeps the chosen offer for Starter, Pro and Scale", () => {
  for (const [offer, plan] of [["audit_test", "starter"], ["pack_5", "pro"], ["pack_15", "scale"]] as const) {
    const member = getAuditEntryDestinations({ isAuthenticated: true, offer });
    const guest = getAuditEntryDestinations({ isAuthenticated: false, offer });
    assert.equal(member.billingHref, `/dashboard/billing?offer=${offer}`, plan);
    assert.equal(guest.billingHref, `/sign-in?next=${encodeURIComponent(`/dashboard/billing?offer=${offer}`)}`, plan);
  }
  const pricing = readFileSync("app/(default)/pricing/PricingContent.tsx", "utf8");
  assert.ok(!pricing.includes("restored=1") && !pricing.includes("/audit/new"), "no pricing link goes through the entry page, including the bottom CTA");
  assert.match(pricing, /href=\{getAuditEntryDestinations\(\{ isAuthenticated \}\)\.billingHref\}/);
  assert.equal(getAuditEntryDestinations({ isAuthenticated: false }).billingHref, `/sign-in?next=${encodeURIComponent("/dashboard/billing")}`);
  assert.equal(getAuditEntryDestinations({ isAuthenticated: true }).billingHref, "/dashboard/billing");
  assert.match(pricing, /getAuditEntryDestinations\(\{ isAuthenticated, offer: plan\.offer \}\)\.billingHref/);
  const billing = readFileSync("app/(default)/dashboard/billing/page.tsx", "utf8");
  assert.match(billing, /searchParams\.get\("offer"\)/);
});

test("idempotency lookup failure: explicit error, no usage event and no lot created, then a clean retry grants once", async () => {
  for (const kind of ["starter", "pack"] as const) {
    const db = newDb();
    db.failOnce("usage_events", "select");
    const run = () => (kind === "starter" ? starter(db) : pack(db, "pro", 5));
    assert.deepEqual(await run(), { ok: false, error: "stripe_webhook_idempotency_lookup_failed" }, kind);
    assert.equal(lots(db).length, 0, "no lot");
    assert.equal(db.rows("usage_events").length, 0, "no usage event");
    assert.deepEqual(await run(), { ok: true, outcome: "granted" }, "Stripe retry grants normally");
    assert.equal(lots(db).length, 1);
    assert.equal(db.rows("usage_events").length, 1);
    assert.deepEqual(await run(), { ok: true, outcome: "already_granted" });
    assert.equal(db.rows("usage_events").length, 1);
  }
  const route = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
  assert.equal((route.match(/error: (packGrant|starterGrant)\.error \}, \{ status: 500 \}/g) ?? []).length, 2, "the webhook answers 500 so Stripe retries");
});
