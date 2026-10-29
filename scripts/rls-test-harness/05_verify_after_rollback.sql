-- RLS test harness, step 5/5: automated verification that the rollback
-- genuinely restores the original (pre-migration) behavior.
--
-- Must be run with `psql -X -v ON_ERROR_STOP=1` (see run_all.sh), AFTER
-- applying scripts/marketing-studio-rls-private-admin-rollback.sql on top of
-- steps 01-04. Reuses the fixtures from 03_fixtures.sql (not re-inserted).
--
-- Same isolation and result-transport design as 04_verify_scenarios.sql:
-- each check runs in its own explicit begin/commit (SET LOCAL ROLE and SET
-- LOCAL "request.jwt.claims" only ever apply within that one transaction,
-- never leaking into the next check), and the boolean result crosses into a
-- separate DO block via a session-level set_config()/current_setting() GUC,
-- never via psql's :'var' substitution inside a dollar-quoted body. Failed
-- assertions raise a real SQL exception -> non-zero psql exit code.

do $$
begin
  if current_database() <> 'norixo_ai_rls_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_ai_rls_test.', current_database();
  end if;
end
$$;

\set ON_ERROR_STOP on

\echo '--- Post-rollback A: client workspace admin (scenario 3 identity) must REGAIN access ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000003"}';
select set_config(
  'rls_harness.rollback_check_a_pass',
  (select count(*) > 0 from public.marketing_campaigns where workspace_id = '00000000-0000-0000-0000-00000000000a')::text,
  false
);
commit;
do $$
declare
  v text := current_setting('rls_harness.rollback_check_a_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL rollback_check_a: access was NOT restored for a client workspace admin -- rollback is not equivalent to the original policies (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS rollback_check_a';
end
$$;

\echo '--- Post-rollback B: plain workspace member (scenario 4 identity) must ALSO regain access ---'
-- Reinforces check A: the restored policy never filtered on role, so a
-- plain member (not just an admin-role member) must regain access too.
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000004"}';
select set_config(
  'rls_harness.rollback_check_b_pass',
  (select count(*) > 0 from public.marketing_campaigns where workspace_id = '00000000-0000-0000-0000-00000000000a')::text,
  false
);
commit;
do $$
declare
  v text := current_setting('rls_harness.rollback_check_b_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL rollback_check_b: a plain workspace member did not regain access after rollback (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS rollback_check_b';
end
$$;

\echo '--- Post-rollback C: private admin NOT a member of the workspace must STILL be refused ---'
-- The restored policy never looked at norixo_private_admins; it always
-- required real workspace membership, which this identity lacks.
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000002"}';
select set_config(
  'rls_harness.rollback_check_c_pass',
  (select count(*) = 0 from public.marketing_campaigns where workspace_id = '00000000-0000-0000-0000-00000000000a')::text,
  false
);
commit;
do $$
declare
  v text := current_setting('rls_harness.rollback_check_c_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL rollback_check_c: a private admin without workspace membership was NOT refused after rollback (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS rollback_check_c';
end
$$;

\echo '--- All 3 post-rollback checks passed, each in its own isolated transaction ---'
