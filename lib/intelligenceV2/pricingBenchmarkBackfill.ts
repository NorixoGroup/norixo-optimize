import {
  canonicalizeMarketCity,
  canonicalizeMarketCountry,
} from "@/lib/competitors/marketNormalization";
import {
  buildPricingDistributionBenchmark,
  buildPricingBenchmarkPreview,
  type PricingBenchmarkBuilderResult,
} from "./pricingBenchmarkBuilder";
import {
  evaluatePricingBenchmarkGovernance,
  type PricingBenchmarkGovernanceDecision,
  type PricingBenchmarkGovernanceReasonCode,
  type PricingBenchmarkGovernanceResult,
} from "./pricingBenchmarkGovernance";
import {
  getIntelligenceV2FeatureFlags,
  type IntelligenceV2FeatureFlagEnv,
} from "./featureFlags";
import {
  normalizeCapacityBand,
  normalizeCurrency,
  normalizeIntelligencePlatform,
  normalizeIntelligencePropertyType,
  type IntelligenceV2CapacityBand,
  type IntelligenceV2Platform,
  type IntelligenceV2PropertyType,
} from "./marketCell";

const MONTH_BUCKET_REGEX = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const MAX_LIMIT = 10000;

type SourceRows = Parameters<typeof buildPricingBenchmarkPreview>[0]["rows"];
type SourceRow = SourceRows[number];
type PreviewResult = ReturnType<typeof buildPricingBenchmarkPreview>;

export type PricingBenchmarkBackfillMode = "dry_run" | "apply";

export type PricingBenchmarkBackfillCliOptions = Readonly<{
  country: string | null;
  city: string | null;
  platform: IntelligenceV2Platform | null;
  propertyType: IntelligenceV2PropertyType | null;
  capacityBand: IntelligenceV2CapacityBand | null;
  currency: string | null;
  capturePeriodBucket: string | null;
  limit: number | null;
  mode: PricingBenchmarkBackfillMode;
  confirmWrite: boolean;
}>;

export type PricingBenchmarkBackfillFactRow = Readonly<{
  market_cell_key: string;
  country: string;
  city: string;
  platform: string;
  property_type: string;
  capacity_band: string;
  currency: string;
  capture_period_bucket: string;
  normalized_nightly_price: number;
  source_class: string;
  confidence_input_band: string;
  freshness_input_band: string;
  transformation_policy_version: string;
  created_at: string;
  fact_contract_version?: string;
  eligibility_policy_version?: string;
  deduplication_policy_version?: string;
  market_cell_policy_version?: string;
  pricing_normalization_policy_version?: string;
  confidence_policy_version?: string;
  freshness_policy_version?: string;
  source_quality_band?: string;
}>;

export type PricingBenchmarkBackfillCellKey = Readonly<{
  marketCellKey: string;
  capturePeriodBucket: string;
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  capacityBand: string;
  currency: string;
}>;

export type PricingBenchmarkBackfillCellReport = Readonly<{
  cell: PricingBenchmarkBackfillCellKey;
  factsCount: number;
  sourceClassCount: number;
  minPrice: number;
  p10Price: number | null;
  p25Price: number | null;
  medianPrice: number | null;
  p75Price: number | null;
  p90Price: number | null;
  maxPrice: number;
  approvalStatus: string | null;
  exposure: PricingBenchmarkGovernanceDecision | "not_evaluated";
  builderReasonCodes: string[];
  governanceReasonCodes: string[];
  wouldWriteArtifact: boolean;
  artifactStatus:
    | "would_write"
    | "already_exists"
    | "insufficient"
    | "not_buildable";
}>;

export type PricingBenchmarkBackfillDryRunReport = Readonly<{
  mode: "dry_run";
  cellsScanned: number;
  cellsReported: number;
  rowsScanned: number;
  cells: ReadonlyArray<PricingBenchmarkBackfillCellReport>;
}>;

