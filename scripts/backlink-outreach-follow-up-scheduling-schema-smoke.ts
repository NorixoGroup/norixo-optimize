import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const [migration, types] = await Promise.all([
    readFile("supabase/migrations/20260811162000_add_backlink_outreach_response_deadline.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);

  for (const value of [
    "add column if not exists response_deadline_at timestamptz",
    "comment on column public.backlink_outreach.response_deadline_at",
    "Final response window deadline after the last accepted attempt",
  ]) assert(migration.includes(value), `Missing migration invariant: ${value}`);

  for (const forbidden of [
    "backfill",
    "update public.backlink_outreach",
    "create index",
    "scheduler",
    "worker",
    "provider",
    "send",
  ]) assert(!migration.toLowerCase().includes(forbidden), `Forbidden migration behavior: ${forbidden}`);

  for (const value of [
    "response_deadline_at: string | null",
    "response_deadline_at?: string | null",
  ]) assert(types.includes(value), `Missing database type invariant: ${value}`);

  const functionBlockStart = types.indexOf("mark_backlink_outreach_follow_up_attempt_requested");
  const responseDeadlineIndex = types.indexOf("response_deadline_at:");
  assert(functionBlockStart === -1 || responseDeadlineIndex < functionBlockStart, "response_deadline_at must be a table column, not a function.");

  console.log("PASS — Backlink outreach follow-up scheduling schema smoke");
}

void main();
