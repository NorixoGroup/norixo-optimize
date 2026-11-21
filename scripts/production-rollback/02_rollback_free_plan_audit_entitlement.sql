-- Production rollback for supabase/migrations/20261115120000_fix_free_plan_audit_entitlement.sql
-- Step 2/3: THE ROLLBACK ITSELF. READY FOR REVIEW -- NOT READY FOR EXECUTION.
--
-- Distinct from scripts/audit-entitlement-test-harness/05_rollback.sql,
-- which targets a throwaway local database (norixo_ph8_entitlement_test)
-- and is guarded to refuse running anywhere else. This script has no
-- such guard because it is meant for Production, but for that exact
-- reason it must never be run casually -- see the controlled execution
-- procedure in this directory's companion files before ever running it.
--
-- What this does:
--   - Removes the 'free_plan' granting branch from reserve_audit_entitlement
--     (a workspace's first free audit again requires a purchased credit
--     lot, exactly as it did before 20261115120000).
--   - Keeps the PL/pgSQL column-ambiguity fix in all three functions
--     (reserve_/finalize_/release_audit_entitlement) -- reverting that
--     fix would resurrect a function that cannot be called at all,
--     which defeats the point of a rollback. finalize_/release_ are
--     re-asserted here unchanged from 20261115120000.
--
-- Idempotence, precisely (corrected -- an earlier draft overclaimed this):
-- this script is idempotent ONLY across the two states where running it
-- is sensible -- the expected pre-rollback state (forward migration
-- live) and the already-rolled-back state (re-running it then is a
-- harmless no-op, verified below). It is explicitly NOT silently
-- tolerant of "forward migration never applied" (refused, nothing to
-- roll back) or of any definition matching neither known state
-- (refused, treated as a possible partial apply or manual modification
-- -- see the guard below). Each of the three functions is identified by
-- its exact schema-qualified signature (::regprocedure), never by bare
-- name, and classified by an exact content hash (md5 of
-- pg_get_functiondef), never by a loose text pattern that an unrelated
-- comment or an attacker-controlled string literal could satisfy.
--
-- Locking, precisely (corrected -- an earlier draft was misleading
-- here): CREATE OR REPLACE FUNCTION takes a lock on the function object
-- itself, not on any row of audit_entitlement_reservations or
-- workspaces. It does not wait on `for update` row locks held by
-- unrelated in-flight application transactions, and a row sitting in
-- status='reserved' does not by itself indicate a lock is held (that
-- lock exists only for the duration of one function call). The only
-- realistic wait is if another session is CURRENTLY executing inside
-- reserve_/finalize_/release_audit_entitlement when this runs -- see
-- 01_preconditions_check.sql section D bis for a best-effort check.
--
-- What this deliberately does NOT do:
--   - Does NOT touch the `source` check constraint. Widening it to allow
--     'free_plan' is purely additive; removing that value again would
--     require every existing 'free_plan' row to be dealt with first.
--     Leaving it in place is harmless and avoids ever needing to choose
--     between failing the rollback and deleting business data.
--   - Does NOT UPDATE or DELETE any row in audit_entitlement_reservations,
--     audits, audit_credit_lots, or usage_events. No business data is
--     touched by this script, full stop.
--   - Does NOT grant or revoke any privilege. CREATE OR REPLACE FUNCTION
--     preserves the existing ACL (ownership and grants) automatically --
--     verified by direct query on a real Postgres instance in Phase 8.1
--     (SECURITY DEFINER and the service_role-only EXECUTE grant survive
--     a body replacement unchanged).

begin;

