import type {
  ClaimNextBacklinkVerificationJobInput,
  ClaimNextBacklinkVerificationJobResult,
  HeartbeatBacklinkVerificationJobInput,
  HeartbeatBacklinkVerificationJobResult,
  CompleteBacklinkVerificationJobInput,
  CompleteBacklinkVerificationJobResult,
  FailBacklinkVerificationJobInput,
  FailBacklinkVerificationJobResult,
} from "./job-claim-types";
import type { BacklinkVerificationJob } from "./job-types";

const MIN_LEASE_DURATION_SECONDS = 30;
const MAX_LEASE_DURATION_SECONDS = 3600;
const MAX_WORKER_ID_LENGTH = 255;

function assertNonEmptyString(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function assertValidWorkerId(workerId: string): void {
  assertNonEmptyString(workerId, "workerId");

  if (workerId.length > MAX_WORKER_ID_LENGTH) {
    throw new Error(`workerId must not exceed ${MAX_WORKER_ID_LENGTH} characters`);
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
    leaseDurationSeconds < MIN_LEASE_DURATION_SECONDS ||
    leaseDurationSeconds > MAX_LEASE_DURATION_SECONDS
  ) {
    throw new Error(
      `leaseDurationSeconds must be an integer between ${MIN_LEASE_DURATION_SECONDS} and ${MAX_LEASE_DURATION_SECONDS}`,
    );
  }
}

export type ClaimNextVerificationJobDependencies = {
  claimNextJob: (
    input: ClaimNextBacklinkVerificationJobInput,
  ) => Promise<BacklinkVerificationJob | null>;
};

export async function claimNextVerificationJob(
  dependencies: ClaimNextVerificationJobDependencies,
  input: ClaimNextBacklinkVerificationJobInput,
): Promise<ClaimNextBacklinkVerificationJobResult> {
  assertValidWorkerId(input.workerId);
  assertValidDateString(input.claimedAt, "claimedAt");
  assertValidLeaseDuration(input.leaseDurationSeconds);

  const job = await dependencies.claimNextJob(input);
  return job == null ? { kind: "empty" } : { kind: "claimed", job };
}

export type ExtendVerificationJobLeaseDependencies = {
  heartbeatBacklinkVerificationJob: (
    input: HeartbeatBacklinkVerificationJobInput,
  ) => Promise<BacklinkVerificationJob | null>;
};

export async function extendVerificationJobLease(
  dependencies: ExtendVerificationJobLeaseDependencies,
  input: HeartbeatBacklinkVerificationJobInput,
): Promise<HeartbeatBacklinkVerificationJobResult> {
  assertNonEmptyString(input.jobId, "jobId");
  assertValidWorkerId(input.workerId);
  assertValidDateString(input.heartbeatAt, "heartbeatAt");
  assertValidLeaseDuration(input.leaseDurationSeconds);

  const job = await dependencies.heartbeatBacklinkVerificationJob(input);
  return job == null ? { kind: "rejected", reason: "not_updated" } : { kind: "extended", job };
}

export type CompleteVerificationJobDependencies = {
  completeBacklinkVerificationJob: (
    input: CompleteBacklinkVerificationJobInput,
  ) => Promise<BacklinkVerificationJob | null>;
};

export async function completeVerificationJob(
  dependencies: CompleteVerificationJobDependencies,
  input: CompleteBacklinkVerificationJobInput,
): Promise<CompleteBacklinkVerificationJobResult> {
  assertNonEmptyString(input.jobId, "jobId");
  assertValidWorkerId(input.workerId);
  assertValidDateString(input.completedAt, "completedAt");

  const job = await dependencies.completeBacklinkVerificationJob(input);
  return job == null ? { kind: "rejected", reason: "not_updated" } : { kind: "completed", job };
}

export type FailVerificationJobDependencies = {
  failBacklinkVerificationJob: (
    input: FailBacklinkVerificationJobInput,
  ) => Promise<BacklinkVerificationJob | null>;
};

export async function failVerificationJob(
  dependencies: FailVerificationJobDependencies,
  input: FailBacklinkVerificationJobInput,
): Promise<FailBacklinkVerificationJobResult> {
  assertNonEmptyString(input.jobId, "jobId");
  assertValidWorkerId(input.workerId);
  assertValidDateString(input.failedAt, "failedAt");
  assertNonEmptyString(input.errorCode, "errorCode");
  assertNonEmptyString(input.errorMessage, "errorMessage");

  const job = await dependencies.failBacklinkVerificationJob(input);
  return job == null ? { kind: "rejected", reason: "not_updated" } : { kind: "failed", job };
}
