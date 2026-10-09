begin;

create table public.backlink_contact_form_verification_preflights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.backlink_contacts(id) on delete cascade,
  form_url text not null check (form_url = trim(form_url) and form_url ~ '^https://[^[:space:]]+$' and position(chr(92) in form_url) = 0),
  idempotency_key text not null check (idempotency_key = trim(idempotency_key) and char_length(idempotency_key) between 1 and 255),
  status text not null default 'pending' check (status in ('pending','running','verified','manual_review','failed','blocked')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 2),
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  cooldown_until timestamptz,
  worker_id text,
  safe_error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, contact_id, form_url),
  unique (workspace_id, idempotency_key)
);

create index backlink_contact_form_verification_preflights_workspace_status_idx
  on public.backlink_contact_form_verification_preflights (workspace_id, status, requested_at, id);

create function public.validate_backlink_contact_form_preflight_binding() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.backlink_contacts c
    where c.id = new.contact_id and c.workspace_id = new.workspace_id
      and c.contact_form_url = new.form_url
  ) then raise exception 'CONTACT_FORM_PREFLIGHT_FORM_MISMATCH'; end if;
  return new;
end; $$;
create trigger trg_backlink_contact_form_preflight_binding
before insert or update of workspace_id, contact_id, form_url on public.backlink_contact_form_verification_preflights
for each row execute function public.validate_backlink_contact_form_preflight_binding();

create function public.set_backlink_contact_form_preflight_updated_at() returns trigger
language plpgsql set search_path = public as $$ begin new.updated_at = timezone('utc', now()); return new; end; $$;
create trigger trg_backlink_contact_form_preflight_updated_at
before update on public.backlink_contact_form_verification_preflights
for each row execute function public.set_backlink_contact_form_preflight_updated_at();

alter table public.backlink_contact_form_verification_preflights enable row level security;
create policy "backlink_contact_form_preflights_select_workspace_admins"
on public.backlink_contact_form_verification_preflights for select to authenticated
using (public.is_workspace_admin_or_owner(workspace_id));

create or replace function public.claim_backlink_contact_form_verification_preflight(
  p_workspace_id uuid, p_preflight_id uuid, p_worker_id text, p_started_at timestamptz
) returns public.backlink_contact_form_verification_preflights
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_verification_preflights;
begin
  if p_workspace_id is null or p_preflight_id is null or nullif(trim(p_worker_id),'') is null or p_started_at is null then
    raise exception 'CONTACT_FORM_PREFLIGHT_INVALID_INPUT';
  end if;
  select * into r from public.backlink_contact_form_verification_preflights
    where id=p_preflight_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_FOUND'; end if;
  if r.status not in ('pending','failed','blocked') or r.attempt_count >= 2 or (r.cooldown_until is not null and r.cooldown_until > p_started_at) then
    return r;
  end if;
  update public.backlink_contact_form_verification_preflights set status='running', attempt_count=r.attempt_count+1,
    worker_id=trim(p_worker_id), started_at=p_started_at, completed_at=null, safe_error_code=null
    where id=r.id returning * into r;
  return r;
end; $$;

create or replace function public.complete_backlink_contact_form_verification_preflight(
  p_workspace_id uuid, p_preflight_id uuid, p_worker_id text, p_status text, p_safe_error_code text, p_completed_at timestamptz
) returns public.backlink_contact_form_verification_preflights
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_verification_preflights;
begin
  if p_status not in ('verified','manual_review','failed','blocked') then raise exception 'CONTACT_FORM_PREFLIGHT_INVALID_COMPLETION'; end if;
  update public.backlink_contact_form_verification_preflights set status=p_status, safe_error_code=nullif(trim(coalesce(p_safe_error_code,'')),''),
    completed_at=p_completed_at, cooldown_until=case when p_status in ('failed','blocked') then p_completed_at + interval '15 minutes' else null end
    where id=p_preflight_id and workspace_id=p_workspace_id and status='running' and worker_id=trim(p_worker_id)
    returning * into r;
  if not found then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_RUNNING'; end if;
  return r;
end; $$;

revoke all on public.backlink_contact_form_verification_preflights from public, anon, authenticated;
grant select on public.backlink_contact_form_verification_preflights to authenticated;
revoke all on function public.claim_backlink_contact_form_verification_preflight(uuid,uuid,text,timestamptz), public.complete_backlink_contact_form_verification_preflight(uuid,uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.claim_backlink_contact_form_verification_preflight(uuid,uuid,text,timestamptz), public.complete_backlink_contact_form_verification_preflight(uuid,uuid,text,text,text,timestamptz) to service_role;
commit;
