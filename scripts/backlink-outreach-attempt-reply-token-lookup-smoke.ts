import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

async function main() {
  const source = readFileSync(new URL("../lib/backlinks/repositories/outreachAttemptsRepository.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function getBacklinkOutreachAttemptByReplyTokenHash");
  const end = source.indexOf("export async function listBacklinkOutreachAttemptsForOutreach", start);
  assert(start >= 0 && end > start, "Reply-token lookup must be present as a bounded repository primitive.");
  const lookup = source.slice(start, end);
  for (const fragment of ["reply_token_hash", ".from(\"backlink_outreach_attempts\")", ".maybeSingle()", "normalizedReplyTokenHash.toLowerCase()", "normalizeBacklinkRepositoryError"]) {
    assert(lookup.includes(fragment), `Reply-token lookup must include ${fragment}.`);
  }
  assert(!lookup.includes("workspace_id"), "Reply-token lookup must be global; the workspace is derived from the resolved Attempt.");
  assert(!lookup.includes(".update("), "Reply-token lookup must be read-only.");
  assert(lookup.includes('code: "VALIDATION"'), "Malformed hashes must use the repository validation convention.");
  console.log("PASS — Backlink outreach attempt reply-token lookup smoke");
}

void main();
