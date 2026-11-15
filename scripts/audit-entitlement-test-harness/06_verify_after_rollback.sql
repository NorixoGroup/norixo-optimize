-- Audit entitlement test harness, step 6/6: proves the rollback is
-- compatible with data already created by the fix (item 9 of the Phase 8
-- mission) -- the 'free_plan' reservation and the finalized audit from
-- scenario 1/8/9 must survive untouched, while any NEW attempt no longer
-- gets a free grant.

\set ON_ERROR_STOP on

do $$
begin
  if current_database() <> 'norixo_ph8_entitlement_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_ph8_entitlement_test.', current_database();
  end if;
end
$$;

-- Pre-existing free_plan data must be untouched by the rollback.
do $$
declare v_status text; v_source text;
begin
  select status, source into v_status, v_source
  from public.audit_entitlement_reservations
  where operation_key = 'ph8-op-1-retry';

  if v_status <> 'consumed' or v_source <> 'free_plan' then
    raise exception 'FAIL post-rollback 1: existing free_plan reservation was altered (status=%, source=%)', v_status, v_source;
  end if;
  raise notice 'PASS post-rollback 1 (existing free_plan reservation intact)';
end
$$;

-- A brand-new free-eligible attempt (fresh workspace, never used before)
-- must now be denied for lack of credit -- the free path no longer exists
-- after rollback, exactly as before the fix was ever applied.
do $$
declare r record;
begin
  insert into auth.users (id, email) values
    ('00000000-0000-0000-0000-000000000007', 'post-rollback@test.local')
  on conflict (id) do nothing;
  insert into public.workspaces (id, name, owner_user_id) values
    ('10000000-0000-0000-0000-000000000007', 'post-rollback', '00000000-0000-0000-0000-000000000007')
  on conflict (id) do nothing;
  insert into public.subscriptions (workspace_id, plan_code, status) values
    ('10000000-0000-0000-0000-000000000007', 'free', 'active')
  on conflict (workspace_id) do nothing;
  insert into public.listings (id, workspace_id, source_url) values
    ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', 'https://airbnb.com/rooms/test-7')
  on conflict (id) do nothing;

  select * into r from public.reserve_audit_entitlement(
    '10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000007',
    'ph8-op-post-rollback', 'listing_id', '20000000-0000-0000-0000-000000000007', 1, true, false
  );
  if r.status <> 'insufficient_entitlement' or r.reason_code <> 'insufficient_credits' then
    raise exception 'FAIL post-rollback 2: rollback did not remove the free path (status=%, reason=%)', r.status, r.reason_code;
  end if;
  raise notice 'PASS post-rollback 2 (free path removed, pre-fix behaviour restored)';
end
$$;

\echo 'ROLLBACK VERIFIED: existing data intact, free path removed'
