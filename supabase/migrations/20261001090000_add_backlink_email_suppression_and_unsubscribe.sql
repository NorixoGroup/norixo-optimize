begin;

-- A1: workspace-wide email suppression, deterministic unsubscribe handling and
-- database-level enforcement before any email Attempt can be reserved.
--
-- Suppression is per (workspace, normalized email address). It never suppresses
-- a whole domain. Existing contact do-not-contact protections remain in place and
-- are mirrored into this table so another contact or campaign cannot bypass them.

create table if not exists public.backlink_email_suppressions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email_normalized text not null,
  reason text not null,
  source text not null,
  outreach_id uuid references public.backlink_outreach(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_email_suppressions_workspace_email_unique
    unique (workspace_id, email_normalized),
  constraint backlink_email_suppressions_email_check
    check (
      email_normalized = lower(trim(email_normalized))
      and email_normalized ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  constraint backlink_email_suppressions_reason_check
    check (reason in ('unsubscribed', 'provider_permanent_bounce', 'provider_complaint', 'contact_do_not_contact')),
  constraint backlink_email_suppressions_source_check
    check (source in ('hosted_unsubscribe', 'admin_unsubscribe', 'inbound_reply', 'outreach_response', 'contact_do_not_contact'))
);

comment on table public.backlink_email_suppressions is
  'Durable workspace-wide email suppression keyed by normalized address. Written only by security-definer functions.';

alter table public.backlink_email_suppressions enable row level security;

create policy "backlink_email_suppressions_select_workspace_admins"
on public.backlink_email_suppressions
for select
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id));

revoke all on table public.backlink_email_suppressions from public, anon, authenticated;
grant select on table public.backlink_email_suppressions to authenticated;
grant all on table public.backlink_email_suppressions to service_role;

-- Prepared follow-ups can now also be cancelled because the address was unsubscribed.
alter table public.backlink_outreach_attempts
  drop constraint backlink_outreach_attempts_cancel_reason_check;

alter table public.backlink_outreach_attempts
  add constraint backlink_outreach_attempts_cancel_reason_check
  check (
    cancel_reason is null
    or cancel_reason in (
      'inbound_reply',
      'provider_complaint',
      'provider_permanent_bounce',
      'contact_unavailable',
      'admin_cancelled',
      'unsubscribed'
    )
  );

create or replace function public.backlink_suppression_reason_for_contact_reason(p_reason text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(p_reason, '')))
    when 'provider_permanent_bounce' then 'provider_permanent_bounce'
    when 'provider_complaint' then 'provider_complaint'
    when 'unsubscribed' then 'unsubscribed'
    else 'contact_do_not_contact'
  end;
$$;

