begin;

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
