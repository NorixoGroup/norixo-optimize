import type {
  RunBacklinkVerificationPollLoopDependencies,
  RunBacklinkVerificationPollLoopInput,
  RunBacklinkVerificationPollLoopResult,
} from "./poll-loop-types";

export async function runBacklinkVerificationPollLoop(
  dependencies: RunBacklinkVerificationPollLoopDependencies,
  input: RunBacklinkVerificationPollLoopInput,
): Promise<RunBacklinkVerificationPollLoopResult> {
  if (!Number.isInteger(input.maxIterations) || input.maxIterations < 1) {
    throw new Error("maxIterations must be an integer greater than or equal to 1");
  }

  for (let iteration = 1; iteration <= input.maxIterations; iteration += 1) {
    const result = await dependencies.pollOnce({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      claimedAt: input.claimedAt,
      leaseDurationSeconds: input.leaseDurationSeconds,
      attemptedAt: input.attemptedAt,
    });

    if (result.kind === "empty") {
      return {
        kind: "empty",
        iterations: iteration,
        lastResult: result,
      };
    }

    if (iteration === input.maxIterations) {
      return {
        kind: "max_iterations_reached",
        iterations: input.maxIterations,
        lastResult: result,
      };
    }
  }

  throw new Error("Backlink verification poll loop did not execute.");
}
