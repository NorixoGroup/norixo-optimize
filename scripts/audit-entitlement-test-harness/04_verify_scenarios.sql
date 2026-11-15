-- Audit entitlement test harness, step 4/6: real assertions against the
-- real functions (applied verbatim from supabase/migrations/ by
-- run_all.sh), not a reimplementation. Each scenario RAISEs EXCEPTION on
-- mismatch; combined with `psql -v ON_ERROR_STOP=1`, the first failure
-- stops the whole run with a non-zero exit code.
--
-- LIMITATION (stated here, not hidden): this script runs sequentially in
-- one psql session. It proves the conflict-detection constraints (unique
-- operation_key, partial unique index on active targets) are correctly
-- defined and triggered, but it does NOT prove true concurrent-transaction
-- locking behavior under real parallel load -- that would require two
-- simultaneous sessions racing on the same `for update` lock, which this
-- single-session harness does not exercise.

\set ON_ERROR_STOP on

do $$
begin
  if current_database() <> 'norixo_ph8_entitlement_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_ph8_entitlement_test.', current_database();
  end if;
end
$$;

-- Scenario 1: first free audit, eligible workspace -> reserved/free_plan, quantity forced to 1
-- (p_quantity=5 passed deliberately to prove the clamp).
do $$
declare r record;
begin
  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
    'ph8-op-1', 'listing_id', '20000000-0000-0000-0000-000000000001', 5, true, false
  );
  if r.status <> 'reserved' or r.source <> 'free_plan' then
    raise exception 'FAIL scenario 1: status=%, source=%, reason=%', r.status, r.source, r.reason_code;
  end if;
  if (select quantity from public.audit_entitlement_reservations where operation_key = 'ph8-op-1') <> 1 then
    raise exception 'FAIL scenario 1: quantity was not clamped to 1';
  end if;
  raise notice 'PASS scenario 1 (first free audit, quantity clamp)';
end
$$;

-- Scenario 2: workspace already has one historical audit -> second free audit denied
do $$
declare r record;
begin
  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
    'ph8-op-2', 'listing_id', '20000000-0000-0000-0000-000000000002', 1, true, false
  );
  if r.status <> 'insufficient_entitlement' or r.reason_code <> 'free_plan_limit_reached' then
    raise exception 'FAIL scenario 2: status=%, reason=%', r.status, r.reason_code;
  end if;
  raise notice 'PASS scenario 2 (second free audit denied)';
end
$$;

-- Scenario 3: paid workspace with one usable credit lot -> reserved/credit, lot decremented
do $$
declare r record; v_consumed integer;
begin
  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003',
    'ph8-op-3', 'listing_id', '20000000-0000-0000-0000-000000000003', 1, false, false
  );
  if r.status <> 'reserved' or r.source <> 'credit' then
    raise exception 'FAIL scenario 3: status=%, source=%, reason=%', r.status, r.source, r.reason_code;
  end if;
  select consumed_quantity into v_consumed from public.audit_credit_lots where source_ref = 'ph8-test-session-1';
  if v_consumed <> 1 then
    raise exception 'FAIL scenario 3: credit lot not decremented (consumed_quantity=%)', v_consumed;
  end if;
  raise notice 'PASS scenario 3 (paid workspace, credit consumed)';
end
$$;

-- Scenario 4: paid workspace with zero credit -> insufficient_credits
do $$
declare r record;
begin
  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004',
    'ph8-op-4', 'listing_id', '20000000-0000-0000-0000-000000000004', 1, false, false
  );
  if r.status <> 'insufficient_entitlement' or r.reason_code <> 'insufficient_credits' then
    raise exception 'FAIL scenario 4: status=%, reason=%', r.status, r.reason_code;
  end if;
  raise notice 'PASS scenario 4 (paid workspace, no credit, denied)';
end
$$;

-- Scenario 5: fail-closed -- no subscriptions row, free flag sent anyway -> must NOT get free_plan
do $$
declare r record;
begin
  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005',
    'ph8-op-5', 'listing_id', '20000000-0000-0000-0000-000000000005', 1, true, false
  );
  if r.status <> 'insufficient_entitlement' or r.reason_code <> 'insufficient_credits' or r.source = 'free_plan' then
    raise exception 'FAIL scenario 5 (fail-closed): status=%, source=%, reason=%', r.status, r.source, r.reason_code;
  end if;
  raise notice 'PASS scenario 5 (fail-closed: no subscriptions row denies free grant)';
end
$$;

-- Scenario 6: paid-plan workspace with a mismatched/spoofed free flag -> must NOT get free_plan
do $$
declare r record;
begin
  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006',
    'ph8-op-6', 'listing_id', '20000000-0000-0000-0000-000000000006', 1, true, false
  );
  if r.source = 'free_plan' or r.status = 'reserved' then
    raise exception 'FAIL scenario 6 (plan-mismatch bypass): status=%, source=%, reason=%', r.status, r.source, r.reason_code;
  end if;
  if r.status <> 'insufficient_entitlement' or r.reason_code <> 'insufficient_credits' then
    raise exception 'FAIL scenario 6: unexpected denial shape status=%, reason=%', r.status, r.reason_code;
  end if;
  raise notice 'PASS scenario 6 (plan-mismatch flag cannot grant free_plan)';
end
$$;

