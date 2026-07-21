import { createHash } from "node:crypto";

import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";
import {
  type ExecutionGraph,
  type ExecutionPlan as RuntimeExecutionPlan,
  buildExecutionGraph,
  buildExecutionPlan as buildRuntimeExecutionPlan,
} from "./executionRuntime";
import {
  parseMarketReportDefinition,
  type MarketReportDefinition,
} from "./marketReportPilot";
import {
  assertRegistrySnapshotPublicSafe,
  buildRegistrySnapshotFingerprint,
  getActiveRegistryVersion,
  getRegistryArtifactLineage,
  getRegistryAsset,
  getRegistryFreshnessState,
  listRegistryPublicationsForAsset,
  listRegistryVariantsForAsset,
  parseRegistrySnapshot,
  type RegistryArtifactReference,
  type RegistryAsset,
  type RegistryAssetVersion,
  type RegistryChannelVariant,
  type RegistryConfidenceBand,
  type RegistryFreshnessState,
  type RegistryPublicationState,
  type RegistrySnapshot,
} from "./registryAdapter";

export const MARKET_REPORT_SECTION_TYPES = Object.freeze([
  "executive_summary",
  "market_overview",
  "pricing_benchmark",
  "occupancy_benchmark",
  "confidence",
  "freshness",
  "methodology",
  "sources",
] as const);

export type MarketReportSectionType =
  (typeof MARKET_REPORT_SECTION_TYPES)[number];

export const MARKET_REPORT_CHANGE_TYPES = Object.freeze([
  "new_report",
  "unchanged_report",
  "updated_report",
  "partial_report",
  "invalid_report",
  "stale_report",
  "missing_required_asset",
] as const);

export type MarketReportChangeType =
  (typeof MARKET_REPORT_CHANGE_TYPES)[number];

export const MARKET_REPORT_DIAGNOSTIC_CODES = Object.freeze([
  "report_asset_missing",
  "active_version_missing",
  "overview_asset_missing",
  "pricing_asset_missing",
  "occupancy_asset_missing",
  "confidence_missing",
  "freshness_missing",
  "invalid_market_identity",
  "cross_market_reference",
  "unsupported_locale",
  "incomplete_report",
  "partial_report_generated",
  "stale_report",
  "invalid_lineage",
  "private_field_detected",
  "invalid_structured_data",
  "invalid_metadata_artifact",
  "unchanged_report",
  "updated_report",
  "runtime_job_created",
  "missing_content_snapshot",
  "report_generated",
  "new_report",
  "mapping_warning",
  "missing_required_asset",
  "invalid_report_document",
  "invalid_artifact_bundle",
  "invalid_report_section",
  "invalid_content_snapshot",
  "invalid_runtime_graph",
  "partial_section_missing",
  "non_publishable_asset",
] as const);

export type MarketReportDiagnosticCode =
  (typeof MARKET_REPORT_DIAGNOSTIC_CODES)[number];

export type MarketReportDiagnosticSeverity = "info" | "warning" | "error";

export type MarketReportGenerationDiagnostic = Readonly<{
  code: MarketReportDiagnosticCode;
  severity: MarketReportDiagnosticSeverity;
  message: string;
  reportKey: string | null;
  assetKey: string | null;
  sectionType: MarketReportSectionType | null;
  metadata: CoordinationJsonObject;
}>;

export const MARKET_REPORT_ERROR_CODES = Object.freeze([
  "invalid_input",
  "registry_resolution_error",
  "missing_required_asset",
  "invalid_asset_version",
  "invalid_market_identity",
  "incomplete_report",
  "unsupported_locale",
  "privacy_violation",
  "invalid_report_document",
  "invalid_artifact_bundle",
  "mapping_error",
  "fingerprint_error",
] as const);

export type MarketReportGenerationErrorCode =
  (typeof MARKET_REPORT_ERROR_CODES)[number];

export class MarketReportGenerationError extends Error {
  readonly code: MarketReportGenerationErrorCode;
  readonly operation: string;
  readonly reportKey?: string;
  readonly assetKey?: string;
  readonly marketCellKey?: string;
  readonly sectionType?: MarketReportSectionType;
  readonly path?: string;
  readonly cause?: unknown;

  constructor(
    input: Readonly<{
      code: MarketReportGenerationErrorCode;
      operation: string;
      message: string;
      reportKey?: string;
      assetKey?: string;
      marketCellKey?: string;
      sectionType?: MarketReportSectionType;
      path?: string;
      cause?: unknown;
    }>,
  ) {
    super(input.message);
    this.name = "MarketReportGenerationError";
    this.code = input.code;
    this.operation = input.operation;
    this.reportKey = input.reportKey;
    this.assetKey = input.assetKey;
    this.marketCellKey = input.marketCellKey;
    this.sectionType = input.sectionType;
    this.path = input.path;
    this.cause = input.cause;
  }
}

export type MarketReportCompletenessPolicy = Readonly<{
  requireOverview: boolean;
  requirePricing: boolean;
  requireOccupancy: boolean;
  requireConfidence: boolean;
  requireFreshness: boolean;
  allowPartialReport: boolean;
  minimumSectionCount: number;
}>;

export type MarketReportGenerationOptions = Readonly<{
  includeMethodology: boolean;
  includeConfidence: boolean;
  includeFreshness: boolean;
  includeLineage: boolean;
  strictCompleteness: boolean;
  targetChannel: string;
  supportedLocales: readonly string[];
  requiredSections: readonly MarketReportSectionType[];
  completenessPolicy: MarketReportCompletenessPolicy;
  metadata: CoordinationJsonObject;
}>;

export type MarketReportGenerationInput = Readonly<{
  registrySnapshot: unknown;
  reportAssetKey: string;
  locale: string;
  generatedAt: string;
  canonicalBaseUrl?: string | null;
  policyVersions?: Readonly<Record<string, string>>;
  previousBundle?: MarketReportArtifactBundle | null;
  options?: Partial<{
    includeMethodology: boolean;
    includeConfidence: boolean;
    includeFreshness: boolean;
    includeLineage: boolean;
    strictCompleteness: boolean;
    targetChannel: string;
    supportedLocales: readonly string[];
    requiredSections: readonly MarketReportSectionType[];
    completenessPolicy: Partial<MarketReportCompletenessPolicy>;
    metadata: CoordinationJsonObject;
  }>;
  metadata?: CoordinationJsonObject;
}>;

export type MarketReportIdentity = Readonly<{
  reportId: string;
  reportKey: string;
  assetKey: string;
  assetVersionId: string;
  marketCellKey: string;
  country: string;
  countryCode: string | null;
  city: string;
  citySlug: string;
  platform: string;
  propertyType: string;
  capacityBand: string | null;
  locale: string;
  reportSlug: string;
  canonicalPath: string;
  canonicalUrl: string | null;
}>;

export type MarketReportPeriod = Readonly<{
  capturePeriodBucket: string | null;
  sourcePeriodStart: string | null;
  sourcePeriodEnd: string | null;
  windowStartedAt: string | null;
  windowEndedAt: string | null;
  label: string;
}>;

export type MarketReportDataPoint = Readonly<{
  key: string;
  label: string;
  value: string | number | boolean | null;
  unit: string | null;
  metadata: CoordinationJsonObject;
}>;

export type MarketReportSection = Readonly<{
  sectionId: string;
  sectionType: MarketReportSectionType;
  order: number;
  title: string;
  summary: string | null;
  content: CoordinationJsonObject;
  dataPoints: readonly MarketReportDataPoint[];
  diagnostics: readonly MarketReportGenerationDiagnostic[];
  contentFingerprint: string;
}>;

export type MarketReportConfidence = Readonly<{
  band: RegistryConfidenceBand | "unknown";
  label: string;
  signals: readonly MarketReportDataPoint[];
}>;

export type MarketReportFreshnessStatus =
  | "fresh"
  | "aging"
  | "stale"
  | "expired"
  | "unknown";

export type MarketReportFreshness = Readonly<{
  status: MarketReportFreshnessStatus;
  label: string;
  assets: readonly (Readonly<{
    assetKey: string;
    assetKind: string;
    status: MarketReportFreshnessStatus;
    computedAt: string | null;
    staleAfter: string | null;
    expiredAfter: string | null;
  }>)[];
}>;

export type MarketReportMethodology = Readonly<{
  title: string;
  bullets: readonly string[];
  disclaimer: string;
}>;

export type MarketReportLineageArtifact = Readonly<{
  marketCellKey: string;
  sourceArtifacts: readonly (Readonly<{
    artifactType: string;
    artifactId: string;
    artifactFingerprint: string;
    relationshipType: string;
    metadata: CoordinationJsonObject;
  }>)[];
  sourceLabels: readonly string[];
  policyVersions: Readonly<Record<string, string>>;
  sourceFingerprint: string;
}>;

export type MarketReportStructuredData = Readonly<{
  schemaType: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
  about: CoordinationJsonObject;
  spatialCoverage: CoordinationJsonObject;
  temporalCoverage: CoordinationJsonObject;
  publisher: CoordinationJsonObject;
  mainEntity: CoordinationJsonObject;
  dataset: CoordinationJsonObject;
  methodology: CoordinationJsonObject;
  canonicalUrl: string | null;
}>;

export type MarketReportMetadataArtifact = Readonly<{
  title: string;
  description: string;
  canonicalPath: string;
  canonicalUrl: string | null;
  locale: string;
  alternates: Readonly<Record<string, string>>;
  openGraph: CoordinationJsonObject;
  robots: CoordinationJsonObject;
  publishedAt: string;
  modifiedAt: string;
  contentFingerprint: string;
}>;

export type MarketReportContentArtifact = Readonly<{
  heading: string;
  introduction: string;
  sections: readonly MarketReportSection[];
  keyFacts: readonly MarketReportDataPoint[];
  disclaimers: readonly string[];
  callouts: readonly string[];
  tables: readonly CoordinationJsonObject[];
  chartsData: readonly CoordinationJsonObject[];
  methodology: MarketReportMethodology | null;
  sourceNotes: readonly string[];
}>;

export type MarketReportDocument = Readonly<{
  identity: MarketReportIdentity;
  title: string;
  description: string;
  period: MarketReportPeriod;
  generatedAt: string;
  sourceCapturedAt: string | null;
  contentFingerprint: string;
  documentVersion: number;
  sections: readonly MarketReportSection[];
  facts: readonly MarketReportDataPoint[];
  confidence: MarketReportConfidence | null;
  freshness: MarketReportFreshness | null;
  methodology: MarketReportMethodology | null;
  lineage: MarketReportLineageArtifact | null;
  diagnostics: readonly MarketReportGenerationDiagnostic[];
  policyVersions: Readonly<Record<string, string>>;
  metadata: CoordinationJsonObject;
}>;

export type MarketReportGenerationChange = Readonly<{
  changeType: MarketReportChangeType;
  previousFingerprint: string | null;
  nextFingerprint: string;
  changedSections: readonly MarketReportSectionType[];
  unchangedSections: readonly MarketReportSectionType[];
  diagnostics: readonly MarketReportGenerationDiagnostic[];
}>;

export type MarketReportArtifactBundle = Readonly<{
  bundleId: string;
  reportId: string;
  reportFingerprint: string;
  document: MarketReportDocument;
  structuredData: MarketReportStructuredData;
  metadataArtifact: MarketReportMetadataArtifact;
  contentArtifact: MarketReportContentArtifact;
  lineageArtifact: MarketReportLineageArtifact | null;
  diagnostics: readonly MarketReportGenerationDiagnostic[];
  policyVersions: Readonly<Record<string, string>>;
  change: MarketReportGenerationChange;
}>;

export type MarketReportGenerationValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type MarketReportDocumentValidationResult =
  | Readonly<{ ok: true; document: MarketReportDocument }>
  | Readonly<{
      ok: false;
      issues: readonly MarketReportGenerationValidationIssue[];
    }>;

export type MarketReportBundleValidationResult =
  | Readonly<{ ok: true; bundle: MarketReportArtifactBundle }>
  | Readonly<{
      ok: false;
      issues: readonly MarketReportGenerationValidationIssue[];
    }>;

export type MarketReportResolutionMode = "reference" | "group_match";

export type MarketReportResolvedInsightAsset<TContent extends CoordinationJsonObject> =
  Readonly<{
    asset: RegistryAsset;
    version: RegistryAssetVersion;
    content: TContent;
    freshness: RegistryFreshnessState | null;
    lineage: readonly RegistryArtifactReference[];
    publications: readonly RegistryPublicationState[];
    variants: readonly RegistryChannelVariant[];
    resolutionMode: MarketReportResolutionMode;
  }>;

export type MarketReportResolvedAssets = Readonly<{
  reportAsset: RegistryAsset;
  reportVersion: RegistryAssetVersion;
  reportDefinition: MarketReportDefinition;
  reportContent: ReportContentSnapshot;
  reportFreshness: RegistryFreshnessState | null;
  reportLineage: readonly RegistryArtifactReference[];
  reportPublications: readonly RegistryPublicationState[];
  reportVariants: readonly RegistryChannelVariant[];
  pricing: MarketReportResolvedInsightAsset<PricingContentSnapshot> | null;
  occupancy: MarketReportResolvedInsightAsset<OccupancyContentSnapshot> | null;
  overview: MarketReportResolvedInsightAsset<OverviewContentSnapshot> | null;
  diagnostics: readonly MarketReportGenerationDiagnostic[];
}>;

export type BuildMarketReportRuntimeGraphInput = Readonly<{
  registrySnapshot: unknown;
  reportAssetKey: string;
  locale: string;
  generatedAt: string;
  metadata?: CoordinationJsonObject;
}>;

export type MarketReportRuntimePlan = Readonly<{
  graph: ExecutionGraph;
  plan: RuntimeExecutionPlan;
  diagnostics: readonly MarketReportGenerationDiagnostic[];
}>;

