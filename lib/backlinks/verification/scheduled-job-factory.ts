import type { CreateBacklinkVerificationJobInput } from "./job-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_JOB_KEY_LENGTH = 255;

function assertNonEmptyString(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function assertUuid(value: string, fieldName: string): void {
  if (!UUID_PATTERN.test(value.trim())) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }
}

function assertValidDateString(value: string, fieldName: string): void {
  assertNonEmptyString(value, fieldName);
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${fieldName} must be a valid date`);
  }
}

function normalizedCadenceDays(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > 3650) {
    throw new Error("cadenceDays must be an integer between 1 and 3650");
  }
  return value;
}

export function buildScheduledBacklinkVerificationJobInput(input: {
  workspaceId: string;
  linkId: string;
  queuedAt: string;
  anchorAt: string;
  cadenceDays: number;
  policy: CreateBacklinkVerificationJobInput["policy"];
  http: CreateBacklinkVerificationJobInput["http"];
}): CreateBacklinkVerificationJobInput {
  assertUuid(input.workspaceId, "workspaceId");
  assertUuid(input.linkId, "linkId");
  assertValidDateString(input.queuedAt, "queuedAt");
  assertValidDateString(input.anchorAt, "anchorAt");
  const cadenceDays = normalizedCadenceDays(input.cadenceDays);

  const cadenceMs = cadenceDays * 24 * 60 * 60 * 1000;
  const periodBucket = Math.trunc(Date.parse(input.anchorAt) / cadenceMs).toString(36);
  const jobKey = `scheduled:${input.linkId}:${periodBucket}`;
  if (jobKey.length > MAX_JOB_KEY_LENGTH) {
    throw new Error("scheduled jobKey must not exceed 255 characters");
  }

  return {
    workspaceId: input.workspaceId,
    linkId: input.linkId,
    jobKey,
    triggerSource: "scheduler",
    policy: input.policy,
    http: input.http,
    queuedAt: input.queuedAt,
  };
}
