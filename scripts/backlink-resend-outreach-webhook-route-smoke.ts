import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import { createResendOutreachWebhookHandler } from "../app/api/webhooks/resend/outreach/route";
import type { ResendOutreachWebhookResult, ResendWebhookVerify } from "../lib/backlinks/providers/resendWebhookAdapter";
import type { OutreachDeliveryEventIngestionResult } from "../lib/backlinks/services/outreachDeliveryEventIngestionService";
import type { BacklinkOutreachDeliveryEventRow } from "../lib/backlinks/repositories/outreachDeliveryEventsRepository";
import type { ComplaintStopSignalResult } from "../lib/backlinks/services/outreachComplaintStopSignalService";
import type { PermanentBounceStopSignalResult } from "../lib/backlinks/services/outreachPermanentBounceStopSignalService";

const request = (headers: Record<string, string> = {}) => new Request("https://norixo.test/api/webhooks/resend/outreach", { method: "POST", headers: { "svix-id": "event-1", "svix-timestamp": "1723366800", "svix-signature": "signature-1", ...headers }, body: '{"raw":true}' });
const normalizedEvent = { type: "email.delivered", created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1", to: ["private@example.com"] } };

function deliveryEvent(eventType: BacklinkOutreachDeliveryEventRow["event_type"], bounceType: string | null = null): BacklinkOutreachDeliveryEventRow {
  return { id: "event-1", workspace_id: "workspace-1", outreach_id: "outreach-1", attempt_id: "attempt-1", provider: "resend", provider_event_id: "provider-event-1", provider_message_id: "message-1", event_type: eventType, bounce_type: bounceType, occurred_at: "2026-08-11T10:00:00.000Z", received_at: "2026-08-11T11:00:00.000Z", created_at: "2026-08-11T11:00:00.000Z" };
}

function handler(ingestion: OutreachDeliveryEventIngestionResult, verify: ResendWebhookVerify = () => normalizedEvent, processComplaint: (event: BacklinkOutreachDeliveryEventRow) => Promise<ComplaintStopSignalResult> = async () => ({ disposition: "not_applicable" }), processPermanentBounce: (event: BacklinkOutreachDeliveryEventRow) => Promise<PermanentBounceStopSignalResult> = async () => ({ disposition: "not_applicable" })) {
  let ingestions = 0;
  const route = createResendOutreachWebhookHandler({
    getWebhookSecret: () => "whsec_test",
    verify,
    ingest: async (event: ResendOutreachWebhookResult) => {
      ingestions += 1;
      assert.equal(event.disposition, "normalized");
      return ingestion;
    },
    processComplaint,
    processPermanentBounce,
  });
  return { route, count: () => ingestions };
}

function ingestionResult(disposition: OutreachDeliveryEventIngestionResult["disposition"]): OutreachDeliveryEventIngestionResult {
  if (disposition === "ignored" || disposition === "unmatched") return { disposition, eventType: "email.delivered" };
  return { disposition, deliveryEvent: deliveryEvent("email.delivered"), eventId: "event-1", outreachId: "outreach-1", attemptId: "attempt-1", eventType: "email.delivered" };
}

async function json(response: Response): Promise<unknown> { return response.json(); }

async function main() {
  const source = readFileSync(new URL("../app/api/webhooks/resend/outreach/route.ts", import.meta.url), "utf8");
  for (const required of ["export async function POST", "export const runtime = \"nodejs\"", "await request.text()", "svix-id", "svix-timestamp", "svix-signature", "RESEND_WEBHOOK_SECRET", "verifyAndNormalizeResendOutreachWebhook", "createBacklinkOutreachDeliveryEventIngestionService", "createBacklinkOutreachComplaintStopSignalService", "createBacklinkOutreachPermanentBounceStopSignalService", "processComplaint(ingestion.deliveryEvent)", "processPermanentBounce(ingestion.deliveryEvent)"]) assert(source.includes(required), `Missing ${required}`);
  for (const forbidden of ["request.json()", "RESEND_API_KEY", "getRequestUserAndWorkspace", "requireWorkspace", "isAdminPrivateEmail", "updateBacklinkOutreach", "updateBacklinkOutreachAttemptState", "outreachLifecycleService", "outreachEmailSendService", "sendTransactionalEmail", "scheduler", "follow_up"]) assert(!source.includes(forbidden), `Forbidden ${forbidden}`);

  for (const disposition of ["ignored", "unmatched", "created", "existing"] as const) {
    const item = handler(ingestionResult(disposition));
    const result = await item.route(request());
    assert.equal(result.status, 200);
    assert.deepEqual(await json(result), { ok: true, disposition });
    assert.equal(item.count(), 1);
  }

  const complaintIngestion: OutreachDeliveryEventIngestionResult = { disposition: "created", deliveryEvent: deliveryEvent("email.complained"), eventId: "event-1", outreachId: "outreach-1", attemptId: "attempt-1", eventType: "email.complained" };
  const complaint = handler(complaintIngestion, () => ({ type: "email.complained", created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1" } }), async (event) => {
    assert.equal(event.event_type, "email.complained");
    return { disposition: "applied", deliveryEventId: event.id, outreachId: "outreach-1", contactId: "contact-1" };
  });
  const complaintResponse = await complaint.route(request());
  assert.equal(complaintResponse.status, 200);
  assert.deepEqual(await json(complaintResponse), { ok: true, disposition: "created", effectDisposition: "applied" });

  const complaintFailure = handler(complaintIngestion, () => ({ type: "email.complained", created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1" } }), async () => { throw new Error("effect failed"); });
  const complaintFailureResponse = await complaintFailure.route(request());
  assert.equal(complaintFailureResponse.status, 500);
  assert.deepEqual(await json(complaintFailureResponse), { error: "Webhook complaint processing unavailable." });

  const existingComplaint: OutreachDeliveryEventIngestionResult = { ...complaintIngestion, disposition: "existing" };
  const existingComplaintRoute = handler(existingComplaint, () => ({ type: "email.complained", created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1" } }), async () => ({ disposition: "existing", deliveryEventId: "event-1", outreachId: "outreach-1", contactId: "contact-1" }));
  const existingComplaintResponse = await existingComplaintRoute.route(request());
  assert.equal(existingComplaintResponse.status, 200);
  assert.deepEqual(await json(existingComplaintResponse), { ok: true, disposition: "existing", effectDisposition: "existing" });

  const permanentIngestion: OutreachDeliveryEventIngestionResult = { disposition: "created", deliveryEvent: deliveryEvent("email.bounced", "permanent"), eventId: "event-1", outreachId: "outreach-1", attemptId: "attempt-1", eventType: "email.bounced" };
  const permanent = handler(permanentIngestion, () => ({ type: "email.bounced", created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1", bounce: { type: "Permanent" } } }), async () => ({ disposition: "not_applicable" }), async (event) => ({ disposition: "applied", deliveryEventId: event.id, outreachId: "outreach-1", contactId: "contact-1" }));
  assert.deepEqual(await json(await permanent.route(request())), { ok: true, disposition: "created", effectDisposition: "applied" });
  const existingPermanent: OutreachDeliveryEventIngestionResult = { ...permanentIngestion, disposition: "existing" };
  const existingPermanentRoute = handler(existingPermanent, () => ({ type: "email.bounced", created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1", bounce: { type: "Permanent" } } }), async () => ({ disposition: "not_applicable" }), async () => ({ disposition: "existing", deliveryEventId: "event-1", outreachId: "outreach-1", contactId: "contact-1" }));
  assert.deepEqual(await json(await existingPermanentRoute.route(request())), { ok: true, disposition: "existing", effectDisposition: "existing" });
  const permanentFailure = handler(permanentIngestion, () => ({ type: "email.bounced", created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1", bounce: { type: "Permanent" } } }), async () => ({ disposition: "not_applicable" }), async () => { throw new Error("effect failed"); });
  const permanentFailureResponse = await permanentFailure.route(request());
  assert.equal(permanentFailureResponse.status, 500);
  assert.deepEqual(await json(permanentFailureResponse), { error: "Webhook permanent bounce processing unavailable." });

  for (const bounceType of ["transient", "undetermined", "unknown", null]) {
    const nonPermanentIngestion: OutreachDeliveryEventIngestionResult = { ...permanentIngestion, deliveryEvent: deliveryEvent("email.bounced", bounceType) };
    const nonPermanent = handler(nonPermanentIngestion, () => ({ type: "email.bounced", created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1", bounce: { type: "Temporary" } } }), async () => ({ disposition: "not_applicable" }), async (event) => {
      assert.equal(event.bounce_type, bounceType);
      return { disposition: "not_applicable" };
    });
    const nonPermanentResponse = await nonPermanent.route(request());
    assert.equal(nonPermanentResponse.status, 200);
    assert.deepEqual(await json(nonPermanentResponse), { ok: true, disposition: "created" });
  }

  const missingHeader = handler(ingestionResult("created"));
  const missingHeaderResponse = await missingHeader.route(request({ "svix-signature": "" }));
  assert.equal(missingHeaderResponse.status, 400); assert.equal(missingHeader.count(), 0);

  const invalidSignature = handler(ingestionResult("created"), () => { throw new Error("signature failure"); });
  const invalidSignatureResponse = await invalidSignature.route(request());
  assert.equal(invalidSignatureResponse.status, 400); assert.equal(invalidSignature.count(), 0);

  const invalidPayload = handler(ingestionResult("created"), () => ({ type: "email.delivered", data: {} }));
  const invalidPayloadResponse = await invalidPayload.route(request());
  assert.equal(invalidPayloadResponse.status, 400); assert.equal(invalidPayload.count(), 0);

  const ingestionFailure = createResendOutreachWebhookHandler({ getWebhookSecret: () => "whsec_test", verify: () => normalizedEvent, ingest: async () => { throw new Error("database failure"); }, processComplaint: async () => ({ disposition: "not_applicable" }), processPermanentBounce: async () => ({ disposition: "not_applicable" }) });
  const ingestionFailureResponse = await ingestionFailure(request());
  assert.equal(ingestionFailureResponse.status, 500);
  assert.deepEqual(await json(ingestionFailureResponse), { error: "Webhook ingestion unavailable." });

  const missingSecret = createResendOutreachWebhookHandler({ getWebhookSecret: () => "", verify: () => normalizedEvent, ingest: async () => { throw new Error("must not ingest"); }, processComplaint: async () => ({ disposition: "not_applicable" }), processPermanentBounce: async () => ({ disposition: "not_applicable" }) });
  const missingSecretResponse = await missingSecret(request());
  assert.equal(missingSecretResponse.status, 500);
  assert.deepEqual(await json(missingSecretResponse), { error: "Webhook unavailable." });

  console.log("PASS — Resend outreach webhook route smoke");
}

void main();
