import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const source = await readFile(
    "app/api/internal/automation/backlinks/qualifications/apply/route.ts",
    "utf8",
  );

  assert(source.includes("export async function POST"), "POST handler is required.");
  for (const method of ["GET", "PATCH", "PUT", "DELETE"]) {
    assert(!source.includes(`export async function ${method}`), `Unexpected ${method} handler.`);
  }

  for (const required of [
    "getRequestUserAndWorkspace(request)",
    'context.status === "unauthenticated"',
    'context.status === "workspace_forbidden"',
    "isAdminPrivateEmail(context.user.email)",
    "await request.json()",
    "parseApplyQualificationRequestBody(body)",
    "applyBacklinkQualificationTransaction(context.client, serviceInput)",
    "getAutomationTaskByIdInRun",
  ]) {
    assert(source.includes(required), `Missing ${required}.`);
  }

  for (const forbidden of [
    "body.workspaceId",
    "body.actorUserId",
    "body.userId",
    "body.email",
    "createSupabaseAdminClient",
    "createClient(",
    "process.env",
    "createBacklinkDomain",
    "createBacklinkOpportunity",
    "createBacklinkActivity",
    "fetch(",
    "setTimeout",
    "setInterval",
    "cron",
    "provider",
    "request.body",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}.`);
  }

  // Body strictness checks
  assert(source.includes('["runId", "taskId", "opportunityId", "confirm"]'), "Expected exact body keys.");
  assert(source.includes("confirm !== true"), "confirm must be strictly true");
  assert(source.includes("!UUID_PATTERN.test(runId)"), "UUID validation missing runId");
  assert(source.includes("!UUID_PATTERN.test(taskId)"), "UUID validation missing taskId");
  assert(source.includes("!UUID_PATTERN.test(opportunityId)"), "UUID validation missing opportunityId");

  // Response checks
  assert(source.includes("return NextResponse.json({ ok: true, result }"), "Success response must include result.");

  console.log("PASS — Backlink qualification apply route smoke");
}

void main();