type PricingContentSnapshot = Readonly<{
  benchmarkType: "pricing_distribution";
  currency: string;
  capturePeriodBucket: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  distribution: Readonly<{
    p10: number;
    p25: number;
    median: number;
    p75: number;
    p90: number;
  }>;
  sample: Readonly<{
    raw: number;
    included: number;
    excludedOutliers: number;
    sourceClassCount: number;
    sourceDiversityBand: string;
  }>;
  approvalStatus: string;
  confidenceLevel: string;
  limitations: readonly string[];
}>;

type OccupancyContentSnapshot = Readonly<{
  benchmarkType: "occupancy_distribution";
  capturePeriodBucket: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  dominantObservedDaysBand: string;
  dominantUnavailabilityRateBand: string;
  observedDaysCounts: Readonly<Record<string, number>>;
  unavailabilityRateCounts: Readonly<Record<string, number>>;
  sample: Readonly<{
    raw: number;
    included: number;
    excludedOutliers: number;
    sourceClassCount: number;
    sourceDiversityBand: string;
  }>;
  approvalStatus: string;
  confidenceLevel: string;
  limitations: readonly string[];
}>;

type OverviewContentSnapshot = Readonly<{
  benchmarkType: "public_market_overview";
  aggregationWindow: string;
  platformScope: string;
  propertyScope: string;
  capacityScope: string;
  currency: string;
  capturePeriodBucket: string;
  windowStartedAt: string;
  windowEndedAt: string;
  distribution: Readonly<{
    p25: number;
    median: number;
    p75: number;
  }>;
  sampleBand: string;
  confidence: string;
  freshnessStatus: string;
  exposureStatus: string;
  limitations: readonly string[];
}>;

type ReportContentSnapshot = Readonly<{
  reportId: string;
  marketCellKey: string;
  city: string;
  country: string;
  platform: string;
  propertyType: string;
  language: string;
  title: string;
  slug: string;
  benchmarkFingerprint: string;
  overviewFingerprint: string;
}>;

type LocalizationBundle = Readonly<{
  locale: string;
  sectionTitles: Readonly<Record<MarketReportSectionType, string>>;
  sectionMissingLabel: string;
  titleBuilder: (input: {
    platform: string;
    city: string;
    propertyType: string;
  }) => string;
  descriptionBuilder: (input: {
    platform: string;
    city: string;
    periodLabel: string;
    hasOccupancy: boolean;
  }) => string;
  executiveSummary: (input: {
    city: string;
    platform: string;
    currency: string | null;
    pricingMedian: number | null;
    pricingCapturePeriod: string | null;
    occupancyBand: string | null;
    confidenceLabel: string;
  }) => string;
  methodologyBullets: readonly string[];
  methodologyDisclaimer: string;
  confidenceLabels: Readonly<Record<string, string>>;
  freshnessLabels: Readonly<Record<MarketReportFreshnessStatus, string>>;
  pricingMedianLabel: string;
  priceRangeLabel: string;
  occupancySignalLabel: string;
  capturePeriodLabel: string;
  sampleLabel: string;
  sourceDiversityLabel: string;
  freshnessEvaluatedLabel: string;
  lineageNote: string;
  sourceNotesTitle: string;
  marketOverviewSummary: (input: {
    median: number | null;
    currency: string | null;
    sampleBand: string | null;
  }) => string;
  pricingSummary: (input: {
    median: number | null;
    currency: string | null;
    confidenceLabel: string;
  }) => string;
  occupancySummary: (input: {
    unavailabilityBand: string | null;
    observedBand: string | null;
    confidenceLabel: string;
  }) => string;
  confidenceSummary: (input: {
    reportConfidenceLabel: string;
  }) => string;
  freshnessSummary: (input: { freshnessLabel: string }) => string;
  sourcesSummary: string;
}>;

const DEFAULT_COMPLETENESS_POLICY: MarketReportCompletenessPolicy =
  Object.freeze({
    requireOverview: true,
    requirePricing: true,
    requireOccupancy: true,
    requireConfidence: false,
    requireFreshness: false,
    allowPartialReport: false,
    minimumSectionCount: 5,
  });

const DEFAULT_GENERATION_OPTIONS: MarketReportGenerationOptions =
  Object.freeze({
    includeMethodology: true,
    includeConfidence: true,
    includeFreshness: true,
    includeLineage: true,
    strictCompleteness: true,
    targetChannel: "web",
    supportedLocales: Object.freeze(["en", "fr"]),
    requiredSections: Object.freeze([
      "executive_summary",
      "market_overview",
      "pricing_benchmark",
      "occupancy_benchmark",
      "methodology",
      "sources",
    ] as const),
    completenessPolicy: DEFAULT_COMPLETENESS_POLICY,
    metadata: Object.freeze({}),
  });

const PRIVATE_KEY_DENYLIST = new Set([
  "userid",
  "workspaceid",
  "auditid",
  "listingid",
  "listingurl",
  "sourceurl",
  "comparableurl",
  "email",
  "guestname",
  "hostname",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "authorization",
  "rawpayload",
  "rawobservation",
  "bookingid",
  "reservationid",
]);

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString() === value;
}

function isJsonSafe(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): value is CoordinationJsonValue {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (
    typeof value === "undefined" ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isJsonSafe(entry, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
    return Object.values(value as Record<string, unknown>).every((entry) =>
      isJsonSafe(entry, seen),
    );
  }

  return false;
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort(compareStrings)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function hashFingerprint(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")}`;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
  } else if (typeof value === "object" && value != null) {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      deepFreeze(entry);
    }
  }

  return Object.freeze(value);
}

function freezeMetadata(metadata?: CoordinationJsonObject): CoordinationJsonObject {
  return Object.freeze({ ...(metadata ?? {}) });
}

function freezeRecord(
  record: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record ?? {}).sort((left, right) =>
        compareStrings(left[0], right[0]),
      ),
    ),
  );
}

function normalizeLocale(locale: string): string {
  return locale.trim().toLowerCase();
}

function normalizeOptions(
  options?: MarketReportGenerationInput["options"],
): MarketReportGenerationOptions {
  const supportedLocales = Object.freeze(
    [...new Set([...(options?.supportedLocales ?? DEFAULT_GENERATION_OPTIONS.supportedLocales)].map(normalizeLocale))]
      .sort(compareStrings),
  );
  const completenessPolicy = Object.freeze({
    ...DEFAULT_COMPLETENESS_POLICY,
    ...(options?.completenessPolicy ?? {}),
    allowPartialReport:
      options?.strictCompleteness === true
        ? false
        : (options?.completenessPolicy?.allowPartialReport ??
          DEFAULT_COMPLETENESS_POLICY.allowPartialReport),
  });

  return Object.freeze({
    includeMethodology:
      options?.includeMethodology ?? DEFAULT_GENERATION_OPTIONS.includeMethodology,
    includeConfidence:
      options?.includeConfidence ?? DEFAULT_GENERATION_OPTIONS.includeConfidence,
    includeFreshness:
      options?.includeFreshness ?? DEFAULT_GENERATION_OPTIONS.includeFreshness,
    includeLineage:
      options?.includeLineage ?? DEFAULT_GENERATION_OPTIONS.includeLineage,
    strictCompleteness:
      options?.strictCompleteness ?? DEFAULT_GENERATION_OPTIONS.strictCompleteness,
    targetChannel:
      options?.targetChannel?.trim() || DEFAULT_GENERATION_OPTIONS.targetChannel,
    supportedLocales,
    requiredSections: Object.freeze(
      [...new Set(options?.requiredSections ?? DEFAULT_GENERATION_OPTIONS.requiredSections)],
    ),
    completenessPolicy,
    metadata: freezeMetadata(options?.metadata),
  });
}

function buildDiagnostic(
  input: Readonly<{
    code: MarketReportDiagnosticCode;
    severity: MarketReportDiagnosticSeverity;
    message: string;
    reportKey?: string | null;
    assetKey?: string | null;
    sectionType?: MarketReportSectionType | null;
    metadata?: CoordinationJsonObject;
  }>,
): MarketReportGenerationDiagnostic {
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    reportKey: input.reportKey ?? null,
    assetKey: input.assetKey ?? null,
    sectionType: input.sectionType ?? null,
    metadata: freezeMetadata(input.metadata),
  });
}

function assertCanonicalTimestamp(
  value: string,
  operation: string,
  path: string,
): void {
  if (!isCanonicalIsoTimestamp(value)) {
    throw new MarketReportGenerationError({
      code: "invalid_input",
      operation,
      path,
      message: `${path} must be a canonical ISO timestamp.`,
    });
  }
}

function assertJsonSafeMetadata(
  value: CoordinationJsonObject,
  operation: string,
  path: string,
): void {
  if (!isJsonSafe(value)) {
    throw new MarketReportGenerationError({
      code: "invalid_input",
      operation,
      path,
      message: `${path} must be JSON-safe.`,
    });
  }
}

function sanitizeSlugSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function capitalize(value: string): string {
  return value.length === 0
    ? value
    : value.charAt(0).toUpperCase() + value.slice(1);
}

function buildCanonicalPath(slug: string): string {
  return `/reports/${slug}`;
}

function buildCanonicalUrl(
  canonicalBaseUrl: string | null | undefined,
  canonicalPath: string,
): string | null {
  if (!isNonEmptyString(canonicalBaseUrl)) {
    return null;
  }

  const parsed = new URL(canonicalBaseUrl.trim());
  parsed.pathname = canonicalPath;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function mapOverviewConfidence(value: string): RegistryConfidenceBand {
  switch (value.trim().toLowerCase()) {
    case "high":
      return "high";
    case "standard":
      return "moderate";
    case "low":
      return "low";
    default:
      return "unknown";
  }
}

function mapVisibleFreshnessStatus(
  freshness: RegistryFreshnessState | null,
): MarketReportFreshnessStatus {
  if (freshness == null) {
    return "unknown";
  }
  if (freshness.isExpired) {
    return "expired";
  }
  if (freshness.isStale) {
    return "stale";
  }
  if (freshness.staleAfter != null && freshness.computedAt !== freshness.staleAfter) {
    return "aging";
  }
  return "fresh";
}

function pickWorstConfidence(
  values: readonly RegistryConfidenceBand[],
): RegistryConfidenceBand | "unknown" {
  const weights: Readonly<Record<RegistryConfidenceBand | "unknown", number>> =
    Object.freeze({
      unknown: 0,
      low: 1,
      moderate: 2,
      high: 3,
      very_high: 4,
    });
  let selected: RegistryConfidenceBand | "unknown" = "unknown";
  for (const value of values) {
    if (weights[value] < weights[selected] || selected === "unknown") {
      selected = value;
    }
  }
  return selected;
}

function pickWorstFreshness(
  values: readonly MarketReportFreshnessStatus[],
): MarketReportFreshnessStatus {
  const weights: Readonly<Record<MarketReportFreshnessStatus, number>> =
    Object.freeze({
      fresh: 0,
      aging: 1,
      stale: 2,
      expired: 3,
      unknown: 4,
    });
  let selected: MarketReportFreshnessStatus = "unknown";
  for (const value of values) {
    if (selected === "unknown" || weights[value] > weights[selected]) {
      selected = value;
    }
  }
  return selected;
}

function assertNoPrivateFields(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertNoPrivateFields(value[index], `${path}[${index}]`);
    }
    return;
  }

  if (typeof value !== "object" || value == null) {
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const nextPath = path.length === 0 ? key : `${path}.${key}`;
    if (PRIVATE_KEY_DENYLIST.has(normalizedKey)) {
      throw new MarketReportGenerationError({
        code: "privacy_violation",
        operation: "assertNoPrivateFields",
        path: nextPath,
        message: `Forbidden private field detected at ${nextPath}.`,
      });
    }
    assertNoPrivateFields(child, nextPath);
  }
}

