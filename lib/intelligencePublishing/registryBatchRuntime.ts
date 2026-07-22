import { createHash } from "node:crypto";

import {
  buildIntelligencePublishingBatchPlan,
  executeIntelligencePublishingBatch,
  type BuildIntelligencePublishingBatchPlanInput,
  type IntelligencePublishingBatchAction,
  type IntelligencePublishingBatchCandidate,
  type IntelligencePublishingBatchHandlerResult,
  type IntelligencePublishingBatchPlan,
  type IntelligencePublishingBatchPlanItem,
  type IntelligencePublishingBatchResult,
} from "./batchPlanning";
import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";
import { buildExecutionPlan as buildEngineExecutionPlan } from "./executionEngine";
import { parsePublicationEventEnvelope, type PublicationEventPriority, type PublicationEventVisibility } from "./eventContracts";
import {
  assertRegistrySnapshotPublicSafe,
  buildRegistrySnapshotFingerprint,
  getActiveRegistryVersion,
  getRegistryAsset,
  listRegistryPublicationsForAsset,
  listRegistryVariantsForAsset,
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
  type RegistryAsset,
  type RegistryAssetType,
  type RegistryAssetVersion,
  type RegistryChannelVariant,
  type RegistryPublicationState,
  type RegistrySnapshot,
} from "./registryAdapter";
import {
  buildExecutionGraphFromExecutionPlan,
  buildExecutionPlan as buildRuntimeExecutionPlan,
  executeExecutionPlan,
} from "./executionRuntime";

export const REGISTRY_BATCH_RUNTIME_CHANNELS = Object.freeze([
  "web",
  "newsletter",
] as const);

export type RegistryBatchRuntimeChannel =
  (typeof REGISTRY_BATCH_RUNTIME_CHANNELS)[number];

export const REGISTRY_BATCH_RUNTIME_DIAGNOSTIC_CODES = Object.freeze([
  "unsupported_asset_type",
  "missing_active_version",
  "missing_market_metadata",
  "missing_locale",
  "candidate_created",
  "candidate_not_found",
  "unsupported_requested_action",
  "runtime_plan_empty",
] as const);

export type RegistryBatchRuntimeDiagnosticCode =
  (typeof REGISTRY_BATCH_RUNTIME_DIAGNOSTIC_CODES)[number];

export type RegistryBatchRuntimeDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export type RegistryBatchRuntimeDiagnostic = Readonly<{
  code: RegistryBatchRuntimeDiagnosticCode;
  severity: RegistryBatchRuntimeDiagnosticSeverity;
  assetId: string | null;
  assetVersionId: string | null;
  locale: string | null;
  channel: string | null;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type BuildRegistryBatchCandidatesInput = Readonly<{
  registrySnapshot: unknown;
  assetTypes?: readonly RegistryAssetType[];
  channel?: RegistryBatchRuntimeChannel;
  requestedAction?: IntelligencePublishingBatchAction;
  priority?: number;
}>;

export type RegistryBatchCandidatesResult = Readonly<{
  snapshot: RegistrySnapshot;
  snapshotFingerprint: string;
  channel: RegistryBatchRuntimeChannel;
  candidates: readonly IntelligencePublishingBatchCandidate[];
  diagnostics: readonly RegistryBatchRuntimeDiagnostic[];
}>;

export type BuildRegistrySnapshotBatchPlanInput =
  BuildRegistryBatchCandidatesInput &
    Readonly<{
      mode: BuildIntelligencePublishingBatchPlanInput["mode"];
      createdAt: string;
    }>;

export type RegistrySnapshotBatchPlanResult = Readonly<
  RegistryBatchCandidatesResult & {
    plan: IntelligencePublishingBatchPlan;
  }
>;

export type CreateRegistryBatchRuntimeExecutionHandlerInput = Readonly<{
  registrySnapshot: unknown;
  channel?: RegistryBatchRuntimeChannel;
  now: () => string;
  sourceSystem?: string;
  priority?: PublicationEventPriority;
  visibility?: PublicationEventVisibility;
  requestedBy?: string;
  reason?: string;
  metadata?: CoordinationJsonObject;
}>;

export type ExecuteRegistrySnapshotBatchInput =
  BuildRegistrySnapshotBatchPlanInput &
    Readonly<{
      now: () => string;
      executeItem?: (
        item: IntelligencePublishingBatchPlanItem,
      ) =>
        | IntelligencePublishingBatchHandlerResult
        | Promise<IntelligencePublishingBatchHandlerResult>;
      sourceSystem?: string;
      eventPriority?: PublicationEventPriority;
      eventVisibility?: PublicationEventVisibility;
      requestedBy?: string;
      reason?: string;
      metadata?: CoordinationJsonObject;
    }>;

export type RegistrySnapshotBatchExecutionResult = Readonly<
  RegistrySnapshotBatchPlanResult & {
    result: IntelligencePublishingBatchResult;
  }
>;

type RegistryBatchCandidateTarget = Readonly<{
  asset: RegistryAsset;
  assetVersion: RegistryAssetVersion;
  locale: string;
  channel: RegistryBatchRuntimeChannel;
}>;

const DEFAULT_ASSET_TYPES = Object.freeze(["market_report"] as const);

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
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
    value === null ||
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

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((entry) => deepFreeze(entry));
    return Object.freeze(value);
  }
  if (typeof value === "object" && value != null) {
    Object.values(value as Record<string, unknown>).forEach((entry) =>
      deepFreeze(entry),
    );
    return Object.freeze(value);
  }
  return value;
}

