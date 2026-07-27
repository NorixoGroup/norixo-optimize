begin;

create table if not exists public.backlink_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_key text not null,
  name text not null,
  objective text not null,
  status text not null default 'draft',
  start_at timestamptz,
  end_at timestamptz,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint backlink_campaigns_workspace_campaign_key_unique
    unique (workspace_id, campaign_key),
  constraint backlink_campaigns_campaign_key_check
    check (campaign_key = upper(trim(campaign_key)) and campaign_key ~ '^BL-CAM-[0-9]{4}-[0-9]{3,}$'),
  constraint backlink_campaigns_name_check
    check (char_length(trim(name)) > 0),
  constraint backlink_campaigns_objective_check
    check (char_length(trim(objective)) > 0),
  constraint backlink_campaigns_status_check
    check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  constraint backlink_campaigns_schedule_check
    check (end_at is null or start_at is null or end_at >= start_at),
  constraint backlink_campaigns_archived_at_check
    check (
      (status = 'archived' and archived_at is not null)
      or (status <> 'archived' and archived_at is null)
    )
);

create index if not exists backlink_campaigns_workspace_status_start_idx
  on public.backlink_campaigns (workspace_id, status, start_at desc);

create or replace function public.validate_backlink_campaign_owner_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = new.workspace_id
      and member.user_id = new.owner_id
  ) then
    raise exception 'BACKLINK_CAMPAIGN_OWNER_WORKSPACE_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_backlink_campaigns_owner_workspace_integrity
  on public.backlink_campaigns;
create trigger trg_backlink_campaigns_owner_workspace_integrity
before insert or update of workspace_id, owner_id on public.backlink_campaigns
for each row
execute function public.validate_backlink_campaign_owner_workspace();

drop trigger if exists trg_backlink_campaigns_updated_at
  on public.backlink_campaigns;
create trigger trg_backlink_campaigns_updated_at
before update on public.backlink_campaigns
for each row
execute function public.set_backlink_foundation_updated_at();

alter table public.backlink_campaigns enable row level security;

create policy "backlink_campaigns_select_workspace_members"
on public.backlink_campaigns
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_campaigns_insert_workspace_admins"
on public.backlink_campaigns
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and created_by = auth.uid()
);

create policy "backlink_campaigns_update_workspace_admins"
on public.backlink_campaigns
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_campaigns is
  'Workspace-scoped operational backlink campaigns. Campaign membership, contacts and outreach are intentionally deferred.';

commit;
