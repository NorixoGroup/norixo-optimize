begin;

create table public.backlink_linkedin_interactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  contact_id uuid not null references public.backlink_contacts(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  interaction_type text not null check (interaction_type in ('connection_invitation_sent','connection_accepted','connection_rejected','connection_withdrawn','connection_expired','message_sent','reply_confirmed')),
  occurred_at timestamptz not null,
  target_profile_url text not null check (target_profile_url = trim(target_profile_url) and target_profile_url ~ '^https://(www\.)?linkedin\.com/in/[^/?#]+/?(\?[^#]*)?$'),
  provider_connection_id text,
  provider_external_id text,
  source text not null default 'manual_confirmation' check (source = 'manual_confirmation'),
  content_fingerprint text,
  evidence_reference text,
  idempotency_key text not null check (idempotency_key = trim(idempotency_key) and char_length(idempotency_key) > 0),
  supersedes_interaction_id uuid references public.backlink_linkedin_interactions(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, idempotency_key)
);
create index backlink_linkedin_interactions_workspace_outreach_occurred_idx on public.backlink_linkedin_interactions(workspace_id, outreach_id, occurred_at, created_at);

create function public.validate_backlink_linkedin_interaction_binding() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.backlink_outreach o where o.id = new.outreach_id and o.workspace_id = new.workspace_id and o.contact_id = new.contact_id) then raise exception 'LINKEDIN_INTERACTION_BINDING_MISMATCH'; end if;
  if not exists (select 1 from public.backlink_contacts c where c.id = new.contact_id and c.workspace_id = new.workspace_id) then raise exception 'LINKEDIN_INTERACTION_CONTACT_WORKSPACE_MISMATCH'; end if;
  if new.target_profile_url is distinct from (select nullif(trim(coalesce(c.linkedin_url,'')), '') from public.backlink_contacts c where c.id = new.contact_id and c.workspace_id = new.workspace_id) then raise exception 'LINKEDIN_INTERACTION_TARGET_MISMATCH'; end if;
  return new;
end; $$;
create trigger trg_backlink_linkedin_interactions_binding before insert on public.backlink_linkedin_interactions for each row execute function public.validate_backlink_linkedin_interaction_binding();
create function public.prevent_backlink_linkedin_interaction_mutation() returns trigger language plpgsql security definer set search_path = public as $$ begin raise exception 'LINKEDIN_INTERACTION_IMMUTABLE'; end; $$;
create trigger trg_backlink_linkedin_interactions_immutable before update or delete on public.backlink_linkedin_interactions for each row execute function public.prevent_backlink_linkedin_interaction_mutation();
alter table public.backlink_linkedin_interactions enable row level security;
create policy "backlink_linkedin_interactions_select_workspace_admins" on public.backlink_linkedin_interactions for select to authenticated using (public.is_workspace_admin_or_owner(workspace_id));

create function public.record_backlink_manual_linkedin_interaction(p_workspace_id uuid, p_outreach_id uuid, p_actor_user_id uuid, p_interaction_type text, p_idempotency_key text)
returns table(disposition text, interaction_id uuid, occurred_at timestamptz, attempt_id uuid)
language plpgsql security definer set search_path = public as $$
declare o public.backlink_outreach; c public.backlink_contacts; e public.backlink_linkedin_interactions; at_count integer; target text; now_value timestamptz := clock_timestamp();
begin
  if p_workspace_id is null or p_outreach_id is null or p_actor_user_id is null or nullif(trim(p_idempotency_key),'') is null or p_interaction_type not in ('connection_invitation_sent','connection_accepted','connection_rejected','connection_withdrawn','connection_expired') then raise exception 'LINKEDIN_INTERACTION_INVALID_INPUT'; end if;
  select * into o from public.backlink_outreach where id=p_outreach_id and workspace_id=p_workspace_id for update; if not found then raise exception 'LINKEDIN_INTERACTION_NOT_FOUND'; end if;
  select * into c from public.backlink_contacts where id=o.contact_id and workspace_id=p_workspace_id for update; if not found then raise exception 'LINKEDIN_INTERACTION_CONTACT_NOT_FOUND'; end if;
  target := nullif(trim(coalesce(c.linkedin_url,'')), '');
  if o.channel <> 'linkedin' or target is null or target !~ '^https://(www\.)?linkedin\.com/in/[^/?#]+/?(\?[^#]*)?$' then raise exception 'LINKEDIN_INTERACTION_INVALID_LINKEDIN_TARGET'; end if;
  if c.contact_status in ('do_not_contact','archived') or c.do_not_contact_at is not null or c.archived_at is not null then raise exception 'LINKEDIN_INTERACTION_CONTACT_SUPPRESSED'; end if;
  select count(*) into at_count from public.backlink_outreach_attempts where workspace_id=p_workspace_id and outreach_id=o.id;
  select * into e from public.backlink_linkedin_interactions where workspace_id=p_workspace_id and idempotency_key=trim(p_idempotency_key) for update;
  if found then
    if e.outreach_id <> o.id or e.contact_id <> c.id or e.actor_user_id <> p_actor_user_id or e.interaction_type <> p_interaction_type or e.target_profile_url <> target then raise exception 'LINKEDIN_INTERACTION_IDEMPOTENCY_CONFLICT'; end if;
    return query select 'existing', e.id, e.occurred_at, null::uuid; return;
  end if;
  if o.status <> 'draft' or o.current_attempt <> 0 or at_count <> 0 then raise exception 'LINKEDIN_INTERACTION_INCONSISTENT_STATE'; end if;
  if p_interaction_type = 'connection_invitation_sent' then
    if exists (select 1 from public.backlink_linkedin_interactions where workspace_id=p_workspace_id and outreach_id=o.id) then raise exception 'LINKEDIN_INTERACTION_INVALID_TRANSITION'; end if;
  elsif not exists (select 1 from public.backlink_linkedin_interactions where workspace_id=p_workspace_id and outreach_id=o.id and interaction_type='connection_invitation_sent')
    or exists (select 1 from public.backlink_linkedin_interactions where workspace_id=p_workspace_id and outreach_id=o.id and interaction_type <> 'connection_invitation_sent') then raise exception 'LINKEDIN_INTERACTION_INVALID_TRANSITION'; end if;
  insert into public.backlink_linkedin_interactions(workspace_id,outreach_id,contact_id,actor_user_id,interaction_type,occurred_at,target_profile_url,idempotency_key) values(p_workspace_id,o.id,c.id,p_actor_user_id,p_interaction_type,now_value,target,trim(p_idempotency_key)) returning * into e;
  return query select 'created', e.id, e.occurred_at, null::uuid;
