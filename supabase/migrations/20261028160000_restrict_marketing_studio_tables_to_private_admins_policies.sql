begin;

-- Deployment order for this migration (do NOT apply out of order):
--   1. 20261028150000_create_norixo_private_admins_registry.sql (table + function only).
--   2. Provision at least one private admin: scripts/marketing-studio-private-admin-provisioning.sql
--      (manual, service_role/SQL editor, operator fills in the real admin e-mail list).
--   3. Reconcile: scripts/marketing-studio-private-admin-reconciliation.sql (read-only,
--      must report PASS before proceeding).
--   4. THIS migration.
-- A standard `supabase db push` applies all pending migrations back-to-back with no
-- pause for step 2/3 in between -- so step 2/3 MUST be completed, and confirmed, before
-- this file is deployed/pushed at all. The guard below is the actual safety net if that
-- operational discipline is ever skipped: it aborts this entire transaction (nothing
-- commits, the seven original policies stay exactly as they are) rather than silently
-- locking out every admin.

do $$
begin
  if not exists (
    select 1
    from public.norixo_private_admins as npa
    join public.workspace_members as wm on wm.user_id = npa.user_id
  ) then
    raise exception
      'Refusing to activate Marketing Studio private-admin RLS policies: no row in norixo_private_admins has a matching workspace_members membership. Provision at least one private admin with real workspace access first -- see scripts/marketing-studio-private-admin-provisioning.sql and scripts/marketing-studio-private-admin-reconciliation.sql. Aborting; the seven original policies remain unchanged.';
  end if;
end
$$;

-- marketing_campaigns: previously any workspace member of any role could
-- select/insert/update/delete rows through their own session (confirmed:
-- every route touching this table -- publish-facebook, publish-post,
-- upload-video, approve, campaigns/[id], delete, duplicate, save -- uses the
-- caller's own Supabase session, never service_role). Tightened to require
-- BOTH is_norixo_private_admin() AND real membership of the row's own
-- workspace (public.is_workspace_member, membership only, no role check --
-- workspace_members.role is never used as a substitute for the private-admin
-- check). This does not assume a single Norixo workspace: each row is
-- evaluated against its own workspace_id, so it holds whether private admins
-- share one workspace or each have their own, as long as the relevant
-- workspace_members row exists for them (verified by the guard above, for at
-- least one admin, before this point is ever reached).
drop policy if exists "marketing_campaigns_select_workspace_members" on public.marketing_campaigns;
drop policy if exists "marketing_campaigns_insert_workspace_members" on public.marketing_campaigns;
drop policy if exists "marketing_campaigns_update_workspace_members" on public.marketing_campaigns;
drop policy if exists "marketing_campaigns_delete_workspace_members" on public.marketing_campaigns;
drop policy if exists "marketing_campaigns_select_private_admin" on public.marketing_campaigns;
drop policy if exists "marketing_campaigns_insert_private_admin" on public.marketing_campaigns;
drop policy if exists "marketing_campaigns_update_private_admin" on public.marketing_campaigns;
drop policy if exists "marketing_campaigns_delete_private_admin" on public.marketing_campaigns;

create policy "marketing_campaigns_select_private_admin"
  on public.marketing_campaigns
  for select
  to authenticated
  using (
    public.is_norixo_private_admin()
    and public.is_workspace_member(marketing_campaigns.workspace_id)
  );

create policy "marketing_campaigns_insert_private_admin"
  on public.marketing_campaigns
  for insert
  to authenticated
  with check (
    public.is_norixo_private_admin()
    and public.is_workspace_member(marketing_campaigns.workspace_id)
  );

create policy "marketing_campaigns_update_private_admin"
  on public.marketing_campaigns
  for update
  to authenticated
  using (
    public.is_norixo_private_admin()
    and public.is_workspace_member(marketing_campaigns.workspace_id)
  )
  with check (
    public.is_norixo_private_admin()
    and public.is_workspace_member(marketing_campaigns.workspace_id)
  );

create policy "marketing_campaigns_delete_private_admin"
  on public.marketing_campaigns
  for delete
  to authenticated
  using (
    public.is_norixo_private_admin()
    and public.is_workspace_member(marketing_campaigns.workspace_id)
  );

-- marketing_studio_generation_runs: the app's own enqueue/claim/heartbeat
-- paths already use service_role exclusively via
-- enqueue_marketing_studio_generation_run / claim_marketing_studio_generation_run
-- / heartbeat_marketing_studio_generation_run, plus the worker's own
-- markMarketingStudioGenerationRunCompleted/Failed writes to this table and
-- to marketing_campaigns -- all via the service_role admin client, so none of
-- this is affected by this change. These table-level policies only ever
-- mattered for a direct Supabase client call bypassing the app entirely;
-- tightened for the same reason and with the same workspace constraint as
-- marketing_campaigns above.
drop policy if exists "marketing_studio_generation_runs_select_workspace_members" on public.marketing_studio_generation_runs;
drop policy if exists "marketing_studio_generation_runs_insert_workspace_members" on public.marketing_studio_generation_runs;
drop policy if exists "marketing_studio_generation_runs_update_workspace_members" on public.marketing_studio_generation_runs;
drop policy if exists "marketing_studio_generation_runs_select_private_admin" on public.marketing_studio_generation_runs;
drop policy if exists "marketing_studio_generation_runs_insert_private_admin" on public.marketing_studio_generation_runs;
drop policy if exists "marketing_studio_generation_runs_update_private_admin" on public.marketing_studio_generation_runs;

create policy "marketing_studio_generation_runs_select_private_admin"
  on public.marketing_studio_generation_runs
  for select
  to authenticated
  using (
    public.is_norixo_private_admin()
    and public.is_workspace_member(marketing_studio_generation_runs.workspace_id)
  );

create policy "marketing_studio_generation_runs_insert_private_admin"
  on public.marketing_studio_generation_runs
  for insert
  to authenticated
  with check (
    public.is_norixo_private_admin()
    and public.is_workspace_member(marketing_studio_generation_runs.workspace_id)
  );

create policy "marketing_studio_generation_runs_update_private_admin"
  on public.marketing_studio_generation_runs
  for update
  to authenticated
  using (
    public.is_norixo_private_admin()
    and public.is_workspace_member(marketing_studio_generation_runs.workspace_id)
  )
  with check (
    public.is_norixo_private_admin()
    and public.is_workspace_member(marketing_studio_generation_runs.workspace_id)
  );

-- marketing_studio_meta_connections / marketing_studio_tiktok_connections /
-- marketing_studio_linkedin_connections are intentionally left untouched:
-- RLS is already enabled with zero policies for authenticated/anon on all
-- three (verified against every migration referencing them), so they are
-- already service_role-only. No change needed or made here.

commit;
