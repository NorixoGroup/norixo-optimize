import { strict as assert } from "node:assert";

import { createResendOutreachWebhookHandler } from "../app/api/webhooks/resend/outreach/route";
import type { BacklinkOutreachDeliveryEventRow } from "../lib/backlinks/repositories/outreachDeliveryEventsRepository";
import type { OutreachDeliveryEventIngestionResult } from "../lib/backlinks/services/outreachDeliveryEventIngestionService";

const request = () => new Request("https://norixo.test/api/webhooks/resend/outreach", { method: "POST", headers: { "svix-id": "provider-event-1", "svix-timestamp": "1723366800", "svix-signature": "signature-1" }, body: "{}" });
const complaintPayload = () => ({ type: "email.complained", created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1" } });
const deliveryEvent: BacklinkOutreachDeliveryEventRow = { id: "delivery-event-1", workspace_id: "workspace-1", outreach_id: "outreach-1", attempt_id: "attempt-1", provider: "resend", provider_event_id: "provider-event-1", provider_message_id: "message-1", event_type: "email.complained", bounce_type: null, occurred_at: "2026-08-11T10:00:00.000Z", received_at: "2026-08-11T11:00:00.000Z", created_at: "2026-08-11T11:00:00.000Z" };

async function main() {
  let persisted = false;
  let processorCalls = 0;
  let processorFailure = true;
  const route = createResendOutreachWebhookHandler({
    getWebhookSecret: () => "whsec_test",
    verify: () => complaintPayload(),
    ingest: async (): Promise<OutreachDeliveryEventIngestionResult> => {
      const disposition = persisted ? "existing" : "created";
      persisted = true;
      return { disposition, deliveryEvent, eventId: deliveryEvent.id, outreachId: deliveryEvent.outreach_id, attemptId: deliveryEvent.attempt_id, eventType: "email.complained" };
    },
    processComplaint: async (event) => {
      processorCalls += 1;
      assert.equal(event.id, deliveryEvent.id);
      if (processorFailure) throw new Error("simulated processor failure");
      return { disposition: processorCalls === 2 ? "applied" : "existing", deliveryEventId: event.id, outreachId: event.outreach_id, contactId: "contact-1" };
    },
    processPermanentBounce: async () => ({ disposition: "not_applicable" }),
  });

  const first = await route(request());
  assert.equal(first.status, 500);
  assert.equal(persisted, true);
  processorFailure = false;
  const second = await route(request());
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { ok: true, disposition: "existing", effectDisposition: "applied" });
  const third = await route(request());
  assert.equal(third.status, 200);
  assert.deepEqual(await third.json(), { ok: true, disposition: "existing", effectDisposition: "existing" });
  assert.equal(processorCalls, 3);

  for (const eventType of ["email.delivered", "email.delivery_delayed", "email.bounced"] as const) {
    let effects = 0;
    const nonComplaint = createResendOutreachWebhookHandler({
      getWebhookSecret: () => "whsec_test",
      verify: () => ({ type: eventType, created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1" } }),
      ingest: async () => ({ disposition: "created", deliveryEvent: { ...deliveryEvent, event_type: eventType }, eventId: deliveryEvent.id, outreachId: deliveryEvent.outreach_id, attemptId: deliveryEvent.attempt_id, eventType }),
      processComplaint: async () => { effects += 1; return { disposition: "not_applicable" }; },
      processPermanentBounce: async () => ({ disposition: "not_applicable" }),
    });
    assert.equal((await nonComplaint(request())).status, 200);
    assert.equal(effects, 1);
  }

  for (const disposition of ["ignored", "unmatched"] as const) {
    let processorCallsForUncorrelatedEvent = 0;
    const uncorrelated = createResendOutreachWebhookHandler({
      getWebhookSecret: () => "whsec_test",
      verify: () => complaintPayload(),
      ingest: async () => ({ disposition, eventType: "email.complained" }),
      processComplaint: async () => { processorCallsForUncorrelatedEvent += 1; return { disposition: "not_applicable" }; },
      processPermanentBounce: async () => ({ disposition: "not_applicable" }),
    });
    assert.equal((await uncorrelated(request())).status, 200);
    assert.equal(processorCallsForUncorrelatedEvent, 0);
  }

  console.log("PASS — Backlink outreach complaint webhook integration smoke");
}

void main();
