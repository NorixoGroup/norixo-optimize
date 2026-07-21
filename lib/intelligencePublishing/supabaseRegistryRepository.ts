import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "../supabase-admin";
import type { CoordinationJsonObject } from "./distributedCoordination";
import {
  applyRegistryReadScope,
  assertExpectedAssetVersionForSnapshot,
  buildPersistentAssetKey,
  buildPersistentAssetVersionKey,
  buildPersistentFreshnessKey,
  buildPersistentPublicationKey,
  buildPersistentReferenceKey,
  buildPersistentRegistryWritePayload,
  buildPersistentVariantKey,
  mergeRegistryCollections,
  mergeRegistrySnapshots,
  PERSISTENT_REGISTRY_SNAPSHOT_ID,
  PersistentRegistryError,
  type PersistentRegistryRepository,
  type PersistentRegistryWriteResult,
  type RegistryReadScope,
  type RegistryWriteOptions,
} from "./persistentRegistry";
import {
  buildRegistrySnapshotFingerprint,
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
  type IntelligencePublishingRegistryReader,
  type RegistryArtifactReference,
  type RegistryAsset,
  type RegistryAssetVersion,
  type RegistryChannelVariant,
  type RegistryFreshnessState,
  type RegistryPublicationState,
  type RegistrySnapshot,
} from "./registryAdapter";

type SupabaseRegistryAssetRow = Readonly<{
  asset_key: string;
  canonical_id: string;
  asset_type: RegistryAsset["assetType"];
  status: RegistryAsset["status"];
  visibility: RegistryAsset["visibility"];
  default_locale: string;
  available_locales: string[];
  available_channels: string[];
  active_version_key: string | null;
  template_id: string | null;
  owner_team: string;
  confidence_affects_visible_content: boolean;
  policy_change_affects_visible_content: boolean;
  freshness_expiry_behavior: RegistryAsset["freshnessExpiryBehavior"];
  metadata: CoordinationJsonObject;
  created_at: string;
  updated_at: string;
}>;

type SupabaseRegistryAssetVersionRow = Readonly<{
  asset_version_key: string;
  asset_key: string;
  version_number: number;
  status: RegistryAssetVersion["status"];
  content_fingerprint: string;
  source_fingerprint: string;
  template_fingerprint: string;
  renderer_fingerprint: string;
  policy_versions: Readonly<Record<string, string>>;
  confidence_band: RegistryAssetVersion["confidenceBand"];
  created_at: string;
  approved_at: string | null;
  published_at: string | null;
  superseded_at: string | null;
  metadata: CoordinationJsonObject;
}>;

type SupabaseRegistryArtifactReferenceRow = Readonly<{
  reference_key: string;
  asset_key: string;
  asset_version_key: string | null;
  artifact_type: RegistryArtifactReference["artifactType"];
  artifact_id: string;
  artifact_fingerprint: string;
  relationship_type: RegistryArtifactReference["relationshipType"];
  policy_versions: Readonly<Record<string, string>>;
  created_at: string;
  metadata: CoordinationJsonObject;
}>;

type SupabaseRegistryChannelVariantRow = Readonly<{
  variant_key: string;
  asset_key: string;
  asset_version_key: string;
  locale: string;
  channel: string;
  status: RegistryChannelVariant["status"];
  content_fingerprint: string;
  destination_key: string | null;
  published_at: string | null;
  updated_at: string;
  metadata: CoordinationJsonObject;
}>;

type SupabaseRegistryFreshnessStateRow = Readonly<{
  freshness_key: string;
  asset_key: string;
  asset_version_key: string | null;
  computed_at: string;
  review_due_at: string | null;
  publishable_until: string | null;
  stale_after: string | null;
  expired_after: string | null;
  is_publishable: boolean;
  is_stale: boolean;
  is_expired: boolean;
  evaluated_at: string;
}>;

