import type {
  PricingDiagnosticV2,
  PricingPercentileBand,
  PricingPositionBand,
  PricingRecommendedAction,
  PricingSignal,
} from "./pricingDiagnosticV2";

export const INTELLIGENCE_V2_PRIVATE_PRICING_DIAGNOSTIC_PROJECTION_CONTRACT_VERSION =
  "v1";

export type PrivatePricingDiagnosticProjectionFallbackLevel =
  | "exact"
  | "capacity_unknown"
  | "property_unknown"
  | "property_capacity_unknown";

export type PrivatePricingDiagnosticProjectionEvidenceStrength =
  | "limited"
  | "moderate"
  | "strong";

export type PrivatePricingDiagnosticProjection = Readonly<{
  projectionContractVersion: string;
  diagnosticContractVersion: string;

  status: "available" | "limited";
  currency: string;
  benchmarkPeriod: string;

  positionBand: PricingPositionBand;
  percentileBand: PricingPercentileBand;
  medianDeltaPercent: number;

  pricingSignal: PricingSignal;
  recommendedAction: PricingRecommendedAction;

  evidenceStrength: PrivatePricingDiagnosticProjectionEvidenceStrength;
  fallbackLevel: PrivatePricingDiagnosticProjectionFallbackLevel;

  limitations: string[];

  policyVersions: Readonly<{
    projectionContractVersion: string;
    diagnosticContractVersion: string;
    positionPolicyVersion: string;
    actionPolicyVersion: string;
  }>;
}>;

export type PrivatePricingDiagnosticProjectionReasonCode =
  | "invalid_diagnostic"
  | "invalid_currency"
  | "invalid_benchmark_period"
  | "invalid_median_delta"
  | "unsupported_status"
  | "unsupported_position_band"
  | "unsupported_percentile_band"
  | "unsupported_pricing_signal"
  | "unsupported_recommended_action"
  | "unsupported_evidence_strength"
  | "unsupported_fallback_level"
  | "invalid_policy_versions";

export type PrivatePricingDiagnosticProjectionResult =
  | Readonly<{
      projected: true;
      projection: PrivatePricingDiagnosticProjection;
    }>
  | Readonly<{
      projected: false;
      status: "invalid_input";
      reasonCodes: PrivatePricingDiagnosticProjectionReasonCode[];
    }>;

const POSITION_BANDS = new Set<PricingPositionBand>([
  "deep_discount",
  "below_market",
  "slightly_below",
  "market_aligned",
  "premium_position",
  "high_outlier",
]);

const PERCENTILE_BANDS = new Set<PricingPercentileBand>([
  "below_p10",
  "p10_to_p25",
  "p25_to_p50",
  "p50_to_p75",
  "p75_to_p90",
  "above_p90",
]);

const PRICING_SIGNALS = new Set<PricingSignal>([
  "under_positioned",
  "aligned",
  "premium_position",
  "high_outlier",
]);

const RECOMMENDED_ACTIONS = new Set<PricingRecommendedAction>([
  "test_higher_price",
  "hold_price",
  "monitor_position",
  "review_price_support",
  "insufficient_evidence",
]);

const EVIDENCE_STRENGTHS =
  new Set<PrivatePricingDiagnosticProjectionEvidenceStrength>([
    "limited",
    "moderate",
    "strong",
  ]);

const FALLBACK_LEVELS =
  new Set<PrivatePricingDiagnosticProjectionFallbackLevel>([
    "exact",
    "capacity_unknown",
    "property_unknown",
    "property_capacity_unknown",
  ]);

const MONTH_BUCKET_REGEX = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueSortedStrings(values: ReadonlyArray<unknown>): string[] {
  return [
    ...new Set(
      values
        .filter(isNonEmptyString)
        .map((value) => value.trim()),
    ),
  ].sort();
}

