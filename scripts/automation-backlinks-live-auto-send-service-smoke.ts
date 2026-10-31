import type { BacklinkOutreachEmailSendResult } from "../lib/backlinks/services/outreachEmailSendService";
import { BacklinkOutreachEmailSendError } from "../lib/backlinks/services/outreachEmailSendService";
import type {
  BacklinkOutreachLiveAutoSendCandidateRow,
  BacklinkOutreachLiveAutoSendDependencies,
  BacklinkOutreachLiveAutoSendWorkspaceControl,
} from "../lib/automation/backlink-outreach-live-auto-send-service";
import {
  MAX_LIVE_AUTO_SENDS_PER_RUN,
  BacklinkOutreachLiveAutoSendError,
  canRunBacklinkOutreachLiveAutoSend,
  runBacklinkOutreachLiveAutoSend,
} from "../lib/automation/backlink-outreach-live-auto-send-service";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const VALID_ID = "550e8400-e29b-41d4-a716-4466554400bb";

function candidate(
  id: string,
  overrides: Partial<BacklinkOutreachLiveAutoSendCandidateRow> = {},
): BacklinkOutreachLiveAutoSendCandidateRow {
  return {
    id,
    workspace_id: "workspace-1",
    status: "ready",
    channel: "email",
    current_attempt: 0,
    max_attempts: 3,
    updated_at: "2026-08-20T08:00:00.000Z",
    auto_send_approved_at: "2026-08-20T07:55:00.000Z",
    auto_send_approved_by: "actor-1",
    auto_send_approval_fingerprint: "approval-fingerprint-1",
    ...overrides,
  };
}

function enabledControl(
  overrides: Partial<BacklinkOutreachLiveAutoSendWorkspaceControl> = {},
): BacklinkOutreachLiveAutoSendWorkspaceControl {
  return {
    backlinksEnabled: true,
    backlinkOutreachScheduleApplyEnabled: true,
    dryRunOnly: false,
    disabledReason: null,
    ...overrides,
  };
}

function sendResult(
  disposition: BacklinkOutreachEmailSendResult["disposition"],
  attemptId = "attempt-1",
): BacklinkOutreachEmailSendResult {
  return {
    disposition,
    outreachId: "outreach-1",
    attemptId,
    attemptStatus: disposition === "failed" ? "failed" : disposition === "unknown" ? "unknown" : "accepted",
    providerMessageId: disposition === "sent" ? "message-1" : null,
    outreachStatus: disposition === "sent" ? "active" : "ready",
    currentAttempt: disposition === "sent" ? 1 : 0,
    errorCode: disposition === "failed" ? "REJECTED" : disposition === "unknown" ? "TIMEOUT" : null,
  };
}

/** No listCandidates: an explicit outreachId must never fall back to a scan (G4-M1). */
function deps(overrides: Partial<BacklinkOutreachLiveAutoSendDependencies> = {}): BacklinkOutreachLiveAutoSendDependencies {
  return {
    getCandidateById: async () => null,
    sendBacklinkOutreachEmail: async () => {
      throw new Error("sendBacklinkOutreachEmail must not be called for this scenario.");
    },
    ...overrides,
  };
}

async function expectInvalidInput(
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
    throw new Error("Expected LIVE_AUTO_SEND_INVALID_INPUT");
  } catch (error) {
    assert(
      error instanceof BacklinkOutreachLiveAutoSendError && error.code === "LIVE_AUTO_SEND_INVALID_INPUT",
      "Expected LIVE_AUTO_SEND_INVALID_INPUT",
    );
  }
}

async function expectReject(
  operation: () => Promise<unknown>,
  code: BacklinkOutreachLiveAutoSendError["code"],
): Promise<void> {
  try {
    await operation();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    assert(error instanceof BacklinkOutreachLiveAutoSendError && error.code === code, `Expected ${code}`);
  }
}

