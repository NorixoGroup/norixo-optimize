import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const migration = await readFile(
    "supabase/migrations/20260917220000_restore_follow_up_schedule_on_admin_cancel.sql",
    "utf8",
  );

  for (const value of [
    "create or replace function public.cancel_backlink_outreach_prepared_follow_up_attempt",
    "p_workspace_id uuid",
    "p_outreach_id uuid",
    "p_attempt_id uuid",
    "p_cancel_reason text",
    "p_cancelled_at timestamptz",
    "security definer",
    "set search_path = public",
    "attempt.attempt_kind <> 'follow_up'",
    "attempt.status = 'cancelled'",
    "attempt.status <> 'prepared'",
    "attempt.requested_at is not null",
    "attempt.accepted_at is not null",
    "attempt.provider_message_id is not null",
    "normalized_reason = 'admin_cancelled'",
    "outreach.next_follow_up_at is not null",
    "outreach.response_deadline_at is not null",
    "attempt.prepared_at is null",
    "FOLLOW_UP_CANCEL_RECOVERY_CONFLICT",
    "set next_follow_up_at = attempt.prepared_at",
    "cancelled_at = p_cancelled_at",
    "cancel_reason = normalized_reason",
    "'cancelled'",
    "'existing'",
  ]) {
    assert(
      migration.includes(value),
      `Missing cancellation/recovery invariant: ${value}`,
    );
  }

  assert(
    migration.indexOf("into outreach") < migration.indexOf("into attempt"),
    "Cancellation must lock Outreach before Attempt.",
  );

  const recoveryStart = migration.indexOf(
    "if normalized_reason = 'admin_cancelled' then",
  );
  const recoveryEnd = migration.indexOf(
    "return query",
    recoveryStart,
  );

  assert(
    recoveryStart >= 0 && recoveryEnd > recoveryStart,
    "Admin recovery block is missing.",
  );

  const recovery = migration.slice(recoveryStart, recoveryEnd);

  assert(
    recovery.includes("set next_follow_up_at = attempt.prepared_at"),
    "Admin cancellation must restore the consumed due schedule.",
  );

  for (const forbidden of [
    "current_attempt =",
    "last_attempt_at =",
    "outreachEmailProvider",
    "sendTransactionalEmail",
  ]) {
    assert(
      !migration.includes(forbidden),
      `Cancellation must not mutate or invoke ${forbidden}.`,
    );
  }

  console.log(
    "PASS — Backlink outreach follow-up admin cancel recovery RPC smoke",
  );
}

void main();