-- Precondition guard, strict and exact (item 4: refuse any unexpected
-- definition of reserve_audit_entitlement, not just "missing the
-- free_plan marker"). Each function is resolved by its exact
-- schema-qualified signature; the current body is classified by an
-- exact content hash against the three known states computed from the
-- real migration files (see 01_preconditions_check.sql section A for
-- the same hashes with commentary). Anything that does not match one of
-- the known hashes is refused -- including a hypothetical state where
-- someone added or changed logic beyond what either migration file
-- contains, which a loose `ilike '%marker%'` match could miss entirely.
--
-- If this guard fires on reserve_, finalize_ or release_, NOTHING below
-- has executed (everything in this file is one transaction) and no
-- catalog object or row has changed.
do $$
declare
  v_reserve_hash text;
  v_finalize_hash text;
  v_release_hash text;
  v_finalize_is_fixed boolean;
  v_release_is_fixed boolean;
begin
  select md5(pg_get_functiondef(oid)) into v_reserve_hash
  from pg_proc
  where oid = 'public.reserve_audit_entitlement(uuid,uuid,text,text,text,integer,boolean,boolean)'::regprocedure;

  select md5(pg_get_functiondef(oid)) into v_finalize_hash
  from pg_proc
  where oid = 'public.finalize_audit_entitlement(uuid,text,uuid,uuid,uuid,text,text)'::regprocedure;

  select md5(pg_get_functiondef(oid)) into v_release_hash
  from pg_proc
  where oid = 'public.release_audit_entitlement(uuid,text,text)'::regprocedure;

  -- Fail-closed on NULL (explicit `is null`, not relied upon via `<>`/`not in`,
  -- which both yield NULL -- i.e. "falls through as if fine" -- when the
  -- left-hand side is NULL; `is null`/`is distinct from` never do).
  if v_finalize_hash is null
    or v_finalize_hash not in ('02bdf99633e37d13a24625b99f41e5ce', 'b11f6e4e15d7c5af5f2d139323badf1a')
  then
    raise exception
      'Refusing to run: finalize_audit_entitlement definition (md5 %) matches neither the known original nor the fixed state -- investigate before proceeding.', coalesce(v_finalize_hash, 'NULL');
  end if;

  if v_release_hash is null
    or v_release_hash not in ('5652282072cf9211bc995a19d145c9db', 'a93023fe0945933cfe3d8f9210ea885c')
  then
    raise exception
      'Refusing to run: release_audit_entitlement definition (md5 %) matches neither the known original nor the fixed state -- investigate before proceeding.', coalesce(v_release_hash, 'NULL');
  end if;

  v_finalize_is_fixed := (v_finalize_hash = 'b11f6e4e15d7c5af5f2d139323badf1a');
  v_release_is_fixed := (v_release_hash = 'a93023fe0945933cfe3d8f9210ea885c');

  if v_reserve_hash = '5a5425ad46f0f8b8d2bcfd9f44858433' then
    raise exception
      'Refusing to run: reserve_audit_entitlement still matches the original 2026-07-14 definition (md5 %) -- the forward migration 20261115120000 does not appear to be live. Nothing to roll back. This script is not a substitute deployment path; re-run 01_preconditions_check.sql and confirm before proceeding.', v_reserve_hash;
  elsif v_reserve_hash = 'e3d2b891289cc19167bc70e502d8317b' then
    -- "Already rolled back" is only a clean, acceptable no-op state if
    -- finalize_/release_ are ALSO both already in their fixed
    -- (ambiguity-corrected) state -- not merely "one of the two known
    -- states" as the checks above allow on their own. reserve_ looking
    -- rolled back while finalize_/release_ still carry the original
    -- ambiguity bug cannot happen through the normal forward-migration
    -- -> rollback path, so seeing it means something else touched these
    -- functions -- refuse and require manual investigation rather than
    -- silently accepting it as idempotent.
    if not (v_finalize_is_fixed and v_release_is_fixed) then
      raise exception
        'Refusing to run: reserve_audit_entitlement looks already rolled back (md5 %), but finalize_audit_entitlement and/or release_audit_entitlement are not both in their fixed (ambiguity-corrected) state (finalize fixed=%, release fixed=%). This is not a clean already-rolled-back state -- it looks like a partial apply or a manual modification. Investigate before proceeding; do not bypass this guard.', v_reserve_hash, v_finalize_is_fixed, v_release_is_fixed;
    end if;
    raise notice 'reserve_audit_entitlement already matches the post-rollback definition (md5 %), and finalize_/release_ are both already fixed -- re-applying below is a verified no-op.', v_reserve_hash;
  elsif v_reserve_hash is distinct from '55a3852265b0b65ebd18793aa5ba37f2' then
    raise exception
      'Refusing to run: reserve_audit_entitlement definition (md5 %) matches none of the three known states (original / fixed-with-free_plan / rolled-back). This looks like a partial apply or a manual modification -- investigate and resolve by hand before running this script; do not bypass this guard.', coalesce(v_reserve_hash, 'NULL');
  end if;
end
$$;

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

  if p_enforce_free_plan_limit then
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
  end if;

  if not p_billing_admin_bypass then
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
    p_enforce_free_plan_limit,
    allocations
  )
  returning id
  into reservation_id;

  return query
  select reservation_id, p_operation_key, 'reserved', source_value, null::text;
end;
$$;

-- Re-asserted unchanged from 20261115120000 (ambiguity fix only, no
-- free_plan-specific logic ever existed here) -- see this file's header
-- for why it is still included.
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

-- Re-asserted unchanged from 20261115120000, same reason as finalize_ above.
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
