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
  set next_follow_up_at = null,
      response_deadline_at = null
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
        response_deadline_at = null,
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
        next_follow_up_at = null,
        response_deadline_at = null
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

create or replace function public.apply_backlink_outreach_provider_complaint(
  p_delivery_event_id uuid,
  p_applied_at timestamptz default timezone('utc', now())
)
returns table (
  disposition text,
  delivery_event_id uuid,
  outreach_id uuid,
  contact_id uuid,
  contact_status text,
  outreach_status text,
  applied_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_event public.backlink_outreach_delivery_events;
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  existing_effect public.backlink_outreach_delivery_effects;
  effective_applied_at timestamptz := coalesce(p_applied_at, timezone('utc', now()));
begin
  if p_delivery_event_id is null then
    raise exception 'BACKLINK_OUTREACH_PROVIDER_COMPLAINT_EVENT_NOT_FOUND';
  end if;

  select * into delivery_event
  from public.backlink_outreach_delivery_events
  where id = p_delivery_event_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_PROVIDER_COMPLAINT_EVENT_NOT_FOUND';
  end if;
  if delivery_event.event_type <> 'email.complained' then
    raise exception 'BACKLINK_OUTREACH_PROVIDER_COMPLAINT_EVENT_TYPE_INVALID';
  end if;

  select * into outreach
  from public.backlink_outreach
  where id = delivery_event.outreach_id
    and workspace_id = delivery_event.workspace_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_PROVIDER_COMPLAINT_OUTREACH_MISMATCH';
  end if;

  select * into contact
  from public.backlink_contacts
  where id = outreach.contact_id
    and workspace_id = delivery_event.workspace_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_PROVIDER_COMPLAINT_CONTACT_MISMATCH';
  end if;

  select * into existing_effect
  from public.backlink_outreach_delivery_effects as effect
  where effect.delivery_event_id = delivery_event.id;
  if found then
    return query select
      'existing',
      existing_effect.delivery_event_id,
      existing_effect.outreach_id,
      existing_effect.contact_id,
      contact.contact_status,
      outreach.status,
      existing_effect.applied_at;
    return;
  end if;

  if contact.contact_status = 'archived' then
    if contact.do_not_contact_at is null and contact.do_not_contact_reason is null then
      update public.backlink_contacts
      set do_not_contact_at = effective_applied_at,
          do_not_contact_reason = 'provider_complaint'
      where id = contact.id;
    end if;
  elsif contact.contact_status <> 'do_not_contact' then
    update public.backlink_contacts
    set contact_status = 'do_not_contact',
        do_not_contact_at = effective_applied_at,
        do_not_contact_reason = 'provider_complaint'
    where id = contact.id;
  end if;

  if outreach.status = 'active' then
    update public.backlink_outreach
    set status = 'closed',
        closed_at = effective_applied_at,
        stop_reason = 'provider_complaint',
        last_response_type = null,
        next_follow_up_at = null,
        response_deadline_at = null
    where id = outreach.id;
  elsif outreach.status = 'replied' then
    update public.backlink_outreach
    set status = 'closed',
        closed_at = effective_applied_at,
        stop_reason = 'provider_complaint',
        next_follow_up_at = null,
        response_deadline_at = null
    where id = outreach.id;
  end if;

  insert into public.backlink_outreach_delivery_effects (
    workspace_id,
    delivery_event_id,
    outreach_id,
    contact_id,
    effect_kind,
    status,
    applied_at
  ) values (
    delivery_event.workspace_id,
    delivery_event.id,
    outreach.id,
    contact.id,
    'provider_complaint_stop',
    'applied',
    effective_applied_at
  );

  select * into outreach from public.backlink_outreach where id = delivery_event.outreach_id;
  select * into contact from public.backlink_contacts where id = outreach.contact_id;
  return query select
    'applied',
    delivery_event.id,
    outreach.id,
    contact.id,
    contact.contact_status,
    outreach.status,
    effective_applied_at;
end;
$$;

create or replace function public.apply_backlink_outreach_provider_permanent_bounce(
  p_delivery_event_id uuid,
  p_applied_at timestamptz default timezone('utc', now())
)
returns table (
  disposition text,
  delivery_event_id uuid,
  outreach_id uuid,
  contact_id uuid,
  contact_status text,
  outreach_status text,
  applied_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_event public.backlink_outreach_delivery_events;
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  existing_effect public.backlink_outreach_delivery_effects;
  effective_applied_at timestamptz := coalesce(p_applied_at, timezone('utc', now()));
begin
  if p_delivery_event_id is null then
    raise exception 'BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_EVENT_NOT_FOUND';
  end if;

  select * into delivery_event
  from public.backlink_outreach_delivery_events
  where id = p_delivery_event_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_EVENT_NOT_FOUND';
  end if;
  if delivery_event.event_type <> 'email.bounced' or delivery_event.bounce_type <> 'permanent' then
    raise exception 'BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_EVENT_INVALID';
  end if;

  select * into outreach
  from public.backlink_outreach
  where id = delivery_event.outreach_id
    and workspace_id = delivery_event.workspace_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_OUTREACH_MISMATCH';
  end if;

  select * into contact
  from public.backlink_contacts
  where id = outreach.contact_id
    and workspace_id = delivery_event.workspace_id
  for update;
  if not found then
    raise exception 'BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_CONTACT_MISMATCH';
  end if;

  select * into existing_effect
  from public.backlink_outreach_delivery_effects as effect
  where effect.delivery_event_id = delivery_event.id;
  if found then
    return query select
      'existing',
      existing_effect.delivery_event_id,
      existing_effect.outreach_id,
      existing_effect.contact_id,
      contact.contact_status,
      outreach.status,
      existing_effect.applied_at;
    return;
  end if;

  if contact.contact_status = 'archived' then
    if contact.do_not_contact_at is null or char_length(trim(coalesce(contact.do_not_contact_reason, ''))) = 0 then
      update public.backlink_contacts
      set do_not_contact_at = coalesce(contact.do_not_contact_at, effective_applied_at),
          do_not_contact_reason = coalesce(nullif(trim(contact.do_not_contact_reason), ''), 'provider_permanent_bounce')
      where id = contact.id;
    end if;
  elsif contact.contact_status <> 'do_not_contact' then
    update public.backlink_contacts
    set contact_status = 'do_not_contact',
        do_not_contact_at = coalesce(contact.do_not_contact_at, effective_applied_at),
        do_not_contact_reason = coalesce(nullif(trim(contact.do_not_contact_reason), ''), 'provider_permanent_bounce')
    where id = contact.id;
  end if;

  if outreach.status = 'active' then
    update public.backlink_outreach
    set status = 'closed',
        closed_at = effective_applied_at,
        stop_reason = 'provider_permanent_bounce',
        last_response_type = 'bounced',
        next_follow_up_at = null,
        response_deadline_at = null
    where id = outreach.id;
  elsif outreach.status = 'replied' then
    update public.backlink_outreach
    set status = 'closed',
        closed_at = effective_applied_at,
        stop_reason = 'provider_permanent_bounce',
        next_follow_up_at = null,
        response_deadline_at = null
    where id = outreach.id;
  end if;

  insert into public.backlink_outreach_delivery_effects (
    workspace_id,
    delivery_event_id,
    outreach_id,
    contact_id,
    effect_kind,
    status,
    applied_at
  ) values (
    delivery_event.workspace_id,
    delivery_event.id,
    outreach.id,
    contact.id,
    'provider_permanent_bounce_stop',
    'applied',
    effective_applied_at
  );

  select * into outreach from public.backlink_outreach where id = delivery_event.outreach_id;
  select * into contact from public.backlink_contacts where id = outreach.contact_id;
  return query select
    'applied',
    delivery_event.id,
    outreach.id,
    contact.id,
    contact.contact_status,
    outreach.status,
    effective_applied_at;
end;
$$;

update public.backlink_outreach
set response_deadline_at = null
where response_deadline_at is not null
  and status in ('replied', 'conversation_open', 'declined', 'no_response', 'paused', 'closed');

update public.backlink_outreach as outreach
set response_deadline_at = null
where outreach.response_deadline_at is not null
  and outreach.status = 'active'
  and exists (
    select 1
    from public.backlink_outreach_inbound_effects as inbound_stop
    where inbound_stop.workspace_id = outreach.workspace_id
      and inbound_stop.outreach_id = outreach.id
      and inbound_stop.effect_kind = 'reply_received_stop'
      and inbound_stop.status = 'applied'
  );

commit;
