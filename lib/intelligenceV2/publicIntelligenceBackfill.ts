import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  canonicalizeMarketCity,
  canonicalizeMarketCountry,
} from "@/lib/competitors/marketNormalization";
import {
  classifyGeographyCandidate,
  inferCountryFromKnownCity as inferCountryFromKnownCityFromClassifier,
  type GeographyCandidateClassificationResult,
} from "@/lib/marketMemory/geographyCandidateClassifier";

import {
  analyzeMarketMemoryPricingBackfillDryRun,
  type MarketMemoryPricingBackfillAnalyzeInput,
  type MarketMemoryPricingBackfillAnalyzeResult,
  type MarketMemoryPricingBackfillCliOptions,
  type MarketMemoryPricingBackfillComparableRow,
  type MarketMemoryPricingBackfillPreparedWrite,
  type MarketMemoryPricingBackfillSnapshotRow,
  type MarketMemoryPricingBackfillSourceClass,
} from "./marketMemoryPricingBackfill";
import {
  normalizeIntelligencePlatform,
  normalizeIntelligencePropertyType,
} from "./marketCell";
import {
  buildPublicMarketOverviewBackfill,
  type PublicMarketOverviewBackfillCandidate,
  type PublicMarketOverviewBackfillResult,
} from "./publicMarketOverviewBackfill";
import {
  writeAnonymousPricingFacts,
  type PricingFactWriterDependencies,
  type PricingFactWriterResult,
} from "./pricingFactWriter";

const SNAPSHOT_PAGE_SIZE = 500;
const COMPARABLE_PAGE_SIZE = 500;
const SNAPSHOT_ID_CHUNK_SIZE = 200;
const FACT_KEY_CHUNK_SIZE = 200;
const WRITE_BATCH_SIZE = 100;
const ISO_DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const MAX_LIMIT = 10000;
const MAX_MARKET_LIMIT = 500;

export type PublicIntelligenceBackfillMode = "dry_run" | "apply";
export type PublicIntelligenceBackfillStage = "facts" | "artifacts" | "all";
export type PublicIntelligenceBackfillPlatform = Exclude<
  ReturnType<typeof normalizeIntelligencePlatform>,
  "unknown"
>;

export type PublicIntelligenceBackfillOptions = Readonly<{
  mode: PublicIntelligenceBackfillMode;
  confirmWrite: boolean;
  country: string | null;
  city: string | null;
  platform: string | null;
  stage: PublicIntelligenceBackfillStage;
  marketLimit: number | null;
  limit: number | null;
  from: string | null;
  to: string | null;
}>;

export type PublicIntelligenceBackfillCliParseResult =
  | Readonly<{ ok: true; options: PublicIntelligenceBackfillOptions }>
  | Readonly<{ ok: false; error: string }>;

export type PublicIntelligenceBackfillAnomalyCode =
  | "missing_country"
  | "missing_city"
  | "invalid_city_candidate"
  | "ambiguous_city_candidate"
  | "district_not_supported_as_city"
  | "unsupported_platform"
  | "unsupported_snapshot_source"
  | "snapshot_without_comparables"
  | "comparables_without_qualifying_snapshot"
  | "no_compatible_comparables"
  | "no_public_property_types";

export type PublicIntelligenceBackfillGlobalAnomaly = Readonly<{
  market: Readonly<{
    country: string;
    city: string;
    platform: string;
  }>;
  code: PublicIntelligenceBackfillAnomalyCode;
  snapshots: number;
  comparables: number;
}>;

export type PublicIntelligenceBackfillGeographyRecoveries = Readonly<{
  countryInferredFromKnownCity: number;
}>;

export type PublicIntelligenceBackfillMarketResult = Readonly<{
  market: Readonly<{
    country: string;
    city: string;
    platforms: readonly string[];
  }>;
  snapshotsScanned: number;
  comparablesScanned: number;
  pricingFacts: Readonly<{
    eligible: number;
    unique: number;
    inserted: number;
    alreadyExisting: number;
    rejected: number;
    failed: number;
  }>;
  publicOverview: Readonly<{
    currencies: readonly string[];
    exactStatus: readonly string[];
    broaderMarketStatus: readonly string[];
    inserted: number;
    alreadyExisting: number;
    notPublic: number;
    failed: number;
  }>;
  anomalies: readonly PublicIntelligenceBackfillAnomalyCode[];
  reasonCodes: readonly string[];
  technicalFailure: boolean;
}>;

export type PublicIntelligenceBackfillResult =
  | Readonly<{
      ok: true;
      options: PublicIntelligenceBackfillOptions;
      marketsDiscovered: number;
      marketsProcessed: number;
      marketsPublic: number;
      marketsInsufficient: number;
      marketsFailed: number;
      factsInserted: number;
      factsAlreadyExisting: number;
      artifactsInserted: number;
      artifactsAlreadyExisting: number;
      geographyRecoveries: PublicIntelligenceBackfillGeographyRecoveries;
      markets: readonly PublicIntelligenceBackfillMarketResult[];
      anomalies: readonly PublicIntelligenceBackfillGlobalAnomaly[];
    }>
  | Readonly<{
      ok: false;
      error: string;
    }>;

type SnapshotMarketSeed = Readonly<{
  key: string;
  country: string;
  city: string;
  platform: PublicIntelligenceBackfillPlatform;
  snapshotIds: readonly string[];
  snapshotsScanned: number;
  comparablesScanned: number;
}>;

type CityMarketSeed = Readonly<{
  country: string;
  city: string;
  platforms: readonly PublicIntelligenceBackfillPlatform[];
  platformSeeds: readonly SnapshotMarketSeed[];
  snapshotsScanned: number;
  comparablesScanned: number;
}>;

type PricingStageAggregate = Readonly<{
  eligible: number;
  unique: number;
  inserted: number;
  alreadyExisting: number;
  rejected: number;
  failed: number;
  propertyTypes: readonly string[];
  currencies: readonly string[];
  anomalies: readonly PublicIntelligenceBackfillAnomalyCode[];
  reasonCodes: readonly string[];
  technicalFailure: boolean;
}>;

type PublicStageAggregate = Readonly<{
  currencies: readonly string[];
  exactStatus: readonly string[];
  broaderMarketStatus: readonly string[];
  inserted: number;
  alreadyExisting: number;
  notPublic: number;
  failed: number;
  reasonCodes: readonly string[];
  technicalFailure: boolean;
}>;