export type PricingBenchmarkBackfillApplyReport = Readonly<{
  mode: "apply";
  cellsScanned: number;
  rowsScanned: number;
  benchmarksBuilt: number;
  writeAttempted: number;
  inserted: number;
  updated: number;
  alreadyExisting: number;
  skipped: number;
  rejected: number;
  failed: number;
  cells: ReadonlyArray<PricingBenchmarkBackfillCellReport>;
}>;

export type PricingBenchmarkBackfillDependencies = Readonly<{
  previewBuilder?: typeof buildPricingBenchmarkPreview;
  pricingBuilder?: typeof buildPricingDistributionBenchmark;
  evaluateGovernance?: typeof evaluatePricingBenchmarkGovernance;
  adminEnv?: FeatureFlagEnvFactory;
}>;

type FeatureFlagEnvFactory = (
  env?: IntelligenceV2FeatureFlagEnv,
) => IntelligenceV2FeatureFlagEnv;

type BuildCellReportInput = Readonly<{
  cell: PricingBenchmarkBackfillCellKey;
  rows: SourceRows;
  builderResult: PricingBenchmarkBuilderResult;
  previewResult: PreviewResult;
  governanceResult: PricingBenchmarkGovernanceResult | null;
}>;

function fail(message: string): never {
  throw new Error(message);
}

function parseEqualsArgument(
  argument: string,
  name: string,
): string | null {
  const prefix = `${name}=`;
  if (!argument.startsWith(prefix)) return null;
  const value = argument.slice(prefix.length).trim();
  if (value.length === 0) {
    fail(`Missing value for \`${name}\`.`);
  }
  return value;
}

function normalizeCountryFilter(value: string | null): string | null {
  return value == null ? null : canonicalizeMarketCountry(value);
}

function normalizeCityFilter(value: string | null): string | null {
  return value == null ? null : canonicalizeMarketCity(value);
}

function normalizePlatformFilter(value: string | null): IntelligenceV2Platform | null {
  if (value == null) return null;
  const normalized = normalizeIntelligencePlatform(value);
  if (normalized === "unknown") {
    fail("`--platform` must be one of airbnb, booking, expedia, agoda, or vrbo.");
  }
  return normalized;
}

function normalizePropertyTypeFilter(
  value: string | null,
): IntelligenceV2PropertyType | null {
  if (value == null) return null;
  return normalizeIntelligencePropertyType(value);
}

function normalizeCapacityBandFilter(
  value: string | null,
): IntelligenceV2CapacityBand | null {
  if (value == null) return null;
  const normalized = value.trim();
  if (
    normalized !== "unknown" &&
    normalized !== "1_3" &&
    normalized !== "4_6" &&
    normalized !== "7_9" &&
    normalized !== "10_plus"
  ) {
    fail(
      "`--capacity-band` must be one of unknown, 1_3, 4_6, 7_9, or 10_plus.",
    );
  }
  return normalized;
}

function normalizeCurrencyFilter(value: string | null): string | null {
  if (value == null) return null;
  const normalized = normalizeCurrency(value);
  if (normalized === "UNKNOWN") {
    fail("`--currency` must be a valid ISO 4217 code.");
  }
  return normalized;
}

function assertMonthBucket(value: string | null): string | null {
  if (value == null) return null;
  if (!MONTH_BUCKET_REGEX.test(value)) {
    fail("`--capture-period` must match YYYY-MM.");
  }
  return value;
}

function toPositiveInteger(value: string | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_LIMIT) {
    fail(`\`--limit\` must be a positive integer not greater than ${MAX_LIMIT}.`);
  }
  return parsed;
}

