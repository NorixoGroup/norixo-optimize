begin;

create table if not exists public.benchmark_artifacts (
  id uuid primary key default gen_random_uuid(),
  artifact_key text null,
  artifact_contract_version text not null,
  benchmark_type text not null,
  approval_status text not null,
  country text not null,
  city text not null,
  platform text not null,
  property_type text not null,
  capacity_band text not null,
  currency text not null,
  market_cell_key text not null,
  capture_period_bucket text not null,
  source_period_start date not null,
  source_period_end date not null,
  cohort_definition_version text not null,
  source_class_count integer not null,
  source_diversity_band text not null,
  p10_price numeric(12,2) not null,
  p25_price numeric(12,2) not null,
  median_price numeric(12,2) not null,
  p75_price numeric(12,2) not null,
  p90_price numeric(12,2) not null,
  raw_sample_size integer not null,
  included_sample_size integer not null,
  excluded_outlier_count integer not null,
  outlier_policy_version text not null,
  confidence_level text not null,
  confidence_policy_version text not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  freshness_policy_version text not null,
  approved_for_internal boolean not null default false,
  approved_for_audit boolean not null default false,
  limitations text[] not null default '{}'::text[],
  cohort_policy_version text not null,
  aggregation_policy_version text not null,
  approval_policy_version text not null,
  market_cell_policy_version text not null,
  supersedes_artifact_id uuid null references public.benchmark_artifacts(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint benchmark_artifacts_artifact_key_check
    check (artifact_key is null or char_length(trim(artifact_key)) > 0),
  constraint benchmark_artifacts_artifact_contract_version_check
    check (char_length(trim(artifact_contract_version)) > 0),
  constraint benchmark_artifacts_benchmark_type_check
    check (benchmark_type = 'pricing_distribution'),
  constraint benchmark_artifacts_approval_status_check
    check (
      approval_status in (
        'draft',
        'insufficient',
        'exploratory',
        'internal_approved',
        'audit_approved',
        'revoked'
      )
    ),
  constraint benchmark_artifacts_country_check
    check (
      char_length(trim(country)) > 0
      and lower(trim(country)) <> 'unknown'
    ),
  constraint benchmark_artifacts_city_check
    check (
      char_length(trim(city)) > 0
      and lower(trim(city)) <> 'unknown'
    ),
  constraint benchmark_artifacts_platform_check
    check (platform in ('airbnb', 'booking', 'expedia', 'agoda', 'vrbo')),
  constraint benchmark_artifacts_property_type_check
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
  constraint benchmark_artifacts_capacity_band_check
    check (capacity_band in ('unknown', '1_3', '4_6', '7_9', '10_plus')),
  constraint benchmark_artifacts_currency_check
    check (
      currency ~ '^[A-Z]{3}$'
      and currency <> 'UNKNOWN'
    ),
  constraint benchmark_artifacts_market_cell_key_check
    check (char_length(trim(market_cell_key)) > 0),
  constraint benchmark_artifacts_capture_period_bucket_check
    check (capture_period_bucket ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint benchmark_artifacts_source_period_check
    check (source_period_end >= source_period_start),
  constraint benchmark_artifacts_cohort_definition_version_check
    check (char_length(trim(cohort_definition_version)) > 0),
  constraint benchmark_artifacts_source_class_count_check
    check (source_class_count >= 0),
  constraint benchmark_artifacts_source_diversity_band_check
    check (source_diversity_band in ('unknown', 'low', 'moderate', 'high')),
  constraint benchmark_artifacts_distribution_positive_check
    check (
      p10_price > 0
      and p25_price > 0
      and median_price > 0
      and p75_price > 0
      and p90_price > 0
    ),
  constraint benchmark_artifacts_distribution_order_check
    check (
      p10_price <= p25_price
      and p25_price <= median_price
      and median_price <= p75_price
      and p75_price <= p90_price
    ),
  constraint benchmark_artifacts_sample_size_check
    check (
      raw_sample_size >= 0
      and included_sample_size >= 0
      and excluded_outlier_count >= 0
      and included_sample_size <= raw_sample_size
      and excluded_outlier_count <= raw_sample_size
    ),
  constraint benchmark_artifacts_outlier_policy_version_check
    check (char_length(trim(outlier_policy_version)) > 0),
  constraint benchmark_artifacts_confidence_level_check
    check (confidence_level in ('very_low', 'low', 'moderate', 'high', 'very_high')),
  constraint benchmark_artifacts_confidence_policy_version_check
    check (char_length(trim(confidence_policy_version)) > 0),
  constraint benchmark_artifacts_validity_window_check
    check (valid_until > valid_from),
  constraint benchmark_artifacts_freshness_policy_version_check
    check (char_length(trim(freshness_policy_version)) > 0),
  constraint benchmark_artifacts_approved_uses_check
    check (
      (approval_status <> 'internal_approved' or approved_for_internal = true)
      and (
        approval_status <> 'audit_approved'
        or (approved_for_internal = true and approved_for_audit = true)
      )
      and (
        approval_status not in ('draft', 'insufficient', 'exploratory', 'revoked')
        or approved_for_audit = false
      )
    ),
  constraint benchmark_artifacts_limitations_check
    check (
      array_position(limitations, null) is null
      and limitations <@ array[
        'small_sample',
        'broad_fallback',
        'low_source_diversity',
        'aging_data',
        'unknown_property_type',
        'unknown_capacity'
      ]::text[]
    ),
  constraint benchmark_artifacts_cohort_policy_version_check
    check (char_length(trim(cohort_policy_version)) > 0),
  constraint benchmark_artifacts_aggregation_policy_version_check
    check (char_length(trim(aggregation_policy_version)) > 0),
  constraint benchmark_artifacts_approval_policy_version_check
    check (char_length(trim(approval_policy_version)) > 0),
  constraint benchmark_artifacts_market_cell_policy_version_check
    check (char_length(trim(market_cell_policy_version)) > 0),
  constraint benchmark_artifacts_supersedes_self_check
    check (supersedes_artifact_id is null or supersedes_artifact_id <> id)
);

create index if not exists benchmark_artifacts_lookup_idx
  on public.benchmark_artifacts (
    benchmark_type,
    market_cell_key,
    capture_period_bucket,
    approval_status,
    valid_until desc
  );

create index if not exists benchmark_artifacts_supersedes_idx
  on public.benchmark_artifacts (supersedes_artifact_id)
  where supersedes_artifact_id is not null;

alter table public.benchmark_artifacts enable row level security;

comment on table public.benchmark_artifacts is
  'Shared internal benchmark artifacts; server-side only. Each row is an aggregated pricing distribution benchmark, never an individual fact or private customer record.';

comment on column public.benchmark_artifacts.artifact_key is
  'Reserved for the canonical benchmark identity defined by the future builder; nullable and non-unique in Patch 3A.';

comment on column public.benchmark_artifacts.limitations is
  'Controlled machine-readable limitation codes only; no free text or private source data.';

comment on column public.benchmark_artifacts.supersedes_artifact_id is
  'Optional reference to the prior artifact replaced by this append-only benchmark artifact.';

commit;
