-- RLS test harness, step 2/5: the schema state the real migrations expect
-- to find, i.e. the repo's state immediately BEFORE
-- supabase/migrations/20261028150000_create_norixo_private_admins_registry.sql
-- and
-- supabase/migrations/20261028160000_restrict_marketing_studio_tables_to_private_admins_policies.sql
-- are applied. Running the real migration files on top of this reproduces
-- the exact upgrade path (migration B's DROP POLICY / CREATE POLICY
-- statements act on real, pre-existing policies here, not on nothing).
--
-- public.is_workspace_member(uuid) and public.is_workspace_admin_or_owner(uuid)
-- below are copied verbatim from supabase/migrations/20260318120000_enable_workspace_rls.sql.
-- public.marketing_campaigns (table + 4 original policies) is copied verbatim
-- from 20260622120000_create_marketing_campaigns.sql + 20260622172000_marketing_campaigns_delete_policy.sql.
-- public.marketing_studio_generation_runs (table + 3 original policies) is
-- copied verbatim from the table/policy portion of
-- 20260709120000_create_marketing_studio_generation_runs.sql. Its three RPC
-- functions (enqueue_/claim_/heartbeat_marketing_studio_generation_run) are
-- deliberately NOT reproduced here -- see harness limitations in the
-- mission deliverable; they are not needed to exercise the RLS policies.
--
-- public.workspaces / public.workspace_members are NOT defined in any local
-- migration (they predate this repo's migrations folder) -- the columns
-- below are reconstructed from how every other migration uses them
-- (workspace_id/user_id/role, role in ('owner','admin') at minimum). This is
-- an approximation, not the real DDL -- see harness limitations.
--
-- Safe to re-run (every object uses IF NOT EXISTS / OR REPLACE).

do $$
begin
  if current_database() <> 'norixo_ai_rls_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_ai_rls_test.', current_database();
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
-- Verbatim from 20260622120000_create_marketing_campaigns.sql +
-- 20260622172000_marketing_campaigns_delete_policy.sql
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  objective text not null,
  language text not null default 'fr',
  timeframe text not null default '7 jours',
  channels text[] not null default array['Instagram', 'Facebook', 'LinkedIn', 'SEO'],
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'archived')),
  planner_json jsonb,
  social_json jsonb,
  creative_json jsonb,
  video_json jsonb,
  raw_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_campaigns enable row level security;

drop policy if exists "marketing_campaigns_select_workspace_members" on public.marketing_campaigns;
create policy "marketing_campaigns_select_workspace_members"
  on public.marketing_campaigns
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_campaigns.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "marketing_campaigns_insert_workspace_members" on public.marketing_campaigns;
create policy "marketing_campaigns_insert_workspace_members"
  on public.marketing_campaigns
  for insert
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_campaigns.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "marketing_campaigns_update_workspace_members" on public.marketing_campaigns;
create policy "marketing_campaigns_update_workspace_members"
  on public.marketing_campaigns
  for update
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_campaigns.workspace_id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_campaigns.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "marketing_campaigns_delete_workspace_members" on public.marketing_campaigns;
create policy "marketing_campaigns_delete_workspace_members"
  on public.marketing_campaigns
  for delete
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_campaigns.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Verbatim (table + 3 policies only) from
-- 20260709120000_create_marketing_studio_generation_runs.sql
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_studio_generation_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  submission_key text not null,
  request_id uuid not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  input_json jsonb not null,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_studio_generation_runs enable row level security;

create unique index if not exists marketing_studio_generation_runs_workspace_submission_idx
  on public.marketing_studio_generation_runs (workspace_id, submission_key);

drop policy if exists "marketing_studio_generation_runs_select_workspace_members" on public.marketing_studio_generation_runs;
create policy "marketing_studio_generation_runs_select_workspace_members"
  on public.marketing_studio_generation_runs
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_studio_generation_runs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "marketing_studio_generation_runs_insert_workspace_members" on public.marketing_studio_generation_runs;
create policy "marketing_studio_generation_runs_insert_workspace_members"
  on public.marketing_studio_generation_runs
  for insert
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_studio_generation_runs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "marketing_studio_generation_runs_update_workspace_members" on public.marketing_studio_generation_runs;
create policy "marketing_studio_generation_runs_update_workspace_members"
  on public.marketing_studio_generation_runs
  for update
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_studio_generation_runs.workspace_id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_studio_generation_runs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Base grants. Supabase's real projects grant anon/authenticated/service_role
-- broad default table privileges at project bootstrap time (not visible in
-- any migration file in this repo -- see the earlier security review).
-- Reproduced explicitly here so the harness tests RLS itself, not an
-- incidental GRANT difference from the real project.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.workspaces to anon, authenticated, service_role;
grant select, insert, update, delete on public.workspace_members to anon, authenticated, service_role;
grant select, insert, update, delete on public.marketing_campaigns to anon, authenticated, service_role;
grant select, insert, update, delete on public.marketing_studio_generation_runs to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- HARNESS-ONLY addition, not present in any real migration: the pre-existing,
-- shared `service_role` on this cluster was verified (read-only) to NOT have
-- BYPASSRLS, and this harness does not alter that shared, cross-project
-- role (see 01_bootstrap_auth_and_roles.sql). These permissive policies,
-- scoped to this database's own tables only, reproduce the *observable
-- effect* of BYPASSRLS for service_role (sees/writes every row) without
-- touching the role's global attributes. They model the real project's
-- behavior; they do not prove the real BYPASSRLS mechanism itself works --
-- see harness limitations in the mission deliverable.
-- ---------------------------------------------------------------------------

drop policy if exists "harness_service_role_bypass" on public.workspaces;
create policy "harness_service_role_bypass" on public.workspaces for all to service_role using (true) with check (true);

drop policy if exists "harness_service_role_bypass" on public.workspace_members;
create policy "harness_service_role_bypass" on public.workspace_members for all to service_role using (true) with check (true);

drop policy if exists "harness_service_role_bypass" on public.marketing_campaigns;
create policy "harness_service_role_bypass" on public.marketing_campaigns for all to service_role using (true) with check (true);

drop policy if exists "harness_service_role_bypass" on public.marketing_studio_generation_runs;
create policy "harness_service_role_bypass" on public.marketing_studio_generation_runs for all to service_role using (true) with check (true);
