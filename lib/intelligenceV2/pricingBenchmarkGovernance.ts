import {
  INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
  INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
  INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
  INTELLIGENCE_V2_BENCHMARK_GOVERNANCE_CONTRACT_VERSION,
  INTELLIGENCE_V2_BENCHMARK_QUALITY_POLICY_VERSION,
  INTELLIGENCE_V2_BENCHMARK_USAGE_POLICY_VERSION,
  INTELLIGENCE_V2_COHORT_POLICY_VERSION,
  INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
  INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
  INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
} from "./policyVersions";

const KNOWN_LIMITATION_CODES = [
  "small_sample",
  "low_source_diversity",
  "unknown_property_type",
  "unknown_capacity",
  "aging_data",
] as const;

type PricingBenchmarkGovernanceLimitationCode =
  (typeof KNOWN_LIMITATION_CODES)[number];

export type PricingBenchmarkGovernanceInput = {
  benchmarkType: "pricing_distribution";
  approvalStatus:
    | "draft"
    | "insufficient"
    | "exploratory"
    | "internal_approved"
    | "audit_approved"
    | "revoked";
  approvedForInternal: boolean;
  approvedForAudit: boolean;
  propertyType:
    | "studio"
    | "apartment"
    | "villa"
    | "riad"
    | "room"
    | "hotel"
    | "unknown";
  capacityBand:
    | "unknown"
    | "1_3"
    | "4_6"
    | "7_9"
    | "10_plus";
  platform: "airbnb" | "booking" | "expedia" | "agoda" | "vrbo";
  currency: string;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  rawSampleSize: number;
  includedSampleSize: number;
  excludedOutlierCount: number;
  sourceClassCount: number;
  sourceDiversityBand: "unknown" | "low" | "moderate" | "high";
  confidenceLevel: "very_low" | "low" | "moderate" | "high" | "very_high";
  validFrom: string;
  validUntil: string;
  limitations: string[];
  artifactContractVersion: string;
  cohortPolicyVersion: string;
  aggregationPolicyVersion: string;
  outlierPolicyVersion: string;
  confidencePolicyVersion: string;
  freshnessPolicyVersion: string;
  approvalPolicyVersion: string;
  marketCellPolicyVersion: string;
  superseded: boolean;
  now?: string;
};

export type PricingBenchmarkGovernanceDecision =
  | "usable"
  | "usable_with_limits"
  | "internal_only"
  | "quarantined"
  | "revoked";

export type PricingBenchmarkGovernanceUsage =
  | "internal_analysis"
  | "private_audit";

export type PricingBenchmarkGovernanceRiskLevel =
  | "low"
  | "moderate"
  | "high"
  | "critical";

export type PricingBenchmarkGovernanceQualityBand =
  | "very_low"
  | "low"
  | "moderate"
  | "high"
  | "very_high";

export type PricingBenchmarkGovernanceStabilityBand =
  | "unknown"
  | "stable"
  | "moderate_drift"
  | "high_drift";

export type PricingBenchmarkRepresentativenessBand =
  | "low"
  | "moderate"
  | "high";

export type PricingBenchmarkGovernanceFreshnessBand =
  | "not_yet_valid"
  | "fresh"
  | "aging"
  | "expired";

export type PricingBenchmarkGovernanceReasonCode =
  | "artifact_revoked"
  | "artifact_superseded"
  | "artifact_expired"
  | "artifact_not_yet_valid"
  | "artifact_not_audit_approved"
  | "artifact_policy_incompatible"
  | "sample_too_small"
  | "low_source_diversity"
  | "unknown_property_type"
  | "unknown_capacity"
  | "distribution_malformed"
  | "distribution_extreme_spread"
  | "aging_data"
  | "quality_gate_failed";

