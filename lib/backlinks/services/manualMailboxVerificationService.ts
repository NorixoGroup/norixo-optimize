import { createHash } from "node:crypto";
import type { MailboxVerificationProvider } from "./mailboxVerificationService";
import { coordinateMailboxVerification } from "./mailboxVerificationCoordinator";

export type ManualMailboxVerificationState = "unverified" | "running" | "indeterminate" | "verified" | "risky" | "undeliverable" | "unknown" | "provider_error" | "exhausted";
type Contact = { id: string; workspace_id: string; email_normalized: string | null; contact_status: string; archived_at: string | null; do_not_contact_at: string | null };
type Claim = { request_id: string; request_status: string; request_attempt_count: number; request_last_result: string | null; reservation_held: boolean };
type CanonicalVerification = { result: string; email_fingerprint: string } | null;

export class ManualMailboxVerificationError extends Error { constructor(readonly code: string) { super(code); } }
export type ManualMailboxVerificationDependencies = {
  getContact(workspaceId: string, contactId: string): Promise<Contact | null>;
  getProvider(): MailboxVerificationProvider | null;
  claim(input: { workspaceId: string; contactId: string; emailFingerprint: string; startedAt: string }): Promise<Claim>;
  complete(input: { workspaceId: string; requestId: string; status: "succeeded" | "terminal" | "retryable"; result: string | null; reason: string; completedAt: string }): Promise<unknown>;
  getCanonicalVerification(workspaceId: string, contactId: string, emailFingerprint: string): Promise<CanonicalVerification>;
  record: Parameters<typeof coordinateMailboxVerification>[0]["record"];
  now?: () => Date;
};

function eligible(contact: Contact): string | null {
  if (contact.email_normalized?.trim() === "") return "MAILBOX_VERIFICATION_CONTACT_EMAIL_MISSING";
  if (contact.email_normalized == null) return "MAILBOX_VERIFICATION_CONTACT_EMAIL_MISSING";
  if (contact.contact_status === "verified") return "MAILBOX_VERIFICATION_CONTACT_ALREADY_VERIFIED";
  if (contact.contact_status !== "unverified") return "MAILBOX_VERIFICATION_CONTACT_STATUS_INVALID";
  if (contact.archived_at != null) return "MAILBOX_VERIFICATION_CONTACT_ARCHIVED";
  if (contact.do_not_contact_at != null) return "MAILBOX_VERIFICATION_CONTACT_DNC";
  return null;
}
function fingerprint(email: string) { return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex"); }
function state(status: string | null, contactStatus: string | null): ManualMailboxVerificationState {
  if (contactStatus === "verified" || status === "deliverable") return "verified";
  if (status === "risky" || status === "undeliverable" || status === "unknown" || status === "provider_error") return status;
  return "unverified";
}
function completionFor(result: string | null, contactStatus: string | null): "succeeded" | "terminal" | "retryable" {
  if (result === "deliverable" && contactStatus === "verified") return "succeeded";
  return result === "provider_error" ? "retryable" : "terminal";
}
function isMailboxResult(value: string): value is "deliverable" | "undeliverable" | "risky" | "unknown" | "provider_error" {
  return value === "deliverable" || value === "undeliverable" || value === "risky" || value === "unknown" || value === "provider_error";
}
function stateFromRequest(status: string, result: string | null): ManualMailboxVerificationState {
  if (status === "running") return "running";
  if (status === "terminal" && result === "provider_error") return "exhausted";
  if (result === "risky" || result === "undeliverable" || result === "unknown") return result;
  if (result === "provider_error") return "provider_error";
  return "indeterminate";
}

export async function runManualMailboxVerification(deps: ManualMailboxVerificationDependencies, input: { workspaceId: string; contactId: string }) {
  const contact = await deps.getContact(input.workspaceId, input.contactId);
  if (contact == null || contact.id !== input.contactId || contact.workspace_id !== input.workspaceId) throw new ManualMailboxVerificationError("MAILBOX_VERIFICATION_CONTACT_SCOPE_INVALID");
  const blocked = eligible(contact); if (blocked != null) throw new ManualMailboxVerificationError(blocked);
  const provider = deps.getProvider(); if (provider == null) throw new ManualMailboxVerificationError("MAILBOX_VERIFICATION_PROVIDER_NOT_CONFIGURED");
  const email = contact.email_normalized!.trim().toLowerCase(); const now = (deps.now ?? (() => new Date()))();
  const reservation = await deps.claim({ workspaceId: input.workspaceId, contactId: input.contactId, emailFingerprint: fingerprint(email), startedAt: now.toISOString() });
  if (!reservation.reservation_held) {
    const emailFingerprint = fingerprint(email);
    const canonical = reservation.request_status === "running"
      ? await deps.getCanonicalVerification(input.workspaceId, input.contactId, emailFingerprint)
      : null;
    if (canonical?.email_fingerprint === emailFingerprint && isMailboxResult(canonical.result)) {
      const resultStatus = canonical.result;
      const completion = resultStatus === "provider_error" && reservation.request_attempt_count >= 3 ? "terminal" : completionFor(resultStatus, contact.contact_status);
      await deps.complete({ workspaceId: input.workspaceId, requestId: reservation.request_id, status: completion, result: resultStatus, reason: "MAILBOX_VERIFICATION_RECONCILED_FROM_CANONICAL_JOURNAL", completedAt: (deps.now ?? (() => new Date()))().toISOString() });
      return { state: completion === "terminal" && resultStatus === "provider_error" ? "exhausted" : state(resultStatus, contact.contact_status), providerCalled: false, requestId: reservation.request_id, reason: "MAILBOX_VERIFICATION_RECONCILED_FROM_CANONICAL_JOURNAL" };
    }
    return { state: stateFromRequest(reservation.request_status, reservation.request_last_result), providerCalled: false, requestId: reservation.request_id, reason: "MAILBOX_VERIFICATION_ALREADY_REQUESTED" };
  }
  let result;
  try {
    result = await coordinateMailboxVerification({ getContact: deps.getContact, provider, record: deps.record, now: () => now }, { workspaceId: input.workspaceId, contactId: input.contactId, currentNormalizedEmail: email });
  } catch {
    await deps.complete({ workspaceId: input.workspaceId, requestId: reservation.request_id, status: "terminal", result: null, reason: "MAILBOX_VERIFICATION_EXECUTION_INDETERMINATE", completedAt: (deps.now ?? (() => new Date()))().toISOString() });
    return { state: "indeterminate" as const, providerCalled: true, requestId: reservation.request_id, reason: "MAILBOX_VERIFICATION_EXECUTION_INDETERMINATE" };
  }
  const resultStatus = result.status;
  const completion = resultStatus === "provider_error" && reservation.request_attempt_count >= 3 ? "terminal" : completionFor(resultStatus, result.contactStatus);
  try {
    await deps.complete({ workspaceId: input.workspaceId, requestId: reservation.request_id, status: completion, result: resultStatus, reason: result.reason, completedAt: (deps.now ?? (() => new Date()))().toISOString() });
  } catch {
    return { state: state(resultStatus, result.contactStatus), providerCalled: true, requestId: reservation.request_id, reason: "MAILBOX_VERIFICATION_COMPLETION_PENDING_RECONCILIATION" };
  }
  return { state: completion === "terminal" && resultStatus === "provider_error" ? "exhausted" : state(resultStatus, result.contactStatus), providerCalled: true, requestId: reservation.request_id, reason: result.reason };
}
