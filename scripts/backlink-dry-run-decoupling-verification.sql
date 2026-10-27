-- Verification SQL for the dry_run_only decoupling (migration 20261027120000).
-- Driven by scripts/backlink-dry-run-decoupling-postgres-harness.sh with -v phase=<name>:
--   before_fix | after_fix | concurrency_setup | concurrency_assert
-- Runs only inside the harness' throwaway database. Every assertion raises on failure.

create schema if not exists tt;

create or replace function tt.assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'ASSERTION FAILED: %', p_msg; end if;
end $$;

-- Creates an isolated workspace + control + running dry_run run + one queued task per kind.
create or replace function tt.setup(
  p_dry boolean, p_enabled boolean, p_reason text, p_kinds text[], p_run_status text default 'running'
) returns table (ws uuid, run uuid) language plpgsql as $$
declare v_ws uuid := gen_random_uuid(); v_run uuid := gen_random_uuid(); k text;
begin
  insert into public.workspaces (id) values (v_ws);
  insert into public.automation_workspace_controls (workspace_id, backlinks_enabled, dry_run_only, disabled_reason)
  values (v_ws, p_enabled, p_dry, p_reason);
  insert into public.automation_runs (id, workspace_id, system, run_kind, idempotency_key, status, mode, trigger_source,
                                       scheduled_at, started_at)
  values (v_run, v_ws, 'backlinks', 'tt', 'k-' || v_run, p_run_status, 'dry_run', 'internal', now(),
          case when p_run_status = 'queued' then null else now() end);
  foreach k in array p_kinds loop
    insert into public.automation_tasks (workspace_id, run_id, system, task_kind, task_key, scheduled_at, available_at)
    values (v_ws, v_run, 'backlinks', k, k, now(), now() - interval '1 minute');
  end loop;
  return query select v_ws, v_run;
end $$;

create or replace function tt.claim_next(p_ws uuid, p_run uuid) returns integer language sql as $$
  select count(*)::integer from public.claim_next_automation_task(p_ws, p_run, 'tt-worker', now(), 60) $$;

create or replace function tt.claim_id(p_ws uuid, p_run uuid, p_kind text) returns integer language sql as $$
  select count(*)::integer from public.claim_backlink_discovery_task_by_id(
    p_ws, p_run, (select id from public.automation_tasks where run_id = p_run and task_kind = p_kind), 'tt-worker', now(), 60) $$;

select :'phase' = 'before_fix' as is_before,
       :'phase' = 'after_fix' as is_after,
       :'phase' = 'concurrency_setup' as is_csetup,
       :'phase' = 'concurrency_assert' as is_cassert \gset

\if :is_before
do $$
declare r record;
begin
  -- Negative control: the bug is real before the fix.
  select * into r from tt.setup(false, true, null, array['backlinks.discovery.preview']);
  perform tt.assert(tt.claim_next(r.ws, r.run) = 0, 'pre-fix: generic claim must refuse discovery when dry_run_only = false');
  select * into r from tt.setup(false, true, null, array['backlinks.discovery.preview']);
  perform tt.assert(tt.claim_id(r.ws, r.run, 'backlinks.discovery.preview') = 0, 'pre-fix: claim by id must refuse when dry_run_only = false');
  -- Sanity: dry_run_only = true still works.
  select * into r from tt.setup(true, true, null, array['backlinks.discovery.preview']);
  perform tt.assert(tt.claim_next(r.ws, r.run) = 1, 'pre-fix: generic claim works when dry_run_only = true');
  select * into r from tt.setup(true, true, null, array['backlinks.discovery.preview']);
  perform tt.assert(tt.claim_id(r.ws, r.run, 'backlinks.discovery.preview') = 1, 'pre-fix: claim by id works when dry_run_only = true');
end $$;
\endif

