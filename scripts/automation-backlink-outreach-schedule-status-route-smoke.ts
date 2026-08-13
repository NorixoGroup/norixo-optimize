import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const source = await readFile(
    "app/api/internal/automation/backlinks/outreach/schedule/status/route.ts",
    "utf8",
  );

  for (const required of [
    "export async function GET(request: NextRequest)",
    "CRON_SECRET",
    "createSupabaseAdminClient()",
    "isAdminPrivateEmail(user.email)",
    "getLatestBacklinkOutreachScheduleApplyRun",
    "listLatestBacklinkOutreachScheduleApplyRuns",
    "enabledWorkspaceCount",
    "enabledWorkspaces",
    "lastRunAt",
    "lastRunTrigger",
    "recentRuns",
    "scheduled",
    "existing",
    "notApplicable",
    "conflicts",
    "failed",
    "backlink_outreach_schedule_apply_enabled",
  ]) {
    assert(source.includes(required), `Missing ${required}`);
  }

  for (const forbidden of [
    "insert(",
    "update(",
    "delete(",
    "createOrGetAutomationRun",
    "applyBacklinkOutreachScheduleReconciliationAutomation",
    "outreachEmailProvider",
    "sendTransactionalEmail",
    "draft",
    "attemptId",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }

  console.log("PASS — Automation backlinks outreach schedule status route smoke");
}

void main();
