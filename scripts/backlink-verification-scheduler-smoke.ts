import {
  runBacklinkVerificationSchedulerTick,
  type PollBacklinkVerificationOnceResult,
  type RunBacklinkVerificationSchedulerTickDependencies,
  type RunBacklinkVerificationSchedulerTickInput,
  type RunBacklinkVerificationSchedulerTickResult,
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

const tickInput: RunBacklinkVerificationSchedulerTickInput = {
  workspaceId: "00000000-0000-4000-8000-000000000099",
  workerId: "scheduler-smoke-1",
  scheduledAt: "2026-08-01T12:00:00.000Z",
  leaseDurationSeconds: 60,
  maxIterations: 3,
};
const lastResultFixture: PollBacklinkVerificationOnceResult = { kind: "empty" };
const emptyResultFixture: RunBacklinkVerificationSchedulerTickResult = {
  kind: "empty",
  iterations: 1,
  lastResult: lastResultFixture,
};
const maxIterationsResultFixture: RunBacklinkVerificationSchedulerTickResult = {
  kind: "max_iterations_reached",
  iterations: 3,
  lastResult: lastResultFixture,
};

async function main(): Promise<void> {
  const emptyInput = { ...tickInput };
  const emptyOriginalInput = { ...emptyInput };
  const emptySnapshot = JSON.stringify(emptyResultFixture);
  let emptyCalls = 0;
  const emptyInputs: RunBacklinkVerificationPollLoopInput[] = [];
  const emptyDependencies: RunBacklinkVerificationSchedulerTickDependencies = {
    runPollLoop: async (input) => {
      emptyCalls += 1;
      emptyInputs.push(input);
      return emptyResultFixture;
    },
  };
  const emptyResult = await runBacklinkVerificationSchedulerTick(emptyDependencies, emptyInput);
  assert(emptyResult.kind === "empty", "Expected empty scheduler tick result.");
  assert(emptyResult === emptyResultFixture, "Empty scheduler result must be propagated by reference.");
  assert(emptyCalls === 1, "Empty scheduler tick must run one poll loop.");
  const emptyReceivedInput = emptyInputs[0];
  assert(emptyReceivedInput != null, "Expected empty poll-loop input.");
  assert(JSON.stringify(Object.keys(emptyReceivedInput).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "maxIterations", "workerId", "workspaceId"]), "Scheduler must provide exactly the poll-loop input keys.");
  assert(emptyReceivedInput.workspaceId === emptyOriginalInput.workspaceId && emptyReceivedInput.workerId === emptyOriginalInput.workerId && emptyReceivedInput.claimedAt === emptyOriginalInput.scheduledAt && emptyReceivedInput.attemptedAt === emptyOriginalInput.scheduledAt && emptyReceivedInput.leaseDurationSeconds === emptyOriginalInput.leaseDurationSeconds && emptyReceivedInput.maxIterations === emptyOriginalInput.maxIterations, "Scheduler must map scheduledAt and preserve the remaining input values.");
  assert(emptyInput.workspaceId === emptyOriginalInput.workspaceId && emptyInput.workerId === emptyOriginalInput.workerId && emptyInput.scheduledAt === emptyOriginalInput.scheduledAt && emptyInput.leaseDurationSeconds === emptyOriginalInput.leaseDurationSeconds && emptyInput.maxIterations === emptyOriginalInput.maxIterations, "Scheduler input must not be mutated.");
  assert(JSON.stringify(emptyResultFixture) === emptySnapshot, "Empty scheduler result must not be mutated.");

  const maxInput = { ...tickInput, maxIterations: 7 };
  const maxOriginalInput = { ...maxInput };
  const maxSnapshot = JSON.stringify(maxIterationsResultFixture);
  let maxCalls = 0;
  const maxDependencies: RunBacklinkVerificationSchedulerTickDependencies = {
    runPollLoop: async (input) => {
      maxCalls += 1;
      assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify(["attemptedAt", "claimedAt", "leaseDurationSeconds", "maxIterations", "workerId", "workspaceId"]), "Max scheduler input must contain exactly the poll-loop keys.");
      assert(input.workspaceId === maxOriginalInput.workspaceId && input.workerId === maxOriginalInput.workerId && input.claimedAt === maxOriginalInput.scheduledAt && input.attemptedAt === maxOriginalInput.scheduledAt && input.leaseDurationSeconds === maxOriginalInput.leaseDurationSeconds && input.maxIterations === maxOriginalInput.maxIterations, "Max scheduler input must preserve the mapping.");
      return maxIterationsResultFixture;
    },
  };
  const maxResult = await runBacklinkVerificationSchedulerTick(maxDependencies, maxInput);
  assert(maxResult.kind === "max_iterations_reached", "Expected max iterations scheduler tick result.");
  assert(maxResult === maxIterationsResultFixture, "Max scheduler result must be propagated by reference.");
  assert(maxCalls === 1, "Max scheduler tick must run one poll loop.");
  assert(maxInput.workspaceId === maxOriginalInput.workspaceId && maxInput.workerId === maxOriginalInput.workerId && maxInput.scheduledAt === maxOriginalInput.scheduledAt && maxInput.leaseDurationSeconds === maxOriginalInput.leaseDurationSeconds && maxInput.maxIterations === maxOriginalInput.maxIterations, "Max scheduler input must not be mutated.");
  assert(JSON.stringify(maxIterationsResultFixture) === maxSnapshot, "Max scheduler result must not be mutated.");

  const schedulerLoopError = new Error("Deterministic scheduler poll-loop failure");
  let errorCalls = 0;
  const errorDependencies: RunBacklinkVerificationSchedulerTickDependencies = {
    runPollLoop: async () => {
      errorCalls += 1;
      throw schedulerLoopError;
    },
  };
  const propagatedError = await assertRejects(
    () => runBacklinkVerificationSchedulerTick(errorDependencies, { ...tickInput }),
    "Deterministic scheduler poll-loop failure",
  );
  assert(propagatedError === schedulerLoopError, "Poll-loop error must be propagated unchanged.");
  assert(errorCalls === 1, "Error scheduler tick must run one poll loop.");

  const workerAInput: RunBacklinkVerificationSchedulerTickInput = {
    ...tickInput,
    workspaceId: "00000000-0000-4000-8000-000000000010",
    workerId: "worker-A",
    scheduledAt: "2026-08-01T12:01:00.000Z",
    maxIterations: 2,
  };
  const workerBInput: RunBacklinkVerificationSchedulerTickInput = {
    ...tickInput,
    workspaceId: "00000000-0000-4000-8000-000000000011",
    workerId: "worker-B",
    scheduledAt: "2026-08-01T12:02:00.000Z",
    maxIterations: 4,
  };
  const workerAReceivedInputs: string[] = [];
  const workerBReceivedInputs: string[] = [];
  let workerACalls = 0;
  let workerBCalls = 0;
  const workerADependencies: RunBacklinkVerificationSchedulerTickDependencies = {
    runPollLoop: async (input) => {
      workerACalls += 1;
      workerAReceivedInputs.push(`${input.workspaceId}:${input.workerId}:${input.claimedAt}:${input.attemptedAt}:${input.maxIterations}`);
      return emptyResultFixture;
    },
  };
  const workerBDependencies: RunBacklinkVerificationSchedulerTickDependencies = {
    runPollLoop: async (input) => {
      workerBCalls += 1;
      workerBReceivedInputs.push(`${input.workspaceId}:${input.workerId}:${input.claimedAt}:${input.attemptedAt}:${input.maxIterations}`);
      return maxIterationsResultFixture;
    },
  };
  const workerAResult = await runBacklinkVerificationSchedulerTick(workerADependencies, workerAInput);
  const workerBResult = await runBacklinkVerificationSchedulerTick(workerBDependencies, workerBInput);
  assert(workerAResult === emptyResultFixture, "Worker A scheduler result must remain independent.");
  assert(workerBResult === maxIterationsResultFixture, "Worker B scheduler result must remain independent.");
  assert(workerACalls === 1 && workerBCalls === 1, "Scheduler ticks must call each poll loop once.");
  assert(workerAReceivedInputs[0] === "00000000-0000-4000-8000-000000000010:worker-A:2026-08-01T12:01:00.000Z:2026-08-01T12:01:00.000Z:2", "Worker A scheduler input must not contain Worker B data.");
  assert(workerBReceivedInputs[0] === "00000000-0000-4000-8000-000000000011:worker-B:2026-08-01T12:02:00.000Z:2026-08-01T12:02:00.000Z:4", "Worker B scheduler input must not contain Worker A data.");

  console.log("PASS — Backlink verification scheduler tick smoke");
}

void main();
