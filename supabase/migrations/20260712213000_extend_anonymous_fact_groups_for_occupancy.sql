begin;

alter table public.anonymous_fact_groups
  drop constraint if exists anonymous_fact_groups_currency_check,
  drop constraint if exists anonymous_fact_groups_metric_family_check,
  drop constraint if exists anonymous_fact_groups_normalized_nightly_price_check,
  drop constraint if exists anonymous_fact_groups_price_band_check,
  drop constraint if exists anonymous_fact_groups_pricing_normalization_policy_version_check;

alter table public.anonymous_fact_groups
  alter column normalized_nightly_price drop not null,
  alter column price_band drop not null,
  alter column pricing_normalization_policy_version drop not null,
  add column if not exists observed_days_band text null,
  add column if not exists unavailability_rate_band text null;

alter table public.anonymous_fact_groups
  add constraint anonymous_fact_groups_metric_family_check
    check (metric_family in ('pricing', 'occupancy')),

  add constraint anonymous_fact_groups_currency_check
    check (
      (
        metric_family = 'pricing'
        and currency ~ '^[A-Z]{3}$'
        and currency <> 'UNKNOWN'
      )
      or (
        metric_family = 'occupancy'
        and currency = 'UNKNOWN'
      )
    ),

  add constraint anonymous_fact_groups_pricing_payload_check
    check (
      metric_family <> 'pricing'
      or (
        normalized_nightly_price is not null
        and normalized_nightly_price > 0
        and price_band = 'unclassified'
        and pricing_normalization_policy_version is not null
        and char_length(
          trim(pricing_normalization_policy_version)
        ) > 0
        and observed_days_band is null
        and unavailability_rate_band is null
      )
    ),

  add constraint anonymous_fact_groups_occupancy_payload_check
    check (
      metric_family <> 'occupancy'
      or (
        normalized_nightly_price is null
        and price_band is null
        and pricing_normalization_policy_version is null
        and observed_days_band in (
          '1_6',
          '7_13',
          '14_29',
          '30_59',
          '60_plus'
        )
        and unavailability_rate_band in (
          '0_19',
          '20_39',
          '40_59',
          '60_79',
          '80_100'
        )
      )
    );

create index if not exists
  anonymous_fact_groups_metric_market_cell_period_idx
  on public.anonymous_fact_groups (
    metric_family,
    market_cell_key,
    capture_period_bucket
  );

comment on table public.anonymous_fact_groups is
  'Shared internal anonymous metric facts; server-side only. Each row is a normalized fact, not a benchmark aggregate.';

comment on column public.anonymous_fact_groups.observed_days_band is
  'Privacy-safe observed calendar window band for occupancy facts; null for pricing facts.';

comment on column public.anonymous_fact_groups.unavailability_rate_band is
  'Privacy-safe unavailability percentage band for occupancy facts; null for pricing facts.';

commit;
