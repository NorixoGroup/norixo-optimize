begin;

create table public.backlink_contact_form_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.backlink_campaigns(id) on delete restrict,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  contact_id uuid not null references public.backlink_contacts(id) on delete restrict,
  opportunity_id uuid not null references public.backlink_opportunities(id) on delete restrict,
  target_url text not null check (target_url = trim(target_url) and char_length(target_url) > 0),
  form_url text not null check (form_url = trim(form_url) and form_url ~ '^https://[^[:space:]]+$'),
  sender_name text not null check (sender_name = trim(sender_name) and char_length(sender_name) > 0),
  sender_email text not null check (sender_email = trim(sender_email) and char_length(sender_email) > 0),
  sender_company text not null check (sender_company = trim(sender_company) and char_length(sender_company) > 0),
  sender_website text not null check (sender_website = trim(sender_website) and sender_website ~ '^https://[^[:space:]]+$'),
  subject text not null check (subject = trim(subject) and char_length(subject) > 0),
  body text not null check (body = trim(body) and char_length(body) > 0),
  content_fingerprint text not null check (content_fingerprint ~ '^cf1_[0-9a-f]{64}$'),
  form_schema_fingerprint text,
  approved_by_user_id uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, outreach_id, content_fingerprint)
);

create index backlink_contact_form_approvals_workspace_outreach_created_idx
  on public.backlink_contact_form_approvals (workspace_id, outreach_id, created_at desc, id desc);

create table public.backlink_contact_form_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.backlink_campaigns(id) on delete restrict,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  approval_id uuid not null references public.backlink_contact_form_approvals(id) on delete restrict,
  state text not null default 'queued' check (state in ('queued','claimed','navigating','discovered','mapped','filled','pre_submit_validated','submitting','submission_confirmed','submission_ambiguous','blocked_captcha','blocked_policy','failed_pre_submit','manual_review')),
  pre_submit_attempt_count integer not null default 0 check (pre_submit_attempt_count >= 0),
  max_pre_submit_attempts integer not null default 2 check (max_pre_submit_attempts between 0 and 10),
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  started_at timestamptz,
  submit_started_at timestamptz,
  finished_at timestamptz,
  form_url text not null check (form_url = trim(form_url) and form_url ~ '^https://[^[:space:]]+$'),
  form_schema_fingerprint text,
  final_url text,
  result_class text,
  safe_error_code text,
  evidence_reference text,
  final_attempt_id uuid references public.backlink_outreach_attempts(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((claimed_by is null and claimed_at is null and lease_expires_at is null) or (claimed_by is not null and claimed_at is not null and lease_expires_at is not null))
);

create unique index backlink_contact_form_runs_one_live_per_outreach_idx
  on public.backlink_contact_form_runs (workspace_id, outreach_id)
  where state in ('queued','claimed','navigating','discovered','mapped','filled','pre_submit_validated','submitting');
create index backlink_contact_form_runs_claim_idx
  on public.backlink_contact_form_runs (state, created_at, id)
  where state = 'queued';

create table public.backlink_contact_form_run_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.backlink_contact_form_runs(id) on delete restrict,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  state text not null check (state in ('queued','claimed','navigating','discovered','mapped','filled','pre_submit_validated','submitting','submission_confirmed','submission_ambiguous','blocked_captcha','blocked_policy','failed_pre_submit','manual_review')),
  event_type text not null check (event_type = trim(event_type) and char_length(event_type) > 0),
  safe_metadata jsonb not null default '{}'::jsonb,
  safe_error_code text,
  evidence_hash text,
  evidence_reference text,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);
create index backlink_contact_form_run_events_history_idx
  on public.backlink_contact_form_run_events (workspace_id, run_id, occurred_at, created_at, id);

create function public.validate_backlink_contact_form_approval_binding() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.backlink_outreach; c public.backlink_contacts; op public.backlink_opportunities;
begin
  select * into o from public.backlink_outreach where id = new.outreach_id and workspace_id = new.workspace_id;
  if not found or o.campaign_id <> new.campaign_id or o.contact_id <> new.contact_id or o.opportunity_id <> new.opportunity_id or o.channel <> 'contact_form' then raise exception 'CONTACT_FORM_APPROVAL_BINDING_MISMATCH'; end if;
  select * into c from public.backlink_contacts where id = new.contact_id and workspace_id = new.workspace_id;
  if not found or nullif(trim(coalesce(c.contact_form_url, '')), '') is null or trim(c.contact_form_url) <> new.form_url then raise exception 'CONTACT_FORM_APPROVAL_FORM_MISMATCH'; end if;
  select * into op from public.backlink_opportunities where id = new.opportunity_id and workspace_id = new.workspace_id;
  if not found or nullif(trim(coalesce(op.target_page_url, '')), '') is null or trim(op.target_page_url) <> new.target_url then raise exception 'CONTACT_FORM_APPROVAL_TARGET_MISMATCH'; end if;
  return new;
