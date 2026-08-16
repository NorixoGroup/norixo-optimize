import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, BacklinkUpdate, WorkspaceId } from "./types";
import type { Database } from "@/types/database.types";

export type BacklinkOutreachRow = BacklinkRow<"backlink_outreach">;
type BacklinkOutreachInsert = BacklinkInsert<"backlink_outreach">;
type BacklinkOutreachUpdate = BacklinkUpdate<"backlink_outreach">;
export type BacklinkOutreachLifecyclePatch = Pick<BacklinkOutreachUpdate, "status" | "last_response_type" | "closed_at" | "stop_reason" | "next_follow_up_at" | "response_deadline_at">;
type ReconcileBacklinkOutreachFollowUpScheduleRpcName = "reconcile_backlink_outreach_follow_up_schedule";
type ReconcileBacklinkOutreachFollowUpScheduleRpcArgs = Database["public"]["Functions"][ReconcileBacklinkOutreachFollowUpScheduleRpcName]["Args"];
type ReconcileBacklinkOutreachFollowUpScheduleRpcRow = Database["public"]["Functions"][ReconcileBacklinkOutreachFollowUpScheduleRpcName]["Returns"][number];
type ListBacklinkOutreachDueFollowUpsRpcName = "list_backlink_outreach_due_follow_ups";
type ListBacklinkOutreachDueFollowUpsRpcArgs = Database["public"]["Functions"][ListBacklinkOutreachDueFollowUpsRpcName]["Args"];
type ListBacklinkOutreachDueFollowUpsRpcRow = Database["public"]["Functions"][ListBacklinkOutreachDueFollowUpsRpcName]["Returns"][number];
type ListBacklinkOutreachExpiredResponseDeadlinesRpcName = "list_backlink_outreach_expired_response_deadlines";
type ListBacklinkOutreachExpiredResponseDeadlinesRpcArgs = Database["public"]["Functions"][ListBacklinkOutreachExpiredResponseDeadlinesRpcName]["Args"];
type ListBacklinkOutreachExpiredResponseDeadlinesRpcRow = Database["public"]["Functions"][ListBacklinkOutreachExpiredResponseDeadlinesRpcName]["Returns"][number];
type ApplyBacklinkOutreachFinalNoResponseRpcName = "apply_backlink_outreach_final_no_response";
type ApplyBacklinkOutreachFinalNoResponseRpcArgs = Database["public"]["Functions"][ApplyBacklinkOutreachFinalNoResponseRpcName]["Args"];
type ApplyBacklinkOutreachFinalNoResponseRpcRow = Database["public"]["Functions"][ApplyBacklinkOutreachFinalNoResponseRpcName]["Returns"][number];
type ApplyBacklinkOutreachBacklinkObtainedRpcName = "apply_backlink_outreach_backlink_obtained";
type ApplyBacklinkOutreachBacklinkObtainedRpcArgs = {
  p_workspace_id: string;
  p_outreach_id: string;
  p_applied_at: string;
};
type ApplyBacklinkOutreachBacklinkObtainedRpcRow = {
  disposition: "applied" | "existing";
  outreach_id: string;
  previous_status: string;
  outreach_status: "closed";
  last_response_type: "positive";
  closed_at: string;
  stop_reason: "backlink_obtained";
  next_follow_up_at: string | null;
  response_deadline_at: string | null;
};

type BacklinkOutreachSystemColumns =
  | "id"
  | "workspace_id"
  | "created_by"
  | "created_at"
  | "updated_at";

export type CreateBacklinkOutreachInput = Omit<
  BacklinkOutreachInsert,
  BacklinkOutreachSystemColumns
> & {
  createdBy: string;
};

export type UpdateBacklinkOutreachInput = Omit<
  BacklinkOutreachUpdate,
  BacklinkOutreachSystemColumns
>;

export type ActivateBacklinkOutreachAfterEmailAcceptedInput = {
  status: "active";
  currentAttempt: number;
  firstContactAt: string;
  lastAttemptAt: string;
};