type SupabaseRegistryPublicationStateRow = Readonly<{
  publication_key: string;
  asset_key: string;
  asset_version_key: string;
  locale: string;
  channel: string;
  publication_status: RegistryPublicationState["status"];
  destination_key: string | null;
  publication_fingerprint: string | null;
  published_at: string | null;
  suppressed_at: string | null;
  metadata: CoordinationJsonObject;
}>;

type SupabaseRegistrySnapshotRow = Readonly<{
  snapshot_key: string;
  snapshot_version: number;
  snapshot_fingerprint: string;
  request_fingerprint: string;
  idempotency_key: string;
  fencing_token: number;
  asset_count: number;
  generated_at: string;
  policy_versions: Readonly<Record<string, string>>;
  snapshot_payload: unknown;
  metadata: CoordinationJsonObject;
  created_at: string;
}>;

type RegistrySnapshotWriteRpcResult = Readonly<{
  status: "written" | "idempotent";
  snapshotId: string;
  snapshotVersion: number;
  snapshotFingerprint: string;
  fencingToken: number;
}>;

type RegistrySnapshotSource = Readonly<{
  header: SupabaseRegistrySnapshotRow;
  snapshot: RegistrySnapshot;
}>;

function sanitizeDatabaseErrorMessage(error: unknown): string {
  const message =
    typeof error === "object" &&
    error != null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : String(error ?? "Unknown database error");

  return message
    .replace(/service_role/gi, "[REDACTED_ROLE]")
    .replace(/[A-Za-z0-9_-]{30,}/g, "[REDACTED_VALUE]");
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString() === value;
}

function ensureCanonicalIsoTimestamp(value: string, operation: string): void {
  if (!isCanonicalIsoTimestamp(value)) {
    throw new PersistentRegistryError({
      code: "mapping_error",
      operation,
      message: `Expected a canonical ISO UTC timestamp, received ${value}.`,
    });
  }
}

function mapErrorCodeFromMessage(message: string): PersistentRegistryError["code"] {
  if (message.includes("IPP_IDEMPOTENCY_CONFLICT")) {
    return "idempotency_conflict";
  }
  if (message.includes("IPP_SNAPSHOT_VERSION_CONFLICT")) {
    return "snapshot_version_conflict";
  }
  if (message.includes("IPP_FENCING_CONFLICT")) {
    return "fencing_conflict";
  }
  if (message.includes("IPP_SNAPSHOT_CONFLICT")) {
    return "snapshot_conflict";
  }
  if (message.includes("IPP_INVALID_SNAPSHOT")) {
    return "invalid_snapshot";
  }
  if (message.includes("IPP_INVALID_WRITE_OPTIONS")) {
    return "mapping_error";
  }
  return "database_error";
}

function toPersistentRegistryError(
  operation: string,
  error: unknown,
  extra: Readonly<{
    assetId?: string;
    assetVersionId?: string;
    snapshotId?: string;
    path?: string;
  }> = {},
): PersistentRegistryError {
  const message = sanitizeDatabaseErrorMessage(error);
  return new PersistentRegistryError({
    code: mapErrorCodeFromMessage(message),
    operation,
    message,
    assetId: extra.assetId,
    assetVersionId: extra.assetVersionId,
    snapshotId: extra.snapshotId,
    path: extra.path,
    cause: error,
  });
}

function normalizeMetadata(
  metadata: CoordinationJsonObject | undefined,
): CoordinationJsonObject {
  return Object.freeze({ ...(metadata ?? {}) });
}

function assertPersistedKeyMatches(
  actual: string,
  expected: string,
  operation: string,
  path: string,
): void {
  if (actual !== expected) {
    throw new PersistentRegistryError({
      code: "derived_key_mismatch",
      operation,
      path,
      message: `Persisted key mismatch at ${path}: expected ${expected}, received ${actual}.`,
    });
  }
}

