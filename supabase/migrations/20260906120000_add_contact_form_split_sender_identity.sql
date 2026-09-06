begin;

alter table public.backlink_contact_form_approvals
  add column sender_first_name text,
  add column sender_last_name text,
  add constraint backlink_contact_form_approvals_sender_first_name_check
    check (sender_first_name is null or (sender_first_name = trim(sender_first_name) and char_length(sender_first_name) between 1 and 120)),
  add constraint backlink_contact_form_approvals_sender_last_name_check
    check (sender_last_name is null or (sender_last_name = trim(sender_last_name) and char_length(sender_last_name) between 1 and 120));

alter table public.backlink_contact_form_approvals
  drop constraint if exists backlink_contact_form_approvals_content_fingerprint_check,
  add constraint backlink_contact_form_approvals_content_fingerprint_check
    check (content_fingerprint ~ '^(cf1|cf2)_[0-9a-f]{64}$');

create function public.contact_form_approval_fingerprint_v2(
  p_workspace_id uuid, p_campaign_id uuid, p_outreach_id uuid, p_contact_id uuid, p_opportunity_id uuid,
  p_target_url text, p_form_url text, p_sender_name text, p_sender_first_name text, p_sender_last_name text,
  p_sender_email text, p_sender_company text, p_sender_website text, p_subject text, p_body text
) returns text language sql immutable security invoker set search_path = public as $$
  select 'cf2_' || encode(extensions.digest(convert_to(array_to_json(array[
    'cf2', trim(p_workspace_id::text), trim(p_campaign_id::text), trim(p_outreach_id::text), trim(p_contact_id::text), trim(p_opportunity_id::text),
    trim(p_target_url), trim(p_form_url), trim(p_sender_name),
    coalesce(nullif(trim(coalesce(p_sender_first_name, '')), ''), ''),
    coalesce(nullif(trim(coalesce(p_sender_last_name, '')), ''), ''),
    trim(p_sender_email), trim(p_sender_company), trim(p_sender_website), trim(p_subject), trim(p_body)
  ])::text, 'UTF8'), 'sha256'), 'hex')
$$;

revoke all on function public.approve_backlink_contact_form_initial_v1(uuid,uuid,uuid,text,text,text,text) from public, anon, authenticated, service_role;
drop function public.approve_backlink_contact_form_initial_v1(uuid,uuid,uuid,text,text,text,text);

create function public.approve_backlink_contact_form_initial_v1(
  p_workspace_id uuid, p_outreach_id uuid, p_approved_by_user_id uuid, p_sender_name text, p_sender_email text,
  p_sender_company text, p_sender_website text, p_sender_first_name text default null, p_sender_last_name text default null
) returns table(approval_id uuid, disposition text, content_fingerprint text)
language plpgsql security definer set search_path = public as $$
declare
  o public.backlink_outreach;
  c public.backlink_contacts;
  op public.backlink_opportunities;
  a public.backlink_contact_form_approvals;
  f text;
  target text;
  form text;
  sn text := trim(coalesce(p_sender_name,''));
  se text := trim(coalesce(p_sender_email,''));
  sc text := trim(coalesce(p_sender_company,''));
  sw text := trim(coalesce(p_sender_website,''));
  sfn text := nullif(trim(coalesce(p_sender_first_name,'')), '');
  sln text := nullif(trim(coalesce(p_sender_last_name,'')), '');
