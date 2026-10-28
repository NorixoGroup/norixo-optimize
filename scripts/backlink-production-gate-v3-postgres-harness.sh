#!/usr/bin/env bash
# PostgreSQL gate — production eligibility gate V3 (migration 20261028090000).
#
# Builds a throwaway DATABASE (unique name, dedicated NON-superuser owner role) on a LOCAL PostgreSQL
# server reached only through a unix socket, applies the repository migrations in order on top of
# minimal Supabase-like stubs (auth schema, workspaces, pgcrypto in "extensions"), then runs
# scripts/backlink-production-gate-v3-verification.sql (refusals, latest/fresh mailbox verification,
# idempotent replay) and a 16-client race (same key, distinct keys, two outreach sharing one recipient).
# It never connects to Supabase or to any TCP host, never calls Resend / Brave / OpenAI, and removes
# only the database and role it created.
#
# Migration 20261017120000 (manual discovery test, intentionally not applied in production, creates a
# role) is skipped. Failures of unrelated, pre-Backlinks migrations (they assume Supabase base tables)
# are tolerated; a failure in any Backlinks / automation migration aborts the run.
#
# Usage: PGSOCKET_DIR=/tmp PG_BIN=/usr/local/opt/postgresql@17/bin scripts/backlink-production-gate-v3-postgres-harness.sh
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
for bin in psql createdb dropdb pgbench; do [ -x "$PG_BIN/$bin" ] || die "missing $PG_BIN/$bin"; done

REPO=$(cd "$(dirname "$0")/.." && pwd -P)
MIG="$REPO/supabase/migrations"
GATE="$MIG/20261028090000_add_backlink_production_eligibility_gate.sql"
TESTS="$REPO/scripts/backlink-production-gate-v3-verification.sql"
[ -f "$GATE" ] && [ -f "$TESTS" ] || die "missing gate migration or verification SQL"

SUFFIX="$(date +%s)_$$"
DB="prodgate_v3_${SUFFIX}"
OWNER="prodgate_owner_${SUFFIX}"
ADMIN=("$PG_BIN/psql" -h "$SOCK" -p "$PORT" -d postgres -v ON_ERROR_STOP=1 -X -q)
as_owner() { "$PG_BIN/psql" -h "$SOCK" -p "$PORT" -U "$OWNER" -d "$DB" -v ON_ERROR_STOP=1 -X -q "$@"; }
TMPFILES=()
cleanup() {
  for f in "${TMPFILES[@]:-}"; do [ -n "$f" ] && rm -f "$f"; done
  "$PG_BIN/dropdb" -h "$SOCK" -p "$PORT" --if-exists --force "$DB" >/dev/null 2>&1 || true
  "${ADMIN[@]}" -c "drop role if exists \"$OWNER\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for role in anon authenticated service_role; do
  [ "$("${ADMIN[@]}" -Atc "select count(*) from pg_roles where rolname='$role'")" = 1 ] || die "role $role missing on the local server"
done
"${ADMIN[@]}" -c "create role \"$OWNER\" login nosuperuser nocreatedb nocreaterole"
"${ADMIN[@]}" -c "create database \"$DB\" owner \"$OWNER\""
"$PG_BIN/psql" -h "$SOCK" -p "$PORT" -d "$DB" -v ON_ERROR_STOP=1 -X -q \
  -c "create schema if not exists extensions; create extension if not exists pgcrypto schema extensions; grant usage on schema extensions to \"$OWNER\""
[ "$("${ADMIN[@]}" -Atc "select rolsuper from pg_roles where rolname='$OWNER'")" = f ] || die "owner must not be a superuser"
pass "throwaway database $DB owned by non-superuser $OWNER"

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

APPLIED=0; TOLERATED=0
for f in $(ls "$MIG"/*.sql | sort); do
  name=$(basename "$f")
  case "$name" in 20261017120000_*) continue ;; esac
  if as_owner -f "$f" >/dev/null 2>/dev/null; then
    APPLIED=$((APPLIED + 1))
  else
    if echo "$name" | grep -q -E "backlink|automation|outreach|contact_form|claim|dead_letter|discovery|brave|inbound"; then
      as_owner -f "$f" 2>&1 | head -5 >&2 || true
      die "Backlinks / automation migration failed to apply: $name"
    fi
    TOLERATED=$((TOLERATED + 1))
  fi
done
for fn in reserve_backlink_approved_initial_attempt_v2 reserve_backlink_approved_initial_attempt_v3; do
  [ "$("${ADMIN[@]}" -d "$DB" -Atc "select count(*) from pg_proc where proname='$fn'")" = 1 ] || die "$fn missing after migrations"
done
pass "migrations applied ($APPLIED ok, $TOLERATED unrelated base-table failures tolerated, 20261017120000 skipped)"

as_owner -v phase=scenarios -f "$TESTS" | tee /tmp/.prodgate_scn.$$ >/dev/null || die "scenario run errored"
TMPFILES+=("/tmp/.prodgate_scn.$$")
grep -E ":: (PASS|FAIL)|TOTAL" /tmp/.prodgate_scn.$$ | sed -n '1,200p' | grep -E ":: FAIL|TOTAL" || true
grep -q "SCENARIOS OK" /tmp/.prodgate_scn.$$ || die "scenario checks failed (see FAIL lines above)"
pass "scenarios: refusals, latest and fresh mailbox verification, gated non-terminal replay"

# Concurrency: 16 clients
as_owner -v phase=concurrency_setup -f "$TESTS" >/dev/null
SAME=$(mktemp "${TMPDIR:-/tmp}/prodgate-same.XXXXXX"); DIST=$(mktemp "${TMPDIR:-/tmp}/prodgate-dist.XXXXXX"); TMPFILES+=("$SAME" "$DIST")
printf "select tt.race('A', 'same_key', 'shared-key-1');\n" > "$SAME"
printf "\\\\set k random(1, 1000000000)\n\\\\set t random(1, 2)\nselect tt.race('B' || :t, 'distinct_keys', 'dk-' || :k);\n" > "$DIST"
"$PG_BIN/pgbench" -h "$SOCK" -p "$PORT" -U "$OWNER" -d "$DB" -n -f "$SAME" -c 16 -j 4 -t 1 >/dev/null 2>&1 || die "pgbench (same key) failed"
"$PG_BIN/pgbench" -h "$SOCK" -p "$PORT" -U "$OWNER" -d "$DB" -n -f "$DIST" -c 16 -j 4 -t 1 >/dev/null 2>&1 || die "pgbench (distinct keys) failed"
as_owner -v phase=concurrency_assert -f "$TESTS" | grep -q "CONCURRENCY OK" || die "concurrency assertion failed (duplicate reservation)"
pass "concurrency: 16 clients with one key give one attempt; 16 clients with distinct keys and a shared recipient give exactly one reservation"

echo "ALL V3 POSTGRESQL CHECKS PASSED"
