import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { buildExecutionPlan } from "../lib/intelligencePublishing/executionEngine";
import { parsePublicationEventEnvelope } from "../lib/intelligencePublishing/eventContracts";
import {
  applyRegistryReadScope,
  assertExpectedAssetVersionForSnapshot,
  buildPersistentFreshnessKey,
  buildPersistentPublicationKey,
  buildPersistentRegistryRequestFingerprint,
  buildPersistentRegistryWritePayload,
  buildPersistentVariantKey,
  buildPersistentReferenceKey,
  mergeRegistryCollections,
  mergeRegistrySnapshots,
  persistMarketReportPilot,
  PersistentRegistryError,
  type PersistentRegistryRepository,
  type PersistentRegistryWriteResult,
  type RegistryReadScope,
  type RegistryWriteOptions,
} from "../lib/intelligencePublishing/persistentRegistry";
import {
  buildRegistrySnapshotForMarketReport,
  parseMarketReportDefinition,
} from "../lib/intelligencePublishing/marketReportPilot";
import {
  buildRegistrySnapshotFingerprint,
  parseRegistrySnapshot,
  type RegistryArtifactReference,
  type RegistryAsset,
  type RegistryAssetVersion,
  type RegistryChannelVariant,
  type RegistryFreshnessState,
  type RegistryPublicationState,
  type RegistrySnapshot,
} from "../lib/intelligencePublishing/registryAdapter";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type MemoryHistoryEntry = Readonly<{
  snapshot: RegistrySnapshot;
  fingerprint: string;
  requestFingerprint: string;
  fencingToken: number;
  idempotencyKey: string;
}>;

