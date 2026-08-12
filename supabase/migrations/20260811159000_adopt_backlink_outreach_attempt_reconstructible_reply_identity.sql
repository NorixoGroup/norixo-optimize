begin;

drop function public.reserve_backlink_outreach_follow_up_attempt(uuid, uuid, uuid, text, text, timestamptz);

create function public.reserve_backlink_outreach_follow_up_attempt(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_attempt_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text,
  p_reply_token_hash text,
  p_reply_token_key_version text,
  p_reserved_at timestamptz
)
returns table (disposition text, attempt_id uuid, outreach_id uuid, attempt_status text, attempt_kind text, prepared_at timestamptz, requested_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  existing_attempt public.backlink_outreach_attempts;
  open_attempt public.backlink_outreach_attempts;
  inbound_stop_effect public.backlink_outreach_inbound_effects;
  reserved_attempt public.backlink_outreach_attempts;
  normalized_key text := trim(coalesce(p_idempotency_key, ''));
  normalized_token_hash text := lower(trim(coalesce(p_reply_token_hash, '')));
  normalized_key_version text := lower(trim(coalesce(p_reply_token_key_version, '')));
begin
  if p_workspace_id is null or p_outreach_id is null then raise exception 'FOLLOW_UP_OUTREACH_NOT_ACTIVE'; end if;
  if normalized_key = '' then raise exception 'FOLLOW_UP_IDEMPOTENCY_CONFLICT'; end if;
  select * into existing_attempt from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id and attempt.idempotency_key = normalized_key;
  if found then
    if existing_attempt.outreach_id <> p_outreach_id or existing_attempt.attempt_kind <> 'follow_up' then raise exception 'FOLLOW_UP_IDEMPOTENCY_CONFLICT'; end if;
    return query select 'existing', existing_attempt.id, existing_attempt.outreach_id, existing_attempt.status, existing_attempt.attempt_kind, existing_attempt.prepared_at, existing_attempt.requested_at;
    return;
  end if;
  if p_attempt_id is null or p_actor_user_id is null or not exists (select 1 from auth.users where id = p_actor_user_id) then raise exception 'FOLLOW_UP_ACTOR_REQUIRED'; end if;
  if normalized_token_hash !~ '^[0-9a-f]{64}$' or normalized_key_version !~ '^v[1-9][0-9]{0,15}$' then raise exception 'FOLLOW_UP_IDEMPOTENCY_CONFLICT'; end if;
  if p_reserved_at is null then raise exception 'FOLLOW_UP_NOT_DUE'; end if;

  select * into outreach from public.backlink_outreach where id = p_outreach_id and workspace_id = p_workspace_id for update;
  if not found or outreach.status <> 'active' then raise exception 'FOLLOW_UP_OUTREACH_NOT_ACTIVE'; end if;
  if outreach.channel <> 'email' then raise exception 'FOLLOW_UP_CHANNEL_NOT_SUPPORTED'; end if;
  if outreach.next_follow_up_at is null then raise exception 'FOLLOW_UP_NOT_SCHEDULED'; end if;
  if outreach.next_follow_up_at > p_reserved_at then raise exception 'FOLLOW_UP_NOT_DUE'; end if;
  if outreach.current_attempt >= outreach.max_attempts then raise exception 'FOLLOW_UP_ATTEMPT_LIMIT_REACHED'; end if;
  select * into contact from public.backlink_contacts where id = outreach.contact_id and workspace_id = p_workspace_id for update;
  if not found or contact.contact_status in ('do_not_contact', 'archived') or nullif(trim(contact.email_normalized), '') is null then raise exception 'FOLLOW_UP_CONTACT_UNAVAILABLE'; end if;
  select * into open_attempt from public.backlink_outreach_attempts as attempt where attempt.workspace_id = p_workspace_id and attempt.outreach_id = outreach.id and attempt.status in ('prepared', 'requested', 'unknown') order by attempt.prepared_at desc nulls last, attempt.requested_at desc nulls last limit 1 for update;
  if found then
    if open_attempt.status = 'prepared' then raise exception 'FOLLOW_UP_ATTEMPT_PREPARED'; end if;
    if open_attempt.status = 'unknown' then raise exception 'FOLLOW_UP_ATTEMPT_UNRESOLVED'; end if;
    raise exception 'FOLLOW_UP_ATTEMPT_IN_PROGRESS';
  end if;
  select * into inbound_stop_effect from public.backlink_outreach_inbound_effects as effect where effect.workspace_id = p_workspace_id and effect.outreach_id = outreach.id and effect.effect_kind = 'reply_received_stop' and effect.status = 'applied' for update;
  if found then raise exception 'FOLLOW_UP_INBOUND_REPLY_STOPPED'; end if;
  insert into public.backlink_outreach_attempts (id, workspace_id, outreach_id, actor_user_id, channel, provider, recipient, idempotency_key, reply_token_hash, reply_token_key_version, attempt_kind, status, prepared_at)
  values (p_attempt_id, outreach.workspace_id, outreach.id, p_actor_user_id, 'email', 'resend', trim(contact.email_normalized), normalized_key, normalized_token_hash, normalized_key_version, 'follow_up', 'prepared', p_reserved_at)
  on conflict (workspace_id, idempotency_key) do nothing returning * into reserved_attempt;
  if not found then
    select * into existing_attempt from public.backlink_outreach_attempts as attempt where attempt.workspace_id = p_workspace_id and attempt.idempotency_key = normalized_key;
    if found and existing_attempt.outreach_id = outreach.id and existing_attempt.attempt_kind = 'follow_up' then
      return query select 'existing', existing_attempt.id, existing_attempt.outreach_id, existing_attempt.status, existing_attempt.attempt_kind, existing_attempt.prepared_at, existing_attempt.requested_at;
      return;
    end if;
    raise exception 'FOLLOW_UP_IDEMPOTENCY_CONFLICT';
  end if;
  update public.backlink_outreach set next_follow_up_at = null where id = outreach.id and workspace_id = outreach.workspace_id;
  return query select 'reserved', reserved_attempt.id, reserved_attempt.outreach_id, reserved_attempt.status, reserved_attempt.attempt_kind, reserved_attempt.prepared_at, reserved_attempt.requested_at;
end;
$$;

revoke all on function public.reserve_backlink_outreach_follow_up_attempt(uuid, uuid, uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_backlink_outreach_follow_up_attempt(uuid, uuid, uuid, uuid, text, text, text, timestamptz) to service_role;
comment on function public.reserve_backlink_outreach_follow_up_attempt(uuid, uuid, uuid, uuid, text, text, text, timestamptz) is
  'Atomically reserves one due email follow-up as prepared with a preallocated reconstructible Reply-To identity; never calls a provider.';

commit;
