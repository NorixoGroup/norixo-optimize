-- Audit entitlement test harness, step 1/6: minimal Supabase-equivalent
-- primitives, following the same pattern already established and
-- documented in scripts/rls-test-harness/01_bootstrap_auth_and_roles.sql.
--
-- Local-only, isolated database (norixo_ph8_entitlement_test on the same
-- plain Homebrew PostgreSQL 16 instance used by the other local harnesses
-- in this repo -- no Docker, no Supabase project, no network access).
--
-- *** GLOBAL OBJECTS WARNING (same as the RLS harness) ***
-- anon/authenticated/service_role are CLUSTER-WIDE roles. A read-only
-- check found they already exist on this cluster (shared with
-- norixo_ai_rls_test and the other local test databases). This script
-- does not create or alter them if present; the `create role` block below
-- is a no-op here, left in only for portability.
--
-- Safe to re-run (every object uses IF NOT EXISTS / OR REPLACE).

do $$
begin
  if current_database() <> 'norixo_ph8_entitlement_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_ph8_entitlement_test.', current_database();
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

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
    raise notice 'Role "service_role" already exists cluster-wide; left unmodified.';
  end if;
end
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
