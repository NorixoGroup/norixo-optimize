import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import {
  buildMarketCellV1,
  normalizeCurrency,
  normalizeIntelligencePlatform,
  normalizeIntelligencePropertyType,
  type IntelligenceV2Platform,
  type IntelligenceV2PropertyType,
} from "./marketCell";
import {
  PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT,
  buildPublicMarketOverviewDatabaseRow,
  buildPublicMarketOverviewArtifactKey,
  type PublicMarketOverviewArtifact,
  type PublicMarketOverviewArtifactPlatform,
  type PublicMarketOverviewPlatformScope,
  type PublicMarketOverviewPersistableArtifactRow,
  type PublicMarketOverviewPropertyScope,
  type PublicMarketOverviewReasonCode,
} from "./publicMarketOverviewContract";
import {
  evaluatePublicMarketOverviewGovernance,
  type PublicMarketOverviewGovernanceResult,
} from "./publicMarketOverviewGovernance";
import {
  computePricingDistribution,
  deriveSourceDiversityBand,
  type PricingBenchmarkDistribution,
} from "./pricingBenchmarkBuilder";

const DAY_MS = 24 * 60 * 60 * 1000;
export const PUBLIC_MARKET_OVERVIEW_WINDOW_DAYS = 90;
const MONTH_BUCKET_REGEX = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

export type PublicMarketOverviewBuilderInput = Readonly<{
  country: string;
  city: string;
  platform?: string | null;
  platformScope?: PublicMarketOverviewPlatformScope;
  propertyType?: string | null;
  currency: string;
  propertyScope: PublicMarketOverviewPropertyScope;
  dryRun?: boolean;
}>;

export type PublicMarketOverviewFactRow = Readonly<{
  country: string;
  city: string;
  platform: string;
  property_type: string;
  capacity_band: string;
  currency: string;
  market_cell_key: string;
  normalized_nightly_price: number;
  source_class: string;
  capture_period_bucket: string;
  created_at: string;
  fact_contract_version: string;
  transformation_policy_version: string;
  eligibility_policy_version: string;
  deduplication_policy_version: string;
  market_cell_policy_version: string;
  confidence_policy_version: string;
  freshness_policy_version: string;
  pricing_normalization_policy_version: string;
}>;

export type PublicMarketOverviewWindow = Readonly<{
  windowStartedAt: Date;
  windowEndedAt: Date;
  capturePeriodBuckets: readonly string[];
}>;

export type PublicMarketOverviewLoadFactsInput = Readonly<{
  country: string;
  city: string;
  platform: Exclude<IntelligenceV2Platform, "unknown"> | null;
  platformScope: PublicMarketOverviewPlatformScope;
  propertyType: IntelligenceV2PropertyType;
  currency: string;
  propertyScope: PublicMarketOverviewPropertyScope;
  windowStartedAt: string;
  windowEndedAt: string;
  capturePeriodBuckets: readonly string[];
}>;

export type PublicMarketOverviewBuilderDependencies = Readonly<{
  loadFacts?: (
    input: PublicMarketOverviewLoadFactsInput,
  ) => Promise<
    | Readonly<{ ok: true; rows: ReadonlyArray<PublicMarketOverviewFactRow> }>
    | Readonly<{ ok: false }>
  >;
  evaluateGovernance?: (
    input: Parameters<typeof evaluatePublicMarketOverviewGovernance>[0],
  ) => PublicMarketOverviewGovernanceResult;
  now?: () => Date;
}>;

export type PublicMarketOverviewBuilderResult =
  | Readonly<{
      available: true;
      status: "dry_run";
      artifact: PublicMarketOverviewArtifact;
      persistableArtifact: PublicMarketOverviewPersistableArtifactRow;
      rawSampleSize: number;
      includedSampleSize: number;
      sourceClassCount: number;
      distinctCapturePeriods: number;
      reasonCodes: readonly [];
    }>
  | Readonly<{
      available: false;
      status: "invalid_input" | "not_public" | "database_error";
      reasonCodes: readonly PublicMarketOverviewReasonCode[];
      rawSampleSize: number;
      includedSampleSize: number;
      sourceClassCount: number;
      distinctCapturePeriods: number;
      limitationCodes: readonly string[];
      windowStartedAt: string | null;
      windowEndedAt: string | null;
    }>;

