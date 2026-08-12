begin;

create table public.backlink_outreach_follow_up_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  attempt_id uuid not null references public.backlink_outreach_attempts(id) on delete restrict,
  follow_up_number integer not null check (follow_up_number > 0),
  subject text not null check (subject = trim(subject) and char_length(subject) between 1 and 300),
  body text not null check (body = trim(body) and char_length(body) between 1 and 10000),
  prepared_at timestamptz not null,
  updated_at timestamptz not null,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_outreach_follow_up_drafts_attempt_unique unique (attempt_id)
);

create index backlink_outreach_follow_up_drafts_workspace_outreach_idx
  on public.backlink_outreach_follow_up_drafts (workspace_id, outreach_id, prepared_at desc);

create or replace function public.validate_backlink_outreach_follow_up_draft_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.backlink_outreach o where o.id = new.outreach_id and o.workspace_id = new.workspace_id) then raise exception 'BACKLINK_OUTREACH_FOLLOW_UP_DRAFT_WORKSPACE_MISMATCH'; end if;
  if not exists (select 1 from public.backlink_outreach_attempts a where a.id = new.attempt_id and a.workspace_id = new.workspace_id and a.outreach_id = new.outreach_id and a.attempt_kind = 'follow_up') then raise exception 'BACKLINK_OUTREACH_FOLLOW_UP_DRAFT_ATTEMPT_MISMATCH'; end if;
  return new;
end;
$$;
create trigger trg_backlink_outreach_follow_up_drafts_integrity before insert or update of workspace_id, outreach_id, attempt_id on public.backlink_outreach_follow_up_drafts for each row execute function public.validate_backlink_outreach_follow_up_draft_integrity();

alter table public.backlink_outreach_follow_up_drafts enable row level security;
create policy "backlink_outreach_follow_up_drafts_select_workspace_members" on public.backlink_outreach_follow_up_drafts for select to authenticated using (public.is_workspace_member(workspace_id));

create function public.prepare_backlink_outreach_follow_up_draft(p_workspace_id uuid, p_outreach_id uuid, p_attempt_id uuid, p_actor_user_id uuid, p_subject text, p_body text, p_prepared_at timestamptz)
returns table (disposition text, draft_id uuid, outreach_id uuid, attempt_id uuid, follow_up_number integer, subject text, body text, prepared_at timestamptz, updated_at timestamptz, updated_by uuid)
language plpgsql security definer set search_path = public as $$
declare a public.backlink_outreach_attempts; d public.backlink_outreach_follow_up_drafts; n integer; s text := trim(coalesce(p_subject,'')); b text := trim(coalesce(p_body,''));
begin
  if p_actor_user_id is null or not exists (select 1 from auth.users where id=p_actor_user_id) or p_prepared_at is null or char_length(s) not between 1 and 300 or char_length(b) not between 1 and 10000 then raise exception 'FOLLOW_UP_DRAFT_INVALID'; end if;
  select * into a from public.backlink_outreach_attempts where id=p_attempt_id and workspace_id=p_workspace_id and outreach_id=p_outreach_id for update;
  if not found then raise exception 'FOLLOW_UP_DRAFT_NOT_FOUND'; end if;
  if a.attempt_kind <> 'follow_up' or a.status <> 'prepared' then raise exception 'FOLLOW_UP_DRAFT_ATTEMPT_NOT_PREPARED'; end if;
  select * into d from public.backlink_outreach_follow_up_drafts where attempt_id=a.id;
  if found then return query select 'existing', d.id,d.outreach_id,d.attempt_id,d.follow_up_number,d.subject,d.body,d.prepared_at,d.updated_at,d.updated_by; return; end if;
  select count(*)::integer into n from public.backlink_outreach_attempts x where x.workspace_id=p_workspace_id and x.outreach_id=p_outreach_id and x.attempt_kind='follow_up' and (x.created_at,a.id) <= (a.created_at,a.id);
  insert into public.backlink_outreach_follow_up_drafts(workspace_id,outreach_id,attempt_id,follow_up_number,subject,body,prepared_at,updated_at,updated_by) values(p_workspace_id,p_outreach_id,a.id,n,s,b,p_prepared_at,p_prepared_at,p_actor_user_id) returning * into d;
  return query select 'created', d.id,d.outreach_id,d.attempt_id,d.follow_up_number,d.subject,d.body,d.prepared_at,d.updated_at,d.updated_by;
end;
$$;

create function public.update_backlink_outreach_follow_up_draft(p_workspace_id uuid, p_outreach_id uuid, p_attempt_id uuid, p_actor_user_id uuid, p_subject text, p_body text, p_expected_updated_at timestamptz, p_updated_at timestamptz)
returns table (draft_id uuid, outreach_id uuid, attempt_id uuid, follow_up_number integer, subject text, body text, prepared_at timestamptz, updated_at timestamptz, updated_by uuid)
language plpgsql security definer set search_path = public as $$
declare a public.backlink_outreach_attempts; d public.backlink_outreach_follow_up_drafts; s text := trim(coalesce(p_subject,'')); b text := trim(coalesce(p_body,''));
begin
  if p_actor_user_id is null or not exists(select 1 from auth.users where id=p_actor_user_id) or p_expected_updated_at is null or p_updated_at is null or char_length(s) not between 1 and 300 or char_length(b) not between 1 and 10000 then raise exception 'FOLLOW_UP_DRAFT_INVALID'; end if;
  select * into a from public.backlink_outreach_attempts where id=p_attempt_id and workspace_id=p_workspace_id and outreach_id=p_outreach_id for update;
  if not found then raise exception 'FOLLOW_UP_DRAFT_NOT_FOUND'; end if;
  if a.attempt_kind <> 'follow_up' or a.status <> 'prepared' then raise exception 'FOLLOW_UP_DRAFT_ATTEMPT_NOT_PREPARED'; end if;
  update public.backlink_outreach_follow_up_drafts set subject=s,body=b,updated_at=p_updated_at,updated_by=p_actor_user_id where workspace_id=p_workspace_id and outreach_id=p_outreach_id and attempt_id=p_attempt_id and updated_at=p_expected_updated_at returning * into d;
  if not found then raise exception 'FOLLOW_UP_DRAFT_CONFLICT'; end if;
  return query select d.id,d.outreach_id,d.attempt_id,d.follow_up_number,d.subject,d.body,d.prepared_at,d.updated_at,d.updated_by;
end;
$$;

revoke all on function public.prepare_backlink_outreach_follow_up_draft(uuid,uuid,uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.prepare_backlink_outreach_follow_up_draft(uuid,uuid,uuid,uuid,text,text,timestamptz) to service_role;
revoke all on function public.update_backlink_outreach_follow_up_draft(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.update_backlink_outreach_follow_up_draft(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz) to service_role;

commit;
