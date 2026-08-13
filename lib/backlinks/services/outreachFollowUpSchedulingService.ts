import { BacklinkRepositoryError } from "../repositories/errors";
import { getBacklinkContactById } from "../repositories/contactsRepository";
import { getBacklinkOutreachById, type ReconcileBacklinkOutreachFollowUpScheduleResult } from "../repositories/outreachRepository";
import { evaluateBacklinkOutreachScheduleReconciliationCandidate, type BacklinkOutreachScheduleReconciliationCandidate } from "./outreachScheduleReconciliationService";

export type BacklinkOutreachFollowUpSchedulingErrorCode =
  | "FOLLOW_UP_SCHEDULE_CONFLICT"
  | "FOLLOW_UP_SCHEDULE_INVALID";

export class BacklinkOutreachFollowUpSchedulingError extends Error {
  constructor(public readonly code: BacklinkOutreachFollowUpSchedulingErrorCode) {
    super(code);
    this.name = "BacklinkOutreachFollowUpSchedulingError";
  }
}

export type BacklinkOutreachFollowUpSchedulingResult = {
  disposition: "scheduled" | "existing" | "not_applicable";
  kind: "follow_up" | "final_response" | null;
  scheduledAt: string | null;
  reason: string | null;
};

type Outreach = Pick<
  Awaited<ReturnType<typeof getBacklinkOutreachById>>,
  "id" | "workspace_id" | "contact_id" | "status" | "channel" | "current_attempt" | "max_attempts" | "last_attempt_at" | "next_follow_up_at" | "response_deadline_at"
>;
type Contact = Pick<Awaited<ReturnType<typeof getBacklinkContactById>>, "contact_status" | "email_normalized">;

function scheduledResult(value: ReconcileBacklinkOutreachFollowUpScheduleResult): BacklinkOutreachFollowUpSchedulingResult {
  return {
    disposition: value.disposition,
    kind: value.kind,
    scheduledAt: value.scheduledAt,
    reason: null,
  };
}

function notApplicable(reason: string): BacklinkOutreachFollowUpSchedulingResult {
  return { disposition: "not_applicable", kind: null, scheduledAt: null, reason };
}

function normalizeFollowUpScheduleError(error: unknown): BacklinkOutreachFollowUpSchedulingError {
  if (error instanceof BacklinkOutreachFollowUpSchedulingError) return error;
  if (error instanceof BacklinkRepositoryError) {
    if (error.code === "CONFLICT" || error.message.startsWith("FOLLOW_UP_SCHEDULE_CONFLICT")) {
      return new BacklinkOutreachFollowUpSchedulingError("FOLLOW_UP_SCHEDULE_CONFLICT");
    }
  }
  return new BacklinkOutreachFollowUpSchedulingError("FOLLOW_UP_SCHEDULE_INVALID");
}

export function reconcileBacklinkOutreachFollowUpSchedule(
  dependencies: {
    getOutreach: (workspaceId: string, outreachId: string) => Promise<Outreach>;
    getLatestAttempt: (workspaceId: string, outreachId: string) => Promise<{ status: string } | null>;
    getOpenAttempt: (workspaceId: string, outreachId: string) => Promise<{ status: string } | null>;
    getContact: (workspaceId: string, contactId: string) => Promise<Contact | null>;
    hasInboundReplyStopEffect: (workspaceId: string, outreachId: string) => Promise<boolean>;
    reconcileSchedule: (workspaceId: string, outreachId: string, input: { expectedCurrentAttempt: number; expectedLastAttemptAt: string; scheduleKind: "follow_up" | "final_response"; scheduledAt: string }) => Promise<ReconcileBacklinkOutreachFollowUpScheduleResult>;
    now?: () => string;
  },
) {
  return async (input: { workspaceId: string; outreachId: string }): Promise<BacklinkOutreachFollowUpSchedulingResult> => {
    const outreach = await dependencies.getOutreach(input.workspaceId, input.outreachId);
    const candidate: BacklinkOutreachScheduleReconciliationCandidate = outreach;
    const lastAttemptAt = outreach.last_attempt_at;
    const evaluate = evaluateBacklinkOutreachScheduleReconciliationCandidate({
      getLatestAttempt: dependencies.getLatestAttempt,
      getOpenAttempt: dependencies.getOpenAttempt,
      getContact: dependencies.getContact,
      hasInboundReplyStopEffect: dependencies.hasInboundReplyStopEffect,
    });
    const eligibility = await evaluate(candidate);
    if (eligibility.disposition === "not_applicable") return notApplicable(eligibility.reason);
    if (lastAttemptAt == null) return notApplicable("LATEST_ATTEMPT_NOT_ACCEPTED");

    try {
      const result = await dependencies.reconcileSchedule(input.workspaceId, input.outreachId, {
        expectedCurrentAttempt: outreach.current_attempt,
        expectedLastAttemptAt: lastAttemptAt,
        scheduleKind: eligibility.kind,
        scheduledAt: eligibility.scheduledAt,
      });
      return scheduledResult(result);
    } catch (error) {
      if (error instanceof BacklinkRepositoryError && error.message.startsWith("FOLLOW_UP_SCHEDULE_NOT_APPLICABLE")) {
        return notApplicable("LATEST_ATTEMPT_NOT_ACCEPTED");
      }
      throw normalizeFollowUpScheduleError(error);
    }
  };
}
