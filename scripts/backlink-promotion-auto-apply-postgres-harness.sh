#!/usr/bin/env bash
# Isolated PostgreSQL 17 verification for BL-AUTO Lot A only.
# It creates a throwaway local database and synthetic fixtures, then drops both.
set -euo pipefail
umask 077
unset DATABASE_URL LOCAL_DB_URL PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGDATABASE PGUSER PGPORT PGPASSWORD PGPASSFILE PGOPTIONS PGSSLMODE

die() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }
PG_BIN="${PG_BIN:-/usr/local/opt/postgresql@17/bin}"
SOCK="${PGSOCKET_DIR:-/tmp}"
PORT="${PGPORT_NUM:-5432}"
REPO=$(cd "$(dirname "$0")/.." && pwd -P)
MIG="$REPO/supabase/migrations/20261112080000_add_backlink_promotion_auto_apply.sql"
PRIVATE="$REPO/supabase/migrations/20261028150000_create_norixo_private_admins_registry.sql"

[ -S "$SOCK/.s.PGSQL.$PORT" ] || die "no local PostgreSQL socket at $SOCK"
for bin in psql createdb dropdb; do [ -x "$PG_BIN/$bin" ] || die "missing $PG_BIN/$bin"; done
[ -f "$MIG" ] && [ -f "$PRIVATE" ] || die "migration missing"

suffix="lota_${$}_$(date +%s)"
db="blautolota_${suffix}"
owner="blautolota_owner_${suffix}"
admin=("$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PORT" -d postgres)
as_owner() { "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PORT" -U "$owner" -d "$db" "$@"; }
cleanup() {
  "$PG_BIN/dropdb" -h "$SOCK" -p "$PORT" --if-exists --force "$db" >/dev/null 2>&1 || true
  "${admin[@]}" -c "drop role if exists \"$owner\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for role in anon authenticated service_role; do
  [ "$("${admin[@]}" -Atc "select count(*) from pg_roles where rolname='$role'")" = 1 ] || die "local role $role missing"
done
"${admin[@]}" -c "create role \"$owner\" login nosuperuser nocreatedb nocreaterole noinherit"
"${admin[@]}" -c "grant authenticated to \"$owner\""
"${admin[@]}" -c "grant service_role to \"$owner\""
"${admin[@]}" -c "create database \"$db\" owner \"$owner\""
as_owner -c "create schema extensions; create extension pgcrypto schema extensions; grant usage on schema extensions to \"$owner\"; grant usage on schema extensions to authenticated; grant usage on schema extensions to service_role"

as_owner <<'SQL'
create schema auth;
grant usage on schema auth to public;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.workspaces (id uuid primary key);
create table public.workspace_members (workspace_id uuid not null, user_id uuid not null, role text not null);
create function public.is_workspace_admin_or_owner(p_workspace_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = auth.uid() and role in ('owner', 'admin'))
$$;
create table public.automation_workspace_controls (
  workspace_id uuid primary key references public.workspaces(id),
  backlinks_enabled boolean not null default false,
  disabled_reason text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.automation_runs (id uuid primary key, workspace_id uuid not null references public.workspaces(id), system text not null, run_kind text not null, status text not null);
create table public.automation_tasks (id uuid primary key, workspace_id uuid not null references public.workspaces(id), run_id uuid not null references public.automation_runs(id), system text not null, task_kind text not null, status text not null, output jsonb);
create sequence public.backlink_domain_key_sequence;
create sequence public.backlink_opportunity_key_sequence;
create sequence public.backlink_activity_key_sequence;
create table public.backlink_assets (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), asset_key text not null, lifecycle_status text not null, unique (workspace_id, asset_key));
create table public.backlink_domains (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), domain_key text not null, hostname text not null, lifecycle_status text not null default 'active', created_by uuid);
create table public.backlink_opportunities (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  opportunity_key text not null, domain_id uuid not null references public.backlink_domains(id), asset_id uuid not null references public.backlink_assets(id),
  opportunity_type text not null, target_page_url text not null, target_page_title text not null, page_type text not null,
  evidence_summary text not null, qualification_status text not null, discovery_status text not null, editorial_status text not null,
  priority text not null, lifecycle_status text not null, convention_risk boolean not null, created_by uuid
);
create table public.backlink_activity (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  activity_key text not null, entity_type text not null, entity_id uuid not null, action_type text not null,
  actor_user_id uuid not null, reason text not null, metadata jsonb not null,
  constraint backlink_activity_action_type_check check (char_length(trim(action_type)) > 0)
);
create table public.backlink_promotion_applications (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  run_id uuid not null references public.automation_runs(id), promotion_task_id uuid not null references public.automation_tasks(id),
  proposal_key text not null, candidate_key text not null, domain_id uuid not null references public.backlink_domains(id),
  opportunity_id uuid not null references public.backlink_opportunities(id), promoted_by uuid not null, domain_disposition text not null, opportunity_disposition text not null,
  unique (workspace_id, promotion_task_id, proposal_key)
);
SQL
as_owner -f "$PRIVATE" >/dev/null
as_owner -f "$MIG" >/dev/null
pass "Lot A migration applies on disposable PostgreSQL 17"

