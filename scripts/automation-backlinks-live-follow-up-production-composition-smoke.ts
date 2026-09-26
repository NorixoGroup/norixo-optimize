import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  BacklinkOutreachLiveFollowUpError,
  runBacklinkOutreachLiveFollowUp,
} from "../lib/automation/backlink-outreach-live-follow-up-service";
import {
  createBacklinkOutreachLiveFollowUpTaskHandler,
} from "../lib/automation/production-composition";
import type { ExecuteAutomationTaskHandlerInput } from "../lib/automation/handler-types";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const outreachId = "22222222-2222-4222-8222-222222222222";
const actorUserId = "33333333-3333-4333-8333-333333333333";

function taskInput(): ExecuteAutomationTaskHandlerInput {
  return {
    workspaceId,
    runId: "44444444-4444-4444-8444-444444444444",
    taskId: "55555555-5555-4555-8555-555555555555",
    taskKind: "backlinks.outreach.follow_up_due",
    input: {
      outreachId,
      nextFollowUpAt: "2026-09-26T10:00:00.000Z",
      currentAttempt: 1,
      maxAttempts: 3,
      created_by: "forbidden-created-by",
      approved_by: "forbidden-approved-by",
      requestedBy: "forbidden-requested-by",
    },
    attemptedAt: "2026-09-26T10:00:00.000Z",
  };
}

function enabledControl() {
  return {
    backlinksEnabled: true,
    backlinkOutreachScheduleApplyEnabled: true,
    dryRunOnly: false,
    disabledReason: null,
  };
}

async function main() {
  {
    let captured: Record<string, unknown> | null = null;
    const handler = createBacklinkOutreachLiveFollowUpTaskHandler({
      getWorkspaceControl: async () => enabledControl(),
      getLatestAttempt: async () => ({ actor_user_id: ` ${actorUserId} ` }),
      runLiveFollowUp: async (input) => {
        captured = input;
        return {
          disposition: "accepted",
          outreachId: input.outreachId,
          attemptId: "66666666-6666-4666-8666-666666666666",
          eligibilityReason: null,
        };
      },
    });
    const result = await handler(taskInput());
    assert.ok(captured != null);
    assert.equal((captured as Record<string, unknown>).outreachId, outreachId);
    assert.equal(result.output.disposition, "accepted");
    assert.equal(result.output.dryRun, false);
  }

  {
    let liveCalls = 0;
    const handler = createBacklinkOutreachLiveFollowUpTaskHandler({
      getWorkspaceControl: async () => enabledControl(),
      getLatestAttempt: async () => ({ actor_user_id: "   " }),
      runLiveFollowUp: async () => {
        liveCalls += 1;
        throw new Error("must not execute");
      },
    });
    const result = await handler(taskInput());
    assert.equal(result.output.disposition, "actor_missing");
    assert.equal(liveCalls, 0);
  }

  {
    let evaluated = 0;
    let prepared = 0;
    let sent = 0;
    const handler = createBacklinkOutreachLiveFollowUpTaskHandler({
      getWorkspaceControl: async () => ({ ...enabledControl(), dryRunOnly: true }),
      getLatestAttempt: async () => ({ actor_user_id: actorUserId }),
      runLiveFollowUp: (input) =>
        runBacklinkOutreachLiveFollowUp(
          {
            resolveActorUserId: async () => actorUserId,
            evaluateEligibility: async () => {
              evaluated += 1;
              return {
                eligible: true,
                reason: null,
                currentAttempt: 1,
                maxAttempts: 3,
                nextFollowUpAt: "2026-09-26T10:00:00.000Z",
              };
            },
            prepareFollowUp: async () => {
              prepared += 1;
              throw new Error("must not prepare");
            },
            sendFollowUpEmail: async () => {
              sent += 1;
              throw new Error("must not send");
            },
          },
          input,
        ),
    });
    const result = await handler(taskInput());
    assert.equal(result.output.disposition, "not_enabled");
    assert.equal(evaluated, 0);
    assert.equal(prepared, 0);
    assert.equal(sent, 0);
  }

  {
    const handler = createBacklinkOutreachLiveFollowUpTaskHandler({
      getWorkspaceControl: async () => enabledControl(),
      getLatestAttempt: async () => ({ actor_user_id: actorUserId }),
      runLiveFollowUp: async () => {
        throw new Error("must not execute");
      },
    });
    const result = await handler({ ...taskInput(), input: { outreachId: "not-a-uuid" } });
    assert.equal(result.output.disposition, "invalid_task_input");
  }

  const productionComposition = await readFile(
    "lib/automation/production-composition.ts",
    "utf8",
  );
  assert.match(
    productionComposition,
    /taskKind === "backlinks\.outreach\.follow_up_due"[\s\S]*return followUpTaskHandler\(handlerInput\)/,
  );
  assert.match(productionComposition, /return dryRunHandlers\.execute\(handlerInput\)/);
  assert.doesNotMatch(productionComposition, /created_by.*actorUserId|approved_by.*actorUserId|requestedBy.*actorUserId/);
  assert.ok(BacklinkOutreachLiveFollowUpError);

  console.log("PASS — automation backlinks live follow-up production composition smoke");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
