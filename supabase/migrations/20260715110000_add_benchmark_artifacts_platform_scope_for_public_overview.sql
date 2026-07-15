begin;

alter table public.benchmark_artifacts
  add column if not exists platform_scope text not null default 'single_platform';

alter table public.benchmark_artifacts
  drop constraint if exists benchmark_artifacts_platform_check,
  drop constraint if exists benchmark_artifacts_platform_scope_check;

alter table public.benchmark_artifacts
  add constraint benchmark_artifacts_platform_check
    check (
      (platform_scope = 'single_platform' and platform in ('airbnb', 'booking', 'expedia', 'agoda', 'vrbo'))
      or (platform_scope = 'all_platforms' and platform = 'all')
    ),
  add constraint benchmark_artifacts_platform_scope_check
    check (
      platform_scope in (
        'single_platform',
        'all_platforms'
      )
    );

drop index if exists public.benchmark_artifacts_public_market_overview_lookup_idx;

create index if not exists benchmark_artifacts_public_market_overview_lookup_idx
  on public.benchmark_artifacts (
    intended_use,
    country,
    city,
    platform_scope,
    platform,
    property_type,
    currency,
    aggregation_window,
    property_scope,
    capacity_scope,
    capture_period_bucket,
    created_at desc
  )
  where benchmark_type = 'pricing_distribution';

comment on column public.benchmark_artifacts.platform_scope is
  'Platform aggregation semantics for the artifact cohort. Historical artifacts default to single_platform; public market overviews may use all_platforms with platform=all.';

commit;
