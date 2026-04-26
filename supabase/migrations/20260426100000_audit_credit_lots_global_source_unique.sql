begin;

-- Idempotence globale par session Stripe : une même (source_type, source_ref) ne peut
-- exister qu’une fois, quel que soit le workspace (cs_… est unique côté Stripe).
alter table public.audit_credit_lots
  drop constraint if exists audit_credit_lots_workspace_source_unique;

create unique index if not exists audit_credit_lots_source_type_source_ref_unique
  on public.audit_credit_lots (source_type, source_ref);

commit;
