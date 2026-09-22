begin;

create table public.backlink_contact_mailbox_verifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.backlink_contacts(id) on delete cascade,
  verification_key text not null,
  email_fingerprint text not null,
  provider text not null,
  result text not null,
  checked_at timestamptz not null,
  provider_reference text,
  safe_metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_contact_mailbox_verifications_workspace_key_unique unique (workspace_id, verification_key),
  constraint backlink_contact_mailbox_verifications_key_check check (char_length(trim(verification_key)) between 1 and 256),
  constraint backlink_contact_mailbox_verifications_fingerprint_check check (email_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint backlink_contact_mailbox_verifications_provider_check check (char_length(trim(provider)) between 1 and 64),
  constraint backlink_contact_mailbox_verifications_result_check check (result in ('deliverable', 'undeliverable', 'risky', 'unknown', 'provider_error')),
  constraint backlink_contact_mailbox_verifications_reference_check check (provider_reference is null or char_length(trim(provider_reference)) between 1 and 256),
  constraint backlink_contact_mailbox_verifications_metadata_check check (
    safe_metadata is null
    or (
      jsonb_typeof(safe_metadata) = 'object'
      and octet_length(safe_metadata::text) <= 4096
      and safe_metadata - array['catch_all', 'disposable', 'role_based'] = '{}'::jsonb
      and (not safe_metadata ? 'catch_all' or jsonb_typeof(safe_metadata -> 'catch_all') = 'boolean')
      and (not safe_metadata ? 'disposable' or jsonb_typeof(safe_metadata -> 'disposable') = 'boolean')
      and (not safe_metadata ? 'role_based' or jsonb_typeof(safe_metadata -> 'role_based') = 'boolean')
    )
  )
);

create index backlink_contact_mailbox_verifications_workspace_contact_checked_idx
  on public.backlink_contact_mailbox_verifications (workspace_id, contact_id, checked_at desc);

create or replace function public.validate_backlink_contact_mailbox_verification_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.backlink_contacts as contact
    where contact.id = new.contact_id and contact.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_CONTACT_MAILBOX_VERIFICATION_WORKSPACE_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_contact_mailbox_verifications_workspace_integrity
before insert or update of workspace_id, contact_id on public.backlink_contact_mailbox_verifications
for each row execute function public.validate_backlink_contact_mailbox_verification_workspace();

alter table public.backlink_contact_mailbox_verifications enable row level security;

create policy "backlink_contact_mailbox_verifications_select_workspace_admins"
on public.backlink_contact_mailbox_verifications
for select to authenticated
using (public.is_workspace_admin_or_owner(workspace_id));

revoke all on public.backlink_contact_mailbox_verifications from public, anon, authenticated;
grant select on public.backlink_contact_mailbox_verifications to authenticated;

