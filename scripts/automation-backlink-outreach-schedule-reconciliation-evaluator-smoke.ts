import {
  classifyBacklinkOutreachScheduleReconciliationCandidate,
  evaluateBacklinkOutreachScheduleReconciliationCandidate,
  type BacklinkOutreachScheduleReconciliationCandidate,
} from "../lib/backlinks/services/outreachScheduleReconciliationService";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function candidate(overrides: Partial<BacklinkOutreachScheduleReconciliationCandidate> = {}): BacklinkOutreachScheduleReconciliationCandidate {
  return {
    id: "00000000-0000-4000-8000-000000000100",
    workspace_id: "00000000-0000-4000-8000-000000000001",
    contact_id: "00000000-0000-4000-8000-000000000010",
    status: "active",
    channel: "email",
    current_attempt: 1,
    max_attempts: 3,
    last_attempt_at: "2026-08-05T10:00:00.000Z",
    next_follow_up_at: null,
    response_deadline_at: null,
    ...overrides,
  };
}

async function main(): Promise<void> {
  let latestAttemptCalls = 0;
  let openAttemptCalls = 0;
  let contactCalls = 0;
  let stopEffectCalls = 0;

  const evaluate = evaluateBacklinkOutreachScheduleReconciliationCandidate({
    getLatestAttempt: async (_workspaceId, _outreachId) => {
      latestAttemptCalls += 1;
      return {
        id: "00000000-0000-4000-8000-000000000200",
        workspace_id: "00000000-0000-4000-8000-000000000001",
        outreach_id: "00000000-0000-4000-8000-000000000100",
        actor_user_id: "00000000-0000-4000-8000-000000000020",
        channel: "email",
        provider: "resend",
        recipient: "guest@example.com",
        idempotency_key: "attempt-1",
        status: "accepted",
        provider_message_id: "msg-1",
        error_code: null,
        error_message: null,
        requested_at: "2026-08-05T10:00:00.000Z",
        accepted_at: "2026-08-05T10:00:05.000Z",
        failed_at: null,
        resolved_at: null,
        created_at: "2026-08-05T10:00:00.000Z",
        attempt_kind: "initial",
        cancel_reason: null,
        cancelled_at: null,
        prepared_at: null,
        reply_token_hash: null,
        reply_token_key_version: null,
      };
    },
    getOpenAttempt: async () => {
      openAttemptCalls += 1;
      return null;
    },
    getContact: async () => {
      contactCalls += 1;
      return { contact_status: "verified", email_normalized: "guest@example.com" };
    },
    hasInboundReplyStopEffect: async () => {
      stopEffectCalls += 1;
      return false;
    },
  });

  const followUpEligible = await evaluate(candidate());
  assert(followUpEligible.disposition === "eligible", "Follow-up candidate should be eligible.");
  assert(followUpEligible.kind === "follow_up", "First attempt should schedule follow-up.");
  assert(followUpEligible.scheduledAt === "2026-08-10T10:00:00.000Z", "First attempt should use +5d schedule.");

  const followUpRetryEligible = await evaluate(candidate({ current_attempt: 2, max_attempts: 4 }));
  assert(followUpRetryEligible.disposition === "eligible", "Second attempt should still be eligible.");
  assert(followUpRetryEligible.kind === "follow_up", "Second attempt should schedule follow-up.");
  assert(followUpRetryEligible.scheduledAt === "2026-08-12T10:00:00.000Z", "Second attempt should use +7d schedule.");

  const finalResponseEligible = await evaluate(candidate({ current_attempt: 3, max_attempts: 3 }));
  assert(finalResponseEligible.disposition === "eligible", "Max attempt should still be eligible.");
  assert(finalResponseEligible.kind === "final_response", "Max attempt should schedule final response.");
  assert(finalResponseEligible.scheduledAt === "2026-08-17T10:00:00.000Z", "Max attempt should use +12d schedule.");

  const exactExisting = classifyBacklinkOutreachScheduleReconciliationCandidate(
    candidate({ next_follow_up_at: "2026-08-10T10:00:00.000Z" }),
    followUpEligible,
  );
  assert(exactExisting.disposition === "existing", "Exact follow-up should be existing.");
  assert(exactExisting.reason === "SCHEDULE_ALREADY_PRESENT", "Exact follow-up reason should be stable.");

  const conflicting = classifyBacklinkOutreachScheduleReconciliationCandidate(
    candidate({ next_follow_up_at: "2026-08-11T10:00:00.000Z" }),
    followUpEligible,
  );
  assert(conflicting.disposition === "conflict", "Mismatched follow-up should conflict.");
  assert(conflicting.reason === "SCHEDULE_CONFLICT", "Conflict reason should be stable.");

  for (const [label, resolvedCandidate, expectedReason] of [
    ["latest failed", candidate(), "LATEST_ATTEMPT_NOT_ACCEPTED"],
    ["latest cancelled", candidate(), "LATEST_ATTEMPT_NOT_ACCEPTED"],
    ["latest unknown", candidate(), "LATEST_ATTEMPT_NOT_ACCEPTED"],
    ["open prepared", candidate(), "OPEN_ATTEMPT_PRESENT"],
    ["open requested", candidate(), "OPEN_ATTEMPT_PRESENT"],
    ["open unknown", candidate(), "OPEN_ATTEMPT_PRESENT"],
    ["dnc", candidate(), "CONTACT_UNAVAILABLE"],
    ["archived", candidate(), "CONTACT_UNAVAILABLE"],
    ["inbound stop", candidate(), "INBOUND_REPLY_STOPPED"],
    ["non-active", candidate({ status: "draft" }), "OUTREACH_NOT_ACTIVE"],
  ] as const) {
    const deps = {
      getLatestAttempt: async () => {
        latestAttemptCalls += 1;
        return label === "latest failed"
          ? { status: "failed" }
          : label === "latest cancelled"
            ? { status: "cancelled" }
            : label === "latest unknown"
              ? { status: "unknown" }
              : { status: "accepted" };
      },
      getOpenAttempt: async () => {
        openAttemptCalls += 1;
        return label === "open prepared"
          ? { status: "prepared" }
          : label === "open requested"
            ? { status: "requested" }
            : label === "open unknown"
              ? { status: "unknown" }
              : null;
      },
      getContact: async () => {
        contactCalls += 1;
        if (label === "dnc") return { contact_status: "do_not_contact", email_normalized: "guest@example.com" };
        if (label === "archived") return { contact_status: "archived", email_normalized: "guest@example.com" };
        return { contact_status: "verified", email_normalized: "guest@example.com" };
      },
      hasInboundReplyStopEffect: async () => {
        stopEffectCalls += 1;
        return label === "inbound stop";
      },
    };
    const localEvaluate = evaluateBacklinkOutreachScheduleReconciliationCandidate(deps);
    const result = await localEvaluate(resolvedCandidate);
    assert(result.disposition === "not_applicable", `${label} should be not applicable.`);
    assert(result.reason === expectedReason, `${label} reason should be stable.`);
  }

  assert(latestAttemptCalls > 0 && openAttemptCalls > 0 && contactCalls > 0 && stopEffectCalls > 0, "Evaluator should read from dependencies.");

  console.log("PASS — Backlink outreach schedule reconciliation evaluator smoke");
}

void main();
