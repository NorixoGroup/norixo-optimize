import { strict as assert } from "node:assert";

import { detectInboundAutoReply, extractBacklinkOutreachReplyToken, extractBacklinkOutreachReplyTokens, normalizeInboundEmailAddress, normalizeInReplyTo, normalizeMessageId, normalizeReferences } from "../lib/backlinks/providers/resendInboundEmailNormalization";

function main() {
  const token = "550e8400-e29b-41d4-a716-446655440000";
  assert.equal(extractBacklinkOutreachReplyToken(`reply+${token}@inbound.norixo.io`, "inbound.norixo.io"), token);
  assert.equal(extractBacklinkOutreachReplyToken(`reply+${token}@other.norixo.io`, "inbound.norixo.io"), null);
  assert.equal(extractBacklinkOutreachReplyToken("reply+not-a-uuid@inbound.norixo.io", "inbound.norixo.io"), null);
  assert.deepEqual(extractBacklinkOutreachReplyTokens([`reply+${token}@inbound.norixo.io`, `reply+${token}@inbound.norixo.io`], "inbound.norixo.io"), [token]);
  assert.deepEqual(extractBacklinkOutreachReplyTokens([`reply+${token}@inbound.norixo.io`, "reply+550e8400-e29b-41d4-a716-446655440001@inbound.norixo.io"], "inbound.norixo.io"), [token, "550e8400-e29b-41d4-a716-446655440001"]);
  assert.equal(normalizeInboundEmailAddress("Name <SENDER@example.com>"), "sender@example.com");
  assert.equal(normalizeMessageId(" <message@example.com> "), "<message@example.com>");
  assert.deepEqual(normalizeInReplyTo("<one@example.com> <two@example.com>"), ["<one@example.com>", "<two@example.com>"]);
  assert.deepEqual(normalizeReferences("<one@example.com> <one@example.com> <two@example.com>"), ["<one@example.com>", "<two@example.com>"]);
  assert.deepEqual(detectInboundAutoReply({ sender: "human@example.com", autoSubmitted: "auto-replied", precedence: null, xAutoreply: null }), { isAutoReply: true, reason: "auto_submitted" });
  assert.deepEqual(detectInboundAutoReply({ sender: "human@example.com", autoSubmitted: "no", precedence: "bulk", xAutoreply: null }), { isAutoReply: true, reason: "precedence" });
  assert.deepEqual(detectInboundAutoReply({ sender: "human@example.com", autoSubmitted: "no", precedence: null, xAutoreply: "yes" }), { isAutoReply: true, reason: "x_autoreply" });
  assert.deepEqual(detectInboundAutoReply({ sender: "mailer-daemon@example.com", autoSubmitted: null, precedence: null, xAutoreply: null }), { isAutoReply: true, reason: "mailer_daemon" });
  assert.deepEqual(detectInboundAutoReply({ sender: "postmaster@example.com", autoSubmitted: null, precedence: null, xAutoreply: null }), { isAutoReply: true, reason: "postmaster" });
  assert.deepEqual(detectInboundAutoReply({ sender: "human@example.com", autoSubmitted: "no", precedence: null, xAutoreply: null }), { isAutoReply: false, reason: null });
  console.log("PASS — Resend inbound normalization smoke");
}

main();
