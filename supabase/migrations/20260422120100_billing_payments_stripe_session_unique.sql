begin;

-- Strong idempotence: one row per Stripe Checkout Session (when session id is set).
create unique index if not exists billing_payments_stripe_checkout_session_id_uniq
  on public.billing_payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- FK workspace_id → workspaces if column exists and no FK yet (safe for uncertain legacy DDL).
do $$
begin
  if to_regclass('public.billing_payments') is null then
    raise notice 'billing_payments table missing; skipping workspace FK';
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'billing_payments'
      and column_name = 'workspace_id'
  ) then
    raise notice 'billing_payments.workspace_id missing; skipping workspace FK';
    return;
  end if;

  if exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'billing_payments'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) like '%workspace_id%references%workspaces%'
  ) then
    raise notice 'billing_payments workspace_id FK already present; skipping';
    return;
  end if;

  alter table public.billing_payments
    add constraint billing_payments_workspace_id_fkey
    foreign key (workspace_id) references public.workspaces(id) on delete cascade;
exception
  when duplicate_object then
    raise notice 'billing_payments workspace_id FK already exists under another name';
  when others then
    raise notice 'billing_payments workspace_id FK not applied: %', sqlerrm;
end;
$$;

commit;
