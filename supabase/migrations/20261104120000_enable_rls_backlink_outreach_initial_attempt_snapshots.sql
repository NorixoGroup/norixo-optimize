begin;

-- G4-M5 Fix A: public.backlink_outreach_initial_attempt_snapshots was created
-- in 20260828120000_add_backlink_outreach_approval_aware_initial_attempt_reservation.sql
-- without row level security and without any policy -- the only
-- backlink_* table in that state. It stores a full snapshot of an approved
-- outreach send (recipient_email, subject, body, target_url,
-- approval_fingerprint) per workspace, so it is at least as sensitive as
-- public.backlink_outreach itself.
--
-- Minimal permissions: enable RLS and add no policy for anon/authenticated.
-- This is a deny-all default once RLS is active -- no client role can
-- select/insert/update/delete a single row. The only legitimate writers
-- (public.reserve_backlink_outreach_initial_attempt_for_approved_auto_send)
-- are SECURITY DEFINER and execute as their owning role, which bypasses RLS
-- regardless of policies (no backlink_* table uses FORCE ROW LEVEL
-- SECURITY), so this migration does not change their behavior. No
-- application code currently reads this table outside that function and a
-- smoke test; the one repository getter
-- (getBacklinkOutreachInitialAttemptSnapshotByAttemptId) has no caller yet.
--
-- If a legitimate direct-read need for this table emerges later (e.g. a
-- workspace-admin-facing audit view), add a scoped SELECT policy in a
-- follow-up migration then -- do not broaden this one speculatively.

alter table public.backlink_outreach_initial_attempt_snapshots enable row level security;

comment on table public.backlink_outreach_initial_attempt_snapshots is
  'Workspace-scoped snapshot of an approved initial outreach send (recipient, subject, body, target URL, approval fingerprint). RLS enabled with no anon/authenticated policy: only SECURITY DEFINER functions (bypassing RLS via ownership) read or write this table today.';

commit;
