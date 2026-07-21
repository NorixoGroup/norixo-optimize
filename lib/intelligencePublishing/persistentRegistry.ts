import { createHash } from "node:crypto";

import {
  buildRegistrySnapshotFingerprint,
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
  type IntelligencePublishingRegistryReader,
  type RegistryArtifactReference,
  type RegistryAsset,
  type RegistryAssetType,
  type RegistryAssetVersion,
  type RegistryChannelVariant,
  type RegistryFreshnessState,
  type RegistryPublicationState,
  type RegistrySnapshot,
} from "./registryAdapter";
import type { CoordinationJsonObject } from "./distributedCoordination";
import {
  buildRegistrySnapshotForMarketReport,
  type MarketReportDefinition,
} from "./marketReportPilot";

// TypeScript owns the canonical registry representation. SQL owns atomic
// persistence and transactional concurrency checks.
export const PERSISTENT_REGISTRY_SNAPSHOT_ID =
  "intelligence_publishing_registry";

export type RegistryReadScope = Readonly<{
  assetIds?: readonly string[];
  assetTypes?: readonly RegistryAssetType[];
  locales?: readonly string[];
  channels?: readonly string[];
  includeHistoricalVersions?: boolean;
  asOf?: string;
}>;

export type RegistryWriteOptions = Readonly<{
  expectedSnapshotFingerprint?: string;
  expectedAssetVersion?: string;
  fencingToken?: number;
  idempotencyKey: string;
  writtenAt: string;
  metadata?: CoordinationJsonObject;
}>;

export type PersistentRegistryWriteResult = Readonly<{
  status: "written" | "idempotent";
  snapshot: RegistrySnapshot;
  snapshotFingerprint: string;
  snapshotVersion: number;
  snapshotId: string;
  fencingToken: number;
  metadata: CoordinationJsonObject;
}>;

export type PersistentRegistryErrorCode =
  | "invalid_snapshot"
  | "invalid_asset"
  | "invalid_version"
  | "invalid_reference"
  | "invalid_variant"
  | "invalid_freshness_state"
  | "invalid_publication_state"
  | "snapshot_conflict"
  | "version_conflict"
  | "idempotency_conflict"
  | "fencing_conflict"
  | "database_error"
  | "mapping_error"
  | "derived_key_mismatch"
  | "private_field_detected"
  | "unsupported_scope"
  | "snapshot_version_conflict"
  | "unsafe_prune_scope"
  | "not_found";

export type PersistentRegistryAssetRow = Readonly<{
  assetKey: string;
  canonicalId: string;
  assetType: RegistryAsset["assetType"];
  status: RegistryAsset["status"];
  visibility: RegistryAsset["visibility"];
  defaultLocale: string;
  availableLocales: readonly string[];
  availableChannels: readonly string[];
  activeVersionKey: string | null;
  templateId: string | null;
  ownerTeam: string;
  confidenceAffectsVisibleContent: boolean;
  policyChangeAffectsVisibleContent: boolean;
  freshnessExpiryBehavior: RegistryAsset["freshnessExpiryBehavior"];
  metadata: CoordinationJsonObject;
  createdAt: string;
  updatedAt: string;
}>;

export type PersistentRegistryAssetVersionRow = Readonly<{
  assetVersionKey: string;
  assetKey: string;
  versionNumber: number;
  status: RegistryAssetVersion["status"];
  contentFingerprint: string;
  sourceFingerprint: string;
  templateFingerprint: string;
  rendererFingerprint: string;
  policyVersions: Readonly<Record<string, string>>;
  confidenceBand: RegistryAssetVersion["confidenceBand"];
  createdAt: string;
  approvedAt: string | null;
  publishedAt: string | null;
  supersededAt: string | null;
  metadata: CoordinationJsonObject;
}>;

export type PersistentRegistryArtifactReferenceRow = Readonly<{
  referenceKey: string;
  assetKey: string;
  assetVersionKey: string | null;
  artifactType: RegistryArtifactReference["artifactType"];
  artifactId: string;
  artifactFingerprint: string;
  relationshipType: RegistryArtifactReference["relationshipType"];
  policyVersions: Readonly<Record<string, string>>;
  createdAt: string;
  metadata: CoordinationJsonObject;
}>;

export type PersistentRegistryChannelVariantRow = Readonly<{
  variantKey: string;
  assetKey: string;
  assetVersionKey: string;
  locale: string;
  channel: string;
  status: RegistryChannelVariant["status"];
  contentFingerprint: string;
  destinationKey: string | null;
  publishedAt: string | null;
  updatedAt: string;
  metadata: CoordinationJsonObject;
}>;

