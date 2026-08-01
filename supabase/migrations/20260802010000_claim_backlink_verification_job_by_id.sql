begin;

create or replace function public.claim_backlink_verification_job_by_id(
  p_workspace_id uuid,
  p_job_id uuid,
  p_worker_id text,
  p_claimed_at timestamptz,
  p_lease_duration_seconds integer
)
returns setof public.backlink_verification_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.backlink_verification_jobs;
begin
  if
    p_workspace_id is null
    or p_job_id is null
    or char_length(trim(coalesce(p_worker_id, ''))) = 0
    or p_claimed_at is null
    or p_lease_duration_seconds is null
    or p_lease_duration_seconds not between 30 and 3600
  then
    raise exception 'BACKLINK_VERIFICATION_JOB_INVALID_CLAIM';
  end if;

  select *
  into claimed
  from public.backlink_verification_jobs
  where workspace_id = p_workspace_id
    and id = p_job_id
    and status = 'queued'
    and attempt_count < max_attempts
  for update skip locked;

  if not found then
    return;
  end if;

  update public.backlink_verification_jobs
  set
    status = 'running',
    started_at = coalesce(started_at, p_claimed_at),
    attempt_count = attempt_count + 1,
    worker_id = p_worker_id,
    claimed_at = p_claimed_at,
    heartbeat_at = p_claimed_at,
    lease_expires_at = p_claimed_at + make_interval(secs => p_lease_duration_seconds)
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end;
$$;

comment on function public.claim_backlink_verification_job_by_id(
  uuid,
  uuid,
  text,
  timestamptz,
  integer
) is 'Atomically claims one eligible job for a workspace without falling back to the general queue.';

revoke all on function public.claim_backlink_verification_job_by_id(
  uuid,
  uuid,
  text,
  timestamptz,
  integer
) from public, anon, authenticated;

grant execute on function public.claim_backlink_verification_job_by_id(
  uuid,
  uuid,
  text,
  timestamptz,
  integer
) to service_role;

commit;