function stableSortObject(
  value: Record<string, string>,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value)
        .sort((left, right) => compareStrings(left[0], right[0]))
        .map(([key, entry]) => [key, entry]),
    ),
  );
}

function freezeMetadata(
  value: CoordinationJsonObject | undefined,
): CoordinationJsonObject {
  if (!isJsonSafe(value ?? {})) {
    throw new Error("Expected JSON-safe metadata.");
  }
  return deepFreeze({ ...(value ?? {}) });
}

function buildHash(prefix: string, input: unknown): string {
  return `${prefix}${createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")}`;
}

function buildDiagnostic(
  input: Readonly<{
    code: RegistryBatchRuntimeDiagnosticCode;
    severity: RegistryBatchRuntimeDiagnosticSeverity;
    assetId?: string | null;
    assetVersionId?: string | null;
    locale?: string | null;
    channel?: string | null;
    message: string;
    metadata?: CoordinationJsonObject;
  }>,
): RegistryBatchRuntimeDiagnostic {
  return deepFreeze({
    code: input.code,
    severity: input.severity,
    assetId: input.assetId ?? null,
    assetVersionId: input.assetVersionId ?? null,
    locale: input.locale ?? null,
    channel: input.channel ?? null,
    message: input.message,
    metadata: freezeMetadata(input.metadata),
  });
}

function normalizeAllowedAssetTypes(
  assetTypes: readonly RegistryAssetType[] | undefined,
): ReadonlySet<RegistryAssetType> {
  return new Set((assetTypes ?? DEFAULT_ASSET_TYPES) as readonly RegistryAssetType[]);
}

function buildCandidateId(target: RegistryBatchCandidateTarget): string {
  return [
    "registry_batch_candidate",
    target.asset.assetId,
    target.assetVersion.assetVersionId,
    target.locale,
    target.channel,
  ].join("|");
}

function parseCandidateId(
  candidateId: string,
): Readonly<{
  assetId: string;
  assetVersionId: string;
  locale: string;
  channel: RegistryBatchRuntimeChannel;
}> | null {
  const parts = candidateId.split("|");
  if (
    parts.length !== 5 ||
    parts[0] !== "registry_batch_candidate" ||
    !REGISTRY_BATCH_RUNTIME_CHANNELS.includes(
      parts[4] as RegistryBatchRuntimeChannel,
    )
  ) {
    return null;
  }
  return Object.freeze({
    assetId: parts[1]!,
    assetVersionId: parts[2]!,
    locale: parts[3]!,
    channel: parts[4] as RegistryBatchRuntimeChannel,
  });
}

