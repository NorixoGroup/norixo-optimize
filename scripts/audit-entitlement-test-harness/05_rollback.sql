-- Audit entitlement test harness, step 5/6: rollback of the fix, function
-- body only. Deliberately does NOT touch the `source` check constraint
-- (widening it to include 'free_plan' is purely additive and harmless to
-- leave in place) and does NOT touch any row already created -- this is
-- the "compatible with data already created" rollback required by
-- Phase 7.2/8, not the more fragile "drop the constraint back" version
-- considered and rejected earlier.
--
-- Restores the pre-fix behaviour: every non-admin call requires an
-- audit_credit_lots row again, including a workspace's first free audit.
-- Deliberately NOT verbatim from
-- supabase/migrations/20260714110000_create_audit_entitlement_reservations.sql:
-- that original body has the ambiguous-column bug found in Phase 8 (see
-- the header of 20261115120000_fix_free_plan_audit_entitlement.sql) --
-- reverting the free_plan branch must not resurrect a function that
-- cannot be called at all. The table-alias fix is therefore kept here.

\set ON_ERROR_STOP on

do $$
begin
  if current_database() <> 'norixo_ph8_entitlement_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_ph8_entitlement_test.', current_database();
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
