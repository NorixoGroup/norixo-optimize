import type {
  PublicMarketOverviewCapacityScope,
  PublicMarketOverviewConfidence,
  PublicMarketOverviewExposureStatus,
  PublicMarketOverviewFreshnessStatus,
  PublicMarketOverviewLimitationCode,
  PublicMarketOverviewPlatformScope,
  PublicMarketOverviewPropertyScope,
  PublicMarketOverviewReasonCode,
  PublicMarketOverviewSampleBand,
} from "./publicMarketOverviewContract";
import {
  INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_CONTRACT_VERSION,
  INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_GOVERNANCE_POLICY_VERSION,
} from "./policyVersions";

export type PublicMarketOverviewGovernanceInput = Readonly<{
  platformScope: PublicMarketOverviewPlatformScope;
  propertyScope: PublicMarketOverviewPropertyScope;
  capacityScope: PublicMarketOverviewCapacityScope;
  includedSampleSize: number;
  sourceClassCount: number;
  distinctCapturePeriods: number;
  p25: number;
  median: number;
  p75: number;
  windowEndedAt: string;
  evaluatedAt?: string;
}>;

export type PublicMarketOverviewGovernanceResult =
  | Readonly<{
      public: true;
      exposureStatus: Exclude<PublicMarketOverviewExposureStatus, "not_public">;
      sampleBand: PublicMarketOverviewSampleBand;
      confidence: PublicMarketOverviewConfidence;
      freshnessStatus: Exclude<PublicMarketOverviewFreshnessStatus, "expired">;
      limitationCodes: readonly PublicMarketOverviewLimitationCode[];
      reasonCodes: readonly [];
      policyVersions: Readonly<{
        contractVersion: string;
        governancePolicyVersion: string;
      }>;
    }>
  | Readonly<{
      public: false;
      exposureStatus: "not_public";
      freshnessStatus: PublicMarketOverviewFreshnessStatus;
      limitationCodes: readonly PublicMarketOverviewLimitationCode[];
      reasonCodes: readonly PublicMarketOverviewReasonCode[];
      policyVersions: Readonly<{
        contractVersion: string;
        governancePolicyVersion: string;
      }>;
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

function monthDistance(leftMs: number, rightMs: number): number {
  const left = new Date(leftMs);
  const right = new Date(rightMs);
  return (
    (left.getUTCFullYear() - right.getUTCFullYear()) * 12 +
    (left.getUTCMonth() - right.getUTCMonth())
  );
}

export function derivePublicMarketOverviewFreshnessStatus(input: {
  windowEndedAt: string;
  evaluatedAt?: string;
}): PublicMarketOverviewFreshnessStatus {
  const windowEndedAtMs = parseTimestampMs(input.windowEndedAt);
  const evaluatedAtMs = parseTimestampMs(input.evaluatedAt) ?? Date.now();

  if (windowEndedAtMs == null || !Number.isFinite(evaluatedAtMs)) {
    return "expired";
  }

  if (windowEndedAtMs > evaluatedAtMs) {
    return "expired";
  }

  const months = monthDistance(evaluatedAtMs, windowEndedAtMs);
  if (months <= 1) {
    return "fresh";
  }

  if (evaluatedAtMs - windowEndedAtMs <= 90 * 24 * 60 * 60 * 1000) {
    return "aging";
  }

  return "expired";
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function buildPolicyVersions() {
  return Object.freeze({
    contractVersion: INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_CONTRACT_VERSION,
    governancePolicyVersion:
      INTELLIGENCE_V2_PUBLIC_MARKET_OVERVIEW_GOVERNANCE_POLICY_VERSION,
  });
}

export function evaluatePublicMarketOverviewGovernance(
  input: PublicMarketOverviewGovernanceInput,
): PublicMarketOverviewGovernanceResult {
  const limitationCodes = new Set<PublicMarketOverviewLimitationCode>([
    "all_capacities_scope",
  ]);
  const reasonCodes = new Set<PublicMarketOverviewReasonCode>();
  const freshnessStatus = derivePublicMarketOverviewFreshnessStatus({
    windowEndedAt: input.windowEndedAt,
    evaluatedAt: input.evaluatedAt,
  });

  if (
    (input.platformScope !== "single_platform" &&
      input.platformScope !== "all_platforms") ||
    input.capacityScope !== "all_capacities" ||
    !Number.isInteger(input.includedSampleSize) ||
    input.includedSampleSize < 0 ||
    !Number.isInteger(input.sourceClassCount) ||
    input.sourceClassCount < 0 ||
    !Number.isInteger(input.distinctCapturePeriods) ||
    input.distinctCapturePeriods < 0 ||
    !isPositiveFinite(input.p25) ||
    !isPositiveFinite(input.median) ||
    !isPositiveFinite(input.p75) ||
    input.p25 > input.median ||
    input.median > input.p75
  ) {
    return Object.freeze({
      public: false,
      exposureStatus: "not_public",
      freshnessStatus,
      limitationCodes: [] as const,
      reasonCodes: ["invalid_input"] as const,
      policyVersions: buildPolicyVersions(),
    });
  }

  if (input.propertyScope === "broader_market") {
    limitationCodes.add("broader_market_segment");
  }

  if (input.platformScope === "all_platforms") {
    limitationCodes.add("multi_platform_scope");
  }

  if (input.sourceClassCount < 2) {
    limitationCodes.add("limited_source_diversity");
  }

  if (input.includedSampleSize >= 5 && input.includedSampleSize < 20) {
    limitationCodes.add("limited_sample_size");
  }

  if (freshnessStatus === "aging") {
    limitationCodes.add("aging_data");
  }

  if (freshnessStatus === "expired") {
    reasonCodes.add("expired_window");
  }

  if (input.includedSampleSize < 5) {
    reasonCodes.add("insufficient_sample_size");
  }

  if (reasonCodes.size > 0) {
    return Object.freeze({
      public: false,
      exposureStatus: "not_public",
      freshnessStatus,
      limitationCodes: uniqueSortedStrings(limitationCodes),
      reasonCodes: uniqueSortedStrings(reasonCodes),
      policyVersions: buildPolicyVersions(),
    });
  }

  const sampleBand: PublicMarketOverviewSampleBand =
    input.includedSampleSize >= 20 ? "strong" : "sufficient";
  const publicFreshnessStatus = freshnessStatus as Exclude<
    PublicMarketOverviewFreshnessStatus,
    "expired"
  >;
  const confidence: PublicMarketOverviewConfidence =
    input.includedSampleSize >= 50 ? "high" : "standard";
  const exposureStatus: Exclude<PublicMarketOverviewExposureStatus, "not_public"> =
    input.includedSampleSize < 20
      ? "public_usable_with_limits"
      : "public_usable";

  return Object.freeze({
    public: true,
    exposureStatus,
    sampleBand,
    confidence,
    freshnessStatus: publicFreshnessStatus,
    limitationCodes: uniqueSortedStrings(limitationCodes),
    reasonCodes: [] as const,
    policyVersions: buildPolicyVersions(),
  });
}
