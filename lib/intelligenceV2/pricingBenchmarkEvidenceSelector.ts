import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  buildMarketCellKey,
  type IntelligenceV2CapacityBand,
  type IntelligenceV2PropertyType,
  type IntelligenceV2Platform,
} from "./marketCell";
import {
  DEBUG_INTELLIGENCE_V2,
  ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION,
  getIntelligenceV2FeatureFlags,
} from "./featureFlags";
import {
  INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
  INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
  INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
  INTELLIGENCE_V2_COHORT_POLICY_VERSION,
  INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
  INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
  INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
} from "./policyVersions";
import {
  buildPricingEvidenceMarketCellCandidates,
  projectPricingBenchmarkEvidence,
  selectBestPricingBenchmarkArtifact,
  type PricingBenchmarkArtifactCandidate,
  type PricingBenchmarkEvidence,
  type PricingBenchmarkEvidenceInput,
  type PricingBenchmarkEvidenceReasonCode,
} from "./pricingBenchmarkEvidence";

const PRICING_BENCHMARK_TYPE = "pricing_distribution";
const MONTH_BUCKET_REGEX = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const PLATFORM_VALUES = new Set(["airbnb", "booking", "expedia", "agoda", "vrbo"]);
const PROPERTY_TYPE_VALUES = new Set([
  "studio",
  "apartment",
  "villa",
  "riad",
  "room",
  "hotel",
  "unknown",
]);
const CAPACITY_BAND_VALUES = new Set(["unknown", "1_3", "4_6", "7_9", "10_plus"]);

export type PricingBenchmarkEvidenceSelectorReasonCode =
  | "flag_disabled"
  | "invalid_input"
  | "invalid_period"
  | "no_candidate_cell"
  | "no_artifact"
  | "artifact_malformed"
  | "artifact_policy_incompatible"
  | "artifact_superseded"
  | "artifact_not_audit_approved"
  | "artifact_not_yet_valid"
  | "artifact_expired"
  | "database_read_error";

export type PricingBenchmarkEvidenceSelectorResult =
  | Readonly<{
      available: true;
      evidence: PricingBenchmarkEvidence;
    }>
  | PricingBenchmarkEvidenceSelectorUnavailableResult;

type PricingBenchmarkEvidenceSelectorUnavailableResult = Readonly<{
  available: false;
  status: PricingBenchmarkEvidenceSelectorUnavailableStatus;
  reasonCodes: string[];
}>;

type PricingBenchmarkEvidenceSelectorUnavailableStatus =
  | "disabled"
  | "unavailable"
  | "database_error";

export type PricingBenchmarkEvidenceLoadInput = Readonly<{
  capturePeriodBucket: string;
  candidateMarketCellKeys: ReadonlyArray<string>;
  nowIso: string;
}>;

export type PricingBenchmarkDbRowLoadResult =
  | Readonly<{
      ok: true;
      rows: ReadonlyArray<PricingBenchmarkArtifactDbRow>;
    }>
  | Readonly<{
      ok: false;
    }>;

export type PricingBenchmarkSupersessionLoadResult =
  | Readonly<{
      ok: true;
      supersededArtifactIds: ReadonlyArray<string>;
    }>
  | Readonly<{
      ok: false;
    }>;

export type PricingBenchmarkEvidenceSelectorDependencies = Readonly<{
  loadArtifacts?: (
    input: PricingBenchmarkEvidenceLoadInput,
  ) => Promise<PricingBenchmarkDbRowLoadResult>;
  loadSupersedingArtifactIds?: (
    candidateIds: string[],
  ) => Promise<PricingBenchmarkSupersessionLoadResult>;
  now?: () => Date;
}>;

export type PricingBenchmarkArtifactDbRow = Readonly<{
  id?: unknown;
  benchmark_type?: unknown;
  approval_status?: unknown;
  approved_for_audit?: unknown;
  country?: unknown;
  city?: unknown;
  platform?: unknown;
  property_type?: unknown;
  capacity_band?: unknown;
  currency?: unknown;
  market_cell_key?: unknown;
  capture_period_bucket?: unknown;
  p10_price?: unknown;
  p25_price?: unknown;
  median_price?: unknown;
  p75_price?: unknown;
  p90_price?: unknown;
  included_sample_size?: unknown;
  confidence_level?: unknown;
  valid_from?: unknown;
  valid_until?: unknown;
  limitations?: unknown;
  artifact_contract_version?: unknown;
  cohort_policy_version?: unknown;
  aggregation_policy_version?: unknown;
  outlier_policy_version?: unknown;
  confidence_policy_version?: unknown;
  freshness_policy_version?: unknown;
  approval_policy_version?: unknown;
  market_cell_policy_version?: unknown;
  supersedes_artifact_id?: unknown;
  created_at?: unknown;
}>;