async function main(): Promise<void> {
  assert(MAX_LIVE_AUTO_SENDS_PER_RUN === 1, "Phase 1 must cap live auto sends at one.");
  assert(canRunBacklinkOutreachLiveAutoSend(enabledControl()), "Enabled control must allow live auto send.");
  assert(!canRunBacklinkOutreachLiveAutoSend(enabledControl({ dryRunOnly: true })), "Dry-run control must block live auto send.");
  assert(!canRunBacklinkOutreachLiveAutoSend(enabledControl({ backlinksEnabled: false })), "Backlinks-disabled control must block live auto send.");
  assert(!canRunBacklinkOutreachLiveAutoSend(enabledControl({ backlinkOutreachScheduleApplyEnabled: false })), "Schedule-apply-disabled control must block live auto send.");
  assert(!canRunBacklinkOutreachLiveAutoSend(enabledControl({ disabledReason: "disabled" })), "Disabled workspace control must block live auto send.");

  // --- G4-M1: outreachId is mandatory. Every rejection below must happen before any lookup. ---

  {
    let getCandidateCalls = 0;
    let sendCalls = 0;
    const d = deps({
      getCandidateById: async () => {
        getCandidateCalls += 1;
        return candidate(VALID_ID);
      },
      sendBacklinkOutreachEmail: async () => {
        sendCalls += 1;
        return sendResult("sent");
      },
    });
    const base = { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl() };

    // Missing field (undefined).
    await expectInvalidInput(() =>
      runBacklinkOutreachLiveAutoSend(d, { ...base, outreachId: undefined as unknown as string }),
    );
    // Explicit null.
    await expectInvalidInput(() =>
      runBacklinkOutreachLiveAutoSend(d, { ...base, outreachId: null as unknown as string }),
    );
    // Empty string.
    await expectInvalidInput(() => runBacklinkOutreachLiveAutoSend(d, { ...base, outreachId: "" }));
    // Whitespace only.
    await expectInvalidInput(() => runBacklinkOutreachLiveAutoSend(d, { ...base, outreachId: "   " }));
    // Wrong type.
    await expectInvalidInput(() =>
      runBacklinkOutreachLiveAutoSend(d, { ...base, outreachId: 12345 as unknown as string }),
    );
    // Malformed (not a UUID).
    await expectInvalidInput(() => runBacklinkOutreachLiveAutoSend(d, { ...base, outreachId: "BL-OUT-2026-019" }));

    assert(getCandidateCalls === 0, "An invalid outreachId must never reach getCandidateById.");
    assert(sendCalls === 0, "An invalid outreachId must never reach the provider.");
  }

  {
    // Direct call to the service with no outreachId key at all (simulating a future caller that
    // bypasses route-level validation entirely) must still be rejected, with no scan.
    let sendCalls = 0;
    const input = { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl() } as unknown as Parameters<typeof runBacklinkOutreachLiveAutoSend>[1];
    await expectInvalidInput(() =>
      runBacklinkOutreachLiveAutoSend(
        deps({ sendBacklinkOutreachEmail: async () => { sendCalls += 1; return sendResult("sent"); } }),
        input,
      ),
    );
    assert(sendCalls === 0, "A direct call without outreachId must never scan or send.");
  }

  {
    // Valid, well-formed UUID, but no matching candidate: must resolve to no_candidate, never
    // fall back to any other outreach.
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      deps({
        getCandidateById: async () => null,
        sendBacklinkOutreachEmail: async () => { sendCalls += 1; return sendResult("sent"); },
      }),
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl(), outreachId: VALID_ID },
    );
    assert(sendCalls === 0 && result.disposition === "no_candidate" && result.outreachId === null, "An unknown outreachId must never select another candidate.");
  }

  {
    // Candidate exists but is ineligible (attempts exhausted): no_candidate, no send.
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      deps({
        getCandidateById: async (_workspaceId, outreachId) =>
          outreachId === VALID_ID ? candidate(VALID_ID, { current_attempt: 3 }) : null,
        sendBacklinkOutreachEmail: async () => { sendCalls += 1; return sendResult("sent"); },
      }),
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl(), outreachId: VALID_ID },
    );
    assert(sendCalls === 0 && result.disposition === "no_candidate", "An ineligible explicit outreachId must not be sent.");
  }

  {
    // Valid, eligible, explicit outreachId: the targeted path must still work end-to-end.
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      deps({
        getCandidateById: async (_workspaceId, outreachId) =>
          outreachId === VALID_ID ? candidate(VALID_ID) : null,
        sendBacklinkOutreachEmail: async (input) => {
          sendCalls += 1;
          assert(input.outreachId === VALID_ID, "The provider must only ever be called for the explicit outreachId.");
          assert(
            input.idempotencyKey === `automation:backlinks:live-auto-send:workspace-1:${VALID_ID}:2026-08-20T08:00:00.000Z`,
            "Idempotency key must stay traceable and unique.",
          );
          return sendResult("sent", "attempt-sent");
        },
        now: () => "2026-08-20T08:00:00.000Z",
        createIdempotencyKey: ({ workspaceId, outreachId, selectedAt }) => `automation:backlinks:live-auto-send:${workspaceId}:${outreachId}:${selectedAt}`,
      }),
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl(), outreachId: VALID_ID },
    );
    assert(sendCalls === 1, "The explicit, eligible outreach must be sent exactly once.");
    assert(result.disposition === "sent" && result.outreachId === VALID_ID && result.attemptId === "attempt-sent", "A successful send must return the explicit outreach and attempt.");
  }

  {
    // A skippable provider refusal on the single explicit candidate must resolve to
    // no_candidate, not crash — and there is no "next candidate" to fall back to.
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      deps({
        getCandidateById: async () => candidate(VALID_ID),
        sendBacklinkOutreachEmail: async () => {
          sendCalls += 1;
          throw new BacklinkOutreachEmailSendError("OUTREACH_NOT_READY");
        },
      }),
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl(), outreachId: VALID_ID },
    );
    assert(sendCalls === 1 && result.disposition === "no_candidate", "A skippable refusal on the explicit candidate must not crash.");
  }

  {
    const result = await runBacklinkOutreachLiveAutoSend(
      deps({
        getCandidateById: async () => candidate(VALID_ID),
        sendBacklinkOutreachEmail: async () => sendResult("failed", "attempt-failed"),
      }),
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl(), outreachId: VALID_ID },
    );
    assert(result.disposition === "failed" && result.outreachId === VALID_ID, "A failed provider response must be reported, not retried.");
  }

  {
    const result = await runBacklinkOutreachLiveAutoSend(
      deps({
        getCandidateById: async () => candidate(VALID_ID),
        sendBacklinkOutreachEmail: async () => sendResult("unknown", "attempt-unknown"),
      }),
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl(), outreachId: VALID_ID },
    );
    assert(result.disposition === "unknown" && result.outreachId === VALID_ID, "An unknown provider response must be reported, not retried.");
  }

  for (const control of [
    enabledControl({ backlinksEnabled: false }),
    enabledControl({ backlinkOutreachScheduleApplyEnabled: false }),
    enabledControl({ dryRunOnly: true }),
    enabledControl({ disabledReason: "disabled" }),
  ]) {
    await expectReject(
      () =>
        runBacklinkOutreachLiveAutoSend(
          deps({ getCandidateById: async () => candidate(VALID_ID), sendBacklinkOutreachEmail: async () => sendResult("sent") }),
          { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: control, outreachId: VALID_ID },
        ),
      "LIVE_AUTO_SEND_NOT_ENABLED",
    );
  }

  // --- Concurrency: two calls targeting the same explicit outreachId must not double-send. ---
  {
    let reserved = false;
    let providerCalls = 0;
    const send = async (): Promise<BacklinkOutreachEmailSendResult> => {
      if (reserved) throw new BacklinkOutreachEmailSendError("OUTREACH_SEND_ATTEMPT_IN_PROGRESS");
      reserved = true;
      providerCalls += 1;
      return sendResult("sent", "attempt-concurrent");
    };
    const d = deps({ getCandidateById: async () => candidate(VALID_ID), sendBacklinkOutreachEmail: send });
    const input = { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl(), outreachId: VALID_ID };
    const [first, second] = await Promise.all([
      runBacklinkOutreachLiveAutoSend(d, input),
      runBacklinkOutreachLiveAutoSend(d, input),
    ]);
    assert(providerCalls === 1, "Only one of two concurrent calls on the same explicit outreachId may reach the provider.");
    assert(
      [first.disposition, second.disposition].includes("sent") && [first.disposition, second.disposition].includes("no_candidate"),
      "The losing concurrent call must be skipped, not silently redirected to another outreach.",
    );
  }

  console.log("PASS — Automation backlinks live auto-send service smoke");
}

void main();