function uniqueSortedReasonCodes(
  values: Iterable<PrivatePricingDiagnosticProjectionReasonCode>,
): PrivatePricingDiagnosticProjectionReasonCode[] {
  return [...new Set(values)].sort();
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

function hasValidPolicyVersions(
  diagnostic: PricingDiagnosticV2,
): boolean {
  return (
    isNonEmptyString(diagnostic.diagnosticContractVersion) &&
    isNonEmptyString(
      diagnostic.policyVersions.diagnosticContractVersion,
    ) &&
    isNonEmptyString(
      diagnostic.policyVersions.positionPolicyVersion,
    ) &&
    isNonEmptyString(
      diagnostic.policyVersions.actionPolicyVersion,
    ) &&
    diagnostic.diagnosticContractVersion ===
      diagnostic.policyVersions.diagnosticContractVersion
  );
}

export function projectPrivatePricingDiagnostic(
  diagnostic: PricingDiagnosticV2,
): PrivatePricingDiagnosticProjectionResult {
  const reasonCodes =
    new Set<PrivatePricingDiagnosticProjectionReasonCode>();

  if (
    diagnostic == null ||
    typeof diagnostic !== "object"
  ) {
    reasonCodes.add("invalid_diagnostic");
  }

  if (
    diagnostic.status !== "available" &&
    diagnostic.status !== "limited"
  ) {
    reasonCodes.add("unsupported_status");
  }

  const currency = normalizeCurrency(diagnostic.currency);
  if (!CURRENCY_REGEX.test(currency)) {
    reasonCodes.add("invalid_currency");
  }

  if (!MONTH_BUCKET_REGEX.test(diagnostic.benchmarkPeriod)) {
    reasonCodes.add("invalid_benchmark_period");
  }

  if (
    !Number.isFinite(diagnostic.medianDeltaPercent)
  ) {
    reasonCodes.add("invalid_median_delta");
  }

  if (!POSITION_BANDS.has(diagnostic.positionBand)) {
    reasonCodes.add("unsupported_position_band");
  }

  if (!PERCENTILE_BANDS.has(diagnostic.percentileBand)) {
    reasonCodes.add("unsupported_percentile_band");
  }

  if (!PRICING_SIGNALS.has(diagnostic.pricingSignal)) {
    reasonCodes.add("unsupported_pricing_signal");
  }

  if (
    !RECOMMENDED_ACTIONS.has(
      diagnostic.recommendedAction,
    )
  ) {
    reasonCodes.add("unsupported_recommended_action");
  }

  if (
    !EVIDENCE_STRENGTHS.has(
      diagnostic.evidenceStrength,
    )
  ) {
    reasonCodes.add("unsupported_evidence_strength");
  }

  if (!FALLBACK_LEVELS.has(diagnostic.fallbackLevel)) {
    reasonCodes.add("unsupported_fallback_level");
  }

  if (!hasValidPolicyVersions(diagnostic)) {
    reasonCodes.add("invalid_policy_versions");
  }

  if (reasonCodes.size > 0) {
    return Object.freeze({
      projected: false,
      status: "invalid_input",
      reasonCodes: uniqueSortedReasonCodes(reasonCodes),
    });
  }

  const projection: PrivatePricingDiagnosticProjection =
    Object.freeze({
      projectionContractVersion:
        INTELLIGENCE_V2_PRIVATE_PRICING_DIAGNOSTIC_PROJECTION_CONTRACT_VERSION,
      diagnosticContractVersion:
        diagnostic.diagnosticContractVersion,

      status: diagnostic.status,
      currency,
      benchmarkPeriod: diagnostic.benchmarkPeriod,

      positionBand: diagnostic.positionBand,
      percentileBand: diagnostic.percentileBand,
      medianDeltaPercent: diagnostic.medianDeltaPercent,

      pricingSignal: diagnostic.pricingSignal,
      recommendedAction: diagnostic.recommendedAction,

      evidenceStrength: diagnostic.evidenceStrength,
      fallbackLevel: diagnostic.fallbackLevel,

      limitations: uniqueSortedStrings(
        diagnostic.limitations,
      ),

      policyVersions: Object.freeze({
        projectionContractVersion:
          INTELLIGENCE_V2_PRIVATE_PRICING_DIAGNOSTIC_PROJECTION_CONTRACT_VERSION,
        diagnosticContractVersion:
          diagnostic.policyVersions.diagnosticContractVersion,
        positionPolicyVersion:
          diagnostic.policyVersions.positionPolicyVersion,
        actionPolicyVersion:
          diagnostic.policyVersions.actionPolicyVersion,
      }),
    });

  return Object.freeze({
    projected: true,
    projection,
  });
}
