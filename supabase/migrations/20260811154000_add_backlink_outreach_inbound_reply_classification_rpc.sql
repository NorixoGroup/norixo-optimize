begin;

create or replace function public.classify_backlink_outreach_inbound_reply(
  p_inbound_message_id uuid,
  p_classification text,
  p_classified_by uuid,
  p_classified_at timestamptz
)
returns table (
  disposition text,
  inbound_message_id uuid,
  outreach_id uuid,
  contact_id uuid,
  classification text,
  outreach_status text,
  classified_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  inbound_message public.backlink_outreach_inbound_messages;
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  existing_classification public.backlink_outreach_inbound_reply_classifications;
begin
  if p_inbound_message_id is null then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_MESSAGE_NOT_FOUND';
  end if;
  if p_classification is null or p_classification not in ('positive', 'negative') then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_INVALID';
  end if;
  if p_classified_by is null then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_ACTOR_REQUIRED';
  end if;
  if p_classified_at is null then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_TIMESTAMP_REQUIRED';
  end if;

  select * into inbound_message
  from public.backlink_outreach_inbound_messages
  where id = p_inbound_message_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_MESSAGE_NOT_FOUND';
  end if;
  if inbound_message.correlation_status <> 'correlated'
    or inbound_message.correlation_method <> 'reply_token'
    or inbound_message.workspace_id is null
    or inbound_message.outreach_id is null
    or inbound_message.attempt_id is null
    or inbound_message.contact_id is null then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_SOURCE_INVALID';
  end if;

  select * into outreach
  from public.backlink_outreach
  where id = inbound_message.outreach_id
    and workspace_id = inbound_message.workspace_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_OUTREACH_MISMATCH';
  end if;

  select * into contact
  from public.backlink_contacts
  where id = inbound_message.contact_id
    and workspace_id = inbound_message.workspace_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_CONTACT_MISMATCH';
  end if;

  if inbound_message.workspace_id <> outreach.workspace_id
    or inbound_message.outreach_id <> outreach.id
    or inbound_message.contact_id <> outreach.contact_id
    or inbound_message.contact_id <> contact.id
    or inbound_message.workspace_id <> contact.workspace_id then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_INTEGRITY_MISMATCH';
  end if;
  if not exists (
    select 1
    from public.backlink_outreach_attempts as attempt
    where attempt.id = inbound_message.attempt_id
      and attempt.workspace_id = inbound_message.workspace_id
      and attempt.outreach_id = inbound_message.outreach_id
  ) then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_ATTEMPT_MISMATCH';
  end if;
  if not exists (
    select 1
    from public.backlink_outreach_inbound_effects as effect
    where effect.inbound_message_id = inbound_message.id
      and effect.effect_kind = 'reply_received_stop'
      and effect.status = 'applied'
  ) then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_STOP_REQUIRED';
  end if;

  select * into existing_classification
  from public.backlink_outreach_inbound_reply_classifications as classification_row
  where classification_row.inbound_message_id = inbound_message.id;
  if found then
    if existing_classification.classification <> p_classification then
      raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_CONFLICT';
    end if;
    return query select
      'existing',
      existing_classification.inbound_message_id,
      existing_classification.outreach_id,
      existing_classification.contact_id,
      existing_classification.classification,
      outreach.status,
      existing_classification.classified_at;
    return;
  end if;

  if outreach.status <> 'active' then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_OUTREACH_NOT_ACTIVE';
  end if;

  -- The audit insert precedes the lifecycle update; PostgreSQL rolls both back on either failure.
  insert into public.backlink_outreach_inbound_reply_classifications (
    workspace_id,
    inbound_message_id,
    outreach_id,
    contact_id,
    classification,
    classified_by,
    classified_at
  ) values (
    inbound_message.workspace_id,
    inbound_message.id,
    inbound_message.outreach_id,
    inbound_message.contact_id,
    p_classification,
    p_classified_by,
    p_classified_at
  );

  if p_classification = 'positive' then
    update public.backlink_outreach
    set status = 'replied',
        last_response_type = 'positive',
        next_follow_up_at = null,
        closed_at = null,
        stop_reason = null
    where id = outreach.id
      and workspace_id = outreach.workspace_id
    returning * into outreach;
  else
    update public.backlink_outreach
    set status = 'declined',
        last_response_type = 'negative',
        closed_at = p_classified_at,
        stop_reason = 'inbound_negative_reply',
        next_follow_up_at = null
    where id = outreach.id
      and workspace_id = outreach.workspace_id
    returning * into outreach;
  end if;

  return query select
    'applied',
    inbound_message.id,
    outreach.id,
    contact.id,
    p_classification,
    outreach.status,
    p_classified_at;
end;
$$;

revoke all on function public.classify_backlink_outreach_inbound_reply(uuid, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.classify_backlink_outreach_inbound_reply(uuid, text, uuid, timestamptz) to service_role;

comment on function public.classify_backlink_outreach_inbound_reply(uuid, text, uuid, timestamptz) is
  'Atomically writes one human positive or negative classification after reply_received_stop and transitions only active Outreach. Audit insertion precedes lifecycle update; either failure rolls back both.';

commit;
