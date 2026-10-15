import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const source = await readFile(
    "app/api/internal/automation/backlinks/runs/resume/route.ts",
    "utf8",
  );

  for (const required of [
    "createBacklinkRunResumeHandler",
    "getRequestUserAndWorkspace(request)",
    "isAdminPrivateEmail",
    "const RESUME_WORKER_ID = \"norixo-automation-backlinks-resume\"",
    "const LEASE_DURATION_SECONDS = 120",
    "const keys = Object.keys(value)",
    "keys.length !== 1",
    'keys[0] !== "runId"',
    "UUID.test(runId)",
    "workspaceId: context.workspace.id",
    "runId: body.runId",
    "workerId: RESUME_WORKER_ID",
    "leaseDurationSeconds: LEASE_DURATION_SECONDS",
    "createAutomationProductionComposition().resumeBacklinksDryRun(input)",
  ]) {
    assert(source.includes(required), `Missing resume-route invariant: ${required}`);
  }

  for (const forbidden of [
    "runBacklinksSchedulerTick",
    "prepareBacklinksDryRun",
    "discoveryInput",
    "promotionInput",
    "fetch(",
    "process.env",
    "createSupabaseAdminClient",
    "BRAVE",
  ]) {
    assert(!source.includes(forbidden), `Resume route must not contain ${forbidden}`);
  }

  const authIndex = source.indexOf("const context = await deps.getContext(request)");
  const adminIndex = source.indexOf("deps.isAdmin(context.user.email)");
  const resumeIndex = source.indexOf("const result = await deps.resume({");
  assert(authIndex < adminIndex && adminIndex < resumeIndex, "Authentication and admin checks must precede resume execution");

  console.log("PASS — Automation backlink run resume route smoke");
}

void main();
