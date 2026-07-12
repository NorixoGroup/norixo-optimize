import type {
  PricingBenchmarkEvidence,
  PricingBenchmarkEvidenceStrength,
  PricingBenchmarkFallbackLevel,
  PricingBenchmarkPermittedWording,
} from "./pricingBenchmarkEvidence";
import {
  INTELLIGENCE_V2_PRICING_ACTION_POLICY_VERSION,
  INTELLIGENCE_V2_PRICING_DIAGNOSTIC_CONTRACT_VERSION,
  INTELLIGENCE_V2_PRICING_POSITION_POLICY_VERSION,
} from "./policyVersions";

export type PricingPositionBand =
  | "deep_discount"
  | "below_market"
  | "slightly_below"
  | "market_aligned"
  | "premium_position"
  | "high_outlier";

export type PricingPercentileBand =
  | "below_p10"
  | "p10_to_p25"
  | "p25_to_p50"
  | "p50_to_p75"
  | "p75_to_p90"
  | "above_p90";

export type PricingInterquartilePosition =
  | "below_iqr"
  | "inside_iqr"
  | "above_iqr";

export type PricingSignal =
  | "under_positioned"
  | "aligned"
  | "premium_position"
  | "high_outlier";

export type PricingRecommendedAction =
  | "test_higher_price"
  | "hold_price"
  | "monitor_position"
  | "review_price_support"
  | "insufficient_evidence";

export type PricingDiagnosticV2LimitationCode =
  | "benchmark_fallback"
  | "aging_evidence"
  | "limited_evidence"
  | "broad_market_cell"
  | "weak_action_only";

export type PricingDiagnosticV2ReasonCode =
  | "invalid_listing_price"
  | "currency_mismatch"
  | "evidence_unavailable"
  | "benchmark_distribution_invalid"
  | "evidence_too_weak"
  | "unsupported_fallback";

export type PricingDiagnosticMarketRange = Readonly<{
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
}>;

export type PricingDiagnosticV2Input = Readonly<{
  listingNightlyPrice: number;
  currency: string;
  pricingBenchmarkEvidence: PricingBenchmarkEvidence;
}>;

export type PricingDiagnosticV2 = Readonly<{
  diagnosticContractVersion: string;
  status: "available" | "limited";

  currency: string;
  benchmarkPeriod: string;

  positionBand: PricingPositionBand;
  percentileBand: PricingPercentileBand;
  interquartilePosition: PricingInterquartilePosition;
  medianDeltaPercent: number;

  marketRange: PricingDiagnosticMarketRange;

  pricingSignal: PricingSignal;
  recommendedAction: PricingRecommendedAction;

  evidenceStrength: Exclude<PricingBenchmarkEvidenceStrength, "unavailable">;
  confidenceLevel: "high" | "very_high";
  fallbackLevel: Exclude<PricingBenchmarkFallbackLevel, "none">;
  permittedWording: Exclude<
    PricingBenchmarkPermittedWording,
    "do_not_claim"
  >;

  limitations: string[];
  reasonCodes: readonly [];

  policyVersions: Readonly<{
    diagnosticContractVersion: string;
    positionPolicyVersion: string;
    actionPolicyVersion: string;
    evidenceContractVersion: string;
  }>;
}>;

export type PricingDiagnosticV2Result =
  | Readonly<{
      available: true;
      diagnostic: PricingDiagnosticV2;
    }>
  | Readonly<{
      available: false;
      status:
        | "invalid_input"
        | "currency_mismatch"
        | "insufficient_evidence";
      reasonCodes: PricingDiagnosticV2ReasonCode[];
    }>;

export type PricingDiagnosticV2ValidationResult =
  | Readonly<{
      valid: true;
    }>
  | Readonly<{
      valid: false;
      status:
        | "invalid_input"
        | "currency_mismatch"
        | "insufficient_evidence";
      reasonCodes: PricingDiagnosticV2ReasonCode[];
    }>;

