begin;

alter table public.automation_tasks
  add column depends_on_task_id uuid null
    references public.automation_tasks(id) on delete restrict;

create or replace function public.validate_automation_task_dependency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.depends_on_task_id is null then
    return new;
  end if;

  if new.depends_on_task_id = new.id then
    raise exception 'AUTOMATION_TASK_SELF_DEPENDENCY';
  end if;

  if not exists (
    select 1
    from public.automation_tasks dependency
    where dependency.id = new.depends_on_task_id
      and dependency.workspace_id = new.workspace_id
      and dependency.run_id = new.run_id
  ) then
    raise exception 'AUTOMATION_TASK_DEPENDENCY_SCOPE_MISMATCH';
  end if;

  if exists (
    with recursive dependency_chain(id, depends_on_task_id, path) as (
      select dependency.id, dependency.depends_on_task_id, array[dependency.id]
      from public.automation_tasks dependency
      where dependency.id = new.depends_on_task_id
      union all
      select dependency.id, dependency.depends_on_task_id, chain.path || dependency.id
      from public.automation_tasks dependency
      join dependency_chain chain on dependency.id = chain.depends_on_task_id
      where not dependency.id = any(chain.path)
        and cardinality(chain.path) < 50
    )
    select 1
    from dependency_chain
    where id = new.id
  ) then
    raise exception 'AUTOMATION_TASK_DEPENDENCY_CYCLE';
  end if;

  return new;
end;
$$;

create trigger trg_automation_tasks_dependency_integrity
before insert or update of depends_on_task_id, workspace_id, run_id
on public.automation_tasks
for each row
execute function public.validate_automation_task_dependency();

create index automation_tasks_dependency_claim_idx
  on public.automation_tasks (
    workspace_id,
    run_id,
    depends_on_task_id,
    status,
    available_at,
    priority,
    scheduled_at,
    created_at
  );

create index automation_tasks_depends_on_task_id_idx
  on public.automation_tasks (depends_on_task_id)
  where depends_on_task_id is not null;

create or replace function public.claim_next_automation_task(
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
declare
  task public.automation_tasks;
begin
  if p_workspace_id is null
    or p_run_id is null
    or p_claimed_at is null
    or char_length(trim(coalesce(p_worker_id, ''))) = 0
    or p_lease_duration_seconds not between 30 and 3600 then
    raise exception 'AUTOMATION_TASK_INVALID_CLAIM';
  end if;

  select t.*
  into task
  from public.automation_tasks t
  join public.automation_runs r on r.id = t.run_id
  join public.automation_workspace_controls c on c.workspace_id = t.workspace_id
  where t.workspace_id = p_workspace_id
    and t.run_id = p_run_id
    and t.status = 'queued'
    and t.available_at <= p_claimed_at
    and t.attempt_count < t.max_attempts
    and r.status in ('queued', 'running')
    and c.backlinks_enabled
    and c.dry_run_only
    and (
      t.depends_on_task_id is null
      or exists (
        select 1
        from public.automation_tasks dependency
        where dependency.id = t.depends_on_task_id
          and dependency.workspace_id = t.workspace_id
          and dependency.run_id = t.run_id
          and dependency.status = 'completed'
      )
    )
  order by t.priority, t.available_at, t.scheduled_at, t.created_at
  for update of t skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.automation_tasks
  set status = 'running',
      attempt_count = attempt_count + 1,
      worker_id = p_worker_id,
      claimed_at = p_claimed_at,
      started_at = p_claimed_at,
      heartbeat_at = p_claimed_at,
      lease_expires_at = p_claimed_at + make_interval(secs => p_lease_duration_seconds),
      error_code = null,
      error_message = null,
      failed_at = null
  where id = task.id
  returning * into task;

  return next task;
end;
$$;

revoke all on function public.claim_next_automation_task(uuid, uuid, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.claim_next_automation_task(uuid, uuid, text, timestamptz, integer)
  to service_role;

commit;
