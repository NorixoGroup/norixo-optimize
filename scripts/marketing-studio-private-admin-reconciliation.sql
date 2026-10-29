-- Norixo AI / Marketing Studio: READ-ONLY reconciliation check between the
-- application-level expected admin list (ADMIN_EMAILS / NORIXO_ADMIN_EMAILS)
-- and the database-level public.norixo_private_admins registry.
--
-- NOT a migration. Modifies nothing (no INSERT/UPDATE/DELETE anywhere in
-- this file). Run manually, after provisioning
-- (scripts/marketing-studio-private-admin-provisioning.sql) and before
-- applying
-- supabase/migrations/20261028160000_restrict_marketing_studio_tables_to_private_admins_policies.sql.
--
-- BEFORE RUNNING: replace the placeholder e-mails in the `expected_admins`
-- VALUES list below with the real, current content of ADMIN_EMAILS /
-- NORIXO_ADMIN_EMAILS -- the same list used for provisioning. Never commit
-- this file back to the repository with real e-mails.
--
-- Raises an exception (non-zero exit under `psql -v ON_ERROR_STOP=1`) if any
-- of the three checks below finds a discrepancy, so this script can be used
-- as a blocking gate in a deployment runbook, without itself touching any
-- data:
--   - an expected (application-level) admin with no matching row in
--     norixo_private_admins: would pass the application's 401/403 check but
--     be silently refused by RLS -- a "ghost admin";
--   - a row in norixo_private_admins with no matching expected e-mail: inert
--     at the application layer (never reaches a route that checks it), not
--     dangerous, but a sign of drift that should be cleaned up;
--   - a provisioned admin with zero workspace_members rows: passes both the
--     application check and is_norixo_private_admin(), but every
--     is_workspace_member() check in the RLS policies still refuses them.

do $$
declare
  missing_in_db int;
  extra_in_db int;
  without_membership int;
begin
  create temporary table expected_admins (email text not null) on commit drop;

  insert into expected_admins (email) values
    -- REPLACE with the real, current ADMIN_EMAILS / NORIXO_ADMIN_EMAILS list
    -- before running. These two lines are placeholders, not real accounts.
    ('admin-placeholder-1@example.invalid'),
    ('admin-placeholder-2@example.invalid');

  select count(*) into missing_in_db
  from expected_admins as ea
  join auth.users as u on lower(u.email) = lower(ea.email)
  where not exists (
    select 1 from public.norixo_private_admins as npa where npa.user_id = u.id
  );

  select count(*) into extra_in_db
  from public.norixo_private_admins as npa
  where not exists (
    select 1
    from expected_admins as ea
    join auth.users as u on lower(u.email) = lower(ea.email)
    where u.id = npa.user_id
  );

  select count(*) into without_membership
  from public.norixo_private_admins as npa
  where not exists (
    select 1 from public.workspace_members as wm where wm.user_id = npa.user_id
  );

  if missing_in_db > 0 then
    raise exception
      'Reconciliation FAILED: % expected admin(s) have no row in norixo_private_admins.',
      missing_in_db;
  end if;

  if extra_in_db > 0 then
    raise exception
      'Reconciliation FAILED: % row(s) in norixo_private_admins do not match any expected admin e-mail.',
      extra_in_db;
  end if;

  if without_membership > 0 then
    raise exception
      'Reconciliation FAILED: % provisioned admin(s) have zero workspace_members rows.',
      without_membership;
  end if;

  raise notice 'Reconciliation PASSED: expected admins and norixo_private_admins match, and all have workspace membership.';
end
$$;