const SUPPORTED_FALLBACK_LEVELS = new Set<PricingBenchmarkFallbackLevel>([
  "exact",
  "capacity_unknown",
  "property_unknown",
  "property_capacity_unknown",
]);

function normalizeCurrency(value: string): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function uniqueSortedStrings(values: ReadonlyArray<string>): string[] {
  return [
    ...new Set(
      values.filter(
        (value) => typeof value === "string" && value.trim().length > 0,
      ),
    ),
  ].sort();
}

function uniqueSortedReasonCodes(
  values: Iterable<PricingDiagnosticV2ReasonCode>,
): PricingDiagnosticV2ReasonCode[] {
  return [...new Set(values)].sort();
}

function isValidDistribution(
  distribution: PricingBenchmarkEvidence["distribution"],
): boolean {
  return (
    Number.isFinite(distribution.p10) &&
    Number.isFinite(distribution.p25) &&
    Number.isFinite(distribution.median) &&
    Number.isFinite(distribution.p75) &&
    Number.isFinite(distribution.p90) &&
    distribution.p10 > 0 &&
    distribution.p25 > 0 &&
    distribution.median > 0 &&
    distribution.p75 > 0 &&
    distribution.p90 > 0 &&
    distribution.p10 <= distribution.p25 &&
    distribution.p25 <= distribution.median &&
    distribution.median <= distribution.p75 &&
    distribution.p75 <= distribution.p90
  );
}

function isUsableEvidenceStrength(
  value: PricingBenchmarkEvidenceStrength,
): value is Exclude<PricingBenchmarkEvidenceStrength, "unavailable"> {
  return value === "limited" || value === "moderate" || value === "strong";
}

function isUsablePermittedWording(
  value: PricingBenchmarkPermittedWording,
): value is Exclude<PricingBenchmarkPermittedWording, "do_not_claim"> {
  return (
    value === "strong_market_evidence" ||
    value === "moderate_market_evidence" ||
    value === "limited_market_evidence"
  );
}

function roundToOneDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function validatePricingDiagnosticInput(
  input: PricingDiagnosticV2Input,
): PricingDiagnosticV2ValidationResult {
  const reasonCodes = new Set<PricingDiagnosticV2ReasonCode>();
  const price = input.listingNightlyPrice;
  const evidence = input.pricingBenchmarkEvidence;

  if (!Number.isFinite(price) || price <= 0) {
    reasonCodes.add("invalid_listing_price");
  }

  const inputCurrency = normalizeCurrency(input.currency);
  const evidenceCurrency = normalizeCurrency(
    evidence.resolvedMarketCell.currency,
  );

  if (!inputCurrency || !evidenceCurrency || inputCurrency !== evidenceCurrency) {
    reasonCodes.add("currency_mismatch");
  }

  if (!isValidDistribution(evidence.distribution)) {
    reasonCodes.add("benchmark_distribution_invalid");
  }

  if (!isUsableEvidenceStrength(evidence.evidenceStrength)) {
    reasonCodes.add("evidence_too_weak");
  }

  if (!isUsablePermittedWording(evidence.permittedWording)) {
    reasonCodes.add("evidence_unavailable");
  }

  if (!SUPPORTED_FALLBACK_LEVELS.has(evidence.fallbackLevel)) {
    reasonCodes.add("unsupported_fallback");
  }

  if (reasonCodes.size === 0) {
    return Object.freeze({ valid: true });
  }

  const normalizedReasons = uniqueSortedReasonCodes(reasonCodes);

  if (normalizedReasons.includes("currency_mismatch")) {
    return Object.freeze({
      valid: false,
      status: "currency_mismatch",
      reasonCodes: normalizedReasons,
    });
  }

  if (
    normalizedReasons.includes("evidence_too_weak") ||
    normalizedReasons.includes("evidence_unavailable")
  ) {
    return Object.freeze({
      valid: false,
      status: "insufficient_evidence",
      reasonCodes: normalizedReasons,
    });
  }

  return Object.freeze({
    valid: false,
    status: "invalid_input",
    reasonCodes: normalizedReasons,
  });
}

