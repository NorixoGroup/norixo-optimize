#!/usr/bin/env bash
# G4-M5 Backlinks RLS test harness: sequential runner. NOT executed
# automatically by Claude/the agent in CI -- prepared for the operator to
# run by hand after an explicit GO, entirely against a local, dedicated,
# isolated PostgreSQL database. Zero Production access, zero Resend/Brave
# calls (nothing here performs network I/O at all).
#
# Hardcoded target: norixo_g4_m5_rls_test only. The database name is not a
# parameter/environment override on purpose, so this script cannot be
# accidentally pointed at another database by a stray env var. This is a
# NEW, dedicated database -- not norixo_ai_rls_test (used by the separate
# marketing-studio private-admin RLS harness in scripts/rls-test-harness/).
#
# `set -e` (shell) + `-v ON_ERROR_STOP=1` (psql, belt-and-suspenders with the
# `\set ON_ERROR_STOP on` already inside 04/05) together guarantee: the
# first failing assertion or SQL error stops this script immediately with a
# non-zero exit code. No step after a failure runs.

set -euo pipefail

PSQL_BIN="/usr/local/opt/postgresql@16/bin/psql"
DB_NAME="norixo_g4_m5_rls_test"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="mac"

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

FIX_A_FILE="$MIGRATIONS_DIR/20261104120000_enable_rls_backlink_outreach_initial_attempt_snapshots.sql"
FIX_B_FILE="$MIGRATIONS_DIR/20261104130000_restrict_backlink_outreach_select_to_workspace_admins.sql"
ROLLBACK_FILE="$REPO_ROOT/scripts/backlinks-g4-m5-rls-rollback.sql"

