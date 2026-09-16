begin;

create unique index backlink_linkedin_interactions_one_reply_confirmed_per_outreach_idx
  on public.backlink_linkedin_interactions(workspace_id, outreach_id)
  where interaction_type = 'reply_confirmed';

create function public.record_backlink_manual_linkedin_reply_confirmed(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_actor_user_id uuid,
  p_classification text,
  p_idempotency_key text
)
returns table(
  disposition text,
  interaction_id uuid,
  occurred_at timestamptz,
  outreach_status text,
  classification text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.backlink_outreach;
  c public.backlink_contacts;
  e public.backlink_linkedin_interactions;
  existing_reply public.backlink_linkedin_interactions;
  target text;
  now_value timestamptz := clock_timestamp();
  next_status text;
begin
  if p_workspace_id is null
    or p_outreach_id is null
    or p_actor_user_id is null
    or p_classification not in ('positive', 'negative')
    or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'LINKEDIN_INTERACTION_INVALID_INPUT';
  end if;

  select *
  into o
  from public.backlink_outreach
  where id = p_outreach_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'LINKEDIN_INTERACTION_NOT_FOUND';
  end if;

  select *
  into c
  from public.backlink_contacts
  where id = o.contact_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'LINKEDIN_INTERACTION_CONTACT_NOT_FOUND';
  end if;

  target := nullif(trim(coalesce(c.linkedin_url, '')), '');

  if o.channel <> 'linkedin'
    or target is null
    or target !~ '^https://(www\.)?linkedin\.com/in/[^/?#]+/?(\?[^#]*)?$' then
    raise exception 'LINKEDIN_INTERACTION_INVALID_LINKEDIN_TARGET';
  end if;

  select *
  into e
  from public.backlink_linkedin_interactions
  where workspace_id = p_workspace_id
    and idempotency_key = trim(p_idempotency_key)
  for update;

  if found then
    if e.outreach_id <> o.id
      or e.contact_id <> c.id
      or e.actor_user_id <> p_actor_user_id
      or e.interaction_type <> 'reply_confirmed'
      or e.target_profile_url <> target then
      raise exception 'LINKEDIN_INTERACTION_IDEMPOTENCY_CONFLICT';
    end if;

    if p_classification = 'positive'
      and (o.status <> 'replied' or o.last_response_type <> 'positive') then
      raise exception 'LINKEDIN_INTERACTION_INCONSISTENT_STATE';
    end if;

    if p_classification = 'negative'
      and (o.status <> 'declined' or o.last_response_type <> 'negative') then
      raise exception 'LINKEDIN_INTERACTION_INCONSISTENT_STATE';
    end if;

    return query
    select
      'existing',
      e.id,
      e.occurred_at,
      o.status,
      p_classification;

    return;
  end if;

  select *
  into existing_reply
  from public.backlink_linkedin_interactions
  where workspace_id = p_workspace_id
    and outreach_id = o.id
    and interaction_type = 'reply_confirmed'
  order by occurred_at asc, created_at asc, id asc
  limit 1
  for update;

  if found then
    raise exception 'LINKEDIN_INTERACTION_IDEMPOTENCY_CONFLICT';
  end if;

  if o.status <> 'active'
    or o.current_attempt <> 1
    or not exists (
      select 1
      from public.backlink_linkedin_interactions
      where workspace_id = p_workspace_id
        and outreach_id = o.id
        and contact_id = c.id
        and interaction_type = 'message_sent'
        and target_profile_url = target
    ) then
    raise exception 'LINKEDIN_INTERACTION_INCONSISTENT_STATE';
  end if;

  next_status := case
    when p_classification = 'positive' then 'replied'
    else 'declined'
  end;

  insert into public.backlink_linkedin_interactions(
    workspace_id,
    outreach_id,
    contact_id,
    actor_user_id,
    interaction_type,
    occurred_at,
    target_profile_url,
    idempotency_key
  )
  values(
    p_workspace_id,
    o.id,
    c.id,
    p_actor_user_id,
    'reply_confirmed',
    now_value,
    target,
    trim(p_idempotency_key)
  )
  returning * into e;

  update public.backlink_outreach
  set
    status = next_status,
    last_response_type = p_classification,
    next_follow_up_at = null,
    response_deadline_at = null,
    closed_at = case
      when p_classification = 'negative' then now_value
      else null
    end,
    stop_reason = case
      when p_classification = 'negative' then 'inbound_negative_reply'
      else null
    end
  where id = o.id
    and workspace_id = p_workspace_id;

  return query
  select
    'created',
    e.id,
    e.occurred_at,
    next_status,
    p_classification;
end;
$$;

revoke all
on function public.record_backlink_manual_linkedin_reply_confirmed(uuid,uuid,uuid,text,text)
from public, anon, authenticated;

grant execute
on function public.record_backlink_manual_linkedin_reply_confirmed(uuid,uuid,uuid,text,text)
to service_role;

commit;