type NormalizedBuilderInput = Readonly<{
  country: string;
  city: string;
  platform: PublicMarketOverviewArtifactPlatform;
  platformScope: PublicMarketOverviewPlatformScope;
  propertyType: IntelligenceV2PropertyType;
  currency: string;
  propertyScope: PublicMarketOverviewPropertyScope;
}>;

function uniqueSortedStrings<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort() as T[];
}

function normalizeRequiredString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toUtcStartOfDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function toUtcMonthBucket(date: Date): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

function roundPublicMoney(value: number): number {
  return Math.round(value);
}

function roundDistributionForPublic(
  distribution: PricingBenchmarkDistribution,
): PricingBenchmarkDistribution {
  const p10Price = roundPublicMoney(distribution.p10Price);
  const p25Price = Math.max(p10Price, roundPublicMoney(distribution.p25Price));
  const medianPrice = Math.max(p25Price, roundPublicMoney(distribution.medianPrice));
  const p75Price = Math.max(medianPrice, roundPublicMoney(distribution.p75Price));
  const p90Price = Math.max(p75Price, roundPublicMoney(distribution.p90Price));

  return Object.freeze({
    p10Price,
    p25Price,
    medianPrice,
    p75Price,
    p90Price,
  });
}

function normalizeKeyPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function buildPublicOverviewMarketCellKey(input: {
  country: string;
  city: string;
  platform: PublicMarketOverviewArtifactPlatform;
  propertyType: IntelligenceV2PropertyType;
  currency: string;
}): string {
  return [
    "v1",
    normalizeKeyPart(input.country),
    normalizeKeyPart(input.city),
    normalizeKeyPart(input.platform),
    normalizeKeyPart(input.propertyType),
    "unknown",
    normalizeKeyPart(input.currency),
  ].join("|");
}

function listOverlappingMonthBuckets(
  windowStartedAt: Date,
  windowEndedAt: Date,
): string[] {
  const buckets: string[] = [];
  let cursor = new Date(
    Date.UTC(
      windowStartedAt.getUTCFullYear(),
      windowStartedAt.getUTCMonth(),
      1,
    ),
  );
  const end = new Date(
    Date.UTC(windowEndedAt.getUTCFullYear(), windowEndedAt.getUTCMonth(), 1),
  );

  while (cursor.getTime() <= end.getTime()) {
    buckets.push(toUtcMonthBucket(cursor));
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }

  return buckets;
}

export function buildPublicMarketOverviewWindow(now: Date): PublicMarketOverviewWindow {
  const windowEndedAt = toUtcStartOfDay(now);
  const windowStartedAt = new Date(
    windowEndedAt.getTime() - PUBLIC_MARKET_OVERVIEW_WINDOW_DAYS * DAY_MS,
  );

  return Object.freeze({
    windowStartedAt,
    windowEndedAt,
    capturePeriodBuckets: listOverlappingMonthBuckets(
      windowStartedAt,
      windowEndedAt,
    ),
  });
}

