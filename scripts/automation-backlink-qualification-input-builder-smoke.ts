import {
  BacklinkQualificationDependencyError,
  buildBacklinkQualificationInputFromDependency,
  type AutomationTask,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertCode(
  action: () => Promise<unknown>,
  code: string,
  message: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error instanceof BacklinkQualificationDependencyError && error.code === code, message);
    return;
  }
  throw new Error(message);
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
  searches: [
    { query: "airbnb tools", countryCode: "US", languageCode: "en" },
    { query: "airbnb guide", countryCode: "FR", languageCode: "fr" },
  ],
  maxResultsPerSearch: 3,
  maxCandidates: 3,
};
const discoveryOutput = {
  version: 1,
  kind: "backlinks.discovery.preview",
  dryRun: true,
  provider: "mock",
  summary: {
    searchesRequested: 2,
    resultsReceived: 2,
    candidatesAccepted: 2,
    candidatesRejected: 0,
    truncated: false,
  },
  candidates: [
    {
      candidateKey: "candidate-1",
      hostname: "one.example",
      sourceUrl: "https://one.example/tools",
      pageTitle: "Tools",
      snippet: "Airbnb tools",
      queryIndex: 0,
      rank: 1,
      countryCode: "US",
      languageCode: "en",
      proposedOpportunityType: null,
      proposedPageType: null,
      suggestedAssetKey: null,
      evidenceSummary: "First candidate",
      discoveryScore: 10,
    },
    {
      candidateKey: "candidate-2",
      hostname: "two.example",
      sourceUrl: "https://two.example/guide",
      pageTitle: "Guide",
      snippet: "Airbnb guide",
      queryIndex: 1,
      rank: 2,
      countryCode: "FR",
      languageCode: "fr",
      proposedOpportunityType: null,
      proposedPageType: null,
      suggestedAssetKey: "asset-1",
      evidenceSummary: "Second candidate",
      discoveryScore: 9,
    },
  ],
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
  let calls = 0;
  const received: Array<{ workspaceId: string; runId: string; taskId: string }> = [];
  const nominal = await buildBacklinkQualificationInputFromDependency(
    { qualificationTask },
    {
      getTaskByIdInRun: async (lookup) => {
        calls += 1;
        received.push(lookup);
        return discoveryTask;
      },
    },
  );
  assert(calls === 1, "dependency must be read exactly once");
  assert(
    JSON.stringify(received) ===
      JSON.stringify([{ workspaceId: ids.workspace, runId: ids.run, taskId: ids.discovery }]),
    "dependency lookup must be workspace and run scoped",
  );
  assert(nominal.discoveryTask === discoveryTask, "discovery task reference must propagate");
  assert(
    JSON.stringify(nominal.qualificationInput.queries) ===
      JSON.stringify([
        { query: "airbnb tools", countryCode: "US", languageCode: "en" },
        { query: "airbnb guide", countryCode: "FR", languageCode: "fr" },
      ]),
    "queries must retain discovery input order",
  );
  assert(
    JSON.stringify(nominal.qualificationInput.candidates.map((candidate) => candidate.candidateKey)) ===
      JSON.stringify(["candidate-1", "candidate-2"]),
    "candidates must retain discovery output order",
  );
  assert(nominal.qualificationInput.maxCandidates === 2, "max candidates must be exact");
  assert(
    !("provider" in nominal.qualificationInput) &&
      !("summary" in nominal.qualificationInput) &&
      !("rejections" in nominal.qualificationInput),
    "provider-only output fields must not be copied",
  );

  const emptyDiscovery = task({
    output: { ...discoveryOutput, candidates: [] },
  });
  const empty = await buildBacklinkQualificationInputFromDependency(
    { qualificationTask },
    { getTaskByIdInRun: async () => emptyDiscovery },
  );
  assert(empty.qualificationInput.candidates.length === 0 && empty.qualificationInput.maxCandidates === 1, "zero candidates must remain a valid qualification input");

  const invalidTasks: readonly AutomationTask[] = [
    { ...qualificationTask, taskKind: "noop" },
    { ...qualificationTask, status: "queued" },
    { ...qualificationTask, dependsOnTaskId: null },
    { ...qualificationTask, id: "invalid" },
  ];
  for (const invalidTask of invalidTasks) {
    let invalidCalls = 0;
    await assertCode(
      () => buildBacklinkQualificationInputFromDependency({ qualificationTask: invalidTask }, { getTaskByIdInRun: async () => { invalidCalls += 1; return discoveryTask; } }),
      "BACKLINK_QUALIFICATION_TASK_INVALID",
      "invalid qualification task must reject",
    );
    assert(invalidCalls === 0, "invalid qualification task must not query the repository");
  }

  await assertCode(
    () => buildBacklinkQualificationInputFromDependency({ qualificationTask }, { getTaskByIdInRun: async () => null }),
    "BACKLINK_QUALIFICATION_DEPENDENCY_NOT_FOUND",
    "missing dependency must reject",
  );
  const repositoryError = new Error("repository failure");
  try {
    await buildBacklinkQualificationInputFromDependency({ qualificationTask }, { getTaskByIdInRun: async () => { throw repositoryError; } });
  } catch (error) {
    assert(error === repositoryError, "repository error must propagate by identity");
  }

  for (const invalidDependency of [
    task({ workspaceId: "00000000-0000-4000-8000-000000000010" }),
    task({ runId: "00000000-0000-4000-8000-000000000011" }),
    task({ id: "00000000-0000-4000-8000-000000000012" }),
  ]) {
    await assertCode(
      () => buildBacklinkQualificationInputFromDependency({ qualificationTask }, { getTaskByIdInRun: async () => invalidDependency }),
      "BACKLINK_QUALIFICATION_DEPENDENCY_SCOPE_MISMATCH",
      "dependency scope must match exactly",
    );
  }
  await assertCode(
    () => buildBacklinkQualificationInputFromDependency({ qualificationTask }, { getTaskByIdInRun: async () => task({ taskKind: "noop" }) }),
    "BACKLINK_QUALIFICATION_DEPENDENCY_KIND_INVALID",
    "dependency kind must be discovery",
  );
  for (const status of ["queued", "running", "failed", "cancelled", "dead_letter"] as const) {
    await assertCode(
      () => buildBacklinkQualificationInputFromDependency({ qualificationTask }, { getTaskByIdInRun: async () => task({ status }) }),
      "BACKLINK_QUALIFICATION_DEPENDENCY_NOT_COMPLETED",
      "dependency must be completed",
    );
  }
  for (const invalidOutput of [null, {}, { ...discoveryOutput, provider: null }]) {
    await assertCode(
      () => buildBacklinkQualificationInputFromDependency({ qualificationTask }, { getTaskByIdInRun: async () => task({ output: invalidOutput }) }),
      "BACKLINK_QUALIFICATION_DEPENDENCY_OUTPUT_INVALID",
      "dependency output must be a discovery preview",
    );
  }
  for (const invalidInput of [{}, { source: "manual_dashboard", requestedScope: "preview" }, { ...discoveryInput, searches: [] }]) {
    await assertCode(
      () => buildBacklinkQualificationInputFromDependency({ qualificationTask }, { getTaskByIdInRun: async () => task({ input: invalidInput }) }),
      "BACKLINK_QUALIFICATION_DISCOVERY_INPUT_INVALID",
      "discovery input must be a valid V1 request",
    );
  }

  const qualificationSnapshot = JSON.stringify(qualificationTask);
  const discoverySnapshot = JSON.stringify(discoveryTask);
  const inputSnapshot = JSON.stringify(discoveryInput);
  const outputSnapshot = JSON.stringify(discoveryOutput);
  const first = await buildBacklinkQualificationInputFromDependency({ qualificationTask }, { getTaskByIdInRun: async () => discoveryTask });
  const second = await buildBacklinkQualificationInputFromDependency({ qualificationTask }, { getTaskByIdInRun: async () => discoveryTask });
  assert(JSON.stringify(first.qualificationInput) === JSON.stringify(second.qualificationInput), "builder must be deterministic");
  assert(first.qualificationInput !== second.qualificationInput, "builder results must be independent");
  assert(JSON.stringify(qualificationTask) === qualificationSnapshot, "qualification task must remain immutable");
  assert(JSON.stringify(discoveryTask) === discoverySnapshot, "discovery task must remain immutable");
  assert(JSON.stringify(discoveryInput) === inputSnapshot && JSON.stringify(discoveryOutput) === outputSnapshot, "discovery input and output must remain immutable");
  console.log("PASS — Automation backlink qualification input builder smoke");
}

void main();
