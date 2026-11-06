
-- ZeroBounce mailbox verification budget (BL-AUTO-04 Mission B).
--
-- A global ledger of ZeroBounce verification reservations, shared by the
-- manual verification route and the autonomous mailbox_verification task, so
-- both paths draw from one common, atomic cap.
--
--   <= p_limit reservations per provider billing cycle (p_cycle_period_start)
--
-- Unlike the Brave Search budget (rolling 30-day window), this ledger is keyed
-- to an explicit cycle_period_start supplied by the caller. The caller is
-- responsible for deriving that date from ZeroBounce's actual renewal anchor
-- (confirmed 2026-12-01 at the time this migration was written) -- this
-- function never assumes a rolling 30-day window equals the provider's
-- billing month, and never assumes the full configured limit is still
-- available (ZeroBounce dashboard usage outside this application is not
-- visible here; the configured limit must already include that margin).
--
-- A reservation is written BEFORE the HTTP request and is never released, so
-- a failed or ambiguous provider attempt still counts (conservative) -- the
-- same policy as the Brave budget ledger.
--
-- This migration is NOT applied by this change. Written for review only.

create table public.backlink_zerobounce_verification_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  contact_id uuid not null,
  email_fingerprint text not null,
  cycle_period_start date not null,
  reserved_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  constraint backlink_zerobounce_verification_reservations_key_unique
    unique (workspace_id, contact_id, email_fingerprint, cycle_period_start),
  constraint backlink_zerobounce_verification_reservations_fingerprint_check
    check (email_fingerprint ~ '^[a-f0-9]{64}$')
);

create index backlink_zerobounce_verification_reservations_period_idx
  on public.backlink_zerobounce_verification_reservations (cycle_period_start, reserved_at);

-- No policies: ordinary users have no access. Only the security-definer RPC
-- below (callable by service_role) writes the ledger.
alter table public.backlink_zerobounce_verification_reservations enable row level security;

-- service_role may read the ledger for audit, but must hold no other direct privilege:
-- direct writes (or deletes) could bypass or silently free the budget, and the
-- default privileges also hand out REFERENCES, TRIGGER and (PostgreSQL 17) MAINTAIN.
-- So every direct privilege is revoked first and SELECT alone is granted back.
-- Reservations are made only through the SECURITY DEFINER function below, which runs
-- with its owner's privileges (the owner is unaffected by these revokes).
revoke all on table public.backlink_zerobounce_verification_reservations
  from public, anon, authenticated, service_role;
grant select on table public.backlink_zerobounce_verification_reservations to service_role;

create or replace function public.reserve_backlink_zerobounce_verification(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_email_fingerprint text,
  p_cycle_period_start date,
  p_limit integer
)
returns table (
  reservation_outcome text,
  reservation_id uuid,
  period_used integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz;
  v_existing_id uuid;
  v_new_id uuid;
  v_used integer;
begin
  if p_workspace_id is null
     or p_contact_id is null
     or p_email_fingerprint is null
     or p_email_fingerprint !~ '^[a-f0-9]{64}$'
     or p_cycle_period_start is null
     or p_limit is null
     or p_limit < 1 then
    raise exception 'ZEROBOUNCE_BUDGET_INVALID_INPUT' using errcode = '22023';
  end if;

  -- Same requirement as the Brave budget RPC: the count-then-insert below is only
  -- atomic under READ COMMITTED, where every statement after the lock wait takes a
  -- fresh snapshot.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'ZEROBOUNCE_BUDGET_ISOLATION_LEVEL_UNSUPPORTED' using errcode = '55000';
  end if;

  -- One global lock serializes every reservation for this cycle, across
  -- workspaces and across the manual and autonomous call paths alike.
  perform pg_advisory_xact_lock(hashtextextended('backlink_zerobounce_verification_budget', 0));

  v_now := clock_timestamp();

  select r.id
    into v_existing_id
  from public.backlink_zerobounce_verification_reservations as r
  where r.workspace_id = p_workspace_id
    and r.contact_id = p_contact_id
    and r.email_fingerprint = p_email_fingerprint
    and r.cycle_period_start = p_cycle_period_start;

  select count(*)::integer
    into v_used
  from public.backlink_zerobounce_verification_reservations as r
  where r.cycle_period_start = p_cycle_period_start;

  -- An idempotent replay returns 'replayed', never 'reserved': the caller must
  -- not send another ZeroBounce request for the same contact+email this cycle.
  if v_existing_id is not null then
    return query select 'replayed'::text, v_existing_id, v_used;
    return;
  end if;

  if v_used >= p_limit then
    return query select 'limit_reached'::text, null::uuid, v_used;
    return;
  end if;

  insert into public.backlink_zerobounce_verification_reservations as r
    (workspace_id, contact_id, email_fingerprint, cycle_period_start, reserved_at)
  values
    (p_workspace_id, p_contact_id, p_email_fingerprint, p_cycle_period_start, v_now)
  returning r.id into v_new_id;

  return query select 'reserved'::text, v_new_id, v_used + 1;
end;
$$;

revoke all on function public.reserve_backlink_zerobounce_verification(uuid, uuid, text, date, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_backlink_zerobounce_verification(uuid, uuid, text, date, integer)
  to service_role;