begin
  if p_workspace_id is null
    or p_outreach_id is null
    or p_approved_by_user_id is null
    or sn=''
    or se=''
    or sc=''
    or sw !~ '^https://[^[:space:]]+$'
    or (sfn is not null and char_length(sfn) > 120)
    or (sln is not null and char_length(sln) > 120)
  then
    raise exception 'CONTACT_FORM_APPROVAL_INVALID_INPUT';
  end if;
  select * into o from public.backlink_outreach where id=p_outreach_id and workspace_id=p_workspace_id for update; if not found then raise exception 'CONTACT_FORM_OUTREACH_NOT_FOUND'; end if;
  select * into c from public.backlink_contacts where id=o.contact_id and workspace_id=p_workspace_id for update; if not found then raise exception 'CONTACT_FORM_CONTACT_NOT_FOUND'; end if;
  select * into op from public.backlink_opportunities where id=o.opportunity_id and workspace_id=p_workspace_id for update; if not found then raise exception 'CONTACT_FORM_OPPORTUNITY_NOT_FOUND'; end if;
  target := nullif(trim(coalesce(op.target_page_url,'')), ''); form := nullif(trim(coalesce(c.contact_form_url,'')), '');
  if o.channel <> 'contact_form' or o.status <> 'draft' or o.current_attempt <> 0 or exists(select 1 from public.backlink_outreach_attempts x where x.workspace_id=p_workspace_id and x.outreach_id=o.id) then raise exception 'CONTACT_FORM_APPROVAL_INCONSISTENT_STATE'; end if;
  if c.contact_status in ('do_not_contact','archived') or c.do_not_contact_at is not null or c.archived_at is not null then raise exception 'CONTACT_FORM_CONTACT_SUPPRESSED'; end if;
  if target is null or form is null or form !~ '^https://[^[:space:]]+$' or position(chr(92) in form) <> 0 or nullif(trim(coalesce(o.subject,'')), '') is null or nullif(trim(coalesce(o.body,'')), '') is null then raise exception 'CONTACT_FORM_APPROVAL_CONTENT_INCOMPLETE'; end if;
  if not public.has_current_backlink_contact_form_verification(p_workspace_id, c.id, form) then raise exception 'CONTACT_FORM_VERIFICATION_REQUIRED'; end if;
  if sfn is null and sln is null then
    f := public.contact_form_approval_fingerprint(p_workspace_id,o.campaign_id,o.id,c.id,op.id,target,form,sn,se,sc,sw,trim(o.subject),trim(o.body));
  else
    f := public.contact_form_approval_fingerprint_v2(p_workspace_id,o.campaign_id,o.id,c.id,op.id,target,form,sn,sfn,sln,se,sc,sw,trim(o.subject),trim(o.body));
  end if;
  select * into a from public.backlink_contact_form_approvals as approval where workspace_id=p_workspace_id and outreach_id=o.id and approval.content_fingerprint=f for update;
  if found then return query select a.id, 'existing', a.content_fingerprint; return; end if;
  insert into public.backlink_contact_form_approvals(workspace_id,campaign_id,outreach_id,contact_id,opportunity_id,target_url,form_url,sender_name,sender_first_name,sender_last_name,sender_email,sender_company,sender_website,subject,body,content_fingerprint,approved_by_user_id) values(p_workspace_id,o.campaign_id,o.id,c.id,op.id,target,form,sn,sfn,sln,se,sc,sw,trim(o.subject),trim(o.body),f,p_approved_by_user_id) returning * into a;
  return query select a.id, 'created', a.content_fingerprint;
end; $$;