end; $$;
create trigger trg_backlink_contact_form_approvals_binding before insert on public.backlink_contact_form_approvals for each row execute function public.validate_backlink_contact_form_approval_binding();
create function public.prevent_backlink_contact_form_approval_mutation() returns trigger language plpgsql security definer set search_path = public as $$ begin raise exception 'CONTACT_FORM_APPROVAL_IMMUTABLE'; end; $$;
create trigger trg_backlink_contact_form_approvals_immutable before update or delete on public.backlink_contact_form_approvals for each row execute function public.prevent_backlink_contact_form_approval_mutation();

create function public.validate_backlink_contact_form_run_binding() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.backlink_contact_form_approvals;
begin
  select * into a from public.backlink_contact_form_approvals where id = new.approval_id and workspace_id = new.workspace_id;
  if not found or a.campaign_id <> new.campaign_id or a.outreach_id <> new.outreach_id or a.form_url <> new.form_url then raise exception 'CONTACT_FORM_RUN_APPROVAL_BINDING_MISMATCH'; end if;
  if new.final_attempt_id is not null and not exists (select 1 from public.backlink_outreach_attempts x where x.id = new.final_attempt_id and x.workspace_id = new.workspace_id and x.outreach_id = new.outreach_id and x.channel = 'contact_form' and x.status = 'accepted') then raise exception 'CONTACT_FORM_RUN_ATTEMPT_BINDING_MISMATCH'; end if;
  return new;
end; $$;
create trigger trg_backlink_contact_form_runs_binding before insert or update of workspace_id,campaign_id,outreach_id,approval_id,form_url,final_attempt_id on public.backlink_contact_form_runs for each row execute function public.validate_backlink_contact_form_run_binding();
create trigger trg_backlink_contact_form_runs_updated_at before update on public.backlink_contact_form_runs for each row execute function public.set_backlink_foundation_updated_at();
create function public.prevent_backlink_contact_form_post_submit_retry() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.state = 'submitting' and new.state in ('queued','claimed','navigating','discovered','mapped','filled','pre_submit_validated') then raise exception 'CONTACT_FORM_RUN_POST_SUBMIT_RETRY_FORBIDDEN'; end if;
  return new;
end; $$;
create trigger trg_backlink_contact_form_runs_no_post_submit_retry before update of state on public.backlink_contact_form_runs for each row execute function public.prevent_backlink_contact_form_post_submit_retry();

create function public.validate_backlink_contact_form_run_event_binding() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.backlink_contact_form_runs r where r.id = new.run_id and r.workspace_id = new.workspace_id and r.outreach_id = new.outreach_id) then raise exception 'CONTACT_FORM_RUN_EVENT_BINDING_MISMATCH'; end if;
  return new;
end; $$;
create trigger trg_backlink_contact_form_run_events_binding before insert on public.backlink_contact_form_run_events for each row execute function public.validate_backlink_contact_form_run_event_binding();
create function public.prevent_backlink_contact_form_run_event_mutation() returns trigger language plpgsql security definer set search_path = public as $$ begin raise exception 'CONTACT_FORM_RUN_EVENT_IMMUTABLE'; end; $$;
create trigger trg_backlink_contact_form_run_events_immutable before update or delete on public.backlink_contact_form_run_events for each row execute function public.prevent_backlink_contact_form_run_event_mutation();

alter table public.backlink_contact_form_approvals enable row level security;
alter table public.backlink_contact_form_runs enable row level security;
alter table public.backlink_contact_form_run_events enable row level security;
create policy "backlink_contact_form_approvals_select_workspace_members" on public.backlink_contact_form_approvals for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "backlink_contact_form_runs_select_workspace_members" on public.backlink_contact_form_runs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "backlink_contact_form_run_events_select_workspace_members" on public.backlink_contact_form_run_events for select to authenticated using (public.is_workspace_member(workspace_id));
revoke all on public.backlink_contact_form_approvals, public.backlink_contact_form_runs, public.backlink_contact_form_run_events from anon, authenticated;
grant select on public.backlink_contact_form_approvals, public.backlink_contact_form_runs, public.backlink_contact_form_run_events to authenticated;

