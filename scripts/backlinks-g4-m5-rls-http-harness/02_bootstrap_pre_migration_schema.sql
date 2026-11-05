-- G4-M5 Backlinks HTTP harness, step 2/3: the schema state the real
-- backlinks migrations expect to find, i.e. the repo's state immediately
-- BEFORE any backlink_* migration is applied.
--
-- Copied from scripts/backlinks-g4-m5-rls-test-harness/02_bootstrap_pre_migration_schema.sql
-- with only the database-name guard changed. public.is_workspace_member(uuid)
-- and public.is_workspace_admin_or_owner(uuid) below are copied verbatim
-- from supabase/migrations/20260318120000_enable_workspace_rls.sql.
--
-- public.workspaces / public.workspace_members are NOT defined in any local
-- migration (they predate this repo's migrations folder) -- the columns
-- below are reconstructed from how every backlink_* migration uses them.
--
-- Everything else is loaded by run_http_harness.sh from the REAL migration
-- files in supabase/migrations/ -- not reproduced here -- so the two Fix
-- migrations are tested against the literal SQL that runs in Production.
--
-- Safe to re-run (every object uses IF NOT EXISTS / OR REPLACE).

do $$
begin
  if current_database() <> 'norixo_g4_m5_rls_http_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_g4_m5_rls_http_test.', current_database();
  end if;
end
$$;

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

grant select, insert, update, delete on public.workspaces to anon, authenticated, service_role;
grant select, insert, update, delete on public.workspace_members to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
