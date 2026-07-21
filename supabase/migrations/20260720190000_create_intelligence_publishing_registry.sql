begin;

create table if not exists public.intelligence_publishing_assets (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null unique,
  canonical_id text not null,
  asset_type text not null,
  status text not null,
  visibility text not null,
  default_locale text not null,
  available_locales text[] not null default '{}'::text[],
  available_channels text[] not null default '{}'::text[],
  active_version_key text null,
  template_id text null,
  owner_team text not null,
  confidence_affects_visible_content boolean not null default false,
  policy_change_affects_visible_content boolean not null default false,
  freshness_expiry_behavior text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint intelligence_publishing_assets_asset_key_check
    check (char_length(trim(asset_key)) > 0),
  constraint intelligence_publishing_assets_canonical_id_check
    check (char_length(trim(canonical_id)) > 0),
  constraint intelligence_publishing_assets_asset_type_check
    check (
      asset_type in (
        'market_report',
        'ranking',
        'guide',
        'article',
        'tool',
        'insight_card',
        'newsletter',
        'social_post',
        'press_asset',
        'video_script',
        'podcast_script',
        'other'
      )
    ),
  constraint intelligence_publishing_assets_status_check
    check (
      status in (
        'draft',
        'generated',
        'pending_review',
        'approved',
        'scheduled',
        'published',
        'deprecated',
        'archived',
        'suppressed'
      )
    ),
  constraint intelligence_publishing_assets_visibility_check
    check (visibility in ('private', 'internal', 'partner', 'public')),
  constraint intelligence_publishing_assets_default_locale_check
    check (char_length(trim(default_locale)) > 0),
  constraint intelligence_publishing_assets_available_locales_check
    check (
      cardinality(available_locales) >= 1
      and array_position(available_locales, null) is null
      and default_locale = any (available_locales)
    ),
  constraint intelligence_publishing_assets_available_channels_check
    check (
      cardinality(available_channels) >= 1
      and array_position(available_channels, null) is null
    ),
  constraint intelligence_publishing_assets_template_id_check
    check (template_id is null or char_length(trim(template_id)) > 0),
  constraint intelligence_publishing_assets_owner_team_check
    check (char_length(trim(owner_team)) > 0),
  constraint intelligence_publishing_assets_freshness_expiry_behavior_check
    check (freshness_expiry_behavior in ('keep_visible', 'suppress')),
  constraint intelligence_publishing_assets_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.intelligence_publishing_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_version_key text not null unique,
  asset_key text not null references public.intelligence_publishing_assets(asset_key) on delete cascade,
  version_number integer not null,
  status text not null,
  content_fingerprint text not null,
  source_fingerprint text not null,
  template_fingerprint text not null,
  renderer_fingerprint text not null,
  policy_versions jsonb not null default '{}'::jsonb,
  confidence_band text not null,
  created_at timestamptz not null,
  approved_at timestamptz null,
  published_at timestamptz null,
  superseded_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  constraint intelligence_publishing_asset_versions_asset_version_key_check
    check (char_length(trim(asset_version_key)) > 0),
  constraint intelligence_publishing_asset_versions_version_number_check
    check (version_number >= 1),
  constraint intelligence_publishing_asset_versions_status_check
    check (
      status in (
        'draft',
        'generated',
        'pending_review',
        'approved',
        'active',
        'superseded',
        'deprecated',
        'suppressed'
      )
    ),
  constraint intelligence_publishing_asset_versions_content_fingerprint_check
    check (char_length(trim(content_fingerprint)) > 0),
  constraint intelligence_publishing_asset_versions_source_fingerprint_check
    check (char_length(trim(source_fingerprint)) > 0),
  constraint intelligence_publishing_asset_versions_template_fingerprint_check
    check (char_length(trim(template_fingerprint)) > 0),
  constraint intelligence_publishing_asset_versions_renderer_fingerprint_check
    check (char_length(trim(renderer_fingerprint)) > 0),
  constraint intelligence_publishing_asset_versions_policy_versions_check
    check (jsonb_typeof(policy_versions) = 'object'),
  constraint intelligence_publishing_asset_versions_confidence_band_check
    check (confidence_band in ('unknown', 'low', 'moderate', 'high', 'very_high')),
  constraint intelligence_publishing_asset_versions_timestamps_check
    check (
      approved_at is null or approved_at >= created_at
    ),
  constraint intelligence_publishing_asset_versions_superseded_check
    check (
      superseded_at is null
      or published_at is null
      or superseded_at >= published_at
    ),
  constraint intelligence_publishing_asset_versions_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint intelligence_publishing_asset_versions_asset_version_unique
    unique (asset_key, version_number),
  constraint intelligence_publishing_asset_versions_asset_key_asset_version_key_unique
    unique (asset_key, asset_version_key)
);

