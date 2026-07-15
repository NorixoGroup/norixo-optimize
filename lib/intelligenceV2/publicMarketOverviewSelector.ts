import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import {
  buildMarketCellV1,
  type IntelligenceV2Platform,
  type IntelligenceV2PropertyType,
} from "./marketCell";
import type {
  PublicMarketOverviewArtifactPlatform,
  PublicMarketOverviewConfidence,
  PublicMarketOverviewLimitationCode,
  PublicMarketOverviewPlatformScope,
  PublicMarketOverviewPropertyScope,
  PublicMarketOverviewSampleBand,
} from "./publicMarketOverviewContract";

const PRICING_BENCHMARK_TYPE = "pricing_distribution";
const ARTIFACT_PLATFORM_VALUES = new Set(["airbnb", "booking", "expedia", "agoda", "vrbo", "all"]);
const PROPERTY_TYPE_VALUES = new Set([
  "studio",
  "apartment",
  "villa",
  "riad",
  "room",
  "hotel",
  "unknown",
]);
const CAPACITY_SCOPE_VALUES = new Set(["all_capacities"]);
const PROPERTY_SCOPE_VALUES = new Set(["exact", "broader_market"]);
const PLATFORM_SCOPE_VALUES = new Set(["single_platform", "all_platforms"]);
const AGGREGATION_WINDOW_VALUES = new Set(["rolling_90_days"]);
const CONFIDENCE_LEVEL_VALUES = new Set(["moderate", "high"]);
const MONTH_BUCKET_REGEX = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

export type PublicMarketOverviewSelectionInput = Readonly<{
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  now?: () => Date;
}>;

export type PublicMarketOverviewEvidence = Readonly<{
  status: "available";
  market: Readonly<{
    country: string;
    city: string;
    platform: PublicMarketOverviewArtifactPlatform;
    platformScope: PublicMarketOverviewPlatformScope;
    requestedPropertyType: Exclude<IntelligenceV2PropertyType, "unknown">;
    resolvedPropertyType: IntelligenceV2PropertyType;
    propertyScope: "exact" | "broader_market";
    capacityScope: "all_capacities";
  }>;
  benchmark: Readonly<{
    p25: number;
    median: number;
    p75: number;
    currency: string;
  }>;
  confidence: PublicMarketOverviewConfidence;
  sampleBand: PublicMarketOverviewSampleBand;
  limitationCodes: readonly PublicMarketOverviewLimitationCode[];
  sourceWindow: Readonly<{
    aggregationWindow: "rolling_90_days";
    validFrom: string;
    validUntil: string;
  }>;
}>;

export type PublicMarketOverviewSelectionReasonCode =
  | "invalid_input"
  | "database_read_error"
  | "no_public_artifact"
  | "ambiguous_currency"
  | "artifact_not_currently_valid"
  | "artifact_invalid_distribution"
  | "artifact_malformed";

export type PublicMarketOverviewSelectorResult =
  | PublicMarketOverviewEvidence
  | Readonly<{
      status: "insufficient_coverage";
      reasonCode: PublicMarketOverviewSelectionReasonCode;
    }>
  | Readonly<{
      status: "unavailable";
      reasonCode: PublicMarketOverviewSelectionReasonCode;
    }>;

export type PublicMarketOverviewSelectorDependencies = Readonly<{
  loadArtifacts?: (
    input: PublicMarketOverviewArtifactLoadInput,
  ) => Promise<
    | Readonly<{ ok: true; rows: ReadonlyArray<PublicMarketOverviewArtifactDbRow> }>
    | Readonly<{ ok: false }>
  >;
}>;

type PublicMarketOverviewArtifactLoadInput = Readonly<{
  country: string;
  city: string;
  propertyType: Exclude<IntelligenceV2PropertyType, "unknown">;
}>;