export type PersistentRegistryFreshnessStateRow = Readonly<{
  freshnessKey: string;
  assetKey: string;
  assetVersionKey: string | null;
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

export type PersistentRegistryPublicationStateRow = Readonly<{
  publicationKey: string;
  assetKey: string;
  assetVersionKey: string;
  locale: string;
  channel: string;
  publicationStatus: RegistryPublicationState["status"];
  destinationKey: string | null;
  publicationFingerprint: string | null;
  publishedAt: string | null;
  suppressedAt: string | null;
  metadata: CoordinationJsonObject;
  createdAt: string;
  updatedAt: string;
}>;

export type PersistentRegistryDeleteKeys = Readonly<{
  assetKeys: readonly string[];
  assetVersionKeys: readonly string[];
  referenceKeys: readonly string[];
  variantKeys: readonly string[];
  freshnessKeys: readonly string[];
  publicationKeys: readonly string[];
}>;

export type PersistentRegistryWritePayload = Readonly<{
  snapshot: Readonly<{
    snapshotId: string;
    requestedSnapshotVersion: number;
    snapshotFingerprint: string;
    requestFingerprint: string;
    assetCount: number;
    generatedAt: string;
    writtenAt: string;
    idempotencyKey: string;
    policyVersions: Readonly<Record<string, string>>;
    snapshotPayload: RegistrySnapshot;
    metadata: CoordinationJsonObject;
  }>;
  assets: readonly PersistentRegistryAssetRow[];
  assetVersions: readonly PersistentRegistryAssetVersionRow[];
  artifactReferences: readonly PersistentRegistryArtifactReferenceRow[];
  channelVariants: readonly PersistentRegistryChannelVariantRow[];
  freshnessStates: readonly PersistentRegistryFreshnessStateRow[];
  publicationStates: readonly PersistentRegistryPublicationStateRow[];
  deleteKeys: PersistentRegistryDeleteKeys;
}>;

export class PersistentRegistryError extends Error {
  readonly code: PersistentRegistryErrorCode;
  readonly operation: string;
  readonly assetId?: string;
  readonly assetVersionId?: string;
  readonly snapshotId?: string;
  readonly path?: string;
  readonly cause?: unknown;

  constructor(
    input: Readonly<{
      code: PersistentRegistryErrorCode;
      operation: string;
      message: string;
      assetId?: string;
      assetVersionId?: string;
      snapshotId?: string;
      path?: string;
      cause?: unknown;
    }>,
  ) {
    super(input.message);
    this.name = "PersistentRegistryError";
    this.code = input.code;
    this.operation = input.operation;
    this.assetId = input.assetId;
    this.assetVersionId = input.assetVersionId;
    this.snapshotId = input.snapshotId;
    this.path = input.path;
    this.cause = input.cause;
  }
}

export interface PersistentRegistryReader
  extends IntelligencePublishingRegistryReader {
  readSnapshot(scope?: RegistryReadScope): Promise<RegistrySnapshot>;
  getVersion(assetVersionId: string): Promise<RegistryAssetVersion | null>;
  listVersions(assetId: string): Promise<readonly RegistryAssetVersion[]>;
}

export interface PersistentRegistryWriter {
  upsertAsset(
    asset: RegistryAsset,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult>;
  upsertVersion(
    version: RegistryAssetVersion,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult>;
  upsertArtifactReference(
    reference: RegistryArtifactReference,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult>;
  upsertChannelVariant(
    variant: RegistryChannelVariant,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult>;
  upsertFreshnessState(
    state: RegistryFreshnessState,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult>;
  upsertPublicationState(
    state: RegistryPublicationState,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult>;
  writeSnapshot(
    snapshot: RegistrySnapshot,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult>;
}

export interface PersistentRegistryRepository
  extends PersistentRegistryReader,
    PersistentRegistryWriter {}

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

function uniqueSortedStrings(
  values: readonly string[] | undefined,
): readonly string[] | undefined {
  if (values == null) {
    return undefined;
  }

  return Object.freeze([...new Set(values)].sort(compareStrings));
}

function sortStringRecord(
  value: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value).sort((left, right) =>
        compareStrings(left[0], right[0]),
      ),
    ),
  );
}

function mergeMetadata(
  base: CoordinationJsonObject,
  next?: CoordinationJsonObject,
): CoordinationJsonObject {
  return Object.freeze({
    ...base,
    ...(next ?? {}),
  });
}

function dedupeByKey<T>(
  currentValues: readonly T[],
  nextValues: readonly T[],
  getKey: (value: T) => string,
): readonly T[] {
  const merged = new Map<string, T>();
  for (const value of currentValues) {
    merged.set(getKey(value), value);
  }
  for (const value of nextValues) {
    merged.set(getKey(value), value);
  }
  return Object.freeze([...merged.values()]);
}

function getFreshnessStateKey(state: RegistryFreshnessState): string {
  return buildPersistentFreshnessKey(state);
}

function getPublicationStateKey(state: RegistryPublicationState): string {
  return buildPersistentPublicationKey(state);
}

function sortStringList(values: readonly string[]): readonly string[] {
  return Object.freeze([...values].sort(compareStrings));
}

function computeDeleteKeys(
  currentValues: readonly string[],
  nextValues: readonly string[],
): readonly string[] {
  const nextSet = new Set(nextValues);
  return Object.freeze(
    [...new Set(currentValues)].filter((value) => !nextSet.has(value)).sort(compareStrings),
  );
}

export function buildPersistentAssetKey(asset: Readonly<{ assetId: string }>): string {
  return asset.assetId;
}

export function buildPersistentAssetVersionKey(
  version: Readonly<{ assetVersionId: string }>,
): string {
  return version.assetVersionId;
}

export function buildPersistentReferenceKey(
  reference: Readonly<{ referenceId: string }>,
): string {
  return reference.referenceId;
}

export function buildPersistentVariantKey(
  variant: Readonly<{ variantId: string }>,
): string {
  return variant.variantId;
}

export function buildPersistentFreshnessKey(
  state: Readonly<{
    assetId: string;
    assetVersionId: string | null;
  }>,
): string {
  return `${state.assetId}|${state.assetVersionId ?? "__asset__"}`;
}

export function buildPersistentPublicationKey(
  state: Readonly<{
    assetId: string;
    assetVersionId: string;
    locale: string;
    channel: string;
    destinationKey: string | null;
  }>,
): string {
  return [
    state.assetId,
    state.assetVersionId,
    state.locale,
    state.channel,
    state.destinationKey ?? "",
  ].join("|");
}

function buildSnapshotVersionId(
  currentSnapshot: RegistrySnapshot | null,
): number {
  return currentSnapshot == null ? 1 : currentSnapshot.snapshotVersion + 1;
}

function filterAssetsByScope(
  snapshot: RegistrySnapshot,
  scope: RegistryReadScope | undefined,
): readonly RegistryAsset[] {
  const assetIdSet =
    scope?.assetIds == null ? null : new Set(scope.assetIds);
  const assetTypeSet =
    scope?.assetTypes == null ? null : new Set(scope.assetTypes);

  return Object.freeze(
    snapshot.assets.filter((asset) => {
      if (assetIdSet != null && !assetIdSet.has(asset.assetId)) {
        return false;
      }
      if (assetTypeSet != null && !assetTypeSet.has(asset.assetType)) {
        return false;
      }
      return true;
    }),
  );
}

function selectVersionIdsForScope(
  assets: readonly RegistryAsset[],
  snapshot: RegistrySnapshot,
  includeHistoricalVersions: boolean,
): ReadonlySet<string> {
  const allowedAssetIds = new Set(assets.map((asset) => asset.assetId));
  const versions = snapshot.assetVersions.filter((version) =>
    allowedAssetIds.has(version.assetId),
  );

  if (includeHistoricalVersions) {
    return new Set(versions.map((version) => version.assetVersionId));
  }

  const versionIds = new Set<string>();
  for (const asset of assets) {
    if (asset.activeVersionId != null) {
      versionIds.add(asset.activeVersionId);
      continue;
    }

    const latestVersion = versions
      .filter((version) => version.assetId === asset.assetId)
      .sort((left, right) => right.versionNumber - left.versionNumber)[0];
    if (latestVersion != null) {
      versionIds.add(latestVersion.assetVersionId);
    }
  }

  return versionIds;
}

function filterByLocaleAndChannel(
  locale: string,
  channel: string,
  scope: RegistryReadScope | undefined,
): boolean {
  const localeSet = scope?.locales == null ? null : new Set(scope.locales);
  const channelSet =
    scope?.channels == null ? null : new Set(scope.channels);

  if (localeSet != null && !localeSet.has(locale)) {
    return false;
  }
  if (channelSet != null && !channelSet.has(channel)) {
    return false;
  }
  return true;
}

export function applyRegistryReadScope(
  snapshot: RegistrySnapshot,
  scope?: RegistryReadScope,
): RegistrySnapshot {
  const normalized = normalizeRegistrySnapshot(parseRegistrySnapshot(snapshot));
  const assets = filterAssetsByScope(normalized, scope);
  const assetIds = new Set(assets.map((asset) => asset.assetId));
  const includeHistoricalVersions = scope?.includeHistoricalVersions !== false;
  const versionIds = selectVersionIdsForScope(
    assets,
    normalized,
    includeHistoricalVersions,
  );

  const filteredSnapshot = parseRegistrySnapshot({
    snapshotId: normalized.snapshotId,
    snapshotVersion: normalized.snapshotVersion,
    generatedAt: normalized.generatedAt,
    assets: assets.map((asset) => ({
      ...asset,
      availableLocales:
        scope?.locales == null
          ? asset.availableLocales
          : asset.availableLocales.filter((locale) =>
              new Set(scope.locales).has(locale),
            ),
      availableChannels:
        scope?.channels == null
          ? asset.availableChannels
          : asset.availableChannels.filter((channel) =>
              new Set(scope.channels).has(channel),
            ),
    })),
    assetVersions: normalized.assetVersions.filter(
      (version) =>
        assetIds.has(version.assetId) && versionIds.has(version.assetVersionId),
    ),
    artifactReferences: normalized.artifactReferences.filter(
      (reference) =>
        assetIds.has(reference.assetId) &&
        (reference.assetVersionId == null ||
          versionIds.has(reference.assetVersionId)),
    ),
    channelVariants: normalized.channelVariants.filter(
      (variant) =>
        assetIds.has(variant.assetId) &&
        versionIds.has(variant.assetVersionId) &&
        filterByLocaleAndChannel(variant.locale, variant.channel, scope),
    ),
    freshnessStates: normalized.freshnessStates.filter(
      (state) =>
        assetIds.has(state.assetId) &&
        (state.assetVersionId == null || versionIds.has(state.assetVersionId)),
    ),
    publicationStates: normalized.publicationStates.filter(
      (state) =>
        assetIds.has(state.assetId) &&
        versionIds.has(state.assetVersionId) &&
        filterByLocaleAndChannel(state.locale, state.channel, scope),
    ),
    policyVersions: normalized.policyVersions,
    metadata: mergeMetadata(normalized.metadata, {
      readScope: {
        assetIds: uniqueSortedStrings(scope?.assetIds) ?? null,
        assetTypes: uniqueSortedStrings(scope?.assetTypes) ?? null,
        locales: uniqueSortedStrings(scope?.locales) ?? null,
        channels: uniqueSortedStrings(scope?.channels) ?? null,
        includeHistoricalVersions,
        asOf: scope?.asOf ?? null,
      },
    }),
  });

  return normalizeRegistrySnapshot(filteredSnapshot);
}

export function mergeRegistrySnapshots(input: Readonly<{
  currentSnapshot: RegistrySnapshot | null;
  incomingSnapshot: RegistrySnapshot;
  writtenAt: string;
  metadata?: CoordinationJsonObject;
}>): RegistrySnapshot {
  const incomingSnapshot = normalizeRegistrySnapshot(
    parseRegistrySnapshot(input.incomingSnapshot),
  );
  return mergeRegistryCollections({
    currentSnapshot: input.currentSnapshot,
    writtenAt: input.writtenAt,
    assets: incomingSnapshot.assets,
    assetVersions: incomingSnapshot.assetVersions,
    artifactReferences: incomingSnapshot.artifactReferences,
    channelVariants: incomingSnapshot.channelVariants,
    freshnessStates: incomingSnapshot.freshnessStates,
    publicationStates: incomingSnapshot.publicationStates,
    policyVersions: incomingSnapshot.policyVersions,
    metadata: mergeMetadata(incomingSnapshot.metadata, input.metadata),
  });
}

export function mergeRegistryCollections(input: Readonly<{
  currentSnapshot: RegistrySnapshot | null;
  writtenAt: string;
  assets?: readonly RegistryAsset[];
  assetVersions?: readonly RegistryAssetVersion[];
  artifactReferences?: readonly RegistryArtifactReference[];
  channelVariants?: readonly RegistryChannelVariant[];
  freshnessStates?: readonly RegistryFreshnessState[];
  publicationStates?: readonly RegistryPublicationState[];
  policyVersions?: Readonly<Record<string, string>>;
  metadata?: CoordinationJsonObject;
}>): RegistrySnapshot {
  const currentSnapshot =
    input.currentSnapshot == null
      ? null
      : normalizeRegistrySnapshot(parseRegistrySnapshot(input.currentSnapshot));

  const mergedSnapshot = parseRegistrySnapshot({
    snapshotId: PERSISTENT_REGISTRY_SNAPSHOT_ID,
    snapshotVersion: buildSnapshotVersionId(currentSnapshot),
    generatedAt: input.writtenAt,
    assets: dedupeByKey(
      currentSnapshot?.assets ?? [],
      input.assets ?? [],
      (asset) => asset.assetId,
    ),
    assetVersions: dedupeByKey(
      currentSnapshot?.assetVersions ?? [],
      input.assetVersions ?? [],
      (version) => version.assetVersionId,
    ),
    artifactReferences: dedupeByKey(
      currentSnapshot?.artifactReferences ?? [],
      input.artifactReferences ?? [],
      (reference) => reference.referenceId,
    ),
    channelVariants: dedupeByKey(
      currentSnapshot?.channelVariants ?? [],
      input.channelVariants ?? [],
      (variant) => variant.variantId,
    ),
    freshnessStates: dedupeByKey(
      currentSnapshot?.freshnessStates ?? [],
      input.freshnessStates ?? [],
      getFreshnessStateKey,
    ),
    publicationStates: dedupeByKey(
      currentSnapshot?.publicationStates ?? [],
      input.publicationStates ?? [],
      getPublicationStateKey,
    ),
    policyVersions: sortStringRecord({
      ...(currentSnapshot?.policyVersions ?? {}),
      ...(input.policyVersions ?? {}),
    }),
    metadata: mergeMetadata(currentSnapshot?.metadata ?? {}, input.metadata),
  });

  return normalizeRegistrySnapshot(mergedSnapshot);
}

function buildPersistentAssetRow(asset: RegistryAsset): PersistentRegistryAssetRow {
  return Object.freeze({
    assetKey: buildPersistentAssetKey(asset),
    canonicalId: asset.canonicalId,
    assetType: asset.assetType,
    status: asset.status,
    visibility: asset.visibility,
    defaultLocale: asset.defaultLocale,
    availableLocales: sortStringList(asset.availableLocales),
    availableChannels: sortStringList(asset.availableChannels),
    activeVersionKey: asset.activeVersionId,
    templateId: asset.templateId,
    ownerTeam: asset.ownerTeam,
    confidenceAffectsVisibleContent: asset.confidenceAffectsVisibleContent,
    policyChangeAffectsVisibleContent: asset.policyChangeAffectsVisibleContent,
    freshnessExpiryBehavior: asset.freshnessExpiryBehavior,
    metadata: asset.metadata,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  });
}

function buildPersistentAssetVersionRow(
  version: RegistryAssetVersion,
): PersistentRegistryAssetVersionRow {
  return Object.freeze({
    assetVersionKey: buildPersistentAssetVersionKey(version),
    assetKey: buildPersistentAssetKey({ assetId: version.assetId }),
    versionNumber: version.versionNumber,
    status: version.status,
    contentFingerprint: version.contentFingerprint,
    sourceFingerprint: version.sourceFingerprint,
    templateFingerprint: version.templateFingerprint,
    rendererFingerprint: version.rendererFingerprint,
    policyVersions: sortStringRecord(version.policyVersions),
    confidenceBand: version.confidenceBand,
    createdAt: version.createdAt,
    approvedAt: version.approvedAt,
    publishedAt: version.publishedAt,
    supersededAt: version.supersededAt,
    metadata: version.metadata,
  });
}

function buildPersistentArtifactReferenceRow(
  reference: RegistryArtifactReference,
): PersistentRegistryArtifactReferenceRow {
  return Object.freeze({
    referenceKey: buildPersistentReferenceKey(reference),
    assetKey: buildPersistentAssetKey({ assetId: reference.assetId }),
    assetVersionKey:
      reference.assetVersionId == null
        ? null
        : buildPersistentAssetVersionKey({
            assetVersionId: reference.assetVersionId,
          }),
    artifactType: reference.artifactType,
    artifactId: reference.artifactId,
    artifactFingerprint: reference.artifactFingerprint,
    relationshipType: reference.relationshipType,
    policyVersions: sortStringRecord(reference.policyVersions),
    createdAt: reference.createdAt,
    metadata: reference.metadata,
  });
}

function buildPersistentChannelVariantRow(
  variant: RegistryChannelVariant,
): PersistentRegistryChannelVariantRow {
  return Object.freeze({
    variantKey: buildPersistentVariantKey(variant),
    assetKey: buildPersistentAssetKey({ assetId: variant.assetId }),
    assetVersionKey: buildPersistentAssetVersionKey({
      assetVersionId: variant.assetVersionId,
    }),
    locale: variant.locale,
    channel: variant.channel,
    status: variant.status,
    contentFingerprint: variant.contentFingerprint,
    destinationKey: variant.destinationKey,
    publishedAt: variant.publishedAt,
    updatedAt: variant.updatedAt,
    metadata: variant.metadata,
  });
}

function buildPersistentFreshnessStateRow(
  state: RegistryFreshnessState,
): PersistentRegistryFreshnessStateRow {
  return Object.freeze({
    freshnessKey: buildPersistentFreshnessKey(state),
    assetKey: buildPersistentAssetKey({ assetId: state.assetId }),
    assetVersionKey:
      state.assetVersionId == null
        ? null
        : buildPersistentAssetVersionKey({
            assetVersionId: state.assetVersionId,
          }),
    computedAt: state.computedAt,
    reviewDueAt: state.reviewDueAt,
    publishableUntil: state.publishableUntil,
    staleAfter: state.staleAfter,
    expiredAfter: state.expiredAfter,
    isPublishable: state.isPublishable,
    isStale: state.isStale,
    isExpired: state.isExpired,
    evaluatedAt: state.evaluatedAt,
  });
}

function buildPersistentPublicationStateRow(
  state: RegistryPublicationState,
  fallbackTimestamp: string,
): PersistentRegistryPublicationStateRow {
  return Object.freeze({
    publicationKey: buildPersistentPublicationKey(state),
    assetKey: buildPersistentAssetKey({ assetId: state.assetId }),
    assetVersionKey: buildPersistentAssetVersionKey({
      assetVersionId: state.assetVersionId,
    }),
    locale: state.locale,
    channel: state.channel,
    publicationStatus: state.status,
    destinationKey: state.destinationKey,
    publicationFingerprint: state.publicationFingerprint,
    publishedAt: state.publishedAt,
    suppressedAt: state.suppressedAt,
    metadata: state.metadata,
    createdAt: fallbackTimestamp,
    updatedAt: fallbackTimestamp,
  });
}

export function buildPersistentRegistryRequestFingerprint(
  payload: Omit<PersistentRegistryWritePayload, "snapshot"> & {
    snapshot: Omit<PersistentRegistryWritePayload["snapshot"], "requestFingerprint">;
  },
): string {
  return createHash("sha256")
    .update(stableStringify(payload))
    .digest("hex");
}

export function buildPersistentRegistryWritePayload(input: Readonly<{
  currentSnapshot: RegistrySnapshot | null;
  snapshot: RegistrySnapshot;
  writeOptions: RegistryWriteOptions;
}>): PersistentRegistryWritePayload {
  const currentSnapshot =
    input.currentSnapshot == null
      ? null
      : normalizeRegistrySnapshot(parseRegistrySnapshot(input.currentSnapshot));
  const snapshot = normalizeRegistrySnapshot(parseRegistrySnapshot(input.snapshot));

  const assets = Object.freeze(snapshot.assets.map(buildPersistentAssetRow));
  const assetVersions = Object.freeze(
    snapshot.assetVersions.map(buildPersistentAssetVersionRow),
  );
  const artifactReferences = Object.freeze(
    snapshot.artifactReferences.map(buildPersistentArtifactReferenceRow),
  );
  const channelVariants = Object.freeze(
    snapshot.channelVariants.map(buildPersistentChannelVariantRow),
  );
  const freshnessStates = Object.freeze(
    snapshot.freshnessStates.map(buildPersistentFreshnessStateRow),
  );
  const publicationStates = Object.freeze(
    snapshot.publicationStates.map((state) =>
      buildPersistentPublicationStateRow(state, input.writeOptions.writtenAt),
    ),
  );

  const deleteKeys = Object.freeze({
    assetKeys: computeDeleteKeys(
      (currentSnapshot?.assets ?? []).map(buildPersistentAssetKey),
      assets.map((row) => row.assetKey),
    ),
    assetVersionKeys: computeDeleteKeys(
      (currentSnapshot?.assetVersions ?? []).map(buildPersistentAssetVersionKey),
      assetVersions.map((row) => row.assetVersionKey),
    ),
    referenceKeys: computeDeleteKeys(
      (currentSnapshot?.artifactReferences ?? []).map(buildPersistentReferenceKey),
      artifactReferences.map((row) => row.referenceKey),
    ),
    variantKeys: computeDeleteKeys(
      (currentSnapshot?.channelVariants ?? []).map(buildPersistentVariantKey),
      channelVariants.map((row) => row.variantKey),
    ),
    freshnessKeys: computeDeleteKeys(
      (currentSnapshot?.freshnessStates ?? []).map(buildPersistentFreshnessKey),
      freshnessStates.map((row) => row.freshnessKey),
    ),
    publicationKeys: computeDeleteKeys(
      (currentSnapshot?.publicationStates ?? []).map(buildPersistentPublicationKey),
      publicationStates.map((row) => row.publicationKey),
    ),
  } satisfies PersistentRegistryDeleteKeys);

  const snapshotRecordBase = Object.freeze({
    snapshotId: snapshot.snapshotId,
    requestedSnapshotVersion: snapshot.snapshotVersion,
    snapshotFingerprint: buildRegistrySnapshotFingerprint(snapshot),
    assetCount: assets.length,
    generatedAt: snapshot.generatedAt,
    writtenAt: input.writeOptions.writtenAt,
    idempotencyKey: input.writeOptions.idempotencyKey,
    policyVersions: sortStringRecord(snapshot.policyVersions),
    snapshotPayload: snapshot,
    metadata: mergeMetadata(snapshot.metadata, input.writeOptions.metadata),
  });

  const requestFingerprint = buildPersistentRegistryRequestFingerprint({
    snapshot: snapshotRecordBase,
    assets,
    assetVersions,
    artifactReferences,
    channelVariants,
    freshnessStates,
    publicationStates,
    deleteKeys,
  });

  return Object.freeze({
    snapshot: Object.freeze({
      ...snapshotRecordBase,
      requestFingerprint,
    }),
    assets,
    assetVersions,
    artifactReferences,
    channelVariants,
    freshnessStates,
    publicationStates,
    deleteKeys,
  });
}

export function buildSingleAssetSnapshot(
  asset: RegistryAsset,
  fallbackTimestamp: string,
): RegistrySnapshot {
  return normalizeRegistrySnapshot(
    parseRegistrySnapshot({
      snapshotId: PERSISTENT_REGISTRY_SNAPSHOT_ID,
      snapshotVersion: 1,
      generatedAt: fallbackTimestamp,
      assets: [asset],
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

export function buildSingleVersionSnapshot(
  version: RegistryAssetVersion,
  fallbackTimestamp: string,
): RegistrySnapshot {
  return normalizeRegistrySnapshot(
    parseRegistrySnapshot({
      snapshotId: PERSISTENT_REGISTRY_SNAPSHOT_ID,
      snapshotVersion: 1,
      generatedAt: fallbackTimestamp,
      assets: [],
      assetVersions: [version],
      artifactReferences: [],
      channelVariants: [],
      freshnessStates: [],
      publicationStates: [],
      policyVersions: version.policyVersions,
      metadata: {},
    }),
  );
}

export function buildSingleReferenceSnapshot(
  reference: RegistryArtifactReference,
  fallbackTimestamp: string,
): RegistrySnapshot {
  return normalizeRegistrySnapshot(
    parseRegistrySnapshot({
      snapshotId: PERSISTENT_REGISTRY_SNAPSHOT_ID,
      snapshotVersion: 1,
      generatedAt: fallbackTimestamp,
      assets: [],
      assetVersions: [],
      artifactReferences: [reference],
      channelVariants: [],
      freshnessStates: [],
      publicationStates: [],
      policyVersions: reference.policyVersions,
      metadata: {},
    }),
  );
}

export function buildSingleVariantSnapshot(
  variant: RegistryChannelVariant,
  fallbackTimestamp: string,
): RegistrySnapshot {
  return normalizeRegistrySnapshot(
    parseRegistrySnapshot({
      snapshotId: PERSISTENT_REGISTRY_SNAPSHOT_ID,
      snapshotVersion: 1,
      generatedAt: fallbackTimestamp,
      assets: [],
      assetVersions: [],
      artifactReferences: [],
      channelVariants: [variant],
      freshnessStates: [],
      publicationStates: [],
      policyVersions: {},
      metadata: {},
    }),
  );
}

export function buildSingleFreshnessStateSnapshot(
  state: RegistryFreshnessState,
  fallbackTimestamp: string,
): RegistrySnapshot {
  return normalizeRegistrySnapshot(
    parseRegistrySnapshot({
      snapshotId: PERSISTENT_REGISTRY_SNAPSHOT_ID,
      snapshotVersion: 1,
      generatedAt: fallbackTimestamp,
      assets: [],
      assetVersions: [],
      artifactReferences: [],
      channelVariants: [],
      freshnessStates: [state],
      publicationStates: [],
      policyVersions: {},
      metadata: {},
    }),
  );
}

export function buildSinglePublicationStateSnapshot(
  state: RegistryPublicationState,
  fallbackTimestamp: string,
): RegistrySnapshot {
  return normalizeRegistrySnapshot(
    parseRegistrySnapshot({
      snapshotId: PERSISTENT_REGISTRY_SNAPSHOT_ID,
      snapshotVersion: 1,
      generatedAt: fallbackTimestamp,
      assets: [],
      assetVersions: [],
      artifactReferences: [],
      channelVariants: [],
      freshnessStates: [],
      publicationStates: [state],
      policyVersions: {},
      metadata: {},
    }),
  );
}

export function assertExpectedAssetVersionForSnapshot(
  currentSnapshot: RegistrySnapshot | null,
  incomingSnapshot: RegistrySnapshot,
  expectedAssetVersion: string | undefined,
): void {
  if (expectedAssetVersion == null) {
    return;
  }

  const assetIds = new Set(incomingSnapshot.assets.map((asset) => asset.assetId));
  for (const version of incomingSnapshot.assetVersions) {
    assetIds.add(version.assetId);
  }

  if (assetIds.size !== 1) {
    throw new PersistentRegistryError({
      code: "unsupported_scope",
      operation: "assertExpectedAssetVersionForSnapshot",
      message:
        "expectedAssetVersion is only supported when exactly one asset is being written.",
    });
  }

  const assetId = [...assetIds][0]!;
  const currentAsset =
    currentSnapshot?.assets.find((asset) => asset.assetId === assetId) ?? null;
  const currentVersion = currentAsset?.activeVersionId ?? null;

  if (currentVersion !== expectedAssetVersion) {
    throw new PersistentRegistryError({
      code: "version_conflict",
      operation: "assertExpectedAssetVersionForSnapshot",
      message:
        `Expected active version ${expectedAssetVersion} for asset ${assetId}, received ${currentVersion ?? "null"}.`,
      assetId,
      assetVersionId: expectedAssetVersion,
    });
  }
}

export async function persistMarketReportPilot(input: Readonly<{
  definition: MarketReportDefinition;
  repository: PersistentRegistryRepository;
  writeOptions: RegistryWriteOptions;
}>): Promise<PersistentRegistryWriteResult> {
  const snapshot = buildRegistrySnapshotForMarketReport(input.definition);
  const currentSnapshot = await input.repository.readSnapshot().catch((error) => {
    if (error instanceof PersistentRegistryError && error.code === "not_found") {
      return null;
    }
    throw error;
  });
  const mergedSnapshot = mergeRegistrySnapshots({
    currentSnapshot,
    incomingSnapshot: snapshot,
    writtenAt: input.writeOptions.writtenAt,
    metadata: {
      sourceSnapshotId: snapshot.snapshotId,
      sourceSnapshotVersion: snapshot.snapshotVersion,
      marketReportId: input.definition.reportId,
    },
  });
  const writeResult = await input.repository.writeSnapshot(
    mergedSnapshot,
    input.writeOptions,
  );

  const readBackSnapshot = await input.repository.readSnapshot();
  const readBackFingerprint = buildRegistrySnapshotFingerprint(readBackSnapshot);
  if (readBackFingerprint !== writeResult.snapshotFingerprint) {
    throw new PersistentRegistryError({
      code: "snapshot_conflict",
      operation: "persistMarketReportPilot",
      message:
        "The snapshot reloaded after persistence does not match the written fingerprint.",
      snapshotId: writeResult.snapshot.snapshotId,
    });
  }

  return Object.freeze({
    ...writeResult,
    snapshot: readBackSnapshot,
  });
}

export const PERSISTENT_REGISTRY_TEST_HELPERS = Object.freeze({
  buildSingleAssetSnapshot,
  buildSingleVersionSnapshot,
  buildSingleReferenceSnapshot,
  buildSingleVariantSnapshot,
  buildSingleFreshnessStateSnapshot,
  buildSinglePublicationStateSnapshot,
});
