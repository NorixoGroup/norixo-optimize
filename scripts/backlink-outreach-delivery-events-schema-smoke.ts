import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [migration, bounceMigration, types] = await Promise.all([
    readFile("supabase/migrations/20260811090000_add_backlink_outreach_delivery_events.sql", "utf8"),
    readFile("supabase/migrations/20260811110000_add_backlink_outreach_delivery_event_bounce_type.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);

  for (const value of [
    "create table public.backlink_outreach_delivery_events",
    "id uuid primary key default gen_random_uuid()",
    "workspace_id uuid not null references public.workspaces(id) on delete cascade",
    "outreach_id uuid not null references public.backlink_outreach(id) on delete restrict",
    "attempt_id uuid not null references public.backlink_outreach_attempts(id) on delete restrict",
    "provider text not null",
    "provider_event_id text not null",
    "provider_message_id text not null",
    "event_type text not null",
    "occurred_at timestamptz not null",
    "received_at timestamptz not null",
    "created_at timestamptz not null default timezone('utc', now())",
    "check (provider = 'resend')",
    "email.delivered",
    "email.delivery_delayed",
    "email.bounced",
    "email.complained",
    "unique (provider, provider_event_id)",
    "backlink_outreach_attempts_provider_message_id_unique",
    "where provider_message_id is not null",
    "(workspace_id, outreach_id, occurred_at desc)",
    "(attempt_id, occurred_at desc)",
    "validate_backlink_outreach_delivery_event_integrity",
    "trg_backlink_outreach_delivery_events_integrity",
    "attempt.outreach_id = new.outreach_id",
    "attempt.workspace_id = new.workspace_id",
    "outreach.workspace_id = new.workspace_id",
    "BACKLINK_OUTREACH_DELIVERY_EVENT_INTEGRITY_MISMATCH",
    "enable row level security",
    "is_workspace_member(workspace_id)",
  ]) assert(migration.includes(value), `Missing schema invariant: ${value}`);

  for (const forbiddenColumn of ["raw_payload", "recipient", "subject", "body", "sender", "headers"]) {
    assert(!new RegExp(`\\b${forbiddenColumn}\\s+(text|jsonb|uuid|timestamptz)`, "i").test(migration), `Forbidden delivery event column: ${forbiddenColumn}`);
  }
  for (const value of ["add column bounce_type text", "bounce_type in ('permanent', 'transient', 'undetermined', 'unknown')", "event_type <> 'email.bounced' and bounce_type is null"]) assert(bounceMigration.includes(value), `Missing bounce schema invariant: ${value}`);
  for (const forbiddenColumn of ["bounce_subtype", "bounce_message", "diagnostic_code"]) assert(!bounceMigration.includes(forbiddenColumn), `Forbidden bounce persistence column: ${forbiddenColumn}`);
  for (const forbiddenEvent of ["email.opened", "email.clicked", "email.received"]) assert(!migration.includes(forbiddenEvent), `Forbidden event type: ${forbiddenEvent}`);
  assert(!/on public\.backlink_outreach_delivery_events for (insert|update|delete) to authenticated/i.test(migration), "No authenticated delivery event write policy is allowed.");
  for (const forbiddenMutation of ["update public.backlink_outreach", "update public.backlink_outreach_attempts", "update public.backlink_contacts"]) assert(!migration.toLowerCase().includes(forbiddenMutation), `Forbidden lifecycle mutation: ${forbiddenMutation}`);
  for (const forbiddenBehavior of ["send", "scheduler", "follow_up"]) assert(!migration.toLowerCase().includes(`create ${forbiddenBehavior}`), `Forbidden schema behavior: ${forbiddenBehavior}`);

  for (const value of [
    "backlink_outreach_delivery_events:",
    "attempt_id: string",
    "bounce_type: string | null",
    "event_type: string",
    "occurred_at: string",
    "outreach_id: string",
    "provider_event_id: string",
    "provider_message_id: string",
    "received_at: string",
    "foreignKeyName: \"backlink_outreach_delivery_events_attempt_id_fkey\"",
    "foreignKeyName: \"backlink_outreach_delivery_events_outreach_id_fkey\"",
    "foreignKeyName: \"backlink_outreach_delivery_events_workspace_id_fkey\"",
  ]) assert(types.includes(value), `Missing database type invariant: ${value}`);

  console.log("PASS — Backlink outreach delivery events schema smoke");
}

void main();