type QueryExistingFactKeys = (
  factKeys: ReadonlyArray<string>,
) => Promise<Set<string>>;

type PublicIntelligenceBackfillDependencies = Readonly<{
  now?: () => Date;
  loadSnapshots?: (
    options: PublicIntelligenceBackfillOptions,
  ) => Promise<ReadonlyArray<MarketMemoryPricingBackfillSnapshotRow>>;
  loadComparablesForSnapshotIds?: (
    snapshotIds: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<MarketMemoryPricingBackfillComparableRow>>;
  analyzePricingBackfill?: (
    input: MarketMemoryPricingBackfillAnalyzeInput,
  ) => MarketMemoryPricingBackfillAnalyzeResult;
  writePricingFacts?: (
    input: Parameters<typeof writeAnonymousPricingFacts>[0],
    dependencies?: PricingFactWriterDependencies,
  ) => Promise<PricingFactWriterResult>;
  buildPublicOverviewBackfill?: (
    options: Parameters<typeof buildPublicMarketOverviewBackfill>[0],
    dependencies?: Parameters<typeof buildPublicMarketOverviewBackfill>[1],
  ) => Promise<PublicMarketOverviewBackfillResult>;
  queryExistingFactKeys?: QueryExistingFactKeys;
  markFactKeysAsExisting?: (factKeys: ReadonlyArray<string>) => void;
}>;

type PublicOverviewRunnerDependencies = Readonly<{
  buildPublicOverviewBackfill: NonNullable<
    PublicIntelligenceBackfillDependencies["buildPublicOverviewBackfill"]
  >;
}>;

export function inferCountryFromKnownCity(city: string | null | undefined) {
  return inferCountryFromKnownCityFromClassifier(city);
}

function parseEqualsArgument(argument: string, name: string): string | null {
  const prefix = `${name}=`;
  if (!argument.startsWith(prefix)) {
    return null;
  }
  const value = argument.slice(prefix.length).trim();
  return value.length > 0 ? value : null;
}

function normalizeNonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function chunkValues<T>(
  values: ReadonlyArray<T>,
  size: number,
): ReadonlyArray<ReadonlyArray<T>> {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function buildAdminWriterEnv(): Record<string, string | undefined> {
  return {
    ...process.env,
    ENABLE_INTELLIGENCE_FACT_TRANSFORMATION: "true",
    ENABLE_INTELLIGENCE_FACT_CONTRIBUTION: "true",
  };
}

function sortStrings(values: Iterable<string>): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function safeStatusFromCandidate(candidate: PublicMarketOverviewBackfillCandidate): string {
  if (candidate.exposureStatus != null) {
    return candidate.exposureStatus;
  }
  return candidate.status;
}

function buildPricingOptionsForCity(input: {
  options: PublicIntelligenceBackfillOptions;
  market: Pick<CityMarketSeed, "country" | "city">;
}): MarketMemoryPricingBackfillCliOptions {
  return {
    country: input.market.country,
    city: input.market.city,
    platform: input.options.platform,
    limit: input.options.limit,
    snapshotId: null,
    from: input.options.from,
    to: input.options.to,
    mode: input.options.mode,
    confirmWrite: input.options.confirmWrite,
  };
}

function deriveDeterministicComparableCity(
  comparables: ReadonlyArray<MarketMemoryPricingBackfillComparableRow>,
): string | null {
  const normalizedCities = new Set<string>();
  for (const comparable of comparables) {
    const city = canonicalizeMarketCity(comparable.city);
    if (city != null && city !== "unknown") {
      normalizedCities.add(city);
    }
  }

  if (normalizedCities.size !== 1) {
    return null;
  }

  return [...normalizedCities][0] ?? null;
}

function normalizeSnapshotMarket(
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
  fallbackCity?: string | null,
): Readonly<{
  country: string | null;
  city: string | null;
  platform: PublicIntelligenceBackfillPlatform | null;
  countryInferred: boolean;
  geography: GeographyCandidateClassificationResult;
}> {
  const geography = classifyGeographyCandidate({
    rawCountry: snapshot.country,
    rawCity: normalizeNonEmptyString(snapshot.city) ?? fallbackCity ?? null,
    source: "public_backfill_snapshot",
  });
  const country = canonicalizeMarketCountry(geography.country);
  const city = canonicalizeMarketCity(geography.city);
  const platform = normalizeIntelligencePlatform(snapshot.platform);
  return Object.freeze({
    country: country === "unknown" ? null : country,
    city: city === "unknown" ? null : city,
    platform: platform === "unknown" ? null : platform,
    countryInferred: geography.reasonCodes.includes("country_inferred_from_known_city"),
    geography,
  });
}

function normalizeComparableMarket(
  comparable: MarketMemoryPricingBackfillComparableRow,
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
): Readonly<{
  country: string | null;
  city: string | null;
  platform: PublicIntelligenceBackfillPlatform | null;
  geography: GeographyCandidateClassificationResult;
}> {
  const geography = classifyGeographyCandidate({
    rawCountry: comparable.country ?? snapshot.country,
    rawCity: comparable.city ?? snapshot.city,
    source: "public_backfill_comparable",
  });
  const country = canonicalizeMarketCountry(geography.country);
  const city = canonicalizeMarketCity(geography.city);
  const platform = normalizeIntelligencePlatform(
    comparable.platform ?? snapshot.platform,
  );
  return Object.freeze({
    country: country === "unknown" ? null : country,
    city: city === "unknown" ? null : city,
    platform: platform === "unknown" ? null : platform,
    geography,
  });
}

function deriveSnapshotSourceClass(
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
): MarketMemoryPricingBackfillSourceClass | null {
  const route =
    snapshot.metadata != null &&
    typeof snapshot.metadata === "object" &&
    !Array.isArray(snapshot.metadata) &&
    typeof snapshot.metadata.route === "string"
      ? snapshot.metadata.route.trim()
      : null;

  if (route === "api_audits") {
    return "authenticated_audit";
  }
  if (route === "api_listings") {
    return "authenticated_listing";
  }
  return null;
}

function marketMatchesDiscoveryFilters(input: {
  country: string | null;
  city: string | null;
  platform: string | null;
  options: PublicIntelligenceBackfillOptions;
}): boolean {
  if (input.options.country != null && input.country !== input.options.country) {
    return false;
  }
  if (input.options.city != null && input.city !== input.options.city) {
    return false;
  }
  if (input.options.platform != null && input.platform !== input.options.platform) {
    return false;
  }
  return true;
}

function buildGlobalAnomalyAccumulator() {
  return new Map<
    string,
    {
      market: { country: string; city: string; platform: string };
      code: PublicIntelligenceBackfillAnomalyCode;
      snapshots: number;
      comparables: number;
    }
  >();
}

function addGlobalAnomaly(
  accumulator: ReturnType<typeof buildGlobalAnomalyAccumulator>,
  input: {
    country: string;
    city: string;
    platform: string;
    code: PublicIntelligenceBackfillAnomalyCode;
    snapshots?: number;
    comparables?: number;
  },
): void {
  const key = [
    input.country,
    input.city,
    input.platform,
    input.code,
  ].join("|");
  const current = accumulator.get(key);
  if (current) {
    current.snapshots += input.snapshots ?? 0;
    current.comparables += input.comparables ?? 0;
    return;
  }
  accumulator.set(key, {
    market: {
      country: input.country,
      city: input.city,
      platform: input.platform,
    },
    code: input.code,
    snapshots: input.snapshots ?? 0,
    comparables: input.comparables ?? 0,
  });
}

function toSortedGlobalAnomalies(
  accumulator: ReturnType<typeof buildGlobalAnomalyAccumulator>,
): readonly PublicIntelligenceBackfillGlobalAnomaly[] {
  return Object.freeze(
    [...accumulator.values()]
      .sort(
        (left, right) =>
          left.market.country.localeCompare(right.market.country) ||
          left.market.city.localeCompare(right.market.city) ||
          left.market.platform.localeCompare(right.market.platform) ||
          left.code.localeCompare(right.code),
      )
      .map((entry) =>
        Object.freeze({
          market: Object.freeze(entry.market),
          code: entry.code,
          snapshots: entry.snapshots,
          comparables: entry.comparables,
        }),
      ),
  );
}

function discoverMarkets(input: {
  snapshots: ReadonlyArray<MarketMemoryPricingBackfillSnapshotRow>;
  comparables: ReadonlyArray<MarketMemoryPricingBackfillComparableRow>;
  options: PublicIntelligenceBackfillOptions;
}): Readonly<{
  markets: readonly CityMarketSeed[];
  anomalies: readonly PublicIntelligenceBackfillGlobalAnomaly[];
  geographyRecoveries: PublicIntelligenceBackfillGeographyRecoveries;
}> {
  const comparablesBySnapshotId = new Map<string, MarketMemoryPricingBackfillComparableRow[]>();
  for (const comparable of input.comparables) {
    const current = comparablesBySnapshotId.get(comparable.snapshot_id);
    if (current) {
      current.push(comparable);
      continue;
    }
    comparablesBySnapshotId.set(comparable.snapshot_id, [comparable]);
  }

  const globalAnomalies = buildGlobalAnomalyAccumulator();
  let countryInferredFromKnownCity = 0;
  const platformGroups = new Map<
    string,
    {
      country: string;
      city: string;
      platform: PublicIntelligenceBackfillPlatform;
      snapshotIds: string[];
      snapshotsScanned: number;
      comparablesScanned: number;
    }
  >();

  for (const snapshot of input.snapshots) {
    const linkedComparables = comparablesBySnapshotId.get(snapshot.id) ?? [];
    const fallbackCity = deriveDeterministicComparableCity(linkedComparables);
    const normalizedSnapshot = normalizeSnapshotMarket(snapshot, fallbackCity);
    if (normalizedSnapshot.countryInferred) {
      countryInferredFromKnownCity += 1;
    }
    const comparableMarket =
      linkedComparables[0] != null
        ? normalizeComparableMarket(linkedComparables[0], snapshot)
        : normalizedSnapshot;

    const anomalyCountry = comparableMarket.country ?? normalizedSnapshot.country ?? "unknown";
    const anomalyCity =
      normalizedSnapshot.geography.city ??
      comparableMarket.geography.city ??
      comparableMarket.city ??
      normalizedSnapshot.city ??
      "unknown";
    const anomalyPlatform =
      comparableMarket.platform ?? normalizedSnapshot.platform ?? "unknown";
    const filterCountry = normalizedSnapshot.country ?? comparableMarket.country;
    const filterCity = normalizedSnapshot.city ?? comparableMarket.city;
    const filterPlatform = normalizedSnapshot.platform ?? comparableMarket.platform;

    if (
      !marketMatchesDiscoveryFilters({
        country: filterCountry,
        city: filterCity,
        platform: filterPlatform,
        options: input.options,
      })
    ) {
      continue;
    }

    if (normalizedSnapshot.geography.status === "invalid") {
      addGlobalAnomaly(globalAnomalies, {
        country: anomalyCountry,
        city: anomalyCity,
        platform: anomalyPlatform,
        code: "invalid_city_candidate",
        snapshots: 1,
        comparables: linkedComparables.length,
      });
      continue;
    }

    if (normalizedSnapshot.geography.status === "ambiguous") {
      addGlobalAnomaly(globalAnomalies, {
        country: anomalyCountry,
        city: anomalyCity,
        platform: anomalyPlatform,
        code: "ambiguous_city_candidate",
        snapshots: 1,
        comparables: linkedComparables.length,
      });
      continue;
    }

    if (normalizedSnapshot.geography.status === "district") {
      addGlobalAnomaly(globalAnomalies, {
        country: anomalyCountry,
        city: anomalyCity,
        platform: anomalyPlatform,
        code: "district_not_supported_as_city",
        snapshots: 1,
        comparables: linkedComparables.length,
      });
      continue;
    }

    if (normalizedSnapshot.country == null) {
      addGlobalAnomaly(globalAnomalies, {
        country: anomalyCountry,
        city: anomalyCity,
        platform: anomalyPlatform,
        code: "missing_country",
        snapshots: 1,
        comparables: linkedComparables.length,
      });
      continue;
    }

    if (normalizedSnapshot.city == null) {
      addGlobalAnomaly(globalAnomalies, {
        country: anomalyCountry,
        city: anomalyCity,
        platform: anomalyPlatform,
        code: "missing_city",
        snapshots: 1,
        comparables: linkedComparables.length,
      });
      continue;
    }

    if (linkedComparables.length === 0) {
      addGlobalAnomaly(globalAnomalies, {
        country: anomalyCountry,
        city: anomalyCity,
        platform: anomalyPlatform,
        code: "snapshot_without_comparables",
        snapshots: 1,
      });
      continue;
    }

    if (normalizedSnapshot.platform == null) {
      addGlobalAnomaly(globalAnomalies, {
        country: anomalyCountry,
        city: anomalyCity,
        platform: anomalyPlatform,
        code: "unsupported_platform",
        snapshots: 1,
        comparables: linkedComparables.length,
      });
      continue;
    }

    if (deriveSnapshotSourceClass(snapshot) == null) {
      addGlobalAnomaly(globalAnomalies, {
        country: normalizedSnapshot.country,
        city: normalizedSnapshot.city,
        platform: normalizedSnapshot.platform,
        code: "unsupported_snapshot_source",
        snapshots: 1,
        comparables: linkedComparables.length,
      });
      continue;
    }

    const key = [
      normalizedSnapshot.country,
      normalizedSnapshot.city,
      normalizedSnapshot.platform,
    ].join("|");
    const current = platformGroups.get(key);
    if (current) {
      current.snapshotIds.push(snapshot.id);
      current.snapshotsScanned += 1;
      current.comparablesScanned += linkedComparables.length;
      continue;
    }

    platformGroups.set(key, {
      country: normalizedSnapshot.country,
      city: normalizedSnapshot.city,
      platform: normalizedSnapshot.platform,
      snapshotIds: [snapshot.id],
      snapshotsScanned: 1,
      comparablesScanned: linkedComparables.length,
    });
  }

  for (const comparable of input.comparables) {
    if (platformGroups.size > 0) {
      continue;
    }
    const country = canonicalizeMarketCountry(comparable.country);
    const city = canonicalizeMarketCity(comparable.city);
    const platform = normalizeIntelligencePlatform(comparable.platform);
    addGlobalAnomaly(globalAnomalies, {
      country: country == null || country === "unknown" ? "unknown" : country,
      city: city == null || city === "unknown" ? "unknown" : city,
      platform: platform === "unknown" ? "unknown" : platform,
      code: "comparables_without_qualifying_snapshot",
      comparables: 1,
    });
  }

  const cityGroups = new Map<
    string,
    {
      country: string;
      city: string;
      platforms: Set<PublicIntelligenceBackfillPlatform>;
      platformSeeds: SnapshotMarketSeed[];
      snapshotsScanned: number;
      comparablesScanned: number;
    }
  >();

  for (const group of platformGroups.values()) {
    const cityKey = [group.country, group.city].join("|");
    const snapshotSeed: SnapshotMarketSeed = Object.freeze({
      key: [group.country, group.city, group.platform].join("|"),
      country: group.country,
      city: group.city,
      platform: group.platform,
      snapshotIds: Object.freeze([...group.snapshotIds].sort()),
      snapshotsScanned: group.snapshotsScanned,
      comparablesScanned: group.comparablesScanned,
    });

    const current = cityGroups.get(cityKey);
    if (current) {
      current.platforms.add(group.platform);
      current.platformSeeds.push(snapshotSeed);
      current.snapshotsScanned += group.snapshotsScanned;
      current.comparablesScanned += group.comparablesScanned;
      continue;
    }

    cityGroups.set(cityKey, {
      country: group.country,
      city: group.city,
      platforms: new Set([group.platform]),
      platformSeeds: [snapshotSeed],
      snapshotsScanned: group.snapshotsScanned,
      comparablesScanned: group.comparablesScanned,
    });
  }

  const markets = [...cityGroups.values()]
    .sort(
      (left, right) =>
        left.country.localeCompare(right.country) ||
        left.city.localeCompare(right.city),
    )
    .slice(0, input.options.marketLimit ?? MAX_MARKET_LIMIT)
    .map((entry) =>
      Object.freeze({
        country: entry.country,
        city: entry.city,
        platforms: Object.freeze([...entry.platforms].sort()),
        platformSeeds: Object.freeze(
          [...entry.platformSeeds].sort((left, right) => left.key.localeCompare(right.key)),
        ),
        snapshotsScanned: entry.snapshotsScanned,
        comparablesScanned: entry.comparablesScanned,
      }),
    );

  return Object.freeze({
    markets: Object.freeze(markets),
    anomalies: toSortedGlobalAnomalies(globalAnomalies),
    geographyRecoveries: Object.freeze({
      countryInferredFromKnownCity,
    }),
  });
}

function buildComparableIndex(
  comparables: ReadonlyArray<MarketMemoryPricingBackfillComparableRow>,
): Map<string, MarketMemoryPricingBackfillComparableRow[]> {
  const map = new Map<string, MarketMemoryPricingBackfillComparableRow[]>();
  for (const comparable of comparables) {
    const current = map.get(comparable.snapshot_id);
    if (current) {
      current.push(comparable);
      continue;
    }
    map.set(comparable.snapshot_id, [comparable]);
  }
  return map;
}

function createDefaultQueryExistingFactKeys(): QueryExistingFactKeys {
  return async (factKeys) => {
    if (factKeys.length === 0) {
      return new Set<string>();
    }

    const admin = createSupabaseAdminClient();
    const existing = new Set<string>();

    for (const chunk of chunkValues(factKeys, FACT_KEY_CHUNK_SIZE)) {
      const { data, error } = await admin
        .from("anonymous_fact_groups")
        .select("fact_key")
        .in("fact_key", [...chunk]);

      if (error) {
        throw new Error(`Unable to read anonymous_fact_groups: ${error.message}`);
      }

      for (const row of Array.isArray(data) ? data : []) {
        if (typeof row.fact_key === "string") {
          existing.add(row.fact_key);
        }
      }
    }

    return existing;
  };
}

function collectCityPricingInputs(input: {
  market: CityMarketSeed;
  snapshots: ReadonlyArray<MarketMemoryPricingBackfillSnapshotRow>;
  comparablesBySnapshotId: Map<string, MarketMemoryPricingBackfillComparableRow[]>;
}): Readonly<{
  snapshots: readonly MarketMemoryPricingBackfillSnapshotRow[];
  comparables: readonly MarketMemoryPricingBackfillComparableRow[];
}> {
  const snapshotsById = new Map(
    input.snapshots.map((snapshot) => [snapshot.id, snapshot] as const),
  );
  const snapshotIds = input.market.platformSeeds.flatMap(
    (platformSeed) => platformSeed.snapshotIds,
  );

  return Object.freeze({
    snapshots: snapshotIds
      .map((snapshotId) => snapshotsById.get(snapshotId))
      .filter(
        (snapshot): snapshot is MarketMemoryPricingBackfillSnapshotRow =>
          snapshot != null,
      ),
    comparables: snapshotIds.flatMap(
      (snapshotId) => input.comparablesBySnapshotId.get(snapshotId) ?? [],
    ),
  });
}

async function loadSnapshotsFromSupabase(
  options: PublicIntelligenceBackfillOptions,
): Promise<ReadonlyArray<MarketMemoryPricingBackfillSnapshotRow>> {
  const admin = createSupabaseAdminClient();
  const rows: MarketMemoryPricingBackfillSnapshotRow[] = [];

  for (let offset = 0; ; offset += SNAPSHOT_PAGE_SIZE) {
    let query = admin
      .from("market_snapshots")
      .select("id,country,city,platform,property_type,created_at,metadata")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + SNAPSHOT_PAGE_SIZE - 1);

    if (options.from != null) {
      query = query.gte("created_at", `${options.from}T00:00:00.000Z`);
    }
    if (options.to != null) {
      query = query.lte("created_at", `${options.to}T23:59:59.999Z`);
    }
    if (options.platform != null) {
      query = query.eq("platform", options.platform.trim().toLowerCase());
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Unable to read market_snapshots: ${error.message}`);
    }

    const page = Array.isArray(data)
      ? (data as MarketMemoryPricingBackfillSnapshotRow[])
      : [];
    rows.push(...page);

    if (page.length < SNAPSHOT_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function loadComparablesForSnapshotIdsFromSupabase(
  snapshotIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<MarketMemoryPricingBackfillComparableRow>> {
  if (snapshotIds.length === 0) {
    return [];
  }

  const admin = createSupabaseAdminClient();
  const rows: MarketMemoryPricingBackfillComparableRow[] = [];

  for (const chunk of chunkValues(snapshotIds, SNAPSHOT_ID_CHUNK_SIZE)) {
    for (let offset = 0; ; offset += COMPARABLE_PAGE_SIZE) {
      const { data, error } = await admin
        .from("market_comparables")
        .select(
          "id,snapshot_id,platform,city,country,property_type,nightly_price,currency,created_at,raw,url,title,latitude,longitude",
        )
        .in("snapshot_id", [...chunk])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + COMPARABLE_PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Unable to read market_comparables: ${error.message}`);
      }

      const page = Array.isArray(data)
        ? (data as MarketMemoryPricingBackfillComparableRow[])
        : [];
      rows.push(...page);

      if (page.length < COMPARABLE_PAGE_SIZE) {
        break;
      }
    }
  }

  return rows;
}

