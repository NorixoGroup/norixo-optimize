#!/usr/bin/env bash
# Audit entitlement test harness: sequential runner, following the same
# structure as scripts/rls-test-harness/run_all.sh.
#
# Hardcoded target: norixo_ph8_entitlement_test only, on the local Homebrew
# PostgreSQL 16 instance already running on this machine (not started by
# this script). The database name is not a parameter/environment override
# on purpose.
#
# Creates the database itself if it does not exist yet (this is a brand
# new, dedicated, disposable database -- distinct from norixo_ai_rls_test
# and the other pre-existing local test databases on this cluster, which
# this script never touches).
#
# `set -e` (shell) + `-v ON_ERROR_STOP=1` (psql, belt-and-suspenders with
# the `\set ON_ERROR_STOP on` already inside 04/05/06) together guarantee:
# the first failing assertion or SQL error stops this script immediately
# with a non-zero exit code.

set -euo pipefail

PSQL_BIN="/usr/local/opt/postgresql@16/bin/psql"
DB_NAME="norixo_ph8_entitlement_test"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="mac"

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"

MIGRATION_CREDIT_LOTS="$REPO_ROOT/supabase/migrations/20260412190000_create_audit_credit_lots.sql"
MIGRATION_RESERVATIONS="$REPO_ROOT/supabase/migrations/20260714110000_create_audit_entitlement_reservations.sql"
MIGRATION_LINK="$REPO_ROOT/supabase/migrations/20260714120000_link_audits_to_entitlement_reservations.sql"
MIGRATION_FIX="$REPO_ROOT/supabase/migrations/20261115120000_fix_free_plan_audit_entitlement.sql"

run_sql() {
  local file="$1"
  echo "=== Running: $file ==="
  "$PSQL_BIN" -X -v ON_ERROR_STOP=1 \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$file"
}

db_exists="$("$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
  -c "select 1 from pg_database where datname = '$DB_NAME';")"
if [[ "$db_exists" != "1" ]]; then
  echo "=== Creating disposable database $DB_NAME ==="
  "$PSQL_BIN" -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "create database $DB_NAME;"
fi

actual_db="$("$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'select current_database();')"
if [[ "$actual_db" != "$DB_NAME" ]]; then
  echo "Refusing to run: connected to '$actual_db' instead of '$DB_NAME'." >&2
  exit 1
fi

run_sql "$HARNESS_DIR/01_bootstrap_auth_and_roles.sql"
run_sql "$HARNESS_DIR/02_bootstrap_pre_migration_schema.sql"
run_sql "$MIGRATION_CREDIT_LOTS"
run_sql "$MIGRATION_RESERVATIONS"
run_sql "$MIGRATION_LINK"
run_sql "$MIGRATION_FIX"
run_sql "$HARNESS_DIR/03_fixtures.sql"
run_sql "$HARNESS_DIR/04_verify_scenarios.sql"
run_sql "$HARNESS_DIR/05_rollback.sql"
run_sql "$HARNESS_DIR/06_verify_after_rollback.sql"

echo "=== All harness steps completed successfully ==="