function getLocalizationBundle(locale: string): LocalizationBundle {
  if (locale === "fr") {
    return Object.freeze({
      locale: "fr",
      sectionTitles: Object.freeze({
        executive_summary: "Résumé exécutif",
        market_overview: "Vue d'ensemble du marché",
        pricing_benchmark: "Benchmark de prix",
        occupancy_benchmark: "Benchmark d'occupation",
        confidence: "Confiance",
        freshness: "Fraîcheur des données",
        methodology: "Méthodologie",
        sources: "Sources",
      }),
      sectionMissingLabel: "Donnée non disponible",
      titleBuilder: ({ platform, city }) =>
        `Rapport de marché ${capitalize(platform)} ${city}`,
      descriptionBuilder: ({ platform, city, periodLabel, hasOccupancy }) =>
        `Rapport de marché ${capitalize(platform)} pour ${city} avec ${
          hasOccupancy ? "prix, occupation et contexte de marché" : "prix et contexte de marché"
        } agrégés pour ${periodLabel}.`,
      executiveSummary: ({
        city,
        platform,
        currency,
        pricingMedian,
        pricingCapturePeriod,
        occupancyBand,
        confidenceLabel,
      }) =>
        [
          `Le marché ${capitalize(platform)} de ${city}`,
          pricingMedian == null || currency == null
            ? "présente des signaux publics agrégés"
            : `affiche une médiane observée de ${pricingMedian} ${currency}`,
          pricingCapturePeriod == null ? null : `sur ${pricingCapturePeriod}`,
          occupancyBand == null
            ? null
            : `avec un signal d'occupation centré sur la bande ${occupancyBand.replace(/_/g, "-")}`,
          `et un niveau de confiance ${confidenceLabel.toLowerCase()}.`,
        ]
          .filter((part): part is string => part != null)
          .join(" "),
      methodologyBullets: Object.freeze([
        "Les métriques proviennent d'actifs publics agrégés et versionnés.",
        "Aucune annonce individuelle, URL privée ou donnée client n'est exposée dans ce rapport.",
        "Certaines métriques sont exprimées en bandes pour préserver la confidentialité et refléter la nature agrégée du signal.",
        "Les résultats dépendent de la période capturée et peuvent évoluer à mesure que les signaux du marché changent.",
      ]),
      methodologyDisclaimer:
        "Ce rapport est une aide à la décision et ne constitue pas une garantie de revenu ou de performance.",
      confidenceLabels: Object.freeze({
        unknown: "inconnue",
        low: "faible",
        moderate: "standard",
        high: "élevée",
        very_high: "très élevée",
      }),
      freshnessLabels: Object.freeze({
        fresh: "fraîche",
        aging: "en vieillissement",
        stale: "ancienne",
        expired: "expirée",
        unknown: "inconnue",
      }),
      pricingMedianLabel: "Médiane",
      priceRangeLabel: "Fourchette",
      occupancySignalLabel: "Signal d'occupation",
      capturePeriodLabel: "Période",
      sampleLabel: "Échantillon",
      sourceDiversityLabel: "Diversité des sources",
      freshnessEvaluatedLabel: "Évalué le",
      lineageNote:
        "Les références ci-dessous décrivent uniquement des artefacts publics agrégés.",
      sourceNotesTitle: "Notes de source",
      marketOverviewSummary: ({ median, currency, sampleBand }) =>
        median == null || currency == null
          ? "Vue d'ensemble publique agrégée du marché."
          : `Le centre du marché observé se situe autour de ${median} ${currency} avec un échantillon ${sampleBand ?? "non documenté"}.`,
      pricingSummary: ({ median, currency, confidenceLabel }) =>
        median == null || currency == null
          ? "Les signaux de prix sont incomplets."
          : `Les prix agrégés placent la médiane observée à ${median} ${currency} avec une confiance ${confidenceLabel.toLowerCase()}.`,
      occupancySummary: ({ unavailabilityBand, observedBand, confidenceLabel }) =>
        unavailabilityBand == null && observedBand == null
          ? "Les signaux d'occupation sont incomplets."
          : `Le signal d'occupation s'appuie sur la bande ${unavailabilityBand ?? "inconnue"} et une observation ${observedBand ?? "inconnue"}, avec une confiance ${confidenceLabel.toLowerCase()}.`,
      confidenceSummary: ({ reportConfidenceLabel }) =>
        `La confiance visible du rapport est ${reportConfidenceLabel.toLowerCase()}.`,
      freshnessSummary: ({ freshnessLabel }) =>
        `Le statut de fraîcheur visible est ${freshnessLabel.toLowerCase()}.`,
      sourcesSummary:
        "Les sources ci-dessous correspondent aux artefacts publics agrégés utilisés pour produire ce rapport.",
    });
  }

  return Object.freeze({
    locale: "en",
    sectionTitles: Object.freeze({
      executive_summary: "Executive summary",
      market_overview: "Market overview",
      pricing_benchmark: "Pricing benchmark",
      occupancy_benchmark: "Occupancy benchmark",
      confidence: "Confidence",
      freshness: "Freshness",
      methodology: "Methodology",
      sources: "Sources",
    }),
    sectionMissingLabel: "Data unavailable",
    titleBuilder: ({ platform, city }) =>
      `${capitalize(platform)} Market Report ${city}`,
    descriptionBuilder: ({ platform, city, periodLabel, hasOccupancy }) =>
      `${capitalize(platform)} market report for ${city} with aggregated ${
        hasOccupancy ? "pricing, occupancy and market context" : "pricing and market context"
      } for ${periodLabel}.`,
    executiveSummary: ({
      city,
      platform,
      currency,
      pricingMedian,
      pricingCapturePeriod,
      occupancyBand,
      confidenceLabel,
    }) =>
      [
        `The ${capitalize(platform)} market in ${city}`,
        pricingMedian == null || currency == null
          ? "shows aggregated public-safe signals"
          : `shows an observed median of ${pricingMedian} ${currency}`,
        pricingCapturePeriod == null ? null : `for ${pricingCapturePeriod}`,
        occupancyBand == null
          ? null
          : `with an occupancy signal centered on the ${occupancyBand.replace(/_/g, "-")} band`,
        `and a ${confidenceLabel.toLowerCase()} confidence level.`,
      ]
        .filter((part): part is string => part != null)
        .join(" "),
    methodologyBullets: Object.freeze([
      "Metrics come from aggregated, versioned public-safe assets.",
      "No individual listing, private URL or client data is exposed in this report.",
      "Some metrics are represented as bands to preserve privacy and reflect the aggregated nature of the signal.",
      "Results depend on the captured period and may evolve as market signals change.",
    ]),
    methodologyDisclaimer:
      "This report is a decision-support artifact and not a guarantee of revenue or performance.",
    confidenceLabels: Object.freeze({
      unknown: "unknown",
      low: "low",
      moderate: "standard",
      high: "high",
      very_high: "very high",
    }),
    freshnessLabels: Object.freeze({
      fresh: "fresh",
      aging: "aging",
      stale: "stale",
      expired: "expired",
      unknown: "unknown",
    }),
    pricingMedianLabel: "Median",
    priceRangeLabel: "Range",
    occupancySignalLabel: "Occupancy signal",
    capturePeriodLabel: "Period",
    sampleLabel: "Sample",
    sourceDiversityLabel: "Source diversity",
    freshnessEvaluatedLabel: "Evaluated at",
    lineageNote:
      "The references below describe aggregated public-safe artifacts only.",
    sourceNotesTitle: "Source notes",
    marketOverviewSummary: ({ median, currency, sampleBand }) =>
      median == null || currency == null
        ? "Aggregated public market overview."
        : `The observed market center sits around ${median} ${currency} with a ${sampleBand ?? "undocumented"} sample band.`,
    pricingSummary: ({ median, currency, confidenceLabel }) =>
      median == null || currency == null
        ? "Pricing signals are incomplete."
        : `Aggregated pricing places the observed median at ${median} ${currency} with ${confidenceLabel.toLowerCase()} confidence.`,
    occupancySummary: ({ unavailabilityBand, observedBand, confidenceLabel }) =>
      unavailabilityBand == null && observedBand == null
        ? "Occupancy signals are incomplete."
        : `The occupancy signal uses the ${unavailabilityBand ?? "unknown"} band and ${observedBand ?? "unknown"} observation band, with ${confidenceLabel.toLowerCase()} confidence.`,
    confidenceSummary: ({ reportConfidenceLabel }) =>
      `The visible report confidence is ${reportConfidenceLabel.toLowerCase()}.`,
    freshnessSummary: ({ freshnessLabel }) =>
      `The visible freshness status is ${freshnessLabel.toLowerCase()}.`,
    sourcesSummary:
      "The sources below correspond to the aggregated public-safe artifacts used to generate this report.",
  });
}

function buildReportDefinitionFromSnapshot(
  input: Readonly<{
    asset: RegistryAsset;
    version: RegistryAssetVersion;
    content: ReportContentSnapshot;
    locale: string;
  }>,
): MarketReportDefinition {
  const metadata = input.asset.metadata as Record<string, unknown>;
  const versionMetadata = input.version.metadata as Record<string, unknown>;
  const occupancyFingerprint =
    typeof metadata.occupancyFingerprint === "string"
      ? metadata.occupancyFingerprint
      : null;

  return parseMarketReportDefinition({
    reportId:
      typeof versionMetadata.reportId === "string"
        ? versionMetadata.reportId
        : input.content.reportId,
    marketCellKey:
      typeof metadata.marketCellKey === "string"
        ? metadata.marketCellKey
        : input.content.marketCellKey,
    city: typeof metadata.city === "string" ? metadata.city : input.content.city,
    country:
      typeof metadata.country === "string"
        ? metadata.country
        : input.content.country,
    platform: input.content.platform,
    propertyType: input.content.propertyType,
    language: input.locale,
    title:
      typeof versionMetadata.title === "string"
        ? versionMetadata.title
        : input.content.title,
    slug:
      typeof versionMetadata.slug === "string"
        ? versionMetadata.slug
        : input.content.slug,
    reportVersion: input.version.versionNumber,
    benchmarkFingerprint: input.content.benchmarkFingerprint,
    overviewFingerprint: input.content.overviewFingerprint,
    policyVersions: input.version.policyVersions,
    createdAt: input.asset.createdAt,
    updatedAt: input.asset.updatedAt,
    metadata: freezeMetadata(
      occupancyFingerprint == null
        ? {}
        : { occupancyFingerprint },
    ),
  });
}

function validatePricingContentSnapshot(
  value: unknown,
  assetKey: string,
): PricingContentSnapshot {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new MarketReportGenerationError({
      code: "mapping_error",
      operation: "validatePricingContentSnapshot",
      assetKey,
      message: `Pricing content snapshot is missing for ${assetKey}.`,
    });
  }

  const candidate = value as Record<string, unknown>;
  const distribution = candidate.distribution as Record<string, unknown>;
  const sample = candidate.sample as Record<string, unknown>;
  if (
    candidate.benchmarkType !== "pricing_distribution" ||
    !isNonEmptyString(candidate.currency) ||
    !isNonEmptyString(candidate.capturePeriodBucket) ||
    !isNonEmptyString(candidate.sourcePeriodStart) ||
    !isNonEmptyString(candidate.sourcePeriodEnd) ||
    typeof distribution !== "object" ||
    distribution == null ||
    typeof sample !== "object" ||
    sample == null
  ) {
    throw new MarketReportGenerationError({
      code: "mapping_error",
      operation: "validatePricingContentSnapshot",
      assetKey,
      message: `Pricing content snapshot is malformed for ${assetKey}.`,
    });
  }

  return deepFreeze({
    benchmarkType: "pricing_distribution",
    currency: candidate.currency.trim(),
    capturePeriodBucket: candidate.capturePeriodBucket.trim(),
    sourcePeriodStart: candidate.sourcePeriodStart.trim(),
    sourcePeriodEnd: candidate.sourcePeriodEnd.trim(),
    distribution: {
      p10: Number(distribution.p10),
      p25: Number(distribution.p25),
      median: Number(distribution.median),
      p75: Number(distribution.p75),
      p90: Number(distribution.p90),
    },
    sample: {
      raw: Number(sample.raw),
      included: Number(sample.included),
      excludedOutliers: Number(sample.excludedOutliers),
      sourceClassCount: Number(sample.sourceClassCount),
      sourceDiversityBand: String(sample.sourceDiversityBand),
    },
    approvalStatus: String(candidate.approvalStatus ?? ""),
    confidenceLevel: String(candidate.confidenceLevel ?? ""),
    limitations: Object.freeze(
      Array.isArray(candidate.limitations)
        ? candidate.limitations.map((item) => String(item)).sort(compareStrings)
        : [],
    ),
  });
}

function validateOccupancyContentSnapshot(
  value: unknown,
  assetKey: string,
): OccupancyContentSnapshot {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new MarketReportGenerationError({
      code: "mapping_error",
      operation: "validateOccupancyContentSnapshot",
      assetKey,
      message: `Occupancy content snapshot is missing for ${assetKey}.`,
    });
  }

  const candidate = value as Record<string, unknown>;
  const sample = candidate.sample as Record<string, unknown>;
  const observed = candidate.observedDaysCounts as Record<string, unknown>;
  const unavailability = candidate.unavailabilityRateCounts as Record<
    string,
    unknown
  >;
  if (
    candidate.benchmarkType !== "occupancy_distribution" ||
    !isNonEmptyString(candidate.capturePeriodBucket) ||
    !isNonEmptyString(candidate.sourcePeriodStart) ||
    !isNonEmptyString(candidate.sourcePeriodEnd) ||
    !isNonEmptyString(candidate.dominantObservedDaysBand) ||
    !isNonEmptyString(candidate.dominantUnavailabilityRateBand) ||
    typeof sample !== "object" ||
    sample == null ||
    typeof observed !== "object" ||
    observed == null ||
    typeof unavailability !== "object" ||
    unavailability == null
  ) {
    throw new MarketReportGenerationError({
      code: "mapping_error",
      operation: "validateOccupancyContentSnapshot",
      assetKey,
      message: `Occupancy content snapshot is malformed for ${assetKey}.`,
    });
  }

  return deepFreeze({
    benchmarkType: "occupancy_distribution",
    capturePeriodBucket: candidate.capturePeriodBucket.trim(),
    sourcePeriodStart: candidate.sourcePeriodStart.trim(),
    sourcePeriodEnd: candidate.sourcePeriodEnd.trim(),
    dominantObservedDaysBand: candidate.dominantObservedDaysBand.trim(),
    dominantUnavailabilityRateBand:
      candidate.dominantUnavailabilityRateBand.trim(),
    observedDaysCounts: Object.freeze(
      Object.fromEntries(
        Object.entries(observed)
          .map(
            ([key, entry]): readonly [string, number] => [key, Number(entry)],
          )
          .sort((left, right) => compareStrings(left[0], right[0])),
      ),
    ),
    unavailabilityRateCounts: Object.freeze(
      Object.fromEntries(
        Object.entries(unavailability)
          .map(
            ([key, entry]): readonly [string, number] => [key, Number(entry)],
          )
          .sort((left, right) => compareStrings(left[0], right[0])),
      ),
    ),
    sample: {
      raw: Number(sample.raw),
      included: Number(sample.included),
      excludedOutliers: Number(sample.excludedOutliers),
      sourceClassCount: Number(sample.sourceClassCount),
      sourceDiversityBand: String(sample.sourceDiversityBand),
    },
    approvalStatus: String(candidate.approvalStatus ?? ""),
    confidenceLevel: String(candidate.confidenceLevel ?? ""),
    limitations: Object.freeze(
      Array.isArray(candidate.limitations)
        ? candidate.limitations.map((item) => String(item)).sort(compareStrings)
        : [],
    ),
  });
}

