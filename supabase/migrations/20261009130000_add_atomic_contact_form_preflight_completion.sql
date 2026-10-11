begin;

create or replace function public.complete_verified_backlink_contact_form_preflight_atomic(
  p_workspace_id uuid, p_preflight_id uuid, p_worker_id text, p_contact_id uuid, p_form_url text,
  p_verified_at timestamptz, p_evidence_version text, p_form_fingerprint text, p_safe_evidence jsonb, p_completed_at timestamptz
) returns public.backlink_contact_form_verification_preflights
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_verification_preflights; c public.backlink_contacts; completed_time timestamptz;
begin
  if p_workspace_id is null or p_preflight_id is null or p_contact_id is null or nullif(trim(p_worker_id),'') is null or p_verified_at is null or p_completed_at is null then raise exception 'CONTACT_FORM_PREFLIGHT_INVALID_INPUT'; end if;
  select * into r from public.backlink_contact_form_verification_preflights where id=p_preflight_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_FOUND'; end if;
  if r.status='verified' and r.worker_id=trim(p_worker_id) then return r; end if;
  if r.status<>'running' or r.worker_id<>trim(p_worker_id) then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_RUNNING'; end if;
  if r.contact_id<>p_contact_id or r.form_url<>trim(coalesce(p_form_url,'')) then raise exception 'CONTACT_FORM_PREFLIGHT_FORM_MISMATCH'; end if;
  select * into c from public.backlink_contacts where id=p_contact_id and workspace_id=p_workspace_id for update;
  if not found or c.contact_form_url<>r.form_url then raise exception 'CONTACT_FORM_PREFLIGHT_FORM_MISMATCH'; end if;
  if trim(coalesce(p_evidence_version,''))<>'cfv1' then raise exception 'CONTACT_FORM_PREFLIGHT_EVIDENCE_VERSION_INVALID'; end if;
  if not public.backlink_contact_form_verification_evidence_valid(p_safe_evidence) then raise exception 'CONTACT_FORM_PREFLIGHT_EVIDENCE_INVALID'; end if;
  -- Retained only for RPC compatibility: p_completed_at is never timing-authoritative.
  completed_time := clock_timestamp();
  if p_verified_at < r.started_at or p_verified_at > completed_time or completed_time-p_verified_at > interval '5 minutes' then raise exception 'CONTACT_FORM_PREFLIGHT_EVIDENCE_STALE'; end if;
  insert into public.backlink_contact_form_verifications(workspace_id,contact_id,form_url,verification_state,verified_at,evidence_version,form_fingerprint,safe_evidence)
  values(p_workspace_id,p_contact_id,r.form_url,'verified',p_verified_at,trim(p_evidence_version),nullif(trim(coalesce(p_form_fingerprint,'')),''),p_safe_evidence)
  on conflict(workspace_id,contact_id,form_url) do update set verification_state='verified',verified_at=excluded.verified_at,evidence_version=excluded.evidence_version,form_fingerprint=excluded.form_fingerprint,safe_evidence=excluded.safe_evidence;
  update public.backlink_contact_form_verification_preflights set status='verified',safe_error_code=null,completed_at=completed_time,cooldown_until=null where id=r.id and workspace_id=p_workspace_id and status='running' and worker_id=trim(p_worker_id) returning * into r;
  if not found then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_RUNNING'; end if;
  return r;
end; $$;

revoke all on function public.complete_verified_backlink_contact_form_preflight_atomic(uuid,uuid,text,uuid,text,timestamptz,text,text,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.complete_verified_backlink_contact_form_preflight_atomic(uuid,uuid,text,uuid,text,timestamptz,text,text,jsonb,timestamptz) to service_role;
comment on function public.complete_verified_backlink_contact_form_preflight_atomic(uuid,uuid,text,uuid,text,timestamptz,text,text,jsonb,timestamptz) is 'Service-role-only atomic evidence upsert and verified preflight completion; locks claim ownership and rolls back both writes on failure.';

commit;
