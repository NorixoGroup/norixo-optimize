import {
  generateBacklinkOutreachFollowUpAiDraft,
  type BacklinkOutreachFollowUpAiContext,
} from "./outreachFollowUpAiDraft";

import type {
  BacklinkOutreachFollowUpDraftProjection,
  PrepareBacklinkOutreachFollowUpDraftResult,
} from "../repositories/outreachFollowUpDraftsRepository";

type Attempt = {
  id: string;
  outreach_id: string;
  attempt_kind: string;
  status: string;
  created_at: string;
};

type Outreach = {
  id: string;
  campaign_id: string;
  contact_id: string;
  opportunity_id: string;
  subject: string | null;
  body: string | null;
};

type Draft = BacklinkOutreachFollowUpDraftProjection;

export class BacklinkOutreachFollowUpDraftError extends Error {
  constructor(
    public readonly code:
      | "FOLLOW_UP_DRAFT_ATTEMPT_NOT_PREPARED"
      | "FOLLOW_UP_DRAFT_CONFLICT"
      | "FOLLOW_UP_DRAFT_INVALID",
  ) {
    super(code);
  }
}

type TemplateData = Omit<
  BacklinkOutreachFollowUpAiContext,
  "followUpNumber" | "previousOutbound"
>;

export type BacklinkOutreachFollowUpDraftDependencies = {
  getAttempt(
    workspaceId: string,
    attemptId: string,
  ): Promise<Attempt>;

  getOutreach(
    workspaceId: string,
    outreachId: string,
  ): Promise<Outreach>;

  listAttempts(
    workspaceId: string,
    outreachId: string,
  ): Promise<Attempt[]>;

  getTemplateData(
    workspaceId: string,
    outreach: Outreach,
  ): Promise<TemplateData>;

  generateAiDraft?: typeof generateBacklinkOutreachFollowUpAiDraft;

  getDraft(
    workspaceId: string,
    attemptId: string,
  ): Promise<Draft | null>;

  prepare(input: {
    workspaceId: string;
    outreachId: string;
    attemptId: string;
    actorUserId: string;
    subject: string;
    body: string;
    preparedAt: string;
  }): Promise<PrepareBacklinkOutreachFollowUpDraftResult>;

  update?: (input: {
    workspaceId: string;
    outreachId: string;
    attemptId: string;
    actorUserId: string;
    subject: string;
    body: string;
    expectedUpdatedAt: string;
    updatedAt: string;
  }) => Promise<Draft>;

  now?: () => string;
};

function valid(attempt: Attempt, outreachId: string) {
  return (
    attempt.outreach_id === outreachId &&
    attempt.attempt_kind === "follow_up" &&
    attempt.status === "prepared"
  );
}

function content(value: string, max: number) {
  const result = value.trim();

  if (!result || result.length > max) {
    throw new BacklinkOutreachFollowUpDraftError(
      "FOLLOW_UP_DRAFT_INVALID",
    );
  }

  return result;
}

export function prepareBacklinkOutreachFollowUpDraft(
  deps: BacklinkOutreachFollowUpDraftDependencies,
) {
  return async (input: {
    workspaceId: string;
    outreachId: string;
    attemptId: string;
    actorUserId: string;
  }) => {
    const attempt = await deps.getAttempt(
      input.workspaceId,
      input.attemptId,
    );

    if (!valid(attempt, input.outreachId)) {
      throw new BacklinkOutreachFollowUpDraftError(
        "FOLLOW_UP_DRAFT_ATTEMPT_NOT_PREPARED",
      );
    }

    const existing = await deps.getDraft(
      input.workspaceId,
      attempt.id,
    );

    // Existing canonical drafts are never regenerated.
    if (existing != null) {
      return {
        ...existing,
        disposition: "existing" as const,
      };
    }

    const outreach = await deps.getOutreach(
      input.workspaceId,
      input.outreachId,
    );

    const attempts = await deps.listAttempts(
      input.workspaceId,
      outreach.id,
    );

    // Number only follow-ups that were actually accepted/sent.
    // Prepared, cancelled or failed attempts are not conversation turns.
    const followUpNumber =
      attempts.filter(
        (item) =>
          item.attempt_kind === "follow_up" &&
          item.status === "accepted" &&
          item.id !== attempt.id &&
          item.created_at < attempt.created_at,
      ).length + 1;

    // Conversation source of truth:
    // use the latest previously ACCEPTED follow-up draft.
    // For the first follow-up, or if no accepted follow-up draft
    // is available, fall back to the actual initial outbound.
    let previousSubject = content(
      outreach.subject ?? "",
      300,
    );

    let previousBody = content(
      outreach.body ?? "",
      10000,
    );

    const priorAcceptedFollowUps = attempts
      .filter(
        (item) =>
          item.attempt_kind === "follow_up" &&
          item.status === "accepted" &&
          item.id !== attempt.id &&
          item.created_at < attempt.created_at,
      )
      .sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );

    for (const priorAttempt of priorAcceptedFollowUps) {
      const priorDraft = await deps.getDraft(
        input.workspaceId,
        priorAttempt.id,
      );

      if (
        priorDraft?.subject?.trim() &&
        priorDraft.body?.trim()
      ) {
        previousSubject = content(
          priorDraft.subject,
          300,
        );
        previousBody = content(
          priorDraft.body,
          10000,
        );
        break;
      }
    }

    const data = await deps.getTemplateData(
      input.workspaceId,
      outreach,
    );

    const generate =
      deps.generateAiDraft ??
      generateBacklinkOutreachFollowUpAiDraft;

    const generated = await generate({
      ...data,
      followUpNumber,
      previousOutbound: {
        subject: previousSubject,
        body: previousBody,
      },
    });

    if (
      generated.status !== "success" ||
      generated.proposal.approvalRequired !== true
    ) {
      throw new BacklinkOutreachFollowUpDraftError(
        "FOLLOW_UP_DRAFT_INVALID",
      );
    }

    return deps.prepare({
      ...input,
      subject: content(
        generated.proposal.subject,
        300,
      ),
      body: content(
        generated.proposal.body,
        10000,
      ),
      preparedAt: (
        deps.now ?? (() => new Date().toISOString())
      )(),
    });
  };
}

export function updateBacklinkOutreachFollowUpDraft(
  deps: BacklinkOutreachFollowUpDraftDependencies,
) {
  return async (input: {
    workspaceId: string;
    outreachId: string;
    attemptId: string;
    actorUserId: string;
    subject: string;
    body: string;
    expectedUpdatedAt: string;
  }) => {
    const attempt = await deps.getAttempt(
      input.workspaceId,
      input.attemptId,
    );

    if (!valid(attempt, input.outreachId)) {
      throw new BacklinkOutreachFollowUpDraftError(
        "FOLLOW_UP_DRAFT_ATTEMPT_NOT_PREPARED",
      );
    }

    if (!deps.update) {
      throw new BacklinkOutreachFollowUpDraftError(
        "FOLLOW_UP_DRAFT_INVALID",
      );
    }

    try {
      return await deps.update({
        ...input,
        subject: content(input.subject, 300),
        body: content(input.body, 10000),
        updatedAt: (
          deps.now ?? (() => new Date().toISOString())
        )(),
      });
    } catch (error) {
      if (
        error instanceof BacklinkOutreachFollowUpDraftError
      ) {
        throw error;
      }

      throw error;
    }
  };
}