export type PricingBenchmarkArtifactDbRowMappingResult =
  | Readonly<{
      ok: true;
      artifact: PricingBenchmarkArtifactCandidate;
    }>
  | Readonly<{
      ok: false;
      reason: "artifact_malformed" | "artifact_policy_incompatible";
    }>;

function uniqueSortedStrings(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function isMonthBucket(value: string): boolean {
  return MONTH_BUCKET_REGEX.test(value);
}

function parseNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function parseTimestamp(value: unknown): string | null {
  const trimmed = parseNonEmptyString(value);
  if (trimmed == null) return null;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? trimmed : null;
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

function parseLimitations(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const limitations: string[] = [];
  for (const item of value) {
    const parsed = parseNonEmptyString(item);
    if (parsed == null) {
      return null;
    }
    limitations.push(parsed);
  }

  return limitations;
}

function hasCompatiblePolicyVersions(row: {
  artifactContractVersion: string;
  cohortPolicyVersion: string;
  aggregationPolicyVersion: string;
  outlierPolicyVersion: string;
  confidencePolicyVersion: string;
  freshnessPolicyVersion: string;
  approvalPolicyVersion: string;
  marketCellPolicyVersion: string;
}): boolean {
  return (
    row.artifactContractVersion ===
      INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION &&
    row.cohortPolicyVersion === INTELLIGENCE_V2_COHORT_POLICY_VERSION &&
    row.aggregationPolicyVersion === INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION &&
    row.outlierPolicyVersion === INTELLIGENCE_V2_OUTLIER_POLICY_VERSION &&
    row.confidencePolicyVersion === INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION &&
    row.freshnessPolicyVersion === INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION &&
    row.approvalPolicyVersion === INTELLIGENCE_V2_APPROVAL_POLICY_VERSION &&
    row.marketCellPolicyVersion === INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION
  );
}

function mapPureReasonCode(
  reasonCode: PricingBenchmarkEvidenceReasonCode,
): PricingBenchmarkEvidenceSelectorReasonCode {
  switch (reasonCode) {
    case "invalid_input":
    case "invalid_requested_market_cell":
      return "invalid_input";
    case "invalid_capture_period_bucket":
      return "invalid_period";
    case "no_artifact":
      return "no_artifact";
    case "revoked_artifact":
    case "approval_status_not_audit_approved":
    case "approved_for_audit_false":
    case "confidence_level_not_allowed":
      return "artifact_not_audit_approved";
    case "superseded_artifact":
      return "artifact_superseded";
    case "artifact_not_yet_valid":
      return "artifact_not_yet_valid";
    case "artifact_expired":
      return "artifact_expired";
    case "policy_version_mismatch":
      return "artifact_policy_incompatible";
    case "benchmark_type_mismatch":
    case "country_mismatch":
    case "city_mismatch":
    case "platform_mismatch":
    case "currency_mismatch":
    case "capture_period_mismatch":
    case "property_type_mismatch":
    case "capacity_band_mismatch":
    case "market_cell_key_mismatch":
    case "invalid_distribution":
    case "invalid_artifact_timestamp":
      return "artifact_malformed";
  }
}

function logSelectorSummary(payload: {
  status: PricingBenchmarkEvidenceSelectorUnavailableStatus | "available";
  requestedPeriod: string;
  candidateCount: number;
  rowCount: number;
  validRowCount: number;
  selectedFallbackLevel: string | null;
  confidenceLevel: string | null;
  freshnessStatus: string | null;
  reasonCodes: ReadonlyArray<string>;
}): void {
  if (process.env[DEBUG_INTELLIGENCE_V2]?.trim().toLowerCase() !== "true") {
    return;
  }

  console.info(
    "[intelligence-v2][pricing-benchmark-evidence-selector]",
    JSON.stringify(payload),
  );
}

function buildUnavailableResult(
  status: PricingBenchmarkEvidenceSelectorUnavailableStatus,
  reasonCodes: ReadonlyArray<PricingBenchmarkEvidenceSelectorReasonCode>,
): PricingBenchmarkEvidenceSelectorUnavailableResult {
  return Object.freeze({
    available: false,
    status,
    reasonCodes: uniqueSortedStrings(reasonCodes),
  });
}

async function loadArtifactsFromSupabase(
  input: PricingBenchmarkEvidenceLoadInput,
): Promise<PricingBenchmarkDbRowLoadResult> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("benchmark_artifacts")
      .select(
        [
          "id",
          "benchmark_type",
          "approval_status",
          "approved_for_audit",
          "country",
          "city",
          "platform",
          "property_type",
          "capacity_band",
          "currency",
          "market_cell_key",
          "capture_period_bucket",
          "p10_price",
          "p25_price",
          "median_price",
          "p75_price",
          "p90_price",
          "included_sample_size",
          "confidence_level",
          "valid_from",
          "valid_until",
          "limitations",
          "artifact_contract_version",
          "cohort_policy_version",
          "aggregation_policy_version",
          "outlier_policy_version",
          "confidence_policy_version",
          "freshness_policy_version",
          "approval_policy_version",
          "market_cell_policy_version",
          "supersedes_artifact_id",
          "created_at",
        ].join(","),
      )
      .eq("benchmark_type", PRICING_BENCHMARK_TYPE)
      .eq("capture_period_bucket", input.capturePeriodBucket)
      .in("market_cell_key", [...input.candidateMarketCellKeys])
      .eq("approval_status", "audit_approved")
      .eq("approved_for_audit", true)
      .lte("valid_from", input.nowIso)
      .gt("valid_until", input.nowIso)
      .eq(
        "artifact_contract_version",
        INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
      )
      .eq("cohort_policy_version", INTELLIGENCE_V2_COHORT_POLICY_VERSION)
      .eq("aggregation_policy_version", INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION)
      .eq("outlier_policy_version", INTELLIGENCE_V2_OUTLIER_POLICY_VERSION)
      .eq("confidence_policy_version", INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION)
      .eq("freshness_policy_version", INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION)
      .eq("approval_policy_version", INTELLIGENCE_V2_APPROVAL_POLICY_VERSION)
      .eq("market_cell_policy_version", INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION)
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data)) {
      return { ok: false };
    }

    return {
      ok: true,
      rows: data as PricingBenchmarkArtifactDbRow[],
    };
  } catch {
    return { ok: false };
  }
}

