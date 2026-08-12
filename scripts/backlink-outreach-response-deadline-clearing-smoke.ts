import { readFileSync } from "node:fs";
import { transitionBacklinkOutreachLifecycle } from "../lib/backlinks/services/outreachLifecycleService";
import type { BacklinkOutreachRow } from "../lib/backlinks/repositories/outreachRepository";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

const migration = readFileSync("supabase/migrations/20260811165000_add_backlink_outreach_response_deadline_clearing.sql", "utf8");

function row(status: BacklinkOutreachRow["status"], responseDeadlineAt: string | null = "deadline", response: string | null = null): BacklinkOutreachRow {
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
    response_deadline_at: responseDeadlineAt,
    closed_at: null,
    last_response_type: response,
    stop_reason: null,
    created_by: null,
    created_at: "2026-08-10T12:00:00.000Z",
    updated_at: "2026-08-10T12:00:00.000Z",
    subject: null,
    body: null,
  };
}

async function main() {
  for (const snippet of [
    "create or replace function public.apply_backlink_outreach_inbound_reply_stop",
    "next_follow_up_at = null,\n      response_deadline_at = null",
    "create or replace function public.classify_backlink_outreach_inbound_reply",
    "set status = 'replied',",
    "set status = 'declined',",
    "response_deadline_at = null",
    "create or replace function public.apply_backlink_outreach_provider_complaint",
    "create or replace function public.apply_backlink_outreach_provider_permanent_bounce",
    "update public.backlink_outreach\nset response_deadline_at = null",
    "status in ('replied', 'conversation_open', 'declined', 'no_response', 'paused', 'closed')",
  ]) {
    assert(migration.includes(snippet), `Missing migration invariant: ${snippet}`);
  }

  const input = { workspaceId: "w", actorUserId: "actor", outreachId: "o" };

  {
    let current = row("active");
    const service = transitionBacklinkOutreachLifecycle({
      getOutreach: async () => current,
      updateIfStatus: async (_workspaceId, _outreachId, expectedStatus, patch) => {
        if (current.status !== expectedStatus) return null;
        current = { ...current, ...patch };
        return current;
      },
      now: () => "2026-08-10T12:00:00.000Z",
    });
    const result = await service({ ...input, transition: { kind: "mark_replied", responseType: "positive" } });
    assert(result.responseDeadlineAt === null, "mark_replied must clear response deadline");
    assert(current.response_deadline_at === null, "mark_replied must persist cleared deadline");
  }

  {
    let current = row("replied", "deadline", "positive");
    const service = transitionBacklinkOutreachLifecycle({
      getOutreach: async () => current,
      updateIfStatus: async (_workspaceId, _outreachId, expectedStatus, patch) => {
        if (current.status !== expectedStatus) return null;
        current = { ...current, ...patch };
        return current;
      },
      now: () => "2026-08-10T12:00:00.000Z",
    });
    const result = await service({ ...input, transition: { kind: "open_conversation" } });
    assert(result.responseDeadlineAt === null, "open_conversation must clear response deadline");
    assert(current.response_deadline_at === null, "open_conversation must persist cleared deadline");
  }

  {
    let current = row("active");
    const service = transitionBacklinkOutreachLifecycle({
      getOutreach: async () => current,
      updateIfStatus: async (_workspaceId, _outreachId, expectedStatus, patch) => {
        if (current.status !== expectedStatus) return null;
        current = { ...current, ...patch };
        return current;
      },
      now: () => "2026-08-10T12:00:00.000Z",
    });
    const result = await service({ ...input, transition: { kind: "decline", stopReason: " reason " } });
    assert(result.responseDeadlineAt === null, "decline must clear response deadline");
    assert(current.response_deadline_at === null, "decline must persist cleared deadline");
  }

  {
    let current = row("active");
    const service = transitionBacklinkOutreachLifecycle({
      getOutreach: async () => current,
      updateIfStatus: async (_workspaceId, _outreachId, expectedStatus, patch) => {
        if (current.status !== expectedStatus) return null;
        current = { ...current, ...patch };
        return current;
      },
      now: () => "2026-08-10T12:00:00.000Z",
    });
    const result = await service({ ...input, transition: { kind: "mark_no_response" } });
    assert(result.responseDeadlineAt === null, "mark_no_response must clear response deadline");
    assert(current.response_deadline_at === null, "mark_no_response must persist cleared deadline");
  }

  {
    let current = row("active");
    const service = transitionBacklinkOutreachLifecycle({
      getOutreach: async () => current,
      updateIfStatus: async (_workspaceId, _outreachId, expectedStatus, patch) => {
        if (current.status !== expectedStatus) return null;
        current = { ...current, ...patch };
        return current;
      },
      now: () => "2026-08-10T12:00:00.000Z",
    });
    const result = await service({ ...input, transition: { kind: "pause" } });
    assert(result.responseDeadlineAt === null, "pause must clear response deadline");
    assert(current.response_deadline_at === null, "pause must persist cleared deadline");
  }

  {
    let current = row("active");
    const service = transitionBacklinkOutreachLifecycle({
      getOutreach: async () => current,
      updateIfStatus: async (_workspaceId, _outreachId, expectedStatus, patch) => {
        if (current.status !== expectedStatus) return null;
        current = { ...current, ...patch };
        return current;
      },
      now: () => "2026-08-10T12:00:00.000Z",
    });
    const result = await service({ ...input, transition: { kind: "close", stopReason: " closed " } });
    assert(result.responseDeadlineAt === null, "close must clear response deadline");
    assert(current.response_deadline_at === null, "close must persist cleared deadline");
  }

  console.log("PASS — Backlink outreach response deadline clearing smoke");
}

void main();