export type ReconcileBacklinkOutreachFollowUpScheduleInput = {
  expectedCurrentAttempt: number;
  expectedLastAttemptAt: string;
  scheduleKind: "follow_up" | "final_response";
  scheduledAt: string;
};

export type ReconcileBacklinkOutreachFollowUpScheduleResult = {
  disposition: "scheduled" | "existing";
  kind: "follow_up" | "final_response";
  scheduledAt: string;
  nextFollowUpAt: string | null;
  responseDeadlineAt: string | null;
};

export type BacklinkOutreachDueFollowUpRow = {
  outreachId: string;
  nextFollowUpAt: string;
  currentAttempt: number;
  maxAttempts: number;
  latestAttemptId: string;
  latestAttemptStatus: string;
};

export type BacklinkOutreachExpiredResponseDeadlineRow = {
  outreachId: string;
  responseDeadlineAt: string;
  currentAttempt: number;
  maxAttempts: number;
  latestAttemptId: string;
  latestAttemptStatus: string;
};

export type ApplyBacklinkOutreachFinalNoResponseResult = {
  disposition: "applied" | "existing";
  outreachId: string;
  outreachStatus: "no_response";
  closedAt: string;
  stopReason: "attempt_limit";
  nextFollowUpAt: string | null;
  responseDeadlineAt: string | null;
};

export type ApplyBacklinkOutreachBacklinkObtainedResult = {
  disposition: "applied" | "existing";
  outreachId: string;
  previousStatus: string;
  outreachStatus: "closed";
  lastResponseType: "positive";
  closedAt: string;
  stopReason: "backlink_obtained";
  nextFollowUpAt: string | null;
  responseDeadlineAt: string | null;
};

export type ListBacklinkOutreachDueFollowUpsInput = {
  workspaceId: WorkspaceId;
  now: string;
  limit?: number;
};

export interface ListBacklinkOutreachInput {
  workspaceId: WorkspaceId;
  pagination?: RepositoryPageRequest;
}

function assertNonEmptyUpdate(operation: string, input: UpdateBacklinkOutreachInput): void {
  if (Object.keys(input).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one field must be provided for update.",
    });
  }
}

function throwNotFound(operation: string, outreachId: string): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: { entity: "backlink_outreach", resourceId: outreachId },
  });
}

export async function getBacklinkOutreachById(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
): Promise<BacklinkOutreachRow> {
  const operation = "getBacklinkOutreachById";
  const { data, error } = await client
    .from("backlink_outreach")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", outreachId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, outreachId);
  }

  return data;
}

export async function listBacklinkOutreach(
  client: BacklinkRepositoryClient,
  input: ListBacklinkOutreachInput,
): Promise<RepositoryPage<BacklinkOutreachRow>> {
  const operation = "listBacklinkOutreach";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_outreach")
    .select("*", { count: "exact" })
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page.from, page.to);

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  const total = count ?? 0;
  return {
    items: data ?? [],
    page: page.page,
    pageSize: page.pageSize,
    total,
    hasNextPage: page.to + 1 < total,
  };
}

export async function listBacklinkOutreachByOpportunity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  opportunityId: string,
): Promise<BacklinkOutreachRow[]> {
  const operation = "listBacklinkOutreachByOpportunity";
  const { data, error } = await client.from("backlink_outreach").select("*").eq("workspace_id", workspaceId).eq("opportunity_id", opportunityId);
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return data ?? [];
}

export type BacklinkOutreachScheduleApplyCandidateRow = Pick<
  BacklinkOutreachRow,
  | "id"
  | "workspace_id"
  | "contact_id"
  | "status"
  | "channel"
  | "current_attempt"
  | "max_attempts"
  | "last_attempt_at"
  | "next_follow_up_at"
  | "response_deadline_at"
>;

