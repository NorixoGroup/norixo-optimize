import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, WorkspaceId } from "./types";
import type { Json } from "@/types/database.types";
import type { Database } from "@/types/database.types";
import type { BacklinkVerificationJob, CreateBacklinkVerificationJobInput } from "../verification/job-types";

export type BacklinkVerificationJobRow = BacklinkRow<"backlink_verification_jobs">;
export type BacklinkVerificationJobHistoryRow = Pick<
  BacklinkVerificationJobRow,
  "trigger_source" | "status" | "completed_at" | "result_summary" | "created_at"
>;
type BacklinkVerificationJobInsert = BacklinkInsert<"backlink_verification_jobs">;

function toPolicyJson(input: CreateBacklinkVerificationJobInput["policy"]): Json {
  return { ...input };
}

function toHttpJson(input: CreateBacklinkVerificationJobInput["http"]): Json {
  return {
    timeoutMs: input.timeoutMs,
    maxRedirects: input.maxRedirects,
    maxResponseBytes: input.maxResponseBytes,
    ...(input.userAgent == null ? {} : { userAgent: input.userAgent }),
  };
}

function mapJob(row: BacklinkVerificationJobRow): BacklinkVerificationJob {
  if (
    !["queued", "running", "completed", "failed"].includes(row.status) ||
    !["manual", "scheduler", "retry", "system"].includes(row.trigger_source)
  ) {
    throw new BacklinkRepositoryError({ code: "DATABASE", operation: "mapBacklinkVerificationJob", message: "The database returned an invalid verification job." });
  }
  return {
    id: row.id, workspaceId: row.workspace_id, linkId: row.link_id, jobKey: row.job_key,
    triggerSource: row.trigger_source as BacklinkVerificationJob["triggerSource"],
    status: row.status as BacklinkVerificationJob["status"],
    policy: row.verification_policy as BacklinkVerificationJob["policy"],
    http: row.http_options as BacklinkVerificationJob["http"],
    attemptCount: row.attempt_count, maxAttempts: row.max_attempts, queuedAt: row.queued_at,
    startedAt: row.started_at, completedAt: row.completed_at, failedAt: row.failed_at,
    lastErrorCode: row.last_error_code, lastErrorMessage: row.last_error_message,
    resultSummary: row.result_summary,
    createdAt: row.created_at, updatedAt: row.updated_at,
    workerId: row.worker_id, claimedAt: row.claimed_at,
    leaseExpiresAt: row.lease_expires_at, heartbeatAt: row.heartbeat_at,
  };
}

export async function getBacklinkVerificationJobById(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, jobId: string): Promise<BacklinkVerificationJob> {
  const operation = "getBacklinkVerificationJobById";
  const { data, error } = await client.from("backlink_verification_jobs").select("*").eq("workspace_id", workspaceId).eq("id", jobId).maybeSingle();
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  if (data == null) throw new BacklinkRepositoryError({ code: "NOT_FOUND", operation, message: "The requested record was not found.", details: { entity: "backlink_verification_job", resourceId: jobId } });
  return mapJob(data);
}

export async function getBacklinkVerificationJobByKey(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, jobKey: string): Promise<BacklinkVerificationJob | null> {
  const operation = "getBacklinkVerificationJobByKey";
  const { data, error } = await client.from("backlink_verification_jobs").select("*").eq("workspace_id", workspaceId).eq("job_key", jobKey).maybeSingle();
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return data == null ? null : mapJob(data);
}

export async function listBacklinkVerificationJobsForLink(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  linkId: string,
  limit: number,
): Promise<Array<BacklinkVerificationJobHistoryRow>> {
  const operation = "listBacklinkVerificationJobsForLink";
  const { data, error } = await client
    .from("backlink_verification_jobs")
    .select("trigger_source, status, completed_at, result_summary, created_at")
    .eq("workspace_id", workspaceId)
    .eq("link_id", linkId)
    .eq("trigger_source", "scheduler")
    .eq("status", "completed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return (data ?? []) as Array<BacklinkVerificationJobHistoryRow>;
}

export async function createBacklinkVerificationJob(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, input: CreateBacklinkVerificationJobInput): Promise<BacklinkVerificationJob> {
  const operation = "createBacklinkVerificationJob";
  const payload: BacklinkVerificationJobInsert = {
    workspace_id: workspaceId, link_id: input.linkId, job_key: input.jobKey, trigger_source: input.triggerSource,
    verification_policy: toPolicyJson(input.policy), http_options: toHttpJson(input.http), queued_at: input.queuedAt,
  };
  const { data, error } = await client.from("backlink_verification_jobs").insert(payload).select("*").single();
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return mapJob(data);
}

async function callJobRpc<TName extends "claim_backlink_verification_job_by_id" | "claim_next_backlink_verification_job" | "heartbeat_backlink_verification_job" | "complete_backlink_verification_job" | "fail_backlink_verification_job">(client: BacklinkRepositoryClient, operation: string, fn: TName, args: Database["public"]["Functions"][TName]["Args"]): Promise<BacklinkVerificationJob | null> {
  const { data, error } = await client.rpc(fn, args);
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  if (!Array.isArray(data)) throw new BacklinkRepositoryError({ code: "DATABASE", operation, message: "The database returned an invalid verification job result." });
  const row = data[0] ?? null;
  if (data.length > 1) throw new BacklinkRepositoryError({ code: "DATABASE", operation, message: "The database returned multiple verification jobs." });
  return row == null ? null : mapJob(row);
}

export const claimNextBacklinkVerificationJob = (client: BacklinkRepositoryClient, workspaceId: string, workerId: string, claimedAt: string, leaseDurationSeconds: number) => callJobRpc(client, "claimNextBacklinkVerificationJob", "claim_next_backlink_verification_job", { p_workspace_id: workspaceId, p_worker_id: workerId, p_claimed_at: claimedAt, p_lease_duration_seconds: leaseDurationSeconds });
export const claimBacklinkVerificationJobById = (client: BacklinkRepositoryClient, workspaceId: string, jobId: string, workerId: string, claimedAt: string, leaseDurationSeconds: number) => callJobRpc(client, "claimBacklinkVerificationJobById", "claim_backlink_verification_job_by_id", { p_workspace_id: workspaceId, p_job_id: jobId, p_worker_id: workerId, p_claimed_at: claimedAt, p_lease_duration_seconds: leaseDurationSeconds });
export const heartbeatBacklinkVerificationJob = (client: BacklinkRepositoryClient, jobId: string, workerId: string, heartbeatAt: string, leaseDurationSeconds: number) => callJobRpc(client, "heartbeatBacklinkVerificationJob", "heartbeat_backlink_verification_job", { p_job_id: jobId, p_worker_id: workerId, p_heartbeat_at: heartbeatAt, p_lease_duration_seconds: leaseDurationSeconds });
export const markBacklinkVerificationJobCompleted = (client: BacklinkRepositoryClient, jobId: string, workerId: string, completedAt: string, resultSummary: Json | null) => callJobRpc(client, "markBacklinkVerificationJobCompleted", "complete_backlink_verification_job", { p_job_id: jobId, p_worker_id: workerId, p_completed_at: completedAt, p_result_summary: resultSummary });
export const markBacklinkVerificationJobFailed = (client: BacklinkRepositoryClient, jobId: string, workerId: string, failedAt: string, errorCode: string, errorMessage: string) => callJobRpc(client, "markBacklinkVerificationJobFailed", "fail_backlink_verification_job", { p_job_id: jobId, p_worker_id: workerId, p_failed_at: failedAt, p_error_code: errorCode, p_error_message: errorMessage });
