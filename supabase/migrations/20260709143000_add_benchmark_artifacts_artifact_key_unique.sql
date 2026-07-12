begin;

create unique index if not exists
  benchmark_artifacts_artifact_key_unique_idx
on public.benchmark_artifacts (artifact_key)
where artifact_key is not null;

comment on index public.benchmark_artifacts_artifact_key_unique_idx is
'Ensures idempotent insertion of content-addressed benchmark artifacts when artifact_key is present.';

commit;