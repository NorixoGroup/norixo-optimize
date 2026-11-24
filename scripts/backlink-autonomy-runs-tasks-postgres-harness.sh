#!/usr/bin/env bash
# BACKLINKS-AUTO-05 Phase 2 — real local PostgreSQL verification of
# automation_runs / automation_tasks: creation, reclamation, chaining,
# persistence, dependency-integrity trigger, idempotence, and genuine RLS
# (real request.jwt.claims / auth.uid(), not a stub bypass).
#
# Builds a throwaway DATABASE (unique name, dedicated non-superuser owner
# role) on the LOCAL PostgreSQL server reached only through a unix socket,
# reuses the already-established bootstrap idioms from
# scripts/rls-test-harness/01_bootstrap_auth_and_roles.sql (real auth.uid())
# and scripts/rls-test-harness/02_bootstrap_pre_migration_schema.sql
# (workspaces/workspace_members columns), applies the repository migrations
# in order, tolerating only migrations unrelated to Backlinks/automation,
# then runs scripts/backlink-autonomy-runs-tasks-postgres-verification.sql.
# Never connects to Supabase or any TCP host; never calls Resend / Brave /
# OpenAI / ZeroBounce. Drops only the database and role it created.
#
# Usage: PGSOCKET_DIR=/tmp PG_BIN=/usr/local/opt/postgresql@16/bin scripts/backlink-autonomy-runs-tasks-postgres-harness.sh
set -euo pipefail
umask 077
export LC_ALL=C LANG=C
unset LANGUAGE DATABASE_URL LOCAL_DB_URL PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGDATABASE PGUSER PGPORT PGPASSWORD PGPASSFILE PGOPTIONS PGSSLMODE

die() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

