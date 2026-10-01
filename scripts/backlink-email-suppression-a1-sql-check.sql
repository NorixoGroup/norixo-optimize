-- A1 SQL behaviour check for workspace-wide email suppression and unsubscribe.
--
-- DISPOSABLE LOCAL DATABASE ONLY. This script creates fixture workspaces, users,
-- contacts and outreach rows. It must never be run against a shared, staging or
-- production database. It refuses to run unless explicitly enabled:
--
--   PGOPTIONS="-c norixo.a1_sql_check_allowed=yes" psql -d <disposable_db> -f scripts/backlink-email-suppression-a1-sql-check.sql
--
-- Prerequisite: the Backlinks migrations (including
-- 20261001090000_add_backlink_email_suppression_and_unsubscribe.sql) are applied
-- to that disposable database. Prints one PASS/FAIL line per check.
do $$
begin
  if current_setting('norixo.a1_sql_check_allowed', true) is distinct from 'yes' then
    raise exception 'Refusing to run: this script only runs on a disposable database with norixo.a1_sql_check_allowed=yes';
  end if;
end $$;
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
create temp table results(name text, ok boolean, detail text);
create or replace function pg_temp.expect_error(p_name text, p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin execute p_sql; insert into results values (p_name, false, 'no error');
  exception when others then insert into results values (p_name, position(p_pattern in sqlerrm) > 0 or position(p_pattern in coalesce(sqlstate,''))>0, left(sqlerrm,120)); end;
end $$;
create or replace function pg_temp.expect(p_name text, p_ok boolean, p_detail text default null) returns void language sql as $$ insert into results values (p_name, coalesce(p_ok,false), p_detail) $$;

-- fixtures -----------------------------------------------------------------
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000aa','admin@norixo.test');
insert into public.workspaces(id,name) values ('11111111-1111-1111-1111-111111111111','W1'),('22222222-2222-2222-2222-222222222222','W2');
insert into public.workspace_members(workspace_id,user_id,role) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000aa','owner'),('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-0000000000aa','owner');
-- A2 reservation gates require an explicit live-enabled workspace control row (these checks exercise suppression, not the gates).
insert into automation_workspace_controls(workspace_id,backlinks_enabled,dry_run_only) values ('11111111-1111-1111-1111-111111111111',true,false),('22222222-2222-2222-2222-222222222222',true,false);
insert into backlink_assets(id,workspace_id,asset_key,display_name,asset_type) values
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','asset-w1','Asset','calculator'),
 ('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','asset-w2','Asset','calculator');
insert into backlink_domains(id,workspace_id,domain_key,hostname) values
 ('d0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','BK-0001','one.example'),
 ('d0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','BK-0002','two.example'),
 ('d0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','BK-0001','three.example');
insert into backlink_opportunities(id,workspace_id,opportunity_key,domain_id,asset_id,opportunity_type,target_page_url,target_page_title,page_type,evidence_summary) values
 ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','OP-000001','d0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','resource','https://one.example/a','A','Blog Article','e'),
 ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','OP-000002','d0000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','resource','https://two.example/a','A','Blog Article','e'),
 ('a0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','OP-000001','d0000000-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000002','resource','https://three.example/a','A','Blog Article','e');
insert into backlink_campaigns(id,workspace_id,campaign_key,name,objective,owner_id,status,live_initial_send_enabled) values
 ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','BL-CAM-2026-001','C1','o','00000000-0000-0000-0000-0000000000aa','active',true),
 ('c0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','BL-CAM-2026-002','C2','o','00000000-0000-0000-0000-0000000000aa','active',true),
 ('c0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','BL-CAM-2026-001','C3','o','00000000-0000-0000-0000-0000000000aa','active',true);
-- contacts: same address a@x.test under two domains of W1 (different campaigns) and once in W2
insert into backlink_contacts(id,workspace_id,domain_id,contact_key,email_normalized,contact_status,source_type,source_reference) values
 ('b0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000001','CT-000001','a@x.test','verified','site','https://one.example/contact'),
 ('b0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000002','CT-000002','a@x.test','verified','site','https://two.example/contact'),
 ('b0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000001','CT-000003','neg@x.test','verified','site','https://one.example/contact'),
 ('b0000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','d0000000-0000-0000-0000-000000000003','CT-000001','a@x.test','verified','site','https://three.example/contact'),
 ('b0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000001','CT-000005','manual@x.test','verified','site','https://one.example/contact'),
 ('b0000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000001','CT-000006','bounce@x.test','verified','site','https://one.example/contact'),
 ('b0000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000001','CT-000007','complaint@x.test','verified','site','https://one.example/contact'),
 ('b0000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','d0000000-0000-0000-0000-000000000001','CT-000008','late@x.test','verified','site','https://one.example/contact');
insert into backlink_outreach(id,workspace_id,campaign_id,opportunity_id,contact_id,outreach_key,channel,status,current_attempt,first_contact_at,last_attempt_at) values
 ('e0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','BL-OUT-2026-001','email','active',1,now(),now()),
 ('e0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','BL-OUT-2026-002','email','draft',0,null,null),
 ('e0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','BL-OUT-2026-003','email','active',1,now(),now()),
 ('e0000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000004','BL-OUT-2026-001','email','active',1,now(),now()),
 ('e0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','BL-OUT-2026-005','email','active',1,now(),now()),
 ('e0000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','BL-OUT-2026-006','email','active',1,now(),now()),
 ('e0000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','BL-OUT-2026-007','email','active',1,now(),now()),
 ('e0000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000008','BL-OUT-2026-008','email','active',1,now(),now());

-- 1. uniqueness + normalization -------------------------------------------------
select pg_temp.expect('1a baseline: no suppression yet', (select count(*) from backlink_email_suppressions)=0);
insert into backlink_email_suppressions(workspace_id,email_normalized,reason,source) values ('11111111-1111-1111-1111-111111111111','dup@x.test','unsubscribed','admin_unsubscribe');
select pg_temp.expect_error('1b duplicate (workspace,email) rejected',$q$insert into backlink_email_suppressions(workspace_id,email_normalized,reason,source) values ('11111111-1111-1111-1111-111111111111','dup@x.test','unsubscribed','admin_unsubscribe')$q$,'backlink_email_suppressions_workspace_email_unique');
select pg_temp.expect_error('1c non-normalized email rejected',$q$insert into backlink_email_suppressions(workspace_id,email_normalized,reason,source) values ('11111111-1111-1111-1111-111111111111','Dup2@X.test','unsubscribed','admin_unsubscribe')$q$,'backlink_email_suppressions_email_check');
insert into backlink_email_suppressions(workspace_id,email_normalized,reason,source) values ('22222222-2222-2222-2222-222222222222','dup@x.test','unsubscribed','admin_unsubscribe');
select pg_temp.expect('1d same address in another workspace is independent', (select count(*) from backlink_email_suppressions where email_normalized='dup@x.test')=2);

-- 6. negative response does not suppress ------------------------------------------
update backlink_outreach set status='declined', last_response_type='negative', closed_at=now(), stop_reason='declined_by_contact', next_follow_up_at=null where id='e0000000-0000-0000-0000-000000000003';
select pg_temp.expect('6 negative closes outreach', (select status from backlink_outreach where id='e0000000-0000-0000-0000-000000000003')='declined');
select pg_temp.expect('6 negative does NOT suppress address', not exists(select 1 from backlink_email_suppressions where email_normalized='neg@x.test'));
select pg_temp.expect('6 negative leaves contact contactable', (select contact_status from backlink_contacts where id='b0000000-0000-0000-0000-000000000003')='verified');

-- 7. manual explicit unsubscribe response -> global suppression ----------------------
update backlink_outreach set status='closed', last_response_type='unsubscribed', closed_at=now(), stop_reason='unsubscribed', next_follow_up_at=null where id='e0000000-0000-0000-0000-000000000005';
select pg_temp.expect('7 explicit unsubscribed response suppresses address', exists(select 1 from backlink_email_suppressions where workspace_id='11111111-1111-1111-1111-111111111111' and email_normalized='manual@x.test' and reason='unsubscribed' and source='outreach_response'));
select pg_temp.expect('7 contact marked do_not_contact', (select contact_status from backlink_contacts where id='b0000000-0000-0000-0000-000000000005')='do_not_contact');

-- prepared follow-up for a@x.test BEFORE unsubscribe ---------------------------------
insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,prepared_at) values
 ('f0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000aa','email','resend','a@x.test','k-fu-1','follow_up','prepared',now());

