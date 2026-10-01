-- A2 SQL behaviour check for the reservation-side initial email send gates (G03 + G04).
--
-- DISPOSABLE LOCAL DATABASE ONLY. This script creates fixture workspaces, users, campaigns,
-- contacts and outreach rows. It must never be run against a shared, staging or production
-- database. It refuses to run unless explicitly enabled:
--
--   PGOPTIONS="-c norixo.a2_sql_check_allowed=yes" psql -d <disposable_db> -f scripts/backlink-send-gates-a2-sql-check.sql
--
-- Prerequisite: the Backlinks migrations (including 20261001090000 and
-- 20261001150000_enforce_backlink_initial_email_send_gates.sql) are applied to that
-- disposable database. Prints one PASS/FAIL line per check.
do $$
begin
  if current_setting('norixo.a2_sql_check_allowed', true) is distinct from 'yes' then
    raise exception 'Refusing to run: this script only runs on a disposable database with norixo.a2_sql_check_allowed=yes';
  end if;
end $$;
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
create temp table results(name text, ok boolean, detail text);
create or replace function pg_temp.expect_error(p_name text, p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin execute p_sql; insert into results values (p_name, false, 'no error');
  exception when others then insert into results values (p_name, position(p_pattern in sqlerrm) > 0, left(sqlerrm,120)); end;
end $$;
create or replace function pg_temp.expect(p_name text, p_ok boolean, p_detail text default null) returns void language sql as $$ insert into results values (p_name, coalesce(p_ok,false), p_detail) $$;
create or replace function pg_temp.expect_ok(p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; insert into results values (p_name, true, null);
  exception when others then insert into results values (p_name, false, left(sqlerrm,120)); end;
end $$;

-- fixtures: one workspace per control scenario --------------------------------------------------
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000aa','admin@norixo.test');
insert into public.workspaces(id,name) values
 ('11111111-1111-1111-1111-111111111111','valid'),
 ('22222222-2222-2222-2222-222222222222','no-control-row'),
 ('33333333-3333-3333-3333-333333333333','backlinks-disabled'),
 ('44444444-4444-4444-4444-444444444444','dry-run');
insert into public.workspace_members(workspace_id,user_id,role)
 select id,'00000000-0000-0000-0000-0000000000aa','owner' from public.workspaces;
insert into automation_workspace_controls(workspace_id,backlinks_enabled,dry_run_only) values
 ('11111111-1111-1111-1111-111111111111',true,false),
 ('33333333-3333-3333-3333-333333333333',false,false),
 ('44444444-4444-4444-4444-444444444444',true,true);
insert into backlink_assets(workspace_id,asset_key,display_name,asset_type)
 select id,'asset-'||substr(id::text,1,2),'Asset','calculator' from public.workspaces;
insert into backlink_domains(workspace_id,domain_key,hostname)
 select id,'BK-0001',substr(id::text,1,2)||'.example' from public.workspaces;
insert into backlink_opportunities(workspace_id,opportunity_key,domain_id,asset_id,opportunity_type,target_page_url,target_page_title,page_type,evidence_summary)
 select d.workspace_id,'OP-000001',d.id,a.id,'resource','https://x.example/a','A','Blog Article','e'
 from backlink_domains d join backlink_assets a on a.workspace_id=d.workspace_id;
-- contacts + campaigns: campaign scenarios live in the valid workspace
insert into backlink_contacts(workspace_id,domain_id,contact_key,email_normalized,contact_status,source_type,source_reference)
 select d.workspace_id,d.id,'CT-000001','r'||substr(d.workspace_id::text,1,2)||'@x.test','verified','site','https://x.example/c' from backlink_domains d;
insert into backlink_campaigns(id,workspace_id,campaign_key,name,objective,owner_id,status,live_initial_send_enabled)
 select ('c0000000-0000-0000-0000-0000000000'||substr(w.id::text,1,2))::uuid,w.id,'BL-CAM-2026-001','C','o','00000000-0000-0000-0000-0000000000aa','active',true from public.workspaces w;
-- extra campaigns in the valid workspace for G04 scenarios
insert into backlink_campaigns(id,workspace_id,campaign_key,name,objective,owner_id,status,live_initial_send_enabled) values
 ('c1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','BL-CAM-2026-002','draft-live','o','00000000-0000-0000-0000-0000000000aa','draft',true),
 ('c1000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','BL-CAM-2026-003','active-notlive','o','00000000-0000-0000-0000-0000000000aa','active',false),
 ('c1000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','BL-CAM-2026-004','paused-live','o','00000000-0000-0000-0000-0000000000aa','paused',true),
 ('c1000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','BL-CAM-2026-005','draft-notlive','o','00000000-0000-0000-0000-0000000000aa','draft',false);
-- outreach rows (one per scenario; distinct contacts/opportunities where required)
insert into backlink_outreach(id,workspace_id,campaign_id,opportunity_id,contact_id,outreach_key,channel,status)
 select ('e0000000-0000-0000-0000-0000000000'||substr(c.workspace_id::text,1,2))::uuid,c.workspace_id,
   ('c0000000-0000-0000-0000-0000000000'||substr(c.workspace_id::text,1,2))::uuid,
   o.id,c.id,'BL-OUT-2026-001','email','ready'
 from backlink_contacts c join backlink_opportunities o on o.workspace_id=c.workspace_id;
insert into backlink_contacts(id,workspace_id,domain_id,contact_key,email_normalized,contact_status,source_type,source_reference)
 select ('b1000000-0000-0000-0000-00000000000'||n)::uuid,'11111111-1111-1111-1111-111111111111',d.id,'CT-00000'||(n+1),'g'||n||'@x.test','verified','site','https://x.example/c'
 from generate_series(1,4) n, backlink_domains d where d.workspace_id='11111111-1111-1111-1111-111111111111';
insert into backlink_outreach(id,workspace_id,campaign_id,opportunity_id,contact_id,outreach_key,channel,status)
 select ('e1000000-0000-0000-0000-00000000000'||n)::uuid,'11111111-1111-1111-1111-111111111111',('c1000000-0000-0000-0000-00000000000'||n)::uuid,
        o.id,('b1000000-0000-0000-0000-00000000000'||n)::uuid,'BL-OUT-2026-00'||(n+1),'email','ready'
 from generate_series(1,4) n, backlink_opportunities o where o.workspace_id='11111111-1111-1111-1111-111111111111';

-- helper to attempt an initial email reservation insert -----------------------------------------
create or replace function pg_temp.initial_attempt(p_ws text, p_outreach text, p_key text) returns text language sql as $$
 select format($f$insert into backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at) values (%L,%L,'00000000-0000-0000-0000-0000000000aa','email','resend','probe@x.test',%L,'initial','requested',now())$f$, p_ws, p_outreach, p_key)
$$;

-- G03 -----------------------------------------------------------------------------------------------
select pg_temp.expect_error('1 missing workspace control row => refused', pg_temp.initial_attempt('22222222-2222-2222-2222-222222222222','e0000000-0000-0000-0000-000000000022','k1'),'BACKLINK_SEND_WORKSPACE_CONTROL_MISSING');
select pg_temp.expect_error('2 backlinks_enabled=false => refused', pg_temp.initial_attempt('33333333-3333-3333-3333-333333333333','e0000000-0000-0000-0000-000000000033','k2'),'BACKLINK_SEND_BACKLINKS_DISABLED');
select pg_temp.expect_error('3 dry_run_only=true => refused', pg_temp.initial_attempt('44444444-4444-4444-4444-444444444444','e0000000-0000-0000-0000-000000000044','k3'),'BACKLINK_SEND_DRY_RUN');
-- G04 -----------------------------------------------------------------------------------------------
select pg_temp.expect_error('5 campaign draft + live=true => refused', pg_temp.initial_attempt('11111111-1111-1111-1111-111111111111','e1000000-0000-0000-0000-000000000001','k5'),'BACKLINK_SEND_CAMPAIGN_NOT_ACTIVE');
select pg_temp.expect_error('6 campaign active + live=false => refused', pg_temp.initial_attempt('11111111-1111-1111-1111-111111111111','e1000000-0000-0000-0000-000000000002','k6'),'BACKLINK_SEND_CAMPAIGN_LIVE_DISABLED');
select pg_temp.expect_error('5b campaign paused + live=true => refused', pg_temp.initial_attempt('11111111-1111-1111-1111-111111111111','e1000000-0000-0000-0000-000000000003','k5b'),'BACKLINK_SEND_CAMPAIGN_NOT_ACTIVE');
select pg_temp.expect_error('6b campaign draft + live=false => refused (not active first)', pg_temp.initial_attempt('11111111-1111-1111-1111-111111111111','e1000000-0000-0000-0000-000000000004','k6b'),'BACKLINK_SEND_CAMPAIGN_NOT_ACTIVE');
select pg_temp.expect_ok('4+7 valid controls + campaign active + live=true => reservation passes', pg_temp.initial_attempt('11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000011','k7'));
select pg_temp.expect('4b the valid reservation row exists', exists(select 1 from backlink_outreach_attempts where idempotency_key='k7'));
-- refusals leave no attempt behind
select pg_temp.expect('refused reservations persist nothing', not exists(select 1 from backlink_outreach_attempts where idempotency_key in ('k1','k2','k3','k5','k6','k5b','k6b')));

-- scope: only INITIAL EMAIL attempts are gated ----------------------------------------------------------------
select pg_temp.expect_ok('9a linkedin initial attempt unaffected (no control row, draft campaign)', $q$insert into backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at) values ('22222222-2222-2222-2222-222222222222','e0000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-0000000000aa','linkedin','manual','https://linkedin.example/in/x','k9a','initial','requested',now())$q$);
select pg_temp.expect_ok('9b contact_form initial attempt unaffected', $q$insert into backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at) values ('33333333-3333-3333-3333-333333333333','e0000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-0000000000aa','contact_form','automated_contact_form','https://x.example/contact','k9b','initial','requested',now())$q$);
-- follow-up lifecycle unchanged by A2: preparing and requesting a follow-up on a DRAFT campaign is not touched by this trigger
-- (the existing follow-up RPC keeps its own workspace + active-campaign requirements)
select pg_temp.expect_ok('8a follow-up prepared attempt insert not gated by the A2 trigger', $q$insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,prepared_at) values ('f0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','e1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000aa','email','resend','fu@x.test','k8','follow_up','prepared',now())$q$);
select pg_temp.expect_ok('8b follow-up prepared->requested transition not gated by the A2 trigger', $q$update backlink_outreach_attempts set status='requested', requested_at=now() where id='f0000000-0000-0000-0000-000000000001'$q$);
select pg_temp.expect('8c A2 trigger fires on INSERT only', (select tgtype & 4 = 4 and tgtype & 16 = 0 from pg_trigger where tgname='trg_backlink_outreach_attempts_enforce_initial_email_send_gates'));

-- A1 interplay: suppression still refuses under fully valid gates -------------------------------------------------
insert into backlink_email_suppressions(workspace_id,email_normalized,reason,source) values ('11111111-1111-1111-1111-111111111111','probe@x.test','unsubscribed','admin_unsubscribe');
select pg_temp.expect_error('9 recipient suppressed before reservation => refused (A1 gate, valid A2 gates)', pg_temp.initial_attempt('11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000011','k9'),'BACKLINK_EMAIL_SUPPRESSED');

select name || ' :: ' || case when ok then 'PASS' else 'FAIL' end || coalesce('  ('||detail||')','') from results order by name;
select 'TOTAL pass=' || count(*) filter (where ok) || ' fail=' || count(*) filter (where not ok) from results;
