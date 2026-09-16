import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(
  process.cwd(),
  "app/api/backlinks/outreach/[id]/linkedin-interactions/reply-confirmed/route.ts",
);

const source = readFileSync(routePath, "utf8");

const required = [
  'export async function POST(',
  'getRequestUserAndWorkspace(request)',
  'isAdminPrivateEmail(auth.user.email)',
  'auth.status === "unauthenticated"',
  'auth.status === "workspace_forbidden"',
  'body.confirm !== true',
  'body.classification !== "positive"',
  'body.classification !== "negative"',
  'key !== "confirm" && key !== "classification"',
  'confirmLinkedInReply(createSupabaseAdminClient()',
  'workspaceId: auth.workspace.id',
  'outreachId: id',
  'actorUserId: auth.user.id',
  'classification: body.classification',
  'status: 401',
  'status: 403',
  'status: 400',
  'status: 404',
  'status: 409',
];

for (const marker of required) {
  assert.ok(
    source.includes(marker),
    `Missing route marker: ${marker}`,
  );
}

const forbidden = [
  "api.linkedin.com",
  "linkedin.com/messaging",
  "sendMessage",
  "send_message",
  "resend",
  "textBody",
  "replyText",
  "messageBody",
];

for (const marker of forbidden) {
  assert.equal(
    source.toLowerCase().includes(marker.toLowerCase()),
    false,
    `Forbidden route primitive: ${marker}`,
  );
}

assert.equal(
  source.includes("Object.keys(body).some"),
  true,
  "Route must reject unexpected body keys.",
);

console.log(
  "PASS — LinkedIn reply-confirmed API contract smoke",
);
