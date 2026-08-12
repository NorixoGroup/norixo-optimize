import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [responseDeadlineMigration, reconciliationMigration, types] = await Promise.all([
    readFile("supabase/migrations/20260811162000_add_backlink_outreach_response_deadline.sql", "utf8"),
    readFile("supabase/migrations/20260811163000_add_backlink_outreach_follow_up_schedule_reconciliation.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);

  for (const value of [
    "response_deadline_at timestamptz",
    "comment on column public.backlink_outreach.response_deadline_at",
  ]) {
    assert(responseDeadlineMigration.includes(value), `Missing scheduling schema invariant: ${value}`);
  }

  for (const value of [
    "reconcile_backlink_outreach_follow_up_schedule",
    "p_expected_current_attempt integer",
    "p_expected_last_attempt_at timestamptz",
    "p_schedule_kind text",
    "p_scheduled_at timestamptz",
    "FOLLOW_UP_SCHEDULE_CONFLICT",
    "FOLLOW_UP_SCHEDULE_STATE_MISMATCH",
    "schedule_kind text",
    "scheduled_at timestamptz",
    "next_follow_up_at timestamptz",
    "response_deadline_at timestamptz",
    "grant execute",
  ]) {
    assert(reconciliationMigration.includes(value), `Missing scheduling schema invariant: ${value}`);
  }

  for (const forbidden of [
    "scheduler",
    "reservation",
    "draft",
    "no_response",
  ]) {
    assert(!reconciliationMigration.includes(forbidden), `Forbidden scheduling schema behavior: ${forbidden}`);
  }

  for (const value of [
    "response_deadline_at: string | null",
    "reconcile_backlink_outreach_follow_up_schedule",
    "p_expected_current_attempt: number",
    "p_expected_last_attempt_at: string",
    "p_schedule_kind: string",
    "p_scheduled_at: string",
    "disposition: string",
    "schedule_kind: string",
    "scheduled_at: string",
    "next_follow_up_at: string | null",
  ]) {
    assert(types.includes(value), `Missing scheduling database type invariant: ${value}`);
  }

  console.log("PASS — Backlink outreach follow-up schedule schema smoke");
}

void main();
