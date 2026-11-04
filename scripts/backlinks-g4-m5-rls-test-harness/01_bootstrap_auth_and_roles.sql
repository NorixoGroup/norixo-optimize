-- G4-M5 Backlinks RLS test harness, step 1/5: minimal Supabase-equivalent
-- primitives.
--
-- Local-only, isolated database (norixo_g4_m5_rls_test on a throwaway
-- PostgreSQL 16 -- no Docker, no Supabase project, no network access).
-- Copied verbatim from scripts/rls-test-harness/01_bootstrap_auth_and_roles.sql
-- (same project convention, same reasoning) -- see that file's header for
-- the full rationale on auth.uid(), the GLOBAL OBJECTS warning for
-- anon/authenticated/service_role, and why service_role's BYPASSRLS here
-- is reproduced via a local permissive policy, not by altering the shared
-- role.
--
-- Safe to re-run (every object uses IF NOT EXISTS / OR REPLACE).

do $$
begin
  if current_database() <> 'norixo_g4_m5_rls_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_g4_m5_rls_test.', current_database();
  end if;
end
$$;

-- Real Supabase projects install pgcrypto in a dedicated `extensions`
-- schema; supabase/migrations/20260830180000_fix_backlink_first_approval_digest_schema.sql
-- and 20260831130000_harden_backlink_v2_approval_fingerprint.sql call
-- extensions.digest(...) explicitly (schema-qualified) because of exactly
-- that layout. Reproduced here (ONE install, in `extensions`, not `public`)
-- so those two real migration files run unmodified against this database;
-- a plain `create extension if not exists pgcrypto;` with no schema (as
-- supabase/migrations/20260830170000_add_atomic_backlink_first_approval.sql
-- also issues, unqualified) would install it in `public` and make the
-- schema-qualified calls below fail with "schema extensions does not
-- exist" / "function extensions.digest does not exist" -- so this must run
-- BEFORE any migration file's own `create extension if not exists
-- pgcrypto;`, which then becomes a true no-op (IF NOT EXISTS, extension
-- already installed, regardless of schema).
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
-- every other local test database on this throwaway Postgres instance.
-- Created ONLY if truly absent; never altered if already present.
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
-- objects INSIDE norixo_g4_m5_rls_test; they do not change the roles'
-- standing on any other database on this cluster.
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
