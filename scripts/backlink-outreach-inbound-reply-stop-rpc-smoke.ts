import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function between(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert(start >= 0 && end > start, "Inbound reply stop RPC definition is missing.");
  return source.slice(start, end);
}

async function main() {
  const [migration, types] = await Promise.all([
    readFile("supabase/migrations/20260811151000_add_backlink_outreach_inbound_reply_stop_rpc.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);
  const rpc = between(migration, "create or replace function public.apply_backlink_outreach_inbound_reply_stop", "revoke all on function public.apply_backlink_outreach_inbound_reply_stop");
  for (const value of [
    "p_inbound_message_id uuid",
    "p_applied_at timestamptz",
    "security definer",
    "set search_path = public",
    "where id = p_inbound_message_id",
    "for update",
    "BACKLINK_OUTREACH_INBOUND_REPLY_MESSAGE_NOT_FOUND",
    "BACKLINK_OUTREACH_INBOUND_REPLY_APPLIED_AT_REQUIRED",
    "inbound_message.correlation_status <> 'correlated'",
    "inbound_message.correlation_method <> 'reply_token'",
    "BACKLINK_OUTREACH_INBOUND_REPLY_SOURCE_INVALID",
    "inbound_message.workspace_id is null",
    "inbound_message.outreach_id is null",
    "inbound_message.attempt_id is null",
    "inbound_message.contact_id is null",
    "where effect.inbound_message_id = inbound_message.id",
    "'existing'",
    "BACKLINK_OUTREACH_INBOUND_REPLY_OUTREACH_MISMATCH",
    "BACKLINK_OUTREACH_INBOUND_REPLY_CONTACT_MISMATCH",
    "BACKLINK_OUTREACH_INBOUND_REPLY_INTEGRITY_MISMATCH",
    "BACKLINK_OUTREACH_INBOUND_REPLY_ATTEMPT_MISMATCH",
    "set next_follow_up_at = null",
    "'reply_received_stop'",
    "'applied'",
    "p_applied_at",
  ]) assert(rpc.includes(value), `Missing inbound reply stop RPC invariant: ${value}`);
  assert(rpc.indexOf("select * into inbound_message") < rpc.indexOf("select * into existing_effect"), "Inbound Message must be locked before idempotence evaluation.");
  assert(rpc.indexOf("select * into outreach") < rpc.indexOf("select * into contact"), "Lock order must be Inbound Message then Outreach then Contact.");
  assert(rpc.indexOf("insert into public.backlink_outreach_inbound_effects") > rpc.indexOf("update public.backlink_outreach"), "Effect insert must follow the atomic Outreach stop update.");
  const update = between(rpc, "update public.backlink_outreach", "insert into public.backlink_outreach_inbound_effects");
  assert(update.includes("set next_follow_up_at = null"), "The only Outreach update must clear next_follow_up_at.");
  for (const forbidden of ["status =", "last_response_type", "closed_at", "stop_reason", "current_attempt", "max_attempts", "first_contact_at", "last_attempt_at", "contact_id =", "campaign_id", "channel", "workspace_id = inbound_message", "outreachEmailProvider", "outreachEmailSendService", "sendTransactionalEmail", "resend", "scheduler"]) {
    assert(!update.includes(forbidden), `Inbound reply stop must not mutate or invoke ${forbidden}.`);
  }
  for (const forbidden of ["update public.backlink_contacts", "insert into public.backlink_outreach_attempts", "update public.backlink_outreach_attempts", "classification", "response_type"]) {
    assert(!rpc.includes(forbidden), `Inbound reply stop RPC must not use ${forbidden}.`);
  }
  for (const value of [
    "revoke all on function public.apply_backlink_outreach_inbound_reply_stop(uuid, timestamptz) from public, anon, authenticated",
    "grant execute on function public.apply_backlink_outreach_inbound_reply_stop(uuid, timestamptz) to service_role",
  ]) assert(migration.includes(value), `Missing inbound reply stop RPC permission: ${value}`);
  for (const value of [
    "apply_backlink_outreach_inbound_reply_stop:",
    "Args: { p_applied_at: string; p_inbound_message_id: string }",
    "disposition: string",
    "inbound_message_id: string",
    "outreach_id: string",
    "contact_id: string",
    "outreach_status: string",
    "applied_at: string",
  ]) assert(types.includes(value), `Missing inbound reply stop RPC database type: ${value}`);
  console.log("PASS — Backlink outreach inbound reply stop RPC smoke");
}

void main();
