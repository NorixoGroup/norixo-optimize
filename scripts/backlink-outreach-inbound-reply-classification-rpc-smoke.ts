import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function between(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert(start >= 0 && end > start, "Inbound reply classification RPC definition is missing.");
  return source.slice(start, end);
}

async function main() {
  const [migration, forwardMigration, types, hardening] = await Promise.all([
    readFile("supabase/migrations/20260811154000_add_backlink_outreach_inbound_reply_classification_rpc.sql", "utf8"),
    readFile("supabase/migrations/20260816030000_allow_positive_inbound_reply_classification_convergence.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
    readFile("supabase/migrations/20260811153000_harden_backlink_provider_stop_signal_dominance.sql", "utf8"),
  ]);
  const rpc = between(migration, "create or replace function public.classify_backlink_outreach_inbound_reply", "revoke all on function public.classify_backlink_outreach_inbound_reply");
  const forwardRpc = between(forwardMigration, "create or replace function public.classify_backlink_outreach_inbound_reply", "revoke all on function public.classify_backlink_outreach_inbound_reply");

  for (const value of [
    "p_inbound_message_id uuid",
    "p_classification text",
    "p_classified_by uuid",
    "p_classified_at timestamptz",
    "security definer",
    "set search_path = public",
    "where id = p_inbound_message_id",
    "for update",
    "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_MESSAGE_NOT_FOUND",
    "p_classification not in ('positive', 'negative')",
    "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_INVALID",
    "inbound_message.correlation_status <> 'correlated'",
    "inbound_message.correlation_method <> 'reply_token'",
    "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_SOURCE_INVALID",
    "inbound_message.workspace_id is null",
    "inbound_message.outreach_id is null",
    "inbound_message.attempt_id is null",
    "inbound_message.contact_id is null",
    "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_INTEGRITY_MISMATCH",
    "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_ATTEMPT_MISMATCH",
    "effect.effect_kind = 'reply_received_stop'",
    "effect.status = 'applied'",
    "BACKLINK_OUTREACH_INBOUND_REPLY_STOP_REQUIRED",
    "where classification_row.inbound_message_id = inbound_message.id",
    "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_CONFLICT",
    "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_OUTREACH_NOT_ACTIVE",
    "insert into public.backlink_outreach_inbound_reply_classifications",
    "set status = 'replied'",
    "last_response_type = 'positive'",
    "set status = 'declined'",
    "last_response_type = 'negative'",
    "stop_reason = 'inbound_negative_reply'",
    "closed_at = p_classified_at",
    "next_follow_up_at = null",
    "'existing'",
    "'applied'",
  ]) assert(rpc.includes(value), `Missing inbound reply classification RPC invariant: ${value}`);

  assert(rpc.indexOf("select * into inbound_message") < rpc.indexOf("select * into outreach"), "Lock order must begin Inbound Message then Outreach.");
  assert(rpc.indexOf("select * into outreach") < rpc.indexOf("select * into contact"), "Lock order must continue Outreach then Contact.");
  assert(rpc.indexOf("insert into public.backlink_outreach_inbound_reply_classifications") < rpc.indexOf("update public.backlink_outreach"), "Classification audit must be inserted before the atomic lifecycle update.");
  assert(!rpc.includes("update public.backlink_contacts"), "Classification must not mutate Contact.");
  for (const forbidden of ["insert into public.backlink_outreach_attempts", "update public.backlink_outreach_attempts", "outreachEmailProvider", "outreachEmailSendService", "sendTransactionalEmail", "resend", "scheduler", "follow_up_at = timezone"]) {
    assert(!rpc.toLowerCase().includes(forbidden.toLowerCase()), `Forbidden classification RPC behavior: ${forbidden}`);
  }

  const positiveUpdate = between(rpc, "if p_classification = 'positive' then", "else\n    update public.backlink_outreach");
  const negativeUpdate = between(rpc, "else\n    update public.backlink_outreach", "end if;\n\n  return query select");
  for (const value of ["set status = 'replied'", "last_response_type = 'positive'", "next_follow_up_at = null", "closed_at = null", "stop_reason = null"]) assert(positiveUpdate.includes(value), `Missing positive transition invariant: ${value}`);
  for (const value of ["set status = 'declined'", "last_response_type = 'negative'", "closed_at = p_classified_at", "stop_reason = 'inbound_negative_reply'", "next_follow_up_at = null"]) assert(negativeUpdate.includes(value), `Missing negative transition invariant: ${value}`);

  for (const value of [
    "revoke all on function public.classify_backlink_outreach_inbound_reply(uuid, text, uuid, timestamptz) from public, anon, authenticated",
    "grant execute on function public.classify_backlink_outreach_inbound_reply(uuid, text, uuid, timestamptz) to service_role",
  ]) assert(migration.includes(value), `Missing classification RPC permission: ${value}`);
  for (const value of [
    "classify_backlink_outreach_inbound_reply:",
    "p_classification: string",
    "p_classified_at: string",
    "p_classified_by: string",
    "p_inbound_message_id: string",
    "classification: string",
    "classified_at: string",
    "contact_id: string",
    "disposition: string",
    "inbound_message_id: string",
    "outreach_id: string",
    "outreach_status: string",
  ]) assert(types.includes(value), `Missing classification RPC database type: ${value}`);
  assert(!types.includes("classify_backlink_outreach_inbound_reply: {\n        Row:"), "Classification RPC must not be typed as a table.");

  for (const raceInvariant of [
    "elsif outreach.status = 'replied'",
    "stop_reason = 'provider_complaint'",
    "stop_reason = 'provider_permanent_bounce'",
  ]) assert(hardening.includes(raceInvariant), `Missing provider dominance race invariant: ${raceInvariant}`);

  for (const value of [
    "outreach.status <> 'active'",
    "and not (",
    "p_classification = 'positive'",
    "outreach.status = 'replied'",
    "outreach.last_response_type = 'positive'",
    "outreach.closed_at is null",
    "outreach.stop_reason is null",
    "outreach.next_follow_up_at is null",
    "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_OUTREACH_NOT_ACTIVE",
  ]) assert(forwardRpc.includes(value), `Missing forward-only convergence invariant: ${value}`);
  assert(!migration.includes("and not ("), "Historical migration must not contain convergence guard.");

  console.log("PASS — Backlink outreach inbound reply classification RPC smoke");
}

void main();
