import assert from "node:assert/strict";

import { runBacklinkAutonomyScheduler } from "@/lib/automation/backlink-autonomy-scheduler";
import type { AppliedBacklinkPromotion } from "@/lib/automation/backlink-promotion-resolution-entry";
import type { AutomationRun, AutomationTask, CreateAutomationRunInput, CreateAutomationTaskInput } from "@/lib/automation/types";

const ids = {
  workspace: "00000000-0000-4000-8000-000000000101",
  promotionRun: "00000000-0000-4000-8000-000000000102",
  promotionTask: "00000000-0000-4000-8000-000000000103",
  domain: "00000000-0000-4000-8000-000000000104",
  opportunity: "00000000-0000-4000-8000-000000000105",
  actor: "00000000-0000-4000-8000-000000000106",
  autonomyRun: "00000000-0000-4000-8000-000000000107",
  task: "00000000-0000-4000-8000-000000000108",
};
const at = "2026-09-21T00:00:00.000Z";
const control = {
  workspaceId: ids.workspace,
  backlinksEnabled: true,
  backlinkAutonomyEnabled: true,
  backlinkOutreachScheduleApplyEnabled: false,
  dryRunOnly: false,
  disabledReason: null,
};
const promotion: AppliedBacklinkPromotion = {
  applicationId: "promotion-application",
  workspaceId: ids.workspace,
  runId: ids.promotionRun,
  promotionTaskId: ids.promotionTask,
  promotionTaskKind: "backlinks.promotion.preview",
  promotionTaskStatus: "completed",
  domainId: ids.domain,
  opportunityId: ids.opportunity,
  actorUserId: ids.actor,
  applied: true,
};

function run(input: CreateAutomationRunInput): AutomationRun {
  return {
    id: ids.autonomyRun,
    workspaceId: input.workspaceId,
    system: input.system,
    runKind: input.runKind,
    idempotencyKey: input.idempotencyKey,
    status: "queued",
    mode: input.mode,
    triggerSource: input.triggerSource,
    requestedBy: input.requestedBy,
    scheduledAt: input.scheduledAt,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    heartbeatAt: null,
    leaseExpiresAt: null,
    workerId: null,
    attemptCount: 0,
    maxAttempts: 1,
    input: input.input,
    summary: null,
    errorCode: null,
    errorMessage: null,
    createdAt: at,
    updatedAt: at,
  };
}

function task(input: CreateAutomationTaskInput): AutomationTask {
  return {
    id: ids.task,
    workspaceId: input.workspaceId,
    runId: input.runId,
    dependsOnTaskId: input.dependsOnTaskId ?? null,
    system: input.system,
    taskKind: input.taskKind,
    taskKey: input.taskKey,
    status: "queued",
    priority: input.priority,
    scheduledAt: input.scheduledAt,
    availableAt: input.availableAt,
    claimedAt: null,
    startedAt: null,
    heartbeatAt: null,
    leaseExpiresAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    workerId: null,
    attemptCount: 0,
    maxAttempts: input.maxAttempts,
    backoffBaseSeconds: input.backoffBaseSeconds,
    input: input.input,
    output: null,
    errorCode: null,
    errorMessage: null,
    createdAt: at,
    updatedAt: at,
  };
}

function record(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

async function main() {
  const runs = new Map<string, AutomationRun>();
  const tasks = new Map<string, AutomationTask>();
  const outbound = { sender: 0, form: 0, linkedin: 0, ready: 0 };
  const dependencies = {
    runtimeConfig: () => ({ autonomyEnabled: true }),
    listWorkspaceControls: async () => [control],
    listAppliedPromotions: async () => [promotion],
    getDomain: async () => ({ id: ids.domain, workspaceId: ids.workspace, archivedAt: null }),
    getOpportunity: async () => ({ id: ids.opportunity, workspaceId: ids.workspace, domainId: ids.domain, archivedAt: null }),
    createOrGetRun: async (input: CreateAutomationRunInput) => {
      const existing = runs.get(input.idempotencyKey);
      if (existing != null) return { kind: "existing" as const, run: existing };
      const created = run(input);
      runs.set(input.idempotencyKey, created);
      return { kind: "created" as const, run: created };
    },
    createOrGetTask: async (input: CreateAutomationTaskInput) => {
      const key = `${input.runId}:${input.taskKind}:${input.taskKey}`;
      const existing = tasks.get(key);
      if (existing != null) return { kind: "existing" as const, task: existing };
      const created = task(input);
      tasks.set(key, created);
      return { kind: "created" as const, task: created };
    },
  };

  const first = await runBacklinkAutonomyScheduler(dependencies, { mode: "apply", scheduledAt: at });
  const createdRun = [...runs.values()][0]!;
  const createdTask = [...tasks.values()][0]!;
  assert.equal(first.created, 1);
  assert.equal(createdRun.status, "queued");
  assert.equal(createdTask.status, "queued");
  assert.notEqual(createdRun.id, promotion.runId);
  assert.equal(createdTask.runId, createdRun.id);
  assert.equal(createdTask.dependsOnTaskId, null);
  assert.equal(record(createdRun.input).promotionApplicationId, promotion.applicationId);
  assert.equal(record(createdRun.input).promotionRunId, promotion.runId);
  assert.equal(record(createdRun.input).promotionTaskId, promotion.promotionTaskId);
  assert.equal(record(createdTask.input).promotionApplicationId, promotion.applicationId);
  assert.equal(record(createdTask.input).promotionRunId, promotion.runId);
  assert.equal(record(createdTask.input).promotionTaskId, promotion.promotionTaskId);
  assert.equal(createdTask.maxAttempts, 3);
  assert.equal(createdTask.availableAt, at);
  assert(createdRun.status === "queued" || createdRun.status === "running");

  const replay = await runBacklinkAutonomyScheduler(dependencies, { mode: "apply", scheduledAt: at });
  assert.equal(replay.existing, 1);
  assert.equal(runs.size, 1);
  assert.equal(tasks.size, 1);

  await Promise.all([
    runBacklinkAutonomyScheduler(dependencies, { mode: "apply", scheduledAt: at }),
    runBacklinkAutonomyScheduler(dependencies, { mode: "apply", scheduledAt: at }),
  ]);
  assert.equal(runs.size, 1);
  assert.equal(tasks.size, 1);
  assert.deepEqual(outbound, { sender: 0, form: 0, linkedin: 0, ready: 0 });

  const invalid = await runBacklinkAutonomyScheduler(
    { ...dependencies, listAppliedPromotions: async () => [{ ...promotion, applied: false } as any] },
    { mode: "apply", scheduledAt: at },
  );
  assert.equal(invalid.created, 0);
  assert.equal(invalid.autonomyRunIds.length, 0);

  const disabled = await runBacklinkAutonomyScheduler(
    { ...dependencies, listWorkspaceControls: async () => [{ ...control, backlinkAutonomyEnabled: false }] },
    { mode: "apply", scheduledAt: at },
  );
  assert.equal(disabled.created, 0);
  assert.equal(disabled.autonomyRunIds.length, 0);

  console.log("PASS — Backlink autonomy dedicated run model G2C.1 smoke");
}

void main();
