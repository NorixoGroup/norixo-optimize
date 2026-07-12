import {
  buildMarketCellKey,
  buildMarketCellV1,
  type IntelligenceV2CapacityBand,
  type IntelligenceV2PropertyType,
  type MarketCellV1,
} from "./marketCell";
import {
  INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
  INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
  INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
  INTELLIGENCE_V2_BENCHMARK_FALLBACK_POLICY_VERSION,
  INTELLIGENCE_V2_BENCHMARK_SELECTION_POLICY_VERSION,
  INTELLIGENCE_V2_COHORT_POLICY_VERSION,
  INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
  INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
  INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
  INTELLIGENCE_V2_PRICING_BENCHMARK_EVIDENCE_CONTRACT_VERSION,
} from "./policyVersions";

const PRICING_BENCHMARK_TYPE = "pricing_distribution";
const MONTH_BUCKET_REGEX = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

const NOT_APPROVED_REASON_CODES = new Set<PricingBenchmarkEvidenceReasonCode>([
  "revoked_artifact",
  "approval_status_not_audit_approved",
  "approved_for_audit_false",
  "confidence_level_not_allowed",
]);
const POLICY_REASON_CODES = new Set<PricingBenchmarkEvidenceReasonCode>([
  "policy_version_mismatch",
]);

export type PricingBenchmarkEvidenceInput = Readonly<{
  country: string;
  city: string;
  platform: string;
  propertyType?: string | null;
  capacity?: number | null;
  guestCapacity?: number | null;
  currency: string;
  capturePeriodBucket: string;
  intendedUse: "private_audit";
}>;

export type PricingBenchmarkFallbackLevel =
  | "exact"
  | "capacity_unknown"
  | "property_unknown"
  | "property_capacity_unknown"
  | "none";

export type PricingBenchmarkFreshnessStatus =
  | "not_yet_valid"
  | "fresh"
  | "aging"
  | "expired";

export type PricingBenchmarkSampleSizeBand =
  | "under_10"
  | "10_19"
  | "20_39"
  | "40_plus";

export type PricingBenchmarkEvidenceStrength =
  | "unavailable"
  | "limited"
  | "moderate"
  | "strong";

export type PricingBenchmarkPermittedWording =
  | "strong_market_evidence"
  | "moderate_market_evidence"
  | "limited_market_evidence"
  | "do_not_claim";

export type PricingBenchmarkAllowedConfidenceLevel = "high" | "very_high";

export type PricingBenchmarkEvidence = Readonly<{
  evidenceContractVersion: string;
  benchmarkType: "pricing_distribution";
  requestedMarketCell: MarketCellV1;
  resolvedMarketCell: MarketCellV1;
  fallbackLevel: PricingBenchmarkFallbackLevel;
  capturePeriodBucket: string;
  distribution: Readonly<{
    p10: number;
    p25: number;
    median: number;
    p75: number;
    p90: number;
  }>;
  confidenceLevel: PricingBenchmarkAllowedConfidenceLevel;
  freshnessStatus: "fresh" | "aging";
  validFrom: string;
  validUntil: string;
  sampleSizeBand: PricingBenchmarkSampleSizeBand;
  limitations: string[];
  intendedUse: "private_audit";
  evidenceStrength: PricingBenchmarkEvidenceStrength;
  permittedWording: PricingBenchmarkPermittedWording;
  policyVersions: Readonly<{
    artifactContractVersion: string;
    marketCellPolicyVersion: string;
    selectionPolicyVersion: string;
    fallbackPolicyVersion: string;
  }>;
}>;

