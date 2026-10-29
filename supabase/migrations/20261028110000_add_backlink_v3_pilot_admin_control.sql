begin;

-- A deliberately narrow, temporary pilot constraint.  A later scale-out migration
-- must replace this index before more than one real approved recipient per workspace
-- is supported.
create unique index backlink_production_eligibility_one_active_pilot_per_workspace_idx
  on public.backlink_production_eligibility (workspace_id)
  where origin_kind = 'real' and status = 'approved';

create table public.backlink_production_eligibility_audit (
  id uuid primary key default gen_random_uuid(),
  eligibility_id uuid not null references public.backlink_production_eligibility(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.backlink_contacts(id) on delete restrict,
  opportunity_id uuid not null references public.backlink_opportunities(id) on delete restrict,
  action text not null check (action in ('approved', 'revoked')),
  origin_kind text not null check (origin_kind = 'real'),
  email_fingerprint text not null check (email_fingerprint ~ '^[a-f0-9]{64}$'),
  source_reference text not null check (char_length(trim(source_reference)) > 0),
  reason text not null check (char_length(trim(reason)) between 10 and 2000),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create index backlink_production_eligibility_audit_lookup_idx
  on public.backlink_production_eligibility_audit (workspace_id, contact_id, opportunity_id, created_at desc);

alter table public.backlink_production_eligibility_audit enable row level security;
create policy "backlink_production_eligibility_audit_select_workspace_admins"
  on public.backlink_production_eligibility_audit for select to authenticated
  using (public.is_workspace_admin_or_owner(workspace_id));
revoke all on public.backlink_production_eligibility_audit from public, anon, authenticated;
grant select on public.backlink_production_eligibility_audit to authenticated;

create or replace function public.prevent_backlink_production_eligibility_audit_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'BACKLINK_PRODUCTION_ELIGIBILITY_AUDIT_IMMUTABLE';
end;
$$;

create trigger trg_backlink_production_eligibility_audit_immutable
before update or delete on public.backlink_production_eligibility_audit
for each row execute function public.prevent_backlink_production_eligibility_audit_mutation();

create or replace function public.approve_backlink_production_pilot_eligibility(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_opportunity_id uuid,
  p_actor_user_id uuid,
  p_source_reference text,
  p_reason text,
  p_reviewed_at timestamptz default timezone('utc', now())
) returns table (eligibility_id uuid, status text, disposition text)
language plpgsql security definer set search_path = public as $$
declare
  contact public.backlink_contacts;
  opportunity public.backlink_opportunities;
  eligibility public.backlink_production_eligibility;
  mailbox public.backlink_contact_mailbox_verifications;
  email_hash text;
  source_ref text := trim(coalesce(p_source_reference, ''));
  review_reason text := trim(coalesce(p_reason, ''));
begin
  if p_workspace_id is null or p_contact_id is null or p_opportunity_id is null or p_actor_user_id is null
    or p_reviewed_at is null or char_length(source_ref) not between 10 and 2000
    or char_length(review_reason) not between 10 and 2000 then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_INVALID_INPUT';
  end if;
  if source_ref ~* '(^|[^[:alnum:]])(test|demo|fixture|seed|canary)([^[:alnum:]]|$)' then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_TEST_ORIGIN';
  end if;
  if not exists (select 1 from auth.users where id = p_actor_user_id) then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_ACTOR_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('backlink_production_pilot:' || p_workspace_id::text, 0));

  select * into contact from public.backlink_contacts
  where id = p_contact_id and workspace_id = p_workspace_id for update;
  if not found or contact.contact_status <> 'verified' or contact.archived_at is not null
    or contact.do_not_contact_at is not null or nullif(trim(coalesce(contact.email_normalized, '')), '') is null then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_CONTACT_INELIGIBLE';
  end if;
  if lower(trim(contact.email_normalized)) ~ '@([^@[:space:]]+\\.)?example$'
    or lower(trim(contact.email_normalized)) ~ '@example\\.(com|org|net)$' then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_TEST_CONTACT';
  end if;

  select * into opportunity from public.backlink_opportunities
  where id = p_opportunity_id and workspace_id = p_workspace_id for update;
  if not found or opportunity.lifecycle_status <> 'active' or contact.domain_id <> opportunity.domain_id then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_OPPORTUNITY_INELIGIBLE';
  end if;

  email_hash := encode(extensions.digest(lower(trim(contact.email_normalized)), 'sha256'), 'hex');
  select * into mailbox from public.backlink_contact_mailbox_verifications
  where workspace_id = p_workspace_id and contact_id = contact.id and email_fingerprint = email_hash
  order by checked_at desc, created_at desc, id desc limit 1;
  if not found or mailbox.result <> 'deliverable'
    or mailbox.checked_at < clock_timestamp() - interval '30 days'
    or mailbox.checked_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_MAILBOX_NOT_DELIVERABLE';
  end if;
  if exists (select 1 from public.backlink_email_suppressions
    where workspace_id = p_workspace_id and email_normalized = lower(trim(contact.email_normalized))) then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_RECIPIENT_SUPPRESSED';
  end if;
  if exists (select 1 from public.backlink_outreach_attempts
    where workspace_id = p_workspace_id and lower(trim(recipient)) = lower(trim(contact.email_normalized))) then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_RECIPIENT_PREVIOUSLY_ATTEMPTED';
  end if;
  -- A requested follow-up is already eligible to reach the provider through the
  -- follow-up service. Refuse the pilot rather than leaving a second send path open.
  if exists (
    select 1
    from public.backlink_outreach_attempts a
    where a.workspace_id = p_workspace_id
      and a.attempt_kind = 'follow_up'
      and a.status = 'requested'
  ) then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_FOLLOW_UP_ALREADY_REQUESTED';
  end if;

  select * into eligibility from public.backlink_production_eligibility
  where workspace_id = p_workspace_id and contact_id = p_contact_id and opportunity_id = p_opportunity_id for update;
  if exists (select 1 from public.backlink_production_eligibility e
    where e.workspace_id = p_workspace_id and e.origin_kind = 'real' and e.status = 'approved'
      and (not found or e.id <> eligibility.id)) then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_ALREADY_ACTIVE';
  end if;

  if found and eligibility.origin_kind = 'real' and eligibility.status = 'approved'
    and eligibility.email_fingerprint = email_hash then
    return query select eligibility.id, eligibility.status, 'already_approved'::text;
    return;
  end if;

  if found then
    update public.backlink_production_eligibility set
      email_fingerprint = email_hash, origin_kind = 'real', status = 'approved', source_reference = source_ref,
      reviewed_by = p_actor_user_id, reviewed_at = p_reviewed_at, review_reason = review_reason,
      created_by = coalesce(created_by, p_actor_user_id), updated_at = timezone('utc', now())
    where id = eligibility.id returning * into eligibility;
  else
    insert into public.backlink_production_eligibility (
      workspace_id, contact_id, opportunity_id, email_fingerprint, origin_kind, status,
      source_reference, reviewed_by, reviewed_at, review_reason, created_by
    ) values (
      p_workspace_id, p_contact_id, p_opportunity_id, email_hash, 'real', 'approved',
      source_ref, p_actor_user_id, p_reviewed_at, review_reason, p_actor_user_id
    ) returning * into eligibility;
  end if;

  insert into public.backlink_production_eligibility_audit (
    eligibility_id, workspace_id, contact_id, opportunity_id, action, origin_kind,
    email_fingerprint, source_reference, reason, actor_user_id, created_at
  ) values (
    eligibility.id, p_workspace_id, p_contact_id, p_opportunity_id, 'approved', 'real',
    email_hash, source_ref, review_reason, p_actor_user_id, p_reviewed_at
  );
  return query select eligibility.id, eligibility.status, 'approved'::text;
end;
$$;

create or replace function public.revoke_backlink_production_pilot_eligibility(
  p_workspace_id uuid, p_contact_id uuid, p_opportunity_id uuid, p_actor_user_id uuid,
  p_reason text, p_revoked_at timestamptz default timezone('utc', now())
) returns table (eligibility_id uuid, status text, disposition text)
language plpgsql security definer set search_path = public as $$
declare eligibility public.backlink_production_eligibility; reason_value text := trim(coalesce(p_reason, ''));
begin
  if p_workspace_id is null or p_contact_id is null or p_opportunity_id is null or p_actor_user_id is null
    or p_revoked_at is null or char_length(reason_value) not between 10 and 2000 then
    raise exception 'BACKLINK_PILOT_ELIGIBILITY_INVALID_INPUT';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('backlink_production_pilot:' || p_workspace_id::text, 0));
  select * into eligibility from public.backlink_production_eligibility
  where workspace_id = p_workspace_id and contact_id = p_contact_id and opportunity_id = p_opportunity_id for update;
  if not found then raise exception 'BACKLINK_PILOT_ELIGIBILITY_NOT_FOUND'; end if;
  if eligibility.status <> 'approved' or eligibility.origin_kind <> 'real' then
    return query select eligibility.id, eligibility.status, 'already_inactive'::text; return;
  end if;
  update public.backlink_production_eligibility set status = 'revoked', reviewed_by = p_actor_user_id,
    reviewed_at = p_revoked_at, review_reason = reason_value, updated_at = timezone('utc', now())
  where id = eligibility.id returning * into eligibility;
  insert into public.backlink_production_eligibility_audit (
    eligibility_id, workspace_id, contact_id, opportunity_id, action, origin_kind,
    email_fingerprint, source_reference, reason, actor_user_id, created_at
  ) values (
    eligibility.id, p_workspace_id, p_contact_id, p_opportunity_id, 'revoked', 'real',
    eligibility.email_fingerprint, eligibility.source_reference, reason_value, p_actor_user_id, p_revoked_at
  );
  return query select eligibility.id, eligibility.status, 'revoked'::text;
