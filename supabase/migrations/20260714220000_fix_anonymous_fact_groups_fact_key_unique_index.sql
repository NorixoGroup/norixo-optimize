begin;

drop index if exists public.anonymous_fact_groups_fact_key_unique_idx;

create unique index if not exists
  anonymous_fact_groups_fact_key_unique_idx
on public.anonymous_fact_groups (fact_key);

comment on index public.anonymous_fact_groups_fact_key_unique_idx is
  'Ensures atomic idempotent insertion of opaque non-reversible fact identities when fact_key is present; standard PostgreSQL unique indexes still allow multiple NULL values.';

commit;
