import {
  recoverBacklinkOutreachRequestedAttempt,
  BacklinkOutreachRequestedAttemptRecoveryError,
  REQUESTED_ATTEMPT_RECOVERY_ERROR_CODE,
  REQUESTED_ATTEMPT_RECOVERY_ERROR_MESSAGE,
} from "../lib/backlinks/services/outreachRequestedAttemptRecoveryService";
import type { BacklinkOutreachAttemptRow, BacklinkOutreachAttemptStatePatch } from "../lib/backlinks/repositories/outreachAttemptsRepository";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function expectError(operation: () => Promise<unknown>, code: BacklinkOutreachRequestedAttemptRecoveryError["code"]) { try { await operation(); throw new Error(`Expected ${code}`); } catch (error) { assert(error instanceof BacklinkOutreachRequestedAttemptRecoveryError && error.code === code, `Expected ${code}`); } }

function attempt(status: BacklinkOutreachAttemptRow["status"] = "requested", attemptKind: BacklinkOutreachAttemptRow["attempt_kind"] = "initial"): BacklinkOutreachAttemptRow {
  return { id: "attempt", workspace_id: "workspace", outreach_id: "outreach", actor_user_id: "actor", attempt_kind: attemptKind, cancel_reason: null, cancelled_at: null, channel: "email", provider: "resend", recipient: "contact@example.com", idempotency_key: "key", reply_token_hash: "a".repeat(64), reply_token_key_version: "v1", status, provider_message_id: null, prepared_at: attemptKind === "follow_up" ? "2026-08-10T08:55:00.000Z" : null, error_code: null, error_message: null, requested_at: "2026-08-10T09:00:00.000Z", accepted_at: null, failed_at: null, resolved_at: null, created_at: "2026-08-10T08:55:00.000Z" };
}

async function main() {
  let row = attempt();
  let patch: BacklinkOutreachAttemptStatePatch | null = null;
  let recoverWins = true;
  const service = recoverBacklinkOutreachRequestedAttempt({
    getAttempt: async () => row,
    recoverRequestedAttempt: async (_workspaceId, _attemptId, nextPatch) => { patch = nextPatch; if (!recoverWins) return null; row = { ...row, ...nextPatch }; return row; },
    now: () => "2026-08-10T09:20:00.000Z",
  });
  const base = { workspaceId: "workspace", actorUserId: "admin", outreachId: "outreach", attemptId: "attempt" };

  let result = await service(base);
  assert(result.disposition === "updated" && result.attemptStatus === "unknown" && result.errorCode === REQUESTED_ATTEMPT_RECOVERY_ERROR_CODE, "Old requested initial Attempt must become unknown.");
  assert(JSON.stringify(patch) === JSON.stringify({ status: "unknown", accepted_at: null, failed_at: null, resolved_at: null, error_code: REQUESTED_ATTEMPT_RECOVERY_ERROR_CODE, error_message: REQUESTED_ATTEMPT_RECOVERY_ERROR_MESSAGE }), "Recovery patch must be bounded and preserve provider_message_id.");

  row = attempt("requested", "follow_up");
  row.provider_message_id = "provider-message";
  result = await service(base);
  assert(result.disposition === "updated" && row.provider_message_id === "provider-message", "Follow-up requested recovery must preserve provider_message_id.");

  row = { ...attempt("requested"), requested_at: "2026-08-10T09:19:00.000Z" };
  await expectError(() => service(base), "REQUESTED_ATTEMPT_RECOVERY_TOO_EARLY");
  row = { ...attempt("requested"), requested_at: "not-a-date" };
  await expectError(() => service(base), "REQUESTED_ATTEMPT_RECOVERY_INTEGRITY_CONFLICT");
  row = { ...attempt("requested"), outreach_id: "other" };
  await expectError(() => service(base), "REQUESTED_ATTEMPT_OUTREACH_MISMATCH");
  for (const status of ["accepted", "failed", "cancelled"] as const) {
    row = attempt(status);
    await expectError(() => service(base), "REQUESTED_ATTEMPT_RECOVERY_STATE_CONFLICT");
  }

  row = { ...attempt("unknown"), error_code: REQUESTED_ATTEMPT_RECOVERY_ERROR_CODE, error_message: REQUESTED_ATTEMPT_RECOVERY_ERROR_MESSAGE };
  result = await service(base);
  assert(result.disposition === "existing", "Same recovery repeated on unknown must be idempotent.");
  row = { ...attempt("unknown"), error_code: "OTHER", error_message: REQUESTED_ATTEMPT_RECOVERY_ERROR_MESSAGE };
  await expectError(() => service(base), "REQUESTED_ATTEMPT_RECOVERY_STATE_CONFLICT");

  row = attempt();
  recoverWins = false;
  const canonicalUnknown = { ...attempt("unknown"), error_code: REQUESTED_ATTEMPT_RECOVERY_ERROR_CODE, error_message: REQUESTED_ATTEMPT_RECOVERY_ERROR_MESSAGE };
  let reads = 0;
  const concurrentRecovery = recoverBacklinkOutreachRequestedAttempt({
    getAttempt: async () => { reads += 1; return reads === 1 ? row : canonicalUnknown; },
    recoverRequestedAttempt: async () => null,
    now: () => "2026-08-10T09:20:00.000Z",
  });
  result = await concurrentRecovery(base);
  assert(result.disposition === "existing", "CAS loser must reload canonical unknown state.");

  for (const forbidden of ["outreachEmailProvider", "sendTransactionalEmail", "outreachEmailSendService", "Resend", "createBacklinkOutreachAttempt", "crypto.randomUUID"]) {
    assert(!JSON.stringify(patch).includes(forbidden), `Recovery must not call ${forbidden}.`);
  }
  console.log("PASS — Backlink outreach requested recovery service smoke");
}

void main();
