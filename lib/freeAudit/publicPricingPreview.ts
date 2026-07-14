import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  buildMarketCellV1,
  normalizeCurrency,
} from "@/lib/intelligenceV2/marketCell";
import {
  getPricingBenchmarkEvidence,
  type PricingBenchmarkEvidenceSelectorResult,
} from "@/lib/intelligenceV2/pricingBenchmarkEvidenceSelector";

import type {
  FreeAuditMarketOverviewAvailable,
  FreeAuditMarketOverviewInput,
  FreeAuditPricingPreviewConfidenceLevel,
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
const PUBLIC_CURRENCY_REGEX = /^[A-Z]{3}$/;
const MAX_COUNTRY_LENGTH = 100;
const MAX_CITY_LENGTH = 120;
const UNAVAILABLE_MESSAGE =
  "L'apercu gratuit est temporairement indisponible.";
const INSUFFICIENT_COVERAGE_MESSAGE =
  "Nous ne disposons pas encore d'un volume suffisant de donnees agregees pour ce marche.";
const BASE_MARKET_LIMITATIONS = Object.freeze([
  "Aucun prix ni contenu de votre annonce n'a ete analyse.",
  "Les resultats reposent sur des donnees de marche agregees.",
  "Les caracteristiques du logement, la saison et l'emplacement precis peuvent fortement modifier le tarif adapte.",
] as const);
const BROAD_SEGMENT_LIMITATION =
  "Le benchmark disponible couvre un segment de marche plus large que la demande initiale.";
const MULTI_CURRENCY_LIMITATION =
  "Plusieurs devises concurrentes existent sur ce marche et ne permettent pas un apercu honnête sans information complementaire.";
const MARKET_OVERVIEW_RECOMMENDATIONS = Object.freeze([
  "La mediane observee permet de situer le niveau central de ce marche.",
  "Les caracteristiques, la saison et l'emplacement precis peuvent fortement modifier le tarif adapte.",
  "L'audit complet analysera votre annonce et sa concurrence reelle pour determiner son positionnement.",
] as const);

type BuildFreeAuditPricingPreviewDependencies = Readonly<{
  getPricingBenchmarkEvidence?: typeof getPricingBenchmarkEvidence;
  listMarketOverviewArtifactCurrencies?: (
    input: MarketOverviewCurrencyDiscoveryInput,
  ) => Promise<MarketOverviewCurrencyDiscoveryResult>;
  now?: () => Date;
}>;

type NormalizedMarketOverviewInput = Readonly<{
  country: string;
  city: string;
  platform: FreeAuditPricingPreviewPlatform;
  propertyType: FreeAuditPricingPreviewPropertyType;
}>;

type MarketOverviewCurrencyDiscoveryInput = Readonly<{
  country: string;
  city: string;
  platform: FreeAuditPricingPreviewPlatform;
  propertyType: FreeAuditPricingPreviewPropertyType;
  capturePeriodBucket: string;
}>;

type MarketOverviewCurrencyDiscoveryRow = Readonly<{
  currency?: unknown;
}>;

type MarketOverviewCurrencyDiscoveryResult =
  | Readonly<{
      ok: true;
      rows: ReadonlyArray<MarketOverviewCurrencyDiscoveryRow>;
    }>
  | Readonly<{
      ok: false;
    }>;

type MarketOverviewCurrencyCandidate = Readonly<{
  currency: string;
  weight: number;
}>;

function uniqueSortedStrings(values: Iterable<string>): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function roundToUnit(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value);
}

function roundToOneDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function getCurrentUtcMonthBucket(now: Date): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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
    platform: marketCell.platform === "unknown" ? input.platform : marketCell.platform,
    propertyType: marketCell.propertyType,
  });
}

function buildResolvedPublicMarket(input: {
  country: string;
  city: string;
  platform: string;
  propertyType: string;
}): FreeAuditPublicMarket | null {
  if (
    input.platform !== "airbnb" &&
    input.platform !== "booking" &&
    input.platform !== "expedia" &&
    input.platform !== "agoda" &&
    input.platform !== "vrbo"
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
    propertyType: input.propertyType,
  });
}

