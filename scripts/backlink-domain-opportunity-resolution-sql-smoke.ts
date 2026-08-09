import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

async function main(): Promise<void> {
  const [migration, databaseTypes, repository, promotionMigration] = await Promise.all([
    readFile(
      "supabase/migrations/20260803070000_add_backlink_domain_opportunity_resolution_rpc.sql",
      "utf8",
    ),
    readFile("types/database.types.ts", "utf8"),
    readFile("lib/backlinks/repositories/domainOpportunityResolutionRepository.ts", "utf8"),
    readFile(
      "supabase/migrations/20260803050000_fix_apply_backlink_promotion_proposal_ambiguities.sql",
      "utf8",
    ),
  ]);

  for (const requirement of [
    "create or replace function public.resolve_backlink_domain_opportunity(",
    "returns table (",
    "domain_id uuid",
    "domain_key text",
    "domain_disposition text",
    "opportunity_id uuid",
    "opportunity_key text",
    "opportunity_disposition text",
    "qualification_status text",
    "security definer",
    "set search_path = public",
    "public.reserve_backlink_key('domain')",
    "public.reserve_backlink_key('opportunity')",
    "where d.workspace_id = p_workspace_id",
    "and d.hostname = p_hostname",
    "where o.workspace_id = p_workspace_id",
    "and o.domain_id = v_domain.id",
    "and o.target_page_url = p_target_page_url",
    "and o.opportunity_type = p_opportunity_type",
    "and o.asset_id = p_asset_id",
    "from public.backlink_assets as a",
    "raise exception 'BACKLINK_OPPORTUNITY_ASSET_WORKSPACE_MISMATCH'",
    "revoke all on function public.resolve_backlink_domain_opportunity(",
    ") from public;",
    ") from anon;",
    ") from authenticated;",
    ") to service_role;",
  ]) {
    assert(migration.includes(requirement), `Missing migration requirement: ${requirement}`);
  }
  assert(
    countOccurrences(migration, "exception when unique_violation then") === 2,
    "Expected unique-violation recovery for both Domain and Opportunity.",
  );

  for (const forbidden of [
    "execute immediate",
    "format(",
    "alter table",
    "alter sequence",
    "setval(",
    "create sequence",
    "'Needs Review'",
    "'To Research'",
    "'Not Started'",
    "'Tier C'",
    "'active'",
    ") to anon",
    ") to authenticated",
  ]) {
    assert(!migration.includes(forbidden), `Forbidden SQL must be absent: ${forbidden}`);
  }

  for (const requirement of [
    "resolve_backlink_domain_opportunity: {",
    "p_workspace_id: string",
    "qualification_status: string",
    "resolveBacklinkDomainOpportunityTransaction",
    "resolve_backlink_domain_opportunity",
  ]) {
    assert(
      databaseTypes.includes(requirement) || repository.includes(requirement),
      `Missing TypeScript contract requirement: ${requirement}`,
    );
  }

  assert(
    promotionMigration.includes("nextval('public.backlink_domain_key_sequence')"),
    "Promotion Domain key generation must remain unchanged.",
  );
  assert(
    promotionMigration.includes("nextval('public.backlink_opportunity_key_sequence')"),
    "Promotion Opportunity key generation must remain unchanged.",
  );
  assert(
    !promotionMigration.includes("resolve_backlink_domain_opportunity"),
    "Promotion RPC must not call the generic resolver in this lot.",
  );

  console.log("PASS — Backlink Domain/Opportunity resolution SQL contract smoke");
}

void main();
