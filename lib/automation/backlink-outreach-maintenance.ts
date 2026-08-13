import type { Json } from "@/types/database.types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const BACKLINK_OUTREACH_MAINTENANCE_RUN_KIND = "backlinks.outreach.maintenance" as const;
export const BACKLINK_OUTREACH_FOLLOW_UP_DUE_TASK_KIND = "backlinks.outreach.follow_up_due" as const;
export const BACKLINK_OUTREACH_FINAL_RESPONSE_EXPIRED_TASK_KIND = "backlinks.outreach.final_response_expired" as const;

export type BacklinkOutreachMaintenanceRunKind = typeof BACKLINK_OUTREACH_MAINTENANCE_RUN_KIND;
export type BacklinkOutreachMaintenanceRunOperation =
  | "schedule_reconciliation"
  | "signal_detection";
export type BacklinkOutreachMaintenanceTaskKind =
  | typeof BACKLINK_OUTREACH_FOLLOW_UP_DUE_TASK_KIND
  | typeof BACKLINK_OUTREACH_FINAL_RESPONSE_EXPIRED_TASK_KIND;

export type BacklinkOutreachMaintenanceRunInput = {
  workspaceId: string;
  requestedBy: string | null;
  idempotencyKey: string;
  scheduledAt: string;
  operation: BacklinkOutreachMaintenanceRunOperation;
  limit: number;
};

export type BacklinkOutreachFollowUpDueTaskInput = {
  outreachId: string;
  nextFollowUpAt: string;
  currentAttempt: number;
  maxAttempts: number;
};

export type BacklinkOutreachFinalResponseExpiredTaskInput = {
  outreachId: string;
  responseDeadlineAt: string;
  currentAttempt: number;
  maxAttempts: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertUuid(value: string, label: string): void {
  assert(UUID_PATTERN.test(value), `${label} must be a valid UUID`);
}

function assertTimestamp(value: string, label: string): void {
  assert(Number.isFinite(Date.parse(value)), `${label} must be a valid date`);
}

function normalizeTimestamp(value: string, label: string): string {
  assertTimestamp(value, label);
  return new Date(value).toISOString();
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actualKeys = Object.keys(value);
  assert(
    actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key)),
    `${label} must have an exact object shape`,
  );
}

export function validateBacklinkOutreachMaintenanceRunInput(value: unknown): BacklinkOutreachMaintenanceRunInput {
  assert(isRecord(value), "Backlink outreach maintenance run input must be an object");
  assertExactKeys(value, ["workspaceId", "requestedBy", "idempotencyKey", "scheduledAt", "operation", "limit"], "Backlink outreach maintenance run input");
  assert(typeof value.workspaceId === "string" && value.workspaceId.trim().length > 0, "workspaceId must not be empty");
  assertUuid(value.workspaceId, "workspaceId");
  assert(value.requestedBy === null || (typeof value.requestedBy === "string" && value.requestedBy.trim().length > 0), "requestedBy must be a UUID or null");
  if (typeof value.requestedBy === "string") {
    assertUuid(value.requestedBy, "requestedBy");
  }
  assert(typeof value.idempotencyKey === "string" && value.idempotencyKey.trim().length > 0 && value.idempotencyKey === value.idempotencyKey.trim() && value.idempotencyKey.length <= 255, "idempotencyKey must be trimmed and at most 255 characters");
  assert(typeof value.scheduledAt === "string", "scheduledAt must be a string");
  assertTimestamp(value.scheduledAt, "scheduledAt");
  assert(value.operation === "schedule_reconciliation" || value.operation === "signal_detection", "operation must be valid");
  assert(typeof value.limit === "number" && Number.isInteger(value.limit) && value.limit >= 1, "limit must be an integer between 1 and 200");
  return {
    workspaceId: value.workspaceId,
    requestedBy: value.requestedBy,
    idempotencyKey: value.idempotencyKey,
    scheduledAt: value.scheduledAt,
    operation: value.operation,
    limit: value.limit,
  };
}

export function validateBacklinkOutreachFollowUpDueTaskInput(value: unknown): BacklinkOutreachFollowUpDueTaskInput {
  assert(isRecord(value), "Follow-up due task input must be an object");
  assertExactKeys(value, ["outreachId", "nextFollowUpAt", "currentAttempt", "maxAttempts"], "Follow-up due task input");
  const outreachId = value.outreachId;
  const nextFollowUpAt = value.nextFollowUpAt;
  const currentAttempt = value.currentAttempt;
  const maxAttempts = value.maxAttempts;
  assert(typeof outreachId === "string" && outreachId.trim().length > 0, "outreachId must not be empty");
  assertUuid(outreachId, "outreachId");
  assert(typeof nextFollowUpAt === "string", "nextFollowUpAt must be a string");
  assertTimestamp(nextFollowUpAt, "nextFollowUpAt");
  if (typeof currentAttempt !== "number" || !Number.isInteger(currentAttempt) || currentAttempt < 0) {
    throw new Error("currentAttempt must be a non-negative integer");
  }
  if (typeof maxAttempts !== "number" || !Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error("maxAttempts must be a positive integer");
  }
  assert(currentAttempt <= maxAttempts, "currentAttempt must be less than or equal to maxAttempts");
  return {
    outreachId,
    nextFollowUpAt,
    currentAttempt,
    maxAttempts,
  };
}

export function validateBacklinkOutreachFinalResponseExpiredTaskInput(value: unknown): BacklinkOutreachFinalResponseExpiredTaskInput {
  assert(isRecord(value), "Final response expired task input must be an object");
  assertExactKeys(value, ["outreachId", "responseDeadlineAt", "currentAttempt", "maxAttempts"], "Final response expired task input");
  const outreachId = value.outreachId;
  const responseDeadlineAt = value.responseDeadlineAt;
  const currentAttempt = value.currentAttempt;
  const maxAttempts = value.maxAttempts;
  assert(typeof outreachId === "string" && outreachId.trim().length > 0, "outreachId must not be empty");
  assertUuid(outreachId, "outreachId");
  assert(typeof responseDeadlineAt === "string", "responseDeadlineAt must be a string");
  assertTimestamp(responseDeadlineAt, "responseDeadlineAt");
  if (typeof currentAttempt !== "number" || !Number.isInteger(currentAttempt) || currentAttempt < 0) {
    throw new Error("currentAttempt must be a non-negative integer");
  }
  if (typeof maxAttempts !== "number" || !Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error("maxAttempts must be a positive integer");
  }
  assert(currentAttempt <= maxAttempts, "currentAttempt must be less than or equal to maxAttempts");
  return {
    outreachId,
    responseDeadlineAt,
    currentAttempt,
    maxAttempts,
  };
}

export function buildBacklinkOutreachFollowUpDueTaskKey(input: BacklinkOutreachFollowUpDueTaskInput): string {
  const normalizedNextFollowUpAt = normalizeTimestamp(input.nextFollowUpAt, "nextFollowUpAt");
  return `outreach-follow-up-due:${input.outreachId}:${normalizedNextFollowUpAt}:${input.currentAttempt}`;
}

export function buildBacklinkOutreachFinalResponseExpiredTaskKey(input: BacklinkOutreachFinalResponseExpiredTaskInput): string {
  const normalizedResponseDeadlineAt = normalizeTimestamp(input.responseDeadlineAt, "responseDeadlineAt");
  return `outreach-final-response-expired:${input.outreachId}:${normalizedResponseDeadlineAt}:${input.currentAttempt}`;
}

export type BacklinkOutreachMaintenanceRunInputJson = Record<string, Json>;