-- 5 + 10. hosted unsubscribe RPC: idempotent, closes other campaigns, W2 untouched ------
create temp table r1 as select * from apply_backlink_outreach_unsubscribe('11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000001','hosted_unsubscribe');
create temp table r2 as select * from apply_backlink_outreach_unsubscribe('11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000001','hosted_unsubscribe');
select pg_temp.expect('5a first unsubscribe applied', (select disposition from r1)='applied', (select closed_outreach_count::text from r1));
select pg_temp.expect('5b repeated unsubscribe is idempotent (existing)', (select disposition from r2)='existing');
select pg_temp.expect('5c exactly one suppression row', (select count(*) from backlink_email_suppressions where workspace_id='11111111-1111-1111-1111-111111111111' and email_normalized='a@x.test')=1);
select pg_temp.expect('10a outreach in current campaign closed', (select status from backlink_outreach where id='e0000000-0000-0000-0000-000000000001')='closed');
select pg_temp.expect('10b outreach in ANOTHER campaign (same email) closed', (select status from backlink_outreach where id='e0000000-0000-0000-0000-000000000002')='closed');
select pg_temp.expect('10c both contacts with that address are do_not_contact', (select count(*) from backlink_contacts where workspace_id='11111111-1111-1111-1111-111111111111' and email_normalized='a@x.test' and contact_status='do_not_contact')=2);
select pg_temp.expect('10d other workspace outreach untouched', (select status from backlink_outreach where id='e0000000-0000-0000-0000-000000000004')='active');
select pg_temp.expect('10e other workspace has no suppression for a@x.test', not exists(select 1 from backlink_email_suppressions where workspace_id='22222222-2222-2222-2222-222222222222' and email_normalized='a@x.test'));
select pg_temp.expect('3a prepared follow-up cancelled with reason unsubscribed', (select status||'/'||cancel_reason from backlink_outreach_attempts where id='f0000000-0000-0000-0000-000000000001')='cancelled/unsubscribed');
select pg_temp.expect('5d next_follow_up cleared + stop reason', (select next_follow_up_at is null and stop_reason='unsubscribed' and last_response_type='unsubscribed' from backlink_outreach where id='e0000000-0000-0000-0000-000000000001'));

