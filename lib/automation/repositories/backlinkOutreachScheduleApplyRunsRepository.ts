import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";

const FAIL = "backlinkOutreachScheduleApplyRuns";

type AutomationClient = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["backlink_outreach_schedule_apply_runs"]["Row"];

export type BacklinkOutreachScheduleApplyRun = {
  id: string;
  workspaceId: string | null;
  workspaceScope: Json;
  triggerKind: "manual_internal" | "cron";
  startedAt: string;
  completedAt: string | null;
  workspacesScanned: number;
  workspacesApplied: number;
  workspacesFailed: number;
  outreachScanned: number;
  scheduled: number;
  existing: number;
  notApplicable: number;
  conflicts: number;
  failed: number;
  workspaceResults: Json;
  createdAt: string;
};

function fail(): Error {
  return new Error(`${FAIL} failed`);
}

function mapRow(row: Row): BacklinkOutreachScheduleApplyRun {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceScope: row.workspace_scope,
    triggerKind: row.trigger_kind as BacklinkOutreachScheduleApplyRun["triggerKind"],
    startedAt: row.started_at,
    completedAt: row.completed_at,
    workspacesScanned: row.workspaces_scanned,
    workspacesApplied: row.workspaces_applied,
    workspacesFailed: row.workspaces_failed,
    outreachScanned: row.outreach_scanned,
    scheduled: row.scheduled,
    existing: row.existing,
    notApplicable: row.not_applicable,
    conflicts: row.conflicts,
    failed: row.failed,
    workspaceResults: row.workspace_results,
    createdAt: row.created_at,
  };
}

export async function createBacklinkOutreachScheduleApplyRun(
  client: AutomationClient,
  input: {
    workspaceId: string | null;
    workspaceScope: Json;
    triggerKind: "manual_internal" | "cron";
    startedAt: string;
    completedAt: string | null;
    workspacesScanned: number;
    workspacesApplied: number;
    workspacesFailed: number;
    outreachScanned: number;
    scheduled: number;
    existing: number;
    notApplicable: number;
    conflicts: number;
    failed: number;
    workspaceResults: Json;
  },
): Promise<BacklinkOutreachScheduleApplyRun> {
  const { data, error } = await client
    .from("backlink_outreach_schedule_apply_runs")
    .insert({
      workspace_id: input.workspaceId,
      workspace_scope: input.workspaceScope,
      trigger_kind: input.triggerKind,
      started_at: input.startedAt,
      completed_at: input.completedAt,
      workspaces_scanned: input.workspacesScanned,
      workspaces_applied: input.workspacesApplied,
      workspaces_failed: input.workspacesFailed,
      outreach_scanned: input.outreachScanned,
      scheduled: input.scheduled,
      existing: input.existing,
      not_applicable: input.notApplicable,
      conflicts: input.conflicts,
      failed: input.failed,
      workspace_results: input.workspaceResults,
    })
    .select("*")
    .single();

  if (error != null || data == null) {
    throw fail();
  }

  return mapRow(data);
}

export async function listLatestBacklinkOutreachScheduleApplyRuns(
  client: AutomationClient,
  limit: number,
): Promise<BacklinkOutreachScheduleApplyRun[]> {
  const { data, error } = await client
    .from("backlink_outreach_schedule_apply_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .throwOnError();
  if (error != null || data == null) {
    throw fail();
  }
  return data.map(mapRow);
}

export async function getLatestBacklinkOutreachScheduleApplyRun(
  client: AutomationClient,
): Promise<BacklinkOutreachScheduleApplyRun | null> {
  const { data, error } = await client
    .from("backlink_outreach_schedule_apply_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error != null) {
    throw fail();
  }
  return data == null ? null : mapRow(data);
}
