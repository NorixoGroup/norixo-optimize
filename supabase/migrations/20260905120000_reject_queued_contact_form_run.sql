begin;

create function public.reject_backlink_contact_form_queued_run_v1(p_run_id uuid, p_reason_code text)
returns setof public.backlink_contact_form_runs
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_runs; now_value timestamptz := clock_timestamp(); reason text := upper(trim(coalesce(p_reason_code,'')));
begin
  if p_run_id is null or reason !~ '^[A-Z0-9_]{1,80}$' then raise exception 'CONTACT_FORM_RUN_REJECTION_INVALID_INPUT'; end if;
  select * into r from public.backlink_contact_form_runs where id=p_run_id and state='queued' for update;
  if not found then return; end if;
  update public.backlink_contact_form_runs set state='manual_review',finished_at=now_value,safe_error_code=reason where id=r.id returning * into r;
  insert into public.backlink_contact_form_run_events(workspace_id,run_id,outreach_id,state,event_type,safe_metadata,safe_error_code,occurred_at) values(r.workspace_id,r.id,r.outreach_id,'manual_review','pre_execution_manual_review',jsonb_build_object('reason_code',reason,'source','admin_pre_execution_rejection'),reason,now_value);
  return next r;
end; $$;

revoke all on function public.reject_backlink_contact_form_queued_run_v1(uuid,text) from public, anon, authenticated;
grant execute on function public.reject_backlink_contact_form_queued_run_v1(uuid,text) to service_role;

comment on function public.reject_backlink_contact_form_queued_run_v1(uuid,text) is 'Atomically moves one exact queued contact-form automation run to manual_review before execution. No claim, browser execution, or generic queued-run fallback.';

commit;
