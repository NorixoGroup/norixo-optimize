#!/usr/bin/env bash
# RLS test harness: sequential runner. NOT executed by Claude/the agent --
# prepared for the operator to run by hand after an explicit GO.
#
# Hardcoded target: norixo_ai_rls_test only. The database name is not a
# parameter/environment override on purpose, so this script cannot be
# accidentally pointed at another database by a stray env var.
#
# `set -e` (shell) + `-v ON_ERROR_STOP=1` (psql, belt-and-suspenders with the
# `\set ON_ERROR_STOP on` already inside 04/05) together guarantee: the first
# failing assertion or SQL error stops this script immediately with a
# non-zero exit code. No step after a failure runs.

set -euo pipefail

PSQL_BIN="/usr/local/opt/postgresql@16/bin/psql"
DB_NAME="norixo_ai_rls_test"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="mac"

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
# Two-migration split (A: registry only, B: policy activation, guarded --
# see both files' headers and scripts/marketing-studio-private-admin-provisioning.sql).
# The fixtures step below already inserts a norixo_private_admins row (admin-1)
# with a real workspace_members membership, so migration B's guard passes here
# the same way the real provisioning + reconciliation scripts must make it
# pass in a real deployment, before B is ever applied.
MIGRATION_A_FILE="$REPO_ROOT/supabase/migrations/20261028150000_create_norixo_private_admins_registry.sql"
MIGRATION_B_FILE="$REPO_ROOT/supabase/migrations/20261028160000_restrict_marketing_studio_tables_to_private_admins_policies.sql"
ROLLBACK_FILE="$REPO_ROOT/scripts/marketing-studio-rls-private-admin-rollback.sql"

run_sql() {
  local file="$1"
  echo "=== Running: $file ==="
  "$PSQL_BIN" -X -v ON_ERROR_STOP=1 \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$file"
}

# Explicit guard before anything else, independent of the one embedded in
# each .sql file: refuse to proceed if this psql/host/port/user combination
# does not resolve to norixo_ai_rls_test.
actual_db="$("$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'select current_database();')"
if [[ "$actual_db" != "$DB_NAME" ]]; then
  echo "Refusing to run: connected to '$actual_db' instead of '$DB_NAME'." >&2
  exit 1
fi

run_sql "$HARNESS_DIR/01_bootstrap_auth_and_roles.sql"
run_sql "$HARNESS_DIR/02_bootstrap_pre_migration_schema.sql"
run_sql "$MIGRATION_A_FILE"
run_sql "$HARNESS_DIR/03_fixtures.sql"
run_sql "$MIGRATION_B_FILE"
run_sql "$HARNESS_DIR/04_verify_scenarios.sql"
run_sql "$ROLLBACK_FILE"
run_sql "$HARNESS_DIR/05_verify_after_rollback.sql"

echo "=== All harness steps completed successfully ==="
