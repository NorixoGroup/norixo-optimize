import type { BacklinkOutreachEmailSendResult } from "../lib/backlinks/services/outreachEmailSendService";
import { BacklinkOutreachEmailSendError } from "../lib/backlinks/services/outreachEmailSendService";
import type {
  BacklinkOutreachLiveAutoSendCandidateRow,
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

  {
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: async (_workspaceId, outreachId) =>
          outreachId === "550e8400-e29b-41d4-a716-4466554400bb"
            ? candidate("550e8400-e29b-41d4-a716-4466554400bb")
            : null,
        listCandidates: async () => {
          throw new Error("Explicit outreachId must not depend on generic candidate scan.");
        },
        sendBacklinkOutreachEmail: async (input) => {
          sendCalls += 1;
          assert(input.idempotencyKey === `automation:backlinks:live-auto-send:workspace-1:550e8400-e29b-41d4-a716-4466554400bb:2026-08-20T08:00:00.000Z`, "Idempotency key must stay traceable and unique.");
          return sendResult("sent", "attempt-sent");
        },
        now: () => "2026-08-20T08:00:00.000Z",
        createIdempotencyKey: ({ workspaceId, outreachId, selectedAt }) => `automation:backlinks:live-auto-send:${workspaceId}:${outreachId}:${selectedAt}`,
      },
      {
        workspaceId: "workspace-1",
        actorUserId: "actor-1",
        workspaceControl: enabledControl(),
        outreachId: "550e8400-e29b-41d4-a716-4466554400bb",
      },
    );
    assert(sendCalls === 1, "Exactly one eligible outreach must be sent per invocation.");
    assert(
      result.disposition === "sent" &&
      result.outreachId === "550e8400-e29b-41d4-a716-4466554400bb" &&
      result.attemptId === "attempt-sent",
      "Successful send must return the selected outreach and attempt.",
    );
  }

  {
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: async (_workspaceId, outreachId) =>
          outreachId === "550e8400-e29b-41d4-a716-4466554400cc"
            ? candidate("550e8400-e29b-41d4-a716-4466554400cc", { current_attempt: 3 })
            : null,
        listCandidates: async () => {
          throw new Error("Explicit outreachId must not depend on generic candidate scan.");
        },
        sendBacklinkOutreachEmail: async () => {
          sendCalls += 1;
          return sendResult("sent", "attempt-a");
        },
      },
      {
        workspaceId: "workspace-1",
        actorUserId: "actor-1",
        workspaceControl: enabledControl(),
        outreachId: "550e8400-e29b-41d4-a716-4466554400cc",
      },
    );
    assert(sendCalls === 0 && result.disposition === "no_candidate", "An ineligible explicit outreachId must not fall back to another candidate.");
  }

  {
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: async () => null,
        listCandidates: async () => [candidate("outreach-a"), candidate("outreach-b")],
        sendBacklinkOutreachEmail: async () => {
          sendCalls += 1;
          return sendResult("sent", "attempt-sent");
        },
      },
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl() },
    );
    assert(sendCalls === 1, "The worker must stop after the first successful send.");
    assert(result.outreachId === "outreach-a" && result.disposition === "sent", "The first eligible outreach should be selected deterministically.");
  }

  {
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: async () => null,
        listCandidates: async () => [candidate("draft-a", { status: "draft" })],
        sendBacklinkOutreachEmail: async () => {
          sendCalls += 1;
          return sendResult("sent");
        },
      },
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl() },
    );
    assert(sendCalls === 0 && result.disposition === "no_candidate", "Non-ready outreach must be excluded.");
  }

  for (const code of [
    "OUTREACH_NOT_SENDABLE",
    "OUTREACH_EMAIL_CHANNEL_UNSUPPORTED",
    "OUTREACH_EMAIL_CONTENT_INCOMPLETE",
    "OUTREACH_CONTACT_NOT_ELIGIBLE",
    "OUTREACH_MAX_ATTEMPTS_REACHED",
    "OUTREACH_ATTEMPT_IDEMPOTENCY_CONFLICT",
    "OUTREACH_SEND_ATTEMPT_IN_PROGRESS",
    "OUTREACH_SEND_ATTEMPT_UNRESOLVED",
  ] as const) {
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: async () => null,
        listCandidates: async () => [candidate(`skip-${code}`)],
        sendBacklinkOutreachEmail: async () => {
          sendCalls += 1;
          throw new BacklinkOutreachEmailSendError(code);
        },
      },
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl() },
    );
    assert(sendCalls === 1 && result.disposition === "no_candidate", `${code} must be treated as a skip condition.`);
  }

  {
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: async () => null,
        listCandidates: async () => [candidate("outreach-a"), candidate("outreach-b")],
        sendBacklinkOutreachEmail: async (input) => {
          sendCalls += 1;
          if (input.outreachId === "outreach-a") {
            throw new BacklinkOutreachEmailSendError("OUTREACH_SEND_ATTEMPT_IN_PROGRESS");
          }
          return sendResult("sent", "attempt-b");
        },
      },
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl() },
    );
    assert(sendCalls === 2 && result.disposition === "sent" && result.outreachId === "outreach-b", "The worker must continue after a skipped candidate.");
  }

  {
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: async () => null,
        listCandidates: async () => [candidate("outreach-a"), candidate("outreach-b")],
        sendBacklinkOutreachEmail: async () => {
          sendCalls += 1;
          return sendResult("failed", "attempt-failed");
        },
      },
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl() },
    );
    assert(sendCalls === 1 && result.disposition === "failed" && result.outreachId === "outreach-a", "A failed provider response must stop the run without retrying.");
  }

  {
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: async () => null,
        listCandidates: async () => [candidate("outreach-a")],
        sendBacklinkOutreachEmail: async () => {
          sendCalls += 1;
          return sendResult("unknown", "attempt-unknown");
        },
      },
      { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: enabledControl() },
    );
    assert(sendCalls === 1 && result.disposition === "unknown" && result.outreachId === "outreach-a", "An unknown provider response must stop the run without retrying.");
  }

  {
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: async (_workspaceId, outreachId) =>
          outreachId === "550e8400-e29b-41d4-a716-4466554400bb"
            ? candidate("550e8400-e29b-41d4-a716-4466554400bb", { current_attempt: 3 })
            : null,
        listCandidates: async () => {
          throw new Error("Explicit outreachId must not depend on generic candidate scan.");
        },
        sendBacklinkOutreachEmail: async () => {
          sendCalls += 1;
          return sendResult("sent", "attempt-a");
        },
      },
      {
        workspaceId: "workspace-1",
        actorUserId: "actor-1",
        workspaceControl: enabledControl(),
        outreachId: "550e8400-e29b-41d4-a716-4466554400bb",
      },
    );
    assert(sendCalls === 0 && result.disposition === "no_candidate", "An explicit outreachId must stay within the same guards.");
  }

  {
    let sendCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: async () => null,
        listCandidates: async () => [candidate("outreach-a")],
        sendBacklinkOutreachEmail: async () => {
          sendCalls += 1;
          return sendResult("sent", "attempt-a");
        },
      },
      {
        workspaceId: "workspace-1",
        actorUserId: "actor-1",
        workspaceControl: enabledControl(),
        outreachId: "00000000-0000-4000-8000-000000000099",
      },
    );
    assert(sendCalls === 0 && result.disposition === "no_candidate", "An explicit outreachId must not bypass selection guards.");
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
          {
            getCandidateById: async () => null,
            listCandidates: async () => [candidate("outreach-a")],
            sendBacklinkOutreachEmail: async () => sendResult("sent"),
          },
          { workspaceId: "workspace-1", actorUserId: "actor-1", workspaceControl: control },
        ),
      "LIVE_AUTO_SEND_NOT_ENABLED",
    );
  }

  console.log("PASS — Automation backlinks live auto-send service smoke");
}

void main();
