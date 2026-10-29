\set ON_ERROR_STOP on
\pset tuples_only on
create schema tt;
create table tt.results (name text, ok boolean);
create function tt.expect(n text, ok boolean) returns void language sql as $$ insert into tt.results values (n, coalesce(ok,false)) $$;
create sequence tt.fixture_key_seq start with 100000;

-- Each fixture is self-contained and uses a non-example, fictional local address.
create function tt.mk(label text, with_requested_follow_up boolean default false)
returns table(ws uuid, actor uuid, contact uuid, opportunity uuid, campaign uuid, outreach uuid, follow_attempt uuid)
language plpgsql as $$
declare d uuid; a uuid; c uuid; c2 uuid; o uuid; ca uuid; out_id uuid; out2 uuid; fu uuid; asset uuid; h text; fixture_key text;
begin
  ws := gen_random_uuid(); actor := gen_random_uuid(); ca := gen_random_uuid(); out_id := gen_random_uuid(); fu := gen_random_uuid();
  fixture_key := nextval('tt.fixture_key_seq')::text;
  insert into auth.users values(actor, label || '@admin.local');
  insert into workspaces values(ws, label);
  insert into workspace_members values(ws, actor, 'owner');
  insert into automation_workspace_controls(workspace_id,backlinks_enabled,dry_run_only,updated_by) values(ws,true,false,actor);
  insert into backlink_assets(workspace_id,asset_key,display_name,asset_type) values(ws,'asset-'||label,'Asset','calculator') returning id into asset;
  insert into backlink_domains(workspace_id,domain_key,hostname) values(ws,'BK-'||fixture_key,label||'.local') returning id into d;
  insert into backlink_opportunities(workspace_id,opportunity_key,domain_id,asset_id,opportunity_type,target_page_url,target_page_title,page_type,evidence_summary) values(ws,'OP-'||fixture_key,d,asset,'resource','https://target.local/'||label,'Target','Blog Article','evidence') returning id into o;
  insert into backlink_contacts(workspace_id,domain_id,contact_key,email_normalized,contact_status,source_type,source_reference) values(ws,d,'CT-'||fixture_key,'person-'||label||'@pilot.local','verified','editorial','https://source.local/'||label) returning id into c;
  h := encode(extensions.digest('person-'||label||'@pilot.local','sha256'),'hex');
  insert into backlink_contact_mailbox_verifications(workspace_id,contact_id,verification_key,email_fingerprint,provider,result,checked_at) values(ws,c,'v-'||label,h,'fake','deliverable',now());
  insert into backlink_campaigns(id,workspace_id,campaign_key,name,objective,owner_id,status,live_initial_send_enabled) values(ca,ws,'BL-CAM-2026-001','Pilot','test',actor,'active',true);
  insert into backlink_outreach(id,workspace_id,campaign_id,opportunity_id,contact_id,outreach_key,channel,status,subject,body) values(out_id,ws,ca,o,c,'BL-OUT-2026-001','email','draft','Subject','Body');
  perform * from approve_backlink_outreach_initial_send(ws,out_id,actor);
  if with_requested_follow_up then
    c2 := gen_random_uuid(); out2 := gen_random_uuid();
    insert into backlink_contacts(id,workspace_id,domain_id,contact_key,email_normalized,contact_status,source_type,source_reference) values(c2,ws,d,'CT-'||fixture_key||'1','follow-up-'||label||'@pilot.local','verified','editorial','https://source.local/follow-up/'||label);
    insert into backlink_outreach(id,workspace_id,campaign_id,opportunity_id,contact_id,outreach_key,channel,status,subject,body) values(out2,ws,ca,o,c2,'BL-OUT-2026-002','email','draft','Subject','Body');
    perform * from approve_backlink_outreach_initial_send(ws,out2,actor);
    update backlink_outreach set status='active',current_attempt=1,first_contact_at=now(),last_attempt_at=now() where id=out2;
    insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at,reply_token_hash,reply_token_key_version) values(fu,ws,out2,actor,'email','fake','follow-up-'||label||'@pilot.local','fu-'||label,'follow_up','requested',now(),repeat('a',64),'v1');
    insert into backlink_outreach_follow_up_drafts(workspace_id,outreach_id,attempt_id,follow_up_number,subject,body,prepared_at,updated_at,updated_by) values(ws,out2,fu,1,'Follow','Follow body',now(),now(),actor);
  else fu := null; end if;
  contact:=c; opportunity:=o; campaign:=ca; outreach:=out_id; follow_attempt:=fu; return next;
