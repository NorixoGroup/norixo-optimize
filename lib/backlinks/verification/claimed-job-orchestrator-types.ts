import type {
  ClaimNextBacklinkVerificationJobInput,
  ClaimNextBacklinkVerificationJobResult,
  CompleteBacklinkVerificationJobInput,
  CompleteBacklinkVerificationJobResult,
  FailBacklinkVerificationJobInput,
  FailBacklinkVerificationJobResult,
} from "./job-claim-types";
import type { BacklinkVerificationJob } from "./job-types";
import type {
  BacklinkVerificationRunResult,
  ExecuteBacklinkVerificationRunDependencies,
  ExecuteBacklinkVerificationRunInput,
} from "./run-types";

export type ExecuteClaimedBacklinkVerificationJobInput = {
  workerId: string;
  claimedAt: string;
  leaseDurationSeconds: number;
  attemptedAt: string;
};

export type ExecuteClaimedBacklinkVerificationJobDependencies = {
  claimNextJob: (
    input: ClaimNextBacklinkVerificationJobInput,
  ) => Promise<ClaimNextBacklinkVerificationJobResult>;
  executeRun: (
    input: ExecuteBacklinkVerificationRunInput,
    dependencies: ExecuteBacklinkVerificationRunDependencies,
  ) => Promise<BacklinkVerificationRunResult>;
  runDependencies: ExecuteBacklinkVerificationRunDependencies;
  completeJob: (
    input: CompleteBacklinkVerificationJobInput,
  ) => Promise<CompleteBacklinkVerificationJobResult>;
  failJob: (
    input: FailBacklinkVerificationJobInput,
  ) => Promise<FailBacklinkVerificationJobResult>;
};

export type ExecuteClaimedBacklinkVerificationJobResult =
  | { kind: "empty" }
  | {
      kind: "completed";
      job: BacklinkVerificationJob;
      run: BacklinkVerificationRunResult;
      completion: CompleteBacklinkVerificationJobResult;
    }
  | {
      kind: "failed";
      job: BacklinkVerificationJob;
      error: {
        code: string;
        message: string;
      };
      failure: FailBacklinkVerificationJobResult;
    };
