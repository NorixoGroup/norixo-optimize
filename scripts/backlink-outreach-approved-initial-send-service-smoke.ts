import { BacklinkOutreachEmailSendError } from "../lib/backlinks/services/outreachEmailSendService";
import { sendApprovedBacklinkOutreachEmail } from "../lib/backlinks/services/outreachApprovedAutoSendService";
import { deriveBacklinkOutreachReplyCorrelationIdentity } from "../lib/backlinks/services/outreachReplyCorrelationIdentity";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function expectError(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    assert(error instanceof BacklinkOutreachEmailSendError && error.code === code, `Expected ${code}`);
  }
}

async function main(): Promise<void> {
  const replyTokenKeyring = { activeKeyVersion: "v1", secrets: { v1: "service-smoke-secret" } };
  const identity = deriveBacklinkOutreachReplyCorrelationIdentity({
    attemptId: "550e8400-e29b-41d4-a716-446655440000",
    keyring: replyTokenKeyring,
  });
  const attempt = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    workspace_id: "workspace", outreach_id: "outreach", actor_user_id: "actor", attempt_kind: "initial",
    cancel_reason: null, cancelled_at: null, channel: "email", provider: "resend", recipient: "snapshot@example.com",
    idempotency_key: "key", reply_token_hash: identity.tokenHash, reply_token_key_version: "v1", status: "requested",
    provider_message_id: null, prepared_at: null, error_code: null, error_message: null,
    requested_at: "2026-08-30T10:00:00.000Z", accepted_at: null, failed_at: null, resolved_at: null,
    created_at: "2026-08-30T10:00:00.000Z",
  } as const;
  const snapshot = {
    attempt_id: attempt.id, workspace_id: "workspace", idempotency_key: "key", outreach_id: "outreach",
    campaign_id: "campaign", opportunity_id: "opportunity", contact_id: "contact", recipient_email: "snapshot@example.com",
    subject: "Approved subject", body: "Approved body", channel: "email", target_url: "https://example.com",
    approved_at: "2026-08-30T09:00:00.000Z", approved_by: "actor", approval_fingerprint: "bl1_valid",
    created_at: "2026-08-30T10:00:00.000Z",
  } as const;
  let providerCalls = 0;
  let activated = false;
  let disposition: "created" | "existing" | "not_approved" | "approval_stale" | "campaign_disabled" | "rate_limited" = "created";
  const service = sendApprovedBacklinkOutreachEmail({
    getWorkspaceControl: async () => null,
    getOutreach: async () => ({
      id: "outreach", campaign_id: "campaign", opportunity_id: "opportunity", contact_id: "contact", channel: "email",
      status: activated ? "active" : "ready", subject: "Mutable subject", body: "Mutable body", current_attempt: 0,
      max_attempts: 3, first_contact_at: null, last_attempt_at: null,
    }),
    reserveApprovedInitialAttempt: async () => {
      if (disposition === "rate_limited") return { attempt: null, snapshot: null, disposition, rateLimitReason: "WORKSPACE_HOURLY_LIMIT_REACHED" } as const;
      if (disposition !== "created" && disposition !== "existing") return { attempt: null, snapshot: null, disposition, rateLimitReason: null } as const;
      return { attempt: { ...attempt, status: disposition === "existing" ? "accepted" : "requested" }, snapshot, disposition, rateLimitReason: null } as const;
    },
    markAttemptAccepted: async () => undefined,
    markAttemptFailed: async () => undefined,
    markAttemptUnknown: async () => undefined,
    sendEmail: async (input) => {
      providerCalls += 1;
      assert(input.to === snapshot.recipient_email && input.subject === snapshot.subject && input.body === snapshot.body, "Provider must use the immutable approved snapshot.");
      return { status: "accepted" as const, provider: "resend", providerMessageId: "message", errorCode: null, errorMessage: null };
    },
    activateOutreach: async (_workspaceId, _outreachId, input) => {
      activated = true;
      return { id: "outreach", campaign_id: "campaign", opportunity_id: "opportunity", contact_id: "contact", channel: "email", status: input.status, subject: null, body: null, current_attempt: input.currentAttempt, max_attempts: 3, first_contact_at: input.firstContactAt, last_attempt_at: input.lastAttemptAt };
    },
    inboundReplyDomain: "inbound.norixo.io",
    replyTokenKeyring,
    createAttemptId: () => attempt.id,
    now: () => "2026-08-30T10:00:00.000Z",
  });
  const input = { workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", idempotencyKey: "key" };

  const sent = await service(input);
  assert(sent.disposition === "sent" && providerCalls === 1, "Approved initial send must reserve once and send once.");
  disposition = "existing";
  const repeated = await service(input);
  assert(repeated.disposition === "existing" && providerCalls === 1, "Idempotency must not duplicate provider sends.");

  disposition = "not_approved";
  await expectError(() => service({ ...input, idempotencyKey: "not-approved" }), "OUTREACH_NOT_APPROVED");
  disposition = "approval_stale";
  await expectError(() => service({ ...input, idempotencyKey: "stale" }), "OUTREACH_APPROVAL_STALE");
  disposition = "campaign_disabled";
  await expectError(() => service({ ...input, idempotencyKey: "gate-disabled" }), "OUTREACH_CAMPAIGN_DISABLED");
  disposition = "rate_limited";
  await expectError(() => service({ ...input, idempotencyKey: "rate-limited" }), "OUTREACH_SEND_RATE_LIMIT_EXCEEDED");
  assert(providerCalls === 1, "Blocked or rate-limited admissions must not fall back to legacy send behavior.");
  console.log("PASS — Backlink outreach approved initial send service smoke");
}

void main();
