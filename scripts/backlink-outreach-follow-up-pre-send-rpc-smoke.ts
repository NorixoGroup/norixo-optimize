import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [migration, repository, types] = await Promise.all([
    readFile("supabase/migrations/20260811161000_add_backlink_outreach_follow_up_pre_send_rpc.sql", "utf8"),
    readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);

  for (const value of [
    "create function public.mark_backlink_outreach_follow_up_attempt_requested",
    "status = 'requested'",
    "requested_at = p_requested_at",
    "'requested_now'",
    "'existing'",
    "draft.subject",
    "draft.body",
    "contact.contact_status in ('do_not_contact', 'archived')",
    "nullif(trim(contact.email_normalized), '') is null",
    "outreach.status <> 'active'",
    "outreach.current_attempt >= outreach.max_attempts",
    "effect.effect_kind = 'reply_received_stop'",
    "effect.status = 'applied'",
    "attempt.status <> 'prepared'",
    "attempt.status = 'requested'",
    "FOLLOW_UP_SEND_LEGACY_IDENTITY",
    "for update",
    "security definer",
    "set search_path = public",
    "grant execute",
  ]) assert(migration.includes(value), `Missing RPC invariant: ${value}`);

  const lockOrder = [
    "from public.backlink_outreach",
    "from public.backlink_contacts",
    "from public.backlink_outreach_attempts",
    "from public.backlink_outreach_follow_up_drafts",
    "from public.backlink_outreach_inbound_effects",
  ].map((value) => migration.indexOf(value));
  assert(lockOrder.every((index) => index >= 0), "RPC must include all lock/read participants.");
  assert(lockOrder.every((index, position) => position === 0 || index > lockOrder[position - 1]), "RPC lock order must be Outreach → Contact → Attempt → Draft → Inbound effects.");

  for (const forbidden of [
    "outreachEmailProvider",
    "sendTransactionalEmail",
    "Resend",
    "next_follow_up_at =",
    "status = 'active'",
    "current_attempt = current_attempt + 1",
  ]) assert(!migration.includes(forbidden), `Forbidden SQL behavior: ${forbidden}`);

  for (const value of [
    "markBacklinkOutreachFollowUpAttemptRequested",
    "mark_backlink_outreach_follow_up_attempt_requested",
    "disposition !== \"requested_now\" && disposition !== \"existing\"",
    "replyTokenHash",
    "replyTokenKeyVersion",
  ]) assert(repository.includes(value), `Missing repository wrapper invariant: ${value}`);

  for (const value of [
    "mark_backlink_outreach_follow_up_attempt_requested:",
    "p_actor_user_id: string",
    "p_requested_at: string",
    "reply_token_hash: string",
    "reply_token_key_version: string",
  ]) assert(types.includes(value), `Missing database type invariant: ${value}`);

  console.log("PASS — Backlink outreach follow-up pre-send RPC smoke");
}

void main();