function groupPreparedWritesBySourceClass(
  preparedWrites: ReadonlyArray<MarketMemoryPricingBackfillPreparedWrite>,
): Map<
  MarketMemoryPricingBackfillSourceClass,
  MarketMemoryPricingBackfillPreparedWrite[]
> {
  const grouped = new Map<
    MarketMemoryPricingBackfillSourceClass,
    MarketMemoryPricingBackfillPreparedWrite[]
  >();

  for (const preparedWrite of preparedWrites) {
    const current = grouped.get(preparedWrite.sourceClass);
    if (current) {
      current.push(preparedWrite);
      continue;
    }
    grouped.set(preparedWrite.sourceClass, [preparedWrite]);
  }

  return grouped;
}

async function applyPricingPreparedWrites(input: {
  preparedWrites: ReadonlyArray<MarketMemoryPricingBackfillPreparedWrite>;
  writePricingFacts: NonNullable<PublicIntelligenceBackfillDependencies["writePricingFacts"]>;
  queryExistingFactKeys: QueryExistingFactKeys;
  markFactKeysAsExisting?: (factKeys: ReadonlyArray<string>) => void;
}): Promise<{
  inserted: number;
  alreadyExisting: number;
  rejected: number;
  failed: number;
}> {
  const uniqueFactKeys = input.preparedWrites.map(
    (preparedWrite) => preparedWrite.opaqueFactKeyPreview,
  );
  const existingBefore = await input.queryExistingFactKeys(uniqueFactKeys);
  const grouped = groupPreparedWritesBySourceClass(input.preparedWrites);
  let rejected = 0;

  for (const [sourceClass, writes] of grouped) {
    for (const batch of chunkValues(writes, WRITE_BATCH_SIZE)) {
      const result = await input.writePricingFacts(
        {
          sourceClass,
          collectionMode: "live",
          observations: batch.map((entry) => entry.observation),
        },
        {
          env: buildAdminWriterEnv(),
        },
      );

      rejected += result.rejected;

      if (result.status === "success" || result.status === "transformed_only") {
        input.markFactKeysAsExisting?.(
          batch.map((entry) => entry.opaqueFactKeyPreview),
        );
      }
    }
  }

  const existingAfter = await input.queryExistingFactKeys(uniqueFactKeys);
  let inserted = 0;
  for (const factKey of existingAfter) {
    if (!existingBefore.has(factKey)) {
      inserted += 1;
    }
  }

  const alreadyExisting = existingBefore.size;
  const attemptedNew = uniqueFactKeys.length - alreadyExisting;
  const failed = Math.max(0, attemptedNew - inserted);

  return {
    inserted,
    alreadyExisting,
    rejected,
    failed,
  };
}

