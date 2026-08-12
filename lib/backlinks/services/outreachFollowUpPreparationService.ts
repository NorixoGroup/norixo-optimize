import { randomUUID } from "node:crypto";

import { deriveBacklinkOutreachReplyCorrelationIdentity, type BacklinkOutreachReplyTokenKeyring } from "./outreachReplyCorrelationIdentity";
import type { PrepareBacklinkOutreachFollowUpDraftResult } from "../repositories/outreachFollowUpDraftsRepository";
import type { ReserveBacklinkOutreachFollowUpAttemptInput, ReserveBacklinkOutreachFollowUpAttemptResult } from "../repositories/outreachAttemptsRepository";

export type BacklinkOutreachFollowUpPreparationResult = {
  disposition: "prepared" | "existing";
  outreachId: string;
  attemptId: string;
  draftDisposition: PrepareBacklinkOutreachFollowUpDraftResult["disposition"];
};

export type BacklinkOutreachFollowUpPreparationDependencies = {
  reserveAttempt: (input: ReserveBacklinkOutreachFollowUpAttemptInput) => Promise<ReserveBacklinkOutreachFollowUpAttemptResult>;
  prepareDraft: (input: { workspaceId: string; outreachId: string; attemptId: string; actorUserId: string }) => Promise<PrepareBacklinkOutreachFollowUpDraftResult>;
  replyTokenKeyring: BacklinkOutreachReplyTokenKeyring;
  now?: () => string;
};

export function prepareBacklinkOutreachFollowUp(deps: BacklinkOutreachFollowUpPreparationDependencies) {
  return async (input: { workspaceId: string; actorUserId: string; outreachId: string; idempotencyKey: string }): Promise<BacklinkOutreachFollowUpPreparationResult> => {
    const attemptId = randomUUID();
    const reservedAt = (deps.now ?? (() => new Date().toISOString()))();
    const identity = deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId, keyring: deps.replyTokenKeyring });

    const reserved = await deps.reserveAttempt({
      workspaceId: input.workspaceId,
      outreachId: input.outreachId,
      attemptId,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      replyTokenHash: identity.tokenHash,
      replyTokenKeyVersion: identity.keyVersion,
      reservedAt,
    });

    if (reserved.attemptStatus !== "prepared") {
      throw new Error("FOLLOW_UP_PREPARATION_CONFLICT");
    }

    const draft = await deps.prepareDraft({
      workspaceId: input.workspaceId,
      outreachId: input.outreachId,
      attemptId: reserved.attemptId,
      actorUserId: input.actorUserId,
    });

    return {
      disposition: reserved.disposition === "reserved" ? "prepared" : "existing",
      outreachId: reserved.outreachId,
      attemptId: reserved.attemptId,
      draftDisposition: draft.disposition,
    };
  };
}
