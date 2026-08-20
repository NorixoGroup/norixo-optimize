import {
  BacklinkOutreachLifecycleError,
  transitionBacklinkOutreachLifecycle,
} from "../lib/backlinks/services/outreachLifecycleService";
import type { BacklinkOutreachRow } from "../lib/backlinks/repositories/outreachRepository";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const now = "2026-08-10T12:00:00.000Z";

function row(status: string = "active", response: string | null = null): BacklinkOutreachRow {
  return {
    id: "o",
    workspace_id: "w",
    campaign_id: "c",
    opportunity_id: "p",
    contact_id: "ct",
    outreach_key: "BL-OUT-2026-001",
    channel: "email",
    status,
    current_attempt: 3,
    max_attempts: 3,
    first_contact_at: null,
    last_attempt_at: null,
    next_follow_up_at: "future",
    response_deadline_at: "deadline",
    success_link_id: null,
    success_link_status: null,
    success_verified_at: null,
    success_source_url: null,
    success_target_url: null,
    closed_at: null,
    last_response_type: response,
    stop_reason: null,
    created_by: null,
    created_at: now,
    updated_at: now,
    subject: null,
    body: null,
  };
}

async function main() {
  let value = row();
  const patches: Record<string, unknown>[] = [];
  const backlinkObtainedCalls: Array<{ workspaceId: string; outreachId: string; appliedAt: string }> = [];

  const service = transitionBacklinkOutreachLifecycle({
    getOutreach: async () => value,
    updateIfStatus: async (_workspaceId, _outreachId, expectedStatus, patch) => {
      patches.push(patch);
      if (value.status !== expectedStatus) return null;
      value = { ...value, ...patch };
      return value;
    },
    markBacklinkObtained: async (workspaceId, outreachId, appliedAt) => {
      backlinkObtainedCalls.push({ workspaceId, outreachId, appliedAt });
      return {
        disposition: "applied",
        outreachId,
        previousStatus: "conversation_open",
        outreachStatus: "closed",
        lastResponseType: "positive",
        closedAt: appliedAt,
        stopReason: "backlink_obtained",
        nextFollowUpAt: null,
        responseDeadlineAt: null,
      };
    },
    now: () => now,
  });

  const input = { workspaceId: "w", actorUserId: "actor", outreachId: "o" };

  for (const responseType of ["positive", "negative", "neutral", "bounced", "unsubscribed"] as const) {
    value = row();
    const result = await service({ ...input, transition: { kind: "mark_replied", responseType } });
    assert(result.status === "replied", "reply status");
    assert(value.last_response_type === responseType, "reply response type");
    assert(value.closed_at === null && value.stop_reason === null && value.next_follow_up_at === null && value.response_deadline_at === null, "reply patch");
  }

  value = row("replied", "positive");
  assert((await service({ ...input, transition: { kind: "open_conversation" } })).status === "conversation_open" && value.response_deadline_at === null, "conversation");
  value = row("replied", "neutral");
  try {
    await service({ ...input, transition: { kind: "open_conversation" } });
    throw new Error("Expected invalid conversation response type");
  } catch (error) {
    assert(error instanceof BacklinkOutreachLifecycleError && error.code === "OUTREACH_LIFECYCLE_RESPONSE_TYPE_INVALID", "invalid conversation");
  }

  value = row();
  assert((await service({ ...input, transition: { kind: "decline", stopReason: " reason " } })).status === "declined" && value.stop_reason === "reason" && value.closed_at === now && value.response_deadline_at === null, "decline");

  value = row();
  assert((await service({ ...input, transition: { kind: "mark_no_response" } })).status === "no_response" && value.stop_reason === "attempt_limit" && value.last_response_type === null && value.response_deadline_at === null, "no response");
  value = row();
  value.current_attempt = 2;
  try {
    await service({ ...input, transition: { kind: "mark_no_response" } });
    throw new Error("Expected no-response attempt limit");
  } catch (error) {
    assert(error instanceof BacklinkOutreachLifecycleError && error.code === "OUTREACH_LIFECYCLE_NO_RESPONSE_ATTEMPTS_REMAIN", "limit");
  }

  value = row("active", "neutral");
  assert((await service({ ...input, transition: { kind: "pause" } })).status === "paused" && value.last_response_type === "neutral" && value.response_deadline_at === null, "pause");

  value = row("active", "neutral");
  assert((await service({ ...input, transition: { kind: "close", stopReason: " close " } })).status === "closed" && value.stop_reason === "close" && value.last_response_type === "neutral" && value.response_deadline_at === null, "close");

  value = row("conversation_open", "positive");
  const backlinkObtainedResult = await service({ ...input, transition: { kind: "mark_backlink_obtained" } });
  assert(backlinkObtainedResult.disposition === "applied", "backlink obtained disposition");
  assert(backlinkObtainedResult.status === "closed", "backlink obtained status");
  assert(backlinkObtainedResult.stopReason === "backlink_obtained", "backlink obtained reason");
  assert(backlinkObtainedCalls.length === 1 && backlinkObtainedCalls[0].workspaceId === "w" && backlinkObtainedCalls[0].outreachId === "o" && backlinkObtainedCalls[0].appliedAt === now, "backlink obtained dependency call");

  for (const patch of patches) {
    for (const key of Object.keys(patch)) {
      assert(["status", "last_response_type", "closed_at", "stop_reason", "next_follow_up_at", "response_deadline_at"].includes(key), `patch ${key}`);
    }
  }

  console.log("PASS — Backlink outreach manual lifecycle service smoke");
}

void main();
