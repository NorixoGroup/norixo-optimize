import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
async function main() {
  const route = await readFile("app/api/internal/automation/backlinks/autonomy/preview/route.ts", "utf8");
  const vercel = await readFile("vercel.json", "utf8").catch(() => "");
  for (const value of ["getRequestUserAndWorkspace", "isAdminPrivateEmail", "runBacklinkAutonomyProductionPreview", "workspaceLimit", "promotionLimitPerWorkspace"]) assert(route.includes(value), `Missing ${value}`);
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
