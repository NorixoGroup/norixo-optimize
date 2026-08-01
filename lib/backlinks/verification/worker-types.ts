import type {
  ExecuteClaimedBacklinkVerificationJobInput,
  ExecuteClaimedBacklinkVerificationJobResult,
} from "./claimed-job-orchestrator-types";

export interface ExecuteBacklinkVerificationWorkerInput {
  workspaceId: string;
  workerId: string;
  claimedAt: string;
  leaseDurationSeconds: number;
  attemptedAt: string;
}

export interface ExecuteBacklinkVerificationWorkerDependencies {
  executeClaimedJob(
    input: ExecuteClaimedBacklinkVerificationJobInput,
  ): Promise<ExecuteClaimedBacklinkVerificationJobResult>;
}

export type ExecuteBacklinkVerificationWorkerResult =
  ExecuteClaimedBacklinkVerificationJobResult;