export function derivePricingPositionBand(
  price: number,
  range: PricingDiagnosticMarketRange,
): PricingPositionBand {
  if (price < range.p10) {
    return "deep_discount";
  }
  if (price < range.p25) {
    return "below_market";
  }
  if (price < range.median) {
    return "slightly_below";
  }
  if (price <= range.p75) {
    return "market_aligned";
  }
  if (price <= range.p90) {
    return "premium_position";
  }
  return "high_outlier";
}

export function derivePricingPercentileBand(
  price: number,
  range: PricingDiagnosticMarketRange,
): PricingPercentileBand {
  if (price < range.p10) {
    return "below_p10";
  }
  if (price < range.p25) {
    return "p10_to_p25";
  }
  if (price < range.median) {
    return "p25_to_p50";
  }
  if (price <= range.p75) {
    return "p50_to_p75";
  }
  if (price <= range.p90) {
    return "p75_to_p90";
  }
  return "above_p90";
}

export function derivePricingInterquartilePosition(
  price: number,
  range: PricingDiagnosticMarketRange,
): PricingInterquartilePosition {
  if (price < range.p25) {
    return "below_iqr";
  }
  if (price <= range.p75) {
    return "inside_iqr";
  }
  return "above_iqr";
}

export function deriveMedianDeltaPercent(
  price: number,
  median: number,
): number | null {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(median) ||
    price <= 0 ||
    median <= 0
  ) {
    return null;
  }

  return roundToOneDecimal(((price - median) / median) * 100);
}

export function derivePricingSignal(
  positionBand: PricingPositionBand,
): PricingSignal {
  switch (positionBand) {
    case "deep_discount":
    case "below_market":
    case "slightly_below":
      return "under_positioned";
    case "market_aligned":
      return "aligned";
    case "premium_position":
      return "premium_position";
    case "high_outlier":
      return "high_outlier";
  }
}

function deriveBaseRecommendedAction(
  positionBand: PricingPositionBand,
): PricingRecommendedAction {
  switch (positionBand) {
    case "deep_discount":
    case "below_market":
      return "test_higher_price";
    case "slightly_below":
    case "market_aligned":
      return "hold_price";
    case "premium_position":
      return "monitor_position";
    case "high_outlier":
      return "review_price_support";
  }
}

export function deriveRecommendedAction(input: Readonly<{
  positionBand: PricingPositionBand;
  evidenceStrength: PricingBenchmarkEvidenceStrength;
  freshnessStatus: PricingBenchmarkEvidence["freshnessStatus"];
  fallbackLevel: PricingBenchmarkFallbackLevel;
}>): PricingRecommendedAction {
  if (input.evidenceStrength === "unavailable") {
    return "insufficient_evidence";
  }

  const baseAction = deriveBaseRecommendedAction(input.positionBand);
  const actionIsStrong =
    baseAction === "test_higher_price" ||
    baseAction === "review_price_support";

  const mustRemainWeak =
    input.evidenceStrength === "limited" ||
    input.freshnessStatus === "aging" ||
    input.fallbackLevel === "property_capacity_unknown";

  if (mustRemainWeak && actionIsStrong) {
    return "monitor_position";
  }

  return baseAction;
}

function buildDiagnosticLimitations(
  evidence: PricingBenchmarkEvidence,
  recommendedAction: PricingRecommendedAction,
  baseAction: PricingRecommendedAction,
): string[] {
  const limitations = new Set(uniqueSortedStrings(evidence.limitations));

  if (evidence.fallbackLevel !== "exact") {
    limitations.add("benchmark_fallback");
  }

  if (evidence.fallbackLevel === "property_capacity_unknown") {
    limitations.add("broad_market_cell");
  }

  if (evidence.freshnessStatus === "aging") {
    limitations.add("aging_evidence");
    limitations.add("limited_evidence");
  }

  if (evidence.evidenceStrength === "moderate") {
    limitations.add("limited_evidence");
  }

  if (evidence.evidenceStrength === "limited") {
    limitations.add("limited_evidence");
  }

  if (recommendedAction !== baseAction) {
    limitations.add("weak_action_only");
  }

  return [...limitations].sort();
}

