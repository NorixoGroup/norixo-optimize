begin;

create table if not exists public.backlink_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain_id uuid not null references public.backlink_domains(id) on delete restrict,
  contact_key text not null,
  full_name text,
  role_title text,
  email_normalized text,
  linkedin_url text,
  contact_form_url text,
  contact_status text not null default 'unverified',
  source_type text,
  source_reference text,
  consent_or_basis_note text,
  last_verified_at timestamptz,
  do_not_contact_at timestamptz,
  do_not_contact_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint backlink_contacts_workspace_contact_key_unique
    unique (workspace_id, contact_key),
  constraint backlink_contacts_contact_key_check
    check (contact_key = upper(trim(contact_key)) and contact_key ~ '^CT-[0-9]{6,}$'),
  constraint backlink_contacts_full_name_check
    check (full_name is null or char_length(trim(full_name)) > 0),
  constraint backlink_contacts_role_title_check
    check (role_title is null or char_length(trim(role_title)) > 0),
  constraint backlink_contacts_email_normalized_check
    check (
      email_normalized is null
      or (
        email_normalized = lower(trim(email_normalized))
        and email_normalized ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      )
    ),
  constraint backlink_contacts_linkedin_url_check
    check (linkedin_url is null or (linkedin_url = trim(linkedin_url) and linkedin_url ~ '^https?://')),
  constraint backlink_contacts_contact_form_url_check
    check (contact_form_url is null or (contact_form_url = trim(contact_form_url) and contact_form_url ~ '^https?://')),
  constraint backlink_contacts_contact_status_check
    check (contact_status in ('unverified', 'verified', 'do_not_contact', 'archived')),
  constraint backlink_contacts_source_evidence_check
    check (
      (
        email_normalized is null
        and linkedin_url is null
        and contact_form_url is null
      )
      or (
        char_length(trim(coalesce(source_type, ''))) > 0
        and char_length(trim(coalesce(source_reference, ''))) > 0
      )
    ),
  constraint backlink_contacts_do_not_contact_check
    check (
      (contact_status = 'do_not_contact'
        and do_not_contact_at is not null
        and char_length(trim(coalesce(do_not_contact_reason, ''))) > 0)
      or (contact_status <> 'do_not_contact'
        and (
          (do_not_contact_at is null and do_not_contact_reason is null)
          or (
            contact_status = 'archived'
            and do_not_contact_at is not null
            and char_length(trim(coalesce(do_not_contact_reason, ''))) > 0
          )
        ))
    ),
  constraint backlink_contacts_archived_at_check
    check (
      (contact_status = 'archived' and archived_at is not null)
      or (contact_status <> 'archived' and archived_at is null)
    )
);

create unique index if not exists backlink_contacts_domain_email_normalized_unique
  on public.backlink_contacts (domain_id, email_normalized)
  where email_normalized is not null;

create index if not exists backlink_contacts_workspace_domain_status_idx
  on public.backlink_contacts (workspace_id, domain_id, contact_status);

create or replace function public.validate_backlink_contact_workspace()
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
    raise exception 'BACKLINK_CONTACT_DOMAIN_WORKSPACE_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_backlink_contacts_workspace_integrity
  on public.backlink_contacts;
create trigger trg_backlink_contacts_workspace_integrity
before insert or update of workspace_id, domain_id on public.backlink_contacts
for each row
execute function public.validate_backlink_contact_workspace();

drop trigger if exists trg_backlink_contacts_updated_at
  on public.backlink_contacts;
create trigger trg_backlink_contacts_updated_at
before update on public.backlink_contacts
for each row
execute function public.set_backlink_foundation_updated_at();

alter table public.backlink_contacts enable row level security;

create policy "backlink_contacts_select_workspace_admins"
on public.backlink_contacts
for select
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id));

create policy "backlink_contacts_insert_workspace_admins"
on public.backlink_contacts
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and created_by = auth.uid()
);

create policy "backlink_contacts_update_workspace_admins"
on public.backlink_contacts
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_contacts is
  'Workspace-scoped editorial contact identities. Contact channels require evidence; outreach history is intentionally deferred.';

commit;
