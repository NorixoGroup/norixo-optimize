
alter table public.automation_tasks drop constraint automation_tasks_state;

alter table public.automation_tasks add constraint automation_tasks_state check(
  (status='queued' and claimed_at is null and started_at is null and completed_at is null and failed_at is null and cancelled_at is null and worker_id is null and lease_expires_at is null)
  or (status='running' and claimed_at is not null and started_at is not null and heartbeat_at is not null and lease_expires_at is not null and worker_id is not null and completed_at is null and failed_at is null and cancelled_at is null)
  or (status='completed' and started_at is not null and completed_at is not null and failed_at is null and cancelled_at is null and error_code is null and error_message is null)
  or (status='failed' and failed_at is not null and completed_at is null and cancelled_at is null and error_code is not null and error_message is not null)
  or (status='dead_letter' and failed_at is not null and completed_at is null and cancelled_at is null and error_code is not null and error_message is not null)
  or (status='cancelled' and cancelled_at is not null and completed_at is null and failed_at is null)
);

create function public.dead_letter_automation_task(
  p_workspace_id uuid,
  p_task_id uuid,
  p_worker_id text,
  p_failed_at timestamptz,
  p_error_code text,
  p_error_message text
) returns setof public.automation_tasks
language plpgsql
security definer
set search_path=public
as $$
declare task public.automation_tasks;
begin
  update public.automation_tasks
  set status='dead_letter',
      available_at=p_failed_at,
      lease_expires_at=null,
      failed_at=p_failed_at,
      error_code=nullif(trim(p_error_code),''),
      error_message=nullif(trim(p_error_message),'')
  where workspace_id=p_workspace_id
    and id=p_task_id
    and status='running'
    and worker_id=p_worker_id
    and lease_expires_at>p_failed_at
  returning * into task;
  if found then return next task; end if;
end;
$$;

revoke all on function public.dead_letter_automation_task(uuid,uuid,text,timestamptz,text,text) from public,anon,authenticated,service_role;
grant execute on function public.dead_letter_automation_task(uuid,uuid,text,timestamptz,text,text) to service_role;
