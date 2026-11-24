-- BACKLINKS-AUTO-05 Phase 2: automation_runs/automation_tasks real-Postgres
-- verification, run by scripts/backlink-autonomy-runs-tasks-postgres-harness.sh
-- against a throwaway, local, non-Production database.
--
-- Every role-dependent scenario below is wrapped in its own explicit
-- `begin; ... commit;` block (SET LOCAL ROLE / SET LOCAL "request.jwt.claims"
-- only last for the current transaction) -- the same idiom already
-- established and documented in scripts/rls-test-harness/04_verify_scenarios.sql.
-- Each scenario's boolean result is computed server-side via set_config(...)
-- and asserted in a following `do $$ ... raise exception ... $$;` block, so
-- ON_ERROR_STOP genuinely aborts the script on any failure.

\set ON_ERROR_STOP on

\echo '--- Setup: workspace, two members (owner/member), workspace controls ---'
insert into public.workspaces (id, name) values
  ('00000000-0000-4000-8000-0000000000a1', 'AUTO-05 workspace');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2', 'owner'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a3', 'member');
insert into public.automation_workspace_controls (workspace_id, backlinks_enabled, dry_run_only) values
  ('00000000-0000-4000-8000-0000000000a1', true, true);

\echo '--- Creation + persistence: one run, two tasks, the second genuinely depending on the first ---'
insert into public.automation_runs (id, workspace_id, system, run_kind, idempotency_key, status, mode, trigger_source, scheduled_at, input)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'backlinks', 'backlinks.autonomy', 'auto05:run:1', 'queued', 'dry_run', 'internal', now(), '{}'::jsonb);
insert into public.automation_tasks (id, workspace_id, run_id, depends_on_task_id, system, task_kind, task_key, status, priority, scheduled_at, available_at, max_attempts, backoff_base_seconds, input)
values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', null, 'backlinks', 'backlinks.contact_resolution', 'auto05-task-1', 'queued', 40, now(), now(), 3, 60, '{}'::jsonb);
-- Deliberately a HIGHER priority (lower number) and an EARLIER available_at
-- than task 1, so that without a correctly enforced dependency gate this
-- task would be claimed FIRST by ordering alone -- making the dependency
-- check below a genuine test, not an artifact of insertion order.
insert into public.automation_tasks (id, workspace_id, run_id, depends_on_task_id, system, task_kind, task_key, status, priority, scheduled_at, available_at, max_attempts, backoff_base_seconds, input)
values ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', 'backlinks', 'backlinks.contact_validation', 'auto05-task-2', 'queued', 5, now() - interval '1 minute', now() - interval '1 minute', 3, 60, '{}'::jsonb);
do $$
begin
  if (select count(*) from public.automation_tasks where run_id = '00000000-0000-4000-8000-0000000000b1') <> 2 then
    raise exception 'FAIL creation: expected exactly 2 persisted tasks in the run.';
  end if;
  raise notice 'PASS creation + persistence';
end
$$;

\echo '--- Idempotence: duplicate (workspace_id, run_id, task_kind, task_key) is rejected by the real unique constraint ---'
begin;
do $$
begin
  insert into public.automation_tasks (id, workspace_id, run_id, depends_on_task_id, system, task_kind, task_key, status, priority, scheduled_at, available_at, max_attempts, backoff_base_seconds, input)
  values ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', null, 'backlinks', 'backlinks.contact_resolution', 'auto05-task-1', 'queued', 40, now(), now(), 3, 60, '{}'::jsonb);
  raise exception 'FAIL idempotence: duplicate task key was NOT rejected.';
exception
  when unique_violation then
    raise notice 'PASS idempotence: real unique constraint rejected the duplicate (%).', sqlerrm;
end
$$;
rollback;

\echo '--- Dependency integrity: a task depending on a task from a DIFFERENT run is rejected by the real trigger (the exact AUTO-03/LIVE-22 defect) ---'
insert into public.automation_runs (id, workspace_id, system, run_kind, idempotency_key, status, mode, trigger_source, scheduled_at, input)
values ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', 'backlinks', 'backlinks.autonomy', 'auto05:run:2', 'queued', 'dry_run', 'internal', now(), '{}'::jsonb);
begin;
do $$
begin
  insert into public.automation_tasks (id, workspace_id, run_id, depends_on_task_id, system, task_kind, task_key, status, priority, scheduled_at, available_at, max_attempts, backoff_base_seconds, input)
  values ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000c1', 'backlinks', 'backlinks.campaign_prepare', 'auto05-task-cross-run', 'queued', 40, now(), now(), 3, 60, '{}'::jsonb);
  raise exception 'FAIL dependency integrity: cross-run depends_on_task_id was NOT rejected.';
