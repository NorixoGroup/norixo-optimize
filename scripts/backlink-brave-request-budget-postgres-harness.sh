#!/usr/bin/env bash
# Gate PostgreSQL 1 — P1b Brave request budget (migration 20261012120000).
#
# Builds a throwaway PostgreSQL 17 cluster in a unique /tmp directory, reachable only through a
# private unix socket (no TCP listener), applies the P1b migration as a dedicated NON-superuser owner
# (the bootstrap superuser `postgres` only administers the cluster), and verifies:
#   - the migration role and function owner are not superusers (rolsuper = false);
#   - Supabase-like roles and default privileges, then the migration's revokes/grants
#     (service_role keeps SELECT only: no INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN);
#   - the 80-request cap, the rolling 30-day window and idempotent replay
#     (reuses PART 1 of scripts/backlink-brave-request-budget-verification.sql, read-only);
#   - real concurrency (pgbench: 200 distinct keys -> 80 reserved; 100 same-key calls -> 1 reserved);
#   - a deterministic lock-boundary race (the 80th/81st reservation in two live sessions);
#   - negative controls: four weakened copies of the migration (no lock, off-by-one cap, no service_role
#     revoke, partial service_role revoke) must each be detected.
# Never touches any other PostgreSQL server (e.g. the PostgreSQL 16 service): every connection goes
# to the private socket, libpq environment is cleared, and the cluster identity is checked first.
# Cleanup removes only the directory this run created, after stopping only the cluster it started.
set -euo pipefail
umask 077

# Deterministic locale: pg_controldata, initdb, pg_ctl and the server translate their messages and
# labels according to the terminal language, and this script parses English output.
export LC_ALL=C
export LANG=C
unset LANGUAGE

die() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

[ "$(id -u)" != 0 ] || die "refusing to run as root"

