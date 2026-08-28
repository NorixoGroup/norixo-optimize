begin;

alter table public.backlink_campaigns
  add column if not exists live_initial_send_enabled boolean not null default false;

alter table public.backlink_outreach
  add column if not exists auto_send_approved_at timestamptz,
  add column if not exists auto_send_approved_by uuid,
  add column if not exists auto_send_approval_fingerprint text,
  add column if not exists auto_send_approved_recipient text,
  add column if not exists auto_send_approved_subject text,
  add column if not exists auto_send_approved_body text,
  add column if not exists auto_send_approved_channel text,
  add column if not exists auto_send_approved_target_url text,
  add column if not exists auto_send_approved_contact_id uuid,
  add column if not exists auto_send_approved_opportunity_id uuid,
  add column if not exists auto_send_approved_campaign_id uuid;

create table if not exists public.backlink_outreach_initial_attempt_snapshots (
  attempt_id uuid primary key references public.backlink_outreach_attempts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  idempotency_key text not null,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  campaign_id uuid not null references public.backlink_campaigns(id) on delete restrict,
  opportunity_id uuid not null references public.backlink_opportunities(id) on delete restrict,
  contact_id uuid not null references public.backlink_contacts(id) on delete restrict,
  recipient_email text not null,
  subject text not null,
  body text not null,
  channel text not null,
  target_url text not null,
  approved_at timestamptz not null,
  approved_by uuid,
  approval_fingerprint text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists backlink_outreach_initial_attempt_snapshots_workspace_id_idx
  on public.backlink_outreach_initial_attempt_snapshots (workspace_id, created_at desc);

create index if not exists backlink_outreach_initial_attempt_snapshots_idempotency_key_idx
  on public.backlink_outreach_initial_attempt_snapshots (workspace_id, idempotency_key);

create or replace function public.reserve_backlink_outreach_initial_attempt_for_approved_auto_send(
  p_workspace_id uuid,
  p_campaign_id uuid,
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
  existing_attempt public.backlink_outreach_attempts;
  campaign public.backlink_campaigns;
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  opportunity public.backlink_opportunities;
  reservation record;
  snapshot public.backlink_outreach_initial_attempt_snapshots;
  normalized_key text := trim(coalesce(p_idempotency_key, ''));
  normalized_token_hash text := lower(trim(coalesce(p_reply_token_hash, '')));
  approved_recipient text;
  approved_subject text;
  approved_body text;
  approved_channel text;
  approved_target_url text;
begin
  if p_workspace_id is null or p_campaign_id is null or p_outreach_id is null or p_attempt_id is null or p_actor_user_id is null or p_requested_at is null then
    raise exception 'OUTREACH_APPROVED_INITIAL_ATTEMPT_INVALID_INPUT';
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

    select *
    into snapshot
    from public.backlink_outreach_initial_attempt_snapshots as item
    where item.workspace_id = p_workspace_id
      and item.attempt_id = existing_attempt.id;
    if not found then
      raise exception 'OUTREACH_APPROVED_INITIAL_ATTEMPT_SNAPSHOT_MISSING';
    end if;

    return query select 'existing', existing_attempt.id, null::text;
    return;
  end if;

  select *
  into campaign
  from public.backlink_campaigns as item
  where item.id = p_campaign_id
    and item.workspace_id = p_workspace_id
  for update;
  if not found then
    return query select 'ineligible', null::uuid, null::text;
    return;
  end if;
  if campaign.live_initial_send_enabled is not true then
    return query select 'campaign_disabled', null::uuid, null::text;
    return;
  end if;

  select *
  into outreach
  from public.backlink_outreach as item
  where item.id = p_outreach_id
    and item.workspace_id = p_workspace_id
    and item.campaign_id = p_campaign_id
  for update;
  if not found then
    return query select 'not_ready', null::uuid, null::text;
    return;
  end if;

  approved_recipient := nullif(trim(coalesce(outreach.auto_send_approved_recipient, '')), '');
  approved_subject := nullif(trim(coalesce(outreach.auto_send_approved_subject, '')), '');
  approved_body := nullif(trim(coalesce(outreach.auto_send_approved_body, '')), '');
  approved_channel := nullif(trim(coalesce(outreach.auto_send_approved_channel, '')), '');
  approved_target_url := nullif(trim(coalesce(outreach.auto_send_approved_target_url, '')), '');

  if outreach.auto_send_approved_at is null
    or outreach.auto_send_approval_fingerprint is null
    or approved_channel is null
    or approved_target_url is null
    or outreach.auto_send_approved_contact_id is null
    or outreach.auto_send_approved_opportunity_id is null
    or outreach.auto_send_approved_campaign_id is null then
    return query select 'not_approved', null::uuid, null::text;
    return;
  end if;

  if approved_subject is null or approved_body is null then
    return query select 'missing_approved_content', null::uuid, null::text;
    return;
  end if;

  if approved_recipient is null then
    return query select 'invalid_recipient', null::uuid, null::text;
    return;
  end if;

  if outreach.status <> 'ready'
    or outreach.channel <> 'email'
    or outreach.current_attempt >= outreach.max_attempts then
    return query select 'not_ready', null::uuid, null::text;
    return;
  end if;

  select *
  into contact
  from public.backlink_contacts as item
  where item.id = outreach.contact_id
    and item.workspace_id = p_workspace_id
  for update;
  if not found then
    return query select 'ineligible', null::uuid, null::text;
    return;
  end if;

  select *
  into opportunity
  from public.backlink_opportunities as item
  where item.id = outreach.opportunity_id
    and item.workspace_id = p_workspace_id
  for update;
  if not found then
    return query select 'ineligible', null::uuid, null::text;
    return;
  end if;

  if contact.contact_status in ('do_not_contact', 'archived') then
    return query select 'ineligible', null::uuid, null::text;
    return;
  end if;
  if nullif(trim(coalesce(contact.email_normalized, '')), '') is null then
    return query select 'invalid_recipient', null::uuid, null::text;
    return;
  end if;
  if contact.domain_id <> opportunity.domain_id then
    return query select 'ineligible', null::uuid, null::text;
    return;
  end if;

  if outreach.auto_send_approved_recipient <> trim(contact.email_normalized)
    or outreach.auto_send_approved_subject <> outreach.subject
    or outreach.auto_send_approved_body <> outreach.body
    or outreach.auto_send_approved_channel <> outreach.channel
    or outreach.auto_send_approved_target_url <> opportunity.target_page_url
    or outreach.auto_send_approved_contact_id <> outreach.contact_id
    or outreach.auto_send_approved_opportunity_id <> outreach.opportunity_id
    or outreach.auto_send_approved_campaign_id <> outreach.campaign_id then
    return query select 'approval_stale', null::uuid, null::text;
    return;
  end if;

  select *
  into reservation
  from public.reserve_backlink_outreach_initial_attempt(
    p_workspace_id,
    p_outreach_id,
    p_attempt_id,
    p_actor_user_id,
    p_idempotency_key,
    p_reply_token_hash,
    p_reply_token_key_version,
    p_requested_at
  );

  if reservation.disposition = 'rate_limited' then
    return query select 'rate_limited', null::uuid, reservation.rate_limit_reason;
    return;
  end if;

  insert into public.backlink_outreach_initial_attempt_snapshots (
    attempt_id,
    workspace_id,
    idempotency_key,
    outreach_id,
    campaign_id,
    opportunity_id,
    contact_id,
    recipient_email,
    subject,
    body,
    channel,
    target_url,
    approved_at,
    approved_by,
    approval_fingerprint
  ) values (
    reservation.attempt_id,
    p_workspace_id,
    normalized_key,
    p_outreach_id,
    p_campaign_id,
    outreach.opportunity_id,
    outreach.contact_id,
    trim(contact.email_normalized),
    outreach.subject,
    outreach.body,
    outreach.channel,
    opportunity.target_page_url,
    outreach.auto_send_approved_at,
    outreach.auto_send_approved_by,
    outreach.auto_send_approval_fingerprint
  )
  on conflict (attempt_id) do update set
    workspace_id = excluded.workspace_id,
    idempotency_key = excluded.idempotency_key,
    outreach_id = excluded.outreach_id,
    campaign_id = excluded.campaign_id,
    opportunity_id = excluded.opportunity_id,
    contact_id = excluded.contact_id,
    recipient_email = excluded.recipient_email,
    subject = excluded.subject,
    body = excluded.body,
    channel = excluded.channel,
    target_url = excluded.target_url,
    approved_at = excluded.approved_at,
    approved_by = excluded.approved_by,
    approval_fingerprint = excluded.approval_fingerprint;

  return query select reservation.disposition, reservation.attempt_id, null::text;
end;
$$;

revoke all on function public.reserve_backlink_outreach_initial_attempt_for_approved_auto_send(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_backlink_outreach_initial_attempt_for_approved_auto_send(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) to service_role;

comment on function public.reserve_backlink_outreach_initial_attempt_for_approved_auto_send(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) is
  'Atomically reserves an approved initial outreach send after validating the approval snapshot, campaign live-send gate, and the existing rolling workspace/domain/contact quotas.';

commit;
