-- Decouple preview-task claims from automation_workspace_controls.dry_run_only.
--
-- dry_run_only now only means "no external send": the initial-send gate
-- (20261001150000), the follow-up send gates (FOLLOW_UP_SEND_DRY_RUN) and the live send
-- services still require dry_run_only = false, and are NOT modified here.
--
-- Before this migration the preview engine also required dry_run_only = true, so a workspace
-- could not discover prospects and send approved emails at the same time.
--
-- Safety properties preserved:
--   * every automation run stays mode = 'dry_run' (automation_runs_mode_check);
--   * claim_backlink_discovery_task_by_id still requires a running dry_run run,
--     backlinks_enabled and no disabled_reason;
--   * claim_next_automation_task now also requires disabled_reason IS NULL for every task kind and
--     both values of dry_run_only (the operator kill switch was previously ignored by this
--     function; claim_backlink_discovery_task_by_id and the autonomy claim already honored it);
--   * claim_next_automation_task skips dry_run_only ONLY for the four *.preview task kinds of a
--     dry_run run. Any other task kind keeps requiring dry_run_only = true (defense in depth);
--   * Brave Search stays bounded by reserve_backlink_brave_request (100 / rolling 30 days), which
--     is not touched.
--
-- CREATE OR REPLACE keeps the function owner and EXECUTE privileges (same technique as
-- 20261020120000), so no GRANT / REVOKE is restated. Rollback: see
-- scripts/backlink-dry-run-decoupling-rollback.sql.

begin;

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
    and c.disabled_reason is null
    and (
      c.dry_run_only
      or (
        r.mode = 'dry_run'
        and t.task_kind in (
          'backlinks.discovery.preview',
          'backlinks.qualification.preview',
          'backlinks.promotion.preview',
          'backlinks.campaign.preview'
        )
      )
    )
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

create or replace function public.claim_backlink_discovery_task_by_id(
  p_workspace_id uuid,
  p_run_id uuid,
  p_task_id uuid,
  p_worker_id text,
  p_claimed_at timestamptz,
  p_lease_duration_seconds integer
) returns setof public.automation_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  task public.automation_tasks;
begin
  if p_workspace_id is null
    or p_run_id is null
    or p_task_id is null
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
    and t.id = p_task_id
    and t.task_kind = 'backlinks.discovery.preview'
    and t.status = 'queued'
    and t.available_at <= p_claimed_at
    and t.attempt_count < t.max_attempts
    and r.status = 'running'
    and r.mode = 'dry_run'
    and c.backlinks_enabled
    and c.disabled_reason is null
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
  for update of t skip locked;

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

comment on column public.automation_workspace_controls.dry_run_only is
  'When true, external sends (initial email, follow-up, live auto-send) are refused. Discovery, qualification, promotion, campaign preview and follow-up scheduling do not depend on it.';

commit;