PG_BIN="${PG_BIN:-/usr/local/opt/postgresql@17/bin}"
case "$PG_BIN" in
  /*) ;;
  *) echo "PG_BIN must be an absolute local PostgreSQL binary directory." >&2; exit 64 ;;
esac
case "$PG_BIN" in
  *postgresql@16*) echo "PG_BIN points at PostgreSQL 16; this harness requires PostgreSQL 17." >&2; exit 64 ;;
esac
for bin in initdb pg_ctl pg_controldata postgres psql pgbench; do
  if [ ! -x "$PG_BIN/$bin" ]; then
    echo "Missing PostgreSQL binary: $PG_BIN/$bin" >&2
    exit 64
  fi
done
case "$("$PG_BIN/postgres" --version)" in
  "postgres (PostgreSQL) 17."*) ;;
  *) echo "PG_BIN is not PostgreSQL 17: $("$PG_BIN/postgres" --version)" >&2; exit 64 ;;
esac

# This harness must never inherit a libpq service, host, database, or password.
unset DATABASE_URL LOCAL_DB_URL PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGDATABASE PGUSER PGPORT PGPASSWORD PGPASSFILE
unset PGCONNECT_TIMEOUT PGOPTIONS PGSSLMODE PGSSLROOTCERT PGSSLCERT PGSSLKEY PGSSLCRL PGREQUIRESSL
unset PGTARGETSESSIONATTRS PGLOADBALANCEHOSTS PGCHANNELBINDING PGGSSENCMODE PGAPPNAME PGCLIENTENCODING PGDATA

REPO=$(cd "$(dirname "$0")/.." && pwd -P)
MIGRATION="$REPO/supabase/migrations/20261012120000_add_backlink_brave_request_budget.sql"
VERIFY_SQL="$REPO/scripts/backlink-brave-request-budget-verification.sql"
[ -f "$MIGRATION" ] || die "migration not found: $MIGRATION"
[ -f "$VERIFY_SQL" ] || die "verification SQL not found: $VERIFY_SQL"
MIGRATION_SHA=$(shasum -a 256 "$MIGRATION" | cut -d' ' -f1)
VERIFY_SHA=$(shasum -a 256 "$VERIFY_SQL" | cut -d' ' -f1)

ROOT_PREFIX=/tmp/norixo-brave-budget-pg
LOGS_PREFIX=/tmp/norixo-brave-budget-pg-logs
ROOT=$(mktemp -d "$ROOT_PREFIX.XXXXXX")
case "$ROOT" in "$ROOT_PREFIX".??????) ;; *) echo "Unexpected temporary cluster path: $ROOT" >&2; exit 64 ;; esac
NONCE="$$-$RANDOM-$RANDOM"
printf '%s\n' "$NONCE" >"$ROOT/.norixo-harness-owner"
DATA="$ROOT/data"; SOCKET="$ROOT/socket"; PORT=55442; STARTED=0
mkdir -m 700 "$DATA" "$SOCKET"
DATA_REAL=$(cd "$DATA" && pwd -P)

# preserve_logs RC — after a failed run, with the cluster confirmed stopped: copies the run's own
# top-level log/diagnostic files (never the data directory or socket) into a new private (0700)
# directory. They hold only server/psql/pgbench output and the SQL this harness generated; no
# environment variables and no credentials are ever written to them (auth is trust, socket only).
preserve_logs() {
  local dest f
  dest=$(mktemp -d "$LOGS_PREFIX.XXXXXX" 2>/dev/null) || return 1
  case "$dest" in "$LOGS_PREFIX".??????) ;; *) return 1 ;; esac
  chmod 700 "$dest" || return 1
  for f in "$ROOT"/*; do
    if [ -f "$f" ] && [ ! -L "$f" ]; then cp -- "$f" "$dest/" || return 1; fi
  done
  echo "Harness failed (exit $1): logs preserved in $dest" >&2
  return 0
}

# cluster_stop_confirmed — true only if this run's cluster is provably down: no postmaster.pid in its
# own data directory AND `pg_ctl status` on that directory exits 3 ("no server running"). Any other
# status (0 running, 4 unreadable data directory) is NOT a confirmation.
cluster_stop_confirmed() {
  local st=0
  [ ! -f "$DATA/postmaster.pid" ] || return 1
  "$PG_BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1 || st=$?
  [ "$st" = 3 ]
}

cleanup() {
  local rc=$? pids pid_dir
  trap - EXIT INT TERM
  pids=$(jobs -p 2>/dev/null || true)
  if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; wait 2>/dev/null || true; fi
  if [ "$STARTED" = 1 ] && [ -f "$DATA/postmaster.pid" ]; then
    pid_dir=$(sed -n 2p "$DATA/postmaster.pid")
    if [ "$(cd "$pid_dir" 2>/dev/null && pwd -P)" = "$DATA_REAL" ]; then
      "$PG_BIN/pg_ctl" -D "$DATA" -m immediate -w stop >/dev/null 2>&1 || true
    else
      echo "INCIDENT: postmaster.pid points at $pid_dir, not at this run's data directory; no server was stopped and $ROOT is left untouched." >&2
      [ "$rc" != 0 ] || rc=70
      exit "$rc"
    fi
  fi
  if [ "$STARTED" = 1 ] && ! cluster_stop_confirmed; then
    echo "INCIDENT: could not confirm that this run's cluster stopped; data files are NOT deleted, $ROOT is left in place (stop it by hand with pg_ctl -D '$DATA' -m immediate stop)." >&2
    [ "$rc" != 0 ] || rc=70
  elif [ "$(cat "$ROOT/.norixo-harness-owner" 2>/dev/null)" = "$NONCE" ]; then
    case "$ROOT" in
      "$ROOT_PREFIX".??????)
        if [ "$rc" != 0 ] && ! preserve_logs "$rc"; then
          echo "Could not preserve the logs; the cluster is stopped and $ROOT is left in place." >&2
        elif rm -rf -- "$ROOT"; then
          if [ "$rc" != 0 ]; then
            if [ "$STARTED" = 1 ]; then
              echo "Cluster stopped; temporary data directory $ROOT removed." >&2
            else
              echo "Temporary data directory $ROOT removed." >&2
            fi
          fi
        else
          echo "INCIDENT: the cluster is stopped but removing $ROOT failed; remove it by hand after checking its contents." >&2
        fi
        ;;
    esac
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"$PG_BIN/initdb" -U postgres --auth-local=trust --auth-host=reject --no-locale --encoding=UTF8 -D "$DATA" >"$ROOT/initdb.log"
EXPECTED_SYSID=$("$PG_BIN/pg_controldata" "$DATA" | sed -n 's/^Database system identifier: *//p')
[ -n "$EXPECTED_SYSID" ] || die "could not read the new cluster's system identifier"
[ ! -e "$SOCKET/.s.PGSQL.$PORT" ] || die "socket already exists in the private directory"
STARTED=1
"$PG_BIN/pg_ctl" -D "$DATA" -l "$ROOT/server.log" -w \
  -o "-h '' -k '$SOCKET' -p $PORT -c unix_socket_permissions=0700 -c fsync=off" start >/dev/null

