import {
  executeClaimedBacklinkVerificationJob,
  type BacklinkVerificationJob,
  type BacklinkVerificationRunResult,
  type ClaimNextBacklinkVerificationJobInput,
  type CompleteBacklinkVerificationJobInput,
  type CompleteBacklinkVerificationJobResult,
  type ExecuteClaimedBacklinkVerificationJobDependencies,
  type ExecuteBacklinkVerificationRunDependencies,
  type ExecuteBacklinkVerificationRunInput,
  type FailBacklinkVerificationJobInput,
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

const jobFixture: BacklinkVerificationJob = {
  id: "00000000-0000-4000-8000-000000000003",
  workspaceId,
  linkId,
  jobKey: "manual:claimed-job-smoke",
  triggerSource: "manual",
  status: "running",
  policy: {},
  http: { timeoutMs: 1_000, maxRedirects: 3, maxResponseBytes: 10_000 },
  attemptCount: 1,
  maxAttempts: 1,
  queuedAt: "2026-08-01T10:00:00.000Z",
  startedAt: "2026-08-01T10:00:00.000Z",
  completedAt: null,
  failedAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z",
  workerId: "worker-smoke-1",
  claimedAt: "2026-08-01T10:00:00.000Z",
  leaseExpiresAt: "2026-08-01T10:01:00.000Z",
  heartbeatAt: "2026-08-01T10:00:00.000Z",
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
  acquired_at: "2026-08-01T09:00:00.000Z",
  first_verified_at: null,
  last_verified_at: null,
  last_seen_at: null,
  lost_at: null,
  lost_reason: null,
  verification_source: null,
  verification_evidence: null,
  created_by: null,
  created_at: "2026-08-01T09:00:00.000Z",
  updated_at: "2026-08-01T09:00:00.000Z",
};

const runResultFixture: BacklinkVerificationRunResult = {
  link: linkFixture,
  runtimeResult: {
    kind: "verified",
    response: {
      requestedUrl: linkFixture.source_url,
      finalUrl: linkFixture.source_url,
      status: 200,
      contentType: "text/html",
      redirectCount: 0,
      fetchedAt: "2026-08-01T10:00:00.000Z",
    },
    verification: {
      status: "FOUND",
      issues: [],
      evidence: { checkedAt: "2026-08-01T10:00:00.000Z" },
      verifiedAt: "2026-08-01T10:00:00.000Z",
    },
  },
  attempt: {
    id: "00000000-0000-4000-8000-000000000008",
    workspaceId,
    linkId,
    sourceUrl: linkFixture.source_url,
    targetUrl: linkFixture.target_url,
    attemptedAt: "2026-08-01T10:00:00.000Z",
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
    createdAt: "2026-08-01T10:00:00.000Z",
  },
  persistenceResult: { kind: "persisted", link: linkFixture },
};

const completionResultFixture: CompleteBacklinkVerificationJobResult = {
  kind: "completed",
  job: jobFixture,
};

const failureResultFixture: FailBacklinkVerificationJobResult = {
  kind: "failed",
  job: jobFixture,
};

const fetchErrorRunResultFixture: BacklinkVerificationRunResult = {
  link: linkFixture,
  runtimeResult: {
    kind: "fetch_error",
    error: {
      code: "FETCH_ERROR",
      message: "Deterministic fetch failure",
    },
  },
  attempt: {
    id: "00000000-0000-4000-8000-000000000009",
    workspaceId,
    linkId,
    sourceUrl: linkFixture.source_url,
    targetUrl: linkFixture.target_url,
    attemptedAt: "2026-08-01T10:00:00.000Z",
    runtimeKind: "fetch_error",
    runtimeReason: null,
    verificationStatus: null,
    requestedUrl: null,
    finalUrl: null,
    httpStatus: null,
    contentType: null,
    redirectCount: null,
    fetchErrorCode: "FETCH_ERROR",
    fetchErrorMessage: "Deterministic fetch failure",
    verificationResult: null,
    createdAt: "2026-08-01T10:00:00.000Z",
  },
  persistenceResult: { kind: "skipped", reason: "fetch_error" },
};

const completionInputs: CompleteBacklinkVerificationJobInput[] = [];
const nominalClaimInputs: ClaimNextBacklinkVerificationJobInput[] = [];
let nominalClaimCalls = 0;
let nominalRunCalls = 0;
let nominalCompletionCalls = 0;
let nominalFailureCalls = 0;

const dependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
  claimNextJob: async (input) => {
    nominalClaimCalls += 1;
    nominalClaimInputs.push(input);
    return { kind: "claimed", job: jobFixture };
  },
  executeRun: async () => {
    nominalRunCalls += 1;
    return runResultFixture;
  },
  runDependencies: {
    getLink: async () => linkFixture,
    executeRuntime: async () => runResultFixture.runtimeResult,
    recordAttempt: async () => runResultFixture.attempt,
    recordAttemptDependencies: { createAttempt: async () => runResultFixture.attempt },
    persistCurrentState: async () => runResultFixture.persistenceResult,
    persistenceDependencies: {
      getLink: async () => linkFixture,
      updateVerification: async () => linkFixture,
    },
  },
  completeJob: async (completionInput) => {
    nominalCompletionCalls += 1;
    completionInputs.push(completionInput);
    return completionResultFixture;
  },
  failJob: async () => {
    nominalFailureCalls += 1;
    return failureResultFixture;
  },
};

