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
    "app/api/internal/automation/backlinks/campaigns/apply/route.ts",
    "utf8",
  );

  assert(source.length > 0, "Route file is required.");
  assert(source.includes("export async function POST"), "POST handler is required.");

  for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
    assert(!source.includes(`export async function ${method}`), `Unexpected ${method} handler.`);
  }

  for (const required of [
    "getRequestUserAndWorkspace(request)",
    'context.status === "unauthenticated"',
    'context.status === "workspace_forbidden"',
    "isAdminPrivateEmail(context.user.email)",
    "await request.json()",
    "parseApplyCampaignMembershipsRequestBody(body)",
    "applyBacklinkCampaignPreviewMemberships(",
    "getAutomationTaskByIdInRun(context.client, taskInput)",
    "createBacklinkCampaignMembershipApplicationRepository(context.client)",
    "applyBacklinkCampaignMembership(",
    "workspaceId: context.workspace.id",
    "actorUserId: context.user.id",
    'const expectedKeys = [\"runId\", \"taskId\", \"campaignId\", \"confirm\"]',
    "!UUID_PATTERN.test(runId)",
    "!UUID_PATTERN.test(taskId)",
    "!UUID_PATTERN.test(campaignId)",
    "confirm !== true",
    '"INVALID_INPUT"',
    '"La requête d’application de campagne est invalide."',
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
      "parseApplyCampaignMembershipsRequestBody(body)",
      "await applyBacklinkCampaignPreviewMemberships(",
    ],
    "POST flow must authenticate and validate before applying memberships.",
  );

  for (const required of [
    "result: {",
    "campaignId: result.campaignId",
    "runId: result.runId",
    "taskId: result.taskId",
    "summary: result.summary",
    '"CAMPAIGN_PREVIEW_TASK_NOT_FOUND"',
    '"CAMPAIGN_PREVIEW_TASK_NOT_COMPLETED"',
    '"CAMPAIGN_PREVIEW_SCOPE_INVALID"',
    '"CAMPAIGN_PREVIEW_INVALID"',
    '"CAMPAIGN_MEMBERSHIP_APPLICATION_INVALID"',
    '"CAMPAIGN_MEMBERSHIP_APPLICATION_FAILED"',
  ]) {
    assert(source.includes(required), `Missing response mapping ${required}.`);
  }

  for (const forbidden of [
    "preview: result.preview",
    "memberships: result.memberships",
    "output: result.output",
    "workspaceId: input.workspaceId",
    "actorUserId: input.actorUserId",
    "body.workspaceId",
    "body.actorUserId",
    "opportunityIds",
    "results:",
    "proposedPriority",
    "membershipStatus",
    'from("',
    'from("automation_tasks")',
    'select("',
    'rpc("',
    "sql",
    "worker",
    "Worker",
    "Outreach",
    "sendEmail",
    "sendTransactionalEmail",
    "resend.emails",
    "nodemailer",
    "createTransport",
    "createCampaign",
    "updateCampaign",
    "createOpportunity",
    "updateOpportunity",
    "error.message",
    "stack",
  ]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}.`);
  }

  console.log("PASS — Campaign membership apply route smoke");
}

void main();