# q DB [psql args...]          — superuser session on the private socket only.
# qa DB APP [psql args...]     — same, tagged with application_name APP.
q() { local db=$1; shift; "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$SOCKET" -p "$PORT" -U postgres -d "dbname=$db application_name=norixo-brave-harness" "$@"; }
qa() { local db=$1 app=$2; shift 2; "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$SOCKET" -p "$PORT" -U postgres -d "dbname=$db application_name=$app" "$@"; }

# The cluster must be exactly the one initdb just created, before any other SQL is sent.
assert_cluster_identity() {
  local out sysid ddir ver listen sockdir port addr
  out=$(q postgres -At -F'|' -c "select system_identifier, current_setting('data_directory'), current_setting('server_version_num'), current_setting('listen_addresses'), current_setting('unix_socket_directories'), current_setting('port'), coalesce(host(inet_server_addr()),'unix-socket') from pg_control_system()")
  IFS='|' read -r sysid ddir ver listen sockdir port addr <<<"$out"
  [ "$sysid" = "$EXPECTED_SYSID" ] || die "system identifier mismatch ($sysid != $EXPECTED_SYSID)"
  [ "$(cd "$ddir" 2>/dev/null && pwd -P)" = "$DATA_REAL" ] || die "data_directory mismatch ($ddir)"
  case "$ver" in 17????) ;; *) die "server is not PostgreSQL 17 ($ver)" ;; esac
  [ -z "$listen" ] || die "TCP listen_addresses must be empty (got '$listen')"
  [ "$sockdir" = "$SOCKET" ] || die "unix_socket_directories mismatch ($sockdir)"
  [ "$port" = "$PORT" ] || die "port mismatch ($port)"
  [ "$addr" = unix-socket ] || die "connection is not over the private unix socket ($addr)"
}
assert_cluster_identity
pass "cluster identity: PostgreSQL 17, sysid $EXPECTED_SYSID, $DATA_REAL, socket only"

# expect DB "<sql returning one value>" "<expected>" "<label>"
expect() {
  local got
  got=$(q "$1" -At -c "$2")
  [ "$got" = "$3" ] || die "$4: expected '$3', got '$got'"
  pass "$4"
}
# wait_for DB "<sql returning t/f>" "<label>"
wait_for() {
  local i
  for i in $(seq 1 100); do
    [ "$(q "$1" -At -c "$2")" = t ] && return 0
    sleep 0.1
  done
  die "timeout waiting for: $3"
}

# Supabase-like roles (cluster-wide). service_role bypasses RLS on Supabase.
q postgres <<'SQL'
create role anon nologin noinherit nobypassrls;
create role authenticated nologin noinherit nobypassrls;
create role service_role nologin noinherit bypassrls;
SQL

# The migration is applied by a dedicated NON-superuser owner, like Supabase's `postgres` role (which
# is not a superuser). The bootstrap superuser `postgres` only administers this throwaway cluster.
# The owner gets no extra attribute: it can log in, owns each database created below, and therefore
# (PostgreSQL 15+: public is owned by pg_database_owner) can create objects in schema public.
OWNER=brave_migration_owner
q postgres -c "create role $OWNER login nosuperuser nocreatedb nocreaterole noinherit nobypassrls noreplication"

