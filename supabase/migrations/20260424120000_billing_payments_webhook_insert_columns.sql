begin;

-- Align billing_payments with insertBillingPayment() in app/api/stripe/webhook/route.ts
-- (payload keys: workspace_id, stripe_*, source, payment_type, plan_code, amount, currency, status, paid_at, metadata).
-- Idempotent ADD COLUMN only; no data changes.

alter table public.billing_payments
  add column if not exists stripe_customer_id text;

alter table public.billing_payments
  add column if not exists stripe_subscription_id text;

alter table public.billing_payments
  add column if not exists stripe_invoice_id text;

alter table public.billing_payments
  add column if not exists stripe_payment_intent_id text;

alter table public.billing_payments
  add column if not exists stripe_checkout_session_id text;

alter table public.billing_payments
  add column if not exists source text;

alter table public.billing_payments
  add column if not exists payment_type text;

alter table public.billing_payments
  add column if not exists plan_code text;

alter table public.billing_payments
  add column if not exists amount numeric;

alter table public.billing_payments
  add column if not exists currency text;

alter table public.billing_payments
  add column if not exists status text;

alter table public.billing_payments
  add column if not exists paid_at timestamptz;

alter table public.billing_payments
  add column if not exists metadata jsonb not null default '{}'::jsonb;

commit;