function buildMarketOnlyLimitations(input: {
  fallbackLevel:
    | "none"
    | "exact"
    | "capacity_unknown"
    | "property_unknown"
    | "property_capacity_unknown";
  evidenceLimitations: readonly string[];
  extraLimitations?: readonly string[];
}): readonly string[] {
  const limitations = new Set<string>(BASE_MARKET_LIMITATIONS);
  if (
    (input.fallbackLevel !== "exact" && input.fallbackLevel !== "none") ||
    input.evidenceLimitations.includes("benchmark_fallback") ||
    input.evidenceLimitations.includes("broad_market_cell") ||
    input.evidenceLimitations.includes("broad_fallback")
  ) {
    limitations.add(BROAD_SEGMENT_LIMITATION);
  }

  for (const limitation of input.extraLimitations ?? []) {
    if (typeof limitation === "string" && limitation.trim().length > 0) {
      limitations.add(limitation);
    }
  }

  return uniqueSortedStrings(limitations);
}

function buildUnavailableResult(): FreeAuditPricingPreviewResult {
  return Object.freeze({
    status: "unavailable",
    message: UNAVAILABLE_MESSAGE,
  });
}

function buildInsufficientCoverageResult(input: {
  market: FreeAuditPublicMarket;
  extraLimitations?: readonly string[];
}): FreeAuditPricingPreviewResult {
  return Object.freeze({
    status: "insufficient_coverage",
    market: input.market,
    limitations: buildMarketOnlyLimitations({
      fallbackLevel: "property_capacity_unknown",
      evidenceLimitations: [],
      extraLimitations: input.extraLimitations,
    }),
    message: INSUFFICIENT_COVERAGE_MESSAGE,
  });
}

function toConfidenceLevel(
  evidenceStrength: string,
): FreeAuditPricingPreviewConfidenceLevel {
  return evidenceStrength === "strong" ? "high" : "standard";
}

function toSampleBand(sampleSizeBand: string): FreeAuditPricingPreviewSampleBand {
  return sampleSizeBand === "40_plus" ? "strong" : "sufficient";
}

async function listMarketOverviewArtifactCurrenciesFromSupabase(
  input: MarketOverviewCurrencyDiscoveryInput,
): Promise<MarketOverviewCurrencyDiscoveryResult> {
  try {
    const admin = createSupabaseAdminClient();
    const marketCell = buildMarketCellV1(input);
    const { data, error } = await admin
      .from("benchmark_artifacts")
      .select("currency")
      .eq("benchmark_type", "pricing_distribution")
      .eq("capture_period_bucket", input.capturePeriodBucket)
      .eq("country", marketCell.country)
      .eq("city", marketCell.city)
      .eq("platform", input.platform)
      .eq("capacity_band", "unknown")
      .in("property_type", [input.propertyType, "unknown"]);

    if (error || !Array.isArray(data)) {
      return { ok: false };
    }

    return {
      ok: true,
      rows: data as ReadonlyArray<MarketOverviewCurrencyDiscoveryRow>,
    };
  } catch {
    return { ok: false };
  }
}

function buildCurrencyCandidates(
  rows: ReadonlyArray<MarketOverviewCurrencyDiscoveryRow>,
): ReadonlyArray<MarketOverviewCurrencyCandidate> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const currency = normalizeCurrency(
      row && typeof row === "object" && "currency" in row ? (row.currency as string | null) : null,
    );
    if (!PUBLIC_CURRENCY_REGEX.test(currency) || currency === "UNKNOWN") {
      continue;
    }
    counts.set(currency, (counts.get(currency) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([currency, weight]) => Object.freeze({ currency, weight }))
    .sort((left, right) => {
      if (right.weight !== left.weight) {
        return right.weight - left.weight;
      }
      return left.currency.localeCompare(right.currency);
    });
}

function selectDominantAvailableCurrency(input: {
  availableResults: ReadonlyArray<{
    currency: string;
    result: Extract<PricingBenchmarkEvidenceSelectorResult, { available: true }>;
    weight: number;
  }>;
}):
  | Readonly<{
      currency: string;
      result: Extract<PricingBenchmarkEvidenceSelectorResult, { available: true }>;
    }>
  | null {
  if (input.availableResults.length === 0) {
    return null;
  }

  if (input.availableResults.length === 1) {
    const [only] = input.availableResults;
    return only == null
      ? null
      : Object.freeze({
          currency: only.currency,
          result: only.result,
        });
  }

  const sorted = [...input.availableResults].sort((left, right) => {
    if (right.weight !== left.weight) {
      return right.weight - left.weight;
    }
    return left.currency.localeCompare(right.currency);
  });

  const first = sorted[0];
  const second = sorted[1];

  if (first == null) {
    return null;
  }

  if (second != null && first.weight === second.weight) {
    return null;
  }

  return Object.freeze({
    currency: first.currency,
    result: first.result,
  });
}