type PublicMarketOverviewArtifactDbRow = Readonly<{
  id?: unknown;
  benchmark_type?: unknown;
  approval_status?: unknown;
  approved_for_internal?: unknown;
  approved_for_audit?: unknown;
  intended_use?: unknown;
  aggregation_window?: unknown;
  platform_scope?: unknown;
  capacity_scope?: unknown;
  property_scope?: unknown;
  country?: unknown;
  city?: unknown;
  platform?: unknown;
  property_type?: unknown;
  currency?: unknown;
  capture_period_bucket?: unknown;
  p25_price?: unknown;
  median_price?: unknown;
  p75_price?: unknown;
  included_sample_size?: unknown;
  confidence_level?: unknown;
  valid_from?: unknown;
  valid_until?: unknown;
  limitations?: unknown;
  created_at?: unknown;
}>;

type NormalizedPublicArtifact = Readonly<{
  benchmarkType: "pricing_distribution";
  approvalStatus: "internal_approved";
  approvedForInternal: true;
  approvedForAudit: false;
  intendedUse: "public_market_overview";
  aggregationWindow: "rolling_90_days";
  platformScope: "single_platform" | "all_platforms";
  capacityScope: "all_capacities";
  propertyScope: "exact" | "broader_market";
  country: string;
  city: string;
  platform: PublicMarketOverviewArtifactPlatform;
  propertyType: IntelligenceV2PropertyType;
  currency: string;
  capturePeriodBucket: string;
  p25: number;
  median: number;
  p75: number;
  includedSampleSize: number;
  confidenceLevel: "moderate" | "high";
  validFrom: string;
  validUntil: string;
  limitations: readonly string[];
  createdAt: string;
}>;

function parseNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function parseMoney(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseNonNegativeInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parseTimestamp(value: unknown): string | null {
  const parsed = parseNonEmptyString(value);
  if (parsed == null) {
    return null;
  }
  return Number.isFinite(Date.parse(parsed)) ? parsed : null;
}

function parseLimitations(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const limitations: string[] = [];
  for (const item of value) {
    const parsed = parseNonEmptyString(item);
    if (parsed == null) {
      return null;
    }
    limitations.push(parsed);
  }
  return limitations.sort();
}

function uniqueSortedLimitations(
  values: Iterable<PublicMarketOverviewLimitationCode>,
): readonly PublicMarketOverviewLimitationCode[] {
  return Object.freeze([...new Set(values)].sort());
}

function normalizeInput(
  input: PublicMarketOverviewSelectionInput,
): Readonly<{
  country: string;
  city: string;
  platform: Exclude<IntelligenceV2Platform, "unknown">;
  propertyType: Exclude<IntelligenceV2PropertyType, "unknown">;
}> | null {
  const marketCell = buildMarketCellV1({
    country: input.country,
    city: input.city,
    platform: input.platform,
    propertyType: input.propertyType,
  });

  if (
    marketCell.country === "unknown" ||
    marketCell.city === "unknown" ||
    marketCell.platform === "unknown" ||
    marketCell.propertyType === "unknown"
  ) {
    return null;
  }

  return Object.freeze({
    country: marketCell.country,
    city: marketCell.city,
    platform: marketCell.platform,
    propertyType: marketCell.propertyType,
  });
}

async function loadArtifactsFromSupabase(
  input: PublicMarketOverviewArtifactLoadInput,
): Promise<
  | Readonly<{ ok: true; rows: ReadonlyArray<PublicMarketOverviewArtifactDbRow> }>
  | Readonly<{ ok: false }>
> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("benchmark_artifacts")
      .select(
        [
          "id",
          "benchmark_type",
          "approval_status",
          "approved_for_internal",
          "approved_for_audit",
          "intended_use",
          "aggregation_window",
          "capacity_scope",
          "property_scope",
          "country",
          "city",
          "platform",
          "property_type",
          "currency",
          "capture_period_bucket",
          "p25_price",
          "median_price",
          "p75_price",
          "included_sample_size",
          "confidence_level",
          "valid_from",
          "valid_until",
          "limitations",
          "created_at",
        ].join(","),
      )
      .eq("benchmark_type", PRICING_BENCHMARK_TYPE)
      .eq("intended_use", "public_market_overview")
      .eq("aggregation_window", "rolling_90_days")
      .eq("platform_scope", "all_platforms")
      .eq("platform", "all")
      .eq("approved_for_audit", false)
      .eq("country", input.country)
      .eq("city", input.city)
      .in("property_type", [input.propertyType, "unknown"])
      .in("property_scope", ["exact", "broader_market"])
      .eq("capacity_scope", "all_capacities")
      .order("valid_from", { ascending: false })
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data)) {
      return { ok: false };
    }

    return {
      ok: true,
      rows: data as ReadonlyArray<PublicMarketOverviewArtifactDbRow>,
    };
  } catch {
    return { ok: false };
  }
}

