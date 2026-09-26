import assert from "node:assert/strict";

import {
  BacklinkOutreachLiveFollowUpError,
  canRunBacklinkOutreachLiveFollowUp,
  runBacklinkOutreachLiveFollowUp,
} from "../lib/automation/backlink-outreach-live-follow-up-service";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_USER_ID = "22222222-2222-4222-8222-222222222222";
const OUTREACH_ID = "33333333-3333-4333-8333-333333333333";
const ATTEMPT_ID = "44444444-4444-4444-8444-444444444444";

function enabledControl() {
  return {
    backlinksEnabled: true,
    backlinkOutreachScheduleApplyEnabled: true,
    dryRunOnly: false,
    disabledReason: null,
  };
}

async function main() {
  assert.equal(
    canRunBacklinkOutreachLiveFollowUp(enabledControl()),
    true,
  );

  assert.equal(
    canRunBacklinkOutreachLiveFollowUp({
      ...enabledControl(),
      dryRunOnly: true,
    }),
    false,
  );

  assert.equal(
    canRunBacklinkOutreachLiveFollowUp({
      ...enabledControl(),
      backlinksEnabled: false,
    }),
    false,
  );

  assert.equal(
    canRunBacklinkOutreachLiveFollowUp({
      ...enabledControl(),
      backlinkOutreachScheduleApplyEnabled: false,
    }),
    false,
  );

  assert.equal(
    canRunBacklinkOutreachLiveFollowUp({
      ...enabledControl(),
      disabledReason: "disabled",
    }),
    false,
  );

  {
    let prepared = false;
    let sent = false;

    const result = await runBacklinkOutreachLiveFollowUp(
      {
        resolveActorUserId: async () => ACTOR_USER_ID,
        evaluateEligibility: async () => ({
          eligible: false,
          reason: "INBOUND_REPLY_STOPPED",
          currentAttempt: 1,
          maxAttempts: 3,
          nextFollowUpAt: "2026-09-26T10:00:00.000Z",
        }),
        prepareFollowUp: async () => {
          prepared = true;
          throw new Error("must not prepare");
        },
        sendFollowUpEmail: async () => {
          sent = true;
          throw new Error("must not send");
        },
      },
      {
        workspaceId: WORKSPACE_ID,
        outreachId: OUTREACH_ID,
        workspaceControl: enabledControl(),
      },
    );

    assert.equal(result.disposition, "ineligible");
    assert.equal(result.eligibilityReason, "INBOUND_REPLY_STOPPED");
    assert.equal(result.attemptId, null);
    assert.equal(prepared, false);
    assert.equal(sent, false);
  }

  {
    let capturedPrepareActor: string | null = null;
    let capturedSendActor: string | null = null;
    let capturedConfirm: boolean | null = null;

    const result = await runBacklinkOutreachLiveFollowUp(
      {
        resolveActorUserId: async () => ACTOR_USER_ID,
        evaluateEligibility: async () => ({
          eligible: true,
          reason: null,
          currentAttempt: 1,
          maxAttempts: 3,
          nextFollowUpAt: "2026-09-26T10:00:00.000Z",
        }),

        prepareFollowUp: async (input) => {
          capturedPrepareActor = input.actorUserId;

          assert.equal(input.workspaceId, WORKSPACE_ID);
          assert.equal(input.outreachId, OUTREACH_ID);
          assert.equal(input.idempotencyKey, "test-follow-up-key");

          return {
            disposition: "prepared",
            outreachId: OUTREACH_ID,
            attemptId: ATTEMPT_ID,
            draftDisposition: "created",
          };
        },

        sendFollowUpEmail: async (input) => {
          capturedSendActor = input.actorUserId;
          capturedConfirm = input.confirm;

          assert.equal(input.workspaceId, WORKSPACE_ID);
          assert.equal(input.outreachId, OUTREACH_ID);
          assert.equal(input.attemptId, ATTEMPT_ID);

          return {
            disposition: "accepted",
            outreachId: OUTREACH_ID,
            attemptId: ATTEMPT_ID,
            providerMessageId: "provider-message-id",
            errorCode: null,
          };
        },

        now: () => "2026-09-26T20:00:00.000Z",

        createIdempotencyKey: () => "test-follow-up-key",
      },
      {
        workspaceId: WORKSPACE_ID,
        outreachId: OUTREACH_ID,
        workspaceControl: enabledControl(),
      },
    );

    assert.equal(result.disposition, "accepted");
    assert.equal(result.outreachId, OUTREACH_ID);
    assert.equal(result.attemptId, ATTEMPT_ID);
    assert.equal(result.eligibilityReason, null);
    assert.equal(capturedPrepareActor, ACTOR_USER_ID);
    assert.equal(capturedSendActor, ACTOR_USER_ID);
    assert.equal(capturedConfirm, true);
  }

  {
    await assert.rejects(
      () =>
        runBacklinkOutreachLiveFollowUp(
          {
            resolveActorUserId: async () => ACTOR_USER_ID,
            evaluateEligibility: async () => {
              throw new Error("must not evaluate");
            },
            prepareFollowUp: async () => {
              throw new Error("must not prepare");
            },
            sendFollowUpEmail: async () => {
              throw new Error("must not send");
            },
          },
          {
            workspaceId: WORKSPACE_ID,
            outreachId: OUTREACH_ID,
            workspaceControl: {
              ...enabledControl(),
              dryRunOnly: true,
            },
          },
        ),
      (error: unknown) =>
        error instanceof BacklinkOutreachLiveFollowUpError &&
        error.code === "LIVE_FOLLOW_UP_NOT_ENABLED",
    );
  }

  {
    let eligibilityCalled = false;
    let prepared = false;
    let sent = false;

    await assert.rejects(
      () =>
        runBacklinkOutreachLiveFollowUp(
          {
            resolveActorUserId: async () => null,
            evaluateEligibility: async () => {
              eligibilityCalled = true;
              throw new Error("must not evaluate");
            },
            prepareFollowUp: async () => {
              prepared = true;
              throw new Error("must not prepare");
            },
            sendFollowUpEmail: async () => {
              sent = true;
              throw new Error("must not send");
            },
          },
          {
            workspaceId: WORKSPACE_ID,
            outreachId: OUTREACH_ID,
            workspaceControl: enabledControl(),
          },
        ),
      (error: unknown) =>
        error instanceof BacklinkOutreachLiveFollowUpError &&
        error.code === "LIVE_FOLLOW_UP_INVALID_INPUT",
    );

    assert.equal(eligibilityCalled, false);
    assert.equal(prepared, false);
    assert.equal(sent, false);
  }

  console.log(
    "PASS — automation backlinks live follow-up service smoke",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
