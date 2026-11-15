-- Audit entitlement test harness, step 2/6: the schema state the real
-- migrations expect to find, i.e. the repo's state immediately BEFORE
--   supabase/migrations/20260412190000_create_audit_credit_lots.sql
--   supabase/migrations/20260714110000_create_audit_entitlement_reservations.sql
--   supabase/migrations/20260714120000_link_audits_to_entitlement_reservations.sql
--   supabase/migrations/20261115120000_fix_free_plan_audit_entitlement.sql
-- are applied (run_all.sh applies these four real files, unmodified, on
-- top of this bootstrap).
--
-- public.workspaces, public.subscriptions, public.audits and
-- public.listings are NOT defined in any local migration (they predate
-- this repo's migrations folder, confirmed in Phases 7.2/8 by grepping
-- supabase/migrations/ for their CREATE TABLE and finding none). The
-- columns below are reconstructed from types/database.types.ts and from
-- lib/billing/ensureWorkspaceSubscription.ts -- this is an approximation
-- of the real DDL, not a copy of it. In particular: no RLS policies are
-- reproduced here (out of scope for this harness -- it tests the
-- reserve/finalize/release SQL functions directly, as a superuser
-- connection that bypasses RLS entirely, same as the real functions do
-- via SECURITY DEFINER).
--
-- Safe to re-run (every object uses IF NOT EXISTS).

do $$
begin
  if current_database() <> 'norixo_ph8_entitlement_test' then
    raise exception 'Refusing to run: connected to % instead of norixo_ph8_entitlement_test.', current_database();
  end if;
end
$$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  slug text,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  plan_code text,
  status text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  source_url text,
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete set null,
  created_at timestamptz default timezone('utc', now()),
  market_score numeric,
  overall_score numeric,
  potential_score numeric,
  listing_quality_index numeric,
  booking_lift_high numeric,
  booking_lift_low numeric,
  revenue_impact_high numeric,
  revenue_impact_low numeric,
  result_payload jsonb
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  event_type text,
  quantity integer,
  metadata jsonb,
  created_at timestamptz default timezone('utc', now())
);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on
  public.workspaces, public.subscriptions, public.listings, public.audits, public.usage_events
  to service_role;