end $$;

create function tt.prepare_follow_up(label text)
returns table(ws uuid, actor uuid, contact uuid, opportunity uuid, campaign uuid, outreach uuid, attempt uuid)
language plpgsql as $$
declare f record; prepared_attempt uuid := gen_random_uuid();
begin
  select * into f from tt.mk(label);
  update backlink_outreach set status='active',current_attempt=1,first_contact_at=now(),last_attempt_at=now() where id=f.outreach;
  insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,prepared_at,reply_token_hash,reply_token_key_version)
  values(prepared_attempt,f.ws,f.outreach,f.actor,'email','fake','person-'||label||'@pilot.local','prepared-'||label,'follow_up','prepared',now(),repeat('f',64),'v1');
  insert into backlink_outreach_follow_up_drafts(workspace_id,outreach_id,attempt_id,follow_up_number,subject,body,prepared_at,updated_at,updated_by)
  values(f.ws,f.outreach,prepared_attempt,1,'Follow','Follow body',now(),now(),f.actor);
  return query select f.ws,f.actor,f.contact,f.opportunity,f.campaign,f.outreach,prepared_attempt;
end $$;

do $$
declare f record; g record; r record; history_attempt uuid; denied boolean;
begin
  -- requested follow-up blocks approval before any pilot row exists.
  select * into f from tt.mk('requested',true);
  begin perform * from approve_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'https://source.local/requested','Reason long enough for audit.'); exception when others then denied := sqlerrm like '%FOLLOW_UP_ALREADY_REQUESTED%'; end;
  perform tt.expect('requested follow-up blocks approval',denied);

  -- Recipient history remains a separate, earlier refusal condition.
  select * into f from tt.mk('history');
  update backlink_outreach set status='active',current_attempt=1,first_contact_at=now(),last_attempt_at=now() where id=f.outreach;
  insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at,reply_token_hash,reply_token_key_version) values(gen_random_uuid(),f.ws,f.outreach,f.actor,'email','fake','person-history@pilot.local','history-requested','follow_up','requested',now(),repeat('e',64),'v1') returning id into history_attempt;
  insert into backlink_outreach_follow_up_drafts(workspace_id,outreach_id,attempt_id,follow_up_number,subject,body,prepared_at,updated_at,updated_by) values(f.ws,f.outreach,history_attempt,1,'Follow','Follow body',now(),now(),f.actor);
  begin perform * from approve_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'https://source.local/history','Reason long enough for audit.'); exception when others then denied := sqlerrm like '%RECIPIENT_PREVIOUSLY_ATTEMPTED%'; end;
  perform tt.expect('recipient history blocks approval',denied);

  select * into f from tt.mk('pilot');
  perform * from approve_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'https://source.local/pilot','Reason long enough for audit.');
  perform tt.expect('pilot approval', (select count(*)=1 from backlink_production_eligibility where workspace_id=f.ws and status='approved'));
  -- Existing requested attempt cannot be resumed; no provider exists in this harness.
  update backlink_outreach set status='active',current_attempt=1,first_contact_at=now(),last_attempt_at=now() where id=f.outreach;
  insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at,reply_token_hash,reply_token_key_version) values(gen_random_uuid(),f.ws,f.outreach,f.actor,'email','fake','person-pilot@pilot.local','old-requested','follow_up','requested',now(),repeat('b',64),'v1') returning id into r;
  begin perform * from mark_backlink_outreach_follow_up_attempt_requested(f.ws,f.outreach,r.id,f.actor,now()); exception when others then denied := sqlerrm like '%FOLLOW_UPS_BLOCKED%'; end;
  perform tt.expect('requested follow-up resume blocked during pilot',denied);

  -- Audit cannot be rewritten and revocation removes admission to V3.
  perform * from revoke_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'Reason long enough to revoke the pilot.');
  perform tt.expect('revocation recorded', (select count(*)=2 from backlink_production_eligibility_audit where workspace_id=f.ws));
  begin update backlink_production_eligibility_audit set reason='mutated' where workspace_id=f.ws; exception when others then denied := sqlerrm like '%AUDIT_IMMUTABLE%'; end;
  perform tt.expect('audit append-only',denied);
  select * into r from reserve_backlink_approved_initial_attempt_v3(f.ws,f.campaign,f.outreach,f.actor,gen_random_uuid(),'after-revoke',repeat('c',64),'v1',now());
  perform tt.expect('revocation blocks V3 reservation',r.disposition='production_eligibility_required');

  select * into f from tt.mk('reapprove');
  perform * from approve_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'https://source.local/reapprove','Reason long enough to approve the pilot.');
  perform * from revoke_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'Reason long enough to revoke the pilot.');
  perform * from approve_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'https://source.local/reapproved','Reason long enough to reapprove the pilot.');
  perform tt.expect('reapproval records new reason', (select review_reason='Reason long enough to reapprove the pilot.' from backlink_production_eligibility where workspace_id=f.ws and contact_id=f.contact and opportunity_id=f.opportunity));
  perform tt.expect('reapproval appends audit', (select count(*)=3 from backlink_production_eligibility_audit where workspace_id=f.ws));

  -- Independent workspaces can each hold one pilot approval.
  select * into f from tt.mk('workspace-a'); select * into g from tt.mk('workspace-b');
  perform * from approve_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'https://source.local/a','Reason long enough for audit.');
  perform * from approve_backlink_production_pilot_eligibility(g.ws,g.contact,g.opportunity,g.actor,'https://source.local/b','Reason long enough for audit.');
  perform tt.expect('workspace isolation', (select count(*)=2 from backlink_production_eligibility where status='approved' and workspace_id in (f.ws,g.ws)));
