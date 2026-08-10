import type { BacklinkOutreachAttemptReservation, BacklinkOutreachAttemptRow } from "../repositories/outreachAttemptsRepository";
import type { OutreachEmailSendResult } from "../providers/outreachEmailProvider";
import { getBacklinkOutreachDraftEligibilityForMembership, type OutreachDraftEligibilityDependencies } from "./outreachDraftEligibilityService";

type Outreach = {
  id: string;
  campaign_id: string;
  opportunity_id: string;
  contact_id: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string | null;
  current_attempt: number;
  max_attempts: number;
  first_contact_at: string | null;
  next_follow_up_at: string | null;
};

type Contact = {
  id: string;
  domain_id: string;
  contact_status: string;
  email_normalized: string | null;
};

export type BacklinkOutreachEmailSendErrorCode =
  | "OUTREACH_NOT_SENDABLE"
  | "OUTREACH_EMAIL_CHANNEL_UNSUPPORTED"
  | "OUTREACH_EMAIL_CONTENT_INCOMPLETE"
  | "OUTREACH_CONTACT_NOT_ELIGIBLE"
  | "OUTREACH_MAX_ATTEMPTS_REACHED"
  | "OUTREACH_ATTEMPT_IDEMPOTENCY_CONFLICT";

export class BacklinkOutreachEmailSendError extends Error {
  constructor(public readonly code: BacklinkOutreachEmailSendErrorCode) {
    super(code);
    this.name = "BacklinkOutreachEmailSendError";
  }
}

export type BacklinkOutreachEmailSendDependencies = {
  eligibility: OutreachDraftEligibilityDependencies;
  getOutreach: (workspaceId: string, outreachId: string) => Promise<Outreach>;
  getContact: (workspaceId: string, contactId: string) => Promise<Contact>;
  getAttemptByIdempotencyKey: (workspaceId: string, idempotencyKey: string) => Promise<BacklinkOutreachAttemptRow | null>;
  reserveAttempt: (workspaceId: string, input: { outreachId: string; actorUserId: string; channel: "email"; provider: "resend"; recipient: string; idempotencyKey: string }) => Promise<BacklinkOutreachAttemptReservation>;
  markAttemptAccepted: (input: { workspaceId: string; attemptId: string; providerMessageId: string | null }) => Promise<unknown>;
  markAttemptFailed: (input: { workspaceId: string; attemptId: string; errorCode: string; errorMessage: string }) => Promise<unknown>;
  markAttemptUnknown: (input: { workspaceId: string; attemptId: string; errorCode: string | null; errorMessage: string | null }) => Promise<unknown>;
  sendEmail: (input: { to: string; subject: string; body: string; idempotencyKey: string }) => Promise<OutreachEmailSendResult>;
  activateOutreach: (workspaceId: string, outreachId: string, input: { status: "active"; currentAttempt: number; firstContactAt: string; lastAttemptAt: string }) => Promise<Outreach>;
  now?: () => string;
};

export type BacklinkOutreachEmailSendResult = {
  outreachId: string;
  attemptId: string;
  attemptStatus: BacklinkOutreachAttemptRow["status"];
  disposition: "sent" | "existing" | "failed" | "unknown" | "reconciled" | "sync_failed";
  providerMessageId: string | null;
  outreachStatus: string;
  currentAttempt: number;
  errorCode: string | null;
};

function required(value: string | null): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new BacklinkOutreachEmailSendError("OUTREACH_EMAIL_CONTENT_INCOMPLETE");
  }
  return normalized;
}

function result(
  outreach: Outreach,
  attempt: BacklinkOutreachAttemptRow,
  disposition: BacklinkOutreachEmailSendResult["disposition"],
  errorCode: string | null = null,
): BacklinkOutreachEmailSendResult {
  return {
    outreachId: outreach.id,
    attemptId: attempt.id,
    attemptStatus: attempt.status,
    disposition,
    providerMessageId: attempt.provider_message_id,
    outreachStatus: outreach.status,
    currentAttempt: outreach.current_attempt,
    errorCode,
  };
}

async function reconcileAccepted(
  dependencies: BacklinkOutreachEmailSendDependencies,
  workspaceId: string,
  outreach: Outreach,
  attempt: BacklinkOutreachAttemptRow,
  disposition: "sent" | "reconciled",
): Promise<BacklinkOutreachEmailSendResult> {
  if (outreach.status === "active") {
    return result(outreach, attempt, "existing");
  }
  if (outreach.status !== "ready") {
    throw new BacklinkOutreachEmailSendError("OUTREACH_NOT_SENDABLE");
  }
  if (outreach.current_attempt >= outreach.max_attempts) {
    throw new BacklinkOutreachEmailSendError("OUTREACH_MAX_ATTEMPTS_REACHED");
  }
  const now = (dependencies.now ?? (() => new Date().toISOString()))();
  try {
    const updated = await dependencies.activateOutreach(workspaceId, outreach.id, {
      status: "active",
      currentAttempt: outreach.current_attempt + 1,
      firstContactAt: outreach.first_contact_at ?? now,
      lastAttemptAt: now,
    });
    return result(updated, attempt, disposition);
  } catch {
    return result(outreach, attempt, "sync_failed", "OUTREACH_SYNC_FAILED");
  }
}

