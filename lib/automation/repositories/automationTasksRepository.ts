import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";
import type { Database } from "@/types/database.types";

import type { AutomationTask, CancelAutomationTaskInput, ClaimNextAutomationTaskInput, CompleteAutomationTaskInput, CreateAutomationTaskInput, CreateAutomationTaskResult, FailAutomationTaskInput, HeartbeatAutomationTaskInput, ReclaimExpiredAutomationTasksInput } from "../types";

type AutomationTaskRow = Database["public"]["Tables"]["automation_tasks"]["Row"];

function mapAutomationTask(row: AutomationTaskRow): AutomationTask {
  if (row.system !== "backlinks" || !["queued", "running", "completed", "failed", "cancelled", "dead_letter"].includes(row.status)) {
    throw new BacklinkRepositoryError({ code: "DATABASE", operation: "mapAutomationTask", message: "The database returned an invalid automation task." });
  }
  return { id: row.id, workspaceId: row.workspace_id, runId: row.run_id, system: "backlinks", taskKind: row.task_kind, taskKey: row.task_key, status: row.status as AutomationTask["status"], priority: row.priority, scheduledAt: row.scheduled_at, availableAt: row.available_at, claimedAt: row.claimed_at, startedAt: row.started_at, heartbeatAt: row.heartbeat_at, leaseExpiresAt: row.lease_expires_at, completedAt: row.completed_at, failedAt: row.failed_at, cancelledAt: row.cancelled_at, workerId: row.worker_id, attemptCount: row.attempt_count, maxAttempts: row.max_attempts, backoffBaseSeconds: row.backoff_base_seconds, input: row.input, output: row.output, errorCode: row.error_code, errorMessage: row.error_message, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function getAutomationTaskByKey(client: BacklinkRepositoryClient, input: Pick<CreateAutomationTaskInput, "workspaceId" | "runId" | "taskKind" | "taskKey">): Promise<AutomationTask | null> {
  const operation = "getAutomationTaskByKey";
  const { data, error } = await client.from("automation_tasks").select("*").eq("workspace_id", input.workspaceId).eq("run_id", input.runId).eq("task_kind", input.taskKind).eq("task_key", input.taskKey).maybeSingle();
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return data == null ? null : mapAutomationTask(data);
}

export async function createAutomationTask(client: BacklinkRepositoryClient, input: CreateAutomationTaskInput): Promise<AutomationTask> {
  const operation = "createAutomationTask";
  const { data, error } = await client.from("automation_tasks").insert({ workspace_id: input.workspaceId, run_id: input.runId, system: input.system, task_kind: input.taskKind, task_key: input.taskKey, priority: input.priority, scheduled_at: input.scheduledAt, available_at: input.availableAt, max_attempts: input.maxAttempts, backoff_base_seconds: input.backoffBaseSeconds, input: input.input }).select("*").single();
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return mapAutomationTask(data);
}

export async function createOrGetAutomationTask(client: BacklinkRepositoryClient, input: CreateAutomationTaskInput): Promise<CreateAutomationTaskResult> {
  try { return { kind: "created", task: await createAutomationTask(client, input) }; }
  catch (error) {
    if (!(error instanceof BacklinkRepositoryError) || error.code !== "CONFLICT") throw error;
    const task = await getAutomationTaskByKey(client, input);
    if (task != null) return { kind: "existing", task };
    throw new BacklinkRepositoryError({ code: "CONFLICT", operation: "createOrGetAutomationTask", message: "The operation conflicts with existing data." });
  }
}

type SingleTaskRpc = "claim_next_automation_task" | "heartbeat_automation_task" | "complete_automation_task" | "fail_automation_task" | "cancel_automation_task";
async function callSingleTaskRpc<T extends SingleTaskRpc>(client: BacklinkRepositoryClient, operation: string, rpc: T, args: Database["public"]["Functions"][T]["Args"]): Promise<AutomationTask | null> {
  const { data, error } = await client.rpc(rpc, args);
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  if (!Array.isArray(data) || data.length > 1) throw new BacklinkRepositoryError({ code: "DATABASE", operation, message: "The database returned an invalid automation task result." });
  return data[0] == null ? null : mapAutomationTask(data[0]);
}
export const claimNextAutomationTask = (client: BacklinkRepositoryClient, input: ClaimNextAutomationTaskInput) => callSingleTaskRpc(client, "claimNextAutomationTask", "claim_next_automation_task", { p_workspace_id: input.workspaceId, p_run_id: input.runId, p_worker_id: input.workerId, p_claimed_at: input.claimedAt, p_lease_duration_seconds: input.leaseDurationSeconds });
export const heartbeatAutomationTask = (client: BacklinkRepositoryClient, input: HeartbeatAutomationTaskInput) => callSingleTaskRpc(client, "heartbeatAutomationTask", "heartbeat_automation_task", { p_workspace_id: input.workspaceId, p_task_id: input.taskId, p_worker_id: input.workerId, p_heartbeat_at: input.heartbeatAt, p_lease_duration_seconds: input.leaseDurationSeconds });
export const completeAutomationTask = (client: BacklinkRepositoryClient, input: CompleteAutomationTaskInput) => callSingleTaskRpc(client, "completeAutomationTask", "complete_automation_task", { p_workspace_id: input.workspaceId, p_task_id: input.taskId, p_worker_id: input.workerId, p_completed_at: input.completedAt, p_output: input.output });
export const failAutomationTask = (client: BacklinkRepositoryClient, input: FailAutomationTaskInput) => callSingleTaskRpc(client, "failAutomationTask", "fail_automation_task", { p_workspace_id: input.workspaceId, p_task_id: input.taskId, p_worker_id: input.workerId, p_failed_at: input.failedAt, p_error_code: input.errorCode, p_error_message: input.errorMessage });
export async function reclaimExpiredAutomationTasks(client: BacklinkRepositoryClient, input: ReclaimExpiredAutomationTasksInput): Promise<AutomationTask[]> { const operation = "reclaimExpiredAutomationTasks"; const { data, error } = await client.rpc("reclaim_expired_automation_tasks", { p_workspace_id: input.workspaceId, p_run_id: input.runId, p_reclaimed_at: input.reclaimedAt, p_limit: input.limit }); if (error != null) throw normalizeBacklinkRepositoryError(operation, error); if (!Array.isArray(data)) throw new BacklinkRepositoryError({ code: "DATABASE", operation, message: "The database returned an invalid automation task result." }); return data.map(mapAutomationTask); }
export const cancelAutomationTask = (client: BacklinkRepositoryClient, input: CancelAutomationTaskInput) => callSingleTaskRpc(client, "cancelAutomationTask", "cancel_automation_task", { p_workspace_id: input.workspaceId, p_task_id: input.taskId, p_worker_id: input.workerId, p_cancelled_at: input.cancelledAt });
