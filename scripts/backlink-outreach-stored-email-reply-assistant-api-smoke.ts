import assert from "node:assert/strict";
import fs from "node:fs";

const routePath =
  "app/api/backlinks/outreach/[id]/inbound/[messageId]/reply-assistant/route.ts";

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
  /getBacklinkOutreachInboundMessageById\(\s*adminClient,\s*messageId/,
);

assert.match(
  source,
  /getBacklinkOutreachById\(\s*adminClient,\s*auth\.workspace\.id,\s*id/,
);

assert.match(
  source,
  /outreach\.channel !== "email"/,
);

assert.match(
  source,
  /inboundMessage\.workspace_id !== auth\.workspace\.id/,
);

assert.match(
  source,
  /inboundMessage\.outreach_id !== id/,
);

assert.match(
  source,
  /inboundMessage\.provider !== "resend"/,
);

assert.match(
  source,
  /inboundMessage\.correlation_status !== "correlated"/,
);

assert.match(
  source,
  /inboundMessage\.text_body/,
);

assert.match(
  source,
  /sender:\s*inboundMessage\.sender/,
);

assert.match(
  source,
  /subject:\s*inboundMessage\.subject/,
);

assert.match(
  source,
  /textBody:\s*inboundMessage\.text_body/,
);

assert.doesNotMatch(
  source,
  /request\.json\(/,
);

assert.doesNotMatch(
  source,
  /body\.inbound|body\.textBody|body\.sender|body\.subject/,
);

assert.doesNotMatch(
  source,
  /\.insert\(|\.update\(|\.delete\(|\.rpc\(/,
);

assert.doesNotMatch(
  source,
  /sendEmail|sendMessage|fetch\(|axios/i,
);

assert.match(
  source,
  /proposal:\s*result\.proposal/,
);

console.log(
  "PASS — stored email backlink reply assistant API contract smoke",
);