export async function listBacklinkOutreachScheduleApplyCandidates(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  limit: number,
): Promise<BacklinkOutreachScheduleApplyCandidateRow[]> {
  const operation = "listBacklinkOutreachScheduleApplyCandidates";
  const { data, error } = await client
    .from("backlink_outreach")
    .select("id, workspace_id, contact_id, status, channel, current_attempt, max_attempts, last_attempt_at, next_follow_up_at, response_deadline_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .eq("channel", "email")
    .gt("current_attempt", 0)
    .not("last_attempt_at", "is", null)
    .is("next_follow_up_at", null)
    .is("response_deadline_at", null)
    .order("last_attempt_at", { ascending: true, nullsFirst: true })
    .order("id", { ascending: true })
    .limit(limit);

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return (data ?? []) as BacklinkOutreachScheduleApplyCandidateRow[];
}

const activeOutreachStatuses = [
  "draft",
  "ready",
  "active",
  "replied",
  "conversation_open",
  "paused",
];

export async function getActiveBacklinkOutreachByIdentity(
  client: BacklinkRepositoryClient,
  input: {
    workspaceId: WorkspaceId;
    opportunityId: string;
    contactId: string;
    channel: string;
  },
): Promise<BacklinkOutreachRow | null> {
  const operation = "getActiveBacklinkOutreachByIdentity";
  const { data, error } = await client
    .from("backlink_outreach")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("opportunity_id", input.opportunityId)
    .eq("contact_id", input.contactId)
    .eq("channel", input.channel)
    .in("status", activeOutreachStatuses)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function createBacklinkOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkOutreachInput,
): Promise<BacklinkOutreachRow> {
  const operation = "createBacklinkOutreach";
  const { createdBy, ...outreach } = input;
  const payload: BacklinkOutreachInsert = {
    ...outreach,
    workspace_id: workspaceId,
    created_by: createdBy,
  };
  const { data, error } = await client
    .from("backlink_outreach")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function updateBacklinkOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
  input: UpdateBacklinkOutreachInput,
): Promise<BacklinkOutreachRow> {
  const operation = "updateBacklinkOutreach";
  assertNonEmptyUpdate(operation, input);

  const { data, error } = await client
    .from("backlink_outreach")
    .update(input)
    .eq("workspace_id", workspaceId)
    .eq("id", outreachId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, outreachId);
  }

  return data;
}

export async function updateBacklinkOutreachLifecycleIfStatus(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
  expectedStatus: BacklinkOutreachRow["status"],
  patch: BacklinkOutreachLifecyclePatch,
): Promise<BacklinkOutreachRow | null> {
  const operation = "updateBacklinkOutreachLifecycleIfStatus";
  const { data, error } = await client
    .from("backlink_outreach")
    .update(patch)
    .eq("workspace_id", workspaceId)
    .eq("id", outreachId)
    .eq("status", expectedStatus)
    .select("*")
    .maybeSingle();

  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return data;
}

export async function activateBacklinkOutreachAfterEmailAccepted(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
  input: ActivateBacklinkOutreachAfterEmailAcceptedInput,
): Promise<BacklinkOutreachRow> {
  const operation = "activateBacklinkOutreachAfterEmailAccepted";
  const { data, error } = await client
    .from("backlink_outreach")
    .update({
      status: input.status,
      current_attempt: input.currentAttempt,
      first_contact_at: input.firstContactAt,
      last_attempt_at: input.lastAttemptAt,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", outreachId)
    .eq("status", "ready")
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, outreachId);
  }

  return data;
}

function mapReconcileBacklinkOutreachFollowUpSchedule(value: unknown): ReconcileBacklinkOutreachFollowUpScheduleResult {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "reconcileBacklinkOutreachFollowUpSchedule",
      message: "The database returned an invalid follow-up schedule result.",
    });
  }
  const record = value as Record<string, unknown>;
  const { disposition, schedule_kind: kind, scheduled_at: scheduledAt, next_follow_up_at: nextFollowUpAt, response_deadline_at: responseDeadlineAt } = record;
  if ((disposition !== "scheduled" && disposition !== "existing") || (kind !== "follow_up" && kind !== "final_response") || typeof scheduledAt !== "string" || (typeof nextFollowUpAt !== "string" && nextFollowUpAt !== null) || (typeof responseDeadlineAt !== "string" && responseDeadlineAt !== null)) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "reconcileBacklinkOutreachFollowUpSchedule",
      message: "The database returned an invalid follow-up schedule result.",
    });
  }
  return { disposition, kind, scheduledAt, nextFollowUpAt, responseDeadlineAt };
}

