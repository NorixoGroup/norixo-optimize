import type {
  ExecuteClaimedBacklinkVerificationJobDependencies,
  ExecuteClaimedBacklinkVerificationJobInput,
  ExecuteClaimedBacklinkVerificationJobResult,
} from "./claimed-job-orchestrator-types";
import type { BacklinkVerificationRunResult } from "./run-types";

function assertNonEmptyString(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function assertValidDateString(value: string, fieldName: string): void {
  assertNonEmptyString(value, fieldName);

  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${fieldName} must be a valid date`);
  }
}

function assertValidLeaseDuration(leaseDurationSeconds: number): void {
  if (
    !Number.isFinite(leaseDurationSeconds) ||
    !Number.isInteger(leaseDurationSeconds) ||
    leaseDurationSeconds < 30 ||
    leaseDurationSeconds > 3600
  ) {
    throw new Error("leaseDurationSeconds must be an integer between 30 and 3600");
  }
}

function serializeExecutionError(error: unknown): { code: string; message: string } {
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

export async function executeClaimedBacklinkVerificationJob(
  dependencies: ExecuteClaimedBacklinkVerificationJobDependencies,
  input: ExecuteClaimedBacklinkVerificationJobInput,
): Promise<ExecuteClaimedBacklinkVerificationJobResult> {
  assertNonEmptyString(input.workerId, "workerId");
  assertValidDateString(input.claimedAt, "claimedAt");
  assertValidLeaseDuration(input.leaseDurationSeconds);
  assertValidDateString(input.attemptedAt, "attemptedAt");

  const claim = await dependencies.claimNextJob({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    claimedAt: input.claimedAt,
    leaseDurationSeconds: input.leaseDurationSeconds,
  });

  if (claim.kind === "empty") {
    return { kind: "empty" };
  }

  const job = claim.job;
  let run: BacklinkVerificationRunResult;

  try {
    run = await dependencies.executeRun(
      {
        workspaceId: job.workspaceId,
        linkId: job.linkId,
        attemptedAt: input.attemptedAt,
        policy: job.policy,
        http: job.http,
      },
      dependencies.runDependencies,
    );
  } catch (error) {
    const serialized = serializeExecutionError(error);
    const failure = await dependencies.failJob({
      jobId: job.id,
      workerId: input.workerId,
      failedAt: input.attemptedAt,
      errorCode: serialized.code,
      errorMessage: serialized.message,
    });

    return {
      kind: "failed",
      job,
      error: serialized,
      failure,
    };
  }

  const resultSummary = {
    runtimeKind: run.runtimeResult.kind,
    persistenceKind: run.persistenceResult.kind,
    verificationStatus:
      run.runtimeResult.kind === "verified"
        ? run.runtimeResult.verification.status
        : null,
  };
  const completion = await dependencies.completeJob({
    jobId: job.id,
    workerId: input.workerId,
    completedAt: input.attemptedAt,
    resultSummary,
  });

  return {
    kind: "completed",
    job,
    run,
    completion,
  };
}