export type PricingBenchmarkArtifactCandidate = Readonly<{
  id: string;
  benchmarkType: "pricing_distribution";
  approvalStatus: string;
  approvedForAudit: boolean;
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  capacityBand: string;
  currency: string;
  marketCellKey: string;
  capturePeriodBucket: string;
  p10Price: number;
  p25Price: number;
  medianPrice: number;
  p75Price: number;
  p90Price: number;
  includedSampleSize: number;
  confidenceLevel: string;
  validFrom: string;
  validUntil: string;
  limitations: string[];
  artifactContractVersion: string;
  marketCellPolicyVersion: string;
  cohortPolicyVersion: string;
  aggregationPolicyVersion: string;
  outlierPolicyVersion: string;
  confidencePolicyVersion: string;
  freshnessPolicyVersion: string;
  approvalPolicyVersion: string;
  supersedesArtifactId: string | null;
  createdAt: string;
}>;

export type PricingBenchmarkEvidenceReasonCode =
  | "invalid_input"
  | "invalid_capture_period_bucket"
  | "invalid_requested_market_cell"
  | "no_artifact"
  | "benchmark_type_mismatch"
  | "country_mismatch"
  | "city_mismatch"
  | "platform_mismatch"
  | "currency_mismatch"
  | "capture_period_mismatch"
  | "property_type_mismatch"
  | "capacity_band_mismatch"
  | "market_cell_key_mismatch"
  | "revoked_artifact"
  | "approval_status_not_audit_approved"
  | "approved_for_audit_false"
  | "confidence_level_not_allowed"
  | "superseded_artifact"
  | "artifact_not_yet_valid"
  | "artifact_expired"
  | "policy_version_mismatch"
  | "invalid_distribution"
  | "invalid_artifact_timestamp";

export type PricingBenchmarkMarketCellCandidate = Readonly<{
  fallbackLevel: Exclude<PricingBenchmarkFallbackLevel, "none">;
  marketCell: MarketCellV1;
}>;

export type PricingBenchmarkArtifactCandidateValidationResult =
  | Readonly<{
      valid: true;
      confidenceLevel: PricingBenchmarkAllowedConfidenceLevel;
      freshnessStatus: "fresh" | "aging";
      sampleSizeBand: PricingBenchmarkSampleSizeBand;
      normalizedLimitations: string[];
      createdAtMs: number;
    }>
  | Readonly<{
      valid: false;
      status: "unavailable" | "not_approved" | "policy_incompatible";
      reasonCodes: PricingBenchmarkEvidenceReasonCode[];
    }>;

export type PricingBenchmarkArtifactSelectionResult =
  | Readonly<{
      selected: true;
      artifact: PricingBenchmarkArtifactCandidate;
      requestedMarketCell: MarketCellV1;
      resolvedMarketCell: MarketCellV1;
      fallbackLevel: Exclude<PricingBenchmarkFallbackLevel, "none">;
      confidenceLevel: PricingBenchmarkAllowedConfidenceLevel;
      freshnessStatus: "fresh" | "aging";
      sampleSizeBand: PricingBenchmarkSampleSizeBand;
      normalizedLimitations: string[];
    }>
  | Readonly<{
      selected: false;
      status: "unavailable" | "not_approved" | "policy_incompatible";
      reasonCodes: PricingBenchmarkEvidenceReasonCode[];
      requestedMarketCell: MarketCellV1 | null;
    }>;

export type PricingBenchmarkEvidenceProjectionResult =
  | Readonly<{
      available: true;
      evidence: PricingBenchmarkEvidence;
    }>
  | Readonly<{
      available: false;
      status: "unavailable" | "not_approved" | "policy_incompatible";
      reasonCodes: PricingBenchmarkEvidenceReasonCode[];
    }>;

function uniqueSortedStrings(values: ReadonlyArray<string>): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))]
    .sort();
}

function uniqueSortedReasonCodes(
  values: Iterable<PricingBenchmarkEvidenceReasonCode>,
): PricingBenchmarkEvidenceReasonCode[] {
  return [...new Set(values)].sort();
}

function isMonthBucket(value: string): boolean {
  return MONTH_BUCKET_REGEX.test(value);
}

