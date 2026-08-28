import { randomUUID } from "node:crypto";
import type { BacklinkOutreachAttemptReservation, BacklinkOutreachAttemptRow } from "../repositories/outreachAttemptsRepository";
import type { OutreachEmailSendResult } from "../providers/outreachEmailProvider";
import {
  getBacklinkOutreachDraftEligibilityForMembership,
  resolveBacklinkOutreachPreferredChannel,
  type OutreachDraftEligibilityDependencies,
} from "./outreachDraftEligibilityService";
import { BacklinkOutreachReplyCorrelationIdentityError, deriveBacklinkOutreachReplyCorrelationIdentity, reconstructBacklinkOutreachReplyToForAttempt, type BacklinkOutreachReplyTokenKeyring } from "./outreachReplyCorrelationIdentity";
import type { AutomationWorkspaceControl } from "@/lib/automation/workspace-control-types";

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
  linkedin_url?: string | null;
  contact_form_url?: string | null;
};

export type BacklinkOutreachEmailSendErrorCode =
  | "OUTREACH_NOT_SENDABLE"
  | "OUTREACH_EMAIL_CHANNEL_UNSUPPORTED"
  | "OUTREACH_EMAIL_CONTENT_INCOMPLETE"
  | "OUTREACH_CONTACT_NOT_ELIGIBLE"
  | "OUTREACH_MAX_ATTEMPTS_REACHED"
  | "OUTREACH_ATTEMPT_IDEMPOTENCY_CONFLICT"
  | "OUTREACH_SEND_ATTEMPT_IN_PROGRESS"
  | "OUTREACH_SEND_ATTEMPT_UNRESOLVED"
  | "OUTREACH_SEND_RATE_LIMIT_EXCEEDED"
  | "OUTREACH_INBOUND_REPLY_CONFIGURATION_INVALID"
  | "OUTREACH_SEND_DISABLED_BY_DRY_RUN"
  | "OUTREACH_NOT_APPROVED"
  | "OUTREACH_APPROVAL_STALE"
  | "OUTREACH_CAMPAIGN_DISABLED"
  | "OUTREACH_NOT_READY"
  | "OUTREACH_INVALID_RECIPIENT"
  | "OUTREACH_MISSING_APPROVED_CONTENT"
  | "OUTREACH_INELIGIBLE";

export class BacklinkOutreachEmailSendError extends Error {
  constructor(public readonly code: BacklinkOutreachEmailSendErrorCode) {
    super(code);
    this.name = "BacklinkOutreachEmailSendError";
  }
}

export type BacklinkOutreachEmailSendDependencies = {
  eligibility: OutreachDraftEligibilityDependencies;
  getWorkspaceControl: (workspaceId: string) => Promise<Pick<AutomationWorkspaceControl, "dryRunOnly"> | null>;
  getOutreach: (workspaceId: string, outreachId: string) => Promise<Outreach>;
  getContact: (workspaceId: string, contactId: string) => Promise<Contact>;
  listAttemptSummariesSince: (workspaceId: string, since: string) => Promise<readonly { outreach_id: string; requested_at: string; status: string }[]>;
  getAttemptByIdempotencyKey: (workspaceId: string, idempotencyKey: string) => Promise<BacklinkOutreachAttemptRow | null>;
  getOpenAttemptForOutreach: (workspaceId: string, outreachId: string) => Promise<BacklinkOutreachAttemptRow | null>;
  updateOutreach: (workspaceId: string, outreachId: string, input: { channel: "email" }) => Promise<Outreach>;
  reserveAttempt: (workspaceId: string, input: { attemptId: string; outreachId: string; actorUserId: string; channel: "email"; provider: "resend"; recipient: string; idempotencyKey: string; replyTokenHash: string; replyTokenKeyVersion: string; attemptKind: "initial" }) => Promise<BacklinkOutreachAttemptReservation>;
  markAttemptAccepted: (input: { workspaceId: string; attemptId: string; providerMessageId: string | null }) => Promise<unknown>;
  markAttemptFailed: (input: { workspaceId: string; attemptId: string; errorCode: string; errorMessage: string }) => Promise<unknown>;
  markAttemptUnknown: (input: { workspaceId: string; attemptId: string; errorCode: string | null; errorMessage: string | null }) => Promise<unknown>;
  sendEmail: (input: { to: string; subject: string; body: string; replyTo: string; idempotencyKey: string }) => Promise<OutreachEmailSendResult>;
  activateOutreach: (workspaceId: string, outreachId: string, input: { status: "active"; currentAttempt: number; firstContactAt: string; lastAttemptAt: string }) => Promise<Outreach>;
  inboundReplyDomain: string | undefined;
  replyTokenKeyring: BacklinkOutreachReplyTokenKeyring;
  createAttemptId?: () => string;
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

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 60 * 60 * 1000).toISOString();
}

