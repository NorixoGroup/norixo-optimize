import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import {
  claimBacklinkVerificationJobById as claimBacklinkVerificationJobByIdRepository,
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
import { claimBacklinkVerificationJobById as claimBacklinkVerificationJobByIdService } from "./targeted-job-claim-service";
import type {
  ClaimNextBacklinkVerificationJobInput,
  ClaimNextBacklinkVerificationJobResult,
  CompleteBacklinkVerificationJobInput,
  CompleteBacklinkVerificationJobResult,
  FailBacklinkVerificationJobInput,
  FailBacklinkVerificationJobResult,
} from "./job-claim-types";
import type { BacklinkVerificationJob } from "./job-types";
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
import type {
  BacklinkVerificationRunResult,
  ExecuteBacklinkVerificationRunDependencies,
} from "./run-types";
import { executeBacklinkVerification } from "./runtime";
import { runBacklinkVerificationSchedulerTick } from "./scheduler";
import type {
  RunBacklinkVerificationSchedulerTickInput,
  RunBacklinkVerificationSchedulerTickResult,
} from "./scheduler-types";
import { executeBacklinkVerificationWorker } from "./worker";
import type { ExecuteBacklinkVerificationWorkerInput } from "./worker-types";
import type {
  ClaimBacklinkVerificationJobByIdInput,
  ClaimBacklinkVerificationJobByIdResult,
} from "./targeted-job-claim-types";

type RunTargetedBacklinkVerificationJobInput = {
  workspaceId: string;
  jobId: string;
  workerId: string;
  claimedAt: string;
  attemptedAt: string;
  leaseDurationSeconds: number;
};

type RunTargetedBacklinkVerificationJobResult =
  | { kind: "rejected"; reason: "not_updated" }
  | {
      kind: "completed";
      job: BacklinkVerificationJob;
      run: BacklinkVerificationRunResult;
      completion: CompleteBacklinkVerificationJobResult;
    }
  | {
      kind: "failed";
      job: BacklinkVerificationJob;
      error: { code: string; message: string };
      failure: FailBacklinkVerificationJobResult;
    };

function serializeTargetedRunError(error: unknown): { code: string; message: string } {
  const fallback = {
    code: "BACKLINK_VERIFICATION_RUN_FAILED",
    message: "Backlink verification run failed",
  };

  if (!(error instanceof Error)) {
    return fallback;
  }

  return {
    code: error.name.trim().length > 0 ? error.name : fallback.code,
    message: error.message.trim().length > 0 ? error.message : fallback.message,
  };
}

export function createBacklinkVerificationProductionComposition(): {
  runSchedulerTick: (
    input: RunBacklinkVerificationSchedulerTickInput,
  ) => Promise<RunBacklinkVerificationSchedulerTickResult>;
  runTargetedJob: (
    input: RunTargetedBacklinkVerificationJobInput,
  ) => Promise<RunTargetedBacklinkVerificationJobResult>;
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

  const claimTargetedJob = (
    input: ClaimBacklinkVerificationJobByIdInput,
  ): Promise<ClaimBacklinkVerificationJobByIdResult> =>
    claimBacklinkVerificationJobByIdService(
      {
        claimJobById: (claimInput) =>
          claimBacklinkVerificationJobByIdRepository(
            client,
            claimInput.workspaceId,
            claimInput.jobId,
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

  const runTargetedJob = async (
    input: RunTargetedBacklinkVerificationJobInput,
  ): Promise<RunTargetedBacklinkVerificationJobResult> => {
    const claim = await claimTargetedJob({
      workspaceId: input.workspaceId,
      jobId: input.jobId,
      workerId: input.workerId,
      claimedAt: input.claimedAt,
      leaseDurationSeconds: input.leaseDurationSeconds,
    });

    if (claim.kind === "rejected") {
      return claim;
    }

    const job = claim.job;
    let run: BacklinkVerificationRunResult;

    try {
      run = await executeBacklinkVerificationRun(
        {
          workspaceId: job.workspaceId,
          linkId: job.linkId,
          attemptedAt: input.attemptedAt,
          policy: job.policy,
          http: job.http,
        },
        runDependencies,
      );
    } catch (error) {
      const serialized = serializeTargetedRunError(error);
      const failure = await failJob({
        jobId: job.id,
        workerId: input.workerId,
        failedAt: input.attemptedAt,
        errorCode: serialized.code,
        errorMessage: serialized.message,
      });

      return { kind: "failed", job, error: serialized, failure };
    }

    const completion = await completeJob({
      jobId: job.id,
      workerId: input.workerId,
      completedAt: input.attemptedAt,
      resultSummary: {
        runtimeKind: run.runtimeResult.kind,
        persistenceKind: run.persistenceResult.kind,
        verificationStatus:
          run.runtimeResult.kind === "verified"
            ? run.runtimeResult.verification.status
            : null,
      },
    });

    return { kind: "completed", job, run, completion };
  };

  return {
    runSchedulerTick: (input) =>
      runBacklinkVerificationSchedulerTick({ runPollLoop }, input),
    runTargetedJob,
  };
}