function isSupportedRequestedMarketCell(marketCell: MarketCellV1): boolean {
  return (
    marketCell.country !== "unknown" &&
    marketCell.city !== "unknown" &&
    marketCell.platform !== "unknown" &&
    marketCell.currency !== "UNKNOWN"
  );
}

function buildMarketCellVariant(
  base: MarketCellV1,
  overrides: Readonly<{
    propertyType?: IntelligenceV2PropertyType;
    capacityBand?: IntelligenceV2CapacityBand;
  }>,
): MarketCellV1 {
  const propertyType = overrides.propertyType ?? base.propertyType;
  const capacityBand = overrides.capacityBand ?? base.capacityBand;

  return Object.freeze({
    country: base.country,
    city: base.city,
    platform: base.platform,
    propertyType,
    capacityBand,
    currency: base.currency,
    marketCellKey: buildMarketCellKey({
      country: base.country,
      city: base.city,
      platform: base.platform,
      propertyType,
      capacityBand,
      currency: base.currency,
    }),
  });
}

function resolveFailureStatus(
  reasonCodes: ReadonlyArray<PricingBenchmarkEvidenceReasonCode>,
): "unavailable" | "not_approved" | "policy_incompatible" {
  if (reasonCodes.some((reason) => NOT_APPROVED_REASON_CODES.has(reason))) {
    return "not_approved";
  }
  if (reasonCodes.some((reason) => POLICY_REASON_CODES.has(reason))) {
    return "policy_incompatible";
  }
  return "unavailable";
}

function hasCompatiblePolicyVersions(
  artifact: PricingBenchmarkArtifactCandidate,
): boolean {
  return (
    artifact.artifactContractVersion ===
      INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION &&
    artifact.marketCellPolicyVersion === INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION &&
    artifact.cohortPolicyVersion === INTELLIGENCE_V2_COHORT_POLICY_VERSION &&
    artifact.aggregationPolicyVersion === INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION &&
    artifact.outlierPolicyVersion === INTELLIGENCE_V2_OUTLIER_POLICY_VERSION &&
    artifact.confidencePolicyVersion === INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION &&
    artifact.freshnessPolicyVersion === INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION &&
    artifact.approvalPolicyVersion === INTELLIGENCE_V2_APPROVAL_POLICY_VERSION
  );
}

function normalizeEvidenceLimitations(
  limitations: ReadonlyArray<string>,
  fallbackLevel: PricingBenchmarkFallbackLevel,
): string[] {
  const normalized = new Set(uniqueSortedStrings(limitations));
  if (fallbackLevel !== "exact" && fallbackLevel !== "none") {
    normalized.add("broad_fallback");
  }
  return [...normalized].sort();
}

function parseTimestamp(value: string): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isAllowedConfidenceLevel(
  value: string,
): value is PricingBenchmarkAllowedConfidenceLevel {
  return value === "high" || value === "very_high";
}

function isValidDistribution(artifact: PricingBenchmarkArtifactCandidate): boolean {
  return (
    Number.isFinite(artifact.p10Price) &&
    Number.isFinite(artifact.p25Price) &&
    Number.isFinite(artifact.medianPrice) &&
    Number.isFinite(artifact.p75Price) &&
    Number.isFinite(artifact.p90Price) &&
    artifact.p10Price > 0 &&
    artifact.p25Price > 0 &&
    artifact.medianPrice > 0 &&
    artifact.p75Price > 0 &&
    artifact.p90Price > 0 &&
    artifact.p10Price <= artifact.p25Price &&
    artifact.p25Price <= artifact.medianPrice &&
    artifact.medianPrice <= artifact.p75Price &&
    artifact.p75Price <= artifact.p90Price
  );
}

