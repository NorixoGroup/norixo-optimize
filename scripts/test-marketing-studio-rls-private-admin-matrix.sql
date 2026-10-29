-- Test matrix for supabase/migrations/20261028160000_restrict_marketing_studio_tables_to_private_admins_policies.sql
-- (the policy-activation migration; requires
-- supabase/migrations/20261028150000_create_norixo_private_admins_registry.sql
-- applied first, plus a provisioned admin -- see
-- scripts/marketing-studio-private-admin-provisioning.sql).
--
-- NOT executed as part of this mission: no local Postgres/Docker is available in this
-- worktree (`supabase start` fails with "Cannot connect to the Docker daemon", no `psql`).
-- This file is prepared so it can be run later against a real local Supabase instance
-- (`supabase start`, then `psql` or the SQL editor) -- static review only until then.
--
-- Each block uses `set local role` + `request.jwt.claims` to simulate a given caller,
-- the standard way to exercise RLS policies directly in Postgres without a real JWT.
-- Replace the placeholder UUIDs with real fixture rows before running.
--
-- Two different failure modes look similar but are NOT the same result:
--   - RLS refusal: the query succeeds, returns 0 rows (SELECT) or raises
--     "new row violates row-level security policy" (INSERT/UPDATE). This is
--     what every "-> MUST be refused" scenario below expects.
--   - SQL permission error ("permission denied for table ..."): the role has
--     no base GRANT on the table at all, so the query never reaches RLS
--     evaluation. Scenarios 1-4 assume `authenticated` already has base
--     SELECT/INSERT/UPDATE/DELETE grants on marketing_campaigns (inherited
--     from the Supabase project's own default bootstrap, not from any
--     migration in this repo -- unconfirmed locally, see the security review).
--     If a permission-denied error appears instead of the documented
--     row-count outcome, that is this assumption failing, not an RLS defect.
-- None of this has been executed; the expectations in comments below are
-- predictions to verify, not reported results.

begin;

-- Fixtures (placeholders -- not real data):
--   workspace A: 00000000-0000-0000-0000-00000000000a
--   workspace B: 00000000-0000-0000-0000-00000000000b
--   private admin, member of workspace A only:      10000000-0000-0000-0000-000000000001
--   private admin, member of neither A nor B:        10000000-0000-0000-0000-000000000002
--   workspace A owner/admin (client), NOT a Norixo private admin: 10000000-0000-0000-0000-000000000003
--   workspace A simple member, NOT a Norixo private admin:        10000000-0000-0000-0000-000000000004
--
-- insert into public.workspaces (id, owner_user_id, name, slug) values (...);
-- insert into public.workspace_members (workspace_id, user_id, role) values (...);
-- insert into public.norixo_private_admins (user_id, email) values (...);
-- insert into public.marketing_campaigns (id, workspace_id, objective) values (...);

-- 1. Private admin, authorized on the row's workspace (A) -> MUST succeed.
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000001"}';
select public.is_norixo_private_admin();                                   -- expect: true
select public.is_workspace_member('00000000-0000-0000-0000-00000000000a'); -- expect: true
select count(*) from public.marketing_campaigns
  where workspace_id = '00000000-0000-0000-0000-00000000000a';             -- expect: > 0, rows visible
reset role;

-- 2. Private admin, NOT a member of the row's workspace -> MUST be refused,
--    even though norixo_private_admins says yes. Proves the AND is real, not
--    a no-op, and that a single shared workspace is not assumed.
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000002"}';
select public.is_norixo_private_admin();                                   -- expect: true
select public.is_workspace_member('00000000-0000-0000-0000-00000000000a'); -- expect: false
select count(*) from public.marketing_campaigns
  where workspace_id = '00000000-0000-0000-0000-00000000000a';             -- expect: 0 rows
reset role;

-- 3. Client workspace owner/admin (workspace_members.role in ('owner','admin')),
--    NOT in norixo_private_admins -> MUST be refused. Proves role is never a
--    substitute for the private-admin check.
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000003"}';
select public.is_norixo_private_admin();                                   -- expect: false
select public.is_workspace_admin_or_owner('00000000-0000-0000-0000-00000000000a'); -- expect: true
select count(*) from public.marketing_campaigns
  where workspace_id = '00000000-0000-0000-0000-00000000000a';             -- expect: 0 rows
reset role;

-- 4. Simple workspace member, NOT a private admin -> MUST be refused (same
--    class as the pre-migration gap this closes).
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000004"}';
select public.is_norixo_private_admin();                                   -- expect: false
select count(*) from public.marketing_campaigns
  where workspace_id = '00000000-0000-0000-0000-00000000000a';             -- expect: 0 rows
reset role;

-- 5. anon -> MUST be refused. `reset role;` above only resets the Postgres
--    role; it does NOT clear `request.jwt.claims`, which is session/
--    transaction state and would otherwise still hold scenario 4's identity
--    here. Cleared explicitly first, so this scenario does not depend on
--    auth.uid() at all: the real reason for the refusal is that no policy on
--    marketing_campaigns targets `anon` (all policies above are `to
--    authenticated`), independent of whatever auth.uid() would resolve to.
set local "request.jwt.claims" = '';
set local role anon;
select count(*) from public.marketing_campaigns;                           -- expect: 0 rows
reset role;

-- 6. service_role -> MUST succeed without restriction (bypasses RLS; this is
--    the worker's own path via enqueue_/claim_/heartbeat_marketing_studio_generation_run
--    and markMarketingStudioGenerationRunCompleted/Failed, confirmed unaffected
--    by code review). Claims cleared too, purely for isolation symmetry with
--    the other scenarios -- service_role bypasses RLS regardless of auth.uid().
set local "request.jwt.claims" = '';
set local role service_role;
select count(*) from public.marketing_campaigns;                           -- expect: all rows, no filter
reset role;

rollback; -- never commit a test run; this block only reads/sets session state.
