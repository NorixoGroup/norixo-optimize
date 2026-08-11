import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

async function main() {
  const source = readFileSync(new URL("../lib/backlinks/repositories/outreachInboundMessagesRepository.ts", import.meta.url), "utf8");
  for (const fragment of [
    'export type BacklinkOutreachInboundCorrelationStatus = "correlated" | "unmatched" | "ambiguous" | "ignored"',
    "getBacklinkOutreachInboundMessageByProviderEventId",
    '.from("backlink_outreach_inbound_messages")',
    '.eq("provider", normalizedProvider)',
    '.eq("provider_event_id", required(operation, providerEventId, "providerEventId"))',
    "workspace_id: input.workspaceId",
    "outreach_id: input.outreachId",
    "attempt_id: input.attemptId",
    "contact_id: input.contactId",
    "correlation_status: input.correlationStatus",
    "correlation_method: input.correlationMethod",
    "received_at: required(operation, input.receivedAt, \"receivedAt\")",
    "occurred_at: required(operation, input.occurredAt, \"occurredAt\")",
    'normalized.code !== "CONFLICT"',
    'disposition: "existing"',
  ]) assert(source.includes(fragment), `Inbound-message repository must include ${fragment}.`);
  for (const forbidden of [".update(", "html", "raw_headers", "attachments", "outreachLifecycleService", "outreachEmailSendService", "sendTransactionalEmail", "from \"resend\""]) {
    assert(!source.includes(forbidden), `Inbound-message repository must not use ${forbidden}.`);
  }
  console.log("PASS — Backlink outreach inbound messages repository smoke");
}

void main();
