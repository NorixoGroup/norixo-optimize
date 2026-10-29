-- RLS test harness, step 4/5: automated verification of the six scenarios.
--
-- Must be run with `psql -X -v ON_ERROR_STOP=1` (see run_all.sh).
--
-- Design, and why it changed from an earlier revision:
--
-- 1. Isolation: `SET LOCAL ROLE` / `SET LOCAL "request.jwt.claims"` only
--    last for the duration of the CURRENT transaction. Without an explicit
--    BEGIN, every statement in a psql script runs in its own one-statement
--    implicit transaction that commits immediately -- so a bare sequence of
--    `set local role ...; set local "request.jwt.claims" ...; select ...;`
--    would have the role/claims revert BEFORE the following statement runs,
--    meaning the SELECT would silently execute as the connecting superuser,
--    not the simulated identity. Every scenario below is therefore wrapped
--    in its own explicit `begin; ... commit;` block, so the role and claims
--    genuinely apply to every statement inside that same transaction, and
--    are guaranteed to revert at `commit`, before the next scenario starts
--    -- no identity or role can leak into the next block.
--
-- 2. Result transport: psql variable interpolation of the form :'varname'
--    is NOT used inside any dollar-quoted (`$$...$$`) body below. Whether
--    that substitution reliably occurs inside dollar-quoting is exactly the
--    kind of psql-version-dependent behavior this harness must not depend
--    on. Instead, each scenario's boolean result is computed entirely
--    server-side and stored via `set_config('rls_harness.<name>', value,
--    false)` -- a session-level (non-local) GUC, set from a PLAIN top-level
--    SELECT (no dollar-quoting at all, so no interpolation ambiguity is
--    even possible there) and committed with the rest of that scenario's
--    transaction. A separate DO block, run AFTER that commit, reads the
--    result back with current_setting(...) -- a pure server-side
--    mechanism, with no psql variable syntax anywhere in its body -- and
--    raises a real SQL exception if the assertion is false. Under
--    ON_ERROR_STOP, that exception stops the script with a non-zero exit
--    code; a plain \echo FAIL could never do that.

do $$
begin
  if current_database() <> 'norixo_ai_rls_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_ai_rls_test.', current_database();
  end if;
end
$$;

\set ON_ERROR_STOP on

\echo '--- Scenario 1: private admin, authorized on the rows workspace (A) -> MUST succeed ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000001"}';
select set_config(
  'rls_harness.scenario_1_pass',
  (
    public.is_norixo_private_admin()
    and public.is_workspace_member('00000000-0000-0000-0000-00000000000a')
    and (select count(*) > 0 from public.marketing_campaigns where workspace_id = '00000000-0000-0000-0000-00000000000a')
  )::text,
  false
);
commit;
do $$
declare
  v text := current_setting('rls_harness.scenario_1_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 1: private admin authorized on workspace A could not see its campaigns (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 1';
end
$$;

\echo '--- Scenario 2: private admin, NOT a member of the rows workspace -> MUST be refused ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000002"}';
select set_config(
  'rls_harness.scenario_2_pass',
  (
    public.is_norixo_private_admin()
    and not public.is_workspace_member('00000000-0000-0000-0000-00000000000a')
    and (select count(*) = 0 from public.marketing_campaigns where workspace_id = '00000000-0000-0000-0000-00000000000a')
  )::text,
  false
);
commit;
do $$
declare
  v text := current_setting('rls_harness.scenario_2_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 2: a private admin without workspace membership was NOT refused -- the AND is not real (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 2';
end
$$;

\echo '--- Scenario 3: client workspace owner/admin, NOT a Norixo private admin -> MUST be refused ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000003"}';
select set_config(
  'rls_harness.scenario_3_pass',
  (
    not public.is_norixo_private_admin()
    and public.is_workspace_admin_or_owner('00000000-0000-0000-0000-00000000000a')
    and (select count(*) = 0 from public.marketing_campaigns where workspace_id = '00000000-0000-0000-0000-00000000000a')
  )::text,
  false
);
commit;
do $$
declare
  v text := current_setting('rls_harness.scenario_3_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 3: a client workspace admin/owner role was accepted as a substitute for the private-admin check (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 3';
end
$$;

\echo '--- Scenario 4: plain workspace member, NOT a Norixo private admin -> MUST be refused ---'
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000004"}';
select set_config(
  'rls_harness.scenario_4_pass',
  (
    not public.is_norixo_private_admin()
    and (select count(*) = 0 from public.marketing_campaigns where workspace_id = '00000000-0000-0000-0000-00000000000a')
  )::text,
  false
);
commit;
do $$
declare
  v text := current_setting('rls_harness.scenario_4_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 4: a plain workspace member was not refused -- the pre-migration gap is not closed (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 4';
end
$$;

\echo '--- Scenario 5: anon -> MUST be refused ---'
begin;
set local role anon;
set local "request.jwt.claims" = '';
select set_config(
  'rls_harness.scenario_5_pass',
  (select count(*) = 0 from public.marketing_campaigns)::text,
  false
);
commit;
do $$
declare
  v text := current_setting('rls_harness.scenario_5_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 5: anon could see rows (no policy on marketing_campaigns targets anon -- check base GRANTs too) (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 5';
end
$$;

\echo '--- Scenario 6: service_role -> MUST see all rows without restriction ---'
-- Relies on the harness-local "harness_service_role_bypass" policies added
-- in step 2, not on BYPASSRLS (the shared service_role on this cluster does
-- not have that attribute -- see 01_bootstrap_auth_and_roles.sql).
begin;
set local role service_role;
set local "request.jwt.claims" = '';
select set_config(
  'rls_harness.scenario_6_pass',
  (select count(*) > 0 from public.marketing_campaigns)::text,
  false
);
commit;
do $$
declare
  v text := current_setting('rls_harness.scenario_6_pass', true);
begin
  if coalesce(nullif(v, '')::boolean, false) is not true then
    raise exception 'FAIL scenario 6: service_role could not see rows via the harness-local bypass policy (got %).', coalesce(v, 'NULL/unset');
  end if;
  raise notice 'PASS scenario 6';
end
$$;

\echo '--- All 6 scenarios passed, each in its own isolated transaction ---'
