import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:9";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "placeholder-not-a-key";

import { shouldShowCreditBalanceOnFreePlan as show } from "../lib/billing/listingsCreditStatus";
import { grantPackCheckoutCredit, grantStarterCheckoutCredit } from "../lib/billing/webhookCreditGrants";
import { CREDIT_LOT_UNIQUES, InMemoryDatabase } from "./support/inMemorySupabase";

/**
 * /dashboard/listings status card for a "free" plan code holding purchased credits.
 *   npx tsx scripts/listings-credit-status.test.ts
 */
const quiet = async <T,>(fn: () => Promise<T>) => {
  const saved = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  console.log = console.info = console.warn = console.error = () => {};
  try { return await fn(); } finally { Object.assign(console, saved); }
};

test("decision: purchased credits beyond the free allowance are shown; otherwise the existing card is kept", () => {
  assert.equal(show({ remainingFreeAudits: 0, creditsAvailable: 1 }), true, "Starter bought, free audit used");
  assert.equal(show({ remainingFreeAudits: 0, creditsAvailable: 6 }), true, "several purchases");
  assert.equal(show({ remainingFreeAudits: 1, creditsAvailable: 2 }), true, "free audit still available + purchased credit");
  assert.equal(show({ remainingFreeAudits: 1, creditsAvailable: 1 }), false, "plain free user keeps the 'test audit' card");
  assert.equal(show({ remainingFreeAudits: 0, creditsAvailable: 0 }), false, "free, nothing left: unchanged 'No audits available'");
  assert.equal(show({ remainingFreeAudits: 0, creditsAvailable: null }), false, "balance unknown: never invented");
  assert.equal(show({ remainingFreeAudits: null, creditsAvailable: 0 }), false);
  assert.equal(show({ remainingFreeAudits: 0, creditsAvailable: -3 }), false);
});

test("end to end on the in-memory database: free account, allowance used, Starter / Pro / Scale purchases", async () => {
  const { canCreateAudit } = await import("../lib/billing/canCreateAudit");
  const { getWorkspaceAuditCredits } = await import("../lib/billing/getWorkspaceAuditCredits");
  const db = new InMemoryDatabase({ unique: CREDIT_LOT_UNIQUES });
  db.seed("subscriptions", [{ workspace_id: "w1", plan_code: "free", status: "active" }]);
  db.seed("audits", [{ workspace_id: "w1" }]);
  const card = async () => {
    const quota = await quiet(() => canCreateAudit("w1", db.client()));
    const credits = await quiet(() => getWorkspaceAuditCredits("w1", db.client()));
    const remainingFree = quota.limit === null ? null : Math.max(quota.limit - quota.currentCount, 0);
    return { plan: quota.planCode, allowed: quota.allowed, remainingFree, available: credits.available, shown: show({ remainingFreeAudits: remainingFree, creditsAvailable: credits.available }) };
  };
  assert.deepEqual(await card(), { plan: "free", allowed: false, remainingFree: 0, available: 0, shown: false });
  const base = { supabaseAdmin: db.client(), workspaceId: "w1", userId: "u1", customerId: null, subscriptionStripeCustomerForDb: null, checkoutIntentIdMeta: "ci", eventType: "checkout.session.completed", eventId: "evt" };
  await quiet(() => grantStarterCheckoutCredit({ ...base, sessionRef: "cs_1", auditQuantity: 1 }));
  assert.deepEqual(await card(), { plan: "free", allowed: true, remainingFree: 0, available: 1, shown: true }, "plan stays free, credit visible and usable");
  await quiet(() => grantPackCheckoutCredit({ ...base, sessionRef: "cs_2", planFromMetadata: "pro", grantQuantity: 5, currentPeriodEnd: null, subscriptionId: null }));
  await quiet(() => grantPackCheckoutCredit({ ...base, sessionRef: "cs_3", planFromMetadata: "scale", grantQuantity: 15, currentPeriodEnd: null, subscriptionId: null }));
  assert.equal((await card()).available, 21);
  // all credits consumed: back to the existing card
  for (const lot of db.rows("audit_credit_lots")) lot.consumed_quantity = lot.granted_quantity;
  db.rows("usage_events").push({ workspace_id: "w1", event_type: "audit_credit_consumed", quantity: 21, metadata: {} });
  assert.deepEqual(await card(), { plan: "free", allowed: false, remainingFree: 0, available: 0, shown: false });
});

test("page wiring: new title in all 11 locales, balance shown for free plan, other cards untouched", () => {
  const src = readFileSync("app/(default)/dashboard/listings/page.tsx", "utf8");
  assert.equal((src.match(/auditCreditsTitle: "/g) ?? []).length, 11);
  assert.match(src, /shouldShowCreditBalanceOnFreePlan\(\{ remainingFreeAudits, creditsAvailable \}\)/);
  assert.match(src, /planTitle = copy\.auditCreditsTitle;/);
  assert.match(src, /\$\{creditsAvailable\} \$\{creditsAvailable === 1 \? copy\.auditAvailableSingular : copy\.auditsAvailable\}/);
  // existing branches still there
  assert.match(src, /planTitle = copy\.auditTestActive;/);
  assert.match(src, /planDetail = copy\.noAuditsAvailable;/);
  assert.match(src, /isProStatusCard \? copy\.proActive : planTitle/);
  // purchased credits are not labelled free or Pro
  const titles = [...src.matchAll(/auditCreditsTitle: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(titles.every((t) => !/free|gratuit|pro\b|gratis|kostenlos/i.test(t)), titles.join(" | "));
});