# new_db NAME — a fresh database owned by $OWNER with Supabase's public-schema grants and default
# privileges (for objects created by $OWNER), so the migration's revokes are tested against the
# privileges Supabase would really grant.
new_db() {
  assert_cluster_identity
  q postgres -c "create database $1 owner $OWNER"
  q "$1" <<SQL
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role $OWNER in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role $OWNER in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role $OWNER in schema public grant all on functions to anon, authenticated, service_role;
SQL
}

# apply_migration DB FILE — runs FILE as $OWNER over the private socket. In the same psql session,
# before FILE, it proves the effective role: session_user = current_user = $OWNER, and that role is
# neither a superuser nor able to bypass RLS (the session also reports is_superuser = off).
apply_migration() {
  local db=$1 file=$2
  cat >"$ROOT/migration-role-check.sql" <<SQL
do \$check\$
begin
  if session_user <> current_user or current_user <> '$OWNER' then
    raise exception 'wrong migration role: session_user=%, current_user=%', session_user, current_user;
  end if;
  if exists (select 1 from pg_roles where rolname = current_user and (rolsuper or rolbypassrls)) then
    raise exception 'the migration role must not be a superuser nor bypass RLS';
  end if;
  if current_setting('is_superuser') <> 'off' then
    raise exception 'the session reports is_superuser = on';
  end if;
end
\$check\$;
SQL
  "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$SOCKET" -p "$PORT" -U "$OWNER" \
    -d "dbname=$db application_name=norixo-brave-harness-migration" \
    -f "$ROOT/migration-role-check.sql" -f "$file"
}

LEDGER=public.backlink_brave_request_reservations
RESERVE=public.reserve_backlink_brave_request

# Structural checks on an applied migration.
check_structure() {
  local db=$1
  expect "$db" "select pg_get_function_result('$RESERVE(uuid,uuid,text)'::regprocedure)" \
    "TABLE(reservation_outcome text, reservation_id uuid, window_used integer)" "$db: function signature"
  expect "$db" "select prosecdef and proconfig @> array['search_path=public, pg_temp'] and pg_get_userbyid(proowner)='$OWNER' from pg_proc where oid='$RESERVE(uuid,uuid,text)'::regprocedure" \
    "t" "$db: SECURITY DEFINER, pinned search_path, owned by $OWNER"
  expect "$db" "select o.rolname || '/' || o.rolsuper || '/' || o.rolbypassrls from pg_proc p join pg_roles o on o.oid = p.proowner where p.oid='$RESERVE(uuid,uuid,text)'::regprocedure" \
    "$OWNER/false/false" "$db: function owner is a non-superuser without BYPASSRLS (rolsuper = false)"
  expect "$db" "select o.rolname || '/' || o.rolsuper from pg_class c join pg_roles o on o.oid = c.relowner where c.oid='$LEDGER'::regclass" \
    "$OWNER/false" "$db: ledger owned by the same non-superuser"
  expect "$db" "select relrowsecurity::text || '/' || (select count(*) from pg_policy where polrelid='$LEDGER'::regclass) from pg_class where oid='$LEDGER'::regclass" \
    "true/0" "$db: RLS enabled, no policies"
}

# PART 1 of the verification SQL: cap, global scope, replay, validation, rolling window,
# privileges and isolation guard. Every write there is rolled back.
run_part1() {
  PGOPTIONS='-c brave_budget_verify.disposable=yes' q "$1" -f "$VERIFY_SQL" >"$ROOT/$1-part1.log" 2>&1
}