export function sendBacklinkOutreachEmail(
  dependencies: BacklinkOutreachEmailSendDependencies,
) {
  return async (input: {
    workspaceId: string;
    actorUserId: string;
    outreachId: string;
    idempotencyKey: string;
  }): Promise<BacklinkOutreachEmailSendResult> => {
    const outreach = await dependencies.getOutreach(input.workspaceId, input.outreachId);
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey) {
      throw new BacklinkOutreachEmailSendError("OUTREACH_ATTEMPT_IDEMPOTENCY_CONFLICT");
    }

    const existing = await dependencies.getAttemptByIdempotencyKey(input.workspaceId, idempotencyKey);
    if (existing != null) {
      if (existing.outreach_id !== outreach.id) {
        throw new BacklinkOutreachEmailSendError("OUTREACH_ATTEMPT_IDEMPOTENCY_CONFLICT");
      }
      if (existing.status === "accepted") {
        return reconcileAccepted(dependencies, input.workspaceId, outreach, existing, "reconciled");
      }
      if (existing.status === "failed") return result(outreach, existing, "failed", existing.error_code);
      if (existing.status === "unknown") return result(outreach, existing, "unknown", existing.error_code);
      return result(outreach, existing, "existing");
    }

    if (outreach.status !== "ready") {
      throw new BacklinkOutreachEmailSendError("OUTREACH_NOT_SENDABLE");
    }
    if (outreach.channel !== "email") {
      throw new BacklinkOutreachEmailSendError("OUTREACH_EMAIL_CHANNEL_UNSUPPORTED");
    }
    if (outreach.current_attempt >= outreach.max_attempts) {
      throw new BacklinkOutreachEmailSendError("OUTREACH_MAX_ATTEMPTS_REACHED");
    }
    const subject = required(outreach.subject);
    const body = required(outreach.body);
    const eligibility = await getBacklinkOutreachDraftEligibilityForMembership(
      dependencies.eligibility,
      { workspaceId: input.workspaceId, campaignId: outreach.campaign_id, opportunityId: outreach.opportunity_id },
    );
    const contact = await dependencies.getContact(input.workspaceId, outreach.contact_id);
    const recipient = contact.email_normalized?.trim();
    if (
      contact.domain_id !== eligibility.domainId ||
      contact.contact_status === "do_not_contact" ||
      contact.contact_status === "archived" ||
      !recipient ||
      !eligibility.contacts.some((item) => item.contactId === contact.id)
    ) {
      throw new BacklinkOutreachEmailSendError("OUTREACH_CONTACT_NOT_ELIGIBLE");
    }

    const reservation = await dependencies.reserveAttempt(input.workspaceId, {
      outreachId: outreach.id,
      actorUserId: input.actorUserId,
      channel: "email",
      provider: "resend",
      recipient,
      idempotencyKey,
    });
    if (reservation.disposition === "existing") {
      if (reservation.attempt.status === "accepted") return reconcileAccepted(dependencies, input.workspaceId, outreach, reservation.attempt, "reconciled");
      if (reservation.attempt.status === "failed") return result(outreach, reservation.attempt, "failed", reservation.attempt.error_code);
      if (reservation.attempt.status === "unknown") return result(outreach, reservation.attempt, "unknown", reservation.attempt.error_code);
      return result(outreach, reservation.attempt, "existing");
    }

    const provider = await dependencies.sendEmail({ to: recipient, subject, body, idempotencyKey });
    if (provider.status === "failed") {
      await dependencies.markAttemptFailed({ workspaceId: input.workspaceId, attemptId: reservation.attempt.id, errorCode: provider.errorCode ?? "OUTREACH_EMAIL_PROVIDER_FAILED", errorMessage: provider.errorMessage ?? "The email provider rejected the message." });
      return { ...result(outreach, { ...reservation.attempt, status: "failed", error_code: provider.errorCode, error_message: provider.errorMessage }, "failed", provider.errorCode), providerMessageId: null };
    }
    if (provider.status === "unknown") {
      await dependencies.markAttemptUnknown({ workspaceId: input.workspaceId, attemptId: reservation.attempt.id, errorCode: provider.errorCode, errorMessage: provider.errorMessage });
      return { ...result(outreach, { ...reservation.attempt, status: "unknown", error_code: provider.errorCode, error_message: provider.errorMessage }, "unknown", provider.errorCode), providerMessageId: null };
    }
    await dependencies.markAttemptAccepted({ workspaceId: input.workspaceId, attemptId: reservation.attempt.id, providerMessageId: provider.providerMessageId });
    const acceptedAttempt = { ...reservation.attempt, status: "accepted" as const, provider_message_id: provider.providerMessageId };
    return reconcileAccepted(dependencies, input.workspaceId, outreach, acceptedAttempt, "sent");
  };
}
