begin;

create table if not exists public.backlink_outreach (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.backlink_campaigns(id) on delete restrict,
  opportunity_id uuid not null references public.backlink_opportunities(id) on delete restrict,
  contact_id uuid not null references public.backlink_contacts(id) on delete restrict,
  outreach_key text not null,
  channel text not null,
  status text not null default 'draft',
  current_attempt smallint not null default 0,
  max_attempts smallint not null default 3,
  first_contact_at timestamptz,
  last_attempt_at timestamptz,
  next_follow_up_at timestamptz,
  closed_at timestamptz,
  last_response_type text,
  stop_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint backlink_outreach_workspace_outreach_key_unique
    unique (workspace_id, outreach_key),
  constraint backlink_outreach_outreach_key_check
    check (outreach_key = upper(trim(outreach_key)) and outreach_key ~ '^BL-OUT-[0-9]{4}-[0-9]{3,}$'),
  constraint backlink_outreach_channel_check
    check (channel in ('email', 'linkedin', 'contact_form', 'slack', 'discord', 'reddit', 'other')),
  constraint backlink_outreach_status_check
    check (
      status in (
        'draft', 'ready', 'active', 'replied', 'conversation_open', 'declined',
        'no_response', 'paused', 'closed'
      )
    ),
  constraint backlink_outreach_current_attempt_check
    check (current_attempt >= 0 and current_attempt <= max_attempts),
  constraint backlink_outreach_max_attempts_check
    check (max_attempts = 3),
  constraint backlink_outreach_last_response_type_check
    check (
      last_response_type is null
      or last_response_type in ('positive', 'negative', 'neutral', 'bounced', 'unsubscribed')
    ),
  constraint backlink_outreach_terminal_state_check
    check (
      (status in ('declined', 'no_response', 'closed')
        and closed_at is not null
        and char_length(trim(coalesce(stop_reason, ''))) > 0)
      or (status not in ('declined', 'no_response', 'closed')
        and closed_at is null
        and stop_reason is null)
    ),
  constraint backlink_outreach_no_response_stop_rule_check
    check (
      status <> 'no_response'
      or (current_attempt = max_attempts and stop_reason = 'attempt_limit')
    )
);

create unique index if not exists backlink_outreach_active_opportunity_contact_channel_unique
  on public.backlink_outreach (opportunity_id, contact_id, channel)
  where status in ('draft', 'ready', 'active', 'replied', 'conversation_open', 'paused');

create index if not exists backlink_outreach_workspace_status_follow_up_idx
  on public.backlink_outreach (workspace_id, status, next_follow_up_at);

create index if not exists backlink_outreach_campaign_created_idx
  on public.backlink_outreach (campaign_id, created_at desc);

create index if not exists backlink_outreach_contact_created_idx
  on public.backlink_outreach (contact_id, created_at desc);

create index if not exists backlink_outreach_opportunity_created_idx
  on public.backlink_outreach (opportunity_id, created_at desc);

create or replace function public.validate_backlink_outreach_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.backlink_campaigns as campaign
    where campaign.id = new.campaign_id
      and campaign.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_OUTREACH_CAMPAIGN_WORKSPACE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.backlink_opportunities as opportunity
    where opportunity.id = new.opportunity_id
      and opportunity.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_OUTREACH_OPPORTUNITY_WORKSPACE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.backlink_contacts as contact
    where contact.id = new.contact_id
      and contact.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_OUTREACH_CONTACT_WORKSPACE_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_backlink_outreach_workspace_integrity
  on public.backlink_outreach;
create trigger trg_backlink_outreach_workspace_integrity
before insert or update of workspace_id, campaign_id, opportunity_id, contact_id on public.backlink_outreach
for each row
execute function public.validate_backlink_outreach_workspace();

drop trigger if exists trg_backlink_outreach_updated_at
  on public.backlink_outreach;
create trigger trg_backlink_outreach_updated_at
before update on public.backlink_outreach
for each row
execute function public.set_backlink_foundation_updated_at();

alter table public.backlink_outreach enable row level security;

create policy "backlink_outreach_select_workspace_members"
on public.backlink_outreach
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_outreach_insert_workspace_admins"
on public.backlink_outreach
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and created_by = auth.uid()
);

create policy "backlink_outreach_update_workspace_admins"
on public.backlink_outreach
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_outreach is
  'Workspace-scoped outreach tracking without message content. Outreach events, templates and queues are intentionally deferred.';

commit;
