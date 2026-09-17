begin;

create or replace function public.cancel_backlink_outreach_prepared_follow_up_attempt(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_attempt_id uuid,
  p_cancel_reason text,
  p_cancelled_at timestamptz
)
returns table (
  disposition text,
  attempt_id uuid,
  outreach_id uuid,
  attempt_status text,
  cancel_reason text,
  cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  outreach public.backlink_outreach;
  attempt public.backlink_outreach_attempts;
  normalized_reason text := trim(coalesce(p_cancel_reason, ''));
begin
  if normalized_reason not in (
    'inbound_reply',
    'provider_complaint',
    'provider_permanent_bounce',
    'contact_unavailable',
    'admin_cancelled'
  ) or p_cancelled_at is null then
    raise exception 'FOLLOW_UP_CANCEL_INVALID';
  end if;

  select bo.*
  into outreach
  from public.backlink_outreach as bo
  where bo.id = p_outreach_id
    and bo.workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'FOLLOW_UP_CANCEL_NOT_FOUND';
  end if;

  select boa.*
  into attempt
  from public.backlink_outreach_attempts as boa
  where boa.id = p_attempt_id
    and boa.workspace_id = p_workspace_id
    and boa.outreach_id = outreach.id
  for update;

  if not found then
    raise exception 'FOLLOW_UP_CANCEL_NOT_FOUND';
  end if;

  if attempt.attempt_kind <> 'follow_up' then
    raise exception 'FOLLOW_UP_CANCEL_CONFLICT';
  end if;

  if attempt.status = 'cancelled' then
    if attempt.cancel_reason <> normalized_reason then
      raise exception 'FOLLOW_UP_CANCEL_CONFLICT';
    end if;

    return query
    select
      'existing',
      attempt.id,
      attempt.outreach_id,
      attempt.status,
      attempt.cancel_reason,
      attempt.cancelled_at;

    return;
  end if;

  if attempt.status <> 'prepared'
    or attempt.requested_at is not null
    or attempt.accepted_at is not null
    or attempt.provider_message_id is not null then
    raise exception 'FOLLOW_UP_CANCEL_CONFLICT';
  end if;

  update public.backlink_outreach_attempts as boa
  set status = 'cancelled',
      cancelled_at = p_cancelled_at,
      cancel_reason = normalized_reason
  where boa.id = attempt.id
    and boa.workspace_id = p_workspace_id
  returning boa.* into attempt;

  if normalized_reason = 'admin_cancelled' then
    if outreach.next_follow_up_at is not null
      or outreach.response_deadline_at is not null
      or attempt.prepared_at is null then
      raise exception 'FOLLOW_UP_CANCEL_RECOVERY_CONFLICT';
    end if;

    update public.backlink_outreach as bo
    set next_follow_up_at = attempt.prepared_at
    where bo.id = outreach.id
      and bo.workspace_id = p_workspace_id;
  end if;

  return query
  select
    'cancelled',
    attempt.id,
    attempt.outreach_id,
    attempt.status,
    attempt.cancel_reason,
    attempt.cancelled_at;
end;
$$;

revoke all on function public.cancel_backlink_outreach_prepared_follow_up_attempt(
  uuid, uuid, uuid, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.cancel_backlink_outreach_prepared_follow_up_attempt(
  uuid, uuid, uuid, text, timestamptz
) to service_role;

comment on function public.cancel_backlink_outreach_prepared_follow_up_attempt(
  uuid, uuid, uuid, text, timestamptz
) is
  'Cancels one prepared follow-up without sending; admin cancellation restores the consumed due follow-up schedule when safe.';

commit;