function validateOverviewContentSnapshot(
  value: unknown,
  assetKey: string,
): OverviewContentSnapshot {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new MarketReportGenerationError({
      code: "mapping_error",
      operation: "validateOverviewContentSnapshot",
      assetKey,
      message: `Overview content snapshot is missing for ${assetKey}.`,
    });
  }

  const candidate = value as Record<string, unknown>;
  const distribution = candidate.distribution as Record<string, unknown>;
  if (
    candidate.benchmarkType !== "public_market_overview" ||
    !isNonEmptyString(candidate.aggregationWindow) ||
    !isNonEmptyString(candidate.platformScope) ||
    !isNonEmptyString(candidate.propertyScope) ||
    !isNonEmptyString(candidate.capacityScope) ||
    !isNonEmptyString(candidate.currency) ||
    !isNonEmptyString(candidate.capturePeriodBucket) ||
    !isNonEmptyString(candidate.windowStartedAt) ||
    !isNonEmptyString(candidate.windowEndedAt) ||
    typeof distribution !== "object" ||
    distribution == null
  ) {
    throw new MarketReportGenerationError({
      code: "mapping_error",
      operation: "validateOverviewContentSnapshot",
      assetKey,
      message: `Overview content snapshot is malformed for ${assetKey}.`,
    });
  }

  return deepFreeze({
    benchmarkType: "public_market_overview",
    aggregationWindow: candidate.aggregationWindow.trim(),
    platformScope: candidate.platformScope.trim(),
    propertyScope: candidate.propertyScope.trim(),
    capacityScope: candidate.capacityScope.trim(),
    currency: candidate.currency.trim(),
    capturePeriodBucket: candidate.capturePeriodBucket.trim(),
    windowStartedAt: candidate.windowStartedAt.trim(),
    windowEndedAt: candidate.windowEndedAt.trim(),
    distribution: {
      p25: Number(distribution.p25),
      median: Number(distribution.median),
      p75: Number(distribution.p75),
    },
    sampleBand: String(candidate.sampleBand ?? ""),
    confidence: String(candidate.confidence ?? ""),
    freshnessStatus: String(candidate.freshnessStatus ?? ""),
    exposureStatus: String(candidate.exposureStatus ?? ""),
    limitations: Object.freeze(
      Array.isArray(candidate.limitations)
        ? candidate.limitations.map((item) => String(item)).sort(compareStrings)
        : [],
    ),
  });
}

function validateReportContentSnapshot(
  value: unknown,
  assetKey: string,
): ReportContentSnapshot {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new MarketReportGenerationError({
      code: "mapping_error",
      operation: "validateReportContentSnapshot",
      assetKey,
      message: `Report content snapshot is missing for ${assetKey}.`,
    });
  }

  const candidate = value as Record<string, unknown>;
  for (const field of [
    "reportId",
    "marketCellKey",
    "city",
    "country",
    "platform",
    "propertyType",
    "language",
    "title",
    "slug",
    "benchmarkFingerprint",
    "overviewFingerprint",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      throw new MarketReportGenerationError({
        code: "mapping_error",
        operation: "validateReportContentSnapshot",
        assetKey,
        message: `Report content snapshot field ${field} is malformed for ${assetKey}.`,
      });
    }
  }

  return deepFreeze({
    reportId: String(candidate.reportId).trim(),
    marketCellKey: String(candidate.marketCellKey).trim(),
    city: String(candidate.city).trim(),
    country: String(candidate.country).trim(),
    platform: String(candidate.platform).trim(),
    propertyType: String(candidate.propertyType).trim(),
    language: String(candidate.language).trim(),
    title: String(candidate.title).trim(),
    slug: String(candidate.slug).trim(),
    benchmarkFingerprint: String(candidate.benchmarkFingerprint).trim(),
    overviewFingerprint: String(candidate.overviewFingerprint).trim(),
  });
}

function extractContentSnapshot(
  version: RegistryAssetVersion,
  assetKey: string,
): CoordinationJsonObject {
  const metadata = version.metadata as Record<string, unknown>;
  const contentSnapshot = metadata.contentSnapshot;
  if (
    typeof contentSnapshot !== "object" ||
    contentSnapshot == null ||
    Array.isArray(contentSnapshot)
  ) {
    throw new MarketReportGenerationError({
      code: "mapping_error",
      operation: "extractContentSnapshot",
      assetKey,
      message:
        `Asset version ${version.assetVersionId} does not expose a public content snapshot.`,
    });
  }

  if (!isJsonSafe(contentSnapshot)) {
    throw new MarketReportGenerationError({
      code: "mapping_error",
      operation: "extractContentSnapshot",
      assetKey,
      message: `Asset version ${version.assetVersionId} content snapshot is not JSON-safe.`,
    });
  }

  return deepFreeze({
    ...(contentSnapshot as CoordinationJsonObject),
  });
}

function buildReferenceFingerprintSet(
  references: readonly RegistryArtifactReference[],
): ReadonlySet<string> {
  return new Set(
    references.map((reference) =>
      [
        reference.artifactType,
        reference.artifactId,
        reference.artifactFingerprint,
        reference.relationshipType,
      ].join("|"),
    ),
  );
}

function validateSameMarket(
  input: Readonly<{
    definition: MarketReportDefinition;
    asset: RegistryAsset;
    assetKind: string;
  }>,
): void {
  const metadata = input.asset.metadata as Record<string, unknown>;
  const city = typeof metadata.city === "string" ? metadata.city : null;
  const country = typeof metadata.country === "string" ? metadata.country : null;
  const platform =
    typeof metadata.platform === "string" ? metadata.platform : null;
  const propertyType =
    typeof metadata.propertyType === "string" ? metadata.propertyType : null;
  if (
    (city != null && city !== input.definition.city) ||
    (country != null && country !== input.definition.country) ||
    (platform != null && platform !== input.definition.platform) ||
    (propertyType != null && propertyType !== input.definition.propertyType)
  ) {
    throw new MarketReportGenerationError({
      code: "invalid_market_identity",
      operation: "validateSameMarket",
      assetKey: input.asset.assetId,
      marketCellKey: input.definition.marketCellKey,
      message:
        `Resolved ${input.assetKind} asset ${input.asset.assetId} belongs to another market.`,
    });
  }
}

function resolveReportAsset(
  snapshot: RegistrySnapshot,
  reportAssetKey: string,
): RegistryAsset {
  const direct = getRegistryAsset(snapshot, reportAssetKey);
  if (direct != null) {
    return direct;
  }

  const key = reportAssetKey.trim();
  const candidates = snapshot.assets
    .filter(
      (asset) =>
        asset.assetType === "market_report" &&
        (asset.canonicalId === key ||
          (asset.metadata as Record<string, unknown>).marketCellKey === key),
    )
    .sort((left, right) => compareStrings(left.assetId, right.assetId));

  if (candidates.length === 0) {
    throw new MarketReportGenerationError({
      code: "registry_resolution_error",
      operation: "resolveReportAsset",
      assetKey: key,
      message: `No market_report asset matches ${key}.`,
    });
  }

  return candidates[0];
}

function resolveInsightAssetByGroup(
  snapshot: RegistrySnapshot,
  input: Readonly<{
    assetKind: "market_pricing_benchmark" | "market_occupancy_benchmark" | "market_overview";
    definition: MarketReportDefinition;
  }>,
): RegistryAsset | null {
  const candidates = snapshot.assets
    .filter((asset) => {
      if (asset.assetType !== "insight_card") {
        return false;
      }
      const metadata = asset.metadata as Record<string, unknown>;
      if (metadata.assetKind !== input.assetKind) {
        return false;
      }
      if (
        metadata.platform !== input.definition.platform ||
        metadata.propertyType !== input.definition.propertyType
      ) {
        return false;
      }

      if (input.assetKind === "market_overview") {
        return (
          metadata.city === input.definition.city &&
          metadata.country === input.definition.country
        );
      }

      return metadata.marketCellKey === input.definition.marketCellKey;
    })
    .sort((left, right) => compareStrings(left.assetId, right.assetId));

  return candidates[0] ?? null;
}

function resolveInsightAssetByReference(
  snapshot: RegistrySnapshot,
  input: Readonly<{
    assetKind: "market_pricing_benchmark" | "market_occupancy_benchmark" | "market_overview";
    requiredArtifactIds: readonly string[];
    expectedFingerprint: string | null;
  }>,
): RegistryAsset | null {
  const candidates = snapshot.assets
    .filter((asset) => {
      if (asset.assetType !== "insight_card") {
        return false;
      }
      const metadata = asset.metadata as Record<string, unknown>;
      if (metadata.assetKind !== input.assetKind) {
        return false;
      }

      const lineage = getRegistryArtifactLineage(snapshot, asset.assetId);
      return lineage.some(
        (reference) =>
          input.requiredArtifactIds.includes(reference.artifactId) &&
          (input.expectedFingerprint == null ||
            reference.artifactFingerprint === input.expectedFingerprint),
      );
    })
    .sort((left, right) => compareStrings(left.assetId, right.assetId));

  return candidates[0] ?? null;
}

function buildResolutionDiagnostics(
  input: Readonly<{
    reportKey: string;
    reportAsset: RegistryAsset;
    reportReferences: readonly RegistryArtifactReference[];
    resolvedAsset: RegistryAsset;
    expectedAssetKind: string;
    expectedFingerprint: string | null;
    requiredArtifactIds: readonly string[];
  }>,
): readonly MarketReportGenerationDiagnostic[] {
  const diagnostics: MarketReportGenerationDiagnostic[] = [];
  const referenceSet = buildReferenceFingerprintSet(input.reportReferences);

  let matchedReference = false;
  for (const artifactId of input.requiredArtifactIds) {
    for (const reportReference of input.reportReferences) {
      if (
        reportReference.artifactId === artifactId &&
        (input.expectedFingerprint == null ||
          reportReference.artifactFingerprint === input.expectedFingerprint)
      ) {
        matchedReference = true;
        break;
      }
    }
    if (matchedReference) {
      break;
    }
  }

  if (!matchedReference) {
    diagnostics.push(
      buildDiagnostic({
        code: "invalid_lineage",
        severity: "warning",
        message:
          `The report asset lineage does not explicitly reference the resolved ${input.expectedAssetKind} asset.`,
        reportKey: input.reportKey,
        assetKey: input.resolvedAsset.assetId,
        metadata: freezeMetadata({
          expectedAssetKind: input.expectedAssetKind,
        }),
      }),
    );
  }

  if (input.resolvedAsset.status === "suppressed") {
    diagnostics.push(
      buildDiagnostic({
        code: "non_publishable_asset",
        severity: "warning",
        message: `Resolved ${input.expectedAssetKind} asset is suppressed.`,
        reportKey: input.reportKey,
        assetKey: input.resolvedAsset.assetId,
      }),
    );
  }

  if (referenceSet.size === 0) {
    diagnostics.push(
      buildDiagnostic({
        code: "invalid_lineage",
        severity: "warning",
        message: "The report asset has no explicit lineage references.",
        reportKey: input.reportKey,
        assetKey: input.reportAsset.assetId,
      }),
    );
  }

  return Object.freeze(diagnostics);
}

function buildRequiredArtifactIdsForInsight(
  input: Readonly<{
    definition: MarketReportDefinition;
    assetKind: "market_pricing_benchmark" | "market_occupancy_benchmark" | "market_overview";
  }>,
): readonly string[] {
  switch (input.assetKind) {
    case "market_pricing_benchmark":
      return Object.freeze([
        `benchmark:${input.definition.marketCellKey}:pricing`,
      ]);
    case "market_occupancy_benchmark":
      return Object.freeze([
        `benchmark:${input.definition.marketCellKey}:occupancy`,
      ]);
    case "market_overview":
      return Object.freeze([
        `overview:${input.definition.country}:${input.definition.city}:${input.definition.platform}:${input.definition.propertyType}`,
      ]);
  }
}

function buildAssetResolution<TContent extends CoordinationJsonObject>(
  input: Readonly<{
    snapshot: RegistrySnapshot;
    definition: MarketReportDefinition;
    reportKey: string;
    reportAsset: RegistryAsset;
    reportReferences: readonly RegistryArtifactReference[];
    assetKind: "market_pricing_benchmark" | "market_occupancy_benchmark" | "market_overview";
    validateContent: (value: unknown, assetKey: string) => TContent;
    expectedFingerprint: string | null;
  }>,
): Readonly<{
  resolved: MarketReportResolvedInsightAsset<TContent> | null;
  diagnostics: readonly MarketReportGenerationDiagnostic[];
}> {
  const asset = resolveInsightAssetByGroup(input.snapshot, {
    assetKind: input.assetKind,
    definition: input.definition,
  });
  const requiredArtifactIds = buildRequiredArtifactIdsForInsight({
    definition: input.definition,
    assetKind: input.assetKind,
  });
  const referenceAsset = resolveInsightAssetByReference(input.snapshot, {
    assetKind: input.assetKind,
    requiredArtifactIds,
    expectedFingerprint: input.expectedFingerprint,
  });
  const resolvedMode: MarketReportResolutionMode =
    referenceAsset != null ? "reference" : "group_match";
  const resolvedAsset = referenceAsset ?? asset;
  if (resolvedAsset == null) {
    return Object.freeze({
      resolved: null,
      diagnostics: Object.freeze([
        buildDiagnostic({
          code:
            input.assetKind === "market_pricing_benchmark"
              ? "pricing_asset_missing"
              : input.assetKind === "market_occupancy_benchmark"
                ? "occupancy_asset_missing"
                : "overview_asset_missing",
          severity: "warning",
          message: `No ${input.assetKind} asset matches ${input.definition.marketCellKey}.`,
          reportKey: input.reportKey,
          assetKey: input.reportAsset.assetId,
        }),
      ]),
    });
  }

  validateSameMarket({
    definition: input.definition,
    asset: resolvedAsset,
    assetKind: input.assetKind,
  });
  const version = getActiveRegistryVersion(input.snapshot, resolvedAsset.assetId);
  if (version == null) {
    throw new MarketReportGenerationError({
      code: "invalid_asset_version",
      operation: "buildAssetResolution",
      reportKey: input.reportKey,
      assetKey: resolvedAsset.assetId,
      marketCellKey: input.definition.marketCellKey,
      message: `Resolved asset ${resolvedAsset.assetId} has no active version.`,
    });
  }

  const content = input.validateContent(
    extractContentSnapshot(version, resolvedAsset.assetId),
    resolvedAsset.assetId,
  );
  const diagnostics = buildResolutionDiagnostics({
    reportKey: input.reportKey,
    reportAsset: input.reportAsset,
    reportReferences: input.reportReferences,
    resolvedAsset,
    expectedAssetKind: input.assetKind,
    expectedFingerprint: input.expectedFingerprint,
    requiredArtifactIds,
  });

  return Object.freeze({
    resolved: deepFreeze({
      asset: resolvedAsset,
      version,
      content,
      freshness: getRegistryFreshnessState(
        input.snapshot,
        resolvedAsset.assetId,
        version.assetVersionId,
      ),
      lineage: getRegistryArtifactLineage(input.snapshot, resolvedAsset.assetId),
      publications: listRegistryPublicationsForAsset(
        input.snapshot,
        resolvedAsset.assetId,
        version.assetVersionId,
      ),
      variants: listRegistryVariantsForAsset(
        input.snapshot,
        resolvedAsset.assetId,
        version.assetVersionId,
      ),
      resolutionMode: resolvedMode,
    }),
    diagnostics,
  });
}