alter table public.intelligence_publishing_assets
  add constraint intelligence_publishing_assets_active_version_fk
  foreign key (asset_key, active_version_key)
  references public.intelligence_publishing_asset_versions(asset_key, asset_version_key)
  deferrable initially deferred;

create table if not exists public.intelligence_publishing_artifact_references (
  id uuid primary key default gen_random_uuid(),
  reference_key text not null unique,
  asset_key text not null references public.intelligence_publishing_assets(asset_key) on delete cascade,
  asset_version_key text null,
  artifact_type text not null,
  artifact_id text not null,
  artifact_fingerprint text not null,
  relationship_type text not null,
  policy_versions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint intelligence_publishing_artifact_references_reference_key_check
    check (char_length(trim(reference_key)) > 0),
  constraint intelligence_publishing_artifact_references_artifact_type_check
    check (
      artifact_type in (
        'benchmark',
        'public_overview',
        'asset',
        'asset_version',
        'policy',
        'template'
      )
    ),
  constraint intelligence_publishing_artifact_references_artifact_id_check
    check (char_length(trim(artifact_id)) > 0),
  constraint intelligence_publishing_artifact_references_artifact_fingerprint_check
    check (char_length(trim(artifact_fingerprint)) > 0),
  constraint intelligence_publishing_artifact_references_relationship_type_check
    check (
      relationship_type in (
        'derived_from',
        'supported_by',
        'supersedes',
        'localized_from',
        'rendered_from',
        'governed_by'
      )
    ),
  constraint intelligence_publishing_artifact_references_policy_versions_check
    check (jsonb_typeof(policy_versions) = 'object'),
  constraint intelligence_publishing_artifact_references_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint intelligence_publishing_artifact_references_asset_version_fk
    foreign key (asset_key, asset_version_key)
    references public.intelligence_publishing_asset_versions(asset_key, asset_version_key)
    on delete cascade
    deferrable initially deferred
);

create table if not exists public.intelligence_publishing_channel_variants (
  id uuid primary key default gen_random_uuid(),
  variant_key text not null unique,
  asset_key text not null references public.intelligence_publishing_assets(asset_key) on delete cascade,
  asset_version_key text not null,
  locale text not null,
  channel text not null,
  status text not null,
  content_fingerprint text not null,
  destination_key text null,
  published_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  constraint intelligence_publishing_channel_variants_variant_key_check
    check (char_length(trim(variant_key)) > 0),
  constraint intelligence_publishing_channel_variants_locale_check
    check (char_length(trim(locale)) > 0),
  constraint intelligence_publishing_channel_variants_channel_check
    check (char_length(trim(channel)) > 0),
  constraint intelligence_publishing_channel_variants_status_check
    check (
      status in (
        'pending',
        'generated',
        'approved',
        'published',
        'failed',
        'suppressed',
        'deprecated'
      )
    ),
  constraint intelligence_publishing_channel_variants_content_fingerprint_check
    check (char_length(trim(content_fingerprint)) > 0),
  constraint intelligence_publishing_channel_variants_destination_key_check
    check (destination_key is null or char_length(trim(destination_key)) > 0),
  constraint intelligence_publishing_channel_variants_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint intelligence_publishing_channel_variants_asset_version_fk
    foreign key (asset_key, asset_version_key)
    references public.intelligence_publishing_asset_versions(asset_key, asset_version_key)
    on delete cascade
    deferrable initially deferred,
  constraint intelligence_publishing_channel_variants_scope_unique
    unique (asset_key, asset_version_key, channel, locale)
);

create table if not exists public.intelligence_publishing_freshness_states (
  id uuid primary key default gen_random_uuid(),
  freshness_key text not null unique,
  asset_key text not null references public.intelligence_publishing_assets(asset_key) on delete cascade,
  asset_version_key text null,
  computed_at timestamptz not null,
  review_due_at timestamptz null,
  publishable_until timestamptz null,
  stale_after timestamptz null,
  expired_after timestamptz null,
  is_publishable boolean not null,
  is_stale boolean not null,
  is_expired boolean not null,
  evaluated_at timestamptz not null,
  constraint intelligence_publishing_freshness_states_freshness_key_check
    check (char_length(trim(freshness_key)) > 0),
  constraint intelligence_publishing_freshness_states_asset_version_fk
    foreign key (asset_key, asset_version_key)
    references public.intelligence_publishing_asset_versions(asset_key, asset_version_key)
    on delete cascade
    deferrable initially deferred,
  constraint intelligence_publishing_freshness_states_timestamps_check
    check (
      (review_due_at is null or review_due_at >= computed_at)
      and (publishable_until is null or publishable_until >= computed_at)
      and (stale_after is null or stale_after >= computed_at)
      and (expired_after is null or expired_after >= computed_at)
      and evaluated_at >= computed_at
    )
);

