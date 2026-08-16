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
  outreach public.backlink_outreach;
  active_link public.backlink_links;
  previous_status text;
begin
  if p_workspace_id is null or p_outreach_id is null or p_applied_at is null then
    raise exception 'BACKLINK_OUTREACH_BACKLINK_OBTAINED_INVALID';
  end if;

  select *
  into outreach
  from public.backlink_outreach
  where id = p_outreach_id
    and workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_BACKLINK_OBTAINED_OUTREACH_MISMATCH';
  end if;

  if outreach.status = 'closed'
    and outreach.last_response_type = 'positive'
    and outreach.stop_reason = 'backlink_obtained'
    and outreach.closed_at is not null then
    return query select
      'existing',
      outreach.id,
      outreach.status,
      outreach.status,
      outreach.last_response_type,
      outreach.closed_at,
      outreach.stop_reason,
      outreach.next_follow_up_at,
      outreach.response_deadline_at;
    return;
  end if;

  if outreach.status <> 'conversation_open'
    or outreach.last_response_type <> 'positive'
    or outreach.closed_at is not null then
    raise exception 'BACKLINK_OUTREACH_BACKLINK_OBTAINED_OUTREACH_INVALID';
  end if;

  select *
  into active_link
  from public.backlink_links
  where workspace_id = p_workspace_id
    and outreach_id = p_outreach_id
    and status = 'active'
  order by acquired_at desc, id asc
  limit 1
  for update;

  if not found then
    raise exception 'BACKLINK_OUTREACH_BACKLINK_OBTAINED_LINK_REQUIRED';
  end if;

  previous_status := outreach.status;

  update public.backlink_outreach
  set status = 'closed',
      closed_at = p_applied_at,
      stop_reason = 'backlink_obtained',
      next_follow_up_at = null,
      response_deadline_at = null
  where id = outreach.id
    and workspace_id = p_workspace_id
  returning * into outreach;

  return query select
    'applied',
    outreach.id,
    previous_status,
    outreach.status,
    outreach.last_response_type,
    outreach.closed_at,
    outreach.stop_reason,
    outreach.next_follow_up_at,
    outreach.response_deadline_at;
end;
$$;

revoke all on function public.apply_backlink_outreach_backlink_obtained(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_backlink_outreach_backlink_obtained(uuid, uuid, timestamptz) to service_role;

comment on function public.apply_backlink_outreach_backlink_obtained(uuid, uuid, timestamptz) is
  'Atomically closes a positive conversation_open Outreach as backlink_obtained only when a same-workspace active verified backlink exists.';

commit;