export function resolveMarketReportAssets(
  input: Readonly<{
    registrySnapshot: unknown;
    reportAssetKey: string;
    locale: string;
    options?: MarketReportGenerationInput["options"];
  }>,
): MarketReportResolvedAssets {
  if (!isNonEmptyString(input.reportAssetKey)) {
    throw new MarketReportGenerationError({
      code: "invalid_input",
      operation: "resolveMarketReportAssets",
      message: "reportAssetKey must be a non-empty string.",
    });
  }
  const locale = normalizeLocale(input.locale);
  const options = normalizeOptions(input.options);
  if (!options.supportedLocales.includes(locale)) {
    throw new MarketReportGenerationError({
      code: "unsupported_locale",
      operation: "resolveMarketReportAssets",
      message: `Locale ${locale} is not supported.`,
    });
  }

  const snapshot = parseRegistrySnapshot(input.registrySnapshot);
  assertRegistrySnapshotPublicSafe(snapshot);
  assertNoPrivateFields(snapshot, "snapshot");

  const reportAsset = resolveReportAsset(snapshot, input.reportAssetKey);
  const reportVersion = getActiveRegistryVersion(snapshot, reportAsset.assetId);
  if (reportVersion == null) {
    throw new MarketReportGenerationError({
      code: "invalid_asset_version",
      operation: "resolveMarketReportAssets",
      assetKey: reportAsset.assetId,
      message: `Market report asset ${reportAsset.assetId} has no active version.`,
    });
  }

  const reportContent = validateReportContentSnapshot(
    extractContentSnapshot(reportVersion, reportAsset.assetId),
    reportAsset.assetId,
  );
  const reportDefinition = buildReportDefinitionFromSnapshot({
    asset: reportAsset,
    version: reportVersion,
    content: reportContent,
    locale,
  });
  const reportKey = `report:${reportDefinition.marketCellKey}:${locale}`;
  const reportLineage = getRegistryArtifactLineage(snapshot, reportAsset.assetId);
  const reportFreshness = getRegistryFreshnessState(
    snapshot,
    reportAsset.assetId,
    reportVersion.assetVersionId,
  );

  const pricing = buildAssetResolution({
    snapshot,
    definition: reportDefinition,
    reportKey,
    reportAsset,
    reportReferences: reportLineage,
    assetKind: "market_pricing_benchmark",
    validateContent: validatePricingContentSnapshot,
    expectedFingerprint: reportDefinition.benchmarkFingerprint,
  });
  const overview = buildAssetResolution({
    snapshot,
    definition: reportDefinition,
    reportKey,
    reportAsset,
    reportReferences: reportLineage,
    assetKind: "market_overview",
    validateContent: validateOverviewContentSnapshot,
    expectedFingerprint: reportDefinition.overviewFingerprint,
  });
  const occupancyFingerprint =
    typeof reportDefinition.metadata.occupancyFingerprint === "string"
      ? reportDefinition.metadata.occupancyFingerprint
      : null;
  const occupancy = buildAssetResolution({
    snapshot,
    definition: reportDefinition,
    reportKey,
    reportAsset,
    reportReferences: reportLineage,
    assetKind: "market_occupancy_benchmark",
    validateContent: validateOccupancyContentSnapshot,
    expectedFingerprint: occupancyFingerprint,
  });

  const diagnostics = [
    ...pricing.diagnostics,
    ...overview.diagnostics,
    ...occupancy.diagnostics,
  ];

  return deepFreeze({
    reportAsset,
    reportVersion,
    reportDefinition,
    reportContent,
    reportFreshness,
    reportLineage,
    reportPublications: listRegistryPublicationsForAsset(
      snapshot,
      reportAsset.assetId,
      reportVersion.assetVersionId,
    ),
    reportVariants: listRegistryVariantsForAsset(
      snapshot,
      reportAsset.assetId,
      reportVersion.assetVersionId,
    ),
    pricing: pricing.resolved,
    occupancy: occupancy.resolved,
    overview: overview.resolved,
    diagnostics: Object.freeze(diagnostics),
  });
}

function buildIdentity(
  input: Readonly<{
    definition: MarketReportDefinition;
    reportAsset: RegistryAsset;
    reportVersion: RegistryAssetVersion;
    locale: string;
    canonicalBaseUrl?: string | null;
    capacityBand: string | null;
  }>,
): MarketReportIdentity {
  const slug =
    isNonEmptyString(input.reportAsset.canonicalId)
      ? input.reportAsset.canonicalId
      : input.definition.slug;
  const canonicalPath = buildCanonicalPath(slug);
  return deepFreeze({
    reportId: input.definition.reportId,
    reportKey: `report:${input.definition.marketCellKey}:${input.locale}`,
    assetKey: input.reportAsset.assetId,
    assetVersionId: input.reportVersion.assetVersionId,
    marketCellKey: input.definition.marketCellKey,
    country: input.definition.country,
    countryCode: input.definition.country.trim().toLowerCase(),
    city: input.definition.city,
    citySlug: sanitizeSlugSegment(input.definition.city),
    platform: input.definition.platform,
    propertyType: input.definition.propertyType,
    capacityBand: input.capacityBand,
    locale: input.locale,
    reportSlug: slug,
    canonicalPath,
    canonicalUrl: buildCanonicalUrl(input.canonicalBaseUrl, canonicalPath),
  });
}

function buildPeriod(
  resolved: MarketReportResolvedAssets,
): MarketReportPeriod {
  const capturePeriodBucket =
    resolved.pricing?.content.capturePeriodBucket ??
    resolved.overview?.content.capturePeriodBucket ??
    resolved.occupancy?.content.capturePeriodBucket ??
    null;
  const sourcePeriodStart =
    resolved.pricing?.content.sourcePeriodStart ??
    resolved.occupancy?.content.sourcePeriodStart ??
    null;
  const sourcePeriodEnd =
    resolved.pricing?.content.sourcePeriodEnd ??
    resolved.occupancy?.content.sourcePeriodEnd ??
    null;
  const windowStartedAt = resolved.overview?.content.windowStartedAt ?? null;
  const windowEndedAt = resolved.overview?.content.windowEndedAt ?? null;

  return deepFreeze({
    capturePeriodBucket,
    sourcePeriodStart,
    sourcePeriodEnd,
    windowStartedAt,
    windowEndedAt,
    label:
      capturePeriodBucket ??
      (windowStartedAt != null && windowEndedAt != null
        ? `${windowStartedAt} -> ${windowEndedAt}`
        : "undocumented_period"),
  });
}

function buildDataPoint(
  key: string,
  label: string,
  value: string | number | boolean | null,
  unit?: string | null,
  metadata?: CoordinationJsonObject,
): MarketReportDataPoint {
  return deepFreeze({
    key,
    label,
    value,
    unit: unit ?? null,
    metadata: freezeMetadata(metadata),
  });
}

function buildSection(
  input: Readonly<{
    sectionType: MarketReportSectionType;
    order: number;
    title: string;
    summary: string | null;
    content: CoordinationJsonObject;
    dataPoints: readonly MarketReportDataPoint[];
    diagnostics?: readonly MarketReportGenerationDiagnostic[];
  }>,
): MarketReportSection {
  const sectionId = `${input.sectionType}_${input.order}`;
  const visibleProjection = {
    sectionType: input.sectionType,
    order: input.order,
    title: input.title,
    summary: input.summary,
    content: input.content,
    dataPoints: input.dataPoints,
  };

  return deepFreeze({
    sectionId,
    sectionType: input.sectionType,
    order: input.order,
    title: input.title,
    summary: input.summary,
    content: freezeMetadata(input.content),
    dataPoints: Object.freeze([...input.dataPoints]),
    diagnostics: Object.freeze([...(input.diagnostics ?? [])]),
    contentFingerprint: hashFingerprint("ipp_market_report_section", visibleProjection),
  });
}

function buildMissingSection(
  input: Readonly<{
    sectionType: MarketReportSectionType;
    order: number;
    localization: LocalizationBundle;
    diagnostic: MarketReportGenerationDiagnostic;
  }>,
): MarketReportSection {
  return buildSection({
    sectionType: input.sectionType,
    order: input.order,
    title: input.localization.sectionTitles[input.sectionType],
    summary: input.localization.sectionMissingLabel,
    content: freezeMetadata({
      status: "missing",
    }),
    dataPoints: Object.freeze([]),
    diagnostics: Object.freeze([input.diagnostic]),
  });
}

function buildExecutiveSummarySection(
  resolved: MarketReportResolvedAssets,
  localization: LocalizationBundle,
  confidence: MarketReportConfidence | null,
): MarketReportSection {
  const median = resolved.pricing?.content.distribution.median ?? null;
  const currency = resolved.pricing?.content.currency ?? null;
  const capturePeriod = resolved.pricing?.content.capturePeriodBucket ?? null;
  const occupancyBand =
    resolved.occupancy?.content.dominantUnavailabilityRateBand ?? null;
  const summary = localization.executiveSummary({
    city: resolved.reportDefinition.city,
    platform: resolved.reportDefinition.platform,
    currency,
    pricingMedian: median,
    pricingCapturePeriod: capturePeriod,
    occupancyBand,
    confidenceLabel:
      confidence?.label ??
      localization.confidenceLabels.unknown,
  });

  return buildSection({
    sectionType: "executive_summary",
    order: 0,
    title: localization.sectionTitles.executive_summary,
    summary,
    content: freezeMetadata({
      city: resolved.reportDefinition.city,
      platform: resolved.reportDefinition.platform,
      pricingMedian: median,
      currency,
      capturePeriod,
      occupancyBand,
      confidence: confidence?.band ?? "unknown",
    }),
    dataPoints: Object.freeze([
      buildDataPoint(
        "pricing_median",
        localization.pricingMedianLabel,
        median,
        currency,
      ),
      buildDataPoint(
        "occupancy_signal",
        localization.occupancySignalLabel,
        occupancyBand,
      ),
      buildDataPoint(
        "capture_period",
        localization.capturePeriodLabel,
        capturePeriod,
      ),
    ]),
  });
}

function buildMarketOverviewSection(
  overview: MarketReportResolvedInsightAsset<OverviewContentSnapshot>,
  localization: LocalizationBundle,
): MarketReportSection {
  return buildSection({
    sectionType: "market_overview",
    order: 1,
    title: localization.sectionTitles.market_overview,
    summary: localization.marketOverviewSummary({
      median: overview.content.distribution.median,
      currency: overview.content.currency,
      sampleBand: overview.content.sampleBand,
    }),
    content: freezeMetadata({
      distribution: overview.content.distribution,
      sampleBand: overview.content.sampleBand,
      confidence: overview.content.confidence,
      freshnessStatus: overview.content.freshnessStatus,
      capturePeriodBucket: overview.content.capturePeriodBucket,
      windowStartedAt: overview.content.windowStartedAt,
      windowEndedAt: overview.content.windowEndedAt,
    }),
    dataPoints: Object.freeze([
      buildDataPoint(
        "overview_p25",
        "P25",
        overview.content.distribution.p25,
        overview.content.currency,
      ),
      buildDataPoint(
        "overview_median",
        localization.pricingMedianLabel,
        overview.content.distribution.median,
        overview.content.currency,
      ),
      buildDataPoint(
        "overview_p75",
        "P75",
        overview.content.distribution.p75,
        overview.content.currency,
      ),
      buildDataPoint(
        "overview_sample_band",
        localization.sampleLabel,
        overview.content.sampleBand,
      ),
    ]),
  });
}

