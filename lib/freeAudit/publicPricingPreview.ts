import {
  buildMarketCellV1,
  normalizeCurrency,
} from "@/lib/intelligenceV2/marketCell";
import { getPricingBenchmarkEvidence } from "@/lib/intelligenceV2/pricingBenchmarkEvidenceSelector";
import { buildPricingDiagnosticV2 } from "@/lib/intelligenceV2/pricingDiagnosticV2";

import type {
  FreeAuditPricingPreviewAvailable,
  FreeAuditPricingPreviewInput,
  FreeAuditPricingPreviewPropertyType,
  FreeAuditPricingPreviewResult,
  FreeAuditPricingPreviewPlatform,
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
const MAX_GUEST_CAPACITY = 100;
const MAX_DECLARED_NIGHTLY_PRICE = 100000;
const MAX_PUBLIC_DELTA_PERCENT = 999.9;
const UNAVAILABLE_MESSAGE =
  "L'apercu gratuit est temporairement indisponible.";
const INSUFFICIENT_COVERAGE_MESSAGE =
  "Nous ne disposons pas encore d'un volume suffisant de donnees agregees pour ce marche.";
const BASE_LIMITATIONS = Object.freeze([
  "Les resultats reposent sur des donnees de marche agregees.",
  "Aucun contenu de l'annonce n'a ete consulte.",
  "Les prix reels peuvent varier selon la saison et les caracteristiques du logement.",
] as const);
const BROAD_SEGMENT_LIMITATION =
  "Le benchmark disponible couvre un segment de marche plus large que la demande initiale.";

type BuildFreeAuditPricingPreviewDependencies = Readonly<{
  getPricingBenchmarkEvidence?: typeof getPricingBenchmarkEvidence;
  now?: () => Date;
}>;

type NormalizedFreeAuditPricingPreviewInput = Readonly<{
  country: string;
  city: string;
  platform: FreeAuditPricingPreviewPlatform;
  propertyType: FreeAuditPricingPreviewPropertyType;
  guestCapacity: number;
  declaredNightlyPrice: number;
  currency: string;
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

function clampDeltaPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value > MAX_PUBLIC_DELTA_PERCENT) {
    return MAX_PUBLIC_DELTA_PERCENT;
  }
  if (value < -MAX_PUBLIC_DELTA_PERCENT) {
    return -MAX_PUBLIC_DELTA_PERCENT;
  }
  return roundToOneDecimal(value);
}

function getCurrentUtcMonthBucket(now: Date): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizeInput(
  input: FreeAuditPricingPreviewInput,
): NormalizedFreeAuditPricingPreviewInput | null {
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

  const guestCapacity = input.guestCapacity;
  if (
    !Number.isFinite(guestCapacity) ||
    !Number.isInteger(guestCapacity) ||
    guestCapacity < 1 ||
    guestCapacity > MAX_GUEST_CAPACITY
  ) {
    return null;
  }

  const declaredNightlyPrice = input.declaredNightlyPrice;
  if (
    !Number.isFinite(declaredNightlyPrice) ||
    declaredNightlyPrice <= 0 ||
    declaredNightlyPrice > MAX_DECLARED_NIGHTLY_PRICE
  ) {
    return null;
  }

  const currency =
    typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "";
  if (!PUBLIC_CURRENCY_REGEX.test(currency)) {
    return null;
  }

  return Object.freeze({
    country,
    city,
    platform: platform as FreeAuditPricingPreviewPlatform,
    propertyType: propertyType as FreeAuditPricingPreviewPropertyType,
    guestCapacity,
    declaredNightlyPrice,
    currency,
  });
}

function buildRequestedPublicMarket(
  input: NormalizedFreeAuditPricingPreviewInput,
): FreeAuditPublicMarket {
  const marketCell = buildMarketCellV1({
    country: input.country,
    city: input.city,
    platform: input.platform,
    propertyType: input.propertyType,
    guestCapacity: input.guestCapacity,
    currency: input.currency,
  });

  return Object.freeze({
    country: marketCell.country,
    city: marketCell.city,
    platform: marketCell.platform === "unknown" ? input.platform : marketCell.platform,
    propertyType: marketCell.propertyType,
    capacityBand: marketCell.capacityBand,
    currency: marketCell.currency,
  });
}