# Real concurrency through pgbench, connected as service_role like the application.
run_pgbench() {
  local db=$1 clients=$2 tx=$3 file=$4
  if ! PGOPTIONS='-c role=service_role' "$PG_BIN/pgbench" -h "$SOCKET" -p "$PORT" -U postgres \
    -n -c "$clients" -j 4 -t "$tx" -f "$file" "$db" >"$file.log" 2>&1; then
    tail -n 20 "$file.log" >&2
    die "$db: pgbench failed (a client aborted; see the log tail above)"
  fi
}
# First command of every pgbench script, run inside each pgbench connection before the reservation:
# the connection is a superuser login narrowed with PGOPTIONS role=service_role, so if that setting
# were ignored the reservation would still succeed. This aborts the pgbench client instead.
pgbench_role_guard() {
  cat <<'SQL'
do $chk$ begin if current_user::text <> 'service_role' then raise exception 'pgbench session is not running as service_role (current_user=%)', current_user; end if; end $chk$;
SQL
}
concurrency_tests() {
  local db=$1
  assert_cluster_identity
  # executed_as records current_user of each pgbench insert, so the harness re-checks the role afterwards.
  q "$db" -c "truncate $LEDGER; create table public.brave_budget_verify_outcomes (outcome text not null, executed_as name not null default current_user); grant insert, select on public.brave_budget_verify_outcomes to service_role"
  { pgbench_role_guard; cat <<SQL
insert into public.brave_budget_verify_outcomes (outcome)
select reservation_outcome from $RESERVE('00000000-0000-0000-0000-0000000000aa'::uuid, null, 'cap:' || gen_random_uuid()::text);
SQL
  } >"$ROOT/$db-cap.sql"
  run_pgbench "$db" 20 10 "$ROOT/$db-cap.sql"
  expect "$db" "select count(*) filter (where executed_as = 'service_role') || '/' || count(*) from public.brave_budget_verify_outcomes" \
    "200/200" "$db: concurrent cap, all 200 pgbench reservations ran as service_role"
  expect "$db" "select count(*) filter (where outcome='reserved') || '/' || count(*) filter (where outcome='limit_reached') from public.brave_budget_verify_outcomes" \
    "80/120" "$db: concurrent cap, 20 sessions x 10 distinct keys -> 80 reserved, 120 refused"
  expect "$db" "select count(*) from $LEDGER" "80" "$db: concurrent cap, ledger holds exactly 80 rows"

  assert_cluster_identity
  q "$db" -c "truncate $LEDGER; truncate public.brave_budget_verify_outcomes"
  { pgbench_role_guard; cat <<SQL
insert into public.brave_budget_verify_outcomes (outcome)
select reservation_outcome from $RESERVE('00000000-0000-0000-0000-0000000000bb'::uuid, null, 'race:same-key');
SQL
  } >"$ROOT/$db-same-key.sql"
  run_pgbench "$db" 20 5 "$ROOT/$db-same-key.sql"
  expect "$db" "select count(*) filter (where executed_as = 'service_role') || '/' || count(*) from public.brave_budget_verify_outcomes" \
    "100/100" "$db: concurrent idempotency, all 100 pgbench reservations ran as service_role"
  expect "$db" "select count(*) filter (where outcome='reserved') || '/' || count(*) filter (where outcome='replayed') from public.brave_budget_verify_outcomes" \
    "1/99" "$db: concurrent idempotency, 100 same-key calls -> 1 reserved, 99 replayed"
  expect "$db" "select count(*) from $LEDGER" "1" "$db: concurrent idempotency, ledger holds exactly 1 row"

  assert_cluster_identity
  q "$db" -c "drop table public.brave_budget_verify_outcomes; truncate $LEDGER"
}