ws="10000000-0000-4000-8000-000000000001"
ws_other="10000000-0000-4000-8000-000000000002"
admin_user="00000000-0000-4000-8000-000000000001"
member_user="00000000-0000-4000-8000-000000000002"
outsider_admin="00000000-0000-4000-8000-000000000003"
run1="40000000-0000-4000-8000-000000000001"
task1="70000000-0000-4000-8000-000000000001"
run2="40000000-0000-4000-8000-000000000002"
task2="70000000-0000-4000-8000-000000000002"
run3="40000000-0000-4000-8000-000000000003"
task3="70000000-0000-4000-8000-000000000003"

as_owner <<SQL
insert into auth.users values ('$admin_user'), ('$member_user'), ('$outsider_admin');
insert into public.workspaces values ('$ws'), ('$ws_other');
insert into public.workspace_members values ('$ws', '$admin_user', 'owner'), ('$ws', '$member_user', 'member');
insert into public.norixo_private_admins (user_id, email) values ('$admin_user', 'synthetic-admin@invalid'), ('$outsider_admin', 'synthetic-outsider@invalid');
insert into public.automation_workspace_controls (workspace_id, backlinks_enabled) values ('$ws', true), ('$ws_other', true);
insert into public.automation_runs values ('$run1', '$ws', 'backlinks', 'backlinks.autonomy', 'completed'), ('$run2', '$ws', 'backlinks', 'backlinks.autonomy', 'completed'), ('$run3', '$ws', 'backlinks', 'backlinks.autonomy', 'completed');
insert into public.backlink_assets (id, workspace_id, asset_key, lifecycle_status) values ('80000000-0000-4000-8000-000000000001', '$ws', 'calculator-one', 'active');
insert into public.automation_tasks (id, workspace_id, run_id, system, task_kind, status, output) values ('$task1', '$ws', '$run1', 'backlinks', 'backlinks.promotion.preview', 'completed', \$j\$
{
  "policyVersion": "backlink-promotion-v1",
  "proposals": [
    {"proposalKey":"p-eligible","candidateKey":"c-eligible","hostname":"example.com","targetPageUrl":"https://example.com/u1","targetPageTitle":"T1","opportunityType":"Resource Page","pageType":"Guide","priority":"Tier A","qualificationScore":90,"qualificationConfidence":"medium","evidenceSummary":"ev","suggestedAssetKey":"calculator-one","promotionDecision":"propose"},
    {"proposalKey":"p-tierb","candidateKey":"c-tierb","hostname":"example.com","targetPageUrl":"https://example.com/u2","targetPageTitle":"T2","opportunityType":"Resource Page","pageType":"Guide","priority":"Tier B","qualificationScore":75,"qualificationConfidence":"medium","evidenceSummary":"ev","suggestedAssetKey":"calculator-one","promotionDecision":"propose"},
    {"proposalKey":"p-lowconf","candidateKey":"c-lowconf","hostname":"example.com","targetPageUrl":"https://example.com/u3","targetPageTitle":"T3","opportunityType":"Resource Page","pageType":"Guide","priority":"Tier A","qualificationScore":90,"qualificationConfidence":"low","evidenceSummary":"ev","suggestedAssetKey":"calculator-one","promotionDecision":"propose"},
    {"proposalKey":"p-noasset","candidateKey":"c-noasset","hostname":"example.com","targetPageUrl":"https://example.com/u4","targetPageTitle":"T4","opportunityType":"Resource Page","pageType":"Guide","priority":"Tier A","qualificationScore":90,"qualificationConfidence":"medium","evidenceSummary":"ev","suggestedAssetKey":null,"promotionDecision":"propose"},
    {"proposalKey":"p-badasset","candidateKey":"c-badasset","hostname":"example.com","targetPageUrl":"https://example.com/u5","targetPageTitle":"T5","opportunityType":"Resource Page","pageType":"Guide","priority":"Tier A","qualificationScore":90,"qualificationConfidence":"medium","evidenceSummary":"ev","suggestedAssetKey":"does-not-exist","promotionDecision":"propose"},
    {"proposalKey":"conflict-a","candidateKey":"c-conflict-a","hostname":"example.com","targetPageUrl":"https://example.com/u6","targetPageTitle":"T6","opportunityType":"Resource Page","pageType":"Guide","priority":"Tier A","qualificationScore":90,"qualificationConfidence":"medium","evidenceSummary":"ev","suggestedAssetKey":"calculator-one","promotionDecision":"propose"},
    {"proposalKey":"conflict-b","candidateKey":"c-conflict-b","hostname":"example.com","targetPageUrl":"https://example.com/u6","targetPageTitle":"T6b","opportunityType":"Resource Page","pageType":"Guide","priority":"Tier A","qualificationScore":90,"qualificationConfidence":"medium","evidenceSummary":"ev","suggestedAssetKey":"calculator-one","promotionDecision":"propose"}
  ]
}
\$j\$::jsonb);
insert into public.automation_tasks (id, workspace_id, run_id, system, task_kind, status, output) values ('$task2', '$ws', '$run2', 'backlinks', 'backlinks.promotion.preview', 'completed', \$j\$
{
  "policyVersion": "backlink-promotion-v1",
  "proposals": [
    {"proposalKey":"p-cap2","candidateKey":"c-cap2","hostname":"example.com","targetPageUrl":"https://example.com/u7","targetPageTitle":"T7","opportunityType":"Resource Page","pageType":"Guide","priority":"Tier A","qualificationScore":90,"qualificationConfidence":"medium","evidenceSummary":"ev","suggestedAssetKey":"calculator-one","promotionDecision":"propose"}
  ]
}
\$j\$::jsonb);
insert into public.automation_tasks (id, workspace_id, run_id, system, task_kind, status, output) values ('$task3', '$ws', '$run3', 'backlinks', 'backlinks.promotion.preview', 'completed', \$j\$
{
  "policyVersion": "backlink-promotion-v1",
  "proposals": [
    {"proposalKey":"p-stale-a","candidateKey":"c-stale-a","hostname":"example.com","targetPageUrl":"https://example.com/u9","targetPageTitle":"T9","opportunityType":"Resource Page","pageType":"Guide","priority":"Tier A","qualificationScore":90,"qualificationConfidence":"medium","evidenceSummary":"ev","suggestedAssetKey":"calculator-one","promotionDecision":"propose"},
    {"proposalKey":"p-stale-b","candidateKey":"c-stale-b","hostname":"example.com","targetPageUrl":"https://example.com/u10","targetPageTitle":"T10","opportunityType":"Resource Page","pageType":"Guide","priority":"Tier A","qualificationScore":90,"qualificationConfidence":"medium","evidenceSummary":"ev","suggestedAssetKey":"calculator-one","promotionDecision":"propose"},
    {"proposalKey":"p-stale-c","candidateKey":"c-stale-c","hostname":"example.com","targetPageUrl":"https://example.com/u11","targetPageTitle":"T11","opportunityType":"Resource Page","pageType":"Guide","priority":"Tier A","qualificationScore":90,"qualificationConfidence":"medium","evidenceSummary":"ev","suggestedAssetKey":"calculator-one","promotionDecision":"propose"}
  ]
}
\$j\$::jsonb);
SQL

