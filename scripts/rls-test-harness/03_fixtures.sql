-- RLS test harness, step 3/5: fixtures.
--
-- Run this AFTER applying the real migration (public.norixo_private_admins
-- does not exist before it). Uses the exact same placeholder UUIDs as
-- scripts/test-marketing-studio-rls-private-admin-matrix.sql, so that file's
-- comments ("workspace A", "private admin, member of workspace A only", ...)
-- describe these exact rows.
--
-- Fictitious data only -- no real user, e-mail, or workspace identity.
-- Safe to re-run (ON CONFLICT DO NOTHING everywhere).

do $$
begin
  if current_database() <> 'norixo_ai_rls_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_ai_rls_test.', current_database();
  end if;
end
$$;

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'fixture-private-admin-1@example.test'),
  ('10000000-0000-0000-0000-000000000002', 'fixture-private-admin-2@example.test'),
  ('10000000-0000-0000-0000-000000000003', 'fixture-client-workspace-admin@example.test'),
  ('10000000-0000-0000-0000-000000000004', 'fixture-client-workspace-member@example.test')
on conflict (id) do nothing;

insert into public.workspaces (id, owner_user_id, name, slug) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003', 'Workspace A (fixture)', 'workspace-a-fixture'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000003', 'Workspace B (fixture)', 'workspace-b-fixture')
on conflict (id) do nothing;

-- admin-1: Norixo private admin AND a real member of workspace A (any role --
-- membership alone is what is_workspace_member() checks).
-- admin-2: Norixo private admin but NOT a member of workspace A or B at all
--          (scenario 2: must still be refused).
-- client-admin-3 (identity .0003): workspace A owner/admin role, NOT a
--          Norixo private admin (scenario 3: role must not substitute).
-- member-4 (identity .0004): plain workspace A member, NOT a Norixo private
--          admin (scenario 4).
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'member'),
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003', 'admin'),
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000004', 'member')
on conflict (workspace_id, user_id) do nothing;

insert into public.norixo_private_admins (user_id, email, note) values
  ('10000000-0000-0000-0000-000000000001', 'fixture-private-admin-1@example.test', 'RLS harness fixture'),
  ('10000000-0000-0000-0000-000000000002', 'fixture-private-admin-2@example.test', 'RLS harness fixture')
on conflict (user_id) do nothing;

insert into public.marketing_campaigns (id, workspace_id, created_by, objective, status) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'Fixture campaign in workspace A', 'draft')
on conflict (id) do nothing;