create table if not exists public.intelligence_publishing_publication_states (
  id uuid primary key default gen_random_uuid(),
  publication_key text not null unique,
  asset_key text not null references public.intelligence_publishing_assets(asset_key) on delete cascade,
  asset_version_key text not null,
  locale text not null,
  channel text not null,
  publication_status text not null,
  destination_key text null,
  publication_fingerprint text null,
  published_at timestamptz null,
  suppressed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint intelligence_publishing_publication_states_publication_key_check
    check (char_length(trim(publication_key)) > 0),
  constraint intelligence_publishing_publication_states_locale_check
    check (char_length(trim(locale)) > 0),
  constraint intelligence_publishing_publication_states_channel_check
    check (char_length(trim(channel)) > 0),
  constraint intelligence_publishing_publication_states_status_check
    check (
      publication_status in (
        'unpublished',
        'scheduled',
        'publishing',
        'published',
        'failed',
        'suppressed',
        'rolled_back'
      )
    ),
  constraint intelligence_publishing_publication_states_destination_key_check
    check (destination_key is null or char_length(trim(destination_key)) > 0),
  constraint intelligence_publishing_publication_states_publication_fingerprint_check
    check (
      publication_fingerprint is null
      or char_length(trim(publication_fingerprint)) > 0
    ),
  constraint intelligence_publishing_publication_states_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint intelligence_publishing_publication_states_asset_version_fk
    foreign key (asset_key, asset_version_key)
    references public.intelligence_publishing_asset_versions(asset_key, asset_version_key)
    on delete cascade
    deferrable initially deferred,
  constraint intelligence_publishing_publication_states_scope_unique
    unique (asset_key, asset_version_key, channel, locale)
);

create table if not exists public.intelligence_publishing_registry_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null,
  snapshot_version integer not null,
  snapshot_fingerprint text not null unique,
  request_fingerprint text not null,
  idempotency_key text not null unique,
  fencing_token bigint not null,
  asset_count integer not null,
  generated_at timestamptz not null,
  policy_versions jsonb not null default '{}'::jsonb,
  snapshot_payload jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint intelligence_publishing_registry_snapshots_snapshot_key_check
    check (char_length(trim(snapshot_key)) > 0),
  constraint intelligence_publishing_registry_snapshots_request_fingerprint_check
    check (char_length(trim(request_fingerprint)) > 0),
  constraint intelligence_publishing_registry_snapshots_snapshot_version_check
    check (snapshot_version >= 1),
  constraint intelligence_publishing_registry_snapshots_fencing_token_check
    check (fencing_token >= 1),
  constraint intelligence_publishing_registry_snapshots_asset_count_check
    check (asset_count >= 0),
  constraint intelligence_publishing_registry_snapshots_policy_versions_check
    check (jsonb_typeof(policy_versions) = 'object'),
  constraint intelligence_publishing_registry_snapshots_payload_check
    check (jsonb_typeof(snapshot_payload) = 'object'),
  constraint intelligence_publishing_registry_snapshots_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint intelligence_publishing_registry_snapshots_snapshot_unique
    unique (snapshot_key, snapshot_version)
);

create index if not exists intelligence_publishing_assets_type_status_idx
  on public.intelligence_publishing_assets (asset_type, status, updated_at desc);

create index if not exists intelligence_publishing_assets_active_version_idx
  on public.intelligence_publishing_assets (active_version_key)
  where active_version_key is not null;

create index if not exists intelligence_publishing_asset_versions_asset_idx
  on public.intelligence_publishing_asset_versions (asset_key, version_number desc);

create index if not exists intelligence_publishing_asset_versions_fingerprint_idx
  on public.intelligence_publishing_asset_versions (content_fingerprint);

create index if not exists intelligence_publishing_artifact_references_asset_idx
  on public.intelligence_publishing_artifact_references (asset_key, created_at desc);

create index if not exists intelligence_publishing_artifact_references_fingerprint_idx
  on public.intelligence_publishing_artifact_references (artifact_fingerprint);

create index if not exists intelligence_publishing_channel_variants_scope_idx
  on public.intelligence_publishing_channel_variants (channel, locale, updated_at desc);

create index if not exists intelligence_publishing_freshness_states_asset_idx
  on public.intelligence_publishing_freshness_states (asset_key, evaluated_at desc);

create index if not exists intelligence_publishing_publication_states_scope_idx
  on public.intelligence_publishing_publication_states (channel, locale, updated_at desc);

create index if not exists intelligence_publishing_publication_states_fingerprint_idx
  on public.intelligence_publishing_publication_states (publication_fingerprint)
  where publication_fingerprint is not null;

create index if not exists intelligence_publishing_registry_snapshots_created_idx
  on public.intelligence_publishing_registry_snapshots (snapshot_version desc, created_at desc);