-- Cancels prepared (never sent) email follow-ups for one suppressed address.
create or replace function public.backlink_cancel_prepared_follow_ups_for_email(
  p_workspace_id uuid,
  p_email_normalized text,
  p_cancel_reason text,
  p_cancelled_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cancelled_count integer;
begin
  update public.backlink_outreach_attempts as attempt
  set status = 'cancelled',
      cancelled_at = p_cancelled_at,
      cancel_reason = p_cancel_reason
  where attempt.workspace_id = p_workspace_id
    and attempt.channel = 'email'
    and attempt.attempt_kind = 'follow_up'
    and attempt.status = 'prepared'
    and lower(btrim(attempt.recipient)) = p_email_normalized;
  get diagnostics cancelled_count = row_count;
  return cancelled_count;
end;
$$;

-- Idempotent core: records suppression for one address and marks matching contacts.
-- Returns true only when a new suppression row was created.
create or replace function public.backlink_apply_email_suppression(
  p_workspace_id uuid,
  p_email_normalized text,
  p_reason text,
  p_source text,
  p_outreach_id uuid,
  p_applied_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
  effective_at timestamptz := coalesce(p_applied_at, timezone('utc', now()));
begin
  if p_workspace_id is null or nullif(trim(coalesce(p_email_normalized, '')), '') is null then
    raise exception 'BACKLINK_SUPPRESSION_INVALID';
  end if;

  insert into public.backlink_email_suppressions (
    workspace_id, email_normalized, reason, source, outreach_id, created_at
  ) values (
    p_workspace_id, lower(btrim(p_email_normalized)), p_reason, p_source, p_outreach_id, effective_at
  )
  on conflict (workspace_id, email_normalized) do nothing;
  get diagnostics inserted_count = row_count;

  update public.backlink_contacts as contact
  set contact_status = 'do_not_contact',
      do_not_contact_at = effective_at,
      do_not_contact_reason = p_reason
  where contact.workspace_id = p_workspace_id
    and contact.email_normalized = lower(btrim(p_email_normalized))
    and contact.contact_status not in ('do_not_contact', 'archived');

  return inserted_count > 0;
end;
$$;

-- Newly suppressed address: stop prepared follow-ups immediately.
create or replace function public.backlink_email_suppression_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.backlink_cancel_prepared_follow_ups_for_email(
    new.workspace_id,
    new.email_normalized,
    case new.reason
      when 'unsubscribed' then 'unsubscribed'
      when 'provider_permanent_bounce' then 'provider_permanent_bounce'
      when 'provider_complaint' then 'provider_complaint'
      else 'contact_unavailable'
    end,
    timezone('utc', now())
  );
  return new;
end;
$$;

drop trigger if exists trg_backlink_email_suppression_after_insert
  on public.backlink_email_suppressions;
create trigger trg_backlink_email_suppression_after_insert
after insert on public.backlink_email_suppressions
for each row execute function public.backlink_email_suppression_after_insert();

-- Fail-closed gate: an email Attempt cannot be prepared or requested for a
-- suppressed address. The check runs for initial sends, follow-ups and any future path.
create or replace function public.backlink_block_suppressed_email_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.channel = 'email'
     and new.status in ('prepared', 'requested')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if exists (
      select 1
      from public.backlink_email_suppressions as suppression
      where suppression.workspace_id = new.workspace_id
        and suppression.email_normalized = lower(btrim(new.recipient))
    ) then
      raise exception 'BACKLINK_EMAIL_SUPPRESSED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_backlink_outreach_attempts_block_suppressed_email
  on public.backlink_outreach_attempts;
create trigger trg_backlink_outreach_attempts_block_suppressed_email
before insert or update of status on public.backlink_outreach_attempts
for each row execute function public.backlink_block_suppressed_email_attempt();

-- Existing do-not-contact signals (bounce, complaint, manual) feed workspace suppression.
create or replace function public.backlink_sync_email_suppression_from_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_normalized is not null
     and (new.contact_status = 'do_not_contact' or new.do_not_contact_at is not null) then
    insert into public.backlink_email_suppressions (
      workspace_id, email_normalized, reason, source
    ) values (
      new.workspace_id,
      lower(btrim(new.email_normalized)),
      public.backlink_suppression_reason_for_contact_reason(new.do_not_contact_reason),
      'contact_do_not_contact'
    )
    on conflict (workspace_id, email_normalized) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_backlink_contacts_sync_email_suppression
  on public.backlink_contacts;
create trigger trg_backlink_contacts_sync_email_suppression
after insert or update of contact_status, email_normalized, do_not_contact_at, do_not_contact_reason
on public.backlink_contacts
for each row execute function public.backlink_sync_email_suppression_from_contact();

-- Deterministic response semantics: recording an `unsubscribed` response (manual
-- lifecycle action or any other path) creates workspace suppression. A plain
-- `negative` response never does.
create or replace function public.backlink_outreach_unsubscribed_response_suppression()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  contact_email text;
begin
  select contact.email_normalized
  into contact_email
  from public.backlink_contacts as contact
  where contact.id = new.contact_id
    and contact.workspace_id = new.workspace_id;

  if contact_email is not null then
    perform public.backlink_apply_email_suppression(
      new.workspace_id,
      contact_email,
      'unsubscribed',
      'outreach_response',
      new.id,
      timezone('utc', now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_backlink_outreach_unsubscribed_response_suppression
  on public.backlink_outreach;
create trigger trg_backlink_outreach_unsubscribed_response_suppression
after update of last_response_type on public.backlink_outreach
for each row
when (new.last_response_type = 'unsubscribed' and old.last_response_type is distinct from new.last_response_type)
execute function public.backlink_outreach_unsubscribed_response_suppression();

-- Explicit unsubscribe: used by the hosted unsubscribe flow and the admin action.
-- Idempotent. Suppresses the address workspace-wide, marks matching contacts,
-- closes every open email outreach for that address and cancels prepared follow-ups.
create or replace function public.apply_backlink_outreach_unsubscribe(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_source text,
  p_applied_at timestamptz default timezone('utc', now())
)
returns table (
  disposition text,
  outreach_id uuid,
  outreach_status text,
  email_suppressed boolean,
  closed_outreach_count integer,
  applied_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_outreach public.backlink_outreach;
  target_contact public.backlink_contacts;
  newly_suppressed boolean;
  closed_count integer := 0;
  effective_at timestamptz := coalesce(p_applied_at, timezone('utc', now()));
begin
  if p_workspace_id is null
     or p_outreach_id is null
     or p_source not in ('hosted_unsubscribe', 'admin_unsubscribe', 'inbound_reply') then
    raise exception 'BACKLINK_UNSUBSCRIBE_INVALID';
  end if;

  select * into target_outreach
  from public.backlink_outreach as outreach
  where outreach.id = p_outreach_id
    and outreach.workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'BACKLINK_UNSUBSCRIBE_OUTREACH_NOT_FOUND';
  end if;

  select * into target_contact
  from public.backlink_contacts as contact
  where contact.id = target_outreach.contact_id
    and contact.workspace_id = p_workspace_id;
  if not found or target_contact.email_normalized is null then
    raise exception 'BACKLINK_UNSUBSCRIBE_EMAIL_UNAVAILABLE';
  end if;

  newly_suppressed := public.backlink_apply_email_suppression(
    p_workspace_id,
    target_contact.email_normalized,
    'unsubscribed',
    p_source,
    target_outreach.id,
    effective_at
  );

  with closed as (
    update public.backlink_outreach as outreach
    set status = 'closed',
        closed_at = effective_at,
        stop_reason = 'unsubscribed',
        last_response_type = 'unsubscribed',
        next_follow_up_at = null,
        response_deadline_at = null
    from public.backlink_contacts as contact
    where outreach.workspace_id = p_workspace_id
      and contact.id = outreach.contact_id
      and contact.workspace_id = p_workspace_id
      and contact.email_normalized = target_contact.email_normalized
      and outreach.channel = 'email'
      and outreach.status in ('draft', 'ready', 'active', 'replied', 'conversation_open', 'paused')
    returning outreach.id
  )
  select count(*)::integer into closed_count from closed;

  perform public.backlink_cancel_prepared_follow_ups_for_email(
    p_workspace_id,
    target_contact.email_normalized,
    'unsubscribed',
    effective_at
  );

  select * into target_outreach
  from public.backlink_outreach as outreach
  where outreach.id = p_outreach_id
    and outreach.workspace_id = p_workspace_id;

  return query select
    case when newly_suppressed or closed_count > 0 then 'applied' else 'existing' end,
    target_outreach.id,
    target_outreach.status,
    true,
    closed_count,
    effective_at;
end;
$$;

revoke all on function public.backlink_cancel_prepared_follow_ups_for_email(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.backlink_apply_email_suppression(uuid, text, text, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_backlink_outreach_unsubscribe(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.backlink_cancel_prepared_follow_ups_for_email(uuid, text, text, timestamptz) to service_role;
grant execute on function public.backlink_apply_email_suppression(uuid, text, text, text, uuid, timestamptz) to service_role;
grant execute on function public.apply_backlink_outreach_unsubscribe(uuid, uuid, text, timestamptz) to service_role;

comment on function public.apply_backlink_outreach_unsubscribe(uuid, uuid, text, timestamptz) is
  'Idempotent explicit unsubscribe: workspace-wide email suppression, contact do-not-contact, close open email outreach, cancel prepared follow-ups.';

-- One-time, idempotent mirror of contacts that are ALREADY do-not-contact. It runs only
-- when this migration is applied and never overwrites an existing suppression row.
insert into public.backlink_email_suppressions (workspace_id, email_normalized, reason, source)
select distinct on (contact.workspace_id, contact.email_normalized)
  contact.workspace_id,
  contact.email_normalized,
  public.backlink_suppression_reason_for_contact_reason(contact.do_not_contact_reason),
  'contact_do_not_contact'
from public.backlink_contacts as contact
where contact.email_normalized is not null
  and (contact.contact_status = 'do_not_contact' or contact.do_not_contact_at is not null)
order by contact.workspace_id, contact.email_normalized, contact.do_not_contact_at nulls last
on conflict (workspace_id, email_normalized) do nothing;

commit;
