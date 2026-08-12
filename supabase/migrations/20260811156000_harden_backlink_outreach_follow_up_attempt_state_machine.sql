begin;

alter table public.backlink_outreach_attempts
  drop constraint backlink_outreach_attempts_status_check,
  alter column requested_at drop not null,
  add column prepared_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancel_reason text,
  add constraint backlink_outreach_attempts_status_check
    check (status in ('prepared', 'requested', 'accepted', 'failed', 'unknown', 'cancelled')),
  add constraint backlink_outreach_attempts_cancel_reason_check
    check (cancel_reason is null or cancel_reason in ('inbound_reply', 'provider_complaint', 'provider_permanent_bounce', 'contact_unavailable', 'admin_cancelled')),
  add constraint backlink_outreach_attempts_prepared_cancelled_kind_check
    check (status not in ('prepared', 'cancelled') or attempt_kind = 'follow_up'),
  add constraint backlink_outreach_attempts_state_timestamp_check
    check (
      (status = 'prepared'
        and prepared_at is not null and requested_at is null
        and accepted_at is null and failed_at is null and resolved_at is null
        and cancelled_at is null and cancel_reason is null and provider_message_id is null)
      or (status = 'requested'
        and requested_at is not null and cancelled_at is null and cancel_reason is null)
      or (status = 'accepted'
        and requested_at is not null and accepted_at is not null and resolved_at is not null
        and cancelled_at is null and cancel_reason is null)
      or (status = 'failed'
        and requested_at is not null and failed_at is not null and resolved_at is not null
        and cancelled_at is null and cancel_reason is null)
      or (status = 'unknown'
        and requested_at is not null and cancelled_at is null and cancel_reason is null)
      or (status = 'cancelled'
        and prepared_at is not null and requested_at is null
        and accepted_at is null and failed_at is null and resolved_at is null
        and cancelled_at is not null and cancel_reason is not null
        and provider_message_id is null)
    );

drop index public.backlink_outreach_attempts_one_open_per_outreach_unique;
create unique index backlink_outreach_attempts_one_open_per_outreach_unique
  on public.backlink_outreach_attempts (workspace_id, outreach_id)
  where status in ('prepared', 'requested', 'unknown');

comment on column public.backlink_outreach_attempts.prepared_at is
  'Follow-up reservation time. A prepared Attempt has not reached a provider.';
comment on column public.backlink_outreach_attempts.cancelled_at is
  'Terminal pre-provider cancellation time for a follow-up Attempt.';
comment on column public.backlink_outreach_attempts.cancel_reason is
  'Bounded reason for a pre-provider follow-up cancellation.';

-- D2 had no application call-site for follow-up reservation. Convert only rows
-- that carry no provider or terminal state, preserving their original reservation time.
update public.backlink_outreach_attempts
set status = 'prepared', prepared_at = requested_at, requested_at = null
where attempt_kind = 'follow_up'
  and status = 'requested'
  and provider_message_id is null
  and accepted_at is null
  and failed_at is null
  and resolved_at is null;