create or replace function public.set_intelligence_publishing_registry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_intelligence_publishing_assets_updated_at
  on public.intelligence_publishing_assets;
create trigger trg_intelligence_publishing_assets_updated_at
before update on public.intelligence_publishing_assets
for each row
execute function public.set_intelligence_publishing_registry_updated_at();

drop trigger if exists trg_intelligence_publishing_channel_variants_updated_at
  on public.intelligence_publishing_channel_variants;
create trigger trg_intelligence_publishing_channel_variants_updated_at
before update on public.intelligence_publishing_channel_variants
for each row
execute function public.set_intelligence_publishing_registry_updated_at();

drop trigger if exists trg_intelligence_publishing_publication_states_updated_at
  on public.intelligence_publishing_publication_states;
create trigger trg_intelligence_publishing_publication_states_updated_at
before update on public.intelligence_publishing_publication_states
for each row
execute function public.set_intelligence_publishing_registry_updated_at();

alter table public.intelligence_publishing_assets enable row level security;
alter table public.intelligence_publishing_asset_versions enable row level security;
alter table public.intelligence_publishing_artifact_references enable row level security;
alter table public.intelligence_publishing_channel_variants enable row level security;
alter table public.intelligence_publishing_freshness_states enable row level security;
alter table public.intelligence_publishing_publication_states enable row level security;
alter table public.intelligence_publishing_registry_snapshots enable row level security;

comment on table public.intelligence_publishing_assets is
  'Persistent IPP assets. Server-side only; canonical contract keys are stored in asset_key, never exposed directly to browser clients.';

comment on table public.intelligence_publishing_registry_snapshots is
  'Persistent IPP snapshot headers and full public-safe payloads, used for deterministic replay, CAS and time-travel reads.';

