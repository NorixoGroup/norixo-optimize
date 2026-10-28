-- Behaviour checks for public.reserve_backlink_approved_initial_attempt_v3
-- (migration 20261028090000_add_backlink_production_eligibility_gate.sql).
--
-- DISPOSABLE LOCAL DATABASE ONLY. Driven by scripts/backlink-production-gate-v3-postgres-harness.sh
-- with -v phase=<scenarios|concurrency_setup|concurrency_assert>. It creates fixture workspaces, users,
-- contacts and outreach rows in a throwaway database; it never contacts any provider.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

create schema if not exists tt;
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tt' and t.typname = 'fx') then
    create type tt.fx as (ws uuid, camp uuid, outreach uuid, contact uuid, opp uuid, actor uuid);
  end if;
end $$;
create table if not exists tt.results (name text, ok boolean, detail text);
create table if not exists tt.conc_log (scenario text, disposition text, attempt_id uuid, at timestamptz default clock_timestamp());

-- One isolated workspace: approved real prospect with a fresh deliverable verification by default.
create or replace function tt.mk(
  p_label text, p_email text,
  p_live boolean default true, p_dry boolean default false,
  p_elig_status text default 'approved', p_origin text default 'real',
  p_mbx_result text default 'deliverable', p_mbx_age interval default interval '1 day'
) returns tt.fx language plpgsql as $$
declare v_ws uuid := gen_random_uuid(); v_actor uuid := gen_random_uuid(); v_camp uuid := gen_random_uuid();
        v_asset uuid; v_dom uuid; v_opp uuid; v_ct uuid; v_out uuid := gen_random_uuid(); v_hash text;
begin
  insert into auth.users(id, email) values (v_actor, p_label || '@admin.test');
  insert into public.workspaces(id, name) values (v_ws, p_label);
  insert into public.workspace_members(workspace_id, user_id, role) values (v_ws, v_actor, 'owner');
  insert into automation_workspace_controls(workspace_id, backlinks_enabled, dry_run_only, backlink_outreach_schedule_apply_enabled)
    values (v_ws, true, p_dry, true);
  insert into backlink_assets(workspace_id, asset_key, display_name, asset_type) values (v_ws, 'asset-1', 'Asset', 'calculator') returning id into v_asset;
  insert into backlink_domains(workspace_id, domain_key, hostname) values (v_ws, 'BK-0001', p_label || '.example') returning id into v_dom;
  insert into backlink_opportunities(workspace_id, opportunity_key, domain_id, asset_id, opportunity_type, target_page_url, target_page_title, page_type, evidence_summary)
    values (v_ws, 'OP-000001', v_dom, v_asset, 'resource', 'https://x.example/a', 'A', 'Blog Article', 'e') returning id into v_opp;
  insert into backlink_contacts(workspace_id, domain_id, contact_key, email_normalized, contact_status, source_type, source_reference)
    values (v_ws, v_dom, 'CT-000001', lower(p_email), 'verified', 'site', 'https://x.example/c') returning id into v_ct;
  insert into backlink_campaigns(id, workspace_id, campaign_key, name, objective, owner_id, status, live_initial_send_enabled)
    values (v_camp, v_ws, 'BL-CAM-2026-001', 'C', 'o', v_actor, 'active', p_live);
  insert into backlink_outreach(id, workspace_id, campaign_id, opportunity_id, contact_id, outreach_key, channel, status, subject, body)
    values (v_out, v_ws, v_camp, v_opp, v_ct, 'BL-OUT-2026-001', 'email', 'draft', 'Subject ' || p_label, 'Body ' || p_label);
  perform * from approve_backlink_outreach_initial_send(v_ws, v_out, v_actor);
  v_hash := encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex');
  if p_elig_status is not null then
    insert into backlink_production_eligibility(workspace_id, contact_id, opportunity_id, email_fingerprint, origin_kind, status, source_reference, reviewed_by, reviewed_at, review_reason, created_by)
      values (v_ws, v_ct, v_opp, v_hash, p_origin, p_elig_status, 'https://x.example/c',
              case when p_elig_status = 'pending' then null else v_actor end,
              case when p_elig_status = 'pending' then null else now() end, 'fixture', v_actor);
  end if;
  if p_mbx_result is not null then
    insert into backlink_contact_mailbox_verifications(workspace_id, contact_id, verification_key, email_fingerprint, provider, result, checked_at)
      values (v_ws, v_ct, 'vk-' || v_out || '-0', v_hash, 'zerobounce', p_mbx_result, clock_timestamp() - p_mbx_age);
  end if;
  return row(v_ws, v_camp, v_out, v_ct, v_opp, v_actor)::tt.fx;
