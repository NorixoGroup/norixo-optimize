import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import {
  claimNextBacklinkVerificationJob,
  markBacklinkVerificationJobCompleted,
  markBacklinkVerificationJobFailed,
} from "../repositories/verificationJobsRepository";
import { createBacklinkVerificationAttempt } from "../repositories/verificationAttemptsRepository";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import { getLink, updateLinkVerification } from "../services/linkService";
import { recordBacklinkVerificationAttempt } from "./attempt-service";
import { executeClaimedBacklinkVerificationJob } from "./claimed-job-orchestrator";
import type {
  ExecuteClaimedBacklinkVerificationJobInput,
  ExecuteClaimedBacklinkVerificationJobResult,
} from "./claimed-job-orchestrator-types";
import {
  claimNextVerificationJob,
  completeVerificationJob,
  failVerificationJob,
} from "./job-claim-service";
import type {
  ClaimNextBacklinkVerificationJobInput,
  ClaimNextBacklinkVerificationJobResult,
  CompleteBacklinkVerificationJobInput,
  CompleteBacklinkVerificationJobResult,
  FailBacklinkVerificationJobInput,
  FailBacklinkVerificationJobResult,
} from "./job-claim-types";
import { persistBacklinkVerificationResult } from "./persistence";
import { pollBacklinkVerificationOnce } from "./poller";
import type {
  PollBacklinkVerificationOnceInput,
  PollBacklinkVerificationOnceResult,
} from "./poller-types";
import { runBacklinkVerificationPollLoop } from "./poll-loop";
import type {
  RunBacklinkVerificationPollLoopInput,
  RunBacklinkVerificationPollLoopResult,
} from "./poll-loop-types";
import { executeBacklinkVerificationRun } from "./run-service";
import type { ExecuteBacklinkVerificationRunDependencies } from "./run-types";
import { executeBacklinkVerification } from "./runtime";
import { runBacklinkVerificationSchedulerTick } from "./scheduler";
import type {
  RunBacklinkVerificationSchedulerTickInput,
  RunBacklinkVerificationSchedulerTickResult,
} from "./scheduler-types";
import { executeBacklinkVerificationWorker } from "./worker";
import type { ExecuteBacklinkVerificationWorkerInput } from "./worker-types";

export function createBacklinkVerificationProductionComposition(): {
  runSchedulerTick: (
    input: RunBacklinkVerificationSchedulerTickInput,
  ) => Promise<RunBacklinkVerificationSchedulerTickResult>;
} {
  const client: BacklinkRepositoryClient = createSupabaseAdminClient();

  const claimNextJob = (
    input: ClaimNextBacklinkVerificationJobInput,
  ): Promise<ClaimNextBacklinkVerificationJobResult> =>
    claimNextVerificationJob(
      {
        claimNextJob: (claimInput) =>
          claimNextBacklinkVerificationJob(
            client,
            claimInput.workspaceId,
            claimInput.workerId,
            claimInput.claimedAt,
            claimInput.leaseDurationSeconds,
          ),
      },
      input,
    );

  const completeJob = (
    input: CompleteBacklinkVerificationJobInput,
  ): Promise<CompleteBacklinkVerificationJobResult> =>
    completeVerificationJob(
      {
        completeBacklinkVerificationJob: (completionInput) =>
          markBacklinkVerificationJobCompleted(
            client,
            completionInput.jobId,
            completionInput.workerId,
            completionInput.completedAt,
            completionInput.resultSummary,
          ),
      },
      input,
    );

  const failJob = (
    input: FailBacklinkVerificationJobInput,
  ): Promise<FailBacklinkVerificationJobResult> =>
    failVerificationJob(
      {
        failBacklinkVerificationJob: (failureInput) =>
          markBacklinkVerificationJobFailed(
            client,
            failureInput.jobId,
            failureInput.workerId,
            failureInput.failedAt,
            failureInput.errorCode,
            failureInput.errorMessage,
          ),
      },
      input,
    );

  const runDependencies: ExecuteBacklinkVerificationRunDependencies = {
    getLink: (workspaceId, linkId) => getLink(client, workspaceId, linkId),
    executeRuntime: (input) => executeBacklinkVerification(input),
    recordAttempt: recordBacklinkVerificationAttempt,
    recordAttemptDependencies: {
      createAttempt: (attemptInput) =>
        createBacklinkVerificationAttempt(
          client,
          attemptInput.workspaceId,
          attemptInput,
        ),
    },
    persistCurrentState: persistBacklinkVerificationResult,
    persistenceDependencies: {
      getLink: (workspaceId, linkId) => getLink(client, workspaceId, linkId),
      updateVerification: (workspaceId, linkId, input) =>
        updateLinkVerification(client, workspaceId, linkId, input),
    },
  };

  const executeClaimedJob = (
    input: ExecuteClaimedBacklinkVerificationJobInput,
  ): Promise<ExecuteClaimedBacklinkVerificationJobResult> =>
    executeClaimedBacklinkVerificationJob(
      {
        claimNextJob,
        executeRun: executeBacklinkVerificationRun,
        runDependencies,
        completeJob,
        failJob,
      },
      input,
    );

  const executeWorker = (input: ExecuteBacklinkVerificationWorkerInput) =>
    executeBacklinkVerificationWorker({ executeClaimedJob }, input);

  const pollOnce = (
    input: PollBacklinkVerificationOnceInput,
  ): Promise<PollBacklinkVerificationOnceResult> =>
    pollBacklinkVerificationOnce({ executeWorker }, input);

  const runPollLoop = (
    input: RunBacklinkVerificationPollLoopInput,
  ): Promise<RunBacklinkVerificationPollLoopResult> =>
    runBacklinkVerificationPollLoop({ pollOnce }, input);

  return {
    runSchedulerTick: (input) =>
      runBacklinkVerificationSchedulerTick({ runPollLoop }, input),
  };
}
