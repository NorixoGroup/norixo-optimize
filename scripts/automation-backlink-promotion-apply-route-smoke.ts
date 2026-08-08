import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
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
    "app/api/internal/automation/backlinks/promotions/apply/route.ts",
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
    "parseApplyPromotionRequestBody(body)",
    "readBacklinkPromotionProposal",
    "getAutomationTaskByIdInRun(context.client, taskInput)",
    "getBacklinkAssetById(",
    "applyBacklinkPromotionProposalTransaction(context.client, transactionInput)",
    "applyBacklinkPromotionProposal(",
    "workspaceId: context.workspace.id",
    "actorUserId: context.user.id",
    '"INVALID_INPUT"',
    '"La requête de promotion est invalide."',
    'console.error("[automation/backlinks/promotions/apply] request failed")',
  ]) {
    assert(source.includes(required), `Missing ${required}.`);
  }

  assertOrdered(
    source,
    [
      "getRequestUserAndWorkspace(request)",
      'context.status === "unauthenticated"',
      'context.status === "workspace_forbidden"',
      "isAdminPrivateEmail(context.user.email)",
      "await request.json()",
      "parseApplyPromotionRequestBody(body)",
      "await applyBacklinkPromotionProposal(",
    ],
    "POST flow must authenticate and validate before composition.",
  );

  for (const required of [
    'const expectedKeys = ["runId", "promotionTaskId", "proposalKey", "assetId"]',
    "!UUID_PATTERN.test(runId)",
    "!UUID_PATTERN.test(promotionTaskId)",
    "!UUID_PATTERN.test(assetId)",
    "proposalKey !== proposalKey.trim()",
    "proposalKey.length > BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH",
  ]) {
    assert(source.includes(required), `Strict body validation missing ${required}.`);
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

  assert(source.includes("context.client"), "Request-scoped client is required for auth.uid().");
  assert(!source.includes("service_role"), "Service-role client must not execute the RPC.");
  assert(!source.includes("error.message"), "Raw error messages must not be returned.");
  assert(!source.includes("stack"), "Stack must not be returned.");
  assert(!source.includes("cause"), "Cause must not be returned.");

  for (const required of [
    'return errorResponse(404, code, "Le résultat Promotion demandé est introuvable.")',
    'return errorResponse(409, code, "Le résultat Promotion n’est pas encore disponible.")',
    'return errorResponse(409, code, "L’asset sélectionné n’est pas actif.")',
    'return errorResponse(500, "PROMOTION_APPLICATION_FAILED", "La création de l’opportunité a échoué.")',
    "return NextResponse.json({ ok: true, result });",
  ]) {
    assert(source.includes(required), `Response mapping missing ${required}.`);
  }

  console.log("PASS — Automation backlink promotion apply route smoke");
}

void main();
