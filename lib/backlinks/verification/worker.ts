import type {
  ExecuteBacklinkVerificationWorkerDependencies,
  ExecuteBacklinkVerificationWorkerInput,
  ExecuteBacklinkVerificationWorkerResult,
} from "./worker-types";

export async function executeBacklinkVerificationWorker(
  dependencies: ExecuteBacklinkVerificationWorkerDependencies,
  input: ExecuteBacklinkVerificationWorkerInput,
): Promise<ExecuteBacklinkVerificationWorkerResult> {
  return dependencies.executeClaimedJob({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    claimedAt: input.claimedAt,
    leaseDurationSeconds: input.leaseDurationSeconds,
    attemptedAt: input.attemptedAt,
  });
}
