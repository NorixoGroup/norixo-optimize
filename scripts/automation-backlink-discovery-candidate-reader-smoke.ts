import {
  readBacklinkDiscoveryCandidate,
} from "../lib/automation/backlink-discovery-candidate-reader";
import {
  BacklinkDiscoveryCandidateReaderError,
  type ReadBacklinkDiscoveryCandidateDependencies,
} from "../lib/automation/backlink-discovery-candidate-reader-types";
import type { BacklinkDiscoveryPreviewOutputV1 } from "../lib/automation/backlink-discovery-handler-types";
import { getAutomationRunById } from "../lib/automation/repositories/automationRunsRepository";
import type { AutomationRun, AutomationTask } from "../lib/automation/types";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const otherWorkspaceId = "00000000-0000-4000-8000-000000000002";
const runId = "00000000-0000-4000-8000-000000000003";
const taskId = "00000000-0000-4000-8000-000000000004";
const candidateKey = "discovery:candidate-one";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function run(): AutomationRun {
  return {
    id: runId,
    workspaceId,
    system: "backlinks",
    runKind: "backlinks-dry-run",
    idempotencyKey: "discovery-reader-smoke",
    status: "completed",
    mode: "dry_run",
    triggerSource: "manual",
    requestedBy: null,
    scheduledAt: "2026-08-09T10:00:00.000Z",
    startedAt: "2026-08-09T10:00:00.000Z",
    completedAt: "2026-08-09T10:01:00.000Z",
    failedAt: null,
    cancelledAt: null,
    heartbeatAt: null,
    leaseExpiresAt: null,
    workerId: null,
    attemptCount: 1,
    maxAttempts: 3,
    input: {},
    summary: null,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-09T10:00:00.000Z",
    updatedAt: "2026-08-09T10:01:00.000Z",
  };
}

function output(): BacklinkDiscoveryPreviewOutputV1 {
  return {
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
    candidates: [
      {
        candidateKey,
        hostname: "example.com",
        sourceUrl: "https://example.com/resources",
        pageTitle: "Resources",
        snippet: "Useful resources",
        queryIndex: 0,
        rank: 1,
        countryCode: "FR",
        languageCode: "fr",
        proposedOpportunityType: null,
        proposedPageType: null,
        suggestedAssetKey: null,
        evidenceSummary: "SERP rank 1 for query resources",
        discoveryScore: 100,
      },
    ],
    rejections: [],
  };
}

function task(discoveryOutput: AutomationTask["output"]): AutomationTask {
  return {
    id: taskId,
    workspaceId,
    runId,
    dependsOnTaskId: null,
    system: "backlinks",
    taskKind: "backlinks.discovery.preview",
    taskKey: "discovery-preview",
    status: "completed",
    priority: 10,
    scheduledAt: "2026-08-09T10:00:00.000Z",
    availableAt: "2026-08-09T10:00:00.000Z",
    claimedAt: null,
    startedAt: "2026-08-09T10:00:00.000Z",
    heartbeatAt: null,
    leaseExpiresAt: null,
    completedAt: "2026-08-09T10:01:00.000Z",
    failedAt: null,
    cancelledAt: null,
    workerId: "worker",
    attemptCount: 1,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: {},
    output: discoveryOutput,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-09T10:00:00.000Z",
    updatedAt: "2026-08-09T10:01:00.000Z",
  };
}

function dependencies(
  discoveryRun: AutomationRun | null,
  discoveryTask: AutomationTask | null,
): ReadBacklinkDiscoveryCandidateDependencies {
  return {
    async getRunById() {
      return discoveryRun;
    },
    async getTaskByIdInRun() {
      return discoveryTask;
    },
  };
}

