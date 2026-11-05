#!/usr/bin/env bash
# G4-M5 Backlinks HTTP harness: validates the 7 access profiles against the
# REAL Next.js route handlers of this worktree, a REAL local PostgREST, and
# a NEW dedicated PostgreSQL database -- with a local synthetic HS256 JWT
# responder standing in for Supabase Auth (NOT real GoTrue; see
# auth_rest_proxy.cjs).
#
# Isolation, by design:
#   - Reuses the EXISTING local PostgreSQL 16 server on 127.0.0.1:5432.
#     Never runs initdb, never starts a new cluster.
#   - Creates exactly one new database, norixo_g4_m5_rls_http_test. Refuses
#     to run if it already exists. Never touches norixo_g4_m5_rls_test,
#     _sandbox, _test_original_20261104, or any other existing database.
#   - Downloads PostgREST v16.5 (macOS x86-64 -- this machine's Homebrew and
#     its PostgreSQL 16 server are x86_64 under Rosetta despite the arm64
#     kernel; no /opt/homebrew arm64 prefix exists here, confirmed via otool
#     -L, so the x86_64 asset is what this runtime can actually load) ONLY
#     from
#     github.com/PostgREST/postgrest/releases, verifies version+architecture,
#     computes (but does not claim as authoritative) its SHA-256. PostgREST
#     publishes no checksum file or signature for this release -- documented
#     here and in the final report as a residual provenance limitation, per
#     explicit user approval ("Option 1").
#   - Starts Next.js on a fresh local port, never the shared :3000 server
#     another worktree owns.
#   - Zero Resend/Brave/Supabase-Production network calls: NEXT_PUBLIC_SUPABASE_URL
#     points at the local proxy, which only talks to localhost PostgREST.
#   - Cleans up only what it created: its own PostgreSQL role, its own
#     database, its own background processes, its own temp directories.
#
# Not for CI -- run by hand only, from the repo root of this worktree:
#   bash scripts/backlinks-g4-m5-rls-http-harness/run_http_harness.sh

set -euo pipefail
umask 077
die() { echo "FAIL: $*" >&2; exit 1; }
block() { echo "BLOCKED: $*" >&2; exit 2; }

[ "$(id -u)" != 0 ] || die "refusing to run as root"

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
FIX_A_FILE="$MIGRATIONS_DIR/20261104120000_enable_rls_backlink_outreach_initial_attempt_snapshots.sql"
FIX_B_FILE="$MIGRATIONS_DIR/20261104130000_restrict_backlink_outreach_select_to_workspace_admins.sql"

DB_NAME="norixo_g4_m5_rls_http_test"
DB_HOST="127.0.0.1"
DB_PORT="5432"
DB_USER="$(id -un)"
PG_BIN="${PG_BIN:-/usr/local/opt/postgresql@16/bin}"
PSQL_BIN="$PG_BIN/psql"
PGRST_VERSION="16.5"
PGRST_ASSET="postgrest-v16.5-macos-x86-64.tar.xz"
PGRST_URL="https://github.com/PostgREST/postgrest/releases/download/v${PGRST_VERSION}/${PGRST_ASSET}"
G4M5_ROLE="g4m5_http_authenticator"

# Ignore any ambient Supabase/Production configuration that could redirect
# this run.
unset DATABASE_URL SUPABASE_DB_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY \
  NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY ADMIN_EMAILS \
  NORIXO_ADMIN_EMAILS RESEND_API_KEY BRAVE_API_KEY PGSERVICE PGSERVICEFILE \
  PGDATABASE PGHOSTADDR PGPASSFILE PGSSLMODE PGOPTIONS PGSYSCONFDIR 2>/dev/null || true

echo "=== Preflight ==="
[ -x "$PSQL_BIN" ] || block "psql not found at $PSQL_BIN (set PG_BIN)"
case "$("$PG_BIN/postgres" --version)" in "postgres (PostgreSQL) 16."*) ;; *) block "PG_BIN is not PostgreSQL 16" ;; esac
command -v node >/dev/null 2>&1 || block "node not found on PATH"
command -v npx >/dev/null 2>&1 || block "npx not found on PATH"
command -v curl >/dev/null 2>&1 || block "curl not found on PATH"
command -v tar >/dev/null 2>&1 || block "tar not found on PATH"
command -v file >/dev/null 2>&1 || block "file not found on PATH"
command -v openssl >/dev/null 2>&1 || block "openssl not found on PATH"
[ "$(uname -s)" = "Darwin" ] || block "This harness's pinned PostgREST asset is macOS only; current machine is $(uname -s)"
[ -f /usr/local/opt/libpq/lib/libpq.5.dylib ] || block "Expected x86_64 libpq not found at /usr/local/opt/libpq/lib/libpq.5.dylib -- this harness is pinned to the macOS x86-64 PostgREST asset to match this machine's Rosetta Homebrew install"

