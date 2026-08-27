begin;

create or replace function public.reserve_backlink_outreach_initial_attempt(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_attempt_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text,
  p_reply_token_hash text,
  p_reply_token_key_version text,
  p_requested_at timestamptz
)
returns table (
  disposition text,
  attempt_id uuid,
  rate_limit_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  opportunity public.backlink_opportunities;
  existing_attempt public.backlink_outreach_attempts;
  open_attempt public.backlink_outreach_attempts;
  reserved_attempt public.backlink_outreach_attempts;
  normalized_key text := trim(coalesce(p_idempotency_key, ''));
  normalized_token_hash text := lower(trim(coalesce(p_reply_token_hash, '')));
  daily_cutoff timestamptz := p_requested_at - interval '24 hours';
  hourly_cutoff timestamptz := p_requested_at - interval '1 hour';
  workspace_count integer := 0;
  hourly_count integer := 0;
  domain_count integer := 0;
  contact_count integer := 0;
begin
  if p_workspace_id is null or p_outreach_id is null or p_attempt_id is null or p_actor_user_id is null or p_requested_at is null then
    raise exception 'OUTREACH_ATTEMPT_RATE_LIMIT_INVALID_INPUT';
  end if;
  if normalized_key = '' then
    raise exception 'OUTREACH_ATTEMPT_IDEMPOTENCY_CONFLICT';
  end if;
  if normalized_token_hash !~ '^[0-9a-f]{64}$' or p_reply_token_key_version is null or trim(p_reply_token_key_version) = '' then
    raise exception 'OUTREACH_INBOUND_REPLY_CONFIGURATION_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('backlink_outreach_initial_attempt:' || p_workspace_id::text, 0));

  select *
  into existing_attempt
  from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id
    and attempt.idempotency_key = normalized_key;
  if found then
    if existing_attempt.outreach_id <> p_outreach_id
      or existing_attempt.attempt_kind <> 'initial' then
      raise exception 'OUTREACH_ATTEMPT_IDEMPOTENCY_CONFLICT';
    end if;
    return query select 'existing', existing_attempt.id, null::text;
    return;
  end if;

  select *
  into outreach
  from public.backlink_outreach as o
  where o.id = p_outreach_id
    and o.workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'OUTREACH_NOT_SENDABLE';
  end if;
  select *
  into contact
  from public.backlink_contacts as c
  where c.id = outreach.contact_id
    and c.workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'OUTREACH_CONTACT_NOT_ELIGIBLE';
  end if;
  select *
  into opportunity
  from public.backlink_opportunities as opp
  where opp.id = outreach.opportunity_id
    and opp.workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'OUTREACH_NOT_SENDABLE';
  end if;

  if outreach.status <> 'ready' then
    raise exception 'OUTREACH_NOT_SENDABLE';
  end if;
  if outreach.current_attempt >= outreach.max_attempts then
    raise exception 'OUTREACH_MAX_ATTEMPTS_REACHED';
  end if;
  if outreach.channel <> 'email' then
    raise exception 'OUTREACH_EMAIL_CHANNEL_UNSUPPORTED';
  end if;
  if nullif(trim(coalesce(outreach.subject, '')), '') is null or nullif(trim(coalesce(outreach.body, '')), '') is null then
    raise exception 'OUTREACH_EMAIL_CONTENT_INCOMPLETE';
  end if;
  if contact.domain_id <> opportunity.domain_id
    or contact.contact_status in ('do_not_contact', 'archived')
    or nullif(trim(coalesce(contact.email_normalized, '')), '') is null then
    raise exception 'OUTREACH_CONTACT_NOT_ELIGIBLE';
  end if;

  select *
  into open_attempt
  from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id
    and attempt.outreach_id = outreach.id
    and attempt.status in ('requested', 'unknown')
  order by attempt.requested_at desc
  limit 1
  for update;
  if found then
    if open_attempt.status = 'unknown' then
      raise exception 'OUTREACH_SEND_ATTEMPT_UNRESOLVED';
    end if;
    raise exception 'OUTREACH_SEND_ATTEMPT_IN_PROGRESS';
  end if;

  select count(*)::integer into workspace_count
  from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id
    and attempt.channel = 'email'
    and attempt.status in ('requested', 'accepted', 'failed', 'unknown')
    and attempt.requested_at >= daily_cutoff;
  if workspace_count >= 5 then
    return query select 'rate_limited', null::uuid, 'WORKSPACE_DAILY_LIMIT_REACHED';
    return;
  end if;

  select count(*)::integer into hourly_count
  from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id
    and attempt.channel = 'email'
    and attempt.status in ('requested', 'accepted', 'failed', 'unknown')
    and attempt.requested_at >= hourly_cutoff;
  if hourly_count >= 2 then
    return query select 'rate_limited', null::uuid, 'WORKSPACE_HOURLY_LIMIT_REACHED';
    return;
  end if;

  select count(*)::integer into domain_count
  from public.backlink_outreach_attempts as attempt
  join public.backlink_outreach as attempt_outreach
    on attempt_outreach.id = attempt.outreach_id
   and attempt_outreach.workspace_id = p_workspace_id
  join public.backlink_opportunities as attempt_opportunity
    on attempt_opportunity.id = attempt_outreach.opportunity_id
   and attempt_opportunity.workspace_id = p_workspace_id
  where attempt.workspace_id = p_workspace_id
    and attempt.channel = 'email'
    and attempt.status in ('requested', 'accepted', 'failed', 'unknown')
    and attempt.requested_at >= daily_cutoff
    and attempt_opportunity.domain_id = opportunity.domain_id;
  if domain_count >= 1 then
    return query select 'rate_limited', null::uuid, 'DOMAIN_DAILY_LIMIT_REACHED';
    return;
  end if;

  select count(*)::integer into contact_count
  from public.backlink_outreach_attempts as attempt
  join public.backlink_outreach as attempt_outreach
    on attempt_outreach.id = attempt.outreach_id
   and attempt_outreach.workspace_id = p_workspace_id
  where attempt.workspace_id = p_workspace_id
    and attempt.channel = 'email'
    and attempt.status in ('requested', 'accepted', 'failed', 'unknown')
    and attempt.requested_at >= daily_cutoff
    and attempt_outreach.contact_id = outreach.contact_id;
  if contact_count >= 1 then
    return query select 'rate_limited', null::uuid, 'CONTACT_DAILY_LIMIT_REACHED';
    return;
  end if;

  insert into public.backlink_outreach_attempts (
    id,
    workspace_id,
    outreach_id,
    actor_user_id,
    channel,
    provider,
    recipient,
    idempotency_key,
    reply_token_hash,
    reply_token_key_version,
    attempt_kind,
    status,
    requested_at
  ) values (
    p_attempt_id,
    outreach.workspace_id,
    outreach.id,
    p_actor_user_id,
    'email',
    'resend',
    trim(contact.email_normalized),
    normalized_key,
    normalized_token_hash,
    trim(p_reply_token_key_version),
    'initial',
    'requested',
    p_requested_at
  )
  on conflict (workspace_id, idempotency_key) do nothing
  returning * into reserved_attempt;

  if not found then
    select *
    into existing_attempt
    from public.backlink_outreach_attempts as attempt
    where attempt.workspace_id = p_workspace_id
      and attempt.idempotency_key = normalized_key;
    if found
      and existing_attempt.outreach_id = outreach.id
      and existing_attempt.attempt_kind = 'initial' then
      return query select 'existing', existing_attempt.id, null::text;
      return;
    end if;
    raise exception 'OUTREACH_ATTEMPT_IDEMPOTENCY_CONFLICT';
  end if;

  return query select 'created', reserved_attempt.id, null::text;
end;
$$;

revoke all on function public.reserve_backlink_outreach_initial_attempt(uuid, uuid, uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_backlink_outreach_initial_attempt(uuid, uuid, uuid, uuid, text, text, text, timestamptz) to service_role;

comment on function public.reserve_backlink_outreach_initial_attempt(uuid, uuid, uuid, uuid, text, text, text, timestamptz) is
  'Atomically reserves one initial email send Attempt after workspace-level rate admission, preserving idempotency and blocking workspace/hour/domain/contact quota races.';

commit;