async function runPricingStage(input: {
  market: CityMarketSeed;
  snapshots: ReadonlyArray<MarketMemoryPricingBackfillSnapshotRow>;
  comparablesBySnapshotId: Map<string, MarketMemoryPricingBackfillComparableRow[]>;
  options: PublicIntelligenceBackfillOptions;
  dependencies: PublicIntelligenceBackfillDependencies;
}): Promise<PricingStageAggregate> {
  const analyzePricingBackfill =
    input.dependencies.analyzePricingBackfill ?? analyzeMarketMemoryPricingBackfillDryRun;
  const writePricingFacts =
    input.dependencies.writePricingFacts ?? writeAnonymousPricingFacts;
  const queryExistingFactKeys =
    input.dependencies.queryExistingFactKeys ?? createDefaultQueryExistingFactKeys();

  let eligible = 0;
  let unique = 0;
  let inserted = 0;
  let alreadyExisting = 0;
  let rejected = 0;
  let failed = 0;
  let technicalFailure = false;
  const propertyTypes = new Set<string>();
  const currencies = new Set<string>();
  const anomalies = new Set<PublicIntelligenceBackfillAnomalyCode>();
  const reasonCodes = new Set<string>();
  const cityPricingInputs = collectCityPricingInputs({
    market: input.market,
    snapshots: input.snapshots,
    comparablesBySnapshotId: input.comparablesBySnapshotId,
  });

  const analysis = analyzePricingBackfill({
    options: buildPricingOptionsForCity({
      options: input.options,
      market: input.market,
    }),
    snapshots: cityPricingInputs.snapshots,
    comparables: cityPricingInputs.comparables,
    identityEnv: process.env,
    referenceNow: input.dependencies.now?.() ?? new Date(),
    includeDiagnostics: input.options.mode === "apply" && input.options.stage !== "artifacts",
  });

  eligible += analysis.report.eligibleCandidates;
  unique += analysis.report.uniqueFactKeys;
  for (const cell of analysis.report.cells) {
    const propertyType = normalizeIntelligencePropertyType(cell.propertyType);
    if (propertyType !== "unknown") {
      propertyTypes.add(propertyType);
    }
    currencies.add(cell.currency);
  }

  if (analysis.report.uniqueFactKeys === 0) {
    anomalies.add("no_compatible_comparables");
  }

  if (input.options.mode === "apply" && input.options.stage !== "artifacts") {
    const preparedWrites = analysis.diagnostics?.preparedWrites ?? [];
    try {
      const applySummary = await applyPricingPreparedWrites({
        preparedWrites,
        writePricingFacts,
        queryExistingFactKeys,
        markFactKeysAsExisting: input.dependencies.markFactKeysAsExisting,
      });
      inserted += applySummary.inserted;
      alreadyExisting += applySummary.alreadyExisting;
      rejected += applySummary.rejected;
      failed += applySummary.failed;
      if (applySummary.failed > 0) {
        reasonCodes.add("pricing_facts_failed");
        technicalFailure = true;
      }
    } catch (error) {
      failed += preparedWrites.length;
      reasonCodes.add("pricing_facts_failed");
      technicalFailure = true;
      const message = error instanceof Error ? error.message : "unknown_pricing_error";
      reasonCodes.add(message.slice(0, 120));
    }
  }

  return Object.freeze({
    eligible,
    unique,
    inserted,
    alreadyExisting,
    rejected,
    failed,
    propertyTypes: sortStrings(propertyTypes),
    currencies: sortStrings(currencies),
    anomalies: Object.freeze([...anomalies].sort()),
    reasonCodes: sortStrings(reasonCodes),
    technicalFailure,
  });
}

