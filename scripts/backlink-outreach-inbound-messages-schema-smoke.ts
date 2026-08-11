import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";

async function main() {
  const [migration, types] = await Promise.all([
    readFile("supabase/migrations/20260811140000_add_backlink_outreach_inbound_messages.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);
  for (const value of [
    "create table public.backlink_outreach_inbound_messages",
    "id uuid primary key default gen_random_uuid()",
    "workspace_id uuid references public.workspaces(id) on delete cascade",
    "outreach_id uuid references public.backlink_outreach(id) on delete restrict",
    "attempt_id uuid references public.backlink_outreach_attempts(id) on delete restrict",
    "contact_id uuid references public.backlink_contacts(id) on delete restrict",
    "provider text not null",
    "provider_event_id text not null",
    "inbound_message_id text not null",
    "correlation_status text not null",
    "correlation_method text",
    "sender text not null",
    "recipient text not null",
    "subject text",
    "text_body text",
    "in_reply_to text",
    "references_header text",
    "received_at timestamptz not null",
    "occurred_at timestamptz not null",
    "created_at timestamptz not null default timezone('utc', now())",
    "provider = 'resend'",
    "('correlated', 'unmatched', 'ambiguous', 'ignored')",
    "('reply_token', 'rfc_headers')",
    "unique (provider, provider_event_id)",
    "char_length(text_body) <= 65536",
    "char_length(subject) <= 2048",
    "sender = trim(sender)",
    "recipient = trim(recipient)",
    "correlation_status = 'correlated' and workspace_id is not null and outreach_id is not null and attempt_id is not null and contact_id is not null and correlation_method is not null",
    "correlation_status in ('unmatched', 'ambiguous', 'ignored') and workspace_id is null and outreach_id is null and attempt_id is null and contact_id is null and correlation_method is null",
    "trg_backlink_outreach_inbound_messages_integrity",
    "BACKLINK_OUTREACH_INBOUND_MESSAGE_INTEGRITY_MISMATCH",
    "attempt.outreach_id = new.outreach_id",
    "outreach.contact_id = new.contact_id",
    "enable row level security",
    "correlation_status = 'correlated' and public.is_workspace_member(workspace_id)",
    "where workspace_id is not null",
    "(provider, inbound_message_id)",
  ]) assert(migration.includes(value), `Missing inbound schema contract: ${value}`);
  for (const forbidden of ["html_body", "attachments json", "attachments text", "raw_payload", "update public.backlink_outreach", "update public.backlink_contacts", "sendTransactionalEmail", "scheduler", "follow_up"]) assert(!migration.includes(forbidden), `Forbidden inbound schema content: ${forbidden}`);
  assert(!migration.includes("for insert to authenticated") && !migration.includes("for update to authenticated") && !migration.includes("for delete to authenticated"), "Inbound messages must not grant authenticated writes.");
  for (const value of [
    "backlink_outreach_inbound_messages:",
    "attempt_id: string | null",
    "contact_id: string | null",
    "correlation_method: string | null",
    "correlation_status: string",
    "inbound_message_id: string",
    "in_reply_to: string | null",
    "references_header: string | null",
    "text_body: string | null",
    "workspace_id: string | null",
    "foreignKeyName: \"backlink_outreach_inbound_messages_attempt_id_fkey\"",
    "foreignKeyName: \"backlink_outreach_inbound_messages_contact_id_fkey\"",
    "foreignKeyName: \"backlink_outreach_inbound_messages_outreach_id_fkey\"",
    "foreignKeyName: \"backlink_outreach_inbound_messages_workspace_id_fkey\"",
  ]) assert(types.includes(value), `Missing inbound database type: ${value}`);
  console.log("PASS — Backlink outreach inbound messages schema smoke");
}

void main();
