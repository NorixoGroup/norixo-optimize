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
  v_existing_application public.backlink_promotion_applications;
  v_resolved_domain public.backlink_domains;
  v_resolved_asset public.backlink_assets;
  v_resolved_opportunity public.backlink_opportunities;
  v_resolved_task public.automation_tasks;
  v_domain_disposition text;
  v_opportunity_disposition text;
  v_generated_key text;
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
    or p_hostname ~ '^(10|127)\.'
    or p_hostname ~ '^169\.254\.'
    or p_hostname ~ '^192\.168\.'
    or p_hostname ~ '^172\.(1[6-9]|2[0-9]|3[0-1])\.'
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

  select pa.*
  into v_existing_application
  from public.backlink_promotion_applications as pa
  where pa.workspace_id = p_workspace_id
    and pa.promotion_task_id = p_promotion_task_id
    and pa.proposal_key = p_proposal_key;

  if found then
    if v_existing_application.run_id <> p_run_id
      or v_existing_application.candidate_key <> p_candidate_key then
      raise exception 'PROMOTION_APPLICATION_MISMATCH';
    end if;

    return query
    select
      v_existing_application.id as application_id,
      v_existing_application.domain_id as domain_id,
      v_existing_application.opportunity_id as opportunity_id,
      v_existing_application.domain_disposition as domain_disposition,
      v_existing_application.opportunity_disposition as opportunity_disposition,
      true as audit_written;
    return;
  end if;

  select t.*
  into v_resolved_task
  from public.automation_tasks as t
  where t.id = p_promotion_task_id
    and t.workspace_id = p_workspace_id
    and t.run_id = p_run_id;

  if not found then
    raise exception 'PROMOTION_TASK_NOT_FOUND';
  end if;
  if v_resolved_task.task_kind <> 'backlinks.promotion.preview' then
    raise exception 'PROMOTION_TASK_KIND_INVALID';
  end if;
  if v_resolved_task.status <> 'completed' then
    raise exception 'PROMOTION_TASK_NOT_COMPLETED';
  end if;

  select a.*
  into v_resolved_asset
  from public.backlink_assets as a
  where a.id = p_asset_id
    and a.workspace_id = p_workspace_id;

  if not found then
    raise exception 'PROMOTION_ASSET_NOT_FOUND';
  end if;
  if v_resolved_asset.lifecycle_status <> 'active' then
    raise exception 'PROMOTION_ASSET_NOT_ACTIVE';
  end if;

  loop
    select d.*
    into v_resolved_domain
    from public.backlink_domains as d
    where d.workspace_id = p_workspace_id
      and d.hostname = p_hostname;

    if found then
      if v_resolved_domain.lifecycle_status = 'archived' then
        raise exception 'PROMOTION_DOMAIN_ARCHIVED';
      end if;
      v_domain_disposition := 'existing';
      exit;
    end if;

    begin
      v_generated_key := 'BK-' || lpad(nextval('public.backlink_domain_key_sequence')::text, 4, '0');
      insert into public.backlink_domains as d (
        workspace_id,
        domain_key,
        hostname,
        created_by
      ) values (
        p_workspace_id,
        v_generated_key,
        p_hostname,
        p_actor_user_id
      )
      returning d.* into v_resolved_domain;
      v_domain_disposition := 'created';
      exit;
    exception when unique_violation then
      select d.*
      into v_resolved_domain
      from public.backlink_domains as d
      where d.workspace_id = p_workspace_id
        and d.hostname = p_hostname;
      if found then
        if v_resolved_domain.lifecycle_status = 'archived' then
          raise exception 'PROMOTION_DOMAIN_ARCHIVED';
        end if;
        v_domain_disposition := 'existing';
        exit;
      end if;
    end;
  end loop;

  loop
    select o.*
    into v_resolved_opportunity
    from public.backlink_opportunities as o
    where o.domain_id = v_resolved_domain.id
      and o.target_page_url = p_target_page_url
      and o.opportunity_type = p_opportunity_type
      and o.asset_id = v_resolved_asset.id;

    if found then
      v_opportunity_disposition := 'existing';
      exit;
    end if;

    begin
      v_generated_key := 'OP-' || lpad(nextval('public.backlink_opportunity_key_sequence')::text, 6, '0');
      insert into public.backlink_opportunities as o (
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
        v_generated_key,
        v_resolved_domain.id,
        v_resolved_asset.id,
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
      returning o.* into v_resolved_opportunity;
      v_opportunity_disposition := 'created';
      exit;
    exception when unique_violation then
      select o.*
      into v_resolved_opportunity
      from public.backlink_opportunities as o
      where o.domain_id = v_resolved_domain.id
        and o.target_page_url = p_target_page_url
        and o.opportunity_type = p_opportunity_type
        and o.asset_id = v_resolved_asset.id;
      if found then
        v_opportunity_disposition := 'existing';
        exit;
      end if;
    end;
  end loop;

  begin
    v_generated_key := 'BL-ACT-' || lpad(nextval('public.backlink_activity_key_sequence')::text, 6, '0');
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
      v_generated_key,
      'opportunity',
      v_resolved_opportunity.id,
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
        'domainDisposition', v_domain_disposition,
        'opportunityDisposition', v_opportunity_disposition
      )
    );

    insert into public.backlink_promotion_applications as pa (
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
      v_resolved_domain.id,
      v_resolved_opportunity.id,
      p_actor_user_id,
      v_domain_disposition,
      v_opportunity_disposition
    )
    returning pa.* into v_existing_application;
  exception when unique_violation then
    select pa.*
    into v_existing_application
    from public.backlink_promotion_applications as pa
    where pa.workspace_id = p_workspace_id
      and pa.promotion_task_id = p_promotion_task_id
      and pa.proposal_key = p_proposal_key;

    if not found then
      raise exception 'PROMOTION_APPLICATION_FAILED';
    end if;
    if v_existing_application.run_id <> p_run_id
      or v_existing_application.candidate_key <> p_candidate_key then
      raise exception 'PROMOTION_APPLICATION_MISMATCH';
    end if;

    return query
    select
      v_existing_application.id as application_id,
      v_existing_application.domain_id as domain_id,
      v_existing_application.opportunity_id as opportunity_id,
      v_existing_application.domain_disposition as domain_disposition,
      v_existing_application.opportunity_disposition as opportunity_disposition,
      true as audit_written;
    return;
  end;

  return query
  select
    v_existing_application.id as application_id,
    v_existing_application.domain_id as domain_id,
    v_existing_application.opportunity_id as opportunity_id,
    v_domain_disposition as domain_disposition,
    v_opportunity_disposition as opportunity_disposition,
    true as audit_written;
end;
$$;

revoke all on function public.apply_backlink_promotion_proposal(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, uuid, integer, text, text
) from public, anon, service_role;
grant execute on function public.apply_backlink_promotion_proposal(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, uuid, integer, text, text
) to authenticated;