export type PricingBenchmarkGovernanceResult =
  | {
      accepted: true;
      decision: "usable" | "usable_with_limits" | "internal_only";
      approvedUses: PricingBenchmarkGovernanceUsage[];
      riskLevel: PricingBenchmarkGovernanceRiskLevel;
      qualityBand: PricingBenchmarkGovernanceQualityBand;
      stabilityBand: PricingBenchmarkGovernanceStabilityBand;
      representativenessBand: PricingBenchmarkRepresentativenessBand;
      freshnessBand: "fresh" | "aging";
      reasonCodes: PricingBenchmarkGovernanceReasonCode[];
      limitationCodes: string[];
      policyVersions: {
        governanceContractVersion: string;
        qualityPolicyVersion: string;
        usagePolicyVersion: string;
      };
      evaluatedAt: string;
    }
  | {
      accepted: false;
      decision: "quarantined" | "revoked";
      approvedUses: [];
      riskLevel: "high" | "critical";
      qualityBand: "very_low" | "low";
      stabilityBand: PricingBenchmarkGovernanceStabilityBand;
      representativenessBand: PricingBenchmarkRepresentativenessBand;
      freshnessBand:
        | "not_yet_valid"
        | "fresh"
        | "aging"
        | "expired";
      reasonCodes: PricingBenchmarkGovernanceReasonCode[];
      limitationCodes: string[];
      policyVersions: {
        governanceContractVersion: string;
        qualityPolicyVersion: string;
        usagePolicyVersion: string;
      };
      evaluatedAt: string;
    };

export type PricingBenchmarkGovernanceValidationResult =
  | Readonly<{ valid: true }>
  | Readonly<{
      valid: false;
      reasonCodes: PricingBenchmarkGovernanceReasonCode[];
    }>;

function uniqueSortedStrings<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort() as T[];
}

function parseTimestampMs(value: string | null | undefined): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveEvaluatedAt(now?: string): string {
  const nowMs = parseTimestampMs(now);
  return nowMs == null ? new Date().toISOString() : new Date(nowMs).toISOString();
}

function normalizeLimitationCodes(
  limitations: ReadonlyArray<string>,
): PricingBenchmarkGovernanceLimitationCode[] {
  const normalized = limitations
    .filter((value): value is PricingBenchmarkGovernanceLimitationCode =>
      KNOWN_LIMITATION_CODES.includes(value as PricingBenchmarkGovernanceLimitationCode),
    );
  return uniqueSortedStrings(normalized);
}

function hasCompatiblePolicyFamily(input: PricingBenchmarkGovernanceInput): boolean {
  return (
    input.artifactContractVersion ===
      INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION &&
    input.cohortPolicyVersion === INTELLIGENCE_V2_COHORT_POLICY_VERSION &&
    input.aggregationPolicyVersion === INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION &&
    input.outlierPolicyVersion === INTELLIGENCE_V2_OUTLIER_POLICY_VERSION &&
    input.confidencePolicyVersion === INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION &&
    input.freshnessPolicyVersion === INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION &&
    input.approvalPolicyVersion === INTELLIGENCE_V2_APPROVAL_POLICY_VERSION &&
    input.marketCellPolicyVersion === INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION
  );
}

function isDistributionMalformed(input: PricingBenchmarkGovernanceInput): boolean {
  return (
    !Number.isFinite(input.p10) ||
    !Number.isFinite(input.p25) ||
    !Number.isFinite(input.median) ||
    !Number.isFinite(input.p75) ||
    !Number.isFinite(input.p90) ||
    input.p10 <= 0 ||
    input.p25 <= 0 ||
    input.median <= 0 ||
    input.p75 <= 0 ||
    input.p90 <= 0 ||
    input.p10 > input.p25 ||
    input.p25 > input.median ||
    input.median > input.p75 ||
    input.p75 > input.p90
  );
}

function deriveSpreadRatio(input: PricingBenchmarkGovernanceInput): number | null {
  if (!Number.isFinite(input.p10) || !Number.isFinite(input.p90) || input.p10 <= 0) {
    return null;
  }
  return input.p90 / input.p10;
}

function buildPolicyVersions() {
  return Object.freeze({
    governanceContractVersion:
      INTELLIGENCE_V2_BENCHMARK_GOVERNANCE_CONTRACT_VERSION,
    qualityPolicyVersion: INTELLIGENCE_V2_BENCHMARK_QUALITY_POLICY_VERSION,
    usagePolicyVersion: INTELLIGENCE_V2_BENCHMARK_USAGE_POLICY_VERSION,
  });
}

