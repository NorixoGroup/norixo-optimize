import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "lib/backlinks/repositories/outreachAttemptsRepository.ts",
  "utf8",
);

const start = source.indexOf(
  "export async function getLatestBacklinkOutreachAttemptForOutreach",
);

assert.notEqual(
  start,
  -1,
  "Latest-attempt repository function must exist.",
);

const end = source.indexOf(
  "export async function listBacklinkOutreachAttemptSummariesForOutreachIds",
  start,
);

assert.notEqual(
  end,
  -1,
  "Latest-attempt repository function boundary must exist.",
);

const fn = source.slice(start, end);

assert.match(
  fn,
  /\.eq\("workspace_id", workspaceId\)/,
  "Latest attempt lookup must remain workspace-scoped.",
);

assert.match(
  fn,
  /\.eq\("outreach_id", outreachId\)/,
  "Latest attempt lookup must remain outreach-scoped.",
);

assert.match(
  fn,
  /\.order\("created_at", \{ ascending: false \}\)/,
  "Latest attempt lookup must sort newest created_at first.",
);

assert.match(
  fn,
  /\.order\("id", \{ ascending: false \}\)/,
  "Latest attempt lookup must retain deterministic id tie-break.",
);

assert.match(
  fn,
  /\.limit\(1\)\.maybeSingle\(\)/,
  "Latest attempt lookup must reduce the ordered result to at most one row before maybeSingle().",
);

console.log(
  "PASS — latest outreach attempt lookup is cardinality-safe",
);