# Deterministic boundary race: 79 committed reservations, then session A reserves the 80th and
# keeps its transaction open while session B asks for the 81st.
#   mode=serialized: B must wait on the advisory lock, then get limit_reached (80 rows).
#   mode=race:       expected only for the weakened migration; B is not blocked and both
#                    reserve (81 rows), which proves the lock-free variant is detected.
boundary_test() {
  local db=$1 mode=$2 a b
  assert_cluster_identity
  q "$db" -c "truncate $LEDGER"
  expect "$db" "select count(*) filter (where r.reservation_outcome='reserved') from generate_series(1,79) g(i) cross join lateral $RESERVE('00000000-0000-0000-0000-0000000000cc'::uuid, null, 'fill:' || g.i) r" \
    "79" "$db: boundary fixture, 79 committed reservations"
  qa "$db" boundary-a -At -c "set role service_role" -c "begin" \
    -c "select reservation_outcome from $RESERVE('00000000-0000-0000-0000-0000000000cd'::uuid, null, 'boundary:a')" \
    -c "select pg_sleep(3)" -c "commit" >"$ROOT/$db-boundary-a.out" 2>&1 & a=$!
  wait_for "$db" "select exists(select 1 from pg_stat_activity where application_name='boundary-a' and wait_event='PgSleep')" "session A holding its transaction"
  qa "$db" boundary-b -At -c "set role service_role" \
    -c "select reservation_outcome from $RESERVE('00000000-0000-0000-0000-0000000000ce'::uuid, null, 'boundary:b')" \
    >"$ROOT/$db-boundary-b.out" 2>&1 & b=$!
  if [ "$mode" = serialized ]; then
    wait_for "$db" "select exists(select 1 from pg_stat_activity where application_name='boundary-b' and wait_event_type='Lock' and wait_event='advisory')" "session B blocked on the advisory lock"
    pass "$db: session B is blocked on the global advisory lock while A is open"
    wait "$a"; wait "$b"
    [ "$(sed -n 1p "$ROOT/$db-boundary-a.out")" = reserved ] || die "$db: session A should reserve the 80th slot"
    [ "$(sed -n 1p "$ROOT/$db-boundary-b.out")" = limit_reached ] || die "$db: session B should get limit_reached"
    expect "$db" "select count(*) from $LEDGER" "80" "$db: boundary race, A reserved #80, B refused #81, ledger 80"
  else
    wait "$b"
    expect "$db" "select exists(select 1 from pg_stat_activity where application_name='boundary-a' and wait_event='PgSleep')" "t" "$db: session B finished while A was still open (no serialization)"
    wait "$a"
    [ "$(sed -n 1p "$ROOT/$db-boundary-a.out")" = reserved ] || die "$db: session A should reserve"
    [ "$(sed -n 1p "$ROOT/$db-boundary-b.out")" = reserved ] || die "$db: weakened migration was expected to over-reserve"
    expect "$db" "select count(*) from $LEDGER" "81" "$db: NEGATIVE CONTROL detected, lock-free migration over-reserves to 81"
  fi
  assert_cluster_identity
  q "$db" -c "truncate $LEDGER"
}

# weaken NAME SED_SCRIPT PATTERN — copy of the migration with one protection removed; PATTERN
# must match the original exactly once and the copy zero times, so the control is never vacuous.
weaken() {
  local out="$ROOT/weak-$1.sql"
  sed -e "$2" "$MIGRATION" >"$out"
  [ "$(grep -c -e "$3" "$MIGRATION" || true)" = 1 ] || die "weakening $1: pattern not found exactly once in the migration"
  [ "$(grep -c -e "$3" "$out" || true)" = 0 ] || die "weakening $1: pattern still present"
  ! cmp -s "$MIGRATION" "$out" || die "weakening $1: copy is identical"
  echo "$out"
}

# 1) Real migration ------------------------------------------------------------------------------
new_db brave_p1b
assert_cluster_identity
apply_migration brave_p1b "$MIGRATION" >/dev/null
check_structure brave_p1b
run_part1 brave_p1b || { cat "$ROOT/brave_p1b-part1.log" >&2; die "PART 1 failed on the real migration"; }
grep -q 'PASS: part 1 left no data behind' "$ROOT/brave_p1b-part1.log" || die "PART 1 did not reach its final check"
pass "brave_p1b: PART 1 (cap 80, global scope, replay, validation, rolling window, privileges, isolation)"
concurrency_tests brave_p1b
boundary_test brave_p1b serialized

# 2) Negative controls ---------------------------------------------------------------------------
WEAK_LOCK=$(weaken lock '/perform pg_advisory_xact_lock(/d' 'pg_advisory_xact_lock(')
new_db brave_weak_lock
assert_cluster_identity
apply_migration brave_weak_lock "$WEAK_LOCK" >/dev/null
boundary_test brave_weak_lock race

