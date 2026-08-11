import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import type { BacklinkOutreachDeliveryEventRow } from "../lib/backlinks/repositories/outreachDeliveryEventsRepository";
import { createBacklinkOutreachPermanentBounceStopSignalService } from "../lib/backlinks/services/outreachPermanentBounceStopSignalService";

function event(eventType: BacklinkOutreachDeliveryEventRow["event_type"], bounceType: string | null): BacklinkOutreachDeliveryEventRow {
  return { id: "delivery-event-1", workspace_id: "workspace-1", outreach_id: "outreach-1", attempt_id: "attempt-1", provider: "resend", provider_event_id: "provider-event-1", provider_message_id: "message-1", event_type: eventType, bounce_type: bounceType, occurred_at: "2026-08-11T10:00:00.000Z", received_at: "2026-08-11T11:00:00.000Z", created_at: "2026-08-11T11:00:00.000Z" };
}

async function main() {
  const source = readFileSync(new URL("../lib/backlinks/services/outreachPermanentBounceStopSignalService.ts", import.meta.url), "utf8");
  for (const forbidden of ['.from("backlink_contacts")', '.from("backlink_outreach")', '.from("backlink_outreach_attempts")', '.from("backlink_outreach_delivery_effects")', "outreachAttemptsRepository", "outreachAttemptService", "outreachEmailProvider", "outreachEmailSendService", "sendTransactionalEmail", "from \"resend\"", "scheduler", "follow_up"]) assert(!source.includes(forbidden), `Permanent bounce processor must not use ${forbidden}`);

  const calls: Array<{ deliveryEventId: string; appliedAt: string }> = [];
  const appliedService = createBacklinkOutreachPermanentBounceStopSignalService({
    applyPermanentBounce: async (input) => { calls.push(input); return { disposition: "applied", deliveryEventId: input.deliveryEventId, outreachId: "outreach-1", contactId: "contact-1", contactStatus: "do_not_contact", outreachStatus: "closed", appliedAt: input.appliedAt }; },
    now: () => "2026-08-11T12:00:00.000Z",
  });
  assert.deepEqual(await appliedService(event("email.bounced", "permanent")), { disposition: "applied", deliveryEventId: "delivery-event-1", outreachId: "outreach-1", contactId: "contact-1" });
  assert.deepEqual(calls, [{ deliveryEventId: "delivery-event-1", appliedAt: "2026-08-11T12:00:00.000Z" }]);

  const existingService = createBacklinkOutreachPermanentBounceStopSignalService({
    applyPermanentBounce: async (input) => ({ disposition: "existing", deliveryEventId: input.deliveryEventId, outreachId: "outreach-1", contactId: "contact-1", contactStatus: "do_not_contact", outreachStatus: "closed", appliedAt: input.appliedAt }),
    now: () => "2026-08-11T13:00:00.000Z",
  });
  assert.equal((await existingService(event("email.bounced", "permanent"))).disposition, "existing");

  let nonApplicableCalls = 0;
  const nonApplicableService = createBacklinkOutreachPermanentBounceStopSignalService({ applyPermanentBounce: async () => { nonApplicableCalls += 1; throw new Error("must not call RPC"); } });
  for (const item of [event("email.bounced", "transient"), event("email.bounced", "undetermined"), event("email.bounced", "unknown"), event("email.bounced", null), event("email.delivered", null), event("email.delivery_delayed", null), event("email.complained", null)]) assert.deepEqual(await nonApplicableService(item), { disposition: "not_applicable" });
  assert.equal(nonApplicableCalls, 0);

  console.log("PASS — Backlink outreach permanent bounce stop-signal service smoke");
}

void main();
