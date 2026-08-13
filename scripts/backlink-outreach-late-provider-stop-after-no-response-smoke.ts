import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [dominanceMigration, responseDeadlineMigration, finalNoResponseMigration] = await Promise.all([
    readFile("supabase/migrations/20260811153000_harden_backlink_provider_stop_signal_dominance.sql", "utf8"),
    readFile("supabase/migrations/20260811165000_add_backlink_outreach_response_deadline_clearing.sql", "utf8"),
    readFile("supabase/migrations/20260811167000_add_backlink_outreach_final_no_response.sql", "utf8"),
  ]);

  const complaintStart = dominanceMigration.indexOf("create or replace function public.apply_backlink_outreach_provider_complaint");
  const bounceStart = dominanceMigration.indexOf("create or replace function public.apply_backlink_outreach_provider_permanent_bounce");
  assert(complaintStart >= 0 && bounceStart > complaintStart, "Complaint RPC definition is missing.");
  const complaintRpc = dominanceMigration.slice(complaintStart, bounceStart);
  const bounceEnd = dominanceMigration.indexOf("comment on function public.apply_backlink_outreach_provider_complaint");
  assert(bounceStart >= 0 && bounceEnd > bounceStart, "Permanent bounce RPC definition is missing.");
  const bounceRpc = dominanceMigration.slice(bounceStart, bounceEnd);

  for (const value of [
    "p_delivery_event_id uuid",
    "p_applied_at timestamptz default timezone('utc', now())",
    "security definer",
    "set search_path = public",
    "select * into delivery_event",
    "for update",
    "delivery_event.event_type <> 'email.complained'",
    "delivery_event.event_type <> 'email.bounced' or delivery_event.bounce_type <> 'permanent'",
    "select * into existing_effect",
    "where effect.delivery_event_id = delivery_event.id",
    "return query select",
    "'existing'",
    "insert into public.backlink_outreach_delivery_effects",
    "'provider_complaint_stop'",
    "'provider_permanent_bounce_stop'",
    "'applied'",
    "contact.contact_status = 'archived'",
  ]) {
    assert(complaintRpc.includes(value) || bounceRpc.includes(value), `Missing late provider stop invariant: ${value}`);
  }

  assert(complaintRpc.includes("if contact.do_not_contact_at is null and contact.do_not_contact_reason is null"), "Complaint must preserve first-wins DNC metadata for archived contacts.");
  assert(complaintRpc.includes("if outreach.status = 'active'"), "Complaint must retain the active lifecycle branch.");
  assert(complaintRpc.includes("elsif outreach.status = 'replied'"), "Complaint must retain the replied lifecycle branch.");
  assert(complaintRpc.includes("stop_reason = 'provider_complaint'"), "Complaint must keep provider_complaint as the explicit stop reason in its active/replied branches.");
  assert(complaintRpc.includes("last_response_type = null"), "Complaint must preserve the human response audit in active branch.");
  assert(!complaintRpc.includes("status = 'no_response'"), "Complaint RPC must not rewrite no_response lifecycle.");

  assert(bounceRpc.includes("if contact.do_not_contact_at is null or char_length(trim(coalesce(contact.do_not_contact_reason, ''))) = 0"), "Bounce must preserve first-wins DNC metadata for archived contacts.");
  assert(bounceRpc.includes("if outreach.status = 'active'"), "Bounce must retain the active lifecycle branch.");
  assert(bounceRpc.includes("elsif outreach.status = 'replied'"), "Bounce must retain the replied lifecycle branch.");
  assert(bounceRpc.includes("stop_reason = 'provider_permanent_bounce'"), "Bounce must keep provider_permanent_bounce as the explicit stop reason in its active/replied branches.");
  assert(bounceRpc.includes("last_response_type = 'bounced'"), "Bounce must retain bounced only in the active branch.");
  assert(!bounceRpc.slice(bounceRpc.indexOf("elsif outreach.status = 'replied'")).includes("last_response_type = 'bounced'"), "Bounce must not overwrite last_response_type in the replied branch.");
  assert(!bounceRpc.includes("status = 'no_response'"), "Bounce RPC must not rewrite no_response lifecycle.");

  for (const value of [
    "response_deadline_at = null",
    "status in ('replied', 'conversation_open', 'declined', 'no_response', 'paused', 'closed')",
    "and outreach.status = 'active'",
    "and exists (",
    "reply_received_stop",
    "Atomically confirms a final no-response",
  ]) {
    assert(responseDeadlineMigration.includes(value) || finalNoResponseMigration.includes(value), `Missing final no-response hardening invariant: ${value}`);
  }

  assert(finalNoResponseMigration.includes("status = 'no_response'"), "Final no-response RPC must preserve the terminal no_response lifecycle.");
  assert(finalNoResponseMigration.includes("stop_reason = 'attempt_limit'"), "Final no-response RPC must preserve attempt_limit as the terminal reason.");
  assert(finalNoResponseMigration.includes("response_deadline_at = null"), "Final no-response RPC must clear the deadline and keep it cleared.");
  assert(finalNoResponseMigration.includes("next_follow_up_at = null"), "Final no-response RPC must keep follow-up scheduling cleared.");

  for (const forbidden of [
    "outreachEmailProvider",
    "outreachEmailSendService",
    "sendTransactionalEmail",
    "Resend",
    "scheduler",
  ]) {
    assert(!finalNoResponseMigration.includes(forbidden), `Forbidden late provider stop behavior: ${forbidden}`);
  }

  console.log("PASS — Backlink outreach late provider stop after no-response smoke");
}

void main();
