import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [migration, repository, types] = await Promise.all([
    readFile("supabase/migrations/20260902140000_gate_backlink_follow_up_send_by_global_volume_caps.sql", "utf8"),
    readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);

  for (const value of [
    "create or replace function public.mark_backlink_outreach_follow_up_attempt_requested",
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
    "FOLLOW_UP_SEND_WORKSPACE_CONTROL_MISSING",
    "FOLLOW_UP_SEND_BACKLINKS_DISABLED",
    "FOLLOW_UP_SEND_DRY_RUN",
    "FOLLOW_UP_SEND_CAMPAIGN_MISSING",
    "FOLLOW_UP_SEND_CAMPAIGN_NOT_ACTIVE",
    "FOLLOW_UP_SEND_CAMPAIGN_MISMATCH",
    "FOLLOW_UP_SEND_WORKSPACE_DAILY_RATE_LIMIT",
    "FOLLOW_UP_SEND_WORKSPACE_HOURLY_RATE_LIMIT",
    "FOLLOW_UP_SEND_DOMAIN_DAILY_RATE_LIMIT",
    "FOLLOW_UP_SEND_CONTACT_DAILY_RATE_LIMIT",
    "pg_advisory_xact_lock(hashtextextended('backlink_outreach_initial_attempt:' || p_workspace_id::text, 0))",
    "from public.automation_workspace_controls",
    "from public.backlink_campaigns",
    "campaign.status <> 'active'",
    "campaign.workspace_id <> outreach.workspace_id",
    "for update",
    "security definer",
    "set search_path = public",
    "grant execute",
  ]) assert(migration.includes(value), `Missing RPC invariant: ${value}`);

  const lockOrder = [
    "from public.backlink_outreach",
    "from public.automation_workspace_controls",
    "from public.backlink_campaigns",
    "from public.backlink_contacts",
    "from public.backlink_opportunities",
    "from public.backlink_outreach_attempts",
    "from public.backlink_outreach_follow_up_drafts",
    "from public.backlink_outreach_inbound_effects",
  ].map((value) => migration.indexOf(value));
  assert(lockOrder.every((index) => index >= 0), "RPC must include all lock/read participants.");
  assert(lockOrder.every((index, position) => position === 0 || index > lockOrder[position - 1]), "RPC lock order must be Outreach → workspace control → campaign → Contact → Opportunity → Attempt → Draft → Inbound effects.");

  const capStart = migration.indexOf("select count(*)::integer into workspace_count");
  const requestedTransition = migration.indexOf("update public.backlink_outreach_attempts set status = 'requested'");
  const capBlock = migration.slice(capStart, requestedTransition);
  assert(capStart > migration.indexOf("FOLLOW_UP_SEND_INBOUND_REPLY_STOPPED"), "Shared cap admission must occur after existing follow-up safety gates.");
  assert(capStart > migration.indexOf("pg_advisory_xact_lock"), "Shared caps must be checked under the initial-send advisory lock.");
  assert(requestedTransition > capStart, "Shared caps must be checked before prepared → requested.");
  for (const value of [
    "if workspace_count >= 5",
    "if hourly_count >= 2",
    "if domain_count >= 1",
    "if contact_count >= 1",
    "item.status in ('requested', 'accepted', 'failed', 'unknown')",
    "item_opportunity.domain_id = opportunity.domain_id",
    "item_outreach.contact_id = outreach.contact_id",
  ]) assert(capBlock.includes(value), `Missing shared cap invariant: ${value}`);
  for (const value of ["p_requested_at - interval '24 hours'", "p_requested_at - interval '1 hour'"]) {
    assert(migration.includes(value), `Missing shared cap window: ${value}`);
  }
  assert(!capBlock.includes("attempt_kind"), "Shared cap queries must not filter attempt_kind.");
  assert(!capBlock.includes("'prepared'"), "Prepared follow-up attempts must not consume shared caps.");

  for (const forbidden of [
    "outreachEmailProvider",
    "sendTransactionalEmail",
    "Resend",
    "next_follow_up_at =",
    "status = 'active'",
    "current_attempt = current_attempt + 1",
    "live_initial_send_enabled",
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