call_as() {
  local actor=$1 sql=$2
  as_owner -Atc "set role authenticated; set request.jwt.claim.sub = '$actor'; $sql"
}
call_unauthenticated() {
  local sql=$1
  as_owner -Atc "set role authenticated; $sql"
}
call_as_service() {
  local sql=$1
  as_owner -Atc "set role service_role; $sql"
}
expect_error_as() {
  local actor=$1 expected=$2 sql=$3
  local out
  if out=$(call_as "$actor" "$sql" 2>&1); then die "expected $expected, call succeeded"; fi
  [[ "$out" == *"$expected"* ]] || die "expected $expected, got: $out"
}
expect_error_call() {
  local caller_fn=$1 expected=$2 sql=$3
  local out
  if out=$("$caller_fn" "$sql" 2>&1); then die "expected $expected, call succeeded"; fi
  [[ "$out" == *"$expected"* ]] || die "expected $expected, got: $out"
}

auth_rpc="select promotion_auto_apply_enabled from public.set_backlink_promotion_auto_apply_authorization('$ws', true);"
apply_tpl="select application_id from public.apply_backlink_promotion_proposal_auto('$ws','$run1','$task1','__KEY__');"

# --- A: authorization grant/revoke, double-authorization, service_role cannot self-authorize ---
expect_error_call call_unauthenticated "PROMOTION_AUTO_APPLY_AUTHORIZATION_UNAUTHORIZED" "$auth_rpc"
if out=$(call_as_service "$auth_rpc" 2>&1); then die "service_role unexpectedly called the authorization RPC"; fi
[[ "$out" == *"permission denied"* ]] || die "service_role refusal was not a permission denial: $out"
expect_error_as "$member_user" "PROMOTION_AUTO_APPLY_AUTHORIZATION_UNAUTHORIZED" "$auth_rpc"
expect_error_as "$outsider_admin" "PROMOTION_AUTO_APPLY_AUTHORIZATION_UNAUTHORIZED" "$auth_rpc"
[ "$(call_as "$admin_user" "$auth_rpc" | tail -n 1)" = "t" ] || die "double-authorized grant failed"
[ "$(as_owner -Atc "select promotion_auto_apply_authorized_by from public.automation_workspace_controls where workspace_id='$ws'")" = "$admin_user" ] || die "authorized_by not recorded"
pass "A: unauthenticated/member/outsider-admin and service_role all refused; double-authorized admin grants"

