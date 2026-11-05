-- G4-M5 HTTP harness, step 4/4: local-cluster-only compensating policy.
--
-- In real Supabase (and in a throwaway cluster the harness fully controls),
-- `service_role` is created with the actual BYPASSRLS attribute, so
-- app/api/backlinks/outreach/[id]/route.ts's GET handler --
-- createStaffOutreachReadClient() -- reads backlink_outreach regardless of
-- Fix B's SELECT policy, exactly as
-- supabase/migrations/20261104130000_restrict_backlink_outreach_select_to_workspace_admins.sql's
-- own comment states ("every app/api/backlinks/outreach/** route reads this
-- table through a service-role Supabase client ... which bypasses RLS").
--
-- On THIS shared, persistent local PostgreSQL 16 cluster, `service_role`
-- already existed (created by an earlier, unrelated local harness run)
-- WITHOUT BYPASSRLS -- scripts/backlinks-g4-m5-rls-http-harness/01_bootstrap_auth_and_roles.sql
-- (and the SQL-only harness it was copied from) deliberately never alters
-- that shared, cluster-wide role to add BYPASSRLS, since doing so could
-- affect every other local database/project using the same cluster. That
-- SQL-only harness never actually exercised a plain service_role SELECT on
-- backlink_outreach (its own service_role scenarios only call SECURITY
-- DEFINER functions, which bypass RLS via function ownership regardless of
-- the caller's role) -- so this gap was invisible there and only surfaces
-- here, at the HTTP layer, where the staff read client issues that query
-- directly.
--
-- Fix: a permissive SELECT policy for service_role, scoped to THIS new
-- database (norixo_g4_m5_rls_http_test) and this one table only --
-- reproducing the production BYPASSRLS behavior locally without touching
-- the shared role or any other database. Not a change to Fix A/B's logic;
-- purely a local-test-environment compensation for this cluster's
-- service_role attribute.

do $$
begin
  if current_database() <> 'norixo_g4_m5_rls_http_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_g4_m5_rls_http_test.', current_database();
  end if;
end
$$;

drop policy if exists "g4m5_http_harness_service_role_bypass" on public.backlink_outreach;

create policy "g4m5_http_harness_service_role_bypass"
on public.backlink_outreach
for select
to service_role
using (true);
