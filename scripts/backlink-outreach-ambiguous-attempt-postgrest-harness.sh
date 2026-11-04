#!/usr/bin/env bash
# G4-M4 — validates the G4-M3 ambiguous-attempt query against a REAL PostgREST on a throwaway local PostgreSQL.
#
# Isolation: private PostgreSQL cluster in a unique temporary directory, unix socket only (listen_addresses=''),
# PostgREST bound to 127.0.0.1 only, synthetic fixtures, read-only DB role, minimal environment (env -i):
# no Supabase/Resend/Brave variable is ever inherited. Cleanup removes only the directory this run created.
#
# Required: PGRST_BIN (absolute path to a PostgREST binary). Optional: PG_BIN (default PostgreSQL 17),
# HARNESS_TSX (tsx binary, default `npx tsx`), HARNESS_NODE_PATH (node_modules dir when the worktree has none).
set -euo pipefail
umask 077
export LC_ALL=C LANG=C
die() { echo "FAIL: $*" >&2; exit 1; }

[ "$(id -u)" != 0 ] || die "refusing to run as root"
PG_BIN="${PG_BIN:-/usr/local/opt/postgresql@17/bin}"
PGRST_BIN="${PGRST_BIN:-}"
case "$PGRST_BIN" in /*) ;; *) die "PGRST_BIN must be an absolute path" ;; esac
[ -x "$PGRST_BIN" ] || die "PostgREST binary not executable: $PGRST_BIN"
for b in initdb pg_ctl postgres psql; do [ -x "$PG_BIN/$b" ] || die "missing $PG_BIN/$b"; done
case "$("$PG_BIN/postgres" --version)" in "postgres (PostgreSQL) 17."*) ;; *) die "PG_BIN is not PostgreSQL 17" ;; esac

TMP_BASE="${TMPDIR:-/tmp}"
[ -d "$TMP_BASE" ] && [ -w "$TMP_BASE" ] && [ -x "$TMP_BASE" ] || die "temporary directory is not usable: $TMP_BASE"
AVAIL_KB=$(df -Pk "$TMP_BASE" | awk 'NR==2 {print $4}')
[ -n "$AVAIL_KB" ] && [ "$AVAIL_KB" -eq "$AVAIL_KB" ] 2>/dev/null || die "unable to determine free space in $TMP_BASE"
[ "$AVAIL_KB" -gt 1048576 ] || die "less than 1 GiB free disk space ($AVAIL_KB KiB); aborting"

REPO=$(cd "$(dirname "$0")/.." && pwd -P)
FIXTURES="$REPO/scripts/backlink-outreach-ambiguous-attempt-postgrest-fixtures.sql"
TEST_TS="$REPO/scripts/backlink-outreach-ambiguous-attempt-postgrest-integration.ts"
[ -f "$FIXTURES" ] && [ -f "$TEST_TS" ] || die "fixtures or test missing"

ROOT_PREFIX="$TMP_BASE/norixo-g4m4-pg"
ROOT=$(mktemp -d "$ROOT_PREFIX.XXXXXX")
case "$ROOT" in "$ROOT_PREFIX".??????) ;; *) die "unexpected temp path $ROOT" ;; esac
NONCE="$$-$RANDOM-$RANDOM"; printf '%s\n' "$NONCE" >"$ROOT/.owner"
DATA="$ROOT/data"; SOCK="$ROOT/sock"; mkdir -m 700 "$DATA" "$SOCK"
PG_PORT=55460
REST_PORT=$(( 55470 + RANDOM % 100 ))
JWT_SECRET="g4m4-synthetic-local-jwt-secret-not-for-production"
STARTED=0; PGRST_PID=""

cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  [ -z "$PGRST_PID" ] || { kill "$PGRST_PID" 2>/dev/null || true; wait "$PGRST_PID" 2>/dev/null || true; }
  [ "$STARTED" != 1 ] || "$PG_BIN/pg_ctl" -D "$DATA" -m immediate -w stop >/dev/null 2>&1 || true
  if [ "$(cat "$ROOT/.owner" 2>/dev/null)" = "$NONCE" ] && [ ! -f "$DATA/postmaster.pid" ]; then
    if [ "$rc" != 0 ]; then mkdir -p "$TMP_BASE/norixo-g4m4-logs" && cp -f "$ROOT"/*.log "$TMP_BASE/norixo-g4m4-logs/" 2>/dev/null || true; fi
    rm -rf -- "$ROOT"
  else
    echo "WARNING: $ROOT left in place (cluster not confirmed stopped)" >&2
  fi
  exit "$rc"
}
trap cleanup EXIT INT TERM

CLEAN_ENV=(env -i HOME="$ROOT" PATH="/usr/bin:/bin:/usr/sbin:/sbin")
PSQL=("${CLEAN_ENV[@]}" "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PG_PORT" -U postgres)

"${CLEAN_ENV[@]}" "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust --encoding=UTF8 --locale=C >"$ROOT/initdb.log" 2>&1
"${CLEAN_ENV[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -w -l "$ROOT/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$SOCK' -c port=$PG_PORT -c fsync=off" start >/dev/null
STARTED=1
"${PSQL[@]}" -d postgres -c "create database g4m4" -c "create role authenticator login noinherit" >/dev/null
PSQL=("${PSQL[@]}" -d g4m4)
"${PSQL[@]}" -f "$FIXTURES"
"${PSQL[@]}" -c "grant web_anon to authenticator"
echo "PASS: throwaway PostgreSQL 17 ready (unix socket only)"

before=$("${PSQL[@]}" -At -c "select md5(string_agg(t::text, '|' order by id)) from public.backlink_outreach_attempts t")
rows=$("${PSQL[@]}" -At -c "select count(*) from public.backlink_outreach_attempts")

"${CLEAN_ENV[@]}" \
  PGRST_DB_URI="postgresql://authenticator@/g4m4?host=$SOCK&port=$PG_PORT" \
  PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=web_anon \
  PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_ROOT_PATH=/rest/v1 \
  PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT="$REST_PORT" PGRST_LOG_LEVEL=info \
  "$PGRST_BIN" >"$ROOT/postgrest.log" 2>&1 &
PGRST_PID=$!
ready=0
for _ in $(seq 1 50); do
  if /usr/bin/curl -fsS -o /dev/null "http://127.0.0.1:$REST_PORT/rest/v1/backlink_outreach_attempts?limit=1"; then ready=1; break; fi
  kill -0 "$PGRST_PID" 2>/dev/null || { cat "$ROOT/postgrest.log" >&2; die "PostgREST exited early"; }
  sleep 0.2
done
[ "$ready" = 1 ] || { cat "$ROOT/postgrest.log" >&2; die "PostgREST did not become ready"; }
echo "PASS: PostgREST $("$PGRST_BIN" --version) listening on 127.0.0.1:$REST_PORT"
: >"$ROOT/postgrest.log.mark"

TSX=(${HARNESS_TSX:-npx tsx})
"${CLEAN_ENV[@]}" NODE_PATH="${HARNESS_NODE_PATH:-}" POSTGREST_URL="http://127.0.0.1:$REST_PORT" G4M4_JWT_SECRET="$JWT_SECRET" \
  PATH="$PATH" "${TSX[@]}" "$TEST_TS"

after=$("${PSQL[@]}" -At -c "select md5(string_agg(t::text, '|' order by id)) from public.backlink_outreach_attempts t")
rows_after=$("${PSQL[@]}" -At -c "select count(*) from public.backlink_outreach_attempts")
[ "$before" = "$after" ] && [ "$rows" = "$rows_after" ] || die "table content changed (before=$before after=$after)"
echo "PASS: table unchanged ($rows rows, md5 $after)"

sleep 0.3
writes=$(grep -E '"(POST|PATCH|PUT|DELETE) ' "$ROOT/postgrest.log" || true)
[ "$(printf '%s' "$writes" | grep -c . || true)" = 1 ] && printf '%s' "$writes" | grep -q '"PATCH ' \
  || { echo "$writes" >&2; die "unexpected non-GET requests (expected exactly the rejected PATCH negative control)"; }
echo "PASS: only non-GET request was the rejected PATCH negative control"
echo "--- sample PostgREST request lines (query string as received) ---"
grep '"GET /rest/v1/backlink_outreach_attempts?select=' "$ROOT/postgrest.log" | grep -m1 'limit=201' | sed 's/%2C/,/g' | cut -c1-400 || true
echo "G4-M4 HARNESS: OK"