async function loadSupersedingArtifactIdsFromSupabase(
  candidateIds: string[],
): Promise<PricingBenchmarkSupersessionLoadResult> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("benchmark_artifacts")
      .select("supersedes_artifact_id")
      .in("supersedes_artifact_id", candidateIds);

    if (error || !Array.isArray(data)) {
      return { ok: false };
    }

    const supersededArtifactIds = data
      .map((row) => {
        if (
          row &&
          typeof row === "object" &&
          "supersedes_artifact_id" in row &&
          typeof row.supersedes_artifact_id === "string" &&
          row.supersedes_artifact_id.trim().length > 0
        ) {
          return row.supersedes_artifact_id;
        }
        return null;
      })
      .filter((value): value is string => value != null);

    return {
      ok: true,
      supersededArtifactIds,
    };
  } catch {
    return { ok: false };
  }
}

export function mapPricingBenchmarkArtifactDbRow(
  row: PricingBenchmarkArtifactDbRow,
): PricingBenchmarkArtifactDbRowMappingResult {
  const id = parseNonEmptyString(row.id);
  const benchmarkType = parseNonEmptyString(row.benchmark_type);
  const approvalStatus = parseNonEmptyString(row.approval_status);
  const approvedForAudit = parseBoolean(row.approved_for_audit);
  const country = parseNonEmptyString(row.country);
  const city = parseNonEmptyString(row.city);
  const platform = parseNonEmptyString(row.platform);
  const propertyType = parseNonEmptyString(row.property_type);
  const capacityBand = parseNonEmptyString(row.capacity_band);
  const currency = parseNonEmptyString(row.currency);
  const marketCellKey = parseNonEmptyString(row.market_cell_key);
  const capturePeriodBucket = parseNonEmptyString(row.capture_period_bucket);
  const p10Price = parseMoney(row.p10_price);
  const p25Price = parseMoney(row.p25_price);
  const medianPrice = parseMoney(row.median_price);
  const p75Price = parseMoney(row.p75_price);
  const p90Price = parseMoney(row.p90_price);
  const includedSampleSize = parseNonNegativeInteger(row.included_sample_size);
  const confidenceLevel = parseNonEmptyString(row.confidence_level);
  const validFrom = parseTimestamp(row.valid_from);
  const validUntil = parseTimestamp(row.valid_until);
  const limitations = parseLimitations(row.limitations);
  const artifactContractVersion = parseNonEmptyString(row.artifact_contract_version);
  const cohortPolicyVersion = parseNonEmptyString(row.cohort_policy_version);
  const aggregationPolicyVersion = parseNonEmptyString(row.aggregation_policy_version);
  const outlierPolicyVersion = parseNonEmptyString(row.outlier_policy_version);
  const confidencePolicyVersion = parseNonEmptyString(row.confidence_policy_version);
  const freshnessPolicyVersion = parseNonEmptyString(row.freshness_policy_version);
  const approvalPolicyVersion = parseNonEmptyString(row.approval_policy_version);
  const marketCellPolicyVersion = parseNonEmptyString(row.market_cell_policy_version);
  const createdAt = parseTimestamp(row.created_at);

  const supersedesArtifactId =
    row.supersedes_artifact_id == null
      ? null
      : parseNonEmptyString(row.supersedes_artifact_id);

  if (
    id == null ||
    benchmarkType == null ||
    approvalStatus == null ||
    approvedForAudit == null ||
    country == null ||
    city == null ||
    platform == null ||
    propertyType == null ||
    capacityBand == null ||
    currency == null ||
    marketCellKey == null ||
    capturePeriodBucket == null ||
    p10Price == null ||
    p25Price == null ||
    medianPrice == null ||
    p75Price == null ||
    p90Price == null ||
    includedSampleSize == null ||
    confidenceLevel == null ||
    validFrom == null ||
    validUntil == null ||
    limitations == null ||
    artifactContractVersion == null ||
    cohortPolicyVersion == null ||
    aggregationPolicyVersion == null ||
    outlierPolicyVersion == null ||
    confidencePolicyVersion == null ||
    freshnessPolicyVersion == null ||
    approvalPolicyVersion == null ||
    marketCellPolicyVersion == null ||
    createdAt == null
  ) {
    return { ok: false, reason: "artifact_malformed" };
  }

  if (
    benchmarkType !== PRICING_BENCHMARK_TYPE ||
    !PLATFORM_VALUES.has(platform) ||
    !PROPERTY_TYPE_VALUES.has(propertyType) ||
    !CAPACITY_BAND_VALUES.has(capacityBand) ||
    !/^[A-Z]{3}$/.test(currency) ||
    currency === "UNKNOWN" ||
    !isMonthBucket(capturePeriodBucket)
  ) {
    return { ok: false, reason: "artifact_malformed" };
  }

  if (
    p10Price > p25Price ||
    p25Price > medianPrice ||
    medianPrice > p75Price ||
    p75Price > p90Price
  ) {
    return { ok: false, reason: "artifact_malformed" };
  }

  if (
    Date.parse(validUntil) <= Date.parse(validFrom) ||
    (row.supersedes_artifact_id != null && supersedesArtifactId == null)
  ) {
    return { ok: false, reason: "artifact_malformed" };
  }

  const rebuiltMarketCellKey = buildMarketCellKey({
    country,
    city,
    platform: platform as IntelligenceV2Platform,
    propertyType: propertyType as IntelligenceV2PropertyType,
    capacityBand: capacityBand as IntelligenceV2CapacityBand,
    currency,
  });

  if (marketCellKey !== rebuiltMarketCellKey) {
    return { ok: false, reason: "artifact_malformed" };
  }

  if (
    !hasCompatiblePolicyVersions({
      artifactContractVersion,
      cohortPolicyVersion,
      aggregationPolicyVersion,
      outlierPolicyVersion,
      confidencePolicyVersion,
      freshnessPolicyVersion,
      approvalPolicyVersion,
      marketCellPolicyVersion,
    })
  ) {
    return { ok: false, reason: "artifact_policy_incompatible" };
  }

  return {
    ok: true,
    artifact: Object.freeze({
      id,
      benchmarkType,
      approvalStatus,
      approvedForAudit,
      country,
      city,
      platform,
      propertyType,
      capacityBand,
      currency,
      marketCellKey,
      capturePeriodBucket,
      p10Price,
      p25Price,
      medianPrice,
      p75Price,
      p90Price,
      includedSampleSize,
      confidenceLevel,
      validFrom,
      validUntil,
      limitations,
      artifactContractVersion,
      marketCellPolicyVersion,
      cohortPolicyVersion,
      aggregationPolicyVersion,
      outlierPolicyVersion,
      confidencePolicyVersion,
      freshnessPolicyVersion,
      approvalPolicyVersion,
      supersedesArtifactId,
      createdAt,
    }),
  };
}

