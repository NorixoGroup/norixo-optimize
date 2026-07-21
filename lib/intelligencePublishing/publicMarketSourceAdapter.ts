import { createHash } from "node:crypto";

import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
  type PricingBenchmarkPopulationInput,
  type PublicMarketOverviewPopulationInput,
} from "./registryPopulation";
import {
  generateMarketReportDocument,
  validateMarketReportArtifactBundle,
  type MarketReportArtifactBundle,
} from "./marketReportGeneration";
import { parseMarketReportDefinition } from "./marketReportPilot";
import {
  assertRegistrySnapshotPublicSafe,
  buildRegistrySnapshotFingerprint,
  parseRegistrySnapshot,
  type RegistrySnapshot,
} from "./registryAdapter";
import type { CoordinationJsonObject, CoordinationJsonValue } from "./distributedCoordination";

const DAY_MS = 24 * 60 * 60 * 1000;

const FORBIDDEN_PRIVATE_KEYS = new Set([
  "userid",
  "workspaceid",
  "auditid",
  "listingid",
  "listingurl",
  "sourceurl",
  "comparableurl",
  "email",
  "token",
  "apikey",
  "authorization",
  "rawpayload",
  "rawobservation",
  "rawrows",
  "rawfacts",
]);

export const PUBLIC_MARKET_REPORT_SOURCE_KIND = "public_market_report_source";
export const PUBLIC_MARKET_REPORT_SOURCE_VERSION = "ipp_public_market_source_v1";

export type PublicMarketRequiredMetric =
  | "pricing_benchmark"
  | "market_overview"
  | "occupancy_benchmark";

export type PublicMarketReportSource = Readonly<{
  schemaVersion: 1;
  sourceKind: typeof PUBLIC_MARKET_REPORT_SOURCE_KIND;
  sourceVersion: typeof PUBLIC_MARKET_REPORT_SOURCE_VERSION;
  generatedAt: string;
  marketCell: Readonly<{
    country: string;
    city: string;
    platform: string;
    propertyType: string;
    currency: string;
    capacityScope: "all_capacities";
  }>;
  pricingBenchmark: PricingBenchmarkPopulationInput["payload"];
  marketOverview: PublicMarketOverviewPopulationInput["artifact"];
  publication: Readonly<{
    primaryLocale: string;
    defaultLocale: string;
    siteOrigin: string;
    canonicalSlug: string;
    knownStaticRoutes: readonly string[];
    indexOnlyWhenComplete: boolean;
    requiredMetrics: readonly PublicMarketRequiredMetric[];
    optionalMetrics: readonly PublicMarketRequiredMetric[];
  }>;
  privacy: Readonly<{
    minimumObservations: number;
    maximumPricingAgeDays: number;
    maximumOverviewAgeDays: number;
    containsRawObservations: false;
    containsPrivateIdentifiers: false;
    provenance: readonly string[];
  }>;
  metadata: CoordinationJsonObject;
}>;

export type PublicMarketReportSourceValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type PublicMarketReportSourceValidationResult =
  | Readonly<{
      ok: true;
      source: PublicMarketReportSource;
    }>
  | Readonly<{
      ok: false;
      issues: readonly PublicMarketReportSourceValidationIssue[];
    }>;

export type PublicMarketSourceBuildResult = Readonly<{
  source: PublicMarketReportSource;
  sourceFingerprint: string;
  registrySnapshot: RegistrySnapshot;
  snapshotFingerprint: string;
  reportAssetKey: string;
}>;

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized: string[] = [];
  for (const entry of value) {
    const parsed = normalizeString(entry);
    if (parsed == null) {
      return null;
    }
    normalized.push(parsed);
  }
  return Object.freeze([...new Set(normalized)].sort(compareStrings));
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

function freezeMetadata(value: unknown): CoordinationJsonObject {
  if (!isPlainObject(value) || !isJsonSafe(value)) {
    return Object.freeze({});
  }
  return Object.freeze({ ...value });
}

function assertNoForbiddenPrivateKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoForbiddenPrivateKeys(entry, `${path}[${index}]`),
    );
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (FORBIDDEN_PRIVATE_KEYS.has(normalizedKey)) {
      throw new Error(`Forbidden private field detected at ${path}.${key}`);
    }
    assertNoForbiddenPrivateKeys(child, `${path}.${key}`);
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.entries(value)
      .sort((left, right) => compareStrings(left[0], right[0]))
      .map(
        ([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function buildIssue(path: string, message: string): PublicMarketReportSourceValidationIssue {
  return Object.freeze({ path, message });
}

function normalizeMetricList(
  value: unknown,
): readonly PublicMarketRequiredMetric[] | null {
  const parsed = normalizeStringArray(value);
  if (parsed == null) {
    return null;
  }
  const allowed = new Set<PublicMarketRequiredMetric>([
    "pricing_benchmark",
    "market_overview",
    "occupancy_benchmark",
  ]);
  if (!parsed.every((entry) => allowed.has(entry as PublicMarketRequiredMetric))) {
    return null;
  }
  return parsed as readonly PublicMarketRequiredMetric[];
}

function parseSourceCandidate(
  input: unknown,
): PublicMarketReportSourceValidationResult {
  const issues: PublicMarketReportSourceValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([buildIssue("", "Expected a source object.")]),
    };
  }

  try {
    assertNoForbiddenPrivateKeys(input, "source");
  } catch (error) {
    return {
      ok: false,
      issues: Object.freeze([
        buildIssue(
          "",
          error instanceof Error ? error.message : "Forbidden private field detected.",
        ),
      ]),
    };
  }

  const schemaVersion = input.schemaVersion;
  const sourceKind = normalizeString(input.sourceKind);
  const sourceVersion = normalizeString(input.sourceVersion);
  const generatedAt = normalizeString(input.generatedAt);
  const marketCell = input.marketCell;
  const pricingBenchmark = input.pricingBenchmark;
  const marketOverview = input.marketOverview;
  const publication = input.publication;
  const privacy = input.privacy;

  if (schemaVersion !== 1) {
    issues.push(buildIssue("schemaVersion", "schemaVersion must equal 1."));
  }
  if (sourceKind !== PUBLIC_MARKET_REPORT_SOURCE_KIND) {
    issues.push(
      buildIssue(
        "sourceKind",
        `sourceKind must equal ${PUBLIC_MARKET_REPORT_SOURCE_KIND}.`,
      ),
    );
  }
  if (sourceVersion !== PUBLIC_MARKET_REPORT_SOURCE_VERSION) {
    issues.push(
      buildIssue(
        "sourceVersion",
        `sourceVersion must equal ${PUBLIC_MARKET_REPORT_SOURCE_VERSION}.`,
      ),
    );
  }
  if (!isCanonicalIsoTimestamp(generatedAt)) {
    issues.push(
      buildIssue("generatedAt", "generatedAt must be a canonical ISO timestamp."),
    );
  }

  if (!isPlainObject(marketCell)) {
    issues.push(buildIssue("marketCell", "marketCell must be an object."));
  }
  if (!isPlainObject(pricingBenchmark)) {
    issues.push(
      buildIssue("pricingBenchmark", "pricingBenchmark must be an object."),
    );
  }
  if (!isPlainObject(marketOverview)) {
    issues.push(
      buildIssue("marketOverview", "marketOverview must be an object."),
    );
  }
  if (!isPlainObject(publication)) {
    issues.push(buildIssue("publication", "publication must be an object."));
  }
  if (!isPlainObject(privacy)) {
    issues.push(buildIssue("privacy", "privacy must be an object."));
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const marketCellRecord = marketCell as Record<string, unknown>;
  const pricingBenchmarkRecord = pricingBenchmark as Record<string, unknown>;
  const marketOverviewRecord = marketOverview as Record<string, unknown>;
  const publicationRecord = publication as Record<string, unknown>;
  const privacyRecord = privacy as Record<string, unknown>;

  const normalizedMarketCell = Object.freeze({
    country: normalizeString(marketCellRecord.country),
    city: normalizeString(marketCellRecord.city),
    platform: normalizeString(marketCellRecord.platform),
    propertyType: normalizeString(marketCellRecord.propertyType),
    currency: normalizeString(marketCellRecord.currency),
    capacityScope: marketCellRecord.capacityScope,
  });

  if (
    normalizedMarketCell.country == null ||
    normalizedMarketCell.city == null ||
    normalizedMarketCell.platform == null ||
    normalizedMarketCell.propertyType == null ||
    normalizedMarketCell.currency == null ||
    normalizedMarketCell.capacityScope !== "all_capacities"
  ) {
    issues.push(
      buildIssue(
        "marketCell",
        "marketCell must include country, city, platform, propertyType, currency and capacityScope=all_capacities.",
      ),
    );
  }

  const primaryLocale = normalizeString(publicationRecord.primaryLocale);
  const defaultLocale = normalizeString(publicationRecord.defaultLocale);
  const siteOrigin = normalizeString(publicationRecord.siteOrigin);
  const canonicalSlug = normalizeString(publicationRecord.canonicalSlug);
  const knownStaticRoutes = normalizeStringArray(publicationRecord.knownStaticRoutes);
  const requiredMetrics = normalizeMetricList(publicationRecord.requiredMetrics);
  const optionalMetrics = normalizeMetricList(publicationRecord.optionalMetrics);
  const indexOnlyWhenComplete =
    publicationRecord.indexOnlyWhenComplete === true ||
    publicationRecord.indexOnlyWhenComplete === false
      ? publicationRecord.indexOnlyWhenComplete
      : null;

  if (primaryLocale == null) {
    issues.push(
      buildIssue("publication.primaryLocale", "primaryLocale is required."),
    );
  }
  if (defaultLocale == null) {
    issues.push(
      buildIssue("publication.defaultLocale", "defaultLocale is required."),
    );
  }
  if (siteOrigin == null) {
    issues.push(buildIssue("publication.siteOrigin", "siteOrigin is required."));
  }
  if (canonicalSlug == null) {
    issues.push(
      buildIssue("publication.canonicalSlug", "canonicalSlug is required."),
    );
  }
  if (knownStaticRoutes == null) {
    issues.push(
      buildIssue(
        "publication.knownStaticRoutes",
        "knownStaticRoutes must be a string array.",
      ),
    );
  }
  if (requiredMetrics == null || requiredMetrics.length === 0) {
    issues.push(
      buildIssue(
        "publication.requiredMetrics",
        "requiredMetrics must contain at least one metric.",
      ),
    );
  }
  if (optionalMetrics == null) {
    issues.push(
      buildIssue(
        "publication.optionalMetrics",
        "optionalMetrics must be a string array.",
      ),
    );
  }
  if (indexOnlyWhenComplete == null) {
    issues.push(
      buildIssue(
        "publication.indexOnlyWhenComplete",
        "indexOnlyWhenComplete must be a boolean.",
      ),
    );
  }

  const minimumObservations =
    typeof privacyRecord.minimumObservations === "number" &&
    Number.isInteger(privacyRecord.minimumObservations)
      ? privacyRecord.minimumObservations
      : null;
  const maximumPricingAgeDays =
    typeof privacyRecord.maximumPricingAgeDays === "number" &&
    Number.isInteger(privacyRecord.maximumPricingAgeDays)
      ? privacyRecord.maximumPricingAgeDays
      : null;
  const maximumOverviewAgeDays =
    typeof privacyRecord.maximumOverviewAgeDays === "number" &&
    Number.isInteger(privacyRecord.maximumOverviewAgeDays)
      ? privacyRecord.maximumOverviewAgeDays
      : null;
  const provenance = normalizeStringArray(privacyRecord.provenance);

  if (minimumObservations == null || minimumObservations < 5) {
    issues.push(
      buildIssue(
        "privacy.minimumObservations",
        "minimumObservations must be an integer greater than or equal to 5.",
      ),
    );
  }
  if (maximumPricingAgeDays == null || maximumPricingAgeDays <= 0) {
    issues.push(
      buildIssue(
        "privacy.maximumPricingAgeDays",
        "maximumPricingAgeDays must be a positive integer.",
      ),
    );
  }
  if (maximumOverviewAgeDays == null || maximumOverviewAgeDays <= 0) {
    issues.push(
      buildIssue(
        "privacy.maximumOverviewAgeDays",
        "maximumOverviewAgeDays must be a positive integer.",
      ),
    );
  }
  if (privacyRecord.containsRawObservations !== false) {
    issues.push(
      buildIssue(
        "privacy.containsRawObservations",
        "containsRawObservations must be false.",
      ),
    );
  }
  if (privacyRecord.containsPrivateIdentifiers !== false) {
    issues.push(
      buildIssue(
        "privacy.containsPrivateIdentifiers",
        "containsPrivateIdentifiers must be false.",
      ),
    );
  }
  if (provenance == null || provenance.length === 0) {
    issues.push(
      buildIssue("privacy.provenance", "provenance must be a non-empty array."),
    );
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const pricingCountry = normalizeString(pricingBenchmarkRecord.country);
  const pricingCity = normalizeString(pricingBenchmarkRecord.city);
  const pricingPlatform = normalizeString(pricingBenchmarkRecord.platform);
  const pricingPropertyType = normalizeString(pricingBenchmarkRecord.property_type);
  const pricingCurrency = normalizeString(pricingBenchmarkRecord.currency);
  const pricingValidUntil = normalizeString(pricingBenchmarkRecord.valid_until);
  const pricingIncluded =
    typeof pricingBenchmarkRecord.included_sample_size === "number" &&
    Number.isInteger(pricingBenchmarkRecord.included_sample_size)
      ? pricingBenchmarkRecord.included_sample_size
      : null;
  if (
    pricingCountry !== normalizedMarketCell.country ||
    pricingCity !== normalizedMarketCell.city ||
    pricingPlatform !== normalizedMarketCell.platform ||
    pricingPropertyType !== normalizedMarketCell.propertyType ||
    pricingCurrency !== normalizedMarketCell.currency
  ) {
    issues.push(
      buildIssue(
        "pricingBenchmark",
        "pricingBenchmark must match the declared marketCell identity.",
      ),
    );
  }
  if (pricingIncluded == null || pricingIncluded < minimumObservations!) {
    issues.push(
      buildIssue(
        "pricingBenchmark.included_sample_size",
        "pricingBenchmark included_sample_size is below the minimum observation threshold.",
      ),
    );
  }
  if (!isCanonicalIsoTimestamp(pricingValidUntil)) {
    issues.push(
      buildIssue(
        "pricingBenchmark.valid_until",
        "pricingBenchmark.valid_until must be a canonical ISO timestamp.",
      ),
    );
  } else {
    const latestAllowedPricingMs =
      Date.parse(pricingValidUntil) + maximumPricingAgeDays! * DAY_MS;
    if (Date.parse(generatedAt!) > latestAllowedPricingMs) {
      issues.push(
        buildIssue(
          "pricingBenchmark.valid_until",
          "pricingBenchmark is older than the allowed freshness window.",
        ),
      );
    }
  }

  const overviewCountry = normalizeString(marketOverviewRecord.country);
  const overviewCity = normalizeString(marketOverviewRecord.city);
  const overviewPlatform = normalizeString(marketOverviewRecord.platform);
  const overviewPropertyType = normalizeString(marketOverviewRecord.propertyType);
  const overviewCurrency = normalizeString(marketOverviewRecord.currency);
  const overviewWindowEndedAt = normalizeString(marketOverviewRecord.windowEndedAt);
  const overviewP25 =
    typeof marketOverviewRecord.p25 === "number" && Number.isFinite(marketOverviewRecord.p25)
      ? marketOverviewRecord.p25
      : null;
  const overviewMedian =
    typeof marketOverviewRecord.median === "number" &&
    Number.isFinite(marketOverviewRecord.median)
      ? marketOverviewRecord.median
      : null;
  const overviewP75 =
    typeof marketOverviewRecord.p75 === "number" && Number.isFinite(marketOverviewRecord.p75)
      ? marketOverviewRecord.p75
      : null;
  if (
    overviewCountry !== normalizedMarketCell.country ||
    overviewCity !== normalizedMarketCell.city ||
    overviewPlatform !== normalizedMarketCell.platform ||
    overviewPropertyType !== normalizedMarketCell.propertyType ||
    overviewCurrency !== normalizedMarketCell.currency
  ) {
    issues.push(
      buildIssue(
        "marketOverview",
        "marketOverview must match the declared marketCell identity.",
      ),
    );
  }
  if (
    marketOverviewRecord.capacityScope !== "all_capacities" ||
    marketOverviewRecord.platformScope !== "single_platform"
  ) {
    issues.push(
      buildIssue(
        "marketOverview",
        "marketOverview must be single_platform and all_capacities for a public market source.",
      ),
    );
  }
  if (
    marketOverviewRecord.propertyScope !== "exact" &&
    marketOverviewRecord.propertyScope !== "broader_market"
  ) {
    issues.push(
      buildIssue(
        "marketOverview.propertyScope",
        "marketOverview.propertyScope must be exact or broader_market.",
      ),
    );
  }
  if (
    overviewP25 == null ||
    overviewMedian == null ||
    overviewP75 == null ||
    overviewP25 > overviewMedian ||
    overviewMedian > overviewP75
  ) {
    issues.push(
      buildIssue(
        "marketOverview.distribution",
        "marketOverview distribution must contain ordered p25/median/p75 values.",
      ),
    );
  }
  if (!isCanonicalIsoTimestamp(overviewWindowEndedAt)) {
    issues.push(
      buildIssue(
        "marketOverview.windowEndedAt",
        "marketOverview.windowEndedAt must be a canonical ISO timestamp.",
      ),
    );
  } else {
    const latestAllowedOverviewMs =
      Date.parse(overviewWindowEndedAt) + maximumOverviewAgeDays! * DAY_MS;
    if (Date.parse(generatedAt!) > latestAllowedOverviewMs) {
      issues.push(
        buildIssue(
          "marketOverview.windowEndedAt",
          "marketOverview is older than the allowed freshness window.",
        ),
      );
    }
  }

  if (
    !requiredMetrics!.includes("pricing_benchmark") ||
    !requiredMetrics!.includes("market_overview")
  ) {
    issues.push(
      buildIssue(
        "publication.requiredMetrics",
        "requiredMetrics must include pricing_benchmark and market_overview.",
      ),
    );
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const normalized: PublicMarketReportSource = Object.freeze({
    schemaVersion: 1,
    sourceKind: PUBLIC_MARKET_REPORT_SOURCE_KIND,
    sourceVersion: PUBLIC_MARKET_REPORT_SOURCE_VERSION,
    generatedAt: generatedAt!,
    marketCell: Object.freeze({
      country: normalizedMarketCell.country!,
      city: normalizedMarketCell.city!,
      platform: normalizedMarketCell.platform!,
      propertyType: normalizedMarketCell.propertyType!,
      currency: normalizedMarketCell.currency!,
      capacityScope: "all_capacities",
    }),
    pricingBenchmark:
      pricingBenchmark as PricingBenchmarkPopulationInput["payload"],
    marketOverview:
      marketOverview as PublicMarketOverviewPopulationInput["artifact"],
    publication: Object.freeze({
      primaryLocale: primaryLocale!,
      defaultLocale: defaultLocale!,
      siteOrigin: siteOrigin!,
      canonicalSlug: canonicalSlug!,
      knownStaticRoutes: knownStaticRoutes!,
      indexOnlyWhenComplete: indexOnlyWhenComplete!,
      requiredMetrics: requiredMetrics!,
      optionalMetrics: optionalMetrics!,
    }),
    privacy: Object.freeze({
      minimumObservations: minimumObservations!,
      maximumPricingAgeDays: maximumPricingAgeDays!,
      maximumOverviewAgeDays: maximumOverviewAgeDays!,
      containsRawObservations: false,
      containsPrivateIdentifiers: false,
      provenance: provenance!,
    }),
    metadata: freezeMetadata(input.metadata),
  });

  return {
    ok: true,
    source: normalized,
  };
}

export function validatePublicMarketSource(
  input: unknown,
): PublicMarketReportSourceValidationResult {
  return parseSourceCandidate(input);
}

export function parsePublicMarketSource(
  input: unknown,
): PublicMarketReportSource {
  const validation = validatePublicMarketSource(input);
  if (!validation.ok) {
    throw new Error(
      validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    );
  }
  return validation.source;
}

export function validatePublicMarketSourcePrivacy(
  input: unknown,
): Readonly<{ ok: true; source: PublicMarketReportSource }> {
  const source = parsePublicMarketSource(input);
  assertNoForbiddenPrivateKeys(source, "source");
  return { ok: true, source };
}

export function fingerprintPublicMarketSource(input: unknown): string {
  const source = parsePublicMarketSource(input);
  return `ipp_public_market_source_${createHash("sha256")
    .update(stableStringify(source))
    .digest("hex")}`;
}

function buildPopulationInputs(
  source: PublicMarketReportSource,
): readonly [PricingBenchmarkPopulationInput, PublicMarketOverviewPopulationInput] {
  const sourceFingerprint = fingerprintPublicMarketSource(source);
  return Object.freeze([
    Object.freeze({
      source: "public_market_dataset",
      datasetType: "pricing_benchmark",
      payload: source.pricingBenchmark,
      metadata: freezeMetadata({
        sourceKind: source.sourceKind,
        sourceFingerprint,
      }),
    }),
    Object.freeze({
      source: "public_market_dataset",
      datasetType: "market_overview",
      artifact: source.marketOverview,
      metadata: freezeMetadata({
        sourceKind: source.sourceKind,
        sourceFingerprint,
      }),
    }),
  ]);
}

function buildReportDefinition(
  source: PublicMarketReportSource,
): ReturnType<typeof parseMarketReportDefinition> {
  const platformLabel =
    source.marketCell.platform.charAt(0).toUpperCase() +
    source.marketCell.platform.slice(1);
  return parseMarketReportDefinition({
    reportId: `report_${source.marketCell.city
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")}_${source.marketCell.platform}_${source.marketCell.propertyType}_${source.publication.primaryLocale}`,
    marketCellKey: source.pricingBenchmark.market_cell_key,
    city: source.marketCell.city,
    country: source.marketCell.country,
    platform: source.marketCell.platform,
    propertyType: source.marketCell.propertyType,
    language: source.publication.primaryLocale,
    title:
      source.publication.primaryLocale === "fr"
        ? `Rapport de marche ${platformLabel} ${source.marketCell.city}`
        : `${platformLabel} Market Report ${source.marketCell.city}`,
    slug: source.publication.canonicalSlug,
    reportVersion: 1,
    benchmarkFingerprint: source.pricingBenchmark.artifact_key,
    overviewFingerprint: source.marketOverview.artifactKey,
    policyVersions: Object.freeze({
      aggregation_policy: source.pricingBenchmark.aggregation_policy_version,
      approval_policy: source.pricingBenchmark.approval_policy_version,
      confidence_policy: source.pricingBenchmark.confidence_policy_version,
      freshness_policy: source.pricingBenchmark.freshness_policy_version,
      market_cell_policy: source.pricingBenchmark.market_cell_policy_version,
      overview_aggregation_policy:
        source.marketOverview.policyVersions.aggregationPolicyVersion,
      overview_governance_policy:
        source.marketOverview.policyVersions.governancePolicyVersion,
      overview_contract: source.marketOverview.policyVersions.contractVersion,
    }),
    createdAt: source.generatedAt,
    updatedAt: source.generatedAt,
    metadata: freezeMetadata({
      sourceKind: source.sourceKind,
      requiredMetrics: [...source.publication.requiredMetrics],
      optionalMetrics: [...source.publication.optionalMetrics],
    }),
  });
}

function getReportAssetKey(
  snapshot: RegistrySnapshot,
  locale: string,
): string {
  const asset = snapshot.assets.find(
    (entry) => entry.assetType === "market_report" && entry.defaultLocale === locale,
  );
  if (asset == null) {
    throw new Error(`No market_report asset was created for locale ${locale}.`);
  }
  return asset.assetId;
}

export function buildRegistrySnapshotFromPublicMarketSource(
  input: unknown,
): PublicMarketSourceBuildResult {
  const source = parsePublicMarketSource(input);
  const sourceFingerprint = fingerprintPublicMarketSource(source);
  const basePlan = buildRegistryPopulationPlan(buildPopulationInputs(source), {
    generatedAt: source.generatedAt,
    evaluatedAt: source.generatedAt,
    targetLocales: ["en"],
    composeMarketReports: false,
    metadata: freezeMetadata({
      sourceKind: source.sourceKind,
      sourceFingerprint,
      canonicalSlug: source.publication.canonicalSlug,
    }),
  });
  const withDatasets = applyRegistryPopulationPlan(basePlan);
  const reportPlan = buildRegistryPopulationPlan(
    [
      Object.freeze({
        source: "market_report_definition" as const,
        datasetType: "market_report_definition" as const,
        definition: buildReportDefinition(source),
        metadata: freezeMetadata({
          sourceKind: source.sourceKind,
          sourceFingerprint,
          canonicalSlug: source.publication.canonicalSlug,
        }),
      }),
    ],
    {
      generatedAt: source.generatedAt,
      evaluatedAt: source.generatedAt,
      targetLocales: [source.publication.primaryLocale],
      composeMarketReports: false,
      metadata: freezeMetadata({
        sourceKind: source.sourceKind,
        sourceFingerprint,
        canonicalSlug: source.publication.canonicalSlug,
      }),
    },
  );
  const applied = applyRegistryPopulationPlan(
    reportPlan,
    withDatasets.nextSnapshot,
  );
  const registrySnapshot = parseRegistrySnapshot(applied.nextSnapshot);
  assertRegistrySnapshotPublicSafe(registrySnapshot);
  const reportAssetKey = getReportAssetKey(
    registrySnapshot,
    source.publication.primaryLocale,
  );
  const snapshotFingerprint = buildRegistrySnapshotFingerprint(registrySnapshot);

  return Object.freeze({
    source,
    sourceFingerprint,
    registrySnapshot,
    snapshotFingerprint,
    reportAssetKey,
  });
}

export function buildMarketReportBundleFromPublicMarketSource(
  input: unknown,
): Readonly<
  PublicMarketSourceBuildResult & {
    bundle: MarketReportArtifactBundle;
  }
> {
  const base = buildRegistrySnapshotFromPublicMarketSource(input);
  const bundle = generateMarketReportDocument({
    registrySnapshot: base.registrySnapshot,
    reportAssetKey: base.reportAssetKey,
    locale: base.source.publication.primaryLocale,
    generatedAt: base.source.generatedAt,
    canonicalBaseUrl: base.source.publication.siteOrigin,
    options: {
      strictCompleteness: false,
      supportedLocales: [base.source.publication.primaryLocale],
      completenessPolicy: {
        requireOverview: base.source.publication.requiredMetrics.includes(
          "market_overview",
        ),
        requirePricing: base.source.publication.requiredMetrics.includes(
          "pricing_benchmark",
        ),
        requireOccupancy:
          base.source.publication.indexOnlyWhenComplete ||
          base.source.publication.requiredMetrics.includes(
            "occupancy_benchmark",
          ),
        allowPartialReport: true,
        minimumSectionCount: 5,
      },
      metadata: freezeMetadata({
        sourceKind: base.source.sourceKind,
        sourceFingerprint: base.sourceFingerprint,
      }),
    },
  });
  const validation = validateMarketReportArtifactBundle(bundle);
  if (!validation.ok) {
    throw new Error(
      validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    );
  }
  if (bundle.document.identity.reportSlug !== base.source.publication.canonicalSlug) {
    throw new Error(
      `Expected canonical slug ${base.source.publication.canonicalSlug}, received ${bundle.document.identity.reportSlug}.`,
    );
  }
  return Object.freeze({
    ...base,
    bundle: validation.bundle,
  });
}
