import {
  previewBacklinkOutreachSignalDetectionRun,
  type BacklinkOutreachSignalDetectionRunInput,
  type BacklinkOutreachSignalDetectionRunResult,
  type PreviewBacklinkOutreachSignalDetectionRunDependencies,
} from "../lib/automation/backlink-outreach-maintenance-runner";
import type { BacklinkRepositoryClient } from "../lib/backlinks/repositories/repositoryClient";
import type { CreateAutomationTaskInput, CreateAutomationTaskResult, AutomationRun } from "../lib/automation/types";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function task(row: CreateAutomationTaskInput, kind: "created" | "existing"): CreateAutomationTaskResult {
  return {
    kind,
    task: {
      id: row.taskKey.includes("follow-up") ? "00000000-0000-4000-8000-000000000300" : "00000000-0000-4000-8000-000000000301",
      workspaceId: row.workspaceId,
      runId: row.runId,
      dependsOnTaskId: row.dependsOnTaskId ?? null,
      system: row.system,
      taskKind: row.taskKind,
      taskKey: row.taskKey,
      status: "queued",
      priority: row.priority,
      scheduledAt: row.scheduledAt,
      availableAt: row.availableAt,
      claimedAt: null,
      startedAt: null,
      heartbeatAt: null,
      leaseExpiresAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      workerId: null,
      attemptCount: 0,
      maxAttempts: row.maxAttempts,
      backoffBaseSeconds: row.backoffBaseSeconds,
      input: row.input,
      output: null,
      errorCode: null,
      errorMessage: null,
      createdAt: row.scheduledAt,
      updatedAt: row.scheduledAt,
    },
  };
}

function automationRun(input: BacklinkOutreachSignalDetectionRunInput, operation: string): AutomationRun {
  return {
    id: "00000000-0000-4000-8000-000000000200",
    workspaceId: input.workspaceId,
    system: "backlinks",
    runKind: "backlinks.outreach.maintenance",
    idempotencyKey: input.idempotencyKey,
    status: "queued",
    mode: "dry_run",
    triggerSource: "internal",
    requestedBy: null,
    scheduledAt: "2026-08-13T08:00:00.000Z",
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    heartbeatAt: null,
    leaseExpiresAt: null,
    workerId: null,
    attemptCount: 0,
    maxAttempts: 1,
    input: { operation, limit: input.limit == null ? 100 : input.limit },
    summary: null,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-13T08:00:00.000Z",
    updatedAt: "2026-08-13T08:00:00.000Z",
  };
}

