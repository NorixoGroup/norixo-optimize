begin;

create function public.backlink_contact_form_verification_evidence_valid(p_safe_evidence jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = public
as $$
  select case
    when p_safe_evidence is null then false
    when jsonb_typeof(p_safe_evidence) <> 'object' then false
    when length(p_safe_evidence::text) > 8192 then false
    when coalesce(p_safe_evidence->>'form_count', '') !~ '^[0-9]+$' then false
    else
      p_safe_evidence->>'actual_form_observed' = 'true'
      and (p_safe_evidence->>'form_count')::integer >= 1
      and p_safe_evidence->>'message_field_present' = 'true'
      and p_safe_evidence->>'submit_control_present' = 'true'
      and p_safe_evidence->>'contact_intent' = 'true'
      and p_safe_evidence->>'newsletter_only' = 'false'
      and p_safe_evidence->>'login_only' = 'false'
      and p_safe_evidence->>'support_only' = 'false'
      and p_safe_evidence->>'sales_demo_only' = 'false'
  end
$$;

create table public.backlink_contact_form_verifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.backlink_contacts(id) on delete restrict,
  form_url text not null check (form_url = trim(form_url) and form_url ~ '^https://[^[:space:]]+$' and position(chr(92) in form_url) = 0),
  verification_state text not null check (verification_state in ('verified','rejected')),
  verified_at timestamptz,
  evidence_version text not null check (evidence_version = trim(evidence_version) and char_length(evidence_version) > 0),
  form_fingerprint text check (form_fingerprint is null or (form_fingerprint = trim(form_fingerprint) and char_length(form_fingerprint) > 0)),
  safe_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_evidence) = 'object' and length(safe_evidence::text) <= 8192),
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_contact_form_verifications_verified_evidence_check
    check (verification_state <> 'verified' or (verified_at is not null and public.backlink_contact_form_verification_evidence_valid(safe_evidence)))
);

create unique index backlink_contact_form_verifications_one_current_per_url_idx
  on public.backlink_contact_form_verifications (workspace_id, contact_id, form_url);
create index backlink_contact_form_verifications_workspace_contact_created_idx
  on public.backlink_contact_form_verifications (workspace_id, contact_id, created_at desc, id desc);

create function public.validate_backlink_contact_form_verification_binding() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.backlink_contacts; form text;
begin
  select * into c from public.backlink_contacts where id = new.contact_id and workspace_id = new.workspace_id;
  form := nullif(trim(coalesce(c.contact_form_url, '')), '');
  if not found or form is null or form <> new.form_url then raise exception 'CONTACT_FORM_VERIFICATION_FORM_MISMATCH'; end if;
  if new.verification_state = 'verified' and not public.backlink_contact_form_verification_evidence_valid(new.safe_evidence) then raise exception 'CONTACT_FORM_VERIFICATION_EVIDENCE_INVALID'; end if;
  return new;
end; $$;
create trigger trg_backlink_contact_form_verifications_binding before insert or update of workspace_id,contact_id,form_url,verification_state,verified_at,safe_evidence on public.backlink_contact_form_verifications for each row execute function public.validate_backlink_contact_form_verification_binding();

create function public.has_current_backlink_contact_form_verification(p_workspace_id uuid, p_contact_id uuid, p_form_url text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.backlink_contacts c
    join public.backlink_contact_form_verifications v
      on v.workspace_id = c.workspace_id
      and v.contact_id = c.id
      and v.form_url = trim(c.contact_form_url)
    where p_workspace_id is not null
      and p_contact_id is not null
      and c.workspace_id = p_workspace_id
      and c.id = p_contact_id
      and nullif(trim(coalesce(c.contact_form_url, '')), '') is not null
      and trim(c.contact_form_url) = trim(coalesce(p_form_url, ''))
      and trim(c.contact_form_url) ~ '^https://[^[:space:]]+$'
      and position(chr(92) in trim(c.contact_form_url)) = 0
      and v.verification_state = 'verified'
      and v.verified_at is not null
      and public.backlink_contact_form_verification_evidence_valid(v.safe_evidence)
  )
$$;