function mapAssetRowToContract(row: SupabaseRegistryAssetRow): RegistryAsset {
  const contract = Object.freeze({
    assetId: row.asset_key,
    canonicalId: row.canonical_id,
    assetType: row.asset_type,
    status: row.status,
    visibility: row.visibility,
    defaultLocale: row.default_locale,
    availableLocales: Object.freeze([...(row.available_locales ?? [])]),
    availableChannels: Object.freeze([...(row.available_channels ?? [])]),
    activeVersionId: row.active_version_key,
    templateId: row.template_id,
    ownerTeam: row.owner_team,
    confidenceAffectsVisibleContent: row.confidence_affects_visible_content,
    policyChangeAffectsVisibleContent: row.policy_change_affects_visible_content,
    freshnessExpiryBehavior: row.freshness_expiry_behavior,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: normalizeMetadata(row.metadata),
  });
  assertPersistedKeyMatches(
    row.asset_key,
    buildPersistentAssetKey(contract),
    "mapAssetRowToContract",
    "asset_key",
  );
  return contract;
}

function mapVersionRowToContract(
  row: SupabaseRegistryAssetVersionRow,
): RegistryAssetVersion {
  const contract = Object.freeze({
    assetVersionId: row.asset_version_key,
    assetId: row.asset_key,
    versionNumber: row.version_number,
    status: row.status,
    contentFingerprint: row.content_fingerprint,
    sourceFingerprint: row.source_fingerprint,
    templateFingerprint: row.template_fingerprint,
    rendererFingerprint: row.renderer_fingerprint,
    policyVersions: Object.freeze({ ...(row.policy_versions ?? {}) }),
    confidenceBand: row.confidence_band,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    supersededAt: row.superseded_at,
    metadata: normalizeMetadata(row.metadata),
  });
  assertPersistedKeyMatches(
    row.asset_version_key,
    buildPersistentAssetVersionKey(contract),
    "mapVersionRowToContract",
    "asset_version_key",
  );
  assertPersistedKeyMatches(
    row.asset_key,
    buildPersistentAssetKey({ assetId: contract.assetId }),
    "mapVersionRowToContract",
    "asset_key",
  );
  return contract;
}

function mapReferenceRowToContract(
  row: SupabaseRegistryArtifactReferenceRow,
): RegistryArtifactReference {
  const contract = Object.freeze({
    referenceId: row.reference_key,
    assetId: row.asset_key,
    assetVersionId: row.asset_version_key,
    artifactType: row.artifact_type,
    artifactId: row.artifact_id,
    artifactFingerprint: row.artifact_fingerprint,
    relationshipType: row.relationship_type,
    policyVersions: Object.freeze({ ...(row.policy_versions ?? {}) }),
    createdAt: row.created_at,
    metadata: normalizeMetadata(row.metadata),
  });
  assertPersistedKeyMatches(
    row.reference_key,
    buildPersistentReferenceKey(contract),
    "mapReferenceRowToContract",
    "reference_key",
  );
  return contract;
}

function mapVariantRowToContract(
  row: SupabaseRegistryChannelVariantRow,
): RegistryChannelVariant {
  const contract = Object.freeze({
    variantId: row.variant_key,
    assetId: row.asset_key,
    assetVersionId: row.asset_version_key,
    locale: row.locale,
    channel: row.channel,
    status: row.status,
    contentFingerprint: row.content_fingerprint,
    destinationKey: row.destination_key,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    metadata: normalizeMetadata(row.metadata),
  });
  assertPersistedKeyMatches(
    row.variant_key,
    buildPersistentVariantKey(contract),
    "mapVariantRowToContract",
    "variant_key",
  );
  return contract;
}