async function main(): Promise<void> {
  const rpcCalls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const createRunCalls: unknown[] = [];
  const completeRunCalls: unknown[] = [];
  const createdTasks: CreateAutomationTaskInput[] = [];
  const taskKinds = new Set<string>();

  let createTaskCallCount = 0;

  const client: PreviewBacklinkOutreachSignalDetectionRunDependencies["client"] = {
    rpc: (async (name: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === "list_backlink_outreach_due_follow_ups") {
        return {
          data: [
            {
              outreach_id: "00000000-0000-4000-8000-000000000010",
              next_follow_up_at: "2026-08-13T09:00:00.000Z",
              current_attempt: 1,
              max_attempts: 3,
              latest_attempt_id: "00000000-0000-4000-8000-000000000020",
              latest_attempt_status: "accepted",
            },
            {
              outreach_id: "00000000-0000-4000-8000-000000000011",
              next_follow_up_at: "2026-08-13T11:00:00.000Z",
              current_attempt: 2,
              max_attempts: 4,
              latest_attempt_id: "00000000-0000-4000-8000-000000000021",
              latest_attempt_status: "accepted",
            },
          ],
          error: null,
        };
      }
      if (name === "list_backlink_outreach_expired_response_deadlines") {
        return {
          data: [
            {
              outreach_id: "00000000-0000-4000-8000-000000000012",
              response_deadline_at: "2026-08-13T10:00:00.000Z",
              current_attempt: 3,
              max_attempts: 3,
              latest_attempt_id: "00000000-0000-4000-8000-000000000022",
              latest_attempt_status: "accepted",
            },
          ],
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${name}`);
    }) as never,
    from: ((() => {
      throw new Error("Unexpected from() call");
    }) as never),
  };

  const dependencies: PreviewBacklinkOutreachSignalDetectionRunDependencies = {
    client,
    now: () => "2026-08-13T08:00:00.000Z",
    createRun: async (input) => {
      createRunCalls.push(input);
      if (createRunCalls.length === 1) {
        return {
          kind: "created",
          run: automationRun({ workspaceId: input.workspaceId, idempotencyKey: input.idempotencyKey, limit: (input.input as { limit?: number }).limit }, String((input.input as { operation?: string }).operation ?? "signal_detection")),
        };
      }
      return {
        kind: "existing",
        run: automationRun({ workspaceId: input.workspaceId, idempotencyKey: input.idempotencyKey, limit: (input.input as { limit?: number }).limit }, String((input.input as { operation?: string }).operation ?? "signal_detection")),
      };
    },
    completeRun: async (input) => {
      completeRunCalls.push(input);
      return {
        kind: "transitioned",
        run: { id: input.runId },
      };
    },
    createTask: async (input) => {
      createdTasks.push(input);
      taskKinds.add(input.taskKind);
      createTaskCallCount += 1;
      return task(input, createTaskCallCount === 2 ? "existing" : "created");
    },
  };

  const preview = await previewBacklinkOutreachSignalDetectionRun(dependencies, {
    workspaceId: "00000000-0000-4000-8000-000000000001",
    idempotencyKey: "maintenance:2026-08-13:signals",
    limit: 100,
  });

  assert(preview.dueDetected === 2, "Runner must count due signals.");
  assert(preview.dueTaskCreated === 1, "Runner must count created due tasks.");
  assert(preview.dueTaskExisting === 1, "Runner must count existing due tasks.");
  assert(preview.expiredDetected === 1, "Runner must count expired signals.");
  assert(preview.expiredTaskCreated === 1, "Runner must count created expired tasks.");
  assert(preview.expiredTaskExisting === 0, "Runner must count existing expired tasks.");
  assert(preview.failed === 0, "Runner must not fail nominal signals.");
  assert(createRunCalls.length === 1, "Runner must create exactly one run.");
  assert(completeRunCalls.length === 1, "Runner must complete exactly one run.");
  assert(rpcCalls[0]?.args?.p_limit === 100, "Default limit must be 100.");
  assert(taskKinds.has("backlinks.outreach.follow_up_due") && taskKinds.has("backlinks.outreach.final_response_expired"), "Runner must create both signal task kinds.");
  assert(JSON.stringify(createdTasks[0]?.input) === JSON.stringify({
    outreachId: "00000000-0000-4000-8000-000000000010",
    nextFollowUpAt: "2026-08-13T09:00:00.000Z",
    currentAttempt: 1,
    maxAttempts: 3,
  }), "Follow-up due task payload must be canonical.");
  assert(JSON.stringify(createdTasks[2]?.input) === JSON.stringify({
    outreachId: "00000000-0000-4000-8000-000000000012",
    responseDeadlineAt: "2026-08-13T10:00:00.000Z",
    currentAttempt: 3,
    maxAttempts: 3,
  }), "Expired response task payload must be canonical.");
  assert(JSON.stringify(createRunCalls[0]) === JSON.stringify({
    workspaceId: "00000000-0000-4000-8000-000000000001",
    system: "backlinks",
    runKind: "backlinks.outreach.maintenance",
    idempotencyKey: "maintenance:2026-08-13:signals",
    mode: "dry_run",
    triggerSource: "internal",
    requestedBy: null,
    scheduledAt: "2026-08-13T08:00:00.000Z",
    input: { operation: "signal_detection", limit: 100 },
  }), "Run creation input must be canonical.");

  const limited = await previewBacklinkOutreachSignalDetectionRun(dependencies, {
    workspaceId: "00000000-0000-4000-8000-000000000001",
    idempotencyKey: "maintenance:2026-08-13:signals:limit",
    limit: 500,
  });
  assert(rpcCalls[2]?.args?.p_limit === 200, "Limit must clamp to 200.");
  assert(limited.dueDetected === 2 && limited.expiredDetected === 1, "Runner must remain deterministic with a larger limit.");

  console.log("PASS — Automation outreach signal detection runner smoke");
}

void main();
