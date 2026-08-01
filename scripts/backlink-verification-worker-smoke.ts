import {
  executeBacklinkVerificationWorker,
  type BacklinkVerificationJob,
  type BacklinkVerificationRunResult,
  type CompleteBacklinkVerificationJobResult,
  type ExecuteBacklinkVerificationWorkerDependencies,
  type ExecuteBacklinkVerificationWorkerInput,
  type ExecuteBacklinkVerificationWorkerResult,
  type FailBacklinkVerificationJobResult,
} from "../lib/backlinks/verification";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejects(
  operation: () => Promise<unknown>,
  expectedMessage: string,
): Promise<Error> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, "Expected an Error instance.");
    assert(error.message.includes(expectedMessage), `Expected error message to include ${expectedMessage}.`);
    return error;
  }
  throw new Error("Expected operation to reject.");
}

const workspaceId = "00000000-0000-4000-8000-000000000001";
const linkId = "00000000-0000-4000-8000-000000000002";
const workerInput: ExecuteBacklinkVerificationWorkerInput = {
  workspaceId,
  workerId: "worker-smoke-1",
  claimedAt: "2026-08-01T11:00:00.000Z",
  leaseDurationSeconds: 60,
  attemptedAt: "2026-08-01T11:00:00.000Z",
};

const jobFixture: BacklinkVerificationJob = {
  id: "00000000-0000-4000-8000-000000000003",
  workspaceId,
  linkId,
  jobKey: "manual:worker-smoke",
  triggerSource: "manual",
  status: "running",
  policy: {},
  http: { timeoutMs: 1_000, maxRedirects: 3, maxResponseBytes: 10_000 },
  attemptCount: 1,
  maxAttempts: 1,
  queuedAt: "2026-08-01T11:00:00.000Z",
  startedAt: "2026-08-01T11:00:00.000Z",
  completedAt: null,
  failedAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  createdAt: "2026-08-01T11:00:00.000Z",
  updatedAt: "2026-08-01T11:00:00.000Z",
  workerId: "worker-smoke-1",
  claimedAt: "2026-08-01T11:00:00.000Z",
  leaseExpiresAt: "2026-08-01T11:01:00.000Z",
  heartbeatAt: "2026-08-01T11:00:00.000Z",
};

const linkFixture = {
  id: linkId,
  workspace_id: workspaceId,
  outreach_id: "00000000-0000-4000-8000-000000000004",
  opportunity_id: "00000000-0000-4000-8000-000000000005",
  domain_id: "00000000-0000-4000-8000-000000000006",
  asset_id: "00000000-0000-4000-8000-000000000007",
  backlink_key: "BL-LNK-000001",
  source_url: "https://publisher.example/resources",
  target_url: "https://norixo.example/revpar",
  anchor_text: null,
  rel_type: null,
  link_location: null,
  status: "observed" as const,
  acquired_at: "2026-08-01T11:00:00.000Z",
  first_verified_at: null,
  last_verified_at: null,
  last_seen_at: null,
  lost_at: null,
  lost_reason: null,
  verification_source: null,
  verification_evidence: null,
  created_by: null,
  created_at: "2026-08-01T11:00:00.000Z",
  updated_at: "2026-08-01T11:00:00.000Z",
};

const runFixture: BacklinkVerificationRunResult = {
  link: linkFixture,
  runtimeResult: {
    kind: "verified",
    response: {
      requestedUrl: linkFixture.source_url,
      finalUrl: linkFixture.source_url,
      status: 200,
      contentType: "text/html",
      redirectCount: 0,
      fetchedAt: "2026-08-01T11:00:00.000Z",
    },
    verification: {
      status: "FOUND",
      issues: [],
      evidence: { checkedAt: "2026-08-01T11:00:00.000Z" },
      verifiedAt: "2026-08-01T11:00:00.000Z",
    },
  },
  attempt: {
    id: "00000000-0000-4000-8000-000000000008",
    workspaceId,
    linkId,
    sourceUrl: linkFixture.source_url,
    targetUrl: linkFixture.target_url,
    attemptedAt: "2026-08-01T11:00:00.000Z",
    runtimeKind: "verified",
    runtimeReason: null,
    verificationStatus: "FOUND",
    requestedUrl: linkFixture.source_url,
    finalUrl: linkFixture.source_url,
    httpStatus: 200,
    contentType: "text/html",
    redirectCount: 0,
    fetchErrorCode: null,
    fetchErrorMessage: null,
    verificationResult: {},
    createdAt: "2026-08-01T11:00:00.000Z",
  },
  persistenceResult: { kind: "persisted", link: linkFixture },
};

const completionFixture: CompleteBacklinkVerificationJobResult = {
  kind: "completed",
  job: jobFixture,
};

