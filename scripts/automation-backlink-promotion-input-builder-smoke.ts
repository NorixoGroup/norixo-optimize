import {
  BacklinkPromotionDependencyError,
  buildBacklinkPromotionInputFromDependencies,
  type AutomationTask,
  type BacklinkDiscoveryPreviewOutputV1,
  type BacklinkQualificationPreviewOutputV1,
} from "../lib/automation";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";
const discoveryId = "00000000-0000-4000-8000-000000000003";
const qualificationId = "00000000-0000-4000-8000-000000000004";
const promotionId = "00000000-0000-4000-8000-000000000005";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function task(overrides: Partial<AutomationTask> = {}): AutomationTask {
  return {
    id: promotionId,
    workspaceId,
    runId,
    dependsOnTaskId: qualificationId,
    system: "backlinks",
    taskKind: "backlinks.promotion.preview",
    taskKey: "promotion-preview",
    status: "running",
    priority: 30,
    scheduledAt: "2026-08-03T10:00:00.000Z",
    availableAt: "2026-08-03T10:00:00.000Z",
    claimedAt: "2026-08-03T10:00:00.000Z",
    startedAt: "2026-08-03T10:00:00.000Z",
    heartbeatAt: "2026-08-03T10:00:00.000Z",
    leaseExpiresAt: "2026-08-03T10:02:00.000Z",
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    workerId: "smoke-worker",
    attemptCount: 1,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: {},
    output: null,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-03T10:00:00.000Z",
    updatedAt: "2026-08-03T10:00:00.000Z",
    ...overrides,
  };
}

const discoveryOutput: BacklinkDiscoveryPreviewOutputV1 = {
  version: 1,
  kind: "backlinks.discovery.preview",
  dryRun: true,
  provider: "mock",
  summary: { searchesRequested: 1, resultsReceived: 1, candidatesAccepted: 1, candidatesRejected: 0, truncated: false },
  candidates: [{ candidateKey: "candidate-one", hostname: "example.com", sourceUrl: "https://example.com/resources", pageTitle: "Host resources", snippet: "Hosts", queryIndex: 0, rank: 1, countryCode: "US", languageCode: "en", proposedOpportunityType: null, proposedPageType: null, suggestedAssetKey: "asset-guide", evidenceSummary: "Relevant host resources", discoveryScore: 90 }],
  rejections: [],
};

const qualificationOutput: BacklinkQualificationPreviewOutputV1 = {
  version: 1,
  kind: "backlinks.qualification.preview",
  dryRun: true,
  policyVersion: "backlink-qualification-v1",
  summary: { candidatesEvaluated: 1, qualified: 1, review: 0, rejected: 0 },
  results: [{ candidateKey: "candidate-one", decision: "qualified", qualificationScore: 85, confidence: "medium", reasons: [{ code: "TOPICAL_RELEVANCE_STRONG", impact: 35, evidence: "Host resources" }], flags: [], proposedOpportunityType: "Resource Page", proposedPageType: "resource_page" }],
};

const qualificationTask = task({
  id: qualificationId,
  dependsOnTaskId: discoveryId,
  taskKind: "backlinks.qualification.preview",
  taskKey: "qualification-preview",
  status: "completed",
  output: qualificationOutput,
});
const discoveryTask = task({
  id: discoveryId,
  dependsOnTaskId: null,
  taskKind: "backlinks.discovery.preview",
  taskKey: "discovery-preview",
  status: "completed",
  output: discoveryOutput,
});

async function assertDependencyError(
  run: () => Promise<unknown>,
  code: BacklinkPromotionDependencyError["code"],
): Promise<void> {
  try {
    await run();
  } catch (error) {
    assert(error instanceof BacklinkPromotionDependencyError && error.code === code, `Expected ${code}`);
    assert(!error.message.includes(workspaceId) && !error.message.includes("https://example.com"), "Dependency error must remain safe");
    return;
  }
  throw new Error(`Expected ${code}`);
}

