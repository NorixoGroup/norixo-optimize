-- G4-M5 Backlinks HTTP harness, step 3/3: fixtures.
--
-- Run AFTER the real backlink_* migration files and BEFORE the two Fix
-- migrations (mirrors scripts/backlinks-g4-m5-rls-test-harness/run_all.sh's
-- ordering), so Fix A/B are exercised against non-empty, realistic tables.
--
-- The first block (workspaces A/B, 4 identities, full domain->outreach
-- chain, SECURITY DEFINER-driven attempt+snapshot rows) is copied verbatim
-- from scripts/backlinks-g4-m5-rls-test-harness/03_fixtures.sql (only the
-- database-name guard changed) -- none of those 4 identities' e-mails are on
-- any admin allow-list, which is exactly what G4-M5's SQL-level scenarios
-- need.
--
-- The second block adds 3 NEW identities whose e-mails ARE meant to be
-- listed in this run's ADMIN_EMAILS env var, covering the 3 workspace-A
-- access shapes the 7 HTTP profiles need that the SQL harness's 4 identities
-- don't by themselves disambiguate (isAdminPrivateEmail is an app-layer,
-- not RLS, gate):
--   - no membership in workspace A at all (profile 4)
--   - plain 'member' of workspace A (profiles 5 and 7)
--   - 'admin' of workspace A (profile 6)
--
-- Fictitious data only -- no real user, e-mail, or workspace identity.
-- Safe to re-run (ON CONFLICT DO NOTHING on all plain inserts; the two
-- function calls are themselves idempotent by design).

do $$
begin
  if current_database() <> 'norixo_g4_m5_rls_http_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_g4_m5_rls_http_test.', current_database();
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Identities (non-admin-email)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'fixture-workspace-a-owner@example.test'),
  ('10000000-0000-0000-0000-000000000002', 'fixture-workspace-a-admin@example.test'),
  ('10000000-0000-0000-0000-000000000003', 'fixture-workspace-a-member@example.test'),
  ('10000000-0000-0000-0000-000000000004', 'fixture-workspace-b-admin@example.test')
on conflict (id) do nothing;

insert into public.workspaces (id, owner_user_id, name, slug) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'Workspace A (fixture)', 'workspace-a-fixture'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000004', 'Workspace B (fixture)', 'workspace-b-fixture')
on conflict (id) do nothing;

-- owner-1: workspace A, role 'owner'.
-- admin-2: workspace A, role 'admin'.
-- member-3: workspace A, role 'member'.
-- admin-4: workspace B, role 'admin' -- used for cross-workspace scenarios.
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000002', 'admin'),
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003', 'member'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000004', 'admin')
on conflict (workspace_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Workspace A: domain, asset, opportunity, contact, campaign, outreach
-- ---------------------------------------------------------------------------

insert into public.backlink_domains (id, workspace_id, domain_key, hostname, lifecycle_status) values
  ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'BK-1001', 'fixture-domain-a.example.test', 'active')
on conflict (id) do nothing;