create or replace function public.record_backlink_contact_mailbox_verification_and_maybe_promote(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_verification_key text,
  p_email_fingerprint text,
  p_provider text,
  p_result text,
  p_checked_at timestamptz,
  p_provider_reference text default null,
  p_safe_metadata jsonb default null
)
returns table (verification_id uuid, disposition text, contact_status text, verified_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  contact public.backlink_contacts;
  existing public.backlink_contact_mailbox_verifications;
  inserted public.backlink_contact_mailbox_verifications;
  normalized_key text := trim(coalesce(p_verification_key, ''));
  normalized_fingerprint text := lower(trim(coalesce(p_email_fingerprint, '')));
  normalized_provider text := trim(coalesce(p_provider, ''));
  normalized_result text := trim(coalesce(p_result, ''));
  normalized_reference text := nullif(trim(coalesce(p_provider_reference, '')), '');
begin
  if p_workspace_id is null or p_contact_id is null or normalized_key = '' or char_length(normalized_key) > 256
    or normalized_fingerprint !~ '^[a-f0-9]{64}$' or normalized_provider = '' or char_length(normalized_provider) > 64
    or normalized_result not in ('deliverable', 'undeliverable', 'risky', 'unknown', 'provider_error') or p_checked_at is null
    or (normalized_reference is not null and char_length(normalized_reference) > 256)
    or (
      p_safe_metadata is not null and (
        jsonb_typeof(p_safe_metadata) <> 'object'
        or octet_length(p_safe_metadata::text) > 4096
        or p_safe_metadata - array['catch_all', 'disposable', 'role_based'] <> '{}'::jsonb
        or (p_safe_metadata ? 'catch_all' and jsonb_typeof(p_safe_metadata -> 'catch_all') <> 'boolean')
        or (p_safe_metadata ? 'disposable' and jsonb_typeof(p_safe_metadata -> 'disposable') <> 'boolean')
        or (p_safe_metadata ? 'role_based' and jsonb_typeof(p_safe_metadata -> 'role_based') <> 'boolean')
      )
    ) then
    raise exception 'BACKLINK_CONTACT_MAILBOX_VERIFICATION_INVALID_INPUT';
  end if;

  select * into contact from public.backlink_contacts
  where id = p_contact_id and workspace_id = p_workspace_id
  for update;
  if not found then raise exception 'BACKLINK_CONTACT_MAILBOX_VERIFICATION_CONTACT_NOT_FOUND'; end if;
  if encode(extensions.digest(lower(trim(coalesce(contact.email_normalized, ''))), 'sha256'), 'hex') <> normalized_fingerprint then
    raise exception 'BACKLINK_CONTACT_MAILBOX_VERIFICATION_STALE_EMAIL';
  end if;

  select * into existing from public.backlink_contact_mailbox_verifications
  where workspace_id = p_workspace_id and verification_key = normalized_key
  for update;
  if found then
    if existing.contact_id <> p_contact_id or existing.email_fingerprint <> normalized_fingerprint
      or existing.provider <> normalized_provider or existing.result <> normalized_result then
      raise exception 'BACKLINK_CONTACT_MAILBOX_VERIFICATION_KEY_CONFLICT';
    end if;
    return query select existing.id, 'existing'::text, contact.contact_status, contact.last_verified_at;
    return;
  end if;

  insert into public.backlink_contact_mailbox_verifications (
    workspace_id, contact_id, verification_key, email_fingerprint, provider, result, checked_at, provider_reference, safe_metadata
  ) values (
    p_workspace_id, p_contact_id, normalized_key, normalized_fingerprint, normalized_provider, normalized_result, p_checked_at, normalized_reference, p_safe_metadata
  ) on conflict (workspace_id, verification_key) do nothing
  returning * into inserted;

  if not found then
    select * into existing from public.backlink_contact_mailbox_verifications
    where workspace_id = p_workspace_id and verification_key = normalized_key
    for update;
    if existing.contact_id <> p_contact_id or existing.email_fingerprint <> normalized_fingerprint
      or existing.provider <> normalized_provider or existing.result <> normalized_result then
      raise exception 'BACKLINK_CONTACT_MAILBOX_VERIFICATION_KEY_CONFLICT';
    end if;
    return query select existing.id, 'existing'::text, contact.contact_status, contact.last_verified_at;
    return;
  end if;

  if contact.contact_status = 'unverified' and normalized_result = 'deliverable'
    and contact.do_not_contact_at is null and contact.archived_at is null then
    update public.backlink_contacts as bc
    set contact_status = 'verified', last_verified_at = p_checked_at
    where bc.id = contact.id
      and bc.workspace_id = p_workspace_id
      and bc.contact_status = 'unverified'
      and bc.do_not_contact_at is null
      and bc.archived_at is null
    returning bc.* into contact;
  end if;

  return query select inserted.id, 'created'::text, contact.contact_status, contact.last_verified_at;
end;
$$;

revoke all on function public.record_backlink_contact_mailbox_verification_and_maybe_promote(uuid, uuid, text, text, text, text, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_backlink_contact_mailbox_verification_and_maybe_promote(uuid, uuid, text, text, text, text, timestamptz, text, jsonb) to service_role;

comment on table public.backlink_contact_mailbox_verifications is 'Append-only provider-independent mailbox verification provenance. It never stores raw email addresses or provider payloads.';
comment on function public.record_backlink_contact_mailbox_verification_and_maybe_promote(uuid, uuid, text, text, text, text, timestamptz, text, jsonb) is 'Atomically records one scoped mailbox verification result and promotes only an unchanged unverified deliverable contact.';

commit;
