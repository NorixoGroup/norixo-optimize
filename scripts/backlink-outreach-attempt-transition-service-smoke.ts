import {
  BacklinkOutreachAttemptTransitionError,
  markBacklinkOutreachAttemptAccepted,
  markBacklinkOutreachAttemptFailed,
  markBacklinkOutreachAttemptUnknown,
} from "../lib/backlinks/services/outreachAttemptService";
import type {
  BacklinkOutreachAttemptRow,
  BacklinkOutreachAttemptStatePatch,
} from "../lib/backlinks/repositories/outreachAttemptsRepository";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function fixture(status: BacklinkOutreachAttemptRow["status"] = "requested"): BacklinkOutreachAttemptRow {
  return {
    id: "attempt",
    workspace_id: "workspace",
    outreach_id: "outreach",
  actor_user_id: "actor",
  attempt_kind: "initial",
  cancel_reason: null,
  cancelled_at: null,
    channel: "email",
    provider: "manual",
    recipient: "contact@example.com",
    idempotency_key: "key",
    reply_token_hash: null,
    reply_token_key_version: null,
    status,
    provider_message_id: null,
    prepared_at: null,
    error_code: null,
    error_message: null,
    requested_at: "2026-08-10T09:00:00.000Z",
    accepted_at: null,
    failed_at: null,
    resolved_at: null,
    created_at: "2026-08-10T09:00:00.000Z",
  };
}

async function expectError(
  operation: () => Promise<unknown>,
  code: BacklinkOutreachAttemptTransitionError["code"],
): Promise<void> {
  try {
    await operation();
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    assert(
      error instanceof BacklinkOutreachAttemptTransitionError && error.code === code,
      `Expected ${code}.`,
    );
  }
}

async function main() {
  let attempt = fixture();
  let patch: BacklinkOutreachAttemptStatePatch | null = null;
  const dependencies = {
    getAttempt: async (_workspaceId: string, _attemptId: string) => attempt,
    updateAttempt: async (
      _workspaceId: string,
      _attemptId: string,
      nextPatch: BacklinkOutreachAttemptStatePatch,
    ) => {
      patch = nextPatch;
      attempt = { ...attempt, ...nextPatch };
      return attempt;
    },
    now: () => "2026-08-10T10:00:00.000Z",
  };
  const accepted = markBacklinkOutreachAttemptAccepted(dependencies);
  const failed = markBacklinkOutreachAttemptFailed(dependencies);
  const unknown = markBacklinkOutreachAttemptUnknown(dependencies);
  const base = { workspaceId: "workspace", attemptId: "attempt" };

  let result = await accepted({ ...base, providerMessageId: "provider-message" });
  assert(result.status === "accepted" && result.disposition === "updated", "Requested attempt must become accepted.");
  assert(JSON.stringify(patch) === JSON.stringify({ status: "accepted", accepted_at: "2026-08-10T10:00:00.000Z", resolved_at: "2026-08-10T10:00:00.000Z", failed_at: null, error_code: null, error_message: null, provider_message_id: "provider-message" }), "Accepted patch must be bounded and timestamped.");
  assert(result.requestedAt === "2026-08-10T09:00:00.000Z", "requested_at must remain unchanged.");
  result = await accepted({ ...base, providerMessageId: "provider-message" });
  assert(result.disposition === "existing", "Accepted retry with the same provider id must be idempotent.");
  await expectError(() => accepted({ ...base, providerMessageId: "other-message" }), "OUTREACH_ATTEMPT_ACCEPTED_CONFLICT");
  await expectError(() => failed({ ...base, errorCode: "FAILED", errorMessage: "Failed" }), "OUTREACH_ATTEMPT_TRANSITION_INVALID");
  await expectError(() => unknown({ ...base }), "OUTREACH_ATTEMPT_TRANSITION_INVALID");

  attempt = fixture();
  result = await failed({ ...base, errorCode: " FAILED ", errorMessage: " Failure " });
  assert(result.status === "failed" && result.disposition === "updated", "Requested attempt must become failed.");
  assert(JSON.stringify(patch) === JSON.stringify({ status: "failed", failed_at: "2026-08-10T10:00:00.000Z", resolved_at: "2026-08-10T10:00:00.000Z", accepted_at: null, provider_message_id: null, error_code: "FAILED", error_message: "Failure" }), "Failed patch must be bounded and normalized.");
  result = await failed({ ...base, errorCode: "FAILED", errorMessage: "Failure" });
  assert(result.disposition === "existing", "Failed retry with identical details must be idempotent.");
  await expectError(() => failed({ ...base, errorCode: "OTHER", errorMessage: "Failure" }), "OUTREACH_ATTEMPT_FAILED_CONFLICT");
  await expectError(() => accepted({ ...base, providerMessageId: null }), "OUTREACH_ATTEMPT_TRANSITION_INVALID");
  await expectError(() => unknown({ ...base }), "OUTREACH_ATTEMPT_TRANSITION_INVALID");

  attempt = fixture();
  result = await unknown({ ...base, errorCode: " TIMEOUT ", errorMessage: " Timed out " });
  assert(result.status === "unknown" && result.disposition === "updated", "Requested attempt must become unknown.");
  assert(JSON.stringify(patch) === JSON.stringify({ status: "unknown", accepted_at: null, failed_at: null, resolved_at: null, provider_message_id: null, error_code: "TIMEOUT", error_message: "Timed out" }), "Unknown patch must be bounded.");
  result = await unknown({ ...base, errorCode: "TIMEOUT", errorMessage: "Timed out" });
  assert(result.disposition === "existing", "Unknown retry with identical details must be idempotent.");
  await expectError(() => unknown({ ...base, errorCode: "OTHER", errorMessage: "Timed out" }), "OUTREACH_ATTEMPT_UNKNOWN_CONFLICT");
  result = await accepted({ ...base, providerMessageId: null });
  assert(result.status === "accepted" && result.disposition === "updated", "Unknown attempt must become accepted.");

  attempt = fixture("unknown");
  result = await failed({ ...base, errorCode: "FAILED", errorMessage: "Failure" });
  assert(result.status === "failed" && result.disposition === "updated", "Unknown attempt must become failed.");

  assert(!JSON.stringify(patch).includes("outreach_id"), "Attempt transition must not mutate backlink_outreach.");
  console.log("PASS — Backlink outreach attempt transition service smoke");
}

void main();
