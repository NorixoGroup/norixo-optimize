import { createHash } from "node:crypto";

import type { CoordinationJsonObject, CoordinationJsonValue } from "./distributedCoordination";
import {
  buildMarketReportFingerprint,
  parseMarketReportDefinition,
  type MarketReportDefinition,
} from "./marketReportPilot";
import {
  PERSISTENT_REGISTRY_SNAPSHOT_ID,
  type PersistentRegistryRepository,
  type PersistentRegistryWriteResult,
  type RegistryWriteOptions,
} from "./persistentRegistry";
import {
  assertRegistrySnapshotPublicSafe,
  buildRegistrySnapshotFingerprint,
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
  type RegistryArtifactReference,
  type RegistryArtifactType,
  type RegistryAsset,
  type RegistryAssetStatus,
  type RegistryAssetType,
  type RegistryAssetVersion,
  type RegistryAssetVersionStatus,
  type RegistryConfidenceBand,
  type RegistryFreshnessState,
  type RegistryPublicationState,
  type RegistrySnapshot,
} from "./registryAdapter";
import {
  buildPublicSafePopulationArtifacts,
  type OccupancyBenchmarkPopulationInput,
  type PricingBenchmarkPopulationInput,
  type PublicMarketOverviewPopulationInput,
  type PublicSafePopulationInput,
} from "./populationSources/publicMarketDatasetPopulation";

export const REGISTRY_POPULATION_SOURCES = Object.freeze([
  "intelligence_v2_aggregate",
  "anonymous_market_facts",
  "market_memory",
  "public_market_dataset",
  "market_report_definition",
  "admin_curated",
  "static_public_dataset",
] as const);

export type RegistryPopulationSource =
  (typeof REGISTRY_POPULATION_SOURCES)[number];

export type RegistryPopulationMarket = Readonly<{
  country: string;
  countryCode?: string | null;
  city: string;
  citySlug: string;
  marketCellKey: string;
  locale?: string | null;
}>;

export type RegistryPopulationMetric = Readonly<{
  metricKey: string;
  metricFamily: string;
  value: string | number | boolean;
  unit: string | null;
  band: string | null;
  period: string;
  sampleSizeBand: string | null;
  confidenceBand: RegistryConfidenceBand;
  sourceClass: string;
  metadata: CoordinationJsonObject;
}>;

export type PublicMarketFact = Readonly<{
  factId: string;
  source: RegistryPopulationSource;
  market: RegistryPopulationMarket;
  metricFamily: string;
  metricKey: string;
  value: string | number | boolean;
  unit: string | null;
  band: string | null;
  periodBucket: string;
  platform: string;
  propertyType: string;
  capacityBand: string;
  sampleSizeBand: string | null;
  confidenceBand: RegistryConfidenceBand;
  sourceClass: string;
  sourceFingerprint: string;
  capturedAt: string;
  policyVersions: Readonly<Record<string, string>>;
  metadata: CoordinationJsonObject;
}>;

export type RegistryPopulationDiagnosticCode =
  | "invalid_source_input"
  | "private_field_detected"
  | "unsupported_metric"
  | "missing_market_identity"
  | "missing_confidence"
  | "stale_source"
  | "duplicate_fact"
  | "conflicting_fact"
  | "asset_unchanged"
  | "asset_version_created"
  | "freshness_only_change"
  | "metadata_only_change"
  | "contribution_skipped"
  | "unsupported_source"
  | "invalid_market_report"
  | "persistence_conflict";

