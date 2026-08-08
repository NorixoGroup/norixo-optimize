import {
  createDryRunAutomationTaskHandlers,
  DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
  DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
  type AutomationTask,
  type BacklinkDiscoveryPreviewOutputV1,
  type BacklinkQualificationPreviewOutputV1,
  type ExecuteAutomationTaskHandlerInput,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAutomationTaskHandlerInput(
  value: unknown,
): value is ExecuteAutomationTaskHandlerInput {
  return (
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    typeof value.runId === "string" &&
    typeof value.taskId === "string" &&
    typeof value.taskKind === "string" &&
    isRecord(value.input) &&
    typeof value.attemptedAt === "string"
  );
}

function outputRecord(result: { output: unknown }): Record<string, unknown> {
  assert(isRecord(result.output), "Handler output must be an object");
  return result.output;
}

function discoverySummary(output: Record<string, unknown>): Record<string, unknown> {
  assert(isRecord(output.summary), "Discovery summary must be an object");
  return output.summary;
}

const baseInput: ExecuteAutomationTaskHandlerInput = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  taskId: "00000000-0000-4000-8000-000000000003",
  taskKind: "noop",
  input: {},
  attemptedAt: "2026-08-03T10:00:00.000Z",
};

function qualificationTask(): AutomationTask {
  return {
    id: baseInput.taskId,
    workspaceId: baseInput.workspaceId,
    runId: baseInput.runId,
    dependsOnTaskId: "00000000-0000-4000-8000-000000000004",
    system: "backlinks",
    taskKind: "backlinks.qualification.preview",
    taskKey: "qualification-preview",
    status: "running",
    priority: 20,
    scheduledAt: baseInput.attemptedAt,
    availableAt: baseInput.attemptedAt,
    claimedAt: baseInput.attemptedAt,
    startedAt: baseInput.attemptedAt,
    heartbeatAt: baseInput.attemptedAt,
    leaseExpiresAt: "2026-08-03T10:02:00.000Z",
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    workerId: "worker-smoke",
    attemptCount: 1,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: {},
    output: null,
    errorCode: null,
    errorMessage: null,
    createdAt: baseInput.attemptedAt,
    updatedAt: baseInput.attemptedAt,
  };
}