function mapFreshnessRowToContract(
  row: SupabaseRegistryFreshnessStateRow,
): RegistryFreshnessState {
  const contract = Object.freeze({
    assetId: row.asset_key,
    assetVersionId: row.asset_version_key,
    computedAt: row.computed_at,
    reviewDueAt: row.review_due_at,
    publishableUntil: row.publishable_until,
    staleAfter: row.stale_after,
    expiredAfter: row.expired_after,
    isPublishable: row.is_publishable,
    isStale: row.is_stale,
    isExpired: row.is_expired,
    evaluatedAt: row.evaluated_at,
  });
  assertPersistedKeyMatches(
    row.freshness_key,
    buildPersistentFreshnessKey(contract),
    "mapFreshnessRowToContract",
    "freshness_key",
  );
  return contract;
}

function mapPublicationRowToContract(
  row: SupabaseRegistryPublicationStateRow,
): RegistryPublicationState {
  const contract = Object.freeze({
    assetId: row.asset_key,
    assetVersionId: row.asset_version_key,
    locale: row.locale,
    channel: row.channel,
    status: row.publication_status,
    destinationKey: row.destination_key,
    publicationFingerprint: row.publication_fingerprint,
    publishedAt: row.published_at,
    suppressedAt: row.suppressed_at,
    metadata: normalizeMetadata(row.metadata),
  });
  assertPersistedKeyMatches(
    row.publication_key,
    buildPersistentPublicationKey(contract),
    "mapPublicationRowToContract",
    "publication_key",
  );
  return contract;
}

function buildSnapshotFromRows(
  header: SupabaseRegistrySnapshotRow,
  rows: Readonly<{
    assets: readonly SupabaseRegistryAssetRow[];
    assetVersions: readonly SupabaseRegistryAssetVersionRow[];
    artifactReferences: readonly SupabaseRegistryArtifactReferenceRow[];
    channelVariants: readonly SupabaseRegistryChannelVariantRow[];
    freshnessStates: readonly SupabaseRegistryFreshnessStateRow[];
    publicationStates: readonly SupabaseRegistryPublicationStateRow[];
  }>,
): RegistrySnapshot {
  const payload =
    typeof header.snapshot_payload === "object" && header.snapshot_payload != null
      ? (header.snapshot_payload as Record<string, unknown>)
      : {};

  return normalizeRegistrySnapshot(
    parseRegistrySnapshot({
      snapshotId:
        typeof payload.snapshotId === "string" && payload.snapshotId.trim().length > 0
          ? payload.snapshotId
          : header.snapshot_key,
      snapshotVersion: header.snapshot_version,
      generatedAt:
        typeof payload.generatedAt === "string" &&
        payload.generatedAt.trim().length > 0
          ? payload.generatedAt
          : header.generated_at,
      assets: rows.assets.map(mapAssetRowToContract),
      assetVersions: rows.assetVersions.map(mapVersionRowToContract),
      artifactReferences: rows.artifactReferences.map(mapReferenceRowToContract),
      channelVariants: rows.channelVariants.map(mapVariantRowToContract),
      freshnessStates: rows.freshnessStates.map(mapFreshnessRowToContract),
      publicationStates: rows.publicationStates.map(mapPublicationRowToContract),
      policyVersions:
        typeof payload.policyVersions === "object" && payload.policyVersions != null
          ? payload.policyVersions
          : header.policy_versions,
      metadata:
        typeof payload.metadata === "object" && payload.metadata != null
          ? payload.metadata
          : {},
    }),
  );
}

async function maybeSingleRow<T>(
  promise: Promise<{
    data: T[] | null;
    error: unknown;
  }>,
  operation: string,
): Promise<T | null> {
  const { data, error } = await promise;
  if (error != null) {
    throw toPersistentRegistryError(operation, error);
  }
  return data?.[0] ?? null;
}

