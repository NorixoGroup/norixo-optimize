begin;

create table public.backlink_outreach_inbound_effects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inbound_message_id uuid not null references public.backlink_outreach_inbound_messages(id) on delete restrict,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  contact_id uuid not null references public.backlink_contacts(id) on delete restrict,
  effect_kind text not null,
  status text not null,
  applied_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_outreach_inbound_effects_inbound_message_unique unique (inbound_message_id),
  constraint backlink_outreach_inbound_effects_effect_kind_check
    check (effect_kind = 'reply_received_stop'),
  constraint backlink_outreach_inbound_effects_status_check
    check (status = 'applied')
);

create or replace function public.validate_backlink_outreach_inbound_effect_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1
    from public.backlink_outreach_inbound_messages as inbound_message
    join public.backlink_outreach as outreach on outreach.id = inbound_message.outreach_id
    join public.backlink_contacts as contact on contact.id = inbound_message.contact_id
    where inbound_message.id = new.inbound_message_id
      and inbound_message.workspace_id = new.workspace_id
      and inbound_message.outreach_id = new.outreach_id
      and inbound_message.contact_id = new.contact_id
      and outreach.id = new.outreach_id
      and outreach.workspace_id = new.workspace_id
      and outreach.contact_id = new.contact_id
      and contact.id = new.contact_id
      and contact.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_OUTREACH_INBOUND_EFFECT_INTEGRITY_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_outreach_inbound_effects_integrity
before insert or update of workspace_id, inbound_message_id, outreach_id, contact_id
on public.backlink_outreach_inbound_effects for each row
execute function public.validate_backlink_outreach_inbound_effect_integrity();

alter table public.backlink_outreach_inbound_effects enable row level security;
create policy "backlink_outreach_inbound_effects_select_workspace_members"
on public.backlink_outreach_inbound_effects for select to authenticated
using (public.is_workspace_member(workspace_id));

comment on table public.backlink_outreach_inbound_effects is
  'Append-only audited stop effects derived from correlated inbound replies. It does not classify replies or store email content.';
comment on column public.backlink_outreach_inbound_effects.inbound_message_id is
  'Unique canonical inbound message source for this effect; duplicate processing must return the existing effect.';
comment on column public.backlink_outreach_inbound_effects.effect_kind is
  'Currently limited to reply_received_stop, which only clears an Outreach follow-up schedule in the future transactional apply primitive.';

commit;
