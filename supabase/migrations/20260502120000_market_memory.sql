begin;

-- Market Memory : snapshots de recherche + comparables extraits (append-only, pas de remplacement du pipeline live).

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  platform text not null default '',
  city text,
  country text,
  property_type text,
  check_in date,
  check_out date,
  nights integer,
  source_url text,
  query_signature text,
  comparable_count integer not null default 0,
  confidence_score numeric,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.market_comparables (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.market_snapshots (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  platform text not null default '',
  url text,
  title text,
  city text,
  country text,
  property_type text,
  nightly_price numeric,
  total_price numeric,
  currency text,
  rating numeric,
  review_count integer,
  latitude numeric,
  longitude numeric,
  check_in date,
  check_out date,
  nights integer,
  raw jsonb not null default '{}'::jsonb,
  normalized_signature text
);

create index if not exists market_snapshots_platform_idx on public.market_snapshots (platform);

create index if not exists market_snapshots_city_idx on public.market_snapshots (city);

create index if not exists market_snapshots_country_idx on public.market_snapshots (country);

create index if not exists market_snapshots_property_type_idx on public.market_snapshots (property_type);

create index if not exists market_snapshots_created_at_idx on public.market_snapshots (created_at desc);

create index if not exists market_snapshots_query_signature_idx on public.market_snapshots (query_signature);

create index if not exists market_comparables_snapshot_id_idx on public.market_comparables (snapshot_id);

create index if not exists market_comparables_platform_idx on public.market_comparables (platform);

create index if not exists market_comparables_city_idx on public.market_comparables (city);

create index if not exists market_comparables_property_type_idx on public.market_comparables (property_type);

create index if not exists market_comparables_created_at_idx on public.market_comparables (created_at desc);

create index if not exists market_comparables_url_idx on public.market_comparables (url)
  where url is not null and length(trim(url)) > 0;

create index if not exists market_comparables_normalized_signature_idx on public.market_comparables (normalized_signature)
  where normalized_signature is not null and length(trim(normalized_signature)) > 0;

alter table public.market_snapshots enable row level security;

alter table public.market_comparables enable row level security;

commit;
