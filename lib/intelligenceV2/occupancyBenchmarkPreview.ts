import {
  OCCUPANCY_BENCHMARK_TYPE,
  validateOccupancyBenchmarkArtifact,
  type OccupancyBenchmarkApprovalStatus,
  type OccupancyBenchmarkArtifact,
  type OccupancyBenchmarkCapacityBand,
  type OccupancyBenchmarkConfidenceLevel,
  type OccupancyBenchmarkLimitationCode,
  type OccupancyBenchmarkPropertyType,
  type OccupancyBenchmarkSourceDiversityBand,
} from "./occupancyBenchmarkArtifact";
import {
  buildOccupancyBenchmarkArtifactKey,
} from "./occupancyBenchmarkArtifactIdentity";
import {
  buildOccupancyBenchmarkDistribution,
} from "./occupancyBenchmarkDistribution";
import type {
  AnonymousOccupancyFact,
} from "./occupancyFact";
import {
  INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
  INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
  INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
  INTELLIGENCE_V2_COHORT_DEFINITION_VERSION,
  INTELLIGENCE_V2_COHORT_POLICY_VERSION,
  INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
  INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
  INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
} from "./policyVersions";

export type OccupancyBenchmarkPreviewReasonCode =
  | "invalid_input"
  | "no_facts_found"
  | "market_cell_mismatch"
  | "capture_period_mismatch"
  | "incompatible_policy_versions"
  | "invalid_source_class"
  | "distribution_failed"
  | "artifact_identity_failed"
  | "artifact_validation_failed";

export type OccupancyBenchmarkPreviewResult =
  | Readonly<{
      ok: true;
      artifact: OccupancyBenchmarkArtifact;
      reasonCodes: readonly [];
    }>
  | Readonly<{
      ok: false;
      marketCellKey: string;
      capturePeriodBucket: string;
      rawSampleSize: number;
      includedSampleSize: number;
      reasonCodes:
        OccupancyBenchmarkPreviewReasonCode[];
    }>;

const SOURCE_CLASSES = new Set([
  "authenticated_audit",
  "authenticated_listing",
]);

const CONFIDENCE_LEVELS:
  ReadonlyArray<OccupancyBenchmarkConfidenceLevel> =
    [
      "very_low",
      "low",
      "moderate",
      "high",
      "very_high",
    ];

function uniqueSortedReasonCodes(
  values: Iterable<OccupancyBenchmarkPreviewReasonCode>,
): OccupancyBenchmarkPreviewReasonCode[] {
  return [...new Set(values)].sort();
}

function previousConfidenceLevel(
  value: OccupancyBenchmarkConfidenceLevel,
): OccupancyBenchmarkConfidenceLevel {
  const index =
    CONFIDENCE_LEVELS.indexOf(value);

  if (index <= 0) {
    return "very_low";
  }

  return (
    CONFIDENCE_LEVELS[index - 1] ??
    "very_low"
  );
}

export function getOccupancyBenchmarkPeriodBounds(
  capturePeriodBucket: string,
): Readonly<{
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  validFrom: string;
  validUntil: string;
}> | null {
  if (
    !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(
      capturePeriodBucket,
    )
  ) {
    return null;
  }

  const [yearText, monthText] =
    capturePeriodBucket.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month)
  ) {
    return null;
  }

  const sourcePeriodStart = new Date(
    Date.UTC(year, month - 1, 1),
  );
  const sourcePeriodEnd = new Date(
    Date.UTC(year, month, 0),
  );
  const validFrom = new Date(
    Date.UTC(year, month, 1),
  );
  const validUntil = new Date(
    Date.UTC(
      year,
      month + 1,
      0,
      23,
      59,
      59,
      999,
    ),
  );

  return Object.freeze({
    sourcePeriodStart:
      sourcePeriodStart
        .toISOString()
        .slice(0, 10),
    sourcePeriodEnd:
      sourcePeriodEnd
        .toISOString()
        .slice(0, 10),
    validFrom: validFrom.toISOString(),
    validUntil: validUntil.toISOString(),
  });
}