function readAssetMetadataString(
  asset: RegistryAsset,
  key: string,
): string | null {
  const raw = asset.metadata[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function collectCandidateLocales(
  snapshot: RegistrySnapshot,
  target: Readonly<{
    asset: RegistryAsset;
    assetVersion: RegistryAssetVersion;
    channel: RegistryBatchRuntimeChannel;
  }>,
): readonly string[] {
  const locales = new Set<string>();
  for (const variant of listRegistryVariantsForAsset(
    snapshot,
    target.asset.assetId,
    target.assetVersion.assetVersionId,
  )) {
    if (
      variant.channel === target.channel &&
      variant.locale.trim().length > 0
    ) {
      locales.add(variant.locale.trim());
    }
  }
  for (const publication of listRegistryPublicationsForAsset(
    snapshot,
    target.asset.assetId,
    target.assetVersion.assetVersionId,
  )) {
    if (
      publication.channel === target.channel &&
      publication.locale.trim().length > 0
    ) {
      locales.add(publication.locale.trim());
    }
  }
  for (const locale of target.asset.availableLocales) {
    if (locale.trim().length > 0) {
      locales.add(locale.trim());
    }
  }
  if (target.asset.defaultLocale.trim().length > 0) {
    locales.add(target.asset.defaultLocale.trim());
  }
  return Object.freeze([...locales].sort(compareStrings));
}

function buildCandidateFromTarget(
  target: RegistryBatchCandidateTarget,
  requestedAction: IntelligencePublishingBatchAction,
  priority: number,
): IntelligencePublishingBatchCandidate {
  const country = readAssetMetadataString(target.asset, "country");
  const city = readAssetMetadataString(target.asset, "city");
  const platform = readAssetMetadataString(target.asset, "platform");
  const propertyType = readAssetMetadataString(target.asset, "propertyType");
  const reportKey = target.asset.canonicalId.trim();
  if (
    reportKey.length === 0 ||
    country == null ||
    city == null ||
    platform == null ||
    propertyType == null
  ) {
    throw new Error("Cannot build a candidate without complete market metadata.");
  }
  return deepFreeze({
    candidateId: buildCandidateId(target),
    reportKey,
    locale: target.locale,
    country,
    city,
    platform,
    propertyType,
    priority,
    requestedAction,
    sourceFingerprint: target.assetVersion.sourceFingerprint,
  });
}

function resolveCandidateTarget(
  snapshot: RegistrySnapshot,
  item: IntelligencePublishingBatchPlanItem,
): RegistryBatchCandidateTarget | null {
  const parsedCandidateId = parseCandidateId(item.candidate.candidateId);
  if (parsedCandidateId == null) {
    return null;
  }

  const asset = getRegistryAsset(snapshot, parsedCandidateId.assetId);
  const activeVersion = getActiveRegistryVersion(snapshot, parsedCandidateId.assetId);
  if (
    asset == null ||
    activeVersion == null ||
    activeVersion.assetVersionId !== parsedCandidateId.assetVersionId
  ) {
    return null;
  }

  const country = readAssetMetadataString(asset, "country");
  const city = readAssetMetadataString(asset, "city");
  const platform = readAssetMetadataString(asset, "platform");
  const propertyType = readAssetMetadataString(asset, "propertyType");

  if (
    asset.canonicalId !== item.candidate.reportKey ||
    country == null ||
    city == null ||
    platform == null ||
    propertyType == null ||
    normalizeText(country) !== normalizeText(item.candidate.country) ||
    normalizeText(city) !== normalizeText(item.candidate.city) ||
    normalizeText(platform) !== normalizeText(item.candidate.platform) ||
    normalizeText(propertyType) !== normalizeText(item.candidate.propertyType) ||
    normalizeText(parsedCandidateId.locale) !== normalizeText(item.candidate.locale) ||
    normalizeText(activeVersion.sourceFingerprint) !==
      normalizeText(item.candidate.sourceFingerprint ?? "")
  ) {
    return null;
  }

  return Object.freeze({
    asset,
    assetVersion: activeVersion,
    locale: parsedCandidateId.locale,
    channel: parsedCandidateId.channel,
  });
}

function buildManualRepublishEvent(
  input: Readonly<{
    item: IntelligencePublishingBatchPlanItem;
    target: RegistryBatchCandidateTarget;
    snapshotFingerprint: string;
    occurredAt: string;
    sourceSystem: string;
    priority: PublicationEventPriority;
    visibility: PublicationEventVisibility;
    requestedBy: string;
    reason: string;
    metadata?: CoordinationJsonObject;
  }>,
) {
  const action = input.item.requestedAction;
  const subjectType = action === "refresh" ? "asset_version" : "asset";
  const subjectId =
    subjectType === "asset_version"
      ? input.target.assetVersion.assetVersionId
      : input.target.asset.assetId;
  const eventHash = createHash("sha256")
    .update(
      [
        input.item.itemKey,
        input.snapshotFingerprint,
        input.target.asset.assetId,
        input.target.assetVersion.assetVersionId,
        input.target.locale,
        action,
      ].join("||"),
    )
    .digest("hex");

  return parsePublicationEventEnvelope({
    eventId: `evt_registry_batch_${eventHash.slice(0, 24)}`,
    eventType: "manual_republish_requested",
    occurredAt: input.occurredAt,
    sourceSystem: input.sourceSystem,
    subjectType,
    subjectId,
    subjectFingerprint: input.target.assetVersion.sourceFingerprint,
    policyVersions: stableSortObject({
      ...input.target.assetVersion.policyVersions,
    }),
    priority: input.priority,
    visibility: input.visibility,
    requestId: `registry_batch:${input.item.itemKey}`,
    metadata: freezeMetadata({
      reason: input.reason,
      requestedBy: input.requestedBy,
      requestedAction: action,
      locale: input.target.locale,
      channel: input.target.channel,
      ...(input.metadata ?? {}),
    }) as {
      reason: string;
      requestedBy: string;
    },
  });
}

export function buildRegistryBatchCandidatesFromSnapshot(
  input: BuildRegistryBatchCandidatesInput,
): RegistryBatchCandidatesResult {
  const snapshot = normalizeRegistrySnapshot(parseRegistrySnapshot(input.registrySnapshot));
  assertRegistrySnapshotPublicSafe(snapshot);
  const snapshotFingerprint = buildRegistrySnapshotFingerprint(snapshot);
  const channel = input.channel ?? "web";
  const requestedAction = input.requestedAction ?? "publish";
  const priority = input.priority ?? 100;
  const allowedAssetTypes = normalizeAllowedAssetTypes(input.assetTypes);
  const diagnostics: RegistryBatchRuntimeDiagnostic[] = [];
  const candidates: IntelligencePublishingBatchCandidate[] = [];

  for (const asset of [...snapshot.assets].sort((left, right) =>
    compareStrings(left.assetId, right.assetId),
  )) {
    if (!allowedAssetTypes.has(asset.assetType)) {
      diagnostics.push(
        buildDiagnostic({
          code: "unsupported_asset_type",
          severity: "info",
          assetId: asset.assetId,
          message: `Skipped asset ${asset.assetId} because assetType ${asset.assetType} is outside the adapter scope.`,
          metadata: freezeMetadata({
            assetType: asset.assetType,
          }),
        }),
      );
      continue;
    }

    const assetVersion = getActiveRegistryVersion(snapshot, asset.assetId);
    if (assetVersion == null) {
      diagnostics.push(
        buildDiagnostic({
          code: "missing_active_version",
          severity: "warning",
          assetId: asset.assetId,
          message: `Skipped asset ${asset.assetId} because no active version is available.`,
          metadata: freezeMetadata({}),
        }),
      );
      continue;
    }

    const country = readAssetMetadataString(asset, "country");
    const city = readAssetMetadataString(asset, "city");
    const platform = readAssetMetadataString(asset, "platform");
    const propertyType = readAssetMetadataString(asset, "propertyType");
    if (
      country == null ||
      city == null ||
      platform == null ||
      propertyType == null ||
      asset.canonicalId.trim().length === 0
    ) {
      diagnostics.push(
        buildDiagnostic({
          code: "missing_market_metadata",
          severity: "warning",
          assetId: asset.assetId,
          assetVersionId: assetVersion.assetVersionId,
          message: `Skipped asset ${asset.assetId} because market metadata is incomplete.`,
          metadata: freezeMetadata({
            hasCountry: country != null,
            hasCity: city != null,
            hasPlatform: platform != null,
            hasPropertyType: propertyType != null,
            hasReportKey: asset.canonicalId.trim().length > 0,
          }),
        }),
      );
      continue;
    }

    const locales = collectCandidateLocales(snapshot, {
      asset,
      assetVersion,
      channel,
    });
    if (locales.length === 0) {
      diagnostics.push(
        buildDiagnostic({
          code: "missing_locale",
          severity: "warning",
          assetId: asset.assetId,
          assetVersionId: assetVersion.assetVersionId,
          channel,
          message: `Skipped asset ${asset.assetId} because no locale is available for channel ${channel}.`,
          metadata: freezeMetadata({}),
        }),
      );
      continue;
    }

    for (const locale of locales) {
      const candidate = buildCandidateFromTarget(
        {
          asset,
          assetVersion,
          locale,
          channel,
        },
        requestedAction,
        priority,
      );
      candidates.push(candidate);
      diagnostics.push(
        buildDiagnostic({
          code: "candidate_created",
          severity: "info",
          assetId: asset.assetId,
          assetVersionId: assetVersion.assetVersionId,
          locale,
          channel,
          message: `Created a batch candidate for asset ${asset.assetId} and locale ${locale}.`,
          metadata: freezeMetadata({
            reportKey: candidate.reportKey,
            requestedAction: candidate.requestedAction ?? requestedAction,
            snapshotFingerprint,
          }),
        }),
      );
    }
  }

  return deepFreeze({
    snapshot,
    snapshotFingerprint,
    channel,
    candidates: Object.freeze(candidates),
    diagnostics: Object.freeze(diagnostics),
  });
}

export function buildRegistrySnapshotBatchPlan(
  input: BuildRegistrySnapshotBatchPlanInput,
): RegistrySnapshotBatchPlanResult {
  const candidateResult = buildRegistryBatchCandidatesFromSnapshot(input);
  const plan = buildIntelligencePublishingBatchPlan({
    candidates: candidateResult.candidates,
    mode: input.mode,
    createdAt: input.createdAt,
  });
  return deepFreeze({
    ...candidateResult,
    plan,
  });
}

export function createRegistryBatchRuntimeExecutionHandler(
  input: CreateRegistryBatchRuntimeExecutionHandlerInput,
): (
  item: IntelligencePublishingBatchPlanItem,
) => Promise<IntelligencePublishingBatchHandlerResult> {
  const snapshot = normalizeRegistrySnapshot(parseRegistrySnapshot(input.registrySnapshot));
  assertRegistrySnapshotPublicSafe(snapshot);
  const snapshotFingerprint = buildRegistrySnapshotFingerprint(snapshot);
  const sourceSystem = input.sourceSystem ?? "ipp_registry_batch_runtime";
  const requestedBy = input.requestedBy ?? "ipp_registry_batch_runtime";
  const reason = input.reason ?? "registry_batch_runtime_integration";
  const metadata = freezeMetadata(input.metadata);

  return async (
    item: IntelligencePublishingBatchPlanItem,
  ): Promise<IntelligencePublishingBatchHandlerResult> => {
    if (item.requestedAction === "generate") {
      return deepFreeze({
        status: "blocked",
        message:
          "The registry batch runtime adapter currently supports publish and refresh actions only.",
        retryable: false,
        metadata: freezeMetadata({
          code: "unsupported_requested_action",
          requestedAction: item.requestedAction,
        }),
      });
    }

    const target = resolveCandidateTarget(snapshot, item);
    if (target == null) {
      return deepFreeze({
        status: "blocked",
        message:
          "The batch candidate could not be resolved back to a registry asset target.",
        retryable: false,
        metadata: freezeMetadata({
          code: "candidate_not_found",
          candidateId: item.candidate.candidateId,
        }),
      });
    }

    const occurredAt = input.now();
    if (!isCanonicalIsoTimestamp(occurredAt)) {
      return deepFreeze({
        status: "failed",
        message: `Expected a canonical ISO timestamp, received ${occurredAt}.`,
        retryable: false,
        metadata: freezeMetadata({
          code: "invalid_now",
        }),
      });
    }

    try {
      const event = buildManualRepublishEvent({
        item,
        target,
        snapshotFingerprint,
        occurredAt,
        sourceSystem,
        priority: input.priority ?? "P2",
        visibility: input.visibility ?? target.asset.visibility,
        requestedBy,
        reason,
        metadata,
      });
      const enginePlan = buildEngineExecutionPlan({
        event,
        registrySnapshot: snapshot,
        runId: buildHash("run_registry_batch_", {
          itemKey: item.itemKey,
          snapshotFingerprint,
        }),
        now: () => occurredAt,
        metadata: freezeMetadata({
          source: "registry_batch_runtime",
          batchItemKey: item.itemKey,
          requestedAction: item.requestedAction,
          locale: target.locale,
          channel: target.channel,
        }),
      });
      const runtimeGraph = buildExecutionGraphFromExecutionPlan({
        executionPlan: enginePlan,
        registrySnapshot: snapshot,
        createdAt: occurredAt,
      });
      const runtimePlan = buildRuntimeExecutionPlan({
        graph: runtimeGraph,
        createdAt: occurredAt,
      });
      const runtimeResult = executeExecutionPlan({
        executionPlan: runtimePlan,
        now: occurredAt,
      });

      if (runtimeResult.readyJobs.length === 0) {
        return deepFreeze({
          status: "skipped",
          message: "The runtime produced no ready jobs for this candidate.",
          retryable: false,
          metadata: freezeMetadata({
            code: "runtime_plan_empty",
            eventId: event.eventId,
            engineExecutionPlanId: enginePlan.executionPlanId,
            runtimePlanId: runtimePlan.planId,
            runtimeStatus: runtimeResult.executionState.status,
          }),
        });
      }

      return deepFreeze({
        status: "succeeded",
        retryable: false,
        metadata: freezeMetadata({
          eventId: event.eventId,
          eventType: event.eventType,
          requestId: event.requestId ?? null,
          assetId: target.asset.assetId,
          assetVersionId: target.assetVersion.assetVersionId,
          locale: target.locale,
          channel: target.channel,
          engineExecutionPlanId: enginePlan.executionPlanId,
          runtimeGraphId: runtimeGraph.graphId,
          runtimePlanId: runtimePlan.planId,
          runtimePlanFingerprint: runtimePlan.fingerprint,
          readyJobIds: runtimeResult.readyJobs.map((job) => job.id),
          readyJobCount: runtimeResult.readyJobs.length,
          runtimeStatus: runtimeResult.executionState.status,
        }),
      });
    } catch (error) {
      return deepFreeze({
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Registry batch runtime integration failed.",
        retryable: false,
        metadata: freezeMetadata({
          candidateId: item.candidate.candidateId,
          thrown: true,
        }),
      });
    }
  };
}

export async function executeRegistrySnapshotBatch(
  input: ExecuteRegistrySnapshotBatchInput,
): Promise<RegistrySnapshotBatchExecutionResult> {
  const built = buildRegistrySnapshotBatchPlan(input);
  const executeItem =
    built.plan.mode === "execute"
      ? input.executeItem ??
        createRegistryBatchRuntimeExecutionHandler({
          registrySnapshot: built.snapshot,
          channel: built.channel,
          now: input.now,
          sourceSystem: input.sourceSystem,
          priority: input.eventPriority,
          visibility: input.eventVisibility,
          requestedBy: input.requestedBy,
          reason: input.reason,
          metadata: input.metadata,
        })
      : undefined;
  const result = await executeIntelligencePublishingBatch({
    plan: built.plan,
    executeItem,
    now: input.now,
  });
  return deepFreeze({
    ...built,
    result,
  });
}