create or replace function public.validate_backlink_contact_form_approval_binding() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.backlink_outreach; c public.backlink_contacts; op public.backlink_opportunities;
begin
  select * into o from public.backlink_outreach where id = new.outreach_id and workspace_id = new.workspace_id;
  if not found or o.campaign_id <> new.campaign_id or o.contact_id <> new.contact_id or o.opportunity_id <> new.opportunity_id or o.channel <> 'contact_form' then raise exception 'CONTACT_FORM_APPROVAL_BINDING_MISMATCH'; end if;
  select * into c from public.backlink_contacts where id = new.contact_id and workspace_id = new.workspace_id;
  if not found or nullif(trim(coalesce(c.contact_form_url, '')), '') is null or trim(c.contact_form_url) <> new.form_url then raise exception 'CONTACT_FORM_APPROVAL_FORM_MISMATCH'; end if;
  if not public.has_current_backlink_contact_form_verification(new.workspace_id, new.contact_id, new.form_url) then raise exception 'CONTACT_FORM_VERIFICATION_REQUIRED'; end if;
  select * into op from public.backlink_opportunities where id = new.opportunity_id and workspace_id = new.workspace_id;
  if not found or nullif(trim(coalesce(op.target_page_url, '')), '') is null or trim(op.target_page_url) <> new.target_url then raise exception 'CONTACT_FORM_APPROVAL_TARGET_MISMATCH'; end if;
  return new;
end; $$;

create or replace function public.validate_backlink_contact_form_run_binding() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.backlink_contact_form_approvals;
begin
  select * into a from public.backlink_contact_form_approvals where id = new.approval_id and workspace_id = new.workspace_id;
  if not found or a.campaign_id <> new.campaign_id or a.outreach_id <> new.outreach_id or a.form_url <> new.form_url then raise exception 'CONTACT_FORM_RUN_APPROVAL_BINDING_MISMATCH'; end if;
  if not public.has_current_backlink_contact_form_verification(new.workspace_id, a.contact_id, new.form_url) then raise exception 'CONTACT_FORM_VERIFICATION_REQUIRED'; end if;
  if new.final_attempt_id is not null and not exists (select 1 from public.backlink_outreach_attempts x where x.id = new.final_attempt_id and x.workspace_id = new.workspace_id and x.outreach_id = new.outreach_id and x.channel = 'contact_form' and x.status = 'accepted') then raise exception 'CONTACT_FORM_RUN_ATTEMPT_BINDING_MISMATCH'; end if;
  return new;
end; $$;

create or replace function public.approve_backlink_contact_form_initial_v1(
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
  if target is null or form is null or form !~ '^https://[^[:space:]]+$' or position(chr(92) in form) <> 0 or nullif(trim(coalesce(o.subject,'')), '') is null or nullif(trim(coalesce(o.body,'')), '') is null then raise exception 'CONTACT_FORM_APPROVAL_CONTENT_INCOMPLETE'; end if;
  if not public.has_current_backlink_contact_form_verification(p_workspace_id, c.id, form) then raise exception 'CONTACT_FORM_VERIFICATION_REQUIRED'; end if;
  f := public.contact_form_approval_fingerprint(p_workspace_id,o.campaign_id,o.id,c.id,op.id,target,form,sn,se,sc,sw,trim(o.subject),trim(o.body));
  select * into a from public.backlink_contact_form_approvals as approval where workspace_id=p_workspace_id and outreach_id=o.id and approval.content_fingerprint=f for update;
  if found then return query select a.id, 'existing', a.content_fingerprint; return; end if;
  insert into public.backlink_contact_form_approvals(workspace_id,campaign_id,outreach_id,contact_id,opportunity_id,target_url,form_url,sender_name,sender_email,sender_company,sender_website,subject,body,content_fingerprint,approved_by_user_id) values(p_workspace_id,o.campaign_id,o.id,c.id,op.id,target,form,sn,se,sc,sw,trim(o.subject),trim(o.body),f,p_approved_by_user_id) returning * into a;
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

alter table public.backlink_contact_form_verifications enable row level security;
create policy "backlink_contact_form_verifications_select_workspace_members" on public.backlink_contact_form_verifications for select to authenticated using (public.is_workspace_member(workspace_id));
revoke all on public.backlink_contact_form_verifications from public, anon, authenticated;
grant select on public.backlink_contact_form_verifications to authenticated;
grant select, insert, update on public.backlink_contact_form_verifications to service_role;

revoke all on function public.backlink_contact_form_verification_evidence_valid(jsonb) from public, anon, authenticated;
revoke all on function public.has_current_backlink_contact_form_verification(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.approve_backlink_contact_form_initial_v1(uuid,uuid,uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.queue_backlink_contact_form_run_v1(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.backlink_contact_form_verification_evidence_valid(jsonb) to service_role;
grant execute on function public.has_current_backlink_contact_form_verification(uuid,uuid,text) to service_role;
grant execute on function public.approve_backlink_contact_form_initial_v1(uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.queue_backlink_contact_form_run_v1(uuid,uuid,uuid) to service_role;

comment on table public.backlink_contact_form_verifications is 'URL-bound, safe structural evidence required before contact-form approval or queue.';
comment on function public.has_current_backlink_contact_form_verification(uuid,uuid,text) is 'Fail-closed current-contact-form verification gate. Requires exact current URL, verified_at, verified state, and bounded safe structural evidence.';

commit;