server_version="$("$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c 'select version();' 2>&1)" \
  || block "cannot reach PostgreSQL at $DB_HOST:$DB_PORT as $DB_USER: $server_version"
case "$server_version" in *"PostgreSQL 16."*) ;; *) block "Server at $DB_HOST:$DB_PORT is not PostgreSQL 16 (got: $server_version)" ;; esac
echo "PASS: existing PostgreSQL 16 reachable at $DB_HOST:$DB_PORT"

existing_db="$("$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
  -c "select 1 from pg_database where datname = '$DB_NAME';")"
[ -z "$existing_db" ] || block "Database $DB_NAME already exists -- refusing to run (condition #1). Drop it manually after confirming it is not another run's unfinished state, then retry."
echo "PASS: $DB_NAME does not exist yet"

curl -sS --max-time 10 -o /dev/null https://github.com \
  || block "No outbound network access to github.com -- cannot fetch PostgREST"
echo "PASS: outbound network reachable"

TMP_BASE="${TMPDIR:-/tmp}"
ROOT="$(mktemp -d "$TMP_BASE/norixo-g4m5-http.XXXXXX")"
LOG_DIR="$ROOT/logs"; mkdir -m 700 "$LOG_DIR"
PGRST_DIR="$ROOT/postgrest"; mkdir -m 700 "$PGRST_DIR"

DB_CREATED=0
ROLE_CREATED=0
PGRST_PID=""
PROXY_PID=""
NEXT_PID=""

cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  echo "=== Cleanup ==="
  if [ -n "$NEXT_PID" ]; then
    kill "$NEXT_PID" 2>/dev/null || true
    wait "$NEXT_PID" 2>/dev/null || true
  fi
  # next dev forks a next-server child that outlives its immediate parent
  # (npx/node) when only that parent PID is signalled -- kill by port too,
  # twice (TERM then KILL), so no orphan survives to hold this worktree's
  # .next dev-server lock for the next run.
  if [ -n "${NEXT_PORT:-}" ]; then
    for sig in TERM KILL; do
      leftover="$(lsof -ti:"$NEXT_PORT" 2>/dev/null || true)"
      [ -z "$leftover" ] || kill "-$sig" $leftover 2>/dev/null || true
      sleep 0.3
    done
  fi
  echo "Stopped Next.js (port $NEXT_PORT)"
  [ -z "$PROXY_PID" ] || { kill "$PROXY_PID" 2>/dev/null || true; wait "$PROXY_PID" 2>/dev/null || true; echo "Stopped proxy ($PROXY_PID)"; }
  [ -z "$PGRST_PID" ] || { kill "$PGRST_PID" 2>/dev/null || true; wait "$PGRST_PID" 2>/dev/null || true; echo "Stopped PostgREST ($PGRST_PID)"; }
  if [ "$DB_CREATED" = 1 ]; then
    "$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
      -c "drop database if exists $DB_NAME;" >/dev/null 2>&1 \
      && echo "Dropped database $DB_NAME" \
      || echo "WARNING: failed to drop database $DB_NAME -- drop it manually." >&2
  fi
  if [ "$ROLE_CREATED" = 1 ]; then
    "$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
      -c "drop role if exists $G4M5_ROLE;" >/dev/null 2>&1 \
      && echo "Dropped role $G4M5_ROLE" \
      || echo "WARNING: failed to drop role $G4M5_ROLE -- drop it manually." >&2
  fi
  if [ "$rc" != 0 ]; then
    echo "Logs preserved at: $LOG_DIR" >&2
  else
    rm -rf -- "$ROOT"
  fi
  exit "$rc"
}
trap cleanup EXIT INT TERM

run_sql() {
  local file="$1"
  echo "--- Running: $file ---"
  "$PSQL_BIN" -X -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file" >>"$LOG_DIR/sql.log" 2>&1 \
    || { echo "SQL step failed, see $LOG_DIR/sql.log" >&2; tail -n 60 "$LOG_DIR/sql.log" >&2; exit 1; }
}

