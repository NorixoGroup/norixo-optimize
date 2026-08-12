begin;

create function public.mark_backlink_outreach_follow_up_attempt_requested(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_attempt_id uuid,
  p_actor_user_id uuid,
  p_requested_at timestamptz
)
returns table (
  disposition text,
  attempt_id uuid,
  outreach_id uuid,
  recipient text,
  subject text,
  body text,
  reply_token_hash text,
  reply_token_key_version text,
  requested_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  attempt public.backlink_outreach_attempts;
  draft public.backlink_outreach_follow_up_drafts;
  inbound_stop_effect public.backlink_outreach_inbound_effects;
begin
  if p_workspace_id is null or p_outreach_id is null or p_attempt_id is null or p_actor_user_id is null or p_requested_at is null then
    raise exception 'FOLLOW_UP_SEND_INVALID';
  end if;
  if not exists (select 1 from auth.users where id = p_actor_user_id) then
    raise exception 'FOLLOW_UP_SEND_ACTOR_REQUIRED';
  end if;

  -- Lock order: Outreach, Contact, Attempt, Draft, inbound reply effects.
  select * into outreach
  from public.backlink_outreach
  where id = p_outreach_id and workspace_id = p_workspace_id
  for update;
  if not found or outreach.status <> 'active' then raise exception 'FOLLOW_UP_SEND_OUTREACH_NOT_ACTIVE'; end if;
  if outreach.channel <> 'email' then raise exception 'FOLLOW_UP_SEND_CHANNEL_NOT_SUPPORTED'; end if;
  if outreach.current_attempt >= outreach.max_attempts then raise exception 'FOLLOW_UP_SEND_ATTEMPT_LIMIT_REACHED'; end if;

  select * into contact
  from public.backlink_contacts
  where id = outreach.contact_id and workspace_id = p_workspace_id
  for update;
  if not found or contact.contact_status in ('do_not_contact', 'archived') or nullif(trim(contact.email_normalized), '') is null then
    update public.backlink_outreach_attempts
    set status = 'cancelled',
        cancelled_at = p_requested_at,
        cancel_reason = 'contact_unavailable'
    where id = p_attempt_id
      and workspace_id = p_workspace_id
      and outreach_id = outreach.id
      and attempt_kind = 'follow_up'
      and status = 'prepared';
    raise exception 'FOLLOW_UP_SEND_CONTACT_UNAVAILABLE';
  end if;

  select * into attempt
  from public.backlink_outreach_attempts
  where id = p_attempt_id
    and workspace_id = p_workspace_id
    and outreach_id = outreach.id
  for update;
  if not found or attempt.attempt_kind <> 'follow_up' then raise exception 'FOLLOW_UP_SEND_ATTEMPT_INVALID'; end if;
  if attempt.status = 'requested' then
    select * into draft from public.backlink_outreach_follow_up_drafts
    where workspace_id = p_workspace_id and outreach_id = outreach.id and attempt_id = attempt.id
    for update;
    if not found then raise exception 'FOLLOW_UP_SEND_DRAFT_INVALID'; end if;
    return query select 'existing', attempt.id, attempt.outreach_id, attempt.recipient, draft.subject, draft.body, attempt.reply_token_hash, attempt.reply_token_key_version, attempt.requested_at;
    return;
  end if;
  if attempt.status <> 'prepared' then raise exception 'FOLLOW_UP_SEND_ATTEMPT_INVALID'; end if;
  if nullif(trim(coalesce(attempt.reply_token_hash, '')), '') is null or nullif(trim(coalesce(attempt.reply_token_key_version, '')), '') is null then
    raise exception 'FOLLOW_UP_SEND_LEGACY_IDENTITY';
  end if;
  if attempt.reply_token_hash !~ '^[0-9a-f]{64}$' or attempt.reply_token_key_version !~ '^v[1-9][0-9]{0,15}$' then
    raise exception 'FOLLOW_UP_SEND_LEGACY_IDENTITY';
  end if;

  select * into draft
  from public.backlink_outreach_follow_up_drafts
  where workspace_id = p_workspace_id
    and outreach_id = outreach.id
    and attempt_id = attempt.id
  for update;
  if not found or char_length(trim(draft.subject)) not between 1 and 300 or char_length(trim(draft.body)) not between 1 and 10000 then
    raise exception 'FOLLOW_UP_SEND_DRAFT_INVALID';
  end if;

  select * into inbound_stop_effect
  from public.backlink_outreach_inbound_effects as effect
  where effect.workspace_id = p_workspace_id
    and effect.outreach_id = outreach.id
    and effect.effect_kind = 'reply_received_stop'
    and effect.status = 'applied'
  for update;
  if found then raise exception 'FOLLOW_UP_SEND_INBOUND_REPLY_STOPPED'; end if;

  update public.backlink_outreach_attempts
  set status = 'requested',
      requested_at = p_requested_at
  where id = attempt.id
    and workspace_id = p_workspace_id
    and status = 'prepared'
  returning * into attempt;
  if not found then raise exception 'FOLLOW_UP_SEND_ATTEMPT_INVALID'; end if;

  return query select 'requested_now', attempt.id, attempt.outreach_id, attempt.recipient, draft.subject, draft.body, attempt.reply_token_hash, attempt.reply_token_key_version, attempt.requested_at;
end;
$$;

revoke all on function public.mark_backlink_outreach_follow_up_attempt_requested(uuid, uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.mark_backlink_outreach_follow_up_attempt_requested(uuid, uuid, uuid, uuid, timestamptz) to service_role;
comment on function public.mark_backlink_outreach_follow_up_attempt_requested(uuid, uuid, uuid, uuid, timestamptz) is
  'Atomically revalidates a prepared email follow-up Attempt, returns canonical draft content, and transitions it to requested before the application calls the provider.';

commit;
