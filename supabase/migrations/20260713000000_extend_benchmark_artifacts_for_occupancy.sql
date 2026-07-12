begin;

alter table public.benchmark_artifacts
  drop constraint if exists benchmark_artifacts_benchmark_type_check,
  drop constraint if exists benchmark_artifacts_currency_check,
  drop constraint if exists benchmark_artifacts_distribution_positive_check,
  drop constraint if exists benchmark_artifacts_distribution_order_check;

alter table public.benchmark_artifacts
  alter column p10_price drop not null,
  alter column p25_price drop not null,
  alter column median_price drop not null,
  alter column p75_price drop not null,
  alter column p90_price drop not null,

  add column if not exists observed_days_1_6_count integer null,
  add column if not exists observed_days_7_13_count integer null,
  add column if not exists observed_days_14_29_count integer null,
  add column if not exists observed_days_30_59_count integer null,
  add column if not exists observed_days_60_plus_count integer null,

  add column if not exists unavailability_0_19_count integer null,
  add column if not exists unavailability_20_39_count integer null,
  add column if not exists unavailability_40_59_count integer null,
  add column if not exists unavailability_60_79_count integer null,
  add column if not exists unavailability_80_100_count integer null,

  add column if not exists dominant_observed_days_band text null,
  add column if not exists dominant_unavailability_rate_band text null;

alter table public.benchmark_artifacts
  add constraint benchmark_artifacts_benchmark_type_check
    check (
      benchmark_type in (
        'pricing_distribution',
        'occupancy_distribution'
      )
    ),

  add constraint benchmark_artifacts_currency_check
    check (
      (
        benchmark_type = 'pricing_distribution'
        and currency ~ '^[A-Z]{3}$'
        and currency <> 'UNKNOWN'
      )
      or (
        benchmark_type = 'occupancy_distribution'
        and currency = 'UNKNOWN'
      )
    ),

  add constraint benchmark_artifacts_pricing_distribution_check
    check (
      benchmark_type <> 'pricing_distribution'
      or (
        p10_price is not null
        and p25_price is not null
        and median_price is not null
        and p75_price is not null
        and p90_price is not null

        and p10_price > 0
        and p25_price > 0
        and median_price > 0
        and p75_price > 0
        and p90_price > 0

        and p10_price <= p25_price
        and p25_price <= median_price
        and median_price <= p75_price
        and p75_price <= p90_price

        and observed_days_1_6_count is null
        and observed_days_7_13_count is null
        and observed_days_14_29_count is null
        and observed_days_30_59_count is null
        and observed_days_60_plus_count is null

        and unavailability_0_19_count is null
        and unavailability_20_39_count is null
        and unavailability_40_59_count is null
        and unavailability_60_79_count is null
        and unavailability_80_100_count is null

        and dominant_observed_days_band is null
        and dominant_unavailability_rate_band is null
      )
    ),

  add constraint benchmark_artifacts_occupancy_distribution_check
    check (
      benchmark_type <> 'occupancy_distribution'
      or (
        p10_price is null
        and p25_price is null
        and median_price is null
        and p75_price is null
        and p90_price is null

        and observed_days_1_6_count is not null
        and observed_days_7_13_count is not null
        and observed_days_14_29_count is not null
        and observed_days_30_59_count is not null
        and observed_days_60_plus_count is not null

        and unavailability_0_19_count is not null
        and unavailability_20_39_count is not null
        and unavailability_40_59_count is not null
        and unavailability_60_79_count is not null
        and unavailability_80_100_count is not null

        and observed_days_1_6_count >= 0
        and observed_days_7_13_count >= 0
        and observed_days_14_29_count >= 0
        and observed_days_30_59_count >= 0
        and observed_days_60_plus_count >= 0

        and unavailability_0_19_count >= 0
        and unavailability_20_39_count >= 0
        and unavailability_40_59_count >= 0
        and unavailability_60_79_count >= 0
        and unavailability_80_100_count >= 0

        and (
          observed_days_1_6_count
          + observed_days_7_13_count
          + observed_days_14_29_count
          + observed_days_30_59_count
          + observed_days_60_plus_count
        ) = included_sample_size

        and (
          unavailability_0_19_count
          + unavailability_20_39_count
          + unavailability_40_59_count
          + unavailability_60_79_count
          + unavailability_80_100_count
        ) = included_sample_size

        and dominant_observed_days_band in (
          '1_6',
          '7_13',
          '14_29',
          '30_59',
          '60_plus'
        )

        and dominant_unavailability_rate_band in (
          '0_19',
          '20_39',
          '40_59',
          '60_79',
          '80_100'
        )
      )
    );

comment on table public.benchmark_artifacts is
  'Shared internal benchmark artifacts; server-side only. Each row is an aggregated pricing or occupancy distribution, never an individual fact or private customer record.';

comment on column public.benchmark_artifacts.observed_days_1_6_count is
  'Number of included occupancy facts in the observed-days band 1_6.';

comment on column public.benchmark_artifacts.dominant_observed_days_band is
  'Most represented privacy-safe observed-days band in an occupancy benchmark.';

comment on column public.benchmark_artifacts.dominant_unavailability_rate_band is
  'Most represented privacy-safe unavailability-rate band in an occupancy benchmark.';

commit;
