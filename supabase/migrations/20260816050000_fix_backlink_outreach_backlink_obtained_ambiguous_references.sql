begin;

create or replace function public.apply_backlink_outreach_backlink_obtained(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_applied_at timestamptz
)
returns table (
  disposition text,
  outreach_id uuid,
  previous_status text,
  outreach_status text,
  last_response_type text,
  closed_at timestamptz,
  stop_reason text,
  next_follow_up_at timestamptz,
  response_deadline_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outreach public.backlink_outreach;
  v_active_link public.backlink_links;
  v_previous_status text;
begin
  if p_workspace_id is null or p_outreach_id is null or p_applied_at is null then
    raise exception 'BACKLINK_OUTREACH_BACKLINK_OBTAINED_INVALID';
  end if;

  select *
  into v_outreach
  from public.backlink_outreach as outreach_source
  where outreach_source.id = p_outreach_id
    and outreach_source.workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_BACKLINK_OBTAINED_OUTREACH_MISMATCH';
  end if;

  if v_outreach.status = 'closed'
    and v_outreach.last_response_type = 'positive'
    and v_outreach.stop_reason = 'backlink_obtained'
    and v_outreach.closed_at is not null then
    return query select
      'existing'::text,
      v_outreach.id,
      v_outreach.status,
      v_outreach.status,
      v_outreach.last_response_type,
      v_outreach.closed_at,
      v_outreach.stop_reason,
      v_outreach.next_follow_up_at,
      v_outreach.response_deadline_at;
    return;
  end if;

  if v_outreach.status <> 'conversation_open'
    or v_outreach.last_response_type <> 'positive'
    or v_outreach.closed_at is not null then
    raise exception 'BACKLINK_OUTREACH_BACKLINK_OBTAINED_OUTREACH_INVALID';
  end if;

  select *
  into v_active_link
  from public.backlink_links as link_source
  where link_source.workspace_id = p_workspace_id
    and link_source.outreach_id = p_outreach_id
    and link_source.status = 'active'
  order by link_source.acquired_at desc, link_source.id asc
  limit 1
  for update;

  if not found then
    raise exception 'BACKLINK_OUTREACH_BACKLINK_OBTAINED_LINK_REQUIRED';
  end if;

  v_previous_status := v_outreach.status;

  update public.backlink_outreach as outreach_update
  set status = 'closed',
      closed_at = p_applied_at,
      stop_reason = 'backlink_obtained',
      next_follow_up_at = null,
      response_deadline_at = null
  where outreach_update.id = v_outreach.id
    and outreach_update.workspace_id = p_workspace_id
  returning * into v_outreach;

  return query select
    'applied'::text,
    v_outreach.id,
    v_previous_status,
    v_outreach.status,
    v_outreach.last_response_type,
    v_outreach.closed_at,
    v_outreach.stop_reason,
    v_outreach.next_follow_up_at,
    v_outreach.response_deadline_at;
end;
$$;

revoke all on function public.apply_backlink_outreach_backlink_obtained(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_backlink_outreach_backlink_obtained(uuid, uuid, timestamptz) to service_role;

comment on function public.apply_backlink_outreach_backlink_obtained(uuid, uuid, timestamptz) is
  'Atomically closes a positive conversation_open Outreach as backlink_obtained only when a same-workspace active verified backlink exists.';

commit;
