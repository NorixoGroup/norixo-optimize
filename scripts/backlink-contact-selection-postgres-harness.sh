#!/usr/bin/env bash
# Isolated PostgreSQL 17 verification for BL-AUTO 5F only.
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
MIG="$REPO/supabase/migrations/20261110100000_add_backlink_contact_selection_decisions.sql"
PRIVATE="$REPO/supabase/migrations/20261028150000_create_norixo_private_admins_registry.sql"

[ -S "$SOCK/.s.PGSQL.$PORT" ] || die "no local PostgreSQL socket at $SOCK"
for bin in psql createdb dropdb; do [ -x "$PG_BIN/$bin" ] || die "missing $PG_BIN/$bin"; done
[ -f "$MIG" ] && [ -f "$PRIVATE" ] || die "migration missing"

suffix="selection_${$}_$(date +%s)"
db="blauto5f_${suffix}"
owner="blauto5f_owner_${suffix}"
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
as_owner -c "create schema extensions; create extension pgcrypto schema extensions; grant usage on schema extensions to \"$owner\"; grant usage on schema extensions to authenticated"

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
create table public.backlink_domains (id uuid primary key, workspace_id uuid not null references public.workspaces(id));
create table public.backlink_opportunities (id uuid primary key, workspace_id uuid not null references public.workspaces(id), domain_id uuid not null references public.backlink_domains(id));
create table public.automation_runs (id uuid primary key, workspace_id uuid not null references public.workspaces(id), system text not null, run_kind text not null, status text not null);
create table public.automation_tasks (id uuid primary key, workspace_id uuid not null references public.workspaces(id), run_id uuid not null references public.automation_runs(id), system text not null, task_kind text not null, status text not null, input jsonb not null, output jsonb);
create table public.backlink_promotion_applications (id uuid primary key, workspace_id uuid not null references public.workspaces(id), domain_id uuid not null references public.backlink_domains(id), opportunity_id uuid not null references public.backlink_opportunities(id));
create table public.backlink_contacts (id uuid primary key, workspace_id uuid not null references public.workspaces(id), domain_id uuid not null references public.backlink_domains(id), contact_status text not null, archived_at timestamptz, do_not_contact_at timestamptz);
SQL
as_owner -f "$PRIVATE" >/dev/null
as_owner -f "$MIG" >/dev/null
pass "5F migration applies on disposable PostgreSQL 17"

as_owner <<'SQL'
create schema tt;
create table tt.ids (ws uuid, other_ws uuid, private_admin uuid, plain_member uuid, private_outsider uuid, app uuid, run uuid, task uuid, c1 uuid, c2 uuid, c3 uuid);
insert into auth.users values
 ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002'), ('00000000-0000-4000-8000-000000000003');
insert into public.workspaces values ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
insert into public.workspace_members values
 ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner'),
 ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'member');
insert into public.norixo_private_admins (user_id, email) values
 ('00000000-0000-4000-8000-000000000001', 'synthetic-owner@invalid'),
 ('00000000-0000-4000-8000-000000000003', 'synthetic-outsider@invalid');
insert into public.backlink_domains values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
insert into public.backlink_opportunities values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
insert into public.automation_runs values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'backlinks', 'backlinks.autonomy', 'completed');
insert into public.backlink_promotion_applications values ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
insert into public.backlink_contacts values
 ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'unverified', null, null),
 ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'unverified', null, null),
 ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'do_not_contact', null, now());