async function evaluateBacklinkOutreachSendRateLimit(
  dependencies: BacklinkOutreachEmailSendDependencies,
  input: {
    workspaceId: string;
    contactId: string;
    domainId: string;
    now: string;
  },
): Promise<
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "WORKSPACE_DAILY_LIMIT_REACHED"
        | "WORKSPACE_HOURLY_LIMIT_REACHED"
        | "DOMAIN_DAILY_LIMIT_REACHED"
        | "CONTACT_DAILY_LIMIT_REACHED";
    }
> {
  const dailyCutoff = addHours(input.now, -24);
  const hourlyCutoff = addHours(input.now, -1);
  const recentAttempts = await dependencies.listAttemptSummariesSince(input.workspaceId, dailyCutoff);
  const hourlyAttempts = recentAttempts.filter((attempt) => Date.parse(attempt.requested_at) >= Date.parse(hourlyCutoff));
  if (recentAttempts.length >= 5) {
    return { allowed: false, reason: "WORKSPACE_DAILY_LIMIT_REACHED" };
  }
  if (hourlyAttempts.length >= 2) {
    return { allowed: false, reason: "WORKSPACE_HOURLY_LIMIT_REACHED" };
  }

  const uniqueOutreachIds = [...new Set(recentAttempts.map((attempt) => attempt.outreach_id))];
  const outreachRows = await Promise.all(uniqueOutreachIds.map((outreachId) => dependencies.getOutreach(input.workspaceId, outreachId)));
  const outreachById = new Map(outreachRows.map((row) => [row.id, row] as const));
  const uniqueOpportunityIds = [...new Set(outreachRows.map((row) => row.opportunity_id))];
  const opportunityRows = await Promise.all(uniqueOpportunityIds.map((opportunityId) => dependencies.eligibility.getOpportunity(input.workspaceId, opportunityId)));
  const domainByOpportunityId = new Map(opportunityRows.map((row) => [row.id, row.domain_id] as const));

  let sameContactCount = 0;
  let sameDomainCount = 0;
  for (const attempt of recentAttempts) {
    const outreach = outreachById.get(attempt.outreach_id);
    if (outreach?.contact_id === input.contactId) {
      sameContactCount += 1;
    }
    const domainId = outreach != null ? domainByOpportunityId.get(outreach.opportunity_id) : null;
    if (domainId === input.domainId) {
      sameDomainCount += 1;
    }
  }
  if (sameDomainCount >= 1) {
    return { allowed: false, reason: "DOMAIN_DAILY_LIMIT_REACHED" };
  }
  if (sameContactCount >= 1) {
    return { allowed: false, reason: "CONTACT_DAILY_LIMIT_REACHED" };
  }
  return { allowed: true };
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
    const workspaceControl = await dependencies.getWorkspaceControl(input.workspaceId);
    if (workspaceControl?.dryRunOnly === true) {
      throw new BacklinkOutreachEmailSendError("OUTREACH_SEND_DISABLED_BY_DRY_RUN");
    }
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
    if (outreach.current_attempt >= outreach.max_attempts) {
      throw new BacklinkOutreachEmailSendError("OUTREACH_MAX_ATTEMPTS_REACHED");
    }
    const subject = required(outreach.subject);
    const body = required(outreach.body);
    const eligibility = await getBacklinkOutreachDraftEligibilityForMembership(
      dependencies.eligibility,
      { workspaceId: input.workspaceId, campaignId: outreach.campaign_id, opportunityId: outreach.opportunity_id, excludeOutreachId: outreach.id },
    );
    const contact = await dependencies.getContact(input.workspaceId, outreach.contact_id);
    const recipient = contact.email_normalized?.trim();
    const preferredChannel = resolveBacklinkOutreachPreferredChannel(contact);
    if (
      contact.domain_id !== eligibility.domainId ||
      contact.contact_status === "do_not_contact" ||
      contact.contact_status === "archived" ||
      !recipient ||
      !eligibility.contacts.some((item) => item.contactId === contact.id)
    ) {
      throw new BacklinkOutreachEmailSendError("OUTREACH_CONTACT_NOT_ELIGIBLE");
    }
    if (outreach.status === "ready" && outreach.current_attempt === 0 && outreach.channel !== "email") {
      if (preferredChannel !== "email") {
        throw new BacklinkOutreachEmailSendError("OUTREACH_EMAIL_CHANNEL_UNSUPPORTED");
      }
      const reconciled = await dependencies.updateOutreach(input.workspaceId, outreach.id, { channel: "email" });
      outreach.channel = reconciled.channel;
    }
    if (outreach.channel !== "email") {
      throw new BacklinkOutreachEmailSendError("OUTREACH_EMAIL_CHANNEL_UNSUPPORTED");
    }

    const openAttempt = await dependencies.getOpenAttemptForOutreach(input.workspaceId, outreach.id);
    if (openAttempt?.status === "requested") throw new BacklinkOutreachEmailSendError("OUTREACH_SEND_ATTEMPT_IN_PROGRESS");
    if (openAttempt?.status === "unknown") throw new BacklinkOutreachEmailSendError("OUTREACH_SEND_ATTEMPT_UNRESOLVED");
    const rateLimit = await evaluateBacklinkOutreachSendRateLimit(dependencies, {
      workspaceId: input.workspaceId,
      contactId: contact.id,
      domainId: eligibility.domainId,
      now: (dependencies.now ?? (() => new Date().toISOString()))(),
    });
    if (!rateLimit.allowed) {
      throw new BacklinkOutreachEmailSendError("OUTREACH_SEND_RATE_LIMIT_EXCEEDED");
    }
    const attemptId = (dependencies.createAttemptId ?? randomUUID)();
    let identity: ReturnType<typeof deriveBacklinkOutreachReplyCorrelationIdentity>;
    try {
      identity = deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId, keyring: dependencies.replyTokenKeyring });
    } catch (error) {
      if (error instanceof BacklinkOutreachReplyCorrelationIdentityError) {
        throw new BacklinkOutreachEmailSendError("OUTREACH_INBOUND_REPLY_CONFIGURATION_INVALID");
      }
      throw error;
    }
    let reservation: BacklinkOutreachAttemptReservation;
    try { reservation = await dependencies.reserveAttempt(input.workspaceId, {
      attemptId: identity.attemptId,
      outreachId: outreach.id,
      actorUserId: input.actorUserId,
      channel: "email",
      provider: "resend",
      recipient,
      idempotencyKey,
      replyTokenHash: identity.tokenHash,
      replyTokenKeyVersion: identity.keyVersion,
      attemptKind: "initial",
    }); } catch (error) {
      const concurrent = await dependencies.getOpenAttemptForOutreach(input.workspaceId, outreach.id);
      if (concurrent?.status === "requested") throw new BacklinkOutreachEmailSendError("OUTREACH_SEND_ATTEMPT_IN_PROGRESS");
      if (concurrent?.status === "unknown") throw new BacklinkOutreachEmailSendError("OUTREACH_SEND_ATTEMPT_UNRESOLVED");
      throw error;
    }
    if (reservation.disposition === "rate_limited") {
      throw new BacklinkOutreachEmailSendError("OUTREACH_SEND_RATE_LIMIT_EXCEEDED");
    }
    if (reservation.disposition === "existing") {
      if (reservation.attempt.status === "accepted") return reconcileAccepted(dependencies, input.workspaceId, outreach, reservation.attempt, "reconciled");
      if (reservation.attempt.status === "failed") return result(outreach, reservation.attempt, "failed", reservation.attempt.error_code);
      if (reservation.attempt.status === "unknown") return result(outreach, reservation.attempt, "unknown", reservation.attempt.error_code);
      return result(outreach, reservation.attempt, "existing");
    }

    let replyTo: string;
    try {
      replyTo = reconstructBacklinkOutreachReplyToForAttempt({ attemptId: reservation.attempt.id, replyTokenHash: reservation.attempt.reply_token_hash, replyTokenKeyVersion: reservation.attempt.reply_token_key_version, keyring: dependencies.replyTokenKeyring, inboundReplyDomain: dependencies.inboundReplyDomain ?? "" }).replyTo;
    } catch (error) {
      if (error instanceof BacklinkOutreachReplyCorrelationIdentityError) {
        throw new BacklinkOutreachEmailSendError("OUTREACH_INBOUND_REPLY_CONFIGURATION_INVALID");
      }
      throw error;
    }
    const provider = await dependencies.sendEmail({ to: recipient, subject, body, replyTo, idempotencyKey });
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
