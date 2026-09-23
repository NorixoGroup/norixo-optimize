import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  normalizeMailboxVerificationSafeMetadata,
  recordMailboxVerificationAndMaybePromote,
  type MailboxVerificationResult,
  type RecordMailboxVerificationAndMaybePromoteRpcClient,
} from "../lib/backlinks/repositories/mailboxVerificationsRepository";

const migrationPath = "supabase/migrations/20260924000000_add_backlink_contact_mailbox_verifications.sql";
const fingerprint = "a".repeat(64);
type VerificationInput = {
  workspaceId: string;
  contactId: string;
  verificationKey: string;
  emailFingerprint: string;
  provider: string;
  result: MailboxVerificationResult;
  checkedAt: string;
  safeMetadata: { catchAll: boolean };
};

const input: VerificationInput = {
  workspaceId: "workspace",
  contactId: "contact",
  verificationKey: "mailbox:contact:2026-09-24T00:00:00.000Z",
  emailFingerprint: fingerprint,
  provider: "disabled",
  result: "deliverable",
  checkedAt: "2026-09-24T00:00:00.000Z",
  safeMetadata: { catchAll: false },
};

type Contact = {
  workspaceId: string;
  status: "unverified" | "verified" | "do_not_contact" | "archived";
  emailFingerprint: string;
  verifiedAt: string | null;
};

type StoredVerification = Pick<VerificationInput, "verificationKey" | "emailFingerprint" | "provider" | "result"> & { id: string };

function applyVerification(contact: Contact, stored: Map<string, StoredVerification>, next = input, workspaceId = "workspace") {
  if (contact.workspaceId !== workspaceId) return { outcome: "workspace_mismatch" as const, contact };
  if (contact.emailFingerprint !== next.emailFingerprint) return { outcome: "stale_email" as const, contact };
  const existing = stored.get(next.verificationKey);
  if (existing != null) {
    if (existing.emailFingerprint !== next.emailFingerprint || existing.provider !== next.provider || existing.result !== next.result) {
      return { outcome: "key_conflict" as const, contact };
    }
    return { outcome: "existing" as const, contact };
  }
  stored.set(next.verificationKey, { id: `verification-${stored.size + 1}`, verificationKey: next.verificationKey, emailFingerprint: next.emailFingerprint, provider: next.provider, result: next.result });
  if (contact.status === "unverified" && next.result === "deliverable") {
    return { outcome: "created" as const, contact: { ...contact, status: "verified" as const, verifiedAt: next.checkedAt } };
  }
  return { outcome: "created" as const, contact };
}

function fakeClient(row: { verification_id: string; disposition: string; contact_status: string; verified_at: string | null }) {
  let received: unknown = null;
  const client: RecordMailboxVerificationAndMaybePromoteRpcClient = {
    rpc: async (_name, args) => {
      received = args;
      return { data: [row], error: null };
    },
  };
  return { client, received: () => received };
}

