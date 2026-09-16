import assert from "node:assert/strict";
import fs from "node:fs";

const routePath =
  "app/api/backlinks/outreach/[id]/reply-assistant/route.ts";

const source = fs.readFileSync(routePath, "utf8");

assert.match(
  source,
  /getRequestUserAndWorkspace\(request\)/,
);

assert.match(
  source,
  /isAdminPrivateEmail\(auth\.user\.email\)/,
);

assert.match(
  source,
  /createBacklinkOutreachReplyAssistantRouteService\(auth\.client\)/,
);

assert.match(
  source,
  /workspaceId:\s*auth\.workspace\.id/,
);

assert.match(
  source,
  /outreachId:\s*id/,
);

assert.match(
  source,
  /inbound:\s*body\.inbound/,
);

assert.doesNotMatch(
  source,
  /channel:\s*body/,
);

assert.doesNotMatch(
  source,
  /sendEmail|sendMessage|resend|linkedin.*api/i,
);

assert.doesNotMatch(
  source,
  /\.insert\(|\.update\(|\.delete\(|\.rpc\(/,
);

assert.match(
  source,
  /proposal:\s*result\.proposal/,
);

console.log(
  "PASS — LinkedIn backlink reply assistant API contract smoke",
);
