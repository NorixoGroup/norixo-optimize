begin;

create table if not exists public.backlink_domain_tags (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain_id uuid not null references public.backlink_domains(id) on delete restrict,
  tag_id uuid not null references public.backlink_tags(id) on delete restrict,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default timezone('utc', now()),
  constraint backlink_domain_tags_primary_key primary key (domain_id, tag_id)
);

create table if not exists public.backlink_opportunity_tags (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.backlink_opportunities(id) on delete restrict,
  tag_id uuid not null references public.backlink_tags(id) on delete restrict,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default timezone('utc', now()),
  constraint backlink_opportunity_tags_primary_key primary key (opportunity_id, tag_id)
);

create index if not exists backlink_domain_tags_workspace_tag_idx
  on public.backlink_domain_tags (workspace_id, tag_id);

create index if not exists backlink_opportunity_tags_workspace_tag_idx
  on public.backlink_opportunity_tags (workspace_id, tag_id);

create or replace function public.validate_backlink_tag_relation_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'backlink_domain_tags' then
    if not exists (
      select 1
      from public.backlink_domains as domain
      where domain.id = new.domain_id
        and domain.workspace_id = new.workspace_id
    ) then
      raise exception 'BACKLINK_DOMAIN_TAG_DOMAIN_WORKSPACE_MISMATCH';
    end if;
  elsif tg_table_name = 'backlink_opportunity_tags' then
    if not exists (
      select 1
      from public.backlink_opportunities as opportunity
      where opportunity.id = new.opportunity_id
        and opportunity.workspace_id = new.workspace_id
    ) then
      raise exception 'BACKLINK_OPPORTUNITY_TAG_OPPORTUNITY_WORKSPACE_MISMATCH';
    end if;
  else
    raise exception 'BACKLINK_TAG_RELATION_UNSUPPORTED_TABLE';
  end if;

  if not exists (
    select 1
    from public.backlink_tags as tag
    where tag.id = new.tag_id
      and tag.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_TAG_RELATION_TAG_WORKSPACE_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_backlink_domain_tags_workspace_integrity
  on public.backlink_domain_tags;
create trigger trg_backlink_domain_tags_workspace_integrity
before insert or update of workspace_id, domain_id, tag_id on public.backlink_domain_tags
for each row
execute function public.validate_backlink_tag_relation_workspace();

drop trigger if exists trg_backlink_opportunity_tags_workspace_integrity
  on public.backlink_opportunity_tags;
create trigger trg_backlink_opportunity_tags_workspace_integrity
before insert or update of workspace_id, opportunity_id, tag_id on public.backlink_opportunity_tags
for each row
execute function public.validate_backlink_tag_relation_workspace();

alter table public.backlink_domain_tags enable row level security;
alter table public.backlink_opportunity_tags enable row level security;

create policy "backlink_domain_tags_select_workspace_members"
on public.backlink_domain_tags
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_domain_tags_insert_workspace_admins"
on public.backlink_domain_tags
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and added_by = auth.uid()
);

create policy "backlink_domain_tags_update_workspace_admins"
on public.backlink_domain_tags
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

create policy "backlink_opportunity_tags_select_workspace_members"
on public.backlink_opportunity_tags
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_opportunity_tags_insert_workspace_admins"
on public.backlink_opportunity_tags
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and added_by = auth.uid()
);

create policy "backlink_opportunity_tags_update_workspace_admins"
on public.backlink_opportunity_tags
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_domain_tags is
  'Workspace-scoped domain-to-tag relations. Contacts, campaigns, outreach and link records remain deferred.';

comment on table public.backlink_opportunity_tags is
  'Workspace-scoped opportunity-to-tag relations. Contacts, campaigns, outreach and link records remain deferred.';

commit;
