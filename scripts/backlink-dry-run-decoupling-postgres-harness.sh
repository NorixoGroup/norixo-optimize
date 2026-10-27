#!/usr/bin/env bash
# PostgreSQL gate — decoupling of preview-task claims from automation_workspace_controls.dry_run_only
# (migration 20261027120000, rollback scripts/backlink-dry-run-decoupling-rollback.sql).
#
# Builds a throwaway DATABASE (unique name, dedicated NON-superuser owner role) on a LOCAL PostgreSQL
# server reached only through a unix socket, applies the real automation migrations in order, and
# verifies before / after / rollback / re-apply behavior, refusal cases, ACL parity and concurrency.
# It never connects to Supabase or to any TCP host, never calls Brave / Resend / OpenAI, and removes
# only the database and role it created.
#
# Usage: PGSOCKET_DIR=/tmp PG_BIN=/usr/local/opt/postgresql@17/bin scripts/backlink-dry-run-decoupling-postgres-harness.sh
set -euo pipefail
umask 077
export LC_ALL=C LANG=C
unset LANGUAGE DATABASE_URL LOCAL_DB_URL PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGDATABASE PGUSER PGPORT PGPASSWORD PGPASSFILE PGOPTIONS PGSSLMODE

die() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

[ "$(id -u)" != 0 ] || die "refusing to run as root"
PG_BIN="${PG_BIN:-/usr/local/opt/postgresql@17/bin}"
SOCK="${PGSOCKET_DIR:-/tmp}"
case "$SOCK" in /*) ;; *) die "PGSOCKET_DIR must be an absolute unix socket directory" ;; esac
[ -S "$SOCK/.s.PGSQL.${PGPORT_NUM:-5432}" ] || die "no PostgreSQL unix socket at $SOCK"
PORT="${PGPORT_NUM:-5432}"
for bin in psql createdb dropdb pgbench; do [ -x "$PG_BIN/$bin" ] || die "missing $PG_BIN/$bin"; done

REPO=$(cd "$(dirname "$0")/.." && pwd -P)
MIG="$REPO/supabase/migrations"
FIX="$MIG/20261027120000_decouple_automation_preview_claims_from_dry_run_only.sql"
ROLLBACK="$REPO/scripts/backlink-dry-run-decoupling-rollback.sql"
TESTS="$REPO/scripts/backlink-dry-run-decoupling-verification.sql"
[ -f "$FIX" ] && [ -f "$ROLLBACK" ] && [ -f "$TESTS" ] || die "missing fix / rollback / verification SQL"

SUFFIX="$(date +%s)_$$"
DB="dryrun_fix_${SUFFIX}"
OWNER="dryrun_owner_${SUFFIX}"
PSQL_ADMIN=("$PG_BIN/psql" -h "$SOCK" -p "$PORT" -d postgres -v ON_ERROR_STOP=1 -X -q)
PSQL_DB=("$PG_BIN/psql" -h "$SOCK" -p "$PORT" -d "$DB" -v ON_ERROR_STOP=1 -X -q)

cleanup() {
  "$PG_BIN/dropdb" -h "$SOCK" -p "$PORT" --if-exists --force "$DB" >/dev/null 2>&1 || true
  "${PSQL_ADMIN[@]}" -c "drop role if exists \"$OWNER\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for role in anon authenticated service_role; do
  [ "$("${PSQL_ADMIN[@]}" -Atc "select count(*) from pg_roles where rolname='$role'")" = 1 ] || die "role $role missing on local server"
done
[ "$("${PSQL_ADMIN[@]}" -Atc "select count(*) from pg_database where datname='$DB'")" = 0 ] || die "database name collision"

"${PSQL_ADMIN[@]}" -c "create role \"$OWNER\" login nosuperuser nocreatedb nocreaterole"
"${PSQL_ADMIN[@]}" -c "create database \"$DB\" owner \"$OWNER\""
[ "$("${PSQL_ADMIN[@]}" -Atc "select rolsuper from pg_roles where rolname='$OWNER'")" = f ] || die "owner role must not be superuser"
pass "throwaway database $DB owned by non-superuser $OWNER"

# Run SQL as the non-superuser owner, like Supabase migrations.
as_owner() { "$PG_BIN/psql" -h "$SOCK" -p "$PORT" -U "$OWNER" -d "$DB" -v ON_ERROR_STOP=1 -X -q "$@"; }

as_owner <<'SQL'
create schema if not exists auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create table public.workspaces (id uuid primary key default gen_random_uuid());
create function public.is_workspace_member(uuid) returns boolean language sql as $$ select true $$;
create function public.is_workspace_admin_or_owner(uuid) returns boolean language sql as $$ select true $$;
SQL

PRE_FIX_MIGRATIONS=(
  20260803010000 20260803020000 20260803030000 20260813000000 20260814010000
  20260816000000 20260921000000 20261015120000 20261015130000
)
for m in "${PRE_FIX_MIGRATIONS[@]}"; do
  f=$(ls "$MIG"/${m}_*.sql)
  as_owner -f "$f" >/dev/null || die "pre-fix migration $m failed to apply"
done
pass "pre-fix automation migrations applied (${#PRE_FIX_MIGRATIONS[@]})"

as_owner -f "$TESTS" -v phase=before_fix || die "pre-fix verification failed (negative control)"
pass "negative control: pre-fix functions refuse discovery when dry_run_only = false"

as_owner -At -c "
  create table public.zz_acl_before as
  select p.proname, p.proowner::regrole::text as owner, p.prosecdef, p.proconfig::text as config, p.proacl::text as acl,
         has_function_privilege('anon', p.oid, 'execute') as anon_x,
         has_function_privilege('authenticated', p.oid, 'execute') as auth_x,
         has_function_privilege('service_role', p.oid, 'execute') as service_x
  from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('claim_next_automation_task', 'claim_backlink_discovery_task_by_id');" >/dev/null

as_owner -f "$FIX" >/dev/null || die "fix migration failed to apply"
pass "fix migration applied"
as_owner -f "$FIX" >/dev/null || die "fix migration is not idempotent"
pass "fix migration is idempotent (applied twice)"

ACL_DIFF=$(as_owner -At -c "
  select count(*) from public.zz_acl_before b join (
    select p.proname, p.proowner::regrole::text as owner, p.prosecdef, p.proconfig::text as config, p.proacl::text as acl,
           has_function_privilege('anon', p.oid, 'execute') as anon_x,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_x,
           has_function_privilege('service_role', p.oid, 'execute') as service_x
    from pg_proc p where p.pronamespace = 'public'::regnamespace
      and p.proname in ('claim_next_automation_task', 'claim_backlink_discovery_task_by_id')) a using (proname)
  where (b.owner, b.prosecdef, b.config, b.acl, b.anon_x, b.auth_x, b.service_x)
        is distinct from (a.owner, a.prosecdef, a.config, a.acl, a.anon_x, a.auth_x, a.service_x);")
[ "$ACL_DIFF" = 0 ] || die "owner / ACL / security-definer / search_path changed by the migration"
pass "owner, ACL, SECURITY DEFINER and search_path unchanged for both functions"

as_owner -f "$TESTS" -v phase=after_fix || die "post-fix verification failed"
pass "post-fix verification (acceptance, refusals, mode check, kill switch)"

# Concurrency: 20 clients race for 4 queued preview tasks.
as_owner -f "$TESTS" -v phase=concurrency_setup >/dev/null
CONC_SCRIPT=$(mktemp "${TMPDIR:-/tmp}/dryrun-conc.XXXXXX")
cat >"$CONC_SCRIPT" <<'SQL'
select count(*) from public.claim_next_automation_task(
  (select workspace_id from public.zz_conc limit 1), (select run_id from public.zz_conc limit 1),
  'worker-' || :client_id, now(), 60);
SQL
"$PG_BIN/pgbench" -h "$SOCK" -p "$PORT" -U "$OWNER" -d "$DB" -n -f "$CONC_SCRIPT" -c 20 -j 4 -t 1 >/dev/null 2>&1 || die "pgbench failed"
rm -f "$CONC_SCRIPT"
as_owner -f "$TESTS" -v phase=concurrency_assert || die "concurrency assertion failed (duplicate claim or lost task)"
pass "concurrency: 20 simultaneous claims over 4 tasks produce exactly 4 distinct claims"

# Rollback restores the pre-fix refusal; re-applying the fix restores acceptance.
as_owner -f "$ROLLBACK" >/dev/null || die "rollback script failed to apply"
as_owner -f "$TESTS" -v phase=before_fix || die "rollback did not restore pre-fix behavior"
pass "rollback restores pre-fix behavior"
as_owner -f "$FIX" >/dev/null || die "re-applying fix after rollback failed"
as_owner -f "$TESTS" -v phase=after_fix || die "behavior wrong after re-applying the fix"
pass "re-applying the fix after rollback restores the decoupled behavior"

echo "ALL POSTGRESQL CHECKS PASSED"