export function buildPricingEvidenceMarketCellCandidates(
  input: PricingBenchmarkEvidenceInput,
): PricingBenchmarkMarketCellCandidate[] {
  const requestedMarketCell = buildMarketCellV1(input);
  const orderedCandidates: PricingBenchmarkMarketCellCandidate[] = [
    Object.freeze({
      fallbackLevel: "exact",
      marketCell: requestedMarketCell,
    }),
    Object.freeze({
      fallbackLevel: "capacity_unknown",
      marketCell: buildMarketCellVariant(requestedMarketCell, {
        capacityBand: "unknown",
      }),
    }),
    Object.freeze({
      fallbackLevel: "property_unknown",
      marketCell: buildMarketCellVariant(requestedMarketCell, {
        propertyType: "unknown",
      }),
    }),
    Object.freeze({
      fallbackLevel: "property_capacity_unknown",
      marketCell: buildMarketCellVariant(requestedMarketCell, {
        propertyType: "unknown",
        capacityBand: "unknown",
      }),
    }),
  ];

  const seen = new Set<string>();
  const deduped: PricingBenchmarkMarketCellCandidate[] = [];

  for (const candidate of orderedCandidates) {
    if (seen.has(candidate.marketCell.marketCellKey)) {
      continue;
    }
    seen.add(candidate.marketCell.marketCellKey);
    deduped.push(candidate);
  }

  return deduped;
}