create or replace function public.queue_backlink_contact_form_run_v1(p_workspace_id uuid, p_outreach_id uuid, p_approval_id uuid)
returns table(run_id uuid, disposition text, state text)
language plpgsql security definer set search_path = public as $$
declare o public.backlink_outreach; c public.backlink_contacts; op public.backlink_opportunities; a public.backlink_contact_form_approvals; r public.backlink_contact_form_runs; f text;
begin
  select * into o from public.backlink_outreach where id=p_outreach_id and workspace_id=p_workspace_id for update; if not found then raise exception 'CONTACT_FORM_OUTREACH_NOT_FOUND'; end if;
  select * into a from public.backlink_contact_form_approvals where id=p_approval_id and workspace_id=p_workspace_id and outreach_id=o.id for update; if not found then raise exception 'CONTACT_FORM_APPROVAL_NOT_FOUND'; end if;
  select * into c from public.backlink_contacts where id=o.contact_id and workspace_id=p_workspace_id for update; select * into op from public.backlink_opportunities where id=o.opportunity_id and workspace_id=p_workspace_id for update;
  if not found or c.contact_status in ('do_not_contact','archived') or c.do_not_contact_at is not null or c.archived_at is not null then raise exception 'CONTACT_FORM_CONTACT_SUPPRESSED'; end if;
  if not public.has_current_backlink_contact_form_verification(p_workspace_id, c.id, a.form_url) then raise exception 'CONTACT_FORM_VERIFICATION_REQUIRED'; end if;
  if a.sender_first_name is null and a.sender_last_name is null then
    f := public.contact_form_approval_fingerprint(p_workspace_id,o.campaign_id,o.id,c.id,op.id,trim(op.target_page_url),trim(c.contact_form_url),a.sender_name,a.sender_email,a.sender_company,a.sender_website,trim(o.subject),trim(o.body));
  else
    f := public.contact_form_approval_fingerprint_v2(p_workspace_id,o.campaign_id,o.id,c.id,op.id,trim(op.target_page_url),trim(c.contact_form_url),a.sender_name,a.sender_first_name,a.sender_last_name,a.sender_email,a.sender_company,a.sender_website,trim(o.subject),trim(o.body));
  end if;
  if o.channel <> 'contact_form' or o.status <> 'draft' or o.current_attempt <> 0 or exists(select 1 from public.backlink_outreach_attempts x where x.workspace_id=p_workspace_id and x.outreach_id=o.id) or a.content_fingerprint <> f then raise exception 'CONTACT_FORM_APPROVAL_STALE'; end if;
  select * into r from public.backlink_contact_form_runs as run where run.workspace_id=p_workspace_id and run.outreach_id=o.id and run.state in ('queued','claimed','navigating','discovered','mapped','filled','pre_submit_validated','submitting') for update;
  if found then
    if r.approval_id = a.id then return query select r.id, 'existing', r.state; return; end if;
    raise exception 'CONTACT_FORM_RUN_ALREADY_ACTIVE';
  end if;
  insert into public.backlink_contact_form_runs(workspace_id,campaign_id,outreach_id,approval_id,form_url,form_schema_fingerprint) values(p_workspace_id,o.campaign_id,o.id,a.id,a.form_url,a.form_schema_fingerprint) returning * into r;
  insert into public.backlink_contact_form_run_events(workspace_id,run_id,outreach_id,state,event_type,safe_metadata) values(p_workspace_id,r.id,o.id,'queued','run_queued',jsonb_build_object('approval_id',a.id));
  return query select r.id, 'created', r.state;
end; $$;

