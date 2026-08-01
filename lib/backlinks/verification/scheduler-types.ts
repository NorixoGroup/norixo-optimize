import type {
  RunBacklinkVerificationPollLoopInput,
  RunBacklinkVerificationPollLoopResult,
} from "./poll-loop-types";

export type RunBacklinkVerificationSchedulerTickInput = {
  workerId: string;
  scheduledAt: string;
  leaseDurationSeconds: number;
  maxIterations: number;
};

export type RunBacklinkVerificationSchedulerTickDependencies = {
  runPollLoop: (
    input: RunBacklinkVerificationPollLoopInput,
  ) => Promise<RunBacklinkVerificationPollLoopResult>;
};

export type RunBacklinkVerificationSchedulerTickResult =
  RunBacklinkVerificationPollLoopResult;
