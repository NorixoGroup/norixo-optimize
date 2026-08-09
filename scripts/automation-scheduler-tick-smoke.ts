import {
  runBacklinksAutomationSchedulerTick,
  type AutomationRun,
  type AutomationTask,
  type BacklinkDiscoveryPreviewOutputV1,
  type BacklinkQualificationPreviewOutputV1,
  type BacklinkPromotionPreviewOutputV1,
  type RunBacklinksAutomationSchedulerTickDependencies,
  type RunBacklinksAutomationSchedulerTickInput,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejects(
  action: () => Promise<unknown>,
  expectedMessage: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error instanceof Error, "Expected an Error");
    assert(error.message === expectedMessage, "Unexpected error message");
    return;
  }

  throw new Error("Expected promise to reject");
}

const input: RunBacklinksAutomationSchedulerTickInput = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  requestedBy: null,
  workerId: "worker-A",
  idempotencyKey: "tick:1",
  triggerSource: "manual",
  scheduledAt: "2026-08-05T10:00:00.000Z",
  startedAt: "2026-08-05T10:00:00.000Z",
  attemptedAt: "2026-08-05T10:00:00.000Z",
  completedAt: "2026-08-05T10:00:00.000Z",
  failedAt: "2026-08-05T10:00:00.000Z",
  leaseDurationSeconds: 30,
  maxWorkerInvocations: 2,
  discoveryInput: { sources: [] },
  qualificationInput: { candidates: [] },
  promotionInput: { source: "automation_qualification", requestedScope: "preview" },
};

const run: AutomationRun = {
  id: "00000000-0000-4000-8000-000000000002",
  workspaceId: input.workspaceId,
  system: "backlinks",
  runKind: "x",
  idempotencyKey: "x",
  status: "queued",
  mode: "dry_run",
  triggerSource: "manual",
  requestedBy: null,
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
  input: {},
  summary: null,
  errorCode: null,
  errorMessage: null,
  createdAt: input.scheduledAt,
  updatedAt: input.scheduledAt,
};

const task: AutomationTask = {
  id: "00000000-0000-4000-8000-000000000003",
  workspaceId: input.workspaceId,
  runId: run.id,
  dependsOnTaskId: null,
  system: "backlinks",
  taskKind: "backlinks.discovery.preview",
  taskKey: "discovery-preview",
  status: "queued",
  priority: 1,
  scheduledAt: input.scheduledAt,
  availableAt: input.scheduledAt,
  claimedAt: null,
  startedAt: null,
  heartbeatAt: null,
  leaseExpiresAt: null,
  completedAt: null,
  failedAt: null,
  cancelledAt: null,
  workerId: null,
  attemptCount: 0,
  maxAttempts: 3,
  backoffBaseSeconds: 60,
  input: {},
  output: null,
  errorCode: null,
  errorMessage: null,
  createdAt: input.scheduledAt,
  updatedAt: input.scheduledAt,
};

const qualificationTask: AutomationTask = {
  ...task,
  id: "00000000-0000-4000-8000-000000000004",
  dependsOnTaskId: task.id,
  taskKind: "backlinks.qualification.preview",
  taskKey: "qualification-preview",
};

const promotionTask: AutomationTask = {
  ...task,
  id: "00000000-0000-4000-8000-000000000005",
  dependsOnTaskId: qualificationTask.id,
  taskKind: "backlinks.promotion.preview",
  taskKey: "promotion-preview",
};

const discoveryPreview: BacklinkDiscoveryPreviewOutputV1 = {
  version: 1,
  kind: "backlinks.discovery.preview",
  dryRun: true,
  provider: "mock",
  summary: {
    searchesRequested: 1,
    resultsReceived: 1,
    candidatesAccepted: 1,
    candidatesRejected: 0,
    truncated: false,
  },
  candidates: [],
  rejections: [],
};