function normalizeReconcileBacklinkOutreachFollowUpScheduleError(error: unknown): BacklinkRepositoryError {
  if (typeof error === "object" && error != null && "message" in error && typeof error.message === "string") {
    if (error.message.startsWith("FOLLOW_UP_SCHEDULE_CONFLICT")) {
      return new BacklinkRepositoryError({ code: "CONFLICT", operation: "reconcileBacklinkOutreachFollowUpSchedule", message: error.message });
    }
    if (error.message.startsWith("FOLLOW_UP_SCHEDULE_STATE_MISMATCH")) {
      return new BacklinkRepositoryError({ code: "CONFLICT", operation: "reconcileBacklinkOutreachFollowUpSchedule", message: error.message });
    }
    if (error.message.startsWith("FOLLOW_UP_SCHEDULE_")) {
      return new BacklinkRepositoryError({ code: "VALIDATION", operation: "reconcileBacklinkOutreachFollowUpSchedule", message: error.message });
    }
  }
  return normalizeBacklinkRepositoryError("reconcileBacklinkOutreachFollowUpSchedule", error);
}

function normalizeDueFollowUpsLimit(limit: number | undefined): number {
  if (limit == null) return 50;
  if (!Number.isInteger(limit) || limit < 1) return 50;
  return Math.min(limit, 200);
}

function normalizeExpiredResponseDeadlinesLimit(limit: number | undefined): number {
  if (limit == null) return 50;
  if (!Number.isInteger(limit) || limit < 1) return 50;
  return Math.min(limit, 200);
}

function mapBacklinkOutreachDueFollowUpRow(value: unknown): BacklinkOutreachDueFollowUpRow {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "listBacklinkOutreachDueFollowUps",
      message: "The database returned an invalid due follow-up row.",
    });
  }
  const record = value as Record<string, unknown>;
  const { outreach_id: outreachId, next_follow_up_at: nextFollowUpAt, current_attempt: currentAttempt, max_attempts: maxAttempts, latest_attempt_id: latestAttemptId, latest_attempt_status: latestAttemptStatus } = record;
  if (typeof outreachId !== "string" || typeof nextFollowUpAt !== "string" || typeof currentAttempt !== "number" || typeof maxAttempts !== "number" || typeof latestAttemptId !== "string" || typeof latestAttemptStatus !== "string") {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "listBacklinkOutreachDueFollowUps",
      message: "The database returned an invalid due follow-up row.",
    });
  }
  return { outreachId, nextFollowUpAt, currentAttempt, maxAttempts, latestAttemptId, latestAttemptStatus };
}

function mapBacklinkOutreachExpiredResponseDeadlineRow(value: unknown): BacklinkOutreachExpiredResponseDeadlineRow {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "listBacklinkOutreachExpiredResponseDeadlines",
      message: "The database returned an invalid expired response deadline row.",
    });
  }
  const record = value as Record<string, unknown>;
  const { outreach_id: outreachId, response_deadline_at: responseDeadlineAt, current_attempt: currentAttempt, max_attempts: maxAttempts, latest_attempt_id: latestAttemptId, latest_attempt_status: latestAttemptStatus } = record;
  if (typeof outreachId !== "string" || typeof responseDeadlineAt !== "string" || typeof currentAttempt !== "number" || typeof maxAttempts !== "number" || typeof latestAttemptId !== "string" || typeof latestAttemptStatus !== "string") {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "listBacklinkOutreachExpiredResponseDeadlines",
      message: "The database returned an invalid expired response deadline row.",
    });
  }
  return { outreachId, responseDeadlineAt, currentAttempt, maxAttempts, latestAttemptId, latestAttemptStatus };
}

