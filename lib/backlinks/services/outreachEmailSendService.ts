import type { BacklinkOutreachAttemptReservation, BacklinkOutreachAttemptRow } from "../repositories/outreachAttemptsRepository";
import type { OutreachEmailSendResult } from "../providers/outreachEmailProvider";
import type { OutreachDraftEligibilityDependencies } from "./outreachDraftEligibilityService";
import type { BacklinkOutreachReplyTokenKeyring } from "./outreachReplyCorrelationIdentity";
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
  | "OUTREACH_SEND_WORKSPACE_CONTROL_MISSING"
  | "OUTREACH_SEND_BACKLINKS_DISABLED"
  | "OUTREACH_CAMPAIGN_NOT_ACTIVE"
  | "OUTREACH_NOT_APPROVED"
  | "OUTREACH_APPROVAL_STALE"
  | "OUTREACH_CAMPAIGN_DISABLED"
  | "OUTREACH_NOT_READY"
  | "OUTREACH_INVALID_RECIPIENT"
  | "OUTREACH_MISSING_APPROVED_CONTENT"
  | "OUTREACH_INELIGIBLE"
  /** G4-M2: this legacy send path is permanently disabled — see sendBacklinkOutreachEmail. */
  | "OUTREACH_EMAIL_SEND_SERVICE_REMOVED";

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
  sendEmail: (input: { to: string; subject: string; body: string; replyTo: string; idempotencyKey: string; context?: { workspaceId: string; outreachId: string } }) => Promise<OutreachEmailSendResult>;
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

/**
 * G4-M2: permanently disabled. This legacy path had no V3 production-eligibility gate, no
 * mailbox-deliverability check, and no suppression check of its own (see the G4-M2 audit).
 * It must refuse before any lookup, reservation, or provider call, regardless of what the
 * caller supplies — so the dependencies and input are intentionally never read.
 */
export function sendBacklinkOutreachEmail(
  dependencies: BacklinkOutreachEmailSendDependencies,
) {
  return async (input: {
    workspaceId: string;
    actorUserId: string;
    outreachId: string;
    idempotencyKey: string;
  }): Promise<BacklinkOutreachEmailSendResult> => {
    void dependencies;
    void input;
    throw new BacklinkOutreachEmailSendError("OUTREACH_EMAIL_SEND_SERVICE_REMOVED");
  };
}