function normalizeInput(
  input: PublicMarketOverviewBuilderInput,
): NormalizedBuilderInput | null {
  const propertyTypeProvided =
    typeof input.propertyType === "string" && input.propertyType.trim().length > 0;
  const platformScope =
    input.platformScope === "single_platform" ||
    input.platformScope === "all_platforms"
      ? input.platformScope
      : "single_platform";
  const baseMarket = buildMarketCellV1({
    country: input.country,
    city: input.city,
    platform: platformScope === "all_platforms" ? "airbnb" : input.platform,
    propertyType: input.propertyType ?? undefined,
    currency: input.currency,
  });

  const propertyScope =
    input.propertyScope === "exact" || input.propertyScope === "broader_market"
      ? input.propertyScope
      : null;

  if (
    propertyScope == null ||
    baseMarket.country === "unknown" ||
    baseMarket.city === "unknown" ||
    baseMarket.currency === "UNKNOWN"
  ) {
    return null;
  }

  if (platformScope === "single_platform" && baseMarket.platform === "unknown") {
    return null;
  }

  if (propertyScope === "exact" && baseMarket.propertyType === "unknown") {
    return null;
  }

  if (
    propertyScope === "broader_market" &&
    propertyTypeProvided &&
    baseMarket.propertyType === "unknown"
  ) {
    return null;
  }

  const normalizedPlatform: PublicMarketOverviewArtifactPlatform =
    platformScope === "all_platforms"
      ? "all"
      : (baseMarket.platform as Exclude<IntelligenceV2Platform, "unknown">);

  return Object.freeze({
    country: baseMarket.country,
    city: baseMarket.city,
    platform: normalizedPlatform,
    platformScope,
    propertyType: baseMarket.propertyType,
    currency: baseMarket.currency,
    propertyScope,
  });
}

function hasSinglePolicyFamily(
  rows: ReadonlyArray<PublicMarketOverviewFactRow>,
): boolean {
  const policyFamilies = new Set(
    rows.map((row) =>
      [
        row.fact_contract_version,
        row.transformation_policy_version,
        row.eligibility_policy_version,
        row.deduplication_policy_version,
        row.market_cell_policy_version,
        row.confidence_policy_version,
        row.freshness_policy_version,
        row.pricing_normalization_policy_version,
      ].join("|"),
    ),
  );
  return policyFamilies.size <= 1;
}

export function selectPublicMarketOverviewRows(input: Readonly<{
  rows: ReadonlyArray<PublicMarketOverviewFactRow>;
  country: string;
  city: string;
  platform: PublicMarketOverviewArtifactPlatform;
  platformScope: PublicMarketOverviewPlatformScope;
  propertyType: IntelligenceV2PropertyType;
  currency: string;
  propertyScope: PublicMarketOverviewPropertyScope;
  capturePeriodBuckets: readonly string[];
}>): PublicMarketOverviewFactRow[] {
  const bucketSet = new Set(
    input.capturePeriodBuckets.filter((bucket) => MONTH_BUCKET_REGEX.test(bucket)),
  );

  return input.rows.filter((row) => {
    const capturePeriodBucket = normalizeRequiredString(row.capture_period_bucket);
    if (capturePeriodBucket == null || !bucketSet.has(capturePeriodBucket)) {
      return false;
    }

    if (
      row.country !== input.country ||
      row.city !== input.city ||
      normalizeCurrency(row.currency) !== input.currency
    ) {
      return false;
    }

    if (input.platformScope === "single_platform" && row.platform !== input.platform) {
      return false;
    }

    if (input.propertyScope === "exact") {
      return (
        normalizeIntelligencePropertyType(row.property_type) === input.propertyType
      );
    }

    return true;
  });
}

async function loadFactsFromSupabase(
  input: PublicMarketOverviewLoadFactsInput,
): Promise<
  | Readonly<{ ok: true; rows: ReadonlyArray<PublicMarketOverviewFactRow> }>
  | Readonly<{ ok: false }>
> {
  try {
    const admin = createSupabaseAdminClient();
    let query = admin
      .from("anonymous_fact_groups")
      .select(
        [
          "country",
          "city",
          "platform",
          "property_type",
          "capacity_band",
          "currency",
          "market_cell_key",
          "normalized_nightly_price",
          "source_class",
          "capture_period_bucket",
          "created_at",
          "fact_contract_version",
          "transformation_policy_version",
          "eligibility_policy_version",
          "deduplication_policy_version",
          "market_cell_policy_version",
          "confidence_policy_version",
          "freshness_policy_version",
          "pricing_normalization_policy_version",
        ].join(","),
      )
      .eq("metric_family", "pricing")
      .eq("country", input.country)
      .eq("city", input.city)
      .eq("currency", input.currency)
      .in("capture_period_bucket", [...input.capturePeriodBuckets])
      .order("capture_period_bucket", { ascending: true })
      .order("created_at", { ascending: true });

    if (input.platformScope === "single_platform" && input.platform != null) {
      query = query.eq("platform", input.platform);
    }

    if (input.propertyScope === "exact" && input.propertyType !== "unknown") {
      query = query.eq("property_type", input.propertyType);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) {
      return { ok: false };
    }

    return {
      ok: true,
      rows: data as unknown as PublicMarketOverviewFactRow[],
    };
  } catch {
    return { ok: false };
  }
}

