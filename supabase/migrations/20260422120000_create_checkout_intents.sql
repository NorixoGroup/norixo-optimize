begin;

create table if not exists public.checkout_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  plan_code text not null,
  price_id text not null,
  currency text not null default 'eur',
  status text not null default 'pending',
  stripe_checkout_session_id text,
  stripe_customer_id text,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint checkout_intents_plan_code_check
    check (plan_code in ('audit_test', 'pro', 'scale')),
  constraint checkout_intents_status_check
    check (char_length(trim(status)) > 0)
);

create index if not exists checkout_intents_workspace_id_idx
  on public.checkout_intents (workspace_id);

create index if not exists checkout_intents_status_idx
  on public.checkout_intents (status);

create unique index if not exists checkout_intents_stripe_session_id_uniq
  on public.checkout_intents (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create or replace function public.set_checkout_intents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_checkout_intents_updated_at on public.checkout_intents;

create trigger trg_checkout_intents_updated_at
before update on public.checkout_intents
for each row
execute function public.set_checkout_intents_updated_at();

alter table public.checkout_intents enable row level security;

comment on table public.checkout_intents is
  'Server-side checkout intent; written via service role only. No client policies in Phase 1.';

commit;
