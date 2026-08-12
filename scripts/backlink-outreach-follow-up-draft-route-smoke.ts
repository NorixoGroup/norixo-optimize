import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const source = await readFile("app/api/backlinks/outreach/[id]/attempts/[attemptId]/follow-up-draft/route.ts", "utf8");
  for (const value of [
    "export async function GET",
    "export async function PATCH",
    "getRequestUserAndWorkspace(request)",
    "isAdminPrivateEmail",
    "getBacklinkOutreachById",
    "getBacklinkOutreachAttemptById",
    "getBacklinkOutreachFollowUpDraftByAttemptId",
    "updateBacklinkOutreachFollowUpDraft",
    "workspaceId: requestContext.workspace.id",
    "actorUserId: requestContext.user.id",
    "outreachId: id",
    "attemptId",
  ]) assert(source.includes(value), `Missing follow-up draft route invariant: ${value}`);

  const getBlock = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function PATCH"));
  for (const value of [
    "attempt.attempt_kind !== \"follow_up\"",
    "attempt.status !== \"prepared\"",
    "attempt.outreach_id !== outreach.id",
    "project(draft)",
  ]) {
    assert(getBlock.includes(value), `Missing GET invariant: ${value}`);
  }

  const parseBlock = source.slice(source.indexOf("function parse"), source.indexOf("export async function GET"));
  for (const value of [
    "Object.keys(body).length !== 3",
    "body.subject === undefined",
    "body.body === undefined",
    "body.expectedUpdatedAt === undefined",
    "typeof body.subject !== \"string\"",
    "typeof body.body !== \"string\"",
    "typeof body.expectedUpdatedAt !== \"string\"",
  ]) {
    assert(parseBlock.includes(value), `Missing parse invariant: ${value}`);
  }

  const patchBlock = source.slice(source.indexOf("export async function PATCH"));
  for (const value of [
    "Le brouillon a été modifié ailleurs. Rechargez la version la plus récente.",
    "draft.updated_at",
  ]) {
    assert(patchBlock.includes(value), `Missing PATCH invariant: ${value}`);
  }
  for (const forbidden of [
    "idempotencyKey",
  ]) {
    assert(!parseBlock.includes(forbidden), `Forbidden request body field: ${forbidden}`);
  }
  for (const forbidden of [
    "sendEmail",
    "provider",
    "scheduler",
  ]) {
    assert(!patchBlock.includes(forbidden), `Forbidden route exposure: ${forbidden}`);
  }

  console.log("PASS — Backlink follow-up draft route smoke");
}

void main();
