-- G4-M5 Backlinks RLS test harness, step 5/5: verification after rollback.
--
-- Must be run with `psql -X -v ON_ERROR_STOP=1` (see run_all.sh), AFTER
-- scripts/backlinks-g4-m5-rls-rollback.sql has been applied. Confirms the
-- rollback genuinely restores the original pre-G4-M5 behavior: a plain
-- workspace A member can read backlink_outreach again, and
-- backlink_outreach_initial_attempt_snapshots has no RLS at all (any
-- authenticated/anon role can read every workspace's rows again -- the
-- exact original gap Fix A closed).

do $$
begin
  if current_database() <> 'norixo_g4_m5_rls_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_g4_m5_rls_test.', current_database();
  end if;
end
$$;

\set ON_ERROR_STOP on

\echo '--- Scenario R1: plain workspace A member can read backlink_outreach again ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000003"}';
select set_config(
  'rls_harness.scenario_r1_pass',
  (
    (select count(*) = 1 from public.backlink_outreach where workspace_id = '00000000-0000-0000-0000-00000000000a')
  )::text,
  false
);
commit;
do $$
declare v text := current_setting('rls_harness.scenario_r1_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario R1: rollback did not restore member SELECT on backlink_outreach (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario R1';
end
$$;

\echo '--- Scenario R2: backlink_outreach_initial_attempt_snapshots has RLS disabled again (original gap restored) ---'
do $$
declare v_relrowsecurity boolean;
begin
  select relrowsecurity into v_relrowsecurity
  from pg_class
  where oid = 'public.backlink_outreach_initial_attempt_snapshots'::regclass;

  if v_relrowsecurity is not false then
    raise exception 'FAIL scenario R2: backlink_outreach_initial_attempt_snapshots still has RLS enabled after rollback (relrowsecurity=%).', v_relrowsecurity;
  end if;
  raise notice 'PASS scenario R2';
end
$$;

\echo '--- Both post-rollback scenarios passed ---'
