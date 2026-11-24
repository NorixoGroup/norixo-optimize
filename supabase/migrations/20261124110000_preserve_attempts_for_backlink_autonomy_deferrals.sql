begin;

-- A policy/budget wait happens before any provider call. It must release its
-- lease and remain observable, but must not consume an execution attempt.
create or replace function public.fail_automation_task(
  p_workspace_id uuid,
  p_task_id uuid,
  p_worker_id text,
  p_failed_at timestamptz,
  p_error_code text,
  p_error_message text
)
returns setof public.automation_tasks
language plpgsql
security definer
set search_path = public
as $$
declare task public.automation_tasks;
declare is_deferred boolean := p_error_code in (
  'MAILBOX_VERIFICATION_PAID_AUTHORIZATION_REQUIRED',
  'MAILBOX_VERIFICATION_DEFERRED_BUDGET_EXHAUSTED',
  'MAILBOX_VERIFICATION_DEFERRED_ALREADY_RESERVED',
  'MAILBOX_VERIFICATION_DEFERRED_BUDGET_UNAVAILABLE',
  'BACKLINKS_DISABLED',
  'AUTOMATION_DISABLED_REASON',
  'BACKLINK_AUTONOMY_DISABLED',
  'LIVE_EXECUTION_NOT_AUTHORIZED'
);
begin
  update public.automation_tasks
  set status = case
        when is_deferred then 'queued'
        when attempt_count < max_attempts then 'queued'
        else 'dead_letter'
      end,
      -- A claim increments first. Deferred policy/budget waits undo only that
      -- unexecuted claim; provider/handler failures remain monotonic.
      attempt_count = case when is_deferred then greatest(attempt_count - 1, 0) else attempt_count end,
      available_at = case
        when is_deferred then p_failed_at + make_interval(secs => least(86400, backoff_base_seconds))
        when attempt_count < max_attempts then p_failed_at + make_interval(secs => least(86400, backoff_base_seconds * (2 ^ (attempt_count - 1))::integer))
        else available_at
      end,
      worker_id = case when is_deferred or attempt_count < max_attempts then null else worker_id end,
      claimed_at = case when is_deferred or attempt_count < max_attempts then null else claimed_at end,
      started_at = case when is_deferred or attempt_count < max_attempts then null else started_at end,
      heartbeat_at = case when is_deferred or attempt_count < max_attempts then null else heartbeat_at end,
      lease_expires_at = null,
      failed_at = case when is_deferred or attempt_count < max_attempts then null else p_failed_at end,
      error_code = nullif(trim(p_error_code), ''),
      error_message = nullif(trim(p_error_message), ''),
      output = case when is_deferred then coalesce(output, '{}'::jsonb) || jsonb_build_object(
        'version', 1,
        'reasonCodes', jsonb_build_array(p_error_code),
        'supervision', jsonb_build_object('disposition', 'blocked', 'deferredAt', p_failed_at)
      ) else output end
  where workspace_id = p_workspace_id
    and id = p_task_id
    and status = 'running'
    and worker_id = p_worker_id
    and lease_expires_at > p_failed_at
  returning * into task;
  if found then return next task; end if;
end;
$$;

revoke all on function public.fail_automation_task(uuid, uuid, text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.fail_automation_task(uuid, uuid, text, timestamptz, text, text)
  to service_role;

commit;