insert into public.automation_tasks values (
 '70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'backlinks', 'backlinks.contact_resolution', 'completed',
 jsonb_build_object('promotionApplicationId','50000000-0000-4000-8000-000000000001','opportunityId','30000000-0000-4000-8000-000000000001','domainId','20000000-0000-4000-8000-000000000001'),
 jsonb_build_object('createdContactIds',jsonb_build_array('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002'),'existingContactIds','[]'::jsonb)
);
insert into public.automation_tasks values (
 '70000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'backlinks', 'backlinks.contact_resolution', 'completed',
 jsonb_build_object('promotionApplicationId','50000000-0000-4000-8000-000000000001','opportunityId','30000000-0000-4000-8000-000000000001','domainId','20000000-0000-4000-8000-000000000001'),
 jsonb_build_object('createdContactIds',jsonb_build_array('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000003'),'existingContactIds','[]'::jsonb)
);
insert into public.automation_tasks values (
 '70000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'backlinks', 'backlinks.contact_resolution', 'completed',
 jsonb_build_object('promotionApplicationId','50000000-0000-4000-8000-000000000001','opportunityId','30000000-0000-4000-8000-000000000001','domainId','20000000-0000-4000-8000-000000000001'),
 jsonb_build_object('createdContactIds',jsonb_build_array('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002'),'existingContactIds','[]'::jsonb)
);
create function tt.fingerprint(p_task uuid) returns text language sql stable security definer set search_path = '' as $$
  select encode(extensions.digest('backlink-contact-selection-v1|workspace=' || t.workspace_id::text || '|promotion=' || (t.input->>'promotionApplicationId') || '|task=' || t.id::text || '|candidates=' || string_agg(value::uuid::text, ',' order by value::uuid), 'sha256'), 'hex')
  from public.automation_tasks t cross join lateral (
    select value from jsonb_array_elements_text(t.output->'createdContactIds') union select value from jsonb_array_elements_text(t.output->'existingContactIds')
  ) c where t.id=p_task group by t.id
$$;
grant usage on schema tt to authenticated;
grant execute on function tt.fingerprint(uuid) to authenticated;
SQL

call_as() {
  local actor=$1; shift
  as_owner -Atc "set role authenticated; set request.jwt.claim.sub = '$actor'; $*"
}
call_as_service() {
  as_owner -Atc "set role service_role; $*"
}
expect_error() {
  local actor=$1 expected=$2; shift 2
  local out
  if out=$(call_as "$actor" "$*" 2>&1); then die "expected $expected"; fi
  [[ "$out" == *"$expected"* ]] || die "expected $expected, got: $out"
}
rpc="select disposition from public.record_backlink_contact_selection_decision('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',tt.fingerprint('70000000-0000-4000-8000-000000000001'),'selection-key-0001','HUMAN_REVIEW_SELECTED',true);"
stale_rpc="select disposition from public.record_backlink_contact_selection_decision('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001',repeat('0',64),'stale-fingerprint-01','HUMAN_REVIEW_SELECTED',true);"
dnc_rpc="select disposition from public.record_backlink_contact_selection_decision('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000003',tt.fingerprint('70000000-0000-4000-8000-000000000002'),'dnc-contact-key-01','HUMAN_REVIEW_SELECTED',true);"
race_rpc="select disposition from public.record_backlink_contact_selection_decision('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000001',tt.fingerprint('70000000-0000-4000-8000-000000000003'),'concurrent-key-001','HUMAN_REVIEW_SELECTED',true);"
bad_promotion_rpc="select disposition from public.record_backlink_contact_selection_decision('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000099','70000000-0000-4000-8000-000000000002',null,repeat('a',64),'bad-promotion-key1','HUMAN_REVIEW_REJECTED_NO_APPROPRIATE_CONTACT',true);"
bad_task_rpc="select disposition from public.record_backlink_contact_selection_decision('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000099',null,repeat('a',64),'bad-source-task01','HUMAN_REVIEW_REJECTED_NO_APPROPRIATE_CONTACT',true);"

expect_error "" "BACKLINK_CONTACT_SELECTION_INVALID_INPUT" "$rpc"
if service_output=$(call_as_service "$rpc" 2>&1); then die "service_role unexpectedly called the RPC"; fi
[[ "$service_output" == *"permission denied"* ]] || die "service_role refusal was not a permission denial: $service_output"
expect_error "00000000-0000-4000-8000-000000000002" "BACKLINK_CONTACT_SELECTION_FORBIDDEN" "$rpc"
expect_error "00000000-0000-4000-8000-000000000003" "BACKLINK_CONTACT_SELECTION_FORBIDDEN" "$rpc"
expect_error "00000000-0000-4000-8000-000000000001" "BACKLINK_CONTACT_SELECTION_FORBIDDEN" "${rpc/10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002}"
expect_error "00000000-0000-4000-8000-000000000001" "permission denied" "insert into public.backlink_contact_selection_decisions (workspace_id,promotion_application_id,source_autonomy_run_id,source_resolution_task_id,decision_status,candidate_fingerprint,candidate_count,reason_code,idempotency_key,decided_by) values ('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','promotion_rejected',repeat('a',64),2,'HUMAN_REVIEW_REJECTED_NO_APPROPRIATE_CONTACT','direct-write-key-01','00000000-0000-4000-8000-000000000001');"
expect_error "00000000-0000-4000-8000-000000000001" "permission denied" "update public.backlink_contact_selection_decisions set reason_code = 'HUMAN_REVIEW_SELECTED';"
expect_error "00000000-0000-4000-8000-000000000001" "permission denied" "delete from public.backlink_contact_selection_decisions;"
pass "RLS/authorization: unauthenticated, member, private outsider and direct write refused"