end $$;

do $$
declare f record; denied boolean;
begin
  select * into f from tt.prepare_follow_up('dry-run');
  update automation_workspace_controls set dry_run_only=true where workspace_id=f.ws;
  begin perform * from mark_backlink_outreach_follow_up_attempt_requested(f.ws,f.outreach,f.attempt,f.actor,now()); exception when others then denied := sqlerrm like '%FOLLOW_UP_SEND_DRY_RUN%'; end;
  perform tt.expect('follow-up dry-run gate',denied);

  select * into f from tt.prepare_follow_up('disabled');
  update automation_workspace_controls set backlinks_enabled=false where workspace_id=f.ws;
  begin perform * from mark_backlink_outreach_follow_up_attempt_requested(f.ws,f.outreach,f.attempt,f.actor,now()); exception when others then denied := sqlerrm like '%FOLLOW_UP_SEND_BACKLINKS_DISABLED%'; end;
  perform tt.expect('follow-up backlinks-disabled gate',denied);

  select * into f from tt.prepare_follow_up('campaign-inactive');
  update backlink_campaigns set status='paused' where id=f.campaign;
  begin perform * from mark_backlink_outreach_follow_up_attempt_requested(f.ws,f.outreach,f.attempt,f.actor,now()); exception when others then denied := sqlerrm like '%FOLLOW_UP_SEND_CAMPAIGN_NOT_ACTIVE%'; end;
  perform tt.expect('follow-up campaign-active gate',denied);

  select * into f from tt.prepare_follow_up('domain-cap');
  insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at,accepted_at,resolved_at,reply_token_hash,reply_token_key_version)
  values(gen_random_uuid(),f.ws,f.outreach,f.actor,'email','fake','historic-domain-cap@pilot.local','domain-cap-history','follow_up','accepted',now(),now(),now(),repeat('9',64),'v1');
  begin perform * from mark_backlink_outreach_follow_up_attempt_requested(f.ws,f.outreach,f.attempt,f.actor,now()); exception when others then denied := sqlerrm like '%FOLLOW_UP_SEND_DOMAIN_DAILY_RATE_LIMIT%'; end;
  perform tt.expect('follow-up domain cap gate',denied);
