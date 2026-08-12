import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function between(source: string, start: string, end: string): string { const from = source.indexOf(start); const to = source.indexOf(end, from); assert(from >= 0 && to > from, "Follow-up cancellation RPC is missing."); return source.slice(from, to); }

async function main() {
  const migration = await readFile("supabase/migrations/20260811156000_harden_backlink_outreach_follow_up_attempt_state_machine.sql", "utf8");
  const rpc = between(migration, "create function public.cancel_backlink_outreach_prepared_follow_up_attempt", "create or replace function public.cancel_prepared_backlink_outreach_follow_up_attempts_for_inbound_stop");
  for (const value of ["p_workspace_id uuid", "p_outreach_id uuid", "p_attempt_id uuid", "p_cancel_reason text", "p_cancelled_at timestamptz", "security definer", "set search_path = public", "attempt.attempt_kind <> 'follow_up'", "attempt.status = 'cancelled'", "attempt.status <> 'prepared'", "FOLLOW_UP_CANCEL_CONFLICT", "status = 'cancelled'", "cancelled_at = p_cancelled_at", "cancel_reason = normalized_reason", "'cancelled'", "'existing'"]) assert(rpc.includes(value), `Missing cancellation invariant: ${value}`);
  assert(rpc.indexOf("select * into outreach") < rpc.indexOf("select * into attempt"), "Cancellation must lock Outreach before Attempt.");
  for (const forbidden of ["provider_message_id", "current_attempt", "next_follow_up_at", "outreachEmailProvider", "sendTransactionalEmail", "scheduler"]) assert(!rpc.includes(forbidden), `Cancellation must not mutate or invoke ${forbidden}.`);
  console.log("PASS — Backlink outreach follow-up cancel RPC smoke");
}

void main();
