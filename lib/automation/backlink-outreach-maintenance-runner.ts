import { listBacklinkOutreachDueFollowUps } from "../backlinks/services/outreachFollowUpDueSelectorService";
import { listBacklinkOutreachExpiredResponseDeadlines } from "../backlinks/services/outreachExpiredResponseDeadlineSelectorService";
import {
  BACKLINK_OUTREACH_FINAL_RESPONSE_EXPIRED_TASK_KIND,
  BACKLINK_OUTREACH_FOLLOW_UP_DUE_TASK_KIND,
  BACKLINK_OUTREACH_MAINTENANCE_RUN_KIND,
  buildBacklinkOutreachFinalResponseExpiredTaskKey,
  buildBacklinkOutreachFollowUpDueTaskKey,
  validateBacklinkOutreachFinalResponseExpiredTaskInput,
  validateBacklinkOutreachFollowUpDueTaskInput,
} from "./backlink-outreach-maintenance";
import type { BacklinkRepositoryClient } from "../backlinks/repositories/repositoryClient";
import type {
  CompleteAutomationRunInput,
  CreateAutomationRunInput,
  CreateAutomationRunResult,
  CreateAutomationTaskInput,
  CreateAutomationTaskResult,
} from "./types";

export type BacklinkOutreachSignalDetectionRunInput = {
  workspaceId: string;
  idempotencyKey: string;
  limit?: number;
};

export type BacklinkOutreachSignalDetectionRunResult = {
  dueDetected: number;
  dueTaskCreated: number;
  dueTaskExisting: number;
  expiredDetected: number;
  expiredTaskCreated: number;
  expiredTaskExisting: number;
  failed: number;
};

export type PreviewBacklinkOutreachSignalDetectionRunDependencies = {
  client: Pick<BacklinkRepositoryClient, "rpc" | "from">;
  createRun: (input: CreateAutomationRunInput) => Promise<CreateAutomationRunResult>;
  completeRun: (input: CompleteAutomationRunInput) => Promise<{ kind: "transitioned"; run: { id: string } } | { kind: "rejected"; reason: "not_updated" }>;
  createTask: (input: CreateAutomationTaskInput) => Promise<CreateAutomationTaskResult>;
  now?: () => string;
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertUuid(value: string, field: string): void {
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), `${field} must be a valid UUID`);
}

function assertNonEmpty(value: string, field: string): void {
  assert(value.trim().length > 0, `${field} must not be empty`);
}

function assertPositiveInteger(value: number | undefined, field: string): void {
  assert(value == null || (Number.isInteger(value) && value >= 1), `${field} must be a positive integer`);
}

