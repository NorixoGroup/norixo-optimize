begin;

create sequence if not exists public.backlink_domain_key_sequence;
create sequence if not exists public.backlink_opportunity_key_sequence;
create sequence if not exists public.backlink_activity_key_sequence;

create table public.backlink_promotion_applications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.automation_runs(id) on delete restrict,
  promotion_task_id uuid not null references public.automation_tasks(id) on delete restrict,
  proposal_key text not null,
  candidate_key text not null,
  domain_id uuid not null references public.backlink_domains(id) on delete restrict,
  opportunity_id uuid not null references public.backlink_opportunities(id) on delete restrict,
  promoted_by uuid not null references auth.users(id) on delete restrict,
  promoted_at timestamptz not null default timezone('utc', now()),
  domain_disposition text not null,
  opportunity_disposition text not null,
  source text not null default 'automation',
  constraint backlink_promotion_applications_idempotency_unique
    unique (workspace_id, promotion_task_id, proposal_key),
  constraint backlink_promotion_applications_proposal_key_check
    check (proposal_key = trim(proposal_key) and char_length(proposal_key) between 1 and 160),
  constraint backlink_promotion_applications_candidate_key_check
    check (candidate_key = trim(candidate_key) and char_length(candidate_key) between 1 and 160),
  constraint backlink_promotion_applications_domain_disposition_check
    check (domain_disposition in ('created', 'existing')),
  constraint backlink_promotion_applications_opportunity_disposition_check
    check (opportunity_disposition in ('created', 'existing')),
  constraint backlink_promotion_applications_source_check
    check (source = 'automation')
);

create index backlink_promotion_applications_workspace_promoted_idx
  on public.backlink_promotion_applications (workspace_id, promoted_at desc);
create index backlink_promotion_applications_task_idx
  on public.backlink_promotion_applications (promotion_task_id);
create index backlink_promotion_applications_opportunity_idx
  on public.backlink_promotion_applications (opportunity_id);
create index backlink_promotion_applications_promoted_by_idx
  on public.backlink_promotion_applications (promoted_by);

create or replace function public.validate_backlink_promotion_application_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.automation_runs as automation_run
    where automation_run.id = new.run_id
      and automation_run.workspace_id = new.workspace_id
  ) then
    raise exception 'PROMOTION_APPLICATION_RUN_WORKSPACE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.automation_tasks as automation_task
    where automation_task.id = new.promotion_task_id
      and automation_task.workspace_id = new.workspace_id
      and automation_task.run_id = new.run_id
      and automation_task.task_kind = 'backlinks.promotion.preview'
  ) then
    raise exception 'PROMOTION_APPLICATION_TASK_SCOPE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.backlink_domains as domain
    where domain.id = new.domain_id
      and domain.workspace_id = new.workspace_id
  ) then
    raise exception 'PROMOTION_APPLICATION_DOMAIN_WORKSPACE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.backlink_opportunities as opportunity
    where opportunity.id = new.opportunity_id
      and opportunity.workspace_id = new.workspace_id
      and opportunity.domain_id = new.domain_id
  ) then
    raise exception 'PROMOTION_APPLICATION_OPPORTUNITY_WORKSPACE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = new.workspace_id
      and member.user_id = new.promoted_by
      and member.role in ('owner', 'admin')
  ) then
    raise exception 'PROMOTION_APPLICATION_ACTOR_WORKSPACE_MISMATCH';
  end if;

  return new;
end;
$$;

create trigger trg_backlink_promotion_applications_integrity
before insert or update of workspace_id, run_id, promotion_task_id, proposal_key, candidate_key, domain_id, opportunity_id, promoted_by
on public.backlink_promotion_applications
for each row
execute function public.validate_backlink_promotion_application_integrity();

create or replace function public.prevent_backlink_promotion_application_identity_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.run_id is distinct from old.run_id
    or new.promotion_task_id is distinct from old.promotion_task_id
    or new.proposal_key is distinct from old.proposal_key
    or new.candidate_key is distinct from old.candidate_key
    or new.domain_id is distinct from old.domain_id
    or new.opportunity_id is distinct from old.opportunity_id
    or new.promoted_by is distinct from old.promoted_by then
    raise exception 'PROMOTION_APPLICATION_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_promotion_applications_identity_immutable
before update on public.backlink_promotion_applications
for each row
execute function public.prevent_backlink_promotion_application_identity_update();

alter table public.backlink_promotion_applications enable row level security;

