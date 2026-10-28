begin;

-- PR 1: no row is eligible by default.  In particular, this migration does
-- not backfill historical outreach, contacts, or campaigns.
create table public.backlink_production_eligibility (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.backlink_contacts(id) on delete restrict,
  opportunity_id uuid not null references public.backlink_opportunities(id) on delete restrict,
  email_fingerprint text not null,
  origin_kind text not null,
  status text not null default 'pending',
  source_reference text not null,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_reason text,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint backlink_production_eligibility_unique unique (workspace_id, contact_id, opportunity_id),
  constraint backlink_production_eligibility_fingerprint_check check (email_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint backlink_production_eligibility_origin_check check (origin_kind in ('real', 'test', 'demo', 'legacy_unknown')),
  constraint backlink_production_eligibility_status_check check (status in ('pending', 'approved', 'rejected', 'revoked')),
  constraint backlink_production_eligibility_source_check check (char_length(trim(source_reference)) > 0),
  constraint backlink_production_eligibility_review_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status in ('approved', 'rejected', 'revoked') and reviewed_by is not null and reviewed_at is not null)
  )
);

create index backlink_production_eligibility_gate_idx
  on public.backlink_production_eligibility (workspace_id, contact_id, opportunity_id, status)
  where status = 'approved' and origin_kind = 'real';

alter table public.backlink_production_eligibility enable row level security;
create policy "backlink_production_eligibility_select_workspace_admins"
  on public.backlink_production_eligibility for select to authenticated
  using (public.is_workspace_admin_or_owner(workspace_id));
revoke all on public.backlink_production_eligibility from public, anon, authenticated;
grant select on public.backlink_production_eligibility to authenticated;

create or replace function public.reserve_backlink_approved_initial_attempt_v3(
  p_workspace_id uuid, p_campaign_id uuid, p_outreach_id uuid, p_actor_user_id uuid,
  p_attempt_id uuid, p_idempotency_key text, p_reply_token_hash text,
  p_reply_token_key_version text, p_requested_at timestamptz
) returns table (disposition text, attempt_id uuid, rate_limit_reason text)
language plpgsql security definer set search_path = public as $$
declare
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  eligibility public.backlink_production_eligibility;
  mailbox public.backlink_contact_mailbox_verifications;
  replay public.backlink_outreach_attempts;
  email_hash text;
  delegated record;