echo "=== Creating dedicated database ==="
"$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "create database $DB_NAME;" >/dev/null
DB_CREATED=1
echo "PASS: created $DB_NAME"

# Real backlink_* migration files, in the exact order they exist in
# supabase/migrations/ -- same list scripts/backlinks-g4-m5-rls-test-harness/run_all.sh
# uses, duplicated here (read-only reference, that file is not modified) so
# Fix A/B are tested against the literal SQL that runs in Production.
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

echo "=== Applying schema: bootstrap, real migrations, fixtures, Fix A/B ==="
run_sql "$HARNESS_DIR/01_bootstrap_auth_and_roles.sql"
ROLE_CREATED=1
run_sql "$HARNESS_DIR/02_bootstrap_pre_migration_schema.sql"
for name in "${REAL_MIGRATION_FILES[@]}"; do
  run_sql "$MIGRATIONS_DIR/$name"
done
run_sql "$HARNESS_DIR/03_fixtures.sql"
run_sql "$FIX_A_FILE"
run_sql "$FIX_B_FILE"
run_sql "$HARNESS_DIR/04_local_service_role_bypass.sql"
echo "PASS: schema ready (Fix A + Fix B applied, both fixture sets loaded, local service_role compensation applied)"

echo "=== Fetching PostgREST ${PGRST_VERSION} (macOS x86-64, runs via Rosetta on this arm64 kernel) ==="
echo "NOTE: PostgREST publishes no checksum file or signature for this release (confirmed via GitHub API and its own release.yaml)."
echo "      Verification here is limited to: official github.com/PostgREST/postgrest/releases source + version/architecture confirmation."
archive="$PGRST_DIR/$PGRST_ASSET"
curl --fail --silent --show-error --location --output "$archive" "$PGRST_URL" \
  || block "Failed to download $PGRST_URL"
sha256="$(shasum -a 256 "$archive" | awk '{print $1}')"
echo "Downloaded $PGRST_ASSET from $PGRST_URL"
echo "SHA-256 (traceability only, NOT an independently verified authenticity proof): $sha256"
tar --extract --xz --file "$archive" --directory "$PGRST_DIR"
PGRST_BIN="$PGRST_DIR/postgrest"
[ -x "$PGRST_BIN" ] || block "postgrest binary missing after extraction"
case "$(file -b "$PGRST_BIN")" in *"x86_64"*) ;; *) block "Extracted PostgREST binary is not x86_64: $(file -b "$PGRST_BIN")" ;; esac
case "$("$PGRST_BIN" --version 2>&1)" in *"PostgREST ${PGRST_VERSION}"*) ;; *) block "PostgREST --version did not report ${PGRST_VERSION}: $("$PGRST_BIN" --version 2>&1)" ;; esac
echo "PASS: PostgREST ${PGRST_VERSION} macOS x86-64 binary confirmed by version and architecture (no official checksum exists to cross-check -- residual limitation)"

echo "=== Minting synthetic identities ==="
G4M5_HTTP_JWT_SECRET="$(openssl rand -hex 32)"
export G4M5_HTTP_JWT_SECRET
mint() { node "$HARNESS_DIR/mint_jwt.cjs" "$1"; }

ANON_KEY="$(mint '{"role":"anon"}')"
SERVICE_ROLE_KEY="$(mint '{"role":"service_role"}')"
TOKEN_P2="$(mint '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000003","email":"fixture-workspace-a-member@example.test"}')"
TOKEN_P3="$(mint '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000001","email":"fixture-workspace-a-owner@example.test"}')"
TOKEN_P4="$(mint '{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000001","email":"g4m5-http-harness-admin-no-member@example.test"}')"
TOKEN_P5_P7="$(mint '{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000002","email":"g4m5-http-harness-admin-member@example.test"}')"
TOKEN_P6="$(mint '{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000003","email":"g4m5-http-harness-admin-owner@example.test"}')"
ADMIN_EMAILS="g4m5-http-harness-admin-no-member@example.test,g4m5-http-harness-admin-member@example.test,g4m5-http-harness-admin-owner@example.test"
echo "PASS: 6 synthetic JWTs minted locally (HS256, random per-run secret -- never printed)"

