import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [migration, types] = await Promise.all([
    readFile("supabase/migrations/20260811150000_add_backlink_outreach_inbound_effects.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);
  for (const value of [
    "create table public.backlink_outreach_inbound_effects",
    "id uuid primary key default gen_random_uuid()",
    "workspace_id uuid not null references public.workspaces(id) on delete cascade",
    "inbound_message_id uuid not null references public.backlink_outreach_inbound_messages(id) on delete restrict",
    "outreach_id uuid not null references public.backlink_outreach(id) on delete restrict",
    "contact_id uuid not null references public.backlink_contacts(id) on delete restrict",
    "effect_kind text not null",
    "status text not null",
    "applied_at timestamptz not null",
    "created_at timestamptz not null default timezone('utc', now())",
    "unique (inbound_message_id)",
    "check (effect_kind = 'reply_received_stop')",
    "check (status = 'applied')",
    "validate_backlink_outreach_inbound_effect_integrity",
    "trg_backlink_outreach_inbound_effects_integrity",
    "BACKLINK_OUTREACH_INBOUND_EFFECT_INTEGRITY_MISMATCH",
    "enable row level security",
    "is_workspace_member(workspace_id)",
  ]) assert(migration.includes(value), `Missing inbound effect schema invariant: ${value}`);
  for (const forbiddenColumn of ["processed", "failed", "retry_count", "classification", "response_type", "body", "subject", "headers"]) {
    assert(!new RegExp(`\\b${forbiddenColumn}\\s+(text|jsonb|uuid|timestamptz|integer)`, "i").test(migration), `Forbidden inbound effect column: ${forbiddenColumn}`);
  }
  assert(!/on public\.backlink_outreach_inbound_effects for (insert|update|delete) to authenticated/i.test(migration), "No authenticated inbound-effect write policy is allowed.");
  assert(!/create (or replace )?function public\.(apply_|.*rpc)/i.test(migration), "C5a1 must not create an apply RPC.");
  for (const value of [
    "backlink_outreach_inbound_effects:",
    "applied_at: string",
    "contact_id: string",
    "inbound_message_id: string",
    "outreach_id: string",
    "effect_kind: string",
    "status: string",
    "workspace_id: string",
    'foreignKeyName: "backlink_outreach_inbound_effects_contact_id_fkey"',
    'foreignKeyName: "backlink_outreach_inbound_effects_inbound_message_id_fkey"',
    'foreignKeyName: "backlink_outreach_inbound_effects_outreach_id_fkey"',
    'foreignKeyName: "backlink_outreach_inbound_effects_workspace_id_fkey"',
  ]) assert(types.includes(value), `Missing inbound effect database type invariant: ${value}`);
  assert(!types.includes("backlink_outreach_inbound_effects: {\n        Args:"), "Inbound Effects must be a table, not a function.");
  console.log("PASS — Backlink outreach inbound effects schema smoke");
}

void main();
