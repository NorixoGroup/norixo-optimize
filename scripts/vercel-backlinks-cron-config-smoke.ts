import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const source = await readFile("vercel.json", "utf8");
  for (const required of [
    '"crons"',
    '"/api/internal/cron/backlinks/outreach/schedule"',
    '"0 6 * * *"',
  ]) {
    assert(source.includes(required), `Missing ${required}`);
  }
  for (const forbidden of ["campaignId", "legacy", "apply-all"]) {
    assert(!source.includes(forbidden), `Forbidden ${forbidden}`);
  }
  console.log("PASS — Vercel backlinks cron config smoke");
}

void main();
