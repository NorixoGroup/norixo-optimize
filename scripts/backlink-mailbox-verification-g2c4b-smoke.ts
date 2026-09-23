import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createZeroBounceMailboxVerificationProvider,
  getConfiguredMailboxVerificationProvider,
  ZEROBOUNCE_EU_VALIDATE_ENDPOINT,
} from "../lib/backlinks/providers/zeroBounceMailboxVerificationProvider";
import { coordinateMailboxVerification } from "../lib/backlinks/services/mailboxVerificationCoordinator";
import type { MailboxVerificationProvider } from "../lib/backlinks/services/mailboxVerificationService";

const workspaceId = "workspace";
const contactId = "contact";
const email = "editor@example.invalid";

function response(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function zeroBounce(payload: unknown, status = 200) {
  let calls = 0;
  let requestedUrl = "";
  const provider = createZeroBounceMailboxVerificationProvider({
    apiKey: "test-key",
    fetchImpl: async (url) => {
      calls += 1;
      requestedUrl = String(url);
      return response(status, payload);
    },
  });
  return { provider, calls: () => calls, requestedUrl: () => requestedUrl };
}

function contact(overrides: Partial<{ id: string; workspace_id: string; contact_status: string; email_normalized: string | null; do_not_contact_at: string | null; archived_at: string | null }> = {}) {
  return { id: contactId, workspace_id: workspaceId, contact_status: "unverified", email_normalized: email, do_not_contact_at: null, archived_at: null, ...overrides };
}

function coordinator(provider: MailboxVerificationProvider, current = contact()) {
  let providerCalls = 0;
  let records = 0;
  const persisted: Array<{ verificationKey: string; emailFingerprint: string; provider: string; safeMetadata?: unknown }> = [];
  const wrappedProvider: MailboxVerificationProvider = { verify: async (input) => { providerCalls += 1; return provider.verify(input); } };
  const seenKeys = new Set<string>();
  const dependencies = {
    getContact: async () => current,
    provider: wrappedProvider,
    record: async (input: { verificationKey: string; emailFingerprint: string; provider: string; result: string; safeMetadata?: unknown }) => {
      records += 1;
      persisted.push(input);
      const existing = seenKeys.has(input.verificationKey);
      seenKeys.add(input.verificationKey);
      return { verificationId: "verification", disposition: existing ? "existing" as const : "created" as const, contactStatus: input.result === "deliverable" ? "verified" : "unverified", verifiedAt: input.result === "deliverable" ? "2026-09-24T00:00:00.000Z" : null };
    },
    now: () => new Date("2026-09-24T00:00:00.000Z"),
  };
  return { dependencies, providerCalls: () => providerCalls, records: () => records, persisted: () => persisted };
}

async function main() {
  const providerSource = await readFile("lib/backlinks/providers/zeroBounceMailboxVerificationProvider.ts", "utf8");
  const coordinatorSource = await readFile("lib/backlinks/services/mailboxVerificationCoordinator.ts", "utf8");
  assert(providerSource.includes(ZEROBOUNCE_EU_VALIDATE_ENDPOINT));
  assert(!providerSource.includes("api.zerobounce.net/v2/validate"));
  assert(!providerSource.includes("Email Finder") && !providerSource.includes("guessformat"));
  assert(!providerSource.includes("console.") && !providerSource.includes("JSON.stringify(payload)") && !providerSource.includes(".text("));
  assert(!coordinatorSource.includes('.from("backlink_contacts")') && !coordinatorSource.includes("updateBacklinkContact"));
  assert.equal(getConfiguredMailboxVerificationProvider({}), null);
  assert.equal(getConfiguredMailboxVerificationProvider({ BACKLINK_MAILBOX_VERIFICATION_PROVIDER: "zerobounce" }), null);

  for (const [providerStatus, expected] of [["valid", "deliverable"], ["invalid", "undeliverable"], ["catch-all", "risky"], ["unknown", "unknown"], ["spamtrap", "undeliverable"], ["abuse", "undeliverable"], ["do_not_mail", "undeliverable"]] as const) {
    const value = zeroBounce({ status: providerStatus });
    assert.equal((await value.provider.verify({ email, domain: "example.invalid" })).status, expected);
    assert.equal(value.calls(), 1);
  }
  const catchAll = zeroBounce({ status: "valid", catch_all: "true" });
  const catchAllResult = await catchAll.provider.verify({ email, domain: "example.invalid" });
  assert.equal(catchAllResult.status, "risky");
  assert.deepEqual(catchAllResult.safeMetadata, { catchAll: true });
  const payloadBoundary = zeroBounce({ status: "valid", arbitrary: { email, response: "provider payload" } });
  assert.deepEqual((await payloadBoundary.provider.verify({ email, domain: "example.invalid" })).safeMetadata, {});
  assert.equal((await zeroBounce({ status: 42 }).provider.verify({ email, domain: "example.invalid" })).status, "provider_error");
  for (const [httpStatus, safeReason] of [[400, "ZEROBOUNCE_HTTP_400"], [401, "ZEROBOUNCE_HTTP_401"], [403, "ZEROBOUNCE_HTTP_403"], [418, "ZEROBOUNCE_HTTP_4XX"], [429, "ZEROBOUNCE_HTTP_429"], [500, "ZEROBOUNCE_HTTP_5XX"], [503, "ZEROBOUNCE_HTTP_5XX"]] as const) {
    const result = await zeroBounce({ status: "valid" }, httpStatus).provider.verify({ email, domain: "example.invalid" });
    assert.equal(result.status, "provider_error");
    assert.equal(result.safeReason, safeReason);
  }
  const eu = zeroBounce({ status: "valid" });
  await eu.provider.verify({ email, domain: "example.invalid" });
  assert.equal(eu.requestedUrl().split("?")[0], ZEROBOUNCE_EU_VALIDATE_ENDPOINT);

  const invalidJsonProvider = createZeroBounceMailboxVerificationProvider({ apiKey: "test-key", fetchImpl: async () => new Response("not-json", { status: 200 }), timeoutMs: 20 });
  assert.equal((await invalidJsonProvider.verify({ email, domain: "example.invalid" })).status, "provider_error");
  const networkProvider = createZeroBounceMailboxVerificationProvider({ apiKey: "test-key", fetchImpl: async () => { throw new Error("network"); } });
  assert.equal((await networkProvider.verify({ email, domain: "example.invalid" })).status, "provider_error");
  const timeoutProvider = createZeroBounceMailboxVerificationProvider({ apiKey: "test-key", timeoutMs: 1, fetchImpl: async (_url, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true })) });
  assert.equal((await timeoutProvider.verify({ email, domain: "example.invalid" })).status, "provider_error");

  const valid = zeroBounce({ status: "valid" });
  const first = coordinator(valid.provider);
  const delivered = await coordinateMailboxVerification(first.dependencies, { workspaceId, contactId, currentNormalizedEmail: email });
  assert.deepEqual({ kind: delivered.kind, status: delivered.status, contactStatus: delivered.contactStatus, disposition: delivered.disposition }, { kind: "persisted", status: "deliverable", contactStatus: "verified", disposition: "created" });
  assert.equal(first.providerCalls(), 1);
  assert.equal(first.records(), 1);
  assert.deepEqual(first.persisted()[0]?.safeMetadata, {});
  assert(!JSON.stringify(first.persisted()).includes(email));
  assert(!JSON.stringify(first.persisted()).includes("test-key"));
  const replay = await coordinateMailboxVerification(first.dependencies, { workspaceId, contactId, currentNormalizedEmail: email });
  assert.equal(replay.disposition, "existing");
  assert.equal(first.providerCalls(), 2);

  for (const status of ["invalid", "catch-all", "unknown"] as const) {
    const value = coordinator(zeroBounce({ status }).provider);
    const outcome = await coordinateMailboxVerification(value.dependencies, { workspaceId, contactId, currentNormalizedEmail: email });
    assert.equal(outcome.kind, "persisted");
    assert.equal(outcome.contactStatus, "unverified");
  }
  const providerError = coordinator({ verify: async () => ({ status: "provider_error", provider: "zerobounce", safeReason: "ERROR" }) });
  assert.equal((await coordinateMailboxVerification(providerError.dependencies, { workspaceId, contactId, currentNormalizedEmail: email })).contactStatus, "unverified");

  for (const current of [contact({ contact_status: "do_not_contact", do_not_contact_at: "2026-09-01T00:00:00.000Z" }), contact({ contact_status: "archived", archived_at: "2026-09-01T00:00:00.000Z" })]) {
    const value = coordinator(zeroBounce({ status: "valid" }).provider, current);
    assert.equal((await coordinateMailboxVerification(value.dependencies, { workspaceId, contactId, currentNormalizedEmail: email })).kind, "blocked");
    assert.equal(value.providerCalls(), 0);
    assert.equal(value.records(), 0);
  }
  const stale = coordinator(zeroBounce({ status: "valid" }).provider, contact({ email_normalized: "changed@example.invalid" }));
  assert.equal((await coordinateMailboxVerification(stale.dependencies, { workspaceId, contactId, currentNormalizedEmail: email })).kind, "stale");
  assert.equal(stale.providerCalls(), 0);
  const mismatch = coordinator(zeroBounce({ status: "valid" }).provider, contact({ workspace_id: "other" }));
  assert.equal((await coordinateMailboxVerification(mismatch.dependencies, { workspaceId, contactId, currentNormalizedEmail: email })).kind, "blocked");

  const conflict = coordinator({ verify: async () => ({ status: "deliverable", provider: "zerobounce", safeReason: "VALID" }) });
  conflict.dependencies.record = async () => { throw new Error("BACKLINK_CONTACT_MAILBOX_VERIFICATION_KEY_CONFLICT"); };
  assert.equal((await coordinateMailboxVerification(conflict.dependencies, { workspaceId, contactId, currentNormalizedEmail: email })).kind, "conflict");
  console.log("PASS — ZeroBounce EU provider and mailbox verification coordinator G2C.4-B smoke");
}

void main();
