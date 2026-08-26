import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const source = await readFile("lib/backlinks/verification/production-composition.ts", "utf8");

  for (const fragment of [
    "listBacklinkVerificationJobsForLink",
    "listVerificationJobHistoryForLink",
    "persistBacklinkVerificationResult",
    "triggerSource: job.triggerSource",
    "executeBacklinkVerificationRun",
  ]) {
    assert(source.includes(fragment), `Missing ${fragment}`);
  }

  const persistenceBlock = source.match(/persistenceDependencies:\s*\{([\s\S]*?)\n\s*\},/);
  assert(persistenceBlock !== null, "persistenceDependencies block not found");
  assert(
    persistenceBlock[1].includes("listVerificationJobHistoryForLink"),
    "production composition must wire listVerificationJobHistoryForLink",
  );

  console.log("PASS — Backlink reverification production composition smoke");
}

void main();