function buildPricingBenchmarkSection(
  pricing: MarketReportResolvedInsightAsset<PricingContentSnapshot>,
  localization: LocalizationBundle,
): MarketReportSection {
  const confidenceLabel =
    localization.confidenceLabels[
      pricing.version.confidenceBand as keyof typeof localization.confidenceLabels
    ] ?? pricing.version.confidenceBand;

  return buildSection({
    sectionType: "pricing_benchmark",
    order: 2,
    title: localization.sectionTitles.pricing_benchmark,
    summary: localization.pricingSummary({
      median: pricing.content.distribution.median,
      currency: pricing.content.currency,
      confidenceLabel,
    }),
    content: freezeMetadata({
      distribution: pricing.content.distribution,
      currency: pricing.content.currency,
      capturePeriodBucket: pricing.content.capturePeriodBucket,
      sourcePeriodStart: pricing.content.sourcePeriodStart,
      sourcePeriodEnd: pricing.content.sourcePeriodEnd,
      confidenceBand: pricing.version.confidenceBand,
      limitations: pricing.content.limitations,
    }),
    dataPoints: Object.freeze([
      buildDataPoint(
        "pricing_p25",
        "P25",
        pricing.content.distribution.p25,
        pricing.content.currency,
      ),
      buildDataPoint(
        "pricing_median",
        localization.pricingMedianLabel,
        pricing.content.distribution.median,
        pricing.content.currency,
      ),
      buildDataPoint(
        "pricing_p75",
        "P75",
        pricing.content.distribution.p75,
        pricing.content.currency,
      ),
      buildDataPoint(
        "pricing_sample",
        localization.sampleLabel,
        pricing.content.sample.included,
      ),
      buildDataPoint(
        "pricing_diversity",
        localization.sourceDiversityLabel,
        pricing.content.sample.sourceDiversityBand,
      ),
    ]),
  });
}

function buildOccupancyBenchmarkSection(
  occupancy: MarketReportResolvedInsightAsset<OccupancyContentSnapshot>,
  localization: LocalizationBundle,
): MarketReportSection {
  const confidenceLabel =
    localization.confidenceLabels[
      occupancy.version.confidenceBand as keyof typeof localization.confidenceLabels
    ] ?? occupancy.version.confidenceBand;

  return buildSection({
    sectionType: "occupancy_benchmark",
    order: 3,
    title: localization.sectionTitles.occupancy_benchmark,
    summary: localization.occupancySummary({
      unavailabilityBand:
        occupancy.content.dominantUnavailabilityRateBand,
      observedBand: occupancy.content.dominantObservedDaysBand,
      confidenceLabel,
    }),
    content: freezeMetadata({
      dominantObservedDaysBand: occupancy.content.dominantObservedDaysBand,
      dominantUnavailabilityRateBand:
        occupancy.content.dominantUnavailabilityRateBand,
      observedDaysCounts: occupancy.content.observedDaysCounts,
      unavailabilityRateCounts: occupancy.content.unavailabilityRateCounts,
      capturePeriodBucket: occupancy.content.capturePeriodBucket,
      sourcePeriodStart: occupancy.content.sourcePeriodStart,
      sourcePeriodEnd: occupancy.content.sourcePeriodEnd,
      limitations: occupancy.content.limitations,
    }),
    dataPoints: Object.freeze([
      buildDataPoint(
        "occupancy_observed_band",
        "Observed days band",
        occupancy.content.dominantObservedDaysBand,
      ),
      buildDataPoint(
        "occupancy_unavailability_band",
        localization.occupancySignalLabel,
        occupancy.content.dominantUnavailabilityRateBand,
      ),
      buildDataPoint(
        "occupancy_sample",
        localization.sampleLabel,
        occupancy.content.sample.included,
      ),
      buildDataPoint(
        "occupancy_diversity",
        localization.sourceDiversityLabel,
        occupancy.content.sample.sourceDiversityBand,
      ),
    ]),
  });
}

function buildConfidenceSection(
  confidence: MarketReportConfidence,
  localization: LocalizationBundle,
): MarketReportSection {
  return buildSection({
    sectionType: "confidence",
    order: 4,
    title: localization.sectionTitles.confidence,
    summary: localization.confidenceSummary({
      reportConfidenceLabel: confidence.label,
    }),
    content: freezeMetadata({
      band: confidence.band,
      label: confidence.label,
    }),
    dataPoints: confidence.signals,
  });
}

function buildFreshnessSection(
  freshness: MarketReportFreshness,
  localization: LocalizationBundle,
): MarketReportSection {
  return buildSection({
    sectionType: "freshness",
    order: 5,
    title: localization.sectionTitles.freshness,
    summary: localization.freshnessSummary({
      freshnessLabel: freshness.label,
    }),
    content: freezeMetadata({
      status: freshness.status,
      assets: freshness.assets.map((asset) => ({
        assetKind: asset.assetKind,
        status: asset.status,
        computedAt: asset.computedAt,
        staleAfter: asset.staleAfter,
        expiredAfter: asset.expiredAfter,
      })),
    }),
    dataPoints: Object.freeze(
      freshness.assets.map((asset, index) =>
        buildDataPoint(
          `freshness_${index}`,
          `${asset.assetKind} freshness`,
          asset.status,
        ),
      ),
    ),
  });
}

function buildMethodologySection(
  methodology: MarketReportMethodology,
  localization: LocalizationBundle,
): MarketReportSection {
  return buildSection({
    sectionType: "methodology",
    order: 6,
    title: localization.sectionTitles.methodology,
    summary: methodology.disclaimer,
    content: freezeMetadata({
      bullets: methodology.bullets,
      disclaimer: methodology.disclaimer,
    }),
    dataPoints: Object.freeze(
      methodology.bullets.map((bullet, index) =>
        buildDataPoint(`methodology_${index}`, `Step ${index + 1}`, bullet),
      ),
    ),
  });
}

function buildSourcesSection(
  lineage: MarketReportLineageArtifact,
  localization: LocalizationBundle,
): MarketReportSection {
  return buildSection({
    sectionType: "sources",
    order: 7,
    title: localization.sectionTitles.sources,
    summary: localization.sourcesSummary,
    content: freezeMetadata({
      sourceArtifacts: lineage.sourceArtifacts,
      sourceLabels: lineage.sourceLabels,
      policyVersions: lineage.policyVersions,
      sourceFingerprint: lineage.sourceFingerprint,
    }),
    dataPoints: Object.freeze(
      lineage.sourceArtifacts.map((artifact, index) =>
        buildDataPoint(
          `source_${index}`,
          artifact.artifactType,
          artifact.artifactId,
        ),
      ),
    ),
  });
}

function buildMethodology(localization: LocalizationBundle): MarketReportMethodology {
  return deepFreeze({
    title: localization.sectionTitles.methodology,
    bullets: Object.freeze([...localization.methodologyBullets]),
    disclaimer: localization.methodologyDisclaimer,
  });
}

function buildConfidence(
  resolved: MarketReportResolvedAssets,
  localization: LocalizationBundle,
): MarketReportConfidence | null {
  const bands: RegistryConfidenceBand[] = [];
  if (resolved.pricing != null) {
    bands.push(resolved.pricing.version.confidenceBand);
  }
  if (resolved.occupancy != null) {
    bands.push(resolved.occupancy.version.confidenceBand);
  }
  if (resolved.overview != null) {
    bands.push(mapOverviewConfidence(resolved.overview.content.confidence));
  }

  if (bands.length === 0) {
    return null;
  }

  const band = pickWorstConfidence(bands);
  const label =
    localization.confidenceLabels[band as keyof typeof localization.confidenceLabels] ??
    band;
  return deepFreeze({
    band,
    label,
    signals: Object.freeze([
      buildDataPoint(
        "pricing_confidence",
        "Pricing",
        resolved.pricing?.version.confidenceBand ?? null,
      ),
      buildDataPoint(
        "occupancy_confidence",
        "Occupancy",
        resolved.occupancy?.version.confidenceBand ?? null,
      ),
      buildDataPoint(
        "overview_confidence",
        "Overview",
        resolved.overview?.content.confidence ?? null,
      ),
    ]),
  });
}

function buildFreshness(
  resolved: MarketReportResolvedAssets,
  localization: LocalizationBundle,
): MarketReportFreshness | null {
  type FreshnessAsset = Readonly<{
    assetKey: string;
    assetKind: string;
    status: MarketReportFreshnessStatus;
    computedAt: string | null;
    staleAfter: string | null;
    expiredAfter: string | null;
  }>;

  const assets = [
    resolved.reportFreshness == null
      ? null
      : {
          assetKey: resolved.reportAsset.assetId,
          assetKind: "market_report",
          status: mapVisibleFreshnessStatus(resolved.reportFreshness),
          computedAt: resolved.reportFreshness.computedAt,
          staleAfter: resolved.reportFreshness.staleAfter,
          expiredAfter: resolved.reportFreshness.expiredAfter,
        },
    resolved.pricing == null
      ? null
      : {
          assetKey: resolved.pricing.asset.assetId,
          assetKind: "market_pricing_benchmark",
          status: mapVisibleFreshnessStatus(resolved.pricing.freshness),
          computedAt: resolved.pricing.freshness?.computedAt ?? null,
          staleAfter: resolved.pricing.freshness?.staleAfter ?? null,
          expiredAfter: resolved.pricing.freshness?.expiredAfter ?? null,
        },
    resolved.occupancy == null
      ? null
      : {
          assetKey: resolved.occupancy.asset.assetId,
          assetKind: "market_occupancy_benchmark",
          status: mapVisibleFreshnessStatus(resolved.occupancy.freshness),
          computedAt: resolved.occupancy.freshness?.computedAt ?? null,
          staleAfter: resolved.occupancy.freshness?.staleAfter ?? null,
          expiredAfter: resolved.occupancy.freshness?.expiredAfter ?? null,
        },
    resolved.overview == null
      ? null
      : {
          assetKey: resolved.overview.asset.assetId,
          assetKind: "market_overview",
          status: mapVisibleFreshnessStatus(resolved.overview.freshness),
          computedAt: resolved.overview.freshness?.computedAt ?? null,
          staleAfter: resolved.overview.freshness?.staleAfter ?? null,
          expiredAfter: resolved.overview.freshness?.expiredAfter ?? null,
        },
  ].filter((asset): asset is FreshnessAsset => asset != null);

  if (assets.length === 0) {
    return null;
  }

  const status = pickWorstFreshness(
    assets.map((asset) => asset.status),
  );
  return deepFreeze({
    status,
    label: localization.freshnessLabels[status],
    assets: Object.freeze(assets),
  });
}

function buildLineageArtifact(
  resolved: MarketReportResolvedAssets,
): MarketReportLineageArtifact {
  const sourceArtifacts = [
    ...resolved.reportLineage,
    ...(resolved.pricing?.lineage ?? []),
    ...(resolved.occupancy?.lineage ?? []),
    ...(resolved.overview?.lineage ?? []),
  ]
    .map((reference) =>
      deepFreeze({
        artifactType: reference.artifactType,
        artifactId: reference.artifactId,
        artifactFingerprint: reference.artifactFingerprint,
        relationshipType: reference.relationshipType,
        metadata: freezeMetadata(reference.metadata),
      }),
    )
    .sort((left, right) =>
      compareStrings(
        `${left.artifactType}|${left.artifactId}|${left.artifactFingerprint}`,
        `${right.artifactType}|${right.artifactId}|${right.artifactFingerprint}`,
      ),
    );

  const sourceLabels = Object.freeze(
    [...new Set(sourceArtifacts.map((artifact) => artifact.artifactType))].sort(
      compareStrings,
    ),
  );
  const policyVersions = freezeRecord({
    ...resolved.reportDefinition.policyVersions,
    ...(resolved.pricing?.version.policyVersions ?? {}),
    ...(resolved.occupancy?.version.policyVersions ?? {}),
    ...(resolved.overview?.version.policyVersions ?? {}),
  });

  return deepFreeze({
    marketCellKey: resolved.reportDefinition.marketCellKey,
    sourceArtifacts: Object.freeze(sourceArtifacts),
    sourceLabels,
    policyVersions,
    sourceFingerprint: hashFingerprint("ipp_market_report_lineage", {
      sourceArtifacts,
      policyVersions,
    }),
  });
}

function buildMetadataArtifact(
  input: Readonly<{
    document: MarketReportDocument;
    structuredData: MarketReportStructuredData;
  }>,
): MarketReportMetadataArtifact {
  const title = `${input.document.title} | Norixo`;
  const openGraph = freezeMetadata({
    title,
    description: input.document.description,
    url: input.document.identity.canonicalUrl,
    type: "article",
  });

  return deepFreeze({
    title,
    description: input.document.description,
    canonicalPath: input.document.identity.canonicalPath,
    canonicalUrl: input.document.identity.canonicalUrl,
    locale: input.document.identity.locale,
    alternates: freezeRecord({
      [input.document.identity.locale]: input.document.identity.canonicalPath,
    }),
    openGraph,
    robots: freezeMetadata({
      index: true,
      follow: true,
    }),
    publishedAt: input.document.generatedAt,
    modifiedAt: input.document.generatedAt,
    contentFingerprint: input.document.contentFingerprint,
  });
}

function buildStructuredData(
  input: Readonly<{
    document: MarketReportDocument;
    lineage: MarketReportLineageArtifact | null;
    methodology: MarketReportMethodology | null;
  }>,
): MarketReportStructuredData {
  return deepFreeze({
    schemaType: "Report",
    headline: input.document.title,
    description: input.document.description,
    datePublished: input.document.generatedAt,
    dateModified: input.document.generatedAt,
    about: freezeMetadata({
      marketCellKey: input.document.identity.marketCellKey,
      platform: input.document.identity.platform,
      propertyType: input.document.identity.propertyType,
    }),
    spatialCoverage: freezeMetadata({
      country: input.document.identity.country,
      city: input.document.identity.city,
    }),
    temporalCoverage: freezeMetadata({
      capturePeriodBucket: input.document.period.capturePeriodBucket,
      sourcePeriodStart: input.document.period.sourcePeriodStart,
      sourcePeriodEnd: input.document.period.sourcePeriodEnd,
      windowStartedAt: input.document.period.windowStartedAt,
      windowEndedAt: input.document.period.windowEndedAt,
    }),
    publisher: freezeMetadata({
      name: "Norixo",
    }),
    mainEntity: freezeMetadata({
      reportId: input.document.identity.reportId,
      reportKey: input.document.identity.reportKey,
      canonicalPath: input.document.identity.canonicalPath,
    }),
    dataset: freezeMetadata({
      sourceFingerprint: input.lineage?.sourceFingerprint ?? null,
      policyVersions: input.document.policyVersions,
    }),
    methodology: freezeMetadata({
      bullets: input.methodology?.bullets ?? [],
      disclaimer: input.methodology?.disclaimer ?? null,
    }),
    canonicalUrl: input.document.identity.canonicalUrl,
  });
}