pick_port() {
  local base="$1" port
  for _ in $(seq 1 50); do
    port=$(( base + RANDOM % 500 ))
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || { echo "$port"; return 0; }
  done
  return 1
}
PGRST_PORT="$(pick_port 41000)" || block "no free port near 41000"
PROXY_PORT="$(pick_port 42000)" || block "no free port near 42000"
NEXT_PORT="$(pick_port 43000)" || block "no free port near 43000"
echo "Ports: PostgREST=$PGRST_PORT proxy=$PROXY_PORT next=$NEXT_PORT (never 3000)"

echo "=== Starting PostgREST ==="
PGRST_DB_URI="postgresql://${G4M5_ROLE}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
PGRST_DB_SCHEMAS=public \
PGRST_DB_ANON_ROLE=anon \
PGRST_JWT_SECRET="$G4M5_HTTP_JWT_SECRET" \
PGRST_SERVER_HOST=127.0.0.1 \
PGRST_SERVER_PORT="$PGRST_PORT" \
"$PGRST_BIN" >"$LOG_DIR/postgrest.log" 2>&1 &
PGRST_PID=$!
for _ in $(seq 1 30); do
  if curl -sS -o /dev/null "http://127.0.0.1:$PGRST_PORT/" 2>/dev/null; then break; fi
  sleep 0.5
done
kill -0 "$PGRST_PID" 2>/dev/null || { tail -n 60 "$LOG_DIR/postgrest.log" >&2; die "PostgREST exited early"; }
echo "PASS: PostgREST listening on 127.0.0.1:$PGRST_PORT"

echo "=== Starting synthetic auth + REST proxy ==="
G4M5_PROXY_PORT="$PROXY_PORT" G4M5_PGRST_PORT="$PGRST_PORT" G4M5_HTTP_JWT_SECRET="$G4M5_HTTP_JWT_SECRET" \
node "$HARNESS_DIR/auth_rest_proxy.cjs" >"$LOG_DIR/proxy.log" 2>&1 &
PROXY_PID=$!
for _ in $(seq 1 30); do
  if curl -sS -o /dev/null "http://127.0.0.1:$PROXY_PORT/auth/v1/user" 2>/dev/null; then break; fi
  sleep 0.5
done
kill -0 "$PROXY_PID" 2>/dev/null || { tail -n 60 "$LOG_DIR/proxy.log" >&2; die "proxy exited early"; }
echo "PASS: synthetic auth+REST proxy listening on 127.0.0.1:$PROXY_PORT (NOT real Supabase Auth)"

