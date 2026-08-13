import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const source = await readFile(
    "app/api/internal/automation/backlinks/outreach/schedule/apply/route.ts",
    "utf8",
  );

  for (const required of [
    "export async function POST(request: NextRequest)",
    "X-Norixo-Workspace-Id",
    "getRequestUserAndWorkspace(request)",
    'auth.status === "unauthenticated"',
    'auth.status === "workspace_forbidden"',
    "isAdminPrivateEmail(auth.user.email)",
    "backlinkOutreachScheduleApplyEnabled",
    "applyBacklinkOutreachScheduleReconciliationAutomation",
    "listBacklinkOutreachScheduleApplyCandidates",
    "markAutomationWorkspaceControlBacklinkOutreachScheduleApplyAttempt",
    'keys.length > 1 || (keys.length === 1 && keys[0] !== "limit")',
    "typeof limit === \"number\"",
    "limit <= 200",
    "limit >= 1",
    'message: "Invalid automation outreach schedule apply input"',
    'message: "Unable to run automation outreach schedule apply"',
    'return NextResponse.json({ ok: true, result })',
    "reconcileBacklinkOutreachFollowUpSchedule",
    "backlink_outreach_schedule_apply_enabled",
  ]) {
    assert(source.includes(required), `Missing ${required}`);
  }

  for (const forbidden of [
    "automation_runs",
    "createOrGetAutomationRun",
    "mode: \"dry_run\"",
    "outreachEmailProvider",
    "sendTransactionalEmail",
    "follow-up-send",
    "no_response",
    "attemptId",
    "draft",
    "prepare",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }

  assert(!source.includes("workspaceId: body.workspaceId"), "Route must not accept caller-supplied workspaceId.");
  assert(!source.includes("body.status"), "Route must not accept caller-supplied status.");
  assert(!source.includes("scheduledAt"), "Route must not accept caller-supplied scheduledAt.");
  assert(!source.includes("outreachIds"), "Route must not accept caller-supplied outreachIds.");

  console.log("PASS — Automation backlinks outreach schedule apply route smoke");
}

void main();
