begin;

create table if not exists public.backlink_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_key text not null,
  display_name text not null,
  description text,
  asset_type text not null,
  canonical_url text,
  lifecycle_status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint backlink_assets_workspace_asset_key_unique
    unique (workspace_id, asset_key),
  constraint backlink_assets_asset_key_check
    check (asset_key = lower(trim(asset_key)) and asset_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint backlink_assets_display_name_check
    check (char_length(trim(display_name)) > 0),
  constraint backlink_assets_asset_type_check
    check (asset_type in ('calculator', 'methodology', 'research', 'market_snapshot', 'other')),
  constraint backlink_assets_canonical_url_check
    check (canonical_url is null or char_length(trim(canonical_url)) > 0),
  constraint backlink_assets_lifecycle_status_check
    check (lifecycle_status in ('draft', 'eligible', 'active', 'paused', 'archived')),
  constraint backlink_assets_archived_at_check
    check (
      (lifecycle_status = 'archived' and archived_at is not null)
      or (lifecycle_status <> 'archived' and archived_at is null)
    )
);

create table if not exists public.backlink_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain_key text not null,
  hostname text not null,
  display_name text,
  country_code text,
  region text,
  primary_language text,
  editorial_category text,
  editorial_compatibility text,
  estimated_difficulty text,
  lifecycle_status text not null default 'discovered',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint backlink_domains_workspace_domain_key_unique
    unique (workspace_id, domain_key),
  constraint backlink_domains_workspace_hostname_unique
    unique (workspace_id, hostname),
  constraint backlink_domains_domain_key_check
    check (domain_key = upper(trim(domain_key)) and domain_key ~ '^BK-[0-9]{4,}$'),
  constraint backlink_domains_hostname_check
    check (
      hostname = lower(trim(hostname))
      and hostname !~ '[/:@?#[:space:]]'
      and position('.' in hostname) > 1
    ),
  constraint backlink_domains_display_name_check
    check (display_name is null or char_length(trim(display_name)) > 0),
  constraint backlink_domains_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint backlink_domains_region_check
    check (
      region is null
      or region in ('North America', 'Europe', 'Africa', 'Middle East', 'Asia-Pacific', 'Latin America')
    ),
  constraint backlink_domains_primary_language_check
    check (
      primary_language is null
      or primary_language in (
        'English', 'Français', 'Español', 'Deutsch', 'Italiano', 'Português',
        'Nederlands', 'العربية', '日本語', '中文', '한국어', 'ไทย',
        'Tiếng Việt', 'Bahasa Indonesia'
      )
    ),
  constraint backlink_domains_editorial_category_check
    check (
      editorial_category is null
      or editorial_category in (
        'Government', 'Association', 'Media', 'Travel Tech', 'University',
        'Research', 'Analytics', 'Revenue Management', 'Software', 'Community',
        'Conference'
      )
    ),
  constraint backlink_domains_editorial_compatibility_check
    check (
      editorial_compatibility is null
      or editorial_compatibility in ('Low', 'Medium', 'Strong', 'Very Strong')
    ),
  constraint backlink_domains_estimated_difficulty_check
    check (estimated_difficulty is null or estimated_difficulty in ('Easy', 'Medium', 'High')),
  constraint backlink_domains_lifecycle_status_check
    check (lifecycle_status in ('discovered', 'qualified', 'active', 'paused', 'archived', 'rejected')),
  constraint backlink_domains_archived_at_check
    check (
      (lifecycle_status = 'archived' and archived_at is not null)
      or (lifecycle_status <> 'archived' and archived_at is null)
    )
);

create table if not exists public.backlink_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tag_key text not null,
  display_name text not null,
  description text,
  tag_group text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint backlink_tags_workspace_tag_key_unique
    unique (workspace_id, tag_key),
  constraint backlink_tags_workspace_display_name_unique
    unique (workspace_id, display_name),
  constraint backlink_tags_tag_key_check
    check (tag_key = lower(trim(tag_key)) and tag_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint backlink_tags_display_name_check
    check (char_length(trim(display_name)) > 0),
  constraint backlink_tags_tag_group_check
    check (tag_group is null or char_length(trim(tag_group)) > 0)
);

create index if not exists backlink_assets_workspace_lifecycle_idx
  on public.backlink_assets (workspace_id, lifecycle_status);

create index if not exists backlink_domains_workspace_lifecycle_idx
  on public.backlink_domains (workspace_id, lifecycle_status);

create index if not exists backlink_domains_workspace_category_idx
  on public.backlink_domains (workspace_id, editorial_category)
  where editorial_category is not null;

create index if not exists backlink_tags_workspace_active_idx
  on public.backlink_tags (workspace_id, is_active);

create or replace function public.set_backlink_foundation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_backlink_assets_updated_at on public.backlink_assets;
create trigger trg_backlink_assets_updated_at
before update on public.backlink_assets
for each row
execute function public.set_backlink_foundation_updated_at();

drop trigger if exists trg_backlink_domains_updated_at on public.backlink_domains;
create trigger trg_backlink_domains_updated_at
before update on public.backlink_domains
for each row
execute function public.set_backlink_foundation_updated_at();

drop trigger if exists trg_backlink_tags_updated_at on public.backlink_tags;
create trigger trg_backlink_tags_updated_at
before update on public.backlink_tags
for each row
execute function public.set_backlink_foundation_updated_at();

alter table public.backlink_assets enable row level security;
alter table public.backlink_domains enable row level security;
alter table public.backlink_tags enable row level security;

create policy "backlink_assets_select_workspace_members"
on public.backlink_assets
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_assets_insert_workspace_admins"
on public.backlink_assets
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and created_by = auth.uid()
);

create policy "backlink_assets_update_workspace_admins"
on public.backlink_assets
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

create policy "backlink_domains_select_workspace_members"
on public.backlink_domains
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_domains_insert_workspace_admins"
on public.backlink_domains
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and created_by = auth.uid()
);

create policy "backlink_domains_update_workspace_admins"
on public.backlink_domains
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

create policy "backlink_tags_select_workspace_members"
on public.backlink_tags
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_tags_insert_workspace_admins"
on public.backlink_tags
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and created_by = auth.uid()
);

create policy "backlink_tags_update_workspace_admins"
on public.backlink_tags
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_assets is
  'Workspace-scoped Norixo backlink assets. No operational assets are seeded by this foundation migration.';

comment on table public.backlink_domains is
  'Workspace-scoped publisher domains. Discovery pages, contacts and opportunities are intentionally deferred.';

comment on table public.backlink_tags is
  'Workspace-scoped operational tags. Tag relation tables and seed data are intentionally deferred.';

commit;
