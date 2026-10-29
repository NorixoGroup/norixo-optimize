-- Norixo AI / Marketing Studio: MANUAL private-admin provisioning script.
--
-- NOT a migration: lives in scripts/ so the Supabase CLI never applies it
-- automatically. Run once, by hand, via the Supabase SQL editor or a
-- reviewed psql/service_role session -- never through the application,
-- never through a user session (the target table has no authenticated/anon
-- policy or grant by design).
--
-- BEFORE RUNNING: replace the placeholder e-mails in the `expected_admins`
-- VALUES list below with the real, current content of ADMIN_EMAILS /
-- NORIXO_ADMIN_EMAILS. Never commit this file back to the repository with
-- real e-mails, user IDs, or any other secret -- restore the placeholders
-- (or discard the edit) before committing.
--
-- This script is intentionally conservative and all-or-nothing:
--   - resolves every expected e-mail against auth.users;
--   - FAILS the whole operation (zero rows inserted) if any expected e-mail
--     is not found in auth.users;
--   - FAILS the whole operation if any expected e-mail resolves to more than
--     one auth.users row (defensive: should be impossible given auth.users'
--     own e-mail uniqueness, but never silently assumed);
--   - FAILS the whole operation if any resolved user has zero
--     workspace_members rows -- this script deliberately never creates
--     workspace membership itself; that is a separate, intentional decision
--     left to the operator, never an automatic side effect of provisioning
--     private-admin status;
--   - only inserts into norixo_private_admins once every check above has
--     passed for every expected admin, inside the same transaction as the
--     checks, so there is no possibility of a partial insert.
--
-- Run this, and confirm it reports PASS, before applying
-- supabase/migrations/20261028160000_restrict_marketing_studio_tables_to_private_admins_policies.sql.
-- Follow up with scripts/marketing-studio-private-admin-reconciliation.sql to
-- confirm the application-level and database-level admin lists now agree.

begin;

do $$
declare
  missing_count int;
  ambiguous_count int;
  without_membership_count int;
  inserted_count int;
begin
  create temporary table expected_admins (email text not null) on commit drop;

  insert into expected_admins (email) values
    -- REPLACE with the real, current ADMIN_EMAILS / NORIXO_ADMIN_EMAILS list
    -- before running. These two lines are placeholders, not real accounts.
    ('admin-placeholder-1@example.invalid'),
    ('admin-placeholder-2@example.invalid');

  select count(*) into missing_count
  from expected_admins as ea
  where not exists (
    select 1 from auth.users as u where lower(u.email) = lower(ea.email)
  );

  select count(*) into ambiguous_count
  from (
    select ea.email
    from expected_admins as ea
    join auth.users as u on lower(u.email) = lower(ea.email)
    group by ea.email
    having count(*) > 1
  ) as amb;

  select count(*) into without_membership_count
  from expected_admins as ea
  join auth.users as u on lower(u.email) = lower(ea.email)
  where not exists (
    select 1 from public.workspace_members as wm where wm.user_id = u.id
  );

  if missing_count > 0 then
    raise exception
      'Provisioning aborted (no rows inserted): % expected admin e-mail(s) not found in auth.users.',
      missing_count;
  end if;

  if ambiguous_count > 0 then
    raise exception
      'Provisioning aborted (no rows inserted): % expected admin e-mail(s) resolve to more than one auth.users row.',
      ambiguous_count;
  end if;

  if without_membership_count > 0 then
    raise exception
      'Provisioning aborted (no rows inserted): % expected admin(s) resolved in auth.users but have zero workspace_members rows. This script never creates workspace membership -- add it deliberately first, then re-run.',
      without_membership_count;
  end if;

  insert into public.norixo_private_admins (user_id, email, granted_by, note)
  select u.id, u.email, null, 'provisioned via scripts/marketing-studio-private-admin-provisioning.sql'
  from expected_admins as ea
  join auth.users as u on lower(u.email) = lower(ea.email)
  on conflict (user_id) do nothing;

  select count(*) into inserted_count
  from expected_admins as ea
  join auth.users as u on lower(u.email) = lower(ea.email)
  join public.norixo_private_admins as npa on npa.user_id = u.id;

  raise notice 'Provisioning PASSED: % expected admin(s) now present in norixo_private_admins.', inserted_count;
end
$$;

commit;