end; $$;

create function public.record_backlink_manual_linkedin_message_sent(p_workspace_id uuid, p_outreach_id uuid, p_actor_user_id uuid, p_idempotency_key text)
returns table(disposition text, interaction_id uuid, occurred_at timestamptz, attempt_id uuid)
language plpgsql security definer set search_path = public as $$
declare o public.backlink_outreach; c public.backlink_contacts; e public.backlink_linkedin_interactions; a public.backlink_outreach_attempts; target text; now_value timestamptz := clock_timestamp(); cnt integer;
begin
  if p_workspace_id is null or p_outreach_id is null or p_actor_user_id is null or nullif(trim(p_idempotency_key),'') is null then raise exception 'LINKEDIN_INTERACTION_INVALID_INPUT'; end if;
  select * into o from public.backlink_outreach where id=p_outreach_id and workspace_id=p_workspace_id for update; if not found then raise exception 'LINKEDIN_INTERACTION_NOT_FOUND'; end if;
  select * into c from public.backlink_contacts where id=o.contact_id and workspace_id=p_workspace_id for update; if not found then raise exception 'LINKEDIN_INTERACTION_CONTACT_NOT_FOUND'; end if;
  target := nullif(trim(coalesce(c.linkedin_url,'')), ''); if o.channel <> 'linkedin' or target is null or target !~ '^https://(www\.)?linkedin\.com/in/[^/?#]+/?(\?[^#]*)?$' then raise exception 'LINKEDIN_INTERACTION_INVALID_LINKEDIN_TARGET'; end if;
  if c.contact_status in ('do_not_contact','archived') or c.do_not_contact_at is not null or c.archived_at is not null then raise exception 'LINKEDIN_INTERACTION_CONTACT_SUPPRESSED'; end if;
  select * into e from public.backlink_linkedin_interactions where workspace_id=p_workspace_id and idempotency_key=trim(p_idempotency_key) for update;
  if found then
    select count(*) into cnt from public.backlink_outreach_attempts where workspace_id=p_workspace_id and outreach_id=o.id and attempt_kind='initial' and status='accepted';
    select * into a from public.backlink_outreach_attempts where workspace_id=p_workspace_id and outreach_id=o.id and attempt_kind='initial' and status='accepted' for update;
    if e.outreach_id <> o.id or e.contact_id <> c.id or e.actor_user_id <> p_actor_user_id or e.interaction_type <> 'message_sent' or e.target_profile_url <> target or cnt <> 1 or a.channel <> 'linkedin' or a.provider <> 'manual' or a.recipient <> target or a.requested_at is distinct from e.occurred_at or a.accepted_at is distinct from e.occurred_at or a.resolved_at is distinct from e.occurred_at or o.status <> 'active' or o.current_attempt <> 1 or o.first_contact_at is distinct from e.occurred_at or o.last_attempt_at is distinct from e.occurred_at then raise exception 'LINKEDIN_INTERACTION_INCONSISTENT_STATE'; end if;
    return query select 'existing', e.id, e.occurred_at, a.id; return;
  end if;
  if o.status <> 'draft' or o.current_attempt <> 0 or exists(select 1 from public.backlink_outreach_attempts where workspace_id=p_workspace_id and outreach_id=o.id) or not exists(select 1 from public.backlink_linkedin_interactions where workspace_id=p_workspace_id and outreach_id=o.id and contact_id=c.id and interaction_type='connection_accepted' and target_profile_url=target) then raise exception 'LINKEDIN_INTERACTION_INCONSISTENT_STATE'; end if;
  insert into public.backlink_linkedin_interactions(workspace_id,outreach_id,contact_id,actor_user_id,interaction_type,occurred_at,target_profile_url,idempotency_key) values(p_workspace_id,o.id,c.id,p_actor_user_id,'message_sent',now_value,target,trim(p_idempotency_key)) returning * into e;
  insert into public.backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at,accepted_at,resolved_at) values(p_workspace_id,o.id,p_actor_user_id,'linkedin','manual',target,'manual-linkedin-initial:'||o.id::text,'initial','accepted',now_value,now_value,now_value) returning * into a;
  update public.backlink_outreach set status='active',current_attempt=1,first_contact_at=now_value,last_attempt_at=now_value where id=o.id and workspace_id=p_workspace_id;
  return query select 'created', e.id, e.occurred_at, a.id;
end; $$;

revoke all on public.backlink_linkedin_interactions from anon, authenticated;
revoke all on function public.record_backlink_manual_linkedin_interaction(uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.record_backlink_manual_linkedin_message_sent(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.record_backlink_manual_linkedin_interaction(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.record_backlink_manual_linkedin_message_sent(uuid,uuid,uuid,text) to service_role;
commit;
