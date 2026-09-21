import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
async function main() {
  const route = await readFile("app/api/internal/automation/backlinks/autonomy/preview/route.ts", "utf8");
  const vercel = await readFile("vercel.json", "utf8").catch(() => "");
  for (const value of ["getRequestUserAndWorkspace", "isAdminPrivateEmail", "runBacklinkAutonomyProductionPreview", "workspaceLimit", "promotionLimitPerWorkspace", "context.workspace.id"]) assert(route.includes(value), `Missing ${value}`);
  assert(route.includes("workspaceId: context.workspace.id"), "Preview must use authenticated workspace");
  assert(route.includes('allowed = ["workspaceLimit", "promotionLimitPerWorkspace"]'), "Request body allowlist must remain bounded");
  assert(!route.includes('allowed = ["workspaceId"'), "workspaceId must not be accepted from request body");
  // Capability checks must inspect executable request handling, not prose comments.
  for (const forbidden of [
    "mode:",
    "mode =",
    "mode=",
    '"apply"',
    '"live"',
    "execute:",
    "confirm:",
    "runOneBacklinkAutonomyWorkerTask",
    "runBacklinkOutreachLiveAutoSend",
    "executeContactFormControlledSubmission",
  ]) {
    assert(!route.includes(forbidden), `Forbidden route capability ${forbidden}`);
  }
  assert(!vercel.includes("autonomy/preview"), "Preview route must not be cron registered");
  console.log("PASS — Backlink autonomy preview route contract smoke");
}
void main();