async function main(): Promise<void> {
  const calls: Array<{ workspaceId: string; runId: string; taskId: string }> = [];
  const result = await buildBacklinkPromotionInputFromDependencies(
    { promotionTask: task() },
    {
      getTaskByIdInRun: async (lookup) => {
        calls.push(lookup);
        return lookup.taskId === qualificationId ? qualificationTask : discoveryTask;
      },
    },
  );
  assert(calls.length === 2 && calls[0]?.taskId === qualificationId && calls[1]?.taskId === discoveryId, "Dependencies must be read in order");
  assert(calls.every((call) => call.workspaceId === workspaceId && call.runId === runId), "Dependency scope must be exact");
  assert(result.qualificationTask === qualificationTask && result.discoveryTask === discoveryTask, "Task references must be retained");
  assert(result.promotionInput.candidates === discoveryOutput.candidates && result.promotionInput.qualificationResults === qualificationOutput.results, "Output arrays must be reused");
  assert(result.promotionInput.includeDecisions.join(",") === "qualified" && result.promotionInput.maxProposals === 1, "Promotion input defaults must be exact");

  const zeroQualification = task({ ...qualificationTask, output: { ...qualificationOutput, summary: { candidatesEvaluated: 0, qualified: 0, review: 0, rejected: 0 }, results: [] } });
  const zero = await buildBacklinkPromotionInputFromDependencies({ promotionTask: task() }, { getTaskByIdInRun: async (lookup) => lookup.taskId === qualificationId ? zeroQualification : discoveryTask });
  assert(zero.promotionInput.maxProposals === 1 && zero.promotionInput.qualificationResults.length === 0, "Zero qualification results must stay valid");

  for (const invalidTask of [task({ taskKind: "other" }), task({ status: "queued" }), task({ dependsOnTaskId: null }), task({ workspaceId: "invalid" })]) {
    let count = 0;
    await assertDependencyError(
      () => buildBacklinkPromotionInputFromDependencies({ promotionTask: invalidTask }, { getTaskByIdInRun: async () => { count += 1; return null; } }),
      "BACKLINK_PROMOTION_TASK_INVALID",
    );
    assert(count === 0, "Invalid promotion task must not read a dependency");
  }

  await assertDependencyError(
    () => buildBacklinkPromotionInputFromDependencies({ promotionTask: task() }, { getTaskByIdInRun: async () => null }),
    "BACKLINK_PROMOTION_QUALIFICATION_DEPENDENCY_NOT_FOUND",
  );
  await assertDependencyError(
    () => buildBacklinkPromotionInputFromDependencies({ promotionTask: task() }, { getTaskByIdInRun: async () => task({ id: qualificationId, workspaceId: "00000000-0000-4000-8000-000000000099" }) }),
    "BACKLINK_PROMOTION_QUALIFICATION_SCOPE_MISMATCH",
  );
  await assertDependencyError(
    () => buildBacklinkPromotionInputFromDependencies({ promotionTask: task() }, { getTaskByIdInRun: async () => task({ id: qualificationId, taskKind: "other" }) }),
    "BACKLINK_PROMOTION_QUALIFICATION_KIND_INVALID",
  );
  await assertDependencyError(
    () => buildBacklinkPromotionInputFromDependencies({ promotionTask: task() }, { getTaskByIdInRun: async () => task({ id: qualificationId, taskKind: "backlinks.qualification.preview", status: "failed" }) }),
    "BACKLINK_PROMOTION_QUALIFICATION_NOT_COMPLETED",
  );
  await assertDependencyError(
    () => buildBacklinkPromotionInputFromDependencies({ promotionTask: task() }, { getTaskByIdInRun: async () => task({ id: qualificationId, taskKind: "backlinks.qualification.preview", status: "completed", output: {} }) }),
    "BACKLINK_PROMOTION_QUALIFICATION_OUTPUT_INVALID",
  );
  await assertDependencyError(
    () => buildBacklinkPromotionInputFromDependencies({ promotionTask: task() }, { getTaskByIdInRun: async (lookup) => lookup.taskId === qualificationId ? qualificationTask : null }),
    "BACKLINK_PROMOTION_DISCOVERY_DEPENDENCY_NOT_FOUND",
  );

  const orphanQualification = task({ ...qualificationTask, output: { ...qualificationOutput, results: [{ ...qualificationOutput.results[0], candidateKey: "orphan" }] } });
  try {
    await buildBacklinkPromotionInputFromDependencies({ promotionTask: task() }, { getTaskByIdInRun: async (lookup) => lookup.taskId === qualificationId ? orphanQualification : discoveryTask });
  } catch (error) {
    assert(error instanceof Error && error.name === "BacklinkPromotionValidationError", "Promotion validation errors must propagate");
  }

  const sourceSnapshot = JSON.stringify({ qualificationTask, discoveryTask });
  const second = await buildBacklinkPromotionInputFromDependencies({ promotionTask: task() }, { getTaskByIdInRun: async (lookup) => lookup.taskId === qualificationId ? qualificationTask : discoveryTask });
  assert(JSON.stringify(result.promotionInput) === JSON.stringify(second.promotionInput) && result.promotionInput !== second.promotionInput, "Builder roots must be deterministic and independent");
  assert(JSON.stringify({ qualificationTask, discoveryTask }) === sourceSnapshot, "Source tasks must remain immutable");
  console.log("PASS — Automation backlink promotion input builder smoke");
}

void main();