create function public.contact_form_approval_fingerprint(
  p_workspace_id uuid, p_campaign_id uuid, p_outreach_id uuid, p_contact_id uuid, p_opportunity_id uuid,
  p_target_url text, p_form_url text, p_sender_name text, p_sender_email text, p_sender_company text,
  p_sender_website text, p_subject text, p_body text
) returns text language sql immutable security invoker set search_path = public as $$
  select 'cf1_' || encode(extensions.digest(convert_to(array_to_json(array[
    'cf1', trim(p_workspace_id::text), trim(p_campaign_id::text), trim(p_outreach_id::text), trim(p_contact_id::text), trim(p_opportunity_id::text),
    trim(p_target_url), trim(p_form_url), trim(p_sender_name), trim(p_sender_email), trim(p_sender_company), trim(p_sender_website), trim(p_subject), trim(p_body)
  ])::text, 'UTF8'), 'sha256'), 'hex')
$$;

create function public.approve_backlink_contact_form_initial_v1(
  p_workspace_id uuid, p_outreach_id uuid, p_approved_by_user_id uuid, p_sender_name text, p_sender_email text,
  p_sender_company text, p_sender_website text
) returns table(approval_id uuid, disposition text, content_fingerprint text)
language plpgsql security definer set search_path = public as $$
declare o public.backlink_outreach; c public.backlink_contacts; op public.backlink_opportunities; a public.backlink_contact_form_approvals; f text; target text; form text; sn text := trim(coalesce(p_sender_name,'')); se text := trim(coalesce(p_sender_email,'')); sc text := trim(coalesce(p_sender_company,'')); sw text := trim(coalesce(p_sender_website,''));
begin
  if p_workspace_id is null or p_outreach_id is null or p_approved_by_user_id is null or sn='' or se='' or sc='' or sw !~ '^https://[^[:space:]]+$' then raise exception 'CONTACT_FORM_APPROVAL_INVALID_INPUT'; end if;
  select * into o from public.backlink_outreach where id=p_outreach_id and workspace_id=p_workspace_id for update; if not found then raise exception 'CONTACT_FORM_OUTREACH_NOT_FOUND'; end if;
  select * into c from public.backlink_contacts where id=o.contact_id and workspace_id=p_workspace_id for update; if not found then raise exception 'CONTACT_FORM_CONTACT_NOT_FOUND'; end if;
  select * into op from public.backlink_opportunities where id=o.opportunity_id and workspace_id=p_workspace_id for update; if not found then raise exception 'CONTACT_FORM_OPPORTUNITY_NOT_FOUND'; end if;
  target := nullif(trim(coalesce(op.target_page_url,'')), ''); form := nullif(trim(coalesce(c.contact_form_url,'')), '');
  if o.channel <> 'contact_form' or o.status <> 'draft' or o.current_attempt <> 0 or exists(select 1 from public.backlink_outreach_attempts x where x.workspace_id=p_workspace_id and x.outreach_id=o.id) then raise exception 'CONTACT_FORM_APPROVAL_INCONSISTENT_STATE'; end if;
  if c.contact_status in ('do_not_contact','archived') or c.do_not_contact_at is not null or c.archived_at is not null then raise exception 'CONTACT_FORM_CONTACT_SUPPRESSED'; end if;
  if target is null or form is null or form !~ '^https://[^[:space:]]+$' or nullif(trim(coalesce(o.subject,'')), '') is null or nullif(trim(coalesce(o.body,'')), '') is null then raise exception 'CONTACT_FORM_APPROVAL_CONTENT_INCOMPLETE'; end if;
  f := public.contact_form_approval_fingerprint(p_workspace_id,o.campaign_id,o.id,c.id,op.id,target,form,sn,se,sc,sw,trim(o.subject),trim(o.body));
  select * into a from public.backlink_contact_form_approvals as approval where workspace_id=p_workspace_id and outreach_id=o.id and approval.content_fingerprint=f for update;
  if found then return query select a.id, 'existing', a.content_fingerprint; return; end if;
  insert into public.backlink_contact_form_approvals(workspace_id,campaign_id,outreach_id,contact_id,opportunity_id,target_url,form_url,sender_name,sender_email,sender_company,sender_website,subject,body,content_fingerprint,approved_by_user_id) values(p_workspace_id,o.campaign_id,o.id,c.id,op.id,target,form,sn,se,sc,sw,trim(o.subject),trim(o.body),f,p_approved_by_user_id) returning * into a;
  return query select a.id, 'created', a.content_fingerprint;
