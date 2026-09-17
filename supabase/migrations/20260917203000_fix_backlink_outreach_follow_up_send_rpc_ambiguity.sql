begin;

-- R6M: qualification-only repair for the remaining follow-up send RPCs.
-- No business-rule, quota, provider, scheduling, approval, or data change.

create or replace function public.mark_backlink_outreach_follow_up_attempt_requested(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_attempt_id uuid,
  p_actor_user_id uuid,
  p_requested_at timestamptz
)
returns table (
  disposition text,
  attempt_id uuid,
  outreach_id uuid,
  recipient text,
  subject text,
  body text,
  reply_token_hash text,
  reply_token_key_version text,
  requested_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  outreach public.backlink_outreach;
  workspace_control public.automation_workspace_controls;
  campaign public.backlink_campaigns;
  contact public.backlink_contacts;
  opportunity public.backlink_opportunities;
  attempt public.backlink_outreach_attempts;
  draft public.backlink_outreach_follow_up_drafts;
  inbound_stop_effect public.backlink_outreach_inbound_effects;
  daily_cutoff timestamptz := p_requested_at - interval '24 hours';
  hourly_cutoff timestamptz := p_requested_at - interval '1 hour';
  workspace_count integer := 0;
  hourly_count integer := 0;
  domain_count integer := 0;
  contact_count integer := 0;
begin
  if p_workspace_id is null or p_outreach_id is null or p_attempt_id is null or p_actor_user_id is null or p_requested_at is null then
    raise exception 'FOLLOW_UP_SEND_INVALID';
  end if;
  if not exists (select 1 from auth.users where id = p_actor_user_id) then
    raise exception 'FOLLOW_UP_SEND_ACTOR_REQUIRED';
  end if;

  -- Match initial-send lock order so all email admissions serialize against one shared budget.
  perform pg_advisory_xact_lock(hashtextextended('backlink_outreach_initial_attempt:' || p_workspace_id::text, 0));

  -- Lock order: Outreach, workspace control, campaign, Contact, Opportunity, Attempt, Draft, inbound reply effects.
  select * into outreach from public.backlink_outreach as outreach_row
  where outreach_row.id = p_outreach_id
    and outreach_row.workspace_id = p_workspace_id for update;
  if not found or outreach.status <> 'active' then raise exception 'FOLLOW_UP_SEND_OUTREACH_NOT_ACTIVE'; end if;
  if outreach.channel <> 'email' then raise exception 'FOLLOW_UP_SEND_CHANNEL_NOT_SUPPORTED'; end if;
  if outreach.current_attempt >= outreach.max_attempts then raise exception 'FOLLOW_UP_SEND_ATTEMPT_LIMIT_REACHED'; end if;

  select * into workspace_control from public.automation_workspace_controls as workspace_control_row
  where workspace_control_row.workspace_id = outreach.workspace_id for update;
  if not found then raise exception 'FOLLOW_UP_SEND_WORKSPACE_CONTROL_MISSING'; end if;
  if workspace_control.backlinks_enabled is not true then raise exception 'FOLLOW_UP_SEND_BACKLINKS_DISABLED'; end if;
  if workspace_control.dry_run_only is not false then raise exception 'FOLLOW_UP_SEND_DRY_RUN'; end if;

  select * into campaign from public.backlink_campaigns as campaign_row
  where campaign_row.id = outreach.campaign_id for update;
  if not found then raise exception 'FOLLOW_UP_SEND_CAMPAIGN_MISSING'; end if;
  if campaign.workspace_id <> outreach.workspace_id then raise exception 'FOLLOW_UP_SEND_CAMPAIGN_MISMATCH'; end if;
  if campaign.status <> 'active' then raise exception 'FOLLOW_UP_SEND_CAMPAIGN_NOT_ACTIVE'; end if;

  select * into contact from public.backlink_contacts as contact_row
  where contact_row.id = outreach.contact_id
    and contact_row.workspace_id = p_workspace_id for update;
  if not found or contact.contact_status in ('do_not_contact', 'archived') or nullif(trim(contact.email_normalized), '') is null then
    update public.backlink_outreach_attempts as attempt_row
    set status = 'cancelled', cancelled_at = p_requested_at, cancel_reason = 'contact_unavailable'
    where attempt_row.id = p_attempt_id
      and attempt_row.workspace_id = p_workspace_id
      and attempt_row.outreach_id = outreach.id
      and attempt_row.attempt_kind = 'follow_up'
      and attempt_row.status = 'prepared';
    raise exception 'FOLLOW_UP_SEND_CONTACT_UNAVAILABLE';
  end if;

  select * into opportunity from public.backlink_opportunities as opportunity_row
  where opportunity_row.id = outreach.opportunity_id
    and opportunity_row.workspace_id = p_workspace_id for update;
  if not found then raise exception 'FOLLOW_UP_SEND_OUTREACH_INVALID'; end if;

  select * into attempt from public.backlink_outreach_attempts as attempt_row
  where attempt_row.id = p_attempt_id
    and attempt_row.workspace_id = p_workspace_id
    and attempt_row.outreach_id = outreach.id for update;
  if not found or attempt.attempt_kind <> 'follow_up' then raise exception 'FOLLOW_UP_SEND_ATTEMPT_INVALID'; end if;
  if attempt.status = 'requested' then
    select * into draft from public.backlink_outreach_follow_up_drafts as draft_row
    where draft_row.workspace_id = p_workspace_id
      and draft_row.outreach_id = outreach.id
      and draft_row.attempt_id = attempt.id for update;
    if not found then raise exception 'FOLLOW_UP_SEND_DRAFT_INVALID'; end if;
    return query select 'existing', attempt.id, attempt.outreach_id, attempt.recipient, draft.subject, draft.body, attempt.reply_token_hash, attempt.reply_token_key_version, attempt.requested_at;
    return;
  end if;
  if attempt.status <> 'prepared' then raise exception 'FOLLOW_UP_SEND_ATTEMPT_INVALID'; end if;
  if nullif(trim(coalesce(attempt.reply_token_hash, '')), '') is null or nullif(trim(coalesce(attempt.reply_token_key_version, '')), '') is null then
    raise exception 'FOLLOW_UP_SEND_LEGACY_IDENTITY';
  end if;
  if attempt.reply_token_hash !~ '^[0-9a-f]{64}$' or attempt.reply_token_key_version !~ '^v[1-9][0-9]{0,15}$' then
    raise exception 'FOLLOW_UP_SEND_LEGACY_IDENTITY';
  end if;

  select * into draft from public.backlink_outreach_follow_up_drafts as draft_row
  where draft_row.workspace_id = p_workspace_id
    and draft_row.outreach_id = outreach.id
    and draft_row.attempt_id = attempt.id for update;
  if not found or char_length(trim(draft.subject)) not between 1 and 300 or char_length(trim(draft.body)) not between 1 and 10000 then
    raise exception 'FOLLOW_UP_SEND_DRAFT_INVALID';
  end if;

  select * into inbound_stop_effect from public.backlink_outreach_inbound_effects as effect
  where effect.workspace_id = p_workspace_id and effect.outreach_id = outreach.id
    and effect.effect_kind = 'reply_received_stop' and effect.status = 'applied' for update;
  if found then raise exception 'FOLLOW_UP_SEND_INBOUND_REPLY_STOPPED'; end if;

  select count(*)::integer into workspace_count
  from public.backlink_outreach_attempts as item
  where item.workspace_id = p_workspace_id
    and item.channel = 'email'
    and item.status in ('requested', 'accepted', 'failed', 'unknown')
    and item.requested_at >= daily_cutoff;
  if workspace_count >= 5 then raise exception 'FOLLOW_UP_SEND_WORKSPACE_DAILY_RATE_LIMIT'; end if;

  select count(*)::integer into hourly_count
  from public.backlink_outreach_attempts as item
  where item.workspace_id = p_workspace_id
    and item.channel = 'email'
    and item.status in ('requested', 'accepted', 'failed', 'unknown')
    and item.requested_at >= hourly_cutoff;
  if hourly_count >= 2 then raise exception 'FOLLOW_UP_SEND_WORKSPACE_HOURLY_RATE_LIMIT'; end if;

  select count(*)::integer into domain_count
  from public.backlink_outreach_attempts as item
  join public.backlink_outreach as item_outreach
    on item_outreach.id = item.outreach_id
   and item_outreach.workspace_id = p_workspace_id
  join public.backlink_opportunities as item_opportunity
    on item_opportunity.id = item_outreach.opportunity_id
   and item_opportunity.workspace_id = p_workspace_id
  where item.workspace_id = p_workspace_id
    and item.channel = 'email'
    and item.status in ('requested', 'accepted', 'failed', 'unknown')
    and item.requested_at >= daily_cutoff
    and item_opportunity.domain_id = opportunity.domain_id;
  if domain_count >= 1 then raise exception 'FOLLOW_UP_SEND_DOMAIN_DAILY_RATE_LIMIT'; end if;

  select count(*)::integer into contact_count
  from public.backlink_outreach_attempts as item
  join public.backlink_outreach as item_outreach
    on item_outreach.id = item.outreach_id
   and item_outreach.workspace_id = p_workspace_id
  where item.workspace_id = p_workspace_id
    and item.channel = 'email'
    and item.status in ('requested', 'accepted', 'failed', 'unknown')
    and item.requested_at >= daily_cutoff
    and item_outreach.contact_id = outreach.contact_id;
  if contact_count >= 1 then raise exception 'FOLLOW_UP_SEND_CONTACT_DAILY_RATE_LIMIT'; end if;

  update public.backlink_outreach_attempts as attempt_row
  set status = 'requested', requested_at = p_requested_at
  where attempt_row.id = attempt.id
    and attempt_row.workspace_id = p_workspace_id
    and attempt_row.status = 'prepared'
  returning attempt_row.* into attempt;
  if not found then raise exception 'FOLLOW_UP_SEND_ATTEMPT_INVALID'; end if;

  return query select 'requested_now', attempt.id, attempt.outreach_id, attempt.recipient, draft.subject, draft.body, attempt.reply_token_hash, attempt.reply_token_key_version, attempt.requested_at;
end;
$$;

revoke all on function public.mark_backlink_outreach_follow_up_attempt_requested(uuid, uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.mark_backlink_outreach_follow_up_attempt_requested(uuid, uuid, uuid, uuid, timestamptz) to service_role;

create or replace function public.apply_backlink_outreach_follow_up_accepted(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_attempt_id uuid,
  p_provider_message_id text,
  p_accepted_at timestamptz
)
returns table (
  disposition text,
  attempt_status text,
  outreach_status text,
  current_attempt integer,
  last_attempt_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  outreach public.backlink_outreach;
  attempt public.backlink_outreach_attempts;
  effect public.backlink_outreach_attempt_lifecycle_effects;
  normalized_provider_message_id text := nullif(trim(coalesce(p_provider_message_id, '')), '');
begin
  if p_workspace_id is null or p_outreach_id is null or p_attempt_id is null or p_accepted_at is null then
    raise exception 'FOLLOW_UP_ACCEPTED_ATTEMPT_INVALID';
  end if;

  select * into attempt
  from public.backlink_outreach_attempts as attempt_row
  where attempt_row.id = p_attempt_id
    and attempt_row.workspace_id = p_workspace_id
    and attempt_row.outreach_id = p_outreach_id
  for update;
  if not found or attempt.attempt_kind <> 'follow_up' or attempt.status not in ('requested', 'unknown', 'accepted') then
    raise exception 'FOLLOW_UP_ACCEPTED_ATTEMPT_INVALID';
  end if;
  if attempt.status = 'accepted' and attempt.provider_message_id is distinct from normalized_provider_message_id then
    raise exception 'FOLLOW_UP_ACCEPTED_RECONCILIATION_CONFLICT';
  end if;

  select * into outreach
  from public.backlink_outreach as outreach_row
  where outreach_row.id = p_outreach_id
    and outreach_row.workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'FOLLOW_UP_ACCEPTED_ATTEMPT_INVALID';
  end if;

  select * into effect
  from public.backlink_outreach_attempt_lifecycle_effects as lifecycle_effect
  where lifecycle_effect.workspace_id = p_workspace_id
    and lifecycle_effect.attempt_id = p_attempt_id
    and lifecycle_effect.effect_kind = 'follow_up_accepted'
  for update;
  if found then
    return query select 'existing', attempt.status, outreach.status, outreach.current_attempt, outreach.last_attempt_at;
    return;
  end if;

  if outreach.current_attempt >= outreach.max_attempts then
    raise exception 'FOLLOW_UP_ACCEPTED_ATTEMPT_LIMIT_REACHED';
  end if;

  update public.backlink_outreach_attempts as attempt_row
  set status = 'accepted',
      accepted_at = p_accepted_at,
      resolved_at = p_accepted_at,
      failed_at = null,
      error_code = null,
      error_message = null,
      provider_message_id = normalized_provider_message_id
  where attempt_row.id = attempt.id
    and attempt_row.workspace_id = p_workspace_id;

  insert into public.backlink_outreach_attempt_lifecycle_effects (
    workspace_id,
    outreach_id,
    attempt_id,
    effect_kind,
    status,
    applied_at
  )
  values (
    p_workspace_id,
    p_outreach_id,
    p_attempt_id,
    'follow_up_accepted',
    'applied',
    p_accepted_at
  );

  update public.backlink_outreach as outreach_row
  set current_attempt = outreach_row.current_attempt + 1,
      last_attempt_at = p_accepted_at,
      next_follow_up_at = null
  where outreach_row.id = p_outreach_id
    and outreach_row.workspace_id = p_workspace_id
  returning outreach_row.* into outreach;

  return query select 'applied', 'accepted', outreach.status, outreach.current_attempt, outreach.last_attempt_at;
end;
$$;

revoke all on function public.apply_backlink_outreach_follow_up_accepted(uuid, uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_backlink_outreach_follow_up_accepted(uuid, uuid, uuid, text, timestamptz) to service_role;

comment on function public.apply_backlink_outreach_follow_up_accepted(uuid, uuid, uuid, text, timestamptz) is
  'Atomically marks a follow-up Attempt accepted and applies its Outreach lifecycle increment exactly once; never calls a provider.';

commit;
