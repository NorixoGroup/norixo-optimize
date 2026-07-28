begin;

create table if not exists public.backlink_campaign_opportunities (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.backlink_campaigns(id) on delete restrict,
  opportunity_id uuid not null references public.backlink_opportunities(id) on delete restrict,
  campaign_priority integer,
  membership_status text not null default 'planned',
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default timezone('utc', now()),
  removed_at timestamptz,
  removal_reason text,
  constraint backlink_campaign_opportunities_primary_key primary key (campaign_id, opportunity_id),
  constraint backlink_campaign_opportunities_membership_status_check
    check (membership_status in ('planned', 'active', 'paused', 'completed', 'removed'))
);

create index if not exists backlink_campaign_opportunities_workspace_status_priority_idx
  on public.backlink_campaign_opportunities (workspace_id, membership_status, campaign_priority);

create index if not exists backlink_campaign_opportunities_opportunity_campaign_idx
  on public.backlink_campaign_opportunities (opportunity_id, campaign_id);

create or replace function public.validate_backlink_campaign_opportunity_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qualification_status_value text;
begin
  if not exists (
    select 1
    from public.backlink_campaigns as campaign
    where campaign.id = new.campaign_id
      and campaign.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_CAMPAIGN_OPPORTUNITY_CAMPAIGN_WORKSPACE_MISMATCH';
  end if;

  select opportunity.qualification_status
  into qualification_status_value
  from public.backlink_opportunities as opportunity
  where opportunity.id = new.opportunity_id
    and opportunity.workspace_id = new.workspace_id;

  if not found then
    raise exception 'BACKLINK_CAMPAIGN_OPPORTUNITY_OPPORTUNITY_WORKSPACE_MISMATCH';
  end if;

  if new.membership_status = 'active' and qualification_status_value <> 'Qualified' then
    raise exception 'BACKLINK_CAMPAIGN_OPPORTUNITY_ACTIVE_REQUIRES_QUALIFIED';
  end if;

  return new;
end;
$$;

create trigger trg_backlink_campaign_opportunities_workspace_integrity
before insert or update of workspace_id, campaign_id, opportunity_id, membership_status
on public.backlink_campaign_opportunities
for each row
execute function public.validate_backlink_campaign_opportunity_workspace();

create trigger trg_backlink_campaign_opportunities_workspace_immutable
before update of workspace_id on public.backlink_campaign_opportunities
for each row
execute function public.prevent_backlink_workspace_reassignment();

alter table public.backlink_campaign_opportunities enable row level security;

create policy "backlink_campaign_opportunities_select_workspace_members"
on public.backlink_campaign_opportunities
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_campaign_opportunities_insert_workspace_admins"
on public.backlink_campaign_opportunities
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and added_by = auth.uid()
);

create policy "backlink_campaign_opportunities_update_workspace_admins"
on public.backlink_campaign_opportunities
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_campaign_opportunities is
  'Workspace-scoped campaign inclusion and preparation of backlink opportunities. Outreach remains a separate contact interaction.';

commit;