exception
  when others then
    if sqlerrm like '%AUTOMATION_TASK_DEPENDENCY_SCOPE_MISMATCH%' then
      raise notice 'PASS dependency integrity: real trigger rejected the cross-run dependency (%).', sqlerrm;
    else
      raise exception 'FAIL dependency integrity: rejected for the WRONG reason (%).', sqlerrm;
    end if;
end
$$;
rollback;

\echo '--- Reclamation + chaining: claim must pick the non-dependent task first despite it ranking lower by priority/available_at, then unlock the dependent task only after completion ---'
do $$
declare
  claimed_first_id uuid;
  claimed_second_id uuid;
begin
  select id into claimed_first_id from public.claim_next_automation_task('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', 'auto05-worker-1', now(), 60);
  if claimed_first_id is distinct from '00000000-0000-4000-8000-0000000000c1' then
    raise exception 'FAIL claim-first: expected task c1 to be claimed despite c2 ranking higher by priority/available_at (dependency gate not enforced); got %.', claimed_first_id;
  end if;

  perform * from public.complete_automation_task('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'auto05-worker-1', now(), '{"candidateCount":1}'::jsonb);
  if (select status from public.automation_tasks where id = '00000000-0000-4000-8000-0000000000c1') <> 'completed' then
    raise exception 'FAIL complete: the first task did not persist as completed.';
  end if;
  if (select output->>'candidateCount' from public.automation_tasks where id = '00000000-0000-4000-8000-0000000000c1') <> '1' then
    raise exception 'FAIL complete: the real persisted output did not round-trip.';
  end if;

  select id into claimed_second_id from public.claim_next_automation_task('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', 'auto05-worker-2', now(), 60);
  if claimed_second_id is distinct from '00000000-0000-4000-8000-0000000000c2' then
    raise exception 'FAIL claim-chain: the dependent task did not become claimable once its dependency completed; got %.', claimed_second_id;
  end if;

  raise notice 'PASS reclamation + chaining: created -> claimed -> completed -> dependent task unlocked';
end
$$;

\echo '--- RLS: a plain workspace member cannot insert a run; the workspace owner can (real shipped policy, real request.jwt.claims mechanism) ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "00000000-0000-4000-8000-0000000000a3"}';
do $$
begin
  insert into public.automation_runs (id, workspace_id, system, run_kind, idempotency_key, status, mode, trigger_source, scheduled_at, input, requested_by)
  values ('00000000-0000-4000-8000-0000000000b9', '00000000-0000-4000-8000-0000000000a1', 'backlinks', 'backlinks.autonomy', 'auto05:run:member-attempt', 'queued', 'dry_run', 'manual', now(), '{}'::jsonb, '00000000-0000-4000-8000-0000000000a3');
  raise exception 'FAIL RLS: a plain workspace member was able to insert an automation_runs row.';
exception
  when insufficient_privilege then
    raise notice 'PASS RLS: plain member rejected by the real policy (%).', sqlerrm;
end
$$;
rollback;

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "00000000-0000-4000-8000-0000000000a2"}';
insert into public.automation_runs (id, workspace_id, system, run_kind, idempotency_key, status, mode, trigger_source, scheduled_at, input, requested_by)
values ('00000000-0000-4000-8000-0000000000b9', '00000000-0000-4000-8000-0000000000a1', 'backlinks', 'backlinks.autonomy', 'auto05:run:owner-attempt', 'queued', 'dry_run', 'manual', now(), '{}'::jsonb, '00000000-0000-4000-8000-0000000000a2');
do $$
begin
  if (select count(*) from public.automation_runs where id = '00000000-0000-4000-8000-0000000000b9') <> 1 then
    raise exception 'FAIL RLS: the workspace owner could not insert an automation_runs row under the real policy.';
  end if;
  raise notice 'PASS RLS: workspace owner/admin accepted by the real policy';
end
$$;
commit;

\echo 'ALL AUTO-05 POSTGRES CHECKS PASSED'
