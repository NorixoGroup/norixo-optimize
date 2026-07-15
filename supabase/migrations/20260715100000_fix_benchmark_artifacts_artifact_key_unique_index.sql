begin;

drop index if exists public.benchmark_artifacts_artifact_key_unique_idx;

create unique index benchmark_artifacts_artifact_key_unique_idx
on public.benchmark_artifacts (artifact_key);

comment on index public.benchmark_artifacts_artifact_key_unique_idx is
'Ensures atomic idempotent insertion of content-addressed benchmark artifacts on artifact_key while preserving nullable artifact_key rows.';

commit;