async function runPublicStage(input: {
  market: CityMarketSeed;
  propertyTypes: readonly string[];
  options: PublicIntelligenceBackfillOptions;
  dependencies: PublicOverviewRunnerDependencies;
}): Promise<PublicStageAggregate> {
  const currencies = new Set<string>();
  const exactStatus = new Set<string>();
  const broaderMarketStatus = new Set<string>();
  const reasonCodes = new Set<string>();
  let inserted = 0;
  let alreadyExisting = 0;
  let notPublic = 0;
  let failed = 0;
  let technicalFailure = false;

  if (input.propertyTypes.length === 0) {
    return Object.freeze({
      currencies: [],
      exactStatus: [],
      broaderMarketStatus: [],
      inserted: 0,
      alreadyExisting: 0,
      notPublic: 0,
      failed: 0,
      reasonCodes: ["no_public_property_types"],
      technicalFailure: false,
    });
  }

  for (const propertyType of input.propertyTypes) {
    const result = await input.dependencies.buildPublicOverviewBackfill({
      mode: input.options.mode,
      confirmWrite: input.options.confirmWrite,
      country: input.market.country,
      city: input.market.city,
      platform: null,
      platformScope: "all_platforms",
      propertyType,
      currency: null,
      windowDays: 90,
      limit: null,
    });

    if (!result.ok) {
      technicalFailure = true;
      failed += 1;
      reasonCodes.add(result.error.slice(0, 120));
      continue;
    }

    inserted += result.insertedCount;
    alreadyExisting += result.alreadyExistingCount;
    notPublic += result.notPublicCount;
    failed += result.failedCount;
    if (result.failedCount > 0) {
      technicalFailure = true;
    }

    for (const candidate of result.candidates) {
      const status = safeStatusFromCandidate(candidate);
      currencies.add(candidate.currency);
      if (candidate.scope === "exact") {
        exactStatus.add(status);
      }
      if (candidate.scope === "broader_market") {
        broaderMarketStatus.add(status);
      }
      for (const reasonCode of candidate.reasonCodes) {
        reasonCodes.add(reasonCode);
      }
    }
  }

  return Object.freeze({
    currencies: sortStrings(currencies),
    exactStatus: sortStrings(exactStatus),
    broaderMarketStatus: sortStrings(broaderMarketStatus),
    inserted,
    alreadyExisting,
    notPublic,
    failed,
    reasonCodes: sortStrings(reasonCodes),
    technicalFailure,
  });
}

