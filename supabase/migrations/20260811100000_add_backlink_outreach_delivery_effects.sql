begin;

create table public.backlink_outreach_delivery_effects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  delivery_event_id uuid not null references public.backlink_outreach_delivery_events(id) on delete restrict,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  contact_id uuid not null references public.backlink_contacts(id) on delete restrict,
  effect_kind text not null,
  status text not null,
  applied_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_outreach_delivery_effects_delivery_event_unique unique (delivery_event_id),
  constraint backlink_outreach_delivery_effects_effect_kind_check
    check (effect_kind = 'provider_complaint_stop'),
  constraint backlink_outreach_delivery_effects_status_check
    check (status = 'applied')
);

create index backlink_outreach_delivery_effects_workspace_outreach_applied_at_idx
  on public.backlink_outreach_delivery_effects (workspace_id, outreach_id, applied_at desc);

alter table public.backlink_outreach_delivery_effects enable row level security;
create policy "backlink_outreach_delivery_effects_select_workspace_members"
on public.backlink_outreach_delivery_effects for select to authenticated
using (public.is_workspace_member(workspace_id));

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

revoke all on function public.apply_backlink_outreach_provider_complaint(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_backlink_outreach_provider_complaint(uuid, timestamptz) to service_role;

comment on table public.backlink_outreach_delivery_effects is
  'Durable, idempotent stop-signal effects derived from append-only delivery events. Outreach subject and body remain in backlink_outreach.';
comment on column public.backlink_outreach_delivery_effects.delivery_event_id is
  'Unique audited delivery event source for this effect; duplicate webhook processing returns the canonical effect.';
comment on column public.backlink_outreach_delivery_effects.effect_kind is
  'Currently limited to provider_complaint_stop. Permanent bounce processing is intentionally out of scope.';
comment on column public.backlink_outreach_delivery_effects.status is
  'An effect row is written only when the transaction applied successfully.';

commit;