const qualificationPreview: BacklinkQualificationPreviewOutputV1 = {
  version: 1,
  kind: "backlinks.qualification.preview",
  dryRun: true,
  policyVersion: "backlink-qualification-v1",
  summary: { candidatesEvaluated: 0, qualified: 0, review: 0, rejected: 0 },
  results: [],
};
const promotionPreview: BacklinkPromotionPreviewOutputV1 = {
  version: 1,
  kind: "backlinks.promotion.preview",
  dryRun: true,
  policyVersion: "backlink-promotion-v1",
  summary: { qualificationResults: 0, eligible: 0, proposed: 0, skipped: 0, duplicates: 0 },
  proposals: [],
  skippedItems: [],
};

const prepared = {
  kind: "prepared" as const,
  run,
  runDisposition: "created" as const,
  tasks: [
    { disposition: "created" as const, task },
    { disposition: "created" as const, task: qualificationTask },
    { disposition: "created" as const, task: promotionTask },
  ] as const,
};

async function main(): Promise<void> {
  let executeCalls = 0;
  let preparationInput: unknown;
  let executionInput: unknown;
  const execution = {
    kind: "completed" as const,
    workerInvocations: 1,
    completedTasks: 1,
    retriedTasks: 0,
    deadLetterTasks: 0,
    stoppedBecause: "empty" as const,
    discoveryPreview,
    discoveryPreviewTaskId: task.id,
    qualificationPreview,
    qualificationPreviewTaskId: qualificationTask.id,
    promotionPreview,
    lastIssue: null,
  };
  const dependencies: RunBacklinksAutomationSchedulerTickDependencies = {
    prepareBacklinksDryRun: async (preparation) => {
      preparationInput = preparation;
      return prepared;
    },
    executeBacklinksDryRun: async (executionRequest) => {
      executeCalls += 1;
      executionInput = executionRequest;
      return execution;
    },
  };

  const completed = await runBacklinksAutomationSchedulerTick(dependencies, input);
  assert(
      completed.kind === "completed" &&
      completed.run === run &&
      completed.promotionTaskId === promotionTask.id &&
      completed.promotionTaskId !== run.id &&
      completed.promotionTaskId !== task.id &&
      completed.promotionTaskId !== qualificationTask.id &&
      completed.execution === execution &&
      completed.execution.discoveryPreview === discoveryPreview &&
      completed.execution.discoveryPreviewTaskId === task.id &&
      completed.execution.qualificationPreview === qualificationPreview &&
      completed.execution.qualificationPreviewTaskId === qualificationTask.id &&
      completed.execution.promotionPreview === promotionPreview &&
      completed.execution.lastIssue === null,
    "completed preview references",
  );
  assert(
    executeCalls === 1 &&
      JSON.stringify(Object.keys(preparationInput as object).sort()) ===
        JSON.stringify(
          [
            "discoveryInput",
            "idempotencyKey",
            "qualificationInput",
            "promotionInput",
            "requestedBy",
            "scheduledAt",
            "triggerSource",
            "workspaceId",
          ].sort(),
        ),
    "prepare input",
  );
  assert(
    JSON.stringify(Object.keys(executionInput as object).sort()) ===
      JSON.stringify(
        [
          "attemptedAt",
          "completedAt",
          "failedAt",
          "leaseDurationSeconds",
          "maxWorkerInvocations",
          "runId",
          "startedAt",
          "workerId",
          "workspaceId",
        ].sort(),
      ),
    "execute input",
  );

  const rejected = await runBacklinksAutomationSchedulerTick(
    {
      ...dependencies,
      prepareBacklinksDryRun: async () => ({
        kind: "rejected",
        reason: "automation_disabled",
      }),
    },
    input,
  );
  assert(
    rejected.kind === "rejected" &&
      !("execution" in rejected) &&
      !("promotionTaskId" in rejected),
    "rejected has no execution preview",
  );

  const pending = await runBacklinksAutomationSchedulerTick(
    {
      ...dependencies,
      executeBacklinksDryRun: async () => ({
        kind: "pending_retry",
        workerInvocations: 1,
        completedTasks: 1,
        retriedTasks: 1,
        deadLetterTasks: 0,
        stoppedBecause: "empty",
        discoveryPreview,
        discoveryPreviewTaskId: task.id,
        qualificationPreview,
        qualificationPreviewTaskId: qualificationTask.id,
        promotionPreview,
        lastIssue: {
          taskKind: "backlinks.discovery.preview",
          code: "PROVIDER_TRANSIENT_ERROR",
          message: "Provider unavailable",
        },
      }),
    },
    input,
  );
  assert(
    pending.kind === "pending_retry" &&
      pending.promotionTaskId === promotionTask.id &&
      pending.execution.discoveryPreview === discoveryPreview &&
      pending.execution.discoveryPreviewTaskId === task.id &&
      pending.execution.qualificationPreview === qualificationPreview &&
      pending.execution.qualificationPreviewTaskId === qualificationTask.id &&
      pending.execution.promotionPreview === promotionPreview &&
      pending.execution.lastIssue?.code === "PROVIDER_TRANSIENT_ERROR",
    "pending preserves previews",
  );

  const failed = await runBacklinksAutomationSchedulerTick(
    {
      ...dependencies,
      executeBacklinksDryRun: async () => ({
        kind: "failed",
        workerInvocations: 1,
        completedTasks: 1,
        retriedTasks: 0,
        deadLetterTasks: 1,
        stoppedBecause: "empty",
        discoveryPreview,
        discoveryPreviewTaskId: task.id,
        qualificationPreview,
        qualificationPreviewTaskId: qualificationTask.id,
        promotionPreview,
        lastIssue: {
          taskKind: "backlinks.qualification.preview",
          code: "BACKLINK_QUALIFICATION_DEPENDENCY_NOT_FOUND",
          message: "Dependency missing",
        },
      }),
    },
    input,
  );
  assert(
    failed.kind === "failed" &&
      failed.promotionTaskId === promotionTask.id &&
      failed.execution.discoveryPreview === discoveryPreview &&
      failed.execution.discoveryPreviewTaskId === task.id &&
      failed.execution.qualificationPreview === qualificationPreview &&
      failed.execution.qualificationPreviewTaskId === qualificationTask.id &&
      failed.execution.promotionPreview === promotionPreview &&
      failed.execution.lastIssue?.code ===
        "BACKLINK_QUALIFICATION_DEPENDENCY_NOT_FOUND",
    "failed preserves previews",
  );

  const reordered = await runBacklinksAutomationSchedulerTick(
    {
      ...dependencies,
      prepareBacklinksDryRun: async () => ({
        ...prepared,
        tasks: [prepared.tasks[2], prepared.tasks[0], prepared.tasks[1]] as const,
      }),
    },
    input,
  );
  assert(
    reordered.kind === "completed" && reordered.promotionTaskId === promotionTask.id,
    "Scheduler must resolve promotion by task kind, not array index",
  );

  await assertRejects(
    () =>
      runBacklinksAutomationSchedulerTick(
        {
          ...dependencies,
          prepareBacklinksDryRun: async () => ({
            ...prepared,
            tasks: [
              prepared.tasks[0],
              prepared.tasks[1],
              { disposition: "created" as const, task: qualificationTask },
            ] as const,
          }),
        },
        input,
      ),
    "promotion task must be a valid prepared promotion task",
  );
  await assertRejects(
    () =>
      runBacklinksAutomationSchedulerTick(
        {
          ...dependencies,
          prepareBacklinksDryRun: async () => ({
            ...prepared,
            tasks: [
              prepared.tasks[0],
              prepared.tasks[1],
              {
                disposition: "created" as const,
                task: { ...promotionTask, id: "invalid" },
              },
            ] as const,
          }),
        },
        input,
      ),
    "promotion task must be a valid prepared promotion task",
  );

  console.log("PASS — Automation Backlinks scheduler tick smoke");
}

void main();
