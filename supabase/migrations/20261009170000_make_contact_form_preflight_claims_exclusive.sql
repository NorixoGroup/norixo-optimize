begin;

revoke all on function public.claim_backlink_contact_form_verification_preflight(uuid,uuid,text,timestamptz) from public, anon, authenticated, service_role;
drop function public.claim_backlink_contact_form_verification_preflight(uuid,uuid,text,timestamptz);

create function public.claim_backlink_contact_form_verification_preflight(
  p_workspace_id uuid, p_preflight_id uuid, p_worker_id text, p_started_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_verification_preflights; claimed_at timestamptz;
begin
  if p_workspace_id is null or p_preflight_id is null or nullif(trim(p_worker_id),'') is null or p_started_at is null then raise exception 'CONTACT_FORM_PREFLIGHT_INVALID_INPUT'; end if;
  select * into r from public.backlink_contact_form_verification_preflights where id=p_preflight_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_FOUND'; end if;
  -- Retained only for RPC compatibility: p_started_at is never security-authoritative.
  claimed_at := clock_timestamp();
  if r.status not in ('pending','failed','blocked') or r.attempt_count >= 2 or (r.cooldown_until is not null and r.cooldown_until > claimed_at) then
    return jsonb_build_object('claimed', false, 'preflight', to_jsonb(r));
  end if;
  update public.backlink_contact_form_verification_preflights set status='running', attempt_count=r.attempt_count+1,
    worker_id=trim(p_worker_id), started_at=claimed_at, completed_at=null, safe_error_code=null
    where id=r.id and status in ('pending','failed','blocked') returning * into r;
  if not found then raise exception 'CONTACT_FORM_PREFLIGHT_NOT_CLAIMED'; end if;
  return jsonb_build_object('claimed', true, 'preflight', to_jsonb(r));
end; $$;

revoke all on function public.claim_backlink_contact_form_verification_preflight(uuid,uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.claim_backlink_contact_form_verification_preflight(uuid,uuid,text,timestamptz) to service_role;
comment on function public.claim_backlink_contact_form_verification_preflight(uuid,uuid,text,timestamptz) is 'Service-role-only exclusive claim. claimed=true is returned only for the invocation that atomically transitions the preflight to its owned running state.';

commit;