export type RegistryPopulationDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export type RegistryPopulationDiagnostic = Readonly<{
  code: RegistryPopulationDiagnosticCode;
  severity: RegistryPopulationDiagnosticSeverity;
  source: RegistryPopulationSource | "registry_population";
  marketCellKey: string | null;
  assetKey: string | null;
  path: string | null;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type RegistryPopulationErrorCode =
  | "invalid_input"
  | "invalid_public_fact"
  | "invalid_contribution"
  | "invalid_plan"
  | "invalid_result"
  | "private_field_detected"
  | "unsupported_source"
  | "unsupported_metric"
  | "conflicting_fact"
  | "invalid_existing_snapshot"
  | "persistence_error"
  | "snapshot_conflict"
  | "mapping_error";

export class RegistryPopulationError extends Error {
  readonly code: RegistryPopulationErrorCode;
  readonly operation: string;
  readonly source?: RegistryPopulationSource;
  readonly marketCellKey?: string;
  readonly assetKey?: string;
  readonly path?: string;
  readonly cause?: unknown;

  constructor(
    input: Readonly<{
      code: RegistryPopulationErrorCode;
      operation: string;
      message: string;
      source?: RegistryPopulationSource;
      marketCellKey?: string;
      assetKey?: string;
      path?: string;
      cause?: unknown;
    }>,
  ) {
    super(input.message);
    this.name = "RegistryPopulationError";
    this.code = input.code;
    this.operation = input.operation;
    this.source = input.source;
    this.marketCellKey = input.marketCellKey;
    this.assetKey = input.assetKey;
    this.path = input.path;
    this.cause = input.cause;
  }
}

export type RegistryPopulationArtifactReferenceDraft = Readonly<{
  artifactType: RegistryArtifactType;
  artifactId: string;
  artifactFingerprint: string;
  relationshipType: RegistryArtifactReference["relationshipType"];
  policyVersions: Readonly<Record<string, string>>;
  createdAt: string;
  metadata: CoordinationJsonObject;
}>;

export type RegistryPopulationFreshnessPolicy = Readonly<{
  freshForDays: number;
  agingForDays: number;
  staleAfterDays: number;
}>;

export type RegistryPopulationFreshnessDraft = Readonly<{
  computedAt: string;
  reviewDueAt: string | null;
  publishableUntil: string | null;
  staleAfter: string | null;
  expiredAfter: string | null;
  isPublishable: boolean;
  isStale: boolean;
  isExpired: boolean;
  evaluatedAt: string;
}>;

export type RegistryPopulationAssetKind =
  | "market_overview"
  | "market_pricing_benchmark"
  | "market_occupancy_benchmark"
  | "market_report";

export type RegistryPopulationContribution = Readonly<{
  contributionId: string;
  source: RegistryPopulationSource;
  sourceFingerprint: string;
  assetId: string;
  assetKind: RegistryPopulationAssetKind;
  assetType: RegistryAssetType;
  contentFingerprint: string;
  versionComparisonFingerprint: string;
  market: RegistryPopulationMarket;
  effectiveAt: string;
  policyVersions: Readonly<Record<string, string>>;
  confidenceBand: RegistryConfidenceBand;
  assetStatus: RegistryAssetStatus;
  assetVisibility: RegistryAsset["visibility"];
  versionStatus: RegistryAssetVersionStatus;
  defaultLocale: string;
  availableLocales: readonly string[];
  availableChannels: readonly string[];
  canonicalId: string;
  templateId: string | null;
  ownerTeam: string;
  confidenceAffectsVisibleContent: boolean;
  policyChangeAffectsVisibleContent: boolean;
  freshnessExpiryBehavior: RegistryAsset["freshnessExpiryBehavior"];
  content: CoordinationJsonObject;
  assetMetadata: CoordinationJsonObject;
  versionMetadata: CoordinationJsonObject;
  artifactReferences: readonly RegistryPopulationArtifactReferenceDraft[];
  freshness: RegistryPopulationFreshnessDraft;
  reportDefinition: MarketReportDefinition | null;
}>;

export type RegistryPopulationSkippedInput = Readonly<{
  source: RegistryPopulationSource;
  inputFingerprint: string;
  reasonCode: RegistryPopulationDiagnosticCode;
  marketCellKey: string | null;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type RegistryPopulationPlan = Readonly<{
  planId: string;
  inputFingerprint: string;
  generatedAt: string;
  evaluatedAt: string;
  facts: readonly PublicMarketFact[];
  contributions: readonly RegistryPopulationContribution[];
  skippedInputs: readonly RegistryPopulationSkippedInput[];
  diagnostics: readonly RegistryPopulationDiagnostic[];
  policyVersions: Readonly<Record<string, string>>;
  metadata: CoordinationJsonObject;
}>;

export type RegistryPopulationChangeKind =
  | "new_asset"
  | "new_version"
  | "unchanged"
  | "freshness_only_change"
  | "metadata_only_change";

export type RegistryPopulationChange = Readonly<{
  assetKey: string;
  kind: RegistryPopulationChangeKind;
  previousVersionKey: string | null;
  nextVersionKey: string;
}>;

export type RegistryPopulationResult = Readonly<{
  plan: RegistryPopulationPlan;
  previousSnapshotFingerprint: string | null;
  nextSnapshot: RegistrySnapshot;
  nextSnapshotFingerprint: string;
  changedAssetKeys: readonly string[];
  unchangedAssetKeys: readonly string[];
  supersededVersionKeys: readonly string[];
  changes: readonly RegistryPopulationChange[];
  diagnostics: readonly RegistryPopulationDiagnostic[];
}>;

export type RegistryPopulationPersistResult = Readonly<{
  result: RegistryPopulationResult;
  writeResult: PersistentRegistryWriteResult;
  reloadedSnapshot: RegistrySnapshot;
  reloadedSnapshotFingerprint: string;
}>;

export type RegistryPopulationOptions = Readonly<{
  generatedAt: string;
  evaluatedAt: string;
  targetLocales?: readonly string[];
  targetChannels?: readonly string[];
  freshnessPolicy?: RegistryPopulationFreshnessPolicy;
  policyVersions?: Readonly<Record<string, string>>;
  metadata?: CoordinationJsonObject;
  composeMarketReports?: boolean;
}>;

export type RegistryPopulationInput =
  | PublicSafePopulationInput
  | Readonly<{
      source: "market_report_definition";
      datasetType: "market_report_definition";
      definition: MarketReportDefinition;
      metadata?: CoordinationJsonObject;
    }>;

type RegistryPopulationIndexes = Readonly<{
  assetById: ReadonlyMap<string, RegistryAsset>;
  versionsByAssetId: ReadonlyMap<string, readonly RegistryAssetVersion[]>;
  versionById: ReadonlyMap<string, RegistryAssetVersion>;
  referencesByAssetId: ReadonlyMap<string, readonly RegistryArtifactReference[]>;
  freshnessByAssetId: ReadonlyMap<string, readonly RegistryFreshnessState[]>;
  publicationStatesByAssetId: ReadonlyMap<string, readonly RegistryPublicationState[]>;
}>;

type ApplyContributionResult = Readonly<{
  asset: RegistryAsset;
  versions: readonly RegistryAssetVersion[];
  artifactReferences: readonly RegistryArtifactReference[];
  freshnessStates: readonly RegistryFreshnessState[];
  publicationStates: readonly RegistryPublicationState[];
  change: RegistryPopulationChange;
  supersededVersionKey: string | null;
  diagnostics: readonly RegistryPopulationDiagnostic[];
}>;

type ComparisonSnapshot = Readonly<{
  asset: RegistryAsset;
  version: RegistryAssetVersion;
  artifactReferences: readonly RegistryArtifactReference[];
  freshness: RegistryFreshnessState | null;
}>;

type ContributionVersionMaterialization = Readonly<{
  versionId: string;
  versionNumber: number;
  version: RegistryAssetVersion;
  artifactReferences: readonly RegistryArtifactReference[];
  freshness: RegistryFreshnessState;
}>;

type PublicSafePopulationArtifacts = ReturnType<
  typeof buildPublicSafePopulationArtifacts
>;

const DEFAULT_FRESHNESS_POLICY = Object.freeze({
  freshForDays: 7,
  agingForDays: 30,
  staleAfterDays: 90,
} satisfies RegistryPopulationFreshnessPolicy);

const PRIVATE_KEY_BLACKLIST = new Set(
  [
    "userId",
    "user_id",
    "workspaceId",
    "workspace_id",
    "auditId",
    "audit_id",
    "listingId",
    "listing_id",
    "listingUrl",
    "listing_url",
    "sourceUrl",
    "source_url",
    "url",
    "privateTitle",
    "private_title",
    "privateDescription",
    "private_description",
    "privateImageUrl",
    "private_image_url",
    "image",
    "images",
    "photo",
    "photos",
    "email",
    "guestName",
    "guest_name",
    "hostName",
    "host_name",
    "customerName",
    "customer_name",
    "accessToken",
    "access_token",
    "refreshToken",
    "refresh_token",
    "apiKey",
    "api_key",
    "authorization",
    "rawPayload",
    "raw_payload",
    "rawObservation",
    "raw_observation",
    "comparableUrl",
    "comparable_url",
    "bookingId",
    "booking_id",
    "reservationId",
    "reservation_id",
    "latitude",
    "longitude",
    "lat",
    "lng",
  ].map(normalizePrivacyKey),
);

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value != null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort((left, right) => compareStrings(left[0], right[0]))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashFingerprint(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function freezeMetadata(metadata: CoordinationJsonObject | undefined): CoordinationJsonObject {
  return Object.freeze({ ...(metadata ?? {}) });
}

function uniqueSortedStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareStrings));
}

function sortStringRecord(
  input: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(input).sort((left, right) => compareStrings(left[0], right[0])),
    ),
  );
}

function normalizePrivacyKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
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

function assertCanonicalTimestamp(
  value: string,
  operation: string,
  path: string,
): void {
  if (!isCanonicalIsoTimestamp(value)) {
    throw new RegistryPopulationError({
      code: "invalid_input",
      operation,
      path,
      message: `Expected a canonical ISO UTC timestamp at ${path}.`,
    });
  }
}

function assertJsonSafe(
  value: unknown,
  operation: string,
  path: string,
): asserts value is CoordinationJsonValue {
  if (!isJsonSafe(value)) {
    throw new RegistryPopulationError({
      code: "invalid_input",
      operation,
      path,
      message: `Expected JSON-safe metadata at ${path}.`,
    });
  }
}

function assertNoPrivateFields(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertNoPrivateFields(value[index], `${path}[${index}]`);
    }
    return;
  }

  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value.trim())) {
      throw new RegistryPopulationError({
        code: "private_field_detected",
        operation: "validateRegistryPopulationPrivacy",
        path,
        message: `Forbidden URL-like value detected at ${path}.`,
      });
    }
    return;
  }

  if (typeof value !== "object" || value == null) {
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = path.length === 0 ? key : `${path}.${key}`;
    if (PRIVATE_KEY_BLACKLIST.has(normalizePrivacyKey(key))) {
      throw new RegistryPopulationError({
        code: "private_field_detected",
        operation: "validateRegistryPopulationPrivacy",
        path: nextPath,
        message: `Forbidden private field detected at ${nextPath}.`,
      });
    }
    assertNoPrivateFields(child, nextPath);
  }
}

