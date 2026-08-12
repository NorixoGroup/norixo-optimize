import {
  BacklinkOutreachFollowUpSchedulingError,
  reconcileBacklinkOutreachFollowUpSchedule,
} from "../lib/backlinks/services/outreachFollowUpSchedulingService";
import type { BacklinkOutreachAttemptRow } from "../lib/backlinks/repositories/outreachAttemptsRepository";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const outreach = {
    id: "outreach",
    workspace_id: "workspace",
    contact_id: "contact",
    status: "active",
    channel: "email",
    current_attempt: 1,
    max_attempts: 3,
    last_attempt_at: "2026-08-12T10:00:00.000Z",
    next_follow_up_at: null,
    response_deadline_at: null,
  } as const;

  const contact = {
    contact_status: "verified",
    email_normalized: "hello@example.com",
  } as const;

  let latestAttempt: BacklinkOutreachAttemptRow = {
    id: "attempt",
    workspace_id: "workspace",
    outreach_id: "outreach",
    actor_user_id: "actor",
    channel: "email",
    provider: "resend",
    recipient: "hello@example.com",
    idempotency_key: "attempt-key",
    status: "accepted",
    provider_message_id: "message-1",
    error_code: null,
    error_message: null,
    requested_at: "2026-08-12T10:00:00.000Z",
    accepted_at: "2026-08-12T10:00:00.000Z",
    failed_at: null,
    resolved_at: null,
    created_at: "2026-08-12T10:00:00.000Z",
    attempt_kind: "email",
    cancel_reason: null,
    cancelled_at: null,
    prepared_at: null,
    reply_token_hash: null,
    reply_token_key_version: null,
  };
  let openAttempt: null | { status: string } = null;
  let stopEffect = false;
  let recordedSchedule: unknown = null;

  const service = reconcileBacklinkOutreachFollowUpSchedule({
    getOutreach: async () => outreach,
    getLatestAttempt: async () => latestAttempt,
    getOpenAttempt: async () => openAttempt,
    getContact: async () => contact,
    hasInboundReplyStopEffect: async () => stopEffect,
    reconcileSchedule: async (_workspaceId, _outreachId, input) => {
      recordedSchedule = input;
      return {
        disposition: "scheduled",
        kind: input.scheduleKind,
        scheduledAt: input.scheduledAt,
        nextFollowUpAt: input.scheduleKind === "follow_up" ? input.scheduledAt : null,
        responseDeadlineAt: input.scheduleKind === "final_response" ? input.scheduledAt : null,
      };
    },
  });

  const scheduled = await service({ workspaceId: "workspace", outreachId: "outreach" });
  assert(
    JSON.stringify(scheduled) === JSON.stringify({
      disposition: "scheduled",
      kind: "follow_up",
      scheduledAt: "2026-08-17T10:00:00.000Z",
      reason: null,
    }),
    "Follow-up scheduling should reconcile to scheduled.",
  );
  assert(
    JSON.stringify(recordedSchedule) === JSON.stringify({
      expectedCurrentAttempt: 1,
      expectedLastAttemptAt: "2026-08-12T10:00:00.000Z",
      scheduleKind: "follow_up",
      scheduledAt: "2026-08-17T10:00:00.000Z",
    }),
    "Scheduling service should pass canonical expected state to the RPC wrapper.",
  );

  latestAttempt = { ...latestAttempt, status: "failed" };
  recordedSchedule = null;
  const notApplicable = await service({ workspaceId: "workspace", outreachId: "outreach" });
  assert(notApplicable.disposition === "not_applicable" && notApplicable.reason === "LATEST_ATTEMPT_NOT_ACCEPTED", "Latest non-accepted attempt must block scheduling.");
  assert(recordedSchedule == null, "Service must not call the RPC when the latest attempt is not accepted.");

  latestAttempt = { ...latestAttempt, status: "accepted" };
  stopEffect = true;
  const stopped = await service({ workspaceId: "workspace", outreachId: "outreach" });
  assert(stopped.disposition === "not_applicable" && stopped.reason === "INBOUND_REPLY_STOPPED", "Inbound reply stop must block scheduling.");

  const invalidError = new BacklinkOutreachFollowUpSchedulingError("FOLLOW_UP_SCHEDULE_INVALID");
  assert(invalidError.code === "FOLLOW_UP_SCHEDULE_INVALID", "Smoke should cover the service error type.");

  console.log("PASS — Backlink outreach follow-up schedule service smoke");
}

void main();
