begin;

create or replace function public.prepare_backlink_outreach_follow_up_draft(p_workspace_id uuid, p_outreach_id uuid, p_attempt_id uuid, p_actor_user_id uuid, p_subject text, p_body text, p_prepared_at timestamptz)
returns table (disposition text, draft_id uuid, outreach_id uuid, attempt_id uuid, follow_up_number integer, subject text, body text, prepared_at timestamptz, updated_at timestamptz, updated_by uuid)
language plpgsql security definer set search_path = public as $$
declare a public.backlink_outreach_attempts; d public.backlink_outreach_follow_up_drafts; n integer; s text := trim(coalesce(p_subject,'')); b text := trim(coalesce(p_body,''));
begin
  if p_actor_user_id is null or not exists (select 1 from auth.users where id=p_actor_user_id) or p_prepared_at is null or char_length(s) not between 1 and 300 or char_length(b) not between 1 and 10000 then raise exception 'FOLLOW_UP_DRAFT_INVALID'; end if;
  select * into a from public.backlink_outreach_attempts as attempt where attempt.id=p_attempt_id and attempt.workspace_id=p_workspace_id and attempt.outreach_id=p_outreach_id for update;
  if not found then raise exception 'FOLLOW_UP_DRAFT_NOT_FOUND'; end if;
  if a.attempt_kind <> 'follow_up' or a.status <> 'prepared' then raise exception 'FOLLOW_UP_DRAFT_ATTEMPT_NOT_PREPARED'; end if;
  select * into d from public.backlink_outreach_follow_up_drafts as draft where draft.attempt_id=a.id;
  if found then return query select 'existing', d.id,d.outreach_id,d.attempt_id,d.follow_up_number,d.subject,d.body,d.prepared_at,d.updated_at,d.updated_by; return; end if;
  select count(*)::integer into n from public.backlink_outreach_attempts x where x.workspace_id=p_workspace_id and x.outreach_id=p_outreach_id and x.attempt_kind='follow_up' and (x.created_at,a.id) <= (a.created_at,a.id);
  insert into public.backlink_outreach_follow_up_drafts(workspace_id,outreach_id,attempt_id,follow_up_number,subject,body,prepared_at,updated_at,updated_by) values(p_workspace_id,p_outreach_id,a.id,n,s,b,p_prepared_at,p_prepared_at,p_actor_user_id) returning * into d;
  return query select 'created', d.id,d.outreach_id,d.attempt_id,d.follow_up_number,d.subject,d.body,d.prepared_at,d.updated_at,d.updated_by;
end;
$$;

create or replace function public.update_backlink_outreach_follow_up_draft(p_workspace_id uuid, p_outreach_id uuid, p_attempt_id uuid, p_actor_user_id uuid, p_subject text, p_body text, p_expected_updated_at timestamptz, p_updated_at timestamptz)
returns table (draft_id uuid, outreach_id uuid, attempt_id uuid, follow_up_number integer, subject text, body text, prepared_at timestamptz, updated_at timestamptz, updated_by uuid)
language plpgsql security definer set search_path = public as $$
declare a public.backlink_outreach_attempts; d public.backlink_outreach_follow_up_drafts; s text := trim(coalesce(p_subject,'')); b text := trim(coalesce(p_body,''));
begin
  if p_actor_user_id is null or not exists(select 1 from auth.users where id=p_actor_user_id) or p_expected_updated_at is null or p_updated_at is null or char_length(s) not between 1 and 300 or char_length(b) not between 1 and 10000 then raise exception 'FOLLOW_UP_DRAFT_INVALID'; end if;
  select * into a from public.backlink_outreach_attempts as attempt where attempt.id=p_attempt_id and attempt.workspace_id=p_workspace_id and attempt.outreach_id=p_outreach_id for update;
  if not found then raise exception 'FOLLOW_UP_DRAFT_NOT_FOUND'; end if;
  if a.attempt_kind <> 'follow_up' or a.status <> 'prepared' then raise exception 'FOLLOW_UP_DRAFT_ATTEMPT_NOT_PREPARED'; end if;
  update public.backlink_outreach_follow_up_drafts as draft set subject=s,body=b,updated_at=p_updated_at,updated_by=p_actor_user_id where draft.workspace_id=p_workspace_id and draft.outreach_id=p_outreach_id and draft.attempt_id=p_attempt_id and draft.updated_at=p_expected_updated_at returning * into d;
  if not found then raise exception 'FOLLOW_UP_DRAFT_CONFLICT'; end if;
  return query select d.id,d.outreach_id,d.attempt_id,d.follow_up_number,d.subject,d.body,d.prepared_at,d.updated_at,d.updated_by;
end;
$$;

revoke all on function public.prepare_backlink_outreach_follow_up_draft(uuid,uuid,uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.prepare_backlink_outreach_follow_up_draft(uuid,uuid,uuid,uuid,text,text,timestamptz) to service_role;
revoke all on function public.update_backlink_outreach_follow_up_draft(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.update_backlink_outreach_follow_up_draft(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz) to service_role;

commit;
