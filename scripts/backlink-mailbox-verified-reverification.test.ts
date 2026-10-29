import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import { coordinateMailboxVerification } from "@/lib/backlinks/services/mailboxVerificationCoordinator";
import { ManualMailboxVerificationError, runManualMailboxVerification } from "@/lib/backlinks/services/manualMailboxVerificationService";
import type { MailboxVerificationProvider, MailboxVerificationResult } from "@/lib/backlinks/services/mailboxVerificationService";

const WORKSPACE_ID = "ws-1";
const CONTACT_ID = "contact-1";
const EMAIL = "hello@hostfully.com";
const NOW = new Date("2026-10-29T00:00:00.000Z");

type ContactFixture = {
  id: string;
  workspace_id: string;
  email_normalized: string | null;
  contact_status: string;
  archived_at: string | null;
  do_not_contact_at: string | null;
};

function baseContact(overrides: Partial<ContactFixture> = {}): ContactFixture {
  return {
    id: CONTACT_ID,
    workspace_id: WORKSPACE_ID,
    email_normalized: EMAIL,
    contact_status: "verified",
    archived_at: null,
    do_not_contact_at: null,
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function fakeProvider(result: Omit<MailboxVerificationResult, "provider"> & { provider?: string }) {
  let calls = 0;
  const provider: MailboxVerificationProvider = {
    async verify() {
      calls += 1;
      return { provider: "zerobounce", ...result } as MailboxVerificationResult;
    },
  };
  return { provider, callCount: () => calls };
}

function fakeDependencies(contact: ContactFixture, options: {
  canonical: { result: string; email_fingerprint: string; checked_at: string } | null;
  provider: MailboxVerificationProvider;
}) {
  return {
    getContact: async () => contact,
    getProvider: () => options.provider,
    claim: async () => ({ request_id: "req-1", request_status: "running", request_attempt_count: 1, request_last_result: null, reservation_held: true }),
    complete: async () => ({}),
    getCanonicalVerification: async () => options.canonical,
    record: async (input: { result: string }) => ({
      verificationId: "verification-1",
      disposition: "created" as const,
      // Mirrors the real RPC: promotion only ever happens from "unverified" + "deliverable".
      contactStatus: contact.contact_status === "unverified" && input.result === "deliverable" ? "verified" : contact.contact_status,
      verifiedAt: null,
    }),
    now: () => NOW,
  };
}

function fingerprintOf(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

test("manual reverification: verified contact with no prior proof is allowed through to the provider", async () => {
  const contact = baseContact();
  const { provider, callCount } = fakeProvider({ status: "undeliverable", safeReason: "ZEROBOUNCE_UNDELIVERABLE" });
  const deps = fakeDependencies(contact, { canonical: null, provider });
  const result = await runManualMailboxVerification(deps, { workspaceId: WORKSPACE_ID, contactId: CONTACT_ID });
  assert.equal(callCount(), 1, "provider must be called when no prior proof exists");
  assert.equal(result.providerResult, "undeliverable");
  assert.equal(result.state, "undeliverable", "a contradicting fresh result must never be reported as verified");
});

test("manual reverification: verified contact with a fresh deliverable proof is blocked without calling the provider", async () => {
  const contact = baseContact();
  const { provider, callCount } = fakeProvider({ status: "deliverable", safeReason: "ZEROBOUNCE_VALID" });
  const canonical = { result: "deliverable", email_fingerprint: fingerprintOf(EMAIL), checked_at: daysAgo(5) };
  const deps = fakeDependencies(contact, { canonical, provider });
  await assert.rejects(
    () => runManualMailboxVerification(deps, { workspaceId: WORKSPACE_ID, contactId: CONTACT_ID }),
    (error: unknown) => error instanceof ManualMailboxVerificationError && error.code === "MAILBOX_VERIFICATION_CONTACT_ALREADY_VERIFIED",
  );
  assert.equal(callCount(), 0, "an unnecessary reverification must never call the provider");
});

test("manual reverification: a deliverable proof older than 30 days is treated as stale and allows reverification", async () => {
  const contact = baseContact();
  const { provider, callCount } = fakeProvider({ status: "deliverable", safeReason: "ZEROBOUNCE_VALID" });
  const canonical = { result: "deliverable", email_fingerprint: fingerprintOf(EMAIL), checked_at: daysAgo(31) };
  const deps = fakeDependencies(contact, { canonical, provider });
  const result = await runManualMailboxVerification(deps, { workspaceId: WORKSPACE_ID, contactId: CONTACT_ID });
  assert.equal(callCount(), 1, "a stale proof must not block reverification");
  assert.equal(result.providerResult, "deliverable");
});

test("manual reverification: a fresh but non-deliverable proof does not block reverification", async () => {
  const contact = baseContact();
  const { provider, callCount } = fakeProvider({ status: "unknown", safeReason: "ZEROBOUNCE_UNKNOWN" });
  const canonical = { result: "risky", email_fingerprint: fingerprintOf(EMAIL), checked_at: daysAgo(1) };
  const deps = fakeDependencies(contact, { canonical, provider });
  await runManualMailboxVerification(deps, { workspaceId: WORKSPACE_ID, contactId: CONTACT_ID });
  assert.equal(callCount(), 1, "only a fresh deliverable proof may block reverification");
});

test("manual reverification: contact_status is never written by this code path, even when the fresh result is deliverable", async () => {
  const contact = baseContact();
  const { provider } = fakeProvider({ status: "deliverable", safeReason: "ZEROBOUNCE_VALID" });
  const deps = fakeDependencies(contact, { canonical: null, provider });
  const result = await runManualMailboxVerification(deps, { workspaceId: WORKSPACE_ID, contactId: CONTACT_ID });
  // The fake record() mirrors the real RPC: it only promotes from "unverified", so an
  // already-"verified" contact must come back unchanged from this call.
  assert.equal(result.state, "verified");
  assert.equal(result.providerResult, "deliverable");
});

test("manual reverification: archived takes precedence over the verified-reverification path", async () => {
  const contact = baseContact({ archived_at: daysAgo(10) });
  const { provider, callCount } = fakeProvider({ status: "deliverable", safeReason: "ZEROBOUNCE_VALID" });
  const deps = fakeDependencies(contact, { canonical: null, provider });
  await assert.rejects(
    () => runManualMailboxVerification(deps, { workspaceId: WORKSPACE_ID, contactId: CONTACT_ID }),
    (error: unknown) => error instanceof ManualMailboxVerificationError && error.code === "MAILBOX_VERIFICATION_CONTACT_ARCHIVED",
  );
  assert.equal(callCount(), 0);
});

test("manual reverification: do-not-contact takes precedence over the verified-reverification path", async () => {
  const contact = baseContact({ do_not_contact_at: daysAgo(2) });
  const { provider, callCount } = fakeProvider({ status: "deliverable", safeReason: "ZEROBOUNCE_VALID" });
  const deps = fakeDependencies(contact, { canonical: null, provider });
  await assert.rejects(
    () => runManualMailboxVerification(deps, { workspaceId: WORKSPACE_ID, contactId: CONTACT_ID }),
    (error: unknown) => error instanceof ManualMailboxVerificationError && error.code === "MAILBOX_VERIFICATION_CONTACT_DNC",
  );
  assert.equal(callCount(), 0);
});

test("regression: an unverified contact with a deliverable result is still promoted and reported as verified", async () => {
  const contact = baseContact({ contact_status: "unverified" });
  const { provider, callCount } = fakeProvider({ status: "deliverable", safeReason: "ZEROBOUNCE_VALID" });
  const deps = fakeDependencies(contact, { canonical: null, provider });
  const result = await runManualMailboxVerification(deps, { workspaceId: WORKSPACE_ID, contactId: CONTACT_ID });
  assert.equal(callCount(), 1);
  assert.equal(result.state, "verified");
  assert.equal(result.providerResult, "deliverable");
});

test("automation isolation: coordinateMailboxVerification without the manual flag still blocks a verified contact", async () => {
  const contact = baseContact();
  const { provider, callCount } = fakeProvider({ status: "deliverable", safeReason: "ZEROBOUNCE_VALID" });
  const outcome = await coordinateMailboxVerification(
    { getContact: async () => contact, provider, record: async () => { throw new Error("must not be called"); }, now: () => NOW },
    { workspaceId: WORKSPACE_ID, contactId: CONTACT_ID, currentNormalizedEmail: EMAIL },
  );
  assert.equal(outcome.kind, "blocked");
  assert.equal(outcome.reason, "MAILBOX_VERIFICATION_CONTACT_ALREADY_VERIFIED");
  assert.equal(callCount(), 0, "automation must never call the provider for an already-verified contact");
});

test("coordinator: allowVerifiedReverification lets a verified contact through without promoting or demoting contact_status", async () => {
  const contact = baseContact();
  const { provider } = fakeProvider({ status: "undeliverable", safeReason: "ZEROBOUNCE_UNDELIVERABLE" });
  const outcome = await coordinateMailboxVerification(
    {
      getContact: async () => contact,
      provider,
      record: async (input) => ({
        verificationId: "verification-2",
        disposition: "created",
        contactStatus: contact.contact_status === "unverified" && input.result === "deliverable" ? "verified" : contact.contact_status,
        verifiedAt: null,
      }),
      now: () => NOW,
    },
    { workspaceId: WORKSPACE_ID, contactId: CONTACT_ID, currentNormalizedEmail: EMAIL, allowVerifiedReverification: true },
  );
  assert.equal(outcome.kind, "persisted");
  assert.equal(outcome.status, "undeliverable");
  assert.equal(outcome.contactStatus, "verified", "contact_status must remain exactly as it was, never auto-changed");
});
