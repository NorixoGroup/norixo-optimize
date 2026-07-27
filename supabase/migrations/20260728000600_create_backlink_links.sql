begin;

create table if not exists public.backlink_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  opportunity_id uuid not null references public.backlink_opportunities(id) on delete restrict,
  domain_id uuid not null references public.backlink_domains(id) on delete restrict,
  asset_id uuid not null references public.backlink_assets(id) on delete restrict,
  backlink_key text not null,
  source_url text not null,
  target_url text not null,
  anchor_text text,
  rel_type text,
  link_location text,
  status text not null default 'observed',
  acquired_at timestamptz not null,
  first_verified_at timestamptz,
  last_verified_at timestamptz,
  last_seen_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  verification_source text,
  verification_evidence text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint backlink_links_workspace_backlink_key_unique
    unique (workspace_id, backlink_key),
  constraint backlink_links_opportunity_source_target_unique
    unique (opportunity_id, source_url, target_url),
  constraint backlink_links_backlink_key_check
    check (backlink_key = upper(trim(backlink_key)) and backlink_key ~ '^BL-LNK-[0-9]{6,}$'),
  constraint backlink_links_source_url_check
    check (source_url = trim(source_url) and source_url ~ '^https?://'),
  constraint backlink_links_target_url_check
    check (target_url = trim(target_url) and target_url ~ '^https?://'),
  constraint backlink_links_anchor_text_check
    check (anchor_text is null or char_length(trim(anchor_text)) > 0),
  constraint backlink_links_rel_type_check
    check (rel_type is null or char_length(trim(rel_type)) > 0),
  constraint backlink_links_link_location_check
    check (link_location is null or char_length(trim(link_location)) > 0),
  constraint backlink_links_status_check
    check (status in ('observed', 'active', 'changed', 'lost', 'archived')),
  constraint backlink_links_active_verification_check
    check (
      status <> 'active'
      or (
        acquired_at is not null
        and first_verified_at is not null
        and char_length(trim(coalesce(verification_evidence, ''))) > 0
      )
    ),
  constraint backlink_links_lost_state_check
    check (
      (status = 'lost'
        and lost_at is not null
        and char_length(trim(coalesce(lost_reason, ''))) > 0)
      or (status <> 'lost'
        and (
          (lost_at is null and lost_reason is null)
          or (
            status = 'archived'
            and lost_at is not null
            and char_length(trim(coalesce(lost_reason, ''))) > 0
          )
        ))
    )
);

create index if not exists backlink_links_workspace_status_verified_idx
  on public.backlink_links (workspace_id, status, last_verified_at);

create index if not exists backlink_links_asset_status_idx
  on public.backlink_links (asset_id, status);

create index if not exists backlink_links_domain_status_idx
  on public.backlink_links (domain_id, status);

create index if not exists backlink_links_outreach_idx
  on public.backlink_links (outreach_id);

create or replace function public.validate_backlink_link_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.backlink_outreach as outreach
    where outreach.id = new.outreach_id
      and outreach.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_LINK_OUTREACH_WORKSPACE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.backlink_opportunities as opportunity
    where opportunity.id = new.opportunity_id
      and opportunity.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_LINK_OPPORTUNITY_WORKSPACE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.backlink_domains as domain
    where domain.id = new.domain_id
      and domain.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_LINK_DOMAIN_WORKSPACE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.backlink_assets as asset
    where asset.id = new.asset_id
      and asset.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_LINK_ASSET_WORKSPACE_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_backlink_links_workspace_integrity
  on public.backlink_links;
create trigger trg_backlink_links_workspace_integrity
before insert or update of workspace_id, outreach_id, opportunity_id, domain_id, asset_id on public.backlink_links
for each row
execute function public.validate_backlink_link_workspace();

drop trigger if exists trg_backlink_links_updated_at
  on public.backlink_links;
create trigger trg_backlink_links_updated_at
before update on public.backlink_links
for each row
execute function public.set_backlink_foundation_updated_at();

alter table public.backlink_links enable row level security;

create policy "backlink_links_select_workspace_members"
on public.backlink_links
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_links_insert_workspace_admins"
on public.backlink_links
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and created_by = auth.uid()
);

create policy "backlink_links_update_workspace_admins"
on public.backlink_links
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_links is
  'Workspace-scoped backlink evidence. Verification history, monitoring and activity records are intentionally deferred.';

commit;
