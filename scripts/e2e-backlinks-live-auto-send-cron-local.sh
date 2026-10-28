#!/usr/bin/env bash
# LOCAL end-to-end test of the live auto-send cron (PR 2) on top of the production gate (PR 1).
#
# Runs the REAL route handler, services, repositories and SQL (migrations in order, V3 reservation
# included) against a throwaway PostgreSQL database reached only through a unix socket. The Supabase
# REST layer is answered in-process by a tiny PostgREST-compatible shim that executes the SQL through
# psql, and the email provider is simulated at the network boundary (the real Resend SDK talks to a
# fake api.resend.com). Every other outbound request is blocked and reported.
#
# No email, no Resend / Brave / OpenAI / Supabase call, no secret. Removes only what it created.
#
# Usage: PGSOCKET_DIR=/tmp PG_BIN=/usr/local/opt/postgresql@17/bin scripts/e2e-backlinks-live-auto-send-cron-local.sh
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
HELPERS="$REPO/scripts/backlink-production-gate-v3-verification.sql"
TEST_TS="$REPO/scripts/e2e-backlinks-live-auto-send-cron-local.ts"
[ -f "$HELPERS" ] && [ -f "$TEST_TS" ] || die "missing helper SQL or test file"
[ -x "$REPO/node_modules/.bin/tsx" ] || die "tsx not available locally (no install attempted)"

SUFFIX="$(date +%s)_$$"
PREFIX="e2e_cron_${SUFFIX}"
TPL="${PREFIX}_tpl"
OWNER="e2e_cron_owner_${SUFFIX}"
ADMIN=("$PG_BIN/psql" -h "$SOCK" -p "$PORT" -d postgres -v ON_ERROR_STOP=1 -X -q)
as_owner() { "$PG_BIN/psql" -h "$SOCK" -p "$PORT" -U "$OWNER" -d "$TPL" -v ON_ERROR_STOP=1 -X -q "$@"; }
cleanup() {
  for db in $("${ADMIN[@]}" -Atc "select datname from pg_database where starts_with(datname, '${PREFIX}_')" 2>/dev/null); do
    "$PG_BIN/dropdb" -h "$SOCK" -p "$PORT" --if-exists --force "$db" >/dev/null 2>&1 || true
  done
  "${ADMIN[@]}" -c "drop role if exists \"$OWNER\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for role in anon authenticated service_role; do
  [ "$("${ADMIN[@]}" -Atc "select count(*) from pg_roles where rolname='$role'")" = 1 ] || die "role $role missing on the local server"
done
"${ADMIN[@]}" -c "create role \"$OWNER\" login nosuperuser nocreatedb nocreaterole"
"${ADMIN[@]}" -c "create database \"$TPL\" owner \"$OWNER\""
"$PG_BIN/psql" -h "$SOCK" -p "$PORT" -d "$TPL" -v ON_ERROR_STOP=1 -X -q \
  -c "create schema if not exists extensions; create extension if not exists pgcrypto schema extensions; grant usage on schema extensions to \"$OWNER\""
as_owner <<'SQL'
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function auth.role() returns text language sql stable as $$ select null::text $$;
create table public.workspaces (id uuid primary key default gen_random_uuid(), name text);
create table public.workspace_members (workspace_id uuid, user_id uuid, role text);
create function public.is_workspace_member(uuid) returns boolean language sql as $$ select true $$;
create function public.is_workspace_admin_or_owner(uuid) returns boolean language sql as $$ select true $$;
create function public.is_workspace_owner(uuid) returns boolean language sql as $$ select true $$;
SQL
for f in $(ls "$MIG"/*.sql | sort); do
  name=$(basename "$f")
  case "$name" in 20261017120000_*) continue ;; esac
  if ! as_owner -f "$f" >/dev/null 2>&1; then
    if echo "$name" | grep -q -E "backlink|automation|outreach|contact_form|claim|dead_letter|discovery|brave|inbound"; then
      die "Backlinks / automation migration failed to apply: $name"
    fi
  fi
done
as_owner -v phase=none -f "$HELPERS" >/dev/null || die "could not install the fixture helpers"
# Optional mutation check: replace V3 by a deliberately weakened body to prove the scenarios detect it.
if [ -n "${E2E_V3_OVERRIDE_SQL:-}" ]; then
  [ -f "$E2E_V3_OVERRIDE_SQL" ] || die "E2E_V3_OVERRIDE_SQL does not exist"
  as_owner -f "$E2E_V3_OVERRIDE_SQL" >/dev/null || die "could not install the override SQL"
  echo "MUTATION ACTIVE: V3 replaced by $E2E_V3_OVERRIDE_SQL"
fi
pass "template database $TPL built (migrations in order, V3 included, fixture helpers installed)"

export E2E_PG_BIN="$PG_BIN" E2E_PG_SOCKET="$SOCK" E2E_PG_PORT="$PORT" E2E_PG_OWNER="$OWNER" E2E_PG_TEMPLATE="$TPL" E2E_DB_PREFIX="$PREFIX"
cd "$REPO"
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" E2E_PG_BIN="$PG_BIN" E2E_PG_SOCKET="$SOCK" E2E_PG_PORT="$PORT" \
  E2E_PG_OWNER="$OWNER" E2E_PG_TEMPLATE="$TPL" E2E_DB_PREFIX="$PREFIX" \
  ./node_modules/.bin/tsx "$TEST_TS"
