import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [migration, originalMigration, types] = await Promise.all([
    readFile("supabase/migrations/20260811153000_harden_backlink_provider_stop_signal_dominance.sql", "utf8"),
    readFile("supabase/migrations/20260811120000_add_backlink_outreach_permanent_bounce_effect.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);
  const start = migration.indexOf("create or replace function public.apply_backlink_outreach_provider_permanent_bounce");
  const end = migration.indexOf("comment on function public.apply_backlink_outreach_provider_complaint");
  assert(start >= 0 && end > start, "Permanent bounce RPC definition is missing.");
  const rpc = migration.slice(start, end);

  for (const value of [
    "p_delivery_event_id uuid",
    "p_applied_at timestamptz default timezone('utc', now())",
    "security definer",
    "set search_path = public",
    "where id = p_delivery_event_id",
    "for update",
    "delivery_event.event_type <> 'email.bounced' or delivery_event.bounce_type <> 'permanent'",
    "BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_EVENT_INVALID",
    "BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_OUTREACH_MISMATCH",
    "BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_CONTACT_MISMATCH",
    "where effect.delivery_event_id = delivery_event.id",
    "contact.contact_status = 'archived'",
    "contact_status = 'do_not_contact'",
    "coalesce(contact.do_not_contact_at, effective_applied_at)",
    "provider_permanent_bounce",
    "if outreach.status = 'active'",
    "elsif outreach.status = 'replied'",
    "status = 'closed'",
    "last_response_type = 'bounced'",
    "next_follow_up_at = null",
    "'provider_permanent_bounce_stop'",
    "'existing'",
    "'applied'",
  ]) assert(rpc.includes(value), `Missing permanent bounce RPC invariant: ${value}`);
  const activeBranch = rpc.slice(rpc.indexOf("if outreach.status = 'active'"), rpc.indexOf("elsif outreach.status = 'replied'"));
  const repliedBranch = rpc.slice(rpc.indexOf("elsif outreach.status = 'replied'"), rpc.indexOf("end if;", rpc.indexOf("elsif outreach.status = 'replied'")));
  assert(activeBranch.includes("last_response_type = 'bounced'"), "Permanent bounce must keep its existing active behavior.");
  assert(!repliedBranch.includes("last_response_type ="), "Permanent bounce must preserve last_response_type for replied Outreach.");
  assert(repliedBranch.includes("status = 'closed'") && repliedBranch.includes("closed_at = effective_applied_at") && repliedBranch.includes("stop_reason = 'provider_permanent_bounce'") && repliedBranch.includes("next_follow_up_at = null"), "Permanent bounce must close replied Outreach without overwriting human response audit.");
  assert(!/outreach\.status\s*(<>|!=)/.test(rpc) && !rpc.includes("in ('active', 'replied'"), "Permanent bounce dominance must be limited to explicit active and replied branches.");
  for (const forbidden of ["backlink_outreach_attempts", "outreachEmailProvider", "outreachEmailSendService", "sendTransactionalEmail", "resend(", "scheduler"]) assert(!rpc.toLowerCase().includes(forbidden.toLowerCase()), `Forbidden permanent bounce RPC behavior: ${forbidden}`);
  assert(rpc.indexOf("select * into delivery_event") < rpc.indexOf("select * into outreach"), "Lock order must start with Delivery Event.");
  assert(rpc.indexOf("select * into outreach") < rpc.indexOf("select * into contact"), "Lock order must be Delivery Event then Outreach then Contact.");
  assert(rpc.indexOf("insert into public.backlink_outreach_delivery_effects") > rpc.indexOf("update public.backlink_outreach"), "Effect insert must follow lifecycle mutations atomically.");
  for (const value of [
    "revoke all on function public.apply_backlink_outreach_provider_permanent_bounce(uuid, timestamptz) from public, anon, authenticated",
    "grant execute on function public.apply_backlink_outreach_provider_permanent_bounce(uuid, timestamptz) to service_role",
    "apply_backlink_outreach_provider_permanent_bounce:",
    "Args: { p_applied_at?: string; p_delivery_event_id: string }",
    "disposition: string",
    "delivery_event_id: string",
    "outreach_id: string",
    "contact_id: string",
    "contact_status: string",
    "outreach_status: string",
    "applied_at: string",
  ]) assert((value.startsWith("revoke") || value.startsWith("grant") ? originalMigration : types).includes(value), `Missing permanent bounce RPC contract: ${value}`);

  console.log("PASS — Backlink outreach provider permanent bounce RPC smoke");
}

void main();
