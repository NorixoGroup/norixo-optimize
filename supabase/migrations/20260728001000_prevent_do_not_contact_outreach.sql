begin;

create or replace function public.validate_backlink_outreach_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  contact_status_value text;
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

  select contact.contact_status
  into contact_status_value
  from public.backlink_contacts as contact
  where contact.id = new.contact_id
    and contact.workspace_id = new.workspace_id;

  if not found then
    raise exception 'BACKLINK_OUTREACH_CONTACT_WORKSPACE_MISMATCH';
  end if;

  if contact_status_value = 'do_not_contact' then
    raise exception 'BACKLINK_OUTREACH_CONTACT_DO_NOT_CONTACT';
  end if;

  return new;
end;
$$;

comment on function public.validate_backlink_outreach_workspace() is
  'Validates outreach tenant integrity and prevents assigning do-not-contact contacts.';

commit;
