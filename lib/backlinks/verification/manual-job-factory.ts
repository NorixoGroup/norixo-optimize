import type { CreateBacklinkVerificationJobInput } from "./job-types";
import type { BuildManualBacklinkVerificationJobInput } from "./manual-job-factory-types";

function assertNonEmptyString(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function assertValidDateString(value: string, fieldName: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${fieldName} must be a valid date`);
  }
}

export function buildManualBacklinkVerificationJobInput(
  input: BuildManualBacklinkVerificationJobInput,
): CreateBacklinkVerificationJobInput {
  assertNonEmptyString(input.workspaceId, "workspaceId");
  assertNonEmptyString(input.linkId, "linkId");
  assertValidDateString(input.queuedAt, "queuedAt");

  const utcDay = new Date(input.queuedAt).toISOString().slice(0, 10);
  const jobKey = `manual:${input.linkId}:${utcDay}`;
  if (jobKey.length > 255) {
    throw new Error("manual jobKey must not exceed 255 characters");
  }

  return {
    workspaceId: input.workspaceId,
    linkId: input.linkId,
    jobKey,
    triggerSource: "manual",
    policy: input.policy,
    http: input.http,
    queuedAt: input.queuedAt,
  };
}