async function buildMarketOverviewPreview(
  input: NormalizedMarketOverviewInput,
  dependencies: BuildFreeAuditPricingPreviewDependencies,
): Promise<FreeAuditPricingPreviewResult> {
  const now = dependencies.now?.() ?? new Date();
  const capturePeriodBucket = getCurrentUtcMonthBucket(now);
  const requestedMarket = buildRequestedPublicMarket(input);
  const listCurrencies =
    dependencies.listMarketOverviewArtifactCurrencies ??
    listMarketOverviewArtifactCurrenciesFromSupabase;
  const currencyDiscovery = await listCurrencies({
    country: input.country,
    city: input.city,
    platform: input.platform,
    propertyType: input.propertyType,
    capturePeriodBucket,
  });

  if (!currencyDiscovery.ok) {
    return buildUnavailableResult();
  }

  const currencyCandidates = buildCurrencyCandidates(currencyDiscovery.rows);
  if (currencyCandidates.length === 0) {
    return buildInsufficientCoverageResult({ market: requestedMarket });
  }

  const loadPricingBenchmarkEvidence =
    dependencies.getPricingBenchmarkEvidence ?? getPricingBenchmarkEvidence;
  const availableResults: Array<{
    currency: string;
    result: Extract<PricingBenchmarkEvidenceSelectorResult, { available: true }>;
    weight: number;
  }> = [];
  let hasUnavailableError = false;

  for (const candidate of currencyCandidates) {
    const result = await loadPricingBenchmarkEvidence({
      country: input.country,
      city: input.city,
      platform: input.platform,
      propertyType: input.propertyType,
      currency: candidate.currency,
      capturePeriodBucket,
      intendedUse: "private_audit",
    });

    if (result.available) {
      availableResults.push({
        currency: candidate.currency,
        result,
        weight: candidate.weight,
      });
      continue;
    }

    if (result.status === "disabled" || result.status === "database_error") {
      hasUnavailableError = true;
    }
  }

  const dominantResult = selectDominantAvailableCurrency({
    availableResults,
  });

  if (dominantResult == null) {
    if (availableResults.length === 0 && hasUnavailableError) {
      return buildUnavailableResult();
    }

    return buildInsufficientCoverageResult({
      market: requestedMarket,
      extraLimitations:
        availableResults.length > 1 ? [MULTI_CURRENCY_LIMITATION] : undefined,
    });
  }

  const resolvedMarket = buildResolvedPublicMarket({
    country: dominantResult.result.evidence.resolvedMarketCell.country,
    city: dominantResult.result.evidence.resolvedMarketCell.city,
    platform: dominantResult.result.evidence.resolvedMarketCell.platform,
    propertyType: dominantResult.result.evidence.resolvedMarketCell.propertyType,
  });

  if (resolvedMarket == null) {
    return buildUnavailableResult();
  }

  const lowPrice = roundToUnit(dominantResult.result.evidence.distribution.p25);
  const medianPrice = roundToUnit(dominantResult.result.evidence.distribution.median);
  const highPrice = roundToUnit(dominantResult.result.evidence.distribution.p75);

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
      currency: dominantResult.result.evidence.resolvedMarketCell.currency,
    }),
    confidence: Object.freeze({
      level: toConfidenceLevel(dominantResult.result.evidence.evidenceStrength),
      sampleBand: toSampleBand(dominantResult.result.evidence.sampleSizeBand),
    }),
    limitations: buildMarketOnlyLimitations({
      fallbackLevel: dominantResult.result.evidence.fallbackLevel,
      evidenceLimitations: dominantResult.result.evidence.limitations,
    }),
    recommendations: Object.freeze([...MARKET_OVERVIEW_RECOMMENDATIONS]),
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