async function main(): Promise<void> {
  const handlers = createDryRunAutomationTaskHandlers({
    providers: {},
    qualificationPolicy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
    getTaskByIdInRun: async () => null,
  });
  const original = JSON.stringify(baseInput);
  const noopFirst = await handlers.execute(baseInput);
  const noopSecond = await handlers.execute(baseInput);
  const noopOutput = outputRecord(noopFirst);
  assert(noopOutput.kind === "noop" && noopOutput.dryRun === true, "Noop must remain unchanged");
  assert(JSON.stringify(noopFirst) === JSON.stringify(noopSecond), "Noop must be deterministic");

  const discoveryInput: ExecuteAutomationTaskHandlerInput = {
    ...baseInput,
    taskKind: "backlinks.discovery.preview",
    input: {},
  };
  const discoveryBefore = JSON.stringify(discoveryInput);
  const discoveryFirst = await handlers.execute(discoveryInput);
  const discoverySecond = await handlers.execute(discoveryInput);
  const discoveryOutput = outputRecord(discoveryFirst);
  const summary = discoverySummary(discoveryOutput);
  assert(
    discoveryOutput.kind === "backlinks.discovery.preview" &&
      discoveryOutput.dryRun === true &&
      discoveryOutput.skipped === "no_searches",
    "Discovery empty input must be skipped",
  );
  assert(
    summary.searchesRequested === 0 &&
      summary.resultsReceived === 0 &&
      summary.candidatesAccepted === 0 &&
      summary.candidatesRejected === 0 &&
      summary.truncated === false,
    "Discovery skipped summary",
  );
  assert(
    Array.isArray(discoveryOutput.candidates) &&
      discoveryOutput.candidates.length === 0 &&
      Array.isArray(discoveryOutput.rejections) &&
      discoveryOutput.rejections.length === 0,
    "Discovery skipped arrays",
  );
  assert(JSON.stringify(discoveryFirst) === JSON.stringify(discoverySecond), "Discovery must be deterministic");
  assert(JSON.stringify(discoveryInput) === discoveryBefore, "Discovery input must not mutate");
  assert(discoveryFirst !== discoverySecond, "Discovery results must be independent");

  const missingProviderInput: ExecuteAutomationTaskHandlerInput = {
    ...discoveryInput,
    input: {
      version: 1,
      source: "manual_dashboard",
      provider: "mock",
      searches: [{ query: "airbnb host resources" }],
      maxResultsPerSearch: 1,
      maxCandidates: 1,
    },
  };
  try {
    await handlers.execute(missingProviderInput);
    throw new Error("Expected missing provider rejection");
  } catch (error) {
    assert(
      error instanceof Error && error.message === "BACKLINK_DISCOVERY_PROVIDER_NOT_CONFIGURED",
      "Discovery V1 must not configure a provider implicitly",
    );
  }

  const promotionDiscoveryOutput: BacklinkDiscoveryPreviewOutputV1 = {
    version: 1,
    kind: "backlinks.discovery.preview",
    dryRun: true,
    provider: "mock",
    summary: { searchesRequested: 1, resultsReceived: 1, candidatesAccepted: 1, candidatesRejected: 0, truncated: false },
    candidates: [{ candidateKey: "promotion-candidate", hostname: "example.com", sourceUrl: "https://example.com/resources", pageTitle: "Resources", snippet: "Hosts", queryIndex: 0, rank: 1, countryCode: "US", languageCode: "en", proposedOpportunityType: null, proposedPageType: null, suggestedAssetKey: "asset-guide", evidenceSummary: "Relevant resources", discoveryScore: 90 }],
    rejections: [],
  };
  const qualificationOutput: BacklinkQualificationPreviewOutputV1 = {
    version: 1,
    kind: "backlinks.qualification.preview",
    dryRun: true,
    policyVersion: "backlink-qualification-v1",
    summary: { candidatesEvaluated: 1, qualified: 1, review: 0, rejected: 0 },
    results: [{ candidateKey: "promotion-candidate", decision: "qualified", qualificationScore: 85, confidence: "medium", reasons: [{ code: "TOPICAL_RELEVANCE_STRONG", impact: 35, evidence: "Hosts" }], flags: [], proposedOpportunityType: "Resource Page", proposedPageType: "resource_page" }],
  };
  const discoveryTask: AutomationTask = { ...qualificationTask(), id: "00000000-0000-4000-8000-000000000005", taskKind: "backlinks.discovery.preview", status: "completed", dependsOnTaskId: null, output: promotionDiscoveryOutput };
  const completedQualificationTask: AutomationTask = { ...qualificationTask(), id: "00000000-0000-4000-8000-000000000004", status: "completed", dependsOnTaskId: discoveryTask.id, output: qualificationOutput };
  const configuredPromotionTask: AutomationTask = { ...qualificationTask(), id: "00000000-0000-4000-8000-000000000006", taskKind: "backlinks.promotion.preview", taskKey: "promotion-preview", status: "running", dependsOnTaskId: completedQualificationTask.id, output: null };
  const configuredHandlers = createDryRunAutomationTaskHandlers({
    providers: {},
    qualificationPolicy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
    promotionPolicy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
    getTaskByIdInRun: async (lookup) => lookup.taskId === completedQualificationTask.id ? completedQualificationTask : discoveryTask,
  });
  const configuredPromotion = await configuredHandlers.execute({
    ...baseInput,
    taskId: configuredPromotionTask.id,
    taskKind: "backlinks.promotion.preview",
    input: {},
    task: configuredPromotionTask,
  });
  const configuredPromotionOutput = outputRecord(configuredPromotion);
  assert(
    configuredPromotionOutput.kind === "backlinks.promotion.preview" &&
      Array.isArray(configuredPromotionOutput.proposals) &&
      configuredPromotionOutput.proposals.length === 1,
    "Configured Promotion handler must return a real preview",
  );

  const qualificationInput: ExecuteAutomationTaskHandlerInput = {
    ...baseInput,
    taskKind: "backlinks.qualification.preview",
    input: {},
    task: qualificationTask(),
  };
  try {
    await handlers.execute(qualificationInput);
    throw new Error("Expected missing qualification dependency rejection");
  } catch (error) {
    assert(
      error instanceof Error && error.message === "Qualification dependency was not found",
      "Qualification must use injected dependency",
    );
  }

  const promotionInput: ExecuteAutomationTaskHandlerInput = {
    ...baseInput,
    taskKind: "backlinks.promotion.preview",
    input: {},
    task: qualificationTask(),
  };
  try {
    await handlers.execute(promotionInput);
    throw new Error("Expected missing promotion handler rejection");
  } catch (error) {
    assert(
      error instanceof Error && error.message === "BACKLINK_PROMOTION_HANDLER_NOT_CONFIGURED",
      "Promotion must not use a placeholder when dependencies are missing",
    );
  }

  const unknownTask: unknown = {
    ...baseInput,
    taskKind: "unknown",
  };
  assert(isAutomationTaskHandlerInput(unknownTask), "Unknown task must be an object");
  try {
    await handlers.execute(unknownTask);
    throw new Error("Expected unknown task rejection");
  } catch (error) {
    assert(error instanceof Error, "Unknown task must reject");
  }

  assert(JSON.stringify(baseInput) === original, "Base input must not mutate");
  console.log("PASS — Automation dry-run handlers smoke");
}

void main();
