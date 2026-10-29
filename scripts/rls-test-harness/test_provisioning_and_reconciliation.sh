#!/usr/bin/env bash
# RLS test harness: tests for scripts/marketing-studio-private-admin-provisioning.sql
# and scripts/marketing-studio-private-admin-reconciliation.sql.
# NOT executed by Claude/the agent -- prepared for the operator to run by
# hand after an explicit GO.
#
# PRECONDITION: run after a FRESH 01 + 02 + migration A sequence (table and
# function must exist; migration B must NOT have run yet -- these two
# scripts are meant to be exercised before B, and this test never applies B).
#
# These two real scripts are committed with placeholder e-mails that the
# operator is meant to edit in place before running manually. To test them
# here without ever committing real data, this script makes a SCRATCH COPY
# of each real file with the placeholder VALUES list replaced by
# test-only, `.invalid`-domain e-mails, runs the copy, and discards it. This
# simulates the real "operator edits the placeholder, then runs" workflow
# exactly -- it is not a mock of the SQL logic itself, which is executed
# unmodified from the scratch copy.
#
# Covers:
#   - provisioning: success, missing user, ambiguous user, user without membership
#   - reconciliation: pass, missing-in-db, extra-in-db, without-membership

set -uo pipefail  # no -e: several sub-tests expect psql to fail

PSQL_BIN="/usr/local/opt/postgresql@16/bin/psql"
DB_NAME="norixo_ai_rls_test"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="mac"

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
PROVISIONING_SRC="$REPO_ROOT/scripts/marketing-studio-private-admin-provisioning.sql"
RECONCILIATION_SRC="$REPO_ROOT/scripts/marketing-studio-private-admin-reconciliation.sql"

SCRATCH_DIR="$(mktemp -d)"
trap 'rm -rf "$SCRATCH_DIR"' EXIT

fail_count=0

actual_db="$("$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'select current_database();')"
if [[ "$actual_db" != "$DB_NAME" ]]; then
  echo "Refusing to run: connected to '$actual_db' instead of '$DB_NAME'." >&2
  exit 1
fi

psql_exec() {
  "$PSQL_BIN" -X -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$@"
}

# make_scratch_copy <source_file> <email1> [email2 ...]
# Replaces the two placeholder VALUES lines with one line per given e-mail.
make_scratch_copy() {
  local src="$1"; shift
  local out="$SCRATCH_DIR/$(basename "$src").$$.$RANDOM.sql"
  local values_block=""
  local first=1
  for email in "$@"; do
    if [[ "$first" -eq 1 ]]; then
      values_block="    ('$email')"
      first=0
    else
      values_block="$values_block,
    ('$email')"
    fi
  done
  awk -v block="$values_block" '
    /\(.admin-placeholder-1@example\.invalid.\),/ { print block ";"; skip=1; next }
    skip && /\(.admin-placeholder-2@example\.invalid.\)/ { skip=0; next }
    { print }
  ' "$src" > "$out"
  echo "$out"
}

require_setup_ok() {
  # Fixture preparation is never expected to fail -- only the actual psql_exec
  # -f "$copyN" calls under test are allowed to fail (the deliberate SQL
  # failures these tests are designed to exercise, checked separately via
  # expect_exit_nonzero below). A non-zero exit here means PREPARATION itself
  # broke -- stop immediately, with a distinct exit code (2) from the
  # end-of-script test-failure exit (1), and name the failed step, so a
  # broken precondition is never mistaken for -- or silently allowed to
  # produce -- a PASS on the test it was meant to set up.
  local label="$1" actual="$2"
  if [[ "$actual" -ne 0 ]]; then
    echo "SETUP FAILED: $label (exit $actual) -- aborting before any assertion could run." >&2
    exit 2
  fi
}