async function main(): Promise<void> {
  const result = await executeClaimedBacklinkVerificationJob(dependencies, {
    workspaceId,
    workerId: "worker-smoke-1",
    claimedAt: "2026-08-01T10:00:00.000Z",
    leaseDurationSeconds: 60,
    attemptedAt: "2026-08-01T10:00:00.000Z",
  });

  assert(result.kind === "completed", "Expected completed result.");
  assert(nominalClaimCalls === 1, "Nominal claim must be called once.");
  assert(nominalRunCalls === 1, "Nominal run must be called once.");
  assert(nominalCompletionCalls === 1, "Nominal completion must be called once.");
  assert(nominalFailureCalls === 0, "Nominal failure must not be called.");
  const nominalClaimInput = nominalClaimInputs[0];
  assert(nominalClaimInput != null, "Expected nominal claim input.");
  assert(nominalClaimInput.workspaceId === workspaceId, "Claim must preserve the orchestrator workspaceId.");
  assert(JSON.stringify(Object.keys(nominalClaimInput).sort()) === JSON.stringify(["claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Claim input must contain exactly the expected keys.");
  const completionInput = completionInputs[0];
  assert(completionInput != null, "Expected completion input.");
  const completionSummary = completionInput.resultSummary;
  assert(
    completionSummary != null && typeof completionSummary === "object" && !Array.isArray(completionSummary),
    "Expected an object completion summary.",
  );
  assert(
    JSON.stringify(Object.keys(completionSummary).sort()) ===
      JSON.stringify(["persistenceKind", "runtimeKind", "verificationStatus"]),
    "Completion summary must contain exactly the expected keys.",
  );
  assert(completionSummary.runtimeKind === "verified", "Expected verified runtime summary.");
  assert(completionSummary.persistenceKind === "persisted", "Expected persisted summary.");
  assert(completionSummary.verificationStatus === "FOUND", "Expected FOUND summary.");
  for (const sensitiveKey of ["html", "headers", "stack", "error", "attempt", "link", "runtimeResult", "persistenceResult"]) {
    assert(!Object.keys(completionSummary).includes(sensitiveKey), `Completion summary must not include ${sensitiveKey}.`);
  }

  let emptyClaimCalls = 0;
  let emptyRunCalls = 0;
  let emptyCompletionCalls = 0;
  let emptyFailureCalls = 0;
  const emptyDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      emptyClaimCalls += 1;
      return { kind: "empty" };
    },
    executeRun: async () => {
      emptyRunCalls += 1;
      return runResultFixture;
    },
    completeJob: async () => {
      emptyCompletionCalls += 1;
      return completionResultFixture;
    },
    failJob: async () => {
      emptyFailureCalls += 1;
      return failureResultFixture;
    },
  };
  const emptyResult = await executeClaimedBacklinkVerificationJob(emptyDependencies, {
    workspaceId,
    workerId: "worker-smoke-1",
    claimedAt: "2026-08-01T10:00:00.000Z",
    leaseDurationSeconds: 60,
    attemptedAt: "2026-08-01T10:00:00.000Z",
  });

  assert(emptyResult.kind === "empty", "Expected empty result.");
  assert(emptyClaimCalls === 1, "Empty claim must be called once.");
  assert(emptyRunCalls === 0, "Run must not be called for an empty claim.");
  assert(emptyCompletionCalls === 0, "Completion must not be called for an empty claim.");
  assert(emptyFailureCalls === 0, "Failure must not be called for an empty claim.");

  const runError = new Error("Deterministic run failure");
  let failedClaimCalls = 0;
  let failedRunCalls = 0;
  let failedCompletionCalls = 0;
  let failedFailureCalls = 0;
  const receivedFailureInputs: FailBacklinkVerificationJobInput[] = [];
  const failedDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      failedClaimCalls += 1;
      return { kind: "claimed", job: jobFixture };
    },
    executeRun: async () => {
      failedRunCalls += 1;
      throw runError;
    },
    completeJob: async () => {
      failedCompletionCalls += 1;
      return completionResultFixture;
    },
    failJob: async (failureInput) => {
      failedFailureCalls += 1;
      receivedFailureInputs.push(failureInput);
      return failureResultFixture;
    },
  };
  const failedResult = await executeClaimedBacklinkVerificationJob(failedDependencies, {
    workspaceId,
    workerId: "worker-smoke-1",
    claimedAt: "2026-08-01T10:00:00.000Z",
    leaseDurationSeconds: 60,
    attemptedAt: "2026-08-01T10:00:00.000Z",
  });

  assert(failedResult.kind === "failed", "Expected failed result.");
  assert(failedClaimCalls === 1, "Failed claim must be called once.");
  assert(failedRunCalls === 1, "Failed run must be called once.");
  assert(failedCompletionCalls === 0, "Completion must not be called after a run error.");
  assert(failedFailureCalls === 1, "Failure must be called once after a run error.");
  assert(failedResult.job === jobFixture, "Failed result must propagate the claimed job.");
  assert(failedResult.error.code === "Error", "Expected serialized Error code.");
  assert(failedResult.error.message === "Deterministic run failure", "Expected serialized Error message.");
  assert(failedResult.failure === failureResultFixture, "Failed result must preserve the failure result.");
  const receivedFailureInput = receivedFailureInputs[0];
  assert(receivedFailureInput != null, "Expected failure input.");
  assert(receivedFailureInput.jobId === jobFixture.id, "Failure jobId must match the claimed job.");
  assert(receivedFailureInput.workerId === "worker-smoke-1", "Failure workerId must match the input.");
  assert(receivedFailureInput.failedAt === "2026-08-01T10:00:00.000Z", "Failure date must match the input.");
  assert(receivedFailureInput.errorCode === "Error", "Failure errorCode must match the serialized error.");
  assert(receivedFailureInput.errorMessage === "Deterministic run failure", "Failure errorMessage must match the serialized error.");
  assert(!Object.keys(receivedFailureInput).includes("stack"), "Failure input must not include stack.");
  assert(!Object.keys(receivedFailureInput).includes("cause"), "Failure input must not include cause.");
  assert(!Object.keys(receivedFailureInput).includes("rawError"), "Failure input must not include rawError.");

  let rejectedCompletionClaimCalls = 0;
  let rejectedCompletionRunCalls = 0;
  let rejectedCompletionCalls = 0;
  let rejectedCompletionFailureCalls = 0;
  const rejectedCompletionDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      rejectedCompletionClaimCalls += 1;
      return { kind: "claimed", job: jobFixture };
    },
    executeRun: async () => {
      rejectedCompletionRunCalls += 1;
      return runResultFixture;
    },
    completeJob: async () => {
      rejectedCompletionCalls += 1;
      return { kind: "rejected", reason: "not_updated" };
    },
    failJob: async () => {
      rejectedCompletionFailureCalls += 1;
      return failureResultFixture;
    },
  };
  const rejectedCompletionResult = await executeClaimedBacklinkVerificationJob(
    rejectedCompletionDependencies,
    {
      workspaceId,
      workerId: "worker-smoke-1",
      claimedAt: "2026-08-01T10:00:00.000Z",
      leaseDurationSeconds: 60,
      attemptedAt: "2026-08-01T10:00:00.000Z",
    },
  );
  assert(rejectedCompletionResult.kind === "completed", "Expected completed result with rejected completion.");
  assert(rejectedCompletionResult.completion.kind === "rejected", "Expected rejected completion.");
  assert(rejectedCompletionResult.completion.reason === "not_updated", "Expected not_updated completion.");
  assert(rejectedCompletionClaimCalls === 1, "Rejected completion claim must be called once.");
  assert(rejectedCompletionRunCalls === 1, "Rejected completion run must be called once.");
  assert(rejectedCompletionCalls === 1, "Rejected completion must be called once.");
  assert(rejectedCompletionFailureCalls === 0, "Failure must not follow a rejected completion.");

  const completionError = new Error("Deterministic completion failure");
  let completionErrorClaimCalls = 0;
  let completionErrorRunCalls = 0;
  let completionErrorCompletionCalls = 0;
  let completionErrorFailureCalls = 0;
  const completionErrorDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      completionErrorClaimCalls += 1;
      return { kind: "claimed", job: jobFixture };
    },
    executeRun: async () => {
      completionErrorRunCalls += 1;
      return runResultFixture;
    },
    completeJob: async () => {
      completionErrorCompletionCalls += 1;
      throw completionError;
    },
    failJob: async () => {
      completionErrorFailureCalls += 1;
      return failureResultFixture;
    },
  };
  const propagatedCompletionError = await assertRejects(
    () =>
      executeClaimedBacklinkVerificationJob(completionErrorDependencies, {
        workspaceId,
        workerId: "worker-smoke-1",
        claimedAt: "2026-08-01T10:00:00.000Z",
        leaseDurationSeconds: 60,
        attemptedAt: "2026-08-01T10:00:00.000Z",
      }),
    "Deterministic completion failure",
  );
  assert(propagatedCompletionError === completionError, "Completion error must be propagated unchanged.");
  assert(completionErrorClaimCalls === 1, "Completion error claim must be called once.");
  assert(completionErrorRunCalls === 1, "Completion error run must be called once.");
  assert(completionErrorCompletionCalls === 1, "Completion error completion must be called once.");
  assert(completionErrorFailureCalls === 0, "Failure must not follow a completion error.");

  let rejectedFailureClaimCalls = 0;
  let rejectedFailureRunCalls = 0;
  let rejectedFailureCompletionCalls = 0;
  let rejectedFailureCalls = 0;
  const rejectedFailureDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      rejectedFailureClaimCalls += 1;
      return { kind: "claimed", job: jobFixture };
    },
    executeRun: async () => {
      rejectedFailureRunCalls += 1;
      throw runError;
    },
    completeJob: async () => {
      rejectedFailureCompletionCalls += 1;
      return completionResultFixture;
    },
    failJob: async () => {
      rejectedFailureCalls += 1;
      return { kind: "rejected", reason: "not_updated" };
    },
  };
  const rejectedFailureResult = await executeClaimedBacklinkVerificationJob(
    rejectedFailureDependencies,
    {
      workspaceId,
      workerId: "worker-smoke-1",
      claimedAt: "2026-08-01T10:00:00.000Z",
      leaseDurationSeconds: 60,
      attemptedAt: "2026-08-01T10:00:00.000Z",
    },
  );
  assert(rejectedFailureResult.kind === "failed", "Expected failed result with rejected failure.");
  assert(rejectedFailureResult.failure.kind === "rejected", "Expected rejected failure.");
  assert(rejectedFailureResult.failure.reason === "not_updated", "Expected not_updated failure.");
  assert(rejectedFailureClaimCalls === 1, "Rejected failure claim must be called once.");
  assert(rejectedFailureRunCalls === 1, "Rejected failure run must be called once.");
  assert(rejectedFailureCompletionCalls === 0, "Completion must not follow a run error.");
  assert(rejectedFailureCalls === 1, "Rejected failure transition must be called once.");

  const terminalFailureError = new Error("Deterministic failure transition error");
  let failureErrorClaimCalls = 0;
  let failureErrorRunCalls = 0;
  let failureErrorCompletionCalls = 0;
  let failureErrorCalls = 0;
  const failureErrorDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      failureErrorClaimCalls += 1;
      return { kind: "claimed", job: jobFixture };
    },
    executeRun: async () => {
      failureErrorRunCalls += 1;
      throw runError;
    },
    completeJob: async () => {
      failureErrorCompletionCalls += 1;
      return completionResultFixture;
    },
    failJob: async () => {
      failureErrorCalls += 1;
      throw terminalFailureError;
    },
  };
  const propagatedFailureError = await assertRejects(
    () =>
      executeClaimedBacklinkVerificationJob(failureErrorDependencies, {
        workspaceId,
        workerId: "worker-smoke-1",
        claimedAt: "2026-08-01T10:00:00.000Z",
        leaseDurationSeconds: 60,
        attemptedAt: "2026-08-01T10:00:00.000Z",
      }),
    "Deterministic failure transition error",
  );
  assert(propagatedFailureError === terminalFailureError, "Failure transition error must be propagated unchanged.");
  assert(failureErrorClaimCalls === 1, "Failure error claim must be called once.");
  assert(failureErrorRunCalls === 1, "Failure error run must be called once.");
  assert(failureErrorCompletionCalls === 0, "Completion must not follow a run error.");
  assert(failureErrorCalls === 1, "Failure transition must be called exactly once.");

  const validInput = {
    workspaceId,
    workerId: "worker-smoke-1",
    claimedAt: "2026-08-01T10:00:00.000Z",
    leaseDurationSeconds: 60,
    attemptedAt: "2026-08-01T10:00:00.000Z",
  };
  const originalValidInput = { ...validInput };
  let invalidInputClaimCalls = 0;
  let invalidInputRunCalls = 0;
  let invalidInputCompletionCalls = 0;
  let invalidInputFailureCalls = 0;
  const invalidInputDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      invalidInputClaimCalls += 1;
      return { kind: "claimed", job: jobFixture };
    },
    executeRun: async () => {
      invalidInputRunCalls += 1;
      return runResultFixture;
    },
    completeJob: async () => {
      invalidInputCompletionCalls += 1;
      return completionResultFixture;
    },
    failJob: async () => {
      invalidInputFailureCalls += 1;
      return failureResultFixture;
    },
  };
  const assertNoInvalidInputDependenciesCalls = (): void => {
    assert(invalidInputClaimCalls === 0, "Invalid input must not call claim.");
    assert(invalidInputRunCalls === 0, "Invalid input must not call run.");
    assert(invalidInputCompletionCalls === 0, "Invalid input must not call completion.");
    assert(invalidInputFailureCalls === 0, "Invalid input must not call failure.");
  };

  await assertRejects(
    () => executeClaimedBacklinkVerificationJob(invalidInputDependencies, { ...validInput, workerId: "" }),
    "workerId must not be empty",
  );
  assertNoInvalidInputDependenciesCalls();
  await assertRejects(
    () => executeClaimedBacklinkVerificationJob(invalidInputDependencies, { ...validInput, workerId: "   " }),
    "workerId must not be empty",
  );
  assertNoInvalidInputDependenciesCalls();
  await assertRejects(
    () => executeClaimedBacklinkVerificationJob(invalidInputDependencies, { ...validInput, claimedAt: "not-a-date" }),
    "claimedAt must be a valid date",
  );
  assertNoInvalidInputDependenciesCalls();
  await assertRejects(
    () => executeClaimedBacklinkVerificationJob(invalidInputDependencies, { ...validInput, attemptedAt: "not-a-date" }),
    "attemptedAt must be a valid date",
  );
  assertNoInvalidInputDependenciesCalls();

  const invalidLeaseMessage = "leaseDurationSeconds must be an integer between 30 and 3600";
  await assertRejects(
    () => executeClaimedBacklinkVerificationJob(invalidInputDependencies, { ...validInput, leaseDurationSeconds: 29 }),
    invalidLeaseMessage,
  );
  assertNoInvalidInputDependenciesCalls();
  await assertRejects(
    () => executeClaimedBacklinkVerificationJob(invalidInputDependencies, { ...validInput, leaseDurationSeconds: 3601 }),
    invalidLeaseMessage,
  );
  assertNoInvalidInputDependenciesCalls();
  await assertRejects(
    () => executeClaimedBacklinkVerificationJob(invalidInputDependencies, { ...validInput, leaseDurationSeconds: 30.5 }),
    invalidLeaseMessage,
  );
  assertNoInvalidInputDependenciesCalls();
  await assertRejects(
    () => executeClaimedBacklinkVerificationJob(invalidInputDependencies, { ...validInput, leaseDurationSeconds: Number.NaN }),
    invalidLeaseMessage,
  );
  assertNoInvalidInputDependenciesCalls();
  await assertRejects(
    () => executeClaimedBacklinkVerificationJob(invalidInputDependencies, { ...validInput, leaseDurationSeconds: Number.POSITIVE_INFINITY }),
    invalidLeaseMessage,
  );
  assertNoInvalidInputDependenciesCalls();
  await assertRejects(
    () => executeClaimedBacklinkVerificationJob(invalidInputDependencies, { ...validInput, leaseDurationSeconds: Number.NEGATIVE_INFINITY }),
    invalidLeaseMessage,
  );
  assertNoInvalidInputDependenciesCalls();
  assert(validInput.workerId === originalValidInput.workerId, "Valid workerId must not be mutated.");
  assert(validInput.workspaceId === originalValidInput.workspaceId, "Valid workspaceId must not be mutated.");
  assert(validInput.claimedAt === originalValidInput.claimedAt, "Valid claimedAt must not be mutated.");
  assert(validInput.attemptedAt === originalValidInput.attemptedAt, "Valid attemptedAt must not be mutated.");
  assert(validInput.leaseDurationSeconds === originalValidInput.leaseDurationSeconds, "Valid lease duration must not be mutated.");

  let nonErrorClaimCalls = 0;
  let nonErrorRunCalls = 0;
  let nonErrorCompletionCalls = 0;
  let nonErrorFailureCalls = 0;
  const nonErrorFailureInputs: FailBacklinkVerificationJobInput[] = [];
  const nonErrorDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      nonErrorClaimCalls += 1;
      return { kind: "claimed", job: jobFixture };
    },
    executeRun: async () => {
      nonErrorRunCalls += 1;
      return Promise.reject("non-error failure");
    },
    completeJob: async () => {
      nonErrorCompletionCalls += 1;
      return completionResultFixture;
    },
    failJob: async (failureInput) => {
      nonErrorFailureCalls += 1;
      nonErrorFailureInputs.push(failureInput);
      return failureResultFixture;
    },
  };
  const nonErrorResult = await executeClaimedBacklinkVerificationJob(nonErrorDependencies, validInput);
  assert(nonErrorResult.kind === "failed", "Expected failed result for a non-Error rejection.");
  assert(nonErrorResult.error.code === "BACKLINK_VERIFICATION_RUN_FAILED", "Expected fallback code for a non-Error rejection.");
  assert(nonErrorResult.error.message === "Backlink verification run failed", "Expected fallback message for a non-Error rejection.");
  assert(nonErrorClaimCalls === 1, "Non-Error claim must be called once.");
  assert(nonErrorRunCalls === 1, "Non-Error run must be called once.");
  assert(nonErrorCompletionCalls === 0, "Non-Error completion must not be called.");
  assert(nonErrorFailureCalls === 1, "Non-Error failure must be called once.");
  const nonErrorFailureInput = nonErrorFailureInputs[0];
  assert(nonErrorFailureInput != null, "Expected non-Error failure input.");
  assert(nonErrorFailureInput.errorCode === "BACKLINK_VERIFICATION_RUN_FAILED", "Expected fallback failure code.");
  assert(nonErrorFailureInput.errorMessage === "Backlink verification run failed", "Expected fallback failure message.");

  const errorWithEmptyName = new Error("Deterministic named failure");
  errorWithEmptyName.name = "";
  let emptyNameClaimCalls = 0;
  let emptyNameRunCalls = 0;
  let emptyNameCompletionCalls = 0;
  let emptyNameFailureCalls = 0;
  const emptyNameDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      emptyNameClaimCalls += 1;
      return { kind: "claimed", job: jobFixture };
    },
    executeRun: async () => {
      emptyNameRunCalls += 1;
      throw errorWithEmptyName;
    },
    completeJob: async () => {
      emptyNameCompletionCalls += 1;
      return completionResultFixture;
    },
    failJob: async () => {
      emptyNameFailureCalls += 1;
      return failureResultFixture;
    },
  };
  const emptyNameResult = await executeClaimedBacklinkVerificationJob(emptyNameDependencies, validInput);
  assert(emptyNameResult.kind === "failed", "Expected failed result for an empty error name.");
  assert(emptyNameResult.error.code === "BACKLINK_VERIFICATION_RUN_FAILED", "Expected fallback code for an empty error name.");
  assert(emptyNameResult.error.message === "Deterministic named failure", "Expected preserved error message.");
  assert(emptyNameClaimCalls === 1, "Empty-name claim must be called once.");
  assert(emptyNameRunCalls === 1, "Empty-name run must be called once.");
  assert(emptyNameCompletionCalls === 0, "Empty-name completion must not be called.");
  assert(emptyNameFailureCalls === 1, "Empty-name failure must be called once.");

  const errorWithEmptyMessage = new Error("");
  errorWithEmptyMessage.name = "DeterministicError";
  let emptyMessageClaimCalls = 0;
  let emptyMessageRunCalls = 0;
  let emptyMessageCompletionCalls = 0;
  let emptyMessageFailureCalls = 0;
  const emptyMessageDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      emptyMessageClaimCalls += 1;
      return { kind: "claimed", job: jobFixture };
    },
    executeRun: async () => {
      emptyMessageRunCalls += 1;
      throw errorWithEmptyMessage;
    },
    completeJob: async () => {
      emptyMessageCompletionCalls += 1;
      return completionResultFixture;
    },
    failJob: async () => {
      emptyMessageFailureCalls += 1;
      return failureResultFixture;
    },
  };
  const emptyMessageResult = await executeClaimedBacklinkVerificationJob(emptyMessageDependencies, validInput);
  assert(emptyMessageResult.kind === "failed", "Expected failed result for an empty error message.");
  assert(emptyMessageResult.error.code === "DeterministicError", "Expected preserved error name.");
  assert(emptyMessageResult.error.message === "Backlink verification run failed", "Expected fallback message for an empty error message.");
  assert(emptyMessageClaimCalls === 1, "Empty-message claim must be called once.");
  assert(emptyMessageRunCalls === 1, "Empty-message run must be called once.");
  assert(emptyMessageCompletionCalls === 0, "Empty-message completion must not be called.");
  assert(emptyMessageFailureCalls === 1, "Empty-message failure must be called once.");

  const emptyError = new Error("");
  emptyError.name = "";
  let emptyErrorClaimCalls = 0;
  let emptyErrorRunCalls = 0;
  let emptyErrorCompletionCalls = 0;
  let emptyErrorFailureCalls = 0;
  const emptyErrorDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      emptyErrorClaimCalls += 1;
      return { kind: "claimed", job: jobFixture };
    },
    executeRun: async () => {
      emptyErrorRunCalls += 1;
      throw emptyError;
    },
    completeJob: async () => {
      emptyErrorCompletionCalls += 1;
      return completionResultFixture;
    },
    failJob: async () => {
      emptyErrorFailureCalls += 1;
      return failureResultFixture;
    },
  };
  const emptyErrorResult = await executeClaimedBacklinkVerificationJob(emptyErrorDependencies, validInput);
  assert(emptyErrorResult.kind === "failed", "Expected failed result for an empty error.");
  assert(emptyErrorResult.error.code === "BACKLINK_VERIFICATION_RUN_FAILED", "Expected fallback code for an empty error.");
  assert(emptyErrorResult.error.message === "Backlink verification run failed", "Expected fallback message for an empty error.");
  assert(emptyErrorClaimCalls === 1, "Empty-error claim must be called once.");
  assert(emptyErrorRunCalls === 1, "Empty-error run must be called once.");
  assert(emptyErrorCompletionCalls === 0, "Empty-error completion must not be called.");
  assert(emptyErrorFailureCalls === 1, "Empty-error failure must be called once.");

  let fetchSummaryClaimCalls = 0;
  let fetchSummaryRunCalls = 0;
  let fetchSummaryCompletionCalls = 0;
  let fetchSummaryFailureCalls = 0;
  const fetchSummaryInputs: CompleteBacklinkVerificationJobInput[] = [];
  const fetchSummaryDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async () => {
      fetchSummaryClaimCalls += 1;
      return { kind: "claimed", job: jobFixture };
    },
    executeRun: async () => {
      fetchSummaryRunCalls += 1;
      return fetchErrorRunResultFixture;
    },
    completeJob: async (summaryInput) => {
      fetchSummaryCompletionCalls += 1;
      fetchSummaryInputs.push(summaryInput);
      return completionResultFixture;
    },
    failJob: async () => {
      fetchSummaryFailureCalls += 1;
      return failureResultFixture;
    },
  };
  const fetchSummaryResult = await executeClaimedBacklinkVerificationJob(fetchSummaryDependencies, validInput);
  assert(fetchSummaryResult.kind === "completed", "Expected completed result for fetch-error runtime.");
  assert(fetchSummaryClaimCalls === 1, "Fetch-summary claim must be called once.");
  assert(fetchSummaryRunCalls === 1, "Fetch-summary run must be called once.");
  assert(fetchSummaryCompletionCalls === 1, "Fetch-summary completion must be called once.");
  assert(fetchSummaryFailureCalls === 0, "Fetch-summary failure must not be called.");
  const fetchSummaryInput = fetchSummaryInputs[0];
  assert(fetchSummaryInput != null, "Expected fetch-error completion input.");
  const fetchSummary = fetchSummaryInput.resultSummary;
  assert(fetchSummary != null && typeof fetchSummary === "object" && !Array.isArray(fetchSummary), "Expected fetch-error summary object.");
  assert(
    JSON.stringify(Object.keys(fetchSummary).sort()) ===
      JSON.stringify(["persistenceKind", "runtimeKind", "verificationStatus"]),
    "Fetch-error summary must contain exactly the expected keys.",
  );
  assert(fetchSummary.runtimeKind === "fetch_error", "Expected fetch_error runtime summary.");
  assert(fetchSummary.persistenceKind === "skipped", "Expected skipped persistence summary.");
  assert(fetchSummary.verificationStatus === null, "Expected null verification status for fetch_error.");
  for (const sensitiveKey of ["html", "headers", "stack", "error", "attempt", "link", "runtimeResult", "persistenceResult"]) {
    assert(!Object.keys(fetchSummary).includes(sensitiveKey), `Fetch-error summary must not include ${sensitiveKey}.`);
  }

  const jobAFixture: BacklinkVerificationJob = {
    ...jobFixture,
    id: "00000000-0000-4000-8000-000000000010",
    workspaceId: "00000000-0000-4000-8000-000000000020",
    linkId: "00000000-0000-4000-8000-000000000011",
    jobKey: "manual:claimed-job-smoke-a",
    workerId: "worker-A",
  };
  const jobBFixture: BacklinkVerificationJob = {
    ...jobFixture,
    id: "00000000-0000-4000-8000-000000000012",
    workspaceId: "00000000-0000-4000-8000-000000000021",
    linkId: "00000000-0000-4000-8000-000000000013",
    jobKey: "manual:claimed-job-smoke-b",
    workerId: "worker-B",
  };
  const statelessInputA = {
    workspaceId: "00000000-0000-4000-8000-000000000010",
    workerId: "worker-A",
    claimedAt: "2026-08-01T10:01:00.000Z",
    leaseDurationSeconds: 60,
    attemptedAt: "2026-08-01T10:02:00.000Z",
  };
  const statelessInputB = {
    workspaceId: "00000000-0000-4000-8000-000000000012",
    workerId: "worker-B",
    claimedAt: "2026-08-01T10:03:00.000Z",
    leaseDurationSeconds: 60,
    attemptedAt: "2026-08-01T10:04:00.000Z",
  };
  const originalInputA = { ...statelessInputA };
  const originalJobA = jobAFixture;
  const originalJobAFields = {
    workspaceId: jobAFixture.workspaceId,
    linkId: jobAFixture.linkId,
    policy: jobAFixture.policy,
    http: jobAFixture.http,
    workerId: jobAFixture.workerId,
    status: jobAFixture.status,
  };
  const originalRunResult = runResultFixture;
  const originalRunFields = {
    runtimeResult: runResultFixture.runtimeResult,
    attempt: runResultFixture.attempt,
    persistenceResult: runResultFixture.persistenceResult,
    link: runResultFixture.link,
  };
  const originalRuntimeResult = runResultFixture.runtimeResult;
  const originalAttempt = runResultFixture.attempt;
  const originalPersistenceResult = runResultFixture.persistenceResult;
  const originalLink = runResultFixture.link;
  const originalCompletionResult = completionResultFixture;
  const originalFailureResult = failureResultFixture;
  let statelessClaimCalls = 0;
  let statelessRunCalls = 0;
  let statelessCompletionCalls = 0;
  let statelessFailureCalls = 0;
  const statelessClaimInputs: ClaimNextBacklinkVerificationJobInput[] = [];
  const statelessRunInputs: ExecuteBacklinkVerificationRunInput[] = [];
  const statelessRunDependencies: ExecuteBacklinkVerificationRunDependencies[] = [];
  const statelessCompletionInputs: CompleteBacklinkVerificationJobInput[] = [];
  const statelessSummaryReferences: CompleteBacklinkVerificationJobInput["resultSummary"][] = [];
  const statelessSummarySnapshots: string[] = [];
  const statelessDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    claimNextJob: async (input) => {
      statelessClaimCalls += 1;
      statelessClaimInputs.push(input);
      return {
        kind: "claimed",
        job: statelessClaimCalls === 1 ? jobAFixture : jobBFixture,
      };
    },
    executeRun: async (runInput, runDependencies) => {
      statelessRunCalls += 1;
      statelessRunInputs.push(runInput);
      statelessRunDependencies.push(runDependencies);
      return runResultFixture;
    },
    completeJob: async (completionInput) => {
      statelessCompletionCalls += 1;
      statelessCompletionInputs.push(completionInput);
      statelessSummaryReferences.push(completionInput.resultSummary);
      statelessSummarySnapshots.push(JSON.stringify(completionInput.resultSummary));
      return completionResultFixture;
    },
    failJob: async () => {
      statelessFailureCalls += 1;
      return failureResultFixture;
    },
  };
  const statelessResultA = await executeClaimedBacklinkVerificationJob(
    statelessDependencies,
    statelessInputA,
  );
  const statelessResultB = await executeClaimedBacklinkVerificationJob(
    statelessDependencies,
    statelessInputB,
  );

  assert(statelessResultA.kind === "completed", "Expected first stateless completed result.");
  assert(statelessResultB.kind === "completed", "Expected second stateless completed result.");
  assert(statelessResultA.job === originalJobA, "First result must propagate job A by reference.");
  assert(statelessResultB.job === jobBFixture, "Second result must propagate job B by reference.");
  assert(statelessResultA.run === originalRunResult, "Run result must be propagated by reference.");
  assert(statelessResultA.run.runtimeResult === originalRuntimeResult && statelessResultA.run.runtimeResult === originalRunFields.runtimeResult, "Runtime result must not be replaced.");
  assert(statelessResultA.run.attempt === originalAttempt && statelessResultA.run.attempt === originalRunFields.attempt, "Attempt must not be replaced.");
  assert(statelessResultA.run.persistenceResult === originalPersistenceResult && statelessResultA.run.persistenceResult === originalRunFields.persistenceResult, "Persistence result must not be replaced.");
  assert(statelessResultA.run.link === originalLink && statelessResultA.run.link === originalRunFields.link, "Link must not be replaced.");
  assert(statelessResultA.completion === originalCompletionResult, "Completion result must be propagated by reference.");
  assert(failedResult.failure === originalFailureResult, "Failure result must be propagated by reference.");
  assert(statelessInputA.workerId === originalInputA.workerId, "Orchestrator workerId input must not be mutated.");
  assert(statelessInputA.workspaceId === originalInputA.workspaceId, "Orchestrator workspaceId input must not be mutated.");
  assert(statelessInputA.claimedAt === originalInputA.claimedAt, "Orchestrator claimedAt input must not be mutated.");
  assert(statelessInputA.leaseDurationSeconds === originalInputA.leaseDurationSeconds, "Orchestrator lease input must not be mutated.");
  assert(statelessInputA.attemptedAt === originalInputA.attemptedAt, "Orchestrator attemptedAt input must not be mutated.");
  assert(jobAFixture.workspaceId === originalJobAFields.workspaceId, "Job workspaceId must not be mutated.");
  assert(jobAFixture.linkId === originalJobAFields.linkId, "Job linkId must not be mutated.");
  assert(jobAFixture.policy === originalJobAFields.policy, "Job policy must not be replaced.");
  assert(jobAFixture.http === originalJobAFields.http, "Job HTTP options must not be replaced.");
  assert(jobAFixture.workerId === originalJobAFields.workerId, "Job workerId must not be mutated.");
  assert(jobAFixture.status === originalJobAFields.status, "Job status must not be mutated.");
  assert(statelessClaimCalls === 2, "Stateless claim must be called twice.");
  assert(statelessRunCalls === 2, "Stateless run must be called twice.");
  assert(statelessCompletionCalls === 2, "Stateless completion must be called twice.");
  assert(statelessFailureCalls === 0, "Stateless failure must not be called.");
  assert(statelessClaimInputs[0]?.workspaceId === statelessInputA.workspaceId, "First claim must use input A workspaceId.");
  assert(statelessClaimInputs[1]?.workspaceId === statelessInputB.workspaceId, "Second claim must use input B workspaceId.");
  assert(statelessClaimInputs[0]?.workspaceId !== statelessClaimInputs[1]?.workspaceId, "Stateless claims must not mix workspaces.");
  const firstRunInput = statelessRunInputs[0];
  const secondRunInput = statelessRunInputs[1];
  assert(firstRunInput != null && secondRunInput != null, "Expected two run inputs.");
  assert(
    JSON.stringify(Object.keys(firstRunInput).sort()) ===
      JSON.stringify(["attemptedAt", "http", "linkId", "policy", "workspaceId"]),
    "Run input must contain exactly the expected keys.",
  );
  assert(firstRunInput.workspaceId === jobAFixture.workspaceId, "First run must use job A workspaceId.");
  assert(firstRunInput.linkId === jobAFixture.linkId, "First run must use job A linkId.");
  assert(firstRunInput.attemptedAt === statelessInputA.attemptedAt, "First run must use input A attemptedAt.");
  assert(firstRunInput.policy === jobAFixture.policy, "First run must use job A policy by reference.");
  assert(firstRunInput.http === jobAFixture.http, "First run must use job A HTTP options by reference.");
  assert(secondRunInput.workspaceId === jobBFixture.workspaceId, "Second run must use job B workspaceId.");
  assert(secondRunInput.linkId === jobBFixture.linkId, "Second run must use job B linkId.");
  assert(secondRunInput.attemptedAt === statelessInputB.attemptedAt, "Second run must use input B attemptedAt.");
  assert(secondRunInput.policy === jobBFixture.policy, "Second run must use job B policy by reference.");
  assert(secondRunInput.http === jobBFixture.http, "Second run must use job B HTTP options by reference.");
  assert(statelessRunDependencies[0] === statelessDependencies.runDependencies, "First run must receive the injected dependencies by reference.");
  assert(statelessRunDependencies[1] === statelessDependencies.runDependencies, "Second run must receive the injected dependencies by reference.");
  const firstSummary = statelessCompletionInputs[0]?.resultSummary;
  const secondSummary = statelessCompletionInputs[1]?.resultSummary;
  assert(firstSummary != null && secondSummary != null, "Expected two completion summaries.");
  assert(firstSummary === statelessSummaryReferences[0], "First resultSummary must remain the captured reference.");
  assert(secondSummary === statelessSummaryReferences[1], "Second resultSummary must remain the captured reference.");
  assert(JSON.stringify(firstSummary) === statelessSummarySnapshots[0], "First resultSummary must not be mutated by completion.");
  assert(JSON.stringify(secondSummary) === statelessSummarySnapshots[1], "Second resultSummary must not be mutated by completion.");
  void assertRejects;
  console.log("PASS — Claimed backlink verification orchestrator smoke");
}

void main();