export async function getPricingBenchmarkEvidence(
  input: PricingBenchmarkEvidenceInput,
  dependencies: PricingBenchmarkEvidenceSelectorDependencies = {},
): Promise<PricingBenchmarkEvidenceSelectorResult> {
  const flags = getIntelligenceV2FeatureFlags();
  if (!flags.ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION) {
    return buildUnavailableResult("disabled", ["flag_disabled"]);
  }

  const now = dependencies.now?.() ?? new Date();
  const requestedPeriod = input.capturePeriodBucket;
  let candidateCount = 0;
  let rowCount = 0;
  let validRowCount = 0;

  try {
    if (
      typeof input !== "object" ||
      input == null ||
      input.intendedUse !== "private_audit"
    ) {
      const result = buildUnavailableResult("unavailable", ["invalid_input"]);
      logSelectorSummary({
        status: result.status,
        requestedPeriod,
        candidateCount,
        rowCount,
        validRowCount,
        selectedFallbackLevel: null,
        confidenceLevel: null,
        freshnessStatus: null,
        reasonCodes: result.reasonCodes,
      });
      return result;
    }

    if (!isMonthBucket(input.capturePeriodBucket)) {
      const result = buildUnavailableResult("unavailable", ["invalid_period"]);
      logSelectorSummary({
        status: result.status,
        requestedPeriod,
        candidateCount,
        rowCount,
        validRowCount,
        selectedFallbackLevel: null,
        confidenceLevel: null,
        freshnessStatus: null,
        reasonCodes: result.reasonCodes,
      });
      return result;
    }

    const candidates = buildPricingEvidenceMarketCellCandidates(input);
    candidateCount = candidates.length;

    if (candidates.length === 0) {
      const result = buildUnavailableResult("unavailable", ["no_candidate_cell"]);
      logSelectorSummary({
        status: result.status,
        requestedPeriod,
        candidateCount,
        rowCount,
        validRowCount,
        selectedFallbackLevel: null,
        confidenceLevel: null,
        freshnessStatus: null,
        reasonCodes: result.reasonCodes,
      });
      return result;
    }

    const loadArtifacts =
      dependencies.loadArtifacts ?? loadArtifactsFromSupabase;
    const loadResult = await loadArtifacts({
      capturePeriodBucket: input.capturePeriodBucket,
      candidateMarketCellKeys: candidates.map((candidate) => candidate.marketCell.marketCellKey),
      nowIso: now.toISOString(),
    });

    if (!loadResult.ok) {
      const result = buildUnavailableResult("database_error", ["database_read_error"]);
      logSelectorSummary({
        status: result.status,
        requestedPeriod,
        candidateCount,
        rowCount,
        validRowCount,
        selectedFallbackLevel: null,
        confidenceLevel: null,
        freshnessStatus: null,
        reasonCodes: result.reasonCodes,
      });
      return result;
    }

    rowCount = loadResult.rows.length;
    const mappedArtifacts: PricingBenchmarkArtifactCandidate[] = [];
    const mappingReasonCodes = new Set<PricingBenchmarkEvidenceSelectorReasonCode>();

    for (const row of loadResult.rows) {
      const mapped = mapPricingBenchmarkArtifactDbRow(row);
      if (mapped.ok) {
        mappedArtifacts.push(mapped.artifact);
      } else {
        mappingReasonCodes.add(mapped.reason);
      }
    }

    validRowCount = mappedArtifacts.length;
    if (mappedArtifacts.length === 0) {
      const reasonCodes =
        rowCount === 0
          ? (["no_artifact"] as PricingBenchmarkEvidenceSelectorReasonCode[])
          : [...mappingReasonCodes];
      const result = buildUnavailableResult(
        "unavailable",
        reasonCodes.length > 0
          ? reasonCodes
          : (["no_artifact"] as PricingBenchmarkEvidenceSelectorReasonCode[]),
      );
      logSelectorSummary({
        status: result.status,
        requestedPeriod,
        candidateCount,
        rowCount,
        validRowCount,
        selectedFallbackLevel: null,
        confidenceLevel: null,
        freshnessStatus: null,
        reasonCodes: result.reasonCodes,
      });
      return result;
    }

    const candidateIds = mappedArtifacts.map((artifact) => artifact.id);
    if (candidateIds.length === 0) {
      const result = buildUnavailableResult("unavailable", ["no_artifact"]);
      logSelectorSummary({
        status: result.status,
        requestedPeriod,
        candidateCount,
        rowCount,
        validRowCount,
        selectedFallbackLevel: null,
        confidenceLevel: null,
        freshnessStatus: null,
        reasonCodes: result.reasonCodes,
      });
      return result;
    }

    const loadSupersedingArtifactIds =
      dependencies.loadSupersedingArtifactIds ?? loadSupersedingArtifactIdsFromSupabase;
    const supersessionResult = await loadSupersedingArtifactIds(candidateIds);
    if (!supersessionResult.ok) {
      const result = buildUnavailableResult("database_error", ["database_read_error"]);
      logSelectorSummary({
        status: result.status,
        requestedPeriod,
        candidateCount,
        rowCount,
        validRowCount,
        selectedFallbackLevel: null,
        confidenceLevel: null,
        freshnessStatus: null,
        reasonCodes: result.reasonCodes,
      });
      return result;
    }

    const selection = selectBestPricingBenchmarkArtifact({
      input,
      artifacts: mappedArtifacts,
      now,
      supersededArtifactIds: supersessionResult.supersededArtifactIds,
    });

    if (!selection.selected) {
      const reasonCodes = new Set<PricingBenchmarkEvidenceSelectorReasonCode>(mappingReasonCodes);
      for (const reasonCode of selection.reasonCodes) {
        reasonCodes.add(mapPureReasonCode(reasonCode));
      }

      const result = buildUnavailableResult(
        "unavailable",
        reasonCodes.size > 0 ? [...reasonCodes] : ["no_artifact"],
      );
      logSelectorSummary({
        status: result.status,
        requestedPeriod,
        candidateCount,
        rowCount,
        validRowCount,
        selectedFallbackLevel: null,
        confidenceLevel: null,
        freshnessStatus: null,
        reasonCodes: result.reasonCodes,
      });
      return result;
    }

    const projected = projectPricingBenchmarkEvidence({
      input,
      artifacts: mappedArtifacts,
      now,
      supersededArtifactIds: supersessionResult.supersededArtifactIds,
    });

    if (!projected.available) {
      const reasonCodes = new Set<PricingBenchmarkEvidenceSelectorReasonCode>(mappingReasonCodes);
      for (const reasonCode of projected.reasonCodes) {
        reasonCodes.add(mapPureReasonCode(reasonCode));
      }
      const result = buildUnavailableResult(
        "unavailable",
        reasonCodes.size > 0 ? [...reasonCodes] : ["no_artifact"],
      );
      logSelectorSummary({
        status: result.status,
        requestedPeriod,
        candidateCount,
        rowCount,
        validRowCount,
        selectedFallbackLevel: null,
        confidenceLevel: null,
        freshnessStatus: null,
        reasonCodes: result.reasonCodes,
      });
      return result;
    }

    logSelectorSummary({
      status: "available",
      requestedPeriod,
      candidateCount,
      rowCount,
      validRowCount,
      selectedFallbackLevel: projected.evidence.fallbackLevel,
      confidenceLevel: projected.evidence.confidenceLevel,
      freshnessStatus: projected.evidence.freshnessStatus,
      reasonCodes: [],
    });
    return projected;
  } catch {
    const result = buildUnavailableResult("database_error", ["database_read_error"]);
    logSelectorSummary({
      status: result.status,
      requestedPeriod,
      candidateCount,
      rowCount,
      validRowCount,
      selectedFallbackLevel: null,
      confidenceLevel: null,
      freshnessStatus: null,
      reasonCodes: result.reasonCodes,
    });
    return result;
  }
}