async function main() {
  const sql = await readFile(migrationPath, "utf8");
  for (const required of [
    "create table public.backlink_contact_mailbox_verifications",
    "unique (workspace_id, verification_key)",
    "(workspace_id, contact_id, checked_at desc)",
    "validate_backlink_contact_mailbox_verification_workspace",
    "BACKLINK_CONTACT_MAILBOX_VERIFICATION_WORKSPACE_MISMATCH",
    "enable row level security",
    "security definer",
    "for update",
    "on conflict (workspace_id, verification_key) do nothing",
    "BACKLINK_CONTACT_MAILBOX_VERIFICATION_STALE_EMAIL",
    "BACKLINK_CONTACT_MAILBOX_VERIFICATION_KEY_CONFLICT",
    "contact_status = 'unverified' and normalized_result = 'deliverable'",
    "contact.do_not_contact_at is null and contact.archived_at is null",
    "last_verified_at = p_checked_at",
    "grant execute on function public.record_backlink_contact_mailbox_verification_and_maybe_promote",
  ]) assert.match(sql, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const status of ["deliverable", "undeliverable", "risky", "unknown", "provider_error"]) assert.match(sql, new RegExp(`'${status}'`));
  assert.match(sql, /safe_metadata - array\['catch_all', 'disposable', 'role_based'\]/);
  assert.match(sql, /octet_length\(safe_metadata::text\) <= 4096/);
  assert.doesNotMatch(sql, /\bemail(?:_normalized)?\s+(?:text|varchar)/i);
  assert.doesNotMatch(sql, /\b(?:payload|credential|api_key|token)\s+(?:jsonb|text|varchar)/i);
  assert.doesNotMatch(sql, /502f1a85-a308-4227-aa73-58332788f235/i);

  assert.equal(normalizeMailboxVerificationSafeMetadata(null), null);
  assert.deepEqual(normalizeMailboxVerificationSafeMetadata({}), {});
  assert.deepEqual(normalizeMailboxVerificationSafeMetadata({ catchAll: true }), { catch_all: true });
  assert.deepEqual(normalizeMailboxVerificationSafeMetadata({ disposable: false }), { disposable: false });
  assert.deepEqual(normalizeMailboxVerificationSafeMetadata({ roleBased: true }), { role_based: true });
  assert.deepEqual(normalizeMailboxVerificationSafeMetadata({ catchAll: false, disposable: false, roleBased: true }), { catch_all: false, disposable: false, role_based: true });
  for (const unsafeMetadata of [
    { provider_state: "person@example.com" },
    { raw_email: "person@example.com" },
    { response: "full provider payload" },
    { unexpected: true },
    { catchAll: "true" },
    { disposable: 1 },
    { roleBased: null },
    { catchAll: { value: true } },
    ["anything"],
    "anything",
    123,
    true,
  ]) assert.throws(() => normalizeMailboxVerificationSafeMetadata(unsafeMetadata), /safeMetadata/);

  const base: Contact = { workspaceId: "workspace", status: "unverified", emailFingerprint: fingerprint, verifiedAt: null };
  for (const result of ["undeliverable", "risky", "unknown", "provider_error"] as const) {
    const outcome = applyVerification(base, new Map(), { ...input, verificationKey: `key-${result}`, result });
    assert.equal(outcome.outcome, "created");
    assert.equal(outcome.contact.status, "unverified");
  }
  const deliverable = applyVerification(base, new Map());
  assert.equal(deliverable.contact.status, "verified");
  assert.equal(deliverable.contact.verifiedAt, input.checkedAt);
  for (const status of ["verified", "do_not_contact", "archived"] as const) {
    const preserved = applyVerification({ ...base, status, verifiedAt: status === "verified" ? "2026-09-01T00:00:00.000Z" : null }, new Map(), { ...input, verificationKey: `preserve-${status}` });
    assert.equal(preserved.contact.status, status);
  }
  assert.equal(applyVerification(base, new Map(), { ...input, emailFingerprint: "b".repeat(64) }).outcome, "stale_email");
  assert.equal(applyVerification({ ...base, workspaceId: "other-workspace" }, new Map()).outcome, "workspace_mismatch");
  const replayStore = new Map<string, StoredVerification>();
  assert.equal(applyVerification(base, replayStore).outcome, "created");
  assert.equal(applyVerification({ ...base, status: "verified", verifiedAt: input.checkedAt }, replayStore).outcome, "existing");
  assert.equal(applyVerification(base, replayStore, { ...input, provider: "other" }).outcome, "key_conflict");
  assert.equal(replayStore.size, 1);
  const concurrentStore = new Map<string, StoredVerification>();
  const concurrent = await Promise.all([Promise.resolve().then(() => applyVerification(base, concurrentStore)), Promise.resolve().then(() => applyVerification(base, concurrentStore))]);
  assert.deepEqual(concurrent.map(({ outcome }) => outcome), ["created", "existing"]);
  assert.equal(concurrentStore.size, 1);

  const fake = fakeClient({ verification_id: "verification", disposition: "created", contact_status: "verified", verified_at: input.checkedAt });
  const rpcResult = await recordMailboxVerificationAndMaybePromote(fake.client, input);
  assert.deepEqual(rpcResult, { verificationId: "verification", disposition: "created", contactStatus: "verified", verifiedAt: input.checkedAt });
  assert.deepEqual(fake.received(), {
    p_workspace_id: input.workspaceId, p_contact_id: input.contactId, p_verification_key: input.verificationKey,
    p_email_fingerprint: fingerprint, p_provider: input.provider, p_result: input.result, p_checked_at: input.checkedAt,
    p_provider_reference: null, p_safe_metadata: { catch_all: false },
  });
  assert.doesNotMatch(JSON.stringify(fake.received()), /editor@example\.com/);
  assert.doesNotMatch(JSON.stringify(fake.received()), /api[_-]?key|token|payload/i);
  console.log("PASS — static mailbox metadata and persistence contract G2C.4-A smoke (no local SQL runtime)");
}

void main();
