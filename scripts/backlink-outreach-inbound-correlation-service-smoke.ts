import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import { correlateBacklinkInboundReply } from "../lib/backlinks/services/outreachInboundCorrelationService";
import { hashBacklinkOutreachReplyToken } from "../lib/backlinks/services/outreachReplyCorrelationIdentity";

const token = "123e4567-e89b-42d3-a456-426614174000";
const secondToken = "123e4567-e89b-42d3-a456-426614174001";

async function main() {
  const source = readFileSync(new URL("../lib/backlinks/services/outreachInboundCorrelationService.ts", import.meta.url), "utf8");
  for (const forbidden of ["rfc_headers", "outreachLifecycleService", "outreachEmailSendService", "sendTransactionalEmail", "outreachEmailProvider", "createBacklink", ".update("]) {
    assert(!source.includes(forbidden), `Correlation must not use ${forbidden}.`);
  }

  let lookups = 0;
  let attempt: { id: string; workspace_id: string; outreach_id: string } | null = { id: "attempt-1", workspace_id: "workspace-1", outreach_id: "outreach-1" };
  let contactStatus = "do_not_contact";
  let outreachStatus = "closed";
  const correlate = correlateBacklinkInboundReply({
    getAttemptByReplyTokenHash: async (value) => { lookups += 1; assert.equal(value, hashBacklinkOutreachReplyToken(token)); return attempt; },
    getOutreach: async (workspaceId, outreachId) => ({ id: outreachId, workspace_id: workspaceId, contact_id: "contact-1", status: outreachStatus }),
    getContact: async (workspaceId, contactId) => ({ id: contactId, workspace_id: workspaceId, email_normalized: "person@example.com", contact_status: contactStatus }),
  });

  assert.deepEqual(await correlate({ sender: "person@example.com", tokenCandidates: [token], autoReply: { isAutoReply: true } }), { status: "ignored", method: null });
  assert.equal(lookups, 0, "Auto-replies must not look up an Attempt.");
  assert.deepEqual(await correlate({ sender: "person@example.com", tokenCandidates: [], autoReply: { isAutoReply: false } }), { status: "unmatched", method: null });
  assert.deepEqual(await correlate({ sender: "person@example.com", tokenCandidates: [token, secondToken], autoReply: { isAutoReply: false } }), { status: "ambiguous", method: null });
  assert.deepEqual(await correlate({ sender: "person@example.com", tokenCandidates: [token, token], autoReply: { isAutoReply: false } }), { status: "correlated", method: "reply_token", workspaceId: "workspace-1", outreachId: "outreach-1", attemptId: "attempt-1", contactId: "contact-1" });
  assert.equal(lookups, 1, "Duplicate token candidates must be de-duplicated before lookup.");
  attempt = null;
  assert.deepEqual(await correlate({ sender: "person@example.com", tokenCandidates: [token], autoReply: { isAutoReply: false } }), { status: "unmatched", method: null });
  attempt = { id: "attempt-1", workspace_id: "workspace-1", outreach_id: "outreach-1" };
  assert.deepEqual(await correlate({ sender: "other@example.com", tokenCandidates: [token], autoReply: { isAutoReply: false } }), { status: "ambiguous", method: null });
  contactStatus = "archived";
  outreachStatus = "declined";
  const terminal = await correlate({ sender: "person@example.com", tokenCandidates: [token], autoReply: { isAutoReply: false } });
  assert.equal(terminal.status, "correlated", "Strong identity must correlate archived/DNC contacts and terminal Outreach records without lifecycle effects.");
  console.log("PASS — Backlink outreach inbound correlation service smoke");
}

void main();
