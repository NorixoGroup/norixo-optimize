begin;

create table if not exists public.audit_credit_lots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text not null check (char_length(trim(source_type)) > 0),
  source_ref text not null check (char_length(trim(source_ref)) > 0),
  plan_code text,
  granted_quantity integer not null check (granted_quantity >= 0),
  consumed_quantity integer not null default 0 check (
    consumed_quantity >= 0
    and consumed_quantity <= granted_quantity
  ),
  expires_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint audit_credit_lots_workspace_source_unique
    unique (workspace_id, source_type, source_ref)
);

create index if not exists audit_credit_lots_workspace_created_idx
  on public.audit_credit_lots (workspace_id, created_at desc);

create index if not exists audit_credit_lots_workspace_period_idx
  on public.audit_credit_lots (
    workspace_id,
    period_start desc nulls last,
    period_end desc nulls last
  );

create index if not exists audit_credit_lots_workspace_open_fifo_idx
  on public.audit_credit_lots (workspace_id, expires_at asc nulls first, created_at asc)
  where consumed_quantity < granted_quantity;

create index if not exists audit_credit_lots_workspace_source_idx
  on public.audit_credit_lots (workspace_id, source_type, source_ref);

create or replace function public.set_audit_credit_lots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_audit_credit_lots_updated_at on public.audit_credit_lots;

create trigger trg_audit_credit_lots_updated_at
before update on public.audit_credit_lots
for each row
execute function public.set_audit_credit_lots_updated_at();

commit;
