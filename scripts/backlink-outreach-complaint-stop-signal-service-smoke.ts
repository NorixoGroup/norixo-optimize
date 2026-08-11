import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import type { BacklinkOutreachDeliveryEventRow } from "../lib/backlinks/repositories/outreachDeliveryEventsRepository";
import { createBacklinkOutreachComplaintStopSignalService } from "../lib/backlinks/services/outreachComplaintStopSignalService";

function event(eventType: BacklinkOutreachDeliveryEventRow["event_type"]): BacklinkOutreachDeliveryEventRow {
  return {
    id: "delivery-event-1", workspace_id: "workspace-1", outreach_id: "outreach-1", attempt_id: "attempt-1", provider: "resend", provider_event_id: "provider-event-1", provider_message_id: "provider-message-1", event_type: eventType, bounce_type: null, occurred_at: "2026-08-11T10:00:00.000Z", received_at: "2026-08-11T11:00:00.000Z", created_at: "2026-08-11T11:00:00.000Z",
  };
}

async function main() {
  const source = readFileSync(new URL("../lib/backlinks/services/outreachComplaintStopSignalService.ts", import.meta.url), "utf8");
  for (const forbidden of ['.from("backlink_contacts")', '.from("backlink_outreach")', '.from("backlink_outreach_attempts")', "outreachEmailProvider", "outreachEmailSendService", "sendTransactionalEmail", "from \"resend\"", "scheduler", "follow_up", "email.bounced"]) {
    assert(!source.includes(forbidden), `Complaint processor must not use ${forbidden}`);
  }

  const calls: Array<{ deliveryEventId: string; appliedAt: string }> = [];
  const appliedService = createBacklinkOutreachComplaintStopSignalService({
    applyProviderComplaint: async (input) => {
      calls.push(input);
      return { disposition: "applied", deliveryEventId: input.deliveryEventId, outreachId: "outreach-1", contactId: "contact-1", contactStatus: "do_not_contact", outreachStatus: "closed", appliedAt: input.appliedAt };
    },
    now: () => "2026-08-11T12:00:00.000Z",
  });
  assert.deepEqual(await appliedService(event("email.complained")), { disposition: "applied", deliveryEventId: "delivery-event-1", outreachId: "outreach-1", contactId: "contact-1" });
  assert.deepEqual(calls, [{ deliveryEventId: "delivery-event-1", appliedAt: "2026-08-11T12:00:00.000Z" }]);

  const existingService = createBacklinkOutreachComplaintStopSignalService({
    applyProviderComplaint: async (input) => ({ disposition: "existing", deliveryEventId: input.deliveryEventId, outreachId: "outreach-1", contactId: "contact-1", contactStatus: "do_not_contact", outreachStatus: "closed", appliedAt: input.appliedAt }),
    now: () => "2026-08-11T13:00:00.000Z",
  });
  assert.equal((await existingService(event("email.complained"))).disposition, "existing");

  let nonComplaintCalls = 0;
  const nonComplaintService = createBacklinkOutreachComplaintStopSignalService({
    applyProviderComplaint: async () => { nonComplaintCalls += 1; throw new Error("must not call RPC"); },
    now: () => "unused",
  });
  for (const eventType of ["email.delivered", "email.delivery_delayed", "email.bounced"] as const) {
    assert.deepEqual(await nonComplaintService(event(eventType)), { disposition: "not_applicable" });
  }
  assert.equal(nonComplaintCalls, 0);

  console.log("PASS — Backlink outreach complaint stop-signal service smoke");
}

void main();