create or replace function public.confirm_backlink_contact_form_submission_v1(p_run_id uuid, p_worker_id text, p_evidence_reference text, p_final_url text default null)
returns table(run_id uuid, attempt_id uuid, disposition text)
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_runs; o public.backlink_outreach; c public.backlink_contacts; op public.backlink_opportunities; a public.backlink_contact_form_approvals; attempt public.backlink_outreach_attempts; now_value timestamptz := clock_timestamp(); worker text := trim(coalesce(p_worker_id,'')); evidence text := trim(coalesce(p_evidence_reference,'')); fingerprint text;
begin
  if worker='' or evidence='' then raise exception 'CONTACT_FORM_CONFIRMATION_INVALID_INPUT'; end if;
  select * into r from public.backlink_contact_form_runs where id=p_run_id for update; if not found then raise exception 'CONTACT_FORM_RUN_NOT_FOUND'; end if;
  if r.state='submission_confirmed' and r.final_attempt_id is not null then return query select r.id,r.final_attempt_id,'existing'; return; end if;
  if r.state <> 'submitting' or r.claimed_by <> worker or r.lease_expires_at is null or r.lease_expires_at <= now_value then raise exception 'CONTACT_FORM_RUN_LEASE_LOST'; end if;
  select * into o from public.backlink_outreach where id=r.outreach_id and workspace_id=r.workspace_id for update; if not found then raise exception 'CONTACT_FORM_OUTREACH_NOT_FOUND'; end if;
  select * into c from public.backlink_contacts where id=o.contact_id and workspace_id=o.workspace_id for update; if not found then raise exception 'CONTACT_FORM_CONTACT_NOT_FOUND'; end if;
  select * into op from public.backlink_opportunities where id=o.opportunity_id and workspace_id=o.workspace_id for update; if not found then raise exception 'CONTACT_FORM_OPPORTUNITY_NOT_FOUND'; end if;
  select * into a from public.backlink_contact_form_approvals where id=r.approval_id and workspace_id=r.workspace_id for update; if not found then raise exception 'CONTACT_FORM_APPROVAL_NOT_FOUND'; end if;
  if a.sender_first_name is null and a.sender_last_name is null then
    fingerprint := public.contact_form_approval_fingerprint(r.workspace_id,o.campaign_id,o.id,c.id,op.id,trim(op.target_page_url),trim(c.contact_form_url),a.sender_name,a.sender_email,a.sender_company,a.sender_website,trim(o.subject),trim(o.body));
  else
    fingerprint := public.contact_form_approval_fingerprint_v2(r.workspace_id,o.campaign_id,o.id,c.id,op.id,trim(op.target_page_url),trim(c.contact_form_url),a.sender_name,a.sender_first_name,a.sender_last_name,a.sender_email,a.sender_company,a.sender_website,trim(o.subject),trim(o.body));
  end if;
  if o.channel <> 'contact_form' or o.status <> 'draft' or o.current_attempt <> 0 or c.contact_status in ('do_not_contact','archived') or c.do_not_contact_at is not null or c.archived_at is not null then raise exception 'CONTACT_FORM_CONFIRMATION_INCONSISTENT_STATE'; end if;
  if r.campaign_id <> o.campaign_id or a.campaign_id <> o.campaign_id or a.outreach_id <> o.id or a.contact_id <> c.id or a.opportunity_id <> op.id or a.form_url <> trim(c.contact_form_url) or a.target_url <> trim(op.target_page_url) or r.form_url <> a.form_url or a.content_fingerprint <> fingerprint then raise exception 'CONTACT_FORM_APPROVAL_STALE'; end if;
  if exists(select 1 from public.backlink_outreach_attempts x where x.workspace_id=r.workspace_id and x.outreach_id=o.id and x.attempt_kind='initial' and x.status='accepted') then raise exception 'CONTACT_FORM_ACCEPTED_INITIAL_EXISTS'; end if;
  insert into public.backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at,accepted_at,resolved_at) values(r.workspace_id,o.id,a.approved_by_user_id,'contact_form','automated_contact_form',a.form_url,'contact-form-confirmed:'||r.id::text,'initial','accepted',now_value,now_value,now_value) returning * into attempt;
  update public.backlink_outreach set status='active',current_attempt=1,first_contact_at=now_value,last_attempt_at=now_value where id=o.id and workspace_id=o.workspace_id;
  update public.backlink_contact_form_runs set state='submission_confirmed', final_attempt_id=attempt.id, evidence_reference=evidence, final_url=nullif(trim(p_final_url),''), result_class='semantic_success', finished_at=now_value where id=r.id returning * into r;
  insert into public.backlink_contact_form_run_events(workspace_id,run_id,outreach_id,state,event_type,safe_metadata,evidence_reference,occurred_at) values(r.workspace_id,r.id,r.outreach_id,'submission_confirmed','submission_confirmed',jsonb_build_object('attempt_id',attempt.id),evidence,now_value);
  return query select r.id,attempt.id,'created';
end; $$;

revoke all on function public.contact_form_approval_fingerprint_v2(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.approve_backlink_contact_form_initial_v1(uuid,uuid,uuid,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.queue_backlink_contact_form_run_v1(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.confirm_backlink_contact_form_submission_v1(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.contact_form_approval_fingerprint_v2(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.approve_backlink_contact_form_initial_v1(uuid,uuid,uuid,text,text,text,text,text,text) to service_role;
grant execute on function public.queue_backlink_contact_form_run_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.confirm_backlink_contact_form_submission_v1(uuid,text,text,text) to service_role;

comment on table public.backlink_contact_form_approvals is 'CF1/CF2 immutable, human-approved contact-form submission snapshots.';

commit;