[ "$(call_as "00000000-0000-4000-8000-000000000001" "$rpc" | tail -n 1)" = "created" ] || die "authorized create failed"
[ "$(call_as "00000000-0000-4000-8000-000000000001" "$rpc" | tail -n 1)" = "replayed" ] || die "identical replay failed"
expect_error "00000000-0000-4000-8000-000000000001" "BACKLINK_CONTACT_SELECTION_IDEMPOTENCY_CONFLICT" "${rpc/60000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000002}"
expect_error "00000000-0000-4000-8000-000000000001" "BACKLINK_CONTACT_SELECTION_ALREADY_DECIDED" "${rpc/selection-key-0001/selection-key-0002}"
expect_error "00000000-0000-4000-8000-000000000001" "BACKLINK_CONTACT_SELECTION_FINGERPRINT_STALE" "$stale_rpc"
expect_error "00000000-0000-4000-8000-000000000001" "BACKLINK_CONTACT_SELECTION_CONTACT_INELIGIBLE" "$dnc_rpc"
expect_error "00000000-0000-4000-8000-000000000001" "BACKLINK_CONTACT_SELECTION_PROMOTION_SCOPE_INVALID" "$bad_promotion_rpc"
expect_error "00000000-0000-4000-8000-000000000001" "BACKLINK_CONTACT_SELECTION_SOURCE_TASK_INVALID" "$bad_task_rpc"
pass "integrity/idempotence: canonical replay, stale fingerprint, duplicate source and DNC refusal"

race_a=$(mktemp "${TMPDIR:-/tmp}/blauto5f-race-a.XXXXXX")
race_b=$(mktemp "${TMPDIR:-/tmp}/blauto5f-race-b.XXXXXX")
trap 'rm -f "$race_a" "$race_b"; cleanup' EXIT
call_as "00000000-0000-4000-8000-000000000001" "$race_rpc" >"$race_a" & first=$!
call_as "00000000-0000-4000-8000-000000000001" "$race_rpc" >"$race_b" & second=$!
wait "$first"; wait "$second"
race=$(cat "$race_a" "$race_b" | grep -E '^(created|replayed)$' | sort | tr '\n' ',')
[ "$race" = "created,replayed," ] || die "concurrent same-source outcome unsafe: $race"
pass "concurrency: exactly one decision and one replay for the same source/key"

[ "$(as_owner -Atc 'select count(*) from public.backlink_contact_selection_decisions')" = 2 ] || die "decision duplicate"
[ "$(as_owner -Atc 'select count(*) from public.backlink_contact_selection_events')" = 4 ] || die "event count incorrect"
[ "$(call_as "00000000-0000-4000-8000-000000000002" 'select count(*) from public.backlink_contact_selection_decisions' | tail -n 1)" = 0 ] || die "member read leaked"
[ "$(call_as "00000000-0000-4000-8000-000000000003" 'select count(*) from public.backlink_contact_selection_decisions' | tail -n 1)" = 0 ] || die "private outsider read leaked"
[ "$(call_as "00000000-0000-4000-8000-000000000001" 'select count(*) from public.backlink_contact_selection_decisions' | tail -n 1)" = 2 ] || die "double-authorized read missing"
[ "$(as_owner -Atc "select count(*) from public.automation_runs where id='40000000-0000-4000-8000-000000000001' and status='completed'")" = 1 ] || die "run changed"
[ "$(as_owner -Atc "select count(*) from public.automation_tasks where status='completed'")" = 3 ] || die "task changed"
if as_owner -c "update public.backlink_contact_selection_decisions set reason_code='HUMAN_REVIEW_SELECTED'" >/dev/null 2>&1; then die "decision update unexpectedly allowed"; fi
if as_owner -c "delete from public.backlink_contact_selection_events" >/dev/null 2>&1; then die "event delete unexpectedly allowed"; fi
pass "audit immutable; no run or task state changed"

echo "ALL BL-AUTO 5F POSTGRESQL CHECKS PASSED"