create policy "backlink_promotion_applications_select_workspace_members"
on public.backlink_promotion_applications
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.apply_backlink_promotion_proposal(
  p_workspace_id uuid,
  p_actor_user_id uuid,
  p_run_id uuid,
  p_promotion_task_id uuid,
  p_proposal_key text,
  p_candidate_key text,
  p_hostname text,
  p_target_page_url text,
  p_target_page_title text,
  p_opportunity_type text,
  p_page_type text,
  p_priority text,
  p_evidence_summary text,
  p_asset_id uuid,
  p_qualification_score integer,
  p_qualification_confidence text,
  p_promotion_policy_version text
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
set search_path = public
as $$
declare
  existing_application public.backlink_promotion_applications;
  resolved_domain public.backlink_domains;
  resolved_asset public.backlink_assets;
  resolved_opportunity public.backlink_opportunities;
  resolved_task public.automation_tasks;
  domain_disposition_value text;
  opportunity_disposition_value text;
  generated_key text;
begin
  if auth.uid() is null
    or p_actor_user_id is null
    or auth.uid() <> p_actor_user_id
    or not public.is_workspace_admin_or_owner(p_workspace_id) then
    raise exception 'PROMOTION_UNAUTHORIZED';
  end if;

  if p_workspace_id is null
    or p_run_id is null
    or p_promotion_task_id is null
    or p_asset_id is null
    or p_proposal_key is null
    or p_proposal_key <> trim(p_proposal_key)
    or char_length(p_proposal_key) not between 1 and 160
    or p_candidate_key is null
    or p_candidate_key <> trim(p_candidate_key)
    or char_length(p_candidate_key) not between 1 and 160
    or p_hostname is null
    or p_hostname <> lower(trim(p_hostname))
    or char_length(p_hostname) not between 3 and 253
    or p_hostname !~ '^[a-z0-9.-]+$'
    or position('.' in p_hostname) <= 1
    or p_hostname = 'localhost'
    or p_hostname like '%.localhost'
    or p_hostname ~ '^(10|127)\\.'
    or p_hostname ~ '^169\\.254\\.'
    or p_hostname ~ '^192\\.168\\.'
    or p_hostname ~ '^172\\.(1[6-9]|2[0-9]|3[0-1])\\.'
    or p_target_page_url is null
    or p_target_page_url <> trim(p_target_page_url)
    or p_target_page_url !~ '^https?://'
    or position('#' in p_target_page_url) > 0
    or char_length(p_target_page_url) > 2048
    or p_target_page_title is null
    or char_length(trim(p_target_page_title)) = 0
    or p_opportunity_type is null
    or char_length(trim(p_opportunity_type)) = 0
    or p_page_type is null
    or p_page_type not in ('Resource Page', 'Guide', 'Best Tools List', 'Directory', 'Blog Article', 'Knowledge Base')
    or p_priority is null
    or p_priority not in ('Tier A', 'Tier B', 'Tier C')
    or p_evidence_summary is null
    or char_length(trim(p_evidence_summary)) = 0
    or p_qualification_score is null
    or p_qualification_score not between 0 and 100
    or p_qualification_confidence is null
    or p_qualification_confidence not in ('low', 'medium')
    or p_promotion_policy_version is null
    or p_promotion_policy_version <> 'backlink-promotion-v1' then
    raise exception 'PROMOTION_APPLICATION_FAILED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_workspace_id::text || ':' || p_promotion_task_id::text || ':' || p_proposal_key,
    0
  ));

  select *
  into existing_application
  from public.backlink_promotion_applications
  where workspace_id = p_workspace_id
    and promotion_task_id = p_promotion_task_id
    and proposal_key = p_proposal_key;

  if found then
    if existing_application.run_id <> p_run_id
      or existing_application.candidate_key <> p_candidate_key then
      raise exception 'PROMOTION_APPLICATION_MISMATCH';
    end if;

    return query
    select
      existing_application.id,
      existing_application.domain_id,
      existing_application.opportunity_id,
      existing_application.domain_disposition,
      existing_application.opportunity_disposition,
      true;
    return;
  end if;

  select *
  into resolved_task
  from public.automation_tasks
  where id = p_promotion_task_id
    and workspace_id = p_workspace_id
    and run_id = p_run_id;

  if not found then
    raise exception 'PROMOTION_TASK_NOT_FOUND';
  end if;
  if resolved_task.task_kind <> 'backlinks.promotion.preview' then
    raise exception 'PROMOTION_TASK_KIND_INVALID';
  end if;
  if resolved_task.status <> 'completed' then
    raise exception 'PROMOTION_TASK_NOT_COMPLETED';
  end if;

  select *
  into resolved_asset
  from public.backlink_assets
  where id = p_asset_id
    and workspace_id = p_workspace_id;

  if not found then
    raise exception 'PROMOTION_ASSET_NOT_FOUND';
  end if;
  if resolved_asset.lifecycle_status <> 'active' then
    raise exception 'PROMOTION_ASSET_NOT_ACTIVE';
  end if;

  loop
    select *
    into resolved_domain
    from public.backlink_domains
    where workspace_id = p_workspace_id
      and hostname = p_hostname;

    if found then
      if resolved_domain.lifecycle_status = 'archived' then
        raise exception 'PROMOTION_DOMAIN_ARCHIVED';
      end if;
      domain_disposition_value := 'existing';
      exit;
    end if;

    begin
      generated_key := 'BK-' || lpad(nextval('public.backlink_domain_key_sequence')::text, 4, '0');
      insert into public.backlink_domains (
        workspace_id,
        domain_key,
        hostname,
        created_by
      ) values (
        p_workspace_id,
        generated_key,
        p_hostname,
        p_actor_user_id
      )
      returning * into resolved_domain;
      domain_disposition_value := 'created';
      exit;
    exception when unique_violation then
      select *
      into resolved_domain
      from public.backlink_domains
      where workspace_id = p_workspace_id
        and hostname = p_hostname;
      if found then
        if resolved_domain.lifecycle_status = 'archived' then
          raise exception 'PROMOTION_DOMAIN_ARCHIVED';
        end if;
        domain_disposition_value := 'existing';
        exit;
      end if;
    end;
  end loop;

  loop
    select *
    into resolved_opportunity
    from public.backlink_opportunities
    where domain_id = resolved_domain.id
      and target_page_url = p_target_page_url
      and opportunity_type = p_opportunity_type
      and asset_id = resolved_asset.id;

    if found then
      opportunity_disposition_value := 'existing';
      exit;
    end if;

    begin
      generated_key := 'OP-' || lpad(nextval('public.backlink_opportunity_key_sequence')::text, 6, '0');
      insert into public.backlink_opportunities (
        workspace_id,
        opportunity_key,
        domain_id,
        asset_id,
        opportunity_type,
        target_page_url,
        target_page_title,
        page_type,
        evidence_summary,
        qualification_status,
        discovery_status,
        editorial_status,
        priority,
        lifecycle_status,
        convention_risk,
        created_by
      ) values (
        p_workspace_id,
        generated_key,
        resolved_domain.id,
        resolved_asset.id,
        p_opportunity_type,
        p_target_page_url,
        p_target_page_title,
        p_page_type,
        p_evidence_summary,
        'Needs Review',
        'Identified',
        'Not Started',
        p_priority,
        'active',
        false,
        p_actor_user_id
      )
      returning * into resolved_opportunity;
      opportunity_disposition_value := 'created';
      exit;
    exception when unique_violation then
      select *
      into resolved_opportunity
      from public.backlink_opportunities
      where domain_id = resolved_domain.id
        and target_page_url = p_target_page_url
        and opportunity_type = p_opportunity_type
        and asset_id = resolved_asset.id;
      if found then
        opportunity_disposition_value := 'existing';
        exit;
      end if;
    end;
  end loop;

  begin
    generated_key := 'BL-ACT-' || lpad(nextval('public.backlink_activity_key_sequence')::text, 6, '0');
    insert into public.backlink_activity (
      workspace_id,
      activity_key,
      entity_type,
      entity_id,
      action_type,
      actor_user_id,
      reason,
      metadata
    ) values (
      p_workspace_id,
      generated_key,
      'opportunity',
      resolved_opportunity.id,
      'automation_promotion_applied',
      p_actor_user_id,
      'Promotion preview applied by an authorized workspace administrator.',
      jsonb_build_object(
        'automationRunId', p_run_id,
        'promotionTaskId', p_promotion_task_id,
        'proposalKey', p_proposal_key,
        'candidateKey', p_candidate_key,
        'qualificationScore', p_qualification_score,
        'qualificationConfidence', p_qualification_confidence,
        'promotionPolicyVersion', p_promotion_policy_version,
        'domainDisposition', domain_disposition_value,
        'opportunityDisposition', opportunity_disposition_value
      )
    );

    insert into public.backlink_promotion_applications (
      workspace_id,
      run_id,
      promotion_task_id,
      proposal_key,
      candidate_key,
      domain_id,
      opportunity_id,
      promoted_by,
      domain_disposition,
      opportunity_disposition
    ) values (
      p_workspace_id,
      p_run_id,
      p_promotion_task_id,
      p_proposal_key,
      p_candidate_key,
      resolved_domain.id,
      resolved_opportunity.id,
      p_actor_user_id,
      domain_disposition_value,
      opportunity_disposition_value
    )
    returning * into existing_application;
  exception when unique_violation then
    select *
    into existing_application
    from public.backlink_promotion_applications
    where workspace_id = p_workspace_id
      and promotion_task_id = p_promotion_task_id
      and proposal_key = p_proposal_key;

    if not found then
      raise exception 'PROMOTION_APPLICATION_FAILED';
    end if;
    if existing_application.run_id <> p_run_id
      or existing_application.candidate_key <> p_candidate_key then
      raise exception 'PROMOTION_APPLICATION_MISMATCH';
    end if;

    return query
    select
      existing_application.id,
      existing_application.domain_id,
      existing_application.opportunity_id,
      existing_application.domain_disposition,
      existing_application.opportunity_disposition,
      true;
    return;
  end;

  return query
  select
    existing_application.id,
    existing_application.domain_id,
    existing_application.opportunity_id,
    existing_application.domain_disposition,
    existing_application.opportunity_disposition,
    true;
end;
$$;

revoke all on function public.apply_backlink_promotion_proposal(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, uuid, integer, text, text
) from public, anon, service_role;
grant execute on function public.apply_backlink_promotion_proposal(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, uuid, integer, text, text
) to authenticated;

comment on table public.backlink_promotion_applications is
  'Append-only, workspace-scoped idempotence records for authorized human application of durable Promotion Preview proposals.';
comment on function public.apply_backlink_promotion_proposal(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, uuid, integer, text, text
) is
  'Atomically applies one authorized Promotion Preview proposal without reading automation task output.';

commit;
