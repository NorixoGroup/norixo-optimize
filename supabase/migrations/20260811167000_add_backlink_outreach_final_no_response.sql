begin;

create or replace function public.apply_backlink_outreach_final_no_response(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_applied_at timestamptz
)
returns table (
  disposition text,
  outreach_id uuid,
  outreach_status text,
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
  contact public.backlink_contacts;
  latest_attempt public.backlink_outreach_attempts;
  open_attempt public.backlink_outreach_attempts;
  inbound_stop public.backlink_outreach_inbound_effects;
begin
  if p_workspace_id is null
    or p_outreach_id is null
    or p_applied_at is null then
    raise exception 'FINAL_NO_RESPONSE_INVALID';
  end if;

  select *
  into outreach
  from public.backlink_outreach
  where id = p_outreach_id
    and workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'FINAL_NO_RESPONSE_OUTREACH_MISMATCH';
  end if;

  if outreach.status = 'no_response'
    and outreach.stop_reason = 'attempt_limit'
    and outreach.closed_at is not null
    and outreach.next_follow_up_at is null
    and outreach.response_deadline_at is null then
    return query select
      'existing',
      outreach.id,
      outreach.status,
      outreach.closed_at,
      outreach.stop_reason,
      outreach.next_follow_up_at,
      outreach.response_deadline_at;
    return;
  end if;

  if outreach.status <> 'active'
    or outreach.channel <> 'email'
    or outreach.response_deadline_at is null
    or outreach.response_deadline_at > p_applied_at
    or outreach.next_follow_up_at is not null
    or outreach.current_attempt < outreach.max_attempts then
    raise exception 'FINAL_NO_RESPONSE_NOT_APPLICABLE';
  end if;

  select *
  into contact
  from public.backlink_contacts
  where id = outreach.contact_id
    and workspace_id = outreach.workspace_id
  for update;
  if not found
    or contact.contact_status in ('do_not_contact', 'archived')
    or nullif(trim(contact.email_normalized), '') is null then
    raise exception 'FINAL_NO_RESPONSE_CONTACT_UNAVAILABLE';
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
    raise exception 'FINAL_NO_RESPONSE_ATTEMPT_NOT_ACCEPTED';
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
    raise exception 'FINAL_NO_RESPONSE_ATTEMPT_IN_PROGRESS';
  end if;

  select *
  into inbound_stop
  from public.backlink_outreach_inbound_effects
  where workspace_id = p_workspace_id
    and outreach_id = outreach.id
    and effect_kind = 'reply_received_stop'
    and status = 'applied'
  for update;
  if found then
    raise exception 'FINAL_NO_RESPONSE_INBOUND_STOPPED';
  end if;

  update public.backlink_outreach
  set status = 'no_response',
      last_response_type = null,
      closed_at = p_applied_at,
      stop_reason = 'attempt_limit',
      next_follow_up_at = null,
      response_deadline_at = null
  where id = outreach.id
    and workspace_id = outreach.workspace_id
  returning * into outreach;

  return query select
    'applied',
    outreach.id,
    outreach.status,
    outreach.closed_at,
    outreach.stop_reason,
    outreach.next_follow_up_at,
    outreach.response_deadline_at;
end;
$$;

revoke all on function public.apply_backlink_outreach_final_no_response(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_backlink_outreach_final_no_response(uuid, uuid, timestamptz) to service_role;
comment on function public.apply_backlink_outreach_final_no_response(uuid, uuid, timestamptz) is
  'Atomically confirms a final no-response only when the expired deadline is still valid, the latest canonical Attempt is accepted, no open Attempt exists, no inbound stop exists, and the Contact is usable. It never schedules, sends, or mutates provider state.';

commit;
