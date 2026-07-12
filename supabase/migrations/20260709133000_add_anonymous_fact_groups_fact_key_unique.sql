begin;

create unique index if not exists
  anonymous_fact_groups_fact_key_unique_idx
on public.anonymous_fact_groups (fact_key)
where fact_key is not null;

comment on index public.anonymous_fact_groups_fact_key_unique_idx is
  'Ensures idempotent insertion of opaque non-reversible fact identities when fact_key is present.';

commit;