expect_exit_zero() {
  local label="$1" actual="$2"
  if [[ "$actual" -ne 0 ]]; then
    echo "TEST FAILED: $label expected exit 0, got $actual." >&2
    fail_count=$((fail_count + 1))
  else
    echo "TEST PASSED: $label (exit 0 as expected)."
  fi
}

expect_exit_nonzero() {
  local label="$1" actual="$2"
  if [[ "$actual" -eq 0 ]]; then
    echo "TEST FAILED: $label expected non-zero exit, got 0." >&2
    fail_count=$((fail_count + 1))
  else
    echo "TEST PASSED: $label (non-zero exit $actual as expected)."
  fi
}

cleanup_fixture() {
  # Removes everything this test script may have inserted, by e-mail, so
  # re-runs are idempotent. Never touches 03_fixtures.sql's own rows
  # (different, non-overlapping e-mail domain pattern: *-test-*@example.invalid
  # here vs admin-1/2@... elsewhere).
  psql_exec -c "
    delete from public.norixo_private_admins
      where email like '%-test-%@example.invalid';
    delete from public.workspace_members
      where user_id in (select id from auth.users where email like '%-test-%@example.invalid');
    delete from auth.users where email like '%-test-%@example.invalid';
  " >/dev/null
  require_setup_ok "cleanup_fixture" "$?"
}

echo "### Provisioning script tests ###"
cleanup_fixture

echo "--- Provisioning 1/4: success (resolvable user, has membership) ---"
psql_exec <<'SQL'
insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000001', 'prov-test-success@example.invalid');
insert into public.workspaces (id, name, slug) values
  ('30000000-0000-0000-0000-00000000aaaa', 'Guard test workspace', 'guard-test-workspace')
on conflict (id) do nothing;
insert into public.workspace_members (workspace_id, user_id, role) values
  ('30000000-0000-0000-0000-00000000aaaa', '30000000-0000-0000-0000-000000000001', 'member');
SQL
require_setup_ok "provisioning success case: fixture setup" "$?"
copy1="$(make_scratch_copy "$PROVISIONING_SRC" 'prov-test-success@example.invalid')"
psql_exec -f "$copy1"
expect_exit_zero "provisioning success case" "$?"
row_count="$("$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
  "select count(*) from public.norixo_private_admins where email = 'prov-test-success@example.invalid';")"
if [[ "$row_count" != "1" ]]; then
  echo "TEST FAILED: provisioning success case did not insert exactly one row (found $row_count)." >&2
  fail_count=$((fail_count + 1))
fi
cleanup_fixture

echo "--- Provisioning 2/4: missing user (e-mail not in auth.users) ---"
copy2="$(make_scratch_copy "$PROVISIONING_SRC" 'prov-test-missing@example.invalid')"
psql_exec -f "$copy2"
expect_exit_nonzero "provisioning missing-user case" "$?"
cleanup_fixture

echo "--- Provisioning 3/4: ambiguous user (two auth.users rows, same e-mail) ---"
psql_exec <<'SQL'
insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000003', 'prov-test-ambiguous@example.invalid'),
  ('30000000-0000-0000-0000-000000000004', 'prov-test-ambiguous@example.invalid');
SQL
require_setup_ok "provisioning ambiguous-user case: fixture setup" "$?"
copy3="$(make_scratch_copy "$PROVISIONING_SRC" 'prov-test-ambiguous@example.invalid')"
psql_exec -f "$copy3"
expect_exit_nonzero "provisioning ambiguous-user case" "$?"
cleanup_fixture

echo "--- Provisioning 4/4: resolvable user, zero workspace_members rows ---"
psql_exec <<'SQL'
insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000005', 'prov-test-nomember@example.invalid');
SQL
require_setup_ok "provisioning without-membership case: fixture setup" "$?"
copy4="$(make_scratch_copy "$PROVISIONING_SRC" 'prov-test-nomember@example.invalid')"
psql_exec -f "$copy4"
expect_exit_nonzero "provisioning without-membership case" "$?"
row_count="$("$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
  "select count(*) from public.norixo_private_admins where email = 'prov-test-nomember@example.invalid';")"