export function validateRegistryPopulationPrivacy(value: unknown): void {
  assertNoPrivateFields(value, "$");
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function sanitizeIdentifier(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function buildPopulationDiagnostic(
  input: Readonly<{
    code: RegistryPopulationDiagnosticCode;
    severity: RegistryPopulationDiagnosticSeverity;
    source: RegistryPopulationSource | "registry_population";
    marketCellKey?: string | null;
    assetKey?: string | null;
    path?: string | null;
    message: string;
    metadata?: CoordinationJsonObject;
  }>,
): RegistryPopulationDiagnostic {
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    source: input.source,
    marketCellKey: input.marketCellKey ?? null,
    assetKey: input.assetKey ?? null,
    path: input.path ?? null,
    message: input.message,
    metadata: freezeMetadata(input.metadata),
  });
}

function mapConfidenceBand(input: string): RegistryConfidenceBand {
  switch (input) {
    case "very_high":
      return "very_high";
    case "high":
      return "high";
    case "moderate":
    case "standard":
      return "moderate";
    case "low":
    case "very_low":
      return "low";
    default:
      return "unknown";
  }
}

function buildEmptySnapshot(generatedAt: string): RegistrySnapshot {
  return normalizeRegistrySnapshot(
    parseRegistrySnapshot({
      snapshotId: PERSISTENT_REGISTRY_SNAPSHOT_ID,
      snapshotVersion: 1,
      generatedAt,
      assets: [],
      assetVersions: [],
      artifactReferences: [],
      channelVariants: [],
      freshnessStates: [],
      publicationStates: [],
      policyVersions: {},
      metadata: {},
    }),
  );
}

function buildIndexes(snapshot: RegistrySnapshot): RegistryPopulationIndexes {
  const assetById = new Map<string, RegistryAsset>();
  const versionById = new Map<string, RegistryAssetVersion>();
  const versionsByAssetId = new Map<string, RegistryAssetVersion[]>();
  const referencesByAssetId = new Map<string, RegistryArtifactReference[]>();
  const freshnessByAssetId = new Map<string, RegistryFreshnessState[]>();
  const publicationStatesByAssetId = new Map<string, RegistryPublicationState[]>();

  for (const asset of snapshot.assets) {
    assetById.set(asset.assetId, asset);
  }
  for (const version of snapshot.assetVersions) {
    versionById.set(version.assetVersionId, version);
    const existing = versionsByAssetId.get(version.assetId) ?? [];
    existing.push(version);
    versionsByAssetId.set(version.assetId, existing);
  }
  for (const reference of snapshot.artifactReferences) {
    const existing = referencesByAssetId.get(reference.assetId) ?? [];
    existing.push(reference);
    referencesByAssetId.set(reference.assetId, existing);
  }
  for (const freshness of snapshot.freshnessStates) {
    const existing = freshnessByAssetId.get(freshness.assetId) ?? [];
    existing.push(freshness);
    freshnessByAssetId.set(freshness.assetId, existing);
  }
  for (const publication of snapshot.publicationStates) {
    const existing = publicationStatesByAssetId.get(publication.assetId) ?? [];
    existing.push(publication);
    publicationStatesByAssetId.set(publication.assetId, existing);
  }

  return Object.freeze({
    assetById,
    versionById,
    versionsByAssetId: new Map(
      [...versionsByAssetId.entries()].map(([assetId, versions]) => [
        assetId,
        Object.freeze([...versions].sort((left, right) => left.versionNumber - right.versionNumber)),
      ]),
    ),
    referencesByAssetId: new Map(
      [...referencesByAssetId.entries()].map(([assetId, references]) => [
        assetId,
        Object.freeze([...references].sort((left, right) => compareStrings(left.referenceId, right.referenceId))),
      ]),
    ),
    freshnessByAssetId: new Map(
      [...freshnessByAssetId.entries()].map(([assetId, states]) => [
        assetId,
        Object.freeze(
          [...states].sort((left, right) =>
            compareStrings(
              `${left.assetVersionId ?? ""}:${left.computedAt}`,
              `${right.assetVersionId ?? ""}:${right.computedAt}`,
            ),
          ),
        ),
      ]),
    ),
    publicationStatesByAssetId: new Map(
      [...publicationStatesByAssetId.entries()].map(([assetId, states]) => [
        assetId,
        Object.freeze(
          [...states].sort((left, right) =>
            compareStrings(
              `${left.assetVersionId}:${left.locale}:${left.channel}`,
              `${right.assetVersionId}:${right.locale}:${right.channel}`,
            ),
          ),
        ),
      ]),
    ),
  });
}

function buildVersionId(assetId: string, versionNumber: number): string {
  return `${assetId}_v${versionNumber}`;
}

function buildReferenceId(
  assetId: string,
  assetVersionId: string,
  draft: RegistryPopulationArtifactReferenceDraft,
): string {
  return `ref_${sanitizeIdentifier(assetId)}_${createHash("sha256")
    .update(
      [
        assetVersionId,
        draft.artifactType,
        draft.artifactId,
        draft.artifactFingerprint,
        draft.relationshipType,
      ].join("||"),
    )
    .digest("hex")
    .slice(0, 16)}`;
}

function buildReportDefinitionFingerprint(
  definition: MarketReportDefinition,
): string {
  return buildMarketReportFingerprint(definition);
}

