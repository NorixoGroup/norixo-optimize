import { sendBacklinkOutreachFollowUpEmail } from "../lib/backlinks/services/outreachFollowUpEmailSendService";
import type { OutreachEmailSendResult } from "../lib/backlinks/providers/outreachEmailProvider";
import type { ApplyBacklinkOutreachFollowUpAcceptedResult, BacklinkOutreachAttemptRow, MarkBacklinkOutreachFollowUpAttemptRequestedResult } from "../lib/backlinks/repositories/outreachAttemptsRepository";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function attempt(overrides: Partial<BacklinkOutreachAttemptRow> = {}): BacklinkOutreachAttemptRow {
  return {
    accepted_at: null,
    actor_user_id: "actor",
    attempt_kind: "follow_up",
    cancel_reason: null,
    cancelled_at: null,
    channel: "email",
    created_at: "2026-08-12T10:00:00.000Z",
    error_code: null,
    error_message: null,
    failed_at: null,
    id: "00000000-0000-8000-8000-000000000123",
    idempotency_key: "follow-up-key",
    outreach_id: "outreach",
    provider: "resend",
    provider_message_id: null,
    prepared_at: "2026-08-12T10:00:00.000Z",
    recipient: "lead@example.com",
    reply_token_hash: "82618f5fd6210723c4de35bf3b8374a327a99ad6b2cce1ef21897c487410fca0",
    reply_token_key_version: "v1",
    requested_at: "2026-08-12T10:00:00.000Z",
    resolved_at: null,
    status: "prepared",
    workspace_id: "workspace",
    ...overrides,
  };
}

function requested(disposition: "requested_now" | "existing" = "requested_now"): MarkBacklinkOutreachFollowUpAttemptRequestedResult {
  return {
    disposition,
    attemptId: "00000000-0000-8000-8000-000000000123",
    outreachId: "outreach",
    recipient: "canonical@example.com",
    subject: "Canonical subject",
    body: "Canonical body",
    replyTokenHash: "82618f5fd6210723c4de35bf3b8374a327a99ad6b2cce1ef21897c487410fca0",
    replyTokenKeyVersion: "v1",
    requestedAt: "2026-08-12T10:01:00.000Z",
  };
}

function accepted(): OutreachEmailSendResult {
  return { status: "accepted", provider: "resend", providerMessageId: "provider-message", errorCode: null, errorMessage: null };
}

function base() {
  const calls = { provider: 0, accepted: 0, failed: 0, unknown: 0, requested: 0 };
  const dependencies = {
    getAttempt: async () => attempt(),
    markRequested: async () => { calls.requested += 1; return requested(); },
    markAccepted: async (): Promise<ApplyBacklinkOutreachFollowUpAcceptedResult> => { calls.accepted += 1; return { disposition: "applied", attemptStatus: "accepted", outreachStatus: "active", currentAttempt: 2, lastAttemptAt: "2026-08-12T10:02:00.000Z" }; },
    markFailed: async () => { calls.failed += 1; },
    markUnknown: async () => { calls.unknown += 1; },
    sendEmail: async (input: { to: string; subject: string; body: string; replyTo: string; idempotencyKey: string }) => {
      calls.provider += 1;
      assert(input.to === "canonical@example.com", "Provider must use canonical recipient.");
      assert(input.subject === "Canonical subject", "Provider must use canonical draft subject.");
      assert(input.body === "Canonical body", "Provider must use canonical draft body.");
      assert(input.replyTo.startsWith("reply+"), "Provider must receive reconstructed Reply-To.");
      assert(input.idempotencyKey === "00000000-0000-8000-8000-000000000123", "Provider idempotency must be attempt ID.");
      return accepted();
    },
    inboundReplyDomain: "reply.example.com",
    replyTokenKeyring: { activeKeyVersion: "v1", secrets: { v1: "secret" } },
    now: () => "2026-08-12T10:02:00.000Z",
  };
  return { calls, dependencies };
}

