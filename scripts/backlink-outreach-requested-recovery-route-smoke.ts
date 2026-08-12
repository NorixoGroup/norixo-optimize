import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const route = await readFile("app/api/backlinks/outreach/[id]/attempts/[attemptId]/recover-requested/route.ts", "utf8");
  for (const value of [
    "export async function POST",
    "getRequestUserAndWorkspace(request)",
    'auth.status === "unauthenticated"',
    'auth.status === "workspace_forbidden"',
    "isAdminPrivateEmail",
    "Object.keys(body).length === 1",
    "body.confirm === true",
    "workspaceId: auth.workspace.id",
    "actorUserId: auth.user.id",
    "outreachId: id",
    "attemptId",
    "recoverBacklinkOutreachRequestedAttempt",
    "recoverRequestedBacklinkOutreachAttemptAsUnknown",
    "REQUESTED_ATTEMPT_RECOVERY_TOO_EARLY",
    'result: { disposition: result.disposition }',
  ]) assert(route.includes(value), `Missing requested recovery route invariant: ${value}`);
  for (const forbidden of [
    "body.status",
    "body.resolution",
    "body.providerMessageId",
    "body.errorCode",
    "body.errorMessage",
    "body.idempotencyKey",
    "outreachEmailProvider",
    "sendTransactionalEmail",
    "outreachEmailSendService",
    "Resend",
    "createBacklinkOutreachAttempt",
    "crypto.randomUUID",
  ]) assert(!route.includes(forbidden), `Forbidden requested recovery route behavior: ${forbidden}`);
  console.log("PASS — Backlink outreach requested recovery route smoke");
}

void main();