function mapRow(
  row: PublicMarketOverviewArtifactDbRow,
): NormalizedPublicArtifact | null {
  const benchmarkType = parseNonEmptyString(row.benchmark_type);
  const approvalStatus = parseNonEmptyString(row.approval_status);
  const approvedForInternal = parseBoolean(row.approved_for_internal);
  const approvedForAudit = parseBoolean(row.approved_for_audit);
  const intendedUse = parseNonEmptyString(row.intended_use);
  const aggregationWindow = parseNonEmptyString(row.aggregation_window);
  const platformScope = parseNonEmptyString(row.platform_scope);
  const capacityScope = parseNonEmptyString(row.capacity_scope);
  const propertyScope = parseNonEmptyString(row.property_scope);
  const country = parseNonEmptyString(row.country);
  const city = parseNonEmptyString(row.city);
  const platform = parseNonEmptyString(row.platform);
  const propertyType = parseNonEmptyString(row.property_type);
  const currency = parseNonEmptyString(row.currency);
  const capturePeriodBucket = parseNonEmptyString(row.capture_period_bucket);
  const p25 = parseMoney(row.p25_price);
  const median = parseMoney(row.median_price);
  const p75 = parseMoney(row.p75_price);
  const includedSampleSize = parseNonNegativeInteger(row.included_sample_size);
  const confidenceLevel = parseNonEmptyString(row.confidence_level);
  const validFrom = parseTimestamp(row.valid_from);
  const validUntil = parseTimestamp(row.valid_until);
  const limitations = parseLimitations(row.limitations);
  const createdAt = parseTimestamp(row.created_at);

  if (
    benchmarkType !== PRICING_BENCHMARK_TYPE ||
    approvalStatus !== "internal_approved" ||
    approvedForInternal !== true ||
    approvedForAudit !== false ||
    intendedUse !== "public_market_overview" ||
    !AGGREGATION_WINDOW_VALUES.has(aggregationWindow ?? "") ||
    !CAPACITY_SCOPE_VALUES.has(capacityScope ?? "") ||
    !PROPERTY_SCOPE_VALUES.has(propertyScope ?? "") ||
    country == null ||
    city == null ||
    platform == null ||
    !ARTIFACT_PLATFORM_VALUES.has(platform) ||
    platformScope == null ||
    !PLATFORM_SCOPE_VALUES.has(platformScope) ||
    (platformScope === "all_platforms" && platform !== "all") ||
    (platformScope === "single_platform" && platform === "all") ||
    propertyType == null ||
    !PROPERTY_TYPE_VALUES.has(propertyType) ||
    currency == null ||
    capturePeriodBucket == null ||
    !MONTH_BUCKET_REGEX.test(capturePeriodBucket) ||
    p25 == null ||
    median == null ||
    p75 == null ||
    p25 > median ||
    median > p75 ||
    includedSampleSize == null ||
    confidenceLevel == null ||
    !CONFIDENCE_LEVEL_VALUES.has(confidenceLevel) ||
    validFrom == null ||
    validUntil == null ||
    Date.parse(validFrom) >= Date.parse(validUntil) ||
    limitations == null ||
    createdAt == null
  ) {
    return null;
  }

  return Object.freeze({
    benchmarkType: "pricing_distribution",
    approvalStatus: "internal_approved",
    approvedForInternal: true,
    approvedForAudit: false,
    intendedUse: "public_market_overview",
    aggregationWindow: "rolling_90_days",
    platformScope: platformScope as PublicMarketOverviewPlatformScope,
    capacityScope: "all_capacities",
    propertyScope: propertyScope as PublicMarketOverviewPropertyScope,
    country,
    city,
    platform: platform as PublicMarketOverviewArtifactPlatform,
    propertyType: propertyType as IntelligenceV2PropertyType,
    currency,
    capturePeriodBucket,
    p25,
    median,
    p75,
    includedSampleSize,
    confidenceLevel: confidenceLevel as "moderate" | "high",
    validFrom,
    validUntil,
    limitations,
    createdAt,
  });
}

