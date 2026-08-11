import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [migration, types] = await Promise.all([
    readFile("supabase/migrations/20260811100000_add_backlink_outreach_delivery_effects.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);
  const start = migration.indexOf("create or replace function public.apply_backlink_outreach_provider_complaint");
  const end = migration.indexOf("revoke all on function public.apply_backlink_outreach_provider_complaint");
  assert(start >= 0 && end > start, "Complaint RPC definition is missing.");
  const rpc = migration.slice(start, end);

  for (const value of [
    "p_delivery_event_id uuid",
    "p_applied_at timestamptz default timezone('utc', now())",
    "security definer",
    "set search_path = public",
    "for update",
    "delivery_event.event_type <> 'email.complained'",
    "BACKLINK_OUTREACH_PROVIDER_COMPLAINT_EVENT_TYPE_INVALID",
    "BACKLINK_OUTREACH_PROVIDER_COMPLAINT_OUTREACH_MISMATCH",
    "BACKLINK_OUTREACH_PROVIDER_COMPLAINT_CONTACT_MISMATCH",
    "where effect.delivery_event_id = delivery_event.id",
    "'existing'",
    "contact_status = 'do_not_contact'",
    "do_not_contact_reason = 'provider_complaint'",
    "contact.contact_status = 'archived'",
    "if contact.do_not_contact_at is null and contact.do_not_contact_reason is null",
    "if outreach.status = 'active'",
    "status = 'closed'",
    "closed_at = effective_applied_at",
    "stop_reason = 'provider_complaint'",
    "last_response_type = null",
    "next_follow_up_at = null",
    "'provider_complaint_stop'",
    "'applied'",
    "'applied',",
  ]) assert(rpc.includes(value), `Missing complaint RPC invariant: ${value}`);

  for (const value of [
    "revoke all on function public.apply_backlink_outreach_provider_complaint(uuid, timestamptz) from public, anon, authenticated",
    "grant execute on function public.apply_backlink_outreach_provider_complaint(uuid, timestamptz) to service_role",
  ]) assert(migration.includes(value), `Missing complaint RPC permission: ${value}`);
  for (const forbidden of ["email.bounced", "backlink_outreach_attempts", "outreachEmailProvider", "sendTransactionalEmail", "resend("]) {
    assert(!rpc.toLowerCase().includes(forbidden.toLowerCase()), `Forbidden complaint RPC behavior: ${forbidden}`);
  }
  assert(rpc.indexOf("select * into delivery_event") < rpc.indexOf("select * into existing_effect"), "Delivery Event must be loaded before effect idempotence evaluation.");
  assert(rpc.indexOf("insert into public.backlink_outreach_delivery_effects") > rpc.indexOf("update public.backlink_outreach"), "Effect must be inserted after lifecycle mutations in the transaction.");

  for (const value of [
    "apply_backlink_outreach_provider_complaint:",
    "Args: { p_applied_at?: string; p_delivery_event_id: string }",
    "disposition: string",
    "delivery_event_id: string",
    "outreach_id: string",
    "contact_id: string",
    "contact_status: string",
    "outreach_status: string",
    "applied_at: string",
  ]) assert(types.includes(value), `Missing complaint RPC database type: ${value}`);

  console.log("PASS — Backlink outreach provider complaint RPC smoke");
}

void main();