function mapApplyBacklinkOutreachFinalNoResponseResult(value: unknown): ApplyBacklinkOutreachFinalNoResponseResult {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "applyBacklinkOutreachFinalNoResponse",
      message: "The database returned an invalid final no-response result.",
    });
  }
  const record = value as Record<string, unknown>;
  const { disposition, outreach_id: outreachId, outreach_status: outreachStatus, closed_at: closedAt, stop_reason: stopReason, next_follow_up_at: nextFollowUpAt, response_deadline_at: responseDeadlineAt } = record;
  if ((disposition !== "applied" && disposition !== "existing") || typeof outreachId !== "string" || outreachStatus !== "no_response" || typeof closedAt !== "string" || stopReason !== "attempt_limit" || (typeof nextFollowUpAt !== "string" && nextFollowUpAt !== null) || (typeof responseDeadlineAt !== "string" && responseDeadlineAt !== null)) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "applyBacklinkOutreachFinalNoResponse",
      message: "The database returned an invalid final no-response result.",
    });
  }
  return { disposition, outreachId, outreachStatus, closedAt, stopReason, nextFollowUpAt, responseDeadlineAt };
}

function mapApplyBacklinkOutreachBacklinkObtainedResult(value: unknown): ApplyBacklinkOutreachBacklinkObtainedResult {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "applyBacklinkOutreachBacklinkObtained",
      message: "The database returned an invalid backlink obtained result.",
    });
  }
  const record = value as Record<string, unknown>;
  const {
    disposition,
    outreach_id: outreachId,
    previous_status: previousStatus,
    outreach_status: outreachStatus,
    last_response_type: lastResponseType,
    closed_at: closedAt,
    stop_reason: stopReason,
    next_follow_up_at: nextFollowUpAt,
    response_deadline_at: responseDeadlineAt,
  } = record;
  if (
    (disposition !== "applied" && disposition !== "existing")
    || typeof outreachId !== "string"
    || typeof previousStatus !== "string"
    || outreachStatus !== "closed"
    || lastResponseType !== "positive"
    || typeof closedAt !== "string"
    || stopReason !== "backlink_obtained"
    || (typeof nextFollowUpAt !== "string" && nextFollowUpAt !== null)
    || (typeof responseDeadlineAt !== "string" && responseDeadlineAt !== null)
  ) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "applyBacklinkOutreachBacklinkObtained",
      message: "The database returned an invalid backlink obtained result.",
    });
  }
  return { disposition, outreachId, previousStatus, outreachStatus, lastResponseType, closedAt, stopReason, nextFollowUpAt, responseDeadlineAt };
}

export async function reconcileBacklinkOutreachFollowUpSchedule(
  client: { rpc(functionName: ReconcileBacklinkOutreachFollowUpScheduleRpcName, args: ReconcileBacklinkOutreachFollowUpScheduleRpcArgs): PromiseLike<{ data: ReconcileBacklinkOutreachFollowUpScheduleRpcRow[] | null; error: unknown }> },
  workspaceId: WorkspaceId,
  outreachId: string,
  input: ReconcileBacklinkOutreachFollowUpScheduleInput,
): Promise<ReconcileBacklinkOutreachFollowUpScheduleResult> {
  const { data, error } = await client.rpc("reconcile_backlink_outreach_follow_up_schedule", {
    p_workspace_id: workspaceId,
    p_outreach_id: outreachId,
    p_expected_current_attempt: input.expectedCurrentAttempt,
    p_expected_last_attempt_at: input.expectedLastAttemptAt,
    p_schedule_kind: input.scheduleKind,
    p_scheduled_at: input.scheduledAt,
  });
  if (error != null) throw normalizeReconcileBacklinkOutreachFollowUpScheduleError(error);
  if (!Array.isArray(data) || data.length !== 1) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "reconcileBacklinkOutreachFollowUpSchedule",
      message: "The database returned an invalid follow-up schedule result.",
    });
  }
  return mapReconcileBacklinkOutreachFollowUpSchedule(data[0]);
}

