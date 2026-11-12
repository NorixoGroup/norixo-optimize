#!/usr/bin/env bash
# Isolated PostgreSQL 17 verification for BL-AUTO Lot E (campaign-apply
# authorization) only. It creates a throwaway local database and synthetic
# fixtures, then drops both.
set -euo pipefail
umask 077
unset DATABASE_URL LOCAL_DB_URL PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGDATABASE PGUSER PGPORT PGPASSWORD PGPASSFILE PGOPTIONS PGSSLMODE

die() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }
PG_BIN="${PG_BIN:-/usr/local/opt/postgresql@17/bin}"
SOCK="${PGSOCKET_DIR:-/tmp}"
PORT="${PGPORT_NUM:-5432}"
REPO=$(cd "$(dirname "$0")/.." && pwd -P)
MIG="$REPO/supabase/migrations/20261112090000_add_backlink_campaign_apply_authorization.sql"
PRIVATE="$REPO/supabase/migrations/20261028150000_create_norixo_private_admins_registry.sql"

[ -S "$SOCK/.s.PGSQL.$PORT" ] || die "no local PostgreSQL socket at $SOCK"
for bin in psql createdb dropdb; do [ -x "$PG_BIN/$bin" ] || die "missing $PG_BIN/$bin"; done
[ -f "$MIG" ] && [ -f "$PRIVATE" ] || die "migration missing"

suffix="lote_${$}_$(date +%s)"
db="blautolote_${suffix}"
owner="blautolote_owner_${suffix}"
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
  dry_run_only boolean not null default true,
  disabled_reason text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
SQL
as_owner -f "$PRIVATE" >/dev/null
as_owner -f "$MIG" >/dev/null
pass "Lot E migration applies on disposable PostgreSQL 17"

ws="10000000-0000-4000-8000-000000000001"
admin_user="00000000-0000-4000-8000-000000000001"
member_user="00000000-0000-4000-8000-000000000002"
outsider_admin="00000000-0000-4000-8000-000000000003"

as_owner <<SQL
insert into auth.users values ('$admin_user'), ('$member_user'), ('$outsider_admin');
insert into public.workspaces values ('$ws');
insert into public.workspace_members values ('$ws', '$admin_user', 'owner'), ('$ws', '$member_user', 'member');
insert into public.norixo_private_admins (user_id, email) values ('$admin_user', 'synthetic-admin@invalid'), ('$outsider_admin', 'synthetic-outsider@invalid');
-- dry_run_only stays true throughout: Lot E must never need, read as a
-- gate, or flip this flag to prove campaign-apply authorization works.
insert into public.automation_workspace_controls (workspace_id, backlinks_enabled, dry_run_only) values ('$ws', true, true);
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

grant_rpc="select campaign_apply_authorized_enabled from public.set_backlink_campaign_apply_authorization('$ws', true);"
revoke_rpc="select campaign_apply_authorized_enabled from public.set_backlink_campaign_apply_authorization('$ws', false);"
check_rpc="select public.is_backlink_campaign_apply_authorized('$ws');"

# --- A: rights — unauthenticated / member / outsider-admin / service_role all refused; only double-authorized admin grants ---
expect_error_call call_unauthenticated "CAMPAIGN_APPLY_AUTHORIZATION_UNAUTHORIZED" "$grant_rpc"
if out=$(call_as_service "$grant_rpc" 2>&1); then die "service_role unexpectedly called the authorization RPC"; fi
[[ "$out" == *"permission denied"* ]] || die "service_role refusal was not a permission denial: $out"
expect_error_as "$member_user" "CAMPAIGN_APPLY_AUTHORIZATION_UNAUTHORIZED" "$grant_rpc"
expect_error_as "$outsider_admin" "CAMPAIGN_APPLY_AUTHORIZATION_UNAUTHORIZED" "$grant_rpc"
if out=$(call_as "$admin_user" "$check_rpc" 2>&1); then die "authenticated caller unexpectedly called the service_role-only check RPC"; fi
[[ "$out" == *"permission denied"* ]] || die "authenticated-caller refusal of check RPC was not a permission denial: $out"
[ "$(call_as "$admin_user" "$grant_rpc" | tail -n 1)" = "t" ] || die "double-authorized grant failed"
[ "$(as_owner -Atc "select campaign_apply_authorized_by from public.automation_workspace_controls where workspace_id='$ws'")" = "$admin_user" ] || die "authorized_by not recorded"
pass "A: unauthenticated/member/outsider-admin and service_role all refused the grant RPC; authenticated callers refused the check RPC; double-authorized admin grants"

# --- Separation préparation/envoi: authorization is readable and true while dry_run_only stays true throughout; this migration never reads or writes dry_run_only ---
[ "$(call_as_service "$check_rpc" | tail -n 1)" = "t" ] || die "authorized check did not return true after grant"
[ "$(as_owner -Atc "select dry_run_only from public.automation_workspace_controls where workspace_id='$ws'")" = "t" ] || die "dry_run_only was unexpectedly changed"
pass "separation: campaign-apply authorization is independently true while dry_run_only remains true and untouched"