-- 2. suppression blocks initial send (another campaign, same workspace) --------------
select pg_temp.expect_error('2 initial email attempt blocked for suppressed address (other campaign, same workspace)',$q$insert into backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at) values ('11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000aa','email','resend','A@x.test ','k-init-2','initial','requested',now())$q$,'BACKLINK_EMAIL_SUPPRESSED');
-- 3. follow-up paths blocked ---------------------------------------------------------
select pg_temp.expect_error('3b new prepared follow-up blocked',$q$insert into backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,prepared_at) values ('11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000aa','email','resend','a@x.test','k-fu-2','follow_up','prepared',now())$q$,'BACKLINK_EMAIL_SUPPRESSED');
-- prepared -> requested transition blocked even if cancellation had not happened
insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,prepared_at) values
 ('f0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-0000000000aa','email','resend','late@x.test','k-fu-late','follow_up','prepared',now());
alter table backlink_email_suppressions disable trigger trg_backlink_email_suppression_after_insert;
insert into backlink_email_suppressions(workspace_id,email_normalized,reason,source) values ('11111111-1111-1111-1111-111111111111','late@x.test','unsubscribed','admin_unsubscribe');
alter table backlink_email_suppressions enable trigger trg_backlink_email_suppression_after_insert;
select pg_temp.expect_error('3c prepared->requested transition blocked at DB level (cancel trigger bypassed for the test)',$q$update backlink_outreach_attempts set status='requested', requested_at=now() where id='f0000000-0000-0000-0000-000000000002'$q$,'BACKLINK_EMAIL_SUPPRESSED');
-- 4. other workspace unaffected ---------------------------------------------------------
insert into backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at) values ('22222222-2222-2222-2222-222222222222','e0000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000aa','email','resend','a@x.test','k-w2','initial','requested',now()) ;
select pg_temp.expect('4 same address in another workspace can still be attempted', exists(select 1 from backlink_outreach_attempts where idempotency_key='k-w2'));
-- non-email channels are not affected by email suppression --------------------------------
insert into backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at) values ('11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000aa','linkedin','manual','https://linkedin.example/in/a','k-li','initial','requested',now()) ;
select pg_temp.expect('4b non-email attempt not blocked by email suppression', exists(select 1 from backlink_outreach_attempts where idempotency_key='k-li'));

-- 8. permanent bounce (real stop function) still works + feeds suppression ---------------
insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at,accepted_at,resolved_at,provider_message_id) values
 ('f0000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000aa','email','resend','bounce@x.test','k-b','initial','accepted',now(),now(),now(),'msg-b'),
 ('f0000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-0000000000aa','email','resend','complaint@x.test','k-c','initial','accepted',now(),now(),now(),'msg-c');
