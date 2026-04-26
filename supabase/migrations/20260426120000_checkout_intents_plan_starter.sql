begin;

alter table public.checkout_intents
  drop constraint if exists checkout_intents_plan_code_check;

alter table public.checkout_intents
  add constraint checkout_intents_plan_code_check
  check (plan_code in ('audit_test', 'pro', 'scale', 'starter'));

commit;