end; $$;

create function public.queue_backlink_contact_form_run_v1(p_workspace_id uuid, p_outreach_id uuid, p_approval_id uuid)
returns table(run_id uuid, disposition text, state text)
language plpgsql security definer set search_path = public as $$
declare o public.backlink_outreach; c public.backlink_contacts; op public.backlink_opportunities; a public.backlink_contact_form_approvals; r public.backlink_contact_form_runs; f text;
begin
  select * into o from public.backlink_outreach where id=p_outreach_id and workspace_id=p_workspace_id for update; if not found then raise exception 'CONTACT_FORM_OUTREACH_NOT_FOUND'; end if;
  select * into a from public.backlink_contact_form_approvals where id=p_approval_id and workspace_id=p_workspace_id and outreach_id=o.id for update; if not found then raise exception 'CONTACT_FORM_APPROVAL_NOT_FOUND'; end if;
  select * into c from public.backlink_contacts where id=o.contact_id and workspace_id=p_workspace_id for update; select * into op from public.backlink_opportunities where id=o.opportunity_id and workspace_id=p_workspace_id for update;
  if not found or c.contact_status in ('do_not_contact','archived') or c.do_not_contact_at is not null or c.archived_at is not null then raise exception 'CONTACT_FORM_CONTACT_SUPPRESSED'; end if;
  f := public.contact_form_approval_fingerprint(p_workspace_id,o.campaign_id,o.id,c.id,op.id,trim(op.target_page_url),trim(c.contact_form_url),a.sender_name,a.sender_email,a.sender_company,a.sender_website,trim(o.subject),trim(o.body));
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

create function public.claim_next_backlink_contact_form_run_v1(p_worker_id text, p_lease_duration_seconds integer)
returns setof public.backlink_contact_form_runs
language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_runs; now_value timestamptz := clock_timestamp(); worker text := trim(coalesce(p_worker_id,''));
begin
  if worker='' or p_lease_duration_seconds not between 30 and 3600 then raise exception 'CONTACT_FORM_RUN_CLAIM_INVALID_INPUT'; end if;
  select * into r from public.backlink_contact_form_runs where state='queued' order by created_at,id for update skip locked limit 1;
  if not found then return; end if;
  update public.backlink_contact_form_runs set state='claimed',claimed_by=worker,claimed_at=now_value,lease_expires_at=now_value+make_interval(secs=>p_lease_duration_seconds),heartbeat_at=now_value,started_at=coalesce(started_at,now_value) where id=r.id returning * into r;
  insert into public.backlink_contact_form_run_events(workspace_id,run_id,outreach_id,state,event_type,safe_metadata,occurred_at) values(r.workspace_id,r.id,r.outreach_id,'claimed','run_claimed',jsonb_build_object('worker_id',worker),now_value);
  return next r;
end; $$;

create function public.heartbeat_backlink_contact_form_run_v1(p_run_id uuid, p_worker_id text, p_lease_duration_seconds integer)
returns public.backlink_contact_form_runs language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_runs; now_value timestamptz := clock_timestamp(); worker text := trim(coalesce(p_worker_id,''));
begin
  if worker='' or p_lease_duration_seconds not between 30 and 3600 then raise exception 'CONTACT_FORM_RUN_HEARTBEAT_INVALID_INPUT'; end if;
  update public.backlink_contact_form_runs set heartbeat_at=now_value,lease_expires_at=now_value+make_interval(secs=>p_lease_duration_seconds) where id=p_run_id and claimed_by=worker and lease_expires_at>now_value and state in ('claimed','navigating','discovered','mapped','filled','pre_submit_validated','submitting') returning * into r;
  if not found then raise exception 'CONTACT_FORM_RUN_LEASE_LOST'; end if; return r;
end; $$;