export function derivePricingEvidenceFreshnessStatus(
  validFrom: string,
  validUntil: string,
  now: Date = new Date(),
): PricingBenchmarkFreshnessStatus {
  const validFromMs = parseTimestamp(validFrom);
  const validUntilMs = parseTimestamp(validUntil);
  const nowMs = now.getTime();

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

export function derivePricingEvidenceSampleSizeBand(
  includedSampleSize: number,
): PricingBenchmarkSampleSizeBand {
  if (!Number.isInteger(includedSampleSize) || includedSampleSize < 10) {
    return "under_10";
  }
  if (includedSampleSize < 20) {
    return "10_19";
  }
  if (includedSampleSize < 40) {
    return "20_39";
  }
  return "40_plus";
}

export function derivePricingEvidenceStrength(input: Readonly<{
  confidenceLevel: PricingBenchmarkAllowedConfidenceLevel;
  freshnessStatus: "fresh" | "aging";
  fallbackLevel: PricingBenchmarkFallbackLevel;
  limitations: ReadonlyArray<string>;
}>): PricingBenchmarkEvidenceStrength {
  const nonFallbackLimitations = input.limitations.filter(
    (limitation) => limitation !== "broad_fallback",
  );

  if (
    input.confidenceLevel === "very_high" &&
    input.freshnessStatus === "fresh" &&
    input.fallbackLevel === "exact" &&
    nonFallbackLimitations.length === 0
  ) {
    return "strong";
  }

  if (
    input.fallbackLevel === "property_capacity_unknown" ||
    input.freshnessStatus === "aging" ||
    nonFallbackLimitations.length > 0
  ) {
    return "limited";
  }

  if (
    input.fallbackLevel === "exact" ||
    input.fallbackLevel === "capacity_unknown" ||
    input.fallbackLevel === "property_unknown"
  ) {
    return "moderate";
  }

  return "unavailable";
}

export function derivePricingEvidencePermittedWording(
  strength: PricingBenchmarkEvidenceStrength,
): PricingBenchmarkPermittedWording {
  switch (strength) {
    case "strong":
      return "strong_market_evidence";
    case "moderate":
      return "moderate_market_evidence";
    case "limited":
      return "limited_market_evidence";
    default:
      return "do_not_claim";
  }
}

export function validatePricingBenchmarkArtifactCandidate(input: Readonly<{
  artifact: PricingBenchmarkArtifactCandidate;
  requestedMarketCell: MarketCellV1;
  candidateMarketCell: MarketCellV1;
  capturePeriodBucket: string;
  fallbackLevel: Exclude<PricingBenchmarkFallbackLevel, "none">;
  now?: Date;
  supersededArtifactIds?: ReadonlyArray<string>;
}>): PricingBenchmarkArtifactCandidateValidationResult {
  const { artifact, requestedMarketCell, candidateMarketCell } = input;
  const reasonCodes = new Set<PricingBenchmarkEvidenceReasonCode>();
  const createdAtMs = parseTimestamp(artifact.createdAt);

  if (artifact.benchmarkType !== PRICING_BENCHMARK_TYPE) {
    reasonCodes.add("benchmark_type_mismatch");
  }
  if (artifact.country !== requestedMarketCell.country) {
    reasonCodes.add("country_mismatch");
  }
  if (artifact.city !== requestedMarketCell.city) {
    reasonCodes.add("city_mismatch");
  }
  if (artifact.platform !== requestedMarketCell.platform) {
    reasonCodes.add("platform_mismatch");
  }
  if (artifact.currency !== requestedMarketCell.currency) {
    reasonCodes.add("currency_mismatch");
  }
  if (artifact.capturePeriodBucket !== input.capturePeriodBucket) {
    reasonCodes.add("capture_period_mismatch");
  }
  if (artifact.propertyType !== candidateMarketCell.propertyType) {
    reasonCodes.add("property_type_mismatch");
  }
  if (artifact.capacityBand !== candidateMarketCell.capacityBand) {
    reasonCodes.add("capacity_band_mismatch");
  }
  if (artifact.marketCellKey !== candidateMarketCell.marketCellKey) {
    reasonCodes.add("market_cell_key_mismatch");
  }
  if (artifact.approvalStatus === "revoked") {
    reasonCodes.add("revoked_artifact");
  } else if (artifact.approvalStatus !== "audit_approved") {
    reasonCodes.add("approval_status_not_audit_approved");
  }
  if (artifact.approvedForAudit !== true) {
    reasonCodes.add("approved_for_audit_false");
  }
  if (!isAllowedConfidenceLevel(artifact.confidenceLevel)) {
    reasonCodes.add("confidence_level_not_allowed");
  }
  if (
    (input.supersededArtifactIds ?? []).includes(artifact.id) ||
    artifact.id === artifact.supersedesArtifactId
  ) {
    reasonCodes.add("superseded_artifact");
  }
  if (!hasCompatiblePolicyVersions(artifact)) {
    reasonCodes.add("policy_version_mismatch");
  }
  if (!isValidDistribution(artifact)) {
    reasonCodes.add("invalid_distribution");
  }
  if (createdAtMs == null) {
    reasonCodes.add("invalid_artifact_timestamp");
  }

  const freshnessStatus = derivePricingEvidenceFreshnessStatus(
    artifact.validFrom,
    artifact.validUntil,
    input.now,
  );
  if (freshnessStatus === "not_yet_valid") {
    reasonCodes.add("artifact_not_yet_valid");
  }
  if (freshnessStatus === "expired") {
    reasonCodes.add("artifact_expired");
  }

  if (reasonCodes.size > 0) {
    const normalizedReasonCodes = uniqueSortedReasonCodes(reasonCodes);
    return Object.freeze({
      valid: false,
      status: resolveFailureStatus(normalizedReasonCodes),
      reasonCodes: normalizedReasonCodes,
    });
  }

  const confidenceLevel = artifact.confidenceLevel as PricingBenchmarkAllowedConfidenceLevel;
  const activeFreshnessStatus = freshnessStatus as "fresh" | "aging";
  const safeCreatedAtMs = createdAtMs as number;

  return Object.freeze({
    valid: true,
    confidenceLevel,
    freshnessStatus: activeFreshnessStatus,
    sampleSizeBand: derivePricingEvidenceSampleSizeBand(artifact.includedSampleSize),
    normalizedLimitations: normalizeEvidenceLimitations(
      artifact.limitations,
      input.fallbackLevel,
    ),
    createdAtMs: safeCreatedAtMs,
  });
}

export function selectBestPricingBenchmarkArtifact(input: Readonly<{
  input: PricingBenchmarkEvidenceInput;
  artifacts: ReadonlyArray<PricingBenchmarkArtifactCandidate>;
  now?: Date;
  supersededArtifactIds?: ReadonlyArray<string>;
}>): PricingBenchmarkArtifactSelectionResult {
  if (input.input.intendedUse !== "private_audit") {
    return Object.freeze({
      selected: false,
      status: "unavailable",
      reasonCodes: uniqueSortedReasonCodes(["invalid_input"]),
      requestedMarketCell: null,
    });
  }

  if (!isMonthBucket(input.input.capturePeriodBucket)) {
    return Object.freeze({
      selected: false,
      status: "unavailable",
      reasonCodes: uniqueSortedReasonCodes(["invalid_capture_period_bucket"]),
      requestedMarketCell: null,
    });
  }

  const requestedMarketCell = buildMarketCellV1(input.input);
  if (!isSupportedRequestedMarketCell(requestedMarketCell)) {
    return Object.freeze({
      selected: false,
      status: "unavailable",
      reasonCodes: uniqueSortedReasonCodes(["invalid_requested_market_cell"]),
      requestedMarketCell,
    });
  }

  const candidateMarketCells = buildPricingEvidenceMarketCellCandidates(input.input);
  const derivedSupersededArtifactIds = new Set<string>(
    (input.supersededArtifactIds ?? []).filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    ),
  );
  for (const artifact of input.artifacts) {
    if (
      typeof artifact.supersedesArtifactId === "string" &&
      artifact.supersedesArtifactId.trim().length > 0
    ) {
      derivedSupersededArtifactIds.add(artifact.supersedesArtifactId);
    }
  }

  const scopedArtifacts: PricingBenchmarkArtifactCandidate[] = [];
  const reasonCodes = new Set<PricingBenchmarkEvidenceReasonCode>();

  for (const artifact of input.artifacts) {
    if (artifact.benchmarkType !== PRICING_BENCHMARK_TYPE) {
      reasonCodes.add("benchmark_type_mismatch");
      continue;
    }
    if (artifact.capturePeriodBucket !== input.input.capturePeriodBucket) {
      reasonCodes.add("capture_period_mismatch");
      continue;
    }
    if (artifact.country !== requestedMarketCell.country) {
      reasonCodes.add("country_mismatch");
      continue;
    }
    if (artifact.city !== requestedMarketCell.city) {
      reasonCodes.add("city_mismatch");
      continue;
    }
    if (artifact.platform !== requestedMarketCell.platform) {
      reasonCodes.add("platform_mismatch");
      continue;
    }
    if (artifact.currency !== requestedMarketCell.currency) {
      reasonCodes.add("currency_mismatch");
      continue;
    }
    scopedArtifacts.push(artifact);
  }

  for (const candidate of candidateMarketCells) {
    const eligible: Array<{
      artifact: PricingBenchmarkArtifactCandidate;
      validation: Extract<
        PricingBenchmarkArtifactCandidateValidationResult,
        Readonly<{ valid: true }>
      >;
    }> = [];

    for (const artifact of scopedArtifacts) {
      if (artifact.marketCellKey !== candidate.marketCell.marketCellKey) {
        continue;
      }

      const validation = validatePricingBenchmarkArtifactCandidate({
        artifact,
        requestedMarketCell,
        candidateMarketCell: candidate.marketCell,
        capturePeriodBucket: input.input.capturePeriodBucket,
        fallbackLevel: candidate.fallbackLevel,
        now: input.now,
        supersededArtifactIds: [...derivedSupersededArtifactIds],
      });

      if (validation.valid) {
        eligible.push({ artifact, validation });
      } else {
        for (const reasonCode of validation.reasonCodes) {
          reasonCodes.add(reasonCode);
        }
      }
    }

    if (eligible.length === 0) {
      continue;
    }

    eligible.sort((left, right) => {
      const confidenceDelta =
        (right.validation.confidenceLevel === "very_high" ? 1 : 0) -
        (left.validation.confidenceLevel === "very_high" ? 1 : 0);
      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }
      return right.validation.createdAtMs - left.validation.createdAtMs;
    });

    const winner = eligible[0];
    if (winner == null) {
      continue;
    }

    return Object.freeze({
      selected: true,
      artifact: winner.artifact,
      requestedMarketCell,
      resolvedMarketCell: candidate.marketCell,
      fallbackLevel: candidate.fallbackLevel,
      confidenceLevel: winner.validation.confidenceLevel,
      freshnessStatus: winner.validation.freshnessStatus,
      sampleSizeBand: winner.validation.sampleSizeBand,
      normalizedLimitations: winner.validation.normalizedLimitations,
    });
  }

  if (reasonCodes.size === 0) {
    reasonCodes.add("no_artifact");
  }

  const normalizedReasonCodes = uniqueSortedReasonCodes(reasonCodes);
  return Object.freeze({
    selected: false,
    status: resolveFailureStatus(normalizedReasonCodes),
    reasonCodes: normalizedReasonCodes,
    requestedMarketCell,
  });
}