function addDays(timestamp: string, days: number): string {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function buildMarketOverviewAssetId(marketCellKey: string): string {
  return `asset_market_overview_${sanitizeIdentifier(marketCellKey)}`;
}

function buildMarketPricingAssetId(marketCellKey: string): string {
  return `asset_market_pricing_${sanitizeIdentifier(marketCellKey)}`;
}

function buildMarketOccupancyAssetId(marketCellKey: string): string {
  return `asset_market_occupancy_${sanitizeIdentifier(marketCellKey)}`;
}

function buildMarketReportAssetIdFromDefinition(
  definition: MarketReportDefinition,
): string {
  return `asset_market_report_${sanitizeIdentifier(definition.reportId)}`;
}

function buildComparisonFingerprint(
  contribution: Omit<
    RegistryPopulationContribution,
    "contributionId" | "versionComparisonFingerprint"
  > & {
    contributionId?: string;
  },
): string {
  return hashFingerprint("ipp_registry_population_version", {
    assetId: contribution.assetId,
    assetKind: contribution.assetKind,
    contentFingerprint: contribution.contentFingerprint,
    sourceFingerprint: contribution.sourceFingerprint,
    confidenceBand: contribution.confidenceBand,
    policyVersions: contribution.policyVersions,
    content: contribution.content,
    assetMetadata: contribution.assetMetadata,
    versionMetadata: contribution.versionMetadata,
    artifactReferences: contribution.artifactReferences,
  });
}

function normalizeFreshnessPolicy(
  policy?: RegistryPopulationFreshnessPolicy,
): RegistryPopulationFreshnessPolicy {
  const value = policy ?? DEFAULT_FRESHNESS_POLICY;
  return Object.freeze({
    freshForDays: value.freshForDays,
    agingForDays: value.agingForDays,
    staleAfterDays: value.staleAfterDays,
  });
}

function buildPublicMarketReportDefinition(input: Readonly<{
  market: RegistryPopulationMarket;
  locale: string;
  platform: string;
  propertyType: string;
  benchmarkFingerprint: string;
  overviewFingerprint: string;
  occupancyFingerprint?: string | null;
  policyVersions: Readonly<Record<string, string>>;
  createdAt: string;
  updatedAt: string;
}>): MarketReportDefinition {
  const citySlug = input.market.citySlug;
  const platform = sanitizeSegment(input.platform);
  const propertyType = sanitizeSegment(input.propertyType);
  const titlePlatform = input.platform.charAt(0).toUpperCase() + input.platform.slice(1);

  return parseMarketReportDefinition({
    reportId: `report_${citySlug}_${platform}_${propertyType}_${sanitizeSegment(input.locale)}`,
    marketCellKey: input.market.marketCellKey,
    city: input.market.city,
    country: input.market.country,
    platform: input.platform,
    propertyType: input.propertyType,
    language: input.locale,
    title: `${titlePlatform} Market Report ${input.market.city}`,
    slug: `${platform}-market-report-${citySlug}-${propertyType}`,
    reportVersion: 1,
    benchmarkFingerprint: input.benchmarkFingerprint,
    overviewFingerprint: input.overviewFingerprint,
    policyVersions: input.policyVersions,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    metadata: freezeMetadata({
      source: "registry_population",
      ...(input.occupancyFingerprint == null
        ? {}
        : { occupancyFingerprint: input.occupancyFingerprint }),
    }),
  });
}

function buildMarketReportContribution(
  definition: MarketReportDefinition,
  generatedAt: string,
): RegistryPopulationContribution {
  const occupancyFingerprint =
    typeof definition.metadata.occupancyFingerprint === "string" &&
    definition.metadata.occupancyFingerprint.trim().length > 0
      ? definition.metadata.occupancyFingerprint.trim()
      : null;
  const content = freezeMetadata({
    reportId: definition.reportId,
    marketCellKey: definition.marketCellKey,
    city: definition.city,
    country: definition.country,
    platform: definition.platform,
    propertyType: definition.propertyType,
    language: definition.language,
    title: definition.title,
    slug: definition.slug,
    benchmarkFingerprint: definition.benchmarkFingerprint,
    overviewFingerprint: definition.overviewFingerprint,
  });
  const sourceFingerprint = hashFingerprint("ipp_market_report_source", {
    benchmarkFingerprint: definition.benchmarkFingerprint,
    overviewFingerprint: definition.overviewFingerprint,
    occupancyFingerprint,
    policyVersions: definition.policyVersions,
  });

  const baseContribution = {
    source: "market_report_definition" as const,
    sourceFingerprint,
    assetId: buildMarketReportAssetIdFromDefinition(definition),
    assetKind: "market_report" as const,
    assetType: "market_report" as const,
    contentFingerprint: buildReportDefinitionFingerprint(definition),
    market: Object.freeze({
      country: definition.country,
      city: definition.city,
      citySlug: sanitizeSegment(definition.city),
      marketCellKey: definition.marketCellKey,
      locale: definition.language,
    }),
    effectiveAt: definition.updatedAt,
    policyVersions: sortStringRecord(definition.policyVersions),
    confidenceBand: "high" as const,
    assetStatus: "generated" as const,
    assetVisibility: "public" as const,
    versionStatus: "active" as const,
    defaultLocale: definition.language,
    availableLocales: Object.freeze([definition.language]),
    availableChannels: Object.freeze(["newsletter", "web"]),
    canonicalId: definition.slug,
    templateId: "tpl_market_report",
    ownerTeam: "intelligence",
    confidenceAffectsVisibleContent: true,
    policyChangeAffectsVisibleContent: true,
    freshnessExpiryBehavior: "keep_visible" as const,
    content,
    assetMetadata: freezeMetadata({
      marketCellKey: definition.marketCellKey,
      city: definition.city,
      country: definition.country,
      platform: definition.platform,
      propertyType: definition.propertyType,
      reportSlug: definition.slug,
      reportLanguage: definition.language,
      source: "registry_population",
    }),
    versionMetadata: freezeMetadata({
      reportId: definition.reportId,
      title: definition.title,
      slug: definition.slug,
      populationGeneratedAt: generatedAt,
    }),
    artifactReferences: Object.freeze([
      Object.freeze({
        artifactType: "benchmark" as const,
        artifactId: `benchmark:${definition.marketCellKey}:pricing`,
        artifactFingerprint: definition.benchmarkFingerprint,
        relationshipType: "supported_by" as const,
        policyVersions: sortStringRecord(definition.policyVersions),
        createdAt: definition.updatedAt,
        metadata: freezeMetadata({ source: "pricing_benchmark" }),
      }),
      Object.freeze({
        artifactType: "public_overview" as const,
        artifactId: `overview:${definition.country}:${definition.city}:${definition.platform}:${definition.propertyType}`,
        artifactFingerprint: definition.overviewFingerprint,
        relationshipType: "supported_by" as const,
        policyVersions: sortStringRecord(definition.policyVersions),
        createdAt: definition.updatedAt,
        metadata: freezeMetadata({ source: "public_market_overview" }),
      }),
      ...(occupancyFingerprint == null
        ? []
        : [
            Object.freeze({
              artifactType: "benchmark" as const,
              artifactId: `benchmark:${definition.marketCellKey}:occupancy`,
              artifactFingerprint: occupancyFingerprint,
              relationshipType: "supported_by" as const,
              policyVersions: sortStringRecord(definition.policyVersions),
              createdAt: definition.updatedAt,
              metadata: freezeMetadata({ source: "occupancy_benchmark" }),
            }),
          ]),
      ...Object.entries(definition.policyVersions).map(([policyId, version]) =>
        Object.freeze({
          artifactType: "policy" as const,
          artifactId: policyId,
          artifactFingerprint: `${policyId}:${version}`,
          relationshipType: "governed_by" as const,
          policyVersions: sortStringRecord(definition.policyVersions),
          createdAt: definition.updatedAt,
          metadata: freezeMetadata({}),
        }),
      ),
    ]),
    freshness: Object.freeze({
      computedAt: definition.updatedAt,
      reviewDueAt: addDays(definition.updatedAt, DEFAULT_FRESHNESS_POLICY.freshForDays),
      publishableUntil: addDays(definition.updatedAt, DEFAULT_FRESHNESS_POLICY.staleAfterDays),
      staleAfter: addDays(definition.updatedAt, DEFAULT_FRESHNESS_POLICY.agingForDays),
      expiredAfter: addDays(definition.updatedAt, DEFAULT_FRESHNESS_POLICY.staleAfterDays),
      isPublishable: true,
      isStale: false,
      isExpired: false,
      evaluatedAt: generatedAt,
    }),
    reportDefinition: definition,
  };

  return Object.freeze({
    contributionId: hashFingerprint("ipp_market_report_contribution", {
      assetId: baseContribution.assetId,
      contentFingerprint: baseContribution.contentFingerprint,
      sourceFingerprint,
    }),
    ...baseContribution,
    versionComparisonFingerprint: buildComparisonFingerprint(baseContribution),
  });
}

function materializeContributionVersion(
  contribution: RegistryPopulationContribution,
  versionId: string,
  versionNumber: number,
  createdAt: string,
  previousVersion: RegistryAssetVersion | null,
): ContributionVersionMaterialization {
  const versionMetadata = freezeMetadata({
    ...contribution.versionMetadata,
    contentSnapshot: contribution.content,
    populationVersionFingerprint: contribution.versionComparisonFingerprint,
    populationContentFingerprint: contribution.contentFingerprint,
    populationSourceFingerprint: contribution.sourceFingerprint,
  });

  const version = Object.freeze({
    assetVersionId: versionId,
    assetId: contribution.assetId,
    versionNumber,
    status: contribution.versionStatus,
    contentFingerprint: contribution.contentFingerprint,
    sourceFingerprint: contribution.sourceFingerprint,
    templateFingerprint:
      contribution.templateId == null
        ? "registry_population_template_v1"
        : `${contribution.templateId}_v1`,
    rendererFingerprint: `registry_population_renderer_${contribution.defaultLocale}`,
    policyVersions: contribution.policyVersions,
    confidenceBand: contribution.confidenceBand,
    createdAt,
    approvedAt: contribution.effectiveAt,
    publishedAt: previousVersion?.publishedAt ?? null,
    supersededAt: null,
    metadata: versionMetadata,
  } satisfies RegistryAssetVersion);

  const references = Object.freeze(
    contribution.artifactReferences.map((draft) =>
      Object.freeze({
        referenceId: buildReferenceId(contribution.assetId, versionId, draft),
        assetId: contribution.assetId,
        assetVersionId: versionId,
        artifactType: draft.artifactType,
        artifactId: draft.artifactId,
        artifactFingerprint: draft.artifactFingerprint,
        relationshipType: draft.relationshipType,
        policyVersions: draft.policyVersions,
        createdAt: draft.createdAt,
        metadata: draft.metadata,
      } satisfies RegistryArtifactReference),
    ),
  );

  const freshness = Object.freeze({
    assetId: contribution.assetId,
    assetVersionId: versionId,
    computedAt: contribution.freshness.computedAt,
    reviewDueAt: contribution.freshness.reviewDueAt,
    publishableUntil: contribution.freshness.publishableUntil,
    staleAfter: contribution.freshness.staleAfter,
    expiredAfter: contribution.freshness.expiredAfter,
    isPublishable: contribution.freshness.isPublishable,
    isStale: contribution.freshness.isStale,
    isExpired: contribution.freshness.isExpired,
    evaluatedAt: contribution.freshness.evaluatedAt,
  } satisfies RegistryFreshnessState);

  return Object.freeze({
    versionId,
    versionNumber,
    version,
    artifactReferences: references,
    freshness,
  });
}

function buildAssetForContribution(
  contribution: RegistryPopulationContribution,
  activeVersionId: string,
  createdAt: string,
  updatedAt: string,
): RegistryAsset {
  return Object.freeze({
    assetId: contribution.assetId,
    canonicalId: contribution.canonicalId,
    assetType: contribution.assetType,
    status: contribution.assetStatus,
    visibility: contribution.assetVisibility,
    defaultLocale: contribution.defaultLocale,
    availableLocales: contribution.availableLocales,
    availableChannels: contribution.availableChannels,
    activeVersionId,
    templateId: contribution.templateId,
    ownerTeam: contribution.ownerTeam,
    confidenceAffectsVisibleContent:
      contribution.confidenceAffectsVisibleContent,
    policyChangeAffectsVisibleContent:
      contribution.policyChangeAffectsVisibleContent,
    freshnessExpiryBehavior: contribution.freshnessExpiryBehavior,
    createdAt,
    updatedAt,
    metadata: freezeMetadata({
      ...contribution.assetMetadata,
      assetKind: contribution.assetKind,
      marketCellKey: contribution.market.marketCellKey,
      city: contribution.market.city,
      country: contribution.market.country,
      locale: contribution.market.locale ?? contribution.defaultLocale,
    }),
  });
}

function buildContributionMarketGroupKey(
  contribution: RegistryPopulationContribution,
): string {
  const metadata = contribution.assetMetadata as Record<string, unknown>;
  return [
    contribution.market.country,
    contribution.market.city,
    String(metadata.platform ?? "unknown"),
    String(metadata.propertyType ?? "unknown"),
    contribution.defaultLocale,
  ].join("|");
}

function filterReferencesExcludingCurrentVersion(
  references: readonly RegistryArtifactReference[],
  activeVersionId: string | null,
): readonly RegistryArtifactReference[] {
  return Object.freeze(
    references.filter(
      (reference) =>
        activeVersionId == null ||
        (reference.assetVersionId !== activeVersionId &&
          reference.assetVersionId != null),
    ),
  );
}

function buildComparisonSnapshot(
  asset: RegistryAsset,
  version: RegistryAssetVersion,
  references: readonly RegistryArtifactReference[],
  freshness: RegistryFreshnessState | null,
): ComparisonSnapshot {
  return Object.freeze({
    asset,
    version,
    artifactReferences: Object.freeze(
      [...references].sort((left, right) => compareStrings(left.referenceId, right.referenceId)),
    ),
    freshness,
  });
}

function buildComparisonFingerprintFromSnapshot(
  snapshot: ComparisonSnapshot,
): string {
  return hashFingerprint("ipp_registry_population_materialized", {
    asset: {
      assetId: snapshot.asset.assetId,
      canonicalId: snapshot.asset.canonicalId,
      assetType: snapshot.asset.assetType,
      status: snapshot.asset.status,
      visibility: snapshot.asset.visibility,
      defaultLocale: snapshot.asset.defaultLocale,
      availableLocales: snapshot.asset.availableLocales,
      availableChannels: snapshot.asset.availableChannels,
      templateId: snapshot.asset.templateId,
      ownerTeam: snapshot.asset.ownerTeam,
      confidenceAffectsVisibleContent:
        snapshot.asset.confidenceAffectsVisibleContent,
      policyChangeAffectsVisibleContent:
        snapshot.asset.policyChangeAffectsVisibleContent,
      freshnessExpiryBehavior: snapshot.asset.freshnessExpiryBehavior,
      metadata: snapshot.asset.metadata,
    },
    version: {
      contentFingerprint: snapshot.version.contentFingerprint,
      sourceFingerprint: snapshot.version.sourceFingerprint,
      templateFingerprint: snapshot.version.templateFingerprint,
      rendererFingerprint: snapshot.version.rendererFingerprint,
      policyVersions: snapshot.version.policyVersions,
      confidenceBand: snapshot.version.confidenceBand,
      metadata: snapshot.version.metadata,
    },
    references: snapshot.artifactReferences.map((reference) => ({
      artifactType: reference.artifactType,
      artifactId: reference.artifactId,
      artifactFingerprint: reference.artifactFingerprint,
      relationshipType: reference.relationshipType,
      policyVersions: reference.policyVersions,
      metadata: reference.metadata,
    })),
  });
}

function buildFreshnessFingerprint(
  freshness: RegistryFreshnessState | null,
): string {
  return hashFingerprint("ipp_registry_population_freshness", freshness ?? null);
}

function applyContributionToSnapshot(
  contribution: RegistryPopulationContribution,
  currentSnapshot: RegistrySnapshot,
  indexes: RegistryPopulationIndexes,
  generatedAt: string,
): ApplyContributionResult {
  const existingAsset = indexes.assetById.get(contribution.assetId) ?? null;
  const existingVersions = indexes.versionsByAssetId.get(contribution.assetId) ?? [];
  const existingActiveVersion =
    existingAsset?.activeVersionId == null
      ? null
      : indexes.versionById.get(existingAsset.activeVersionId) ?? null;
  const existingReferences = indexes.referencesByAssetId.get(contribution.assetId) ?? [];
  const existingFreshnessStates =
    indexes.freshnessByAssetId.get(contribution.assetId) ?? [];
  const existingPublicationStates =
    indexes.publicationStatesByAssetId.get(contribution.assetId) ?? [];
  const activeFreshness =
    existingActiveVersion == null
      ? null
      : existingFreshnessStates.find(
          (state) => state.assetVersionId === existingActiveVersion.assetVersionId,
        ) ?? null;

  const candidateVersionId =
    existingActiveVersion?.assetVersionId ??
    buildVersionId(contribution.assetId, 1);
  const candidateVersionNumber =
    existingActiveVersion?.versionNumber ?? 1;

  const candidateMaterialized = materializeContributionVersion(
    contribution,
    candidateVersionId,
    candidateVersionNumber,
    existingActiveVersion?.createdAt ?? generatedAt,
    existingActiveVersion,
  );

  const candidateAsset = buildAssetForContribution(
    contribution,
    candidateMaterialized.versionId,
    existingAsset?.createdAt ?? generatedAt,
    generatedAt,
  );

  const currentComparison =
    existingAsset != null && existingActiveVersion != null
      ? buildComparisonSnapshot(
          existingAsset,
          existingActiveVersion,
          existingReferences.filter(
            (reference) =>
              reference.assetVersionId === existingActiveVersion.assetVersionId,
          ),
          activeFreshness,
        )
      : null;

  const currentFingerprint =
    currentComparison == null
      ? null
      : buildComparisonFingerprintFromSnapshot(currentComparison);
  const currentFreshnessFingerprint =
    currentComparison == null
      ? null
      : buildFreshnessFingerprint(currentComparison.freshness);

  const candidateComparison = buildComparisonSnapshot(
    candidateAsset,
    candidateMaterialized.version,
    candidateMaterialized.artifactReferences,
    candidateMaterialized.freshness,
  );
  const candidateFingerprint =
    buildComparisonFingerprintFromSnapshot(candidateComparison);
  const candidateFreshnessFingerprint =
    buildFreshnessFingerprint(candidateMaterialized.freshness);

  if (currentFingerprint === candidateFingerprint) {
    const preservedVersions = Object.freeze(
      existingVersions.map((version) =>
        existingActiveVersion != null &&
        version.assetVersionId === existingActiveVersion.assetVersionId
          ? candidateMaterialized.version
          : version,
      ),
    );
    const preservedReferences = Object.freeze([
      ...filterReferencesExcludingCurrentVersion(
        existingReferences,
        existingActiveVersion?.assetVersionId ?? null,
      ),
      ...candidateMaterialized.artifactReferences,
    ]);
    const preservedFreshness = Object.freeze([
      ...existingFreshnessStates.filter(
        (state) => state.assetVersionId !== existingActiveVersion?.assetVersionId,
      ),
      candidateMaterialized.freshness,
    ]);
    const changeKind =
      currentFreshnessFingerprint === candidateFreshnessFingerprint
        ? "unchanged"
        : "freshness_only_change";
    const diagnosticCode =
      changeKind === "unchanged"
        ? "asset_unchanged"
        : "freshness_only_change";

    return Object.freeze({
      asset: candidateAsset,
      versions: preservedVersions,
      artifactReferences: preservedReferences,
      freshnessStates: preservedFreshness,
      publicationStates: existingPublicationStates,
      change: Object.freeze({
        assetKey: contribution.assetId,
        kind: changeKind,
        previousVersionKey: existingActiveVersion?.assetVersionId ?? null,
        nextVersionKey: candidateMaterialized.version.assetVersionId,
      }),
      supersededVersionKey: null,
      diagnostics: Object.freeze([
        buildPopulationDiagnostic({
          code: diagnosticCode,
          severity: "info",
          source: "registry_population",
          marketCellKey: contribution.market.marketCellKey,
          assetKey: contribution.assetId,
          message:
            changeKind === "unchanged"
              ? "Canonical asset content is unchanged."
              : "Canonical content is unchanged but freshness evolved.",
        }),
      ]),
    });
  }

  const nextVersionNumber =
    existingActiveVersion == null
      ? 1
      : existingVersions.reduce(
            (max, version) => Math.max(max, version.versionNumber),
            0,
          ) + 1;
  const nextVersionId = buildVersionId(contribution.assetId, nextVersionNumber);
  const materialized = materializeContributionVersion(
    contribution,
    nextVersionId,
    nextVersionNumber,
    generatedAt,
    existingActiveVersion,
  );
  const nextAsset = buildAssetForContribution(
    contribution,
    materialized.versionId,
    existingAsset?.createdAt ?? generatedAt,
    generatedAt,
  );

  const supersededVersion =
    existingActiveVersion == null
      ? null
      : Object.freeze({
          ...existingActiveVersion,
          status: "superseded" as const,
          supersededAt: generatedAt,
        });

  return Object.freeze({
    asset: nextAsset,
    versions: Object.freeze([
      ...existingVersions.map((version) =>
        supersededVersion != null &&
        version.assetVersionId === supersededVersion.assetVersionId
          ? supersededVersion
          : version,
      ),
      materialized.version,
    ]),
    artifactReferences: Object.freeze([
      ...existingReferences,
      ...materialized.artifactReferences,
    ]),
    freshnessStates: Object.freeze([
      ...existingFreshnessStates,
      materialized.freshness,
    ]),
    publicationStates: existingPublicationStates,
    change: Object.freeze({
      assetKey: contribution.assetId,
      kind: existingAsset == null ? "new_asset" : "new_version",
      previousVersionKey: existingActiveVersion?.assetVersionId ?? null,
      nextVersionKey: materialized.version.assetVersionId,
    }),
    supersededVersionKey: supersededVersion?.assetVersionId ?? null,
    diagnostics: Object.freeze([
      buildPopulationDiagnostic({
        code: "asset_version_created",
        severity: "info",
        source: "registry_population",
        marketCellKey: contribution.market.marketCellKey,
        assetKey: contribution.assetId,
        message:
          existingAsset == null
            ? "A new public-safe asset was created."
            : "A new asset version was created from updated canonical content.",
      }),
    ]),
  });
}

function buildPlanId(plan: Omit<RegistryPopulationPlan, "planId">): string {
  return hashFingerprint("ipp_registry_population_plan", {
    inputFingerprint: plan.inputFingerprint,
    generatedAt: plan.generatedAt,
    evaluatedAt: plan.evaluatedAt,
    facts: plan.facts,
    contributions: plan.contributions.map((contribution) => ({
      assetId: contribution.assetId,
      assetKind: contribution.assetKind,
      sourceFingerprint: contribution.sourceFingerprint,
      versionComparisonFingerprint: contribution.versionComparisonFingerprint,
    })),
    skippedInputs: plan.skippedInputs,
    policyVersions: plan.policyVersions,
    metadata: plan.metadata,
  });
}

function buildInputFingerprint(
  inputs: readonly RegistryPopulationInput[],
): string {
  return hashFingerprint(
    "ipp_registry_population_input",
    inputs.map((input) => input),
  );
}

function normalizePopulationInput(
  input: RegistryPopulationInput,
): RegistryPopulationInput {
  if (input.source === "market_report_definition") {
    return Object.freeze({
      source: "market_report_definition",
      datasetType: "market_report_definition",
      definition: parseMarketReportDefinition(input.definition),
      metadata: freezeMetadata(input.metadata),
    });
  }

  return input;
}

function sortInputs(
  inputs: readonly RegistryPopulationInput[],
): readonly RegistryPopulationInput[] {
  return Object.freeze(
    [...inputs]
      .map(normalizePopulationInput)
      .sort((left, right) =>
        compareStrings(stableStringify(left), stableStringify(right)),
      ),
  );
}

function buildDirectMarketReportArtifacts(
  input: Readonly<{
    definition: MarketReportDefinition;
    generatedAt: string;
  }>,
): PublicSafePopulationArtifacts {
  return Object.freeze({
    facts: Object.freeze([]),
    contributions: Object.freeze([
      buildMarketReportContribution(input.definition, input.generatedAt),
    ]),
    diagnostics: Object.freeze([]),
    skipped: null,
  });
}

function buildComposedMarketReportContributions(input: Readonly<{
  contributions: readonly RegistryPopulationContribution[];
  generatedAt: string;
  targetLocales: readonly string[];
}>): readonly RegistryPopulationContribution[] {
  const pricingByGroup = new Map<
    string,
    RegistryPopulationContribution
  >();
  const overviewByGroup = new Map<
    string,
    RegistryPopulationContribution
  >();
  const occupancyByGroup = new Map<
    string,
    RegistryPopulationContribution
  >();

  for (const contribution of input.contributions) {
    const locale = contribution.defaultLocale;
    const groupKey = buildContributionMarketGroupKey(contribution);
    if (contribution.assetKind === "market_pricing_benchmark") {
      pricingByGroup.set(groupKey, contribution);
    } else if (contribution.assetKind === "market_overview") {
      overviewByGroup.set(groupKey, contribution);
    } else if (contribution.assetKind === "market_occupancy_benchmark") {
      occupancyByGroup.set(groupKey, contribution);
    }
  }

  const composed: RegistryPopulationContribution[] = [];
  for (const [groupKey, pricingContribution] of [...pricingByGroup.entries()].sort((left, right) =>
    compareStrings(left[0], right[0]),
  )) {
    const overviewContribution = overviewByGroup.get(groupKey);
    if (overviewContribution == null) {
      continue;
    }

    const occupancyContribution = occupancyByGroup.get(groupKey) ?? null;
    const locale = pricingContribution.defaultLocale;
    if (!input.targetLocales.includes(locale)) {
      continue;
    }

    const overviewFingerprint =
      overviewContribution.sourceFingerprint;
    const benchmarkFingerprint =
      pricingContribution.sourceFingerprint;
    const definition = buildPublicMarketReportDefinition({
      market: pricingContribution.market,
      locale,
      platform:
        String(
          (pricingContribution.assetMetadata as Record<string, unknown>).platform ??
            "airbnb",
        ),
      propertyType:
        String(
          (pricingContribution.assetMetadata as Record<string, unknown>).propertyType ??
            "apartment",
        ),
      benchmarkFingerprint,
      overviewFingerprint,
      occupancyFingerprint: occupancyContribution?.sourceFingerprint ?? null,
      policyVersions: sortStringRecord({
        ...pricingContribution.policyVersions,
        ...overviewContribution.policyVersions,
      }),
      createdAt: input.generatedAt,
      updatedAt: input.generatedAt,
    });
    composed.push(buildMarketReportContribution(definition, input.generatedAt));
  }

  return Object.freeze(
    composed.sort((left, right) => compareStrings(left.assetId, right.assetId)),
  );
}

function collectArtifactsFromInput(
  input: RegistryPopulationInput,
  generatedAt: string,
): PublicSafePopulationArtifacts {
  if (input.source === "market_report_definition") {
    return buildDirectMarketReportArtifacts({
      definition: input.definition,
      generatedAt,
    });
  }

  return buildPublicSafePopulationArtifacts(input, {
    generatedAt,
  });
}

export function buildRegistryPopulationPlan(
  inputs: readonly RegistryPopulationInput[],
  options: RegistryPopulationOptions,
): RegistryPopulationPlan {
  if (!Array.isArray(inputs)) {
    throw new RegistryPopulationError({
      code: "invalid_input",
      operation: "buildRegistryPopulationPlan",
      message: "Expected inputs to be an array.",
    });
  }

  assertCanonicalTimestamp(
    options.generatedAt,
    "buildRegistryPopulationPlan",
    "options.generatedAt",
  );
  assertCanonicalTimestamp(
    options.evaluatedAt,
    "buildRegistryPopulationPlan",
    "options.evaluatedAt",
  );
  assertJsonSafe(
    options.metadata ?? {},
    "buildRegistryPopulationPlan",
    "options.metadata",
  );

  const sortedInputs = sortInputs(inputs);
  validateRegistryPopulationPrivacy(sortedInputs);

  const factsById = new Map<string, PublicMarketFact>();
  const contributionByAssetId = new Map<string, RegistryPopulationContribution>();
  const diagnostics: RegistryPopulationDiagnostic[] = [];
  const skippedInputs: RegistryPopulationSkippedInput[] = [];

  for (const input of sortedInputs) {
    const artifacts = collectArtifactsFromInput(input, options.generatedAt);

    for (const diagnostic of artifacts.diagnostics) {
      diagnostics.push(diagnostic);
    }

    if (artifacts.skipped != null) {
      skippedInputs.push(artifacts.skipped);
      continue;
    }

    for (const fact of artifacts.facts) {
      const existing = factsById.get(fact.factId);
      if (existing == null) {
        factsById.set(fact.factId, fact);
        continue;
      }

      if (stableStringify(existing) !== stableStringify(fact)) {
        throw new RegistryPopulationError({
          code: "conflicting_fact",
          operation: "buildRegistryPopulationPlan",
          source: fact.source,
          marketCellKey: fact.market.marketCellKey,
          path: "facts",
          message: `Conflicting fact detected for ${fact.factId}.`,
        });
      }

      diagnostics.push(
        buildPopulationDiagnostic({
          code: "duplicate_fact",
          severity: "info",
          source: fact.source,
          marketCellKey: fact.market.marketCellKey,
          message: `Duplicate public-safe fact deduplicated for ${fact.factId}.`,
        }),
      );
    }

    for (const contribution of artifacts.contributions) {
      const existing = contributionByAssetId.get(contribution.assetId);
      if (existing == null) {
        contributionByAssetId.set(contribution.assetId, contribution);
        continue;
      }

      if (
        existing.versionComparisonFingerprint !==
        contribution.versionComparisonFingerprint
      ) {
        throw new RegistryPopulationError({
          code: "invalid_contribution",
          operation: "buildRegistryPopulationPlan",
          source: contribution.source,
          marketCellKey: contribution.market.marketCellKey,
          assetKey: contribution.assetId,
          message: `Conflicting contribution detected for ${contribution.assetId}.`,
        });
      }
    }
  }

  if (options.composeMarketReports !== false) {
    for (const contribution of buildComposedMarketReportContributions({
      contributions: Object.freeze([...contributionByAssetId.values()]),
      generatedAt: options.generatedAt,
      targetLocales: uniqueSortedStrings(
        options.targetLocales ?? ["en"],
      ),
    })) {
      if (!contributionByAssetId.has(contribution.assetId)) {
        contributionByAssetId.set(contribution.assetId, contribution);
      }
    }
  }

  const policyVersions = sortStringRecord({
    ...(options.policyVersions ?? {}),
    ...Object.fromEntries(
      [...contributionByAssetId.values()]
        .flatMap((contribution) => Object.entries(contribution.policyVersions))
        .sort((left, right) => compareStrings(left[0], right[0])),
    ),
  });

  const planWithoutId = Object.freeze({
    inputFingerprint: buildInputFingerprint(sortedInputs),
    generatedAt: options.generatedAt,
    evaluatedAt: options.evaluatedAt,
    facts: Object.freeze(
      [...factsById.values()].sort((left, right) =>
        compareStrings(left.factId, right.factId),
      ),
    ),
    contributions: Object.freeze(
      [...contributionByAssetId.values()].sort((left, right) =>
        compareStrings(left.assetId, right.assetId),
      ),
    ),
    skippedInputs: Object.freeze(
      skippedInputs.sort((left, right) =>
        compareStrings(left.inputFingerprint, right.inputFingerprint),
      ),
    ),
    diagnostics: Object.freeze(
      diagnostics.sort((left, right) =>
        compareStrings(
          `${left.assetKey ?? ""}|${left.marketCellKey ?? ""}|${left.code}`,
          `${right.assetKey ?? ""}|${right.marketCellKey ?? ""}|${right.code}`,
        ),
      ),
    ),
    policyVersions,
    metadata: freezeMetadata(options.metadata),
  });

  const plan = Object.freeze({
    planId: buildPlanId(planWithoutId),
    ...planWithoutId,
  });

  validateRegistryPopulationPrivacy(plan);
  return plan;
}

export function applyRegistryPopulationPlan(
  plan: RegistryPopulationPlan,
  existingSnapshot?: RegistrySnapshot | null,
): RegistryPopulationResult {
  validateRegistryPopulationPrivacy(plan);
  const currentSnapshot =
    existingSnapshot == null
      ? buildEmptySnapshot(plan.generatedAt)
      : normalizeRegistrySnapshot(parseRegistrySnapshot(existingSnapshot));
  const previousSnapshotFingerprint =
    currentSnapshot.assets.length === 0 &&
    currentSnapshot.assetVersions.length === 0 &&
    currentSnapshot.artifactReferences.length === 0 &&
    currentSnapshot.channelVariants.length === 0 &&
    currentSnapshot.freshnessStates.length === 0 &&
    currentSnapshot.publicationStates.length === 0
      ? null
      : buildRegistrySnapshotFingerprint(currentSnapshot);

  const indexes = buildIndexes(currentSnapshot);
  const targetedAssetIds = new Set(plan.contributions.map((contribution) => contribution.assetId));

  const nextAssets = currentSnapshot.assets.filter(
    (asset) => !targetedAssetIds.has(asset.assetId),
  );
  const nextVersions = currentSnapshot.assetVersions.filter(
    (version) => !targetedAssetIds.has(version.assetId),
  );
  const nextReferences = currentSnapshot.artifactReferences.filter(
    (reference) => !targetedAssetIds.has(reference.assetId),
  );
  const nextFreshnessStates = currentSnapshot.freshnessStates.filter(
    (state) => !targetedAssetIds.has(state.assetId),
  );
  const nextPublicationStates = currentSnapshot.publicationStates.filter(
    (state) => !targetedAssetIds.has(state.assetId),
  );

  const diagnostics = [...plan.diagnostics];
  const changes: RegistryPopulationChange[] = [];
  const supersededVersionKeys: string[] = [];

  for (const contribution of plan.contributions) {
    const applied = applyContributionToSnapshot(
      contribution,
      currentSnapshot,
      indexes,
      plan.generatedAt,
    );
    nextAssets.push(applied.asset);
    nextVersions.push(...applied.versions);
    nextReferences.push(...applied.artifactReferences);
    nextFreshnessStates.push(...applied.freshnessStates);
    nextPublicationStates.push(...applied.publicationStates);
    diagnostics.push(...applied.diagnostics);
    changes.push(applied.change);
    if (applied.supersededVersionKey != null) {
      supersededVersionKeys.push(applied.supersededVersionKey);
    }
  }

  const mergedPolicyVersions = sortStringRecord({
    ...currentSnapshot.policyVersions,
    ...plan.policyVersions,
  });
  const mergedMetadata = freezeMetadata({
    ...currentSnapshot.metadata,
    ...plan.metadata,
    registryPopulationPlanId: plan.planId,
  });
  const hasEffectiveSnapshotChange = changes.some(
    (change) => change.kind !== "unchanged",
  );
  const metadataChanged =
    stableStringify(currentSnapshot.metadata) !==
    stableStringify(mergedMetadata);
  const policyVersionsChanged =
    stableStringify(currentSnapshot.policyVersions) !==
    stableStringify(mergedPolicyVersions);

  if (
    !hasEffectiveSnapshotChange &&
    !metadataChanged &&
    !policyVersionsChanged
  ) {
    const currentFingerprint = buildRegistrySnapshotFingerprint(currentSnapshot);
    return Object.freeze({
      plan,
      previousSnapshotFingerprint: currentFingerprint,
      nextSnapshot: currentSnapshot,
      nextSnapshotFingerprint: currentFingerprint,
      changedAssetKeys: Object.freeze([]),
      unchangedAssetKeys: Object.freeze(
        changes.map((change) => change.assetKey).sort(compareStrings),
      ),
      supersededVersionKeys: Object.freeze([]),
      changes: Object.freeze(
        changes.sort((left, right) =>
          compareStrings(left.assetKey, right.assetKey),
        ),
      ),
      diagnostics: Object.freeze(
        diagnostics.sort((left, right) =>
          compareStrings(
            `${left.assetKey ?? ""}|${left.marketCellKey ?? ""}|${left.code}`,
            `${right.assetKey ?? ""}|${right.marketCellKey ?? ""}|${right.code}`,
          ),
        ),
      ),
    });
  }

  const nextSnapshot = normalizeRegistrySnapshot(
    parseRegistrySnapshot({
      snapshotId: PERSISTENT_REGISTRY_SNAPSHOT_ID,
      snapshotVersion:
        previousSnapshotFingerprint == null
          ? 1
          : currentSnapshot.snapshotVersion + 1,
      generatedAt: plan.generatedAt,
      assets: nextAssets,
      assetVersions: nextVersions,
      artifactReferences: nextReferences,
      channelVariants: currentSnapshot.channelVariants,
      freshnessStates: nextFreshnessStates,
      publicationStates: nextPublicationStates,
      policyVersions: mergedPolicyVersions,
      metadata: mergedMetadata,
    }),
  );

  assertRegistrySnapshotPublicSafe(nextSnapshot);

  const nextSnapshotFingerprint =
    buildRegistrySnapshotFingerprint(nextSnapshot);
  const changedAssetKeys = Object.freeze(
    changes
      .filter((change) => change.kind !== "unchanged")
      .map((change) => change.assetKey)
      .sort(compareStrings),
  );
  const unchangedAssetKeys = Object.freeze(
    changes
      .filter((change) => change.kind === "unchanged")
      .map((change) => change.assetKey)
      .sort(compareStrings),
  );

  return Object.freeze({
    plan,
    previousSnapshotFingerprint,
    nextSnapshot,
    nextSnapshotFingerprint,
    changedAssetKeys,
    unchangedAssetKeys,
    supersededVersionKeys: Object.freeze(
      [...new Set(supersededVersionKeys)].sort(compareStrings),
    ),
    changes: Object.freeze(
      changes.sort((left, right) =>
        compareStrings(left.assetKey, right.assetKey),
      ),
    ),
    diagnostics: Object.freeze(
      diagnostics.sort((left, right) =>
        compareStrings(
          `${left.assetKey ?? ""}|${left.marketCellKey ?? ""}|${left.code}`,
          `${right.assetKey ?? ""}|${right.marketCellKey ?? ""}|${right.code}`,
        ),
      ),
    ),
  });
}

export async function persistRegistryPopulationPlan(
  input: Readonly<{
    repository: PersistentRegistryRepository;
    plan: RegistryPopulationPlan;
    existingSnapshot?: RegistrySnapshot | null;
    writeOptions: RegistryWriteOptions;
  }>,
): Promise<RegistryPopulationPersistResult> {
  const baseSnapshot =
    input.existingSnapshot ??
    (await input.repository.readSnapshot());
  const result = applyRegistryPopulationPlan(input.plan, baseSnapshot);
  const writeResult = await input.repository.writeSnapshot(
    result.nextSnapshot,
    input.writeOptions,
  );
  const reloadedSnapshot = await input.repository.readSnapshot();
  const reloadedSnapshotFingerprint =
    buildRegistrySnapshotFingerprint(reloadedSnapshot);

  if (reloadedSnapshotFingerprint !== writeResult.snapshotFingerprint) {
    throw new RegistryPopulationError({
      code: "persistence_error",
      operation: "persistRegistryPopulationPlan",
      message:
        "Reloaded registry snapshot fingerprint does not match the write result fingerprint.",
    });
  }

  return Object.freeze({
    result,
    writeResult,
    reloadedSnapshot,
    reloadedSnapshotFingerprint,
  });
}

export type {
  OccupancyBenchmarkPopulationInput,
  PricingBenchmarkPopulationInput,
  PublicMarketOverviewPopulationInput,
  PublicSafePopulationInput,
};