export async function listBacklinkOutreachDueFollowUps(
  client: { rpc(functionName: ListBacklinkOutreachDueFollowUpsRpcName, args: ListBacklinkOutreachDueFollowUpsRpcArgs): PromiseLike<{ data: ListBacklinkOutreachDueFollowUpsRpcRow[] | null; error: unknown }> },
  input: ListBacklinkOutreachDueFollowUpsInput,
): Promise<BacklinkOutreachDueFollowUpRow[]> {
  const { data, error } = await client.rpc("list_backlink_outreach_due_follow_ups", {
    p_workspace_id: input.workspaceId,
    p_now: input.now,
    p_limit: normalizeDueFollowUpsLimit(input.limit),
  });
  if (error != null) throw normalizeBacklinkRepositoryError("listBacklinkOutreachDueFollowUps", error);
  if (!Array.isArray(data)) return [];
  return data.map(mapBacklinkOutreachDueFollowUpRow);
}

export type ListBacklinkOutreachExpiredResponseDeadlinesInput = {
  workspaceId: WorkspaceId;
  now: string;
  limit?: number;
};

export async function listBacklinkOutreachExpiredResponseDeadlines(
  client: { rpc(functionName: ListBacklinkOutreachExpiredResponseDeadlinesRpcName, args: ListBacklinkOutreachExpiredResponseDeadlinesRpcArgs): PromiseLike<{ data: ListBacklinkOutreachExpiredResponseDeadlinesRpcRow[] | null; error: unknown }> },
  input: ListBacklinkOutreachExpiredResponseDeadlinesInput,
): Promise<BacklinkOutreachExpiredResponseDeadlineRow[]> {
  const { data, error } = await client.rpc("list_backlink_outreach_expired_response_deadlines", {
    p_workspace_id: input.workspaceId,
    p_now: input.now,
    p_limit: normalizeExpiredResponseDeadlinesLimit(input.limit),
  });
  if (error != null) throw normalizeBacklinkRepositoryError("listBacklinkOutreachExpiredResponseDeadlines", error);
  if (!Array.isArray(data)) return [];
  return data.map(mapBacklinkOutreachExpiredResponseDeadlineRow);
}

export async function applyBacklinkOutreachFinalNoResponse(
  client: { rpc(functionName: ApplyBacklinkOutreachFinalNoResponseRpcName, args: ApplyBacklinkOutreachFinalNoResponseRpcArgs): PromiseLike<{ data: ApplyBacklinkOutreachFinalNoResponseRpcRow[] | null; error: unknown }> },
  workspaceId: WorkspaceId,
  outreachId: string,
  appliedAt: string,
): Promise<ApplyBacklinkOutreachFinalNoResponseResult> {
  const { data, error } = await client.rpc("apply_backlink_outreach_final_no_response", {
    p_workspace_id: workspaceId,
    p_outreach_id: outreachId,
    p_applied_at: appliedAt,
  });
  if (error != null) throw normalizeBacklinkRepositoryError("applyBacklinkOutreachFinalNoResponse", error);
  if (!Array.isArray(data) || data.length !== 1) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "applyBacklinkOutreachFinalNoResponse",
      message: "The database returned an invalid final no-response result.",
    });
  }
  return mapApplyBacklinkOutreachFinalNoResponseResult(data[0]);
}

export async function applyBacklinkOutreachBacklinkObtained(
  client: { rpc(functionName: ApplyBacklinkOutreachBacklinkObtainedRpcName, args: ApplyBacklinkOutreachBacklinkObtainedRpcArgs): PromiseLike<{ data: ApplyBacklinkOutreachBacklinkObtainedRpcRow[] | null; error: unknown }> },
  workspaceId: WorkspaceId,
  outreachId: string,
  appliedAt: string,
): Promise<ApplyBacklinkOutreachBacklinkObtainedResult> {
  const { data, error } = await client.rpc("apply_backlink_outreach_backlink_obtained", {
    p_workspace_id: workspaceId,
    p_outreach_id: outreachId,
    p_applied_at: appliedAt,
  });
  if (error != null) throw normalizeBacklinkRepositoryError("applyBacklinkOutreachBacklinkObtained", error);
  if (!Array.isArray(data) || data.length !== 1) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "applyBacklinkOutreachBacklinkObtained",
      message: "The database returned an invalid backlink obtained result.",
    });
  }
  return mapApplyBacklinkOutreachBacklinkObtainedResult(data[0]);
}