create function public.transition_backlink_contact_form_run_v1(p_run_id uuid, p_worker_id text, p_next_state text, p_event_type text, p_safe_metadata jsonb default '{}'::jsonb, p_safe_error_code text default null, p_evidence_reference text default null, p_final_url text default null)
returns public.backlink_contact_form_runs language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_runs; now_value timestamptz := clock_timestamp(); worker text := trim(coalesce(p_worker_id,'')); allowed boolean := false;
begin
  select * into r from public.backlink_contact_form_runs where id=p_run_id for update; if not found then raise exception 'CONTACT_FORM_RUN_NOT_FOUND'; end if;
  if worker='' or r.claimed_by <> worker or r.lease_expires_at is null or r.lease_expires_at <= now_value then raise exception 'CONTACT_FORM_RUN_LEASE_LOST'; end if;
  allowed := (r.state='claimed' and p_next_state in ('navigating','failed_pre_submit','blocked_policy','manual_review')) or (r.state='navigating' and p_next_state in ('discovered','failed_pre_submit','blocked_policy','blocked_captcha','manual_review')) or (r.state='discovered' and p_next_state in ('mapped','failed_pre_submit','blocked_policy','blocked_captcha','manual_review')) or (r.state='mapped' and p_next_state in ('filled','failed_pre_submit','blocked_policy','blocked_captcha','manual_review')) or (r.state='filled' and p_next_state in ('pre_submit_validated','failed_pre_submit','blocked_policy','blocked_captcha','manual_review')) or (r.state='pre_submit_validated' and p_next_state in ('submitting','failed_pre_submit','blocked_policy','blocked_captcha','manual_review')) or (r.state='submitting' and p_next_state in ('submission_ambiguous','manual_review'));
  if not allowed then raise exception 'CONTACT_FORM_RUN_INVALID_TRANSITION'; end if;
  if r.state='submitting' and p_next_state='queued' then raise exception 'CONTACT_FORM_RUN_POST_SUBMIT_RETRY_FORBIDDEN'; end if;
  update public.backlink_contact_form_runs set state=p_next_state, safe_error_code=coalesce(trim(p_safe_error_code),safe_error_code), evidence_reference=coalesce(trim(p_evidence_reference),evidence_reference), final_url=coalesce(trim(p_final_url),final_url), submit_started_at=case when p_next_state='submitting' then now_value else submit_started_at end, finished_at=case when p_next_state in ('submission_ambiguous','blocked_captcha','blocked_policy','failed_pre_submit','manual_review') then now_value else finished_at end where id=r.id returning * into r;
  insert into public.backlink_contact_form_run_events(workspace_id,run_id,outreach_id,state,event_type,safe_metadata,safe_error_code,evidence_reference,occurred_at) values(r.workspace_id,r.id,r.outreach_id,r.state,trim(p_event_type),coalesce(p_safe_metadata,'{}'::jsonb),case when r.state='failed_pre_submit' then nullif(trim(p_safe_error_code),'') else null end,nullif(trim(p_evidence_reference),''),now_value);
  return r;
end; $$;

create function public.confirm_backlink_contact_form_submission_v1(p_run_id uuid, p_worker_id text, p_evidence_reference text, p_final_url text default null)
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
  fingerprint := public.contact_form_approval_fingerprint(r.workspace_id,o.campaign_id,o.id,c.id,op.id,trim(op.target_page_url),trim(c.contact_form_url),a.sender_name,a.sender_email,a.sender_company,a.sender_website,trim(o.subject),trim(o.body));
  if o.channel <> 'contact_form' or o.status <> 'draft' or o.current_attempt <> 0 or c.contact_status in ('do_not_contact','archived') or c.do_not_contact_at is not null or c.archived_at is not null then raise exception 'CONTACT_FORM_CONFIRMATION_INCONSISTENT_STATE'; end if;
  if r.campaign_id <> o.campaign_id or a.campaign_id <> o.campaign_id or a.outreach_id <> o.id or a.contact_id <> c.id or a.opportunity_id <> op.id or a.form_url <> trim(c.contact_form_url) or a.target_url <> trim(op.target_page_url) or r.form_url <> a.form_url or a.content_fingerprint <> fingerprint then raise exception 'CONTACT_FORM_APPROVAL_STALE'; end if;
  if exists(select 1 from public.backlink_outreach_attempts x where x.workspace_id=r.workspace_id and x.outreach_id=o.id and x.attempt_kind='initial' and x.status='accepted') then raise exception 'CONTACT_FORM_ACCEPTED_INITIAL_EXISTS'; end if;
  insert into public.backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at,accepted_at,resolved_at) values(r.workspace_id,o.id,a.approved_by_user_id,'contact_form','automated_contact_form',a.form_url,'contact-form-confirmed:'||r.id::text,'initial','accepted',now_value,now_value,now_value) returning * into attempt;
  update public.backlink_outreach set status='active',current_attempt=1,first_contact_at=now_value,last_attempt_at=now_value where id=o.id and workspace_id=o.workspace_id;
  update public.backlink_contact_form_runs set state='submission_confirmed', final_attempt_id=attempt.id, evidence_reference=evidence, final_url=nullif(trim(p_final_url),''), result_class='semantic_success', finished_at=now_value where id=r.id returning * into r;
  insert into public.backlink_contact_form_run_events(workspace_id,run_id,outreach_id,state,event_type,safe_metadata,evidence_reference,occurred_at) values(r.workspace_id,r.id,r.outreach_id,'submission_confirmed','submission_confirmed',jsonb_build_object('attempt_id',attempt.id),evidence,now_value);
  return query select r.id,attempt.id,'created';