function normalizeLimit(limit: number | undefined): number {
  if (limit == null) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

function nowOrDefault(now?: () => string): string {
  const value = now?.() ?? new Date().toISOString();
  assert(Number.isFinite(Date.parse(value)), "now must be a valid date");
  return value;
}

async function createSignalTask(
  dependencies: Pick<PreviewBacklinkOutreachSignalDetectionRunDependencies, "createTask">,
  input: CreateAutomationTaskInput,
): Promise<CreateAutomationTaskResult> {
  return dependencies.createTask(input);
}

export async function previewBacklinkOutreachSignalDetectionRun(
  dependencies: PreviewBacklinkOutreachSignalDetectionRunDependencies,
  input: BacklinkOutreachSignalDetectionRunInput,
): Promise<BacklinkOutreachSignalDetectionRunResult> {
  assertUuid(input.workspaceId, "workspaceId");
  assertNonEmpty(input.idempotencyKey, "idempotencyKey");
  assert(input.idempotencyKey === input.idempotencyKey.trim(), "idempotencyKey must be trimmed");
  assertPositiveInteger(input.limit, "limit");

  const serverNow = nowOrDefault(dependencies.now);
  const limit = normalizeLimit(input.limit);

  const createdRun = await dependencies.createRun({
    workspaceId: input.workspaceId,
    system: "backlinks",
    runKind: BACKLINK_OUTREACH_MAINTENANCE_RUN_KIND,
    idempotencyKey: input.idempotencyKey,
    mode: "dry_run",
    triggerSource: "internal",
    requestedBy: null,
    scheduledAt: serverNow,
    input: { operation: "signal_detection", limit },
  });
  if (createdRun.kind === "rejected") {
    throw new Error("BACKLINK_OUTREACH_SIGNAL_DETECTION_RUN_REJECTED");
  }

  const dueResult = await listBacklinkOutreachDueFollowUps(dependencies.client, { now: () => serverNow })({
    workspaceId: input.workspaceId,
    now: serverNow,
    limit,
  });
  const expiredResult = await listBacklinkOutreachExpiredResponseDeadlines(dependencies.client, { now: () => serverNow })({
    workspaceId: input.workspaceId,
    now: serverNow,
    limit,
  });

  let dueTaskCreated = 0;
  let dueTaskExisting = 0;
  let expiredTaskCreated = 0;
  let expiredTaskExisting = 0;
  let failed = 0;

  for (const row of dueResult.items) {
    try {
      const taskInput = validateBacklinkOutreachFollowUpDueTaskInput({
        outreachId: row.outreachId,
        nextFollowUpAt: row.nextFollowUpAt,
        currentAttempt: row.currentAttempt,
        maxAttempts: row.maxAttempts,
      });
      const task = await createSignalTask(dependencies, {
        workspaceId: input.workspaceId,
        runId: createdRun.run.id,
        dependsOnTaskId: null,
        system: "backlinks",
        taskKind: BACKLINK_OUTREACH_FOLLOW_UP_DUE_TASK_KIND,
        taskKey: buildBacklinkOutreachFollowUpDueTaskKey(taskInput),
        priority: 100,
        scheduledAt: serverNow,
        availableAt: serverNow,
        maxAttempts: 1,
        backoffBaseSeconds: 60,
        input: taskInput,
      });
      if (task.kind === "created") dueTaskCreated += 1; else dueTaskExisting += 1;
    } catch {
      failed += 1;
    }
  }

  for (const row of expiredResult.items) {
    try {
      const taskInput = validateBacklinkOutreachFinalResponseExpiredTaskInput({
        outreachId: row.outreachId,
        responseDeadlineAt: row.responseDeadlineAt,
        currentAttempt: row.currentAttempt,
        maxAttempts: row.maxAttempts,
      });
      const task = await createSignalTask(dependencies, {
        workspaceId: input.workspaceId,
        runId: createdRun.run.id,
        dependsOnTaskId: null,
        system: "backlinks",
        taskKind: BACKLINK_OUTREACH_FINAL_RESPONSE_EXPIRED_TASK_KIND,
        taskKey: buildBacklinkOutreachFinalResponseExpiredTaskKey(taskInput),
        priority: 110,
        scheduledAt: serverNow,
        availableAt: serverNow,
        maxAttempts: 1,
        backoffBaseSeconds: 60,
        input: taskInput,
      });
      if (task.kind === "created") expiredTaskCreated += 1; else expiredTaskExisting += 1;
    } catch {
      failed += 1;
    }
  }

  const summary = {
    dueDetected: dueResult.items.length,
    dueTaskCreated,
    dueTaskExisting,
    expiredDetected: expiredResult.items.length,
    expiredTaskCreated,
    expiredTaskExisting,
    failed,
  };

  const completed = await dependencies.completeRun({
    workspaceId: input.workspaceId,
    runId: createdRun.run.id,
    completedAt: serverNow,
    summary,
  });
  if (completed.kind === "rejected") {
    throw new Error("BACKLINK_OUTREACH_SIGNAL_DETECTION_RUN_COMPLETION_REJECTED");
  }

  return summary;
}

export const previewBacklinkOutreachMaintenanceSignalRun = previewBacklinkOutreachSignalDetectionRun;