function derivePublicLimitations(
  artifact: NormalizedPublicArtifact,
): readonly PublicMarketOverviewLimitationCode[] {
  const limitations = new Set<PublicMarketOverviewLimitationCode>([
    "all_capacities_scope",
  ]);

  if (artifact.platformScope === "all_platforms") {
    limitations.add("multi_platform_scope");
  }

  if (
    artifact.propertyScope === "broader_market" ||
    artifact.limitations.includes("broad_fallback")
  ) {
    limitations.add("broader_market_segment");
  }
  if (artifact.limitations.includes("low_source_diversity")) {
    limitations.add("limited_source_diversity");
  }
  if (artifact.limitations.includes("small_sample")) {
    limitations.add("limited_sample_size");
  }
  if (artifact.limitations.includes("aging_data")) {
    limitations.add("aging_data");
  }

  return uniqueSortedLimitations(limitations);
}

function deriveSampleBand(
  includedSampleSize: number,
): PublicMarketOverviewSampleBand {
  return includedSampleSize >= 30 ? "strong" : "sufficient";
}

function deriveConfidence(
  confidenceLevel: "moderate" | "high",
): PublicMarketOverviewConfidence {
  return confidenceLevel === "high" ? "high" : "standard";
}

function selectBestArtifactForCurrency(
  artifacts: readonly NormalizedPublicArtifact[],
): NormalizedPublicArtifact | null {
  const sorted = [...artifacts].sort((left, right) => {
    const validFromDelta = Date.parse(right.validFrom) - Date.parse(left.validFrom);
    if (validFromDelta !== 0) {
      return validFromDelta;
    }
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });

  return sorted[0] ?? null;
}

function buildAvailableEvidence(input: {
  artifact: NormalizedPublicArtifact;
  requestedPropertyType: Exclude<IntelligenceV2PropertyType, "unknown">;
}): PublicMarketOverviewEvidence {
  return Object.freeze({
    status: "available",
    market: Object.freeze({
      country: input.artifact.country,
      city: input.artifact.city,
      platform: input.artifact.platform,
      platformScope: input.artifact.platformScope,
      requestedPropertyType: input.requestedPropertyType,
      resolvedPropertyType:
        input.artifact.propertyScope === "broader_market"
          ? "unknown"
          : input.artifact.propertyType,
      propertyScope: input.artifact.propertyScope,
      capacityScope: "all_capacities",
    }),
    benchmark: Object.freeze({
      p25: input.artifact.p25,
      median: input.artifact.median,
      p75: input.artifact.p75,
      currency: input.artifact.currency,
    }),
    confidence: deriveConfidence(input.artifact.confidenceLevel),
    sampleBand: deriveSampleBand(input.artifact.includedSampleSize),
    limitationCodes: derivePublicLimitations(input.artifact),
    sourceWindow: Object.freeze({
      aggregationWindow: "rolling_90_days",
      validFrom: input.artifact.validFrom,
      validUntil: input.artifact.validUntil,
    }),
  });
}

