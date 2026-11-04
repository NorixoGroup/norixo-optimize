-- Rollback for:
--   supabase/migrations/20261104120000_enable_rls_backlink_outreach_initial_attempt_snapshots.sql
--   supabase/migrations/20261104130000_restrict_backlink_outreach_select_to_workspace_admins.sql
--
-- NOT a migration: it lives in scripts/ so the Supabase CLI never applies it
-- automatically. Run it manually (SQL editor / reviewed psql session) only
-- to restore the original pre-G4-M5 state: member-scoped SELECT on
-- backlink_outreach, and no RLS at all on
-- backlink_outreach_initial_attempt_snapshots. The clause below is the
-- exact text from migration 20260728000500_create_backlink_outreach.sql --
-- nothing paraphrased, nothing summarized.
-- This does NOT execute anything by itself (do not run this file
-- automatically).

begin;

drop policy if exists "backlink_outreach_select_workspace_admins" on public.backlink_outreach;

create policy "backlink_outreach_select_workspace_members"
on public.backlink_outreach
for select
to authenticated
using (public.is_workspace_member(workspace_id));

alter table public.backlink_outreach_initial_attempt_snapshots disable row level security;

commit;
