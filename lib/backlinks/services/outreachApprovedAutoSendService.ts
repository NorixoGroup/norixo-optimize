import { randomUUID } from "node:crypto";

import type {
  BacklinkOutreachApprovedInitialAttemptResult,
  BacklinkOutreachAttemptRow,
} from "../repositories/outreachAttemptsRepository";
import type { OutreachEmailSendResult } from "../providers/outreachEmailProvider";
import {
  BacklinkOutreachEmailSendError,
  type BacklinkOutreachEmailSendResult,
} from "./outreachEmailSendService";
import {
  BacklinkOutreachReplyCorrelationIdentityError,
  deriveBacklinkOutreachReplyCorrelationIdentity,
  reconstructBacklinkOutreachReplyToForAttempt,
  type BacklinkOutreachReplyTokenKeyring,
} from "./outreachReplyCorrelationIdentity";

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
  last_attempt_at: string | null;
};

export type BacklinkOutreachApprovedAutoSendWorkspaceControl = {
  dryRunOnly: boolean;
};

export type BacklinkOutreachApprovedAutoSendResult = BacklinkOutreachEmailSendResult;

export type BacklinkOutreachApprovedAutoSendDependencies = {
  getWorkspaceControl: (
    workspaceId: string,
  ) => Promise<BacklinkOutreachApprovedAutoSendWorkspaceControl | null>;
  getOutreach: (
    workspaceId: string,
    outreachId: string,
  ) => Promise<Outreach>;
  reserveApprovedInitialAttempt: (input: {
    workspaceId: string;
    campaignId: string;
    outreachId: string;
    attemptId: string;
    actorUserId: string;
    idempotencyKey: string;
    replyTokenHash: string;
    replyTokenKeyVersion: string;
    requestedAt: string;
  }) => Promise<BacklinkOutreachApprovedInitialAttemptResult>;
  markAttemptAccepted: (input: {
    workspaceId: string;
    attemptId: string;
    providerMessageId: string | null;
  }) => Promise<unknown>;
  markAttemptFailed: (input: {
    workspaceId: string;
    attemptId: string;
    errorCode: string;
    errorMessage: string;
  }) => Promise<unknown>;
  markAttemptUnknown: (input: {
    workspaceId: string;
    attemptId: string;
    errorCode: string | null;
    errorMessage: string | null;
  }) => Promise<unknown>;
  sendEmail: (input: {
    to: string;
    subject: string;
    body: string;
    replyTo: string;
    idempotencyKey: string;
  }) => Promise<OutreachEmailSendResult>;
  activateOutreach: (
    workspaceId: string,
    outreachId: string,
    input: {
      status: "active";
      currentAttempt: number;
      firstContactAt: string;
      lastAttemptAt: string;
    },
  ) => Promise<Outreach>;
  inboundReplyDomain: string | undefined;
  replyTokenKeyring: BacklinkOutreachReplyTokenKeyring;
  createAttemptId?: () => string;
  now?: () => string;
};

function required(value: string | null): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new BacklinkOutreachEmailSendError("OUTREACH_MISSING_APPROVED_CONTENT");
  }
  return normalized;
}