class InMemoryPersistentRegistryRepository
  implements PersistentRegistryRepository
{
  private history: MemoryHistoryEntry[] = [];
  private idempotency = new Map<string, MemoryHistoryEntry>();

  async readSnapshot(scope?: RegistryReadScope): Promise<RegistrySnapshot> {
    const source =
      scope?.asOf == null
        ? this.history[this.history.length - 1] ?? null
        : [...this.history]
            .reverse()
            .find((entry) => entry.snapshot.generatedAt <= scope.asOf!) ?? null;

    if (source == null) {
      throw new PersistentRegistryError({
        code: "not_found",
        operation: "readSnapshot",
        message: "No in-memory registry snapshot is available.",
      });
    }

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

  async getAssetVersion(
    assetVersionId: string,
  ): Promise<RegistryAssetVersion | null> {
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
    const current = this.history[this.history.length - 1]?.snapshot ?? null;
    assertExpectedAssetVersionForSnapshot(
      current,
      incomingSnapshot,
      options.expectedAssetVersion,
    );

    const merged = mergeRegistrySnapshots({
      currentSnapshot: current,
      incomingSnapshot,
      writtenAt: options.writtenAt,
    });
    return this.persistSnapshot(merged, options);
  }

  private async persistSnapshot(
    snapshot: RegistrySnapshot,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult> {
    const current = this.history[this.history.length - 1]?.snapshot ?? null;
    const normalizedSnapshot = parseRegistrySnapshot(snapshot);
    const writePayload = buildPersistentRegistryWritePayload({
      currentSnapshot: current,
      snapshot: normalizedSnapshot,
      writeOptions: options,
    });
    const fingerprint = writePayload.snapshot.snapshotFingerprint;
    const existingIdempotent = this.idempotency.get(options.idempotencyKey);
    if (existingIdempotent != null) {
      if (
        existingIdempotent.requestFingerprint !==
        writePayload.snapshot.requestFingerprint
      ) {
        throw new PersistentRegistryError({
          code: "idempotency_conflict",
          operation: "writeSnapshot",
          message:
            "The idempotency key already exists with a different request fingerprint.",
          snapshotId: existingIdempotent.snapshot.snapshotId,
        });
      }

      return Object.freeze({
        status: "idempotent",
        snapshot: existingIdempotent.snapshot,
        snapshotFingerprint: existingIdempotent.fingerprint,
        snapshotVersion: existingIdempotent.snapshot.snapshotVersion,
        snapshotId: existingIdempotent.snapshot.snapshotId,
        fencingToken: existingIdempotent.fencingToken,
        metadata: Object.freeze({ ...(options.metadata ?? {}) }),
      });
    }

    const currentFingerprint =
      current == null ? null : buildRegistrySnapshotFingerprint(current);
    if (
      options.expectedSnapshotFingerprint != null &&
      currentFingerprint !== options.expectedSnapshotFingerprint
    ) {
      throw new PersistentRegistryError({
        code: "snapshot_conflict",
        operation: "writeSnapshot",
        message:
          "expectedSnapshotFingerprint does not match the current in-memory snapshot fingerprint.",
        snapshotId: current?.snapshotId,
      });
    }

    const currentFencingToken = this.history[this.history.length - 1]?.fencingToken ?? 0;
    if (
      options.fencingToken != null &&
      currentFencingToken > options.fencingToken
    ) {
      throw new PersistentRegistryError({
        code: "fencing_conflict",
        operation: "writeSnapshot",
        message: "The provided fencing token is stale.",
        snapshotId: current?.snapshotId,
      });
    }

    const historyEntry: MemoryHistoryEntry = Object.freeze({
      snapshot: normalizedSnapshot,
      fingerprint,
      requestFingerprint: writePayload.snapshot.requestFingerprint,
      fencingToken: currentFencingToken + 1,
      idempotencyKey: options.idempotencyKey,
    });
    this.history.push(historyEntry);
    this.idempotency.set(options.idempotencyKey, historyEntry);

    return Object.freeze({
      status: "written",
      snapshot: normalizedSnapshot,
      snapshotFingerprint: fingerprint,
      snapshotVersion: normalizedSnapshot.snapshotVersion,
      snapshotId: normalizedSnapshot.snapshotId,
      fencingToken: historyEntry.fencingToken,
      metadata: Object.freeze({ ...(options.metadata ?? {}) }),
    });
  }

  private getCurrentSnapshot(): RegistrySnapshot | null {
    return this.history[this.history.length - 1]?.snapshot ?? null;
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
    const currentSnapshot = this.getCurrentSnapshot();
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
    return this.persistSnapshot(mergedSnapshot, options);
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

function buildWriteOptions(
  idempotencyKey: string,
  overrides: Partial<RegistryWriteOptions> = {},
): RegistryWriteOptions {
  return Object.freeze({
    idempotencyKey,
    writtenAt: "2026-07-20T19:00:00.000Z",
    metadata: {
      smoke: "persistent_registry",
    },
    ...overrides,
  });
}

function buildBaseSnapshotInput() {
  return {
    snapshotId: "seed_registry_snapshot",
    snapshotVersion: 1,
    generatedAt: "2026-07-20T18:00:00.000Z",
    assets: [
      {
        assetId: "asset_report_paris",
        canonicalId: "market-report-paris",
        assetType: "market_report",
        status: "published",
        visibility: "public",
        defaultLocale: "en",
        availableLocales: ["en", "fr"],
        availableChannels: ["web", "api"],
        activeVersionId: "asset_report_paris_v2",
        templateId: "tpl_market_report",
        ownerTeam: "intelligence",
        confidenceAffectsVisibleContent: true,
        policyChangeAffectsVisibleContent: true,
        freshnessExpiryBehavior: "keep_visible",
        createdAt: "2026-07-01T09:00:00.000Z",
        updatedAt: "2026-07-20T18:00:00.000Z",
        metadata: {
          market: "paris",
        },
      },
    ],
    assetVersions: [
      {
        assetVersionId: "asset_report_paris_v2",
        assetId: "asset_report_paris",
        versionNumber: 2,
        status: "active",
        contentFingerprint: "content_fp_paris_v2",
        sourceFingerprint: "source_fp_paris_v2",
        templateFingerprint: "template_fp_market_report_v1",
        rendererFingerprint: "renderer_fp_web_v2",
        policyVersions: {
          pricing_policy: "policy_v2",
        },
        confidenceBand: "high",
        createdAt: "2026-07-18T09:00:00.000Z",
        approvedAt: "2026-07-19T09:00:00.000Z",
        publishedAt: "2026-07-20T10:00:00.000Z",
        supersededAt: null,
        metadata: {
          summary: "active paris report",
        },
      },
    ],
    artifactReferences: [
      {
        referenceId: "ref_paris_benchmark",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        artifactType: "benchmark",
        artifactId: "benchmark:paris:pricing",
        artifactFingerprint: "benchmark_fp_v2",
        relationshipType: "supported_by",
        policyVersions: {
          pricing_policy: "policy_v2",
        },
        createdAt: "2026-07-20T09:35:00.000Z",
        metadata: {
          approved: true,
        },
      },
    ],
    channelVariants: [
      {
        variantId: "variant_paris_en_web_v2",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        locale: "en",
        channel: "web",
        status: "published",
        contentFingerprint: "variant_fp_paris_en_web_v2",
        destinationKey: "site:web:en",
        publishedAt: "2026-07-20T10:05:00.000Z",
        updatedAt: "2026-07-20T10:05:00.000Z",
        metadata: {},
      },
    ],
    freshnessStates: [
      {
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        computedAt: "2026-07-20T10:00:00.000Z",
        reviewDueAt: "2026-07-25T10:00:00.000Z",
        publishableUntil: "2026-08-20T10:00:00.000Z",
        staleAfter: "2026-07-28T10:00:00.000Z",
        expiredAfter: "2026-08-20T10:00:00.000Z",
        isPublishable: true,
        isStale: false,
        isExpired: false,
        evaluatedAt: "2026-07-20T10:00:00.000Z",
      },
    ],
    publicationStates: [
      {
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        locale: "en",
        channel: "web",
        status: "published",
        destinationKey: "site:web:en",
        publicationFingerprint: "publication_fp_paris_en_web_v2",
        publishedAt: "2026-07-20T10:05:00.000Z",
        suppressedAt: null,
        metadata: {},
      },
    ],
    policyVersions: {
      pricing_policy: "policy_v2",
    },
    metadata: {
      seed: "base",
    },
  };
}

function expectPersistentRegistryError(
  fn: () => Promise<unknown>,
): Promise<PersistentRegistryError> {
  try {
    return fn()
      .then(() => {
        throw new Error("Expected a PersistentRegistryError.");
      })
      .catch((error) => error as PersistentRegistryError);
  } catch (error) {
    return Promise.resolve(error as PersistentRegistryError);
  }
}

function buildMarketReportDefinition() {
  return parseMarketReportDefinition({
    reportId: "report_marrakech_airbnb_apartment_en",
    marketCellKey: "morocco:marrakech:airbnb:apartment",
    city: "Marrakech",
    country: "morocco",
    platform: "airbnb",
    propertyType: "apartment",
    language: "en",
    title: "Marrakech Airbnb Market Report",
    slug: "marrakech-airbnb-market-report",
    reportVersion: 3,
    benchmarkFingerprint: "benchmark_fp_marrakech_v3",
    overviewFingerprint: "overview_fp_marrakech_v3",
    policyVersions: {
      pricing_policy: "pricing_policy_v3",
      public_overview_policy: "public_overview_policy_v3",
    },
    createdAt: "2026-07-20T18:30:00.000Z",
    updatedAt: "2026-07-20T18:45:00.000Z",
    metadata: {
      market: "marrakech",
    },
  });
}

async function assertSqlRpcDoesNotDeriveBusinessKeys(): Promise<void> {
  const sql = await fs.readFile(
    "supabase/migrations/20260720190000_create_intelligence_publishing_registry.sql",
    "utf8",
  );

  const rpcSectionStart = sql.indexOf(
    "create or replace function public.write_intelligence_publishing_registry_snapshot",
  );
  assert.notEqual(rpcSectionStart, -1);
  const rpcSection = sql.slice(rpcSectionStart);

  const forbiddenPatterns = [
    /freshness_entry\s*->>\s*'assetId'\s*\)\s*\|\|/i,
    /publication_entry\s*->>\s*'assetId'\s*\)\s*\|\|/i,
    /source\.value\s*->>\s*'assetId'\s*\)\s*\|\|/i,
    /asset_version_id\s*\|\|/i,
    /channel\s*\|\|\s*locale/i,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.equal(
      pattern.test(rpcSection),
      false,
      `Forbidden SQL key derivation pattern matched: ${pattern}`,
    );
  }
}

async function main() {
  {
    const snapshot = parseRegistrySnapshot(buildBaseSnapshotInput());
    const variant = snapshot.channelVariants[0]!;
    const reference = snapshot.artifactReferences[0]!;
    const freshness = snapshot.freshnessStates[0]!;
    const publication = snapshot.publicationStates[0]!;

    assert.equal(buildPersistentVariantKey(variant), variant.variantId);
    assert.equal(buildPersistentReferenceKey(reference), reference.referenceId);
    assert.equal(
      buildPersistentFreshnessKey(freshness),
      "asset_report_paris|asset_report_paris_v2",
    );
    assert.equal(
      buildPersistentPublicationKey(publication),
      "asset_report_paris|asset_report_paris_v2|en|web|site:web:en",
    );

    const reorderedSnapshot = parseRegistrySnapshot({
      ...buildBaseSnapshotInput(),
      assets: [...buildBaseSnapshotInput().assets].reverse(),
      assetVersions: [...buildBaseSnapshotInput().assetVersions].reverse(),
      artifactReferences: [...buildBaseSnapshotInput().artifactReferences].reverse(),
      channelVariants: [...buildBaseSnapshotInput().channelVariants].reverse(),
      freshnessStates: [...buildBaseSnapshotInput().freshnessStates].reverse(),
      publicationStates: [...buildBaseSnapshotInput().publicationStates].reverse(),
    });
    assert.equal(
      buildPersistentFreshnessKey(reorderedSnapshot.freshnessStates[0]!),
      buildPersistentFreshnessKey(freshness),
    );
    assert.equal(
      buildPersistentPublicationKey(reorderedSnapshot.publicationStates[0]!),
      buildPersistentPublicationKey(publication),
    );
  }

  {
    const snapshot = parseRegistrySnapshot(buildBaseSnapshotInput());
    const payload = buildPersistentRegistryWritePayload({
      currentSnapshot: null,
      snapshot,
      writeOptions: buildWriteOptions("payload_base"),
    });

    assert.equal(payload.assets.length, 1);
    assert.equal(payload.assetVersions.length, 1);
    assert.equal(payload.artifactReferences.length, 1);
    assert.equal(payload.channelVariants.length, 1);
    assert.equal(payload.freshnessStates.length, 1);
    assert.equal(payload.publicationStates.length, 1);
    assert.equal(payload.assets[0]!.assetKey, "asset_report_paris");
    assert.equal(
      payload.assetVersions[0]!.assetVersionKey,
      "asset_report_paris_v2",
    );
    assert.equal(payload.artifactReferences[0]!.referenceKey, "ref_paris_benchmark");
    assert.equal(
      payload.channelVariants[0]!.variantKey,
      "variant_paris_en_web_v2",
    );
    assert.equal(
      payload.freshnessStates[0]!.freshnessKey,
      "asset_report_paris|asset_report_paris_v2",
    );
    assert.equal(
      payload.publicationStates[0]!.publicationKey,
      "asset_report_paris|asset_report_paris_v2|en|web|site:web:en",
    );
    assert.equal(payload.snapshot.requestFingerprint.length > 0, true);
    assert.equal(payload.deleteKeys.assetKeys.length, 0);
    assert.equal(payload.deleteKeys.assetVersionKeys.length, 0);

    const requestFingerprintRepeat = buildPersistentRegistryRequestFingerprint({
      snapshot: {
        snapshotId: payload.snapshot.snapshotId,
        requestedSnapshotVersion: payload.snapshot.requestedSnapshotVersion,
        snapshotFingerprint: payload.snapshot.snapshotFingerprint,
        assetCount: payload.snapshot.assetCount,
        generatedAt: payload.snapshot.generatedAt,
        writtenAt: payload.snapshot.writtenAt,
        idempotencyKey: payload.snapshot.idempotencyKey,
        policyVersions: payload.snapshot.policyVersions,
        snapshotPayload: payload.snapshot.snapshotPayload,
        metadata: payload.snapshot.metadata,
      },
      assets: payload.assets,
      assetVersions: payload.assetVersions,
      artifactReferences: payload.artifactReferences,
      channelVariants: payload.channelVariants,
      freshnessStates: payload.freshnessStates,
      publicationStates: payload.publicationStates,
      deleteKeys: payload.deleteKeys,
    });
    assert.equal(requestFingerprintRepeat, payload.snapshot.requestFingerprint);

    const mutatedSnapshot = parseRegistrySnapshot({
      ...buildBaseSnapshotInput(),
      assetVersions: [
        {
          ...buildBaseSnapshotInput().assetVersions[0]!,
          contentFingerprint: "content_fp_paris_v3",
        },
      ],
    });
    const mutatedPayload = buildPersistentRegistryWritePayload({
      currentSnapshot: null,
      snapshot: mutatedSnapshot,
      writeOptions: buildWriteOptions("payload_mutated"),
    });
    assert.notEqual(
      mutatedPayload.snapshot.requestFingerprint,
      payload.snapshot.requestFingerprint,
    );

    const currentSnapshot = parseRegistrySnapshot(buildBaseSnapshotInput());
    const prunedSnapshot = parseRegistrySnapshot({
      ...buildBaseSnapshotInput(),
      snapshotVersion: 2,
      publicationStates: [],
      channelVariants: [],
    });
    const prunedPayload = buildPersistentRegistryWritePayload({
      currentSnapshot,
      snapshot: prunedSnapshot,
      writeOptions: buildWriteOptions("payload_pruned"),
    });
    assert.equal(prunedPayload.snapshot.requestedSnapshotVersion, 2);
    assert.equal(prunedPayload.deleteKeys.publicationKeys.length, 1);
    assert.equal(prunedPayload.deleteKeys.variantKeys.length, 1);
  }

  {
    await assertSqlRpcDoesNotDeriveBusinessKeys();
  }

  {
    const repository = new InMemoryPersistentRegistryRepository();
    const baseSnapshot = parseRegistrySnapshot(buildBaseSnapshotInput());
    const writeResult = await repository.writeSnapshot(
      baseSnapshot,
      buildWriteOptions("write_base_snapshot"),
    );

    assert.equal(writeResult.status, "written");
    const readSnapshot = await repository.readSnapshot();
    assert.equal(readSnapshot.assets.length, 1);
    assert.equal(
      buildRegistrySnapshotFingerprint(readSnapshot),
      writeResult.snapshotFingerprint,
    );
    assert.equal(Object.isFrozen(readSnapshot), true);

    const shuffled = deepClone(buildBaseSnapshotInput());
    shuffled.assets.reverse();
    shuffled.assetVersions.reverse();
    shuffled.artifactReferences.reverse();
    shuffled.channelVariants.reverse();
    shuffled.freshnessStates.reverse();
    shuffled.publicationStates.reverse();
    const shuffledSnapshot = parseRegistrySnapshot(shuffled);
    const shuffledRepository = new InMemoryPersistentRegistryRepository();
    const shuffledWrite = await shuffledRepository.writeSnapshot(
      shuffledSnapshot,
      buildWriteOptions("write_base_snapshot_shuffled"),
    );
    assert.equal(
      shuffledWrite.snapshotFingerprint,
      writeResult.snapshotFingerprint,
    );
  }

  {
    const repository = new InMemoryPersistentRegistryRepository();
    const baseSnapshot = parseRegistrySnapshot(buildBaseSnapshotInput());
    await repository.writeSnapshot(baseSnapshot, buildWriteOptions("idempotent_key"));
    const idempotentResult = await repository.writeSnapshot(
      baseSnapshot,
      buildWriteOptions("idempotent_key"),
    );
    assert.equal(idempotentResult.status, "idempotent");

    const idempotencyConflict = await expectPersistentRegistryError(() =>
      repository.writeSnapshot(
        parseRegistrySnapshot({
          ...buildBaseSnapshotInput(),
          assetVersions: [
            {
              ...buildBaseSnapshotInput().assetVersions[0]!,
              contentFingerprint: "content_fp_paris_retry_conflict",
            },
          ],
        }),
        buildWriteOptions("idempotent_key"),
      ),
    );
    assert.equal(idempotencyConflict.code, "idempotency_conflict");
  }

  {
    const repository = new InMemoryPersistentRegistryRepository();
    const baseSnapshot = parseRegistrySnapshot(buildBaseSnapshotInput());
    const firstWrite = await repository.writeSnapshot(
      baseSnapshot,
      buildWriteOptions("conflict_base"),
    );

    const updatedVersion = deepClone(buildBaseSnapshotInput());
    updatedVersion.assetVersions[0]!.contentFingerprint = "content_fp_paris_v3";
    updatedVersion.assets[0]!.activeVersionId = "asset_report_paris_v2";
    const conflictFingerprintError = await expectPersistentRegistryError(() =>
      repository.writeSnapshot(
        parseRegistrySnapshot(updatedVersion),
        buildWriteOptions("conflict_snapshot", {
          expectedSnapshotFingerprint: "wrong_fingerprint",
        }),
      ),
    );
    assert.equal(conflictFingerprintError.code, "snapshot_conflict");

    const versionConflictError = await expectPersistentRegistryError(() =>
      repository.upsertAsset(
        {
          ...firstWrite.snapshot.assets[0]!,
          status: "approved",
        },
        buildWriteOptions("version_conflict", {
          expectedAssetVersion: "asset_report_paris_v1",
        }),
      ),
    );
    assert.equal(versionConflictError.code, "version_conflict");
  }

  {
    const repository = new InMemoryPersistentRegistryRepository();
    const baseSnapshot = parseRegistrySnapshot(buildBaseSnapshotInput());
    await repository.writeSnapshot(baseSnapshot, buildWriteOptions("dedupe_base"));
    const duplicateReference = baseSnapshot.artifactReferences[0]!;
    await repository.upsertArtifactReference(
      duplicateReference,
      buildWriteOptions("dedupe_reference"),
    );
    const references = await repository.listArtifactReferences("asset_report_paris");
    assert.equal(references.length, 1);
  }

  {
    const repository = new InMemoryPersistentRegistryRepository();
    const baseSnapshot = parseRegistrySnapshot(buildBaseSnapshotInput());
    await repository.writeSnapshot(
      baseSnapshot,
      buildWriteOptions("single_upserts_base"),
    );

    const variant: RegistryChannelVariant = Object.freeze({
      variantId: "variant_paris_fr_web_v2",
      assetId: "asset_report_paris",
      assetVersionId: "asset_report_paris_v2",
      locale: "fr",
      channel: "web",
      status: "approved",
      contentFingerprint: "variant_fp_paris_fr_web_v2",
      destinationKey: "site:web:fr",
      publishedAt: null,
      updatedAt: "2026-07-20T19:05:00.000Z",
      metadata: {},
    });
    await repository.upsertChannelVariant(
      variant,
      buildWriteOptions("upsert_variant", {
        expectedSnapshotFingerprint: buildRegistrySnapshotFingerprint(
          await repository.readSnapshot(),
        ),
      }),
    );

    const freshness: RegistryFreshnessState = Object.freeze({
      assetId: "asset_report_paris",
      assetVersionId: "asset_report_paris_v2",
      computedAt: "2026-07-20T19:06:00.000Z",
      reviewDueAt: "2026-07-25T19:06:00.000Z",
      publishableUntil: "2026-08-20T19:06:00.000Z",
      staleAfter: "2026-07-28T19:06:00.000Z",
      expiredAfter: "2026-08-20T19:06:00.000Z",
      isPublishable: true,
      isStale: false,
      isExpired: false,
      evaluatedAt: "2026-07-20T19:06:00.000Z",
    });
    await repository.upsertFreshnessState(
      freshness,
      buildWriteOptions("upsert_freshness", {
        expectedSnapshotFingerprint: buildRegistrySnapshotFingerprint(
          await repository.readSnapshot(),
        ),
      }),
    );

    const publicationState: RegistryPublicationState = Object.freeze({
      assetId: "asset_report_paris",
      assetVersionId: "asset_report_paris_v2",
      locale: "fr",
      channel: "web",
      status: "scheduled",
      destinationKey: "site:web:fr",
      publicationFingerprint: "publication_fp_paris_fr_web_v2",
      publishedAt: null,
      suppressedAt: null,
      metadata: {},
    });
    await repository.upsertPublicationState(
      publicationState,
      buildWriteOptions("upsert_publication_state", {
        expectedSnapshotFingerprint: buildRegistrySnapshotFingerprint(
          await repository.readSnapshot(),
        ),
      }),
    );

    const current = await repository.readSnapshot({
      assetIds: ["asset_report_paris"],
      includeHistoricalVersions: true,
    });
    assert.equal(
      current.channelVariants.some((entry) => entry.variantId === variant.variantId),
      true,
    );
    assert.equal(
      current.freshnessStates.some(
        (entry) =>
          entry.assetId === freshness.assetId &&
          entry.assetVersionId === freshness.assetVersionId,
      ),
      true,
    );
    assert.equal(
      current.publicationStates.some(
        (entry) =>
          entry.locale === publicationState.locale &&
          entry.channel === publicationState.channel &&
          entry.destinationKey === publicationState.destinationKey,
      ),
      true,
    );
    assert.equal(current.assets[0]!.activeVersionId, "asset_report_paris_v2");
  }

  {
    const invalidSnapshotError = await expectPersistentRegistryError(() =>
      Promise.resolve(
        parseRegistrySnapshot({
          ...buildBaseSnapshotInput(),
          assets: [
            {
              ...buildBaseSnapshotInput().assets[0],
              activeVersionId: "missing_version",
            },
          ],
        }),
      ).then((snapshot) => {
        void snapshot;
      }),
    );
    assert.equal(invalidSnapshotError.name, "RegistryAdapterError");
  }

  {
    const repository = new InMemoryPersistentRegistryRepository();
    const privateFieldError = await expectPersistentRegistryError(() =>
      repository.writeSnapshot(
        parseRegistrySnapshot({
          ...buildBaseSnapshotInput(),
          assets: [
            {
              ...buildBaseSnapshotInput().assets[0],
              metadata: {
                listingUrl: "https://private.example.test/listing",
              },
            },
          ],
        }),
        buildWriteOptions("private_field"),
      ),
    );
    assert.equal(privateFieldError.name, "RegistryAdapterError");
  }

  {
    const repository = new InMemoryPersistentRegistryRepository();
    const invalidMetadataError = await expectPersistentRegistryError(() =>
      repository.writeSnapshot(
        parseRegistrySnapshot({
          ...buildBaseSnapshotInput(),
          metadata: {
            invalid: (() => "nope") as unknown as string,
          },
        }),
        buildWriteOptions("invalid_metadata"),
      ),
    );
    assert.equal(invalidMetadataError.name, "RegistryAdapterError");
  }

  {
    const repository = new InMemoryPersistentRegistryRepository();
    const definition = buildMarketReportDefinition();
    const persisted = await persistMarketReportPilot({
      definition,
      repository,
      writeOptions: buildWriteOptions("persist_market_report_pilot", {
        writtenAt: "2026-07-20T19:10:00.000Z",
      }),
    });

    const marketReportSnapshot = await repository.readSnapshot({
      assetIds: persisted.snapshot.assets.map((asset) => asset.assetId),
      includeHistoricalVersions: true,
    });
    assert.equal(
      marketReportSnapshot.assets.some((asset) => asset.assetType === "market_report"),
      true,
    );

    assert.doesNotThrow(() => parseRegistrySnapshot(marketReportSnapshot));
    const event = parsePublicationEventEnvelope({
      eventId: "evt_manual_republish_market_report",
      eventType: "manual_republish_requested",
      occurredAt: "2026-07-20T19:11:00.000Z",
      sourceSystem: "admin_console",
      subjectType: "asset",
      subjectId: marketReportSnapshot.assets[0]!.assetId,
      subjectFingerprint: "manual_republish_fingerprint_v1",
      policyVersions: {
        pricing_policy: "pricing_policy_v3",
      },
      priority: "P1",
      visibility: "internal",
      requestId: "req_market_report_manual_republish",
      metadata: {
        reason: "editorial_review",
        requestedBy: "ops@norixo.io",
      },
    });
    const executionPlan = buildExecutionPlan({
      event,
      registrySnapshot: marketReportSnapshot,
      runId: "run_market_report_from_persistent_registry",
      now: () => "2026-07-20T19:11:00.000Z",
      estimatedCostByJobType: {
        generate_asset_version: 5,
        publish: 3,
      },
    });
    assert.equal(executionPlan.jobs.length > 0, true);
  }
  
  console.log("PASS — Intelligence Publishing persistent registry smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
