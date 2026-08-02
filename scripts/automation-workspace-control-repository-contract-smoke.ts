import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const source = await readFile(
    "lib/automation/repositories/automationWorkspaceControlsRepository.ts",
    "utf8",
  );

  for (const required of [
    'from("automation_workspace_controls")',
    '.eq("workspace_id", workspaceId)',
    '.insert({ workspace_id: input.workspaceId, backlinks_enabled: false })',
    'error.code !== "CONFLICT"',
    "getAutomationWorkspaceControl(client, input.workspaceId)",
    '.update({ backlinks_enabled: input.backlinksEnabled })',
    '.eq("workspace_id", input.workspaceId)',
    "normalizeBacklinkRepositoryError",
    'code: "NOT_FOUND"',
    "data.length > 1",
    "workspaceId: row.workspace_id",
    "backlinksEnabled: row.backlinks_enabled",
    "dryRunOnly: true",
    "createdAt: row.created_at",
    "updatedAt: row.updated_at",
  ]) {
    assert(source.includes(required), `Missing ${required}`);
  }

  const createPayload = source.match(/\.insert\((\{[^\n]+\})\)/);
  assert(createPayload !== null, "Create payload not found");
  assert(!createPayload[1].includes("dry_run_only"), "Create must not write dry_run_only");
  assert(!createPayload[1].includes("created_at"), "Create must not write created_at");
  assert(!createPayload[1].includes("updated_at"), "Create must not write updated_at");

  const updatePayload = source.match(/\.update\((\{[^\n]+\})\)/);
  assert(updatePayload !== null, "Update payload not found");
  assert(
    updatePayload[1] === "{ backlinks_enabled: input.backlinksEnabled }",
    "Update payload must only contain backlinks_enabled",
  );
  assert(!source.includes("createSupabaseAdminClient"), "Repository must not create an admin client");
  assert(!source.includes("dry_run_only:"), "Repository must not update dry_run_only");

  console.log("PASS — Automation workspace control repository contract smoke");
}

void main();
