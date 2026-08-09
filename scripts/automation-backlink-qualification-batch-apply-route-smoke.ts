import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const source = await readFile("app/api/internal/automation/backlinks/qualifications/batch-apply/route.ts", "utf8");
  assert(source.includes("export async function POST"), "POST handler is required.");
  for (const method of ["GET", "PUT", "PATCH", "DELETE"]) assert(!source.includes(`export async function ${method}`), `Unexpected ${method}.`);
  for (const required of [
    "getRequestUserAndWorkspace(request)",
    'context.status === "unauthenticated"',
    'context.status === "workspace_forbidden"',
    "isAdminPrivateEmail(context.user.email)",
    "parseApplyQualificationBatchRequestBody(body)",
    'const expectedKeys = ["runId", "taskId", "opportunityIds", "confirm"]',
    "opportunityIds.length > 50",
    "new Set(opportunityIds).size !== opportunityIds.length",
    "confirm !== true",
    "workspaceId: context.workspace.id",
    "actorUserId: context.user.id",
    "applyBacklinkQualificationBatchTransaction(context.client, input)",
    "return NextResponse.json({ ok: true, result }, { status: 200 })",
  ]) assert(source.includes(required), `Missing ${required}.`);
  for (const forbidden of ["workspaceId: body", "actorUserId: body", "candidateKey", "discoveryTaskId", "stack", "error.message", "fetch("]) assert(!source.includes(forbidden), `Forbidden ${forbidden}.`);
  console.log("PASS — Backlink qualification batch apply route smoke");
}

void main();