begin
  if p_workspace_id is null or p_campaign_id is null or p_outreach_id is null or p_actor_user_id is null or p_attempt_id is null or p_requested_at is null then
    raise exception 'OUTREACH_APPROVED_INITIAL_ATTEMPT_INVALID_INPUT';
  end if;

  -- Idempotent replay, phase A (before any lock). An attempt that is already
  -- terminal (accepted, failed, unknown) or that belongs to another outreach can
  -- never lead to a provider call, so V2 keeps its exact replay / conflict
  -- semantics and the attempt created by this key stays observable.
  select * into replay from public.backlink_outreach_attempts a
   where a.workspace_id = p_workspace_id and a.idempotency_key = trim(coalesce(p_idempotency_key, ''));
  if found and (replay.outreach_id <> p_outreach_id or replay.status in ('accepted', 'failed', 'unknown')) then
    select * into delegated from public.reserve_backlink_approved_initial_attempt_v2(
      p_workspace_id, p_campaign_id, p_outreach_id, p_actor_user_id, p_attempt_id,
      p_idempotency_key, p_reply_token_hash, p_reply_token_key_version, p_requested_at
    );
    return query select delegated.disposition, delegated.attempt_id, delegated.rate_limit_reason;
    return;
  end if;

  select * into outreach from public.backlink_outreach
   where id = p_outreach_id and workspace_id = p_workspace_id and campaign_id = p_campaign_id for update;
  if not found then return query select 'not_ready', null::uuid, null::text; return; end if;
  select * into contact from public.backlink_contacts
   where id = outreach.contact_id and workspace_id = p_workspace_id for update;
  if not found or contact.contact_status <> 'verified' or contact.archived_at is not null
     or contact.do_not_contact_at is not null or nullif(trim(coalesce(contact.email_normalized, '')), '') is null then
    return query select 'ineligible', null::uuid, null::text; return;
  end if;
  email_hash := encode(extensions.digest(lower(trim(contact.email_normalized)), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('backlink_production_recipient:' || p_workspace_id::text || ':' || email_hash, 0));

  -- Idempotent replay, phase B (authoritative, after the locks): a concurrent call
  -- with the same key may have committed while this one waited. A terminal attempt
  -- is returned as before; a still-requested attempt of this outreach is a legitimate
  -- resumption, but it must pass every gate below again (suppression, revocation,
  -- eligibility change, mailbox status) before the caller may reach the provider.
  select * into replay from public.backlink_outreach_attempts a
   where a.workspace_id = p_workspace_id and a.idempotency_key = trim(coalesce(p_idempotency_key, ''));
  if found and (replay.outreach_id <> p_outreach_id or replay.status in ('accepted', 'failed', 'unknown')) then
    select * into delegated from public.reserve_backlink_approved_initial_attempt_v2(
      p_workspace_id, p_campaign_id, p_outreach_id, p_actor_user_id, p_attempt_id,
      p_idempotency_key, p_reply_token_hash, p_reply_token_key_version, p_requested_at
    );
    return query select delegated.disposition, delegated.attempt_id, delegated.rate_limit_reason;
    return;
  end if;

  select * into eligibility from public.backlink_production_eligibility
   where workspace_id = p_workspace_id and contact_id = contact.id and opportunity_id = outreach.opportunity_id for update;
  if not found or eligibility.origin_kind <> 'real' or eligibility.status <> 'approved' or eligibility.email_fingerprint <> email_hash then
    return query select 'production_eligibility_required', null::uuid, null::text; return;
  end if;

  -- Only the MOST RECENT verification of this contact for the CURRENT email
  -- fingerprint counts: it must be deliverable and at most 30 days old (a future
  -- timestamp beyond a 5 minute clock skew is rejected as well).
  select * into mailbox from public.backlink_contact_mailbox_verifications v
   where v.workspace_id = p_workspace_id and v.contact_id = contact.id and v.email_fingerprint = email_hash
   order by v.checked_at desc, v.created_at desc, v.id desc
   limit 1;
  if not found or mailbox.result <> 'deliverable'
     or mailbox.checked_at < clock_timestamp() - interval '30 days'
     or mailbox.checked_at > clock_timestamp() + interval '5 minutes' then
    return query select 'mailbox_not_deliverable', null::uuid, null::text; return;
  end if;

  if exists (select 1 from public.backlink_email_suppressions s
    where s.workspace_id = p_workspace_id and s.email_normalized = lower(trim(contact.email_normalized))) then
    return query select 'recipient_suppressed', null::uuid, null::text; return;
  end if;
  -- Recipient history: the attempt being replayed (same key) is not "another" attempt.
  if exists (select 1 from public.backlink_outreach_attempts a
    where a.workspace_id = p_workspace_id and lower(trim(a.recipient)) = lower(trim(contact.email_normalized))
      and a.status = 'unknown' and a.id is distinct from replay.id) then
    return query select 'recipient_unknown_attempt', null::uuid, null::text; return;
  end if;
  if exists (select 1 from public.backlink_outreach_attempts a
    where a.workspace_id = p_workspace_id and lower(trim(a.recipient)) = lower(trim(contact.email_normalized))
      and a.id is distinct from replay.id) then
    return query select 'recipient_previously_attempted', null::uuid, null::text; return;
  end if;

  select * into delegated from public.reserve_backlink_approved_initial_attempt_v2(
    p_workspace_id, p_campaign_id, p_outreach_id, p_actor_user_id, p_attempt_id,
    p_idempotency_key, p_reply_token_hash, p_reply_token_key_version, p_requested_at
  );
  return query select delegated.disposition, delegated.attempt_id, delegated.rate_limit_reason;
end;
$$;

revoke all on function public.reserve_backlink_approved_initial_attempt_v3(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_backlink_approved_initial_attempt_v3(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) to service_role;
comment on function public.reserve_backlink_approved_initial_attempt_v3(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) is
  'Fail-closed production gate: explicit real approval, latest mailbox verification deliverable and at most 30 days old for the current email, suppression and recipient-history exclusion (all re-applied on a non-terminal idempotent replay) before delegating to V2 limits and idempotency.';

commit;
