begin;

create unique index backlink_outreach_attempts_provider_message_id_unique
  on public.backlink_outreach_attempts (provider, provider_message_id)
  where provider_message_id is not null;

create table public.backlink_outreach_delivery_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  attempt_id uuid not null references public.backlink_outreach_attempts(id) on delete restrict,
  provider text not null,
  provider_event_id text not null,
  provider_message_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_outreach_delivery_events_provider_check
    check (provider = 'resend'),
  constraint backlink_outreach_delivery_events_provider_event_id_check
    check (provider_event_id = trim(provider_event_id) and char_length(provider_event_id) > 0),
  constraint backlink_outreach_delivery_events_provider_message_id_check
    check (provider_message_id = trim(provider_message_id) and char_length(provider_message_id) > 0),
  constraint backlink_outreach_delivery_events_event_type_check
    check (event_type in ('email.delivered', 'email.delivery_delayed', 'email.bounced', 'email.complained')),
  constraint backlink_outreach_delivery_events_provider_event_unique
    unique (provider, provider_event_id)
);

create index backlink_outreach_delivery_events_workspace_outreach_occurred_at_idx
  on public.backlink_outreach_delivery_events (workspace_id, outreach_id, occurred_at desc);

create index backlink_outreach_delivery_events_attempt_occurred_at_idx
  on public.backlink_outreach_delivery_events (attempt_id, occurred_at desc);

create or replace function public.validate_backlink_outreach_delivery_event_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.backlink_outreach_attempts as attempt
    join public.backlink_outreach as outreach on outreach.id = attempt.outreach_id
    where attempt.id = new.attempt_id
      and attempt.workspace_id = new.workspace_id
      and attempt.outreach_id = new.outreach_id
      and outreach.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_OUTREACH_DELIVERY_EVENT_INTEGRITY_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_outreach_delivery_events_integrity
before insert or update of workspace_id, outreach_id, attempt_id on public.backlink_outreach_delivery_events
for each row execute function public.validate_backlink_outreach_delivery_event_integrity();

alter table public.backlink_outreach_delivery_events enable row level security;
create policy "backlink_outreach_delivery_events_select_workspace_members"
on public.backlink_outreach_delivery_events for select to authenticated
using (public.is_workspace_member(workspace_id));

comment on table public.backlink_outreach_delivery_events is
  'Append-only Resend delivery event chronology for correlated Outreach attempts. Email content remains in backlink_outreach.';
comment on column public.backlink_outreach_delivery_events.provider_event_id is
  'Authenticated provider delivery identifier (Resend Svix ID) used for idempotent webhook ingestion.';
comment on column public.backlink_outreach_delivery_events.provider_message_id is
  'Resend email identifier correlated to backlink_outreach_attempts.provider_message_id.';
comment on column public.backlink_outreach_delivery_events.event_type is
  'Observed delivery event only; it does not mutate Outreach, Attempt, or Contact lifecycle state.';

commit;