[ "$(id -u)" != 0 ] || die "refusing to run as root"
PG_BIN="${PG_BIN:-/usr/local/opt/postgresql@17/bin}"
SOCK="${PGSOCKET_DIR:-/tmp}"
PORT="${PGPORT_NUM:-5432}"
case "$SOCK" in /*) ;; *) die "PGSOCKET_DIR must be an absolute unix socket directory" ;; esac
[ -S "$SOCK/.s.PGSQL.$PORT" ] || die "no PostgreSQL unix socket at $SOCK"
for bin in psql createdb dropdb; do [ -x "$PG_BIN/$bin" ] || die "missing $PG_BIN/$bin"; done

REPO=$(cd "$(dirname "$0")/.." && pwd -P)
MIG="$REPO/supabase/migrations"
VERIFY="$REPO/scripts/backlink-autonomy-runs-tasks-postgres-verification.sql"
[ -f "$VERIFY" ] || die "missing verification SQL"

SUFFIX="$(date +%s)_$$"
DB="auto05_runs_tasks_${SUFFIX}"
OWNER="auto05_owner_${SUFFIX}"
ADMIN=("$PG_BIN/psql" -h "$SOCK" -p "$PORT" -d postgres -v ON_ERROR_STOP=1 -X -q)
as_owner() { "$PG_BIN/psql" -h "$SOCK" -p "$PORT" -U "$OWNER" -d "$DB" -v ON_ERROR_STOP=1 -X -q "$@"; }
cleanup() {
  "$PG_BIN/dropdb" -h "$SOCK" -p "$PORT" --if-exists --force "$DB" >/dev/null 2>&1 || true
  "${ADMIN[@]}" -c "drop role if exists \"$OWNER\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for role in anon authenticated service_role; do
  [ "$("${ADMIN[@]}" -Atc "select count(*) from pg_roles where rolname='$role'")" = 1 ] || die "role $role missing on the local server"
done
"${ADMIN[@]}" -c "create role \"$OWNER\" login nosuperuser nocreatedb nocreaterole"
"${ADMIN[@]}" -c "create database \"$DB\" owner \"$OWNER\""
[ "$("${ADMIN[@]}" -Atc "select rolsuper from pg_roles where rolname='$OWNER'")" = f ] || die "owner must not be a superuser"
pass "throwaway database $DB owned by non-superuser $OWNER"

as_owner -c "create schema if not exists extensions; create extension if not exists pgcrypto schema extensions;"

# Real auth.uid() (reads request.jwt.claim.sub / request.jwt.claims), exactly
# as scripts/rls-test-harness/01_bootstrap_auth_and_roles.sql already proved.
as_owner <<'SQL'
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
-- workspaces/workspace_members with the real columns the shipped RLS
-- migration (20260318120000) requires, exactly as
-- scripts/rls-test-harness/02_bootstrap_pre_migration_schema.sql already
-- established -- so that migration applies for real, instead of being
-- tolerated as a failure and leaving a permissive stub in its place.
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete cascade,
  name text,
  slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000a3')
on conflict (id) do nothing;

-- Minimal pre-existing stand-ins for the OTHER tables that the same
-- transactional workspace-RLS migration (20260318120000) also enables RLS
-- on, so that migration commits as a whole instead of rolling back the
-- is_workspace_admin_or_owner()/is_workspace_member() functions this
-- harness actually needs. Not Backlinks concerns; present only so the
-- migration this harness depends on can apply for real.
create table if not exists public.listings (id uuid primary key default gen_random_uuid(), workspace_id uuid references public.workspaces (id) on delete cascade, created_by uuid references auth.users (id) on delete set null);
create table if not exists public.audits (id uuid primary key default gen_random_uuid(), workspace_id uuid references public.workspaces (id) on delete cascade, listing_id uuid references public.listings (id) on delete cascade, created_by uuid references auth.users (id) on delete set null);
create table if not exists public.subscriptions (id uuid primary key default gen_random_uuid(), workspace_id uuid references public.workspaces (id) on delete cascade);
create table if not exists public.usage_events (id uuid primary key default gen_random_uuid(), workspace_id uuid references public.workspaces (id) on delete cascade, user_id uuid references auth.users (id) on delete set null);
SQL

APPLIED=0; TOLERATED=0
for f in $(ls "$MIG"/*.sql | sort); do
  name=$(basename "$f")
  case "$name" in 20261017120000_*) continue ;; esac
  if as_owner -f "$f" >/dev/null 2>/dev/null; then
    APPLIED=$((APPLIED + 1))
  else
    if echo "$name" | grep -q -E "backlink|automation|outreach|contact_form|claim|dead_letter|discovery|brave|inbound|enable_workspace_rls"; then
      as_owner -f "$f" 2>&1 | head -8 >&2 || true
      die "Backlinks / automation / workspace-RLS migration failed to apply: $name"
    fi
    TOLERATED=$((TOLERATED + 1))
  fi
done
for fn in claim_next_automation_task complete_automation_task is_workspace_admin_or_owner; do
  [ "$("${ADMIN[@]}" -d "$DB" -Atc "select count(*) from pg_proc where proname='$fn'")" -ge 1 ] || die "$fn missing after migrations"
done
pass "migrations applied ($APPLIED ok, $TOLERATED unrelated base-table failures tolerated, 20261017120000 skipped)"

# Only the three roles (shared cluster-wide, never created/altered by this
# script -- consistent with scripts/rls-test-harness/01_bootstrap_auth_and_roles.sql's
# own documented policy) need access to THIS database's objects.
# The throwaway owner must be able to SET ROLE authenticated to exercise the
# real RLS policies as that role (this grant is scoped to the owner role
# this script itself created and drops on exit -- it never alters the
# shared cluster-wide authenticated/service_role roles' own membership).
"${ADMIN[@]}" -c "grant authenticated to \"$OWNER\"; grant service_role to \"$OWNER\";"
"${ADMIN[@]}" -d "$DB" -c "grant usage on schema auth to anon, authenticated, service_role; grant usage on schema public to anon, authenticated, service_role; grant select on auth.users to anon, authenticated, service_role;" >/dev/null
"${ADMIN[@]}" -d "$DB" -c "grant select, insert, update, delete on public.workspaces, public.workspace_members, public.automation_workspace_controls, public.automation_runs, public.automation_tasks to anon, authenticated, service_role;" >/dev/null
"${ADMIN[@]}" -d "$DB" -c "grant execute on function public.claim_next_automation_task(uuid,uuid,text,timestamptz,integer), public.complete_automation_task(uuid,uuid,text,timestamptz,jsonb) to \"$OWNER\";" >/dev/null 2>&1 || true

as_owner -f "$VERIFY" || die "verification checks failed"
pass "automation_runs/automation_tasks: creation, idempotence, dependency integrity, reclamation, chaining, persistence, and real RLS all verified against local PostgreSQL"

echo "ALL AUTO-05 POSTGRESQL CHECKS PASSED"
