-- G4-M5 Backlinks RLS test harness, step 4/5: automated verification.
--
-- Must be run with `psql -X -v ON_ERROR_STOP=1` (see run_all.sh), AFTER both
-- Fix migrations (20261104120000, 20261104130000) have been applied on top
-- of the fixtures from step 3.
--
-- Same design as scripts/rls-test-harness/04_verify_scenarios.sql: every
-- scenario runs inside its own explicit begin/commit so `set local role` /
-- `set local "request.jwt.claims"` genuinely apply to every statement in
-- that scenario and are guaranteed to revert at commit, before the next
-- scenario starts. Each scenario's boolean result is computed server-side
-- and stored via set_config(...) (a session-level GUC, not a psql variable),
-- then read back and asserted in a separate DO block with RAISE EXCEPTION
-- under ON_ERROR_STOP -- a plain \echo FAIL could never stop the script.

do $$
begin
  if current_database() <> 'norixo_g4_m5_rls_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_g4_m5_rls_test.', current_database();
  end if;
end
$$;

\set ON_ERROR_STOP on

\echo '--- Scenario 1 (Fix B): plain workspace A member -> SELECT backlink_outreach MUST see 0 rows ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000003"}';
select set_config(
  'rls_harness.scenario_1_pass',
  (
    public.is_workspace_member('00000000-0000-0000-0000-00000000000a')
    and not public.is_workspace_admin_or_owner('00000000-0000-0000-0000-00000000000a')
    and (select count(*) = 0 from public.backlink_outreach where workspace_id = '00000000-0000-0000-0000-00000000000a')
  )::text,
  false
);
commit;
do $$
declare v text := current_setting('rls_harness.scenario_1_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 1: plain member could still read backlink_outreach (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 1';
end
$$;

\echo '--- Scenario 2 (Fix B): workspace A admin -> SELECT backlink_outreach MUST see its own row ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000002"}';
select set_config(
  'rls_harness.scenario_2_pass',
  (
    (select count(*) from public.backlink_outreach where workspace_id = '00000000-0000-0000-0000-00000000000a') = 1
    and (select subject from public.backlink_outreach where id = '35000000-0000-0000-0000-00000000000a') = 'Fixture outreach subject A'
  )::text,
  false
);
commit;
do $$
declare v text := current_setting('rls_harness.scenario_2_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 2: workspace A admin could not read its own backlink_outreach row (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 2';
end
$$;

\echo '--- Scenario 3 (Fix B): workspace A owner -> SELECT backlink_outreach MUST see its own row ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000001"}';
select set_config(
  'rls_harness.scenario_3_pass',
  (
    (select count(*) from public.backlink_outreach where workspace_id = '00000000-0000-0000-0000-00000000000a') = 1
  )::text,
  false
);
commit;
do $$
declare v text := current_setting('rls_harness.scenario_3_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 3: workspace A owner could not read its own backlink_outreach row (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 3';
end
$$;

\echo '--- Scenario 4 (Fix A): workspace A admin -> SELECT backlink_outreach_initial_attempt_snapshots MUST see 0 rows (deny-all) ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000002"}';
select set_config(
  'rls_harness.scenario_4_pass',
  (
    (select count(*) = 0 from public.backlink_outreach_initial_attempt_snapshots where workspace_id = '00000000-0000-0000-0000-00000000000a')
  )::text,
  false
);
commit;
do $$
declare v text := current_setting('rls_harness.scenario_4_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 4: workspace A admin could read backlink_outreach_initial_attempt_snapshots (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 4';
end
$$;

\echo '--- Scenario 5 (non-disclosure): workspace A admin -> SELECT workspace B rows MUST see 0 rows, on both tables ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000002"}';
select set_config(
  'rls_harness.scenario_5_pass',
  (
    (select count(*) = 0 from public.backlink_outreach where workspace_id = '00000000-0000-0000-0000-00000000000b')
    and (select count(*) = 0 from public.backlink_outreach_initial_attempt_snapshots where workspace_id = '00000000-0000-0000-0000-00000000000b')
  )::text,
  false
);
commit;
do $$
declare v text := current_setting('rls_harness.scenario_5_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 5: workspace A admin could read workspace B rows on backlink_outreach and/or the snapshots table (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 5';
end
$$;

\echo '--- Scenario 6 (no regression): SECURITY DEFINER functions still callable via service_role after both Fix migrations ---'
-- Only the idempotent "existing" path of the reservation wrapper is
-- exercised here. approve_backlink_outreach_initial_send is NOT re-called:
-- its own business rule (OUTREACH_ALREADY_ATTEMPTED, independent of Fix A/B)
-- unconditionally rejects re-approval once any backlink_outreach_attempts
-- row exists for that outreach -- which the fixtures step already created.
-- That is pre-existing behavior, not something this RLS change could
-- regress, so re-testing it here would not add signal.
begin;
set local role service_role;
select set_config(
  'rls_harness.scenario_6_pass',
  (
    (
      select disposition
      from public.reserve_backlink_outreach_initial_attempt_for_approved_auto_send(
        '00000000-0000-0000-0000-00000000000a'::uuid,
        '34000000-0000-0000-0000-00000000000a'::uuid,
        '35000000-0000-0000-0000-00000000000a'::uuid,
        '36000000-0000-0000-0000-00000000000a'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid,
        'fixture-initial-attempt-a',
        repeat('0', 64),
        'v1',
        timezone('utc', now())
      )
    ) = 'existing'
  )::text,
  false
);
commit;
do $$
declare v text := current_setting('rls_harness.scenario_6_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 6: a SECURITY DEFINER function call regressed after the Fix migrations (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 6';
end
$$;

\echo '--- Scenario 7 (no regression): apply_backlink_outreach_backlink_obtained raises its own business error, never a permission error ---'
-- Fixture outreach A is in status 'ready' with no active backlink_links
-- row, so this call is expected to fail on business grounds
-- (BACKLINK_OUTREACH_BACKLINK_OBTAINED_OUTREACH_INVALID) -- that is fine and
-- expected. What this scenario actually checks is that it does NOT fail
-- with a permission/RLS error (SQLSTATE 42501), which is the only failure
-- mode Fix A/B could plausibly introduce for a SECURITY DEFINER function.
do $$
declare
  v_sqlstate text;
begin
  set local role service_role;
  begin
    perform * from public.apply_backlink_outreach_backlink_obtained(
      '00000000-0000-0000-0000-00000000000a'::uuid,
      '35000000-0000-0000-0000-00000000000a'::uuid,
      timezone('utc', now())
    );
    v_sqlstate := '00000';
  exception when others then
    v_sqlstate := sqlstate;
  end;

  if v_sqlstate = '42501' then
    raise exception 'FAIL scenario 7: apply_backlink_outreach_backlink_obtained failed with a permission error (SQLSTATE 42501) after the Fix migrations.';
  end if;
  raise notice 'PASS scenario 7 (resolved with SQLSTATE %, not a permission error)', v_sqlstate;
end
$$;

\echo '--- All 7 scenarios passed ---'
