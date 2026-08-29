import {
  claimNextVerificationJob,
  completeVerificationJob,
  extendVerificationJobLease,
  failVerificationJob,
  reclaimExpiredBacklinkVerificationJobs,
} from "../lib/backlinks/verification";
import type {
  BacklinkVerificationJob,
  ClaimNextBacklinkVerificationJobInput,
  ClaimNextVerificationJobDependencies,
  CompleteVerificationJobDependencies,
  ExtendVerificationJobLeaseDependencies,
  FailVerificationJobDependencies,
  ReclaimExpiredBacklinkVerificationJobsDependencies,
} from "../lib/backlinks/verification";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejects(operation: () => Promise<unknown>, expectedMessage: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, "Expected an Error instance.");
    assert(error.message.includes(expectedMessage), `Expected error message to include ${expectedMessage}.`);
    return;
  }
  throw new Error("Expected operation to reject.");
}

async function captureRejection(operation: () => Promise<unknown>): Promise<Error> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, "Expected an Error instance.");
    return error;
  }
  throw new Error("Expected operation to reject.");
}

const jobFixture: BacklinkVerificationJob = {
  id: "00000000-0000-4000-8000-000000000001", workspaceId: "00000000-0000-4000-8000-000000000002", linkId: "00000000-0000-4000-8000-000000000003", jobKey: "manual:smoke", triggerSource: "manual", status: "running", policy: {}, http: { timeoutMs: 1000, maxRedirects: 3, maxResponseBytes: 10000 }, attemptCount: 1, maxAttempts: 1, queuedAt: "2026-07-31T12:00:00.000Z", startedAt: "2026-07-31T12:00:00.000Z", completedAt: null, failedAt: null, lastErrorCode: null, lastErrorMessage: null, createdAt: "2026-07-31T12:00:00.000Z", updatedAt: "2026-07-31T12:00:00.000Z", workerId: "worker-smoke-1", claimedAt: "2026-07-31T12:00:00.000Z", leaseExpiresAt: "2026-07-31T12:01:00.000Z", heartbeatAt: "2026-07-31T12:00:00.000Z",
};

const workspaceId = "00000000-0000-4000-8000-000000000099";
const claimInputs: ClaimNextBacklinkVerificationJobInput[] = [];
const claimDependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async (input) => { claimInputs.push(input); return jobFixture; } };
const heartbeatDependencies: ExtendVerificationJobLeaseDependencies = { heartbeatBacklinkVerificationJob: async () => jobFixture };
const reclaimDependencies: ReclaimExpiredBacklinkVerificationJobsDependencies = { reclaimExpiredBacklinkVerificationJobs: async () => [{ ...jobFixture, status: "queued", maxAttempts: 2, workerId: null, claimedAt: null, heartbeatAt: null, leaseExpiresAt: null, attemptCount: 1 }] };
const exhaustedReclaimDependencies: ReclaimExpiredBacklinkVerificationJobsDependencies = { reclaimExpiredBacklinkVerificationJobs: async () => [{ ...jobFixture, status: "failed", failedAt: "2026-07-31T12:02:00.000Z", lastErrorCode: "verification_job_lease_expired", lastErrorMessage: "Backlink verification job lease expired before completion.", attemptCount: 1, maxAttempts: 1 }] };
const completeDependencies: CompleteVerificationJobDependencies = { completeBacklinkVerificationJob: async () => jobFixture };
const failDependencies: FailVerificationJobDependencies = { failBacklinkVerificationJob: async () => jobFixture };
const emptyClaimDependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async () => null };
const rejectedHeartbeatDependencies: ExtendVerificationJobLeaseDependencies = { heartbeatBacklinkVerificationJob: async () => null };
const rejectedCompletionDependencies: CompleteVerificationJobDependencies = { completeBacklinkVerificationJob: async () => null };
const rejectedFailureDependencies: FailVerificationJobDependencies = { failBacklinkVerificationJob: async () => null };

