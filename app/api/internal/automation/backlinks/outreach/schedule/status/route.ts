import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  getLatestBacklinkOutreachScheduleApplyRun,
  listLatestBacklinkOutreachScheduleApplyRuns,
} from "@/lib/automation/repositories/backlinkOutreachScheduleApplyRunsRepository";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function authenticateInternalRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (CRON_SECRET.length > 0 && authorization === `Bearer ${CRON_SECRET}`) {
    return { kind: "cron" as const };
  }

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const client = createSupabaseAdminClient();
  const token = authorization.slice(7).trim();
  const {
    data: { user },
  } = await client.auth.getUser(token);
  if (user == null || !isAdminPrivateEmail(user.email)) {
    return null;
  }

  return { kind: "admin" as const, client };
}

export async function GET(request: NextRequest) {
  const auth = await authenticateInternalRequest(request);
  if (auth == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  const { data: controlRows, error: controlError } = await adminClient
    .from("automation_workspace_controls")
    .select("workspace_id, backlink_outreach_schedule_apply_enabled, dry_run_only, backlinks_enabled, updated_at")
    .eq("backlink_outreach_schedule_apply_enabled", true)
    .eq("dry_run_only", true)
    .eq("backlinks_enabled", true)
    .order("workspace_id", { ascending: true });

  if (controlError != null) {
    console.error("[automation/backlinks/outreach/schedule/status] failed to load workspace controls", controlError);
    return NextResponse.json({ error: "Unable to load automation schedule apply status." }, { status: 500 });
  }

  const latestRun = await getLatestBacklinkOutreachScheduleApplyRun(adminClient);
  const recentRuns = await listLatestBacklinkOutreachScheduleApplyRuns(adminClient, 10);

  return NextResponse.json({
    ok: true,
    result: {
      enabledWorkspaceCount: controlRows?.length ?? 0,
      enabledWorkspaces:
        controlRows?.map((row) => ({
          workspaceId: row.workspace_id,
          enabled: row.backlink_outreach_schedule_apply_enabled,
          updatedAt: row.updated_at,
        })) ?? [],
      lastRunAt: latestRun?.completedAt ?? latestRun?.startedAt ?? null,
      lastRunTrigger: latestRun?.triggerKind ?? null,
      scheduled: latestRun?.scheduled ?? 0,
      existing: latestRun?.existing ?? 0,
      notApplicable: latestRun?.notApplicable ?? 0,
      conflicts: latestRun?.conflicts ?? 0,
      failed: latestRun?.failed ?? 0,
      recentRuns: recentRuns.slice(0, 5).map((run) => ({
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        triggerKind: run.triggerKind,
        workspacesScanned: run.workspacesScanned,
        workspacesApplied: run.workspacesApplied,
        workspacesFailed: run.workspacesFailed,
        scheduled: run.scheduled,
        existing: run.existing,
        notApplicable: run.notApplicable,
        conflicts: run.conflicts,
        failed: run.failed,
      })),
    },
  });
}