export function buildPricingDiagnosticV2(
  input: PricingDiagnosticV2Input,
): PricingDiagnosticV2Result {
  const validation = validatePricingDiagnosticInput(input);

  if (!validation.valid) {
    return Object.freeze({
      available: false,
      status: validation.status,
      reasonCodes: [...validation.reasonCodes],
    });
  }

  const evidence = input.pricingBenchmarkEvidence;
  const marketRange: PricingDiagnosticMarketRange = Object.freeze({
    p10: evidence.distribution.p10,
    p25: evidence.distribution.p25,
    median: evidence.distribution.median,
    p75: evidence.distribution.p75,
    p90: evidence.distribution.p90,
  });

  const medianDeltaPercent = deriveMedianDeltaPercent(
    input.listingNightlyPrice,
    marketRange.median,
  );

  if (medianDeltaPercent == null) {
    return Object.freeze({
      available: false,
      status: "invalid_input",
      reasonCodes: [
        "benchmark_distribution_invalid",
      ] satisfies PricingDiagnosticV2ReasonCode[],
    });
  }

  const positionBand = derivePricingPositionBand(
    input.listingNightlyPrice,
    marketRange,
  );
  const percentileBand = derivePricingPercentileBand(
    input.listingNightlyPrice,
    marketRange,
  );
  const interquartilePosition = derivePricingInterquartilePosition(
    input.listingNightlyPrice,
    marketRange,
  );
  const pricingSignal = derivePricingSignal(positionBand);
  const baseAction = deriveBaseRecommendedAction(positionBand);
  const recommendedAction = deriveRecommendedAction({
    positionBand,
    evidenceStrength: evidence.evidenceStrength,
    freshnessStatus: evidence.freshnessStatus,
    fallbackLevel: evidence.fallbackLevel,
  });

  const limited =
    evidence.evidenceStrength === "limited" ||
    evidence.freshnessStatus === "aging" ||
    evidence.fallbackLevel === "property_capacity_unknown";

  const diagnostic: PricingDiagnosticV2 = Object.freeze({
    diagnosticContractVersion:
      INTELLIGENCE_V2_PRICING_DIAGNOSTIC_CONTRACT_VERSION,
    status: limited ? "limited" : "available",

    currency: normalizeCurrency(input.currency),
    benchmarkPeriod: evidence.capturePeriodBucket,

    positionBand,
    percentileBand,
    interquartilePosition,
    medianDeltaPercent,

    marketRange,

    pricingSignal,
    recommendedAction,

    evidenceStrength: evidence.evidenceStrength as Exclude<
      PricingBenchmarkEvidenceStrength,
      "unavailable"
    >,
    confidenceLevel: evidence.confidenceLevel,
    fallbackLevel: evidence.fallbackLevel as Exclude<
      PricingBenchmarkFallbackLevel,
      "none"
    >,
    permittedWording: evidence.permittedWording as Exclude<
      PricingBenchmarkPermittedWording,
      "do_not_claim"
    >,

    limitations: buildDiagnosticLimitations(
      evidence,
      recommendedAction,
      baseAction,
    ),
    reasonCodes: [] as const,

    policyVersions: Object.freeze({
      diagnosticContractVersion:
        INTELLIGENCE_V2_PRICING_DIAGNOSTIC_CONTRACT_VERSION,
      positionPolicyVersion:
        INTELLIGENCE_V2_PRICING_POSITION_POLICY_VERSION,
      actionPolicyVersion:
        INTELLIGENCE_V2_PRICING_ACTION_POLICY_VERSION,
      evidenceContractVersion: evidence.evidenceContractVersion,
    }),
  });

  return Object.freeze({
    available: true,
    diagnostic,
  });
}