async function main(): Promise<void> {
  assert((await claimNextVerificationJob(claimDependencies, { workspaceId, workerId: "worker-smoke-1", claimedAt: "2026-07-31T12:00:00.000Z", leaseDurationSeconds: 60 })).kind === "claimed", "Expected claimed.");
  const receivedClaimInput = claimInputs[0];
  assert(receivedClaimInput != null, "Expected claim dependency input.");
  assert(JSON.stringify(Object.keys(receivedClaimInput).sort()) === JSON.stringify(["claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Claim dependency input must contain exactly the expected keys.");
  assert(receivedClaimInput.workspaceId === workspaceId && receivedClaimInput.workerId === "worker-smoke-1" && receivedClaimInput.claimedAt === "2026-07-31T12:00:00.000Z" && receivedClaimInput.leaseDurationSeconds === 60, "Claim dependency input must preserve workspace and claim values.");
  assert((await extendVerificationJobLease(heartbeatDependencies, { jobId: jobFixture.id, workerId: "worker-smoke-1", heartbeatAt: "2026-07-31T12:00:30.000Z", leaseDurationSeconds: 60 })).kind === "extended", "Expected extended.");
  const reclaimed = await reclaimExpiredBacklinkVerificationJobs(reclaimDependencies, { workspaceId: jobFixture.workspaceId, reclaimedAt: "2026-07-31T12:02:00.000Z", limit: 1 });
  assert(reclaimed.kind === "reclaimed", "Expected reclaimed.");
  assert(reclaimed.jobs.length === 1, "Expected one reclaimed job.");
  assert(reclaimed.jobs[0]?.status === "queued", "Reclaimed job must be queued.");
  assert(reclaimed.jobs[0]?.attemptCount === 1, "Reclaimed job must preserve the consumed claim count.");
  assert(reclaimed.jobs[0]?.workerId === null && reclaimed.jobs[0]?.leaseExpiresAt === null, "Reclaimed job must clear lease ownership fields.");
  const exhausted = await reclaimExpiredBacklinkVerificationJobs(exhaustedReclaimDependencies, { workspaceId: jobFixture.workspaceId, reclaimedAt: "2026-07-31T12:02:00.000Z", limit: 1 });
  assert(exhausted.kind === "reclaimed", "Expected exhausted reclaim result.");
  assert(exhausted.jobs[0]?.status === "failed", "Exhausted reclaimed job must be failed.");
  assert(exhausted.jobs[0]?.attemptCount === 1, "Exhausted reclaimed job must preserve attempt count.");
  assert(exhausted.jobs[0]?.lastErrorCode === "verification_job_lease_expired", "Exhausted reclaimed job must expose stable lease-expired error code.");
  assert((await completeVerificationJob(completeDependencies, { jobId: jobFixture.id, workerId: "worker-smoke-1", completedAt: "2026-07-31T12:00:30.000Z", resultSummary: null })).kind === "completed", "Expected completed.");
  assert((await failVerificationJob(failDependencies, { jobId: jobFixture.id, workerId: "worker-smoke-1", failedAt: "2026-07-31T12:00:30.000Z", errorCode: "SMOKE", errorMessage: "Smoke failure" })).kind === "failed", "Expected failed.");
  assert((await claimNextVerificationJob(emptyClaimDependencies, { workspaceId, workerId: "worker-smoke-1", claimedAt: "2026-07-31T12:00:00.000Z", leaseDurationSeconds: 60 })).kind === "empty", "Expected empty.");
  const rejectedHeartbeat = await extendVerificationJobLease(rejectedHeartbeatDependencies, { jobId: jobFixture.id, workerId: "worker-smoke-1", heartbeatAt: "2026-07-31T12:00:30.000Z", leaseDurationSeconds: 60 });
  assert(rejectedHeartbeat.kind === "rejected", "Expected rejected heartbeat.");
  assert(rejectedHeartbeat.reason === "not_updated", "Expected not_updated heartbeat.");
  const rejectedCompletion = await completeVerificationJob(rejectedCompletionDependencies, { jobId: jobFixture.id, workerId: "worker-smoke-1", completedAt: "2026-07-31T12:00:30.000Z", resultSummary: null });
  assert(rejectedCompletion.kind === "rejected", "Expected rejected completion.");
  assert(rejectedCompletion.reason === "not_updated", "Expected not_updated completion.");
  const rejectedFailure = await failVerificationJob(rejectedFailureDependencies, { jobId: jobFixture.id, workerId: "worker-smoke-1", failedAt: "2026-07-31T12:00:30.000Z", errorCode: "SMOKE", errorMessage: "Smoke failure" });
  assert(rejectedFailure.kind === "rejected", "Expected rejected failure.");
  assert(rejectedFailure.reason === "not_updated", "Expected not_updated failure.");
  const validClaimInput = { workspaceId, workerId: "worker-smoke-1", claimedAt: "2026-07-31T12:00:00.000Z", leaseDurationSeconds: 60 };
  const validHeartbeatInput = { jobId: jobFixture.id, workerId: "worker-smoke-1", heartbeatAt: "2026-07-31T12:00:30.000Z", leaseDurationSeconds: 60 };
  const validCompletionInput = { jobId: jobFixture.id, workerId: "worker-smoke-1", completedAt: "2026-07-31T12:00:30.000Z", resultSummary: null };
  const validFailureInput = { jobId: jobFixture.id, workerId: "worker-smoke-1", failedAt: "2026-07-31T12:00:30.000Z", errorCode: "SMOKE", errorMessage: "Smoke failure" };
  let invalidClaimCalls = 0;
  const invalidClaimDependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async () => { invalidClaimCalls += 1; return jobFixture; } };
  await assertRejects(() => claimNextVerificationJob(invalidClaimDependencies, { ...validClaimInput, workerId: "" }), "workerId must not be empty");
  await assertRejects(() => claimNextVerificationJob(invalidClaimDependencies, { ...validClaimInput, workerId: "   " }), "workerId must not be empty");
  await assertRejects(() => claimNextVerificationJob(invalidClaimDependencies, { ...validClaimInput, workerId: "x".repeat(256) }), "workerId must not exceed 255 characters");
  await assertRejects(() => claimNextVerificationJob(invalidClaimDependencies, { ...validClaimInput, claimedAt: "not-a-date" }), "claimedAt must be a valid date");
  assert(invalidClaimCalls === 0, "Invalid claim inputs must not call dependencies.");

  let invalidHeartbeatCalls = 0;
  const invalidHeartbeatDependencies: ExtendVerificationJobLeaseDependencies = { heartbeatBacklinkVerificationJob: async () => { invalidHeartbeatCalls += 1; return jobFixture; } };
  await assertRejects(() => extendVerificationJobLease(invalidHeartbeatDependencies, { ...validHeartbeatInput, jobId: "" }), "jobId must not be empty");
  await assertRejects(() => extendVerificationJobLease(invalidHeartbeatDependencies, { ...validHeartbeatInput, heartbeatAt: "not-a-date" }), "heartbeatAt must be a valid date");
  assert(invalidHeartbeatCalls === 0, "Invalid heartbeat inputs must not call dependencies.");

  let invalidReclaimCalls = 0;
  const invalidReclaimDependencies: ReclaimExpiredBacklinkVerificationJobsDependencies = { reclaimExpiredBacklinkVerificationJobs: async () => { invalidReclaimCalls += 1; return []; } };
  const validReclaimInput = { workspaceId: jobFixture.workspaceId, reclaimedAt: "2026-07-31T12:02:00.000Z", limit: 1, jobId: jobFixture.id };
  await assertRejects(() => reclaimExpiredBacklinkVerificationJobs(invalidReclaimDependencies, { ...validReclaimInput, workspaceId: "bad" }), "workspaceId must be a valid UUID");
  await assertRejects(() => reclaimExpiredBacklinkVerificationJobs(invalidReclaimDependencies, { ...validReclaimInput, reclaimedAt: "not-a-date" }), "reclaimedAt must be a valid date");
  await assertRejects(() => reclaimExpiredBacklinkVerificationJobs(invalidReclaimDependencies, { ...validReclaimInput, limit: 0 }), "limit must be an integer between 1 and 100");
  await assertRejects(() => reclaimExpiredBacklinkVerificationJobs(invalidReclaimDependencies, { ...validReclaimInput, limit: 101 }), "limit must be an integer between 1 and 100");
  await assertRejects(() => reclaimExpiredBacklinkVerificationJobs(invalidReclaimDependencies, { ...validReclaimInput, jobId: "bad" }), "jobId must be a valid UUID");
  assert(invalidReclaimCalls === 0, "Invalid reclaim inputs must not call dependencies.");

  let invalidCompletionCalls = 0;
  const invalidCompletionDependencies: CompleteVerificationJobDependencies = { completeBacklinkVerificationJob: async () => { invalidCompletionCalls += 1; return jobFixture; } };
  await assertRejects(() => completeVerificationJob(invalidCompletionDependencies, { ...validCompletionInput, jobId: "   " }), "jobId must not be empty");
  await assertRejects(() => completeVerificationJob(invalidCompletionDependencies, { ...validCompletionInput, completedAt: "not-a-date" }), "completedAt must be a valid date");
  assert(invalidCompletionCalls === 0, "Invalid completion inputs must not call dependencies.");

  let invalidFailureCalls = 0;
  const invalidFailureDependencies: FailVerificationJobDependencies = { failBacklinkVerificationJob: async () => { invalidFailureCalls += 1; return jobFixture; } };
  await assertRejects(() => failVerificationJob(invalidFailureDependencies, { ...validFailureInput, jobId: "" }), "jobId must not be empty");
  await assertRejects(() => failVerificationJob(invalidFailureDependencies, { ...validFailureInput, failedAt: "not-a-date" }), "failedAt must be a valid date");
  assert(invalidFailureCalls === 0, "Invalid failure inputs must not call dependencies.");

  let minimumClaimCalls = 0;
  const minimumClaimDependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async () => { minimumClaimCalls += 1; return jobFixture; } };
  assert((await claimNextVerificationJob(minimumClaimDependencies, { ...validClaimInput, leaseDurationSeconds: 30 })).kind === "claimed", "Expected minimum lease claim.");
  assert(minimumClaimCalls === 1, "Minimum lease claim must call dependencies exactly once.");

  let maximumClaimCalls = 0;
  const maximumClaimDependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async () => { maximumClaimCalls += 1; return jobFixture; } };
  assert((await claimNextVerificationJob(maximumClaimDependencies, { ...validClaimInput, leaseDurationSeconds: 3600 })).kind === "claimed", "Expected maximum lease claim.");
  assert(maximumClaimCalls === 1, "Maximum lease claim must call dependencies exactly once.");

  let minimumHeartbeatCalls = 0;
  const minimumHeartbeatDependencies: ExtendVerificationJobLeaseDependencies = { heartbeatBacklinkVerificationJob: async () => { minimumHeartbeatCalls += 1; return jobFixture; } };
  assert((await extendVerificationJobLease(minimumHeartbeatDependencies, { ...validHeartbeatInput, leaseDurationSeconds: 30 })).kind === "extended", "Expected minimum lease heartbeat.");
  assert(minimumHeartbeatCalls === 1, "Minimum lease heartbeat must call dependencies exactly once.");

  let maximumHeartbeatCalls = 0;
  const maximumHeartbeatDependencies: ExtendVerificationJobLeaseDependencies = { heartbeatBacklinkVerificationJob: async () => { maximumHeartbeatCalls += 1; return jobFixture; } };
  assert((await extendVerificationJobLease(maximumHeartbeatDependencies, { ...validHeartbeatInput, leaseDurationSeconds: 3600 })).kind === "extended", "Expected maximum lease heartbeat.");
  assert(maximumHeartbeatCalls === 1, "Maximum lease heartbeat must call dependencies exactly once.");

  let invalidLeaseClaimCalls = 0;
  const invalidLeaseClaimDependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async () => { invalidLeaseClaimCalls += 1; return jobFixture; } };
  await assertRejects(() => claimNextVerificationJob(invalidLeaseClaimDependencies, { ...validClaimInput, leaseDurationSeconds: 29 }), "leaseDurationSeconds must be an integer between 30 and 3600");
  await assertRejects(() => claimNextVerificationJob(invalidLeaseClaimDependencies, { ...validClaimInput, leaseDurationSeconds: 3601 }), "leaseDurationSeconds must be an integer between 30 and 3600");
  await assertRejects(() => claimNextVerificationJob(invalidLeaseClaimDependencies, { ...validClaimInput, leaseDurationSeconds: 30.5 }), "leaseDurationSeconds must be an integer between 30 and 3600");
  await assertRejects(() => claimNextVerificationJob(invalidLeaseClaimDependencies, { ...validClaimInput, leaseDurationSeconds: Number.NaN }), "leaseDurationSeconds must be an integer between 30 and 3600");
  await assertRejects(() => claimNextVerificationJob(invalidLeaseClaimDependencies, { ...validClaimInput, leaseDurationSeconds: Number.POSITIVE_INFINITY }), "leaseDurationSeconds must be an integer between 30 and 3600");
  await assertRejects(() => claimNextVerificationJob(invalidLeaseClaimDependencies, { ...validClaimInput, leaseDurationSeconds: Number.NEGATIVE_INFINITY }), "leaseDurationSeconds must be an integer between 30 and 3600");
  assert(invalidLeaseClaimCalls === 0, "Invalid claim lease durations must not call dependencies.");

  let invalidLeaseHeartbeatCalls = 0;
  const invalidLeaseHeartbeatDependencies: ExtendVerificationJobLeaseDependencies = { heartbeatBacklinkVerificationJob: async () => { invalidLeaseHeartbeatCalls += 1; return jobFixture; } };
  await assertRejects(() => extendVerificationJobLease(invalidLeaseHeartbeatDependencies, { ...validHeartbeatInput, leaseDurationSeconds: 29 }), "leaseDurationSeconds must be an integer between 30 and 3600");
  await assertRejects(() => extendVerificationJobLease(invalidLeaseHeartbeatDependencies, { ...validHeartbeatInput, leaseDurationSeconds: 3601 }), "leaseDurationSeconds must be an integer between 30 and 3600");
  await assertRejects(() => extendVerificationJobLease(invalidLeaseHeartbeatDependencies, { ...validHeartbeatInput, leaseDurationSeconds: 30.5 }), "leaseDurationSeconds must be an integer between 30 and 3600");
  await assertRejects(() => extendVerificationJobLease(invalidLeaseHeartbeatDependencies, { ...validHeartbeatInput, leaseDurationSeconds: Number.NaN }), "leaseDurationSeconds must be an integer between 30 and 3600");
  await assertRejects(() => extendVerificationJobLease(invalidLeaseHeartbeatDependencies, { ...validHeartbeatInput, leaseDurationSeconds: Number.POSITIVE_INFINITY }), "leaseDurationSeconds must be an integer between 30 and 3600");
  await assertRejects(() => extendVerificationJobLease(invalidLeaseHeartbeatDependencies, { ...validHeartbeatInput, leaseDurationSeconds: Number.NEGATIVE_INFINITY }), "leaseDurationSeconds must be an integer between 30 and 3600");
  assert(invalidLeaseHeartbeatCalls === 0, "Invalid heartbeat lease durations must not call dependencies.");

  const originalErrorCode = validFailureInput.errorCode;
  const originalErrorMessage = validFailureInput.errorMessage;
  let invalidFailureDetailCalls = 0;
  const invalidFailureDetailDependencies: FailVerificationJobDependencies = { failBacklinkVerificationJob: async () => { invalidFailureDetailCalls += 1; return jobFixture; } };
  await assertRejects(() => failVerificationJob(invalidFailureDetailDependencies, { ...validFailureInput, errorCode: "" }), "errorCode must not be empty");
  await assertRejects(() => failVerificationJob(invalidFailureDetailDependencies, { ...validFailureInput, errorCode: "   " }), "errorCode must not be empty");
  await assertRejects(() => failVerificationJob(invalidFailureDetailDependencies, { ...validFailureInput, errorMessage: "" }), "errorMessage must not be empty");
  await assertRejects(() => failVerificationJob(invalidFailureDetailDependencies, { ...validFailureInput, errorMessage: "   " }), "errorMessage must not be empty");
  assert(invalidFailureDetailCalls === 0, "Invalid failure details must not call dependencies.");
  assert(validFailureInput.errorCode === originalErrorCode, "errorCode must not be mutated.");
  assert(validFailureInput.errorMessage === originalErrorMessage, "errorMessage must not be mutated.");

  const claimRepositoryError = new Error("claim repository failure");
  let claimRepositoryCalls = 0;
  const failingClaimDependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async () => { claimRepositoryCalls += 1; throw claimRepositoryError; } };
  assert(await captureRejection(() => claimNextVerificationJob(failingClaimDependencies, validClaimInput)) === claimRepositoryError, "Claim repository error must be propagated unchanged.");
  assert(claimRepositoryCalls === 1, "Claim repository must be called exactly once.");

  const heartbeatRepositoryError = new Error("heartbeat repository failure");
  let heartbeatRepositoryCalls = 0;
  const failingHeartbeatDependencies: ExtendVerificationJobLeaseDependencies = { heartbeatBacklinkVerificationJob: async () => { heartbeatRepositoryCalls += 1; throw heartbeatRepositoryError; } };
  assert(await captureRejection(() => extendVerificationJobLease(failingHeartbeatDependencies, validHeartbeatInput)) === heartbeatRepositoryError, "Heartbeat repository error must be propagated unchanged.");
  assert(heartbeatRepositoryCalls === 1, "Heartbeat repository must be called exactly once.");

  const completionRepositoryError = new Error("completion repository failure");
  let completionRepositoryCalls = 0;
  const failingCompletionDependencies: CompleteVerificationJobDependencies = { completeBacklinkVerificationJob: async () => { completionRepositoryCalls += 1; throw completionRepositoryError; } };
  assert(await captureRejection(() => completeVerificationJob(failingCompletionDependencies, validCompletionInput)) === completionRepositoryError, "Completion repository error must be propagated unchanged.");
  assert(completionRepositoryCalls === 1, "Completion repository must be called exactly once.");

  const failureRepositoryError = new Error("failure repository failure");
  let failureRepositoryCalls = 0;
  const failingFailureDependencies: FailVerificationJobDependencies = { failBacklinkVerificationJob: async () => { failureRepositoryCalls += 1; throw failureRepositoryError; } };
  assert(await captureRejection(() => failVerificationJob(failingFailureDependencies, validFailureInput)) === failureRepositoryError, "Failure repository error must be propagated unchanged.");
  assert(failureRepositoryCalls === 1, "Failure repository must be called exactly once.");

  const originalClaimInput = { ...validClaimInput };
  let successfulClaimCalls = 0;
  const successfulClaimDependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async () => { successfulClaimCalls += 1; return jobFixture; } };
  const successfulClaim = await claimNextVerificationJob(successfulClaimDependencies, validClaimInput);
  assert(successfulClaim.kind === "claimed", "Expected successful claim.");
  assert(successfulClaim.job === jobFixture, "Claim must propagate the repository job unchanged.");
  assert(successfulClaimCalls === 1, "Successful claim must call dependencies exactly once.");
  assert(validClaimInput.workerId === originalClaimInput.workerId, "Claim workerId must not be mutated.");
  assert(validClaimInput.workspaceId === originalClaimInput.workspaceId, "Claim workspaceId must not be mutated.");
  assert(validClaimInput.claimedAt === originalClaimInput.claimedAt, "Claim claimedAt must not be mutated.");
  assert(validClaimInput.leaseDurationSeconds === originalClaimInput.leaseDurationSeconds, "Claim lease duration must not be mutated.");

  const originalHeartbeatInput = { ...validHeartbeatInput };
  let successfulHeartbeatCalls = 0;
  const successfulHeartbeatDependencies: ExtendVerificationJobLeaseDependencies = { heartbeatBacklinkVerificationJob: async () => { successfulHeartbeatCalls += 1; return jobFixture; } };
  const successfulHeartbeat = await extendVerificationJobLease(successfulHeartbeatDependencies, validHeartbeatInput);
  assert(successfulHeartbeat.kind === "extended", "Expected successful heartbeat.");
  assert(successfulHeartbeat.job === jobFixture, "Heartbeat must propagate the repository job unchanged.");
  assert(successfulHeartbeatCalls === 1, "Successful heartbeat must call dependencies exactly once.");
  assert(validHeartbeatInput.jobId === originalHeartbeatInput.jobId, "Heartbeat jobId must not be mutated.");
  assert(validHeartbeatInput.workerId === originalHeartbeatInput.workerId, "Heartbeat workerId must not be mutated.");
  assert(validHeartbeatInput.heartbeatAt === originalHeartbeatInput.heartbeatAt, "Heartbeat date must not be mutated.");
  assert(validHeartbeatInput.leaseDurationSeconds === originalHeartbeatInput.leaseDurationSeconds, "Heartbeat lease duration must not be mutated.");

  const originalCompletionInput = { ...validCompletionInput };
  let successfulCompletionCalls = 0;
  const successfulCompletionDependencies: CompleteVerificationJobDependencies = { completeBacklinkVerificationJob: async () => { successfulCompletionCalls += 1; return jobFixture; } };
  const successfulCompletion = await completeVerificationJob(successfulCompletionDependencies, validCompletionInput);
  assert(successfulCompletion.kind === "completed", "Expected successful completion.");
  assert(successfulCompletion.job === jobFixture, "Completion must propagate the repository job unchanged.");
  assert(successfulCompletionCalls === 1, "Successful completion must call dependencies exactly once.");
  assert(validCompletionInput.jobId === originalCompletionInput.jobId, "Completion jobId must not be mutated.");
  assert(validCompletionInput.workerId === originalCompletionInput.workerId, "Completion workerId must not be mutated.");
  assert(validCompletionInput.completedAt === originalCompletionInput.completedAt, "Completion date must not be mutated.");
  assert(validCompletionInput.resultSummary === originalCompletionInput.resultSummary, "Completion result summary must not be mutated.");

  const originalFailureInput = { ...validFailureInput };
  let successfulFailureCalls = 0;
  const successfulFailureDependencies: FailVerificationJobDependencies = { failBacklinkVerificationJob: async () => { successfulFailureCalls += 1; return jobFixture; } };
  const successfulFailure = await failVerificationJob(successfulFailureDependencies, validFailureInput);
  assert(successfulFailure.kind === "failed", "Expected successful failure.");
  assert(successfulFailure.job === jobFixture, "Failure must propagate the repository job unchanged.");
  assert(successfulFailureCalls === 1, "Successful failure must call dependencies exactly once.");
  assert(validFailureInput.jobId === originalFailureInput.jobId, "Failure jobId must not be mutated.");
  assert(validFailureInput.workerId === originalFailureInput.workerId, "Failure workerId must not be mutated.");
  assert(validFailureInput.failedAt === originalFailureInput.failedAt, "Failure date must not be mutated.");
  assert(validFailureInput.errorCode === originalFailureInput.errorCode, "Failure errorCode must not be mutated.");
  assert(validFailureInput.errorMessage === originalFailureInput.errorMessage, "Failure errorMessage must not be mutated.");

  let workerACalls = 0;
  const workerADependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async () => { workerACalls += 1; return jobFixture; } };
  let workerBCalls = 0;
  const workerBDependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async () => { workerBCalls += 1; return jobFixture; } };
  const workerAResult = await claimNextVerificationJob(workerADependencies, { ...validClaimInput, workerId: "worker-A" });
  const workerBResult = await claimNextVerificationJob(workerBDependencies, { ...validClaimInput, workerId: "worker-B" });
  assert(workerAResult.kind === "claimed" && workerAResult.job === jobFixture, "Worker A claim must remain independent.");
  assert(workerBResult.kind === "claimed" && workerBResult.job === jobFixture, "Worker B claim must remain independent.");
  assert(workerACalls === 1, "Worker A dependencies must be called exactly once.");
  assert(workerBCalls === 1, "Worker B dependencies must be called exactly once.");

  const exhaustedClaimDependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async () => null };
  const exhaustedClaim = await claimNextVerificationJob(exhaustedClaimDependencies, validClaimInput);
  assert(exhaustedClaim.kind === "empty", "Exhausted jobs must return empty.");

  let statelessClaimCalls = 0;
  const statelessClaimDependencies: ClaimNextVerificationJobDependencies = { claimNextJob: async () => { statelessClaimCalls += 1; return jobFixture; } };
  const firstStatelessClaim = await claimNextVerificationJob(statelessClaimDependencies, { ...validClaimInput, workerId: "worker-stateless-A", claimedAt: "2026-07-31T12:01:00.000Z" });
  const secondStatelessClaim = await claimNextVerificationJob(statelessClaimDependencies, { ...validClaimInput, workerId: "worker-stateless-B", claimedAt: "2026-07-31T12:02:00.000Z" });
  assert(firstStatelessClaim.kind === "claimed" && firstStatelessClaim.job === jobFixture, "First stateless claim must succeed.");
  assert(secondStatelessClaim.kind === "claimed" && secondStatelessClaim.job === jobFixture, "Second stateless claim must not depend on the first.");
  assert(statelessClaimCalls === 2, "Stateless claims must call dependencies once per input.");
  void assertRejects;
  console.log("PASS — Backlink verification job claim service smoke");
}

void main();
