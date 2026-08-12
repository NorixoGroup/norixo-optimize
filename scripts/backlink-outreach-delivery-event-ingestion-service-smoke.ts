import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import { createBacklinkOutreachDeliveryEventIngestionService } from "../lib/backlinks/services/outreachDeliveryEventIngestionService";
import type { BacklinkOutreachDeliveryEventRow, CreateBacklinkOutreachDeliveryEventInput } from "../lib/backlinks/repositories/outreachDeliveryEventsRepository";
import type { BacklinkOutreachAttemptRow } from "../lib/backlinks/repositories/outreachAttemptsRepository";
import type { ResendOutreachWebhookResult } from "../lib/backlinks/providers/resendWebhookAdapter";

const attempt: BacklinkOutreachAttemptRow = {
  id: "attempt-1", workspace_id: "workspace-1", outreach_id: "outreach-1", actor_user_id: "actor-1", attempt_kind: "initial", cancel_reason: null, cancelled_at: null, channel: "email", provider: "resend", recipient: "recipient@example.com", idempotency_key: "key-1", reply_token_hash: null, reply_token_key_version: null, status: "accepted", provider_message_id: "message-1", prepared_at: null, error_code: null, error_message: null, requested_at: "2026-08-11T09:00:00.000Z", accepted_at: "2026-08-11T09:00:01.000Z", failed_at: null, resolved_at: "2026-08-11T09:00:00.000Z", created_at: "2026-08-11T09:00:00.000Z",
};

const supported = (eventType: "email.delivered" | "email.delivery_delayed" | "email.bounced" | "email.complained", bounceType: "permanent" | "transient" | "undetermined" | "unknown" = "permanent"): ResendOutreachWebhookResult => eventType === "email.bounced"
  ? { disposition: "normalized", provider: "resend", providerEventId: `event-${eventType}-${bounceType}`, providerMessageId: "message-1", eventType, occurredAt: "2026-08-11T10:00:00.000Z", bounceType }
  : { disposition: "normalized", provider: "resend", providerEventId: `event-${eventType}`, providerMessageId: "message-1", eventType, occurredAt: "2026-08-11T10:00:00.000Z" };
const deliveryEvent = (id: string, eventType: BacklinkOutreachDeliveryEventRow["event_type"], bounceType: string | null): BacklinkOutreachDeliveryEventRow => ({ id, workspace_id: "workspace-1", outreach_id: "outreach-1", attempt_id: "attempt-1", provider: "resend", provider_event_id: `provider-event-${id}`, provider_message_id: "message-1", event_type: eventType, bounce_type: bounceType, occurred_at: "2026-08-11T10:00:00.000Z", received_at: "2026-08-11T11:00:00.000Z", created_at: "2026-08-11T11:00:00.000Z" });

async function main() {
  const source = readFileSync(new URL("../lib/backlinks/services/outreachDeliveryEventIngestionService.ts", import.meta.url), "utf8");
  for (const forbidden of ["updateBacklinkOutreach", "outreachLifecycleService", "outreachAttemptService", "updateBacklinkOutreachAttemptState", "outreachEmailProvider", "outreachEmailSendService", "sendTransactionalEmail", "from \"resend\"", "scheduler", "follow_up"]) {
    assert(!source.includes(forbidden), `Ingestion service must not use ${forbidden}`);
  }

  let lookups = 0;
  let creates: CreateBacklinkOutreachDeliveryEventInput[] = [];
  const eventsByProviderEventId = new Map<string, BacklinkOutreachDeliveryEventRow>();
  const service = createBacklinkOutreachDeliveryEventIngestionService({
    getAttemptByProviderMessageId: async (provider, messageId) => { lookups += 1; assert.equal(provider, "resend"); assert.equal(messageId, "message-1"); return attempt; },
    createDeliveryEvent: async (input) => {
      creates.push(input);
      const existing = eventsByProviderEventId.get(input.providerEventId);
      if (existing != null) return { disposition: "existing", event: existing };
      const event = deliveryEvent(`delivery-${creates.length}`, input.eventType, input.bounceType);
      eventsByProviderEventId.set(input.providerEventId, event);
      return { disposition: "created", event };
    },
    now: () => "2026-08-11T11:00:00.000Z",
  });

  const ignored = await service({ disposition: "ignored", eventType: "email.opened" });
  assert.deepEqual(ignored, { disposition: "ignored", eventType: "email.opened" });
  assert.equal(lookups, 0); assert.equal(creates.length, 0);

  for (const eventType of ["email.delivered", "email.delivery_delayed", "email.bounced", "email.complained"] as const) {
    const result = await service(supported(eventType));
    assert.equal(result.disposition, "created");
    assert.equal(result.eventType, eventType);
    assert.equal(result.outreachId, attempt.outreach_id);
    assert.equal(result.attemptId, attempt.id);
  }
  const first = creates[0];
  assert.deepEqual(first, { workspaceId: attempt.workspace_id, outreachId: attempt.outreach_id, attemptId: attempt.id, provider: "resend", providerEventId: "event-email.delivered", providerMessageId: "message-1", eventType: "email.delivered", bounceType: null, occurredAt: "2026-08-11T10:00:00.000Z", receivedAt: "2026-08-11T11:00:00.000Z" });
  for (const bounceType of ["transient", "undetermined", "unknown"] as const) {
    const result = await service(supported("email.bounced", bounceType));
    assert.equal(result.disposition, "created");
    assert.equal(result.deliveryEvent.bounce_type, bounceType);
    assert.equal(creates.at(-1)?.bounceType, bounceType);
  }
  const permanent = creates.find((item) => item.eventType === "email.bounced" && item.bounceType === "permanent");
  assert(permanent != null, "Permanent bounce classification must be persisted.");
  const duplicate = await service(supported("email.delivered"));
  assert.equal(duplicate.disposition, "existing");

  let unmatchedCreates = 0;
  const unmatchedService = createBacklinkOutreachDeliveryEventIngestionService({ getAttemptByProviderMessageId: async () => null, createDeliveryEvent: async () => { unmatchedCreates += 1; throw new Error("must not insert"); }, now: () => "unused" });
  const unmatched = await unmatchedService(supported("email.delivered"));
  assert.deepEqual(unmatched, { disposition: "unmatched", eventType: "email.delivered" });
  assert.equal(unmatchedCreates, 0);

  const lookupFailure = new Error("lookup failure");
  const failingLookup = createBacklinkOutreachDeliveryEventIngestionService({ getAttemptByProviderMessageId: async () => { throw lookupFailure; }, createDeliveryEvent: async () => { throw new Error("must not insert"); }, now: () => "unused" });
  await assert.rejects(() => failingLookup(supported("email.delivered")), lookupFailure);
  const createFailure = new Error("create failure");
  const failingCreate = createBacklinkOutreachDeliveryEventIngestionService({ getAttemptByProviderMessageId: async () => attempt, createDeliveryEvent: async () => { throw createFailure; }, now: () => "unused" });
  await assert.rejects(() => failingCreate(supported("email.delivered")), createFailure);

  console.log("PASS — Backlink outreach delivery event ingestion service smoke");
}

void main();