function buildUnavailableResult(input: {
  status: "invalid_input" | "not_public" | "database_error";
  reasonCodes: readonly PublicMarketOverviewReasonCode[];
  rawSampleSize?: number;
  includedSampleSize?: number;
  sourceClassCount?: number;
  distinctCapturePeriods?: number;
  limitationCodes?: readonly string[];
  windowStartedAt?: string | null;
  windowEndedAt?: string | null;
}): PublicMarketOverviewBuilderResult {
  return Object.freeze({
    available: false,
    status: input.status,
    reasonCodes: uniqueSortedStrings(input.reasonCodes),
    rawSampleSize: input.rawSampleSize ?? 0,
    includedSampleSize: input.includedSampleSize ?? 0,
    sourceClassCount: input.sourceClassCount ?? 0,
    distinctCapturePeriods: input.distinctCapturePeriods ?? 0,
    limitationCodes: input.limitationCodes ?? [],
    windowStartedAt: input.windowStartedAt ?? null,
    windowEndedAt: input.windowEndedAt ?? null,
  });
}

export async function buildPublicMarketOverviewArtifact(
  input: PublicMarketOverviewBuilderInput,
  dependencies: PublicMarketOverviewBuilderDependencies = {},
): Promise<PublicMarketOverviewBuilderResult> {
  const now = dependencies.now?.() ?? new Date();
  const normalized = normalizeInput(input);
  const window = buildPublicMarketOverviewWindow(now);
  const windowStartedAtIso = toIsoString(window.windowStartedAt);
  const windowEndedAtIso = toIsoString(window.windowEndedAt);

  if (normalized == null) {
    return buildUnavailableResult({
      status: "invalid_input",
      reasonCodes: ["invalid_input", "unsupported_market"],
      windowStartedAt: windowStartedAtIso,
      windowEndedAt: windowEndedAtIso,
    });
  }

  const loadFacts = dependencies.loadFacts ?? loadFactsFromSupabase;
  const loadResult = await loadFacts({
    country: normalized.country,
    city: normalized.city,
    platform:
      normalized.platformScope === "single_platform"
        ? (normalized.platform as Exclude<IntelligenceV2Platform, "unknown">)
        : null,
    platformScope: normalized.platformScope,
    propertyType: normalized.propertyType,
    currency: normalized.currency,
    propertyScope: normalized.propertyScope,
    windowStartedAt: windowStartedAtIso,
    windowEndedAt: windowEndedAtIso,
    capturePeriodBuckets: window.capturePeriodBuckets,
  });

  if (!loadResult.ok) {
    return buildUnavailableResult({
      status: "database_error",
      reasonCodes: ["invalid_input"],
      windowStartedAt: windowStartedAtIso,
      windowEndedAt: windowEndedAtIso,
    });
  }

  const rows = selectPublicMarketOverviewRows({
    rows: loadResult.rows,
    country: normalized.country,
    city: normalized.city,
    platform: normalized.platform,
    platformScope: normalized.platformScope,
    propertyType: normalized.propertyType,
    currency: normalized.currency,
    propertyScope: normalized.propertyScope,
    capturePeriodBuckets: window.capturePeriodBuckets,
  });

  const rawSampleSize = rows.length;
  const includedSampleSize = rows.length;
  const sourceClassCount = new Set(rows.map((row) => row.source_class)).size;
  const distinctCapturePeriods = new Set(
    rows
      .map((row) => normalizeRequiredString(row.capture_period_bucket))
      .filter((value): value is string => value != null && MONTH_BUCKET_REGEX.test(value)),
  ).size;

  if (rows.length === 0) {
    return buildUnavailableResult({
      status: "not_public",
      reasonCodes: ["no_facts_in_window"],
      rawSampleSize,
      includedSampleSize,
      sourceClassCount,
      distinctCapturePeriods,
      windowStartedAt: windowStartedAtIso,
      windowEndedAt: windowEndedAtIso,
    });
  }

  if (!hasSinglePolicyFamily(rows)) {
    return buildUnavailableResult({
      status: "invalid_input",
      reasonCodes: ["mixed_policy_versions"],
      rawSampleSize,
      includedSampleSize,
      sourceClassCount,
      distinctCapturePeriods,
      windowStartedAt: windowStartedAtIso,
      windowEndedAt: windowEndedAtIso,
    });
  }

  const prices = rows.map((row) => Number(row.normalized_nightly_price));
  const distribution = computePricingDistribution(prices);
  if (distribution == null) {
    return buildUnavailableResult({
      status: "invalid_input",
      reasonCodes: ["invalid_distribution"],
      rawSampleSize,
      includedSampleSize,
      sourceClassCount,
      distinctCapturePeriods,
      windowStartedAt: windowStartedAtIso,
      windowEndedAt: windowEndedAtIso,
    });
  }

  const roundedDistribution = roundDistributionForPublic(distribution);
  const governanceEvaluator =
    dependencies.evaluateGovernance ?? evaluatePublicMarketOverviewGovernance;
  const governance = governanceEvaluator({
    platformScope: normalized.platformScope,
    propertyScope: normalized.propertyScope,
    capacityScope: "all_capacities",
    includedSampleSize,
    sourceClassCount,
    distinctCapturePeriods,
    p25: roundedDistribution.p25Price,
    median: roundedDistribution.medianPrice,
    p75: roundedDistribution.p75Price,
    windowEndedAt: windowEndedAtIso,
    evaluatedAt: now.toISOString(),
  });

  if (!governance.public) {
    return buildUnavailableResult({
      status: "not_public",
      reasonCodes: governance.reasonCodes,
      rawSampleSize,
      includedSampleSize,
      sourceClassCount,
      distinctCapturePeriods,
      limitationCodes: governance.limitationCodes,
      windowStartedAt: windowStartedAtIso,
      windowEndedAt: windowEndedAtIso,
    });
  }

  const capturePeriodBucket = toUtcMonthBucket(window.windowEndedAt);
  const sourceDiversityBand = deriveSourceDiversityBand(sourceClassCount);
  const platform = normalized.platform;
  const propertyType = normalizeIntelligencePropertyType(normalized.propertyType);

  if (
    (platform !== "all" && normalizeIntelligencePlatform(platform) === "unknown") ||
    (normalized.propertyScope === "exact" && propertyType === "unknown") ||
    (sourceDiversityBand !== "low" && sourceDiversityBand !== "moderate")
  ) {
    return buildUnavailableResult({
      status: "invalid_input",
      reasonCodes: ["invalid_input"],
      rawSampleSize,
      includedSampleSize,
      sourceClassCount,
      distinctCapturePeriods,
      limitationCodes: governance.limitationCodes,
      windowStartedAt: windowStartedAtIso,
      windowEndedAt: windowEndedAtIso,
    });
  }

  const artifactKey = buildPublicMarketOverviewArtifactKey({
    country: normalized.country,
    city: normalized.city,
    platform,
    platformScope: normalized.platformScope,
    propertyType,
    currency: normalized.currency,
    propertyScope: normalized.propertyScope,
    windowStartedAt: windowStartedAtIso,
    windowEndedAt: windowEndedAtIso,
    capturePeriodBucket,
    p10: roundedDistribution.p10Price,
    p25: roundedDistribution.p25Price,
    median: roundedDistribution.medianPrice,
    p75: roundedDistribution.p75Price,
    p90: roundedDistribution.p90Price,
    rawSampleSize,
    includedSampleSize,
    sourceClassCount,
    sourceDiversityBand,
    sampleBand: governance.sampleBand,
    confidence: governance.confidence,
    freshnessStatus: governance.freshnessStatus,
    limitationCodes: governance.limitationCodes,
  });

  if (artifactKey == null) {
    return buildUnavailableResult({
      status: "invalid_input",
      reasonCodes: ["invalid_input"],
      rawSampleSize,
      includedSampleSize,
      sourceClassCount,
      distinctCapturePeriods,
      limitationCodes: governance.limitationCodes,
      windowStartedAt: windowStartedAtIso,
      windowEndedAt: windowEndedAtIso,
    });
  }

  const marketCellKey = buildPublicOverviewMarketCellKey({
    country: normalized.country,
    city: normalized.city,
    platform: normalized.platform,
    propertyType,
    currency: normalized.currency,
  });
  const validityEnd = new Date(window.windowEndedAt.getTime() + 30 * DAY_MS);

  const artifact: PublicMarketOverviewArtifact = Object.freeze({
    publicContractVersion: PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.publicContractVersion,
    artifactKey,
    intendedUse: "public_market_overview",
    aggregationWindow: "rolling_90_days",
    platformScope: normalized.platformScope,
    capacityScope: "all_capacities",
    propertyScope: normalized.propertyScope,
    country: normalized.country,
    city: normalized.city,
    platform: normalized.platform,
    propertyType,
    currency: normalized.currency,
    capturePeriodBucket,
    windowStartedAt: windowStartedAtIso,
    windowEndedAt: windowEndedAtIso,
    p25: roundedDistribution.p25Price,
    median: roundedDistribution.medianPrice,
    p75: roundedDistribution.p75Price,
    sampleBand: governance.sampleBand,
    confidence: governance.confidence,
    freshnessStatus: governance.freshnessStatus,
    exposureStatus: governance.exposureStatus,
    limitationCodes: governance.limitationCodes,
    policyVersions: Object.freeze({
      contractVersion: PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.publicContractVersion,
      aggregationPolicyVersion:
        PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.publicAggregationPolicyVersion,
      governancePolicyVersion:
        PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.publicGovernancePolicyVersion,
      marketCellPolicyVersion:
        PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.marketCellPolicyVersion,
    }),
  });

  const persistableArtifact: PublicMarketOverviewPersistableArtifactRow =
    buildPublicMarketOverviewDatabaseRow({
      artifact,
      marketCellKey,
      sourcePeriodStart: toDateOnly(window.windowStartedAt),
      sourcePeriodEnd: toDateOnly(window.windowEndedAt),
      sourceClassCount,
      sourceDiversityBand,
      p10Price: roundedDistribution.p10Price,
      p25Price: roundedDistribution.p25Price,
      medianPrice: roundedDistribution.medianPrice,
      p75Price: roundedDistribution.p75Price,
      p90Price: roundedDistribution.p90Price,
      rawSampleSize,
      includedSampleSize,
      excludedOutlierCount: 0,
      outlierPolicyVersion: PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.outlierPolicyVersion,
      confidencePolicyVersion:
        PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.publicGovernancePolicyVersion,
      freshnessPolicyVersion:
        PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.publicGovernancePolicyVersion,
      cohortDefinitionVersion:
        PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.cohortDefinitionVersion,
      cohortPolicyVersion:
        PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.cohortPolicyVersion,
      aggregationPolicyVersion:
        PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.publicAggregationPolicyVersion,
      approvalPolicyVersion:
        PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.publicGovernancePolicyVersion,
      marketCellPolicyVersion:
        PUBLIC_MARKET_OVERVIEW_POLICY_CONTEXT.marketCellPolicyVersion,
      validFrom: windowEndedAtIso,
      validUntil: validityEnd.toISOString(),
    });

  return Object.freeze({
    available: true,
    status: "dry_run",
    artifact,
    persistableArtifact,
    rawSampleSize,
    includedSampleSize,
    sourceClassCount,
    distinctCapturePeriods,
    reasonCodes: [] as const,
  });
}