echo "=== Starting Next.js (this worktree, isolated env) ==="
( cd "$REPO_ROOT" && \
  NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$PROXY_PORT" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  ADMIN_EMAILS="$ADMIN_EMAILS" \
  PORT="$NEXT_PORT" \
  "$REPO_ROOT/node_modules/.bin/next" dev -p "$NEXT_PORT" >"$LOG_DIR/next.log" 2>&1 & echo $! >"$ROOT/next.pid" )
NEXT_PID="$(cat "$ROOT/next.pid")"
READY=0
for _ in $(seq 1 90); do
  if curl -sS -o /dev/null "http://127.0.0.1:$NEXT_PORT/" 2>/dev/null; then READY=1; break; fi
  kill -0 "$NEXT_PID" 2>/dev/null || break
  sleep 1
done
kill -0 "$NEXT_PID" 2>/dev/null || { tail -n 80 "$LOG_DIR/next.log" >&2; die "Next.js exited early"; }
[ "$READY" = 1 ] || { tail -n 80 "$LOG_DIR/next.log" >&2; die "Next.js did not become ready in time"; }
echo "PASS: Next.js listening on 127.0.0.1:$NEXT_PORT (this worktree, port 3000 untouched)"

WORKSPACE_A="00000000-0000-0000-0000-00000000000a"
WORKSPACE_B="00000000-0000-0000-0000-00000000000b"
OUTREACH_A="35000000-0000-0000-0000-00000000000a"
ROUTE_URL="http://127.0.0.1:$NEXT_PORT/api/backlinks/outreach/$OUTREACH_A"

row_hash() {
  "$PSQL_BIN" -X -At -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "select md5(row(t.*)::text) from public.backlink_outreach t where id = '$OUTREACH_A';"
}

echo ""
echo "=== Running 7 HTTP profiles against $ROUTE_URL ==="
OVERALL_PASS=1
report() {
  # report <n> <desc> <expected> <got_status> <extra_detail>
  local n="$1" desc="$2" expected="$3" got="$4" extra="$5"
  if [[ "$got" =~ ^($expected)$ ]]; then
    printf "PASS profile %s: %-70s expected=%s got=%s %s\n" "$n" "$desc" "$expected" "$got" "$extra"
  else
    printf "FAIL profile %s: %-70s expected=%s got=%s %s\n" "$n" "$desc" "$expected" "$got" "$extra"
    OVERALL_PASS=0
  fi
}

# Profile 1: no authentication.
body1=$(mktemp); status1=$(curl -sS -o "$body1" -w '%{http_code}' "$ROUTE_URL" -H "X-Norixo-Workspace-Id: $WORKSPACE_A")
report 1 "no authentication" "401" "$status1" ""

# Profile 2: non-admin, workspace A member.
body2=$(mktemp); status2=$(curl -sS -o "$body2" -w '%{http_code}' "$ROUTE_URL" -H "Authorization: Bearer $TOKEN_P2" -H "X-Norixo-Workspace-Id: $WORKSPACE_A")
report 2 "non-admin, workspace A member" "403" "$status2" ""

# Profile 3: non-admin, workspace A owner.
body3=$(mktemp); status3=$(curl -sS -o "$body3" -w '%{http_code}' "$ROUTE_URL" -H "Authorization: Bearer $TOKEN_P3" -H "X-Norixo-Workspace-Id: $WORKSPACE_A")
report 3 "non-admin, workspace A owner" "403" "$status3" ""

# Profile 4: admin email, no membership in requested workspace A.
body4=$(mktemp); status4=$(curl -sS -o "$body4" -w '%{http_code}' "$ROUTE_URL" -H "Authorization: Bearer $TOKEN_P4" -H "X-Norixo-Workspace-Id: $WORKSPACE_A")
leak4="none"; grep -qi "Fixture outreach subject" "$body4" && leak4="LEAK DETECTED"
report 4 "admin email, no membership in workspace A" "403" "$status4" "cross-workspace-leak=$leak4"

# Profile 5: admin email, workspace A plain member, read.
body5=$(mktemp); status5=$(curl -sS -o "$body5" -w '%{http_code}' "$ROUTE_URL" -H "Authorization: Bearer $TOKEN_P5_P7" -H "X-Norixo-Workspace-Id: $WORKSPACE_A")
leakB5="none"; grep -q "$WORKSPACE_B" "$body5" && leakB5="LEAK DETECTED (workspace B id present)"
grep -q "Fixture outreach subject B" "$body5" && leakB5="LEAK DETECTED (workspace B subject present)"
report 5 "admin email, workspace A member, read" "200" "$status5" "cross-workspace-leak=$leakB5"

# Profile 6: admin email, workspace A admin, read.
body6=$(mktemp); status6=$(curl -sS -o "$body6" -w '%{http_code}' "$ROUTE_URL" -H "Authorization: Bearer $TOKEN_P6" -H "X-Norixo-Workspace-Id: $WORKSPACE_A")
report 6 "admin email, workspace A admin, read" "200" "$status6" ""

# Profile 7: admin email, workspace A plain member, write -- must be refused
# AND must not modify the row. Before/after comparison.
before_hash="$(row_hash)"
body7=$(mktemp); status7=$(curl -sS -o "$body7" -w '%{http_code}' -X PATCH "$ROUTE_URL" \
  -H "Authorization: Bearer $TOKEN_P5_P7" -H "X-Norixo-Workspace-Id: $WORKSPACE_A" \
  -H "Content-Type: application/json" \
  -d '{"subject":"G4-M5 HTTP harness unauthorized write attempt -- must not persist"}')
after_hash="$(row_hash)"
no_write="yes"; [ "$before_hash" = "$after_hash" ] || no_write="NO -- ROW CHANGED"
report 7 "admin email, workspace A member, write" "40[0-9]|50[0-9]" "$status7" "row-unchanged=$no_write"
[ "$no_write" = "yes" ] || OVERALL_PASS=0

echo ""
echo "=== Response bodies (first 300 chars each, for the report) ==="
for n in 1 2 3 4 5 6 7; do
  var="body$n"
  echo "--- profile $n ---"
  head -c 300 "${!var}"; echo
done

echo ""
if [ "$OVERALL_PASS" = 1 ]; then
  echo "=== OVERALL: PASS (all 7 profiles behaved as expected, no cross-workspace leak, no unauthorized write) ==="
else
  echo "=== OVERALL: FAIL (see FAIL lines above) ==="
fi
exit $(( 1 - OVERALL_PASS ))
