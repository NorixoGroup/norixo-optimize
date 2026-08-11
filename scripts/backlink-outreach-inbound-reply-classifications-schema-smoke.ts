import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [migration, types] = await Promise.all([
    readFile("supabase/migrations/20260811152000_add_backlink_outreach_inbound_reply_classifications.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);

  for (const value of [
    "create table public.backlink_outreach_inbound_reply_classifications",
    "id uuid primary key default gen_random_uuid()",
    "workspace_id uuid not null references public.workspaces(id) on delete cascade",
    "inbound_message_id uuid not null references public.backlink_outreach_inbound_messages(id) on delete restrict",
    "outreach_id uuid not null references public.backlink_outreach(id) on delete restrict",
    "contact_id uuid not null references public.backlink_contacts(id) on delete restrict",
    "classification text not null",
    "classified_by uuid not null references auth.users(id) on delete restrict",
    "classified_at timestamptz not null",
    "created_at timestamptz not null default timezone('utc', now())",
    "unique (inbound_message_id)",
    "classification in ('positive', 'negative')",
    "validate_backlink_outreach_inbound_reply_classification_integrity",
    "trg_backlink_outreach_inbound_reply_classifications_integrity",
    "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_INTEGRITY_MISMATCH",
    "inbound_message.correlation_status = 'correlated'",
    "inbound_message.correlation_method = 'reply_token'",
    "enable row level security",
    "is_workspace_member(workspace_id)",
    "(workspace_id, outreach_id, classified_at desc)",
  ]) assert(migration.includes(value), `Missing inbound reply classification schema invariant: ${value}`);

  const classificationCheck = migration.match(/constraint backlink_outreach_inbound_reply_classifications_classification_check\s+check \(([^)]+)\)/i)?.[1];
  assert(classificationCheck, "Missing inbound reply classification check constraint.");
  for (const forbiddenClassification of ["neutral", "bounced", "unsubscribed"]) {
    assert(!classificationCheck.includes(forbiddenClassification), `Forbidden classification value: ${forbiddenClassification}`);
  }
  for (const forbidden of ["updated_at", "status text", "resolved_at", "retry_count", "note", "response_body", "update public.backlink_outreach", "update public.backlink_contacts", "update public.backlink_outreach_inbound_effects", "sendTransactionalEmail", "scheduler", "follow_up"]) {
    assert(!new RegExp(`\\b${forbidden}\\b`, "i").test(migration), `Forbidden C6a schema content: ${forbidden}`);
  }
  assert(!/on public\.backlink_outreach_inbound_reply_classifications for (insert|update|delete) to authenticated/i.test(migration), "No authenticated classification write policy is allowed.");
  assert(!/create (or replace )?function public\.(apply_|.*classification.*rpc)/i.test(migration), "C6a must not create a classification RPC.");

  for (const value of [
    "backlink_outreach_inbound_reply_classifications:",
    "classification: string",
    "classified_at: string",
    "classified_by: string",
    "contact_id: string",
    "inbound_message_id: string",
    "outreach_id: string",
    "workspace_id: string",
    'foreignKeyName: "backlink_outreach_inbound_reply_classifications_contact_id_fkey"',
    'foreignKeyName: "backlink_outreach_inbound_reply_classifications_inbound_message_id_fkey"',
    'foreignKeyName: "backlink_outreach_inbound_reply_classifications_outreach_id_fkey"',
    'foreignKeyName: "backlink_outreach_inbound_reply_classifications_workspace_id_fkey"',
  ]) assert(types.includes(value), `Missing inbound reply classification database type invariant: ${value}`);
  assert(!types.includes("backlink_outreach_inbound_reply_classifications: {\n        Args:"), "Inbound reply classifications must be a table, not a function.");

  console.log("PASS — Backlink outreach inbound reply classifications schema smoke");
}

void main();