# Real backlink_* migration files this harness replays, in the exact order
# they exist in supabase/migrations/ -- from the first backlink table up to
# (and including) the last file that touches backlink_outreach or
# backlink_outreach_initial_attempt_snapshots before the two Fix migrations
# above. Includes automation_runs/automation_tasks (20260803010000,
# 20260803020000): not backlink-prefixed, but a real FK prerequisite of
# backlink_promotion_applications/backlink_discovery_intake_applications,
# which are themselves in this chronological range. Applying the real files
# verbatim -- rather than hand-reconstructing this much schema -- is what
# lets Fix A/B be tested against the literal SQL that runs in Production.
REAL_MIGRATION_FILES=(
  "20260728000000_create_backlink_foundation.sql"
  "20260728000100_create_backlink_opportunities.sql"
  "20260728000200_create_backlink_tag_relations.sql"
  "20260728000300_create_backlink_contacts.sql"
  "20260728000400_create_backlink_campaigns.sql"
  "20260728000500_create_backlink_outreach.sql"
  "20260728000600_create_backlink_links.sql"
  "20260728000700_create_backlink_notes.sql"
  "20260728000800_create_backlink_activity.sql"
  "20260728000900_prevent_backlink_workspace_reassignment.sql"
  "20260728001100_create_backlink_campaign_opportunities.sql"
  "20260728001200_create_backlink_verification_attempts.sql"
  "20260728001300_create_backlink_verification_jobs.sql"
  "20260728001400_add_backlink_verification_job_claims.sql"
  "20260801090000_scope_backlink_verification_job_claim_by_workspace.sql"
  "20260802010000_claim_backlink_verification_job_by_id.sql"
  "20260803010000_create_automation_runs.sql"
  "20260803020000_create_automation_tasks.sql"
  "20260803040000_add_backlink_promotion_applications.sql"
  "20260803050000_fix_apply_backlink_promotion_proposal_ambiguities.sql"
  "20260803060000_add_backlink_key_reservation_rpc.sql"
  "20260803070000_add_backlink_domain_opportunity_resolution_rpc.sql"
  "20260810090000_add_backlink_discovery_intake_applications.sql"
  "20260810091000_add_backlink_outreach_draft_content.sql"
  "20260810092000_add_backlink_outreach_key_reservation.sql"
  "20260810100000_add_backlink_outreach_attempts.sql"
  "20260810110000_add_backlink_outreach_open_attempt_unique.sql"
  "20260811090000_add_backlink_outreach_delivery_events.sql"
  "20260811100000_add_backlink_outreach_delivery_effects.sql"
  "20260811110000_add_backlink_outreach_delivery_event_bounce_type.sql"
  "20260811120000_add_backlink_outreach_permanent_bounce_effect.sql"
  "20260811130000_add_backlink_outreach_attempt_reply_token_hash.sql"
  "20260811140000_add_backlink_outreach_inbound_messages.sql"
  "20260811150000_add_backlink_outreach_inbound_effects.sql"
  "20260811151000_add_backlink_outreach_inbound_reply_stop_rpc.sql"
  "20260811152000_add_backlink_outreach_inbound_reply_classifications.sql"
  "20260811153000_harden_backlink_provider_stop_signal_dominance.sql"
  "20260811154000_add_backlink_outreach_inbound_reply_classification_rpc.sql"
  "20260811155000_add_backlink_outreach_follow_up_attempt_reservation.sql"
  "20260811156000_harden_backlink_outreach_follow_up_attempt_state_machine.sql"
  "20260811157000_add_backlink_outreach_follow_up_drafts.sql"
  "20260811158000_add_backlink_outreach_attempt_reply_token_key_version.sql"
  "20260811159000_adopt_backlink_outreach_attempt_reconstructible_reply_identity.sql"
  "20260811160000_add_backlink_outreach_follow_up_accepted_lifecycle_effect.sql"
  "20260811161000_add_backlink_outreach_follow_up_pre_send_rpc.sql"
  "20260811162000_add_backlink_outreach_response_deadline.sql"
  "20260811163000_add_backlink_outreach_follow_up_schedule_reconciliation.sql"
  "20260811164000_add_backlink_outreach_due_follow_ups_selector.sql"
  "20260811165000_add_backlink_outreach_response_deadline_clearing.sql"
  "20260811166000_add_backlink_outreach_expired_response_deadlines_selector.sql"
  "20260811167000_add_backlink_outreach_final_no_response.sql"
  "20260813000000_add_backlink_outreach_schedule_apply_capability.sql"
  "20260814000000_add_backlink_outreach_schedule_apply_runs.sql"
  "20260814010000_add_backlink_outreach_schedule_apply_fairness_and_locking.sql"
  "20260814020000_harden_backlink_outreach_expired_response_deadlines_selector.sql"
  "20260814030000_fix_backlink_outreach_expired_response_deadlines_return_types.sql"
  "20260816010000_add_backlink_outreach_attempts_insert_policy.sql"
  "20260816020000_add_backlink_outreach_attempts_update_policy.sql"
  "20260816040000_add_backlink_outreach_backlink_obtained_lifecycle_effect.sql"
  "20260816050000_fix_backlink_outreach_backlink_obtained_ambiguous_references.sql"
  "20260817010000_add_backlink_outreach_acquisition_snapshot.sql"
  "20260827120000_add_backlink_outreach_initial_attempt_reservation.sql"
  "20260828120000_add_backlink_outreach_approval_aware_initial_attempt_reservation.sql"
  "20260829120000_reclaim_expired_backlink_verification_jobs.sql"
  "20260830170000_add_atomic_backlink_first_approval.sql"
  "20260830180000_fix_backlink_first_approval_digest_schema.sql"
  "20260831130000_harden_backlink_v2_approval_fingerprint.sql"
)

run_sql() {
  local file="$1"
  echo "=== Running: $file ==="
  "$PSQL_BIN" -X -v ON_ERROR_STOP=1 \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$file"
}

# Explicit guard before anything else, independent of the one embedded in
# each .sql file: refuse to proceed if this psql/host/port/user combination
# does not resolve to norixo_g4_m5_rls_test.
actual_db="$("$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'select current_database();')"
if [[ "$actual_db" != "$DB_NAME" ]]; then
  echo "Refusing to run: connected to '$actual_db' instead of '$DB_NAME'." >&2
  exit 1
fi

run_sql "$HARNESS_DIR/01_bootstrap_auth_and_roles.sql"
run_sql "$HARNESS_DIR/02_bootstrap_pre_migration_schema.sql"

for name in "${REAL_MIGRATION_FILES[@]}"; do
  run_sql "$MIGRATIONS_DIR/$name"
done

run_sql "$HARNESS_DIR/03_fixtures.sql"
run_sql "$FIX_A_FILE"
run_sql "$FIX_B_FILE"
run_sql "$HARNESS_DIR/04_verify_scenarios.sql"
run_sql "$ROLLBACK_FILE"
run_sql "$HARNESS_DIR/05_verify_after_rollback.sql"

echo "=== All harness steps completed successfully ==="
