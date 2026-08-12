import type { BacklinkContactRow } from "../repositories/contactsRepository";
import type { BacklinkOutreachAttemptRow } from "../repositories/outreachAttemptsRepository";
import type { BacklinkOutreachRow } from "../repositories/outreachRepository";

type FollowUpOutreach = Pick<
  BacklinkOutreachRow,
  "id" | "contact_id" | "channel" | "status" | "current_attempt" | "max_attempts" | "next_follow_up_at"
>;
type FollowUpContact = Pick<BacklinkContactRow, "contact_status" | "email_normalized">;
type FollowUpAttempt = Pick<BacklinkOutreachAttemptRow, "status">;

export type BacklinkOutreachFollowUpEligibilityReason =
  | "OUTREACH_NOT_ACTIVE"
  | "CHANNEL_NOT_SUPPORTED"
  | "FOLLOW_UP_NOT_SCHEDULED"
  | "FOLLOW_UP_NOT_DUE"
  | "ATTEMPT_LIMIT_REACHED"
  | "CONTACT_UNAVAILABLE"
  | "FOLLOW_UP_ATTEMPT_PREPARED"
  | "FOLLOW_UP_ATTEMPT_IN_PROGRESS"
  | "FOLLOW_UP_ATTEMPT_UNRESOLVED"
  | "INBOUND_REPLY_STOPPED";

export type BacklinkOutreachFollowUpEligibilityResult = {
  eligible: boolean;
  reason: BacklinkOutreachFollowUpEligibilityReason | null;
  currentAttempt: number;
  maxAttempts: number;
  nextFollowUpAt: string | null;
};

export type BacklinkOutreachFollowUpEligibilityDependencies = {
  getOutreach: (workspaceId: string, outreachId: string) => Promise<FollowUpOutreach>;
  getContact: (workspaceId: string, contactId: string) => Promise<FollowUpContact | null>;
  getOpenAttemptForOutreach: (workspaceId: string, outreachId: string) => Promise<FollowUpAttempt | null>;
  hasInboundReplyStopEffect: (workspaceId: string, outreachId: string) => Promise<boolean>;
  now?: () => string;
};

export type EvaluateBacklinkOutreachFollowUpEligibilityInput = {
  workspaceId: string;
  outreachId: string;
};

function ineligible(
  outreach: FollowUpOutreach,
  reason: BacklinkOutreachFollowUpEligibilityReason,
): BacklinkOutreachFollowUpEligibilityResult {
  return {
    eligible: false,
    reason,
    currentAttempt: outreach.current_attempt,
    maxAttempts: outreach.max_attempts,
    nextFollowUpAt: outreach.next_follow_up_at,
  };
}

function isDue(nextFollowUpAt: string, now: string): boolean {
  const dueAt = Date.parse(nextFollowUpAt);
  const evaluatedAt = Date.parse(now);
  return Number.isFinite(dueAt) && Number.isFinite(evaluatedAt) && dueAt <= evaluatedAt;
}

function hasUsableEmail(contact: FollowUpContact | null): boolean {
  return contact != null &&
    contact.contact_status !== "do_not_contact" &&
    contact.contact_status !== "archived" &&
    Boolean(contact.email_normalized?.trim());
}

/**
 * Read-only, informational eligibility. A true result is not a send reservation:
 * D2 must revalidate every guard atomically before any follow-up can be reserved.
 */
export function evaluateBacklinkOutreachFollowUpEligibility(
  dependencies: BacklinkOutreachFollowUpEligibilityDependencies,
) {
  return async (
    input: EvaluateBacklinkOutreachFollowUpEligibilityInput,
  ): Promise<BacklinkOutreachFollowUpEligibilityResult> => {
    // This order avoids unnecessary reads and makes the first blocking reason deterministic.
    const outreach = await dependencies.getOutreach(input.workspaceId, input.outreachId);
    if (outreach.status !== "active") return ineligible(outreach, "OUTREACH_NOT_ACTIVE");
    if (outreach.channel !== "email") return ineligible(outreach, "CHANNEL_NOT_SUPPORTED");
    if (outreach.next_follow_up_at == null) return ineligible(outreach, "FOLLOW_UP_NOT_SCHEDULED");
    if (!isDue(outreach.next_follow_up_at, (dependencies.now ?? (() => new Date().toISOString()))())) {
      return ineligible(outreach, "FOLLOW_UP_NOT_DUE");
    }
    if (outreach.current_attempt >= outreach.max_attempts) return ineligible(outreach, "ATTEMPT_LIMIT_REACHED");

    const contact = await dependencies.getContact(input.workspaceId, outreach.contact_id);
    if (!hasUsableEmail(contact)) return ineligible(outreach, "CONTACT_UNAVAILABLE");

    const openAttempt = await dependencies.getOpenAttemptForOutreach(input.workspaceId, outreach.id);
    if (openAttempt?.status === "prepared") return ineligible(outreach, "FOLLOW_UP_ATTEMPT_PREPARED");
    if (openAttempt?.status === "requested") return ineligible(outreach, "FOLLOW_UP_ATTEMPT_IN_PROGRESS");
    if (openAttempt?.status === "unknown") return ineligible(outreach, "FOLLOW_UP_ATTEMPT_UNRESOLVED");

    if (await dependencies.hasInboundReplyStopEffect(input.workspaceId, outreach.id)) {
      return ineligible(outreach, "INBOUND_REPLY_STOPPED");
    }
    return {
      eligible: true,
      reason: null,
      currentAttempt: outreach.current_attempt,
      maxAttempts: outreach.max_attempts,
      nextFollowUpAt: outreach.next_follow_up_at,
    };
  };
}