-- TypeScript owns the canonical registry representation. SQL owns atomic
-- persistence and transactional concurrency checks.
create or replace function public.write_intelligence_publishing_registry_snapshot(
  p_snapshot jsonb,
  p_write_options jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  asset_entry jsonb;
  version_entry jsonb;
  reference_entry jsonb;
  variant_entry jsonb;
  freshness_entry jsonb;
  publication_entry jsonb;
  current_snapshot record;
  existing_idempotency record;
  v_payload_snapshot jsonb;
  v_assets jsonb;
  v_asset_versions jsonb;
  v_artifact_references jsonb;
  v_channel_variants jsonb;
  v_freshness_states jsonb;
  v_publication_states jsonb;
  v_delete_keys jsonb;
  v_snapshot_key text;
  v_requested_snapshot_version integer;
  v_snapshot_fingerprint text;
  v_request_fingerprint text;
  v_expected_snapshot_fingerprint text;
  v_idempotency_key text;
  v_written_at timestamptz;
  v_generated_at timestamptz;
  v_fencing_token bigint;
  v_next_snapshot_version integer;
  v_next_fencing_token bigint;
  v_asset_count integer;
  v_snapshot_payload jsonb;
  v_policy_versions jsonb;
  v_metadata jsonb;
begin
  if jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'IPP_INVALID_SNAPSHOT: p_snapshot must be a JSON object';
  end if;

  if jsonb_typeof(coalesce(p_write_options, '{}'::jsonb)) <> 'object' then
    raise exception 'IPP_INVALID_WRITE_OPTIONS: p_write_options must be a JSON object';
  end if;

  -- TypeScript owns the canonical registry representation.
  -- SQL only enforces atomic persistence and transactional concurrency checks.
  v_payload_snapshot := coalesce(p_snapshot -> 'snapshot', '{}'::jsonb);
  v_assets := coalesce(p_snapshot -> 'assets', '[]'::jsonb);
  v_asset_versions := coalesce(p_snapshot -> 'assetVersions', '[]'::jsonb);
  v_artifact_references := coalesce(p_snapshot -> 'artifactReferences', '[]'::jsonb);
  v_channel_variants := coalesce(p_snapshot -> 'channelVariants', '[]'::jsonb);
  v_freshness_states := coalesce(p_snapshot -> 'freshnessStates', '[]'::jsonb);
  v_publication_states := coalesce(p_snapshot -> 'publicationStates', '[]'::jsonb);
  v_delete_keys := coalesce(p_snapshot -> 'deleteKeys', '{}'::jsonb);

  if jsonb_typeof(v_payload_snapshot) <> 'object' then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot payload is required';
  end if;
  if jsonb_typeof(v_assets) <> 'array'
    or jsonb_typeof(v_asset_versions) <> 'array'
    or jsonb_typeof(v_artifact_references) <> 'array'
    or jsonb_typeof(v_channel_variants) <> 'array'
    or jsonb_typeof(v_freshness_states) <> 'array'
    or jsonb_typeof(v_publication_states) <> 'array' then
    raise exception 'IPP_INVALID_SNAPSHOT: all registry collections must be arrays';
  end if;
  if jsonb_typeof(v_delete_keys) <> 'object' then
    raise exception 'IPP_INVALID_SNAPSHOT: deleteKeys must be an object';
  end if;

  v_snapshot_key := nullif(trim(coalesce(v_payload_snapshot ->> 'snapshotId', '')), '');
  v_requested_snapshot_version :=
    nullif(trim(coalesce(v_payload_snapshot ->> 'requestedSnapshotVersion', '')), '')::integer;
  v_snapshot_fingerprint :=
    nullif(trim(coalesce(v_payload_snapshot ->> 'snapshotFingerprint', '')), '');
  v_request_fingerprint :=
    nullif(trim(coalesce(v_payload_snapshot ->> 'requestFingerprint', '')), '');
  v_idempotency_key :=
    nullif(trim(coalesce(v_payload_snapshot ->> 'idempotencyKey', '')), '');
  v_written_at :=
    nullif(trim(coalesce(v_payload_snapshot ->> 'writtenAt', '')), '')::timestamptz;
  v_generated_at :=
    nullif(trim(coalesce(v_payload_snapshot ->> 'generatedAt', '')), '')::timestamptz;
  v_asset_count :=
    nullif(trim(coalesce(v_payload_snapshot ->> 'assetCount', '')), '')::integer;
  v_snapshot_payload := coalesce(v_payload_snapshot -> 'snapshotPayload', '{}'::jsonb);
  v_policy_versions := coalesce(v_payload_snapshot -> 'policyVersions', '{}'::jsonb);
  v_metadata := coalesce(v_payload_snapshot -> 'metadata', '{}'::jsonb);
  v_expected_snapshot_fingerprint :=
    nullif(trim(coalesce(p_write_options ->> 'expectedSnapshotFingerprint', '')), '');
  v_fencing_token :=
    nullif(trim(coalesce(p_write_options ->> 'fencingToken', '')), '')::bigint;

  if v_snapshot_key is null then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot.snapshotId is required';
  end if;
  if v_requested_snapshot_version is null or v_requested_snapshot_version < 1 then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot.requestedSnapshotVersion must be >= 1';
  end if;
  if v_snapshot_fingerprint is null then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot.snapshotFingerprint is required';
  end if;
  if v_request_fingerprint is null then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot.requestFingerprint is required';
  end if;
  if v_idempotency_key is null then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot.idempotencyKey is required';
  end if;
  if v_written_at is null then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot.writtenAt is required';
  end if;
  if v_generated_at is null then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot.generatedAt is required';
  end if;
  if v_asset_count is null or v_asset_count < 0 then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot.assetCount must be >= 0';
  end if;
  if jsonb_typeof(v_snapshot_payload) <> 'object' then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot.snapshotPayload must be a JSON object';
  end if;
  if jsonb_typeof(v_policy_versions) <> 'object' then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot.policyVersions must be a JSON object';
  end if;
  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'IPP_INVALID_SNAPSHOT: snapshot.metadata must be a JSON object';
  end if;

  select *
  into existing_idempotency
  from public.intelligence_publishing_registry_snapshots
  where idempotency_key = v_idempotency_key
  limit 1;

  if found then
    if existing_idempotency.request_fingerprint <> v_request_fingerprint then
      raise exception
        'IPP_IDEMPOTENCY_CONFLICT: idempotencyKey already exists with a different requestFingerprint';
    end if;

    return jsonb_build_object(
      'status', 'idempotent',
      'snapshotId', existing_idempotency.snapshot_key,
      'snapshotVersion', existing_idempotency.snapshot_version,
      'snapshotFingerprint', existing_idempotency.snapshot_fingerprint,
      'fencingToken', existing_idempotency.fencing_token
    );
  end if;

  select *
  into current_snapshot
  from public.intelligence_publishing_registry_snapshots
  order by snapshot_version desc
  limit 1
  for update;

  if v_expected_snapshot_fingerprint is not null and (
    current_snapshot is null
    or current_snapshot.snapshot_fingerprint <> v_expected_snapshot_fingerprint
  ) then
    raise exception
      'IPP_SNAPSHOT_CONFLICT: expectedSnapshotFingerprint does not match the current registry snapshot';
  end if;

  if v_fencing_token is not null
    and current_snapshot is not null
    and current_snapshot.fencing_token > v_fencing_token then
    raise exception
      'IPP_FENCING_CONFLICT: provided fencingToken is older than the current registry fencing token';
  end if;

  v_next_snapshot_version := coalesce(current_snapshot.snapshot_version, 0) + 1;
  v_next_fencing_token := coalesce(current_snapshot.fencing_token, 0) + 1;

  if v_requested_snapshot_version <> v_next_snapshot_version then
    raise exception
      'IPP_SNAPSHOT_VERSION_CONFLICT: requestedSnapshotVersion does not match the next persistent snapshot version';
  end if;

  for asset_entry in
    select value
    from jsonb_array_elements(v_assets)
  loop
    insert into public.intelligence_publishing_assets (
      asset_key,
      canonical_id,
      asset_type,
      status,
      visibility,
      default_locale,
      available_locales,
      available_channels,
      active_version_key,
      template_id,
      owner_team,
      confidence_affects_visible_content,
      policy_change_affects_visible_content,
      freshness_expiry_behavior,
      metadata,
      created_at,
      updated_at
    )
    values (
      trim(asset_entry ->> 'assetKey'),
      trim(asset_entry ->> 'canonicalId'),
      trim(asset_entry ->> 'assetType'),
      trim(asset_entry ->> 'status'),
      trim(asset_entry ->> 'visibility'),
      trim(asset_entry ->> 'defaultLocale'),
      coalesce(
        (
          select array_agg(locale_value order by ord)
          from jsonb_array_elements_text(coalesce(asset_entry -> 'availableLocales', '[]'::jsonb)) with ordinality as locale_values(locale_value, ord)
        ),
        '{}'::text[]
      ),
      coalesce(
        (
          select array_agg(channel_value order by ord)
          from jsonb_array_elements_text(coalesce(asset_entry -> 'availableChannels', '[]'::jsonb)) with ordinality as channel_values(channel_value, ord)
        ),
        '{}'::text[]
      ),
      nullif(trim(coalesce(asset_entry ->> 'activeVersionKey', '')), ''),
      nullif(trim(coalesce(asset_entry ->> 'templateId', '')), ''),
      trim(asset_entry ->> 'ownerTeam'),
      coalesce((asset_entry ->> 'confidenceAffectsVisibleContent')::boolean, false),
      coalesce((asset_entry ->> 'policyChangeAffectsVisibleContent')::boolean, false),
      trim(asset_entry ->> 'freshnessExpiryBehavior'),
      coalesce(asset_entry -> 'metadata', '{}'::jsonb),
      nullif(asset_entry ->> 'createdAt', '')::timestamptz,
      nullif(asset_entry ->> 'updatedAt', '')::timestamptz
    )
    on conflict (asset_key)
    do update set
      canonical_id = excluded.canonical_id,
      asset_type = excluded.asset_type,
      status = excluded.status,
      visibility = excluded.visibility,
      default_locale = excluded.default_locale,
      available_locales = excluded.available_locales,
      available_channels = excluded.available_channels,
      active_version_key = excluded.active_version_key,
      template_id = excluded.template_id,
      owner_team = excluded.owner_team,
      confidence_affects_visible_content = excluded.confidence_affects_visible_content,
      policy_change_affects_visible_content = excluded.policy_change_affects_visible_content,
      freshness_expiry_behavior = excluded.freshness_expiry_behavior,
      metadata = excluded.metadata,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
  end loop;

  for version_entry in
    select value
    from jsonb_array_elements(v_asset_versions)
  loop
    insert into public.intelligence_publishing_asset_versions (
      asset_version_key,
      asset_key,
      version_number,
      status,
      content_fingerprint,
      source_fingerprint,
      template_fingerprint,
      renderer_fingerprint,
      policy_versions,
      confidence_band,
      created_at,
      approved_at,
      published_at,
      superseded_at,
      metadata
    )
    values (
      trim(version_entry ->> 'assetVersionKey'),
      trim(version_entry ->> 'assetKey'),
      (version_entry ->> 'versionNumber')::integer,
      trim(version_entry ->> 'status'),
      trim(version_entry ->> 'contentFingerprint'),
      trim(version_entry ->> 'sourceFingerprint'),
      trim(version_entry ->> 'templateFingerprint'),
      trim(version_entry ->> 'rendererFingerprint'),
      coalesce(version_entry -> 'policyVersions', '{}'::jsonb),
      trim(version_entry ->> 'confidenceBand'),
      nullif(version_entry ->> 'createdAt', '')::timestamptz,
      nullif(version_entry ->> 'approvedAt', '')::timestamptz,
      nullif(version_entry ->> 'publishedAt', '')::timestamptz,
      nullif(version_entry ->> 'supersededAt', '')::timestamptz,
      coalesce(version_entry -> 'metadata', '{}'::jsonb)
    )
    on conflict (asset_version_key)
    do update set
      asset_key = excluded.asset_key,
      version_number = excluded.version_number,
      status = excluded.status,
      content_fingerprint = excluded.content_fingerprint,
      source_fingerprint = excluded.source_fingerprint,
      template_fingerprint = excluded.template_fingerprint,
      renderer_fingerprint = excluded.renderer_fingerprint,
      policy_versions = excluded.policy_versions,
      confidence_band = excluded.confidence_band,
      created_at = excluded.created_at,
      approved_at = excluded.approved_at,
      published_at = excluded.published_at,
      superseded_at = excluded.superseded_at,
      metadata = excluded.metadata;
  end loop;

  for reference_entry in
    select value
    from jsonb_array_elements(v_artifact_references)
  loop
    insert into public.intelligence_publishing_artifact_references (
      reference_key,
      asset_key,
      asset_version_key,
      artifact_type,
      artifact_id,
      artifact_fingerprint,
      relationship_type,
      policy_versions,
      created_at,
      metadata
    )
    values (
      trim(reference_entry ->> 'referenceKey'),
      trim(reference_entry ->> 'assetKey'),
      nullif(trim(coalesce(reference_entry ->> 'assetVersionKey', '')), ''),
      trim(reference_entry ->> 'artifactType'),
      trim(reference_entry ->> 'artifactId'),
      trim(reference_entry ->> 'artifactFingerprint'),
      trim(reference_entry ->> 'relationshipType'),
      coalesce(reference_entry -> 'policyVersions', '{}'::jsonb),
      nullif(reference_entry ->> 'createdAt', '')::timestamptz,
      coalesce(reference_entry -> 'metadata', '{}'::jsonb)
    )
    on conflict (reference_key)
    do update set
      asset_key = excluded.asset_key,
      asset_version_key = excluded.asset_version_key,
      artifact_type = excluded.artifact_type,
      artifact_id = excluded.artifact_id,
      artifact_fingerprint = excluded.artifact_fingerprint,
      relationship_type = excluded.relationship_type,
      policy_versions = excluded.policy_versions,
      created_at = excluded.created_at,
      metadata = excluded.metadata;
  end loop;

  for variant_entry in
    select value
    from jsonb_array_elements(v_channel_variants)
  loop
    insert into public.intelligence_publishing_channel_variants (
      variant_key,
      asset_key,
      asset_version_key,
      locale,
      channel,
      status,
      content_fingerprint,
      destination_key,
      published_at,
      updated_at,
      metadata
    )
    values (
      trim(variant_entry ->> 'variantKey'),
      trim(variant_entry ->> 'assetKey'),
      trim(variant_entry ->> 'assetVersionKey'),
      trim(variant_entry ->> 'locale'),
      trim(variant_entry ->> 'channel'),
      trim(variant_entry ->> 'status'),
      trim(variant_entry ->> 'contentFingerprint'),
      nullif(trim(coalesce(variant_entry ->> 'destinationKey', '')), ''),
      nullif(variant_entry ->> 'publishedAt', '')::timestamptz,
      nullif(variant_entry ->> 'updatedAt', '')::timestamptz,
      coalesce(variant_entry -> 'metadata', '{}'::jsonb)
    )
    on conflict (variant_key)
    do update set
      asset_key = excluded.asset_key,
      asset_version_key = excluded.asset_version_key,
      locale = excluded.locale,
      channel = excluded.channel,
      status = excluded.status,
      content_fingerprint = excluded.content_fingerprint,
      destination_key = excluded.destination_key,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at,
      metadata = excluded.metadata;
  end loop;

  for freshness_entry in
    select value
    from jsonb_array_elements(v_freshness_states)
  loop
    insert into public.intelligence_publishing_freshness_states (
      freshness_key,
      asset_key,
      asset_version_key,
      computed_at,
      review_due_at,
      publishable_until,
      stale_after,
      expired_after,
      is_publishable,
      is_stale,
      is_expired,
      evaluated_at
    )
    values (
      trim(freshness_entry ->> 'freshnessKey'),
      trim(freshness_entry ->> 'assetKey'),
      nullif(trim(coalesce(freshness_entry ->> 'assetVersionKey', '')), ''),
      nullif(freshness_entry ->> 'computedAt', '')::timestamptz,
      nullif(freshness_entry ->> 'reviewDueAt', '')::timestamptz,
      nullif(freshness_entry ->> 'publishableUntil', '')::timestamptz,
      nullif(freshness_entry ->> 'staleAfter', '')::timestamptz,
      nullif(freshness_entry ->> 'expiredAfter', '')::timestamptz,
      coalesce((freshness_entry ->> 'isPublishable')::boolean, false),
      coalesce((freshness_entry ->> 'isStale')::boolean, false),
      coalesce((freshness_entry ->> 'isExpired')::boolean, false),
      nullif(freshness_entry ->> 'evaluatedAt', '')::timestamptz
    )
    on conflict (freshness_key)
    do update set
      asset_key = excluded.asset_key,
      asset_version_key = excluded.asset_version_key,
      computed_at = excluded.computed_at,
      review_due_at = excluded.review_due_at,
      publishable_until = excluded.publishable_until,
      stale_after = excluded.stale_after,
      expired_after = excluded.expired_after,
      is_publishable = excluded.is_publishable,
      is_stale = excluded.is_stale,
      is_expired = excluded.is_expired,
      evaluated_at = excluded.evaluated_at;
  end loop;

  for publication_entry in
    select value
    from jsonb_array_elements(v_publication_states)
  loop
    insert into public.intelligence_publishing_publication_states (
      publication_key,
      asset_key,
      asset_version_key,
      locale,
      channel,
      publication_status,
      destination_key,
      publication_fingerprint,
      published_at,
      suppressed_at,
      metadata,
      created_at,
      updated_at
    )
    values (
      trim(publication_entry ->> 'publicationKey'),
      trim(publication_entry ->> 'assetKey'),
      trim(publication_entry ->> 'assetVersionKey'),
      trim(publication_entry ->> 'locale'),
      trim(publication_entry ->> 'channel'),
      trim(publication_entry ->> 'publicationStatus'),
      nullif(trim(coalesce(publication_entry ->> 'destinationKey', '')), ''),
      nullif(trim(coalesce(publication_entry ->> 'publicationFingerprint', '')), ''),
      nullif(publication_entry ->> 'publishedAt', '')::timestamptz,
      nullif(publication_entry ->> 'suppressedAt', '')::timestamptz,
      coalesce(publication_entry -> 'metadata', '{}'::jsonb),
      nullif(publication_entry ->> 'createdAt', '')::timestamptz,
      nullif(publication_entry ->> 'updatedAt', '')::timestamptz
    )
    on conflict (publication_key)
    do update set
      asset_key = excluded.asset_key,
      asset_version_key = excluded.asset_version_key,
      locale = excluded.locale,
      channel = excluded.channel,
      publication_status = excluded.publication_status,
      destination_key = excluded.destination_key,
      publication_fingerprint = excluded.publication_fingerprint,
      published_at = excluded.published_at,
      suppressed_at = excluded.suppressed_at,
      metadata = excluded.metadata,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
  end loop;

  delete from public.intelligence_publishing_publication_states
  where publication_key in (
    select value
    from jsonb_array_elements_text(coalesce(v_delete_keys -> 'publicationKeys', '[]'::jsonb)) as value
  );

  delete from public.intelligence_publishing_freshness_states
  where freshness_key in (
    select value
    from jsonb_array_elements_text(coalesce(v_delete_keys -> 'freshnessKeys', '[]'::jsonb)) as value
  );

  delete from public.intelligence_publishing_channel_variants
  where variant_key in (
    select value
    from jsonb_array_elements_text(coalesce(v_delete_keys -> 'variantKeys', '[]'::jsonb)) as value
  );

  delete from public.intelligence_publishing_artifact_references
  where reference_key in (
    select value
    from jsonb_array_elements_text(coalesce(v_delete_keys -> 'referenceKeys', '[]'::jsonb)) as value
  );

  delete from public.intelligence_publishing_asset_versions
  where asset_version_key in (
    select value
    from jsonb_array_elements_text(coalesce(v_delete_keys -> 'assetVersionKeys', '[]'::jsonb)) as value
  );

  delete from public.intelligence_publishing_assets
  where asset_key in (
    select value
    from jsonb_array_elements_text(coalesce(v_delete_keys -> 'assetKeys', '[]'::jsonb)) as value
  );

  insert into public.intelligence_publishing_registry_snapshots (
    snapshot_key,
    snapshot_version,
    snapshot_fingerprint,
    request_fingerprint,
    idempotency_key,
    fencing_token,
    asset_count,
    generated_at,
    policy_versions,
    snapshot_payload,
    metadata
  )
  values (
    v_snapshot_key,
    v_requested_snapshot_version,
    v_snapshot_fingerprint,
    v_request_fingerprint,
    v_idempotency_key,
    v_next_fencing_token,
    v_asset_count,
    v_generated_at,
    v_policy_versions,
    v_snapshot_payload,
    v_metadata
  );

  return jsonb_build_object(
    'status', 'written',
    'snapshotId', v_snapshot_key,
    'snapshotVersion', v_requested_snapshot_version,
    'snapshotFingerprint', v_snapshot_fingerprint,
    'fencingToken', v_next_fencing_token
  );
end;
$$;

revoke all on function public.write_intelligence_publishing_registry_snapshot(jsonb, jsonb) from public;
revoke all on function public.write_intelligence_publishing_registry_snapshot(jsonb, jsonb) from anon;
revoke all on function public.write_intelligence_publishing_registry_snapshot(jsonb, jsonb) from authenticated;
grant execute on function public.write_intelligence_publishing_registry_snapshot(jsonb, jsonb) to service_role;

commit;