end;
$$;

create or replace function public.get_backlink_production_pilot_eligibility(
  p_workspace_id uuid, p_contact_id uuid, p_opportunity_id uuid
) returns table (
  eligibility_id uuid, origin_kind text, status text, source_reference text,
  review_reason text, reviewed_by uuid, reviewed_at timestamptz, created_by uuid,
  created_at timestamptz, updated_at timestamptz, audit_history jsonb
)
language sql security definer set search_path = public as $$
  select e.id, e.origin_kind, e.status, e.source_reference, e.review_reason,
    e.reviewed_by, e.reviewed_at, e.created_by, e.created_at, e.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'action', a.action, 'reason', a.reason, 'actor_user_id', a.actor_user_id,
        'created_at', a.created_at
      ) order by a.created_at asc, a.id asc)
      from public.backlink_production_eligibility_audit a
      where a.eligibility_id = e.id
    ), '[]'::jsonb)
  from public.backlink_production_eligibility e
  where e.workspace_id = p_workspace_id and e.contact_id = p_contact_id and e.opportunity_id = p_opportunity_id;
$$;

-- An approved pilot eligibility is the explicit pilot signal.  No follow-up may
-- transition to requested while it exists, preventing a workspace-wide live toggle
-- from sending historical follow-ups during the initial-send pilot.
create or replace function public.backlink_block_follow_up_during_production_pilot()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.attempt_kind = 'follow_up' and new.status = 'requested' and exists (
    select 1 from public.backlink_production_eligibility e
    where e.workspace_id = new.workspace_id and e.origin_kind = 'real' and e.status = 'approved'
  ) then
    raise exception 'BACKLINK_PILOT_FOLLOW_UPS_BLOCKED';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_outreach_attempts_block_follow_up_during_production_pilot
