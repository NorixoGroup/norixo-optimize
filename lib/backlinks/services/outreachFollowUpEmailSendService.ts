import type { OutreachEmailSendResult } from "../providers/outreachEmailProvider";
import type { ApplyBacklinkOutreachFollowUpAcceptedResult, BacklinkOutreachAttemptRow, MarkBacklinkOutreachFollowUpAttemptRequestedResult } from "../repositories/outreachAttemptsRepository";
import { BacklinkOutreachReplyCorrelationIdentityError, reconstructBacklinkOutreachReplyToForAttempt, type BacklinkOutreachReplyTokenKeyring } from "./outreachReplyCorrelationIdentity";

export type BacklinkOutreachFollowUpEmailSendErrorCode =
  | "FOLLOW_UP_SEND_CONFIRM_REQUIRED"
  | "FOLLOW_UP_SEND_IDENTITY_INVALID"
  | "FOLLOW_UP_SEND_PROVIDER_UNAVAILABLE";

export class BacklinkOutreachFollowUpEmailSendError extends Error {
  constructor(public readonly code: BacklinkOutreachFollowUpEmailSendErrorCode) {
    super(code);
    this.name = "BacklinkOutreachFollowUpEmailSendError";
  }
}

export type BacklinkOutreachFollowUpEmailSendDependencies = {
  getAttempt: (workspaceId: string, attemptId: string) => Promise<BacklinkOutreachAttemptRow>;
  markRequested: (input: { workspaceId: string; outreachId: string; attemptId: string; actorUserId: string; requestedAt: string }) => Promise<MarkBacklinkOutreachFollowUpAttemptRequestedResult>;
  markAccepted: (input: { workspaceId: string; outreachId: string; attemptId: string; providerMessageId: string | null; acceptedAt: string }) => Promise<ApplyBacklinkOutreachFollowUpAcceptedResult>;
  markFailed: (input: { workspaceId: string; attemptId: string; errorCode: string; errorMessage: string }) => Promise<unknown>;
  markUnknown: (input: { workspaceId: string; attemptId: string; errorCode: string | null; errorMessage: string | null }) => Promise<unknown>;
  sendEmail: (input: { to: string; subject: string; body: string; replyTo: string; idempotencyKey: string }) => Promise<OutreachEmailSendResult>;
  inboundReplyDomain: string | undefined;
  replyTokenKeyring: BacklinkOutreachReplyTokenKeyring;
  now?: () => string;
};

export type BacklinkOutreachFollowUpEmailSendResult = {
  disposition: "accepted" | "failed" | "unknown" | "existing";
  outreachId: string;
  attemptId: string;
  providerMessageId: string | null;
  errorCode: string | null;
};

function providerErrorCode(result: OutreachEmailSendResult): string {
  return result.errorCode?.trim() || "OUTREACH_EMAIL_PROVIDER_FAILED";
}

function providerErrorMessage(result: OutreachEmailSendResult): string {
  return result.errorMessage?.trim() || "The email provider rejected the message.";
}