export function parsePublicIntelligenceBackfillCliArgs(
  argv: readonly string[],
): PublicIntelligenceBackfillCliParseResult {
  let mode: PublicIntelligenceBackfillMode = "dry_run";
  let confirmWrite = false;
  let sawDryRun = false;
  let sawApply = false;
  let country: string | null = null;
  let city: string | null = null;
  let platform: string | null = null;
  let stage: PublicIntelligenceBackfillStage = "all";
  let marketLimit: number | null = null;
  let limit: number | null = null;
  let from: string | null = null;
  let to: string | null = null;

  for (const argument of argv) {
    if (argument === "--dry-run") {
      sawDryRun = true;
      mode = "dry_run";
      continue;
    }
    if (argument === "--apply") {
      sawApply = true;
      mode = "apply";
      continue;
    }
    if (argument === "--confirm-write") {
      confirmWrite = true;
      continue;
    }

    const parsedCountry = parseEqualsArgument(argument, "--country");
    if (parsedCountry != null) {
      country = parsedCountry;
      continue;
    }

    const parsedCity = parseEqualsArgument(argument, "--city");
    if (parsedCity != null) {
      city = parsedCity;
      continue;
    }

    const parsedPlatform = parseEqualsArgument(argument, "--platform");
    if (parsedPlatform != null) {
      platform = parsedPlatform;
      continue;
    }

    const parsedStage = parseEqualsArgument(argument, "--stage");
    if (parsedStage != null) {
      if (parsedStage !== "facts" && parsedStage !== "artifacts" && parsedStage !== "all") {
        return { ok: false, error: "Expected --stage to be facts, artifacts, or all." };
      }
      stage = parsedStage;
      continue;
    }

    const parsedMarketLimit = parseEqualsArgument(argument, "--market-limit");
    if (parsedMarketLimit != null) {
      const value = Number(parsedMarketLimit);
      if (!Number.isInteger(value) || value <= 0 || value > MAX_MARKET_LIMIT) {
        return {
          ok: false,
          error: `Expected --market-limit to be a positive integer not greater than ${MAX_MARKET_LIMIT}.`,
        };
      }
      marketLimit = value;
      continue;
    }

    const parsedLimit = parseEqualsArgument(argument, "--limit");
    if (parsedLimit != null) {
      const value = Number(parsedLimit);
      if (!Number.isInteger(value) || value <= 0 || value > MAX_LIMIT) {
        return {
          ok: false,
          error: `Expected --limit to be a positive integer not greater than ${MAX_LIMIT}.`,
        };
      }
      limit = value;
      continue;
    }

    const parsedFrom = parseEqualsArgument(argument, "--from");
    if (parsedFrom != null) {
      if (!isValidIsoDate(parsedFrom)) {
        return { ok: false, error: "Expected --from to be in YYYY-MM-DD format." };
      }
      from = parsedFrom;
      continue;
    }

    const parsedTo = parseEqualsArgument(argument, "--to");
    if (parsedTo != null) {
      if (!isValidIsoDate(parsedTo)) {
        return { ok: false, error: "Expected --to to be in YYYY-MM-DD format." };
      }
      to = parsedTo;
      continue;
    }

    return { ok: false, error: `Unknown argument: ${argument}` };
  }

  if (sawDryRun && sawApply) {
    return { ok: false, error: "Cannot combine --dry-run and --apply." };
  }

  if (mode === "apply" && !confirmWrite) {
    return { ok: false, error: "--apply requires --confirm-write." };
  }

  if (city != null && country == null) {
    return { ok: false, error: "--city requires --country." };
  }

  if (platform != null) {
    const normalizedPlatform = normalizeIntelligencePlatform(platform);
    if (normalizedPlatform === "unknown") {
      return {
        ok: false,
        error: "Expected --platform to be one of airbnb, booking, expedia, agoda, or vrbo.",
      };
    }
    platform = normalizedPlatform;
  }

  if (country != null) {
    const normalizedCountry = canonicalizeMarketCountry(country);
    if (normalizedCountry === "unknown") {
      return { ok: false, error: "Unable to normalize --country." };
    }
    country = normalizedCountry;
  }

  if (city != null) {
    const normalizedCity = canonicalizeMarketCity(city);
    if (normalizedCity === "unknown") {
      return { ok: false, error: "Unable to normalize --city." };
    }
    city = normalizedCity;
  }

  if (from != null && to != null) {
    const fromMs = Date.parse(`${from}T00:00:00.000Z`);
    const toMs = Date.parse(`${to}T23:59:59.999Z`);
    if (fromMs > toMs) {
      return { ok: false, error: "--from must be earlier than or equal to --to." };
    }
  }

  return {
    ok: true,
    options: Object.freeze({
      mode,
      confirmWrite,
      country,
      city,
      platform,
      stage,
      marketLimit,
      limit,
      from,
      to,
    }),
  };
}