before update of status on public.backlink_outreach_attempts
for each row execute function public.backlink_block_follow_up_during_production_pilot();

-- The follow-up sender calls this RPC even for an already-requested Attempt.
-- Replacing it is necessary so a pre-existing requested row cannot reach the
-- provider after a pilot becomes active. The shared advisory lock serializes
-- this check with pilot approval.
create or replace function public.mark_backlink_outreach_follow_up_attempt_requested(
  p_workspace_id uuid, p_outreach_id uuid, p_attempt_id uuid, p_actor_user_id uuid, p_requested_at timestamptz
) returns table (disposition text, attempt_id uuid, outreach_id uuid, recipient text, subject text, body text, reply_token_hash text, reply_token_key_version text, requested_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare outreach public.backlink_outreach; contact public.backlink_contacts; attempt public.backlink_outreach_attempts;
  draft public.backlink_outreach_follow_up_drafts; inbound_stop_effect public.backlink_outreach_inbound_effects;
begin
  if p_workspace_id is null or p_outreach_id is null or p_attempt_id is null or p_actor_user_id is null or p_requested_at is null then raise exception 'FOLLOW_UP_SEND_INVALID'; end if;
  if not exists (select 1 from auth.users where id = p_actor_user_id) then raise exception 'FOLLOW_UP_SEND_ACTOR_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('backlink_production_pilot:' || p_workspace_id::text, 0));
  if exists (select 1 from public.backlink_production_eligibility e where e.workspace_id = p_workspace_id and e.origin_kind = 'real' and e.status = 'approved') then
    raise exception 'BACKLINK_PILOT_FOLLOW_UPS_BLOCKED';
  end if;
  select * into outreach from public.backlink_outreach where id = p_outreach_id and workspace_id = p_workspace_id for update;
  if not found or outreach.status <> 'active' then raise exception 'FOLLOW_UP_SEND_OUTREACH_NOT_ACTIVE'; end if;
  if outreach.channel <> 'email' then raise exception 'FOLLOW_UP_SEND_CHANNEL_NOT_SUPPORTED'; end if;
  if outreach.current_attempt >= outreach.max_attempts then raise exception 'FOLLOW_UP_SEND_ATTEMPT_LIMIT_REACHED'; end if;
  select * into contact from public.backlink_contacts where id = outreach.contact_id and workspace_id = p_workspace_id for update;
  if not found or contact.contact_status in ('do_not_contact', 'archived') or nullif(trim(contact.email_normalized), '') is null then
    update public.backlink_outreach_attempts set status = 'cancelled', cancelled_at = p_requested_at, cancel_reason = 'contact_unavailable'
    where id = p_attempt_id and workspace_id = p_workspace_id and outreach_id = outreach.id and attempt_kind = 'follow_up' and status = 'prepared';
    raise exception 'FOLLOW_UP_SEND_CONTACT_UNAVAILABLE';
  end if;
  select * into attempt from public.backlink_outreach_attempts where id = p_attempt_id and workspace_id = p_workspace_id and outreach_id = outreach.id for update;
  if not found or attempt.attempt_kind <> 'follow_up' then raise exception 'FOLLOW_UP_SEND_ATTEMPT_INVALID'; end if;
  if attempt.status = 'requested' then
    select * into draft from public.backlink_outreach_follow_up_drafts where workspace_id = p_workspace_id and outreach_id = outreach.id and attempt_id = attempt.id for update;
    if not found then raise exception 'FOLLOW_UP_SEND_DRAFT_INVALID'; end if;
    return query select 'existing', attempt.id, attempt.outreach_id, attempt.recipient, draft.subject, draft.body, attempt.reply_token_hash, attempt.reply_token_key_version, attempt.requested_at; return;
  end if;
  if attempt.status <> 'prepared' then raise exception 'FOLLOW_UP_SEND_ATTEMPT_INVALID'; end if;
  if nullif(trim(coalesce(attempt.reply_token_hash, '')), '') is null or nullif(trim(coalesce(attempt.reply_token_key_version, '')), '') is null or attempt.reply_token_hash !~ '^[0-9a-f]{64}$' or attempt.reply_token_key_version !~ '^v[1-9][0-9]{0,15}$' then raise exception 'FOLLOW_UP_SEND_LEGACY_IDENTITY'; end if;
  select * into draft from public.backlink_outreach_follow_up_drafts where workspace_id = p_workspace_id and outreach_id = outreach.id and attempt_id = attempt.id for update;
  if not found or char_length(trim(draft.subject)) not between 1 and 300 or char_length(trim(draft.body)) not between 1 and 10000 then raise exception 'FOLLOW_UP_SEND_DRAFT_INVALID'; end if;
  select * into inbound_stop_effect from public.backlink_outreach_inbound_effects as effect where effect.workspace_id = p_workspace_id and effect.outreach_id = outreach.id and effect.effect_kind = 'reply_received_stop' and effect.status = 'applied' for update;
  if found then raise exception 'FOLLOW_UP_SEND_INBOUND_REPLY_STOPPED'; end if;
  update public.backlink_outreach_attempts set status = 'requested', requested_at = p_requested_at where id = attempt.id and workspace_id = p_workspace_id and status = 'prepared' returning * into attempt;
  if not found then raise exception 'FOLLOW_UP_SEND_ATTEMPT_INVALID'; end if;
  return query select 'requested_now', attempt.id, attempt.outreach_id, attempt.recipient, draft.subject, draft.body, attempt.reply_token_hash, attempt.reply_token_key_version, attempt.requested_at;
end;
$$;

revoke all on function public.approve_backlink_production_pilot_eligibility(uuid, uuid, uuid, uuid, text, text, timestamptz), public.revoke_backlink_production_pilot_eligibility(uuid, uuid, uuid, uuid, text, timestamptz), public.get_backlink_production_pilot_eligibility(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_backlink_production_pilot_eligibility(uuid, uuid, uuid, uuid, text, text, timestamptz), public.revoke_backlink_production_pilot_eligibility(uuid, uuid, uuid, uuid, text, timestamptz), public.get_backlink_production_pilot_eligibility(uuid, uuid, uuid) to service_role;

commit;
