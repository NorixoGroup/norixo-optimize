\set ON_ERROR_STOP on
\pset tuples_only on
create schema tt;
create table tt.results (name text, ok boolean);
create function tt.expect(n text, ok boolean) returns void language sql as $$ insert into tt.results values (n, coalesce(ok,false)) $$;

-- Each fixture is self-contained and uses a non-example, fictional local address.
create function tt.mk(label text, with_requested_follow_up boolean default false)
returns table(ws uuid, actor uuid, contact uuid, opportunity uuid, campaign uuid, outreach uuid, follow_attempt uuid)
language plpgsql as $$
declare d uuid; a uuid; c uuid; o uuid; ca uuid; out_id uuid; fu uuid; asset uuid; h text;
begin
  ws := gen_random_uuid(); actor := gen_random_uuid(); ca := gen_random_uuid(); out_id := gen_random_uuid(); fu := gen_random_uuid();
  insert into auth.users values(actor, label || '@admin.local');
  insert into workspaces values(ws, label);
  insert into workspace_members values(ws, actor, 'owner');
  insert into backlink_assets(workspace_id,asset_key,display_name,asset_type) values(ws,'asset-'||label,'Asset','calculator') returning id into asset;
  insert into backlink_domains(workspace_id,domain_key,hostname) values(ws,'BK-'||substr(replace(ws::text,'-',''),1,8),label||'.local') returning id into d;
  insert into backlink_opportunities(workspace_id,opportunity_key,domain_id,asset_id,opportunity_type,target_page_url,target_page_title,page_type,evidence_summary) values(ws,'OP-'||substr(replace(ws::text,'-',''),1,8),d,asset,'resource','https://target.local/'||label,'Target','Blog Article','evidence') returning id into o;
  insert into backlink_contacts(workspace_id,domain_id,contact_key,email_normalized,contact_status,source_type,source_reference) values(ws,d,'CT-'||substr(replace(ws::text,'-',''),1,8),'person-'||label||'@pilot.local','verified','editorial','https://source.local/'||label) returning id into c;
  h := encode(extensions.digest('person-'||label||'@pilot.local','sha256'),'hex');
  insert into backlink_contact_mailbox_verifications(workspace_id,contact_id,verification_key,email_fingerprint,provider,result,checked_at) values(ws,c,'v-'||label,h,'fake','deliverable',now());
  insert into backlink_campaigns(id,workspace_id,campaign_key,name,objective,owner_id,status,live_initial_send_enabled) values(ca,ws,'BL-CAM-2026-001','Pilot','test',actor,'active',true);
  insert into backlink_outreach(id,workspace_id,campaign_id,opportunity_id,contact_id,outreach_key,channel,status,subject,body) values(out_id,ws,ca,o,c,'BL-OUT-2026-001','email','draft','Subject','Body');
  perform * from approve_backlink_outreach_initial_send(ws,out_id,actor);
  if with_requested_follow_up then
    update backlink_outreach set status='active',current_attempt=1,first_contact_at=now(),last_attempt_at=now() where id=out_id;
    insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at,reply_token_hash,reply_token_key_version) values(fu,ws,out_id,actor,'email','fake','person-'||label||'@pilot.local','fu-'||label,'follow_up','requested',now(),repeat('a',64),'v1');
    insert into backlink_outreach_follow_up_drafts(workspace_id,outreach_id,attempt_id,subject,body) values(ws,out_id,fu,'Follow','Follow body');
  else fu := null; end if;
  contact:=c; opportunity:=o; campaign:=ca; outreach:=out_id; follow_attempt:=fu; return next;
end $$;

do $$
declare f record; g record; r record; denied boolean;
begin
  -- requested follow-up blocks approval before any pilot row exists.
  select * into f from tt.mk('requested',true);
  begin perform * from approve_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'https://source.local/requested','Reason long enough for audit.'); exception when others then denied := sqlerrm like '%FOLLOW_UP_ALREADY_REQUESTED%'; end;
  perform tt.expect('requested follow-up blocks approval',denied);

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

  -- Independent workspaces can each hold one pilot approval.
  select * into f from tt.mk('workspace-a'); select * into g from tt.mk('workspace-b');
  perform * from approve_backlink_production_pilot_eligibility(f.ws,f.contact,f.opportunity,f.actor,'https://source.local/a','Reason long enough for audit.');
  perform * from approve_backlink_production_pilot_eligibility(g.ws,g.contact,g.opportunity,g.actor,'https://source.local/b','Reason long enough for audit.');
  perform tt.expect('workspace isolation', (select count(*)=2 from backlink_production_eligibility where status='approved' and workspace_id in (f.ws,g.ws)));
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
update backlink_outreach set status='active',current_attempt=1,first_contact_at=now(),last_attempt_at=now() where id=(select outreach from tt.follow_race);
update tt.follow_race set follow_attempt=gen_random_uuid();
insert into backlink_outreach_attempts(id,workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,reply_token_hash,reply_token_key_version)
select follow_attempt,ws,outreach,actor,'email','fake','person-follow-race@pilot.local','race-follow','follow_up','prepared',repeat('d',64),'v1' from tt.follow_race;
insert into backlink_outreach_follow_up_drafts(workspace_id,outreach_id,attempt_id,subject,body)
select ws,outreach,follow_attempt,'Follow','Follow body' from tt.follow_race;
