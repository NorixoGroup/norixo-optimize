import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const source = await readFile(
    "app/api/internal/automation/backlinks/outreach/tick/route.ts",
    "utf8",
  );

  for (const required of [
    "export async function POST(request: NextRequest)",
    "createRequestSupabaseClient(request)",
    "client.auth.getUser(token)",
    "isAdminPrivateEmail(user.email)",
    "createSupabaseAdminClient()",
    "runBacklinkOutreachMaintenanceOrchestration(",
    "listEligibleWorkspaces: async (limit)",
    "previewScheduleReconciliation: async (input)",
    "previewSignalDetection: async (input)",
    "await request.json().catch(() => null)",
    'code: "INVALID_INPUT"',
    'message: "Invalid automation outreach tick input"',
    'code: "AUTOMATION_OUTREACH_TICK_FAILED"',
    'message: "Unable to run automation outreach tick"',
    'console.error("[automation/backlinks/outreach/tick] request failed"',
    "workspaceLimit",
    ".order(\"workspace_id\", { ascending: true })",
    ".limit(limit)",
    '.select("workspace_id, backlinks_enabled, dry_run_only, disabled_reason")',
    "listBacklinkOutreach(adminClient",
    "createOrGetAutomationRun(adminClient",
    "createOrGetAutomationTask(adminClient",
    "completeAutomationRun(adminClient",
  ]) {
    assert(source.includes(required), `Missing ${required}`);
  }

  for (const forbidden of [
    "getRequestUserAndWorkspace(",
    "triggerSource: \"manual\"",
    "mode: \"live\"",
    "workspaceId: auth.workspace.id",
    "actorUserId: auth.user.id",
    "/send",
    "provider",
    "attemptId",
    "outreachId:",
    "taskKind:",
    "randomUUID",
    "service_role",
    "cron",
    "fetch(",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }

  const authIndex = source.indexOf("createRequestSupabaseClient(request)");
  const adminIndex = source.indexOf("isAdminPrivateEmail(user.email)");
  const bodyIndex = source.indexOf("await request.json().catch(() => null)");
  const orchestrationIndex = source.indexOf("runBacklinkOutreachMaintenanceOrchestration(");
  assert(authIndex >= 0 && adminIndex > authIndex, "Admin auth must follow request auth.");
  assert(bodyIndex > adminIndex, "Body parsing must follow auth.");
  assert(orchestrationIndex > bodyIndex, "Orchestration must happen after body validation.");

  const expectedBodyShape = source.match(/function parseInternalAutomationTickBody[\s\S]*?return typeof workspaceLimit === "number"/);
  assert(expectedBodyShape != null, "Body parser missing");
  assert(source.includes('keys.length > 1 || (keys.length === 1 && keys[0] !== "workspaceLimit")'), "Body must be strict");
  assert(source.includes("workspaceLimit <= 100"), "Workspace limit must be bounded");
  assert(source.includes("workspaceLimit >= 1"), "Workspace limit must be positive");
  assert(source.includes("return {}"), "Empty body must be accepted");
  assert(source.includes("return NextResponse.json({ ok: true, result });"), "Route must return the orchestration result.");

  console.log("PASS — Automation backlinks outreach maintenance route smoke");
}

void main();
