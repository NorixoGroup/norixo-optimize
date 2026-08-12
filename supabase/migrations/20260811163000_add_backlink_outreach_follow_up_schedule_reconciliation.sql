begin;

create function public.reconcile_backlink_outreach_follow_up_schedule(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_expected_current_attempt integer,
  p_expected_last_attempt_at timestamptz,
  p_schedule_kind text,
  p_scheduled_at timestamptz
)
returns table (
  disposition text,
  schedule_kind text,
  scheduled_at timestamptz,
  next_follow_up_at timestamptz,
  response_deadline_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  latest_attempt public.backlink_outreach_attempts;
  open_attempt public.backlink_outreach_attempts;
  inbound_stop_effect public.backlink_outreach_inbound_effects;
begin
  if p_workspace_id is null
    or p_outreach_id is null
    or p_expected_current_attempt is null
    or p_expected_last_attempt_at is null
    or p_schedule_kind not in ('follow_up', 'final_response')
    or p_scheduled_at is null then
    raise exception 'FOLLOW_UP_SCHEDULE_INVALID';
  end if;

  select *
  into outreach
  from public.backlink_outreach
  where id = p_outreach_id
    and workspace_id = p_workspace_id
  for update;
  if not found or outreach.status <> 'active' or outreach.channel <> 'email' then
    raise exception 'FOLLOW_UP_SCHEDULE_NOT_APPLICABLE';
  end if;

  select *
  into contact
  from public.backlink_contacts
  where id = outreach.contact_id
    and workspace_id = p_workspace_id
  for update;
  if not found
    or contact.contact_status in ('do_not_contact', 'archived')
    or nullif(trim(contact.email_normalized), '') is null then
    raise exception 'FOLLOW_UP_SCHEDULE_NOT_APPLICABLE';
  end if;

  select *
  into open_attempt
  from public.backlink_outreach_attempts
  where workspace_id = p_workspace_id
    and outreach_id = outreach.id
    and status in ('prepared', 'requested', 'unknown')
  order by created_at desc, id desc
  limit 1
  for update;
  if found then
    raise exception 'FOLLOW_UP_SCHEDULE_NOT_APPLICABLE';
  end if;

  select *
  into inbound_stop_effect
  from public.backlink_outreach_inbound_effects
  where workspace_id = p_workspace_id
    and outreach_id = outreach.id
    and effect_kind = 'reply_received_stop'
    and status = 'applied'
  for update;
  if found then
    raise exception 'FOLLOW_UP_SCHEDULE_NOT_APPLICABLE';
  end if;

  select *
  into latest_attempt
  from public.backlink_outreach_attempts
  where workspace_id = p_workspace_id
    and outreach_id = outreach.id
  order by created_at desc, id desc
  limit 1
  for update;
  if not found or latest_attempt.status <> 'accepted' then
    raise exception 'FOLLOW_UP_SCHEDULE_NOT_APPLICABLE';
  end if;

  if outreach.current_attempt <> p_expected_current_attempt
    or outreach.last_attempt_at is distinct from p_expected_last_attempt_at then
    raise exception 'FOLLOW_UP_SCHEDULE_STATE_MISMATCH';
  end if;

  if p_schedule_kind = 'follow_up' and outreach.current_attempt >= outreach.max_attempts then
    raise exception 'FOLLOW_UP_SCHEDULE_NOT_APPLICABLE';
  end if;
  if p_schedule_kind = 'final_response' and outreach.current_attempt < outreach.max_attempts then
    raise exception 'FOLLOW_UP_SCHEDULE_NOT_APPLICABLE';
  end if;

  if outreach.next_follow_up_at is not null and outreach.response_deadline_at is not null then
    raise exception 'FOLLOW_UP_SCHEDULE_CONFLICT';
  end if;

  if p_schedule_kind = 'follow_up' then
    if outreach.next_follow_up_at is not distinct from p_scheduled_at and outreach.response_deadline_at is null then
      return query select 'existing', p_schedule_kind, outreach.next_follow_up_at, outreach.next_follow_up_at, outreach.response_deadline_at;
      return;
    end if;
    if outreach.next_follow_up_at is not null or outreach.response_deadline_at is not null then
      raise exception 'FOLLOW_UP_SCHEDULE_CONFLICT';
    end if;
    update public.backlink_outreach
    set next_follow_up_at = p_scheduled_at,
        response_deadline_at = null
    where id = outreach.id
      and workspace_id = p_workspace_id
    returning * into outreach;
    return query select 'scheduled', p_schedule_kind, p_scheduled_at, outreach.next_follow_up_at, outreach.response_deadline_at;
    return;
  end if;

  if outreach.response_deadline_at is not distinct from p_scheduled_at and outreach.next_follow_up_at is null then
    return query select 'existing', p_schedule_kind, outreach.response_deadline_at, outreach.next_follow_up_at, outreach.response_deadline_at;
    return;
  end if;
  if outreach.next_follow_up_at is not null or outreach.response_deadline_at is not null then
    raise exception 'FOLLOW_UP_SCHEDULE_CONFLICT';
  end if;
  update public.backlink_outreach
  set response_deadline_at = p_scheduled_at,
      next_follow_up_at = null
  where id = outreach.id
    and workspace_id = p_workspace_id
  returning * into outreach;
  return query select 'scheduled', p_schedule_kind, p_scheduled_at, outreach.next_follow_up_at, outreach.response_deadline_at;
end;
$$;

revoke all on function public.reconcile_backlink_outreach_follow_up_schedule(uuid, uuid, integer, timestamptz, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reconcile_backlink_outreach_follow_up_schedule(uuid, uuid, integer, timestamptz, text, timestamptz) to service_role;
comment on function public.reconcile_backlink_outreach_follow_up_schedule(uuid, uuid, integer, timestamptz, text, timestamptz) is
  'Atomically reconciles a follow-up schedule after an accepted attempt, writing exactly one next_follow_up_at or response_deadline_at and never sending a provider message.';

commit;
