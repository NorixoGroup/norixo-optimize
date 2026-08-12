import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const source = await readFile("app/api/backlinks/outreach/[id]/follow-up/prepare/route.ts", "utf8");
  for (const value of [
    "export async function POST",
    "getRequestUserAndWorkspace(request)",
    'auth.status === "unauthenticated"',
    'auth.status === "workspace_forbidden"',
    "body.confirm !== true",
    "idempotencyKey",
    "reserveBacklinkOutreachFollowUpAttempt",
    "prepareBacklinkOutreachFollowUpDraft",
    "prepareBacklinkOutreachFollowUp",
    "workspaceId: auth.workspace.id",
    "actorUserId: auth.user.id",
    "outreachId: id",
  ]) {
    assert(source.includes(value), `Missing route invariant: ${value}`);
  }
  for (const forbidden of [
    "outreachEmailProvider",
    "sendTransactionalEmail",
    "outreachEmailSendService",
    "Resend",
    "scheduler",
  ]) {
    assert(!source.includes(forbidden), `Forbidden route dependency: ${forbidden}`);
  }

  const parseStart = source.indexOf("function parse");
  const parseBlock = source.slice(parseStart, source.indexOf("\n\nexport async function POST", parseStart));
  assert(parseBlock.includes("Object.keys(body).length !== 2"), "The route body must be strict.");
  assert(parseBlock.includes("body.confirm !== true"), "The route body must require confirm:true.");

  console.log("PASS — Backlink follow-up prepare route smoke");
}

void main();
