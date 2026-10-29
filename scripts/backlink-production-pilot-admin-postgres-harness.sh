#!/usr/bin/env bash
# Disposable PostgreSQL 17 harness for the V3 pilot-admin control only.
set -euo pipefail
umask 077
export LC_ALL=C LANG=C
unset DATABASE_URL LOCAL_DB_URL PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGDATABASE PGUSER PGPORT PGPASSWORD PGPASSFILE PGOPTIONS PGSSLMODE

die() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }
PG_BIN="${PG_BIN:-/usr/lib/postgresql/17/bin}"
SOCK="${PGSOCKET_DIR:?PGSOCKET_DIR is required}"
PORT="${PGPORT_NUM:-5432}"
REPO=$(cd "$(dirname "$0")/.." && pwd -P)
MIG="$REPO/supabase/migrations"
VERIFY="$REPO/scripts/backlink-production-pilot-admin-verification.sql"
[ -S "$SOCK/.s.PGSQL.$PORT" ] || die "private PostgreSQL socket unavailable"
for bin in psql createdb dropdb; do [ -x "$PG_BIN/$bin" ] || die "missing $PG_BIN/$bin"; done
[ -f "$VERIFY" ] || die "verification SQL missing"

suffix="$(date +%s)_$$"
db="pilot_admin_${suffix}"
owner="pilot_admin_owner_${suffix}"
admin=("$PG_BIN/psql" -h "$SOCK" -p "$PORT" -d postgres -X -q -v ON_ERROR_STOP=1)
as_owner() { "$PG_BIN/psql" -h "$SOCK" -p "$PORT" -U "$owner" -d "$db" -X -q -v ON_ERROR_STOP=1 "$@"; }
cleanup() {
  "$PG_BIN/dropdb" -h "$SOCK" -p "$PORT" --if-exists --force "$db" >/dev/null 2>&1 || true
  "${admin[@]}" -c "drop role if exists \"$owner\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for role in anon authenticated service_role; do
  [ "$("${admin[@]}" -Atc "select count(*) from pg_roles where rolname='$role'")" = 1 ] || die "role $role missing"
done
"${admin[@]}" -c "create role \"$owner\" login nosuperuser nocreatedb nocreaterole noinherit"
"${admin[@]}" -c "grant service_role, authenticated to \"$owner\""
"${admin[@]}" -c "create database \"$db\" owner \"$owner\""
"$PG_BIN/psql" -h "$SOCK" -p "$PORT" -d "$db" -X -q -v ON_ERROR_STOP=1 -c "create schema extensions; create extension pgcrypto schema extensions; grant usage on schema extensions to \"$owner\""

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

applied=0
for file in $(ls "$MIG"/*.sql | sort); do
  name=$(basename "$file")
  case "$name" in 20261017120000_*) continue ;; esac
  if ! as_owner -f "$file" >/dev/null 2>&1; then
    if echo "$name" | grep -qE 'backlink|automation|outreach|contact_form|discovery|brave|inbound|pilot'; then
      as_owner -f "$file" 2>&1 | head -20 >&2 || true
      die "required migration failed: $name"
    fi
  else
    applied=$((applied + 1))
  fi
done
pass "isolated database and $applied migrations (20261017120000 excluded)"

as_owner -f "$VERIFY" | tee "/tmp/pilot-admin-verify.$$"
grep -q 'PILOT ADMIN SCENARIOS OK' "/tmp/pilot-admin-verify.$$" || die "scenario failure"
rm -f "/tmp/pilot-admin-verify.$$"
pass "pilot-admin scenarios"

# Two independent sessions race to approve the same candidate. The shared advisory
# lock permits one approval and makes the second an idempotent observation.
sql="select disposition from approve_backlink_production_pilot_eligibility((select ws from tt.concurrent),(select contact from tt.concurrent),(select opportunity from tt.concurrent),(select actor from tt.concurrent),'https://source.local/concurrent','Reason long enough for concurrent audit.');"
as_owner -Atc "$sql" >"/tmp/pilot-admin-race-a.$$" & first=$!
as_owner -Atc "$sql" >"/tmp/pilot-admin-race-b.$$" & second=$!
wait "$first"; wait "$second"
race="$(cat /tmp/pilot-admin-race-a.$$ /tmp/pilot-admin-race-b.$$ | sort | tr '\n' ',')"
rm -f "/tmp/pilot-admin-race-a.$$" "/tmp/pilot-admin-race-b.$$"
case "$race" in *approved,*already_approved,*|*already_approved,*approved,*) ;; *) die "concurrent approval unexpected: $race";; esac
pass "concurrency: two PostgreSQL sessions serialize pilot approval"

# Race approval against a prepared follow-up request. Exactly one branch may win:
# pilot approved with follow-up still prepared, or follow-up requested with no pilot.
approve_sql="select disposition from approve_backlink_production_pilot_eligibility((select ws from tt.follow_race),(select contact from tt.follow_race),(select opportunity from tt.follow_race),(select actor from tt.follow_race),'https://source.local/follow-race','Reason long enough for race audit.');"
follow_sql="select disposition from mark_backlink_outreach_follow_up_attempt_requested((select ws from tt.follow_race),(select follow_outreach from tt.follow_race),(select follow_attempt from tt.follow_race),(select actor from tt.follow_race),now());"
(as_owner -Atc "$approve_sql" >/tmp/pilot-admin-race-approve.$$ 2>&1 || true) & first=$!
(as_owner -Atc "$follow_sql" >/tmp/pilot-admin-race-follow.$$ 2>&1 || true) & second=$!
wait "$first"; wait "$second"
state=$(as_owner -Atc "select (select count(*) from backlink_production_eligibility where workspace_id=(select ws from tt.follow_race) and status='approved') || ':' || (select status from backlink_outreach_attempts where id=(select follow_attempt from tt.follow_race));")
rm -f "/tmp/pilot-admin-race-approve.$$" "/tmp/pilot-admin-race-follow.$$"
case "$state" in '1:prepared'|'0:requested') ;; *) die "approval/follow-up race unsafe state: $state";; esac
pass "concurrency: approval and follow-up request are mutually exclusive"
echo "ALL PILOT ADMIN POSTGRESQL CHECKS PASSED"
