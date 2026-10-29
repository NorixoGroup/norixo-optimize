-- Rollback for supabase/migrations/20261028160000_restrict_marketing_studio_tables_to_private_admins_policies.sql
-- (the policy-activation migration; see also
-- supabase/migrations/20261028150000_create_norixo_private_admins_registry.sql,
-- which this rollback intentionally leaves in place -- see note below).
--
-- NOT a migration: it lives in scripts/ so the Supabase CLI never applies it automatically.
-- Run it manually (SQL editor / reviewed psql session) only to restore the seven original
-- workspace-member policies on marketing_campaigns and marketing_studio_generation_runs.
-- The clauses below are the exact text from migrations 20260622120000, 20260622172000 and
-- 20260709120000 -- nothing paraphrased, nothing summarized.
-- This does NOT execute anything by itself (do not run this file automatically).
-- It intentionally leaves public.norixo_private_admins and public.is_norixo_private_admin()
-- in place (harmless once unused); drop them explicitly at the end only if you also want to
-- remove the private-admin registry entirely.

begin;

drop policy if exists "marketing_campaigns_select_private_admin" on public.marketing_campaigns;
drop policy if exists "marketing_campaigns_insert_private_admin" on public.marketing_campaigns;
drop policy if exists "marketing_campaigns_update_private_admin" on public.marketing_campaigns;
drop policy if exists "marketing_campaigns_delete_private_admin" on public.marketing_campaigns;

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

drop policy if exists "marketing_studio_generation_runs_select_private_admin" on public.marketing_studio_generation_runs;
drop policy if exists "marketing_studio_generation_runs_insert_private_admin" on public.marketing_studio_generation_runs;
drop policy if exists "marketing_studio_generation_runs_update_private_admin" on public.marketing_studio_generation_runs;

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

commit;

-- Optional full teardown of the private-admin registry itself (separate,
-- deliberate step -- run only if you also want to remove it, not as part of
-- the policy rollback above):
--
-- drop function if exists public.is_norixo_private_admin();
-- drop table if exists public.norixo_private_admins;