function buildAcceptedResult(input: {
  decision: "usable" | "usable_with_limits" | "internal_only";
  includedSampleSize: number;
  representativenessBand: PricingBenchmarkRepresentativenessBand;
  freshnessBand: "fresh" | "aging";
  reasonCodes: Iterable<PricingBenchmarkGovernanceReasonCode>;
  limitationCodes: ReadonlyArray<string>;
  evaluatedAt: string;
}): PricingBenchmarkGovernanceResult {
  const approvedUses: PricingBenchmarkGovernanceUsage[] =
    input.decision === "internal_only"
      ? ["internal_analysis"]
      : ["internal_analysis", "private_audit"];

  return Object.freeze({
    accepted: true,
    decision: input.decision,
    approvedUses,
    riskLevel: derivePricingBenchmarkRiskLevel(input.decision),
    qualityBand: derivePricingBenchmarkQualityBand({
      decision: input.decision,
      includedSampleSize: input.includedSampleSize,
    }),
    stabilityBand: "unknown",
    representativenessBand: input.representativenessBand,
    freshnessBand: input.freshnessBand,
    reasonCodes: uniqueSortedStrings(input.reasonCodes),
    limitationCodes: uniqueSortedStrings(input.limitationCodes),
    policyVersions: buildPolicyVersions(),
    evaluatedAt: input.evaluatedAt,
  });
}

function buildRejectedResult(input: {
  decision: "quarantined" | "revoked";
  representativenessBand: PricingBenchmarkRepresentativenessBand;
  freshnessBand: PricingBenchmarkGovernanceFreshnessBand;
  reasonCodes: Iterable<PricingBenchmarkGovernanceReasonCode>;
  limitationCodes: ReadonlyArray<string>;
  evaluatedAt: string;
}): PricingBenchmarkGovernanceResult {
  const reasonCodes = uniqueSortedStrings(input.reasonCodes);
  const qualityBand: "very_low" | "low" =
    input.decision === "revoked" ||
    reasonCodes.includes("distribution_malformed") ||
    reasonCodes.includes("quality_gate_failed") ||
    reasonCodes.includes("sample_too_small")
      ? "very_low"
      : "low";
  const riskLevel: "high" | "critical" =
    input.decision === "revoked" ? "critical" : "high";

  return Object.freeze({
    accepted: false,
    decision: input.decision,
    approvedUses: [] as [],
    riskLevel,
    qualityBand,
    stabilityBand: "unknown",
    representativenessBand: input.representativenessBand,
    freshnessBand: input.freshnessBand,
    reasonCodes,
    limitationCodes: uniqueSortedStrings(input.limitationCodes),
    policyVersions: buildPolicyVersions(),
    evaluatedAt: input.evaluatedAt,
  });
}

export function derivePricingBenchmarkGovernanceFreshness(
  validFrom: string,
  validUntil: string,
  now?: string,
): PricingBenchmarkGovernanceFreshnessBand {
  const validFromMs = parseTimestampMs(validFrom);
  const validUntilMs = parseTimestampMs(validUntil);
  const nowMs = parseTimestampMs(now) ?? Date.now();

  if (validFromMs == null || validUntilMs == null || !Number.isFinite(nowMs)) {
    return "expired";
  }
  if (nowMs < validFromMs) {
    return "not_yet_valid";
  }
  if (nowMs >= validUntilMs) {
    return "expired";
  }
  if (validUntilMs - nowMs <= 7 * 24 * 60 * 60 * 1000) {
    return "aging";
  }
  return "fresh";
}

export function derivePricingBenchmarkRepresentativeness(
  propertyType: PricingBenchmarkGovernanceInput["propertyType"],
  capacityBand: PricingBenchmarkGovernanceInput["capacityBand"],
): PricingBenchmarkRepresentativenessBand {
  const unknownCount =
    (propertyType === "unknown" ? 1 : 0) + (capacityBand === "unknown" ? 1 : 0);

  if (unknownCount >= 2) {
    return "low";
  }
  if (unknownCount === 1) {
    return "moderate";
  }
  return "high";
}

export function derivePricingBenchmarkQualityBand(input: {
  decision: PricingBenchmarkGovernanceDecision;
  includedSampleSize: number;
}): PricingBenchmarkGovernanceQualityBand {
  switch (input.decision) {
    case "usable":
      return "very_high";
    case "usable_with_limits":
      return "high";
    case "internal_only":
      return input.includedSampleSize < 10 ? "low" : "moderate";
    case "quarantined":
    case "revoked":
      return "very_low";
  }
}

export function derivePricingBenchmarkRiskLevel(
  decision: PricingBenchmarkGovernanceDecision,
): PricingBenchmarkGovernanceRiskLevel {
  switch (decision) {
    case "usable":
      return "low";
    case "usable_with_limits":
      return "moderate";
    case "revoked":
      return "critical";
    case "internal_only":
    case "quarantined":
      return "high";
  }
}