function buildContentArtifact(
  input: Readonly<{
    document: MarketReportDocument;
    methodology: MarketReportMethodology | null;
    localization: LocalizationBundle;
  }>,
): MarketReportContentArtifact {
  const sourceNotes =
    input.document.lineage == null
      ? Object.freeze<string[]>([])
      : Object.freeze([
          input.localization.lineageNote,
          `${input.localization.sourceNotesTitle}: ${input.document.lineage.sourceLabels.join(", ")}`,
        ]);

  return deepFreeze({
    heading: input.document.title,
    introduction:
      input.document.sections.find(
        (section) => section.sectionType === "executive_summary",
      )?.summary ?? input.document.description,
    sections: input.document.sections,
    keyFacts: input.document.facts,
    disclaimers:
      input.methodology == null
        ? Object.freeze<string[]>([])
        : Object.freeze([input.methodology.disclaimer]),
    callouts: Object.freeze<string[]>([]),
    tables: Object.freeze<CoordinationJsonObject[]>([]),
    chartsData: Object.freeze<CoordinationJsonObject[]>([]),
    methodology: input.methodology,
    sourceNotes,
  });
}

function buildDocumentFingerprint(
  input: Readonly<{
    identity: MarketReportIdentity;
    title: string;
    description: string;
    period: MarketReportPeriod;
    sections: readonly MarketReportSection[];
    confidence: MarketReportConfidence | null;
    freshness: MarketReportFreshness | null;
    methodology: MarketReportMethodology | null;
    lineage: MarketReportLineageArtifact | null;
    policyVersions: Readonly<Record<string, string>>;
  }>,
): string {
  return hashFingerprint("ipp_market_report_document", {
    identity: {
      reportKey: input.identity.reportKey,
      marketCellKey: input.identity.marketCellKey,
      locale: input.identity.locale,
      canonicalPath: input.identity.canonicalPath,
    },
    title: input.title,
    description: input.description,
    period: input.period,
    sections: input.sections.map((section) => ({
      sectionType: section.sectionType,
      contentFingerprint: section.contentFingerprint,
      title: section.title,
      summary: section.summary,
      content: section.content,
      dataPoints: section.dataPoints,
    })),
    confidence:
      input.confidence == null
        ? null
        : {
            band: input.confidence.band,
            signals: input.confidence.signals,
          },
    freshness:
      input.freshness == null
        ? null
        : {
            status: input.freshness.status,
            assets: input.freshness.assets.map((asset) => ({
              assetKind: asset.assetKind,
              status: asset.status,
            })),
          },
    methodology:
      input.methodology == null
        ? null
        : {
            bullets: input.methodology.bullets,
            disclaimer: input.methodology.disclaimer,
          },
    lineage:
      input.lineage == null
        ? null
        : {
            sourceFingerprint: input.lineage.sourceFingerprint,
            sourceArtifacts: input.lineage.sourceArtifacts,
          },
    policyVersions: input.policyVersions,
  });
}

function buildChange(
  input: Readonly<{
    bundleFingerprint: string;
    sections: readonly MarketReportSection[];
    previousBundle: MarketReportArtifactBundle | null;
    diagnostics: readonly MarketReportGenerationDiagnostic[];
    stale: boolean;
    partial: boolean;
  }>,
): MarketReportGenerationChange {
  if (input.partial) {
    return deepFreeze({
      changeType: "partial_report",
      previousFingerprint: input.previousBundle?.reportFingerprint ?? null,
      nextFingerprint: input.bundleFingerprint,
      changedSections: input.sections.map((section) => section.sectionType),
      unchangedSections: Object.freeze<MarketReportSectionType[]>([]),
      diagnostics: input.diagnostics,
    });
  }

  if (input.stale) {
    return deepFreeze({
      changeType: "stale_report",
      previousFingerprint: input.previousBundle?.reportFingerprint ?? null,
      nextFingerprint: input.bundleFingerprint,
      changedSections: input.sections.map((section) => section.sectionType),
      unchangedSections: Object.freeze<MarketReportSectionType[]>([]),
      diagnostics: input.diagnostics,
    });
  }

  if (input.previousBundle == null) {
    return deepFreeze({
      changeType: "new_report",
      previousFingerprint: null,
      nextFingerprint: input.bundleFingerprint,
      changedSections: input.sections.map((section) => section.sectionType),
      unchangedSections: Object.freeze<MarketReportSectionType[]>([]),
      diagnostics: input.diagnostics,
    });
  }

  const previousSections = new Map(
    input.previousBundle.document.sections.map((section) => [
      section.sectionType,
      section.contentFingerprint,
    ]),
  );
  const changedSections: MarketReportSectionType[] = [];
  const unchangedSections: MarketReportSectionType[] = [];
  for (const section of input.sections) {
    const previousFingerprint = previousSections.get(section.sectionType);
    if (previousFingerprint === section.contentFingerprint) {
      unchangedSections.push(section.sectionType);
    } else {
      changedSections.push(section.sectionType);
    }
  }

  return deepFreeze({
    changeType:
      input.previousBundle.reportFingerprint === input.bundleFingerprint
        ? "unchanged_report"
        : "updated_report",
    previousFingerprint: input.previousBundle.reportFingerprint,
    nextFingerprint: input.bundleFingerprint,
    changedSections: Object.freeze(changedSections),
    unchangedSections: Object.freeze(unchangedSections),
    diagnostics: input.diagnostics,
  });
}

export function validateMarketReportDocument(
  input: unknown,
): MarketReportDocumentValidationResult {
  const issues: MarketReportGenerationValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a MarketReportDocument object.",
        }),
      ]),
    };
  }

  const document = input as MarketReportDocument;
  if (!isNonEmptyString(document.title)) {
    issues.push({ path: "title", message: "Expected a non-empty title." });
  }
  if (!isNonEmptyString(document.description)) {
    issues.push({
      path: "description",
      message: "Expected a non-empty description.",
    });
  }
  if (!isNonEmptyString(document.contentFingerprint)) {
    issues.push({
      path: "contentFingerprint",
      message: "Expected a non-empty contentFingerprint.",
    });
  }
  if (!Array.isArray(document.sections) || document.sections.length === 0) {
    issues.push({
      path: "sections",
      message: "Expected at least one section.",
    });
  }
  if (!isNonEmptyString(document.identity.canonicalPath)) {
    issues.push({
      path: "identity.canonicalPath",
      message: "Expected a canonicalPath.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  try {
    assertNoPrivateFields(document, "document");
  } catch (error) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path:
            error instanceof MarketReportGenerationError
              ? error.path ?? "document"
              : "document",
          message: error instanceof Error ? error.message : "Privacy validation failed.",
        }),
      ]),
    };
  }

  return {
    ok: true,
    document: deepFreeze(document),
  };
}

export function validateMarketReportArtifactBundle(
  input: unknown,
): MarketReportBundleValidationResult {
  const issues: MarketReportGenerationValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a MarketReportArtifactBundle object.",
        }),
      ]),
    };
  }

  const bundle = input as MarketReportArtifactBundle;
  if (!isNonEmptyString(bundle.bundleId)) {
    issues.push({ path: "bundleId", message: "Expected a non-empty bundleId." });
  }
  if (!isNonEmptyString(bundle.reportFingerprint)) {
    issues.push({
      path: "reportFingerprint",
      message: "Expected a non-empty reportFingerprint.",
    });
  }

  const documentValidation = validateMarketReportDocument(bundle.document);
  if (!documentValidation.ok) {
    for (const issue of documentValidation.issues) {
      issues.push({
        path: `document.${issue.path}`,
        message: issue.message,
      });
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  try {
    assertNoPrivateFields(bundle, "bundle");
  } catch (error) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path:
            error instanceof MarketReportGenerationError
              ? error.path ?? "bundle"
              : "bundle",
          message: error instanceof Error ? error.message : "Privacy validation failed.",
        }),
      ]),
    };
  }

  return {
    ok: true,
    bundle: deepFreeze(bundle),
  };
}

function buildPolicyVersions(
  input: Readonly<{
    reportDefinition: MarketReportDefinition;
    pricing: MarketReportResolvedInsightAsset<PricingContentSnapshot> | null;
    occupancy: MarketReportResolvedInsightAsset<OccupancyContentSnapshot> | null;
    overview: MarketReportResolvedInsightAsset<OverviewContentSnapshot> | null;
    inputPolicyVersions?: Readonly<Record<string, string>>;
  }>,
): Readonly<Record<string, string>> {
  return freezeRecord({
    ...input.reportDefinition.policyVersions,
    ...(input.pricing?.version.policyVersions ?? {}),
    ...(input.occupancy?.version.policyVersions ?? {}),
    ...(input.overview?.version.policyVersions ?? {}),
    ...(input.inputPolicyVersions ?? {}),
  });
}

function buildDescription(
  input: Readonly<{
    localization: LocalizationBundle;
    resolved: MarketReportResolvedAssets;
    period: MarketReportPeriod;
  }>,
): string {
  return input.localization.descriptionBuilder({
    platform: input.resolved.reportDefinition.platform,
    city: input.resolved.reportDefinition.city,
    periodLabel: input.period.label,
    hasOccupancy: input.resolved.occupancy != null,
  });
}

function buildTitle(
  input: Readonly<{
    localization: LocalizationBundle;
    resolved: MarketReportResolvedAssets;
  }>,
): string {
  return input.localization.titleBuilder({
    platform: input.resolved.reportDefinition.platform,
    city: input.resolved.reportDefinition.city,
    propertyType: input.resolved.reportDefinition.propertyType,
  });
}

function computeSourceCapturedAt(period: MarketReportPeriod): string | null {
  const candidates = [
    period.sourcePeriodEnd,
    period.windowEndedAt,
    period.sourcePeriodStart,
    period.windowStartedAt,
  ].filter((value): value is string => value != null);
  if (candidates.length === 0) {
    return null;
  }
  return [...candidates].sort(compareStrings)[candidates.length - 1];
}

function validateCompletenessOrThrow(
  input: Readonly<{
    policy: MarketReportCompletenessPolicy;
    resolved: MarketReportResolvedAssets;
    reportKey: string;
  }>,
): readonly MarketReportGenerationDiagnostic[] {
  const diagnostics: MarketReportGenerationDiagnostic[] = [];
  if (input.policy.requireOverview && input.resolved.overview == null) {
    diagnostics.push(
      buildDiagnostic({
        code: "overview_asset_missing",
        severity: "error",
        message: "Required market overview asset is missing.",
        reportKey: input.reportKey,
      }),
    );
  }
  if (input.policy.requirePricing && input.resolved.pricing == null) {
    diagnostics.push(
      buildDiagnostic({
        code: "pricing_asset_missing",
        severity: "error",
        message: "Required pricing asset is missing.",
        reportKey: input.reportKey,
      }),
    );
  }
  if (input.policy.requireOccupancy && input.resolved.occupancy == null) {
    diagnostics.push(
      buildDiagnostic({
        code: "occupancy_asset_missing",
        severity: "error",
        message: "Required occupancy asset is missing.",
        reportKey: input.reportKey,
      }),
    );
  }

  if (
    diagnostics.length > 0 &&
    input.policy.allowPartialReport === false
  ) {
    throw new MarketReportGenerationError({
      code: "missing_required_asset",
      operation: "validateCompletenessOrThrow",
      reportKey: input.reportKey,
      marketCellKey: input.resolved.reportDefinition.marketCellKey,
      message: "Required public-safe assets are missing for a strict report.",
    });
  }

  return Object.freeze(diagnostics);
}

