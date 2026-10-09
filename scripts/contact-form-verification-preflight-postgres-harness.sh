#!/usr/bin/env bash
set -euo pipefail

PG_BIN=/usr/local/opt/postgresql@16/bin
ROOT=$(mktemp -d /tmp/norixo-contact-form-preflight-pg.XXXXXX)
DATA="$ROOT/data"; SOCKET="$ROOT/socket"; PORT=55441; DB=a4_d8_7
cleanup() { "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$ROOT"; }
trap cleanup EXIT INT TERM
mkdir -m 700 "$DATA" "$SOCKET"
"$PG_BIN/initdb" --auth=trust --no-locale --encoding=UTF8 -D "$DATA" >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -o "-h '' -k '$SOCKET' -p $PORT" -w start >/dev/null
"$PG_BIN/createdb" -h "$SOCKET" -p "$PORT" "$DB"
psql() { "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h "$SOCKET" -p "$PORT" -d "$DB" "$@"; }
psql <<'SQL' >/dev/null
create extension pgcrypto; create schema auth;
create role anon nologin nobypassrls; create role authenticated nologin nobypassrls; create role service_role nologin nobypassrls;
create table auth.users(id uuid primary key); create table public.workspaces(id uuid primary key);
create table public.backlink_contacts(id uuid primary key,workspace_id uuid not null references public.workspaces(id),contact_form_url text);
create function public.is_workspace_admin_or_owner(p uuid) returns boolean language sql stable as $$select current_user='authenticated' and current_setting('app.workspace_id',true)=p::text and current_setting('app.workspace_admin',true)='true'$$;
insert into auth.users values('00000000-0000-0000-0000-000000000001');
insert into public.workspaces values('10000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000001');
insert into public.backlink_contacts values
('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','https://one.test/contact'),
('12000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','https://two.test/contact'),
('13000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','https://three.test/contact');
SQL
psql -f supabase/migrations/20261009120000_add_backlink_contact_form_verification_preflights.sql >/dev/null
psql <<'SQL' >/dev/null
create function assert_true(v boolean,m text) returns void language plpgsql as $$begin if not v then raise exception '%',m;end if;end$$;
insert into public.backlink_contact_form_verification_preflights(id,workspace_id,contact_id,form_url,idempotency_key,requested_by) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','https://one.test/contact','r1','00000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001','https://two.test/contact','r2','00000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001','https://three.test/contact','race','00000000-0000-0000-0000-000000000001');
do $$begin begin insert into public.backlink_contact_form_verification_preflights(workspace_id,contact_id,form_url,idempotency_key,requested_by) values('10000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','https://one.test/contact','dup','00000000-0000-0000-0000-000000000001');raise exception 'duplicate';exception when unique_violation then null;end;begin insert into public.backlink_contact_form_verification_preflights(workspace_id,contact_id,form_url,idempotency_key,requested_by) values('10000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','https://changed.test/contact','stale','00000000-0000-0000-0000-000000000001');raise exception 'stale';exception when others then if sqlerrm<>'CONTACT_FORM_PREFLIGHT_FORM_MISMATCH' then raise;end if;end;begin insert into public.backlink_contact_form_verification_preflights(workspace_id,contact_id,form_url,idempotency_key,requested_by) values('20000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','https://one.test/contact','cross','00000000-0000-0000-0000-000000000001');raise exception 'cross';exception when others then if sqlerrm<>'CONTACT_FORM_PREFLIGHT_FORM_MISMATCH' then raise;end if;end;end$$;
select assert_true((select status='running' and attempt_count=1 from public.claim_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','a','2026-10-09T12:00Z')),'claim');
select public.complete_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','a','failed','TEST','2026-10-09T12:01Z');
select assert_true((select status='failed' and attempt_count=1 from public.claim_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','a','2026-10-09T12:02Z')),'cooldown');
select public.claim_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','a','2026-10-09T12:17Z'); select public.complete_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','a','failed','TEST','2026-10-09T12:18Z');
select assert_true((select attempt_count=2 and status='failed' from public.claim_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','a','2026-10-09T12:40Z')),'max attempts');
set role authenticated; set app.workspace_id='10000000-0000-0000-0000-000000000001';set app.workspace_admin='true';select assert_true((select count(*)=3 from public.backlink_contact_form_verification_preflights),'admin rls');set app.workspace_admin='false';select assert_true((select count(*)=0 from public.backlink_contact_form_verification_preflights),'nonadmin rls');reset role;
set role anon;do $$begin perform public.claim_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','anon','2026-10-09T12:00Z');raise exception 'anon';exception when insufficient_privilege then null;end$$;reset role;
set role authenticated;do $$begin perform public.claim_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','auth','2026-10-09T12:00Z');raise exception 'auth';exception when insufficient_privilege then null;end$$;reset role;
set role service_role;select assert_true((select status='running' from public.claim_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','svc','2026-10-09T12:00Z')),'service');reset role;
SQL
psql -c "begin;select worker_id from public.claim_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','owner-a','2026-10-09T13:00Z');select pg_sleep(2);commit" >"$ROOT/a.out" & A=$!; sleep .3
psql -c "select worker_id from public.claim_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','owner-b','2026-10-09T13:00Z')" >"$ROOT/b.out" & B=$!; wait "$A"; wait "$B"
[ "$(rg -c '^ owner-a$' "$ROOT/a.out" || true)" = 1 ]; [ "$(rg -c '^ owner-b$' "$ROOT/b.out" || true)" = 0 ]
psql -Atqc "select count(*) from public.backlink_contact_form_verification_preflights where id='30000000-0000-0000-0000-000000000003' and worker_id='owner-a' and status='running' and attempt_count=1" | rg '^1$'
psql <<'SQL' >/dev/null
do $$begin perform public.complete_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','owner-b','verified','', '2026-10-09T13:01Z');raise exception 'loser completed';exception when others then if sqlerrm<>'CONTACT_FORM_PREFLIGHT_NOT_RUNNING' then raise;end if;end$$;
select assert_true((select status='running' and worker_id='owner-a' from public.backlink_contact_form_verification_preflights where id='30000000-0000-0000-0000-000000000003'),'winner preserved');
select public.complete_backlink_contact_form_verification_preflight('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','owner-a','verified','', '2026-10-09T13:02Z');
select assert_true((select status='verified' and worker_id='owner-a' from public.backlink_contact_form_verification_preflights where id='30000000-0000-0000-0000-000000000003'),'winner final');
SQL
echo 'PASS — contact-form verification preflight PostgreSQL harness'
