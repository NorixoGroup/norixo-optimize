#!/usr/bin/env bash
# RLS test harness: dedicated NEGATIVE test for migration B's blocking guard.
# NOT executed by Claude/the agent -- prepared for the operator to run by
# hand after an explicit GO.
#
# PRECONDITION: run this ONLY after a FRESH 01 + 02 + migration A sequence
# (NOT after the full run_all.sh, which already provisions a valid admin
# before B -- that would make this negative test pass for the wrong reason,
# because migration B's guard would see a real valid admin and proceed).
# Suggested fresh sequence before running this script:
#   psql ... -f 01_bootstrap_auth_and_roles.sql
#   psql ... -f 02_bootstrap_pre_migration_schema.sql
#   psql ... -f ../../supabase/migrations/20261028150000_create_norixo_private_admins_registry.sql
#
# Verifies: applying migration B against a norixo_private_admins state with
# NO row holding valid workspace membership MUST fail (non-zero exit), and
# the seven original _workspace_members policies MUST remain untouched
# afterward, with zero _private_admin policies created. This is the
# negative-path counterpart to run_all.sh's happy path.

set -uo pipefail  # no -e: the migration-B step below is EXPECTED to fail

PSQL_BIN="/usr/local/opt/postgresql@16/bin/psql"
DB_NAME="norixo_ai_rls_test"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="mac"

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
MIGRATION_B_FILE="$REPO_ROOT/supabase/migrations/20261028160000_restrict_marketing_studio_tables_to_private_admins_policies.sql"

GUARD_TEST_USER_ID="20000000-0000-0000-0000-000000000099"
GUARD_TEST_EMAIL="guard-test-admin-no-membership@example.invalid"

actual_db="$("$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'select current_database();')"
if [[ "$actual_db" != "$DB_NAME" ]]; then
  echo "Refusing to run: connected to '$actual_db' instead of '$DB_NAME'." >&2
  exit 1
fi

echo "=== Precondition: insert a private admin with NO workspace membership (deliberately invalid) ==="
"$PSQL_BIN" -X -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<SQL
insert into auth.users (id, email) values
  ('$GUARD_TEST_USER_ID', '$GUARD_TEST_EMAIL')
on conflict (id) do nothing;
insert into public.norixo_private_admins (user_id, email) values
  ('$GUARD_TEST_USER_ID', '$GUARD_TEST_EMAIL')
on conflict (user_id) do nothing;
SQL
precondition_exit=$?
if [[ "$precondition_exit" -ne 0 ]]; then
  echo "TEST FAILED: could not even set up the deliberately-invalid precondition (exit $precondition_exit)." >&2
  exit 1
fi

echo "=== Attempting migration B: MUST fail (guard must reject -- no admin has valid workspace membership) ==="
"$PSQL_BIN" -X -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_B_FILE"
migration_b_exit=$?

if [[ "$migration_b_exit" -eq 0 ]]; then
  echo "TEST FAILED: migration B succeeded despite no admin having valid workspace membership." >&2
  exit 1
fi
echo "Migration B correctly failed (exit code $migration_b_exit) -- guard worked as intended."

echo "=== Post-condition: the 7 original _workspace_members policies must still be intact, 0 _private_admin policies ==="
"$PSQL_BIN" -X -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<'SQL'
do $$
declare
  original_count int;
  private_admin_count int;
begin
  select count(*) into original_count
  from pg_policies
  where tablename in ('marketing_campaigns','marketing_studio_generation_runs')
    and policyname like '%_workspace_members';

  select count(*) into private_admin_count
  from pg_policies
  where tablename in ('marketing_campaigns','marketing_studio_generation_runs')
    and policyname like '%_private_admin';

  if original_count <> 7 then
    raise exception 'TEST FAILED: expected 7 original _workspace_members policies, found %.', original_count;
  end if;
  if private_admin_count <> 0 then
    raise exception 'TEST FAILED: expected 0 _private_admin policies after a failed migration B, found %.', private_admin_count;
  end if;
  raise notice 'TEST PASSED: migration B failed safely -- all 7 original policies intact, 0 private-admin policies created.';
end
$$;
SQL
postcondition_exit=$?
if [[ "$postcondition_exit" -ne 0 ]]; then
  echo "TEST FAILED: post-condition check did not pass (exit $postcondition_exit)." >&2
  exit 1
fi

echo "=== Cleanup: removing the deliberately-invalid guard-test fixture ==="
"$PSQL_BIN" -X -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
  "delete from public.norixo_private_admins where user_id = '$GUARD_TEST_USER_ID'; delete from auth.users where id = '$GUARD_TEST_USER_ID';"

echo "=== Blocking guard negative test completed successfully ==="
