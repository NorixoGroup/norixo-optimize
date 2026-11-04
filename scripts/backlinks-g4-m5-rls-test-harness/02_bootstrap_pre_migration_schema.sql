-- G4-M5 Backlinks RLS test harness, step 2/5: the schema state the real
-- backlinks migrations expect to find, i.e. the repo's state immediately
-- BEFORE any backlink_* migration is applied.
--
-- public.is_workspace_member(uuid) and public.is_workspace_admin_or_owner(uuid)
-- below are copied verbatim from supabase/migrations/20260318120000_enable_workspace_rls.sql
-- (same text used by scripts/rls-test-harness/02_bootstrap_pre_migration_schema.sql).
--
-- public.workspaces / public.workspace_members are NOT defined in any local
-- migration (they predate this repo's migrations folder) -- the columns
-- below are reconstructed from how every backlink_* migration uses them
-- (workspace_id/user_id/role, role in ('owner','admin') at minimum). This is
-- an approximation, not the real DDL -- see harness limitations in the
-- mission deliverable.
--
-- Everything else (backlink_foundation, backlink_opportunities,
-- backlink_contacts, backlink_campaigns, backlink_outreach,
-- backlink_outreach_attempts, backlink_outreach_initial_attempt_snapshots,
-- and their prerequisite chain) is loaded by run_all.sh from the REAL
-- migration files in supabase/migrations/ -- not reproduced here -- so the
-- two new Fix migrations are tested against the literal SQL that will run
-- in Production, not an approximation of it.
--
-- Safe to re-run (every object uses IF NOT EXISTS / OR REPLACE).

do $$
begin
  if current_database() <> 'norixo_g4_m5_rls_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_g4_m5_rls_test.', current_database();
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Reconstructed (approximated) workspaces / workspace_members
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete cascade,
  name text,
  slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Verbatim from 20260318120000_enable_workspace_rls.sql
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin_or_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Base grants on the two reconstructed tables (every backlink_* table's own
-- grants/policies are created by the real migration files applied next).
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.workspaces to anon, authenticated, service_role;
grant select, insert, update, delete on public.workspace_members to anon, authenticated, service_role;

-- Real Supabase projects grant anon/authenticated/service_role broad default
-- table privileges at project bootstrap time (not visible in any migration
-- file in this repo -- same observation already documented in
-- scripts/rls-test-harness/02_bootstrap_pre_migration_schema.sql). Every
-- backlink_* table below is created by the real migration files (applied
-- next, by this same role), so this ALTER DEFAULT PRIVILEGES -- not a
-- per-table GRANT -- is what reproduces that bootstrap behavior for tables
-- this script does not itself create. Without it, RLS enablement would be
-- untestable: every SELECT would already fail with "permission denied",
-- masking whether a policy exists at all.
alter default privileges for role mac in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