function result(
  outreach: Outreach,
  attempt: BacklinkOutreachAttemptRow,
  disposition: BacklinkOutreachEmailSendResult["disposition"],
  errorCode: string | null = null,
): BacklinkOutreachApprovedAutoSendResult {
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
  dependencies: BacklinkOutreachApprovedAutoSendDependencies,
  workspaceId: string,
  outreach: Outreach,
  attempt: BacklinkOutreachAttemptRow,
  disposition: "sent" | "reconciled",
): Promise<BacklinkOutreachApprovedAutoSendResult> {
  if (outreach.status === "active") {
    return result(outreach, attempt, "existing");
  }
  if (outreach.status !== "ready") {
    throw new BacklinkOutreachEmailSendError("OUTREACH_NOT_READY");
  }
  if (outreach.current_attempt >= outreach.max_attempts) {
    throw new BacklinkOutreachEmailSendError("OUTREACH_NOT_READY");
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

function createDefaultIdempotencyKey(input: {
  workspaceId: string;
  outreachId: string;
  selectedAt: string;
}): string {
  return `automation:backlinks:approved-auto-send:${input.workspaceId}:${input.outreachId}:${input.selectedAt}:${randomUUID()}`;
}

export function sendApprovedBacklinkOutreachEmail(
  dependencies: BacklinkOutreachApprovedAutoSendDependencies,
) {
  return async (input: {
    workspaceId: string;
    actorUserId: string;
    outreachId: string;
    idempotencyKey: string;
  }): Promise<BacklinkOutreachApprovedAutoSendResult> => {
    const workspaceControl = await dependencies.getWorkspaceControl(input.workspaceId);
    if (workspaceControl?.dryRunOnly === true) {
      throw new BacklinkOutreachEmailSendError("OUTREACH_SEND_DISABLED_BY_DRY_RUN");
    }

    const outreach = await dependencies.getOutreach(input.workspaceId, input.outreachId);
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey) {
      throw new BacklinkOutreachEmailSendError("OUTREACH_ATTEMPT_IDEMPOTENCY_CONFLICT");
    }

    const attemptId = (dependencies.createAttemptId ?? randomUUID)();
    let identity: ReturnType<typeof deriveBacklinkOutreachReplyCorrelationIdentity>;
    try {
      identity = deriveBacklinkOutreachReplyCorrelationIdentity({
        attemptId,
        keyring: dependencies.replyTokenKeyring,
      });
    } catch (error) {
      if (error instanceof BacklinkOutreachReplyCorrelationIdentityError) {
        throw new BacklinkOutreachEmailSendError(
          "OUTREACH_INBOUND_REPLY_CONFIGURATION_INVALID",
        );
      }
      throw error;
    }

    const reservation = await dependencies.reserveApprovedInitialAttempt({
      workspaceId: input.workspaceId,
      campaignId: outreach.campaign_id,
      outreachId: outreach.id,
      attemptId: identity.attemptId,
      actorUserId: input.actorUserId,
      idempotencyKey,
      replyTokenHash: identity.tokenHash,
      replyTokenKeyVersion: identity.keyVersion,
      requestedAt: (dependencies.now ?? (() => new Date().toISOString()))(),
    });

    if (reservation.disposition === "rate_limited") {
      throw new BacklinkOutreachEmailSendError("OUTREACH_SEND_RATE_LIMIT_EXCEEDED");
    }
    if (
      reservation.disposition === "not_approved" ||
      reservation.disposition === "approval_stale" ||
      reservation.disposition === "campaign_disabled" ||
      reservation.disposition === "not_ready" ||
      reservation.disposition === "invalid_recipient" ||
      reservation.disposition === "missing_approved_content" ||
      reservation.disposition === "ineligible"
    ) {
      throw new BacklinkOutreachEmailSendError(
        reservation.disposition === "campaign_disabled"
          ? "OUTREACH_CAMPAIGN_DISABLED"
          : reservation.disposition === "not_ready"
            ? "OUTREACH_NOT_READY"
            : reservation.disposition === "invalid_recipient"
              ? "OUTREACH_INVALID_RECIPIENT"
              : reservation.disposition === "missing_approved_content"
                ? "OUTREACH_MISSING_APPROVED_CONTENT"
                : reservation.disposition === "approval_stale"
                  ? "OUTREACH_APPROVAL_STALE"
                  : reservation.disposition === "not_approved"
                    ? "OUTREACH_NOT_APPROVED"
                    : "OUTREACH_INELIGIBLE",
      );
    }

    const attempt = reservation.attempt;
    const snapshot = reservation.snapshot;
    if (attempt == null || snapshot == null) {
      throw new BacklinkOutreachEmailSendError("OUTREACH_MISSING_APPROVED_CONTENT");
    }

    if (attempt.status === "accepted") {
      return reconcileAccepted(dependencies, input.workspaceId, outreach, attempt, "reconciled");
    }
    if (attempt.status === "failed") {
      return result(outreach, attempt, "failed", attempt.error_code);
    }
    if (attempt.status === "unknown") {
      return result(outreach, attempt, "unknown", attempt.error_code);
    }

    const recipient = required(snapshot.recipient_email);
    const subject = required(snapshot.subject);
    const body = required(snapshot.body);
    const replyTo = reconstructBacklinkOutreachReplyToForAttempt({
      attemptId: attempt.id,
      replyTokenHash: attempt.reply_token_hash,
      replyTokenKeyVersion: attempt.reply_token_key_version,
      keyring: dependencies.replyTokenKeyring,
      inboundReplyDomain: dependencies.inboundReplyDomain ?? "",
    }).replyTo;
    const provider = await dependencies.sendEmail({
      to: recipient,
      subject,
      body,
      replyTo,
      idempotencyKey,
    });

    if (provider.status === "failed") {
      await dependencies.markAttemptFailed({
        workspaceId: input.workspaceId,
        attemptId: attempt.id,
        errorCode: provider.errorCode ?? "OUTREACH_EMAIL_PROVIDER_FAILED",
        errorMessage: provider.errorMessage ?? "The email provider rejected the message.",
      });
      return {
        ...result(
          outreach,
          { ...attempt, status: "failed", error_code: provider.errorCode, error_message: provider.errorMessage },
          "failed",
          provider.errorCode,
        ),
        providerMessageId: null,
      };
    }
    if (provider.status === "unknown") {
      await dependencies.markAttemptUnknown({
        workspaceId: input.workspaceId,
        attemptId: attempt.id,
        errorCode: provider.errorCode,
        errorMessage: provider.errorMessage,
      });
      return {
        ...result(
          outreach,
          { ...attempt, status: "unknown", error_code: provider.errorCode, error_message: provider.errorMessage },
          "unknown",
          provider.errorCode,
        ),
        providerMessageId: null,
      };
    }

    await dependencies.markAttemptAccepted({
      workspaceId: input.workspaceId,
      attemptId: attempt.id,
      providerMessageId: provider.providerMessageId,
    });
    const acceptedAttempt = {
      ...attempt,
      status: "accepted" as const,
      provider_message_id: provider.providerMessageId,
    };
    return reconcileAccepted(dependencies, input.workspaceId, outreach, acceptedAttempt, "sent");
  };
}
