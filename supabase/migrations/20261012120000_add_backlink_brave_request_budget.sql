
-- Brave Search request budget.
--
-- A global ledger of Brave request reservations, shared by manual and scheduled
-- discovery and by every workspace that uses the same Brave API account.
--
--   80 reservations / rolling 30 days
--
-- A reservation is written BEFORE the HTTP request and is never released, so a
-- failed or ambiguous provider attempt still counts (conservative).
--
-- The ledger deliberately has no foreign keys: it records external spend and
-- must survive deletion of a workspace or run, otherwise deleting a row would
-- silently free budget that was really consumed.

create table public.backlink_brave_request_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid,
  request_key text not null,
  reserved_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  constraint backlink_brave_request_reservations_key_unique unique (workspace_id, request_key),
  constraint backlink_brave_request_reservations_key_check
    check (request_key ~ '^[A-Za-z0-9:_.-]{1,200}$')
);

create index backlink_brave_request_reservations_reserved_at_idx
  on public.backlink_brave_request_reservations (reserved_at);

-- No policies: ordinary users have no access. Only the security-definer RPC
-- below (callable by service_role) writes the ledger.
alter table public.backlink_brave_request_reservations enable row level security;

-- service_role may read the ledger for audit, but must hold no other direct privilege:
-- direct writes (or deletes) could bypass or silently free the budget, and the
-- default privileges also hand out REFERENCES, TRIGGER and (PostgreSQL 17) MAINTAIN.
-- So every direct privilege is revoked first and SELECT alone is granted back.
-- Reservations are made only through the SECURITY DEFINER function below, which runs
-- with its owner's privileges (the owner is unaffected by these revokes).
revoke all on table public.backlink_brave_request_reservations
  from public, anon, authenticated, service_role;
grant select on table public.backlink_brave_request_reservations to service_role;

create or replace function public.reserve_backlink_brave_request(
  p_workspace_id uuid,
  p_run_id uuid,
  p_request_key text
)
returns table (
  reservation_outcome text,
  reservation_id uuid,
  window_used integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_limit constant integer := 80;
  v_now timestamptz;
  v_existing_id uuid;
  v_new_id uuid;
  v_used integer;
begin
  if p_workspace_id is null
     or p_request_key is null
     or p_request_key !~ '^[A-Za-z0-9:_.-]{1,200}$' then
    raise exception 'BRAVE_BUDGET_INVALID_INPUT' using errcode = '22023';
  end if;

  -- The lock only protects the count-then-insert below if every statement after it takes a
  -- fresh snapshot (READ COMMITTED). Under REPEATABLE READ / SERIALIZABLE the snapshot could
  -- predate the lock wait and miss reservations committed by the previous holder, so refuse.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'BRAVE_BUDGET_ISOLATION_LEVEL_UNSUPPORTED' using errcode = '55000';
  end if;

  -- One global lock serializes every reservation, across workspaces. The count
  -- and the insert below therefore run as one atomic step.
  perform pg_advisory_xact_lock(hashtextextended('backlink_brave_request_budget', 0));

  -- Read after the lock is held, so the rolling window and the stored timestamp share one
  -- reference time that reflects when this reservation was actually admitted.
  v_now := clock_timestamp();

  select r.id
    into v_existing_id
  from public.backlink_brave_request_reservations as r
  where r.workspace_id = p_workspace_id
    and r.request_key = p_request_key;

  select count(*)::integer
    into v_used
  from public.backlink_brave_request_reservations as r
  where r.reserved_at > v_now - interval '30 days';

  -- An idempotent replay returns 'replayed', never 'reserved': the caller must
  -- not send another HTTP request without a new request key.
  if v_existing_id is not null then
    return query select 'replayed'::text, v_existing_id, v_used;
    return;
  end if;

  if v_used >= c_limit then
    return query select 'limit_reached'::text, null::uuid, v_used;
    return;
  end if;

  insert into public.backlink_brave_request_reservations as r
    (workspace_id, run_id, request_key, reserved_at)
  values
    (p_workspace_id, p_run_id, p_request_key, v_now)
  returning r.id into v_new_id;

  return query select 'reserved'::text, v_new_id, v_used + 1;
end;
$$;

revoke all on function public.reserve_backlink_brave_request(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reserve_backlink_brave_request(uuid, uuid, text)
  to service_role;
