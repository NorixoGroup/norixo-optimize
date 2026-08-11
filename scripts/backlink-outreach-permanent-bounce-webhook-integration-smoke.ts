import { strict as assert } from "node:assert";

import { createResendOutreachWebhookHandler } from "../app/api/webhooks/resend/outreach/route";
import type { BacklinkOutreachDeliveryEventRow } from "../lib/backlinks/repositories/outreachDeliveryEventsRepository";
import type { OutreachDeliveryEventIngestionResult } from "../lib/backlinks/services/outreachDeliveryEventIngestionService";

const request = () => new Request("https://norixo.test/api/webhooks/resend/outreach", { method: "POST", headers: { "svix-id": "provider-event-1", "svix-timestamp": "1723366800", "svix-signature": "signature-1" }, body: "{}" });

function deliveryEvent(bounceType: string | null): BacklinkOutreachDeliveryEventRow {
  return { id: "delivery-event-1", workspace_id: "workspace-1", outreach_id: "outreach-1", attempt_id: "attempt-1", provider: "resend", provider_event_id: "provider-event-1", provider_message_id: "message-1", event_type: "email.bounced", bounce_type: bounceType, occurred_at: "2026-08-11T10:00:00.000Z", received_at: "2026-08-11T11:00:00.000Z", created_at: "2026-08-11T11:00:00.000Z" };
}

const permanentPayload = () => ({ type: "email.bounced", created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1", bounce: { type: "Permanent" } } });

async function main() {
  const canonicalPermanentEvent = deliveryEvent("permanent");
  let persisted = false;
  let permanentCalls = 0;
  let processorFailure = true;
  const route = createResendOutreachWebhookHandler({
    getWebhookSecret: () => "whsec_test",
    verify: () => permanentPayload(),
    ingest: async (): Promise<OutreachDeliveryEventIngestionResult> => {
      const disposition = persisted ? "existing" : "created";
      persisted = true;
      return { disposition, deliveryEvent: canonicalPermanentEvent, eventId: canonicalPermanentEvent.id, outreachId: canonicalPermanentEvent.outreach_id, attemptId: canonicalPermanentEvent.attempt_id, eventType: "email.bounced" };
    },
    processComplaint: async () => ({ disposition: "not_applicable" }),
    processPermanentBounce: async (event) => {
      permanentCalls += 1;
      assert.equal(event.bounce_type, "permanent");
      if (processorFailure) throw new Error("simulated processor failure");
      return { disposition: permanentCalls === 2 ? "applied" : "existing", deliveryEventId: event.id, outreachId: event.outreach_id, contactId: "contact-1" };
    },
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
  assert.equal(permanentCalls, 3);

  for (const bounceType of ["transient", "undetermined", "unknown", null]) {
    let permanentProcessorCalls = 0;
    const nonPermanent = createResendOutreachWebhookHandler({
      getWebhookSecret: () => "whsec_test",
      verify: () => permanentPayload(),
      ingest: async () => ({ disposition: "created", deliveryEvent: deliveryEvent(bounceType), eventId: "delivery-event-1", outreachId: "outreach-1", attemptId: "attempt-1", eventType: "email.bounced" }),
      processComplaint: async () => ({ disposition: "not_applicable" }),
      processPermanentBounce: async (event) => {
        permanentProcessorCalls += 1;
        assert.equal(event.bounce_type, bounceType);
        return { disposition: "not_applicable" };
      },
    });
    const response = await nonPermanent(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, disposition: "created" });
    assert.equal(permanentProcessorCalls, 1);
  }

  for (const eventType of ["email.delivered", "email.delivery_delayed", "email.complained"] as const) {
    let permanentProcessorCalls = 0;
    const otherEvent: BacklinkOutreachDeliveryEventRow = { ...canonicalPermanentEvent, event_type: eventType, bounce_type: null };
    const routeForOtherEvent = createResendOutreachWebhookHandler({
      getWebhookSecret: () => "whsec_test",
      verify: () => ({ type: eventType, created_at: "2026-08-11T10:00:00.000Z", data: { email_id: "message-1" } }),
      ingest: async () => ({ disposition: "created", deliveryEvent: otherEvent, eventId: otherEvent.id, outreachId: otherEvent.outreach_id, attemptId: otherEvent.attempt_id, eventType }),
      processComplaint: async () => eventType === "email.complained" ? { disposition: "applied", deliveryEventId: otherEvent.id, outreachId: otherEvent.outreach_id, contactId: "contact-1" } : { disposition: "not_applicable" },
      processPermanentBounce: async () => {
        permanentProcessorCalls += 1;
        return { disposition: "not_applicable" };
      },
    });
    const response = await routeForOtherEvent(request());
    assert.equal(response.status, 200);
    assert.equal(permanentProcessorCalls, 1);
    assert.deepEqual(await response.json(), eventType === "email.complained" ? { ok: true, disposition: "created", effectDisposition: "applied" } : { ok: true, disposition: "created" });
  }

  console.log("PASS — Backlink outreach permanent bounce webhook integration smoke");
}

void main();