export async function runPublicIntelligenceBackfill(
  options: PublicIntelligenceBackfillOptions,
  dependencies: PublicIntelligenceBackfillDependencies = {},
): Promise<PublicIntelligenceBackfillResult> {
  try {
    const loadSnapshots = dependencies.loadSnapshots ?? loadSnapshotsFromSupabase;
    const loadComparablesForSnapshotIds =
      dependencies.loadComparablesForSnapshotIds ??
      loadComparablesForSnapshotIdsFromSupabase;
    const snapshots = await loadSnapshots(options);
    const comparables = await loadComparablesForSnapshotIds(
      snapshots.map((snapshot) => snapshot.id),
    );

    const discovery = discoverMarkets({
      snapshots,
      comparables,
      options,
    });

    const comparablesBySnapshotId = buildComparableIndex(comparables);
    const marketResults: PublicIntelligenceBackfillMarketResult[] = [];
    let marketsPublic = 0;
    let marketsInsufficient = 0;
    let marketsFailed = 0;
    let factsInserted = 0;
    let factsAlreadyExisting = 0;
    let artifactsInserted = 0;
    let artifactsAlreadyExisting = 0;

    for (const market of discovery.markets) {
      const marketReasonCodes = new Set<string>();
      const marketAnomalies = new Set<PublicIntelligenceBackfillAnomalyCode>();
      let technicalFailure = false;

      const pricingStage =
        options.stage === "artifacts"
          ? Object.freeze<PricingStageAggregate>({
              eligible: 0,
              unique: 0,
              inserted: 0,
              alreadyExisting: 0,
              rejected: 0,
              failed: 0,
              propertyTypes: [],
              currencies: [],
              anomalies: [],
              reasonCodes: [],
              technicalFailure: false,
            })
          : await runPricingStage({
              market,
              snapshots,
              comparablesBySnapshotId,
              options,
              dependencies,
            });

      for (const anomaly of pricingStage.anomalies) {
        marketAnomalies.add(anomaly);
      }
      for (const reasonCode of pricingStage.reasonCodes) {
        marketReasonCodes.add(reasonCode);
      }
      technicalFailure ||= pricingStage.technicalFailure;

      let propertyTypes = pricingStage.propertyTypes;
      if (options.stage === "artifacts" && propertyTypes.length === 0) {
        const inferredPropertyTypes = new Set<string>();
        const cityPricingInputs = collectCityPricingInputs({
          market,
          snapshots,
          comparablesBySnapshotId,
        });
        const analysis =
          (dependencies.analyzePricingBackfill ?? analyzeMarketMemoryPricingBackfillDryRun)({
            options: buildPricingOptionsForCity({ options, market }),
            snapshots: cityPricingInputs.snapshots,
            comparables: cityPricingInputs.comparables,
            identityEnv: process.env,
            referenceNow: dependencies.now?.() ?? new Date(),
            includeDiagnostics: false,
          });
        for (const cell of analysis.report.cells) {
          const propertyType = normalizeIntelligencePropertyType(cell.propertyType);
          if (propertyType !== "unknown") {
            inferredPropertyTypes.add(propertyType);
          }
        }
        propertyTypes = sortStrings(inferredPropertyTypes);
      }

      const publicStage =
        options.stage === "facts" || (options.mode === "apply" && pricingStage.failed > 0)
          ? Object.freeze<PublicStageAggregate>({
              currencies: [],
              exactStatus: [],
              broaderMarketStatus: [],
              inserted: 0,
              alreadyExisting: 0,
              notPublic: 0,
              failed: 0,
              reasonCodes:
                options.mode === "apply" && pricingStage.failed > 0
                  ? ["pricing_facts_failed"]
                  : [],
              technicalFailure: false,
            })
          : await runPublicStage({
              market,
              propertyTypes,
              options,
              dependencies: {
                buildPublicOverviewBackfill:
                  dependencies.buildPublicOverviewBackfill ??
                  buildPublicMarketOverviewBackfill,
              },
            });

      if (options.stage !== "facts" && propertyTypes.length === 0) {
        marketAnomalies.add("no_public_property_types");
      }

      for (const reasonCode of publicStage.reasonCodes) {
        marketReasonCodes.add(reasonCode);
      }
      technicalFailure ||= publicStage.technicalFailure;

      factsInserted += pricingStage.inserted;
      factsAlreadyExisting += pricingStage.alreadyExisting;
      artifactsInserted += publicStage.inserted;
      artifactsAlreadyExisting += publicStage.alreadyExisting;

      const hasPublicStatus =
        publicStage.exactStatus.some(
          (status) =>
            status === "public_usable" || status === "public_usable_with_limits",
        ) ||
        publicStage.broaderMarketStatus.some(
          (status) =>
            status === "public_usable" || status === "public_usable_with_limits",
        );

      if (technicalFailure) {
        marketsFailed += 1;
      } else if (hasPublicStatus) {
        marketsPublic += 1;
      } else {
        marketsInsufficient += 1;
      }

      marketResults.push(
        Object.freeze({
          market: Object.freeze({
            country: market.country,
            city: market.city,
            platforms: market.platforms,
          }),
          snapshotsScanned: market.snapshotsScanned,
          comparablesScanned: market.comparablesScanned,
          pricingFacts: Object.freeze({
            eligible: pricingStage.eligible,
            unique: pricingStage.unique,
            inserted: pricingStage.inserted,
            alreadyExisting: pricingStage.alreadyExisting,
            rejected: pricingStage.rejected,
            failed: pricingStage.failed,
          }),
          publicOverview: Object.freeze({
            currencies: publicStage.currencies,
            exactStatus: publicStage.exactStatus,
            broaderMarketStatus: publicStage.broaderMarketStatus,
            inserted: publicStage.inserted,
            alreadyExisting: publicStage.alreadyExisting,
            notPublic: publicStage.notPublic,
            failed: publicStage.failed,
          }),
          anomalies: Object.freeze([...marketAnomalies].sort()),
          reasonCodes: sortStrings(marketReasonCodes),
          technicalFailure,
        }),
      );
    }

    return Object.freeze({
      ok: true,
      options,
      marketsDiscovered: discovery.markets.length,
      marketsProcessed: marketResults.length,
      marketsPublic,
      marketsInsufficient,
      marketsFailed,
      factsInserted,
      factsAlreadyExisting,
      artifactsInserted,
      artifactsAlreadyExisting,
      geographyRecoveries: discovery.geographyRecoveries,
      markets: Object.freeze(marketResults),
      anomalies: discovery.anomalies,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown public intelligence failure.",
    };
  }
}

export function formatPublicIntelligenceBackfillResult(
  result: Extract<PublicIntelligenceBackfillResult, { ok: true }>,
): string {
  const lines: string[] = [];

  for (const market of result.markets) {
    lines.push(
      `${market.market.country} | ${market.market.city} | ${market.market.platforms.join(",")}`,
    );
    lines.push(`Snapshots: ${market.snapshotsScanned}`);
    lines.push(`Comparables: ${market.comparablesScanned}`);
    lines.push(`Pricing facts eligible: ${market.pricingFacts.eligible}`);
    lines.push(`Pricing facts unique: ${market.pricingFacts.unique}`);
    lines.push(`Pricing facts inserted: ${market.pricingFacts.inserted}`);
    lines.push(`Pricing facts already existing: ${market.pricingFacts.alreadyExisting}`);
    lines.push(`Pricing facts rejected: ${market.pricingFacts.rejected}`);
    lines.push(`Pricing facts failed: ${market.pricingFacts.failed}`);

    const publicStatuses = [
      ...market.publicOverview.exactStatus,
      ...market.publicOverview.broaderMarketStatus,
    ];
    lines.push(
      `Public overview: ${
        publicStatuses.length > 0 ? publicStatuses.join(", ") : "none"
      }`,
    );
    lines.push(`Artifacts inserted: ${market.publicOverview.inserted}`);
    lines.push(
      `Artifacts already existing: ${market.publicOverview.alreadyExisting}`,
    );
    lines.push(`Artifacts not public: ${market.publicOverview.notPublic}`);
    lines.push(`Artifacts failed: ${market.publicOverview.failed}`);

    if (market.anomalies.length > 0) {
      lines.push(`Anomalies: ${market.anomalies.join(", ")}`);
    }
    if (market.reasonCodes.length > 0) {
      lines.push(`Reason codes: ${market.reasonCodes.join(", ")}`);
    }
    lines.push("");
  }

  lines.push(`Markets discovered: ${result.marketsDiscovered}`);
  lines.push(`Markets processed: ${result.marketsProcessed}`);
  lines.push(`Markets public: ${result.marketsPublic}`);
  lines.push(`Markets insufficient: ${result.marketsInsufficient}`);
  lines.push(`Markets failed: ${result.marketsFailed}`);
  lines.push(`Facts inserted: ${result.factsInserted}`);
  lines.push(`Facts already existing: ${result.factsAlreadyExisting}`);
  lines.push(`Artifacts inserted: ${result.artifactsInserted}`);
  lines.push(`Artifacts already existing: ${result.artifactsAlreadyExisting}`);
  lines.push("");
  lines.push("Geography recoveries:");
  lines.push(
    `- country_inferred_from_known_city: ${result.geographyRecoveries.countryInferredFromKnownCity}`,
  );

  if (result.anomalies.length > 0) {
    lines.push("");
    lines.push("Global anomalies:");
    for (const anomaly of result.anomalies) {
      lines.push(
        `- ${anomaly.market.country} | ${anomaly.market.city} | ${anomaly.market.platform} | ${anomaly.code} | snapshots=${anomaly.snapshots} | comparables=${anomaly.comparables}`,
      );
    }
  }

  return lines.join("\n");
}
