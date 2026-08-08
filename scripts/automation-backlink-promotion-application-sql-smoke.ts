import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const [migration, fixMigration, databaseTypes] = await Promise.all([
    readFile(
      "supabase/migrations/20260803040000_add_backlink_promotion_applications.sql",
      "utf8",
    ),
    readFile(
      "supabase/migrations/20260803050000_fix_apply_backlink_promotion_proposal_ambiguities.sql",
      "utf8",
    ),
    readFile("types/database.types.ts", "utf8"),
  ]);

  const migrationRequirements = [
    "create sequence if not exists public.backlink_domain_key_sequence",
    "create sequence if not exists public.backlink_opportunity_key_sequence",
    "create sequence if not exists public.backlink_activity_key_sequence",
    "create table public.backlink_promotion_applications",
    "unique (workspace_id, promotion_task_id, proposal_key)",
    "references public.automation_runs(id)",
    "references public.automation_tasks(id)",
    "references public.backlink_domains(id)",
    "references public.backlink_opportunities(id)",
    "references auth.users(id)",
    "check (source = 'automation')",
    "check (domain_disposition in ('created', 'existing'))",
    "check (opportunity_disposition in ('created', 'existing'))",
    "enable row level security",
    "for select",
    "using (public.is_workspace_member(workspace_id))",
    "validate_backlink_promotion_application_integrity",
    "trg_backlink_promotion_applications_identity_immutable",
    "create or replace function public.apply_backlink_promotion_proposal",
    "security definer",
    "set search_path = public",
    "auth.uid() <> p_actor_user_id",
    "public.is_workspace_admin_or_owner(p_workspace_id)",
    "resolved_task.task_kind <> 'backlinks.promotion.preview'",
    "resolved_task.status <> 'completed'",
    "resolved_asset.lifecycle_status <> 'active'",
    "PROMOTION_DOMAIN_ARCHIVED",
    "pg_advisory_xact_lock",
    "from public.backlink_domains",
    "from public.backlink_opportunities",
    "exception when unique_violation",
    "'Needs Review'",
    "'Identified'",
    "'Not Started'",
    "'active'",
    "'automation_promotion_applied'",
    "jsonb_build_object",
    "PROMOTION_APPLICATION_MISMATCH",
    "grant execute on function public.apply_backlink_promotion_proposal",
    ") to authenticated",
  ];

  for (const requirement of migrationRequirements) {
    assert(migration.includes(requirement), `Missing migration requirement: ${requirement}`);
  }

  assert(!migration.includes("max("), "Promotion key generation must not use max + 1.");
  assert(!migration.includes("create policy \"backlink_promotion_applications_insert"), "Direct client insert policy must not exist.");
  assert(!migration.includes(") to anon"), "Promotion RPC must not be granted to anon.");
  assert(
    !migration.includes(") to service_role;"),
    "Promotion RPC must not be granted to service_role.",
  );
  assert(!migration.includes("execute immediate"), "Promotion RPC must not use dynamic SQL.");

  for (const requirement of [
    "create or replace function public.apply_backlink_promotion_proposal",
    "returns table (",
    "application_id uuid",
    "domain_id uuid",
    "opportunity_id uuid",
    "security definer",
    "set search_path = public",
    "v_existing_application",
    "v_resolved_domain",
    "v_resolved_opportunity",
    "v_domain_disposition",
    "v_opportunity_disposition",
    "from public.backlink_promotion_applications as pa",
    "from public.backlink_domains as d",
    "from public.backlink_opportunities as o",
    "where o.domain_id = v_resolved_domain.id",
    "returning pa.* into v_existing_application",
    "v_existing_application.id as application_id",
    "v_existing_application.domain_id as domain_id",
    "v_existing_application.opportunity_id as opportunity_id",
    "true as audit_written",
    "pg_advisory_xact_lock",
    "exception when unique_violation",
    "'automation_promotion_applied'",
    "raise exception 'PROMOTION_APPLICATION_MISMATCH'",
    ") from public, anon, service_role;",
    ") to authenticated;",
  ]) {
    assert(fixMigration.includes(requirement), `Missing ambiguity fix: ${requirement}`);
  }

  for (const dangerousPattern of [
    "into domain_id",
    "into opportunity_id",
    "into application_id",
    "where domain_id =",
    "where opportunity_id =",
    "select domain_id",
    "select opportunity_id",
    "return query select application_id, domain_id",
  ]) {
    assert(
      !fixMigration.includes(dangerousPattern),
      `Ambiguous SQL pattern must be absent: ${dangerousPattern}`,
    );
  }

  const typeRequirements = [
    "backlink_promotion_applications: {",
    "promotion_task_id: string",
    "proposal_key: string",
    "apply_backlink_promotion_proposal: {",
    "p_promotion_task_id: string",
    "application_id: string",
    "audit_written: boolean",
  ];

  for (const requirement of typeRequirements) {
    assert(databaseTypes.includes(requirement), `Missing Supabase type requirement: ${requirement}`);
  }

  console.log("PASS — Automation backlink promotion application SQL smoke");
}

void main();
