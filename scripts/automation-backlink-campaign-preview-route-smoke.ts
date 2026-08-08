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
  const source = await readFile("app/api/internal/automation/backlinks/campaigns/preview/route.ts", "utf8");

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
    "parseCampaignPreviewRequestBody(body)",
    "createAutomationProductionComposition()",
    "prepareBacklinkCampaignPreviewRun({",
    "executeBacklinkCampaignPreviewRun({",
    'workerId: AUTOMATION_WORKER_ID',
    'triggerSource: "manual"',
    "leaseDurationSeconds: AUTOMATION_LEASE_DURATION_SECONDS",
    "maxWorkerInvocations: AUTOMATION_MAX_WORKER_INVOCATIONS",
    "const now = new Date().toISOString()",
    'code: "INVALID_CAMPAIGN_PREVIEW_REQUEST"',
    'message: "Campaign preview request is invalid"',
    'console.error("[automation/backlinks/campaigns/preview] request failed")',
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
      "parseCampaignPreviewRequestBody(body)",
      "createAutomationProductionComposition()",
      "prepareBacklinkCampaignPreviewRun({",
      "executeBacklinkCampaignPreviewRun({",
    ],
    "POST flow must authenticate and validate before composition.",
  );

  assert(source.includes('const expectedKeys = ["campaignId", "opportunityIds", "requestedLimits", "idempotencyKey"]'), "Strict body keys missing.");
  assert(source.includes("keys.length !== expectedKeys.length"), "Body must be strict.");
  assert(source.includes("!keys.every"), "Body must reject extra keys.");
  assert(source.includes("opportunityIds.length > 100"), "Opportunity count limit missing.");
  assert(source.includes("seenOpportunityIds"), "Duplicate opportunity IDs must be rejected.");
  assert(source.includes("maxPerDomain > maxSelectedOpportunities"), "Requested limits must be validated.");
  assert(source.includes("idempotencyKey !== idempotencyKey.trim()"), "Idempotency key trimming missing.");
  assert(source.includes("idempotencyKey.length > 255"), "Idempotency key length limit missing.");
  assert(source.includes('source: "manual_dashboard"'), "Server-owned source missing.");
  assert(source.includes('workspaceId: context.workspace.id'), "Workspace must come from context.");
  assert(source.includes('requestedBy: context.user.id'), "RequestedBy must come from context.");
  assert(source.includes("scheduledAt: now"), "scheduledAt must use server date.");
  assert(source.includes("startedAt: now"), "startedAt must use server date.");
  assert(source.includes("attemptedAt: now"), "attemptedAt must use server date.");
  assert(source.includes("completedAt: now"), "completedAt must use server date.");
  assert(source.includes("failedAt: now"), "failedAt must use server date.");

  assert(source.includes('runDisposition: preparation.runDisposition'), "Preparation dispositions must be preserved.");
  assert(source.includes('taskDisposition: preparation.taskDisposition'), "Preparation dispositions must be preserved.");
  assert(source.includes('kind: "completed"'), "Completed response shape missing.");
  assert(source.includes('taskId: execution.task.id'), "Completed response must expose taskId.");
  assert(source.includes('kind: "pending_retry"'), "Pending retry response shape missing.");
  assert(source.includes('taskId: execution.task?.id ?? null'), "Pending retry must include nullable taskId.");
  assert(source.includes('kind: "failed"'), "Failed response shape missing.");
  assert(source.includes('preview: execution.preview'), "Preview must be returned for completed/pending_retry.");
  assert(source.includes('workerInvocations: execution.workerInvocations'), "Worker invocation count must be returned.");
  assert(source.includes('taskKind: execution.lastIssue.taskKind'), "Failed response must use safe lastIssue taskKind.");
  assert(source.includes('code: execution.lastIssue.code'), "Failed response must use safe lastIssue code.");
  assert(source.includes('message: execution.lastIssue.message'), "Failed response must use safe lastIssue message.");

  // Ensure missing-task guard and safe error are present
  assert(source.includes('CAMPAIGN_PREVIEW_TASK_MISSING'), "Missing-task error code must be present.");
  assert(source.includes('La tâche du preview est introuvable.'), "Missing-task error message must be present.");

  for (const forbidden of [
    "body.workspaceId",
    "body.requestedBy",
    "body.actorId",
    "body.userId",
    "body.email",
    "createSupabaseAdminClient",
    "service_role",
    "error.message",
    "stack",
    "cause",
    "fetch(",
    "process.env",
    "console.error(error)",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}.`);
  }

  // Inspect each `result` object returned to ensure it does not leak sensitive fields
  function extractResultBlocks(src: string): string[] {
    const blocks: string[] = [];
    const needle = "result:";
    let idx = 0;
    while (true) {
      const pos = src.indexOf(needle, idx);
      if (pos === -1) break;
      let i = src.indexOf("{", pos + needle.length);
      if (i === -1) break;
      let depth = 0;
      let start = i;
      let end = -1;
      for (; i < src.length; i++) {
        const ch = src[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) break;
      blocks.push(src.slice(start, end + 1));
      idx = end + 1;
    }
    return blocks;
  }

  const resultBlocks = extractResultBlocks(source);
  assert(resultBlocks.length > 0, "No result blocks found to inspect.");
  for (const block of resultBlocks) {
    assert(!block.includes("workspaceId"), "Result must not expose workspaceId.");
    assert(!block.includes("workerId"), "Result must not expose workerId.");
    // Ensure the full task object is not returned inside the result
    assert(!/\btask\s*:\s*\{/.test(block), "Result must not return full task object.");
  }

  console.log("PASS — Automation backlink campaign preview route smoke");
}

void main();
