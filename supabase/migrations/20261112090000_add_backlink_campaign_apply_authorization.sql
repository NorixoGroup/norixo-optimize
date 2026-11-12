begin;

-- Lot E (campaign-apply step only): explicit, revocable, per-workspace human
-- authorization gating campaignApplyAuthorized, the autonomy pipeline's
-- existing campaign-preparation gate (lib/automation/backlink-autonomy-worker.ts,
-- backlink-master-autonomy-orchestrator.ts, backlink-downstream-task-handlers.ts).
-- That gate already triple-checks this fact; this migration only adds a
-- storage/grant/revoke mechanism and a read-only live check for it. It never
-- touches the orchestrator, the dispatcher, the handlers, dry_run_only, or
-- any send path.

alter table public.automation_workspace_controls
  add column campaign_apply_authorized_enabled boolean not null default false,
  add column campaign_apply_authorized_by uuid references auth.users(id) on delete set null,
  add column campaign_apply_authorized_at timestamptz;

alter table public.automation_workspace_controls
  add constraint automation_workspace_controls_campaign_apply_authorized_check
    check (
      (campaign_apply_authorized_enabled = false and campaign_apply_authorized_by is null and campaign_apply_authorized_at is null)
      or (campaign_apply_authorized_enabled = true and campaign_apply_authorized_by is not null and campaign_apply_authorized_at is not null)
    );

-- Grant/revoke: the ONLY path that may write the three columns above. A live,
-- double-authorized human session is structurally required (auth.uid());
-- service_role never has a session and can never satisfy this check.
create or replace function public.set_backlink_campaign_apply_authorization(
  p_workspace_id uuid,
  p_enabled boolean
)
returns table (
  workspace_id uuid,
  campaign_apply_authorized_enabled boolean,
  campaign_apply_authorized_by uuid,
  campaign_apply_authorized_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_row public.automation_workspace_controls%rowtype;
begin
  if v_actor_user_id is null
    or p_workspace_id is null
    or p_enabled is null
    or not public.is_norixo_private_admin()
    or not public.is_workspace_admin_or_owner(p_workspace_id) then
    raise exception 'CAMPAIGN_APPLY_AUTHORIZATION_UNAUTHORIZED';
  end if;

  update public.automation_workspace_controls as awc
  set
    campaign_apply_authorized_enabled = p_enabled,
    campaign_apply_authorized_by = case when p_enabled then v_actor_user_id else null end,
    campaign_apply_authorized_at = case when p_enabled then pg_catalog.timezone('utc', pg_catalog.now()) else null end,
    updated_by = v_actor_user_id,
    updated_at = pg_catalog.timezone('utc', pg_catalog.now())
  where awc.workspace_id = p_workspace_id
  returning awc.* into v_row;

  if not found then
    raise exception 'CAMPAIGN_APPLY_AUTHORIZATION_WORKSPACE_NOT_FOUND';
  end if;

  return query
  select v_row.workspace_id, v_row.campaign_apply_authorized_enabled,
    v_row.campaign_apply_authorized_by, v_row.campaign_apply_authorized_at;
end;
$$;

revoke all on function public.set_backlink_campaign_apply_authorization(uuid, boolean)
  from public, anon, service_role;
grant execute on function public.set_backlink_campaign_apply_authorization(uuid, boolean)
  to authenticated;

-- Unattended, read-only authorization check. No row is ever written by this
-- function — unlike apply_backlink_promotion_proposal_auto, there is no
-- per-entity application to create or replay here: this is purely a gate
-- consulted by the autonomy worker on every contact_validation/
-- mailbox_verification task completion, so it must never cache a stale
-- answer. Every call re-reads the stored grant and re-validates, live, that
-- the authorizing admin still holds both rights — exactly the same
-- staleness re-check already applied in apply_backlink_promotion_proposal_auto.
-- service_role-only; never callable by a human session.
create or replace function public.is_backlink_campaign_apply_authorized(
  p_workspace_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_control public.automation_workspace_controls%rowtype;
begin
  if p_workspace_id is null then
    return false;
  end if;

  select awc.* into v_control
  from public.automation_workspace_controls as awc
  where awc.workspace_id = p_workspace_id;

  if not found
    or v_control.campaign_apply_authorized_enabled is not true
    or v_control.campaign_apply_authorized_by is null
    or v_control.backlinks_enabled is not true
    or v_control.disabled_reason is not null then
    return false;
  end if;

  if not exists (
    select 1 from public.norixo_private_admins as npa where npa.user_id = v_control.campaign_apply_authorized_by
  ) or not exists (
    select 1 from public.workspace_members as wm
    where wm.workspace_id = p_workspace_id and wm.user_id = v_control.campaign_apply_authorized_by and wm.role in ('owner', 'admin')
  ) then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.is_backlink_campaign_apply_authorized(uuid)
  from public, anon, authenticated;
grant execute on function public.is_backlink_campaign_apply_authorized(uuid)
  to service_role;

comment on function public.set_backlink_campaign_apply_authorization(uuid, boolean) is
  'Grants or revokes per-workspace authorization for the autonomy pipeline to prepare campaigns/drafts (campaignApplyAuthorized). Requires a live, double-authorized human session; service_role has no session and can never call or satisfy this. Never authorizes any send: campaign_prepare/draft_prepare only create internal rows, and dry_run_only plus the send trigger remain independently enforced downstream.';
comment on function public.is_backlink_campaign_apply_authorized(uuid) is
  'Unattended, read-only, live authorization check for campaignApplyAuthorized. Re-validates on every call (never cached) that the authorizing admin is still in norixo_private_admins and still workspace owner/admin, in addition to the stored grant and workspace backlinks_enabled/disabled_reason state. service_role-only.';

commit;
