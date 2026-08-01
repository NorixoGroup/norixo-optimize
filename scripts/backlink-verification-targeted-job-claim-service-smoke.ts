import {
  claimBacklinkVerificationJobById,
  type BacklinkVerificationJob,
  type ClaimBacklinkVerificationJobByIdDependencies,
  type ClaimBacklinkVerificationJobByIdInput,
} from "../lib/backlinks/verification";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejects(
  operation: () => Promise<unknown>,
  expectedMessage: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, "Expected an Error instance.");
    assert(
      error.message.includes(expectedMessage),
      `Expected error message to include ${expectedMessage}.`,
    );
    return;
  }

  throw new Error("Expected operation to reject.");
}

const input: ClaimBacklinkVerificationJobByIdInput = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  jobId: "00000000-0000-4000-8000-000000000002",
  workerId: "targeted-claim-smoke",
  claimedAt: "2026-08-02T10:00:00.000Z",
  leaseDurationSeconds: 60,
};

const jobFixture: BacklinkVerificationJob = {
  id: input.jobId,
  workspaceId: input.workspaceId,
  linkId: "00000000-0000-4000-8000-000000000003",
  jobKey: "manual:targeted-claim-smoke:2026-08-02",
  triggerSource: "manual",
  status: "running",
  policy: {},
  http: { timeoutMs: 1_000, maxRedirects: 3, maxResponseBytes: 10_000 },
  attemptCount: 1,
  maxAttempts: 1,
  queuedAt: "2026-08-02T10:00:00.000Z",
  startedAt: "2026-08-02T10:00:00.000Z",
  completedAt: null,
  failedAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  createdAt: "2026-08-02T10:00:00.000Z",
  updatedAt: "2026-08-02T10:00:00.000Z",
  workerId: input.workerId,
  claimedAt: input.claimedAt,
  leaseExpiresAt: "2026-08-02T10:01:00.000Z",
  heartbeatAt: input.claimedAt,
};

async function main(): Promise<void> {
  const originalInput = { ...input };
  const originalJob = JSON.stringify(jobFixture);
  let claimCalls = 0;
  let receivedInput: ClaimBacklinkVerificationJobByIdInput | undefined;
  const claimedDependencies: ClaimBacklinkVerificationJobByIdDependencies = {
    claimJobById: async (received) => {
      claimCalls += 1;
      receivedInput = received;
      return jobFixture;
    },
  };

  const claimed = await claimBacklinkVerificationJobById(claimedDependencies, input);
  assert(claimed.kind === "claimed", "Expected a claimed result.");
  assert(claimed.job === jobFixture, "Claimed job must preserve its reference.");
  assert(claimCalls === 1, "Successful claim must call the dependency once.");
  assert(receivedInput === input, "Claim dependency must receive the original input reference.");
  assert(
    JSON.stringify(Object.keys(receivedInput).sort()) ===
      JSON.stringify([
        "claimedAt",
        "jobId",
        "leaseDurationSeconds",
        "workerId",
        "workspaceId",
      ]),
    "Claim dependency must receive exactly the targeted claim input keys.",
  );
  assert(
    input.workspaceId === originalInput.workspaceId &&
      input.jobId === originalInput.jobId &&
      input.workerId === originalInput.workerId &&
      input.claimedAt === originalInput.claimedAt &&
      input.leaseDurationSeconds === originalInput.leaseDurationSeconds,
    "Claim input must not be mutated.",
  );
  assert(JSON.stringify(jobFixture) === originalJob, "Claimed job must not be mutated.");

  let rejectedCalls = 0;
  const rejected = await claimBacklinkVerificationJobById(
    {
      claimJobById: async () => {
        rejectedCalls += 1;
        return null;
      },
    },
    { ...input },
  );
  assert(rejected.kind === "rejected", "Null claim must be rejected.");
  assert(rejected.reason === "not_updated", "Rejected claim must use not_updated.");
  assert(rejectedCalls === 1, "Null claim must call the dependency once.");

  const repositoryError = new Error("repository failure");
  let repositoryCalls = 0;
  let thrown: unknown;
  try {
    await claimBacklinkVerificationJobById(
      {
        claimJobById: async () => {
          repositoryCalls += 1;
          throw repositoryError;
        },
      },
      { ...input },
    );
  } catch (error) {
    thrown = error;
  }
  assert(thrown === repositoryError, "Repository errors must be propagated by identity.");
  assert(repositoryCalls === 1, "Failing repository must be called once.");

  const invalidCases: Array<{
    input: ClaimBacklinkVerificationJobByIdInput;
    expectedMessage: string;
  }> = [
    { input: { ...input, workspaceId: "" }, expectedMessage: "workspaceId must not be empty" },
    { input: { ...input, jobId: "" }, expectedMessage: "jobId must not be empty" },
    { input: { ...input, workerId: "" }, expectedMessage: "workerId must not be empty" },
    { input: { ...input, claimedAt: "not-a-date" }, expectedMessage: "claimedAt must be a valid date" },
    { input: { ...input, leaseDurationSeconds: 29 }, expectedMessage: "leaseDurationSeconds must be an integer between 30 and 3600" },
    { input: { ...input, leaseDurationSeconds: 3601 }, expectedMessage: "leaseDurationSeconds must be an integer between 30 and 3600" },
    { input: { ...input, leaseDurationSeconds: 30.5 }, expectedMessage: "leaseDurationSeconds must be an integer between 30 and 3600" },
  ];

  for (const invalidCase of invalidCases) {
    let invalidCalls = 0;
    const invalidDependencies: ClaimBacklinkVerificationJobByIdDependencies = {
      claimJobById: async () => {
        invalidCalls += 1;
        return jobFixture;
      },
    };
    await assertRejects(
      () => claimBacklinkVerificationJobById(invalidDependencies, invalidCase.input),
      invalidCase.expectedMessage,
    );
    assert(invalidCalls === 0, "Invalid input must not call the dependency.");
  }

  console.log("PASS — Backlink verification targeted job claim service smoke");
}

void main();
