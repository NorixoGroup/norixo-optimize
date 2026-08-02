import {
  executeBacklinksDryRunOrchestrator,
  type AutomationRun,
  type AutomationTask,
  type BacklinkDiscoveryPreviewOutputV1,
  type ExecuteAutomationWorkerOnceResult,
  type ExecuteBacklinksDryRunOrchestratorDependencies,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const input = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  workerId: "worker-A",
  startedAt: "2026-08-04T10:00:00.000Z",
  attemptedAt: "2026-08-04T10:00:00.000Z",
  completedAt: "2026-08-04T10:00:00.000Z",
  failedAt: "2026-08-04T10:00:00.000Z",
  leaseDurationSeconds: 30,
  maxWorkerInvocations: 3,
};

const run: AutomationRun = {
  id: input.runId,
  workspaceId: input.workspaceId,
  system: "backlinks",
  runKind: "x",
  idempotencyKey: "x",
  status: "running",
  mode: "dry_run",
  triggerSource: "manual",
  requestedBy: null,
  scheduledAt: input.startedAt,
  startedAt: input.startedAt,
  completedAt: null,
  failedAt: null,
  cancelledAt: null,
  heartbeatAt: null,
  leaseExpiresAt: null,
  workerId: null,
  attemptCount: 1,
  maxAttempts: 1,
  input: {},
  summary: null,
  errorCode: null,
  errorMessage: null,
  createdAt: input.startedAt,
  updatedAt: input.startedAt,
};

const task: AutomationTask = {
  id: "00000000-0000-4000-8000-000000000003",
  workspaceId: input.workspaceId,
  runId: input.runId,
  system: "backlinks",
  taskKind: "noop",
  taskKey: "x",
  status: "completed",
  priority: 1,
  scheduledAt: input.startedAt,
  availableAt: input.startedAt,
  claimedAt: null,
  startedAt: null,
  heartbeatAt: null,
  leaseExpiresAt: null,
  completedAt: input.completedAt,
  failedAt: null,
  cancelledAt: null,
  workerId: null,
  attemptCount: 1,
  maxAttempts: 3,
  backoffBaseSeconds: 60,
  input: {},
  output: null,
  errorCode: null,
  errorMessage: null,
  createdAt: input.startedAt,
  updatedAt: input.startedAt,
};

const discoveryTask: AutomationTask = {
  ...task,
  taskKind: "backlinks.discovery.preview",
  taskKey: "discovery-preview",
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

function dependencies(
  results: ExecuteAutomationWorkerOnceResult[],
): ExecuteBacklinksDryRunOrchestratorDependencies {
  let index = 0;
  return {
    startRun: async () => ({ kind: "transitioned", run }),
    executeWorkerOnce: async () => results[index++] ?? { kind: "empty" },
    completeRun: async () => ({ kind: "transitioned", run }),
    failRun: async () => ({ kind: "transitioned", run }),
  };
}

async function main(): Promise<void> {
  let completeCalls = 0;
  let failCalls = 0;
  const completedDependencies = dependencies([
    { kind: "completed", task: discoveryTask, output: discoveryPreview },
    { kind: "completed", task, output: {} },
    { kind: "empty" },
  ]);
  completedDependencies.completeRun = async (completeInput) => {
    completeCalls += 1;
    assert(
      JSON.stringify(completeInput.summary) ===
        JSON.stringify({
          workerInvocations: 3,
          completedTasks: 2,
          retriedTasks: 0,
          deadLetterTasks: 0,
          stoppedBecause: "empty",
        }),
      "summary must remain metrics only",
    );
    return { kind: "transitioned", run };
  };
  completedDependencies.failRun = async () => {
    failCalls += 1;
    return { kind: "transitioned", run };
  };

  const previewBefore = JSON.stringify(discoveryPreview);
  const completed = await executeBacklinksDryRunOrchestrator(
    completedDependencies,
    input,
  );
  assert(
    completed.kind === "completed" &&
      completeCalls === 1 &&
      failCalls === 0 &&
      completed.discoveryPreview === discoveryPreview,
    "completed discovery preview",
  );
  assert(JSON.stringify(discoveryPreview) === previewBefore, "preview immutable");

  const pending = await executeBacklinksDryRunOrchestrator(
    dependencies([
      { kind: "completed", task: discoveryTask, output: discoveryPreview },
      { kind: "retried", task },
      { kind: "empty" },
    ]),
    input,
  );
  assert(
    pending.kind === "pending_retry" &&
      pending.discoveryPreview === discoveryPreview,
    "pending retains preview",
  );

  const failed = await executeBacklinksDryRunOrchestrator(
    dependencies([
      { kind: "completed", task: discoveryTask, output: discoveryPreview },
      { kind: "dead_letter", task },
      { kind: "empty" },
    ]),
    input,
  );
  assert(
    failed.kind === "failed" && failed.discoveryPreview === discoveryPreview,
    "failed retains preview",
  );

  const noDiscovery = await executeBacklinksDryRunOrchestrator(
    dependencies([{ kind: "completed", task, output: {} }, { kind: "empty" }]),
    input,
  );
  assert(
    noDiscovery.kind === "completed" && noDiscovery.discoveryPreview === null,
    "no discovery has null preview",
  );

  const invalidDiscovery = await executeBacklinksDryRunOrchestrator(
    dependencies([
      {
        kind: "completed",
        task: discoveryTask,
        output: { version: 1, kind: "backlinks.discovery.preview", dryRun: true },
      },
      { kind: "empty" },
    ]),
    input,
  );
  assert(
    invalidDiscovery.kind === "completed" &&
      invalidDiscovery.discoveryPreview === null,
    "invalid discovery output is ignored",
  );

  const limit = await executeBacklinksDryRunOrchestrator(
    dependencies([
      { kind: "completed", task, output: {} },
      { kind: "completed", task, output: {} },
    ]),
    { ...input, maxWorkerInvocations: 2 },
  );
  assert(
    limit.kind === "completed" &&
      limit.stoppedBecause === "max_worker_invocations",
    "limit",
  );

  const rejectedDependencies = dependencies([]);
  rejectedDependencies.startRun = async () => ({
    kind: "rejected",
    reason: "not_updated",
  });
  let rejectedStart = false;
  try {
    await executeBacklinksDryRunOrchestrator(rejectedDependencies, input);
  } catch (error) {
    rejectedStart =
      error instanceof Error && error.message === "AUTOMATION_RUN_START_REJECTED";
  }
  assert(rejectedStart, "start reject");

  console.log("PASS — Automation Backlinks dry-run orchestrator smoke");
}

void main();
