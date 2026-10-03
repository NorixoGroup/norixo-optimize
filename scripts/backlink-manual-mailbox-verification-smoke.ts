import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runManualMailboxVerification, ManualMailboxVerificationError } from "../lib/backlinks/services/manualMailboxVerificationService";

type Contact = { id: string; workspace_id: string; email_normalized: string | null; contact_status: string; archived_at: string | null; do_not_contact_at: string | null };
const workspaceId = "workspace"; const contactId = "contact";
function harness(result: "deliverable" | "risky" | "undeliverable" | "unknown" | "provider_error", contact: Contact = { id: contactId, workspace_id: workspaceId, email_normalized: "owner@example.test", contact_status: "unverified", archived_at: null, do_not_contact_at: null }) {
  let calls = 0; let claimed = false; const completed: Array<Record<string, unknown>> = []; let canonical: { result: string; email_fingerprint: string } | null = null;
  const deps = {
    getContact: async () => contact,
    getProvider: () => ({ verify: async () => { calls += 1; return { status: result, provider: "fake", safeReason: `FAKE_${result}` }; } }),
    claim: async (): Promise<{ request_id: string; request_status: string; request_attempt_count: number; request_last_result: string | null; reservation_held: boolean }> => { if (claimed) return { request_id: "request", request_status: "running", request_attempt_count: 1, request_last_result: null, reservation_held: false }; claimed = true; return { request_id: "request", request_status: "running", request_attempt_count: 1, request_last_result: null, reservation_held: true }; },
    complete: async (input: Record<string, unknown>) => { completed.push(input); },
    getCanonicalVerification: async () => canonical,
    record: async (input: { result: string }) => { canonical = { result: input.result, email_fingerprint: "b2096dbc5111b6305225657ffdfab205aaff1dfb30d71805aea56922b2cbb24f" }; if (input.result === "deliverable") contact.contact_status = "verified"; return { verificationId: "verification", disposition: "created" as const, contactStatus: contact.contact_status, verifiedAt: contact.contact_status === "verified" ? "2026-01-01T00:00:00.000Z" : null }; },
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  };
  return { deps, get calls() { return calls; }, get completed() { return completed; }, set canonical(value: { result: string; email_fingerprint: string } | null) { canonical = value; } };
}