export function parsePricingBenchmarkBackfillCliArgs(
  argv: ReadonlyArray<string>,
): PricingBenchmarkBackfillCliOptions {
  let country: string | null = null;
  let city: string | null = null;
  let platform: IntelligenceV2Platform | null = null;
  let propertyType: IntelligenceV2PropertyType | null = null;
  let capacityBand: IntelligenceV2CapacityBand | null = null;
  let currency: string | null = null;
  let capturePeriodBucket: string | null = null;
  let limit: number | null = null;
  let mode: PricingBenchmarkBackfillMode = "dry_run";
  let confirmWrite = false;
  let explicitDryRun = false;

  for (const argument of argv) {
    if (argument === "--dry-run") {
      explicitDryRun = true;
      continue;
    }

    if (argument === "--apply") {
      mode = "apply";
      continue;
    }

    if (argument === "--confirm-write") {
      confirmWrite = true;
      continue;
    }

    const parsedCountry = parseEqualsArgument(argument, "--country");
    if (parsedCountry != null) {
      country = normalizeCountryFilter(parsedCountry);
      continue;
    }

    const parsedCity = parseEqualsArgument(argument, "--city");
    if (parsedCity != null) {
      city = normalizeCityFilter(parsedCity);
      continue;
    }

    const parsedPlatform = parseEqualsArgument(argument, "--platform");
    if (parsedPlatform != null) {
      platform = normalizePlatformFilter(parsedPlatform);
      continue;
    }

    const parsedPropertyType = parseEqualsArgument(argument, "--property-type");
    if (parsedPropertyType != null) {
      propertyType = normalizePropertyTypeFilter(parsedPropertyType);
      continue;
    }

    const parsedCapacityBand = parseEqualsArgument(argument, "--capacity-band");
    if (parsedCapacityBand != null) {
      capacityBand = normalizeCapacityBandFilter(parsedCapacityBand);
      continue;
    }

    const parsedCurrency = parseEqualsArgument(argument, "--currency");
    if (parsedCurrency != null) {
      currency = normalizeCurrencyFilter(parsedCurrency);
      continue;
    }

    const parsedPeriod = parseEqualsArgument(argument, "--capture-period");
    if (parsedPeriod != null) {
      capturePeriodBucket = assertMonthBucket(parsedPeriod);
      continue;
    }

    const parsedLimit = parseEqualsArgument(argument, "--limit");
    if (parsedLimit != null) {
      limit = toPositiveInteger(parsedLimit);
      continue;
    }

    fail(`Unknown argument: ${argument}`);
  }

  if (explicitDryRun && mode === "apply") {
    fail("`--dry-run` and `--apply` cannot be used together.");
  }

  if (mode === "apply") {
    if (!confirmWrite) {
      fail("Apply mode requires --confirm-write.");
    }
    if (country == null || city == null || platform == null) {
      fail(
        "Apply mode requires an explicit perimeter: `--country`, `--city`, and `--platform`.",
      );
    }
  }

  return {
    country,
    city,
    platform,
    propertyType,
    capacityBand,
    currency,
    capturePeriodBucket,
    limit,
    mode,
    confirmWrite,
  };
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function toSourceRows(
  rows: ReadonlyArray<PricingBenchmarkBackfillFactRow>,
): SourceRows {
  return rows.map((row) => ({
    country: row.country,
    city: row.city,
    platform: row.platform,
    property_type: row.property_type,
    capacity_band: row.capacity_band,
    currency: row.currency,
    market_cell_key: row.market_cell_key,
    normalized_nightly_price: row.normalized_nightly_price,
    source_class: row.source_class,
    fact_contract_version: row.fact_contract_version ?? "v1",
    transformation_policy_version: row.transformation_policy_version,
    eligibility_policy_version: row.eligibility_policy_version ?? "v1",
    deduplication_policy_version: row.deduplication_policy_version ?? "v1",
    market_cell_policy_version: row.market_cell_policy_version ?? "v1",
    pricing_normalization_policy_version:
      row.pricing_normalization_policy_version ?? "v1",
    confidence_policy_version: row.confidence_policy_version ?? "v1",
    freshness_policy_version: row.freshness_policy_version ?? "v1",
    source_quality_band: row.source_quality_band ?? "unknown",
    freshness_input_band: row.freshness_input_band,
    confidence_input_band: row.confidence_input_band,
  }));
}

function rowMatchesFilters(
  row: PricingBenchmarkBackfillFactRow,
  options: PricingBenchmarkBackfillCliOptions,
): boolean {
  if (options.country != null && row.country !== options.country) return false;
  if (options.city != null && row.city !== options.city) return false;
  if (options.platform != null && row.platform !== options.platform) return false;
  if (options.propertyType != null && row.property_type !== options.propertyType) {
    return false;
  }
  if (options.capacityBand != null && row.capacity_band !== options.capacityBand) {
    return false;
  }
  if (options.currency != null && row.currency !== options.currency) return false;
  if (
    options.capturePeriodBucket != null &&
    row.capture_period_bucket !== options.capturePeriodBucket
  ) {
    return false;
  }
  return true;
}

function buildCellKey(row: PricingBenchmarkBackfillFactRow): string {
  return [
    row.market_cell_key,
    row.capture_period_bucket,
  ].join("|");
}

function groupRowsByCell(
  rows: ReadonlyArray<PricingBenchmarkBackfillFactRow>,
  options: PricingBenchmarkBackfillCliOptions,
): ReadonlyArray<Readonly<{
  cell: PricingBenchmarkBackfillCellKey;
  rows: ReadonlyArray<PricingBenchmarkBackfillFactRow>;
}>> {
  const grouped = new Map<
    string,
    {
      cell: PricingBenchmarkBackfillCellKey;
      rows: PricingBenchmarkBackfillFactRow[];
    }
  >();

  for (const row of rows) {
    if (!rowMatchesFilters(row, options)) continue;
    const key = buildCellKey(row);
    const current = grouped.get(key);
    if (current) {
      current.rows.push(row);
      continue;
    }
    grouped.set(key, {
      cell: {
        marketCellKey: row.market_cell_key,
        capturePeriodBucket: row.capture_period_bucket,
        country: row.country,
        city: row.city,
        platform: row.platform,
        propertyType: row.property_type,
        capacityBand: row.capacity_band,
        currency: row.currency,
      },
      rows: [row],
    });
  }

  let cells = [...grouped.values()].sort((left, right) => {
    const periodOrder = left.cell.capturePeriodBucket.localeCompare(
      right.cell.capturePeriodBucket,
    );
    if (periodOrder !== 0) return periodOrder;
    return left.cell.marketCellKey.localeCompare(right.cell.marketCellKey);
  });

  if (options.limit != null) {
    cells = cells.slice(0, options.limit);
  }

  return cells;
}

function buildAdministrativeBenchmarkEnv(
  env: IntelligenceV2FeatureFlagEnv = process.env,
): IntelligenceV2FeatureFlagEnv {
  return {
    ...env,
    ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION: "true",
  };
}

function computeMinMax(rows: SourceRows): { minPrice: number; maxPrice: number } {
  const prices = rows
    .map((row) => row.normalized_nightly_price)
    .filter(isFinitePositiveNumber)
    .sort((left, right) => left - right);
  const minPrice = prices[0] ?? 0;
  const maxPrice = prices[prices.length - 1] ?? 0;
  return { minPrice, maxPrice };
}

function buildGovernanceResult(
  previewResult: PreviewResult,
  evaluateGovernanceFn: typeof evaluatePricingBenchmarkGovernance,
): PricingBenchmarkGovernanceResult | null {
  if (!previewResult.ok) return null;
  const payload = previewResult.payload;
  return evaluateGovernanceFn({
    benchmarkType: "pricing_distribution",
    approvalStatus: payload.approval_status,
    approvedForInternal: payload.approved_for_internal,
    approvedForAudit: payload.approved_for_audit,
    propertyType: payload.property_type,
    capacityBand: payload.capacity_band,
    platform: payload.platform,
    currency: payload.currency,
    p10: payload.p10_price,
    p25: payload.p25_price,
    median: payload.median_price,
    p75: payload.p75_price,
    p90: payload.p90_price,
    rawSampleSize: payload.raw_sample_size,
    includedSampleSize: payload.included_sample_size,
    excludedOutlierCount: payload.excluded_outlier_count,
    sourceClassCount: payload.source_class_count,
    sourceDiversityBand: payload.source_diversity_band,
    confidenceLevel: payload.confidence_level,
    validFrom: payload.valid_from,
    validUntil: payload.valid_until,
    limitations: payload.limitations,
    artifactContractVersion: payload.artifact_contract_version,
    cohortPolicyVersion: payload.cohort_policy_version,
    aggregationPolicyVersion: payload.aggregation_policy_version,
    outlierPolicyVersion: payload.outlier_policy_version,
    confidencePolicyVersion: payload.confidence_policy_version,
    freshnessPolicyVersion: payload.freshness_policy_version,
    approvalPolicyVersion: payload.approval_policy_version,
    marketCellPolicyVersion: payload.market_cell_policy_version,
    superseded: false,
  });
}

function toArtifactStatus(
  previewResult: PreviewResult,
  builderResult: PricingBenchmarkBuilderResult,
): PricingBenchmarkBackfillCellReport["artifactStatus"] {
  if (!previewResult.ok) return "not_buildable";
  if (previewResult.approvalStatus === "insufficient") return "insufficient";
  if (builderResult.reasonCodes.includes("artifact_already_exists")) {
    return "already_exists";
  }
  return "would_write";
}

function toWouldWriteArtifact(
  previewResult: PreviewResult,
  builderResult: PricingBenchmarkBuilderResult,
): boolean {
  if (!previewResult.ok) return false;
  if (previewResult.approvalStatus === "insufficient") return false;
  if (builderResult.status === "failed" || builderResult.status === "disabled") {
    return false;
  }
  return !builderResult.reasonCodes.includes("artifact_already_exists");
}

function sortStrings(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function buildCellReport(input: BuildCellReportInput): PricingBenchmarkBackfillCellReport {
  const { minPrice, maxPrice } = computeMinMax(input.rows);
  const sourceClassCount = new Set(
    input.rows.map((row) => row.source_class),
  ).size;

  return {
    cell: input.cell,
    factsCount: input.rows.length,
    sourceClassCount,
    minPrice,
    p10Price: input.builderResult.p10Price,
    p25Price: input.builderResult.p25Price,
    medianPrice: input.builderResult.medianPrice,
    p75Price: input.builderResult.p75Price,
    p90Price: input.builderResult.p90Price,
    maxPrice,
    approvalStatus: input.builderResult.approvalStatus,
    exposure: input.governanceResult?.decision ?? "not_evaluated",
    builderReasonCodes: sortStrings(input.builderResult.reasonCodes),
    governanceReasonCodes: sortStrings(
      input.governanceResult?.reasonCodes ??
        ([] as PricingBenchmarkGovernanceReasonCode[]),
    ),
    wouldWriteArtifact: toWouldWriteArtifact(
      input.previewResult,
      input.builderResult,
    ),
    artifactStatus: toArtifactStatus(input.previewResult, input.builderResult),
  };
}

function formatNullableNumber(value: number | null): string {
  return value == null ? "n/a" : String(Math.round(value * 100) / 100);
}

function formatCodeList(values: ReadonlyArray<string>): string {
  return values.length === 0 ? "none" : values.join(", ");
}

export function formatPricingBenchmarkBackfillDryRunReport(
  report: PricingBenchmarkBackfillDryRunReport,
): string {
  const lines: string[] = [
    "Mode: dry-run",
    `Rows scanned: ${report.rowsScanned}`,
    `Cells scanned: ${report.cellsScanned}`,
    `Cells reported: ${report.cellsReported}`,
    "",
  ];

  for (const cell of report.cells) {
    lines.push(
      `${cell.cell.country} | ${cell.cell.city} | ${cell.cell.platform} | ${cell.cell.propertyType} | ${cell.cell.capacityBand} | ${cell.cell.currency} | ${cell.cell.capturePeriodBucket}`,
    );
    lines.push(`Facts: ${cell.factsCount}`);
    lines.push(`Source classes: ${cell.sourceClassCount}`);
    lines.push(
      `Min/P25/Median/P75/Max: ${formatNullableNumber(cell.minPrice)} / ${formatNullableNumber(cell.p25Price)} / ${formatNullableNumber(cell.medianPrice)} / ${formatNullableNumber(cell.p75Price)} / ${formatNullableNumber(cell.maxPrice)}`,
    );
    lines.push(`Approval: ${cell.approvalStatus ?? "n/a"}`);
    lines.push(`Exposure: ${cell.exposure}`);
    lines.push(`Builder reasons: ${formatCodeList(cell.builderReasonCodes)}`);
    lines.push(
      `Governance reasons: ${formatCodeList(cell.governanceReasonCodes)}`,
    );
    lines.push(
      `Would write artifact: ${cell.wouldWriteArtifact ? "yes" : "no"}`,
    );
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function formatPricingBenchmarkBackfillApplyReport(
  report: PricingBenchmarkBackfillApplyReport,
): string {
  const lines = [
    "Mode: apply",
    `Rows scanned: ${report.rowsScanned}`,
    `Cells scanned: ${report.cellsScanned}`,
    `Benchmarks built: ${report.benchmarksBuilt}`,
    `Write attempted: ${report.writeAttempted}`,
    `Inserted: ${report.inserted}`,
    `Updated: ${report.updated}`,
    `Already existing: ${report.alreadyExisting}`,
    `Skipped: ${report.skipped}`,
    `Rejected: ${report.rejected}`,
    `Failed: ${report.failed}`,
  ];
  return lines.join("\n");
}

export async function runPricingBenchmarkBackfillDryRun(input: Readonly<{
  options: PricingBenchmarkBackfillCliOptions;
  rows: ReadonlyArray<PricingBenchmarkBackfillFactRow>;
  env?: IntelligenceV2FeatureFlagEnv;
  dependencies?: PricingBenchmarkBackfillDependencies;
}>): Promise<PricingBenchmarkBackfillDryRunReport> {
  const previewBuilder =
    input.dependencies?.previewBuilder ?? buildPricingBenchmarkPreview;
  const pricingBuilder =
    input.dependencies?.pricingBuilder ?? buildPricingDistributionBenchmark;
  const governanceEvaluator =
    input.dependencies?.evaluateGovernance ?? evaluatePricingBenchmarkGovernance;
  const adminEnvFactory =
    input.dependencies?.adminEnv ?? buildAdministrativeBenchmarkEnv;
  const grouped = groupRowsByCell(input.rows, input.options);
  const adminEnv = adminEnvFactory(input.env);
  const cells: PricingBenchmarkBackfillCellReport[] = [];

  for (const entry of grouped) {
    const sourceRows = toSourceRows(entry.rows);
    const previewResult = previewBuilder({
      marketCellKey: entry.cell.marketCellKey,
      capturePeriodBucket: entry.cell.capturePeriodBucket,
      rows: sourceRows,
    });
    const builderResult = await pricingBuilder({
      marketCellKey: entry.cell.marketCellKey,
      capturePeriodBucket: entry.cell.capturePeriodBucket,
      dryRun: true,
    }, {
      env: adminEnv,
    });
    const governanceResult = buildGovernanceResult(
      previewResult,
      governanceEvaluator,
    );

    cells.push(
      buildCellReport({
        cell: entry.cell,
        rows: sourceRows,
        builderResult,
        previewResult,
        governanceResult,
      }),
    );
  }

  return {
    mode: "dry_run",
    cellsScanned: grouped.length,
    cellsReported: cells.length,
    rowsScanned: input.rows.length,
    cells,
  };
}

function isBuilderWriteAttempted(
  result: PricingBenchmarkBuilderResult,
): boolean {
  return result.status === "inserted" || result.status === "failed";
}

export async function runPricingBenchmarkBackfillApply(input: Readonly<{
  options: PricingBenchmarkBackfillCliOptions;
  rows: ReadonlyArray<PricingBenchmarkBackfillFactRow>;
  env?: IntelligenceV2FeatureFlagEnv;
  dependencies?: PricingBenchmarkBackfillDependencies;
}>): Promise<PricingBenchmarkBackfillApplyReport> {
  if (input.options.mode !== "apply") {
    fail("Apply runner requires apply mode.");
  }

  const previewBuilder =
    input.dependencies?.previewBuilder ?? buildPricingBenchmarkPreview;
  const pricingBuilder =
    input.dependencies?.pricingBuilder ?? buildPricingDistributionBenchmark;
  const governanceEvaluator =
    input.dependencies?.evaluateGovernance ?? evaluatePricingBenchmarkGovernance;
  const adminEnvFactory =
    input.dependencies?.adminEnv ?? buildAdministrativeBenchmarkEnv;
  const grouped = groupRowsByCell(input.rows, input.options);
  const adminEnv = adminEnvFactory(input.env);
  const cells: PricingBenchmarkBackfillCellReport[] = [];
  let benchmarksBuilt = 0;
  let writeAttempted = 0;
  let inserted = 0;
  let updated = 0;
  let alreadyExisting = 0;
  let skipped = 0;
  let rejected = 0;
  let failed = 0;

  for (const entry of grouped) {
    const sourceRows = toSourceRows(entry.rows);
    const previewResult = previewBuilder({
      marketCellKey: entry.cell.marketCellKey,
      capturePeriodBucket: entry.cell.capturePeriodBucket,
      rows: sourceRows,
    });
    const builderResult = await pricingBuilder({
      marketCellKey: entry.cell.marketCellKey,
      capturePeriodBucket: entry.cell.capturePeriodBucket,
      dryRun: false,
    }, {
      env: adminEnv,
    });
    const governanceResult = buildGovernanceResult(
      previewResult,
      governanceEvaluator,
    );

    cells.push(
      buildCellReport({
        cell: entry.cell,
        rows: sourceRows,
        builderResult,
        previewResult,
        governanceResult,
      }),
    );

    if (previewResult.ok) {
      benchmarksBuilt += 1;
    }

    if (isBuilderWriteAttempted(builderResult)) {
      writeAttempted += 1;
    }

    switch (builderResult.status) {
      case "inserted":
        inserted += 1;
        break;
      case "already_exists":
        alreadyExisting += 1;
        break;
      case "insufficient":
        rejected += 1;
        break;
      case "disabled":
      case "failed":
        failed += 1;
        break;
      case "dry_run":
        skipped += 1;
        break;
    }
  }

  return {
    mode: "apply",
    cellsScanned: grouped.length,
    rowsScanned: input.rows.length,
    benchmarksBuilt,
    writeAttempted,
    inserted,
    updated,
    alreadyExisting,
    skipped,
    rejected,
    failed,
    cells,
  };
}

export function shouldAllowApplyExecution(
  report: PricingBenchmarkBackfillDryRunReport,
): boolean {
  return report.cells.some((cell) => cell.wouldWriteArtifact);
}

export function isBenchmarkComputationEnabled(
  env: IntelligenceV2FeatureFlagEnv = process.env,
): boolean {
  return getIntelligenceV2FeatureFlags(env)
    .ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION;
}
