begin;

create table public.backlink_contact_mailbox_verification_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.backlink_contacts(id) on delete cascade,
  email_fingerprint text not null,
  status text not null default 'running',
  attempt_count integer not null default 1,
  last_result text,
  last_reason text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint backlink_contact_mailbox_verification_requests_unique unique (workspace_id, contact_id, email_fingerprint),
  constraint backlink_contact_mailbox_verification_requests_fingerprint_check check (email_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint backlink_contact_mailbox_verification_requests_status_check check (status in ('running','succeeded','terminal','retryable')),
  constraint backlink_contact_mailbox_verification_requests_attempts_check check (attempt_count between 1 and 3),
  constraint backlink_contact_mailbox_verification_requests_result_check check (last_result is null or last_result in ('deliverable','undeliverable','risky','unknown','provider_error'))
);

create index backlink_contact_mailbox_verification_requests_workspace_contact_updated_idx
  on public.backlink_contact_mailbox_verification_requests (workspace_id, contact_id, updated_at desc);

create or replace function public.validate_backlink_contact_mailbox_verification_request_workspace()
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
    raise exception 'BACKLINK_CONTACT_MAILBOX_VERIFICATION_REQUEST_WORKSPACE_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_contact_mailbox_verification_requests_workspace_integrity
before insert or update of workspace_id, contact_id on public.backlink_contact_mailbox_verification_requests
for each row execute function public.validate_backlink_contact_mailbox_verification_request_workspace();

create or replace function public.set_backlink_contact_mailbox_verification_request_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = timezone('utc', now()); return new; end;
$$;

create trigger trg_backlink_contact_mailbox_verification_requests_updated_at
before update on public.backlink_contact_mailbox_verification_requests
for each row execute function public.set_backlink_contact_mailbox_verification_request_updated_at();

alter table public.backlink_contact_mailbox_verification_requests enable row level security;
create policy "backlink_contact_mailbox_verification_requests_select_workspace_admins"
on public.backlink_contact_mailbox_verification_requests for select to authenticated
using (public.is_workspace_admin_or_owner(workspace_id));

create or replace function public.claim_backlink_contact_mailbox_verification_request(
  p_workspace_id uuid, p_contact_id uuid, p_email_fingerprint text, p_started_at timestamptz
) returns table (request_id uuid, request_status text, request_attempt_count integer, request_last_result text, reservation_held boolean)
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_mailbox_verification_requests;
begin
  if p_workspace_id is null or p_contact_id is null or lower(trim(coalesce(p_email_fingerprint,''))) !~ '^[a-f0-9]{64}$' or p_started_at is null then
    raise exception 'BACKLINK_MAILBOX_VERIFICATION_REQUEST_INVALID_INPUT';
  end if;
  loop
    select * into r from public.backlink_contact_mailbox_verification_requests
    where workspace_id=p_workspace_id and contact_id=p_contact_id and email_fingerprint=lower(trim(p_email_fingerprint)) for update;
    if found then
      if r.status='retryable' and r.attempt_count < 3 then
        update public.backlink_contact_mailbox_verification_requests set status='running', attempt_count=r.attempt_count+1, started_at=p_started_at, completed_at=null, last_reason=null
        where id=r.id returning * into r;
        return query select r.id,r.status,r.attempt_count,r.last_result,true;
        return;
      end if;
      if r.status='retryable' and r.attempt_count >= 3 then
        update public.backlink_contact_mailbox_verification_requests set status='terminal', last_reason='MAILBOX_VERIFICATION_RETRY_EXHAUSTED', completed_at=p_started_at
        where id=r.id returning * into r;
      end if;
      return query select r.id,r.status,r.attempt_count,r.last_result,false;
      return;
    end if;
    insert into public.backlink_contact_mailbox_verification_requests(workspace_id,contact_id,email_fingerprint,status,attempt_count,started_at)
    values(p_workspace_id,p_contact_id,lower(trim(p_email_fingerprint)),'running',1,p_started_at)
    on conflict (workspace_id,contact_id,email_fingerprint) do nothing returning * into r;
    if found then
      return query select r.id,r.status,r.attempt_count,r.last_result,true;
      return;
    end if;
  end loop;
end; $$;

create or replace function public.complete_backlink_contact_mailbox_verification_request(
  p_workspace_id uuid, p_request_id uuid, p_status text, p_result text, p_reason text, p_completed_at timestamptz
) returns public.backlink_contact_mailbox_verification_requests
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_mailbox_verification_requests;
begin
  if p_status not in ('succeeded','terminal','retryable') or p_result is not null and p_result not in ('deliverable','undeliverable','risky','unknown','provider_error') then
    raise exception 'BACKLINK_MAILBOX_VERIFICATION_REQUEST_INVALID_COMPLETION';
  end if;
  update public.backlink_contact_mailbox_verification_requests set status=p_status,last_result=p_result,last_reason=nullif(trim(coalesce(p_reason,'')),''),completed_at=p_completed_at
  where id=p_request_id and workspace_id=p_workspace_id and status='running' returning * into r;
  if not found then raise exception 'BACKLINK_MAILBOX_VERIFICATION_REQUEST_NOT_RUNNING'; end if;
  return r;
end; $$;

revoke all on function public.claim_backlink_contact_mailbox_verification_request(uuid,uuid,text,timestamptz), public.complete_backlink_contact_mailbox_verification_request(uuid,uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.claim_backlink_contact_mailbox_verification_request(uuid,uuid,text,timestamptz), public.complete_backlink_contact_mailbox_verification_request(uuid,uuid,text,text,text,timestamptz) to service_role;
commit;