# --- B: Tier/confidence/policy/asset/conflict all re-derived in SQL, never trusted ---
expect_error_call call_as_service "PROMOTION_AUTO_APPLY_PROPOSAL_NOT_ELIGIBLE" "${apply_tpl/__KEY__/p-tierb}"
expect_error_call call_as_service "PROMOTION_AUTO_APPLY_PROPOSAL_NOT_ELIGIBLE" "${apply_tpl/__KEY__/p-lowconf}"
expect_error_call call_as_service "PROMOTION_AUTO_APPLY_PROPOSAL_NOT_ELIGIBLE" "${apply_tpl/__KEY__/p-noasset}"
expect_error_call call_as_service "PROMOTION_AUTO_APPLY_ASSET_NOT_FOUND" "${apply_tpl/__KEY__/p-badasset}"
expect_error_call call_as_service "PROMOTION_AUTO_APPLY_CONFLICTING_PROPOSAL" "${apply_tpl/__KEY__/conflict-a}"
expect_error_as "$admin_user" "permission denied" "${apply_tpl/__KEY__/p-eligible}"
pass "B: Tier B, low confidence, missing/unknown asset, and sibling URL conflict all rejected from stored JSON alone; authenticated caller cannot invoke the auto-apply RPC"

# --- C/idempotence: eligible application succeeds, replay is idempotent, same-day cap blocks a second workspace application ---
first_app=$(call_as_service "${apply_tpl/__KEY__/p-eligible}" | tail -n 1)
[ -n "$first_app" ] || die "eligible application did not return an id"
replay_app=$(call_as_service "${apply_tpl/__KEY__/p-eligible}" | tail -n 1)
[ "$replay_app" = "$first_app" ] || die "replay returned a different application"
[ "$(as_owner -Atc "select count(*) from public.backlink_promotion_applications where workspace_id='$ws'")" = 1 ] || die "replay created a duplicate application"
[ "$(as_owner -Atc "select action_type from public.backlink_activity where entity_id = (select opportunity_id from public.backlink_promotion_applications where id='$first_app')")" = "automation_promotion_auto_applied" ] || die "audit action_type missing or wrong"
cap_tpl="select application_id from public.apply_backlink_promotion_proposal_auto('$ws','$run2','$task2','p-cap2');"
expect_error_call call_as_service "PROMOTION_AUTO_APPLY_WORKSPACE_LIMIT_REACHED" "$cap_tpl"
pass "idempotence: replay returns the same application without duplicating it; audit action_type compatible; same-day cap blocks a second, different, otherwise-eligible proposal"

