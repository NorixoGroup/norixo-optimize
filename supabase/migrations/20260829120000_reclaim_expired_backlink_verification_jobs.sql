begin;

create or replace function public.reclaim_expired_backlink_verification_jobs(
  p_workspace_id uuid,
  p_reclaimed_at timestamptz,
  p_limit integer,
  p_job_id uuid default null
)
returns setof public.backlink_verification_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if
    p_workspace_id is null
    or p_reclaimed_at is null
    or p_limit is null
    or p_limit not between 1 and 100
  then
    raise exception 'BACKLINK_VERIFICATION_JOB_INVALID_RECLAIM';
  end if;

  return query
  with candidates as (
    select id
    from public.backlink_verification_jobs
    where workspace_id = p_workspace_id
      and status = 'running'
      and lease_expires_at <= p_reclaimed_at
      and (p_job_id is null or id = p_job_id)
    order by lease_expires_at asc, created_at asc
    for update skip locked
    limit p_limit
  )
  update public.backlink_verification_jobs as job
  set
    status = case when job.attempt_count < job.max_attempts then 'queued' else 'failed' end,
    started_at = case when job.attempt_count < job.max_attempts then null else job.started_at end,
    worker_id = case when job.attempt_count < job.max_attempts then null else job.worker_id end,
    claimed_at = case when job.attempt_count < job.max_attempts then null else job.claimed_at end,
    heartbeat_at = case when job.attempt_count < job.max_attempts then null else job.heartbeat_at end,
    lease_expires_at = case when job.attempt_count < job.max_attempts then null else job.lease_expires_at end,
    failed_at = case when job.attempt_count < job.max_attempts then null else p_reclaimed_at end,
    last_error_code = case when job.attempt_count < job.max_attempts then null else 'verification_job_lease_expired' end,
    last_error_message = case when job.attempt_count < job.max_attempts then null else 'Backlink verification job lease expired before completion.' end,
    attempt_count = job.attempt_count
  from candidates
  where job.id = candidates.id
    and job.workspace_id = p_workspace_id
    and job.status = 'running'
    and job.lease_expires_at <= p_reclaimed_at
  returning job.*;
end;
$$;

comment on function public.reclaim_expired_backlink_verification_jobs(
  uuid,
  timestamptz,
  integer,
  uuid
) is 'Atomically reclaims expired running backlink verification jobs for one workspace, preserving monotonic claim counts and failing exhausted leases on the same job row.';

revoke all on function public.reclaim_expired_backlink_verification_jobs(
  uuid,
  timestamptz,
  integer,
  uuid
) from public, anon, authenticated;

grant execute on function public.reclaim_expired_backlink_verification_jobs(
  uuid,
  timestamptz,
  integer,
  uuid
) to service_role;

commit;
