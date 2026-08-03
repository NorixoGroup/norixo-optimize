import {
  runBacklinksAutomationSchedulerTick,
  type AutomationRun,
  type AutomationTask,
  type BacklinkDiscoveryPreviewOutputV1,
  type BacklinkQualificationPreviewOutputV1,
  type RunBacklinksAutomationSchedulerTickDependencies,
  type RunBacklinksAutomationSchedulerTickInput,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
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
  taskKind: "noop",
  taskKey: "x",
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

const prepared = {
  kind: "prepared" as const,
  run,
  runDisposition: "created" as const,
  tasks: [
    { disposition: "created" as const, task },
    { disposition: "created" as const, task },
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
    qualificationPreview,
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
      completed.execution === execution &&
      completed.execution.discoveryPreview === discoveryPreview &&
      completed.execution.qualificationPreview === qualificationPreview &&
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
    rejected.kind === "rejected" && !("execution" in rejected),
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
        qualificationPreview,
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
      pending.execution.discoveryPreview === discoveryPreview &&
      pending.execution.qualificationPreview === qualificationPreview &&
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
        qualificationPreview,
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
    failed.kind === "failed" && failed.execution.discoveryPreview === discoveryPreview && failed.execution.qualificationPreview === qualificationPreview && failed.execution.lastIssue?.code === "BACKLINK_QUALIFICATION_DEPENDENCY_NOT_FOUND",
    "failed preserves previews",
  );

  console.log("PASS — Automation Backlinks scheduler tick smoke");
}

void main();
