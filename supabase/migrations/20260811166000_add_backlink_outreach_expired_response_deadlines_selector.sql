begin;

create or replace function public.list_backlink_outreach_expired_response_deadlines(
  p_workspace_id uuid,
  p_now timestamptz,
  p_limit integer default 50
)
returns table (
  outreach_id uuid,
  response_deadline_at timestamptz,
  current_attempt integer,
  max_attempts integer,
  latest_attempt_id uuid,
  latest_attempt_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_workspace_id is null
    or p_now is null
    or p_limit is null
    or p_limit not between 1 and 200 then
    raise exception 'EXPIRED_RESPONSE_DEADLINE_SELECTOR_INVALID';
  end if;

  return query
  with latest_attempts as (
    select distinct on (attempt.workspace_id, attempt.outreach_id)
      attempt.workspace_id,
      attempt.outreach_id,
      attempt.id as latest_attempt_id,
      attempt.status as latest_attempt_status
    from public.backlink_outreach_attempts as attempt
    where attempt.workspace_id = p_workspace_id
    order by attempt.workspace_id, attempt.outreach_id, attempt.created_at desc, attempt.id desc
  )
  select
    outreach.id as outreach_id,
    outreach.response_deadline_at,
    outreach.current_attempt,
    outreach.max_attempts,
    latest_attempts.latest_attempt_id,
    latest_attempts.latest_attempt_status
  from public.backlink_outreach as outreach
  join public.backlink_contacts as contact
    on contact.id = outreach.contact_id
   and contact.workspace_id = outreach.workspace_id
  join latest_attempts
    on latest_attempts.workspace_id = outreach.workspace_id
   and latest_attempts.outreach_id = outreach.id
  where outreach.workspace_id = p_workspace_id
    and outreach.status = 'active'
    and outreach.channel = 'email'
    and outreach.response_deadline_at is not null
    and outreach.response_deadline_at <= p_now
    and outreach.next_follow_up_at is null
    and outreach.current_attempt >= outreach.max_attempts
    and contact.contact_status not in ('do_not_contact', 'archived')
    and nullif(trim(contact.email_normalized), '') is not null
    and latest_attempts.latest_attempt_status = 'accepted'
    and not exists (
      select 1
      from public.backlink_outreach_attempts as open_attempt
      where open_attempt.workspace_id = outreach.workspace_id
        and open_attempt.outreach_id = outreach.id
        and open_attempt.status in ('prepared', 'requested', 'unknown')
    )
    and not exists (
      select 1
      from public.backlink_outreach_inbound_effects as inbound_stop
      where inbound_stop.workspace_id = outreach.workspace_id
        and inbound_stop.outreach_id = outreach.id
        and inbound_stop.effect_kind = 'reply_received_stop'
        and inbound_stop.status = 'applied'
    )
  order by outreach.response_deadline_at asc, outreach.id asc
  limit p_limit;
end;
$$;

revoke all on function public.list_backlink_outreach_expired_response_deadlines(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.list_backlink_outreach_expired_response_deadlines(uuid, timestamptz, integer) to service_role;
comment on function public.list_backlink_outreach_expired_response_deadlines(uuid, timestamptz, integer) is
  'Read-only workspace-scoped selector for active email Outreach rows whose final response deadline has expired and whose latest accepted Attempt is canonical. It is fail-closed and not authoritative for any future no_response action.';

commit;
