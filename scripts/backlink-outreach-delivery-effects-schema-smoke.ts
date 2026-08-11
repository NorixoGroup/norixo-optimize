import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [migration, permanentBounceMigration, types] = await Promise.all([
    readFile("supabase/migrations/20260811100000_add_backlink_outreach_delivery_effects.sql", "utf8"),
    readFile("supabase/migrations/20260811120000_add_backlink_outreach_permanent_bounce_effect.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);

  for (const value of [
    "create table public.backlink_outreach_delivery_effects",
    "id uuid primary key default gen_random_uuid()",
    "workspace_id uuid not null references public.workspaces(id) on delete cascade",
    "delivery_event_id uuid not null references public.backlink_outreach_delivery_events(id) on delete restrict",
    "outreach_id uuid not null references public.backlink_outreach(id) on delete restrict",
    "contact_id uuid not null references public.backlink_contacts(id) on delete restrict",
    "effect_kind text not null",
    "status text not null",
    "applied_at timestamptz",
    "created_at timestamptz not null default timezone('utc', now())",
    "unique (delivery_event_id)",
    "check (status = 'applied')",
    "enable row level security",
    "is_workspace_member(workspace_id)",
  ]) assert(migration.includes(value), `Missing delivery effect schema invariant: ${value}`);
  for (const value of [
    "drop constraint backlink_outreach_delivery_effects_effect_kind_check",
    "check (effect_kind in ('provider_complaint_stop', 'provider_permanent_bounce_stop'))",
  ]) assert(permanentBounceMigration.includes(value), `Missing permanent bounce effect schema invariant: ${value}`);
  assert(!permanentBounceMigration.includes("status in ("), "Effect status must remain limited to applied.");

  for (const forbiddenColumn of ["raw_payload", "subject", "body", "recipient"]) {
    assert(!new RegExp(`\\b${forbiddenColumn}\\s+(text|jsonb|uuid|timestamptz)`, "i").test(migration), `Forbidden delivery effect column: ${forbiddenColumn}`);
  }
  assert(!/on public\.backlink_outreach_delivery_effects for (insert|update|delete) to authenticated/i.test(migration), "No authenticated Delivery Effect write policy is allowed.");

  for (const value of [
    "backlink_outreach_delivery_effects:",
    "applied_at: string | null",
    "contact_id: string",
    "delivery_event_id: string",
    "effect_kind: string",
    "outreach_id: string",
    "status: string",
    "workspace_id: string",
    'foreignKeyName: "backlink_outreach_delivery_effects_contact_id_fkey"',
    'foreignKeyName: "backlink_outreach_delivery_effects_delivery_event_id_fkey"',
    'foreignKeyName: "backlink_outreach_delivery_effects_outreach_id_fkey"',
    'foreignKeyName: "backlink_outreach_delivery_effects_workspace_id_fkey"',
  ]) assert(types.includes(value), `Missing delivery effect database type invariant: ${value}`);
  assert(!types.includes("backlink_outreach_delivery_effects: {\n        Args:"), "Delivery Effects must be a table, not a function.");

  console.log("PASS — Backlink outreach delivery effects schema smoke");
}

void main();