async function main() {
for (const result of ["deliverable", "risky", "undeliverable", "unknown", "provider_error"] as const) {
  const h = harness(result); const output = await runManualMailboxVerification(h.deps, { workspaceId, contactId });
  assert.equal(h.calls, 1); assert.equal(output.state, result === "deliverable" ? "verified" : result);
}
for (const overrides of [{ archived_at: "2026-01-01" }, { do_not_contact_at: "2026-01-01" }, { email_normalized: null }, { contact_status: "verified" }]) {
  const h = harness("deliverable", { id: contactId, workspace_id: workspaceId, email_normalized: "owner@example.test", contact_status: "unverified", archived_at: null, do_not_contact_at: null, ...overrides });
  await assert.rejects(() => runManualMailboxVerification(h.deps, { workspaceId, contactId }), ManualMailboxVerificationError); assert.equal(h.calls, 0);
}
const concurrent = harness("deliverable");
await Promise.all([runManualMailboxVerification(concurrent.deps, { workspaceId, contactId }), runManualMailboxVerification(concurrent.deps, { workspaceId, contactId })]);
assert.equal(concurrent.calls, 1);
{
  const h = harness("risky");
  h.deps.getProvider = () => ({ verify: async () => { throw new Error("provider failure"); } });
  const output = await runManualMailboxVerification(h.deps, { workspaceId, contactId });
  assert.equal(output.state, "indeterminate"); assert.equal(h.completed.at(-1)?.status, "terminal");
}
{
  const h = harness("risky");
  h.deps.complete = async () => { throw new Error("completion failure"); };
  const first = await runManualMailboxVerification(h.deps, { workspaceId, contactId });
  assert.equal(first.providerCalled, true);
  h.deps.claim = async () => ({ request_id: "request", request_status: "running", request_attempt_count: 1, request_last_result: null, reservation_held: false });
  h.deps.complete = async () => undefined;
  const replay = await runManualMailboxVerification(h.deps, { workspaceId, contactId });
  assert.equal(replay.providerCalled, false); assert.equal(replay.reason, "MAILBOX_VERIFICATION_RECONCILED_FROM_CANONICAL_JOURNAL"); assert.equal(h.calls, 1);
}
{
  const h = harness("provider_error");
  let claimNumber = 0;
  h.deps.claim = async () => {
    claimNumber += 1;
    if (claimNumber <= 3) return { request_id: "request", request_status: "running", request_attempt_count: claimNumber, request_last_result: claimNumber === 1 ? null : "provider_error", reservation_held: true };
    return { request_id: "request", request_status: "terminal", request_attempt_count: 3, request_last_result: "provider_error", reservation_held: false };
  };
  assert.equal((await runManualMailboxVerification(h.deps, { workspaceId, contactId })).state, "provider_error");
  assert.equal((await runManualMailboxVerification(h.deps, { workspaceId, contactId })).state, "provider_error");
  assert.equal((await runManualMailboxVerification(h.deps, { workspaceId, contactId })).state, "exhausted");
  assert.equal((await runManualMailboxVerification(h.deps, { workspaceId, contactId })).state, "exhausted");
  assert.equal(h.calls, 3);
}
{
  const h = harness("deliverable");
  h.deps.claim = async () => ({ request_id: "request", request_status: "running", request_attempt_count: 1, request_last_result: null, reservation_held: false });
  const output = await runManualMailboxVerification(h.deps, { workspaceId, contactId });
  assert.equal(output.state, "running"); assert.equal(h.calls, 0);
}
for (const [attempt, expectedState, expectedCompletion] of [[1, "provider_error", "retryable"], [2, "provider_error", "retryable"], [3, "exhausted", "terminal"]] as const) {
  const h = harness("deliverable");
  h.canonical = { result: "provider_error", email_fingerprint: "b2096dbc5111b6305225657ffdfab205aaff1dfb30d71805aea56922b2cbb24f" };
  h.deps.claim = async () => ({ request_id: "request", request_status: "running", request_attempt_count: attempt, request_last_result: null, reservation_held: false });
  const output = await runManualMailboxVerification(h.deps, { workspaceId, contactId });
  assert.equal(output.state, expectedState); assert.equal(h.completed.at(-1)?.status, expectedCompletion); assert.equal(h.calls, 0);
}
const migration = await readFile("supabase/migrations/20261003170000_add_manual_backlink_mailbox_verification_requests.sql", "utf8");
assert.match(migration, /validate_backlink_contact_mailbox_verification_request_workspace/);
assert.match(migration, /workspace_id = new\.workspace_id/);
assert.match(migration, /for update/);
assert.match(migration, /on conflict \(workspace_id,contact_id,email_fingerprint\) do nothing/);
assert.match(migration, /attempt_count < 3/);
assert.doesNotMatch(migration, /interval '15 minutes'/);
assert.doesNotMatch(migration, /status='running' and/);
assert.match(migration, /MAILBOX_VERIFICATION_RETRY_EXHAUSTED/);
assert.match(migration, /request_last_result/);
const route = await readFile("app/api/backlinks/contacts/[id]/mailbox-verification/route.ts", "utf8");
assert.match(route, /await getBacklinkContactById\(requestContext\.client/);
assert.match(route, /const adminClient = createSupabaseAdminClient\(\)/);
assert.doesNotMatch(route, /error instanceof Error \? error\.message/);
assert.ok(route.indexOf("await getBacklinkContactById(requestContext.client") < route.indexOf("const adminClient = createSupabaseAdminClient()"));
const contactsRoute = await readFile("app/api/backlinks/contacts/route.ts", "utf8");
assert.match(contactsRoute, /listMailboxVerificationStatesForContacts/);
const dashboard = await readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8");
assert.match(dashboard, /setMailboxVerificationStates\(contacts\.mailboxVerificationStates \?\? \{\}\)/);
assert.match(dashboard, /mailboxVerificationStates\[contact\.id\] === "running"/);
assert.match(dashboard, /mailboxVerificationStates\[contact\.id\] !== "provider_error"/);
assert.match(dashboard, /mailboxVerificationStates\[contact\.id\] === "exhausted"/);
const requestsRepository = await readFile("lib/backlinks/repositories/mailboxVerificationRequestsRepository.ts", "utf8");
assert.match(requestsRepository, /eq\("email_fingerprint", emailFingerprint\)/);
assert.match(requestsRepository, /order\("checked_at", \{ ascending: false \}\)\.order\("created_at", \{ ascending: false \}\)\.order\("id", \{ ascending: false \}\)/);
console.log("PASS — manual mailbox verification: fake provider only; no Ready, Send, Resend, or autonomy execution");
}
void main();
