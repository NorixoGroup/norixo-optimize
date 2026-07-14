begin;

create table if not exists public.audit_entitlement_reservations (
  id uuid primary key default gen_random_uuid(),
  operation_key text not null unique check (char_length(trim(operation_key)) > 0),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  target_kind text not null check (target_kind in ('listing_id', 'source_url')),
  target_ref text not null check (char_length(trim(target_ref)) > 0),
  source text not null check (source in ('credit', 'admin')),
  status text not null check (status in ('reserved', 'consumed', 'released')),
  quantity integer not null default 1 check (quantity > 0),
  free_plan_gate boolean not null default false,
  credit_allocations jsonb not null default '[]'::jsonb,
  audit_id uuid references public.audits(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  failure_code text,
  finalized_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint audit_entitlement_reservations_credit_allocations_array
    check (jsonb_typeof(credit_allocations) = 'array')
);

alter table public.audit_entitlement_reservations enable row level security;

create unique index if not exists audit_entitlement_reservations_active_target_unique
  on public.audit_entitlement_reservations (workspace_id, target_kind, target_ref)
  where status = 'reserved';

create index if not exists audit_entitlement_reservations_workspace_status_idx
  on public.audit_entitlement_reservations (workspace_id, status, created_at desc);

create index if not exists audit_entitlement_reservations_workspace_operation_idx
  on public.audit_entitlement_reservations (workspace_id, operation_key);

create or replace function public.set_audit_entitlement_reservations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_audit_entitlement_reservations_updated_at
on public.audit_entitlement_reservations;

create trigger trg_audit_entitlement_reservations_updated_at
before update on public.audit_entitlement_reservations
for each row
execute function public.set_audit_entitlement_reservations_updated_at();

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

  select *
  into existing_reservation
  from public.audit_entitlement_reservations
  where operation_key = p_operation_key
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

  select *
  into conflicting_reservation
  from public.audit_entitlement_reservations
  where workspace_id = p_workspace_id
    and target_kind = p_target_kind
    and target_ref = p_target_ref
    and status = 'reserved'
  order by created_at desc
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
        from public.audit_entitlement_reservations
        where workspace_id = p_workspace_id
          and free_plan_gate = true
          and status = 'reserved'
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

  select *
  into existing_reservation
  from public.audit_entitlement_reservations
  where workspace_id = p_workspace_id
    and operation_key = p_operation_key
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

  select *
  into existing_reservation
  from public.audit_entitlement_reservations
  where workspace_id = p_workspace_id
    and operation_key = p_operation_key
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

revoke all on table public.audit_entitlement_reservations from public;
revoke all on table public.audit_entitlement_reservations from anon;
revoke all on table public.audit_entitlement_reservations from authenticated;

revoke all on function public.reserve_audit_entitlement(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  boolean,
  boolean
) from public;
revoke all on function public.reserve_audit_entitlement(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  boolean,
  boolean
) from anon;
revoke all on function public.reserve_audit_entitlement(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  boolean,
  boolean
) from authenticated;
grant execute on function public.reserve_audit_entitlement(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  boolean,
  boolean
) to service_role;

revoke all on function public.finalize_audit_entitlement(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text
) from public;
revoke all on function public.finalize_audit_entitlement(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text
) from anon;
revoke all on function public.finalize_audit_entitlement(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text
) from authenticated;
grant execute on function public.finalize_audit_entitlement(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text
) to service_role;

revoke all on function public.release_audit_entitlement(
  uuid,
  text,
  text
) from public;
revoke all on function public.release_audit_entitlement(
  uuid,
  text,
  text
) from anon;
revoke all on function public.release_audit_entitlement(
  uuid,
  text,
  text
) from authenticated;
grant execute on function public.release_audit_entitlement(
  uuid,
  text,
  text
) to service_role;

commit;
