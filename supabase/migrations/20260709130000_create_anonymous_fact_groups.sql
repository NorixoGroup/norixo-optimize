begin;

create table if not exists public.anonymous_fact_groups (
  id uuid primary key default gen_random_uuid(),
  fact_key text null,
  fact_contract_version text not null check (char_length(trim(fact_contract_version)) > 0),
  country text not null,
  city text not null,
  platform text not null,
  property_type text not null,
  capacity_band text not null,
  currency text not null,
  market_cell_key text not null,
  metric_family text not null,
  normalized_nightly_price numeric(12,2) not null,
  price_band text not null,
  capture_period_bucket text not null,
  source_class text not null,
  confidence_input_band text not null,
  freshness_input_band text not null,
  source_quality_band text not null,
  transformation_policy_version text not null,
  eligibility_policy_version text not null,
  deduplication_policy_version text not null,
  market_cell_policy_version text not null,
  confidence_policy_version text not null,
  freshness_policy_version text not null,
  pricing_normalization_policy_version text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint anonymous_fact_groups_fact_key_check
    check (fact_key is null or char_length(trim(fact_key)) > 0),
  constraint anonymous_fact_groups_country_check
    check (
      char_length(trim(country)) > 0
      and lower(trim(country)) <> 'unknown'
    ),
  constraint anonymous_fact_groups_city_check
    check (
      char_length(trim(city)) > 0
      and lower(trim(city)) <> 'unknown'
    ),
  constraint anonymous_fact_groups_platform_check
    check (platform in ('airbnb', 'booking', 'expedia', 'agoda', 'vrbo')),
  constraint anonymous_fact_groups_property_type_check
    check (
      property_type in (
        'studio',
        'apartment',
        'villa',
        'riad',
        'room',
        'hotel',
        'unknown'
      )
    ),
  constraint anonymous_fact_groups_capacity_band_check
    check (capacity_band in ('unknown', '1_3', '4_6', '7_9', '10_plus')),
  constraint anonymous_fact_groups_currency_check
    check (
      currency ~ '^[A-Z]{3}$'
      and currency <> 'UNKNOWN'
    ),
  constraint anonymous_fact_groups_market_cell_key_check
    check (char_length(trim(market_cell_key)) > 0),
  constraint anonymous_fact_groups_metric_family_check
    check (metric_family = 'pricing'),
  constraint anonymous_fact_groups_normalized_nightly_price_check
    check (normalized_nightly_price > 0),
  constraint anonymous_fact_groups_price_band_check
    check (price_band = 'unclassified'),
  constraint anonymous_fact_groups_capture_period_bucket_check
    check (capture_period_bucket ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint anonymous_fact_groups_source_class_check
    check (source_class in ('authenticated_audit', 'authenticated_listing')),
  constraint anonymous_fact_groups_confidence_input_band_check
    check (confidence_input_band in ('unknown', 'low', 'moderate', 'high')),
  constraint anonymous_fact_groups_freshness_input_band_check
    check (freshness_input_band in ('unknown', 'fresh', 'recent', 'aging', 'stale')),
  constraint anonymous_fact_groups_source_quality_band_check
    check (source_quality_band in ('unknown', 'low', 'moderate', 'high')),
  constraint anonymous_fact_groups_transformation_policy_version_check
    check (char_length(trim(transformation_policy_version)) > 0),
  constraint anonymous_fact_groups_eligibility_policy_version_check
    check (char_length(trim(eligibility_policy_version)) > 0),
  constraint anonymous_fact_groups_deduplication_policy_version_check
    check (char_length(trim(deduplication_policy_version)) > 0),
  constraint anonymous_fact_groups_market_cell_policy_version_check
    check (char_length(trim(market_cell_policy_version)) > 0),
  constraint anonymous_fact_groups_confidence_policy_version_check
    check (char_length(trim(confidence_policy_version)) > 0),
  constraint anonymous_fact_groups_freshness_policy_version_check
    check (char_length(trim(freshness_policy_version)) > 0),
  constraint anonymous_fact_groups_pricing_normalization_policy_version_check
    check (char_length(trim(pricing_normalization_policy_version)) > 0)
);

create index if not exists anonymous_fact_groups_market_cell_capture_period_idx
  on public.anonymous_fact_groups (
    market_cell_key,
    capture_period_bucket
  );

alter table public.anonymous_fact_groups enable row level security;

comment on table public.anonymous_fact_groups is
  'Shared internal anonymous pricing facts; server-side only. Each row is a normalized fact, not a benchmark aggregate.';

comment on column public.anonymous_fact_groups.fact_key is
  'Reserved for an opaque non-reversible identity defined by the Patch 2B writer; nullable and non-unique in Patch 2A.';

comment on column public.anonymous_fact_groups.market_cell_key is
  'Canonical anonymous Market Cell V1 key; contains no private identifier.';

commit;
