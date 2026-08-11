import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import { createResendOutreachInboundWebhookHandler } from "../app/api/webhooks/resend/outreach/inbound/route";
import type { BacklinkOutreachInboundMessageRow } from "../lib/backlinks/repositories/outreachInboundMessagesRepository";

const request = () => new Request("https://norixo.test/api/webhooks/resend/outreach/inbound", { method: "POST", headers: { "svix-id": "event-1", "svix-timestamp": "1723366800", "svix-signature": "signature-1" }, body: '{"raw":true}' });
const received = { type: "email.received", created_at: "2026-08-11T16:00:00.000Z", data: { email_id: "email-1", message_id: "<inbound@example.com>", from: "person@example.com", to: ["reply+123e4567-e89b-42d3-a456-426614174000@replies.example.com"], subject: "Reply" } };

function inbound(correlationStatus: string): BacklinkOutreachInboundMessageRow {
  const correlated = correlationStatus === "correlated";
  return { id: "inbound-1", workspace_id: correlated ? "workspace-1" : null, outreach_id: correlated ? "outreach-1" : null, attempt_id: correlated ? "attempt-1" : null, contact_id: correlated ? "contact-1" : null, provider: "resend", provider_event_id: "event-1", inbound_message_id: "<inbound@example.com>", correlation_status: correlationStatus, correlation_method: correlated ? "reply_token" : null, sender: "person@example.com", recipient: "reply+123e4567-e89b-42d3-a456-426614174000@replies.example.com", subject: "Reply", text_body: "Hello", in_reply_to: null, references_header: null, received_at: "2026-08-11T16:01:00.000Z", occurred_at: "2026-08-11T16:00:00.000Z", created_at: "2026-08-11T16:01:00.000Z" };
}

function handler(correlationStatus: string, disposition: "created" | "existing" = "created", processor: "applied" | "existing" | "not_applicable" | "throws" = "applied", event: unknown = received) {
  let receivedCalls = 0;
  let ingests = 0;
  let processors = 0;
  const route = createResendOutreachInboundWebhookHandler({
    getWebhookSecret: () => "whsec_inbound",
    getInboundReplyDomain: () => "replies.example.com",
    verify: () => event,
    receive: async (emailId) => { receivedCalls += 1; assert.equal(emailId, "email-1"); return { textBody: "Hello", messageId: "<inbound@example.com>", inReplyTo: [], references: [], autoReply: { isAutoReply: false } }; },
    ingest: async (input) => { ingests += 1; assert.equal(input.content.textBody, "Hello"); return { disposition, message: inbound(correlationStatus), correlationStatus }; },
    processInboundReply: async () => { processors += 1; if (processor === "throws") throw new Error("effect failure"); return processor === "not_applicable" ? { disposition: "not_applicable" } : { disposition: processor, inboundMessageId: "inbound-1", outreachId: "outreach-1", contactId: "contact-1" }; },
  });
  return { route, counts: () => ({ receivedCalls, ingests, processors }) };
}

async function body(response: Response) { return response.json(); }

async function main() {
  const source = readFileSync(new URL("../app/api/webhooks/resend/outreach/inbound/route.ts", import.meta.url), "utf8");
  for (const forbidden of ["updateBacklinkOutreach", "updateBacklinkContact", "updateBacklinkOutreachAttemptState", "outreachLifecycleService", "outreachEmailSendService", "sendTransactionalEmail", "scheduler", "classification"]) assert(!source.includes(forbidden), `Inbound webhook route must not use ${forbidden}`);
  const ignored = handler("unmatched", "created", "applied", { type: "email.delivered", created_at: "2026-08-11T16:00:00.000Z", data: {} });
  assert.deepEqual(await body(await ignored.route(request())), { ok: true, disposition: "ignored" });
  assert.deepEqual(ignored.counts(), { receivedCalls: 0, ingests: 0, processors: 0 });
  for (const correlationStatus of ["unmatched", "ambiguous", "ignored"]) {
    const item = handler(correlationStatus);
    assert.deepEqual(await body(await item.route(request())), { ok: true, disposition: correlationStatus });
    assert.equal(item.counts().processors, 0);
  }
  const correlated = handler("correlated", "created", "applied");
  assert.deepEqual(await body(await correlated.route(request())), { ok: true, disposition: "created", correlationStatus: "correlated", effectDisposition: "applied" });
  assert.equal(correlated.counts().processors, 1);
  const existing = handler("correlated", "existing", "existing");
  assert.deepEqual(await body(await existing.route(request())), { ok: true, disposition: "existing", correlationStatus: "correlated", effectDisposition: "existing" });
  assert.equal(existing.counts().processors, 1, "Existing inbound rows must still reconcile their effect.");
  const processorFailure = handler("correlated", "created", "throws");
  const failure = await processorFailure.route(request());
  assert.equal(failure.status, 500); assert.deepEqual(await body(failure), { error: "Webhook inbound reply processing unavailable." });
  let invalidReceiveCalls = 0;
  let invalidIngestCalls = 0;
  const invalidRoute = createResendOutreachInboundWebhookHandler({ getWebhookSecret: () => "whsec_inbound", getInboundReplyDomain: () => "replies.example.com", verify: () => { throw new Error("bad signature"); }, receive: async () => { invalidReceiveCalls += 1; throw new Error("must not receive"); }, ingest: async () => { invalidIngestCalls += 1; throw new Error("must not ingest"); }, processInboundReply: async () => ({ disposition: "not_applicable" }) });
  const invalidResponse = await invalidRoute(request());
  assert.equal(invalidResponse.status, 400); assert.equal(invalidReceiveCalls, 0); assert.equal(invalidIngestCalls, 0);
  let failedReceiveIngests = 0;
  const receivingFailureRoute = createResendOutreachInboundWebhookHandler({ getWebhookSecret: () => "whsec_inbound", getInboundReplyDomain: () => "replies.example.com", verify: () => received, receive: async () => { throw new Error("receiving unavailable"); }, ingest: async () => { failedReceiveIngests += 1; throw new Error("must not ingest"); }, processInboundReply: async () => ({ disposition: "not_applicable" }) });
  const receivingFailure = await receivingFailureRoute(request());
  assert.equal(receivingFailure.status, 500); assert.deepEqual(await body(receivingFailure), { error: "Webhook inbound reply processing unavailable." }); assert.equal(failedReceiveIngests, 0);
  console.log("PASS — Backlink outreach inbound webhook integration smoke");
}

void main();
