import { normalizeBacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";

export const BACKLINK_RESUMABLE_RUN_KIND = "backlinks.daily_preview";
export const BACKLINK_DISCOVERY_TASK_KIND = "backlinks.discovery.preview";
export const BACKLINK_RESUMABLE_TASK_KINDS = [
  BACKLINK_DISCOVERY_TASK_KIND,
  "backlinks.qualification.preview",
  "backlinks.promotion.preview",
] as const;

export type BacklinkDiscoveryQualificationResumeCandidate = {
  workspaceId: string;
  runId: string;
  taskId: string;
  taskKind: (typeof BACKLINK_RESUMABLE_TASK_KINDS)[number];
};

type ResumeCandidateTaskRow = {
  id: string;
  workspace_id: string;
  run_id: string;
  task_kind: string;
  status: string;
  available_at: string;
  lease_expires_at: string | null;
  attempt_count: number;
  max_attempts: number;
};

/** Pure predicate, tested directly: due-for-retry queued, or running with an expired lease. */
export function isBacklinkDiscoveryQualificationResumeCandidateTask(
  row: ResumeCandidateTaskRow,
  nowMs: number,
): boolean {
  const isDueQueued =
    row.status === "queued" && row.attempt_count < row.max_attempts && Date.parse(row.available_at) <= nowMs;
  const isExpiredLease =
    row.status === "running" && row.lease_expires_at != null && Date.parse(row.lease_expires_at) <= nowMs;
  return isDueQueued || isExpiredLease;
}

/**
 * Read-only discovery of stuck Discovery/Qualification/Promotion-preview work: a queued task
 * whose backoff has elapsed, or a running task whose lease has expired. Scoped to workspaces
 * that already have backlinks_enabled, dry_run_only and no disabled_reason (the same gate
 * claim_next_automation_task enforces at the database level), so this can never surface a
 * candidate for a workspace sending real email.
 */
export async function listBacklinkDiscoveryQualificationResumeCandidates(
  client: BacklinkRepositoryClient,
  input: { now: string; limit: number },
): Promise<readonly BacklinkDiscoveryQualificationResumeCandidate[]> {
  const operation = "listBacklinkDiscoveryQualificationResumeCandidates";
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error(`${operation}: now must be a valid date`);
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) {
    throw new Error(`${operation}: limit must be an integer between 1 and 50`);
  }

  const { data: controls, error: controlsError } = await client
    .from("automation_workspace_controls")
    .select("workspace_id")
    .eq("backlinks_enabled", true)
    .eq("dry_run_only", true)
    .is("disabled_reason", null);
  if (controlsError != null) throw normalizeBacklinkRepositoryError(operation, controlsError);
  const eligibleWorkspaceIds = (controls ?? []).map((row) => row.workspace_id);
  if (eligibleWorkspaceIds.length === 0) return [];

  const { data: runs, error: runsError } = await client
    .from("automation_runs")
    .select("id, workspace_id")
    .eq("system", "backlinks")
    .eq("run_kind", BACKLINK_RESUMABLE_RUN_KIND)
    .eq("mode", "dry_run")
    .eq("status", "running")
    .in("workspace_id", eligibleWorkspaceIds)
    .limit(100);
  if (runsError != null) throw normalizeBacklinkRepositoryError(operation, runsError);
  if (!runs || runs.length === 0) return [];
  const runIds = runs.map((row) => row.id);

  const { data: tasks, error: tasksError } = await client
    .from("automation_tasks")
    .select("id, workspace_id, run_id, task_kind, status, available_at, lease_expires_at, attempt_count, max_attempts")
    .eq("system", "backlinks")
    .in("run_id", runIds)
    .in("task_kind", BACKLINK_RESUMABLE_TASK_KINDS)
    .in("status", ["queued", "running"])
    .order("available_at", { ascending: true })
    .limit(200);
  if (tasksError != null) throw normalizeBacklinkRepositoryError(operation, tasksError);

  const candidatesByRun = new Map<string, BacklinkDiscoveryQualificationResumeCandidate>();
  for (const row of tasks ?? []) {
    if (!isBacklinkDiscoveryQualificationResumeCandidateTask(row, nowMs)) continue;

    // At most one candidate per run per pass: resumeBacklinksDryRun/resumeDiscovery each advance
    // one run's worth of work per call, so a second task in the same run is picked up on the next
    // scheduled invocation rather than being claimed twice in this one.
    if (candidatesByRun.has(row.run_id)) continue;
    candidatesByRun.set(row.run_id, {
      workspaceId: row.workspace_id,
      runId: row.run_id,
      taskId: row.id,
      taskKind: row.task_kind as BacklinkDiscoveryQualificationResumeCandidate["taskKind"],
    });
  }

  return [...candidatesByRun.values()].slice(0, input.limit);
}
