import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const source = await readFile("app/api/backlinks/outreach/[id]/final-no-response/route.ts", "utf8");
  for (const value of [
    "export async function POST",
    "getRequestUserAndWorkspace(request)",
    'auth.status === "unauthenticated"',
    'auth.status === "workspace_forbidden"',
    "isAdminPrivateEmail(auth.user.email)",
    "Object.keys(body).length !== 1",
    '"confirm" in body',
    "body.confirm !== true",
    "applyBacklinkOutreachFinalNoResponse",
    "workspaceId: auth.workspace.id",
    "actorUserId: auth.user.id",
    "outreachId: id",
    "{ ok: true, result }",
  ]) assert(source.includes(value), `Missing ${value}`);
  for (const forbidden of ["body.status", "body.idempotencyKey", "body.workspaceId", "body.actorUserId", "outreachEmailProvider", "sendTransactionalEmail", "Resend", "scheduler", "provider"]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }
  console.log("PASS — Backlink outreach final no-response route smoke");
}

void main();
