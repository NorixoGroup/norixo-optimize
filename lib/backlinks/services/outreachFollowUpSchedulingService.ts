import { BacklinkRepositoryError } from "../repositories/errors";
import { getBacklinkContactById } from "../repositories/contactsRepository";
import { getBacklinkOutreachById, type ReconcileBacklinkOutreachFollowUpScheduleResult } from "../repositories/outreachRepository";
import { getLatestBacklinkOutreachAttemptForOutreach, getOpenBacklinkOutreachAttemptForOutreach, type BacklinkOutreachAttemptRow } from "../repositories/outreachAttemptsRepository";
import { hasBacklinkOutreachInboundReplyStopEffect } from "../repositories/outreachInboundEffectsRepository";
import { evaluateBacklinkOutreachFollowUpSchedulingPolicy, type BacklinkOutreachFollowUpSchedulingPolicyResult } from "./outreachFollowUpSchedulingPolicy";

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

function usableContact(contact: Contact | null): boolean {
  return contact != null && contact.contact_status !== "do_not_contact" && contact.contact_status !== "archived" && Boolean(contact.email_normalized?.trim());
}

function latestAcceptedAttempt(attempt: BacklinkOutreachAttemptRow | null): BacklinkOutreachAttemptRow | null {
  return attempt != null && attempt.status === "accepted" ? attempt : null;
}

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
    getLatestAttempt: (workspaceId: string, outreachId: string) => Promise<BacklinkOutreachAttemptRow | null>;
    getOpenAttempt: (workspaceId: string, outreachId: string) => Promise<BacklinkOutreachAttemptRow | null>;
    getContact: (workspaceId: string, contactId: string) => Promise<Contact | null>;
    hasInboundReplyStopEffect: (workspaceId: string, outreachId: string) => Promise<boolean>;
    reconcileSchedule: (workspaceId: string, outreachId: string, input: { expectedCurrentAttempt: number; expectedLastAttemptAt: string; scheduleKind: "follow_up" | "final_response"; scheduledAt: string }) => Promise<ReconcileBacklinkOutreachFollowUpScheduleResult>;
    now?: () => string;
  },
) {
  return async (input: { workspaceId: string; outreachId: string }): Promise<BacklinkOutreachFollowUpSchedulingResult> => {
    const outreach = await dependencies.getOutreach(input.workspaceId, input.outreachId);
    if (outreach.status !== "active") return notApplicable("OUTREACH_NOT_ACTIVE");
    if (outreach.channel !== "email") return notApplicable("CHANNEL_NOT_SUPPORTED");

    const latest = latestAcceptedAttempt(await dependencies.getLatestAttempt(input.workspaceId, input.outreachId));
    if (latest == null || outreach.current_attempt <= 0 || outreach.last_attempt_at == null || outreach.current_attempt > outreach.max_attempts) {
      return notApplicable("LATEST_ATTEMPT_NOT_ACCEPTED");
    }

    const contact = await dependencies.getContact(input.workspaceId, outreach.contact_id);
    if (!usableContact(contact)) return notApplicable("CONTACT_UNAVAILABLE");

    const openAttempt = await dependencies.getOpenAttempt(input.workspaceId, input.outreachId);
    if (openAttempt?.status === "prepared" || openAttempt?.status === "requested" || openAttempt?.status === "unknown") {
      return notApplicable("OPEN_ATTEMPT_PRESENT");
    }

    if (await dependencies.hasInboundReplyStopEffect(input.workspaceId, input.outreachId)) {
      return notApplicable("INBOUND_REPLY_STOPPED");
    }

    const policy = evaluateBacklinkOutreachFollowUpSchedulingPolicy({
      currentAttempt: outreach.current_attempt,
      maxAttempts: outreach.max_attempts,
      lastAttemptAt: outreach.last_attempt_at,
    });

    if (policy.kind === "none") {
      return notApplicable("POLICY_NONE");
    }

    try {
      const result = await dependencies.reconcileSchedule(input.workspaceId, input.outreachId, {
        expectedCurrentAttempt: outreach.current_attempt,
        expectedLastAttemptAt: outreach.last_attempt_at,
        scheduleKind: policy.kind,
        scheduledAt: policy.kind === "follow_up" ? policy.nextFollowUpAt : policy.responseDeadlineAt,
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
