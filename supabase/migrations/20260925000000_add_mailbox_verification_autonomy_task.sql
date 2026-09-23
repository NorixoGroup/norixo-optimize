begin;

create or replace function public.claim_next_backlink_autonomy_task(
  p_workspace_id uuid,
  p_run_id uuid,
  p_worker_id text,
  p_claimed_at timestamptz,
  p_lease_duration_seconds integer
)
returns setof public.automation_tasks
language plpgsql
security definer
set search_path = public
as $$
declare task public.automation_tasks;
begin
  if p_workspace_id is null or p_run_id is null or p_claimed_at is null
    or char_length(trim(coalesce(p_worker_id, ''))) = 0
    or p_lease_duration_seconds not between 30 and 3600 then
    raise exception 'AUTOMATION_TASK_INVALID_CLAIM';
  end if;

  select t.* into task
  from public.automation_tasks t
  join public.automation_runs r on r.id = t.run_id
  join public.automation_workspace_controls c on c.workspace_id = t.workspace_id
  where t.workspace_id = p_workspace_id and t.run_id = p_run_id
    and t.status = 'queued' and t.available_at <= p_claimed_at
    and t.attempt_count < t.max_attempts and r.status in ('queued', 'running')
    and c.backlinks_enabled and c.backlink_autonomy_enabled and c.disabled_reason is null
    and t.task_kind in (
      'backlinks.contact_resolution', 'backlinks.contact_validation',
      'backlinks.mailbox_verification', 'backlinks.campaign_prepare',
      'backlinks.draft_prepare', 'backlinks.outreach_decision'
    )
    and (t.depends_on_task_id is null or exists (
      select 1 from public.automation_tasks dependency
      where dependency.id = t.depends_on_task_id
        and dependency.workspace_id = t.workspace_id
        and dependency.run_id = t.run_id
        and dependency.status = 'completed'
    ))
  order by t.priority, t.available_at, t.scheduled_at, t.created_at
  for update of t skip locked limit 1;
  if not found then return; end if;

  update public.automation_tasks
  set status = 'running', attempt_count = attempt_count + 1, worker_id = p_worker_id,
      claimed_at = p_claimed_at, started_at = p_claimed_at, heartbeat_at = p_claimed_at,
      lease_expires_at = p_claimed_at + make_interval(secs => p_lease_duration_seconds),
      error_code = null, error_message = null, failed_at = null
  where id = task.id returning * into task;
  return next task;
end;
$$;

revoke all on function public.claim_next_backlink_autonomy_task(uuid, uuid, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.claim_next_backlink_autonomy_task(uuid, uuid, text, timestamptz, integer)
  to service_role;

create or replace function public.reclaim_expired_backlink_autonomy_tasks(
  p_workspace_id uuid,
  p_run_id uuid,
  p_reclaimed_at timestamptz,
  p_limit integer
)
returns setof public.automation_tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'AUTOMATION_TASK_INVALID_RECLAIM_LIMIT';
  end if;

  return query
  with candidates as (
    select id
    from public.automation_tasks
    where workspace_id = p_workspace_id
      and run_id = p_run_id
      and status = 'running'
      and lease_expires_at <= p_reclaimed_at
      and task_kind in (
        'backlinks.contact_resolution',
        'backlinks.contact_validation',
        'backlinks.mailbox_verification',
        'backlinks.campaign_prepare',
        'backlinks.draft_prepare',
        'backlinks.outreach_decision'
      )
    order by lease_expires_at, created_at
    for update skip locked
    limit p_limit
  )
  update public.automation_tasks t
  set status = case when attempt_count < max_attempts then 'queued' else 'dead_letter' end,
      available_at = case when attempt_count < max_attempts then p_reclaimed_at else available_at end,
      worker_id = case when attempt_count < max_attempts then null else worker_id end,
      claimed_at = case when attempt_count < max_attempts then null else claimed_at end,
      started_at = case when attempt_count < max_attempts then null else started_at end,
      heartbeat_at = case when attempt_count < max_attempts then null else heartbeat_at end,
      lease_expires_at = null,
      failed_at = case when attempt_count < max_attempts then null else p_reclaimed_at end,
      error_code = 'AUTOMATION_TASK_LEASE_EXPIRED',
      error_message = 'Automation task lease expired'
  from candidates
  where t.id = candidates.id
  returning t.*;
end;
$$;

revoke all on function public.reclaim_expired_backlink_autonomy_tasks(uuid, uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.reclaim_expired_backlink_autonomy_tasks(uuid, uuid, timestamptz, integer)
  to service_role;

commit;
