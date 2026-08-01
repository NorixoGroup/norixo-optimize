import type {
  ExecuteBacklinkVerificationWorkerInput,
  ExecuteBacklinkVerificationWorkerResult,
} from "./worker-types";

export type PollBacklinkVerificationOnceInput = {
  workerId: string;
  claimedAt: string;
  leaseDurationSeconds: number;
  attemptedAt: string;
};

export type PollBacklinkVerificationOnceDependencies = {
  executeWorker: (
    input: ExecuteBacklinkVerificationWorkerInput,
  ) => Promise<ExecuteBacklinkVerificationWorkerResult>;
};

export type PollBacklinkVerificationOnceResult =
  ExecuteBacklinkVerificationWorkerResult;
