import { strict as assert } from "node:assert";

import { ResendInboundWebhookAdapterError, verifyAndNormalizeResendInboundWebhook } from "../lib/backlinks/providers/resendInboundWebhookAdapter";

const headers = { svixId: "event-1", svixTimestamp: "1723366800", svixSignature: "signature-1" };
const received = {
  type: "email.received",
  created_at: "2026-08-11T10:00:00.000Z",
  data: {
    email_id: "email-1",
    message_id: "<inbound-1@example.com>",
    from: "Sender <SENDER@example.com>",
    to: ["reply+550e8400-e29b-41d4-a716-446655440000@inbound.norixo.io"],
    subject: " Reply subject ",
    attachments: [{ id: "attachment-1" }],
  },
};

function expects(operation: () => unknown, code: ResendInboundWebhookAdapterError["code"]) {
  assert.throws(operation, (error: unknown) => error instanceof ResendInboundWebhookAdapterError && error.code === code);
}

function main() {
  let verifiedPayload = "";
  const result = verifyAndNormalizeResendInboundWebhook({
    payload: '{"raw":true}',
    headers,
    webhookSecret: "whsec_inbound",
    verify: ({ payload, headers: verifyHeaders, webhookSecret }) => {
      verifiedPayload = payload;
      assert.deepEqual(verifyHeaders, { id: "event-1", timestamp: "1723366800", signature: "signature-1" });
      assert.equal(webhookSecret, "whsec_inbound");
      return received;
    },
  });
  assert.equal(verifiedPayload, '{"raw":true}');
  assert.deepEqual(result, { disposition: "received", provider: "resend", providerEventId: "event-1", emailId: "email-1", inboundMessageId: "<inbound-1@example.com>", sender: "sender@example.com", recipients: ["reply+550e8400-e29b-41d4-a716-446655440000@inbound.norixo.io"], subject: "Reply subject", occurredAt: "2026-08-11T10:00:00.000Z" });
  assert(!("textBody" in result) && !("htmlBody" in result) && !("headers" in result) && !("attachments" in result), "Webhook adapter must not expose content or raw headers.");

  const ignored = verifyAndNormalizeResendInboundWebhook({ payload: "{}", headers, webhookSecret: "whsec_inbound", verify: () => ({ type: "email.delivered" }) });
  assert.deepEqual(ignored, { disposition: "ignored", eventType: "email.delivered" });
  expects(() => verifyAndNormalizeResendInboundWebhook({ payload: "{}", headers, webhookSecret: "", verify: () => received }), "RESEND_INBOUND_WEBHOOK_SECRET_MISSING");
  expects(() => verifyAndNormalizeResendInboundWebhook({ payload: "{}", headers: { ...headers, svixSignature: "" }, webhookSecret: "whsec_inbound", verify: () => received }), "RESEND_INBOUND_WEBHOOK_HEADERS_MISSING");
  expects(() => verifyAndNormalizeResendInboundWebhook({ payload: "{}", headers, webhookSecret: "whsec_inbound", verify: () => { throw new Error("invalid"); } }), "RESEND_INBOUND_WEBHOOK_SIGNATURE_INVALID");
  expects(() => verifyAndNormalizeResendInboundWebhook({ payload: "{}", headers, webhookSecret: "whsec_inbound", verify: () => ({ ...received, data: { ...received.data, message_id: "invalid" } }) }), "RESEND_INBOUND_WEBHOOK_EVENT_INVALID");
  console.log("PASS — Resend inbound webhook adapter smoke");
}

main();
