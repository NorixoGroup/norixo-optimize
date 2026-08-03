import {
  DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
  BacklinkQualificationDependencyError,
  executeBacklinkQualificationPreviewHandler,
  type AutomationTask,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ids = {
  workspace: "00000000-0000-4000-8000-000000000001",
  run: "00000000-0000-4000-8000-000000000002",
  discovery: "00000000-0000-4000-8000-000000000003",
  qualification: "00000000-0000-4000-8000-000000000004",
};

const discoveryInput = {
  version: 1,
  source: "manual_dashboard",
  provider: "mock",
  searches: [{ query: "airbnb host resources", countryCode: "US", languageCode: "en" }],
  maxResultsPerSearch: 3,
  maxCandidates: 3,
};

const discoveryOutput = {
  version: 1,
  kind: "backlinks.discovery.preview",
  dryRun: true,
  provider: "mock",
  summary: { searchesRequested: 1, resultsReceived: 1, candidatesAccepted: 1, candidatesRejected: 0, truncated: false },
  candidates: [{ candidateKey: "candidate-1", hostname: "one.example", sourceUrl: "https://one.example/resources", pageTitle: "Resources", snippet: "Airbnb host resources", queryIndex: 0, rank: 1, countryCode: "US", languageCode: "en", proposedOpportunityType: null, proposedPageType: null, suggestedAssetKey: null, evidenceSummary: "Candidate", discoveryScore: 10 }],
  rejections: [],
};

function task(overrides: Partial<AutomationTask> = {}): AutomationTask {
  return {
    id: ids.discovery,
    workspaceId: ids.workspace,
    runId: ids.run,
    dependsOnTaskId: null,
    system: "backlinks",
    taskKind: "backlinks.discovery.preview",
    taskKey: "discovery-preview",
    status: "completed",
    priority: 10,
    scheduledAt: "2026-08-04T10:00:00.000Z",
    availableAt: "2026-08-04T10:00:00.000Z",
    claimedAt: "2026-08-04T10:00:00.000Z",
    startedAt: "2026-08-04T10:00:00.000Z",
    heartbeatAt: "2026-08-04T10:00:00.000Z",
    leaseExpiresAt: null,
    completedAt: "2026-08-04T10:00:01.000Z",
    failedAt: null,
    cancelledAt: null,
    workerId: "worker-A",
    attemptCount: 1,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: discoveryInput,
    output: discoveryOutput,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-04T10:00:00.000Z",
    updatedAt: "2026-08-04T10:00:01.000Z",
    ...overrides,
  };
}

const qualificationTask = task({
  id: ids.qualification,
  dependsOnTaskId: ids.discovery,
  taskKind: "backlinks.qualification.preview",
  taskKey: "qualification-preview",
  status: "running",
  output: null,
  completedAt: null,
  leaseExpiresAt: "2026-08-04T10:02:00.000Z",
});
const discoveryTask = task();

async function main(): Promise<void> {
  const qualificationSnapshot = JSON.stringify(qualificationTask);
  const discoverySnapshot = JSON.stringify(discoveryTask);
  const policySnapshot = JSON.stringify(DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1);
  let reads = 0;
  const nominal = await executeBacklinkQualificationPreviewHandler(
    { task: qualificationTask },
    {
      getTaskByIdInRun: async (input) => {
        reads += 1;
        assert(
          input.workspaceId === ids.workspace && input.runId === ids.run && input.taskId === ids.discovery,
          "dependency lookup must be exact",
        );
        return discoveryTask;
      },
      policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
    },
  );
  assert(reads === 1, "dependency must be read exactly once");
  assert(nominal.kind === "backlinks.qualification.preview" && nominal.dryRun === true, "nominal output");
  assert(nominal.summary.candidatesEvaluated === 1 && nominal.results.length === 1, "candidate must be qualified");
  assert(!("discoveryTask" in nominal) && !("provider" in nominal), "discovery task must not be exposed");

  const zero = await executeBacklinkQualificationPreviewHandler(
    { task: qualificationTask },
    { getTaskByIdInRun: async () => task({ output: { ...discoveryOutput, candidates: [] } }), policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1 },
  );
  assert(zero.summary.candidatesEvaluated === 0 && zero.results.length === 0, "zero candidates");

  const repositoryError = new Error("repository failure");
  try {
    await executeBacklinkQualificationPreviewHandler(
      { task: qualificationTask },
      { getTaskByIdInRun: async () => { throw repositoryError; }, policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1 },
    );
    throw new Error("Expected repository error");
  } catch (error) {
    assert(error === repositoryError, "repository error must propagate by identity");
  }

  try {
    await executeBacklinkQualificationPreviewHandler(
      { task: { ...qualificationTask, dependsOnTaskId: null } },
      { getTaskByIdInRun: async () => discoveryTask, policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1 },
    );
    throw new Error("Expected dependency error");
  } catch (error) {
    assert(error instanceof BacklinkQualificationDependencyError, "builder error must propagate");
  }

  const selfPolicy = { ...DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1, selfHostnames: ["one.example"] };
  const policyOutput = await executeBacklinkQualificationPreviewHandler(
    { task: qualificationTask },
    { getTaskByIdInRun: async () => discoveryTask, policy: selfPolicy },
  );
  assert(policyOutput.results[0]?.decision === "rejected", "injected policy must be used");
  assert(JSON.stringify(qualificationTask) === qualificationSnapshot, "qualification task must not mutate");
  assert(JSON.stringify(discoveryTask) === discoverySnapshot, "discovery task must not mutate");
  assert(JSON.stringify(DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1) === policySnapshot, "policy must not mutate");
  assert(nominal !== zero && nominal.results !== zero.results, "outputs must be independent");
  console.log("PASS — Automation backlink qualification handler smoke");
}

void main();
