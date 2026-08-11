begin;

create table public.backlink_outreach_inbound_reply_classifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inbound_message_id uuid not null references public.backlink_outreach_inbound_messages(id) on delete restrict,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  contact_id uuid not null references public.backlink_contacts(id) on delete restrict,
  classification text not null,
  classified_by uuid not null references auth.users(id) on delete restrict,
  classified_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_outreach_inbound_reply_classifications_inbound_message_unique unique (inbound_message_id),
  constraint backlink_outreach_inbound_reply_classifications_classification_check
    check (classification in ('positive', 'negative'))
);

create index backlink_outreach_inbound_reply_classifications_workspace_outreach_classified_at_idx
on public.backlink_outreach_inbound_reply_classifications (workspace_id, outreach_id, classified_at desc);

create or replace function public.validate_backlink_outreach_inbound_reply_classification_integrity()
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
      and inbound_message.correlation_status = 'correlated'
      and inbound_message.correlation_method = 'reply_token'
      and outreach.id = new.outreach_id
      and outreach.workspace_id = new.workspace_id
      and outreach.contact_id = new.contact_id
      and contact.id = new.contact_id
      and contact.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_INTEGRITY_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_outreach_inbound_reply_classifications_integrity
before insert or update of workspace_id, inbound_message_id, outreach_id, contact_id
on public.backlink_outreach_inbound_reply_classifications for each row
execute function public.validate_backlink_outreach_inbound_reply_classification_integrity();

alter table public.backlink_outreach_inbound_reply_classifications enable row level security;
create policy "backlink_outreach_inbound_reply_classifications_select_workspace_members"
on public.backlink_outreach_inbound_reply_classifications for select to authenticated
using (public.is_workspace_member(workspace_id));

comment on table public.backlink_outreach_inbound_reply_classifications is
  'Append-only canonical human classifications for correlated reply-token inbound messages. It does not mutate Outreach lifecycle or delivery state.';
comment on column public.backlink_outreach_inbound_reply_classifications.inbound_message_id is
  'Unique canonical inbound message source for this classification; repeated processing must return the existing classification.';
comment on column public.backlink_outreach_inbound_reply_classifications.classification is
  'Human classification limited to positive or negative in the MVP; neutral and other classifications are intentionally deferred.';
comment on constraint backlink_outreach_inbound_reply_classifications_inbound_message_unique
on public.backlink_outreach_inbound_reply_classifications is
  'One canonical append-only classification per inbound message.';

-- The reply_received_stop effect is deliberately not required by this relational trigger.
-- Its sequencing with lifecycle mutation belongs to the future transactional classification RPC.

commit;
