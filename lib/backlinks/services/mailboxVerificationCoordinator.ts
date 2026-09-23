import { createHash } from "node:crypto";

import type { RecordMailboxVerificationAndMaybePromoteInput, RecordMailboxVerificationAndMaybePromoteResult } from "../repositories/mailboxVerificationsRepository";
import type { MailboxVerificationProvider, MailboxVerificationResult } from "./mailboxVerificationService";

type CoordinatorContact = {
  id: string;
  workspace_id: string;
  contact_status: string;
  email_normalized: string | null;
  do_not_contact_at: string | null;
  archived_at: string | null;
};

export type MailboxVerificationCoordinatorDependencies = {
  getContact: (workspaceId: string, contactId: string) => Promise<CoordinatorContact | null>;
  provider: MailboxVerificationProvider;
  record: (input: RecordMailboxVerificationAndMaybePromoteInput) => Promise<RecordMailboxVerificationAndMaybePromoteResult>;
  now?: () => Date;
};

export type MailboxVerificationCoordinatorInput = {
  workspaceId: string;
  contactId: string;
  currentNormalizedEmail: string;
};

export type MailboxVerificationCoordinatorOutcome = {
  kind: "persisted" | "blocked" | "stale" | "conflict";
  status: MailboxVerificationResult["status"] | null;
  contactStatus: string | null;
  verificationId: string | null;
  disposition: "created" | "existing" | null;
  reason: string;
};

function normalizedEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) ? normalized : null;
}

function fingerprint(email: string): string {
  return createHash("sha256").update(email, "utf8").digest("hex");
}

function blocked(reason: string, contactStatus: string | null = null): MailboxVerificationCoordinatorOutcome {
  return { kind: "blocked", status: null, contactStatus, verificationId: null, disposition: null, reason };
}

function providerName(result: MailboxVerificationResult): string | null {
  const provider = result.provider?.trim().toLowerCase() ?? "";
  return provider === "" || provider.length > 64 ? null : provider;
}

export async function coordinateMailboxVerification(
  dependencies: MailboxVerificationCoordinatorDependencies,
  input: MailboxVerificationCoordinatorInput,
): Promise<MailboxVerificationCoordinatorOutcome> {
  const expectedEmail = normalizedEmail(input.currentNormalizedEmail);
  if (!input.workspaceId || !input.contactId || expectedEmail == null) return blocked("MAILBOX_VERIFICATION_INPUT_INVALID");
  const contact = await dependencies.getContact(input.workspaceId, input.contactId);
  if (contact == null || contact.id !== input.contactId || contact.workspace_id !== input.workspaceId) return blocked("MAILBOX_VERIFICATION_CONTACT_SCOPE_INVALID");
  const currentEmail = contact.email_normalized == null ? null : normalizedEmail(contact.email_normalized);
  if (currentEmail == null) return blocked("MAILBOX_VERIFICATION_CONTACT_EMAIL_MISSING", contact.contact_status);
  if (currentEmail !== expectedEmail) return { ...blocked("MAILBOX_VERIFICATION_STALE_EMAIL", contact.contact_status), kind: "stale" };
  if (contact.contact_status === "do_not_contact" || contact.do_not_contact_at != null) return blocked("MAILBOX_VERIFICATION_CONTACT_DNC", contact.contact_status);
  if (contact.contact_status === "archived" || contact.archived_at != null) return blocked("MAILBOX_VERIFICATION_CONTACT_ARCHIVED", contact.contact_status);
  if (contact.contact_status === "verified") return blocked("MAILBOX_VERIFICATION_CONTACT_ALREADY_VERIFIED", contact.contact_status);
  if (contact.contact_status !== "unverified") return blocked("MAILBOX_VERIFICATION_CONTACT_STATUS_INVALID", contact.contact_status);

  const result = await dependencies.provider.verify({ email: currentEmail, domain: currentEmail.slice(currentEmail.lastIndexOf("@") + 1) });
  const provider = providerName(result);
  if (provider == null) return blocked("MAILBOX_VERIFICATION_PROVIDER_INVALID", contact.contact_status);
  const checkedAt = (dependencies.now ?? (() => new Date()))().toISOString();
  try {
    const persisted = await dependencies.record({
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      verificationKey: `mbv1:${input.workspaceId}:${input.contactId}:${fingerprint(currentEmail)}:${provider}`,
      emailFingerprint: fingerprint(currentEmail),
      provider,
      result: result.status,
      checkedAt,
      providerReference: result.providerReference ?? null,
      safeMetadata: result.safeMetadata ?? null,
    });
    return { kind: "persisted", status: result.status, contactStatus: persisted.contactStatus, verificationId: persisted.verificationId, disposition: persisted.disposition, reason: result.safeReason };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("STALE_EMAIL")) return { ...blocked("MAILBOX_VERIFICATION_STALE_EMAIL", contact.contact_status), kind: "stale" };
    if (message.includes("KEY_CONFLICT")) return { ...blocked("MAILBOX_VERIFICATION_KEY_CONFLICT", contact.contact_status), kind: "conflict" };
    throw error;
  }
}
