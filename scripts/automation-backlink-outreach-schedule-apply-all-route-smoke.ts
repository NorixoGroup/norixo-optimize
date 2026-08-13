import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const source = await readFile(
    "app/api/internal/automation/backlinks/outreach/schedule/apply-all/route.ts",
    "utf8",
  );

  for (const required of [
    "export async function POST(request: NextRequest)",
    "CRON_SECRET",
    "authorization === `Bearer ${CRON_SECRET}`",
    "createRequestSupabaseClient(request)",
    "client.auth.getUser(token)",
    "isAdminPrivateEmail(user.email)",
    "runBacklinkOutreachScheduleApplyOrchestration(",
    "applyBacklinkOutreachScheduleReconciliationAutomation",
    "createOrGetAutomationRun(adminClient",
    "completeAutomationRun(adminClient",
    "backlink_outreach_schedule_apply_enabled",
    "keys.length > 2",
    "workspaceLimit",
    "outreachLimitPerWorkspace",
    'message: "Invalid automation outreach schedule apply-all input"',
    'message: "Unable to run automation outreach schedule apply-all"',
    'return NextResponse.json({ ok: true, result })',
  ]) {
    assert(source.includes(required), `Missing ${required}`);
  }

  for (const forbidden of [
    "getRequestUserAndWorkspace(",
    "workspaceId: body.workspaceId",
    "body.workspaceId",
    "body.outreachIds",
    "body.status",
    "follow-up-send",
    "no_response",
    "provider",
    "attemptId",
    "randomUUID",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }

  assert(source.includes(".order(\"workspace_id\", { ascending: true })"), "Workspace order must be deterministic.");
  assert(source.includes(".eq(\"backlinks_enabled\", true)"), "Workspace filter must include backlinks_enabled.");
  assert(source.includes(".eq(\"dry_run_only\", true)"), "Workspace filter must include dry_run_only.");
  assert(source.includes(".eq(\"backlink_outreach_schedule_apply_enabled\", true)"), "Workspace filter must include apply capability.");
  assert(source.includes(".is(\"disabled_reason\", null)"), "Workspace filter must exclude disabled workspaces.");
  assert(source.includes("workspaceLimit > 100"), "Workspace limit must be bounded.");
  assert(source.includes("workspaceLimit < 1"), "Workspace limit must be positive.");
  assert(source.includes("outreachLimitPerWorkspace > 200"), "Outreach limit must be bounded.");
  assert(source.includes("outreachLimitPerWorkspace < 1"), "Outreach limit must be positive.");

  console.log("PASS — Automation backlinks outreach schedule apply-all route smoke");
}

void main();
