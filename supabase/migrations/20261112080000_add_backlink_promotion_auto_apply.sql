begin;

-- Lot A: unattended, strictly Tier A promotion auto-apply. Two new, narrowly
-- scoped RPCs; the existing human apply_backlink_promotion_proposal RPC,
-- its grants, and the human route are never touched.

alter table public.automation_workspace_controls
  add column promotion_auto_apply_enabled boolean not null default false,
  add column promotion_auto_apply_authorized_by uuid references auth.users(id) on delete set null,
  add column promotion_auto_apply_authorized_at timestamptz,
  add column promotion_auto_apply_last_applied_date date;

alter table public.automation_workspace_controls
  add constraint automation_workspace_controls_promotion_auto_apply_check
    check (
      (promotion_auto_apply_enabled = false and promotion_auto_apply_authorized_by is null and promotion_auto_apply_authorized_at is null)
      or (promotion_auto_apply_enabled = true and promotion_auto_apply_authorized_by is not null and promotion_auto_apply_authorized_at is not null)
    );

-- Grant/revoke: the ONLY path that may write the four columns above. A live,
-- double-authorized human session is structurally required (auth.uid());
-- service_role never has a session and can never satisfy this check, so it
-- can never self-authorize via this or any other normal path.
create or replace function public.set_backlink_promotion_auto_apply_authorization(
  p_workspace_id uuid,
  p_enabled boolean
)
returns table (
  workspace_id uuid,
  promotion_auto_apply_enabled boolean,
  promotion_auto_apply_authorized_by uuid,
  promotion_auto_apply_authorized_at timestamptz
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
    raise exception 'PROMOTION_AUTO_APPLY_AUTHORIZATION_UNAUTHORIZED';
  end if;

  update public.automation_workspace_controls as awc
  set
    promotion_auto_apply_enabled = p_enabled,
    promotion_auto_apply_authorized_by = case when p_enabled then v_actor_user_id else null end,
    promotion_auto_apply_authorized_at = case when p_enabled then pg_catalog.timezone('utc', pg_catalog.now()) else null end,
    updated_by = v_actor_user_id,
    updated_at = pg_catalog.timezone('utc', pg_catalog.now())
  where awc.workspace_id = p_workspace_id
  returning awc.* into v_row;

  if not found then
    raise exception 'PROMOTION_AUTO_APPLY_AUTHORIZATION_WORKSPACE_NOT_FOUND';
  end if;

  return query
  select v_row.workspace_id, v_row.promotion_auto_apply_enabled,
    v_row.promotion_auto_apply_authorized_by, v_row.promotion_auto_apply_authorized_at;
end;
$$;

revoke all on function public.set_backlink_promotion_auto_apply_authorization(uuid, boolean)
  from public, anon, service_role;
grant execute on function public.set_backlink_promotion_auto_apply_authorization(uuid, boolean)
  to authenticated;

-- Unattended auto-apply. Takes only references (workspace/run/task/proposal
-- key) — never a caller-supplied eligibility fact. Every field that decides
-- eligibility (tier, confidence, policy version, asset, conflict) is
-- re-derived inside this one transaction from the canonical, already-
-- completed backlinks.promotion.preview task output. service_role-only.
create or replace function public.apply_backlink_promotion_proposal_auto(
  p_workspace_id uuid,
  p_run_id uuid,
  p_promotion_task_id uuid,
  p_proposal_key text
)
returns table (
  application_id uuid,
  domain_id uuid,
  opportunity_id uuid,
  domain_disposition text,
  opportunity_disposition text,
  audit_written boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_control public.automation_workspace_controls%rowtype;
  v_resolved_task public.automation_tasks%rowtype;
  v_proposal jsonb;
  v_other_conflict jsonb;
  v_resolved_asset public.backlink_assets%rowtype;
  v_resolved_domain public.backlink_domains%rowtype;
  v_resolved_opportunity public.backlink_opportunities%rowtype;
  v_existing_application public.backlink_promotion_applications%rowtype;
  v_hostname text;
  v_target_page_url text;
  v_target_page_title text;
  v_opportunity_type text;
  v_page_type text;
  v_priority text;
  v_evidence_summary text;
  v_candidate_key text;
  v_suggested_asset_key text;
  v_qualification_score integer;
  v_qualification_confidence text;
  v_promotion_decision text;
  v_actor_user_id uuid;
  v_domain_disposition text;
  v_opportunity_disposition text;
  v_generated_key text;
  v_cap_rows_updated integer;
begin
  if p_workspace_id is null
    or p_run_id is null
    or p_promotion_task_id is null
    or p_proposal_key is null
    or p_proposal_key <> pg_catalog.btrim(p_proposal_key)
    or pg_catalog.char_length(p_proposal_key) not between 1 and 160 then
    raise exception 'PROMOTION_AUTO_APPLY_INVALID_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_workspace_id::text || ':' || p_promotion_task_id::text || ':' || p_proposal_key,
    0
  ));

  -- Re-read workspace authorization transactionally, with a row lock: a
  -- concurrent revocation (set_backlink_promotion_auto_apply_authorization)
  -- either commits before this SELECT (so this call sees it disabled and
  -- aborts) or blocks behind this transaction's lock until it commits/rolls
  -- back (so the revocation always wins the next attempt). Never trusts a
  -- caller-supplied authorization flag.
  -- dry_run_only is deliberately NOT part of this gate. This function only
  -- ever writes backlink_domains / backlink_opportunities /
  -- backlink_promotion_applications / backlink_activity — the same internal,
  -- non-sending rows the human apply_backlink_promotion_proposal RPC already
  -- creates today without checking dry_run_only either. It never creates an
  -- outreach row, calls a provider, or reaches any send path directly. Every
  -- stage between this function and an actual send (campaign_prepare,
  -- draft_prepare, outreach_decision, the human Ready/Send actions, and the
  -- DB trigger backlink_enforce_initial_email_send_gates()) independently
  -- re-checks dry_run_only on its own; none of them trust this function's
  -- having run. So Lot A may apply a promotion while dry_run_only=true
  -- (by design — this is exactly what lets it be piloted before any
  -- workspace's dry-run is ever lifted), and no external send becomes newly
  -- reachable by this path: campaignApplyAuthorized is unwired in production
  -- (a separate, already-documented downstream blocker), and even were it
  -- wired, the send machinery's own triple gate still applies unchanged.
  select awc.* into v_control
  from public.automation_workspace_controls as awc
  where awc.workspace_id = p_workspace_id
  for update;

  if not found
    or v_control.promotion_auto_apply_enabled is not true
    or v_control.promotion_auto_apply_authorized_by is null
    or v_control.backlinks_enabled is not true
    or v_control.disabled_reason is not null then
    raise exception 'PROMOTION_AUTO_APPLY_NOT_AUTHORIZED';
  end if;
  v_actor_user_id := v_control.promotion_auto_apply_authorized_by;

  -- Idempotent replay of an already-applied proposal never consumes the
  -- per-workspace-per-day cap below.
  select pa.* into v_existing_application
  from public.backlink_promotion_applications as pa
  where pa.workspace_id = p_workspace_id
    and pa.promotion_task_id = p_promotion_task_id
    and pa.proposal_key = p_proposal_key;

  if found then
    if v_existing_application.run_id <> p_run_id then
      raise exception 'PROMOTION_AUTO_APPLY_APPLICATION_MISMATCH';
    end if;
    return query
    select v_existing_application.id, v_existing_application.domain_id, v_existing_application.opportunity_id,
      v_existing_application.domain_disposition, v_existing_application.opportunity_disposition, true;
    return;
  end if;

  -- Only reached when a genuinely new application is about to be created
  -- (never for the idempotent replay above): the authorizing admin's rights
  -- are re-checked live, against the same canonical registries the grant RPC
  -- itself consults, not merely trusted from the moment authorization was
  -- granted. Either right having been withdrawn since then blocks this and
  -- every future new application for the workspace, without touching the
  -- stored authorization row itself (set_backlink_promotion_auto_apply_authorization
  -- remains the only path that writes it).
  if not exists (
    select 1 from public.norixo_private_admins as npa where npa.user_id = v_actor_user_id
  ) or not exists (
    select 1 from public.workspace_members as wm
    where wm.workspace_id = p_workspace_id and wm.user_id = v_actor_user_id and wm.role in ('owner', 'admin')
  ) then
    raise exception 'PROMOTION_AUTO_APPLY_AUTHORIZATION_STALE';
  end if;

  select t.* into v_resolved_task
  from public.automation_tasks as t
  where t.id = p_promotion_task_id
    and t.workspace_id = p_workspace_id
    and t.run_id = p_run_id;

  if not found then
    raise exception 'PROMOTION_AUTO_APPLY_TASK_NOT_FOUND';
  end if;
  if v_resolved_task.task_kind <> 'backlinks.promotion.preview' then
    raise exception 'PROMOTION_AUTO_APPLY_TASK_KIND_INVALID';
  end if;
  if v_resolved_task.status <> 'completed' then
    raise exception 'PROMOTION_AUTO_APPLY_TASK_NOT_COMPLETED';
  end if;
  if v_resolved_task.output is null or v_resolved_task.output ->> 'policyVersion' <> 'backlink-promotion-v1' then
    raise exception 'PROMOTION_AUTO_APPLY_POLICY_VERSION_INVALID';
  end if;

  select p into v_proposal
  from pg_catalog.jsonb_array_elements(coalesce(v_resolved_task.output -> 'proposals', '[]'::jsonb)) as p
  where p ->> 'proposalKey' = p_proposal_key;

  if v_proposal is null then
    raise exception 'PROMOTION_AUTO_APPLY_PROPOSAL_NOT_FOUND';
  end if;

  v_promotion_decision := v_proposal ->> 'promotionDecision';
  v_priority := v_proposal ->> 'priority';
  v_qualification_confidence := v_proposal ->> 'qualificationConfidence';
  v_hostname := v_proposal ->> 'hostname';
  v_target_page_url := v_proposal ->> 'targetPageUrl';
  v_target_page_title := v_proposal ->> 'targetPageTitle';
  v_opportunity_type := v_proposal ->> 'opportunityType';
  v_page_type := v_proposal ->> 'pageType';
  v_evidence_summary := v_proposal ->> 'evidenceSummary';
  v_candidate_key := v_proposal ->> 'candidateKey';
  v_suggested_asset_key := v_proposal ->> 'suggestedAssetKey';
  v_qualification_score := (v_proposal ->> 'qualificationScore')::integer;

  -- Strict Tier A eligibility, re-derived entirely from the canonical
  -- proposal above — never from a parameter. qualificationConfidence has
  -- only 'low'/'medium' in this system; there is no 'high' to compare against.
  if v_promotion_decision is distinct from 'propose'
    or v_priority is distinct from 'Tier A'
    or v_qualification_confidence is distinct from 'medium'
    or v_suggested_asset_key is null
    or pg_catalog.char_length(pg_catalog.btrim(v_suggested_asset_key)) = 0 then
    raise exception 'PROMOTION_AUTO_APPLY_PROPOSAL_NOT_ELIGIBLE';
  end if;

  -- Conflict check: no other *proposed* entry in the same preview output
  -- targets the same URL.
  select p into v_other_conflict
  from pg_catalog.jsonb_array_elements(coalesce(v_resolved_task.output -> 'proposals', '[]'::jsonb)) as p
  where p ->> 'proposalKey' is distinct from p_proposal_key
    and p ->> 'promotionDecision' = 'propose'
    and p ->> 'targetPageUrl' = v_target_page_url
  limit 1;

  if v_other_conflict is not null then
    raise exception 'PROMOTION_AUTO_APPLY_CONFLICTING_PROPOSAL';
  end if;

  -- backlink_assets_workspace_asset_key_unique already guarantees at most
  -- one row for (workspace_id, asset_key); "not found" is the only failure
  -- shape, never an ambiguity to arbitrate.
  select a.* into v_resolved_asset
  from public.backlink_assets as a
  where a.workspace_id = p_workspace_id
    and a.asset_key = v_suggested_asset_key
    and a.lifecycle_status = 'active';

  if not found then
    raise exception 'PROMOTION_AUTO_APPLY_ASSET_NOT_FOUND';
  end if;

  -- Per-workspace, per-day cap, independent of the per-proposal idempotency
  -- above: a conditional UPDATE is atomic under Postgres row locking inside
  -- this same transaction, so two genuinely concurrent auto-apply attempts
  -- for the same workspace can never both succeed on the same day, whatever
  -- proposal each targets.
  update public.automation_workspace_controls as awc
  set promotion_auto_apply_last_applied_date = current_date
  where awc.workspace_id = p_workspace_id
    and (awc.promotion_auto_apply_last_applied_date is null or awc.promotion_auto_apply_last_applied_date < current_date);

  get diagnostics v_cap_rows_updated = row_count;
  if v_cap_rows_updated = 0 then
    raise exception 'PROMOTION_AUTO_APPLY_WORKSPACE_LIMIT_REACHED';
  end if;

  -- From here on: the same domain/opportunity/activity resolution as the
  -- human apply_backlink_promotion_proposal RPC, intentionally duplicated so
  -- neither function depends on the other.
  loop
    select d.* into v_resolved_domain
    from public.backlink_domains as d
    where d.workspace_id = p_workspace_id and d.hostname = v_hostname;

    if found then
      if v_resolved_domain.lifecycle_status = 'archived' then
        raise exception 'PROMOTION_AUTO_APPLY_DOMAIN_ARCHIVED';
      end if;
      v_domain_disposition := 'existing';
      exit;
    end if;

    begin
      v_generated_key := 'BK-' || pg_catalog.lpad(pg_catalog.nextval('public.backlink_domain_key_sequence')::text, 4, '0');
      insert into public.backlink_domains as d (workspace_id, domain_key, hostname, created_by)
      values (p_workspace_id, v_generated_key, v_hostname, v_actor_user_id)
      returning d.* into v_resolved_domain;
      v_domain_disposition := 'created';
      exit;
    exception when unique_violation then
      select d.* into v_resolved_domain
      from public.backlink_domains as d
      where d.workspace_id = p_workspace_id and d.hostname = v_hostname;
      if found then
        if v_resolved_domain.lifecycle_status = 'archived' then
          raise exception 'PROMOTION_AUTO_APPLY_DOMAIN_ARCHIVED';
        end if;
        v_domain_disposition := 'existing';
        exit;
      end if;
    end;
  end loop;

  loop
    select o.* into v_resolved_opportunity
    from public.backlink_opportunities as o
    where o.domain_id = v_resolved_domain.id
      and o.target_page_url = v_target_page_url
      and o.opportunity_type = v_opportunity_type
      and o.asset_id = v_resolved_asset.id;

    if found then
      v_opportunity_disposition := 'existing';
      exit;
    end if;

    begin
      v_generated_key := 'OP-' || pg_catalog.lpad(pg_catalog.nextval('public.backlink_opportunity_key_sequence')::text, 6, '0');
      insert into public.backlink_opportunities as o (
        workspace_id, opportunity_key, domain_id, asset_id, opportunity_type,
        target_page_url, target_page_title, page_type, evidence_summary,
        qualification_status, discovery_status, editorial_status, priority,
        lifecycle_status, convention_risk, created_by
      ) values (
        p_workspace_id, v_generated_key, v_resolved_domain.id, v_resolved_asset.id, v_opportunity_type,
        v_target_page_url, v_target_page_title, v_page_type, v_evidence_summary,
        'Needs Review', 'Identified', 'Not Started', v_priority,
        'active', false, v_actor_user_id
      )
      returning o.* into v_resolved_opportunity;
      v_opportunity_disposition := 'created';
      exit;
    exception when unique_violation then
      select o.* into v_resolved_opportunity
      from public.backlink_opportunities as o
      where o.domain_id = v_resolved_domain.id
        and o.target_page_url = v_target_page_url
        and o.opportunity_type = v_opportunity_type
        and o.asset_id = v_resolved_asset.id;
      if found then
        v_opportunity_disposition := 'existing';
        exit;
      end if;
    end;
  end loop;

  begin
    v_generated_key := 'BL-ACT-' || pg_catalog.lpad(pg_catalog.nextval('public.backlink_activity_key_sequence')::text, 6, '0');
    insert into public.backlink_activity (
      workspace_id, activity_key, entity_type, entity_id, action_type, actor_user_id, reason, metadata
    ) values (
      p_workspace_id, v_generated_key, 'opportunity', v_resolved_opportunity.id,
      'automation_promotion_auto_applied', v_actor_user_id,
      'Promotion preview applied automatically under a pre-authorized workspace policy.',
      pg_catalog.jsonb_build_object(
        'automationRunId', p_run_id,
        'promotionTaskId', p_promotion_task_id,
        'proposalKey', p_proposal_key,
        'candidateKey', v_candidate_key,
        'qualificationScore', v_qualification_score,
        'qualificationConfidence', v_qualification_confidence,
        'promotionPolicyVersion', v_resolved_task.output ->> 'policyVersion',
        'domainDisposition', v_domain_disposition,
        'opportunityDisposition', v_opportunity_disposition,
        'authorizedBy', v_actor_user_id
      )
    );

    insert into public.backlink_promotion_applications as pa (
      workspace_id, run_id, promotion_task_id, proposal_key, candidate_key,
      domain_id, opportunity_id, promoted_by, domain_disposition, opportunity_disposition
    ) values (
      p_workspace_id, p_run_id, p_promotion_task_id, p_proposal_key, v_candidate_key,
      v_resolved_domain.id, v_resolved_opportunity.id, v_actor_user_id, v_domain_disposition, v_opportunity_disposition
    )
    returning pa.* into v_existing_application;
  exception when unique_violation then
    select pa.* into v_existing_application
    from public.backlink_promotion_applications as pa
    where pa.workspace_id = p_workspace_id
      and pa.promotion_task_id = p_promotion_task_id
      and pa.proposal_key = p_proposal_key;
    if not found then
      raise exception 'PROMOTION_AUTO_APPLY_APPLICATION_FAILED';
    end if;
    return query
    select v_existing_application.id, v_existing_application.domain_id, v_existing_application.opportunity_id,
      v_existing_application.domain_disposition, v_existing_application.opportunity_disposition, true;
    return;
  end;

  return query
  select v_existing_application.id, v_existing_application.domain_id, v_existing_application.opportunity_id,
    v_domain_disposition, v_opportunity_disposition, true;
end;
$$;

revoke all on function public.apply_backlink_promotion_proposal_auto(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.apply_backlink_promotion_proposal_auto(uuid, uuid, uuid, text)
  to service_role;

comment on function public.set_backlink_promotion_auto_apply_authorization(uuid, boolean) is
  'Grants or revokes per-workspace Tier A promotion auto-apply authorization. Requires a live, double-authorized human session; service_role has no session and can never call or satisfy this.';
comment on function public.apply_backlink_promotion_proposal_auto(uuid, uuid, uuid, text) is
  'Unattended auto-apply for strictly Tier A promotions. Re-derives every eligibility fact from the canonical completed promotion.preview task output inside one transaction; never trusts a caller-supplied value. Re-validates live, on every new (non-replay) application, that the authorizing admin is still in norixo_private_admins and still workspace owner/admin. Deliberately ignores dry_run_only: it only ever writes internal domain/opportunity/application/activity rows, never an outreach row, and every stage between it and an actual send independently re-checks dry_run_only on its own. service_role-only, duplicated from (never shared with) the human apply_backlink_promotion_proposal RPC.';

commit;