const failureFixture: FailBacklinkVerificationJobResult = {
  kind: "failed",
  job: jobFixture,
};

const emptyResultFixture: ExecuteBacklinkVerificationWorkerResult = { kind: "empty" };
const completedResultFixture: ExecuteBacklinkVerificationWorkerResult = {
  kind: "completed",
  job: jobFixture,
  run: runFixture,
  completion: completionFixture,
};
const failedResultFixture: ExecuteBacklinkVerificationWorkerResult = {
  kind: "failed",
  job: jobFixture,
  error: { code: "WORKER_SMOKE_FAILURE", message: "Deterministic worker failure" },
  failure: failureFixture,
};

async function main(): Promise<void> {
  const emptyInput = { ...workerInput };
  const emptyOriginalInput = { ...emptyInput };
  let emptyCalls = 0;
  const emptyInputs: ExecuteBacklinkVerificationWorkerInput[] = [];
  const emptyDependencies: ExecuteBacklinkVerificationWorkerDependencies = {
    executeClaimedJob: async (input) => {
      emptyCalls += 1;
      emptyInputs.push(input);
      return emptyResultFixture;
    },
  };
  const emptyResult = await executeBacklinkVerificationWorker(emptyDependencies, emptyInput);
  assert(emptyResult === emptyResultFixture, "Empty result must be propagated by reference.");
  assert(emptyCalls === 1, "Empty dependency must be called once.");
  const emptyReceivedInput = emptyInputs[0];
  assert(emptyReceivedInput != null, "Expected empty dependency input.");
  assert(JSON.stringify(Object.keys(emptyReceivedInput).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Empty dependency input must contain exactly the expected keys.");
  assert(emptyReceivedInput.workspaceId === emptyOriginalInput.workspaceId && emptyReceivedInput.workerId === emptyOriginalInput.workerId && emptyReceivedInput.claimedAt === emptyOriginalInput.claimedAt && emptyReceivedInput.leaseDurationSeconds === emptyOriginalInput.leaseDurationSeconds && emptyReceivedInput.attemptedAt === emptyOriginalInput.attemptedAt, "Empty dependency input must be preserved.");
  assert(emptyInput.workspaceId === emptyOriginalInput.workspaceId && emptyInput.workerId === emptyOriginalInput.workerId && emptyInput.claimedAt === emptyOriginalInput.claimedAt && emptyInput.leaseDurationSeconds === emptyOriginalInput.leaseDurationSeconds && emptyInput.attemptedAt === emptyOriginalInput.attemptedAt, "Empty worker input must not be mutated.");

  const completedInput = { ...workerInput };
  const completedOriginalInput = { ...completedInput };
  const completedSnapshot = JSON.stringify(completedResultFixture);
  let completedCalls = 0;
  const completedDependencies: ExecuteBacklinkVerificationWorkerDependencies = {
    executeClaimedJob: async (input) => {
      completedCalls += 1;
      assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Completed dependency input must contain exactly the expected keys.");
      assert(input.workspaceId === completedOriginalInput.workspaceId && input.workerId === completedOriginalInput.workerId && input.claimedAt === completedOriginalInput.claimedAt && input.leaseDurationSeconds === completedOriginalInput.leaseDurationSeconds && input.attemptedAt === completedOriginalInput.attemptedAt, "Completed dependency input must be preserved.");
      return completedResultFixture;
    },
  };
  const completedResult = await executeBacklinkVerificationWorker(completedDependencies, completedInput);
  assert(completedResult.kind === "completed", "Expected completed worker result.");
  assert(completedResult === completedResultFixture, "Completed result must be propagated by reference.");
  assert(completedCalls === 1, "Completed dependency must be called once.");
  assert(completedInput.workspaceId === completedOriginalInput.workspaceId && completedInput.workerId === completedOriginalInput.workerId && completedInput.claimedAt === completedOriginalInput.claimedAt && completedInput.leaseDurationSeconds === completedOriginalInput.leaseDurationSeconds && completedInput.attemptedAt === completedOriginalInput.attemptedAt, "Completed worker input must not be mutated.");
  assert(JSON.stringify(completedResultFixture) === completedSnapshot, "Completed result must not be mutated.");

  const failedInput = { ...workerInput };
  const failedOriginalInput = { ...failedInput };
  const failedSnapshot = JSON.stringify(failedResultFixture);
  let failedCalls = 0;
  const failedDependencies: ExecuteBacklinkVerificationWorkerDependencies = {
    executeClaimedJob: async (input) => {
      failedCalls += 1;
      assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Failed dependency input must contain exactly the expected keys.");
      assert(input.workspaceId === failedOriginalInput.workspaceId && input.workerId === failedOriginalInput.workerId && input.claimedAt === failedOriginalInput.claimedAt && input.leaseDurationSeconds === failedOriginalInput.leaseDurationSeconds && input.attemptedAt === failedOriginalInput.attemptedAt, "Failed dependency input must be preserved.");
      return failedResultFixture;
    },
  };
  const failedResult = await executeBacklinkVerificationWorker(failedDependencies, failedInput);
  assert(failedResult.kind === "failed", "Expected failed worker result.");
  assert(failedResult === failedResultFixture, "Failed result must be propagated by reference.");
  assert(failedCalls === 1, "Failed dependency must be called once.");
  assert(failedInput.workspaceId === failedOriginalInput.workspaceId && failedInput.workerId === failedOriginalInput.workerId && failedInput.claimedAt === failedOriginalInput.claimedAt && failedInput.leaseDurationSeconds === failedOriginalInput.leaseDurationSeconds && failedInput.attemptedAt === failedOriginalInput.attemptedAt, "Failed worker input must not be mutated.");
  assert(JSON.stringify(failedResultFixture) === failedSnapshot, "Failed result must not be mutated.");

  const workerDependencyError = new Error("Deterministic worker dependency failure");
  let errorCalls = 0;
  const errorDependencies: ExecuteBacklinkVerificationWorkerDependencies = {
    executeClaimedJob: async () => {
      errorCalls += 1;
      throw workerDependencyError;
    },
  };
  const propagatedError = await assertRejects(
    () => executeBacklinkVerificationWorker(errorDependencies, { ...workerInput }),
    "Deterministic worker dependency failure",
  );
  assert(propagatedError === workerDependencyError, "Worker dependency error must be propagated unchanged.");
  assert(errorCalls === 1, "Error dependency must be called once.");

  const workerAInput: ExecuteBacklinkVerificationWorkerInput = {
    ...workerInput,
    workspaceId: "00000000-0000-4000-8000-000000000010",
    workerId: "worker-A",
    attemptedAt: "2026-08-01T11:01:00.000Z",
  };
  const workerBInput: ExecuteBacklinkVerificationWorkerInput = {
    ...workerInput,
    workspaceId: "00000000-0000-4000-8000-000000000011",
    workerId: "worker-B",
    attemptedAt: "2026-08-01T11:02:00.000Z",
  };
  let statelessCalls = 0;
  const statelessInputs: ExecuteBacklinkVerificationWorkerInput[] = [];
  const statelessDependencies: ExecuteBacklinkVerificationWorkerDependencies = {
    executeClaimedJob: async (input) => {
      statelessCalls += 1;
      statelessInputs.push(input);
      return statelessCalls === 1 ? completedResultFixture : failedResultFixture;
    },
  };
  const workerAResult = await executeBacklinkVerificationWorker(statelessDependencies, workerAInput);
  const workerBResult = await executeBacklinkVerificationWorker(statelessDependencies, workerBInput);
  assert(workerAResult === completedResultFixture, "Worker A must receive the first result.");
  assert(workerBResult === failedResultFixture, "Worker B must receive the second result.");
  assert(statelessCalls === 2, "Stateless dependency must be called once per worker.");
  const receivedWorkerAInput = statelessInputs[0];
  const receivedWorkerBInput = statelessInputs[1];
  assert(receivedWorkerAInput != null && receivedWorkerBInput != null, "Expected two stateless inputs.");
  assert(receivedWorkerAInput.workspaceId === workerAInput.workspaceId && receivedWorkerAInput.workerId === workerAInput.workerId && receivedWorkerAInput.claimedAt === workerAInput.claimedAt && receivedWorkerAInput.leaseDurationSeconds === workerAInput.leaseDurationSeconds && receivedWorkerAInput.attemptedAt === workerAInput.attemptedAt, "Worker A input must remain independent.");
  assert(receivedWorkerBInput.workspaceId === workerBInput.workspaceId && receivedWorkerBInput.workerId === workerBInput.workerId && receivedWorkerBInput.claimedAt === workerBInput.claimedAt && receivedWorkerBInput.leaseDurationSeconds === workerBInput.leaseDurationSeconds && receivedWorkerBInput.attemptedAt === workerBInput.attemptedAt, "Worker B input must remain independent.");
  assert(receivedWorkerAInput.workspaceId !== receivedWorkerBInput.workspaceId, "Worker workspaces must remain independent.");
  assert(receivedWorkerAInput.workerId !== receivedWorkerBInput.workerId, "Worker inputs must remain independent.");
  assert(receivedWorkerAInput.attemptedAt !== receivedWorkerBInput.attemptedAt, "Worker attempt dates must remain independent.");

  console.log("PASS — Backlink verification worker smoke");
}

void main();