export function deriveOccupancySourceDiversityBand(
  sourceClassCount: number,
): OccupancyBenchmarkSourceDiversityBand {
  if (
    !Number.isInteger(sourceClassCount) ||
    sourceClassCount <= 0
  ) {
    return "unknown";
  }

  if (sourceClassCount === 1) {
    return "low";
  }

  return "moderate";
}

export function deriveOccupancyBenchmarkConfidenceLevel(
  input: Readonly<{
    includedSampleSize: number;
    sourceClassCount: number;
    propertyType:
      OccupancyBenchmarkPropertyType;
    capacityBand:
      OccupancyBenchmarkCapacityBand;
  }>,
): OccupancyBenchmarkConfidenceLevel {
  let level:
    OccupancyBenchmarkConfidenceLevel;

  if (input.includedSampleSize < 5) {
    level = "very_low";
  } else if (
    input.includedSampleSize < 10
  ) {
    level = "low";
  } else if (
    input.includedSampleSize < 20
  ) {
    level = "moderate";
  } else if (
    input.includedSampleSize < 40
  ) {
    level = "high";
  } else {
    level = "very_high";
  }

  if (input.sourceClassCount < 2) {
    level = previousConfidenceLevel(level);
  }

  if (input.propertyType === "unknown") {
    level = previousConfidenceLevel(level);
  }

  if (input.capacityBand === "unknown") {
    level = previousConfidenceLevel(level);
  }

  return level;
}

export function buildOccupancyBenchmarkLimitations(
  input: Readonly<{
    includedSampleSize: number;
    sourceClassCount: number;
    propertyType:
      OccupancyBenchmarkPropertyType;
    capacityBand:
      OccupancyBenchmarkCapacityBand;
  }>,
): OccupancyBenchmarkLimitationCode[] {
  const limitations =
    new Set<OccupancyBenchmarkLimitationCode>();

  if (input.includedSampleSize < 20) {
    limitations.add("small_sample");
  }

  if (input.sourceClassCount < 2) {
    limitations.add(
      "low_source_diversity",
    );
  }

  if (input.propertyType === "unknown") {
    limitations.add(
      "unknown_property_type",
    );
  }

  if (input.capacityBand === "unknown") {
    limitations.add("unknown_capacity");
  }

  return [...limitations].sort();
}

export function deriveOccupancyBenchmarkApproval(
  confidenceLevel:
    OccupancyBenchmarkConfidenceLevel,
): Readonly<{
  approvalStatus:
    OccupancyBenchmarkApprovalStatus;
  approvedForInternal: boolean;
  approvedForAudit: boolean;
}> {
  switch (confidenceLevel) {
    case "very_high":
      return {
        approvalStatus: "audit_approved",
        approvedForInternal: true,
        approvedForAudit: true,
      };

    case "high":
      return {
        approvalStatus:
          "internal_approved",
        approvedForInternal: true,
        approvedForAudit: false,
      };

    case "moderate":
    case "low":
      return {
        approvalStatus: "exploratory",
        approvedForInternal: false,
        approvedForAudit: false,
      };

    default:
      return {
        approvalStatus: "insufficient",
        approvedForInternal: false,
        approvedForAudit: false,
      };
  }
}

function samePolicyFamily(
  left: AnonymousOccupancyFact,
  right: AnonymousOccupancyFact,
): boolean {
  return (
    left.factContractVersion ===
      right.factContractVersion &&
    left.transformationPolicyVersion ===
      right.transformationPolicyVersion &&
    left.eligibilityPolicyVersion ===
      right.eligibilityPolicyVersion &&
    left.deduplicationPolicyVersion ===
      right.deduplicationPolicyVersion &&
    left.marketCellPolicyVersion ===
      right.marketCellPolicyVersion
  );
}

