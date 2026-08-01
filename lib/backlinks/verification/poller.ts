import type {
  PollBacklinkVerificationOnceDependencies,
  PollBacklinkVerificationOnceInput,
  PollBacklinkVerificationOnceResult,
} from "./poller-types";

export async function pollBacklinkVerificationOnce(
  dependencies: PollBacklinkVerificationOnceDependencies,
  input: PollBacklinkVerificationOnceInput,
): Promise<PollBacklinkVerificationOnceResult> {
  return dependencies.executeWorker({
    workerId: input.workerId,
    claimedAt: input.claimedAt,
    leaseDurationSeconds: input.leaseDurationSeconds,
    attemptedAt: input.attemptedAt,
  });
}
