import { buildMarketCellV1 } from "@/lib/intelligenceV2/marketCell";
import type { PublicMarketOverviewLimitationCode } from "@/lib/intelligenceV2/publicMarketOverviewContract";
import { getPublicMarketOverviewEvidence } from "@/lib/intelligenceV2/publicMarketOverviewSelector";

import type {
  FreeAuditMarketOverviewAvailable,
  FreeAuditMarketOverviewInput,
  FreeAuditMarketOverviewLimitationCode,
  FreeAuditMarketOverviewRecommendationCode,
  FreeAuditPricingPreviewConfidenceLevel,
  FreeAuditPricingPreviewPlatformScope,
  FreeAuditPricingPreviewPropertyType,
  FreeAuditPricingPreviewPlatform,
  FreeAuditPricingPreviewResult,
  FreeAuditPricingPreviewSampleBand,
  FreeAuditPublicMarket,
} from "./publicPricingPreviewContract";

const PUBLIC_PLATFORM_VALUES = new Set<FreeAuditPricingPreviewPlatform>([
  "airbnb",
  "booking",
  "expedia",
  "agoda",
  "vrbo",
]);
const PUBLIC_PROPERTY_TYPE_VALUES = new Set<FreeAuditPricingPreviewPropertyType>([
  "studio",
  "apartment",
  "villa",
  "riad",
  "room",
  "hotel",
]);
const MAX_COUNTRY_LENGTH = 100;
const MAX_CITY_LENGTH = 120;
const UNAVAILABLE_MESSAGE =
  "L'apercu gratuit est temporairement indisponible.";
const INSUFFICIENT_COVERAGE_MESSAGE =
  "Nous ne disposons pas encore d'un volume suffisant de donnees agregees pour ce marche.";
const BASE_MARKET_LIMITATIONS = Object.freeze([
  "market_only",
  "aggregated_market_data",
  "listing_specific_factors",
] as const satisfies readonly FreeAuditMarketOverviewLimitationCode[]);
const MARKET_OVERVIEW_RECOMMENDATIONS = Object.freeze([
  "median_positions_market",
  "listing_specific_factors_matter",
  "full_audit_for_positioning",
] as const satisfies readonly FreeAuditMarketOverviewRecommendationCode[]);
const BROADER_MARKET_RECOMMENDATIONS = Object.freeze([
  "median_positions_market",
  "broader_segment_used",
  "full_audit_for_positioning",
] as const satisfies readonly FreeAuditMarketOverviewRecommendationCode[]);

type BuildFreeAuditPricingPreviewDependencies = Readonly<{
  getPublicMarketOverviewEvidence?: typeof getPublicMarketOverviewEvidence;
  now?: () => Date;
}>;

type NormalizedMarketOverviewInput = Readonly<{
  country: string;
  city: string;
  platform: FreeAuditPricingPreviewPlatform;
  propertyType: FreeAuditPricingPreviewPropertyType;
}>;

function roundToUnit(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value);
}

function normalizeBaseInput(
  input: Readonly<{
    country: string;
    city: string;
    platform: string;
    propertyType: string;
  }>,
): NormalizedMarketOverviewInput | null {
  if (typeof input !== "object" || input == null) {
    return null;
  }

  const country = typeof input.country === "string" ? input.country.trim() : "";
  if (country.length === 0 || country.length > MAX_COUNTRY_LENGTH) {
    return null;
  }

  const city = typeof input.city === "string" ? input.city.trim() : "";
  if (city.length === 0 || city.length > MAX_CITY_LENGTH) {
    return null;
  }

  const platform =
    typeof input.platform === "string" ? input.platform.trim().toLowerCase() : "";
  if (!PUBLIC_PLATFORM_VALUES.has(platform as FreeAuditPricingPreviewPlatform)) {
    return null;
  }

  const propertyType =
    typeof input.propertyType === "string"
      ? input.propertyType.trim().toLowerCase()
      : "";
  if (!PUBLIC_PROPERTY_TYPE_VALUES.has(propertyType as FreeAuditPricingPreviewPropertyType)) {
    return null;
  }

  return Object.freeze({
    country,
    city,
    platform: platform as FreeAuditPricingPreviewPlatform,
    propertyType: propertyType as FreeAuditPricingPreviewPropertyType,
  });
}

function normalizeMarketOverviewInput(
  input: FreeAuditMarketOverviewInput,
): NormalizedMarketOverviewInput | null {
  return normalizeBaseInput(input);
}

function buildRequestedPublicMarket(
  input: NormalizedMarketOverviewInput,
): FreeAuditPublicMarket {
  const marketCell = buildMarketCellV1({
    country: input.country,
    city: input.city,
    platform: input.platform,
    propertyType: input.propertyType,
  });

  return Object.freeze({
    country: marketCell.country,
    city: marketCell.city,
    platform: "all",
    platformScope: "all_platforms",
    propertyType: marketCell.propertyType,
  });
}

function buildResolvedPublicMarket(input: {
  country: string;
  city: string;
  platform: string;
  platformScope: FreeAuditPricingPreviewPlatformScope;
  propertyType: string;
}): FreeAuditPublicMarket | null {
  if (
    input.platform !== "airbnb" &&
    input.platform !== "booking" &&
    input.platform !== "expedia" &&
    input.platform !== "agoda" &&
    input.platform !== "vrbo" &&
    input.platform !== "all"
  ) {
    return null;
  }

  if (
    input.propertyType !== "studio" &&
    input.propertyType !== "apartment" &&
    input.propertyType !== "villa" &&
    input.propertyType !== "riad" &&
    input.propertyType !== "room" &&
    input.propertyType !== "hotel" &&
    input.propertyType !== "unknown"
  ) {
    return null;
  }

  return Object.freeze({
    country: input.country,
    city: input.city,
    platform: input.platform,
    platformScope: input.platformScope,
    propertyType: input.propertyType,
  });
}