if [[ "$row_count" != "0" ]]; then
  echo "TEST FAILED: without-membership case must insert zero rows (found $row_count)." >&2
  fail_count=$((fail_count + 1))
fi
cleanup_fixture

echo "### Reconciliation script tests ###"

echo "--- Reconciliation 1/4: pass (consistent) ---"
psql_exec <<'SQL'
insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'recon-test-pass@example.invalid');
insert into public.workspaces (id, name, slug) values
  ('40000000-0000-0000-0000-00000000aaaa', 'Guard test workspace 2', 'guard-test-workspace-2')
on conflict (id) do nothing;
insert into public.workspace_members (workspace_id, user_id, role) values
  ('40000000-0000-0000-0000-00000000aaaa', '40000000-0000-0000-0000-000000000001', 'member');
insert into public.norixo_private_admins (user_id, email) values
  ('40000000-0000-0000-0000-000000000001', 'recon-test-pass@example.invalid');
SQL
require_setup_ok "reconciliation pass case: fixture setup" "$?"
copy5="$(make_scratch_copy "$RECONCILIATION_SRC" 'recon-test-pass@example.invalid')"
psql_exec -f "$copy5"
expect_exit_zero "reconciliation pass case" "$?"
cleanup_fixture

echo "--- Reconciliation 2/4: missing-in-db (expected admin absent from norixo_private_admins) ---"
psql_exec <<'SQL'
insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000002', 'recon-test-missingdb@example.invalid');
insert into public.workspaces (id, name, slug) values
  ('40000000-0000-0000-0000-00000000bbbb', 'Guard test workspace 3', 'guard-test-workspace-3')
on conflict (id) do nothing;
insert into public.workspace_members (workspace_id, user_id, role) values
  ('40000000-0000-0000-0000-00000000bbbb', '40000000-0000-0000-0000-000000000002', 'member');
SQL
require_setup_ok "reconciliation missing-in-db case: fixture setup" "$?"
copy6="$(make_scratch_copy "$RECONCILIATION_SRC" 'recon-test-missingdb@example.invalid')"
psql_exec -f "$copy6"
expect_exit_nonzero "reconciliation missing-in-db case" "$?"
cleanup_fixture

echo "--- Reconciliation 3/4: extra-in-db (db row not in expected list) ---"
psql_exec <<'SQL'
insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000003', 'recon-test-extradb@example.invalid');
insert into public.norixo_private_admins (user_id, email) values
  ('40000000-0000-0000-0000-000000000003', 'recon-test-extradb@example.invalid');
SQL
require_setup_ok "reconciliation extra-in-db case: fixture setup" "$?"
copy7="$(make_scratch_copy "$RECONCILIATION_SRC" 'recon-test-someone-else@example.invalid')"
psql_exec -f "$copy7"
expect_exit_nonzero "reconciliation extra-in-db case" "$?"
cleanup_fixture

echo "--- Reconciliation 4/4: provisioned admin without workspace membership ---"
psql_exec <<'SQL'
insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000004', 'recon-test-nomember@example.invalid');
insert into public.norixo_private_admins (user_id, email) values
  ('40000000-0000-0000-0000-000000000004', 'recon-test-nomember@example.invalid');
SQL
require_setup_ok "reconciliation without-membership case: fixture setup" "$?"
copy8="$(make_scratch_copy "$RECONCILIATION_SRC" 'recon-test-nomember@example.invalid')"
psql_exec -f "$copy8"
expect_exit_nonzero "reconciliation without-membership case" "$?"
cleanup_fixture

echo ""
if [[ "$fail_count" -gt 0 ]]; then
  echo "=== $fail_count test(s) FAILED ===" >&2
  exit 1
fi
echo "=== All provisioning and reconciliation tests passed ==="
