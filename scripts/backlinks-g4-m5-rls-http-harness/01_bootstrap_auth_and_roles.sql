-- G4-M5 Backlinks HTTP harness, step 1/3: minimal Supabase-equivalent
-- primitives.
--
-- NEW, dedicated database (norixo_g4_m5_rls_http_test) on the EXISTING local
-- PostgreSQL 16 server at 127.0.0.1:5432 -- no initdb, no new cluster, no
-- Docker, no Supabase project, no network access from Postgres itself.
--
-- Copied from scripts/backlinks-g4-m5-rls-test-harness/01_bootstrap_auth_and_roles.sql
-- with only the database-name guard changed, so this file can run against
-- norixo_g4_m5_rls_http_test without touching that already-validated
-- harness's own database or files. See that file's header for the full
-- rationale on auth.uid(), the GLOBAL OBJECTS warning for
-- anon/authenticated/service_role, and why service_role's BYPASSRLS here is
-- reproduced via a local permissive policy, not by altering the shared role.
--
-- Safe to re-run (every object uses IF NOT EXISTS / OR REPLACE).

do $$
begin
  if current_database() <> 'norixo_g4_m5_rls_http_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_g4_m5_rls_http_test.', current_database();
  end if;
end
$$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists auth;

-- Minimal auth.users: only the column every FK in this project references
-- (id uuid). This is NOT the real Supabase auth.users table.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- The real Supabase auth.uid() implementation, unmodified: reads
-- request.jwt.claim.sub first, falling back to request.jwt.claims->>'sub'.
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

-- GLOBAL OBJECTS WARNING: these three roles are cluster-wide, shared with
-- every other local test database on this PostgreSQL instance (including
-- the already-validated norixo_g4_m5_rls_test harness). Created ONLY if
-- truly absent; never altered if already present.
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
    raise notice 'Role "service_role" already exists cluster-wide WITHOUT being altered; if it lacks BYPASSRLS, step 2''s local policy is what models that behavior, not this role''s attributes.';
  end if;
end
$$;

-- These GRANTs only affect how anon/authenticated/service_role may access
-- objects INSIDE norixo_g4_m5_rls_http_test; they do not change the roles'
-- standing on any other database on this cluster.
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;

-- PostgREST connection role for THIS harness only, cluster-wide (roles are
-- not per-database) but uniquely named and created/dropped only by this
-- harness's own setup/teardown -- never touches anon/authenticated/
-- service_role or any role created by another project.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'g4m5_http_authenticator') then
    create role g4m5_http_authenticator login noinherit;
  else
    raise exception 'Refusing to run: role g4m5_http_authenticator already exists (stale run?). Drop it manually after confirming it is not in use, then re-run.';
  end if;
end
$$;

grant anon, authenticated, service_role to g4m5_http_authenticator;