function buildResolvedPublicMarket(input: {
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  capacityBand: string;
  currency: string;
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

  if (
    input.capacityBand !== "1_3" &&
    input.capacityBand !== "4_6" &&
    input.capacityBand !== "7_9" &&
    input.capacityBand !== "10_plus" &&
    input.capacityBand !== "unknown"
  ) {
    return null;
  }

  const currency = normalizeCurrency(input.currency);
  if (!PUBLIC_CURRENCY_REGEX.test(currency)) {
    return null;
  }

  return Object.freeze({
    country: input.country,
    city: input.city,
    platform: input.platform,
    propertyType: input.propertyType,
    capacityBand: input.capacityBand,
    currency,
  });
}

function buildPublicLimitations(input: {
  fallbackLevel: "exact" | "capacity_unknown" | "property_unknown" | "property_capacity_unknown";
  diagnosticLimitations: readonly string[];
}): readonly string[] {
  const limitations = new Set<string>(BASE_LIMITATIONS);
  if (
    input.fallbackLevel !== "exact" ||
    input.diagnosticLimitations.includes("benchmark_fallback") ||
    input.diagnosticLimitations.includes("broad_market_cell")
  ) {
    limitations.add(BROAD_SEGMENT_LIMITATION);
  }
  return uniqueSortedStrings(limitations);
}

function mapPositioningBand(input: string): FreeAuditPricingPreviewAvailable["positioning"]["band"] | null {
  switch (input) {
    case "deep_discount":
      return "well_below_market";
    case "below_market":
    case "slightly_below":
      return "below_market";
    case "market_aligned":
      return "near_market";
    case "premium_position":
      return "above_market";
    case "high_outlier":
      return "well_above_market";
    default:
      return null;
  }
}

function buildRecommendations(
  band: FreeAuditPricingPreviewAvailable["positioning"]["band"],
): readonly string[] {
  switch (band) {
    case "well_below_market":
      return Object.freeze([
        "Votre prix declare est nettement inferieur au niveau central observe sur ce marche.",
        "Verifiez si votre tarif reflete reellement les caracteristiques et la saison de votre logement.",
      ]);
    case "below_market":
      return Object.freeze([
        "Votre prix declare se situe sous le niveau central observe.",
        "Une legere reevaluation peut etre envisagee si votre logement est competitif.",
      ]);
    case "near_market":
      return Object.freeze([
        "Votre prix declare est proche du niveau central observe.",
        "Les photos, le titre et la qualite de l'annonce peuvent devenir les principaux leviers de conversion.",
      ]);
    case "above_market":
      return Object.freeze([
        "Votre prix declare se situe au-dessus du niveau central observe.",
        "Assurez-vous que la presentation et les equipements justifient ce positionnement.",
      ]);
    case "well_above_market":
      return Object.freeze([
        "Votre prix declare est nettement superieur au niveau central observe.",
        "Un audit complet peut verifier si ce premium est soutenu par l'annonce et la concurrence reelle.",
      ]);
  }
}

function buildUnavailableResult(): FreeAuditPricingPreviewResult {
  return Object.freeze({
    status: "unavailable",
    message: UNAVAILABLE_MESSAGE,
  });
}

function buildInsufficientCoverageResult(input: {
  market: FreeAuditPublicMarket;
  declaredNightlyPrice: number;
}): FreeAuditPricingPreviewResult {
  return Object.freeze({
    status: "insufficient_coverage",
    market: input.market,
    declaredNightlyPrice: input.declaredNightlyPrice,
    limitations: Object.freeze([
      "Aucun contenu de l'annonce n'a ete consulte.",
      "L'apercu gratuit repose uniquement sur des donnees de marche agregees lorsqu'elles sont disponibles.",
    ]),
    message: INSUFFICIENT_COVERAGE_MESSAGE,
  });
}

export async function buildFreeAuditPricingPreview(
  input: FreeAuditPricingPreviewInput,
  dependencies: BuildFreeAuditPricingPreviewDependencies = {},
): Promise<FreeAuditPricingPreviewResult> {
  const normalizedInput = normalizeInput(input);
  if (normalizedInput == null) {
    return buildUnavailableResult();
  }

  const now = dependencies.now?.() ?? new Date();
  const capturePeriodBucket = getCurrentUtcMonthBucket(now);
  const requestedMarket = buildRequestedPublicMarket(normalizedInput);
  const loadPricingBenchmarkEvidence =
    dependencies.getPricingBenchmarkEvidence ?? getPricingBenchmarkEvidence;

  try {
    const evidenceResult = await loadPricingBenchmarkEvidence({
      country: normalizedInput.country,
      city: normalizedInput.city,
      platform: normalizedInput.platform,
      propertyType: normalizedInput.propertyType,
      capacity: normalizedInput.guestCapacity,
      guestCapacity: normalizedInput.guestCapacity,
      currency: normalizedInput.currency,
      capturePeriodBucket,
      intendedUse: "private_audit",
    });

    if (!evidenceResult.available) {
      if (
        evidenceResult.status === "disabled" ||
        evidenceResult.status === "database_error"
      ) {
        return buildUnavailableResult();
      }

      return buildInsufficientCoverageResult({
        market: requestedMarket,
        declaredNightlyPrice: normalizedInput.declaredNightlyPrice,
      });
    }

    const resolvedMarket = buildResolvedPublicMarket({
      country: evidenceResult.evidence.resolvedMarketCell.country,
      city: evidenceResult.evidence.resolvedMarketCell.city,
      platform: evidenceResult.evidence.resolvedMarketCell.platform,
      propertyType: evidenceResult.evidence.resolvedMarketCell.propertyType,
      capacityBand: evidenceResult.evidence.resolvedMarketCell.capacityBand,
      currency: evidenceResult.evidence.resolvedMarketCell.currency,
    });

    if (resolvedMarket == null) {
      return buildUnavailableResult();
    }

    const diagnosticResult = buildPricingDiagnosticV2({
      listingNightlyPrice: normalizedInput.declaredNightlyPrice,
      currency: normalizedInput.currency,
      pricingBenchmarkEvidence: evidenceResult.evidence,
    });

    if (!diagnosticResult.available) {
      if (diagnosticResult.status === "insufficient_evidence") {
        return buildInsufficientCoverageResult({
          market: resolvedMarket,
          declaredNightlyPrice: normalizedInput.declaredNightlyPrice,
        });
      }

      return buildUnavailableResult();
    }

    const positioningBand = mapPositioningBand(diagnosticResult.diagnostic.positionBand);
    if (positioningBand == null) {
      return buildUnavailableResult();
    }

    const lowPrice = roundToUnit(diagnosticResult.diagnostic.marketRange.p25);
    const medianPrice = roundToUnit(diagnosticResult.diagnostic.marketRange.median);
    const highPrice = roundToUnit(diagnosticResult.diagnostic.marketRange.p75);
    if (
      lowPrice == null ||
      medianPrice == null ||
      highPrice == null ||
      lowPrice > medianPrice ||
      medianPrice > highPrice
    ) {
      return buildUnavailableResult();
    }

    const deltaFromMedianPercent = clampDeltaPercent(
      diagnosticResult.diagnostic.medianDeltaPercent,
    );

    return Object.freeze({
      status: "available",
      market: resolvedMarket,
      declaredNightlyPrice: normalizedInput.declaredNightlyPrice,
      benchmark: Object.freeze({
        lowPrice,
        medianPrice,
        highPrice,
      }),
      positioning: Object.freeze({
        band: positioningBand,
        deltaFromMedianPercent,
      }),
      confidence: Object.freeze({
        level:
          diagnosticResult.diagnostic.evidenceStrength === "strong"
            ? "high"
            : "standard",
        sampleBand:
          evidenceResult.evidence.sampleSizeBand === "40_plus"
            ? "strong"
            : "sufficient",
      }),
      limitations: buildPublicLimitations({
        fallbackLevel: diagnosticResult.diagnostic.fallbackLevel,
        diagnosticLimitations: diagnosticResult.diagnostic.limitations,
      }),
      recommendations: buildRecommendations(positioningBand),
    });
  } catch {
    return buildUnavailableResult();
  }
}

export type { BuildFreeAuditPricingPreviewDependencies };