insert into backlink_outreach_delivery_events(id,workspace_id,outreach_id,attempt_id,provider,provider_event_id,provider_message_id,event_type,bounce_type,occurred_at,received_at) values
 ('ee000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000006','f0000000-0000-0000-0000-000000000006','resend','evt-b','msg-b','email.bounced','permanent',now(),now()),
 ('ee000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000007','f0000000-0000-0000-0000-000000000007','resend','evt-c','msg-c','email.complained',null,now(),now());
create temp table rb as select * from apply_backlink_outreach_provider_permanent_bounce('ee000000-0000-0000-0000-000000000006');
create temp table rc as select * from apply_backlink_outreach_provider_complaint('ee000000-0000-0000-0000-000000000007');
select pg_temp.expect('8a permanent bounce: contact do_not_contact + outreach closed + follow-up cleared', (select contact_status='do_not_contact' from backlink_contacts where id='b0000000-0000-0000-0000-000000000006') and (select status='closed' and next_follow_up_at is null and stop_reason='provider_permanent_bounce' from backlink_outreach where id='e0000000-0000-0000-0000-000000000006'));
select pg_temp.expect('8b permanent bounce mirrored into workspace suppression', exists(select 1 from backlink_email_suppressions where workspace_id='11111111-1111-1111-1111-111111111111' and email_normalized='bounce@x.test' and reason='provider_permanent_bounce'));
select pg_temp.expect_error('8c bounced address cannot be emailed from another campaign',$q$insert into backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at) values ('11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000aa','email','resend','bounce@x.test','k-b2','initial','requested',now())$q$,'BACKLINK_EMAIL_SUPPRESSED');
-- 9. complaint -----------------------------------------------------------------------------
select pg_temp.expect('9a complaint: contact do_not_contact + outreach closed', (select contact_status='do_not_contact' from backlink_contacts where id='b0000000-0000-0000-0000-000000000007') and (select status='closed' and stop_reason='provider_complaint' from backlink_outreach where id='e0000000-0000-0000-0000-000000000007'));
select pg_temp.expect('9b complaint mirrored into workspace suppression', exists(select 1 from backlink_email_suppressions where workspace_id='11111111-1111-1111-1111-111111111111' and email_normalized='complaint@x.test' and reason='provider_complaint'));
select pg_temp.expect_error('9c existing contact-level DNC still blocks new outreach creation',$q$insert into backlink_outreach(workspace_id,campaign_id,opportunity_id,contact_id,outreach_key,channel,status) values ('11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000007','BL-OUT-2026-099','email','draft')$q$,'BACKLINK_OUTREACH_CONTACT_DO_NOT_CONTACT');

-- security / tenancy of the RPC ------------------------------------------------------------
select pg_temp.expect_error('S1 unsubscribe RPC rejects outreach from another workspace',$q$select * from apply_backlink_outreach_unsubscribe('22222222-2222-2222-2222-222222222222','e0000000-0000-0000-0000-000000000001','hosted_unsubscribe')$q$,'BACKLINK_UNSUBSCRIBE_OUTREACH_NOT_FOUND');
select pg_temp.expect_error('S2 unsubscribe RPC rejects unknown source',$q$select * from apply_backlink_outreach_unsubscribe('11111111-1111-1111-1111-111111111111','e0000000-0000-0000-0000-000000000001','whatever')$q$,'BACKLINK_UNSUBSCRIBE_INVALID');
select pg_temp.expect('S3 anon/authenticated cannot execute unsubscribe RPC', not has_function_privilege('anon','apply_backlink_outreach_unsubscribe(uuid,uuid,text,timestamptz)','execute') and not has_function_privilege('authenticated','apply_backlink_outreach_unsubscribe(uuid,uuid,text,timestamptz)','execute') and has_function_privilege('service_role','apply_backlink_outreach_unsubscribe(uuid,uuid,text,timestamptz)','execute'));
select pg_temp.expect('S4 suppression table: no direct write privilege for anon/authenticated', not has_table_privilege('anon','backlink_email_suppressions','insert') and not has_table_privilege('authenticated','backlink_email_suppressions','insert') and not has_table_privilege('authenticated','backlink_email_suppressions','update') and not has_table_privilege('authenticated','backlink_email_suppressions','delete'));

select name || ' :: ' || case when ok then 'PASS' else 'FAIL' end || coalesce('  ('||detail||')','') from results order by name;
select 'TOTAL pass=' || count(*) filter (where ok) || ' fail=' || count(*) filter (where not ok) from results;
