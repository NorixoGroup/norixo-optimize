import {
  executeBacklinksDryRunOrchestrator,
  type AutomationRun,
  type AutomationTask,
  type BacklinkDiscoveryPreviewOutputV1,
  type BacklinkQualificationPreviewOutputV1,
  type BacklinkPromotionPreviewOutputV1,
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
  dependsOnTaskId: null,
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

const qualificationTask: AutomationTask = {
  ...task,
  id: "00000000-0000-4000-8000-000000000004",
  taskKind: "backlinks.qualification.preview",
  taskKey: "qualification-preview",
  dependsOnTaskId: discoveryTask.id,
};

const qualificationPreview: BacklinkQualificationPreviewOutputV1 = {
  version: 1,
  kind: "backlinks.qualification.preview",
  dryRun: true,
  policyVersion: "backlink-qualification-v1",
  summary: { candidatesEvaluated: 1, qualified: 1, review: 0, rejected: 0 },
  results: [],
};

const promotionTask: AutomationTask = {
  ...task,
  id: "00000000-0000-4000-8000-000000000005",
  taskKind: "backlinks.promotion.preview",
  taskKey: "promotion-preview",
  dependsOnTaskId: qualificationTask.id,
};
const promotionPreview: BacklinkPromotionPreviewOutputV1 = {
  version: 1,
  kind: "backlinks.promotion.preview",
  dryRun: true,
  policyVersion: "backlink-promotion-v1",
  summary: { qualificationResults: 1, eligible: 1, proposed: 1, skipped: 0, duplicates: 0 },
  proposals: [{ proposalKey: "promotion:candidate-one", candidateKey: "candidate-one", hostname: "example.com", targetPageUrl: "https://example.com/resources", targetPageTitle: "Resources", opportunityType: "Resource Page", pageType: "Resource Page", priority: "Tier A", qualificationScore: 85, qualificationConfidence: "medium", evidenceSummary: "Relevant resources", suggestedAssetKey: null, promotionDecision: "propose" }],
  skippedItems: [],
};

const retriedTask: AutomationTask = {
  ...task,
  taskKind: "backlinks.discovery.preview",
  errorCode: "PROVIDER_TRANSIENT_ERROR",
  errorMessage: "Provider temporarily unavailable",
};
const deadLetterTask: AutomationTask = {
  ...task,
  taskKind: "backlinks.qualification.preview",
  errorCode: "BACKLINK_QUALIFICATION_DEPENDENCY_NOT_FOUND",
  errorMessage: "Qualification dependency was not found",
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
    { kind: "completed", task: qualificationTask, output: qualificationPreview },
    { kind: "completed", task: promotionTask, output: promotionPreview },
    { kind: "empty" },
  ]);
  completedDependencies.completeRun = async (completeInput) => {
    completeCalls += 1;
    assert(
      JSON.stringify(completeInput.summary) ===
        JSON.stringify({
          workerInvocations: 4,
          completedTasks: 3,
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
    { ...input, maxWorkerInvocations: 4 },
  );
  assert(
    completed.kind === "completed" &&
      completeCalls === 1 &&
      failCalls === 0 &&
      completed.discoveryPreview === discoveryPreview &&
      completed.qualificationPreview === qualificationPreview &&
      completed.qualificationPreviewTaskId === qualificationTask.id &&
      completed.promotionPreview === promotionPreview &&
      completed.lastIssue === null,
    "completed previews",
  );
  assert(JSON.stringify(discoveryPreview) === previewBefore, "preview immutable");

  const pending = await executeBacklinksDryRunOrchestrator(
    dependencies([
      { kind: "completed", task: discoveryTask, output: discoveryPreview },
      { kind: "completed", task: qualificationTask, output: qualificationPreview },
    { kind: "completed", task: promotionTask, output: promotionPreview },
      { kind: "retried", task: retriedTask },
    ]),
    { ...input, maxWorkerInvocations: 4 },
  );
  assert(
      pending.kind === "pending_retry" &&
      pending.discoveryPreview === discoveryPreview &&
      pending.qualificationPreview === qualificationPreview &&
      pending.qualificationPreviewTaskId === qualificationTask.id &&
      pending.promotionPreview === promotionPreview,
    "pending retains previews",
  );
  assert(
    pending.lastIssue?.taskKind === "backlinks.discovery.preview" &&
      pending.lastIssue.code === "PROVIDER_TRANSIENT_ERROR" &&
      pending.lastIssue.message === "Provider temporarily unavailable",
    "pending retains issue",
  );

  const failed = await executeBacklinksDryRunOrchestrator(
    dependencies([
      { kind: "completed", task: discoveryTask, output: discoveryPreview },
      { kind: "completed", task: qualificationTask, output: qualificationPreview },
      { kind: "completed", task: promotionTask, output: promotionPreview },
      { kind: "dead_letter", task: deadLetterTask },
    ]),
    { ...input, maxWorkerInvocations: 4 },
  );
  assert(
    failed.kind === "failed" && failed.discoveryPreview === discoveryPreview && failed.qualificationPreview === qualificationPreview && failed.qualificationPreviewTaskId === qualificationTask.id && failed.promotionPreview === promotionPreview && failed.lastIssue?.code === "BACKLINK_QUALIFICATION_DEPENDENCY_NOT_FOUND",
    "failed retains previews",
  );

  const noDiscovery = await executeBacklinksDryRunOrchestrator(
    dependencies([{ kind: "completed", task, output: {} }, { kind: "empty" }]),
    { ...input, maxWorkerInvocations: 4 },
  );
  assert(
    noDiscovery.kind === "completed" && noDiscovery.discoveryPreview === null && noDiscovery.qualificationPreview === null && noDiscovery.qualificationPreviewTaskId === null && noDiscovery.promotionPreview === null,
    "no preview has null previews",
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

  const invalidQualificationOutputs = [
    { ...qualificationPreview, version: 2 },
    { ...qualificationPreview, kind: "invalid" },
    { ...qualificationPreview, dryRun: false },
    { ...qualificationPreview, policyVersion: "invalid" },
    { ...qualificationPreview, summary: null },
    { ...qualificationPreview, results: null },
  ];
  for (const output of invalidQualificationOutputs) {
    const invalidQualification = await executeBacklinksDryRunOrchestrator(
      dependencies([
        { kind: "completed", task: qualificationTask, output },
        { kind: "empty" },
      ]),
      input,
    );
    assert(
      invalidQualification.kind === "completed" && invalidQualification.qualificationPreview === null && invalidQualification.qualificationPreviewTaskId === null,
      "invalid qualification output is ignored",
    );
  }

  for (const output of [
    { ...promotionPreview, version: 2 },
    { ...promotionPreview, kind: "invalid" },
    { ...promotionPreview, dryRun: false },
    { ...promotionPreview, policyVersion: "invalid" },
    { ...promotionPreview, summary: null },
    { ...promotionPreview, proposals: null },
    { ...promotionPreview, skippedItems: null },
  ]) {
    const invalidPromotion = await executeBacklinksDryRunOrchestrator(
      dependencies([{ kind: "completed", task: promotionTask, output }, { kind: "empty" }]),
      input,
    );
    assert(
      invalidPromotion.kind === "completed" && invalidPromotion.promotionPreview === null,
      "invalid promotion output is ignored",
    );
  }

  const fallback = await executeBacklinksDryRunOrchestrator(
    dependencies([
      { kind: "retried", task: { ...task, errorCode: "  ", errorMessage: null } },
      { kind: "empty" },
    ]),
    input,
  );
  assert(
    fallback.kind === "pending_retry" &&
      fallback.lastIssue?.code === "AUTOMATION_TASK_EXECUTION_FAILED" &&
      fallback.lastIssue.message === "La tâche Automation n’a pas pu être exécutée.",
    "issue fallbacks",
  );

  const longIssue = await executeBacklinksDryRunOrchestrator(
    dependencies([
      {
        kind: "dead_letter",
        task: {
          ...task,
          taskKind: "x".repeat(101),
          errorCode: "c".repeat(101),
          errorMessage: "m".repeat(301),
        },
      },
      { kind: "empty" },
    ]),
    input,
  );
  assert(
    longIssue.kind === "failed" &&
      longIssue.lastIssue?.taskKind.length === 100 &&
      longIssue.lastIssue.code.length === 100 &&
      longIssue.lastIssue.message.length === 300,
    "issue values must be bounded",
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