-- Scenario 6b (added Phase 8.2 -- no explicit admin scenario existed
-- before this): admin bypass on a paid-plan workspace with ZERO credit
-- lots must still succeed as 'admin', skipping the credit requirement
-- entirely.
do $$
declare r record;
begin
  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000099',
    'ph82-admin-1', 'listing_id', '20000000-0000-0000-0000-000000000099', 1, false, true
  );
  if r.status <> 'reserved' or r.source <> 'admin' then
    raise exception 'FAIL scenario 6b: status=%, source=%, reason=%', r.status, r.source, r.reason_code;
  end if;
  raise notice 'PASS scenario 6b (admin bypass skips credit requirement)';
end
$$;

-- Scenario 6c: defensive-in-depth -- admin bypass combined with a
-- (defensively tested, unreachable from real callers) enforce_free_plan_limit=true
-- flag must still resolve to 'admin', never 'free_plan'.
do $$
declare r record;
begin
  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000099',
    'ph82-admin-2', 'source_url', 'https://airbnb.com/rooms/test-admin-2', 1, true, true
  );
  if r.status <> 'reserved' or r.source <> 'admin' then
    raise exception 'FAIL scenario 6c: status=%, source=%, reason=%', r.status, r.source, r.reason_code;
  end if;
  raise notice 'PASS scenario 6c (admin bypass wins even if enforce_free_plan_limit is also true)';
end
$$;

-- Scenario 7: idempotence -- replaying the same operation_key from scenario 1
do $$
declare r record;
begin
  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
    'ph8-op-1', 'listing_id', '20000000-0000-0000-0000-000000000001', 1, true, false
  );
  if r.status <> 'already_reserved' then
    raise exception 'FAIL scenario 7: status=%', r.status;
  end if;
  raise notice 'PASS scenario 7 (idempotent replay of operation_key)';
end
$$;

-- Scenario 7b: same active target, different operation_key -> conflict
-- (sequential-session proof of the constraint only -- see file header limitation).
do $$
declare r record;
begin
  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
    'ph8-op-1b', 'listing_id', '20000000-0000-0000-0000-000000000001', 1, true, false
  );
  if r.status <> 'conflict' or r.reason_code <> 'active_target_reservation' then
    raise exception 'FAIL scenario 7b: status=%, reason=%', r.status, r.reason_code;
  end if;
  raise notice 'PASS scenario 7b (active-target conflict detected)';
end
$$;

-- Scenario 8: release then retry -- free quota must become available again
do $$
declare r record;
begin
  select * into r from public.release_audit_entitlement(
    '10000000-0000-0000-0000-000000000001', 'ph8-op-1', 'test_failure'
  );
  if r.status <> 'released' then
    raise exception 'FAIL scenario 8a (release): status=%', r.status;
  end if;

  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
    'ph8-op-1-retry', 'listing_id', '20000000-0000-0000-0000-000000000001', 1, true, false
  );
  if r.status <> 'reserved' or r.source <> 'free_plan' then
    raise exception 'FAIL scenario 8b (retry after release): status=%, source=%', r.status, r.source;
  end if;
  raise notice 'PASS scenario 8 (release then retry grants free_plan again)';
end
$$;

-- Scenario 9: finalize a free_plan reservation -> no usage_events row created
do $$
declare r record; v_audit_id uuid := gen_random_uuid(); v_usage_count integer;
begin
  -- A real audits row must exist before finalize (audit_id has a real FK
  -- constraint), matching the real app flow: app/api/audits/route.ts
  -- inserts into audits before calling finalizeAuditEntitlement.
  insert into public.audits (id, workspace_id, listing_id, created_by)
  values (v_audit_id, '10000000-0000-0000-0000-000000000001',
          '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');

  select * into r from public.finalize_audit_entitlement(
    '10000000-0000-0000-0000-000000000001', 'ph8-op-1-retry',
    v_audit_id, '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
    'api_audits_create', null
  );
  if r.status <> 'finalized' then
    raise exception 'FAIL scenario 9a (finalize): status=%', r.status;
  end if;

  select count(*) into v_usage_count from public.usage_events
  where workspace_id = '10000000-0000-0000-0000-000000000001';
  if v_usage_count <> 0 then
    raise exception 'FAIL scenario 9b: expected 0 usage_events rows for a free audit, found %', v_usage_count;
  end if;
  raise notice 'PASS scenario 9 (finalize free_plan: no usage_events row)';
end
$$;

-- Scenario 10 (constraint/permission check, item 8 of the mission): the
-- widened source constraint accepts 'free_plan' and the function keeps its
-- SECURITY DEFINER / service_role-only execute grant.
do $$
declare v_def text; v_secdef boolean; v_has_grant boolean;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid = 'public.audit_entitlement_reservations'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%free_plan%';
  if v_def is null then
    raise exception 'FAIL scenario 10a: no check constraint mentions free_plan';
  end if;

  select prosecdef into v_secdef from pg_proc where proname = 'reserve_audit_entitlement';
  if not v_secdef then
    raise exception 'FAIL scenario 10b: reserve_audit_entitlement lost SECURITY DEFINER';
  end if;

  select has_function_privilege('service_role', 'public.reserve_audit_entitlement(uuid,uuid,text,text,text,integer,boolean,boolean)', 'execute')
    into v_has_grant;
  if not v_has_grant then
    raise exception 'FAIL scenario 10c: service_role lost EXECUTE on reserve_audit_entitlement';
  end if;

  raise notice 'PASS scenario 10 (constraint + SECURITY DEFINER + service_role grant intact)';
end
$$;

\echo 'ALL SCENARIOS PASSED'
