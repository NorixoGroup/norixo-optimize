import type {
  ClaimBacklinkVerificationJobByIdDependencies,
  ClaimBacklinkVerificationJobByIdInput,
  ClaimBacklinkVerificationJobByIdResult,
} from "./targeted-job-claim-types";

const MIN_LEASE_DURATION_SECONDS = 30;
const MAX_LEASE_DURATION_SECONDS = 3600;

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
    leaseDurationSeconds < MIN_LEASE_DURATION_SECONDS ||
    leaseDurationSeconds > MAX_LEASE_DURATION_SECONDS
  ) {
    throw new Error(
      `leaseDurationSeconds must be an integer between ${MIN_LEASE_DURATION_SECONDS} and ${MAX_LEASE_DURATION_SECONDS}`,
    );
  }
}

export async function claimBacklinkVerificationJobById(
  dependencies: ClaimBacklinkVerificationJobByIdDependencies,
  input: ClaimBacklinkVerificationJobByIdInput,
): Promise<ClaimBacklinkVerificationJobByIdResult> {
  assertNonEmptyString(input.workspaceId, "workspaceId");
  assertNonEmptyString(input.jobId, "jobId");
  assertNonEmptyString(input.workerId, "workerId");
  assertValidDateString(input.claimedAt, "claimedAt");
  assertValidLeaseDuration(input.leaseDurationSeconds);

  const job = await dependencies.claimJobById(input);
  return job == null
    ? { kind: "rejected", reason: "not_updated" }
    : { kind: "claimed", job };
}