end $$;

-- SQL ACL: authenticated cannot execute the admin mutation; service_role can.
do $$
declare f record; denied boolean;
begin
  select * into f from tt.mk('acl');
  set local role authenticated;
  begin perform * from approve_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'https://source.local/acl','Reason long enough for audit.'); exception when insufficient_privilege then denied:=true; end;
  reset role;
  perform tt.expect('authenticated cannot mutate eligibility',denied);
end $$;

do $$
declare f record; r record;
begin
  select * into f from tt.mk('service-role');
  set local role service_role;
  select * into r from approve_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'https://source.local/service','Reason long enough for service-role audit.');
  reset role;
  perform tt.expect('service_role can mutate eligibility',r.disposition='approved');
end $$;

select name || ' :: ' || case when ok then 'PASS' else 'FAIL' end from tt.results order by name;
select case when bool_and(ok) then 'PILOT ADMIN SCENARIOS OK' else 'PILOT ADMIN SCENARIOS FAILED' end from tt.results;

-- Export one independent fixture for two separate psql sessions in the harness.
create table tt.concurrent as select * from tt.mk('concurrent');
create table tt.follow_race as select * from tt.mk('follow-race');
alter table tt.follow_race add column follow_contact uuid, add column follow_outreach uuid;
do $$
declare f record; d uuid; follow_key text; follow_contact_id uuid := gen_random_uuid(); follow_outreach_id uuid := gen_random_uuid();
begin
  select * into f from tt.follow_race;
  select domain_id into d from backlink_contacts where id=f.contact and workspace_id=f.ws;
  follow_key := nextval('tt.fixture_key_seq')::text;
  insert into backlink_contacts(id,workspace_id,domain_id,contact_key,email_normalized,contact_status,source_type,source_reference) values(follow_contact_id,f.ws,d,'CT-'||follow_key,'follow-up-race@pilot.local','verified','editorial','https://source.local/follow-up-race');
  insert into backlink_outreach(id,workspace_id,campaign_id,opportunity_id,contact_id,outreach_key,channel,status,subject,body) values(follow_outreach_id,f.ws,f.campaign,f.opportunity,follow_contact_id,'BL-OUT-2026-002','email','draft','Subject','Body');
  perform * from approve_backlink_outreach_initial_send(f.ws,follow_outreach_id,f.actor);
  update backlink_outreach set status='active',current_attempt=1,first_contact_at=now(),last_attempt_at=now() where id=follow_outreach_id;
  update tt.follow_race set follow_contact=follow_contact_id, follow_outreach=follow_outreach_id, follow_attempt=gen_random_uuid();
end $$;
insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,prepared_at,reply_token_hash,reply_token_key_version)
select follow_attempt,ws,follow_outreach,actor,'email','fake','follow-up-race@pilot.local','race-follow','follow_up','prepared',now(),repeat('d',64),'v1' from tt.follow_race;
insert into backlink_outreach_follow_up_drafts(workspace_id,outreach_id,attempt_id,follow_up_number,subject,body,prepared_at,updated_at,updated_by)
select ws,follow_outreach,follow_attempt,1,'Follow','Follow body',now(),now(),actor from tt.follow_race;