async function assertReaderError(
  operation: () => Promise<unknown>,
  code: BacklinkDiscoveryCandidateReaderError["code"],
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof BacklinkDiscoveryCandidateReaderError, "Expected reader error.");
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function repositoryClient(data: object | null) {
  const calls: { tables: string[]; filters: Array<{ column: string; value: string }> } = {
    tables: [],
    filters: [],
  };
  const query = {
    select() {
      return query;
    },
    eq(column: string, value: string) {
      calls.filters.push({ column, value });
      return query;
    },
    async maybeSingle() {
      return { data, error: null };
    },
  };
  return {
    client: {
      from(table: string) {
        calls.tables.push(table);
        return query;
      },
    },
    calls,
  };
}

async function main(): Promise<void> {
  const storedRun = {
    id: runId,
    workspace_id: workspaceId,
    system: "backlinks",
    run_kind: "backlinks-dry-run",
    idempotency_key: "discovery-reader-smoke",
    status: "completed",
    mode: "dry_run",
    trigger_source: "manual",
    requested_by: null,
    scheduled_at: "2026-08-09T10:00:00.000Z",
    started_at: "2026-08-09T10:00:00.000Z",
    completed_at: "2026-08-09T10:01:00.000Z",
    failed_at: null,
    cancelled_at: null,
    heartbeat_at: null,
    lease_expires_at: null,
    worker_id: null,
    attempt_count: 1,
    max_attempts: 3,
    input: {},
    summary: null,
    error_code: null,
    error_message: null,
    created_at: "2026-08-09T10:00:00.000Z",
    updated_at: "2026-08-09T10:01:00.000Z",
  };
  const foundRepository = repositoryClient(storedRun);
  const foundRun = await Reflect.apply(getAutomationRunById, undefined, [
    foundRepository.client,
    { workspaceId, runId },
  ]);
  assert(typeof foundRun === "object" && foundRun !== null, "Expected workspace-scoped run.");
  assert(
    JSON.stringify(foundRepository.calls) ===
      JSON.stringify({
        tables: ["automation_runs"],
        filters: [
          { column: "workspace_id", value: workspaceId },
          { column: "id", value: runId },
        ],
      }),
    "Expected strict workspace and run filters.",
  );
  const absentRepository = repositoryClient(null);
  const absentRun = await Reflect.apply(getAutomationRunById, undefined, [
    absentRepository.client,
    { workspaceId: otherWorkspaceId, runId },
  ]);
  assert(absentRun === null, "Expected null for a run outside the workspace.");
  assert(
    JSON.stringify(absentRepository.calls.filters) ===
      JSON.stringify([
        { column: "workspace_id", value: otherWorkspaceId },
        { column: "id", value: runId },
      ]),
    "Expected workspace filtering for missing runs.",
  );

  const input = { workspaceId, runId, taskId, candidateKey };
  const found = await readBacklinkDiscoveryCandidate(dependencies(run(), task(output())), input);
  assert(found.candidate.candidateKey === candidateKey, "Expected requested discovery candidate.");
  await assertReaderError(
    () => readBacklinkDiscoveryCandidate(dependencies(null, task(output())), input),
    "RUN_NOT_FOUND",
  );
  await assertReaderError(
    () => readBacklinkDiscoveryCandidate(dependencies(run(), null), input),
    "TASK_NOT_FOUND",
  );
  const incompleteTask = task(output());
  incompleteTask.status = "running";
  await assertReaderError(
    () => readBacklinkDiscoveryCandidate(dependencies(run(), incompleteTask), input),
    "TASK_NOT_COMPLETED",
  );
  const wrongKindTask = task(output());
  wrongKindTask.taskKind = "backlinks.qualification.preview";
  await assertReaderError(
    () => readBacklinkDiscoveryCandidate(dependencies(run(), wrongKindTask), input),
    "TASK_KIND_INVALID",
  );
  await assertReaderError(
    () => readBacklinkDiscoveryCandidate(dependencies(run(), task({})), input),
    "OUTPUT_INVALID",
  );
  await assertReaderError(
    () => readBacklinkDiscoveryCandidate(dependencies(run(), task(output())), { ...input, candidateKey: "discovery:missing" }),
    "CANDIDATE_NOT_FOUND",
  );

  console.log("automation backlink discovery candidate reader smoke: PASS");
}

void main();
