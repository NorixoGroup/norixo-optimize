import {
  runBacklinkVerificationPollLoop,
  type BacklinkVerificationJob,
  type BacklinkVerificationRunResult,
  type CompleteBacklinkVerificationJobResult,
  type FailBacklinkVerificationJobResult,
  type PollBacklinkVerificationOnceResult,
  type RunBacklinkVerificationPollLoopDependencies,
  type RunBacklinkVerificationPollLoopInput,
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
const validInput: RunBacklinkVerificationPollLoopInput = {
  workspaceId,
  workerId: "poll-loop-smoke-1",
  claimedAt: "2026-08-01T11:00:00.000Z",
  leaseDurationSeconds: 60,
  attemptedAt: "2026-08-01T11:00:00.000Z",
  maxIterations: 5,
};

const jobFixture: BacklinkVerificationJob = {
  id: "00000000-0000-4000-8000-000000000003",
  workspaceId,
  linkId,
  jobKey: "manual:poll-loop-smoke",
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
  workerId: "poll-loop-smoke-1",
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
const emptyFixture: PollBacklinkVerificationOnceResult = { kind: "empty" };
const completedFixture: PollBacklinkVerificationOnceResult = {
  kind: "completed",
  job: jobFixture,
  run: runFixture,
  completion: completionFixture,
};
const failedFixture: PollBacklinkVerificationOnceResult = {
  kind: "failed",
  job: jobFixture,
  error: { code: "POLL_LOOP_SMOKE_FAILURE", message: "Deterministic poll loop failure" },
  failure: failureFixture,
};
const completedSnapshot = JSON.stringify(completedFixture);
const failedSnapshot = JSON.stringify(failedFixture);

async function main(): Promise<void> {
  const firstEmptyInput = { ...validInput };
  const firstEmptyOriginal = { ...firstEmptyInput };
  const emptySnapshot = JSON.stringify(emptyFixture);
  let firstEmptyCalls = 0;
  const firstEmptyDependencies: RunBacklinkVerificationPollLoopDependencies = {
    pollOnce: async (input) => {
      firstEmptyCalls += 1;
      assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "First empty input must contain exactly five poller keys.");
      assert(input.workspaceId === firstEmptyOriginal.workspaceId && input.workerId === firstEmptyOriginal.workerId && input.claimedAt === firstEmptyOriginal.claimedAt && input.leaseDurationSeconds === firstEmptyOriginal.leaseDurationSeconds && input.attemptedAt === firstEmptyOriginal.attemptedAt, "First empty input must be preserved.");
      return emptyFixture;
    },
  };
  const firstEmptyResult = await runBacklinkVerificationPollLoop(firstEmptyDependencies, firstEmptyInput);
  assert(firstEmptyResult.kind === "empty", "Expected empty result on first iteration.");
  assert(firstEmptyResult.iterations === 1, "First empty result must stop at iteration one.");
  assert(firstEmptyResult.lastResult === emptyFixture, "First empty last result must preserve the fixture reference.");
  assert(firstEmptyCalls === 1, "First empty scenario must call pollOnce once.");
  assert(firstEmptyInput.workerId === firstEmptyOriginal.workerId && firstEmptyInput.claimedAt === firstEmptyOriginal.claimedAt && firstEmptyInput.leaseDurationSeconds === firstEmptyOriginal.leaseDurationSeconds && firstEmptyInput.attemptedAt === firstEmptyOriginal.attemptedAt && firstEmptyInput.maxIterations === firstEmptyOriginal.maxIterations, "First empty loop input must not be mutated.");
  assert(JSON.stringify(emptyFixture) === emptySnapshot, "Empty fixture must not be mutated.");

  const delayedEmptyInput = { ...validInput };
  const delayedEmptyOriginal = { ...delayedEmptyInput };
  const delayedEmptySequence = [completedFixture, failedFixture, emptyFixture];
  let delayedEmptyCalls = 0;
  const delayedEmptyDependencies: RunBacklinkVerificationPollLoopDependencies = {
    pollOnce: async (input) => {
      assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Delayed empty input must contain exactly five poller keys.");
      assert(input.workspaceId === delayedEmptyOriginal.workspaceId && input.workerId === delayedEmptyOriginal.workerId && input.claimedAt === delayedEmptyOriginal.claimedAt && input.leaseDurationSeconds === delayedEmptyOriginal.leaseDurationSeconds && input.attemptedAt === delayedEmptyOriginal.attemptedAt, "Delayed empty input must be preserved.");
      const result = delayedEmptySequence[delayedEmptyCalls];
      delayedEmptyCalls += 1;
      assert(result != null, "Delayed empty scenario must not poll after empty.");
      return result;
    },
  };
  const delayedEmptyResult = await runBacklinkVerificationPollLoop(delayedEmptyDependencies, delayedEmptyInput);
  assert(delayedEmptyResult.kind === "empty", "Expected delayed empty result.");
  assert(delayedEmptyResult.iterations === 3, "Delayed empty result must stop at iteration three.");
  assert(delayedEmptyResult.lastResult === emptyFixture, "Delayed empty last result must be the empty fixture.");
  assert(delayedEmptyCalls === 3, "Delayed empty scenario must not make a fourth call.");
  assert(delayedEmptyInput.workerId === delayedEmptyOriginal.workerId && delayedEmptyInput.claimedAt === delayedEmptyOriginal.claimedAt && delayedEmptyInput.leaseDurationSeconds === delayedEmptyOriginal.leaseDurationSeconds && delayedEmptyInput.attemptedAt === delayedEmptyOriginal.attemptedAt && delayedEmptyInput.maxIterations === delayedEmptyOriginal.maxIterations, "Delayed empty loop input must not be mutated.");

  const limitInput = { ...validInput, maxIterations: 3 };
  const limitSequence = [completedFixture, failedFixture, completedFixture];
  let limitCalls = 0;
  const limitDependencies: RunBacklinkVerificationPollLoopDependencies = {
    pollOnce: async (input) => {
      assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Limit input must contain exactly five poller keys.");
      assert(input.workspaceId === limitInput.workspaceId && input.workerId === limitInput.workerId && input.claimedAt === limitInput.claimedAt && input.leaseDurationSeconds === limitInput.leaseDurationSeconds && input.attemptedAt === limitInput.attemptedAt, "Limit input must be preserved.");
      const result = limitSequence[limitCalls];
      limitCalls += 1;
      assert(result != null, "Limit scenario must not exceed maxIterations.");
      return result;
    },
  };
  const limitResult = await runBacklinkVerificationPollLoop(limitDependencies, limitInput);
  assert(limitResult.kind === "max_iterations_reached", "Expected max iterations result.");
  assert(limitResult.iterations === 3, "Limit result must report three iterations.");
  assert(limitResult.lastResult === completedFixture, "Limit last result must be the third fixture.");
  assert(limitCalls === 3, "Limit scenario must call pollOnce exactly three times.");

  let oneTurnCalls = 0;
  const oneTurnDependencies: RunBacklinkVerificationPollLoopDependencies = {
    pollOnce: async (input) => {
      assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "One-turn input must contain exactly five poller keys.");
      assert(input.workspaceId === validInput.workspaceId && input.workerId === validInput.workerId && input.claimedAt === validInput.claimedAt && input.leaseDurationSeconds === validInput.leaseDurationSeconds && input.attemptedAt === validInput.attemptedAt, "One-turn input must be preserved.");
      oneTurnCalls += 1;
      return completedFixture;
    },
  };
  const oneTurnResult = await runBacklinkVerificationPollLoop(oneTurnDependencies, {
    ...validInput,
    maxIterations: 1,
  });
  assert(oneTurnResult.kind === "max_iterations_reached", "One-turn non-empty result must reach the limit.");
  assert(oneTurnResult.iterations === 1, "One-turn result must report one iteration.");
  assert(oneTurnResult.lastResult === completedFixture, "One-turn last result must preserve the fixture reference.");
  assert(oneTurnCalls === 1, "One-turn scenario must call pollOnce once.");

  const alternatingInput = { ...validInput, maxIterations: 4 };
  const alternatingSequence = [completedFixture, failedFixture, completedFixture, failedFixture];
  const alternatingConsumed: PollBacklinkVerificationOnceResult[] = [];
  let alternatingCalls = 0;
  const alternatingDependencies: RunBacklinkVerificationPollLoopDependencies = {
    pollOnce: async (input) => {
      assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Alternating input must contain exactly five poller keys.");
      assert(input.workspaceId === alternatingInput.workspaceId && input.workerId === alternatingInput.workerId && input.claimedAt === alternatingInput.claimedAt && input.leaseDurationSeconds === alternatingInput.leaseDurationSeconds && input.attemptedAt === alternatingInput.attemptedAt, "Alternating input must be preserved.");
      const result = alternatingSequence[alternatingCalls];
      alternatingCalls += 1;
      assert(result != null, "Alternating scenario must not exceed maxIterations.");
      alternatingConsumed.push(result);
      return result;
    },
  };
  const alternatingResult = await runBacklinkVerificationPollLoop(alternatingDependencies, alternatingInput);
  assert(alternatingResult.kind === "max_iterations_reached", "Alternating scenario must reach the limit.");
  assert(alternatingResult.iterations === 4, "Alternating scenario must report four iterations.");
  assert(alternatingResult.lastResult === failedFixture, "Alternating last result must be the final failed fixture.");
  assert(alternatingCalls === 4, "Alternating scenario must call pollOnce four times.");
  assert(alternatingConsumed[0] === completedFixture && alternatingConsumed[1] === failedFixture && alternatingConsumed[2] === completedFixture && alternatingConsumed[3] === failedFixture, "Alternating scenario must consume results in the expected order.");

  const pollOnceError = new Error("Deterministic pollOnce failure");
  let errorCalls = 0;
  const errorDependencies: RunBacklinkVerificationPollLoopDependencies = {
    pollOnce: async (input) => {
      assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Error input must contain exactly five poller keys.");
      assert(input.workspaceId === validInput.workspaceId && input.workerId === validInput.workerId && input.claimedAt === validInput.claimedAt && input.leaseDurationSeconds === validInput.leaseDurationSeconds && input.attemptedAt === validInput.attemptedAt, "Error input must be preserved.");
      errorCalls += 1;
      if (errorCalls === 1) return completedFixture;
      throw pollOnceError;
    },
  };
  const propagatedError = await assertRejects(
    () => runBacklinkVerificationPollLoop(errorDependencies, { ...validInput }),
    "Deterministic pollOnce failure",
  );
  assert(propagatedError === pollOnceError, "pollOnce error must be propagated unchanged.");
  assert(errorCalls === 2, "Error scenario must call pollOnce exactly twice.");

  for (const invalidMaxIterations of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    let invalidCalls = 0;
    const invalidDependencies: RunBacklinkVerificationPollLoopDependencies = {
      pollOnce: async (input) => {
        assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Invalid input must contain exactly five poller keys.");
        invalidCalls += 1;
        return emptyFixture;
      },
    };
    await assertRejects(
      () => runBacklinkVerificationPollLoop(invalidDependencies, { ...validInput, maxIterations: invalidMaxIterations }),
      "maxIterations must be an integer greater than or equal to 1",
    );
    assert(invalidCalls === 0, "Invalid maxIterations must not call pollOnce.");
  }

  const workerAInput: RunBacklinkVerificationPollLoopInput = {
    ...validInput,
    workspaceId: "00000000-0000-4000-8000-000000000010",
    workerId: "worker-A",
    attemptedAt: "2026-08-01T11:01:00.000Z",
    maxIterations: 2,
  };
  const workerBInput: RunBacklinkVerificationPollLoopInput = {
    ...validInput,
    workspaceId: "00000000-0000-4000-8000-000000000011",
    workerId: "worker-B",
    attemptedAt: "2026-08-01T11:02:00.000Z",
    maxIterations: 3,
  };
  const workerAInputs: string[] = [];
  const workerBInputs: string[] = [];
  let workerACalls = 0;
  let workerBCalls = 0;
  const workerADependencies: RunBacklinkVerificationPollLoopDependencies = {
    pollOnce: async (input) => {
      assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Worker A input must contain exactly five poller keys.");
      workerACalls += 1;
      workerAInputs.push(`${input.workspaceId}:${input.workerId}:${input.attemptedAt}`);
      return workerACalls === 1 ? completedFixture : emptyFixture;
    },
  };
  const workerBDependencies: RunBacklinkVerificationPollLoopDependencies = {
    pollOnce: async (input) => {
      assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "workerId", "workspaceId"]), "Worker B input must contain exactly five poller keys.");
      workerBCalls += 1;
      workerBInputs.push(`${input.workspaceId}:${input.workerId}:${input.attemptedAt}`);
      return workerBCalls === 1 ? failedFixture : workerBCalls === 2 ? completedFixture : emptyFixture;
    },
  };
  const workerAResult = await runBacklinkVerificationPollLoop(workerADependencies, workerAInput);
  const workerBResult = await runBacklinkVerificationPollLoop(workerBDependencies, workerBInput);
  assert(workerAResult.kind === "empty" && workerAResult.iterations === 2, "Worker A loop must remain independent.");
  assert(workerBResult.kind === "empty" && workerBResult.iterations === 3, "Worker B loop must remain independent.");
  assert(workerACalls === 2 && workerBCalls === 3, "Worker loop counters must remain independent.");
  assert(workerAInputs.every((entry) => entry === "00000000-0000-4000-8000-000000000010:worker-A:2026-08-01T11:01:00.000Z"), "Worker A inputs must not contain Worker B data.");
  assert(workerBInputs.every((entry) => entry === "00000000-0000-4000-8000-000000000011:worker-B:2026-08-01T11:02:00.000Z"), "Worker B inputs must not contain Worker A data.");
  assert(JSON.stringify(completedFixture) === completedSnapshot, "Completed fixture must not be mutated.");
  assert(JSON.stringify(failedFixture) === failedSnapshot, "Failed fixture must not be mutated.");

  console.log("PASS — Backlink verification poll loop smoke");
}

void main();