export function validatePricingBenchmarkGovernanceInput(
  input: PricingBenchmarkGovernanceInput,
): PricingBenchmarkGovernanceValidationResult {
  const reasonCodes = new Set<PricingBenchmarkGovernanceReasonCode>();
  const validFromMs = parseTimestampMs(input.validFrom);
  const validUntilMs = parseTimestampMs(input.validUntil);

  if (input.benchmarkType !== "pricing_distribution") {
    reasonCodes.add("quality_gate_failed");
  }
  if (isDistributionMalformed(input)) {
    reasonCodes.add("distribution_malformed");
  }
  if (
    !Number.isInteger(input.rawSampleSize) ||
    input.rawSampleSize < 0 ||
    !Number.isInteger(input.includedSampleSize) ||
    input.includedSampleSize < 0 ||
    input.includedSampleSize > input.rawSampleSize ||
    !Number.isInteger(input.excludedOutlierCount) ||
    input.excludedOutlierCount < 0 ||
    input.excludedOutlierCount > input.rawSampleSize ||
    !Number.isInteger(input.sourceClassCount) ||
    input.sourceClassCount < 0 ||
    !/^[A-Z]{3}$/.test(input.currency)
  ) {
    reasonCodes.add("quality_gate_failed");
  }
  if (!hasCompatiblePolicyFamily(input)) {
    reasonCodes.add("artifact_policy_incompatible");
  }
  if (input.superseded === true) {
    reasonCodes.add("artifact_superseded");
  }
  if (
    validFromMs == null ||
    validUntilMs == null ||
    validUntilMs <= validFromMs
  ) {
    reasonCodes.add("quality_gate_failed");
  }

  if (reasonCodes.size > 0) {
    return Object.freeze({
      valid: false,
      reasonCodes: uniqueSortedStrings(reasonCodes),
    });
  }

  return Object.freeze({ valid: true });
}