\if :is_after
do $$
declare r record; k text; n integer;
begin
  -- A1/A2: every preview kind is claimable with dry_run_only = false.
  foreach k in array array['backlinks.discovery.preview','backlinks.qualification.preview',
                           'backlinks.promotion.preview','backlinks.campaign.preview'] loop
    select * into r from tt.setup(false, true, null, array[k]);
    perform tt.assert(tt.claim_next(r.ws, r.run) = 1, 'generic claim must accept ' || k || ' with dry_run_only = false');
  end loop;

  select * into r from tt.setup(false, true, null, array['backlinks.discovery.preview']);
  perform tt.assert(tt.claim_id(r.ws, r.run, 'backlinks.discovery.preview') = 1, 'claim by id accepts discovery with dry_run_only = false');

  -- A3: every non-preview kind keeps requiring dry_run_only = true (no accidental opening).
  foreach k in array array['backlinks.outreach.follow_up_due','backlinks.outreach.final_response_expired',
                           'backlinks.contact_resolution','backlinks.contact_validation','backlinks.campaign_prepare',
                           'backlinks.draft_prepare','backlinks.outreach_decision','backlinks.mailbox_verification',
                           'backlinks.contact_form_prepare','backlinks.unknown_future_kind'] loop
    select * into r from tt.setup(false, true, null, array[k]);
    perform tt.assert(tt.claim_next(r.ws, r.run) = 0, 'generic claim must NOT accept non-preview kind ' || k || ' with dry_run_only = false');
    select * into r from tt.setup(true, true, null, array[k]);
    perform tt.assert(tt.claim_next(r.ws, r.run) = 1, 'legacy behavior kept for ' || k || ' with dry_run_only = true');
  end loop;

  -- A4: backlinks disabled blocks both functions, for either dry_run_only value.
  select * into r from tt.setup(false, false, null, array['backlinks.discovery.preview']);
  perform tt.assert(tt.claim_next(r.ws, r.run) = 0, 'backlinks_enabled = false blocks generic claim (dry=false)');
  perform tt.assert(tt.claim_id(r.ws, r.run, 'backlinks.discovery.preview') = 0, 'backlinks_enabled = false blocks claim by id (dry=false)');
  select * into r from tt.setup(true, false, null, array['backlinks.discovery.preview']);
  perform tt.assert(tt.claim_next(r.ws, r.run) = 0, 'backlinks_enabled = false blocks generic claim (dry=true)');

  -- A5: kill switch (disabled_reason) blocks every task kind, for both dry_run_only values, in both functions.
  foreach k in array array['backlinks.discovery.preview','backlinks.qualification.preview',
                           'backlinks.promotion.preview','backlinks.campaign.preview',
                           'backlinks.outreach.follow_up_due','backlinks.contact_resolution',
                           'backlinks.unknown_future_kind'] loop
    select * into r from tt.setup(false, true, 'maintenance', array[k]);
    perform tt.assert(tt.claim_next(r.ws, r.run) = 0, 'disabled_reason blocks generic claim of ' || k || ' (dry=false)');
    select * into r from tt.setup(true, true, 'maintenance', array[k]);
    perform tt.assert(tt.claim_next(r.ws, r.run) = 0, 'disabled_reason blocks generic claim of ' || k || ' (dry=true)');
  end loop;
  select * into r from tt.setup(false, true, 'maintenance', array['backlinks.discovery.preview']);
  perform tt.assert(tt.claim_id(r.ws, r.run, 'backlinks.discovery.preview') = 0, 'disabled_reason blocks claim by id (dry=false)');
  select * into r from tt.setup(true, true, 'maintenance', array['backlinks.discovery.preview']);
  perform tt.assert(tt.claim_id(r.ws, r.run, 'backlinks.discovery.preview') = 0, 'disabled_reason blocks claim by id (dry=true)');
  -- Clearing the kill switch re-opens claims (it is a switch, not a tombstone).
  select * into r from tt.setup(false, true, 'maintenance', array['backlinks.discovery.preview']);
  update public.automation_workspace_controls set disabled_reason = null where workspace_id = r.ws;
  perform tt.assert(tt.claim_next(r.ws, r.run) = 1, 'clearing disabled_reason re-opens the preview claim');

  -- A6: unchanged legacy behavior when dry_run_only = true.
  select * into r from tt.setup(true, true, null, array['backlinks.discovery.preview']);
  perform tt.assert(tt.claim_id(r.ws, r.run, 'backlinks.discovery.preview') = 1, 'claim by id keeps working with dry_run_only = true');

  -- A7: claim by id keeps its other guards.
  select * into r from tt.setup(false, true, null, array['backlinks.qualification.preview']);
  perform tt.assert(tt.claim_id(r.ws, r.run, 'backlinks.qualification.preview') = 0, 'claim by id refuses non-discovery kinds');
  select * into r from tt.setup(false, true, null, array['backlinks.discovery.preview'], 'queued');
  perform tt.assert(tt.claim_id(r.ws, r.run, 'backlinks.discovery.preview') = 0, 'claim by id refuses a run that is not running');
  select * into r from tt.setup(false, true, null, array['backlinks.discovery.preview']);
  update public.automation_tasks set attempt_count = max_attempts where run_id = r.run;
  perform tt.assert(tt.claim_id(r.ws, r.run, 'backlinks.discovery.preview') = 0, 'claim by id respects max_attempts');
  perform tt.assert(tt.claim_next(r.ws, r.run) = 0, 'generic claim respects max_attempts');

  -- Dependencies: a dependent task is not claimable before its dependency completes.
  select * into r from tt.setup(false, true, null, array['backlinks.discovery.preview','backlinks.qualification.preview']);
  update public.automation_tasks set depends_on_task_id = (select id from public.automation_tasks
         where run_id = r.run and task_kind = 'backlinks.discovery.preview')
   where run_id = r.run and task_kind = 'backlinks.qualification.preview';
  update public.automation_tasks set priority = 1 where run_id = r.run and task_kind = 'backlinks.qualification.preview';
  perform tt.assert((select task_kind from public.claim_next_automation_task(r.ws, r.run, 'tt-worker', now(), 60)) = 'backlinks.discovery.preview',
                    'dependent preview task is not claimed before its dependency');

  -- A8: a task is claimed once, attempt_count incremented, lease set.
  select * into r from tt.setup(false, true, null, array['backlinks.promotion.preview']);
  perform tt.assert(tt.claim_next(r.ws, r.run) = 1 and tt.claim_next(r.ws, r.run) = 0, 'a running task is not claimed twice');
  perform tt.assert((select attempt_count = 1 and status = 'running' and lease_expires_at is not null
                       from public.automation_tasks where run_id = r.run), 'claim increments attempts and sets the lease');

  -- A9: only dry_run runs can exist (no live discovery run is possible).
  begin
    insert into public.automation_runs (workspace_id, system, run_kind, idempotency_key, status, mode, trigger_source, scheduled_at)
    values ((select ws from tt.setup(false, true, null, array[]::text[])), 'backlinks', 'tt', 'live-attempt', 'queued', 'live', 'internal', now());
    raise exception 'ASSERTION FAILED: a non-dry_run automation run was accepted';
  exception when check_violation then null; end;

  -- A10: invalid input still raises.
  begin
    perform * from public.claim_next_automation_task(null, null, 'w', now(), 60);
    raise exception 'ASSERTION FAILED: null arguments accepted';
  exception when others then
    perform tt.assert(sqlerrm = 'AUTOMATION_TASK_INVALID_CLAIM', 'invalid claim input must raise AUTOMATION_TASK_INVALID_CLAIM');
  end;

  -- A11: privileges.
  perform tt.assert(has_function_privilege('service_role', 'public.claim_next_automation_task(uuid,uuid,text,timestamptz,integer)', 'execute'), 'service_role keeps EXECUTE on claim_next');
  perform tt.assert(not has_function_privilege('anon', 'public.claim_next_automation_task(uuid,uuid,text,timestamptz,integer)', 'execute'), 'anon has no EXECUTE on claim_next');
  perform tt.assert(not has_function_privilege('authenticated', 'public.claim_next_automation_task(uuid,uuid,text,timestamptz,integer)', 'execute'), 'authenticated has no EXECUTE on claim_next');
  perform tt.assert(has_function_privilege('service_role', 'public.claim_backlink_discovery_task_by_id(uuid,uuid,uuid,text,timestamptz,integer)', 'execute'), 'service_role keeps EXECUTE on claim by id');
  perform tt.assert(not has_function_privilege('anon', 'public.claim_backlink_discovery_task_by_id(uuid,uuid,uuid,text,timestamptz,integer)', 'execute'), 'anon has no EXECUTE on claim by id');

  -- Only the two claim functions of the harness schema reference dry_run_only (send gates are not part of this fix).
  perform tt.assert((select count(*) = 0 from pg_proc where pronamespace = 'public'::regnamespace
                       and prosrc ilike '%dry_run_only%'
                       and proname not in ('claim_next_automation_task','claim_backlink_discovery_task_by_id')),
                    'no other public function references dry_run_only');
  -- The after-fix claim functions no longer require dry_run_only unconditionally.
  perform tt.assert((select prosrc not ilike '%and c.dry_run_only%' from pg_proc where proname = 'claim_backlink_discovery_task_by_id'),
                    'claim by id no longer requires dry_run_only');
end $$;
\endif

\if :is_csetup
drop table if exists public.zz_conc;
create table public.zz_conc as select ws as workspace_id, run as run_id
  from tt.setup(false, true, null, array['backlinks.discovery.preview','backlinks.qualification.preview',
                                           'backlinks.promotion.preview','backlinks.campaign.preview']) limit 1;
\endif

\if :is_cassert
do $$
declare w uuid; r uuid;
begin
  select workspace_id, run_id into w, r from public.zz_conc;
  -- 4 preview tasks seeded, 20 racing clients: every task is claimed exactly once.
  perform tt.assert((select count(*) from public.automation_tasks where run_id = r) = 4, 'seed has 4 queued tasks');
  perform tt.assert((select count(*) from public.automation_tasks where run_id = r and status = 'running') = 4, 'every task claimed');
  perform tt.assert((select count(*) from public.automation_tasks where run_id = r and attempt_count <> 1) = 0, 'no task claimed more than once');
  perform tt.assert((select count(distinct worker_id) from public.automation_tasks where run_id = r) = 4, 'each task has its own winning worker');
end $$;
\endif
