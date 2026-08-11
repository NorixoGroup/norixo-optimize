import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import type { BacklinkOutreachInboundMessageRow, CreateBacklinkOutreachInboundMessageInput } from "../lib/backlinks/repositories/outreachInboundMessagesRepository";
import { ingestBacklinkInboundMessage } from "../lib/backlinks/services/outreachInboundMessageIngestionService";

function row(input: CreateBacklinkOutreachInboundMessageInput): BacklinkOutreachInboundMessageRow {
  return { id: "inbound-1", workspace_id: input.workspaceId, outreach_id: input.outreachId, attempt_id: input.attemptId, contact_id: input.contactId, provider: input.provider, provider_event_id: input.providerEventId, inbound_message_id: input.inboundMessageId, correlation_status: input.correlationStatus, correlation_method: input.correlationMethod, sender: input.sender, recipient: input.recipient, subject: input.subject, text_body: input.textBody, in_reply_to: input.inReplyTo, references_header: input.referencesHeader, received_at: input.receivedAt, occurred_at: input.occurredAt, created_at: "2026-08-11T12:00:01.000Z" };
}

async function main() {
  const source = readFileSync(new URL("../lib/backlinks/services/outreachInboundMessageIngestionService.ts", import.meta.url), "utf8");
  for (const forbidden of ["outreachLifecycleService", "outreachEmailSendService", "sendTransactionalEmail", "outreachEmailProvider", "createBacklinkContact", "createBacklinkOutreach", "next_follow_up", ".update("]) {
    assert(!source.includes(forbidden), `Inbound ingestion must not use ${forbidden}.`);
  }

  const correlated = { status: "correlated" as const, method: "reply_token" as const, workspaceId: "workspace-1", outreachId: "outreach-1", attemptId: "attempt-1", contactId: "contact-1" };
  const nonCorrelated = (status: "unmatched" | "ambiguous" | "ignored") => ({ status, method: null });
  let mode: "correlated" | "unmatched" | "ambiguous" | "ignored" = "correlated";
  let createCalls: CreateBacklinkOutreachInboundMessageInput[] = [];
  const canonical = new Map<string, BacklinkOutreachInboundMessageRow>();
  const ingest = ingestBacklinkInboundMessage({
    correlate: async (input) => {
      if (mode === "ignored") assert(input.autoReply.isAutoReply, "Ignored correlation must be driven by auto-reply metadata.");
      return mode === "correlated" ? correlated : nonCorrelated(mode);
    },
    createInboundMessage: async (input) => {
      createCalls.push(input);
      const existing = canonical.get(input.providerEventId);
      if (existing != null) return { disposition: "existing", message: existing };
      const created = row(input);
      canonical.set(input.providerEventId, created);
      return { disposition: "created", message: created };
    },
    now: () => "2026-08-11T12:00:00.000Z",
  });
  const input = { webhook: { provider: "resend" as const, providerEventId: "event-1", inboundMessageId: "message-1", sender: "person@example.com", recipients: ["other@example.com", "reply+123e4567-e89b-42d3-a456-426614174000@replies.example.com"], subject: "Reply", occurredAt: "2026-08-11T11:59:00.000Z" }, content: { textBody: "Hello", inReplyTo: ["<one@example.com>"], references: ["<one@example.com>", "<two@example.com>"], autoReply: { isAutoReply: false } }, inboundReplyDomain: "replies.example.com" };
  const created = await ingest(input);
  assert.equal(created.disposition, "created");
  assert.equal(created.correlationStatus, "correlated");
  assert.deepEqual(createCalls[0], { workspaceId: "workspace-1", outreachId: "outreach-1", attemptId: "attempt-1", contactId: "contact-1", provider: "resend", providerEventId: "event-1", inboundMessageId: "message-1", correlationStatus: "correlated", correlationMethod: "reply_token", sender: "person@example.com", recipient: "reply+123e4567-e89b-42d3-a456-426614174000@replies.example.com", subject: "Reply", textBody: "Hello", inReplyTo: "<one@example.com>", referencesHeader: "<one@example.com> <two@example.com>", receivedAt: "2026-08-11T12:00:00.000Z", occurredAt: "2026-08-11T11:59:00.000Z" });
  for (const next of ["unmatched", "ambiguous", "ignored"] as const) {
    mode = next;
    const result = await ingest({ ...input, webhook: { ...input.webhook, providerEventId: `event-${next}` }, content: { ...input.content, autoReply: { isAutoReply: next === "ignored" } } });
    assert.equal(result.correlationStatus, next);
    const persisted = createCalls.at(-1);
    assert(persisted != null);
    assert.equal(persisted.workspaceId, null); assert.equal(persisted.outreachId, null); assert.equal(persisted.attemptId, null); assert.equal(persisted.contactId, null); assert.equal(persisted.correlationMethod, null);
  }
  mode = "correlated";
  const duplicate = await ingest(input);
  assert.equal(duplicate.disposition, "existing");
  assert.equal(duplicate.message.text_body, "Hello", "The first append-only row remains canonical on duplicate delivery.");
  console.log("PASS — Backlink outreach inbound message ingestion service smoke");
}

void main();
