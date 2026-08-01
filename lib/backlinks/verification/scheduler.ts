import type {
  RunBacklinkVerificationSchedulerTickDependencies,
  RunBacklinkVerificationSchedulerTickInput,
  RunBacklinkVerificationSchedulerTickResult,
} from "./scheduler-types";

export async function runBacklinkVerificationSchedulerTick(
  dependencies: RunBacklinkVerificationSchedulerTickDependencies,
  input: RunBacklinkVerificationSchedulerTickInput,
): Promise<RunBacklinkVerificationSchedulerTickResult> {
  return dependencies.runPollLoop({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    claimedAt: input.scheduledAt,
    leaseDurationSeconds: input.leaseDurationSeconds,
    attemptedAt: input.scheduledAt,
    maxIterations: input.maxIterations,
  });
}