export function buildOccupancyBenchmarkPreview(
  input: Readonly<{
    marketCellKey: string;
    capturePeriodBucket: string;
    facts:
      ReadonlyArray<AnonymousOccupancyFact>;
    supersedesArtifactId?: string | null;
  }>,
): OccupancyBenchmarkPreviewResult {
  const reasonCodes =
    new Set<OccupancyBenchmarkPreviewReasonCode>();

  const marketCellKey =
    typeof input.marketCellKey === "string"
      ? input.marketCellKey.trim()
      : "";
  const capturePeriodBucket =
    typeof input.capturePeriodBucket === "string"
      ? input.capturePeriodBucket.trim()
      : "";

  if (
    marketCellKey.length === 0 ||
    getOccupancyBenchmarkPeriodBounds(
      capturePeriodBucket,
    ) == null
  ) {
    return {
      ok: false,
      marketCellKey,
      capturePeriodBucket,
      rawSampleSize: input.facts.length,
      includedSampleSize: 0,
      reasonCodes: ["invalid_input"],
    };
  }

  if (input.facts.length === 0) {
    return {
      ok: false,
      marketCellKey,
      capturePeriodBucket,
      rawSampleSize: 0,
      includedSampleSize: 0,
      reasonCodes: ["no_facts_found"],
    };
  }

  const firstFact = input.facts[0];

  if (firstFact == null) {
    return {
      ok: false,
      marketCellKey,
      capturePeriodBucket,
      rawSampleSize: 0,
      includedSampleSize: 0,
      reasonCodes: ["no_facts_found"],
    };
  }

  const validFacts:
    AnonymousOccupancyFact[] = [];

  for (const fact of input.facts) {
    if (
      fact.marketCell.marketCellKey !==
        marketCellKey
    ) {
      reasonCodes.add(
        "market_cell_mismatch",
      );
      continue;
    }

    if (
      fact.capturePeriodBucket !==
        capturePeriodBucket
    ) {
      reasonCodes.add(
        "capture_period_mismatch",
      );
      continue;
    }

    if (!samePolicyFamily(firstFact, fact)) {
      reasonCodes.add(
        "incompatible_policy_versions",
      );
      continue;
    }

    if (
      !SOURCE_CLASSES.has(fact.sourceClass)
    ) {
      reasonCodes.add(
        "invalid_source_class",
      );
      continue;
    }

    validFacts.push(fact);
  }

  if (
    reasonCodes.size > 0 ||
    validFacts.length !== input.facts.length
  ) {
    return {
      ok: false,
      marketCellKey,
      capturePeriodBucket,
      rawSampleSize: input.facts.length,
      includedSampleSize:
        validFacts.length,
      reasonCodes:
        uniqueSortedReasonCodes(reasonCodes),
    };
  }

  const distributionResult =
    buildOccupancyBenchmarkDistribution(
      validFacts.map((fact) => ({
        observedDaysBand:
          fact.observedDaysBand,
        unavailabilityRateBand:
          fact.unavailabilityRateBand,
      })),
    );

  if (!distributionResult.ok) {
    return {
      ok: false,
      marketCellKey,
      capturePeriodBucket,
      rawSampleSize: input.facts.length,
      includedSampleSize: 0,
      reasonCodes: ["distribution_failed"],
    };
  }

  const sourceClassCount = new Set(
    validFacts.map(
      (fact) => fact.sourceClass,
    ),
  ).size;

  const sourceDiversityBand =
    deriveOccupancySourceDiversityBand(
      sourceClassCount,
    );

  const platform =
    firstFact.marketCell.platform;
  const propertyType =
    firstFact.marketCell.propertyType;
  const capacityBand =
    firstFact.marketCell.capacityBand;

  if (platform === "unknown") {
    return {
      ok: false,
      marketCellKey,
      capturePeriodBucket,
      rawSampleSize: input.facts.length,
      includedSampleSize:
        distributionResult.includedSampleSize,
      reasonCodes: ["invalid_input"],
    };
  }

  const confidenceLevel =
    deriveOccupancyBenchmarkConfidenceLevel({
      includedSampleSize:
        distributionResult.includedSampleSize,
      sourceClassCount,
      propertyType,
      capacityBand,
    });

  const limitations =
    buildOccupancyBenchmarkLimitations({
      includedSampleSize:
        distributionResult.includedSampleSize,
      sourceClassCount,
      propertyType,
      capacityBand,
    });

  const approval =
    deriveOccupancyBenchmarkApproval(
      confidenceLevel,
    );

  const periodBounds =
    getOccupancyBenchmarkPeriodBounds(
      capturePeriodBucket,
    );

  if (periodBounds == null) {
    return {
      ok: false,
      marketCellKey,
      capturePeriodBucket,
      rawSampleSize: input.facts.length,
      includedSampleSize: 0,
      reasonCodes: ["invalid_input"],
    };
  }

  const identityResult =
    buildOccupancyBenchmarkArtifactKey({
      benchmarkType:
        OCCUPANCY_BENCHMARK_TYPE,
      marketCellKey,
      capturePeriodBucket,
      sourcePeriodStart:
        periodBounds.sourcePeriodStart,
      sourcePeriodEnd:
        periodBounds.sourcePeriodEnd,
      distribution:
        distributionResult.distribution,
      rawSampleSize: input.facts.length,
      includedSampleSize:
        distributionResult.includedSampleSize,
      excludedOutlierCount: 0,
      sourceClassCount,
      sourceDiversityBand,
      confidenceLevel,
      approvalStatus:
        approval.approvalStatus,
      limitations,
      artifactContractVersion:
        INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
      cohortDefinitionVersion:
        INTELLIGENCE_V2_COHORT_DEFINITION_VERSION,
      cohortPolicyVersion:
        INTELLIGENCE_V2_COHORT_POLICY_VERSION,
      aggregationPolicyVersion:
        INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
      outlierPolicyVersion:
        INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
      confidencePolicyVersion:
        INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
      freshnessPolicyVersion:
        INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
      approvalPolicyVersion:
        INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
      marketCellPolicyVersion:
        INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
    });

  if (!identityResult.ok) {
    return {
      ok: false,
      marketCellKey,
      capturePeriodBucket,
      rawSampleSize: input.facts.length,
      includedSampleSize:
        distributionResult.includedSampleSize,
      reasonCodes:
        ["artifact_identity_failed"],
    };
  }

  const artifact:
    OccupancyBenchmarkArtifact = {
      artifactKey:
        identityResult.artifactKey,
      artifactContractVersion:
        INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
      benchmarkType:
        OCCUPANCY_BENCHMARK_TYPE,

      approvalStatus:
        approval.approvalStatus,

      country:
        firstFact.marketCell.country,
      city: firstFact.marketCell.city,
      platform,
      propertyType,
      capacityBand,
      currency: "UNKNOWN",
      marketCellKey,

      capturePeriodBucket,
      sourcePeriodStart:
        periodBounds.sourcePeriodStart,
      sourcePeriodEnd:
        periodBounds.sourcePeriodEnd,

      cohortDefinitionVersion:
        INTELLIGENCE_V2_COHORT_DEFINITION_VERSION,
      sourceClassCount,
      sourceDiversityBand,

      distribution:
        distributionResult.distribution,

      rawSampleSize: input.facts.length,
      includedSampleSize:
        distributionResult.includedSampleSize,
      excludedOutlierCount: 0,

      outlierPolicyVersion:
        INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
      confidenceLevel,
      confidencePolicyVersion:
        INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,

      validFrom: periodBounds.validFrom,
      validUntil: periodBounds.validUntil,
      freshnessPolicyVersion:
        INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,

      approvedForInternal:
        approval.approvedForInternal,
      approvedForAudit:
        approval.approvedForAudit,
      limitations,

      cohortPolicyVersion:
        INTELLIGENCE_V2_COHORT_POLICY_VERSION,
      aggregationPolicyVersion:
        INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
      approvalPolicyVersion:
        INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
      marketCellPolicyVersion:
        INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,

      supersedesArtifactId:
        input.supersedesArtifactId ?? null,
    };

  const validation =
    validateOccupancyBenchmarkArtifact(
      artifact,
    );

  if (!validation.valid) {
    return {
      ok: false,
      marketCellKey,
      capturePeriodBucket,
      rawSampleSize: input.facts.length,
      includedSampleSize:
        distributionResult.includedSampleSize,
      reasonCodes:
        ["artifact_validation_failed"],
    };
  }

  return {
    ok: true,
    artifact: Object.freeze(artifact),
    reasonCodes: [],
  };
}
