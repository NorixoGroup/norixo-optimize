import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const [base, kinds, state, keyVersion, types] = await Promise.all([
    readFile("supabase/migrations/20260810100000_add_backlink_outreach_attempts.sql", "utf8"),
    readFile("supabase/migrations/20260811155000_add_backlink_outreach_follow_up_attempt_reservation.sql", "utf8"),
    readFile("supabase/migrations/20260811156000_harden_backlink_outreach_follow_up_attempt_state_machine.sql", "utf8"),
    readFile("supabase/migrations/20260811158000_add_backlink_outreach_attempt_reply_token_key_version.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);
  for (const value of ["create table public.backlink_outreach_attempts", "actor_user_id uuid not null", "idempotency_key text not null", "Subject and body remain in backlink_outreach"]) assert(base.includes(value), `Missing base Attempt invariant: ${value}`);
  assert(!/\bsubject\s+(text|uuid)/.test(base) && !/\bbody\s+(text|uuid)/.test(base), "Attempts must not duplicate subject/body.");
  for (const value of ["add column attempt_kind text", "set attempt_kind = 'initial'", "alter column attempt_kind set not null", "check (attempt_kind in ('initial', 'follow_up'))"]) assert(kinds.includes(value), `Missing attempt_kind invariant: ${value}`);
  for (const value of ["add column prepared_at timestamptz", "add column cancelled_at timestamptz", "add column cancel_reason text", "status in ('prepared', 'requested', 'accepted', 'failed', 'unknown', 'cancelled')", "where status in ('prepared', 'requested', 'unknown')", "status = 'prepared'", "status = 'cancelled'", "prepared_at = requested_at, requested_at = null"]) assert(state.includes(value), `Missing state-machine invariant: ${value}`);
  assert(!state.includes("reply_token text"), "Only a reply-token hash may be persisted.");
  assert(keyVersion.includes("add column reply_token_key_version text"), "Reply-token key version must be nullable for legacy Attempts.");
  assert(keyVersion.includes("legacy non-reconstructible identity"), "Key-version migration must define legacy identity behavior.");
  assert(!/\breply_token\s+text\b/.test(keyVersion), "The raw reply token must never be persisted.");
  assert(!keyVersion.includes("reply_to_address"), "A Reply-To address must not be persisted.");
  for (const value of ["attempt_kind: string", "prepared_at: string | null", "cancelled_at: string | null", "cancel_reason: string | null", "reply_token_key_version: string | null", "reply_token_key_version?: string | null", "reserve_backlink_outreach_follow_up_attempt:", "cancel_backlink_outreach_prepared_follow_up_attempt:"]) assert(types.includes(value), `Missing Attempt database type: ${value}`);
  console.log("PASS — Backlink outreach attempt schema smoke");
}

void main();
