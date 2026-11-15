-- Audit entitlement test harness, step 3/6: fixtures for the 9 scenarios
-- in 04_verify_scenarios.sql. Idempotent (ON CONFLICT DO NOTHING) so the
-- harness can be re-run without manual cleanup between iterations.

do $$
begin
  if current_database() <> 'norixo_ph8_entitlement_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_ph8_entitlement_test.', current_database();
  end if;
end
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'free-eligible@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'free-used@test.local'),
  ('00000000-0000-0000-0000-000000000003', 'paid-with-credit@test.local'),
  ('00000000-0000-0000-0000-000000000004', 'paid-no-credit@test.local'),
  ('00000000-0000-0000-0000-000000000005', 'no-sub-row@test.local'),
  ('00000000-0000-0000-0000-000000000006', 'fake-free-flag@test.local'),
  ('00000000-0000-0000-0000-000000000099', 'admin-tester@test.local')
on conflict (id) do nothing;

insert into public.workspaces (id, name, owner_user_id) values
  ('10000000-0000-0000-0000-000000000001', 'free-eligible', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'free-used', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003', 'paid-with-credit', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004', 'paid-no-credit', '00000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000005', 'no-sub-row', '00000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000006', 'fake-free-flag', '00000000-0000-0000-0000-000000000006'),
  -- Paid plan, zero credit lots: proves admin bypass skips the credit
  -- requirement entirely (added in Phase 8.2 -- no explicit admin
  -- scenario existed in the harness before this).
  ('10000000-0000-0000-0000-000000000099', 'admin-no-credit-no-free', '00000000-0000-0000-0000-000000000099')
on conflict (id) do nothing;

-- Workspace 5 deliberately has NO row here -- tests the fail-closed path.
insert into public.subscriptions (workspace_id, plan_code, status) values
  ('10000000-0000-0000-0000-000000000001', 'free', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'free', 'active'),
  ('10000000-0000-0000-0000-000000000003', 'pro', 'active'),
  ('10000000-0000-0000-0000-000000000004', 'pro', 'active'),
  ('10000000-0000-0000-0000-000000000006', 'pro', 'active'),
  ('10000000-0000-0000-0000-000000000099', 'pro', 'active')
on conflict (workspace_id) do nothing;

-- Workspace 2: one audit already consumed (free quota already used).
insert into public.listings (id, workspace_id, source_url) values
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'https://airbnb.com/rooms/test-2')
on conflict (id) do nothing;

insert into public.audits (id, workspace_id, listing_id, created_by)
select '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
       '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'
where not exists (select 1 from public.audits where id = '30000000-0000-0000-0000-000000000002');

-- Workspace 3: one usable paid credit lot.
insert into public.audit_credit_lots (workspace_id, source_type, source_ref, granted_quantity, consumed_quantity)
values ('10000000-0000-0000-0000-000000000003', 'stripe_checkout_pack', 'ph8-test-session-1', 1, 0)
on conflict (workspace_id, source_type, source_ref) do nothing;

-- Listings used as reservation targets by the scenarios below.
insert into public.listings (id, workspace_id, source_url) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'https://airbnb.com/rooms/test-1'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'https://airbnb.com/rooms/test-3'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'https://airbnb.com/rooms/test-4'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'https://airbnb.com/rooms/test-5'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', 'https://airbnb.com/rooms/test-6'),
  ('20000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000099', 'https://airbnb.com/rooms/test-admin')
on conflict (id) do nothing;
