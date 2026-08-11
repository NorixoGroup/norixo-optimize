begin;

create or replace function public.apply_backlink_outreach_inbound_reply_stop(
  p_inbound_message_id uuid,
  p_applied_at timestamptz
)
returns table (
  disposition text,
  inbound_message_id uuid,
  outreach_id uuid,
  contact_id uuid,
  outreach_status text,
  applied_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  inbound_message public.backlink_outreach_inbound_messages;
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  existing_effect public.backlink_outreach_inbound_effects;
begin
  if p_inbound_message_id is null then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_MESSAGE_NOT_FOUND';
  end if;
  if p_applied_at is null then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_APPLIED_AT_REQUIRED';
  end if;

  select * into inbound_message
  from public.backlink_outreach_inbound_messages
  where id = p_inbound_message_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_MESSAGE_NOT_FOUND';
  end if;
  if inbound_message.correlation_status <> 'correlated'
    or inbound_message.correlation_method <> 'reply_token'
    or inbound_message.workspace_id is null
    or inbound_message.outreach_id is null
    or inbound_message.attempt_id is null
    or inbound_message.contact_id is null then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_SOURCE_INVALID';
  end if;

  select * into existing_effect
  from public.backlink_outreach_inbound_effects as effect
  where effect.inbound_message_id = inbound_message.id;
  if found then
    select * into outreach
    from public.backlink_outreach
    where id = existing_effect.outreach_id
      and workspace_id = existing_effect.workspace_id;
    if not found then
      raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_OUTREACH_MISMATCH';
    end if;
    return query select
      'existing',
      existing_effect.inbound_message_id,
      existing_effect.outreach_id,
      existing_effect.contact_id,
      outreach.status,
      existing_effect.applied_at;
    return;
  end if;

  select * into outreach
  from public.backlink_outreach
  where id = inbound_message.outreach_id
    and workspace_id = inbound_message.workspace_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_OUTREACH_MISMATCH';
  end if;

  select * into contact
  from public.backlink_contacts
  where id = inbound_message.contact_id
    and workspace_id = inbound_message.workspace_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CONTACT_MISMATCH';
  end if;

  if inbound_message.workspace_id <> outreach.workspace_id
    or inbound_message.outreach_id <> outreach.id
    or inbound_message.contact_id <> outreach.contact_id
    or inbound_message.contact_id <> contact.id
    or inbound_message.workspace_id <> contact.workspace_id then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_INTEGRITY_MISMATCH';
  end if;
  if not exists (
    select 1
    from public.backlink_outreach_attempts as attempt
    where attempt.id = inbound_message.attempt_id
      and attempt.workspace_id = inbound_message.workspace_id
      and attempt.outreach_id = inbound_message.outreach_id
  ) then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_ATTEMPT_MISMATCH';
  end if;

  update public.backlink_outreach
  set next_follow_up_at = null
  where id = outreach.id
    and workspace_id = outreach.workspace_id;

  insert into public.backlink_outreach_inbound_effects (
    workspace_id,
    inbound_message_id,
    outreach_id,
    contact_id,
    effect_kind,
    status,
    applied_at
  ) values (
    inbound_message.workspace_id,
    inbound_message.id,
    inbound_message.outreach_id,
    inbound_message.contact_id,
    'reply_received_stop',
    'applied',
    p_applied_at
  );

  return query select
    'applied',
    inbound_message.id,
    outreach.id,
    contact.id,
    outreach.status,
    p_applied_at;
end;
$$;

revoke all on function public.apply_backlink_outreach_inbound_reply_stop(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_backlink_outreach_inbound_reply_stop(uuid, timestamptz) to service_role;

comment on function public.apply_backlink_outreach_inbound_reply_stop(uuid, timestamptz) is
  'Atomically clears only next_follow_up_at and writes one append-only reply_received_stop effect for a strongly correlated inbound reply.';

commit;
