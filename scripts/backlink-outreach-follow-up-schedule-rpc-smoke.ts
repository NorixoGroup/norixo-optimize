import { readFile } from "node:fs/promises";
import { reconcileBacklinkOutreachFollowUpSchedule as reconcileScheduleRpc, type ReconcileBacklinkOutreachFollowUpScheduleResult } from "../lib/backlinks/repositories/outreachRepository";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [migration, repository, types] = await Promise.all([
    readFile("supabase/migrations/20260811163000_add_backlink_outreach_follow_up_schedule_reconciliation.sql", "utf8"),
    readFile("lib/backlinks/repositories/outreachRepository.ts", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);

  for (const value of [
    "create function public.reconcile_backlink_outreach_follow_up_schedule",
    "p_expected_current_attempt integer",
    "p_expected_last_attempt_at timestamptz",
    "p_schedule_kind text",
    "p_scheduled_at timestamptz",
    "outreach.status <> 'active'",
    "outreach.channel <> 'email'",
    "contact.contact_status in ('do_not_contact', 'archived')",
    "nullif(trim(contact.email_normalized), '') is null",
    "status in ('prepared', 'requested', 'unknown')",
    "effect_kind = 'reply_received_stop'",
    "latest_attempt.status <> 'accepted'",
    "FOLLOW_UP_SCHEDULE_STATE_MISMATCH",
    "FOLLOW_UP_SCHEDULE_CONFLICT",
    "next_follow_up_at = p_scheduled_at",
    "response_deadline_at = p_scheduled_at",
    "'scheduled'",
    "'existing'",
    "security definer",
    "set search_path = public",
    "grant execute",
  ]) assert(migration.includes(value), `Missing scheduling RPC invariant: ${value}`);

  for (const forbidden of [
    "outreachEmailProvider",
    "sendTransactionalEmail",
    "scheduler",
    "draft",
    "reservation",
    "no_response",
  ]) assert(!migration.includes(forbidden), `Forbidden scheduling RPC behavior: ${forbidden}`);

  for (const value of [
    "reconcileBacklinkOutreachFollowUpSchedule",
    "reconcile_backlink_outreach_follow_up_schedule",
    "p_expected_current_attempt: input.expectedCurrentAttempt",
    "p_expected_last_attempt_at: input.expectedLastAttemptAt",
    "p_schedule_kind: input.scheduleKind",
    "p_scheduled_at: input.scheduledAt",
  ]) assert(repository.includes(value), `Missing scheduling repository wrapper invariant: ${value}`);

  for (const value of [
    "reconcile_backlink_outreach_follow_up_schedule:",
    "p_expected_current_attempt: number",
    "p_expected_last_attempt_at: string",
    "p_schedule_kind: string",
    "p_scheduled_at: string",
    "disposition: string",
    "response_deadline_at: string | null",
  ]) assert(types.includes(value), `Missing scheduling database type invariant: ${value}`);

  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert(name === "reconcile_backlink_outreach_follow_up_schedule", "RPC wrapper must call the reconciliation RPC.");
      assert(args.p_workspace_id === "workspace" && args.p_outreach_id === "outreach", "RPC wrapper must scope workspace and outreach.");
      assert(args.p_expected_current_attempt === 1 && args.p_expected_last_attempt_at === "2026-08-12T10:00:00.000Z", "RPC wrapper must pass expected canonical state.");
      assert(args.p_schedule_kind === "follow_up" && args.p_scheduled_at === "2026-08-17T10:00:00.000Z", "RPC wrapper must pass schedule target.");
      return {
        data: [{
          disposition: "scheduled",
          schedule_kind: "follow_up",
          scheduled_at: "2026-08-17T10:00:00.000Z",
          next_follow_up_at: "2026-08-17T10:00:00.000Z",
          response_deadline_at: null,
        }],
        error: null,
      };
    },
  };

  const result = await reconcileScheduleRpc(client as never, "workspace", "outreach", {
    expectedCurrentAttempt: 1,
    expectedLastAttemptAt: "2026-08-12T10:00:00.000Z",
    scheduleKind: "follow_up",
    scheduledAt: "2026-08-17T10:00:00.000Z",
  });
  assert(JSON.stringify(result) === JSON.stringify({
    disposition: "scheduled",
    kind: "follow_up",
    scheduledAt: "2026-08-17T10:00:00.000Z",
    nextFollowUpAt: "2026-08-17T10:00:00.000Z",
    responseDeadlineAt: null,
  } satisfies ReconcileBacklinkOutreachFollowUpScheduleResult), "RPC result must normalize scheduled follow-up state.");

  console.log("PASS — Backlink outreach follow-up schedule RPC smoke");
}

void main();