export function sendBacklinkOutreachFollowUpEmail(
  dependencies: BacklinkOutreachFollowUpEmailSendDependencies,
) {
  return async (input: {
    workspaceId: string;
    actorUserId: string;
    outreachId: string;
    attemptId: string;
    confirm: boolean;
  }): Promise<BacklinkOutreachFollowUpEmailSendResult> => {
    if (input.confirm !== true) {
      throw new BacklinkOutreachFollowUpEmailSendError("FOLLOW_UP_SEND_CONFIRM_REQUIRED");
    }

    const attempt = await dependencies.getAttempt(input.workspaceId, input.attemptId);
    if (attempt.outreach_id !== input.outreachId) {
      throw new BacklinkOutreachFollowUpEmailSendError("FOLLOW_UP_SEND_IDENTITY_INVALID");
    }

    try {
      reconstructBacklinkOutreachReplyToForAttempt({
        attemptId: attempt.id,
        replyTokenHash: attempt.reply_token_hash,
        replyTokenKeyVersion: attempt.reply_token_key_version,
        keyring: dependencies.replyTokenKeyring,
        inboundReplyDomain: dependencies.inboundReplyDomain ?? "",
      });
    } catch (error) {
      if (error instanceof BacklinkOutreachReplyCorrelationIdentityError) {
        throw new BacklinkOutreachFollowUpEmailSendError("FOLLOW_UP_SEND_IDENTITY_INVALID");
      }
      throw error;
    }

    const requestedAt = (dependencies.now ?? (() => new Date().toISOString()))();
    const snapshot = await dependencies.markRequested({
      workspaceId: input.workspaceId,
      outreachId: input.outreachId,
      attemptId: input.attemptId,
      actorUserId: input.actorUserId,
      requestedAt,
    });

    if (snapshot.disposition === "existing") {
      return {
        disposition: "existing",
        outreachId: snapshot.outreachId,
        attemptId: snapshot.attemptId,
        providerMessageId: null,
        errorCode: null,
      };
    }

    let replyTo: string;
    try {
      replyTo = reconstructBacklinkOutreachReplyToForAttempt({
        attemptId: snapshot.attemptId,
        replyTokenHash: snapshot.replyTokenHash,
        replyTokenKeyVersion: snapshot.replyTokenKeyVersion,
        keyring: dependencies.replyTokenKeyring,
        inboundReplyDomain: dependencies.inboundReplyDomain ?? "",
      }).replyTo;
    } catch (error) {
      if (error instanceof BacklinkOutreachReplyCorrelationIdentityError) {
        throw new BacklinkOutreachFollowUpEmailSendError("FOLLOW_UP_SEND_IDENTITY_INVALID");
      }
      throw error;
    }

    let provider: OutreachEmailSendResult;
    try {
      provider = await dependencies.sendEmail({
        to: snapshot.recipient,
        subject: snapshot.subject,
        body: snapshot.body,
        replyTo,
        idempotencyKey: snapshot.attemptId,
      });
    } catch {
      await dependencies.markUnknown({
        workspaceId: input.workspaceId,
        attemptId: snapshot.attemptId,
        errorCode: "OUTREACH_EMAIL_PROVIDER_THROW",
        errorMessage: "The email provider result could not be confirmed.",
      });
      return {
        disposition: "unknown",
        outreachId: snapshot.outreachId,
        attemptId: snapshot.attemptId,
        providerMessageId: null,
        errorCode: "OUTREACH_EMAIL_PROVIDER_THROW",
      };
    }

    if (provider.status === "failed") {
      const errorCode = providerErrorCode(provider);
      await dependencies.markFailed({
        workspaceId: input.workspaceId,
        attemptId: snapshot.attemptId,
        errorCode,
        errorMessage: providerErrorMessage(provider),
      });
      return {
        disposition: "failed",
        outreachId: snapshot.outreachId,
        attemptId: snapshot.attemptId,
        providerMessageId: null,
        errorCode,
      };
    }

    if (provider.status === "unknown") {
      await dependencies.markUnknown({
        workspaceId: input.workspaceId,
        attemptId: snapshot.attemptId,
        errorCode: provider.errorCode,
        errorMessage: provider.errorMessage,
      });
      return {
        disposition: "unknown",
        outreachId: snapshot.outreachId,
        attemptId: snapshot.attemptId,
        providerMessageId: null,
        errorCode: provider.errorCode,
      };
    }

    const accepted = await dependencies.markAccepted({
      workspaceId: input.workspaceId,
      outreachId: snapshot.outreachId,
      attemptId: snapshot.attemptId,
      providerMessageId: provider.providerMessageId,
      acceptedAt: (dependencies.now ?? (() => new Date().toISOString()))(),
    });
    return {
      disposition: accepted.disposition === "applied" ? "accepted" : "existing",
      outreachId: snapshot.outreachId,
      attemptId: snapshot.attemptId,
      providerMessageId: provider.providerMessageId,
      errorCode: null,
    };
  };
}