# --- Idempotence: repeated checks and a repeated identical grant are stable ---
[ "$(call_as_service "$check_rpc" | tail -n 1)" = "t" ] || die "repeated check #1 inconsistent"
[ "$(call_as_service "$check_rpc" | tail -n 1)" = "t" ] || die "repeated check #2 inconsistent"
[ "$(call_as "$admin_user" "$grant_rpc" | tail -n 1)" = "t" ] || die "idempotent re-grant failed"
[ "$(as_owner -Atc "select count(*) from public.automation_workspace_controls where workspace_id='$ws'")" = 1 ] || die "re-grant duplicated the control row"
pass "idempotence: repeated reads and a repeated identical grant leave exactly one, consistent control row"

# --- Révocation: revoke clears the stored grant and the live check flips to false immediately, uncached ---
[ "$(call_as "$admin_user" "$revoke_rpc" | tail -n 1)" = "f" ] || die "revocation failed"
[ "$(as_owner -Atc "select campaign_apply_authorized_by from public.automation_workspace_controls where workspace_id='$ws'")" = "" ] || die "authorized_by not cleared on revocation"
[ "$(call_as_service "$check_rpc" | tail -n 1)" = "f" ] || die "check did not immediately reflect revocation"
pass "révocation: revoking clears authorized_by/authorized_at and the live check flips to false with no caching"

# --- Staleness: rights withdrawn from the authorizing admin disable the live check without touching the stored grant row ---
[ "$(call_as "$admin_user" "$grant_rpc" | tail -n 1)" = "t" ] || die "re-grant before staleness tests failed"
as_owner -c "delete from public.norixo_private_admins where user_id = '$admin_user'" >/dev/null
[ "$(call_as_service "$check_rpc" | tail -n 1)" = "f" ] || die "check did not reflect private-admin-registry removal"
[ "$(as_owner -Atc "select campaign_apply_authorized_enabled from public.automation_workspace_controls where workspace_id='$ws'")" = "t" ] || die "stored grant row was unexpectedly touched by the staleness check"
as_owner -c "insert into public.norixo_private_admins (user_id, email) values ('$admin_user', 'synthetic-admin@invalid')" >/dev/null
[ "$(call_as_service "$check_rpc" | tail -n 1)" = "t" ] || die "check did not recover once private-admin rights were restored"

as_owner -c "update public.workspace_members set role = 'member' where workspace_id = '$ws' and user_id = '$admin_user'" >/dev/null
[ "$(call_as_service "$check_rpc" | tail -n 1)" = "f" ] || die "check did not reflect workspace-role demotion"
as_owner -c "update public.workspace_members set role = 'owner' where workspace_id = '$ws' and user_id = '$admin_user'" >/dev/null
[ "$(call_as_service "$check_rpc" | tail -n 1)" = "t" ] || die "check did not recover once the workspace role was restored"
pass "staleness: withdrawing either the private-admin registry entry or the workspace role disables the live check immediately; the stored grant row is never touched by the check; restoring rights restores the check"

# --- Concurrency: two genuinely concurrent grant/revoke calls for the same workspace never corrupt the row; the final state is exactly one of the two outcomes ---
race_a=$(mktemp "${TMPDIR:-/tmp}/blauto-lote-race-a.XXXXXX")
race_b=$(mktemp "${TMPDIR:-/tmp}/blauto-lote-race-b.XXXXXX")
trap 'rm -f "$race_a" "$race_b"; cleanup' EXIT
( call_as "$admin_user" "$grant_rpc" >"$race_a" 2>&1 ) &
first=$!
( call_as "$admin_user" "$revoke_rpc" >"$race_b" 2>&1 ) &
second=$!
wait "$first" || true
wait "$second" || true
out_a=$(tail -n 1 "$race_a")
out_b=$(tail -n 1 "$race_b")
[[ "$out_a" == "t" || "$out_a" == "f" ]] || die "race call A produced neither t nor f: $out_a"
[[ "$out_b" == "t" || "$out_b" == "f" ]] || die "race call B produced neither t nor f: $out_b"
final=$(as_owner -Atc "select campaign_apply_authorized_enabled from public.automation_workspace_controls where workspace_id='$ws'")
[ "$(as_owner -Atc "select count(*) from public.automation_workspace_controls where workspace_id='$ws'")" = 1 ] || die "race left more than one control row"
if [ "$final" = "t" ]; then
  [ -n "$(as_owner -Atc "select campaign_apply_authorized_by from public.automation_workspace_controls where workspace_id='$ws'")" ] || die "final enabled state has no authorized_by"
else
  [ -z "$(as_owner -Atc "select campaign_apply_authorized_by from public.automation_workspace_controls where workspace_id='$ws'")" ] || die "final disabled state still has authorized_by"
fi
pass "concurrency: two genuinely concurrent grant/revoke calls for the same workspace leave exactly one, internally consistent final state"
rm -f "$race_a" "$race_b"

echo "ALL BL-AUTO LOT E POSTGRESQL CHECKS PASSED"