export function evaluatePricingBenchmarkGovernance(
  input: PricingBenchmarkGovernanceInput,
): PricingBenchmarkGovernanceResult {
  const evaluatedAt = resolveEvaluatedAt(input.now);
  const freshnessBand = derivePricingBenchmarkGovernanceFreshness(
    input.validFrom,
    input.validUntil,
    evaluatedAt,
  );
  const representativenessBand = derivePricingBenchmarkRepresentativeness(
    input.propertyType,
    input.capacityBand,
  );
  const normalizedLimitations = normalizeLimitationCodes(input.limitations);
  const validation = validatePricingBenchmarkGovernanceInput(input);
  const reasonCodes = new Set<PricingBenchmarkGovernanceReasonCode>();

  const hasLowSourceDiversity =
    input.sourceClassCount < 2 ||
    input.sourceDiversityBand === "low" ||
    normalizedLimitations.includes("low_source_diversity");
  const hasUnknownProperty =
    input.propertyType === "unknown" ||
    normalizedLimitations.includes("unknown_property_type");
  const hasUnknownCapacity =
    input.capacityBand === "unknown" ||
    normalizedLimitations.includes("unknown_capacity");
  const hasAgingSignal =
    freshnessBand === "aging" || normalizedLimitations.includes("aging_data");
  const hasExtremeSpread = (deriveSpreadRatio(input) ?? 0) > 5;
  const hasAuditApproval =
    input.approvalStatus === "audit_approved" && input.approvedForAudit === true;
  const hasInternalApproval =
    input.approvedForInternal === true ||
    input.approvalStatus === "exploratory" ||
    input.approvalStatus === "internal_approved" ||
    input.approvalStatus === "audit_approved";

  if (hasLowSourceDiversity) {
    reasonCodes.add("low_source_diversity");
  }
  if (hasUnknownProperty) {
    reasonCodes.add("unknown_property_type");
  }
  if (hasUnknownCapacity) {
    reasonCodes.add("unknown_capacity");
  }
  if (hasAgingSignal) {
    reasonCodes.add("aging_data");
  }
  if (hasExtremeSpread) {
    reasonCodes.add("distribution_extreme_spread");
  }
  if (
    input.includedSampleSize < 20 ||
    normalizedLimitations.includes("small_sample")
  ) {
    reasonCodes.add("sample_too_small");
  }

  if (input.approvalStatus === "revoked") {
    reasonCodes.add("artifact_revoked");
    return buildRejectedResult({
      decision: "revoked",
      representativenessBand,
      freshnessBand,
      reasonCodes,
      limitationCodes: normalizedLimitations,
      evaluatedAt,
    });
  }

  if (!validation.valid) {
    for (const reasonCode of validation.reasonCodes) {
      reasonCodes.add(reasonCode);
    }
    return buildRejectedResult({
      decision: "quarantined",
      representativenessBand,
      freshnessBand,
      reasonCodes,
      limitationCodes: normalizedLimitations,
      evaluatedAt,
    });
  }

  if (freshnessBand === "not_yet_valid") {
    reasonCodes.add("artifact_not_yet_valid");
    return buildRejectedResult({
      decision: "quarantined",
      representativenessBand,
      freshnessBand,
      reasonCodes,
      limitationCodes: normalizedLimitations,
      evaluatedAt,
    });
  }

  if (freshnessBand === "expired") {
    reasonCodes.add("artifact_expired");
    return buildRejectedResult({
      decision: "quarantined",
      representativenessBand,
      freshnessBand,
      reasonCodes,
      limitationCodes: normalizedLimitations,
      evaluatedAt,
    });
  }

  if (input.approvalStatus === "insufficient" || input.includedSampleSize < 5) {
    reasonCodes.add("sample_too_small");
    return buildRejectedResult({
      decision: "quarantined",
      representativenessBand,
      freshnessBand,
      reasonCodes,
      limitationCodes: normalizedLimitations,
      evaluatedAt,
    });
  }

  if (input.approvalStatus === "draft" || !hasInternalApproval) {
    reasonCodes.add("artifact_not_audit_approved");
    return buildRejectedResult({
      decision: "quarantined",
      representativenessBand,
      freshnessBand,
      reasonCodes,
      limitationCodes: normalizedLimitations,
      evaluatedAt,
    });
  }

  if (
    input.approvalStatus === "exploratory" ||
    input.approvalStatus === "internal_approved"
  ) {
    reasonCodes.add("artifact_not_audit_approved");
    return buildAcceptedResult({
      decision: "internal_only",
      includedSampleSize: input.includedSampleSize,
      representativenessBand,
      freshnessBand,
      reasonCodes,
      limitationCodes: normalizedLimitations,
      evaluatedAt,
    });
  }

  if (!hasAuditApproval) {
    reasonCodes.add("artifact_not_audit_approved");
    return buildAcceptedResult({
      decision: "internal_only",
      includedSampleSize: input.includedSampleSize,
      representativenessBand,
      freshnessBand,
      reasonCodes,
      limitationCodes: normalizedLimitations,
      evaluatedAt,
    });
  }

  if (input.includedSampleSize < 20) {
    return buildAcceptedResult({
      decision: "internal_only",
      includedSampleSize: input.includedSampleSize,
      representativenessBand,
      freshnessBand,
      reasonCodes,
      limitationCodes: normalizedLimitations,
      evaluatedAt,
    });
  }

  const structuralWarningCount =
    (hasLowSourceDiversity ? 1 : 0) +
    (hasUnknownProperty ? 1 : 0) +
    (hasUnknownCapacity ? 1 : 0);

  if (
    representativenessBand === "low" ||
    structuralWarningCount >= 2 ||
    !["high", "very_high"].includes(input.confidenceLevel)
  ) {
    if (!["high", "very_high"].includes(input.confidenceLevel)) {
      reasonCodes.add("quality_gate_failed");
    }
    return buildAcceptedResult({
      decision: "internal_only",
      includedSampleSize: input.includedSampleSize,
      representativenessBand,
      freshnessBand,
      reasonCodes,
      limitationCodes: normalizedLimitations,
      evaluatedAt,
    });
  }

  if (
    input.includedSampleSize >= 40 &&
    input.sourceDiversityBand !== "unknown" &&
    input.sourceDiversityBand !== "low" &&
    representativenessBand === "high" &&
    freshnessBand === "fresh" &&
    !hasExtremeSpread &&
    structuralWarningCount === 0
  ) {
    return buildAcceptedResult({
      decision: "usable",
      includedSampleSize: input.includedSampleSize,
      representativenessBand,
      freshnessBand,
      reasonCodes,
      limitationCodes: normalizedLimitations,
      evaluatedAt,
    });
  }

  return buildAcceptedResult({
    decision: "usable_with_limits",
    includedSampleSize: input.includedSampleSize,
    representativenessBand,
    freshnessBand,
    reasonCodes,
    limitationCodes: normalizedLimitations,
    evaluatedAt,
  });
}
