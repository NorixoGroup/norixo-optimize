begin;

alter table public.backlink_verification_jobs
  add column worker_id text,
  add column claimed_at timestamptz,
  add column lease_expires_at timestamptz,
  add column heartbeat_at timestamptz;

alter table public.backlink_verification_jobs
  drop constraint backlink_verification_jobs_state_check,
  add constraint backlink_verification_jobs_state_check
    check (
      (status = 'queued' and started_at is null and completed_at is null and failed_at is null and worker_id is null and claimed_at is null and lease_expires_at is null and heartbeat_at is null and last_error_code is null and last_error_message is null)
      or (status = 'running' and started_at is not null and completed_at is null and failed_at is null and worker_id is not null and claimed_at is not null and lease_expires_at is not null and heartbeat_at is not null)
      or (status = 'completed' and completed_at is not null and failed_at is null and worker_id is not null and claimed_at is not null and lease_expires_at is not null and heartbeat_at is not null and last_error_code is null and last_error_message is null)
      or (status = 'failed' and failed_at is not null and completed_at is null and worker_id is not null and claimed_at is not null and lease_expires_at is not null and heartbeat_at is not null and (last_error_code is not null or last_error_message is not null))
    );

create index backlink_verification_jobs_claim_idx on public.backlink_verification_jobs (status, queued_at, created_at);

create or replace function public.claim_next_backlink_verification_job(p_worker_id text, p_claimed_at timestamptz, p_lease_duration_seconds integer)
returns setof public.backlink_verification_jobs language plpgsql security definer set search_path = public as $$
declare claimed public.backlink_verification_jobs;
begin
  if char_length(trim(coalesce(p_worker_id, ''))) = 0 or p_lease_duration_seconds not between 30 and 3600 then raise exception 'BACKLINK_VERIFICATION_JOB_INVALID_CLAIM'; end if;
  select * into claimed from public.backlink_verification_jobs where status = 'queued' and attempt_count < max_attempts order by queued_at asc, created_at asc for update skip locked limit 1;
  if not found then return; end if;
  update public.backlink_verification_jobs set status='running', started_at=coalesce(started_at,p_claimed_at), worker_id=p_worker_id, claimed_at=p_claimed_at, heartbeat_at=p_claimed_at, lease_expires_at=p_claimed_at + make_interval(secs => p_lease_duration_seconds), attempt_count=attempt_count+1 where id=claimed.id returning * into claimed;
  return next claimed;
end; $$;

create or replace function public.heartbeat_backlink_verification_job(p_job_id uuid, p_worker_id text, p_heartbeat_at timestamptz, p_lease_duration_seconds integer)
returns setof public.backlink_verification_jobs language plpgsql security definer set search_path = public as $$
declare updated public.backlink_verification_jobs;
begin
  if char_length(trim(coalesce(p_worker_id, ''))) = 0 or p_lease_duration_seconds not between 30 and 3600 then raise exception 'BACKLINK_VERIFICATION_JOB_INVALID_HEARTBEAT'; end if;
  update public.backlink_verification_jobs set heartbeat_at=p_heartbeat_at, lease_expires_at=p_heartbeat_at + make_interval(secs => p_lease_duration_seconds) where id=p_job_id and status='running' and worker_id=p_worker_id and lease_expires_at > p_heartbeat_at returning * into updated;
  if found then return next updated; end if;
end; $$;

create or replace function public.complete_backlink_verification_job(p_job_id uuid, p_worker_id text, p_completed_at timestamptz, p_result_summary jsonb)
returns setof public.backlink_verification_jobs language plpgsql security definer set search_path = public as $$
declare updated public.backlink_verification_jobs;
begin
  update public.backlink_verification_jobs set status='completed', completed_at=p_completed_at, failed_at=null, last_error_code=null, last_error_message=null, result_summary=p_result_summary where id=p_job_id and status='running' and worker_id=p_worker_id and lease_expires_at > p_completed_at returning * into updated;
  if found then return next updated; end if;
end; $$;

create or replace function public.fail_backlink_verification_job(p_job_id uuid, p_worker_id text, p_failed_at timestamptz, p_error_code text, p_error_message text)
returns setof public.backlink_verification_jobs language plpgsql security definer set search_path = public as $$
declare updated public.backlink_verification_jobs;
begin
  update public.backlink_verification_jobs set status='failed', failed_at=p_failed_at, completed_at=null, last_error_code=nullif(trim(p_error_code),''), last_error_message=nullif(trim(p_error_message),'') where id=p_job_id and status='running' and worker_id=p_worker_id and lease_expires_at > p_failed_at returning * into updated;
  if found then return next updated; end if;
end; $$;

revoke all on function public.claim_next_backlink_verification_job(text,timestamptz,integer) from public, anon, authenticated;
revoke all on function public.heartbeat_backlink_verification_job(uuid,text,timestamptz,integer) from public, anon, authenticated;
revoke all on function public.complete_backlink_verification_job(uuid,text,timestamptz,jsonb) from public, anon, authenticated;
revoke all on function public.fail_backlink_verification_job(uuid,text,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.claim_next_backlink_verification_job(text,timestamptz,integer) to service_role;
grant execute on function public.heartbeat_backlink_verification_job(uuid,text,timestamptz,integer) to service_role;
grant execute on function public.complete_backlink_verification_job(uuid,text,timestamptz,jsonb) to service_role;
grant execute on function public.fail_backlink_verification_job(uuid,text,timestamptz,text,text) to service_role;
commit;
