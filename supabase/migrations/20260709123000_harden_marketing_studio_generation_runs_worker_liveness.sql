alter table public.marketing_studio_generation_runs
  add column if not exists worker_id text,
  add column if not exists heartbeat_at timestamptz;

alter table public.marketing_studio_generation_runs
  drop constraint if exists marketing_studio_generation_runs_status_check;

alter table public.marketing_studio_generation_runs
  add constraint marketing_studio_generation_runs_status_check
  check (status in ('queued', 'running', 'completed', 'failed', 'abandoned'));

drop function if exists public.claim_marketing_studio_generation_run();

create or replace function public.claim_marketing_studio_generation_run(
  p_worker_id text
)
returns public.marketing_studio_generation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_run public.marketing_studio_generation_runs;
begin
  if not pg_try_advisory_xact_lock(
    hashtextextended('marketing_studio_generation_runs_claim', 0)
  ) then
    return null;
  end if;

  update public.marketing_studio_generation_runs
  set
    status = 'abandoned',
    error_message = 'Worker heartbeat expired before terminal completion.',
    updated_at = now()
  where status = 'running'
    and coalesce(heartbeat_at, started_at, updated_at) < now() - interval '120 seconds';

  if exists (
    select 1
    from public.marketing_studio_generation_runs
    where status = 'running'
  ) then
    return null;
  end if;

  select *
  into claimed_run
  from public.marketing_studio_generation_runs
  where status = 'queued'
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.marketing_studio_generation_runs
  set
    status = 'running',
    worker_id = p_worker_id,
    heartbeat_at = now(),
    started_at = coalesce(started_at, now()),
    updated_at = now()
  where id = claimed_run.id
  returning *
  into claimed_run;

  return claimed_run;
end;
$$;

create or replace function public.heartbeat_marketing_studio_generation_run(
  p_run_id uuid,
  p_worker_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.marketing_studio_generation_runs
  set
    heartbeat_at = now(),
    updated_at = now()
  where id = p_run_id
    and status = 'running'
    and worker_id = p_worker_id;

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

revoke all on function public.claim_marketing_studio_generation_run(text)
  from public;

revoke all on function public.claim_marketing_studio_generation_run(text)
  from anon;

revoke all on function public.claim_marketing_studio_generation_run(text)
  from authenticated;

grant execute on function public.claim_marketing_studio_generation_run(text)
  to service_role;

revoke all on function public.heartbeat_marketing_studio_generation_run(uuid, text)
  from public;

revoke all on function public.heartbeat_marketing_studio_generation_run(uuid, text)
  from anon;

revoke all on function public.heartbeat_marketing_studio_generation_run(uuid, text)
  from authenticated;

grant execute on function public.heartbeat_marketing_studio_generation_run(uuid, text)
  to service_role;