export function projectPricingBenchmarkEvidence(input: Readonly<{
  input: PricingBenchmarkEvidenceInput;
  artifacts: ReadonlyArray<PricingBenchmarkArtifactCandidate>;
  now?: Date;
  supersededArtifactIds?: ReadonlyArray<string>;
}>): PricingBenchmarkEvidenceProjectionResult {
  const selection = selectBestPricingBenchmarkArtifact(input);
  if (!selection.selected) {
    return Object.freeze({
      available: false,
      status: selection.status,
      reasonCodes: selection.reasonCodes,
    });
  }

  const evidenceStrength = derivePricingEvidenceStrength({
    confidenceLevel: selection.confidenceLevel,
    freshnessStatus: selection.freshnessStatus,
    fallbackLevel: selection.fallbackLevel,
    limitations: selection.normalizedLimitations,
  });
  const permittedWording = derivePricingEvidencePermittedWording(evidenceStrength);

  return Object.freeze({
    available: true,
    evidence: Object.freeze({
      evidenceContractVersion:
        INTELLIGENCE_V2_PRICING_BENCHMARK_EVIDENCE_CONTRACT_VERSION,
      benchmarkType: PRICING_BENCHMARK_TYPE,
      requestedMarketCell: selection.requestedMarketCell,
      resolvedMarketCell: selection.resolvedMarketCell,
      fallbackLevel: selection.fallbackLevel,
      capturePeriodBucket: selection.artifact.capturePeriodBucket,
      distribution: Object.freeze({
        p10: selection.artifact.p10Price,
        p25: selection.artifact.p25Price,
        median: selection.artifact.medianPrice,
        p75: selection.artifact.p75Price,
        p90: selection.artifact.p90Price,
      }),
      confidenceLevel: selection.confidenceLevel,
      freshnessStatus: selection.freshnessStatus,
      validFrom: selection.artifact.validFrom,
      validUntil: selection.artifact.validUntil,
      sampleSizeBand: selection.sampleSizeBand,
      limitations: [...selection.normalizedLimitations],
      intendedUse: "private_audit",
      evidenceStrength,
      permittedWording,
      policyVersions: Object.freeze({
        artifactContractVersion: selection.artifact.artifactContractVersion,
        marketCellPolicyVersion: selection.artifact.marketCellPolicyVersion,
        selectionPolicyVersion: INTELLIGENCE_V2_BENCHMARK_SELECTION_POLICY_VERSION,
        fallbackPolicyVersion: INTELLIGENCE_V2_BENCHMARK_FALLBACK_POLICY_VERSION,
      }),
    }),
  });
}
