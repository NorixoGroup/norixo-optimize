begin;

create or replace function public.resolve_backlink_domain_opportunity(
  p_workspace_id uuid,
  p_hostname text,
  p_asset_id uuid,
  p_target_page_url text,
  p_target_page_title text,
  p_opportunity_type text,
  p_page_type text,
  p_evidence_summary text
)
returns table (
  domain_id uuid,
  domain_key text,
  domain_disposition text,
  opportunity_id uuid,
  opportunity_key text,
  opportunity_disposition text,
  qualification_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain public.backlink_domains;
  v_opportunity public.backlink_opportunities;
begin
  perform 1
  from public.backlink_assets as a
  where a.id = p_asset_id
    and a.workspace_id = p_workspace_id;

  if not found then
    raise exception 'BACKLINK_OPPORTUNITY_ASSET_WORKSPACE_MISMATCH';
  end if;

  loop
    select d.*
    into v_domain
    from public.backlink_domains as d
    where d.workspace_id = p_workspace_id
      and d.hostname = p_hostname;

    if found then
      domain_disposition := 'existing';
      exit;
    end if;

    begin
      insert into public.backlink_domains as d (
        workspace_id,
        domain_key,
        hostname
      ) values (
        p_workspace_id,
        public.reserve_backlink_key('domain'),
        p_hostname
      )
      returning d.* into v_domain;
      domain_disposition := 'created';
      exit;
    exception when unique_violation then
      select d.*
      into v_domain
      from public.backlink_domains as d
      where d.workspace_id = p_workspace_id
        and d.hostname = p_hostname;
      if found then
        domain_disposition := 'existing';
        exit;
      end if;
    end;
  end loop;

  loop
    select o.*
    into v_opportunity
    from public.backlink_opportunities as o
    where o.workspace_id = p_workspace_id
      and o.domain_id = v_domain.id
      and o.target_page_url = p_target_page_url
      and o.opportunity_type = p_opportunity_type
      and o.asset_id = p_asset_id;

    if found then
      opportunity_disposition := 'existing';
      exit;
    end if;

    begin
      insert into public.backlink_opportunities as o (
        workspace_id,
        opportunity_key,
        domain_id,
        asset_id,
        opportunity_type,
        target_page_url,
        target_page_title,
        page_type,
        evidence_summary
      ) values (
        p_workspace_id,
        public.reserve_backlink_key('opportunity'),
        v_domain.id,
        p_asset_id,
        p_opportunity_type,
        p_target_page_url,
        p_target_page_title,
        p_page_type,
        p_evidence_summary
      )
      returning o.* into v_opportunity;
      opportunity_disposition := 'created';
      exit;
    exception when unique_violation then
      select o.*
      into v_opportunity
      from public.backlink_opportunities as o
      where o.workspace_id = p_workspace_id
        and o.domain_id = v_domain.id
        and o.target_page_url = p_target_page_url
        and o.opportunity_type = p_opportunity_type
        and o.asset_id = p_asset_id;
      if found then
        opportunity_disposition := 'existing';
        exit;
      end if;
    end;
  end loop;

  return query
  select
    v_domain.id,
    v_domain.domain_key,
    domain_disposition,
    v_opportunity.id,
    v_opportunity.opportunity_key,
    opportunity_disposition,
    v_opportunity.qualification_status;
end;
$$;

revoke all on function public.resolve_backlink_domain_opportunity(
  uuid, text, uuid, text, text, text, text, text
) from public;
revoke all on function public.resolve_backlink_domain_opportunity(
  uuid, text, uuid, text, text, text, text, text
) from anon;
revoke all on function public.resolve_backlink_domain_opportunity(
  uuid, text, uuid, text, text, text, text, text
) from authenticated;
grant execute on function public.resolve_backlink_domain_opportunity(
  uuid, text, uuid, text, text, text, text, text
) to service_role;

comment on function public.resolve_backlink_domain_opportunity(
  uuid, text, uuid, text, text, text, text, text
) is 'Atomically resolves or creates canonical Backlink Domain and Opportunity records for backend workflows.';

commit;
