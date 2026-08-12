import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const source = await readFile("app/api/backlinks/outreach/[id]/attempts/[attemptId]/follow-up-send/route.ts", "utf8");
  for (const value of [
    "export async function POST",
    "getRequestUserAndWorkspace(request)",
    'auth.status === "unauthenticated"',
    'auth.status === "workspace_forbidden"',
    "isAdminPrivateEmail(auth.user.email)",
    "Object.keys(body).length !== 1",
    "body.confirm !== true",
    "const { id, attemptId } = await context.params",
    "workspaceId: auth.workspace.id",
    "actorUserId: auth.user.id",
    "outreachId: id",
    "attemptId",
    "sendBacklinkOutreachFollowUpEmail",
    "markBacklinkOutreachFollowUpAttemptRequested",
    "applyBacklinkOutreachFollowUpAccepted",
    "createEnvironmentOutreachEmailProvider()",
    "result: { disposition: result.disposition }",
  ]) assert(source.includes(value), `Missing route invariant: ${value}`);

  const parseBlock = source.slice(source.indexOf("function parse"), source.indexOf("export async function POST"));
  for (const forbidden of [
    "idempotencyKey",
    "subject",
    "body.body",
    "recipient",
    "provider",
    "channel",
    "status",
    "workspaceId",
    "actorUserId",
    "providerMessageId",
  ]) assert(!parseBlock.includes(forbidden), `Forbidden request body field accepted: ${forbidden}`);

  for (const forbidden of [
    "providerMessageId: result.providerMessageId",
    "errorCode: result.errorCode",
    "stack",
    "sql",
  ]) assert(!source.includes(forbidden), `Forbidden route exposure: ${forbidden}`);

  console.log("PASS — Backlink outreach follow-up send route smoke");
}

void main();
