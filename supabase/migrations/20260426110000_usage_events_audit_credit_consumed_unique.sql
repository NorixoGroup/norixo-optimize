begin;

-- Un même audit ne peut déclencher qu’un seul événement « crédit consommé » (anti double traitement).
create unique index if not exists usage_events_audit_credit_consumed_one_per_audit
  on public.usage_events (workspace_id, ((metadata->>'audit_id')))
  where event_type = 'audit_credit_consumed'
    and coalesce(metadata->>'audit_id', '') <> '';

commit;