insert into public.backlink_assets (id, workspace_id, asset_key, display_name, asset_type, lifecycle_status) values
  ('31000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'fixture-asset-a', 'Fixture Asset A', 'calculator', 'active')
on conflict (id) do nothing;

insert into public.backlink_opportunities (
  id, workspace_id, opportunity_key, domain_id, asset_id, opportunity_type,
  target_page_url, target_page_title, page_type, evidence_summary
) values (
  '32000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'OP-100001',
  '30000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-00000000000a', 'guest_post',
  'https://fixture-domain-a.example.test/resources', 'Fixture Resource Page A', 'Resource Page',
  'Fixture evidence summary A'
)
on conflict (id) do nothing;

insert into public.backlink_contacts (
  id, workspace_id, domain_id, contact_key, email_normalized, contact_status, source_type, source_reference
) values (
  '33000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a',
  'CT-100001', 'fixture-contact-a@example.test', 'verified', 'manual', 'fixture harness'
)
on conflict (id) do nothing;

insert into public.backlink_campaigns (
  id, workspace_id, campaign_key, name, objective, owner_id, live_initial_send_enabled
) values (
  '34000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'BL-CAM-2026-001',
  'Fixture Campaign A', 'Fixture objective A', '10000000-0000-0000-0000-000000000001', true
)
on conflict (id) do nothing;

insert into public.backlink_outreach (
  id, workspace_id, campaign_id, opportunity_id, contact_id, outreach_key, channel, status,
  subject, body, created_by
) values (
  '35000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a',
  '34000000-0000-0000-0000-00000000000a', '32000000-0000-0000-0000-00000000000a',
  '33000000-0000-0000-0000-00000000000a', 'BL-OUT-2026-001', 'email', 'draft',
  'Fixture outreach subject A', 'Fixture outreach body A', '10000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Workspace B: same shape, fully isolated identities/keys -- used only to
-- prove no cross-workspace disclosure.
-- ---------------------------------------------------------------------------

insert into public.backlink_domains (id, workspace_id, domain_key, hostname, lifecycle_status) values
  ('30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'BK-1002', 'fixture-domain-b.example.test', 'active')
on conflict (id) do nothing;

insert into public.backlink_assets (id, workspace_id, asset_key, display_name, asset_type, lifecycle_status) values
  ('31000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'fixture-asset-b', 'Fixture Asset B', 'calculator', 'active')
on conflict (id) do nothing;

insert into public.backlink_opportunities (
  id, workspace_id, opportunity_key, domain_id, asset_id, opportunity_type,
  target_page_url, target_page_title, page_type, evidence_summary
) values (
  '32000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'OP-100002',
  '30000000-0000-0000-0000-00000000000b', '31000000-0000-0000-0000-00000000000b', 'guest_post',
  'https://fixture-domain-b.example.test/resources', 'Fixture Resource Page B', 'Resource Page',
  'Fixture evidence summary B'
)
on conflict (id) do nothing;

insert into public.backlink_contacts (
  id, workspace_id, domain_id, contact_key, email_normalized, contact_status, source_type, source_reference
) values (
  '33000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-00000000000b',
  'CT-100002', 'fixture-contact-b@example.test', 'verified', 'manual', 'fixture harness'
)
on conflict (id) do nothing;

insert into public.backlink_campaigns (
  id, workspace_id, campaign_key, name, objective, owner_id, live_initial_send_enabled
) values (
  '34000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'BL-CAM-2026-002',
  'Fixture Campaign B', 'Fixture objective B', '10000000-0000-0000-0000-000000000004', true
)
on conflict (id) do nothing;

insert into public.backlink_outreach (
  id, workspace_id, campaign_id, opportunity_id, contact_id, outreach_key, channel, status,
  subject, body, created_by
) values (
  '35000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b',
  '34000000-0000-0000-0000-00000000000b', '32000000-0000-0000-0000-00000000000b',
  '33000000-0000-0000-0000-00000000000b', 'BL-OUT-2026-002', 'email', 'draft',
  'Fixture outreach subject B', 'Fixture outreach body B', '10000000-0000-0000-0000-000000000004'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Drive the real approval + reservation RPCs: each workspace ends up with
-- one 'ready' outreach, one real backlink_outreach_attempts row, and one
-- real backlink_outreach_initial_attempt_snapshots row.
-- ---------------------------------------------------------------------------

select * from public.approve_backlink_outreach_initial_send(
  '00000000-0000-0000-0000-00000000000a'::uuid,
  '35000000-0000-0000-0000-00000000000a'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid
);

select * from public.approve_backlink_outreach_initial_send(
  '00000000-0000-0000-0000-00000000000b'::uuid,
  '35000000-0000-0000-0000-00000000000b'::uuid,
  '10000000-0000-0000-0000-000000000004'::uuid
);

select * from public.reserve_backlink_outreach_initial_attempt_for_approved_auto_send(
  '00000000-0000-0000-0000-00000000000a'::uuid,
  '34000000-0000-0000-0000-00000000000a'::uuid,
  '35000000-0000-0000-0000-00000000000a'::uuid,
  '36000000-0000-0000-0000-00000000000a'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid,
  'fixture-initial-attempt-a',
  encode(extensions.digest('fixture-reply-token-a', 'sha256'), 'hex'),
  'v1',
  timezone('utc', now())
);

select * from public.reserve_backlink_outreach_initial_attempt_for_approved_auto_send(
  '00000000-0000-0000-0000-00000000000b'::uuid,
  '34000000-0000-0000-0000-00000000000b'::uuid,
  '35000000-0000-0000-0000-00000000000b'::uuid,
  '36000000-0000-0000-0000-00000000000b'::uuid,
  '10000000-0000-0000-0000-000000000004'::uuid,
  'fixture-initial-attempt-b',
  encode(extensions.digest('fixture-reply-token-b', 'sha256'), 'hex'),
  'v1',
  timezone('utc', now())
);

do $$
declare
  v_a_count integer;
  v_b_count integer;
begin
  select count(*) into v_a_count
  from public.backlink_outreach_attempts a
  join public.backlink_outreach_initial_attempt_snapshots s on s.attempt_id = a.id
  where a.id = '36000000-0000-0000-0000-00000000000a';

  if v_a_count <> 1 then
    raise exception 'FIXTURES: workspace A attempt/snapshot pair was not created as expected (count=%).', v_a_count;
  end if;

  select count(*) into v_b_count
  from public.backlink_outreach_attempts a
  join public.backlink_outreach_initial_attempt_snapshots s on s.attempt_id = a.id
  where a.id = '36000000-0000-0000-0000-00000000000b';

  if v_b_count <> 1 then
    raise exception 'FIXTURES: workspace B attempt/snapshot pair was not created as expected (count=%).', v_b_count;
  end if;

  raise notice 'Fixtures OK: attempt+snapshot rows exist for both workspace A and workspace B.';
end
$$;

-- ---------------------------------------------------------------------------
-- NEW for the HTTP harness: 3 admin-allow-listed identities (e-mails listed
-- in this run's ADMIN_EMAILS env var -- see run_http_harness.sh), covering
-- the 3 workspace-A relationships the 7 profiles require:
--   20...0001 no membership in workspace A at all               (profile 4)
--   20...0002 plain 'member' of workspace A                     (profiles 5, 7)
--   20...0003 'admin' of workspace A                            (profile 6)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-000000000001', 'g4m5-http-harness-admin-no-member@example.test'),
  ('20000000-0000-0000-0000-000000000002', 'g4m5-http-harness-admin-member@example.test'),
  ('20000000-0000-0000-0000-000000000003', 'g4m5-http-harness-admin-owner@example.test')
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000002', 'member'),
  ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000003', 'admin')
on conflict (workspace_id, user_id) do nothing;

do $$
declare
  v_no_member_count integer;
begin
  select count(*) into v_no_member_count
  from public.workspace_members
  where user_id = '20000000-0000-0000-0000-000000000001';

  if v_no_member_count <> 0 then
    raise exception 'FIXTURES: admin-no-member identity unexpectedly has a workspace_members row (count=%).', v_no_member_count;
  end if;

  raise notice 'Fixtures OK: HTTP-harness admin identities created (no-member, member, admin).';
end
$$;
