import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const source = await readFile(
    "app/api/internal/cron/backlinks/outreach/schedule/route.ts",
    "utf8",
  );

  for (const required of [
    "export async function GET(request: NextRequest)",
    "CRON_SECRET",
    'authorization !== `Bearer ${CRON_SECRET}`',
    "createSupabaseAdminClient()",
    'triggerKind: "cron"',
    "workspaceLimit: 25",
    "outreachLimitPerWorkspace: 100",
    "runBacklinkOutreachScheduleApply(",
    'disposition: "already_running"',
    'disposition: "completed"',
    "workspacesScanned",
    "workspacesApplied",
    "workspacesFailed",
    "scheduled",
    "existing",
    "notApplicable",
    "conflicts",
    "failed",
    "Unable to run automation outreach schedule cron",
  ]) {
    assert(source.includes(required), `Missing ${required}`);
  }

  for (const forbidden of [
    "createRequestSupabaseClient(",
    "getRequestUserAndWorkspace(",
    "request.json(",
    "searchParams",
    "body.",
    "workspaceId:",
    "outreachId:",
    "mode: \"dry_run\"",
    "admin email",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }

  console.log("PASS — Backlink outreach cron route smoke");
}

void main();
