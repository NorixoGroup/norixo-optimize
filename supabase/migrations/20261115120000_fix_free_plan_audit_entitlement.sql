-- Fixes a defect proven by code review (Norixo diagnostic Phases 5-7.2):
-- reserve_audit_entitlement() has required an audit_credit_lots row for
-- every non-admin call since 2026-07-14, including a workspace's first
-- free "Découverte" audit -- which no code path ever grants a credit lot
-- for. Every free-plan workspace with no purchase has therefore been
-- denied at the reservation step since that date (status='failed'/
-- 'insufficient_entitlement', no row ever inserted, hence the empty
-- audit_entitlement_reservations table observed in Production).
--
-- This migration adds a 'free_plan' reservation source: a workspace's one
-- lifetime free audit is granted without touching audit_credit_lots, and
-- without creating a usage_events ledger entry on finalize (the `if source
-- = 'credit'` guards in finalize/release already skip correctly for any
-- other source value, unchanged).
--
-- Eligibility for 'free_plan' is re-verified server-side against
-- public.subscriptions.plan_code -- never trusted purely from the
-- caller-supplied p_enforce_free_plan_limit flag, and fails CLOSED
-- (denies, falls through to the standard credit check) when no
-- subscriptions row exists, since no DB-level guarantee makes "no row"
-- mean "free plan" (only a lazy TypeScript upsert does, outside this
-- function's control). requested_quantity is hard-clamped to 1 whenever
-- a free grant is produced, regardless of the quantity parameter received.
--
-- SEPARATE DEFECT FOUND WHILE BUILDING THE LOCAL TEST HARNESS (Phase 8,
-- not part of the original Phases 5-7.2 diagnosis): reserve_, finalize_
-- and release_audit_entitlement all declare a RETURNS TABLE column named
-- `operation_key` (and reserve_ also `status`), which is also a real
-- column of audit_entitlement_reservations. Bare references to those
-- column names inside each function's own SQL queries are ambiguous
-- under PL/pgSQL's default `variable_conflict = error`, and Postgres
-- raises "column reference is ambiguous" (42702) the first time any of
-- the three functions is actually called -- for EVERY caller, free or
-- paid, admin or not, on the very first query each function runs. This
-- was never caught by static review because it only manifests at
-- execution time against a real Postgres engine, which no prior phase
-- had done. All three functions are re-created below with table aliases
-- to qualify every such reference. This is independent of the free_plan
-- feature and would need fixing even without it -- see the Phase 8
-- deliverable for why this likely supersedes the free-plan-credit-gap
-- theory as the dominant explanation for zero audits since 2026-07-14.
--
-- Rollback-safe by construction: the 'free_plan' value is purely additive
-- to the `source` check constraint and is never removed by a rollback.
-- The rollback script (scripts/audit-entitlement-test-harness/05_rollback.sql)
-- reverts only the free_plan branch of reserve_audit_entitlement and keeps
-- the ambiguous-column fix in all three functions -- rolling back to a
-- function that cannot be called at all would defeat the point of a
-- rollback.

begin;

-- Never assume the Postgres-generated constraint name; discover it.
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.audit_entitlement_reservations'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%source%credit%admin%';

  if v_conname is not null then
    execute format('alter table public.audit_entitlement_reservations drop constraint %I', v_conname);
  end if;
end
$$;

alter table public.audit_entitlement_reservations
  add constraint audit_entitlement_reservations_source_check
  check (source in ('credit', 'admin', 'free_plan'));

create or replace function public.reserve_audit_entitlement(
  p_workspace_id uuid,
  p_user_id uuid,
  p_operation_key text,
  p_target_kind text,
  p_target_ref text,
  p_quantity integer default 1,
  p_enforce_free_plan_limit boolean default false,
  p_billing_admin_bypass boolean default false
)
returns table (
  reservation_id uuid,
  operation_key text,
  status text,
  source text,
  reason_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_reservation public.audit_entitlement_reservations;
  conflicting_reservation public.audit_entitlement_reservations;
  lot public.audit_credit_lots;
  requested_quantity integer := greatest(coalesce(p_quantity, 1), 1);
  source_value text := case when p_billing_admin_bypass then 'admin' else 'credit' end;
  total_available integer := 0;
  remaining_quantity integer := 0;
  available_quantity integer := 0;
  consume_now integer := 0;
  free_limit_consumed integer := 0;
  allocations jsonb := '[]'::jsonb;
  v_plan_code text;
  v_free_candidate boolean := p_enforce_free_plan_limit and not p_billing_admin_bypass;
  is_free_grant boolean := false;
begin
  if p_workspace_id is null
    or p_user_id is null
    or coalesce(trim(p_operation_key), '') = ''
    or coalesce(trim(p_target_kind), '') = ''
    or coalesce(trim(p_target_ref), '') = ''
  then
    return query
    select null::uuid, coalesce(p_operation_key, ''), 'failed', source_value, 'invalid_request';
    return;
  end if;

  if p_target_kind not in ('listing_id', 'source_url') then
    return query
    select null::uuid, p_operation_key, 'failed', source_value, 'invalid_target_kind';
    return;
  end if;

  perform 1
  from public.workspaces
  where id = p_workspace_id
  for update;

  if not found then
    return query
    select null::uuid, p_operation_key, 'failed', source_value, 'workspace_not_found';
    return;
  end if;

  select aer.*
  into existing_reservation
  from public.audit_entitlement_reservations aer
  where aer.operation_key = p_operation_key
  limit 1;

  if found then
    return query
    select
      existing_reservation.id,
      existing_reservation.operation_key,
      'already_reserved',
      existing_reservation.source,
      null::text;
    return;
  end if;

  select aer.*
  into conflicting_reservation
  from public.audit_entitlement_reservations aer
  where aer.workspace_id = p_workspace_id
    and aer.target_kind = p_target_kind
    and aer.target_ref = p_target_ref
    and aer.status = 'reserved'
  order by aer.created_at desc
  limit 1;

  if found then
    return query
    select
      conflicting_reservation.id,
      conflicting_reservation.operation_key,
      'conflict',
      conflicting_reservation.source,
      'active_target_reservation';
    return;
  end if;

  -- Fail-closed re-verification: the free path is never granted on the
  -- caller's word alone. Absence of a subscriptions row, or a plan_code
  -- other than 'free', silently falls through to the standard credit
  -- check below instead of granting (or denying outright) anything.
  if v_free_candidate then
    select plan_code into v_plan_code
    from public.subscriptions
    where workspace_id = p_workspace_id;

    v_free_candidate := (v_plan_code is not null and v_plan_code = 'free');
  end if;

  if v_free_candidate then
    select
      (
        select count(*)
        from public.audits
        where workspace_id = p_workspace_id
      )
      +
      (
        select count(*)
        from public.audit_entitlement_reservations aer
        where aer.workspace_id = p_workspace_id
          and aer.free_plan_gate = true
          and aer.status = 'reserved'
      )
    into free_limit_consumed;

    if free_limit_consumed >= 1 then
      return query
      select null::uuid, p_operation_key, 'insufficient_entitlement', source_value, 'free_plan_limit_reached';
      return;
    end if;

    is_free_grant := true;
    source_value := 'free_plan';
    requested_quantity := 1;
  end if;

  if not p_billing_admin_bypass and not is_free_grant then
    for lot in
      select *
      from public.audit_credit_lots
      where workspace_id = p_workspace_id
        and consumed_quantity < granted_quantity
        and (
          expires_at is null
          or expires_at > timezone('utc', now())
        )
      order by expires_at asc nulls first, created_at asc, id asc
      for update
    loop
      total_available :=
        total_available
        + greatest(coalesce(lot.granted_quantity, 0) - coalesce(lot.consumed_quantity, 0), 0);
    end loop;

    if total_available < requested_quantity then
      return query
      select null::uuid, p_operation_key, 'insufficient_entitlement', source_value, 'insufficient_credits';
      return;
    end if;

    remaining_quantity := requested_quantity;

    for lot in
      select *
      from public.audit_credit_lots
      where workspace_id = p_workspace_id
        and consumed_quantity < granted_quantity
        and (
          expires_at is null
          or expires_at > timezone('utc', now())
        )
      order by expires_at asc nulls first, created_at asc, id asc
      for update
    loop
      exit when remaining_quantity <= 0;

      available_quantity := greatest(
        coalesce(lot.granted_quantity, 0) - coalesce(lot.consumed_quantity, 0),
        0
      );

      if available_quantity <= 0 then
        continue;
      end if;

      consume_now := least(remaining_quantity, available_quantity);

      update public.audit_credit_lots
      set
        consumed_quantity = consumed_quantity + consume_now,
        updated_at = timezone('utc', now())
      where id = lot.id;

      allocations := allocations || jsonb_build_array(
        jsonb_build_object(
          'lot_id', lot.id,
          'quantity', consume_now
        )
      );

      remaining_quantity := remaining_quantity - consume_now;
    end loop;
  end if;

  insert into public.audit_entitlement_reservations (
    operation_key,
    workspace_id,
    user_id,
    target_kind,
    target_ref,
    source,
    status,
    quantity,
    free_plan_gate,
    credit_allocations
  )
  values (
    p_operation_key,
    p_workspace_id,
    p_user_id,
    p_target_kind,
    p_target_ref,
    source_value,
    'reserved',
    requested_quantity,
    is_free_grant,
    allocations
  )
  returning id
  into reservation_id;

  return query
  select reservation_id, p_operation_key, 'reserved', source_value, null::text;
end;
$$;

-- Same PL/pgSQL variable/column name collision as above
-- (operation_key is both a RETURNS TABLE column here and a real column of
-- audit_entitlement_reservations), found only by actually executing this
-- function against a real Postgres engine -- fixed here with a table
-- alias, unrelated to and independent of the free_plan feature itself.
create or replace function public.finalize_audit_entitlement(
  p_workspace_id uuid,
  p_operation_key text,
  p_audit_id uuid,
  p_listing_id uuid,
  p_user_id uuid,
  p_usage_source text default null,
  p_source_url text default null
)
returns table (
  reservation_id uuid,
  operation_key text,
  status text,
  source text,
  reason_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_reservation public.audit_entitlement_reservations;
begin
  if p_workspace_id is null
    or p_audit_id is null
    or p_listing_id is null
    or p_user_id is null
    or coalesce(trim(p_operation_key), '') = ''
  then
    return query
    select null::uuid, coalesce(p_operation_key, ''), 'failed', null::text, 'invalid_request';
    return;
  end if;

  select aer.*
  into existing_reservation
  from public.audit_entitlement_reservations aer
  where aer.workspace_id = p_workspace_id
    and aer.operation_key = p_operation_key
  for update;

  if not found then
    return query
    select null::uuid, p_operation_key, 'failed', null::text, 'reservation_not_found';
    return;
  end if;

  if existing_reservation.status = 'consumed' then
    return query
    select
      existing_reservation.id,
      existing_reservation.operation_key,
      'already_finalized',
      existing_reservation.source,
      null::text;
    return;
  end if;

  if existing_reservation.status = 'released' then
    return query
    select
      existing_reservation.id,
      existing_reservation.operation_key,
      'failed',
      existing_reservation.source,
      'already_released';
    return;
  end if;

  if existing_reservation.source = 'credit' then
    insert into public.usage_events (
      workspace_id,
      user_id,
      event_type,
      quantity,
      metadata
    )
    values (
      p_workspace_id,
      p_user_id,
      'audit_credit_consumed',
      existing_reservation.quantity,
      jsonb_strip_nulls(
        jsonb_build_object(
          'audit_id', p_audit_id,
          'listing_id', p_listing_id,
          'operation_key', existing_reservation.operation_key,
          'reservation_id', existing_reservation.id,
          'source', coalesce(nullif(trim(p_usage_source), ''), 'audit_entitlement_finalize'),
          'source_url', nullif(trim(coalesce(p_source_url, '')), '')
        )
      )
    )
    on conflict do nothing;
  end if;

  update public.audit_entitlement_reservations
  set
    status = 'consumed',
    audit_id = p_audit_id,
    listing_id = p_listing_id,
    finalized_at = timezone('utc', now()),
    failure_code = null,
    updated_at = timezone('utc', now())
  where id = existing_reservation.id
  returning *
  into existing_reservation;

  return query
  select
    existing_reservation.id,
    existing_reservation.operation_key,
    'finalized',
    existing_reservation.source,
    null::text;
end;
$$;

-- Same fix as above, same reason.
create or replace function public.release_audit_entitlement(
  p_workspace_id uuid,
  p_operation_key text,
  p_failure_code text default null
)
returns table (
  reservation_id uuid,
  operation_key text,
  status text,
  source text,
  reason_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_reservation public.audit_entitlement_reservations;
  allocation_entry jsonb;
  allocation_lot_id uuid;
  allocation_quantity integer;
begin
  if p_workspace_id is null or coalesce(trim(p_operation_key), '') = '' then
    return query
    select null::uuid, coalesce(p_operation_key, ''), 'failed', null::text, 'invalid_request';
    return;
  end if;

  perform 1
  from public.workspaces
  where id = p_workspace_id
  for update;

  select aer.*
  into existing_reservation
  from public.audit_entitlement_reservations aer
  where aer.workspace_id = p_workspace_id
    and aer.operation_key = p_operation_key
  for update;

  if not found then
    return query
    select null::uuid, p_operation_key, 'failed', null::text, 'reservation_not_found';
    return;
  end if;

  if existing_reservation.status = 'released' then
    return query
    select
      existing_reservation.id,
      existing_reservation.operation_key,
      'already_released',
      existing_reservation.source,
      null::text;
    return;
  end if;

  if existing_reservation.status = 'consumed' then
    return query
    select
      existing_reservation.id,
      existing_reservation.operation_key,
      'failed',
      existing_reservation.source,
      'already_consumed';
    return;
  end if;

  if existing_reservation.source = 'credit' then
    for allocation_entry in
      select value
      from jsonb_array_elements(existing_reservation.credit_allocations)
    loop
      allocation_lot_id := nullif(allocation_entry->>'lot_id', '')::uuid;
      allocation_quantity := greatest(coalesce((allocation_entry->>'quantity')::integer, 0), 0);

      if allocation_lot_id is null or allocation_quantity <= 0 then
        continue;
      end if;

      update public.audit_credit_lots
      set
        consumed_quantity = greatest(consumed_quantity - allocation_quantity, 0),
        updated_at = timezone('utc', now())
      where id = allocation_lot_id
        and workspace_id = p_workspace_id;
    end loop;
  end if;

  update public.audit_entitlement_reservations
  set
    status = 'released',
    released_at = timezone('utc', now()),
    failure_code = nullif(trim(coalesce(p_failure_code, '')), ''),
    updated_at = timezone('utc', now())
  where id = existing_reservation.id
  returning *
  into existing_reservation;

  return query
  select
    existing_reservation.id,
    existing_reservation.operation_key,
    'released',
    existing_reservation.source,
    null::text;
end;
$$;

commit;
