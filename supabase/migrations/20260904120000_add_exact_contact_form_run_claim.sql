begin;

create function public.claim_backlink_contact_form_run_by_id_v1(p_run_id uuid, p_worker_id text, p_lease_duration_seconds integer)
returns setof public.backlink_contact_form_runs
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_runs; now_value timestamptz := clock_timestamp(); worker text := trim(coalesce(p_worker_id,''));
begin
  if p_run_id is null or worker='' or p_lease_duration_seconds not between 30 and 3600 then raise exception 'CONTACT_FORM_RUN_CLAIM_INVALID_INPUT'; end if;
  select * into r from public.backlink_contact_form_runs where id=p_run_id and state='queued' for update;
  if not found then return; end if;
  update public.backlink_contact_form_runs set state='claimed',claimed_by=worker,claimed_at=now_value,lease_expires_at=now_value+make_interval(secs=>p_lease_duration_seconds),heartbeat_at=now_value,started_at=coalesce(started_at,now_value) where id=r.id returning * into r;
  insert into public.backlink_contact_form_run_events(workspace_id,run_id,outreach_id,state,event_type,safe_metadata,occurred_at) values(r.workspace_id,r.id,r.outreach_id,'claimed','run_claimed',jsonb_build_object('worker_id',worker),now_value);
  return next r;
end; $$;

revoke all on function public.claim_backlink_contact_form_run_by_id_v1(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.claim_backlink_contact_form_run_by_id_v1(uuid,text,integer) to service_role;

comment on function public.claim_backlink_contact_form_run_by_id_v1(uuid,text,integer) is 'Atomically claims one exact queued contact-form automation run. No generic queued-run fallback.';

commit;