drop function public.reserve_backlink_outreach_follow_up_attempt(uuid, uuid, text, text, timestamptz);
create function public.reserve_backlink_outreach_follow_up_attempt(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text,
  p_reply_token_hash text,
  p_reserved_at timestamptz
)
returns table (
  disposition text,
  attempt_id uuid,
  outreach_id uuid,
  attempt_status text,
  attempt_kind text,
  prepared_at timestamptz,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  existing_attempt public.backlink_outreach_attempts;
  open_attempt public.backlink_outreach_attempts;
  inbound_stop_effect public.backlink_outreach_inbound_effects;
  reserved_attempt public.backlink_outreach_attempts;
  normalized_key text := trim(coalesce(p_idempotency_key, ''));
  normalized_token_hash text := lower(trim(coalesce(p_reply_token_hash, '')));
begin
  if p_workspace_id is null or p_outreach_id is null then raise exception 'FOLLOW_UP_OUTREACH_NOT_ACTIVE'; end if;
  if p_actor_user_id is null or not exists (select 1 from auth.users where id = p_actor_user_id) then raise exception 'FOLLOW_UP_ACTOR_REQUIRED'; end if;
  if normalized_key = '' or normalized_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'FOLLOW_UP_IDEMPOTENCY_CONFLICT'; end if;
  if p_reserved_at is null then raise exception 'FOLLOW_UP_NOT_DUE'; end if;

  select * into existing_attempt from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id and attempt.idempotency_key = normalized_key;
  if found then
    if existing_attempt.outreach_id <> p_outreach_id or existing_attempt.attempt_kind <> 'follow_up' then raise exception 'FOLLOW_UP_IDEMPOTENCY_CONFLICT'; end if;
    return query select 'existing', existing_attempt.id, existing_attempt.outreach_id, existing_attempt.status, existing_attempt.attempt_kind, existing_attempt.prepared_at, existing_attempt.requested_at;
    return;
  end if;

  -- Lock order: Outreach, Contact, open Attempts, inbound reply effects.
  select * into outreach from public.backlink_outreach
  where id = p_outreach_id and workspace_id = p_workspace_id for update;
  if not found or outreach.status <> 'active' then raise exception 'FOLLOW_UP_OUTREACH_NOT_ACTIVE'; end if;
  if outreach.channel <> 'email' then raise exception 'FOLLOW_UP_CHANNEL_NOT_SUPPORTED'; end if;
  if outreach.next_follow_up_at is null then raise exception 'FOLLOW_UP_NOT_SCHEDULED'; end if;
  if outreach.next_follow_up_at > p_reserved_at then raise exception 'FOLLOW_UP_NOT_DUE'; end if;
  if outreach.current_attempt >= outreach.max_attempts then raise exception 'FOLLOW_UP_ATTEMPT_LIMIT_REACHED'; end if;

  select * into existing_attempt from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id and attempt.idempotency_key = normalized_key;
  if found then
    if existing_attempt.outreach_id <> outreach.id or existing_attempt.attempt_kind <> 'follow_up' then raise exception 'FOLLOW_UP_IDEMPOTENCY_CONFLICT'; end if;
    return query select 'existing', existing_attempt.id, existing_attempt.outreach_id, existing_attempt.status, existing_attempt.attempt_kind, existing_attempt.prepared_at, existing_attempt.requested_at;
    return;
  end if;

  select * into contact from public.backlink_contacts
  where id = outreach.contact_id and workspace_id = p_workspace_id for update;
  if not found or contact.contact_status in ('do_not_contact', 'archived') or nullif(trim(contact.email_normalized), '') is null then raise exception 'FOLLOW_UP_CONTACT_UNAVAILABLE'; end if;

  select * into open_attempt from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id and attempt.outreach_id = outreach.id
    and attempt.status in ('prepared', 'requested', 'unknown')
  order by attempt.prepared_at desc nulls last, attempt.requested_at desc nulls last
  limit 1 for update;
  if found then
    if open_attempt.status = 'prepared' then raise exception 'FOLLOW_UP_ATTEMPT_PREPARED'; end if;
    if open_attempt.status = 'unknown' then raise exception 'FOLLOW_UP_ATTEMPT_UNRESOLVED'; end if;
    raise exception 'FOLLOW_UP_ATTEMPT_IN_PROGRESS';
  end if;

  select * into inbound_stop_effect from public.backlink_outreach_inbound_effects as effect
  where effect.workspace_id = p_workspace_id and effect.outreach_id = outreach.id
    and effect.effect_kind = 'reply_received_stop' and effect.status = 'applied'
  for update;
  if found then raise exception 'FOLLOW_UP_INBOUND_REPLY_STOPPED'; end if;

  insert into public.backlink_outreach_attempts (
    workspace_id, outreach_id, actor_user_id, channel, provider, recipient,
    idempotency_key, reply_token_hash, attempt_kind, status, prepared_at
  ) values (
    outreach.workspace_id, outreach.id, p_actor_user_id, 'email', 'resend', trim(contact.email_normalized),
    normalized_key, normalized_token_hash, 'follow_up', 'prepared', p_reserved_at
  ) on conflict (workspace_id, idempotency_key) do nothing
  returning * into reserved_attempt;

  if not found then
    select * into existing_attempt from public.backlink_outreach_attempts as attempt
    where attempt.workspace_id = p_workspace_id and attempt.idempotency_key = normalized_key;
    if found and existing_attempt.outreach_id = outreach.id and existing_attempt.attempt_kind = 'follow_up' then
      return query select 'existing', existing_attempt.id, existing_attempt.outreach_id, existing_attempt.status, existing_attempt.attempt_kind, existing_attempt.prepared_at, existing_attempt.requested_at;
      return;
    end if;
    raise exception 'FOLLOW_UP_IDEMPOTENCY_CONFLICT';
  end if;

  update public.backlink_outreach set next_follow_up_at = null
  where id = outreach.id and workspace_id = outreach.workspace_id;
  return query select 'reserved', reserved_attempt.id, reserved_attempt.outreach_id, reserved_attempt.status, reserved_attempt.attempt_kind, reserved_attempt.prepared_at, reserved_attempt.requested_at;
end;
$$;

create function public.cancel_backlink_outreach_prepared_follow_up_attempt(
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
  if normalized_reason not in ('inbound_reply', 'provider_complaint', 'provider_permanent_bounce', 'contact_unavailable', 'admin_cancelled') or p_cancelled_at is null then
    raise exception 'FOLLOW_UP_CANCEL_INVALID';
  end if;
  select * into outreach from public.backlink_outreach where id = p_outreach_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'FOLLOW_UP_CANCEL_NOT_FOUND'; end if;
  select * into attempt from public.backlink_outreach_attempts
  where id = p_attempt_id and workspace_id = p_workspace_id and outreach_id = outreach.id for update;
  if not found then raise exception 'FOLLOW_UP_CANCEL_NOT_FOUND'; end if;
  if attempt.attempt_kind <> 'follow_up' then raise exception 'FOLLOW_UP_CANCEL_CONFLICT'; end if;
  if attempt.status = 'cancelled' then
    if attempt.cancel_reason <> normalized_reason then raise exception 'FOLLOW_UP_CANCEL_CONFLICT'; end if;
    return query select 'existing', attempt.id, attempt.outreach_id, attempt.status, attempt.cancel_reason, attempt.cancelled_at;
    return;
  end if;
  if attempt.status <> 'prepared' then raise exception 'FOLLOW_UP_CANCEL_CONFLICT'; end if;
  update public.backlink_outreach_attempts set status = 'cancelled', cancelled_at = p_cancelled_at, cancel_reason = normalized_reason
  where id = attempt.id and workspace_id = p_workspace_id returning * into attempt;
  return query select 'cancelled', attempt.id, attempt.outreach_id, attempt.status, attempt.cancel_reason, attempt.cancelled_at;
end;
$$;

create or replace function public.cancel_prepared_backlink_outreach_follow_up_attempts_for_inbound_stop()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.effect_kind = 'reply_received_stop' and new.status = 'applied' then
    update public.backlink_outreach_attempts
    set status = 'cancelled', cancelled_at = new.applied_at, cancel_reason = 'inbound_reply'
    where workspace_id = new.workspace_id and outreach_id = new.outreach_id
      and attempt_kind = 'follow_up' and status = 'prepared';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_outreach_inbound_effects_cancel_prepared_follow_up
after insert on public.backlink_outreach_inbound_effects
for each row execute function public.cancel_prepared_backlink_outreach_follow_up_attempts_for_inbound_stop();

create or replace function public.cancel_prepared_backlink_outreach_follow_up_attempts_for_provider_stop()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  reason text;
begin
  if new.status = 'closed' and new.stop_reason in ('provider_complaint', 'provider_permanent_bounce') then
    reason := case new.stop_reason when 'provider_complaint' then 'provider_complaint' else 'provider_permanent_bounce' end;
    update public.backlink_outreach_attempts
    set status = 'cancelled', cancelled_at = coalesce(new.closed_at, timezone('utc', now())), cancel_reason = reason
    where workspace_id = new.workspace_id and outreach_id = new.id
      and attempt_kind = 'follow_up' and status = 'prepared';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_outreach_cancel_prepared_follow_up_for_provider_stop
after update of status, stop_reason on public.backlink_outreach
for each row execute function public.cancel_prepared_backlink_outreach_follow_up_attempts_for_provider_stop();

revoke all on function public.reserve_backlink_outreach_follow_up_attempt(uuid, uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_backlink_outreach_follow_up_attempt(uuid, uuid, uuid, text, text, timestamptz) to service_role;
revoke all on function public.cancel_backlink_outreach_prepared_follow_up_attempt(uuid, uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.cancel_backlink_outreach_prepared_follow_up_attempt(uuid, uuid, uuid, text, timestamptz) to service_role;

comment on function public.reserve_backlink_outreach_follow_up_attempt(uuid, uuid, uuid, text, text, timestamptz) is
  'Atomically reserves one due email follow-up as prepared, consumes next_follow_up_at, and never calls a provider.';
comment on function public.cancel_backlink_outreach_prepared_follow_up_attempt(uuid, uuid, uuid, text, timestamptz) is
  'Atomically transitions only a prepared follow-up Attempt to cancelled before any provider call.';

commit;
