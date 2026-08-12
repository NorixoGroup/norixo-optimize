import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function between(source: string, start: string, end: string): string { const from = source.indexOf(start); const to = source.indexOf(end, from); assert(from >= 0 && to > from, "Follow-up reservation RPC is missing."); return source.slice(from, to); }

async function main() {
  const [migration, types] = await Promise.all([
    readFile("supabase/migrations/20260811159000_adopt_backlink_outreach_attempt_reconstructible_reply_identity.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);
  const rpc = between(migration, "create function public.reserve_backlink_outreach_follow_up_attempt", "revoke all on function public.reserve_backlink_outreach_follow_up_attempt");
  for (const value of [
    "p_workspace_id uuid", "p_outreach_id uuid", "p_attempt_id uuid", "p_actor_user_id uuid", "p_idempotency_key text", "p_reply_token_hash text", "p_reply_token_key_version text", "p_reserved_at timestamptz", "security definer", "set search_path = public",
    "outreach.status <> 'active'", "outreach.channel <> 'email'", "outreach.next_follow_up_at is null", "outreach.next_follow_up_at > p_reserved_at", "outreach.current_attempt >= outreach.max_attempts",
    "contact.contact_status in ('do_not_contact', 'archived')", "attempt.status in ('prepared', 'requested', 'unknown')", "FOLLOW_UP_ATTEMPT_PREPARED", "FOLLOW_UP_ATTEMPT_IN_PROGRESS", "FOLLOW_UP_ATTEMPT_UNRESOLVED", "FOLLOW_UP_INBOUND_REPLY_STOPPED",
    "attempt_kind", "'follow_up'", "reply_token_hash", "reply_token_key_version", "normalized_key_version", "'prepared', p_reserved_at", "requested_at", "set next_follow_up_at = null", "'reserved'", "'existing'", "on conflict (workspace_id, idempotency_key) do nothing",
  ]) assert(rpc.includes(value), `Missing follow-up reservation invariant: ${value}`);
  assert(rpc.includes("values (p_attempt_id") && rpc.includes("normalized_token_hash, normalized_key_version"), "Reservation must persist the preallocated Attempt ID, hash, and key version.");
  assert(rpc.includes("normalized_token_hash !~ '^[0-9a-f]{64}$'") && rpc.includes("normalized_key_version !~ '^v[1-9][0-9]{0,15}$'"), "Reservation must reject missing or malformed reconstructible identity fields.");
  assert(rpc.indexOf("select * into outreach") < rpc.indexOf("select * into contact"), "Lock order must begin Outreach then Contact.");
  assert(rpc.indexOf("select * into contact") < rpc.indexOf("select * into open_attempt"), "Lock order must continue Contact then Attempts.");
  assert(rpc.indexOf("select * into open_attempt") < rpc.indexOf("select * into inbound_stop_effect"), "Lock order must finish Attempts then inbound effects.");
  assert(rpc.indexOf("insert into public.backlink_outreach_attempts") < rpc.indexOf("update public.backlink_outreach"), "Reservation must consume the schedule atomically after Attempt insertion.");
  for (const forbidden of ["outreachEmailProvider", "outreachEmailSendService", "sendTransactionalEmail", "scheduler", "provider_message_id", "current_attempt =", "'requested', p_reserved_at", "gen_random_uuid()"]) assert(!rpc.includes(forbidden), `Forbidden reservation behavior: ${forbidden}`);
  for (const value of ["p_attempt_id: string", "p_actor_user_id: string", "p_reply_token_hash: string", "p_reply_token_key_version: string", "prepared_at: string | null", "requested_at: string | null"]) assert(types.includes(value), `Missing reservation database type: ${value}`);
  console.log("PASS — Backlink outreach follow-up reservation RPC smoke");
}

void main();
