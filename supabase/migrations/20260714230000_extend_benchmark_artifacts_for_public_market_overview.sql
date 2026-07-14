begin;

alter table public.benchmark_artifacts
  add column if not exists intended_use text not null default 'private_audit',
  add column if not exists aggregation_window text not null default 'monthly_exact',
  add column if not exists capacity_scope text not null default 'exact_band',
  add column if not exists property_scope text not null default 'exact';

alter table public.benchmark_artifacts
  drop constraint if exists benchmark_artifacts_intended_use_check,
  drop constraint if exists benchmark_artifacts_aggregation_window_check,
  drop constraint if exists benchmark_artifacts_capacity_scope_check,
  drop constraint if exists benchmark_artifacts_property_scope_check;

alter table public.benchmark_artifacts
  add constraint benchmark_artifacts_intended_use_check
    check (
      intended_use in (
        'private_audit',
        'public_market_overview'
      )
    ),
  add constraint benchmark_artifacts_aggregation_window_check
    check (
      aggregation_window in (
        'monthly_exact',
        'rolling_90_days'
      )
    ),
  add constraint benchmark_artifacts_capacity_scope_check
    check (
      capacity_scope in (
        'exact_band',
        'all_capacities'
      )
    ),
  add constraint benchmark_artifacts_property_scope_check
    check (
      property_scope in (
        'exact',
        'broader_market'
      )
    );

create index if not exists benchmark_artifacts_public_market_overview_lookup_idx
  on public.benchmark_artifacts (
    intended_use,
    country,
    city,
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

comment on column public.benchmark_artifacts.intended_use is
  'Server-side artifact usage scope. Historical artifacts default to private_audit; future public market overviews use public_market_overview.';

comment on column public.benchmark_artifacts.aggregation_window is
  'Aggregation time window semantics. Historical pricing artifacts default to monthly_exact; public market overviews may use rolling_90_days.';

comment on column public.benchmark_artifacts.capacity_scope is
  'Capacity semantics for the artifact cohort. exact_band preserves the existing private behavior; all_capacities is reserved for future public market overviews.';

comment on column public.benchmark_artifacts.property_scope is
  'Property-type resolution semantics for the artifact cohort. exact preserves the existing private behavior; broader_market is reserved for future public fallbacks.';

comment on index public.benchmark_artifacts_public_market_overview_lookup_idx is
  'Supports future server-side selection of public_market_overview pricing artifacts without exposing benchmark_artifacts directly to clients.';

commit;