# --- C/concurrency: two genuinely concurrent calls for two different eligible proposals in the same workspace never both succeed ---
as_owner -c "delete from public.backlink_promotion_applications where workspace_id='$ws'; update public.automation_workspace_controls set promotion_auto_apply_last_applied_date = null where workspace_id='$ws';" >/dev/null
race_a=$(mktemp "${TMPDIR:-/tmp}/blauto-lota-race-a.XXXXXX")
race_b=$(mktemp "${TMPDIR:-/tmp}/blauto-lota-race-b.XXXXXX")
trap 'rm -f "$race_a" "$race_b"; cleanup' EXIT
call_as_service "${apply_tpl/__KEY__/p-eligible}" >"$race_a" 2>&1 & first=$!
call_as_service "$cap_tpl" >"$race_b" 2>&1 & second=$!
wait "$first" || true; wait "$second" || true
out_a=$(cat "$race_a"); out_b=$(cat "$race_b")
success_count=0; fail_count=0
for out in "$out_a" "$out_b"; do
  if [[ "$out" =~ ^[0-9a-f-]{36}$ ]]; then success_count=$((success_count + 1));
  elif [[ "$out" == *"PROMOTION_AUTO_APPLY_WORKSPACE_LIMIT_REACHED"* ]]; then fail_count=$((fail_count + 1));
  fi
done
[ "$success_count" = "1" ] && [ "$fail_count" = "1" ] || die "concurrent cap outcome unsafe: a=$out_a b=$out_b"
pass "concurrency: exactly one of two genuinely concurrent, different-proposal applications for the same workspace succeeds on the same day"

# --- 1: a stale authorizing admin (private-admin rights withdrawn) blocks every new application, but a replay of an already-applied proposal still succeeds ---
as_owner -c "delete from public.backlink_promotion_applications where workspace_id='$ws'; update public.automation_workspace_controls set promotion_auto_apply_last_applied_date = null where workspace_id='$ws';" >/dev/null
stale_a_tpl="select application_id from public.apply_backlink_promotion_proposal_auto('$ws','$run3','$task3','p-stale-a');"
first_stale_app=$(call_as_service "$stale_a_tpl" | tail -n 1)
[ -n "$first_stale_app" ] || die "pre-revocation application did not return an id"
as_owner -c "delete from public.norixo_private_admins where user_id = '$admin_user';" >/dev/null
replay_stale_app=$(call_as_service "$stale_a_tpl" | tail -n 1)
[ "$replay_stale_app" = "$first_stale_app" ] || die "replay after private-admin revocation did not preserve idempotence"
expect_error_call call_as_service "PROMOTION_AUTO_APPLY_AUTHORIZATION_STALE" "select application_id from public.apply_backlink_promotion_proposal_auto('$ws','$run3','$task3','p-stale-b');"
as_owner -c "insert into public.norixo_private_admins (user_id, email) values ('$admin_user', 'synthetic-admin@invalid');" >/dev/null
pass "1: private-admin revocation blocks every new application while preserving idempotent replay of an already-applied one; restored afterward"

# --- 1: a stale authorizing admin (workspace role demoted) blocks every new application ---
as_owner -c "update public.workspace_members set role = 'member' where workspace_id = '$ws' and user_id = '$admin_user';" >/dev/null
expect_error_call call_as_service "PROMOTION_AUTO_APPLY_AUTHORIZATION_STALE" "select application_id from public.apply_backlink_promotion_proposal_auto('$ws','$run3','$task3','p-stale-c');"
as_owner -c "update public.workspace_members set role = 'owner' where workspace_id = '$ws' and user_id = '$admin_user';" >/dev/null
[ "$(as_owner -Atc "select count(*) from public.backlink_promotion_applications where proposal_key in ('p-stale-b','p-stale-c')")" = 0 ] || die "a stale-admin attempt unexpectedly created an application"
pass "1: workspace role demotion blocks every new application; no application was ever created while rights were stale"

# --- A: revocation blocks further auto-apply immediately, transactionally ---
as_owner -c "delete from public.backlink_promotion_applications where workspace_id='$ws'; update public.automation_workspace_controls set promotion_auto_apply_last_applied_date = null where workspace_id='$ws';" >/dev/null
revoke_rpc="select promotion_auto_apply_enabled from public.set_backlink_promotion_auto_apply_authorization('$ws', false);"
[ "$(call_as "$admin_user" "$revoke_rpc" | tail -n 1)" = "f" ] || die "revocation failed"
[ "$(as_owner -Atc "select promotion_auto_apply_authorized_by is null from public.automation_workspace_controls where workspace_id='$ws'")" = "t" ] || die "authorized_by not cleared on revocation"
expect_error_call call_as_service "PROMOTION_AUTO_APPLY_NOT_AUTHORIZED" "${apply_tpl/__KEY__/p-eligible}"
pass "A: revocation clears authorization and immediately blocks further auto-apply"

echo "ALL BL-AUTO LOT A POSTGRESQL CHECKS PASSED"
