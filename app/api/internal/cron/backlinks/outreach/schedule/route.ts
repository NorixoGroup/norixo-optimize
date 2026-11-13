import { NextRequest, NextResponse } from "next/server";

import { runBacklinkOutreachScheduleApply } from "@/lib/automation/backlink-outreach-schedule-apply-runner";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasValidBacklinkN8nCronAuthorization } from "@/lib/automation/backlink-n8n-cron-authorization";

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? "";
  const isLegacyAuthorized = cronSecret.length > 0 && authorization === `Bearer ${cronSecret}`;
  const isN8nAuthorized = await hasValidBacklinkN8nCronAuthorization(authorization, {
    NORIXO_N8N_CRON_SECRET: process.env.NORIXO_N8N_CRON_SECRET,
  });
  if (!isLegacyAuthorized && !isN8nAuthorized) {
    return unauthorizedResponse();
  }

  const client = createSupabaseAdminClient();
  const startedAt = new Date().toISOString();

  try {
    const result = await runBacklinkOutreachScheduleApply(client, {
      triggerKind: "cron",
      startedAt,
      workspaceLimit: 25,
      outreachLimitPerWorkspace: 100,
    });

    if (result.disposition === "already_running") {
      return NextResponse.json({ disposition: "already_running" });
    }

    return NextResponse.json({
      disposition: "completed",
      workspacesScanned: result.result.workspacesScanned,
      workspacesApplied: result.result.workspacesSucceeded,
      workspacesFailed: result.result.workspacesFailed,
      scheduled: result.result.scheduled,
      existing: result.result.existing,
      notApplicable: result.result.notApplicable,
      conflicts: result.result.conflicts,
      failed: result.result.failed,
    });
  } catch (error) {
    console.error("[automation/backlinks/outreach/schedule/cron] request failed");
    return NextResponse.json(
      { error: "Unable to run automation outreach schedule cron" },
      { status: 500 },
    );
  }
}