function buildSections(
  input: Readonly<{
    resolved: MarketReportResolvedAssets;
    localization: LocalizationBundle;
    options: MarketReportGenerationOptions;
    confidence: MarketReportConfidence | null;
    freshness: MarketReportFreshness | null;
    methodology: MarketReportMethodology | null;
    lineage: MarketReportLineageArtifact | null;
    completenessDiagnostics: readonly MarketReportGenerationDiagnostic[];
  }>,
): readonly MarketReportSection[] {
  const sections: MarketReportSection[] = [];
  sections.push(
    buildExecutiveSummarySection(
      input.resolved,
      input.localization,
      input.confidence,
    ),
  );

  if (input.resolved.overview != null) {
    sections.push(
      buildMarketOverviewSection(input.resolved.overview, input.localization),
    );
  } else if (input.options.completenessPolicy.allowPartialReport) {
    const diagnostic =
      input.completenessDiagnostics.find(
        (entry) => entry.code === "overview_asset_missing",
      ) ??
      buildDiagnostic({
        code: "partial_section_missing",
        severity: "warning",
        message: "Overview section is missing.",
      });
    sections.push(
      buildMissingSection({
        sectionType: "market_overview",
        order: 1,
        localization: input.localization,
        diagnostic,
      }),
    );
  }

  if (input.resolved.pricing != null) {
    sections.push(
      buildPricingBenchmarkSection(input.resolved.pricing, input.localization),
    );
  } else if (input.options.completenessPolicy.allowPartialReport) {
    const diagnostic =
      input.completenessDiagnostics.find(
        (entry) => entry.code === "pricing_asset_missing",
      ) ??
      buildDiagnostic({
        code: "partial_section_missing",
        severity: "warning",
        message: "Pricing section is missing.",
      });
    sections.push(
      buildMissingSection({
        sectionType: "pricing_benchmark",
        order: 2,
        localization: input.localization,
        diagnostic,
      }),
    );
  }

  if (input.resolved.occupancy != null) {
    sections.push(
      buildOccupancyBenchmarkSection(
        input.resolved.occupancy,
        input.localization,
      ),
    );
  } else if (input.options.completenessPolicy.allowPartialReport) {
    const diagnostic =
      input.completenessDiagnostics.find(
        (entry) => entry.code === "occupancy_asset_missing",
      ) ??
      buildDiagnostic({
        code: "partial_section_missing",
        severity: "warning",
        message: "Occupancy section is missing.",
      });
    sections.push(
      buildMissingSection({
        sectionType: "occupancy_benchmark",
        order: 3,
        localization: input.localization,
        diagnostic,
      }),
    );
  }

  if (input.options.includeConfidence && input.confidence != null) {
    sections.push(buildConfidenceSection(input.confidence, input.localization));
  }
  if (input.options.includeFreshness && input.freshness != null) {
    sections.push(buildFreshnessSection(input.freshness, input.localization));
  }
  if (input.options.includeMethodology && input.methodology != null) {
    sections.push(buildMethodologySection(input.methodology, input.localization));
  }
  if (input.options.includeLineage && input.lineage != null) {
    sections.push(buildSourcesSection(input.lineage, input.localization));
  }

  return deepFreeze(
    sections
      .map((section, index) =>
        buildSection({
          sectionType: section.sectionType,
          order: index,
          title: section.title,
          summary: section.summary,
          content: section.content,
          dataPoints: section.dataPoints,
          diagnostics: section.diagnostics,
        }),
      )
      .sort((left, right) => left.order - right.order),
  );
}

export function generateMarketReportDocument(
  input: MarketReportGenerationInput,
): MarketReportArtifactBundle {
  if (!isNonEmptyString(input.reportAssetKey)) {
    throw new MarketReportGenerationError({
      code: "invalid_input",
      operation: "generateMarketReportDocument",
      message: "reportAssetKey must be a non-empty string.",
    });
  }
  assertCanonicalTimestamp(
    input.generatedAt,
    "generateMarketReportDocument",
    "generatedAt",
  );
  const metadata = freezeMetadata(input.metadata);
  assertJsonSafeMetadata(
    metadata,
    "generateMarketReportDocument",
    "metadata",
  );

  const options = normalizeOptions(input.options);
  const locale = normalizeLocale(input.locale);
  if (!options.supportedLocales.includes(locale)) {
    throw new MarketReportGenerationError({
      code: "unsupported_locale",
      operation: "generateMarketReportDocument",
      message: `Locale ${locale} is not supported.`,
    });
  }

  const snapshot = parseRegistrySnapshot(input.registrySnapshot);
  assertRegistrySnapshotPublicSafe(snapshot);
  assertNoPrivateFields(snapshot, "snapshot");
  const resolved = resolveMarketReportAssets({
    registrySnapshot: snapshot,
    reportAssetKey: input.reportAssetKey,
    locale,
    options: input.options,
  });
  const localization = getLocalizationBundle(locale);
  const completenessDiagnostics = validateCompletenessOrThrow({
    policy: options.completenessPolicy,
    resolved,
    reportKey: `report:${resolved.reportDefinition.marketCellKey}:${locale}`,
  });

  const confidence = buildConfidence(resolved, localization);
  const freshness = buildFreshness(resolved, localization);
  const methodology = options.includeMethodology
    ? buildMethodology(localization)
    : null;
  const lineage = options.includeLineage ? buildLineageArtifact(resolved) : null;

  const sections = buildSections({
    resolved,
    localization,
    options,
    confidence,
    freshness,
    methodology,
    lineage,
    completenessDiagnostics,
  });

  if (sections.length < options.completenessPolicy.minimumSectionCount) {
    throw new MarketReportGenerationError({
      code: "incomplete_report",
      operation: "generateMarketReportDocument",
      reportKey: `report:${resolved.reportDefinition.marketCellKey}:${locale}`,
      marketCellKey: resolved.reportDefinition.marketCellKey,
      message: "The generated report does not meet the minimum section count.",
    });
  }

  const policyVersions = buildPolicyVersions({
    reportDefinition: resolved.reportDefinition,
    pricing: resolved.pricing,
    occupancy: resolved.occupancy,
    overview: resolved.overview,
    inputPolicyVersions: input.policyVersions,
  });
  const period = buildPeriod(resolved);
  const title = buildTitle({ localization, resolved });
  const description = buildDescription({
    localization,
    resolved,
    period,
  });
  const identity = buildIdentity({
    definition: resolved.reportDefinition,
    reportAsset: resolved.reportAsset,
    reportVersion: resolved.reportVersion,
    locale,
    canonicalBaseUrl: input.canonicalBaseUrl,
    capacityBand:
      typeof (resolved.pricing?.asset.metadata as Record<string, unknown> | undefined)?.capacityBand ===
      "string"
        ? String(
            (resolved.pricing?.asset.metadata as Record<string, unknown>).capacityBand,
          )
        : typeof (resolved.occupancy?.asset.metadata as Record<string, unknown> | undefined)
              ?.capacityBand === "string"
          ? String(
              (resolved.occupancy?.asset.metadata as Record<string, unknown>).capacityBand,
            )
          : null,
  });
  const documentFingerprint = buildDocumentFingerprint({
    identity,
    title,
    description,
    period,
    sections,
    confidence,
    freshness,
    methodology,
    lineage,
    policyVersions,
  });

  const documentDiagnostics = [
    ...resolved.diagnostics,
    ...completenessDiagnostics,
    ...(freshness?.status === "stale" || freshness?.status === "expired"
      ? [
          buildDiagnostic({
            code: "stale_report",
            severity: "warning",
            message: "The visible freshness status is stale or expired.",
            reportKey: identity.reportKey,
          }),
        ]
      : []),
  ];

  const document = deepFreeze({
    identity,
    title,
    description,
    period,
    generatedAt: resolved.reportVersion.createdAt,
    sourceCapturedAt: computeSourceCapturedAt(period),
    contentFingerprint: documentFingerprint,
    documentVersion: 1,
    sections,
    facts: Object.freeze(
      sections.flatMap((section) => section.dataPoints).slice(0, 8),
    ),
    confidence,
    freshness,
    methodology,
    lineage,
    diagnostics: Object.freeze(documentDiagnostics),
    policyVersions,
    metadata: freezeMetadata({
      generatedAtInput: input.generatedAt,
      reportAssetKey: input.reportAssetKey,
      registrySnapshotId: snapshot.snapshotId,
      registrySnapshotFingerprint: buildRegistrySnapshotFingerprint(snapshot),
      ...options.metadata,
      ...metadata,
    }),
  });

  const documentValidation = validateMarketReportDocument(document);
  if (!documentValidation.ok) {
    throw new MarketReportGenerationError({
      code: "invalid_report_document",
      operation: "generateMarketReportDocument",
      reportKey: identity.reportKey,
      message: documentValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | "),
    });
  }

  const structuredData = buildStructuredData({
    document,
    lineage,
    methodology,
  });
  const metadataArtifact = buildMetadataArtifact({
    document,
    structuredData,
  });
  const contentArtifact = buildContentArtifact({
    document,
    methodology,
    localization,
  });

  const diagnostics: MarketReportGenerationDiagnostic[] = [
    ...document.diagnostics,
  ];
  const previousBundle = input.previousBundle ?? null;
  const previousFingerprint = previousBundle?.reportFingerprint ?? null;
  const previousDocumentFingerprint =
    previousBundle?.document.contentFingerprint ?? null;
  diagnostics.push(
    buildDiagnostic({
      code:
        previousFingerprint == null
          ? "new_report"
          : previousDocumentFingerprint === document.contentFingerprint
            ? "unchanged_report"
            : "updated_report",
      severity: "info",
      message:
        previousFingerprint == null
          ? "A new market report bundle was generated."
          : previousDocumentFingerprint === document.contentFingerprint
            ? "The market report bundle is unchanged."
            : "The market report bundle was updated.",
      reportKey: identity.reportKey,
    }),
  );
  diagnostics.push(
    buildDiagnostic({
      code: "report_generated",
      severity: "info",
      message: "A canonical market report document was generated.",
      reportKey: identity.reportKey,
      assetKey: identity.assetKey,
    }),
  );

  const lineageArtifact = lineage;
  const bundleFingerprint = hashFingerprint("ipp_market_report_bundle", {
    reportId: identity.reportId,
    reportFingerprint: document.contentFingerprint,
    metadataArtifact: {
      title: metadataArtifact.title,
      description: metadataArtifact.description,
      canonicalPath: metadataArtifact.canonicalPath,
      locale: metadataArtifact.locale,
      openGraph: metadataArtifact.openGraph,
    },
    structuredData,
    contentArtifact: {
      heading: contentArtifact.heading,
      introduction: contentArtifact.introduction,
      sections: contentArtifact.sections.map((section) => ({
        sectionType: section.sectionType,
        contentFingerprint: section.contentFingerprint,
      })),
      keyFacts: contentArtifact.keyFacts,
      disclaimers: contentArtifact.disclaimers,
      sourceNotes: contentArtifact.sourceNotes,
    },
    lineageArtifact,
  });

  const change = buildChange({
    bundleFingerprint,
    sections,
    previousBundle,
    diagnostics: Object.freeze(diagnostics),
    stale:
      freshness?.status === "stale" || freshness?.status === "expired",
    partial: completenessDiagnostics.length > 0,
  });
  const bundle = deepFreeze({
    bundleId: hashFingerprint("ipp_market_report_bundle_id", {
      reportId: identity.reportId,
      reportFingerprint: bundleFingerprint,
    }),
    reportId: identity.reportId,
    reportFingerprint: bundleFingerprint,
    document,
    structuredData,
    metadataArtifact,
    contentArtifact,
    lineageArtifact,
    diagnostics: Object.freeze(diagnostics),
    policyVersions,
    change,
  });

  const bundleValidation = validateMarketReportArtifactBundle(bundle);
  if (!bundleValidation.ok) {
    throw new MarketReportGenerationError({
      code: "invalid_artifact_bundle",
      operation: "generateMarketReportDocument",
      reportKey: identity.reportKey,
      message: bundleValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | "),
    });
  }

  assertNoPrivateFields(bundle, "bundle");
  return bundle;
}

export function buildMarketReportExecutionGraph(
  input: BuildMarketReportRuntimeGraphInput,
): MarketReportRuntimePlan {
  assertCanonicalTimestamp(
    input.generatedAt,
    "buildMarketReportExecutionGraph",
    "generatedAt",
  );
  const snapshot = parseRegistrySnapshot(input.registrySnapshot);
  assertRegistrySnapshotPublicSafe(snapshot);
  assertNoPrivateFields(snapshot, "snapshot");
  const locale = normalizeLocale(input.locale);
  const graph = buildExecutionGraph({
    registrySnapshotId: snapshot.snapshotId,
    registrySnapshotFingerprint: buildRegistrySnapshotFingerprint(snapshot),
    createdAt: input.generatedAt,
    jobs: Object.freeze([
      Object.freeze({
        id: hashFingerprint("ipp_market_report_runtime_job", {
          reportAssetKey: input.reportAssetKey,
          locale,
          step: "resolve_market_report_assets",
        }),
        type: "resolve_market_report_assets",
        dependencies: Object.freeze([]),
        inputs: freezeMetadata({
          reportAssetKey: input.reportAssetKey,
          locale,
        }),
        outputs: freezeMetadata({}),
        metadata: freezeMetadata({
          stage: "market_report_generation",
        }),
      }),
      Object.freeze({
        id: hashFingerprint("ipp_market_report_runtime_job", {
          reportAssetKey: input.reportAssetKey,
          locale,
          step: "generate_market_report_document",
        }),
        type: "generate_market_report_document",
        dependencies: Object.freeze([
          hashFingerprint("ipp_market_report_runtime_job", {
            reportAssetKey: input.reportAssetKey,
            locale,
            step: "resolve_market_report_assets",
          }),
        ]),
        inputs: freezeMetadata({
          reportAssetKey: input.reportAssetKey,
          locale,
        }),
        outputs: freezeMetadata({}),
        metadata: freezeMetadata({
          stage: "market_report_generation",
        }),
      }),
      Object.freeze({
        id: hashFingerprint("ipp_market_report_runtime_job", {
          reportAssetKey: input.reportAssetKey,
          locale,
          step: "validate_market_report_bundle",
        }),
        type: "validate_market_report_bundle",
        dependencies: Object.freeze([
          hashFingerprint("ipp_market_report_runtime_job", {
            reportAssetKey: input.reportAssetKey,
            locale,
            step: "generate_market_report_document",
          }),
        ]),
        inputs: freezeMetadata({
          reportAssetKey: input.reportAssetKey,
          locale,
        }),
        outputs: freezeMetadata({}),
        metadata: freezeMetadata({
          stage: "market_report_generation",
        }),
      }),
    ]),
    metadata: freezeMetadata({
      reportAssetKey: input.reportAssetKey,
      locale,
      ...(input.metadata ?? {}),
    }),
  });
  const plan = buildRuntimeExecutionPlan({
    graph,
    createdAt: input.generatedAt,
    metadata: freezeMetadata({
      reportAssetKey: input.reportAssetKey,
      locale,
    }),
  });
  return deepFreeze({
    graph,
    plan,
    diagnostics: Object.freeze([
      buildDiagnostic({
        code: "runtime_job_created",
        severity: "info",
        message: "A runtime execution graph was created for market report generation.",
        reportKey: `report:${input.reportAssetKey}:${locale}`,
      }),
    ]),
  });
}
