import type {
  PollBacklinkVerificationOnceInput,
  PollBacklinkVerificationOnceResult,
} from "./poller-types";

export type RunBacklinkVerificationPollLoopInput = {
  workerId: string;
  claimedAt: string;
  leaseDurationSeconds: number;
  attemptedAt: string;
  maxIterations: number;
};

export type RunBacklinkVerificationPollLoopDependencies = {
  pollOnce: (
    input: PollBacklinkVerificationOnceInput,
  ) => Promise<PollBacklinkVerificationOnceResult>;
};

export type RunBacklinkVerificationPollLoopResult =
  | {
      kind: "empty";
      iterations: number;
      lastResult: PollBacklinkVerificationOnceResult;
    }
  | {
      kind: "max_iterations_reached";
      iterations: number;
      lastResult: PollBacklinkVerificationOnceResult;
    };
