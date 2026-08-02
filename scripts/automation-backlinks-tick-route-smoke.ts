import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const source = await readFile(
    "app/api/internal/automation/backlinks/tick/route.ts",
    "utf8",
  );

  for (const required of [
    "export async function POST(request: NextRequest)",
    "getRequestUserAndWorkspace(request)",
    'context.status === "unauthenticated"',
    'context.status === "workspace_forbidden"',
    "isAdminPrivateEmail(context.user.email)",
    'workerId: AUTOMATION_WORKER_ID',
    'triggerSource: "manual"',
    "leaseDurationSeconds: AUTOMATION_LEASE_DURATION_SECONDS",
    "maxWorkerInvocations: AUTOMATION_MAX_WORKER_INVOCATIONS",
    "const now = new Date().toISOString()",
    "createAutomationProductionComposition()",
    "composition.runBacklinksSchedulerTick({",
    'console.error("[automation/backlinks/tick] request failed")',
  ]) {
    assert(source.includes(required), `Missing ${required}`);
  }

  const authIndex = source.indexOf("getRequestUserAndWorkspace(request)");
  const adminIndex = source.indexOf("isAdminPrivateEmail(context.user.email)");
  const bodyIndex = source.indexOf("await request.json()");
  const compositionIndex = source.indexOf(
    "createAutomationProductionComposition()",
  );
  assert(authIndex < adminIndex, "Admin check must follow authentication");
  assert(adminIndex < bodyIndex, "Body must follow admin check");
  assert(bodyIndex < compositionIndex, "Composition must follow body validation");

  const expectedBodyKeys = [
    "idempotencyKey",
    "scheduledAt",
    "discoveryInput",
    "qualificationInput",
  ];
  for (const key of expectedBodyKeys) {
    assert(source.includes(`"${key}"`), `Missing body key ${key}`);
  }
  assert(source.includes("keys.length !== expectedKeys.length"), "Body must be strict");
  assert(source.includes("!keys.every"), "Body must reject extra keys");
  assert(source.includes("idempotencyKey !== idempotencyKey.trim()"), "Idempotency key must be trimmed");
  assert(source.includes("idempotencyKey.length > 255"), "Idempotency key limit missing");
  assert(source.includes("Number.isFinite(Date.parse(scheduledAt))"), "scheduledAt validation missing");
  assert(source.includes("!isJsonObject(discoveryInput)"), "discoveryInput validation missing");
  assert(source.includes("!isJsonObject(qualificationInput)"), "qualificationInput validation missing");
  assert(source.includes('code: "INVALID_INPUT"'), "Invalid input code missing");
  assert(source.includes('message: "Invalid automation tick input"'), "Invalid input message missing");

  const dateExpressions = source.match(/new Date\(\)\.toISOString\(\)/g) ?? [];
  assert(dateExpressions.length === 1, "Exactly one server date is required");
  for (const field of ["startedAt", "attemptedAt", "completedAt", "failedAt"]) {
    assert(source.includes(`${field}: now`), `${field} must use the server date`);
  }
  assert(source.includes("scheduledAt: input.scheduledAt"), "scheduledAt must come from body");
  assert(source.includes("requestedBy: context.user.id"), "requestedBy must come from context");
  assert(source.includes("workspaceId: context.workspace.id"), "workspace must come from context");

  const tickInput = source.match(/runBacklinksSchedulerTick\(\{([\s\S]*?)\n    \}\)/);
  assert(tickInput !== null, "Tick input not found");
  const tickKeys = [...tickInput[1].matchAll(/^\s+(\w+):/gm)].map(
    (match) => match[1],
  );
  const expectedTickKeys = [
    "workspaceId",
    "requestedBy",
    "workerId",
    "idempotencyKey",
    "triggerSource",
    "scheduledAt",
    "startedAt",
    "attemptedAt",
    "completedAt",
    "failedAt",
    "leaseDurationSeconds",
    "maxWorkerInvocations",
    "discoveryInput",
    "qualificationInput",
  ];
  assert(
    tickKeys.join(",") === expectedTickKeys.join(","),
    "Tick input must contain exactly the expected fields",
  );

  assert(source.includes("return NextResponse.json({ ok: true, result });"), "Success response missing");
  assert(source.includes('code: "AUTOMATION_TICK_FAILED"'), "Failure code missing");
  assert(source.includes('message: "Unable to run automation tick"'), "Failure message missing");
  for (const forbidden of [
    "setTimeout",
    "setInterval",
    "fetch(",
    "cron",
    "webhook",
    "provider",
    "createSupabaseAdminClient",
    "repositories/",
    "process.env",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }

  console.log("PASS — Automation Backlinks tick route smoke");
}

void main();
