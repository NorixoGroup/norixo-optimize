import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const migration = await readFile("supabase/migrations/20260811156000_harden_backlink_outreach_follow_up_attempt_state_machine.sql", "utf8");
  for (const value of ["trg_backlink_outreach_inbound_effects_cancel_prepared_follow_up", "trg_backlink_outreach_cancel_prepared_follow_up_for_provider_stop", "cancel_prepared_backlink_outreach_follow_up_attempts_for_inbound_stop", "cancel_prepared_backlink_outreach_follow_up_attempts_for_provider_stop", "cancel_reason = 'inbound_reply'", "provider_complaint", "provider_permanent_bounce", "attempt_kind = 'follow_up' and status = 'prepared'", "status = 'cancelled'"]) assert(migration.includes(value), `Missing stop-cancellation invariant: ${value}`);
  for (const forbidden of ["outreachEmailProvider", "outreachEmailSendService", "sendTransactionalEmail", "scheduler", "provider_message_id =", "next_follow_up_at = timezone"]) assert(!migration.includes(forbidden), `Stop cancellation must not ${forbidden}.`);
  console.log("PASS — Backlink outreach follow-up stop cancellation smoke");
}

void main();
