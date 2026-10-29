-- RLS test harness, step 1/5: minimal Supabase-equivalent primitives.
--
-- Local-only, isolated database (norixo_ai_rls_test on a plain Homebrew
-- PostgreSQL 16 -- no Docker, no Supabase project, no network access).
-- Reproduces exactly the dependencies the real migrations
-- (supabase/migrations/20261028150000_create_norixo_private_admins_registry.sql
-- and
-- supabase/migrations/20261028160000_restrict_marketing_studio_tables_to_private_admins_policies.sql)
-- and their prerequisites rely on: auth.uid(), auth.users, and the
-- anon/authenticated/service_role roles. This is NOT a mock of the security
-- logic itself -- it is the real auth.uid() mechanism (reads the
-- `request.jwt.claims` GUC, exactly as Supabase's own implementation does),
-- so RLS policies evaluated against it behave the same way they would in a
-- real Supabase project.
--
-- *** GLOBAL OBJECTS WARNING ***
-- PostgreSQL roles are CLUSTER-WIDE, not database-scoped. A read-only check
-- against this cluster found that `anon`, `authenticated` and `service_role`
-- ALREADY EXIST here -- shared with other local test databases on this same
-- Homebrew Postgres 16 instance (norixo_bl1_test, norixo_bl1_backlinks_test,
-- norixo_bl1_backlinks_test_v4, norixo_pr1_test, nkridari_dev). This script
-- therefore does NOT create or alter these roles: the `create role` below is
-- a no-op whenever the role already exists (IF NOT EXISTS guard), and this
-- script never runs ALTER ROLE on them. Their privileges on *this* database's
-- objects are granted below (scoped to norixo_ai_rls_test only, via plain
-- GRANT on specific tables); their global attributes (superuser, bypassrls,
-- login, membership of any other role) are left exactly as found, on every
-- other database on this cluster as well as this one.
--
-- Consequence verified by direct inspection: the pre-existing `service_role`
-- does NOT have BYPASSRLS (rolbypassrls = false). Real Supabase's
-- service_role does. This harness does not attempt to add BYPASSRLS to the
-- shared role (that would be a global, cross-project mutation outside this
-- script's authorization). Step 2 instead adds a database-local permissive
-- policy scoped to service_role on this database's own tables, which
-- reproduces the *observable effect* (service_role sees/writes everything)
-- without touching the shared role's global attributes. See the harness
-- limitations in the mission deliverable for what this does NOT prove.
--
-- Safe to re-run (every object uses IF NOT EXISTS / OR REPLACE).

do $$
begin
  if current_database() <> 'norixo_ai_rls_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_ai_rls_test.', current_database();
  end if;
end
$$;

create schema if not exists auth;

-- Minimal auth.users: only the column every FK in this project references
-- (id uuid). This is NOT the real Supabase auth.users table (dozens of
-- columns, triggers, identity linking) -- see harness limitations.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- The real Supabase auth.uid() implementation, unmodified: reads
-- request.jwt.claim.sub first, falling back to request.jwt.claims->>'sub'.
-- public.is_norixo_private_admin() and public.is_workspace_member() both
-- call this exact function; it is not stubbed or simplified.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- GLOBAL OBJECTS: these three roles are cluster-wide. Created ONLY if truly
-- absent; never altered if already present (see warning above). On this
-- cluster, as of the last check, all three already exist -- this block will
-- raise a NOTICE for each and otherwise do nothing.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  else
    raise notice 'Role "anon" already exists cluster-wide; left unmodified.';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  else
    raise notice 'Role "authenticated" already exists cluster-wide; left unmodified.';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  else
    raise notice 'Role "service_role" already exists cluster-wide WITHOUT being altered; if it lacks BYPASSRLS, step 2''s local policy is what makes scenario 6 work, not this role''s attributes.';
  end if;
end
$$;

-- These GRANTs only affect how anon/authenticated/service_role may access
-- objects INSIDE norixo_ai_rls_test; they do not change the roles' standing
-- on any other database on this cluster.
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