// TypeScript owns the canonical registry representation. SQL owns atomic
// persistence and transactional concurrency checks.
export class SupabasePersistentRegistryRepository
  implements PersistentRegistryRepository, IntelligencePublishingRegistryReader
{
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? createSupabaseAdminClient();
  }

  private async getLatestSnapshotRow(asOf?: string): Promise<SupabaseRegistrySnapshotRow | null> {
    if (asOf != null) {
      ensureCanonicalIsoTimestamp(asOf, "getLatestSnapshotRow");
    }

    let query = this.client
      .from("intelligence_publishing_registry_snapshots")
      .select(
        "snapshot_key,snapshot_version,snapshot_fingerprint,request_fingerprint,idempotency_key,fencing_token,asset_count,generated_at,policy_versions,snapshot_payload,metadata,created_at",
      )
      .order("snapshot_version", { ascending: false })
      .limit(1);

    if (asOf != null) {
      query = query.lte("generated_at", asOf);
    }

    const { data, error } = await query;
    if (error != null) {
      throw toPersistentRegistryError("getLatestSnapshotRow", error);
    }

    return (data?.[0] as SupabaseRegistrySnapshotRow | undefined) ?? null;
  }

  private async loadCurrentSnapshotFromTables(): Promise<RegistrySnapshotSource | null> {
    const header = await this.getLatestSnapshotRow();
    if (header == null) {
      return null;
    }

    const [
      assetsResult,
      versionsResult,
      referencesResult,
      variantsResult,
      freshnessResult,
      publicationsResult,
    ] = await Promise.all([
      this.client
        .from("intelligence_publishing_assets")
        .select(
          "asset_key,canonical_id,asset_type,status,visibility,default_locale,available_locales,available_channels,active_version_key,template_id,owner_team,confidence_affects_visible_content,policy_change_affects_visible_content,freshness_expiry_behavior,metadata,created_at,updated_at",
        )
        .order("asset_key", { ascending: true }),
      this.client
        .from("intelligence_publishing_asset_versions")
        .select(
          "asset_version_key,asset_key,version_number,status,content_fingerprint,source_fingerprint,template_fingerprint,renderer_fingerprint,policy_versions,confidence_band,created_at,approved_at,published_at,superseded_at,metadata",
        )
        .order("asset_key", { ascending: true })
        .order("version_number", { ascending: true }),
      this.client
        .from("intelligence_publishing_artifact_references")
        .select(
          "reference_key,asset_key,asset_version_key,artifact_type,artifact_id,artifact_fingerprint,relationship_type,policy_versions,created_at,metadata",
        )
        .order("reference_key", { ascending: true }),
      this.client
        .from("intelligence_publishing_channel_variants")
        .select(
          "variant_key,asset_key,asset_version_key,locale,channel,status,content_fingerprint,destination_key,published_at,updated_at,metadata",
        )
        .order("variant_key", { ascending: true }),
      this.client
        .from("intelligence_publishing_freshness_states")
        .select(
          "freshness_key,asset_key,asset_version_key,computed_at,review_due_at,publishable_until,stale_after,expired_after,is_publishable,is_stale,is_expired,evaluated_at",
        )
        .order("freshness_key", { ascending: true }),
      this.client
        .from("intelligence_publishing_publication_states")
        .select(
          "publication_key,asset_key,asset_version_key,locale,channel,publication_status,destination_key,publication_fingerprint,published_at,suppressed_at,metadata",
        )
        .order("publication_key", { ascending: true }),
    ]);

    for (const [operation, result] of [
      ["loadAssets", assetsResult],
      ["loadVersions", versionsResult],
      ["loadReferences", referencesResult],
      ["loadVariants", variantsResult],
      ["loadFreshnessStates", freshnessResult],
      ["loadPublicationStates", publicationsResult],
    ] as const) {
      if (result.error != null) {
        throw toPersistentRegistryError(operation, result.error);
      }
    }

    const snapshot = buildSnapshotFromRows(header, {
      assets: (assetsResult.data ?? []) as SupabaseRegistryAssetRow[],
      assetVersions:
        (versionsResult.data ?? []) as SupabaseRegistryAssetVersionRow[],
      artifactReferences:
        (referencesResult.data ?? []) as SupabaseRegistryArtifactReferenceRow[],
      channelVariants:
        (variantsResult.data ?? []) as SupabaseRegistryChannelVariantRow[],
      freshnessStates:
        (freshnessResult.data ?? []) as SupabaseRegistryFreshnessStateRow[],
      publicationStates:
        (publicationsResult.data ?? []) as SupabaseRegistryPublicationStateRow[],
    });

    return Object.freeze({
      header,
      snapshot,
    });
  }

  private async loadSnapshotFromPayload(asOf: string): Promise<RegistrySnapshotSource | null> {
    const header = await this.getLatestSnapshotRow(asOf);
    if (header == null) {
      return null;
    }

    const snapshot = normalizeRegistrySnapshot(
      parseRegistrySnapshot(header.snapshot_payload),
    );

    return Object.freeze({
      header,
      snapshot,
    });
  }

  private async readBaseSnapshot(scope?: RegistryReadScope): Promise<RegistrySnapshotSource> {
    const source =
      scope?.asOf == null
        ? await this.loadCurrentSnapshotFromTables()
        : await this.loadSnapshotFromPayload(scope.asOf);

    if (source == null) {
      throw new PersistentRegistryError({
        code: "not_found",
        operation: "readSnapshot",
        message: "No persistent registry snapshot is available yet.",
        snapshotId: PERSISTENT_REGISTRY_SNAPSHOT_ID,
      });
    }

    return source;
  }

  async readSnapshot(scope?: RegistryReadScope): Promise<RegistrySnapshot> {
    const source = await this.readBaseSnapshot(scope);
    return applyRegistryReadScope(source.snapshot, scope);
  }

  async getSnapshot(): Promise<RegistrySnapshot> {
    return this.readSnapshot();
  }

  async getAsset(assetId: string): Promise<RegistryAsset | null> {
    const snapshot = await this.readSnapshot({
      assetIds: [assetId],
      includeHistoricalVersions: true,
    });
    return snapshot.assets[0] ?? null;
  }

  async getVersion(assetVersionId: string): Promise<RegistryAssetVersion | null> {
    const snapshot = await this.readSnapshot({
      includeHistoricalVersions: true,
    });
    return (
      snapshot.assetVersions.find(
        (version) => version.assetVersionId === assetVersionId,
      ) ?? null
    );
  }

  async getAssetVersion(assetVersionId: string): Promise<RegistryAssetVersion | null> {
    return this.getVersion(assetVersionId);
  }

  async listVersions(assetId: string): Promise<readonly RegistryAssetVersion[]> {
    const snapshot = await this.readSnapshot({
      assetIds: [assetId],
      includeHistoricalVersions: true,
    });
    return Object.freeze(
      snapshot.assetVersions.filter((version) => version.assetId === assetId),
    );
  }

  async listAssetVersions(assetId: string): Promise<readonly RegistryAssetVersion[]> {
    return this.listVersions(assetId);
  }

  async findAssetsByArtifact(
    subjectType: RegistryArtifactReference["artifactType"],
    subjectId: string,
  ): Promise<readonly RegistryAsset[]> {
    const snapshot = await this.readSnapshot({
      includeHistoricalVersions: true,
    });
    const assetIds = new Set(
      snapshot.artifactReferences
        .filter(
          (reference) =>
            reference.artifactType === subjectType &&
            reference.artifactId === subjectId,
        )
        .map((reference) => reference.assetId),
    );

    return Object.freeze(
      snapshot.assets.filter((asset) => assetIds.has(asset.assetId)),
    );
  }

  async listArtifactReferences(
    assetId: string,
  ): Promise<readonly RegistryArtifactReference[]> {
    const snapshot = await this.readSnapshot({
      assetIds: [assetId],
      includeHistoricalVersions: true,
    });
    return Object.freeze(
      snapshot.artifactReferences.filter((reference) => reference.assetId === assetId),
    );
  }

  async listChannelVariants(
    assetId: string,
    assetVersionId?: string | null,
  ): Promise<readonly RegistryChannelVariant[]> {
    const snapshot = await this.readSnapshot({
      assetIds: [assetId],
      includeHistoricalVersions: true,
    });
    return Object.freeze(
      snapshot.channelVariants.filter(
        (variant) =>
          variant.assetId === assetId &&
          (assetVersionId == null || variant.assetVersionId === assetVersionId),
      ),
    );
  }

  async getFreshnessState(
    assetId: string,
    assetVersionId?: string | null,
  ): Promise<RegistryFreshnessState | null> {
    const snapshot = await this.readSnapshot({
      assetIds: [assetId],
      includeHistoricalVersions: true,
    });
    return (
      snapshot.freshnessStates.find(
        (state) =>
          state.assetId === assetId &&
          (assetVersionId == null
            ? state.assetVersionId == null
            : state.assetVersionId === assetVersionId),
      ) ?? null
    );
  }

  async listPublicationStates(
    assetId: string,
    assetVersionId?: string | null,
  ): Promise<readonly RegistryPublicationState[]> {
    const snapshot = await this.readSnapshot({
      assetIds: [assetId],
      includeHistoricalVersions: true,
    });
    return Object.freeze(
      snapshot.publicationStates.filter(
        (state) =>
          state.assetId === assetId &&
          (assetVersionId == null || state.assetVersionId === assetVersionId),
      ),
    );
  }

  private async writeMergedSnapshot(
    incomingSnapshot: RegistrySnapshot,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult> {
    ensureCanonicalIsoTimestamp(options.writtenAt, "writeMergedSnapshot");
    const normalizedIncomingSnapshot = normalizeRegistrySnapshot(
      parseRegistrySnapshot(incomingSnapshot),
    );
    const currentSnapshotSource =
      await this.loadCurrentSnapshotFromTables().catch((error) => {
        if (
          error instanceof PersistentRegistryError &&
          error.code === "not_found"
        ) {
          return null;
        }
        throw error;
      });
    const currentSnapshot = currentSnapshotSource?.snapshot ?? null;

    assertExpectedAssetVersionForSnapshot(
      currentSnapshot,
      normalizedIncomingSnapshot,
      options.expectedAssetVersion,
    );

    const mergedSnapshot = mergeRegistrySnapshots({
      currentSnapshot,
      incomingSnapshot: normalizedIncomingSnapshot,
      writtenAt: options.writtenAt,
    });
    return this.persistSnapshot(mergedSnapshot, options, currentSnapshot);
  }

  private async loadCurrentSnapshotOrNull(): Promise<RegistrySnapshot | null> {
    const source = await this.loadCurrentSnapshotFromTables().catch((error) => {
      if (
        error instanceof PersistentRegistryError &&
        error.code === "not_found"
      ) {
        return null;
      }
      throw error;
    });

    return source?.snapshot ?? null;
  }

  private async persistCollections(
    options: RegistryWriteOptions,
    collections: Readonly<{
      assets?: readonly RegistryAsset[];
      assetVersions?: readonly RegistryAssetVersion[];
      artifactReferences?: readonly RegistryArtifactReference[];
      channelVariants?: readonly RegistryChannelVariant[];
      freshnessStates?: readonly RegistryFreshnessState[];
      publicationStates?: readonly RegistryPublicationState[];
      policyVersions?: Readonly<Record<string, string>>;
    }>,
  ): Promise<PersistentRegistryWriteResult> {
    const currentSnapshot = await this.loadCurrentSnapshotOrNull();
    const mergedSnapshot = mergeRegistryCollections({
      currentSnapshot,
      writtenAt: options.writtenAt,
      ...collections,
    });
    assertExpectedAssetVersionForSnapshot(
      currentSnapshot,
      mergedSnapshot,
      options.expectedAssetVersion,
    );
    return this.persistSnapshot(mergedSnapshot, options, currentSnapshot);
  }

  private async persistSnapshot(
    snapshot: RegistrySnapshot,
    options: RegistryWriteOptions,
    currentSnapshotOverride?: RegistrySnapshot | null,
  ): Promise<PersistentRegistryWriteResult> {
    ensureCanonicalIsoTimestamp(options.writtenAt, "persistSnapshot");
    const normalizedSnapshot = normalizeRegistrySnapshot(
      parseRegistrySnapshot(snapshot),
    );
    const currentSnapshot =
      currentSnapshotOverride === undefined
        ? (
            await this.loadCurrentSnapshotFromTables().catch((error) => {
              if (
                error instanceof PersistentRegistryError &&
                error.code === "not_found"
              ) {
                return null;
              }
              throw error;
            })
          )?.snapshot ?? null
        : currentSnapshotOverride;
    const writePayload = buildPersistentRegistryWritePayload({
      currentSnapshot,
      snapshot: normalizedSnapshot,
      writeOptions: options,
    });
    const mergedFingerprint = writePayload.snapshot.snapshotFingerprint;
    const { data, error } = await this.client.rpc(
      "write_intelligence_publishing_registry_snapshot",
      {
        p_snapshot: writePayload,
        p_write_options: {
          expectedSnapshotFingerprint: options.expectedSnapshotFingerprint ?? null,
          fencingToken: options.fencingToken ?? null,
        },
      },
    );

    if (error != null) {
      throw toPersistentRegistryError("writeSnapshot", error, {
        snapshotId: normalizedSnapshot.snapshotId,
      });
    }

    const rpcResult = data as RegistrySnapshotWriteRpcResult;
    const reloadedSnapshot = await this.readSnapshot();
    const reloadedFingerprint =
      buildRegistrySnapshotFingerprint(reloadedSnapshot);
    if (reloadedFingerprint !== mergedFingerprint) {
      throw new PersistentRegistryError({
        code: "snapshot_conflict",
        operation: "writeSnapshot",
        message:
          "The reloaded snapshot fingerprint differs from the merged snapshot fingerprint after persistence.",
        snapshotId: reloadedSnapshot.snapshotId,
      });
    }

    return Object.freeze({
      status: rpcResult.status,
      snapshot: reloadedSnapshot,
      snapshotFingerprint: reloadedFingerprint,
      snapshotVersion: reloadedSnapshot.snapshotVersion,
      snapshotId: reloadedSnapshot.snapshotId,
      fencingToken: Number(rpcResult.fencingToken ?? 0),
      metadata: normalizeMetadata(options.metadata),
    });
  }

  async upsertAsset(
    asset: RegistryAsset,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult> {
    return this.persistCollections(options, {
      assets: [asset],
    });
  }

  async upsertVersion(
    version: RegistryAssetVersion,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult> {
    return this.persistCollections(options, {
      assetVersions: [version],
      policyVersions: version.policyVersions,
    });
  }

  async upsertArtifactReference(
    reference: RegistryArtifactReference,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult> {
    return this.persistCollections(options, {
      artifactReferences: [reference],
      policyVersions: reference.policyVersions,
    });
  }

  async upsertChannelVariant(
    variant: RegistryChannelVariant,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult> {
    return this.persistCollections(options, {
      channelVariants: [variant],
    });
  }

  async upsertFreshnessState(
    state: RegistryFreshnessState,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult> {
    return this.persistCollections(options, {
      freshnessStates: [state],
    });
  }

  async upsertPublicationState(
    state: RegistryPublicationState,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult> {
    return this.persistCollections(options, {
      publicationStates: [state],
    });
  }

  async writeSnapshot(
    snapshot: RegistrySnapshot,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult> {
    return this.persistSnapshot(snapshot, options);
  }
}

export function createSupabasePersistentRegistryRepository(
  client?: SupabaseClient,
): PersistentRegistryRepository {
  return new SupabasePersistentRegistryRepository(client);
}
