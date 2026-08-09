import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";

import type { AutomationRun, AutomationWorkspaceControl, CancelAutomationRunInput, CompleteAutomationRunInput, CreateAutomationRunInput, FailAutomationRunInput, StartAutomationRunInput } from "../types";

type AutomationClient = SupabaseClient<Database>;
type AutomationRunRow = Database["public"]["Tables"]["automation_runs"]["Row"];

function fail(operation: string): Error { return new Error(`${operation} failed`); }
function mapRun(row: AutomationRunRow): AutomationRun {
  if (row.system !== "backlinks" || !["queued", "running", "completed", "failed", "cancelled"].includes(row.status) || row.mode !== "dry_run" || !["manual", "scheduled", "internal"].includes(row.trigger_source)) throw fail("mapAutomationRun");
  return { id: row.id, workspaceId: row.workspace_id, system: "backlinks", runKind: row.run_kind, idempotencyKey: row.idempotency_key, status: row.status as AutomationRun["status"], mode: "dry_run", triggerSource: row.trigger_source as AutomationRun["triggerSource"], requestedBy: row.requested_by, scheduledAt: row.scheduled_at, startedAt: row.started_at, completedAt: row.completed_at, failedAt: row.failed_at, cancelledAt: row.cancelled_at, heartbeatAt: row.heartbeat_at, leaseExpiresAt: row.lease_expires_at, workerId: row.worker_id, attemptCount: row.attempt_count, maxAttempts: row.max_attempts, input: row.input, summary: row.summary, errorCode: row.error_code, errorMessage: row.error_message, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function getAutomationWorkspaceControl(client: AutomationClient, workspaceId: string): Promise<AutomationWorkspaceControl | null> {
  const { data, error } = await client.from("automation_workspace_controls").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (error != null) throw fail("getAutomationWorkspaceControl");
  return data == null ? null : { workspaceId: data.workspace_id, backlinksEnabled: data.backlinks_enabled, dryRunOnly: data.dry_run_only, disabledReason: data.disabled_reason };
}
export async function getAutomationRunByKey(client: AutomationClient, input: Pick<CreateAutomationRunInput, "workspaceId" | "system" | "runKind" | "idempotencyKey">): Promise<AutomationRun | null> {
  const { data, error } = await client.from("automation_runs").select("*").eq("workspace_id", input.workspaceId).eq("system", input.system).eq("run_kind", input.runKind).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (error != null) throw fail("getAutomationRunByKey");
  return data == null ? null : mapRun(data);
}
export async function getAutomationRunById(
  client: AutomationClient,
  input: { workspaceId: string; runId: string },
): Promise<AutomationRun | null> {
  const { data, error } = await client
    .from("automation_runs")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.runId)
    .maybeSingle();
  if (error != null) throw fail("getAutomationRunById");
  return data == null ? null : mapRun(data);
}
export async function createOrGetAutomationRun(client: AutomationClient, input: CreateAutomationRunInput): Promise<{ kind: "created" | "existing"; run: AutomationRun }> {
  const { data, error } = await client.from("automation_runs").insert({ workspace_id: input.workspaceId, system: input.system, run_kind: input.runKind, idempotency_key: input.idempotencyKey, mode: input.mode, trigger_source: input.triggerSource, requested_by: input.requestedBy, scheduled_at: input.scheduledAt, input: input.input }).select("*").single();
  if (error == null) return { kind: "created", run: mapRun(data) };
  if (error.code !== "23505") throw fail("createOrGetAutomationRun");
  const existing = await getAutomationRunByKey(client, input);
  if (existing != null) return { kind: "existing", run: existing };
  throw fail("createOrGetAutomationRun");
}
async function callTransition<T extends "start_automation_run" | "complete_automation_run" | "fail_automation_run" | "cancel_automation_run">(client: AutomationClient, name: T, args: Database["public"]["Functions"][T]["Args"]): Promise<AutomationRun | null> {
  const { data, error } = await client.rpc(name, args);
  if (error != null || !Array.isArray(data) || data.length > 1) throw fail(name);
  return data[0] == null ? null : mapRun(data[0]);
}
export const startAutomationRun = (client: AutomationClient, input: StartAutomationRunInput) => callTransition(client, "start_automation_run", { p_workspace_id: input.workspaceId, p_run_id: input.runId, p_started_at: input.startedAt });
export const completeAutomationRun = (client: AutomationClient, input: CompleteAutomationRunInput) => callTransition(client, "complete_automation_run", { p_workspace_id: input.workspaceId, p_run_id: input.runId, p_completed_at: input.completedAt, p_summary: input.summary as Json | null });
export const failAutomationRun = (client: AutomationClient, input: FailAutomationRunInput) => callTransition(client, "fail_automation_run", { p_workspace_id: input.workspaceId, p_run_id: input.runId, p_failed_at: input.failedAt, p_error_code: input.errorCode, p_error_message: input.errorMessage });
export const cancelAutomationRun = (client: AutomationClient, input: CancelAutomationRunInput) => callTransition(client, "cancel_automation_run", { p_workspace_id: input.workspaceId, p_run_id: input.runId, p_cancelled_at: input.cancelledAt, p_reason: input.reason });