function selectForScope(input: {
  artifacts: readonly NormalizedPublicArtifact[];
  requestedPropertyType: Exclude<IntelligenceV2PropertyType, "unknown">;
  scope: PublicMarketOverviewPropertyScope;
  nowIso: string;
}):
  | Readonly<{ outcome: "selected"; artifact: NormalizedPublicArtifact }>
  | Readonly<{ outcome: "none"; reasonCode: PublicMarketOverviewSelectionReasonCode }> {
  const scopeArtifacts = input.artifacts.filter((artifact) => {
    if (artifact.propertyScope !== input.scope) {
      return false;
    }
    if (
      input.scope === "exact" &&
      artifact.propertyType !== input.requestedPropertyType
    ) {
      return false;
    }
    if (
      input.scope === "broader_market" &&
      artifact.propertyType !== input.requestedPropertyType &&
      artifact.propertyType !== "unknown"
    ) {
      return false;
    }
    return true;
  });

  if (scopeArtifacts.length === 0) {
    return { outcome: "none", reasonCode: "no_public_artifact" };
  }

  const validNowArtifacts = scopeArtifacts.filter((artifact) => {
    const nowMs = Date.parse(input.nowIso);
    return (
      Date.parse(artifact.validFrom) <= nowMs && nowMs < Date.parse(artifact.validUntil)
    );
  });

  if (validNowArtifacts.length === 0) {
    return { outcome: "none", reasonCode: "artifact_not_currently_valid" };
  }

  const byCurrency = new Map<string, NormalizedPublicArtifact[]>();
  for (const artifact of validNowArtifacts) {
    const existing = byCurrency.get(artifact.currency) ?? [];
    existing.push(artifact);
    byCurrency.set(artifact.currency, existing);
  }

  const currencies = [...byCurrency.keys()].sort();
  if (currencies.length !== 1) {
    return { outcome: "none", reasonCode: "ambiguous_currency" };
  }

  const currency = currencies[0];
  if (currency == null) {
    return { outcome: "none", reasonCode: "ambiguous_currency" };
  }

  const selected = selectBestArtifactForCurrency(byCurrency.get(currency) ?? []);
  if (selected == null) {
    return { outcome: "none", reasonCode: "artifact_malformed" };
  }

  return { outcome: "selected", artifact: selected };
}

export async function getPublicMarketOverviewEvidence(
  input: PublicMarketOverviewSelectionInput,
  dependencies: PublicMarketOverviewSelectorDependencies = {},
): Promise<PublicMarketOverviewSelectorResult> {
  const normalized = normalizeInput(input);
  if (normalized == null) {
    return Object.freeze({
      status: "unavailable",
      reasonCode: "invalid_input",
    });
  }

  const loadArtifacts = dependencies.loadArtifacts ?? loadArtifactsFromSupabase;
  const loadResult = await loadArtifacts({
    country: normalized.country,
    city: normalized.city,
    propertyType: normalized.propertyType,
  });

  if (!loadResult.ok) {
    return Object.freeze({
      status: "unavailable",
      reasonCode: "database_read_error",
    });
  }

  const mappedArtifacts = loadResult.rows.map(mapRow);
  if (mappedArtifacts.some((artifact) => artifact == null)) {
    // Ignore malformed rows if there are valid candidates, otherwise classify as insufficient.
  }
  const artifacts = mappedArtifacts.filter(
    (artifact): artifact is NormalizedPublicArtifact => artifact != null,
  );

  if (artifacts.length === 0) {
    return Object.freeze({
      status: "insufficient_coverage",
      reasonCode:
        loadResult.rows.length > 0 ? "artifact_malformed" : "no_public_artifact",
    });
  }

  const nowIso = (input.now?.() ?? new Date()).toISOString();
  const exactResult = selectForScope({
    artifacts,
    requestedPropertyType: normalized.propertyType,
    scope: "exact",
    nowIso,
  });
  if (exactResult.outcome === "selected") {
    return buildAvailableEvidence({
      artifact: exactResult.artifact,
      requestedPropertyType: normalized.propertyType,
    });
  }
  if (exactResult.reasonCode === "ambiguous_currency") {
    return Object.freeze({
      status: "insufficient_coverage",
      reasonCode: "ambiguous_currency",
    });
  }

  const broaderResult = selectForScope({
    artifacts,
    requestedPropertyType: normalized.propertyType,
    scope: "broader_market",
    nowIso,
  });
  if (broaderResult.outcome === "selected") {
    return buildAvailableEvidence({
      artifact: broaderResult.artifact,
      requestedPropertyType: normalized.propertyType,
    });
  }

  return Object.freeze({
    status: "insufficient_coverage",
    reasonCode:
      broaderResult.reasonCode !== "no_public_artifact"
        ? broaderResult.reasonCode
        : exactResult.reasonCode,
  });
}
