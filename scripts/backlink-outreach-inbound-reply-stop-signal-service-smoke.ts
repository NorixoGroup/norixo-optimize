import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import type { BacklinkOutreachInboundMessageRow } from "../lib/backlinks/repositories/outreachInboundMessagesRepository";
import { createBacklinkOutreachInboundReplyStopSignalService } from "../lib/backlinks/services/outreachInboundReplyStopSignalService";

function inbound(correlationStatus: BacklinkOutreachInboundMessageRow["correlation_status"], correlationMethod: BacklinkOutreachInboundMessageRow["correlation_method"]): BacklinkOutreachInboundMessageRow {
  const correlated = correlationStatus === "correlated";
  return { id: "inbound-1", workspace_id: correlated ? "workspace-1" : null, outreach_id: correlated ? "outreach-1" : null, attempt_id: correlated ? "attempt-1" : null, contact_id: correlated ? "contact-1" : null, provider: "resend", provider_event_id: "event-1", inbound_message_id: "message-1", correlation_status: correlationStatus, correlation_method: correlationMethod, sender: "person@example.com", recipient: "reply+token@example.com", subject: null, text_body: null, in_reply_to: null, references_header: null, received_at: "2026-08-11T14:00:00.000Z", occurred_at: "2026-08-11T13:00:00.000Z", created_at: "2026-08-11T14:00:00.000Z" };
}

async function main() {
  const source = readFileSync(new URL("../lib/backlinks/services/outreachInboundReplyStopSignalService.ts", import.meta.url), "utf8");
  for (const forbidden of ['.from("backlink_outreach")', '.from("backlink_contacts")', '.from("backlink_outreach_attempts")', '.from("backlink_outreach_inbound_effects")', "updateBacklinkOutreach", "outreachLifecycleService", "outreachAttemptService", "updateBacklinkOutreachAttemptState", "outreachEmailProvider", "outreachEmailSendService", "sendTransactionalEmail", "from \"resend\"", "scheduler", "classification"]) {
    assert(!source.includes(forbidden), `Inbound reply stop processor must not use ${forbidden}`);
  }
  const calls: Array<{ inboundMessageId: string; appliedAt: string }> = [];
  const service = createBacklinkOutreachInboundReplyStopSignalService({
    applyInboundReplyStop: async (input) => { calls.push(input); return { disposition: "applied", inboundMessageId: input.inboundMessageId, outreachId: "outreach-1", contactId: "contact-1", outreachStatus: "closed", appliedAt: input.appliedAt }; },
    now: () => "2026-08-11T15:00:00.000Z",
  });
  assert.deepEqual(await service(inbound("correlated", "reply_token")), { disposition: "applied", inboundMessageId: "inbound-1", outreachId: "outreach-1", contactId: "contact-1" });
  assert.deepEqual(calls, [{ inboundMessageId: "inbound-1", appliedAt: "2026-08-11T15:00:00.000Z" }]);
  const existingService = createBacklinkOutreachInboundReplyStopSignalService({
    applyInboundReplyStop: async (input) => ({ disposition: "existing", inboundMessageId: input.inboundMessageId, outreachId: "outreach-1", contactId: "contact-1", outreachStatus: "closed", appliedAt: input.appliedAt }),
    now: () => "2026-08-11T16:00:00.000Z",
  });
  assert.equal((await existingService(inbound("correlated", "reply_token"))).disposition, "existing", "Existing inbound rows must reconcile through the RPC.");
  let nonApplicableCalls = 0;
  const nonApplicableService = createBacklinkOutreachInboundReplyStopSignalService({
    applyInboundReplyStop: async () => { nonApplicableCalls += 1; throw new Error("must not call RPC"); },
  });
  for (const row of [inbound("unmatched", null), inbound("ambiguous", null), inbound("ignored", null), inbound("correlated", "rfc_headers")]) {
    assert.deepEqual(await nonApplicableService(row), { disposition: "not_applicable" });
  }
  assert.equal(nonApplicableCalls, 0);
  console.log("PASS — Backlink outreach inbound reply stop-signal service smoke");
}

void main();
