
create table public.backlink_contact_form_preflight_reconciliations (
  id uuid primary key default gen_random_uuid(), preflight_id uuid not null unique references public.backlink_contact_form_verification_preflights(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade, reconciled_by uuid not null references auth.users(id) on delete restrict,
  previous_status text not null, next_status text not null, safe_reason_code text not null, reconciled_at timestamptz not null default timezone('utc', now())
);
alter table public.backlink_contact_form_preflight_reconciliations enable row level security;
create policy "backlink_contact_form_preflight_reconciliations_select_workspace_admins" on public.backlink_contact_form_preflight_reconciliations for select to authenticated using (public.is_workspace_admin_or_owner(workspace_id));
revoke all on public.backlink_contact_form_preflight_reconciliations from public, anon, authenticated;
grant select on public.backlink_contact_form_preflight_reconciliations to authenticated;

create or replace function public.reconcile_abandoned_backlink_contact_form_preflight(
  p_workspace_id uuid, p_preflight_id uuid, p_reconciled_by uuid, p_reconciled_at timestamptz
) returns public.backlink_contact_form_verification_preflights
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_verification_preflights; c public.backlink_contacts;
begin
  if p_workspace_id is null or p_preflight_id is null or p_reconciled_by is null or p_reconciled_at is null then raise exception 'CONTACT_FORM_PREFLIGHT_INVALID_INPUT'; end if;
  select * into r from public.backlink_contact_form_verification_preflights where id=p_preflight_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_FOUND'; end if;
  if r.status <> 'running' then return r; end if;
  if r.started_at is null or r.started_at > p_reconciled_at - interval '10 minutes' then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_ABANDONED'; end if;
  select * into c from public.backlink_contacts where id=r.contact_id and workspace_id=p_workspace_id for update;
  if not found or c.contact_form_url <> r.form_url then raise exception 'CONTACT_FORM_PREFLIGHT_FORM_MISMATCH'; end if;
  update public.backlink_contact_form_verification_preflights set status='failed', safe_error_code='CONTACT_FORM_PREFLIGHT_ABANDONED', completed_at=p_reconciled_at, cooldown_until=p_reconciled_at + interval '15 minutes'
    where id=r.id and workspace_id=p_workspace_id and status='running' returning * into r;
  if not found then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_RUNNING'; end if;
  insert into public.backlink_contact_form_preflight_reconciliations(preflight_id,workspace_id,reconciled_by,previous_status,next_status,safe_reason_code,reconciled_at)
    values(r.id,p_workspace_id,p_reconciled_by,'running','failed','CONTACT_FORM_PREFLIGHT_ABANDONED',p_reconciled_at) on conflict(preflight_id) do nothing;
  return r;
end; $$;

revoke all on function public.reconcile_abandoned_backlink_contact_form_preflight(uuid,uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.reconcile_abandoned_backlink_contact_form_preflight(uuid,uuid,uuid,timestamptz) to service_role;
comment on function public.reconcile_abandoned_backlink_contact_form_preflight(uuid,uuid,uuid,timestamptz) is 'Service-role-only, explicit administrative reconciliation of a running preflight older than ten minutes; never creates evidence or retries network work.';
