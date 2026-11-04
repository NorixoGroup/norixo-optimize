begin;

-- G4-M5 Fix B: public.backlink_outreach's SELECT policy
-- ("backlink_outreach_select_workspace_members", from
-- 20260728000500_create_backlink_outreach.sql) allows any workspace member
-- (role 'member' included) to read the table, while its INSERT/UPDATE
-- policies are already restricted to workspace admins/owners
-- (public.is_workspace_admin_or_owner). Since
-- 20260810091000_add_backlink_outreach_draft_content.sql, the table also
-- carries the outreach draft content (subject, body) and, since
-- 20260828120000_add_backlink_outreach_approval_aware_initial_attempt_reservation.sql,
-- the approval metadata (auto_send_approval_fingerprint,
-- auto_send_approved_by, auto_send_approved_body, etc.) -- all more
-- sensitive than a bare lifecycle-status row. SELECT is hereby aligned with
-- INSERT/UPDATE: workspace admins/owners only.
--
-- No application regression expected: every app/api/backlinks/outreach/**
-- route reads this table through a service-role Supabase client
-- (createSupabaseAdminClient), which bypasses RLS, and no direct
-- browser/PostgREST read of backlink_outreach by the 'authenticated' role
-- exists in the codebase today. The SECURITY DEFINER functions that read
-- backlink_outreach (validate_backlink_outreach_workspace,
-- reserve_backlink_outreach_initial_attempt,
-- reserve_backlink_outreach_initial_attempt_for_approved_auto_send,
-- apply_backlink_outreach_backlink_obtained, approve_backlink_outreach_initial_send,
-- etc.) execute as their owning role and bypass RLS regardless of this
-- policy change.

drop policy if exists "backlink_outreach_select_workspace_members" on public.backlink_outreach;

create policy "backlink_outreach_select_workspace_admins"
on public.backlink_outreach
for select
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_outreach is
  'Workspace-scoped outreach tracking, including draft content and approval metadata. SELECT restricted to workspace admins/owners, matching INSERT/UPDATE.';

commit;
