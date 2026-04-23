begin;

-- Align existing checkout_intents (prod) with Phase 1 code in:
-- app/api/stripe/checkout/route.ts (insert/update metadata, expires_at, …)
-- app/api/stripe/webhook/route.ts (update completed_at, status, stripe_customer_id)
-- Idempotent: only ADD COLUMN IF NOT EXISTS; no data rewrite.

alter table public.checkout_intents
  add column if not exists completed_at timestamptz;

alter table public.checkout_intents
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.checkout_intents
  add column if not exists expires_at timestamptz;

comment on column public.checkout_intents.completed_at is
  'Timestamp when the intent is marked completed (Stripe webhook success).';

commit;
