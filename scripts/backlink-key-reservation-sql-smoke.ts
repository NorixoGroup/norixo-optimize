import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const [migration, databaseTypes] = await Promise.all([
    readFile(
      "supabase/migrations/20260803060000_add_backlink_key_reservation_rpc.sql",
      "utf8",
    ),
    readFile("types/database.types.ts", "utf8"),
  ]);

  for (const requirement of [
    "create or replace function public.reserve_backlink_key(p_kind text)",
    "returns text",
    "security definer",
    "set search_path = public",
    "when 'domain' then",
    "'BK-' || lpad(nextval('public.backlink_domain_key_sequence')::text, 4, '0')",
    "when 'opportunity' then",
    "'OP-' || lpad(nextval('public.backlink_opportunity_key_sequence')::text, 6, '0')",
    "raise exception 'BACKLINK_KEY_KIND_INVALID'",
    "revoke all on function public.reserve_backlink_key(text) from public",
    "revoke all on function public.reserve_backlink_key(text) from anon",
    "revoke all on function public.reserve_backlink_key(text) from authenticated",
    "grant execute on function public.reserve_backlink_key(text) to service_role",
    "comment on function public.reserve_backlink_key(text)",
  ]) {
    assert(migration.includes(requirement), `Missing migration requirement: ${requirement}`);
  }

  for (const forbidden of [
    "execute immediate",
    "format(",
    "insert into public.backlink_domains",
    "insert into public.backlink_opportunities",
    "update public.backlink_domains",
    "update public.backlink_opportunities",
    "delete from public.backlink_domains",
    "delete from public.backlink_opportunities",
    "alter sequence",
    "setval(",
    "create sequence",
    ") to anon",
    ") to authenticated",
  ]) {
    assert(!migration.includes(forbidden), `Forbidden SQL must be absent: ${forbidden}`);
  }

  for (const requirement of [
    "reserve_backlink_key: {",
    "p_kind: string",
    "Returns: string",
  ]) {
    assert(databaseTypes.includes(requirement), `Missing database type requirement: ${requirement}`);
  }

  console.log("PASS — Backlink key reservation SQL contract smoke");
}

void main();
