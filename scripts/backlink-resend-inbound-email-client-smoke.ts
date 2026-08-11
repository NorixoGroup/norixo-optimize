import { strict as assert } from "node:assert";

import { ResendInboundEmailClientError, createResendInboundEmailClient } from "../lib/backlinks/providers/resendInboundEmailClient";

async function expects(operation: () => Promise<unknown>, code: ResendInboundEmailClientError["code"]) {
  await assert.rejects(operation, (error: unknown) => error instanceof ResendInboundEmailClientError && error.code === code);
}

async function main() {
  let receivedEmailId = "";
  const client = createResendInboundEmailClient({
    apiKey: "re_inbound",
    get: async (emailId) => {
      receivedEmailId = emailId;
      return {
        data: {
          text: `  ${"x".repeat(65537)}  `,
          headers: {
            "message-id": "<inbound-1@example.com>",
            "IN-REPLY-TO": "<outbound-1@example.com>",
            References: "<outbound-0@example.com> <outbound-1@example.com> <outbound-1@example.com>",
            "Auto-Submitted": "no",
            Precedence: "list",
            "X-Autoreply": "yes",
          },
        },
        error: null,
      };
    },
  });
  const result = await client(" inbound-email-1 ");
  assert.equal(receivedEmailId, "inbound-email-1");
  assert.equal(result.textBody?.length, 65536);
  assert.deepEqual(result, { textBody: result.textBody, messageId: "<inbound-1@example.com>", inReplyTo: ["<outbound-1@example.com>"], references: ["<outbound-0@example.com>", "<outbound-1@example.com>"], autoReply: { isAutoReply: true, reason: "precedence" } });
  assert(!("headers" in result) && !("htmlBody" in result) && !("attachments" in result), "Receiving client must only return targeted normalized data.");

  await expects(() => createResendInboundEmailClient({ apiKey: undefined, get: async () => ({ data: null, error: null }) })("email-1"), "RESEND_INBOUND_EMAIL_CONFIGURATION_MISSING");
  await expects(() => client(" "), "RESEND_INBOUND_EMAIL_ID_INVALID");
  await expects(() => createResendInboundEmailClient({ apiKey: "re_inbound", get: async () => ({ data: null, error: { name: "not_found", statusCode: 404, message: "missing" } }) })("email-1"), "RESEND_INBOUND_EMAIL_PROVIDER_REJECTED");
  await expects(() => createResendInboundEmailClient({ apiKey: "re_inbound", get: async () => { throw new Error("timeout"); } })("email-1"), "RESEND_INBOUND_EMAIL_PROVIDER_UNAVAILABLE");
  await expects(() => createResendInboundEmailClient({ apiKey: "re_inbound", get: async () => ({ data: null, error: null }) })("email-1"), "RESEND_INBOUND_EMAIL_CONTENT_INVALID");
  console.log("PASS — Resend inbound email client smoke");
}

void main();
