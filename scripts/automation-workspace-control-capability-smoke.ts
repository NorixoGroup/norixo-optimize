import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const files = {
    migration: await readFile(
      "supabase/migrations/20260813000000_add_backlink_outreach_schedule_apply_capability.sql",
      "utf8",
    ),
    databaseTypes: await readFile("types/database.types.ts", "utf8"),
    workspaceControlTypes: await readFile(
      "lib/automation/workspace-control-types.ts",
      "utf8",
    ),
    repository: await readFile(
      "lib/automation/repositories/automationWorkspaceControlsRepository.ts",
      "utf8",
    ),
    service: await readFile("lib/automation/workspace-control-service.ts", "utf8"),
    route: await readFile("app/api/internal/automation/workspace-control/route.ts", "utf8"),
  };

  for (const required of [
    "backlink_outreach_schedule_apply_enabled boolean not null default false",
    "Explicit capability gate for automated Outreach scheduling apply",
    "backlink_outreach_schedule_apply_enabled: boolean",
    "backlinkOutreachScheduleApplyEnabled: boolean",
    "backlinkOutreachScheduleApplyEnabled?: boolean",
    "canApplyBacklinkOutreachScheduling",
    "typeof input.backlinkOutreachScheduleApplyEnabled !== \"boolean\"",
    "backlinkOutreachScheduleApplyEnabled: input.backlinkOutreachScheduleApplyEnabled",
    'keys.length < 1 || keys.length > 2',
  ]) {
    assert(
      Object.values(files).some((source) => source.includes(required)),
      `Missing ${required}`,
    );
  }

  assert(
    files.workspaceControlTypes.includes("backlinkOutreachScheduleApplyEnabled: boolean"),
    "Workspace control types must expose the camelCase capability flag",
  );
  assert(
    files.repository.includes("backlinkOutreachScheduleApplyEnabled") &&
      files.repository.includes("row.backlink_outreach_schedule_apply_enabled"),
    "Repository must map the new capability column",
  );
  assert(
    files.repository.includes("update(patch)"),
    "Repository must update from a bounded patch object",
  );
  assert(
    files.service.includes("return control?.backlinkOutreachScheduleApplyEnabled === true"),
    "Capability helper must check only the explicit flag",
  );
  assert(
    files.route.includes("backlinkOutreachScheduleApplyEnabled: input.backlinkOutreachScheduleApplyEnabled"),
    "Route must forward the capability flag",
  );
  assert(
    files.route.includes('return NextResponse.json({ ok: true, control: result.control })'),
    "Route must keep the control response unchanged",
  );
  assert(
    files.databaseTypes.includes("backlink_outreach_schedule_apply_enabled: boolean"),
    "Database types must include the capability column",
  );

  console.log("PASS — Automation workspace control capability smoke");
}

void main();
