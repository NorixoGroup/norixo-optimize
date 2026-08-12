import { readFile } from "node:fs/promises";

import { BacklinkRepositoryError } from "../lib/backlinks/repositories/errors";
import { cancelBacklinkOutreachPreparedFollowUpAttempt, reserveBacklinkOutreachFollowUpAttempt, type CancelBacklinkOutreachPreparedFollowUpAttemptRpcClient, type ReserveBacklinkOutreachFollowUpAttemptRpcClient } from "../lib/backlinks/repositories/outreachAttemptsRepository";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  let calls = 0;
  const client: ReserveBacklinkOutreachFollowUpAttemptRpcClient = {
    rpc: async (name, args) => {
      calls += 1;
      assert(name === "reserve_backlink_outreach_follow_up_attempt", "Wrapper must call only the follow-up reservation RPC.");
      assert(args.p_workspace_id === "workspace" && args.p_outreach_id === "outreach", "Wrapper must pass the canonical workspace and Outreach IDs.");
      assert(args.p_attempt_id === "attempt-candidate" && args.p_actor_user_id === "actor" && args.p_idempotency_key === "key" && args.p_reply_token_hash === "a".repeat(64) && args.p_reply_token_key_version === "v1" && args.p_reserved_at === "2026-08-12T10:00:00.000Z", "Wrapper must pass only canonical RPC arguments.");
      return { data: [{ disposition: "reserved", attempt_id: "attempt", outreach_id: "outreach", attempt_status: "prepared", attempt_kind: "follow_up", prepared_at: "2026-08-12T10:00:00.000Z", requested_at: null }], error: null };
    },
  };
  const input = { workspaceId: "workspace", outreachId: "outreach", attemptId: "attempt-candidate", actorUserId: "actor", idempotencyKey: "key", replyTokenHash: "a".repeat(64), replyTokenKeyVersion: "v1", reservedAt: "2026-08-12T10:00:00.000Z" };
  const reserved = await reserveBacklinkOutreachFollowUpAttempt(client, input);
  assert(calls === 1 && reserved.disposition === "reserved" && reserved.attemptKind === "follow_up" && reserved.attemptStatus === "prepared" && reserved.preparedAt != null && reserved.requestedAt == null, "Reserved RPC result must be normalized.");

  const existingClient: ReserveBacklinkOutreachFollowUpAttemptRpcClient = { rpc: async () => ({ data: [{ disposition: "existing", attempt_id: "attempt", outreach_id: "outreach", attempt_status: "prepared", attempt_kind: "follow_up", prepared_at: "2026-08-12T10:00:00.000Z", requested_at: null }], error: null }) };
  assert((await reserveBacklinkOutreachFollowUpAttempt(existingClient, input)).disposition === "existing", "Existing RPC result must be normalized.");

  const conflictClient: ReserveBacklinkOutreachFollowUpAttemptRpcClient = { rpc: async () => ({ data: null, error: { message: "FOLLOW_UP_IDEMPOTENCY_CONFLICT" } }) };
  try { await reserveBacklinkOutreachFollowUpAttempt(conflictClient, input); throw new Error("Expected stable conflict."); } catch (error) { assert(error instanceof BacklinkRepositoryError && error.code === "CONFLICT", "Stable RPC conflicts must be normalized."); }

  const cancelClient: CancelBacklinkOutreachPreparedFollowUpAttemptRpcClient = { rpc: async (name, args) => { assert(name === "cancel_backlink_outreach_prepared_follow_up_attempt", "Cancellation must call only its dedicated RPC."); assert(args.p_workspace_id === "workspace" && args.p_outreach_id === "outreach" && args.p_attempt_id === "attempt" && args.p_cancel_reason === "admin_cancelled" && args.p_cancelled_at === "2026-08-12T10:01:00.000Z", "Cancellation must use only bounded RPC input."); return { data: [{ disposition: "cancelled", attempt_id: "attempt", outreach_id: "outreach", attempt_status: "cancelled", cancel_reason: "admin_cancelled", cancelled_at: "2026-08-12T10:01:00.000Z" }], error: null }; } };
  const cancelled = await cancelBacklinkOutreachPreparedFollowUpAttempt(cancelClient, { workspaceId: "workspace", outreachId: "outreach", attemptId: "attempt", cancelReason: "admin_cancelled", cancelledAt: "2026-08-12T10:01:00.000Z" });
  assert(cancelled.disposition === "cancelled" && cancelled.attemptStatus === "cancelled", "Cancellation result must be normalized.");

  const source = await readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8");
  const start = source.indexOf("export async function reserveBacklinkOutreachFollowUpAttempt");
  const block = source.slice(start, source.indexOf("export async function createBacklinkOutreachAttempt", start));
  for (const value of ["p_attempt_id: required(input.attemptId", "p_reply_token_hash: required(input.replyTokenHash", "p_reply_token_key_version: required(input.replyTokenKeyVersion"]) assert(block.includes(value), `Wrapper must pass ${value}.`);
  assert(block.includes('.rpc("reserve_backlink_outreach_follow_up_attempt"'), "Wrapper must use RPC.");
  for (const forbidden of [".insert(", ".update(", '.from("backlink_outreach_attempts")', '.from("backlink_outreach")']) assert(!block.includes(forbidden), `Follow-up wrapper must not directly mutate ${forbidden}.`);
  const cancelStart = source.indexOf("export async function cancelBacklinkOutreachPreparedFollowUpAttempt");
  const cancelBlock = source.slice(cancelStart, source.indexOf("export async function createBacklinkOutreachAttempt", cancelStart));
  assert(cancelBlock.includes('.rpc("cancel_backlink_outreach_prepared_follow_up_attempt"'), "Cancellation wrapper must use RPC.");
  for (const forbidden of [".insert(", ".update(", '.from("backlink_outreach_attempts")', '.from("backlink_outreach")']) assert(!cancelBlock.includes(forbidden), `Cancellation wrapper must not directly mutate ${forbidden}.`);
  console.log("PASS — Backlink outreach follow-up reservation repository smoke");
}

void main();