async function main() {
  {
    const { calls, dependencies } = base();
    const send = sendBacklinkOutreachFollowUpEmail(dependencies);
    await send({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", attemptId: "00000000-0000-8000-8000-000000000123", confirm: true });
    assert(calls.requested === 1 && calls.provider === 1 && calls.accepted === 1, "Accepted flow must request, send once, and apply D4.2.");
  }
  {
    const { calls, dependencies } = base();
    const send = sendBacklinkOutreachFollowUpEmail({ ...dependencies, markRequested: async () => { calls.requested += 1; return requested("existing"); } });
    const result = await send({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", attemptId: "00000000-0000-8000-8000-000000000123", confirm: true });
    assert(result.disposition === "existing" && calls.provider === 0, "Existing requested must not call provider.");
  }
  {
    const { calls, dependencies } = base();
    const send = sendBacklinkOutreachFollowUpEmail({ ...dependencies, sendEmail: async () => { calls.provider += 1; return { status: "failed", provider: "resend", providerMessageId: null, errorCode: "FAILED", errorMessage: "Failed" }; } });
    const result = await send({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", attemptId: "00000000-0000-8000-8000-000000000123", confirm: true });
    assert(result.disposition === "failed" && calls.failed === 1 && calls.accepted === 0, "Failed provider result must transition failed without D4.2.");
  }
  {
    const { calls, dependencies } = base();
    const send = sendBacklinkOutreachFollowUpEmail({ ...dependencies, sendEmail: async () => { calls.provider += 1; return { status: "unknown", provider: "resend", providerMessageId: null, errorCode: "UNKNOWN", errorMessage: "Unknown" }; } });
    const result = await send({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", attemptId: "00000000-0000-8000-8000-000000000123", confirm: true });
    assert(result.disposition === "unknown" && calls.unknown === 1 && calls.accepted === 0, "Unknown provider result must transition unknown.");
  }
  {
    const { calls, dependencies } = base();
    const send = sendBacklinkOutreachFollowUpEmail({ ...dependencies, sendEmail: async () => { calls.provider += 1; throw new Error("network"); } });
    const result = await send({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", attemptId: "00000000-0000-8000-8000-000000000123", confirm: true });
    assert(result.disposition === "unknown" && calls.unknown === 1, "Provider throw must become unknown.");
  }
  {
    const { calls, dependencies } = base();
    const send = sendBacklinkOutreachFollowUpEmail(dependencies);
    await send({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", attemptId: "00000000-0000-8000-8000-000000000123", confirm: false }).then(() => { throw new Error("confirm false must reject"); }, () => undefined);
    assert(calls.requested === 0 && calls.provider === 0, "Missing confirm must not mutate or call provider.");
  }
  {
    const { calls, dependencies } = base();
    const send = sendBacklinkOutreachFollowUpEmail({ ...dependencies, getAttempt: async () => attempt({ reply_token_key_version: null }) });
    await send({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", attemptId: "00000000-0000-8000-8000-000000000123", confirm: true }).then(() => { throw new Error("legacy identity must reject"); }, () => undefined);
    assert(calls.requested === 0 && calls.provider === 0, "Legacy identity must fail before pre-send/provider.");
  }
  for (const code of [
    "FOLLOW_UP_SEND_WORKSPACE_CONTROL_MISSING",
    "FOLLOW_UP_SEND_BACKLINKS_DISABLED",
    "FOLLOW_UP_SEND_DRY_RUN",
    "FOLLOW_UP_SEND_CAMPAIGN_MISSING",
    "FOLLOW_UP_SEND_CAMPAIGN_NOT_ACTIVE",
    "FOLLOW_UP_SEND_CAMPAIGN_MISMATCH",
    "FOLLOW_UP_SEND_WORKSPACE_DAILY_RATE_LIMIT",
    "FOLLOW_UP_SEND_WORKSPACE_HOURLY_RATE_LIMIT",
    "FOLLOW_UP_SEND_DOMAIN_DAILY_RATE_LIMIT",
    "FOLLOW_UP_SEND_CONTACT_DAILY_RATE_LIMIT",
    "FOLLOW_UP_SEND_INBOUND_REPLY_STOPPED",
    "FOLLOW_UP_SEND_CONTACT_UNAVAILABLE",
    "FOLLOW_UP_SEND_PROVIDER_COMPLAINT_PREPARED_ATTEMPT_CANCELLED",
    "FOLLOW_UP_SEND_PROVIDER_PERMANENT_BOUNCE_PREPARED_ATTEMPT_CANCELLED",
  ]) {
    const { calls, dependencies } = base();
    const send = sendBacklinkOutreachFollowUpEmail({
      ...dependencies,
      markRequested: async () => {
        calls.requested += 1;
        throw new Error(code);
      },
    });
    await send({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", attemptId: "00000000-0000-8000-8000-000000000123", confirm: true }).then(
      () => { throw new Error(`${code} must reject before provider invocation`); },
      () => undefined,
    );
    assert(calls.requested === 1 && calls.provider === 0 && calls.accepted === 0 && calls.failed === 0 && calls.unknown === 0, `${code} must preserve state after atomic admission rejects.`);
  }
  console.log("PASS — Backlink outreach follow-up send service smoke");
}

void main();
