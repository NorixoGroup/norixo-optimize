begin;

create table if not exists public.backlink_opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_key text not null,
  domain_id uuid not null references public.backlink_domains(id) on delete restrict,
  asset_id uuid not null references public.backlink_assets(id) on delete restrict,
  opportunity_type text not null,
  target_page_url text not null,
  target_page_title text not null,
  page_type text not null,
  evidence_summary text not null,
  qualification_status text not null default 'Needs Review',
  discovery_status text not null default 'To Research',
  editorial_status text not null default 'Not Started',
  priority text not null default 'Tier C',
  lifecycle_status text not null default 'active',
  editorial_angle text,
  convention_risk boolean not null default false,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  closed_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  archived_at timestamptz,
  constraint backlink_opportunities_workspace_opportunity_key_unique
    unique (workspace_id, opportunity_key),
  constraint backlink_opportunities_domain_page_type_asset_unique
    unique (domain_id, target_page_url, opportunity_type, asset_id),
  constraint backlink_opportunities_opportunity_key_check
    check (opportunity_key = upper(trim(opportunity_key)) and opportunity_key ~ '^OP-[0-9]{6,}$'),
  constraint backlink_opportunities_opportunity_type_check
    check (char_length(trim(opportunity_type)) > 0),
  constraint backlink_opportunities_target_page_url_check
    check (
      target_page_url = trim(target_page_url)
      and target_page_url ~ '^https?://'
    ),
  constraint backlink_opportunities_target_page_title_check
    check (char_length(trim(target_page_title)) > 0),
  constraint backlink_opportunities_page_type_check
    check (
      page_type in (
        'Resource Page', 'Recommended Tools', 'Blog Article', 'Research Publication',
        'Industry Report', 'Statistics Page', 'Methodology Page', 'Directory',
        'Software Listing', 'Partner Page', 'Knowledge Base', 'Best Tools List',
        'Guide', 'Case Study', 'Documentation', 'Press Page', 'News Article',
        'Community Resource'
      )
    ),
  constraint backlink_opportunities_evidence_summary_check
    check (char_length(trim(evidence_summary)) > 0),
  constraint backlink_opportunities_qualification_status_check
    check (qualification_status in ('Qualified', 'Needs Review', 'Not Suitable', 'Blocked')),
  constraint backlink_opportunities_discovery_status_check
    check (discovery_status in ('To Research', 'Researching', 'Identified', 'Verified')),
  constraint backlink_opportunities_editorial_status_check
    check (
      editorial_status in (
        'Not Started', 'Page Identified', 'Ready for Contact', 'Contacted',
        'In Discussion', 'Link Acquired', 'Closed'
      )
    ),
  constraint backlink_opportunities_priority_check
    check (priority in ('Tier A', 'Tier B', 'Tier C')),
  constraint backlink_opportunities_lifecycle_status_check
    check (lifecycle_status in ('active', 'closed', 'archived')),
  constraint backlink_opportunities_closed_state_check
    check (
      (lifecycle_status = 'active' and closed_at is null and archived_at is null)
      or (lifecycle_status = 'closed' and closed_at is not null and archived_at is null)
      or (lifecycle_status = 'archived' and archived_at is not null)
    ),
  constraint backlink_opportunities_closed_reason_check
    check (
      (lifecycle_status = 'active' and closed_reason is null)
      or (lifecycle_status in ('closed', 'archived') and char_length(trim(coalesce(closed_reason, ''))) > 0)
    )
);

create index if not exists backlink_opportunities_workspace_qualification_queue_idx
  on public.backlink_opportunities (workspace_id, qualification_status, priority, next_review_at);

create index if not exists backlink_opportunities_workspace_editorial_queue_idx
  on public.backlink_opportunities (workspace_id, editorial_status, assigned_to, updated_at desc);

create index if not exists backlink_opportunities_workspace_asset_idx
  on public.backlink_opportunities (workspace_id, asset_id);

create or replace function public.validate_backlink_opportunity_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.backlink_domains as domain
    where domain.id = new.domain_id
      and domain.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_OPPORTUNITY_DOMAIN_WORKSPACE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.backlink_assets as asset
    where asset.id = new.asset_id
      and asset.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_OPPORTUNITY_ASSET_WORKSPACE_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_backlink_opportunities_workspace_integrity
  on public.backlink_opportunities;
create trigger trg_backlink_opportunities_workspace_integrity
before insert or update of workspace_id, domain_id, asset_id on public.backlink_opportunities
for each row
execute function public.validate_backlink_opportunity_workspace();

drop trigger if exists trg_backlink_opportunities_updated_at
  on public.backlink_opportunities;
create trigger trg_backlink_opportunities_updated_at
before update on public.backlink_opportunities
for each row
execute function public.set_backlink_foundation_updated_at();

alter table public.backlink_opportunities enable row level security;

create policy "backlink_opportunities_select_workspace_members"
on public.backlink_opportunities
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_opportunities_insert_workspace_admins"
on public.backlink_opportunities
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and created_by = auth.uid()
);

create policy "backlink_opportunities_update_workspace_admins"
on public.backlink_opportunities
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_opportunities is
  'Workspace-scoped page-level backlink opportunities. Contacts, outreach, campaigns, links and tag relations are intentionally deferred.';

commit;
