begin;

create or replace function public.prevent_backlink_workspace_reassignment()
returns trigger
language plpgsql
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'BACKLINK_WORKSPACE_ID_IMMUTABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_backlink_assets_workspace_immutable on public.backlink_assets;
create trigger trg_backlink_assets_workspace_immutable
before update of workspace_id on public.backlink_assets
for each row
execute function public.prevent_backlink_workspace_reassignment();

drop trigger if exists trg_backlink_domains_workspace_immutable on public.backlink_domains;
create trigger trg_backlink_domains_workspace_immutable
before update of workspace_id on public.backlink_domains
for each row
execute function public.prevent_backlink_workspace_reassignment();

drop trigger if exists trg_backlink_tags_workspace_immutable on public.backlink_tags;
create trigger trg_backlink_tags_workspace_immutable
before update of workspace_id on public.backlink_tags
for each row
execute function public.prevent_backlink_workspace_reassignment();

drop trigger if exists trg_backlink_opportunities_workspace_immutable on public.backlink_opportunities;
create trigger trg_backlink_opportunities_workspace_immutable
before update of workspace_id on public.backlink_opportunities
for each row
execute function public.prevent_backlink_workspace_reassignment();

drop trigger if exists trg_backlink_domain_tags_workspace_immutable on public.backlink_domain_tags;
create trigger trg_backlink_domain_tags_workspace_immutable
before update of workspace_id on public.backlink_domain_tags
for each row
execute function public.prevent_backlink_workspace_reassignment();

drop trigger if exists trg_backlink_opportunity_tags_workspace_immutable on public.backlink_opportunity_tags;
create trigger trg_backlink_opportunity_tags_workspace_immutable
before update of workspace_id on public.backlink_opportunity_tags
for each row
execute function public.prevent_backlink_workspace_reassignment();

drop trigger if exists trg_backlink_contacts_workspace_immutable on public.backlink_contacts;
create trigger trg_backlink_contacts_workspace_immutable
before update of workspace_id on public.backlink_contacts
for each row
execute function public.prevent_backlink_workspace_reassignment();

drop trigger if exists trg_backlink_campaigns_workspace_immutable on public.backlink_campaigns;
create trigger trg_backlink_campaigns_workspace_immutable
before update of workspace_id on public.backlink_campaigns
for each row
execute function public.prevent_backlink_workspace_reassignment();

drop trigger if exists trg_backlink_outreach_workspace_immutable on public.backlink_outreach;
create trigger trg_backlink_outreach_workspace_immutable
before update of workspace_id on public.backlink_outreach
for each row
execute function public.prevent_backlink_workspace_reassignment();

drop trigger if exists trg_backlink_links_workspace_immutable on public.backlink_links;
create trigger trg_backlink_links_workspace_immutable
before update of workspace_id on public.backlink_links
for each row
execute function public.prevent_backlink_workspace_reassignment();

drop trigger if exists trg_backlink_notes_workspace_immutable on public.backlink_notes;
create trigger trg_backlink_notes_workspace_immutable
before update of workspace_id on public.backlink_notes
for each row
execute function public.prevent_backlink_workspace_reassignment();

drop trigger if exists trg_backlink_activity_workspace_immutable on public.backlink_activity;
create trigger trg_backlink_activity_workspace_immutable
before update of workspace_id on public.backlink_activity
for each row
execute function public.prevent_backlink_workspace_reassignment();

comment on function public.prevent_backlink_workspace_reassignment() is
  'Prevents tenant reassignment for all Backlink Acquisition Platform records.';

commit;