end $$;

create or replace function tt.mbx(f tt.fx, p_email text, p_result text, p_age interval, p_tag text) returns void language sql as $$
  insert into backlink_contact_mailbox_verifications(workspace_id, contact_id, verification_key, email_fingerprint, provider, result, checked_at)
  values (f.ws, f.contact, 'vk-' || f.outreach || '-' || p_tag, encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex'), 'zerobounce', p_result, clock_timestamp() - p_age) $$;

create or replace function tt.v3(f tt.fx, p_key text) returns text language plpgsql as $$
declare r record;
begin
  select * into r from reserve_backlink_approved_initial_attempt_v3(f.ws, f.camp, f.outreach, f.actor, gen_random_uuid(), p_key, encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'), 'v1', now());
  return r.disposition;
end $$;

-- Same call, but a database exception (workspace / campaign trigger gates) is returned as text.
create or replace function tt.v3x(f tt.fx, p_key text) returns text language plpgsql as $$
begin
  return tt.v3(f, p_key);
exception when others then
  return 'EXC:' || sqlerrm;
end $$;

-- A second approved outreach (own domain / opportunity / contact) inside the same workspace.
create or replace function tt.second(f tt.fx, p_email text, p_with_eligibility boolean default false) returns uuid language plpgsql as $$
declare v_asset uuid; v_dom uuid; v_opp uuid; v_ct uuid; v_out uuid := gen_random_uuid(); v_hash text := encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex');
begin
  select id into v_asset from backlink_assets where workspace_id = f.ws limit 1;
  insert into backlink_domains(workspace_id, domain_key, hostname) values (f.ws, 'BK-0002', 'second-' || f.ws || '.example') returning id into v_dom;
  insert into backlink_opportunities(workspace_id, opportunity_key, domain_id, asset_id, opportunity_type, target_page_url, target_page_title, page_type, evidence_summary)
    values (f.ws, 'OP-000002', v_dom, v_asset, 'resource', 'https://x2.example/a', 'A', 'Blog Article', 'e') returning id into v_opp;
  insert into backlink_contacts(workspace_id, domain_id, contact_key, email_normalized, contact_status, source_type, source_reference)
    values (f.ws, v_dom, 'CT-000002', lower(p_email), 'verified', 'site', 'https://x2.example/c') returning id into v_ct;
  insert into backlink_outreach(id, workspace_id, campaign_id, opportunity_id, contact_id, outreach_key, channel, status, subject, body)
    values (v_out, f.ws, f.camp, v_opp, v_ct, 'BL-OUT-2026-002', 'email', 'draft', 'S2', 'B2');
  perform * from approve_backlink_outreach_initial_send(f.ws, v_out, f.actor);
  if p_with_eligibility then
    insert into backlink_production_eligibility(workspace_id, contact_id, opportunity_id, email_fingerprint, origin_kind, status, source_reference, reviewed_by, reviewed_at, review_reason, created_by)
      values (f.ws, v_ct, v_opp, v_hash, 'real', 'approved', 'https://x2.example/c', f.actor, now(), 'fixture', f.actor);
    insert into backlink_contact_mailbox_verifications(workspace_id, contact_id, verification_key, email_fingerprint, provider, result, checked_at)
      values (f.ws, v_ct, 'vk-second-' || v_out, v_hash, 'zerobounce', 'deliverable', clock_timestamp() - interval '1 day');
  end if;
  return v_out;
end $$;

create or replace function tt.attempts(f tt.fx) returns integer language sql as $$
  select count(*)::integer from backlink_outreach_attempts where workspace_id = f.ws $$;

create or replace function tt.expect(p_name text, p_ok boolean, p_detail text default null) returns void language sql as $$
  insert into tt.results values (p_name, coalesce(p_ok, false), p_detail) $$;

create or replace function tt.expect_disp(p_name text, p_got text, p_want text) returns void language sql as $$
  insert into tt.results values (p_name, p_got is not distinct from p_want, 'got=' || coalesce(p_got, 'NULL') || ' want=' || p_want) $$;

select :'phase' = 'scenarios' as is_scn, :'phase' = 'concurrency_setup' as is_csetup, :'phase' = 'concurrency_assert' as is_cassert \gset

\if :is_scn
truncate tt.results;
do $$
declare f tt.fx; r text; first_attempt uuid;
begin
  -- ---------------------------------------------------------------- baseline
  f := tt.mk('g1', 'good1@real.test');
  perform tt.expect_disp('G1 approved real + fresh deliverable + human approval => reserved', tt.v3(f, 'k-g1'), 'created');
  perform tt.expect('G1b exactly one initial attempt persisted', tt.attempts(f) = 1);

  -- ---------------------------------------------------------------- production eligibility
  f := tt.mk('e0', 'e0@real.test', p_elig_status => null);
  perform tt.expect_disp('E0 no eligibility row => refused', tt.v3(f, 'k-e0'), 'production_eligibility_required');
  perform tt.expect('E0b nothing persisted', tt.attempts(f) = 0);
  foreach r in array array['test', 'demo', 'legacy_unknown'] loop
    f := tt.mk('eo-' || r, 'eo-' || r || '@real.test', p_origin => r);
    perform tt.expect_disp('E1 origin_kind=' || r || ' approved => refused', tt.v3(f, 'k-eo-' || r), 'production_eligibility_required');
  end loop;
  foreach r in array array['pending', 'rejected', 'revoked'] loop
    f := tt.mk('es-' || r, 'es-' || r || '@real.test', p_elig_status => r);
    perform tt.expect_disp('E2 status=' || r || ' => refused', tt.v3(f, 'k-es-' || r), 'production_eligibility_required');
  end loop;
  f := tt.mk('e3', 'e3-old@real.test');
  update backlink_contacts set email_normalized = 'e3-new@real.test' where id = f.contact;
  perform tt.expect_disp('E3 email changed after approval (fingerprint mismatch) => refused', tt.v3(f, 'k-e3'), 'production_eligibility_required');

  -- ---------------------------------------------------------------- mailbox verification (B1)
  f := tt.mk('m0', 'm0@real.test', p_mbx_result => null);
  perform tt.expect_disp('M0 no verification => refused', tt.v3(f, 'k-m0'), 'mailbox_not_deliverable');
  f := tt.mk('m1', 'm1@real.test', p_mbx_result => 'deliverable', p_mbx_age => interval '5 days');
  perform tt.mbx(f, 'm1@real.test', 'undeliverable', interval '1 day', 'latest');
  perform tt.expect_disp('M1 LATEST is undeliverable although an older one is deliverable => refused', tt.v3(f, 'k-m1'), 'mailbox_not_deliverable');
  f := tt.mk('m2', 'm2@real.test', p_mbx_result => 'undeliverable', p_mbx_age => interval '5 days');
  perform tt.mbx(f, 'm2@real.test', 'deliverable', interval '1 day', 'latest');
  perform tt.expect_disp('M2 latest is deliverable after an older undeliverable => accepted', tt.v3(f, 'k-m2'), 'created');
  foreach r in array array['risky', 'unknown', 'provider_error', 'undeliverable'] loop
    f := tt.mk('m3-' || r, 'm3-' || r || '@real.test', p_mbx_result => r);
    perform tt.expect_disp('M3 latest result=' || r || ' => refused', tt.v3(f, 'k-m3-' || r), 'mailbox_not_deliverable');
  end loop;
  f := tt.mk('m4a', 'm4a@real.test', p_mbx_age => interval '31 days');
  perform tt.expect_disp('M4 deliverable 31 days old => refused (older than 30 days)', tt.v3(f, 'k-m4a'), 'mailbox_not_deliverable');
  f := tt.mk('m4b', 'm4b@real.test', p_mbx_age => interval '29 days');
  perform tt.expect_disp('M4b deliverable 29 days old => accepted', tt.v3(f, 'k-m4b'), 'created');
  f := tt.mk('m5', 'm5@real.test', p_mbx_age => interval '-1 day');
  perform tt.expect_disp('M5 deliverable dated in the future => refused', tt.v3(f, 'k-m5'), 'mailbox_not_deliverable');
  f := tt.mk('m6', 'm6-new@real.test', p_mbx_result => null);
  perform tt.mbx(f, 'm6-old@real.test', 'deliverable', interval '1 day', 'oldaddr');
  perform tt.expect_disp('M6 deliverable only for another email fingerprint => refused', tt.v3(f, 'k-m6'), 'mailbox_not_deliverable');
  f := tt.mk('m7', 'm7@real.test', p_mbx_result => 'deliverable', p_mbx_age => interval '2 days');
  insert into backlink_contact_mailbox_verifications(workspace_id, contact_id, verification_key, email_fingerprint, provider, result, checked_at, created_at)
    values (f.ws, f.contact, 'vk-m7-tie', encode(extensions.digest('m7@real.test', 'sha256'), 'hex'), 'zerobounce', 'undeliverable',
            (select checked_at from backlink_contact_mailbox_verifications where contact_id = f.contact limit 1), clock_timestamp());
  perform tt.expect_disp('M7 same checked_at: the most recently created row (undeliverable) wins => refused', tt.v3(f, 'k-m7'), 'mailbox_not_deliverable');

  -- ---------------------------------------------------------------- suppression, contact state, history
  f := tt.mk('s1', 's1@real.test');
  insert into backlink_email_suppressions(workspace_id, email_normalized, reason, source) values (f.ws, 's1@real.test', 'unsubscribed', 'admin_unsubscribe');
  perform tt.expect_disp('S1 suppressed recipient => refused', tt.v3(f, 'k-s1'), 'recipient_suppressed');
  f := tt.mk('c1', 'c1@real.test');
  update backlink_contacts set contact_status = 'do_not_contact', do_not_contact_at = now(), do_not_contact_reason = 'fixture' where id = f.contact;
  perform tt.expect_disp('C1 do_not_contact => refused', tt.v3(f, 'k-c1'), 'ineligible');
  f := tt.mk('c2', 'c2@real.test');
  update backlink_contacts set contact_status = 'archived', archived_at = now() where id = f.contact;
  perform tt.expect_disp('C2 archived contact => refused', tt.v3(f, 'k-c2'), 'ineligible');
  f := tt.mk('c3', 'c3@real.test');
  update backlink_contacts set contact_status = 'unverified' where id = f.contact;
  perform tt.expect_disp('C3 contact not verified => refused', tt.v3(f, 'k-c3'), 'ineligible');
  foreach r in array array['accepted', 'failed', 'requested'] loop
    f := tt.mk('h-' || r, 'h-' || r || '@real.test');
    insert into backlink_outreach_attempts(workspace_id, outreach_id, actor_user_id, channel, provider, recipient, idempotency_key, attempt_kind, status, requested_at, accepted_at, failed_at, resolved_at, provider_message_id, error_code, error_message)
      values (f.ws, f.outreach, f.actor, 'email', 'resend', 'h-' || r || '@real.test', 'prior-' || r, 'initial', r, now() - interval '1 day',
              case when r = 'accepted' then now() - interval '1 day' end, case when r = 'failed' then now() - interval '1 day' end,
              case when r in ('accepted', 'failed') then now() - interval '1 day' end,
              case when r = 'accepted' then 'pm-' || gen_random_uuid() end, case when r = 'failed' then 'E' end, case when r = 'failed' then 'failed' end);
    perform tt.expect_disp('H1 prior attempt status=' || r || ' for the recipient => refused', tt.v3(f, 'k-h-' || r), 'recipient_previously_attempted');
  end loop;
  f := tt.mk('h-unknown', 'h-unknown@real.test');
  insert into backlink_outreach_attempts(workspace_id, outreach_id, actor_user_id, channel, provider, recipient, idempotency_key, attempt_kind, status, requested_at, error_code, error_message)
    values (f.ws, f.outreach, f.actor, 'email', 'resend', 'h-unknown@real.test', 'prior-unknown', 'initial', 'unknown', now() - interval '1 day', 'E', 'unknown');
  perform tt.expect_disp('H2 prior attempt status=unknown => refused', tt.v3(f, 'k-h-unknown'), 'recipient_unknown_attempt');

  -- ---------------------------------------------------------------- workspace / campaign gates still apply (delegated)
  f := tt.mk('w1', 'w1@real.test', p_dry => true);
  perform tt.expect('W1 workspace dry_run_only=true => refused, nothing persisted', tt.v3x(f, 'k-w1') <> 'created' and tt.attempts(f) = 0, tt.v3x(f, 'k-w1b'));
  f := tt.mk('w2', 'w2@real.test', p_live => false);
  perform tt.expect('W2 campaign live_initial_send_enabled=false => refused, nothing persisted', tt.v3x(f, 'k-w2') <> 'created' and tt.attempts(f) = 0, tt.v3x(f, 'k-w2b'));

  -- ---------------------------------------------------------------- idempotent replay (N1)
  f := tt.mk('r1', 'r1@real.test');
  perform tt.expect_disp('R1a first call', tt.v3(f, 'k-r1'), 'created');
  select id into first_attempt from backlink_outreach_attempts where workspace_id = f.ws;
  perform tt.expect_disp('R1b legitimate resumption: same key, still requested, nothing changed => existing (V2 replay)', tt.v3(f, 'k-r1'), 'existing');
  perform tt.expect('R1c replay creates no second attempt and keeps the same attempt id',
                    tt.attempts(f) = 1 and (select id from backlink_outreach_attempts where workspace_id = f.ws) = first_attempt);

  f := tt.mk('r2', 'r2@real.test');
  perform tt.v3(f, 'k-r2');
  insert into backlink_email_suppressions(workspace_id, email_normalized, reason, source) values (f.ws, 'r2@real.test', 'unsubscribed', 'admin_unsubscribe');
  perform tt.expect_disp('R2 replay of a requested attempt after the recipient was suppressed => refused', tt.v3(f, 'k-r2'), 'recipient_suppressed');

  f := tt.mk('r3', 'r3@real.test');
  perform tt.v3(f, 'k-r3');
  update backlink_production_eligibility set status = 'revoked', reviewed_by = f.actor, reviewed_at = now() where contact_id = f.contact;
  perform tt.expect_disp('R3 replay after the production eligibility was revoked => refused', tt.v3(f, 'k-r3'), 'production_eligibility_required');

  f := tt.mk('r4', 'r4-old@real.test');
  perform tt.v3(f, 'k-r4');
  update backlink_contacts set email_normalized = 'r4-new@real.test' where id = f.contact;
  perform tt.expect_disp('R4 replay after the contact email changed => refused', tt.v3(f, 'k-r4'), 'production_eligibility_required');

  f := tt.mk('r5', 'r5@real.test');
  perform tt.v3(f, 'k-r5');
  perform tt.mbx(f, 'r5@real.test', 'undeliverable', interval '0 seconds', 'later');
  perform tt.expect_disp('R5 replay after a newer undeliverable verification => refused', tt.v3(f, 'k-r5'), 'mailbox_not_deliverable');

  f := tt.mk('r6', 'r6@real.test');
  perform tt.v3(f, 'k-r6');
  update backlink_contacts set contact_status = 'do_not_contact', do_not_contact_at = now(), do_not_contact_reason = 'fixture' where id = f.contact;
  perform tt.expect_disp('R6 replay after the contact became do_not_contact => refused', tt.v3(f, 'k-r6'), 'ineligible');

  f := tt.mk('r7', 'r7@real.test');
  perform tt.v3(f, 'k-r7');
  insert into backlink_outreach_attempts(workspace_id, outreach_id, actor_user_id, channel, provider, recipient, idempotency_key, attempt_kind, status, requested_at, error_code, error_message)
    values (f.ws, tt.second(f, 'r7-other@real.test'), f.actor, 'email', 'resend', 'r7@real.test', 'other-unknown', 'initial', 'unknown', now() - interval '1 day', 'E', 'unknown');
  perform tt.expect_disp('R7 replay while ANOTHER attempt for the recipient is unknown => refused', tt.v3(f, 'k-r7'), 'recipient_unknown_attempt');

  -- terminal replays are returned as V2 did (they can never lead to a provider call)
  f := tt.mk('r8', 'r8@real.test');
  perform tt.v3(f, 'k-r8');
  update backlink_outreach_attempts set status = 'accepted', accepted_at = now(), resolved_at = now(), provider_message_id = 'pm-r8-' || gen_random_uuid() where workspace_id = f.ws;
  insert into backlink_email_suppressions(workspace_id, email_normalized, reason, source) values (f.ws, 'r8@real.test', 'unsubscribed', 'admin_unsubscribe');
  perform tt.expect_disp('R8 replay of an ACCEPTED attempt is returned as before even if now suppressed', tt.v3(f, 'k-r8'), 'existing');
  perform tt.expect('R8b no extra attempt', tt.attempts(f) = 1);

  f := tt.mk('r9', 'r9@real.test');
  perform tt.v3(f, 'k-r9');
  update backlink_outreach_attempts set status = 'failed', failed_at = now(), resolved_at = now(), error_code = 'E', error_message = 'failed' where workspace_id = f.ws;
  perform tt.expect_disp('R9 replay of a FAILED attempt is returned as before (no new attempt)', tt.v3(f, 'k-r9'), 'existing');
  perform tt.expect('R9b no extra attempt', tt.attempts(f) = 1);

  f := tt.mk('r10', 'r10@real.test');
  perform tt.v3(f, 'k-r10');
  perform tt.expect_disp('R10 a DIFFERENT key for a recipient already attempted => refused', tt.v3(f, 'k-r10-other'), 'recipient_previously_attempted');
  perform tt.expect('R10b still exactly one attempt', tt.attempts(f) = 1);
end $$;
select name || ' :: ' || case when ok then 'PASS' else 'FAIL' end || coalesce('  (' || detail || ')', '') from tt.results order by name;
select 'TOTAL pass=' || count(*) filter (where ok) || ' fail=' || count(*) filter (where not ok) from tt.results;
select case when count(*) filter (where not ok) = 0 then 'SCENARIOS OK' else 'SCENARIOS FAILED' end from tt.results;
\endif

\if :is_csetup
-- Concurrency fixtures: A = one outreach hammered with the SAME key and with DISTINCT keys;
-- B = two outreach rows (two contacts) in ONE workspace that share the same recipient address.
delete from tt.conc_log;
drop table if exists tt.conc;
create table tt.conc as
  select 'A'::text as tag, (f).ws, (f).camp, (f).outreach, (f).actor from (select tt.mk('cc-a', 'cc-a@real.test') as f) x;
do $$
declare f tt.fx; v_out2 uuid;
begin
  f := tt.mk('cc-b', 'cc-b@real.test');
  insert into tt.conc select 'B1', f.ws, f.camp, f.outreach, f.actor;
  v_out2 := tt.second(f, 'cc-b@real.test', true);
  insert into tt.conc select 'B2', f.ws, f.camp, v_out2, f.actor;
end $$;
-- Race wrapper: same transaction semantics as a PostgREST rpc call.
create or replace function tt.race(p_tag text, p_scenario text, p_key text) returns void language plpgsql as $$
declare c record; r record;
begin
  select * into c from tt.conc where tag = p_tag;
  select * into r from reserve_backlink_approved_initial_attempt_v3(c.ws, c.camp, c.outreach, c.actor, gen_random_uuid(), p_key, encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'), 'v1', now());
  insert into tt.conc_log(scenario, disposition, attempt_id) values (p_scenario, r.disposition, r.attempt_id);
end $$;
\endif

\if :is_cassert
do $$
declare n integer; d integer; a integer;
begin
  -- 1. same key, 16 simultaneous clients on one outreach: one attempt, everyone saw the same attempt
  select count(*) into n from tt.conc_log where scenario = 'same_key';
  select count(*) into a from backlink_outreach_attempts where workspace_id = (select ws from tt.conc where tag = 'A');
  select count(distinct attempt_id) into d from tt.conc_log where scenario = 'same_key' and attempt_id is not null;
  if n <> 16 or a <> 1 or d <> 1 then raise exception 'CONCURRENCY same-key: calls=% attempts=% distinct_attempt_ids=%', n, a, d; end if;
  if exists (select 1 from tt.conc_log where scenario = 'same_key' and disposition not in ('created', 'existing')) then
    raise exception 'CONCURRENCY same-key: unexpected disposition %', (select string_agg(distinct disposition, ',') from tt.conc_log where scenario = 'same_key' and disposition not in ('created', 'existing'));
  end if;
  -- 2. distinct keys, same recipient, two outreach rows of one workspace: exactly one reservation overall
  select count(*) into a from backlink_outreach_attempts where workspace_id = (select ws from tt.conc where tag = 'B1');
  select count(*) into n from tt.conc_log where scenario = 'distinct_keys' and disposition = 'created';
  if a <> 1 or n <> 1 then raise exception 'CONCURRENCY distinct keys / shared recipient: attempts=% created=%', a, n; end if;
  if exists (select 1 from tt.conc_log where scenario = 'distinct_keys' and disposition not in ('created', 'recipient_previously_attempted')) then
    raise exception 'CONCURRENCY distinct keys: unexpected disposition %', (select string_agg(distinct disposition, ',') from tt.conc_log where scenario = 'distinct_keys' and disposition not in ('created', 'recipient_previously_attempted'));
  end if;
end $$;
select 'CONCURRENCY OK';
\endif