WEAK_CAP=$(weaken cap 's/if v_used >= c_limit then/if v_used > c_limit then/' 'if v_used >= c_limit then')
new_db brave_weak_cap
assert_cluster_identity
apply_migration brave_weak_cap "$WEAK_CAP" >/dev/null
if run_part1 brave_weak_cap; then die "NEGATIVE CONTROL missed: PART 1 accepted a cap of 81"; fi
grep -q 'expected limit_reached' "$ROOT/brave_weak_cap-part1.log" || { cat "$ROOT/brave_weak_cap-part1.log" >&2; die "weak cap failed for an unexpected reason"; }
pass "brave_weak_cap: NEGATIVE CONTROL detected, off-by-one cap rejected by PART 1"

# service_role dropped from the revoke: Supabase's default privileges leave it every privilege.
REVOKE_PATTERN='^  from public, anon, authenticated, service_role;$'
WEAK_PRIV=$(weaken privileges 's/^  from public, anon, authenticated, service_role;$/  from public, anon, authenticated;/' "$REVOKE_PATTERN")
new_db brave_weak_priv
assert_cluster_identity
apply_migration brave_weak_priv "$WEAK_PRIV" >/dev/null
expect brave_weak_priv "select has_table_privilege('service_role','$LEDGER','INSERT')" "t" "brave_weak_priv: Supabase default privileges reproduced (service_role keeps INSERT without the revoke)"
if run_part1 brave_weak_priv; then die "NEGATIVE CONTROL missed: PART 1 accepted direct ledger writes by service_role"; fi
grep -q 'service_role must not have INSERT on the ledger' "$ROOT/brave_weak_priv-part1.log" || { cat "$ROOT/brave_weak_priv-part1.log" >&2; die "weak privileges failed for an unexpected reason"; }
pass "brave_weak_priv: NEGATIVE CONTROL detected, missing service_role revoke rejected by PART 1"

# The previous, partial revoke (INSERT/UPDATE/DELETE/TRUNCATE only) must now be rejected: it leaves
# REFERENCES, TRIGGER and MAINTAIN, which the old verification never looked at.
WEAK_PARTIAL=$(weaken partial-privileges $'s/^  from public, anon, authenticated, service_role;$/  from public, anon, authenticated;\\\nrevoke insert, update, delete, truncate on table public.backlink_brave_request_reservations from service_role;/' "$REVOKE_PATTERN")
new_db brave_weak_partial
assert_cluster_identity
apply_migration brave_weak_partial "$WEAK_PARTIAL" >/dev/null
for priv in REFERENCES TRIGGER MAINTAIN; do
  expect brave_weak_partial "select has_table_privilege('service_role','$LEDGER','$priv')" "t" "brave_weak_partial: service_role keeps $priv under the partial revoke"
done
expect brave_weak_partial "select has_table_privilege('service_role','$LEDGER','INSERT')" "f" "brave_weak_partial: the partial revoke does remove INSERT"
if run_part1 brave_weak_partial; then die "NEGATIVE CONTROL missed: PART 1 accepted a partial service_role revoke"; fi
grep -q 'service_role must not have REFERENCES on the ledger' "$ROOT/brave_weak_partial-part1.log" || { cat "$ROOT/brave_weak_partial-part1.log" >&2; die "partial privileges failed for an unexpected reason"; }
pass "brave_weak_partial: NEGATIVE CONTROL detected, partial revoke (REFERENCES/TRIGGER/MAINTAIN left) rejected by PART 1"

# 3) Repository files untouched ------------------------------------------------------------------
[ "$(shasum -a 256 "$MIGRATION" | cut -d' ' -f1)" = "$MIGRATION_SHA" ] || die "migration file changed during the run"
[ "$(shasum -a 256 "$VERIFY_SQL" | cut -d' ' -f1)" = "$VERIFY_SHA" ] || die "verification SQL changed during the run"
assert_cluster_identity
echo "PASS — backlink Brave request budget PostgreSQL 17 harness (migration sha256 $MIGRATION_SHA)"
