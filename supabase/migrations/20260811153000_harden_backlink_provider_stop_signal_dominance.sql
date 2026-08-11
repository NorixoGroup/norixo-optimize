begin;

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
        next_follow_up_at = null
    where id = outreach.id;
  elsif outreach.status = 'replied' then
    update public.backlink_outreach
    set status = 'closed',
        closed_at = effective_applied_at,
        stop_reason = 'provider_complaint',
        next_follow_up_at = null
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
        next_follow_up_at = null
    where id = outreach.id;
  elsif outreach.status = 'replied' then
    update public.backlink_outreach
    set status = 'closed',
        closed_at = effective_applied_at,
        stop_reason = 'provider_permanent_bounce',
        next_follow_up_at = null
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

comment on function public.apply_backlink_outreach_provider_complaint(uuid, timestamptz) is
  'Provider complaint closes active or replied Outreach. The replied branch preserves last_response_type as prior human response audit.';
comment on function public.apply_backlink_outreach_provider_permanent_bounce(uuid, timestamptz) is
  'Permanent bounce closes active or replied Outreach. The replied branch preserves last_response_type; bounced is recorded only from active.';

commit;