function buildMarketOnlyLimitations(input: {
  broaderMarketSegment?: boolean;
  selectorLimitations?: readonly PublicMarketOverviewLimitationCode[];
  extraLimitations?: readonly FreeAuditMarketOverviewLimitationCode[];
}): readonly FreeAuditMarketOverviewLimitationCode[] {
  const limitations = new Set<FreeAuditMarketOverviewLimitationCode>(BASE_MARKET_LIMITATIONS);
  if (input.broaderMarketSegment) {
    limitations.add("broad_market_segment");
  }

  for (const limitation of input.selectorLimitations ?? []) {
    if (limitation === "broader_market_segment") {
      limitations.add("broad_market_segment");
      continue;
    }
    if (
      limitation === "all_capacities_scope" ||
      limitation === "multi_platform_scope" ||
      limitation === "limited_sample_size" ||
      limitation === "limited_source_diversity" ||
      limitation === "aging_data"
    ) {
      limitations.add(limitation);
    }
  }

  for (const limitation of input.extraLimitations ?? []) {
    limitations.add(limitation);
  }

  return Object.freeze([...new Set(limitationSort(limitations))]);
}

function limitationSort(
  values: Iterable<FreeAuditMarketOverviewLimitationCode>,
): FreeAuditMarketOverviewLimitationCode[] {
  return [...values].sort();
}

function buildUnavailableResult(): FreeAuditPricingPreviewResult {
  return Object.freeze({
    status: "unavailable",
    message: UNAVAILABLE_MESSAGE,
  });
}

function buildInsufficientCoverageResult(input: {
  market: FreeAuditPublicMarket;
  extraLimitations?: readonly FreeAuditMarketOverviewLimitationCode[];
}): FreeAuditPricingPreviewResult {
  return Object.freeze({
    status: "insufficient_coverage",
    market: input.market,
    limitations: buildMarketOnlyLimitations({
      extraLimitations: input.extraLimitations,
    }),
    message: INSUFFICIENT_COVERAGE_MESSAGE,
  });
}

function toConfidenceLevel(
  confidence: "standard" | "high",
): FreeAuditPricingPreviewConfidenceLevel {
  return confidence;
}

function toSampleBand(
  sampleBand: "sufficient" | "strong",
): FreeAuditPricingPreviewSampleBand {
  return sampleBand;
}

function buildRecommendations(input: {
  broaderMarketSegment: boolean;
}): readonly FreeAuditMarketOverviewRecommendationCode[] {
  return input.broaderMarketSegment
    ? BROADER_MARKET_RECOMMENDATIONS
    : MARKET_OVERVIEW_RECOMMENDATIONS;
}

async function buildMarketOverviewPreview(
  input: NormalizedMarketOverviewInput,
  dependencies: BuildFreeAuditPricingPreviewDependencies,
): Promise<FreeAuditPricingPreviewResult> {
  const requestedMarket = buildRequestedPublicMarket(input);
  const selectPublicMarketOverview =
    dependencies.getPublicMarketOverviewEvidence ??
    getPublicMarketOverviewEvidence;
  const result = await selectPublicMarketOverview({
    country: input.country,
    city: input.city,
    platform: input.platform,
    propertyType: input.propertyType,
    now: dependencies.now,
  });

  if (result.status === "unavailable") {
    return buildUnavailableResult();
  }

  if (result.status === "insufficient_coverage") {
    return buildInsufficientCoverageResult({
      market: requestedMarket,
      extraLimitations:
        result.reasonCode === "ambiguous_currency"
          ? ["multi_currency_market"]
          : undefined,
    });
  }

  const resolvedMarket = buildResolvedPublicMarket({
    country: result.market.country,
    city: result.market.city,
    platform: result.market.platform,
    platformScope: result.market.platformScope,
    propertyType: result.market.resolvedPropertyType,
  });

  if (resolvedMarket == null) {
    return buildUnavailableResult();
  }

  const lowPrice = roundToUnit(result.benchmark.p25);
  const medianPrice = roundToUnit(result.benchmark.median);
  const highPrice = roundToUnit(result.benchmark.p75);

  if (
    lowPrice == null ||
    medianPrice == null ||
    highPrice == null ||
    lowPrice > medianPrice ||
    medianPrice > highPrice
  ) {
    return buildUnavailableResult();
  }

  return Object.freeze({
    status: "available",
    market: resolvedMarket,
    benchmark: Object.freeze({
      lowPrice,
      medianPrice,
      highPrice,
      currency: result.benchmark.currency,
    }),
    confidence: Object.freeze({
      level: toConfidenceLevel(result.confidence),
      sampleBand: toSampleBand(result.sampleBand),
    }),
    limitations: buildMarketOnlyLimitations({
      broaderMarketSegment:
        result.market.propertyScope === "broader_market" ||
        result.limitationCodes.includes("broader_market_segment"),
      selectorLimitations: result.limitationCodes,
    }),
    recommendations: buildRecommendations({
      broaderMarketSegment:
        result.market.propertyScope === "broader_market" ||
        result.limitationCodes.includes("broader_market_segment"),
    }),
  } satisfies FreeAuditMarketOverviewAvailable);
}

export async function buildFreeAuditPricingPreview(
  input: FreeAuditMarketOverviewInput,
  dependencies: BuildFreeAuditPricingPreviewDependencies = {},
): Promise<FreeAuditPricingPreviewResult> {
  const normalized = normalizeMarketOverviewInput(input);
  if (normalized == null) {
    return buildUnavailableResult();
  }

  return buildMarketOverviewPreview(normalized, dependencies);
}

export type { BuildFreeAuditPricingPreviewDependencies };
