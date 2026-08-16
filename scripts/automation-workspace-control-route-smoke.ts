import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function handlerSource(source: string, method: "GET" | "PATCH"): string {
  const start = source.indexOf(`export async function ${method}`);
  const nextMethod = method === "GET" ? source.indexOf("export async function PATCH") : source.length;
  assert(start !== -1, `Missing ${method} handler`);
  return source.slice(start, nextMethod);
}

function assertOrdered(source: string, values: string[], message: string): void {
  let previous = -1;
  for (const value of values) {
    const current = source.indexOf(value);
    assert(current > previous, message);
    previous = current;
  }
}

async function main(): Promise<void> {
  const source = await readFile(
    "app/api/internal/automation/workspace-control/route.ts",
    "utf8",
  );
  const getSource = handlerSource(source, "GET");
  const patchSource = handlerSource(source, "PATCH");

  for (const forbiddenMethod of ["POST", "PUT", "DELETE"]) {
    assert(
      !source.includes(`export async function ${forbiddenMethod}`),
      `Unexpected ${forbiddenMethod} handler`,
    );
  }
  for (const required of [
    "getRequestUserAndWorkspace(request)",
    'context.status === "unauthenticated"',
    'context.status === "workspace_forbidden"',
    "isAdminPrivateEmail(context.user.email)",
    "createSupabaseAdminClient()",
    "getOrCreateAutomationWorkspaceControl",
    "updateAutomationWorkspaceControl",
    'code: "INVALID_INPUT"',
    'message: "Invalid automation workspace control input"',
    'code: "AUTOMATION_WORKSPACE_CONTROL_FAILED"',
    'message: "Unable to manage automation workspace control"',
    'console.error("[automation/workspace-control] request failed")',
  ]) {
    assert(source.includes(required), `Missing ${required}`);
  }

  for (const handler of [getSource, patchSource]) {
    assertOrdered(
      handler,
      [
        "getRequestUserAndWorkspace(request)",
        'context.status === "unauthenticated"',
        'context.status === "workspace_forbidden"',
        "isAdminPrivateEmail(context.user.email)",
        "createSupabaseAdminClient()",
      ],
      "Client creation must follow auth, workspace, and admin checks",
    );
    assert(handler.includes("workspaceId: context.workspace.id"), "Workspace must come from context");
  }

  assert(!getSource.includes("request.json"), "GET must not read a body");
  assert(getSource.includes("control: result.control"), "GET must return public control");
  assert(getSource.includes("disposition: result.kind"), "GET must return disposition");
  assert(getSource.includes("createOrGetAutomationWorkspaceControlRepository"), "GET adapter missing");

  assertOrdered(
    patchSource,
    [
      "getRequestUserAndWorkspace(request)",
      "isAdminPrivateEmail(context.user.email)",
      "await request.json()",
      "parseUpdateWorkspaceControlRequestBody(body)",
      "createSupabaseAdminClient()",
      "await getOrCreateAutomationWorkspaceControl",
      "await updateAutomationWorkspaceControl",
    ],
    "PATCH flow order is invalid",
  );
  assert(patchSource.includes("backlinksEnabled: input.backlinksEnabled"), "PATCH flag missing");
  assert(
    patchSource.includes("backlinkOutreachScheduleApplyEnabled: input.backlinkOutreachScheduleApplyEnabled"),
    "PATCH capability flag missing",
  );
  assert(patchSource.includes("dryRunOnly: input.dryRunOnly"), "PATCH dry-run flag missing");
  assert(patchSource.includes("return NextResponse.json({ ok: true, control: result.control })"), "PATCH response missing");

  for (const required of [
    'keys.length < 1 || keys.length > 3',
    'allowedKeys = new Set(["backlinksEnabled", "backlinkOutreachScheduleApplyEnabled", "dryRunOnly"])',
    "typeof backlinksEnabled === \"boolean\"",
    "typeof backlinkOutreachScheduleApplyEnabled === \"boolean\"",
    "typeof dryRunOnly === \"boolean\"",
    "request.json().catch(() => null)",
  ]) {
    assert(source.includes(required), `Missing strict body validation ${required}`);
  }
  for (const forbidden of [
    "body.workspaceId",
    "input.workspaceId",
    "body.backlinkOutreachScheduleApplyEnabled",
    "setTimeout",
    "setInterval",
    "fetch(",
    "cron",
    "webhook",
    "provider",
    "createClient(",
    "process.env",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }

  const clientCreations = source.match(/createSupabaseAdminClient\(\)/g) ?? [];
  assert(clientCreations.length === 2, "Expected one client per handler");
  assert(!source.includes("client: client"), "Client must not be returned");
  assert(!source.includes("secret"), "Secret must not be exposed");
  assert(!source.includes("stack"), "Stack must not be exposed");
  assert(!source.includes("cause"), "Cause must not be exposed");

  console.log("PASS — Automation workspace control route smoke");
}

void main();