end; $$;

create function public.retry_backlink_contact_form_pre_submit_v1(p_run_id uuid, p_worker_id text)
returns public.backlink_contact_form_runs language plpgsql security definer set search_path = public as $$
declare r public.backlink_contact_form_runs; now_value timestamptz := clock_timestamp(); worker text := trim(coalesce(p_worker_id,''));
begin
  select * into r from public.backlink_contact_form_runs where id=p_run_id for update; if not found then raise exception 'CONTACT_FORM_RUN_NOT_FOUND'; end if;
  if worker='' or r.claimed_by <> worker or r.lease_expires_at is null or r.lease_expires_at <= now_value then raise exception 'CONTACT_FORM_RUN_LEASE_LOST'; end if;
  if r.state <> 'failed_pre_submit' or r.pre_submit_attempt_count >= r.max_pre_submit_attempts then raise exception 'CONTACT_FORM_RUN_PRE_SUBMIT_RETRY_UNAVAILABLE'; end if;
  update public.backlink_contact_form_runs set state='queued', pre_submit_attempt_count=pre_submit_attempt_count+1, claimed_by=null, claimed_at=null, lease_expires_at=null, heartbeat_at=null, finished_at=null, safe_error_code=null where id=r.id returning * into r;
  insert into public.backlink_contact_form_run_events(workspace_id,run_id,outreach_id,state,event_type,safe_metadata,occurred_at) values(r.workspace_id,r.id,r.outreach_id,'queued','pre_submit_retry_queued',jsonb_build_object('pre_submit_attempt_count',r.pre_submit_attempt_count),now_value);
  return r;
end; $$;

revoke all on function public.approve_backlink_contact_form_initial_v1(uuid,uuid,uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.queue_backlink_contact_form_run_v1(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.claim_next_backlink_contact_form_run_v1(text,integer) from public, anon, authenticated;
revoke all on function public.heartbeat_backlink_contact_form_run_v1(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.transition_backlink_contact_form_run_v1(uuid,text,text,text,jsonb,text,text,text) from public, anon, authenticated;
revoke all on function public.confirm_backlink_contact_form_submission_v1(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.retry_backlink_contact_form_pre_submit_v1(uuid,text) from public, anon, authenticated;
grant execute on function public.approve_backlink_contact_form_initial_v1(uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.queue_backlink_contact_form_run_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.claim_next_backlink_contact_form_run_v1(text,integer) to service_role;
grant execute on function public.heartbeat_backlink_contact_form_run_v1(uuid,text,integer) to service_role;
grant execute on function public.transition_backlink_contact_form_run_v1(uuid,text,text,text,jsonb,text,text,text) to service_role;
grant execute on function public.confirm_backlink_contact_form_submission_v1(uuid,text,text,text) to service_role;
grant execute on function public.retry_backlink_contact_form_pre_submit_v1(uuid,text) to service_role;

comment on table public.backlink_contact_form_approvals is 'CF1 immutable, human-approved contact-form submission snapshots.';
comment on table public.backlink_contact_form_runs is 'Durable contact-form browser execution queue. C2 defines no browser execution.';
comment on table public.backlink_contact_form_run_events is 'Append-only, deterministic contact-form automation timeline.';

commit;
