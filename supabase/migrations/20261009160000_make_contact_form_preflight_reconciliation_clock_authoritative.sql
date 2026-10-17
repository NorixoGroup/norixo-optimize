
revoke all on function public.reconcile_abandoned_backlink_contact_form_preflight(uuid,uuid,uuid,timestamptz) from public, anon, authenticated, service_role;
drop function public.reconcile_abandoned_backlink_contact_form_preflight(uuid,uuid,uuid,timestamptz);

create function public.reconcile_abandoned_backlink_contact_form_preflight(
  p_workspace_id uuid, p_preflight_id uuid, p_reconciled_by uuid
) returns public.backlink_contact_form_verification_preflights
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_verification_preflights; c public.backlink_contacts; reconciled_time timestamptz;
begin
  if p_workspace_id is null or p_preflight_id is null or p_reconciled_by is null then raise exception 'CONTACT_FORM_PREFLIGHT_INVALID_INPUT'; end if;
  select * into r from public.backlink_contact_form_verification_preflights where id=p_preflight_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_FOUND'; end if;
  if r.status <> 'running' then return r; end if;
  -- Capture wall-clock time only after the row lock has been obtained.
  reconciled_time := clock_timestamp();
  if r.started_at is null or r.started_at > reconciled_time - interval '10 minutes' then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_ABANDONED'; end if;
  select * into c from public.backlink_contacts where id=r.contact_id and workspace_id=p_workspace_id for update;
  if not found or c.contact_form_url <> r.form_url then raise exception 'CONTACT_FORM_PREFLIGHT_FORM_MISMATCH'; end if;
  update public.backlink_contact_form_verification_preflights set status='failed', safe_error_code='CONTACT_FORM_PREFLIGHT_ABANDONED', completed_at=reconciled_time, cooldown_until=reconciled_time + interval '15 minutes'
    where id=r.id and workspace_id=p_workspace_id and status='running' returning * into r;
  if not found then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_RUNNING'; end if;
  insert into public.backlink_contact_form_preflight_reconciliations(preflight_id,workspace_id,reconciled_by,previous_status,next_status,safe_reason_code,reconciled_at)
    values(r.id,p_workspace_id,p_reconciled_by,'running','failed','CONTACT_FORM_PREFLIGHT_ABANDONED',reconciled_time) on conflict(preflight_id) do nothing;
  return r;
end; $$;

revoke all on function public.reconcile_abandoned_backlink_contact_form_preflight(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.reconcile_abandoned_backlink_contact_form_preflight(uuid,uuid,uuid) to service_role;
comment on function public.reconcile_abandoned_backlink_contact_form_preflight(uuid,uuid,uuid) is 'Service-role-only, explicit administrative reconciliation of a running preflight older than ten minutes; PostgreSQL derives the authoritative reconciliation time after locking the row.';
