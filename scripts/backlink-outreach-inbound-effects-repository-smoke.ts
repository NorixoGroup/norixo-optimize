import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import { applyBacklinkOutreachInboundReplyStop, type ApplyBacklinkOutreachInboundReplyStopRpcClient } from "../lib/backlinks/repositories/outreachInboundEffectsRepository";

function rpcClient(disposition: "applied" | "existing", error: unknown = null): ApplyBacklinkOutreachInboundReplyStopRpcClient {
  return {
    rpc: async (name, args) => {
      assert.equal(name, "apply_backlink_outreach_inbound_reply_stop");
      assert.deepEqual(args, { p_inbound_message_id: "inbound-1", p_applied_at: "2026-08-11T15:00:00.000Z" });
      return {
        data: error == null ? [{ disposition, inbound_message_id: "inbound-1", outreach_id: "outreach-1", contact_id: "contact-1", outreach_status: "closed", applied_at: "2026-08-11T15:00:00.000Z" }] : null,
        error,
      };
    },
  };
}

async function main() {
  const source = readFileSync(new URL("../lib/backlinks/repositories/outreachInboundEffectsRepository.ts", import.meta.url), "utf8");
  for (const forbidden of ['.from("backlink_outreach")', '.from("backlink_contacts")', '.from("backlink_outreach_attempts")', '.from("backlink_outreach_inbound_effects")', ".insert(", ".update(", ".delete(", "outreachEmailProvider", "outreachEmailSendService", "sendTransactionalEmail"]) {
    assert(!source.includes(forbidden), `Inbound Effect repository must not use ${forbidden}`);
  }
  const input = { inboundMessageId: "inbound-1", appliedAt: "2026-08-11T15:00:00.000Z" };
  assert.deepEqual(await applyBacklinkOutreachInboundReplyStop(rpcClient("applied"), input), { disposition: "applied", inboundMessageId: "inbound-1", outreachId: "outreach-1", contactId: "contact-1", outreachStatus: "closed", appliedAt: "2026-08-11T15:00:00.000Z" });
  assert.equal((await applyBacklinkOutreachInboundReplyStop(rpcClient("existing"), input)).disposition, "existing");
  await assert.rejects(() => applyBacklinkOutreachInboundReplyStop(rpcClient("applied", { code: "P0001", message: "BACKLINK_OUTREACH_INBOUND_REPLY_SOURCE_INVALID" }), input), { code: "VALIDATION" });
  await assert.rejects(() => applyBacklinkOutreachInboundReplyStop(rpcClient("applied", { code: "P0001", message: "BACKLINK_OUTREACH_INBOUND_REPLY_MESSAGE_NOT_FOUND" }), input), { code: "NOT_FOUND" });
  console.log("PASS — Backlink outreach inbound effects repository smoke");
}

void main();
