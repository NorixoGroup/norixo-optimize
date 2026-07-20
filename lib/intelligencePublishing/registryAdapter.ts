import { createHash } from "node:crypto";

import {
  buildPublicationEventSubjectKey,
  PUBLICATION_EVENT_SUBJECT_TYPES,
  PUBLICATION_EVENT_VISIBILITIES,
  type PublicationEventEnvelope,
  type PublicationEventSubjectType,
  type PublicationEventVisibility,
} from "./eventContracts";
import type {
  ImpactResolutionContext,
  ImpactResolverArtifactReference,
  ImpactResolverAsset,
  ImpactResolverAssetVersion,
  ImpactPlan,
} from "./impactResolver";
import type {
  ExpandImpactActionIntoJobsContext,
  JobMetadata,
  JobType,
} from "./jobModel";
import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";

export const REGISTRY_ASSET_TYPES = Object.freeze([
  "market_report",
  "ranking",
  "guide",
  "article",
  "tool",
  "insight_card",
  "newsletter",
  "social_post",
  "press_asset",
  "video_script",
  "podcast_script",
  "other",
] as const);

export type RegistryAssetType = (typeof REGISTRY_ASSET_TYPES)[number];

export const REGISTRY_ASSET_STATUSES = Object.freeze([
  "draft",
  "generated",
  "pending_review",
  "approved",
  "scheduled",
  "published",
  "deprecated",
  "archived",
  "suppressed",
] as const);

export type RegistryAssetStatus = (typeof REGISTRY_ASSET_STATUSES)[number];

export const REGISTRY_ASSET_VERSION_STATUSES = Object.freeze([
  "draft",
  "generated",
  "pending_review",
  "approved",
  "active",
  "superseded",
  "deprecated",
  "suppressed",
] as const);

export type RegistryAssetVersionStatus =
  (typeof REGISTRY_ASSET_VERSION_STATUSES)[number];

export const REGISTRY_VARIANT_STATUSES = Object.freeze([
  "pending",
  "generated",
  "approved",
  "published",
  "failed",
  "suppressed",
  "deprecated",
] as const);

export type RegistryVariantStatus =
  (typeof REGISTRY_VARIANT_STATUSES)[number];

export const REGISTRY_PUBLICATION_STATUSES = Object.freeze([
  "unpublished",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "suppressed",
  "rolled_back",
] as const);

export type RegistryPublicationStatus =
  (typeof REGISTRY_PUBLICATION_STATUSES)[number];

export const ARTIFACT_RELATIONSHIP_TYPES = Object.freeze([
  "derived_from",
  "supported_by",
  "supersedes",
  "localized_from",
  "rendered_from",
  "governed_by",
] as const);

export type ArtifactRelationshipType =
  (typeof ARTIFACT_RELATIONSHIP_TYPES)[number];

export const REGISTRY_CONFIDENCE_BANDS = Object.freeze([
  "unknown",
  "low",
  "moderate",
  "high",
  "very_high",
] as const);

export type RegistryConfidenceBand =
  (typeof REGISTRY_CONFIDENCE_BANDS)[number];

export const REGISTRY_ARTIFACT_TYPES = Object.freeze([
  ...PUBLICATION_EVENT_SUBJECT_TYPES,
  "policy",
] as const);

export type RegistryArtifactType =
  | PublicationEventSubjectType
  | "policy";

export type RegistryAsset = Readonly<{
  assetId: string;
  canonicalId: string;
  assetType: RegistryAssetType;
  status: RegistryAssetStatus;
  visibility: PublicationEventVisibility;
  defaultLocale: string;
  availableLocales: readonly string[];
  availableChannels: readonly string[];
  activeVersionId: string | null;
  templateId: string | null;
  ownerTeam: string;
  confidenceAffectsVisibleContent: boolean;
  policyChangeAffectsVisibleContent: boolean;
  freshnessExpiryBehavior: "keep_visible" | "suppress";
  createdAt: string;
  updatedAt: string;
  metadata: CoordinationJsonObject;
}>;

export type RegistryAssetVersion = Readonly<{
  assetVersionId: string;
  assetId: string;
  versionNumber: number;
  status: RegistryAssetVersionStatus;
  contentFingerprint: string;
  sourceFingerprint: string;
  templateFingerprint: string;
  rendererFingerprint: string;
  policyVersions: Readonly<Record<string, string>>;
  confidenceBand: RegistryConfidenceBand;
  createdAt: string;
  approvedAt: string | null;
  publishedAt: string | null;
  supersededAt: string | null;
  metadata: CoordinationJsonObject;
}>;

export type RegistryArtifactReference = Readonly<{
  referenceId: string;
  assetId: string;
  assetVersionId: string | null;
  artifactType: RegistryArtifactType;
  artifactId: string;
  artifactFingerprint: string;
  relationshipType: ArtifactRelationshipType;
  policyVersions: Readonly<Record<string, string>>;
  createdAt: string;
  metadata: CoordinationJsonObject;
}>;

export type RegistryChannelVariant = Readonly<{
  variantId: string;
  assetId: string;
  assetVersionId: string;
  locale: string;
  channel: string;
  status: RegistryVariantStatus;
  contentFingerprint: string;
  destinationKey: string | null;
  publishedAt: string | null;
  updatedAt: string;
  metadata: CoordinationJsonObject;
}>;

export type RegistryFreshnessState = Readonly<{
  assetId: string;
  assetVersionId: string | null;
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

export type RegistryPublicationState = Readonly<{
  assetId: string;
  assetVersionId: string;
  locale: string;
  channel: string;
  status: RegistryPublicationStatus;
  destinationKey: string | null;
  publicationFingerprint: string | null;
  publishedAt: string | null;
  suppressedAt: string | null;
  metadata: CoordinationJsonObject;
}>;

export type RegistrySnapshot = Readonly<{
  snapshotId: string;
  snapshotVersion: number;
  generatedAt: string;
  assets: readonly RegistryAsset[];
  assetVersions: readonly RegistryAssetVersion[];
  artifactReferences: readonly RegistryArtifactReference[];
  channelVariants: readonly RegistryChannelVariant[];
  freshnessStates: readonly RegistryFreshnessState[];
  publicationStates: readonly RegistryPublicationState[];
  policyVersions: Readonly<Record<string, string>>;
  metadata: CoordinationJsonObject;
}>;

export type RegistrySnapshotValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type RegistrySnapshotValidationResult =
  | Readonly<{
      ok: true;
      snapshot: RegistrySnapshot;
    }>
  | Readonly<{
      ok: false;
      issues: readonly RegistrySnapshotValidationIssue[];
    }>;

export type RegistryAdapterErrorCode =
  | "invalid_snapshot"
  | "duplicate_entity"
  | "orphan_reference"
  | "inconsistent_active_version"
  | "inconsistent_asset_version"
  | "invalid_lineage"
  | "missing_asset"
  | "missing_version"
  | "private_field_detected"
  | "unsupported_mapping"
  | "invalid_fingerprint_input";

export class RegistryAdapterError extends Error {
  readonly code: RegistryAdapterErrorCode;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly path?: string;

  constructor(
    input: Readonly<{
      code: RegistryAdapterErrorCode;
      message: string;
      entityType?: string;
      entityId?: string;
      path?: string;
    }>,
  ) {
    super(input.message);
    this.name = "RegistryAdapterError";
    this.code = input.code;
    this.entityType = input.entityType;
    this.entityId = input.entityId;
    this.path = input.path;
  }
}

export interface IntelligencePublishingRegistryReader {
  getSnapshot(): Promise<RegistrySnapshot>;
  getAsset(assetId: string): Promise<RegistryAsset | null>;
  getAssetVersion(assetVersionId: string): Promise<RegistryAssetVersion | null>;
  findAssetsByArtifact(
    subjectType: RegistryArtifactType,
    subjectId: string,
  ): Promise<readonly RegistryAsset[]>;
  listAssetVersions(assetId: string): Promise<readonly RegistryAssetVersion[]>;
  listArtifactReferences(
    assetId: string,
  ): Promise<readonly RegistryArtifactReference[]>;
  listChannelVariants(
    assetId: string,
    assetVersionId?: string | null,
  ): Promise<readonly RegistryChannelVariant[]>;
  getFreshnessState(
    assetId: string,
    assetVersionId?: string | null,
  ): Promise<RegistryFreshnessState | null>;
  listPublicationStates(
    assetId: string,
    assetVersionId?: string | null,
  ): Promise<readonly RegistryPublicationState[]>;
}

export type BuildImpactResolutionContextFromRegistryInput = Readonly<{
  snapshot: RegistrySnapshot;
  event?: PublicationEventEnvelope;
  targetSubject?:
    | Readonly<{
        subjectType: RegistryArtifactType;
        subjectId: string;
      }>
    | null;
  now?: () => string;
}>;

export type BuildJobExpansionContextFromRegistryInput = Readonly<{
  snapshot: RegistrySnapshot;
  impactPlan: ImpactPlan;
  runId: string;
  now: () => string;
  maxAttemptsByJobType?: Readonly<Partial<Record<JobType, number>>>;
  estimatedCostByJobType?: Readonly<Partial<Record<JobType, number>>>;
  metadataByJobType?: Readonly<Partial<Record<JobType, JobMetadata>>>;
  dependencyJobIdsByTargetKey?: Readonly<Record<string, readonly string[]>>;
  dependentJobIdsByTargetKey?: Readonly<Record<string, readonly string[]>>;
}>;

const FORBIDDEN_PRIVATE_KEYS = new Set([
  "userid",
  "workspaceid",
  "auditid",
  "listingid",
  "listingurl",
  "sourceurl",
  "guestname",
  "customeremail",
  "privatetitle",
  "privatedescription",
  "privateimageurl",
  "rawobservation",
]);

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString() === value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1;
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

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function compareNullableStrings(
  left: string | null,
  right: string | null,
): number {
  return compareStrings(left ?? "", right ?? "");
}

function uniqueSortedStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareStrings));
}

function sortStringRecord(
  input: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(input)
        .sort((left, right) => compareStrings(left[0], right[0]))
        .map(([key, value]) => [key, value]),
    ),
  );
}

function freezeMetadata(
  metadata: CoordinationJsonObject | undefined,
): CoordinationJsonObject {
  return Object.freeze({ ...(metadata ?? {}) });
}

function isRegistryAssetType(value: unknown): value is RegistryAssetType {
  return (
    typeof value === "string" &&
    (REGISTRY_ASSET_TYPES as readonly string[]).includes(value)
  );
}

function isRegistryAssetStatus(value: unknown): value is RegistryAssetStatus {
  return (
    typeof value === "string" &&
    (REGISTRY_ASSET_STATUSES as readonly string[]).includes(value)
  );
}

function isRegistryAssetVersionStatus(
  value: unknown,
): value is RegistryAssetVersionStatus {
  return (
    typeof value === "string" &&
    (REGISTRY_ASSET_VERSION_STATUSES as readonly string[]).includes(value)
  );
}

function isRegistryVariantStatus(value: unknown): value is RegistryVariantStatus {
  return (
    typeof value === "string" &&
    (REGISTRY_VARIANT_STATUSES as readonly string[]).includes(value)
  );
}

function isRegistryPublicationStatus(
  value: unknown,
): value is RegistryPublicationStatus {
  return (
    typeof value === "string" &&
    (REGISTRY_PUBLICATION_STATUSES as readonly string[]).includes(value)
  );
}

function isArtifactRelationshipType(
  value: unknown,
): value is ArtifactRelationshipType {
  return (
    typeof value === "string" &&
    (ARTIFACT_RELATIONSHIP_TYPES as readonly string[]).includes(value)
  );
}

function isRegistryConfidenceBand(
  value: unknown,
): value is RegistryConfidenceBand {
  return (
    typeof value === "string" &&
    (REGISTRY_CONFIDENCE_BANDS as readonly string[]).includes(value)
  );
}

function isRegistryArtifactType(value: unknown): value is RegistryArtifactType {
  return (
    typeof value === "string" &&
    (REGISTRY_ARTIFACT_TYPES as readonly string[]).includes(value)
  );
}

function isPublicationVisibility(
  value: unknown,
): value is PublicationEventVisibility {
  return (
    typeof value === "string" &&
    (PUBLICATION_EVENT_VISIBILITIES as readonly string[]).includes(value)
  );
}

function normalizeOptionalString(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim() : null;
}

function normalizePolicyVersions(
  input: unknown,
  issues: RegistrySnapshotValidationIssue[],
  path: string,
): Readonly<Record<string, string>> | null {
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    issues.push({
      path,
      message: "Expected a policyVersions object.",
    });
    return null;
  }

  const entries = Object.entries(input as Record<string, unknown>);
  const normalized: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!isNonEmptyString(key) || !isNonEmptyString(value)) {
      issues.push({
        path,
        message: "policyVersions keys and values must be non-empty strings.",
      });
      continue;
    }
    normalized[key.trim()] = value.trim();
  }

  return sortStringRecord(normalized);
}

function assertNoForbiddenPrivateKeys(
  value: unknown,
  path: string,
): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertNoForbiddenPrivateKeys(value[index], `${path}[${index}]`);
    }
    return;
  }

  if (typeof value !== "object" || value == null) {
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const nextPath = path.length === 0 ? key : `${path}.${key}`;
    if (FORBIDDEN_PRIVATE_KEYS.has(normalizedKey)) {
      throw new RegistryAdapterError({
        code: "private_field_detected",
        message: `Forbidden private field detected at ${nextPath}.`,
        path: nextPath,
      });
    }
    assertNoForbiddenPrivateKeys(child, nextPath);
  }
}

export function assertRegistrySnapshotPublicSafe(
  snapshot: RegistrySnapshot,
): void {
  assertNoForbiddenPrivateKeys(snapshot, "snapshot");
}

function freezeRegistryAsset(asset: RegistryAsset): RegistryAsset {
  return Object.freeze({
    ...asset,
    availableLocales: Object.freeze([...asset.availableLocales]),
    availableChannels: Object.freeze([...asset.availableChannels]),
    metadata: freezeMetadata(asset.metadata),
  });
}

function freezeRegistryAssetVersion(
  version: RegistryAssetVersion,
): RegistryAssetVersion {
  return Object.freeze({
    ...version,
    policyVersions: sortStringRecord(version.policyVersions),
    metadata: freezeMetadata(version.metadata),
  });
}

function freezeRegistryArtifactReference(
  reference: RegistryArtifactReference,
): RegistryArtifactReference {
  return Object.freeze({
    ...reference,
    policyVersions: sortStringRecord(reference.policyVersions),
    metadata: freezeMetadata(reference.metadata),
  });
}

function freezeRegistryChannelVariant(
  variant: RegistryChannelVariant,
): RegistryChannelVariant {
  return Object.freeze({
    ...variant,
    metadata: freezeMetadata(variant.metadata),
  });
}

function freezeRegistryPublicationState(
  publication: RegistryPublicationState,
): RegistryPublicationState {
  return Object.freeze({
    ...publication,
    metadata: freezeMetadata(publication.metadata),
  });
}

function freezeRegistryFreshnessState(
  freshnessState: RegistryFreshnessState,
): RegistryFreshnessState {
  return Object.freeze({
    ...freshnessState,
  });
}

function freezeRegistrySnapshot(snapshot: RegistrySnapshot): RegistrySnapshot {
  return Object.freeze({
    ...snapshot,
    assets: Object.freeze(snapshot.assets.map(freezeRegistryAsset)),
    assetVersions: Object.freeze(
      snapshot.assetVersions.map(freezeRegistryAssetVersion),
    ),
    artifactReferences: Object.freeze(
      snapshot.artifactReferences.map(freezeRegistryArtifactReference),
    ),
    channelVariants: Object.freeze(
      snapshot.channelVariants.map(freezeRegistryChannelVariant),
    ),
    freshnessStates: Object.freeze(
      snapshot.freshnessStates.map(freezeRegistryFreshnessState),
    ),
    publicationStates: Object.freeze(
      snapshot.publicationStates.map(freezeRegistryPublicationState),
    ),
    policyVersions: sortStringRecord(snapshot.policyVersions),
    metadata: freezeMetadata(snapshot.metadata),
  });
}

function validateLocaleOrChannelList(
  values: unknown,
  fieldName: string,
  issues: RegistrySnapshotValidationIssue[],
  path: string,
): readonly string[] | null {
  if (!Array.isArray(values)) {
    issues.push({
      path,
      message: `Expected ${fieldName} to be an array of non-empty strings.`,
    });
    return null;
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!isNonEmptyString(value)) {
      issues.push({
        path,
        message: `${fieldName} entries must be non-empty strings.`,
      });
      continue;
    }
    const trimmed = value.trim();
    if (seen.has(trimmed)) {
      issues.push({
        path,
        message: `${fieldName} entries must be unique.`,
      });
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return Object.freeze(normalized);
}

function validateTimestampField(
  value: unknown,
  path: string,
  issues: RegistrySnapshotValidationIssue[],
  required: boolean,
): string | null {
  if (value == null) {
    if (required) {
      issues.push({
        path,
        message: "Expected a canonical ISO UTC timestamp.",
      });
    }
    return null;
  }

  if (!isNonEmptyString(value) || !isCanonicalIsoTimestamp(value)) {
    issues.push({
      path,
      message: "Expected a canonical ISO UTC timestamp.",
    });
    return null;
  }

  return value.trim();
}

function validateRegistryAssetCandidate(
  candidate: Record<string, unknown>,
  index: number,
  issues: RegistrySnapshotValidationIssue[],
): RegistryAsset | null {
  const path = `assets[${index}]`;
  const availableLocales = validateLocaleOrChannelList(
    candidate.availableLocales,
    "availableLocales",
    issues,
    `${path}.availableLocales`,
  );
  const availableChannels = validateLocaleOrChannelList(
    candidate.availableChannels,
    "availableChannels",
    issues,
    `${path}.availableChannels`,
  );
  const defaultLocale = normalizeOptionalString(candidate.defaultLocale);

  if (!isNonEmptyString(candidate.assetId)) {
    issues.push({ path: `${path}.assetId`, message: "Expected a non-empty string." });
  }
  if (!isNonEmptyString(candidate.canonicalId)) {
    issues.push({
      path: `${path}.canonicalId`,
      message: "Expected a non-empty string.",
    });
  }
  if (!isRegistryAssetType(candidate.assetType)) {
    issues.push({
      path: `${path}.assetType`,
      message: `Expected one of: ${REGISTRY_ASSET_TYPES.join(", ")}.`,
    });
  }
  if (!isRegistryAssetStatus(candidate.status)) {
    issues.push({
      path: `${path}.status`,
      message: `Expected one of: ${REGISTRY_ASSET_STATUSES.join(", ")}.`,
    });
  }
  if (!isPublicationVisibility(candidate.visibility)) {
    issues.push({
      path: `${path}.visibility`,
      message: `Expected one of: ${PUBLICATION_EVENT_VISIBILITIES.join(", ")}.`,
    });
  }
  if (!isNonEmptyString(candidate.defaultLocale)) {
    issues.push({
      path: `${path}.defaultLocale`,
      message: "Expected a non-empty string.",
    });
  }
  if (
    availableLocales != null &&
    defaultLocale != null &&
    !availableLocales.includes(defaultLocale)
  ) {
    issues.push({
      path: `${path}.defaultLocale`,
      message: "defaultLocale must be present in availableLocales.",
    });
  }
  if (!isNonEmptyString(candidate.ownerTeam)) {
    issues.push({
      path: `${path}.ownerTeam`,
      message: "Expected a non-empty string.",
    });
  }
  if (
    typeof candidate.confidenceAffectsVisibleContent !== "boolean" ||
    typeof candidate.policyChangeAffectsVisibleContent !== "boolean"
  ) {
    issues.push({
      path,
      message:
        "confidenceAffectsVisibleContent and policyChangeAffectsVisibleContent must be booleans.",
    });
  }
  if (
    candidate.freshnessExpiryBehavior !== "keep_visible" &&
    candidate.freshnessExpiryBehavior !== "suppress"
  ) {
    issues.push({
      path: `${path}.freshnessExpiryBehavior`,
      message: 'Expected "keep_visible" or "suppress".',
    });
  }

  const createdAt = validateTimestampField(
    candidate.createdAt,
    `${path}.createdAt`,
    issues,
    true,
  );
  const updatedAt = validateTimestampField(
    candidate.updatedAt,
    `${path}.updatedAt`,
    issues,
    true,
  );

  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: `${path}.metadata`,
      message: "metadata must be JSON-safe.",
    });
  }

  if (
    !isNonEmptyString(candidate.assetId) ||
    !isNonEmptyString(candidate.canonicalId) ||
    !isRegistryAssetType(candidate.assetType) ||
    !isRegistryAssetStatus(candidate.status) ||
    !isPublicationVisibility(candidate.visibility) ||
    !isNonEmptyString(candidate.defaultLocale) ||
    !isNonEmptyString(candidate.ownerTeam) ||
    availableLocales == null ||
    availableChannels == null ||
    createdAt == null ||
    updatedAt == null ||
    typeof candidate.confidenceAffectsVisibleContent !== "boolean" ||
    typeof candidate.policyChangeAffectsVisibleContent !== "boolean" ||
    (candidate.freshnessExpiryBehavior !== "keep_visible" &&
      candidate.freshnessExpiryBehavior !== "suppress")
  ) {
    return null;
  }

  return freezeRegistryAsset({
    assetId: candidate.assetId.trim(),
    canonicalId: candidate.canonicalId.trim(),
    assetType: candidate.assetType,
    status: candidate.status,
    visibility: candidate.visibility,
    defaultLocale: candidate.defaultLocale.trim(),
    availableLocales,
    availableChannels,
    activeVersionId: normalizeOptionalString(candidate.activeVersionId),
    templateId: normalizeOptionalString(candidate.templateId),
    ownerTeam: candidate.ownerTeam.trim(),
    confidenceAffectsVisibleContent:
      candidate.confidenceAffectsVisibleContent,
    policyChangeAffectsVisibleContent:
      candidate.policyChangeAffectsVisibleContent,
    freshnessExpiryBehavior: candidate.freshnessExpiryBehavior,
    createdAt,
    updatedAt,
    metadata: freezeMetadata(candidate.metadata as CoordinationJsonObject | undefined),
  });
}

function validateRegistryAssetVersionCandidate(
  candidate: Record<string, unknown>,
  index: number,
  issues: RegistrySnapshotValidationIssue[],
): RegistryAssetVersion | null {
  const path = `assetVersions[${index}]`;

  if (!isNonEmptyString(candidate.assetVersionId)) {
    issues.push({
      path: `${path}.assetVersionId`,
      message: "Expected a non-empty string.",
    });
  }
  if (!isNonEmptyString(candidate.assetId)) {
    issues.push({
      path: `${path}.assetId`,
      message: "Expected a non-empty string.",
    });
  }
  if (!isPositiveInteger(candidate.versionNumber)) {
    issues.push({
      path: `${path}.versionNumber`,
      message: "Expected an integer >= 1.",
    });
  }
  if (!isRegistryAssetVersionStatus(candidate.status)) {
    issues.push({
      path: `${path}.status`,
      message: `Expected one of: ${REGISTRY_ASSET_VERSION_STATUSES.join(", ")}.`,
    });
  }
  for (const field of [
    "contentFingerprint",
    "sourceFingerprint",
    "templateFingerprint",
    "rendererFingerprint",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: `${path}.${field}`,
        message: "Expected a non-empty string.",
      });
    }
  }
  if (!isRegistryConfidenceBand(candidate.confidenceBand)) {
    issues.push({
      path: `${path}.confidenceBand`,
      message: `Expected one of: ${REGISTRY_CONFIDENCE_BANDS.join(", ")}.`,
    });
  }
  const policyVersions = normalizePolicyVersions(
    candidate.policyVersions,
    issues,
    `${path}.policyVersions`,
  );
  const createdAt = validateTimestampField(
    candidate.createdAt,
    `${path}.createdAt`,
    issues,
    true,
  );
  const approvedAt = validateTimestampField(
    candidate.approvedAt,
    `${path}.approvedAt`,
    issues,
    false,
  );
  const publishedAt = validateTimestampField(
    candidate.publishedAt,
    `${path}.publishedAt`,
    issues,
    false,
  );
  const supersededAt = validateTimestampField(
    candidate.supersededAt,
    `${path}.supersededAt`,
    issues,
    false,
  );

  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: `${path}.metadata`,
      message: "metadata must be JSON-safe.",
    });
  }

  if (
    !isNonEmptyString(candidate.assetVersionId) ||
    !isNonEmptyString(candidate.assetId) ||
    !isPositiveInteger(candidate.versionNumber) ||
    !isRegistryAssetVersionStatus(candidate.status) ||
    !isNonEmptyString(candidate.contentFingerprint) ||
    !isNonEmptyString(candidate.sourceFingerprint) ||
    !isNonEmptyString(candidate.templateFingerprint) ||
    !isNonEmptyString(candidate.rendererFingerprint) ||
    !isRegistryConfidenceBand(candidate.confidenceBand) ||
    policyVersions == null ||
    createdAt == null
  ) {
    return null;
  }

  return freezeRegistryAssetVersion({
    assetVersionId: candidate.assetVersionId.trim(),
    assetId: candidate.assetId.trim(),
    versionNumber: candidate.versionNumber,
    status: candidate.status,
    contentFingerprint: candidate.contentFingerprint.trim(),
    sourceFingerprint: candidate.sourceFingerprint.trim(),
    templateFingerprint: candidate.templateFingerprint.trim(),
    rendererFingerprint: candidate.rendererFingerprint.trim(),
    policyVersions,
    confidenceBand: candidate.confidenceBand,
    createdAt,
    approvedAt,
    publishedAt,
    supersededAt,
    metadata: freezeMetadata(candidate.metadata as CoordinationJsonObject | undefined),
  });
}

function validateRegistryArtifactReferenceCandidate(
  candidate: Record<string, unknown>,
  index: number,
  issues: RegistrySnapshotValidationIssue[],
): RegistryArtifactReference | null {
  const path = `artifactReferences[${index}]`;
  for (const field of [
    "referenceId",
    "assetId",
    "artifactId",
    "artifactFingerprint",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: `${path}.${field}`,
        message: "Expected a non-empty string.",
      });
    }
  }
  if (!isRegistryArtifactType(candidate.artifactType)) {
    issues.push({
      path: `${path}.artifactType`,
      message: `Expected one of: ${REGISTRY_ARTIFACT_TYPES.join(", ")}.`,
    });
  }
  if (!isArtifactRelationshipType(candidate.relationshipType)) {
    issues.push({
      path: `${path}.relationshipType`,
      message: `Expected one of: ${ARTIFACT_RELATIONSHIP_TYPES.join(", ")}.`,
    });
  }

  const policyVersions = normalizePolicyVersions(
    candidate.policyVersions,
    issues,
    `${path}.policyVersions`,
  );
  const createdAt = validateTimestampField(
    candidate.createdAt,
    `${path}.createdAt`,
    issues,
    true,
  );

  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: `${path}.metadata`,
      message: "metadata must be JSON-safe.",
    });
  }

  if (
    !isNonEmptyString(candidate.referenceId) ||
    !isNonEmptyString(candidate.assetId) ||
    !isRegistryArtifactType(candidate.artifactType) ||
    !isNonEmptyString(candidate.artifactId) ||
    !isNonEmptyString(candidate.artifactFingerprint) ||
    !isArtifactRelationshipType(candidate.relationshipType) ||
    policyVersions == null ||
    createdAt == null
  ) {
    return null;
  }

  return freezeRegistryArtifactReference({
    referenceId: candidate.referenceId.trim(),
    assetId: candidate.assetId.trim(),
    assetVersionId: normalizeOptionalString(candidate.assetVersionId),
    artifactType: candidate.artifactType,
    artifactId: candidate.artifactId.trim(),
    artifactFingerprint: candidate.artifactFingerprint.trim(),
    relationshipType: candidate.relationshipType,
    policyVersions,
    createdAt,
    metadata: freezeMetadata(candidate.metadata as CoordinationJsonObject | undefined),
  });
}

function validateRegistryChannelVariantCandidate(
  candidate: Record<string, unknown>,
  index: number,
  issues: RegistrySnapshotValidationIssue[],
): RegistryChannelVariant | null {
  const path = `channelVariants[${index}]`;
  for (const field of [
    "variantId",
    "assetId",
    "assetVersionId",
    "locale",
    "channel",
    "contentFingerprint",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: `${path}.${field}`,
        message: "Expected a non-empty string.",
      });
    }
  }
  if (!isRegistryVariantStatus(candidate.status)) {
    issues.push({
      path: `${path}.status`,
      message: `Expected one of: ${REGISTRY_VARIANT_STATUSES.join(", ")}.`,
    });
  }
  const publishedAt = validateTimestampField(
    candidate.publishedAt,
    `${path}.publishedAt`,
    issues,
    false,
  );
  const updatedAt = validateTimestampField(
    candidate.updatedAt,
    `${path}.updatedAt`,
    issues,
    true,
  );

  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: `${path}.metadata`,
      message: "metadata must be JSON-safe.",
    });
  }

  if (
    !isNonEmptyString(candidate.variantId) ||
    !isNonEmptyString(candidate.assetId) ||
    !isNonEmptyString(candidate.assetVersionId) ||
    !isNonEmptyString(candidate.locale) ||
    !isNonEmptyString(candidate.channel) ||
    !isRegistryVariantStatus(candidate.status) ||
    !isNonEmptyString(candidate.contentFingerprint) ||
    updatedAt == null
  ) {
    return null;
  }

  return freezeRegistryChannelVariant({
    variantId: candidate.variantId.trim(),
    assetId: candidate.assetId.trim(),
    assetVersionId: candidate.assetVersionId.trim(),
    locale: candidate.locale.trim(),
    channel: candidate.channel.trim(),
    status: candidate.status,
    contentFingerprint: candidate.contentFingerprint.trim(),
    destinationKey: normalizeOptionalString(candidate.destinationKey),
    publishedAt,
    updatedAt,
    metadata: freezeMetadata(candidate.metadata as CoordinationJsonObject | undefined),
  });
}

function validateRegistryFreshnessStateCandidate(
  candidate: Record<string, unknown>,
  index: number,
  issues: RegistrySnapshotValidationIssue[],
): RegistryFreshnessState | null {
  const path = `freshnessStates[${index}]`;
  if (!isNonEmptyString(candidate.assetId)) {
    issues.push({
      path: `${path}.assetId`,
      message: "Expected a non-empty string.",
    });
  }
  for (const field of ["isPublishable", "isStale", "isExpired"] as const) {
    if (typeof candidate[field] !== "boolean") {
      issues.push({
        path: `${path}.${field}`,
        message: "Expected a boolean.",
      });
    }
  }
  const computedAt = validateTimestampField(
    candidate.computedAt,
    `${path}.computedAt`,
    issues,
    true,
  );
  const evaluatedAt = validateTimestampField(
    candidate.evaluatedAt,
    `${path}.evaluatedAt`,
    issues,
    true,
  );
  const reviewDueAt = validateTimestampField(
    candidate.reviewDueAt,
    `${path}.reviewDueAt`,
    issues,
    false,
  );
  const publishableUntil = validateTimestampField(
    candidate.publishableUntil,
    `${path}.publishableUntil`,
    issues,
    false,
  );
  const staleAfter = validateTimestampField(
    candidate.staleAfter,
    `${path}.staleAfter`,
    issues,
    false,
  );
  const expiredAfter = validateTimestampField(
    candidate.expiredAfter,
    `${path}.expiredAfter`,
    issues,
    false,
  );

  if (
    !isNonEmptyString(candidate.assetId) ||
    typeof candidate.isPublishable !== "boolean" ||
    typeof candidate.isStale !== "boolean" ||
    typeof candidate.isExpired !== "boolean" ||
    computedAt == null ||
    evaluatedAt == null
  ) {
    return null;
  }

  return freezeRegistryFreshnessState({
    assetId: candidate.assetId.trim(),
    assetVersionId: normalizeOptionalString(candidate.assetVersionId),
    computedAt,
    reviewDueAt,
    publishableUntil,
    staleAfter,
    expiredAfter,
    isPublishable: candidate.isPublishable,
    isStale: candidate.isStale,
    isExpired: candidate.isExpired,
    evaluatedAt,
  });
}

function validateRegistryPublicationStateCandidate(
  candidate: Record<string, unknown>,
  index: number,
  issues: RegistrySnapshotValidationIssue[],
): RegistryPublicationState | null {
  const path = `publicationStates[${index}]`;
  for (const field of ["assetId", "assetVersionId", "locale", "channel"] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: `${path}.${field}`,
        message: "Expected a non-empty string.",
      });
    }
  }
  if (!isRegistryPublicationStatus(candidate.status)) {
    issues.push({
      path: `${path}.status`,
      message: `Expected one of: ${REGISTRY_PUBLICATION_STATUSES.join(", ")}.`,
    });
  }
  const publishedAt = validateTimestampField(
    candidate.publishedAt,
    `${path}.publishedAt`,
    issues,
    false,
  );
  const suppressedAt = validateTimestampField(
    candidate.suppressedAt,
    `${path}.suppressedAt`,
    issues,
    false,
  );

  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: `${path}.metadata`,
      message: "metadata must be JSON-safe.",
    });
  }

  if (
    !isNonEmptyString(candidate.assetId) ||
    !isNonEmptyString(candidate.assetVersionId) ||
    !isNonEmptyString(candidate.locale) ||
    !isNonEmptyString(candidate.channel) ||
    !isRegistryPublicationStatus(candidate.status)
  ) {
    return null;
  }

  return freezeRegistryPublicationState({
    assetId: candidate.assetId.trim(),
    assetVersionId: candidate.assetVersionId.trim(),
    locale: candidate.locale.trim(),
    channel: candidate.channel.trim(),
    status: candidate.status,
    destinationKey: normalizeOptionalString(candidate.destinationKey),
    publicationFingerprint: normalizeOptionalString(candidate.publicationFingerprint),
    publishedAt,
    suppressedAt,
    metadata: freezeMetadata(candidate.metadata as CoordinationJsonObject | undefined),
  });
}

export function validateRegistrySnapshot(
  input: unknown,
): RegistrySnapshotValidationResult {
  const issues: RegistrySnapshotValidationIssue[] = [];

  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a registry snapshot object.",
        }),
      ]),
    };
  }

  const candidate = input as Record<string, unknown>;

  if (!isNonEmptyString(candidate.snapshotId)) {
    issues.push({
      path: "snapshotId",
      message: "Expected a non-empty string.",
    });
  }
  if (!isPositiveInteger(candidate.snapshotVersion)) {
    issues.push({
      path: "snapshotVersion",
      message: "Expected an integer >= 1.",
    });
  }

  const generatedAt = validateTimestampField(
    candidate.generatedAt,
    "generatedAt",
    issues,
    true,
  );

  const assetsRaw = Array.isArray(candidate.assets) ? candidate.assets : null;
  const versionsRaw = Array.isArray(candidate.assetVersions)
    ? candidate.assetVersions
    : null;
  const referencesRaw = Array.isArray(candidate.artifactReferences)
    ? candidate.artifactReferences
    : null;
  const variantsRaw = Array.isArray(candidate.channelVariants)
    ? candidate.channelVariants
    : null;
  const freshnessRaw = Array.isArray(candidate.freshnessStates)
    ? candidate.freshnessStates
    : null;
  const publicationsRaw = Array.isArray(candidate.publicationStates)
    ? candidate.publicationStates
    : null;

  for (const [field, value] of [
    ["assets", assetsRaw],
    ["assetVersions", versionsRaw],
    ["artifactReferences", referencesRaw],
    ["channelVariants", variantsRaw],
    ["freshnessStates", freshnessRaw],
    ["publicationStates", publicationsRaw],
  ] as const) {
    if (value == null) {
      issues.push({
        path: field,
        message: `Expected ${field} to be an array.`,
      });
    }
  }

  const policyVersions = normalizePolicyVersions(
    candidate.policyVersions ?? {},
    issues,
    "policyVersions",
  );

  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
    });
  }

  const assets = (assetsRaw ?? [])
    .map((entry, index) =>
      typeof entry === "object" && entry != null && !Array.isArray(entry)
        ? validateRegistryAssetCandidate(
            entry as Record<string, unknown>,
            index,
            issues,
          )
        : (issues.push({
            path: `assets[${index}]`,
            message: "Expected an asset object.",
          }),
          null),
    )
    .filter((value): value is RegistryAsset => value != null);

  const assetVersions = (versionsRaw ?? [])
    .map((entry, index) =>
      typeof entry === "object" && entry != null && !Array.isArray(entry)
        ? validateRegistryAssetVersionCandidate(
            entry as Record<string, unknown>,
            index,
            issues,
          )
        : (issues.push({
            path: `assetVersions[${index}]`,
            message: "Expected an asset version object.",
          }),
          null),
    )
    .filter((value): value is RegistryAssetVersion => value != null);

  const artifactReferences = (referencesRaw ?? [])
    .map((entry, index) =>
      typeof entry === "object" && entry != null && !Array.isArray(entry)
        ? validateRegistryArtifactReferenceCandidate(
            entry as Record<string, unknown>,
            index,
            issues,
          )
        : (issues.push({
            path: `artifactReferences[${index}]`,
            message: "Expected an artifact reference object.",
          }),
          null),
    )
    .filter((value): value is RegistryArtifactReference => value != null);

  const channelVariants = (variantsRaw ?? [])
    .map((entry, index) =>
      typeof entry === "object" && entry != null && !Array.isArray(entry)
        ? validateRegistryChannelVariantCandidate(
            entry as Record<string, unknown>,
            index,
            issues,
          )
        : (issues.push({
            path: `channelVariants[${index}]`,
            message: "Expected a channel variant object.",
          }),
          null),
    )
    .filter((value): value is RegistryChannelVariant => value != null);

  const freshnessStates = (freshnessRaw ?? [])
    .map((entry, index) =>
      typeof entry === "object" && entry != null && !Array.isArray(entry)
        ? validateRegistryFreshnessStateCandidate(
            entry as Record<string, unknown>,
            index,
            issues,
          )
        : (issues.push({
            path: `freshnessStates[${index}]`,
            message: "Expected a freshness state object.",
          }),
          null),
    )
    .filter((value): value is RegistryFreshnessState => value != null);

  const publicationStates = (publicationsRaw ?? [])
    .map((entry, index) =>
      typeof entry === "object" && entry != null && !Array.isArray(entry)
        ? validateRegistryPublicationStateCandidate(
            entry as Record<string, unknown>,
            index,
            issues,
          )
        : (issues.push({
            path: `publicationStates[${index}]`,
            message: "Expected a publication state object.",
          }),
          null),
    )
    .filter((value): value is RegistryPublicationState => value != null);

  const assetById = new Map<string, RegistryAsset>();
  const assetVersionById = new Map<string, RegistryAssetVersion>();
  const referenceById = new Map<string, RegistryArtifactReference>();
  const variantById = new Map<string, RegistryChannelVariant>();
  const freshnessKeys = new Set<string>();
  const publicationKeys = new Set<string>();
  const versionNumberKeys = new Set<string>();

  for (const asset of assets) {
    if (assetById.has(asset.assetId)) {
      issues.push({
        path: "assets",
        message: `Duplicate assetId: ${asset.assetId}.`,
      });
      continue;
    }
    assetById.set(asset.assetId, asset);
  }

  for (const version of assetVersions) {
    if (assetVersionById.has(version.assetVersionId)) {
      issues.push({
        path: "assetVersions",
        message: `Duplicate assetVersionId: ${version.assetVersionId}.`,
      });
      continue;
    }
    assetVersionById.set(version.assetVersionId, version);

    const versionNumberKey = `${version.assetId}|${version.versionNumber}`;
    if (versionNumberKeys.has(versionNumberKey)) {
      issues.push({
        path: "assetVersions",
        message: `Duplicate versionNumber ${version.versionNumber} for asset ${version.assetId}.`,
      });
    }
    versionNumberKeys.add(versionNumberKey);

    const asset = assetById.get(version.assetId);
    if (asset == null) {
      issues.push({
        path: "assetVersions",
        message: `Version ${version.assetVersionId} references missing asset ${version.assetId}.`,
      });
    }
  }

  for (const asset of assets) {
    if (asset.activeVersionId == null) {
      continue;
    }
    const activeVersion = assetVersionById.get(asset.activeVersionId);
    if (activeVersion == null) {
      issues.push({
        path: "assets",
        message: `Asset ${asset.assetId} references missing activeVersionId ${asset.activeVersionId}.`,
      });
      continue;
    }
    if (activeVersion.assetId !== asset.assetId) {
      issues.push({
        path: "assets",
        message: `Asset ${asset.assetId} activeVersionId ${asset.activeVersionId} belongs to another asset.`,
      });
    }
  }

  for (const reference of artifactReferences) {
    if (referenceById.has(reference.referenceId)) {
      issues.push({
        path: "artifactReferences",
        message: `Duplicate referenceId: ${reference.referenceId}.`,
      });
      continue;
    }
    referenceById.set(reference.referenceId, reference);

    const asset = assetById.get(reference.assetId);
    if (asset == null) {
      issues.push({
        path: "artifactReferences",
        message: `Reference ${reference.referenceId} points to missing asset ${reference.assetId}.`,
      });
      continue;
    }

    if (reference.assetVersionId != null) {
      const version = assetVersionById.get(reference.assetVersionId);
      if (version == null) {
        issues.push({
          path: "artifactReferences",
          message: `Reference ${reference.referenceId} points to missing assetVersionId ${reference.assetVersionId}.`,
        });
      } else if (version.assetId !== asset.assetId) {
        issues.push({
          path: "artifactReferences",
          message: `Reference ${reference.referenceId} points to version ${reference.assetVersionId} outside asset ${asset.assetId}.`,
        });
      }
    }
  }

  for (const variant of channelVariants) {
    if (variantById.has(variant.variantId)) {
      issues.push({
        path: "channelVariants",
        message: `Duplicate variantId: ${variant.variantId}.`,
      });
      continue;
    }
    variantById.set(variant.variantId, variant);

    const asset = assetById.get(variant.assetId);
    if (asset == null) {
      issues.push({
        path: "channelVariants",
        message: `Variant ${variant.variantId} points to missing asset ${variant.assetId}.`,
      });
      continue;
    }
    const version = assetVersionById.get(variant.assetVersionId);
    if (version == null) {
      issues.push({
        path: "channelVariants",
        message: `Variant ${variant.variantId} points to missing version ${variant.assetVersionId}.`,
      });
      continue;
    }
    if (version.assetId !== asset.assetId) {
      issues.push({
        path: "channelVariants",
        message: `Variant ${variant.variantId} references inconsistent asset/version pair.`,
      });
    }
  }

  for (const freshnessState of freshnessStates) {
    const freshnessKey = `${freshnessState.assetId}|${freshnessState.assetVersionId ?? ""}`;
    if (freshnessKeys.has(freshnessKey)) {
      issues.push({
        path: "freshnessStates",
        message: `Duplicate freshness state for ${freshnessKey}.`,
      });
    }
    freshnessKeys.add(freshnessKey);

    const asset = assetById.get(freshnessState.assetId);
    if (asset == null) {
      issues.push({
        path: "freshnessStates",
        message: `Freshness state points to missing asset ${freshnessState.assetId}.`,
      });
      continue;
    }
    if (freshnessState.assetVersionId != null) {
      const version = assetVersionById.get(freshnessState.assetVersionId);
      if (version == null) {
        issues.push({
          path: "freshnessStates",
          message: `Freshness state points to missing version ${freshnessState.assetVersionId}.`,
        });
      } else if (version.assetId !== asset.assetId) {
        issues.push({
          path: "freshnessStates",
          message: `Freshness state references inconsistent asset/version pair.`,
        });
      }
    }
  }

  for (const publication of publicationStates) {
    const publicationKey = [
      publication.assetId,
      publication.assetVersionId,
      publication.locale,
      publication.channel,
      publication.destinationKey ?? "",
    ].join("|");
    if (publicationKeys.has(publicationKey)) {
      issues.push({
        path: "publicationStates",
        message: `Duplicate publication state for ${publicationKey}.`,
      });
    }
    publicationKeys.add(publicationKey);

    const asset = assetById.get(publication.assetId);
    if (asset == null) {
      issues.push({
        path: "publicationStates",
        message: `Publication state points to missing asset ${publication.assetId}.`,
      });
      continue;
    }
    const version = assetVersionById.get(publication.assetVersionId);
    if (version == null) {
      issues.push({
        path: "publicationStates",
        message: `Publication state points to missing version ${publication.assetVersionId}.`,
      });
      continue;
    }
    if (version.assetId !== asset.assetId) {
      issues.push({
        path: "publicationStates",
        message: `Publication state references inconsistent asset/version pair.`,
      });
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  const snapshot = freezeRegistrySnapshot({
    snapshotId: (candidate.snapshotId as string).trim(),
    snapshotVersion: candidate.snapshotVersion as number,
    generatedAt: generatedAt!,
    assets: Object.freeze(assets),
    assetVersions: Object.freeze(assetVersions),
    artifactReferences: Object.freeze(artifactReferences),
    channelVariants: Object.freeze(channelVariants),
    freshnessStates: Object.freeze(freshnessStates),
    publicationStates: Object.freeze(publicationStates),
    policyVersions: policyVersions ?? Object.freeze({}),
    metadata: freezeMetadata(candidate.metadata as CoordinationJsonObject | undefined),
  });

  try {
    assertRegistrySnapshotPublicSafe(snapshot);
  } catch (error) {
    if (error instanceof RegistryAdapterError) {
      return {
        ok: false,
        issues: Object.freeze([
          Object.freeze({
            path: error.path ?? "snapshot",
            message: error.message,
          }),
        ]),
      };
    }
    throw error;
  }

  return {
    ok: true,
    snapshot,
  };
}

export function parseRegistrySnapshot(input: unknown): RegistrySnapshot {
  const result = validateRegistrySnapshot(input);
  if (!result.ok) {
    throw new RegistryAdapterError({
      code: "invalid_snapshot",
      message: result.issues.map((issue) => `${issue.path}: ${issue.message}`).join(" | "),
    });
  }

  return result.snapshot;
}

function compareAssets(left: RegistryAsset, right: RegistryAsset): number {
  return compareStrings(left.assetId, right.assetId);
}

function compareVersions(
  left: RegistryAssetVersion,
  right: RegistryAssetVersion,
): number {
  return (
    compareStrings(left.assetId, right.assetId) ||
    left.versionNumber - right.versionNumber ||
    compareStrings(left.assetVersionId, right.assetVersionId)
  );
}

function compareReferences(
  left: RegistryArtifactReference,
  right: RegistryArtifactReference,
): number {
  return (
    compareStrings(left.assetId, right.assetId) ||
    compareStrings(left.artifactType, right.artifactType) ||
    compareStrings(left.artifactId, right.artifactId) ||
    compareStrings(left.referenceId, right.referenceId)
  );
}

function compareVariants(
  left: RegistryChannelVariant,
  right: RegistryChannelVariant,
): number {
  return (
    compareStrings(left.assetId, right.assetId) ||
    compareStrings(left.assetVersionId, right.assetVersionId) ||
    compareStrings(left.locale, right.locale) ||
    compareStrings(left.channel, right.channel) ||
    compareStrings(left.variantId, right.variantId)
  );
}

function compareFreshnessStates(
  left: RegistryFreshnessState,
  right: RegistryFreshnessState,
): number {
  return (
    compareStrings(left.assetId, right.assetId) ||
    compareNullableStrings(left.assetVersionId, right.assetVersionId)
  );
}

function comparePublications(
  left: RegistryPublicationState,
  right: RegistryPublicationState,
): number {
  return (
    compareStrings(left.assetId, right.assetId) ||
    compareStrings(left.assetVersionId, right.assetVersionId) ||
    compareStrings(left.locale, right.locale) ||
    compareStrings(left.channel, right.channel) ||
    compareNullableStrings(left.destinationKey, right.destinationKey)
  );
}

export function normalizeRegistrySnapshot(
  snapshot: RegistrySnapshot,
): RegistrySnapshot {
  const parsed = parseRegistrySnapshot(snapshot);

  return freezeRegistrySnapshot({
    ...parsed,
    assets: Object.freeze(
      parsed.assets
        .map((asset) =>
          freezeRegistryAsset({
            ...asset,
            availableLocales: uniqueSortedStrings(asset.availableLocales),
            availableChannels: uniqueSortedStrings(asset.availableChannels),
          }),
        )
        .sort(compareAssets),
    ),
    assetVersions: Object.freeze([...parsed.assetVersions].sort(compareVersions)),
    artifactReferences: Object.freeze(
      [...parsed.artifactReferences].sort(compareReferences),
    ),
    channelVariants: Object.freeze(
      [...parsed.channelVariants].sort(compareVariants),
    ),
    freshnessStates: Object.freeze(
      [...parsed.freshnessStates].sort(compareFreshnessStates),
    ),
    publicationStates: Object.freeze(
      [...parsed.publicationStates].sort(comparePublications),
    ),
    policyVersions: sortStringRecord(parsed.policyVersions),
  });
}

type RegistryIndexes = Readonly<{
  snapshot: RegistrySnapshot;
  assetById: ReadonlyMap<string, RegistryAsset>;
  assetVersionById: ReadonlyMap<string, RegistryAssetVersion>;
  versionsByAssetId: ReadonlyMap<string, readonly RegistryAssetVersion[]>;
  referencesByAssetId: ReadonlyMap<string, readonly RegistryArtifactReference[]>;
  variantsByAssetId: ReadonlyMap<string, readonly RegistryChannelVariant[]>;
  publicationsByAssetId: ReadonlyMap<string, readonly RegistryPublicationState[]>;
  freshnessByKey: ReadonlyMap<string, RegistryFreshnessState>;
  assetsByArtifactKey: ReadonlyMap<string, readonly RegistryAsset[]>;
}>;

function buildRegistryIndexes(snapshot: RegistrySnapshot): RegistryIndexes {
  const normalized = normalizeRegistrySnapshot(snapshot);
  const assetById = new Map<string, RegistryAsset>();
  const assetVersionById = new Map<string, RegistryAssetVersion>();
  const versionsByAssetId = new Map<string, RegistryAssetVersion[]>();
  const referencesByAssetId = new Map<string, RegistryArtifactReference[]>();
  const variantsByAssetId = new Map<string, RegistryChannelVariant[]>();
  const publicationsByAssetId = new Map<string, RegistryPublicationState[]>();
  const freshnessByKey = new Map<string, RegistryFreshnessState>();
  const assetsByArtifactKey = new Map<string, RegistryAsset[]>();

  for (const asset of normalized.assets) {
    assetById.set(asset.assetId, asset);
  }

  for (const version of normalized.assetVersions) {
    assetVersionById.set(version.assetVersionId, version);
    const bucket = versionsByAssetId.get(version.assetId) ?? [];
    bucket.push(version);
    versionsByAssetId.set(version.assetId, bucket);
  }

  for (const reference of normalized.artifactReferences) {
    const asset = assetById.get(reference.assetId);
    if (asset == null) {
      continue;
    }
    const assetBucket = referencesByAssetId.get(reference.assetId) ?? [];
    assetBucket.push(reference);
    referencesByAssetId.set(reference.assetId, assetBucket);

    const artifactKey = buildPublicationEventSubjectKey(
      reference.artifactType === "policy" ? "policy" : reference.artifactType,
      reference.artifactId,
    );
    const artifactBucket = assetsByArtifactKey.get(artifactKey) ?? [];
    artifactBucket.push(asset);
    assetsByArtifactKey.set(artifactKey, artifactBucket);
  }

  for (const variant of normalized.channelVariants) {
    const bucket = variantsByAssetId.get(variant.assetId) ?? [];
    bucket.push(variant);
    variantsByAssetId.set(variant.assetId, bucket);
  }

  for (const publication of normalized.publicationStates) {
    const bucket = publicationsByAssetId.get(publication.assetId) ?? [];
    bucket.push(publication);
    publicationsByAssetId.set(publication.assetId, bucket);
  }

  for (const freshnessState of normalized.freshnessStates) {
    freshnessByKey.set(
      `${freshnessState.assetId}|${freshnessState.assetVersionId ?? ""}`,
      freshnessState,
    );
  }

  return Object.freeze({
    snapshot: normalized,
    assetById,
    assetVersionById,
    versionsByAssetId: new Map(
      [...versionsByAssetId.entries()].map(([key, value]) => [
        key,
        Object.freeze([...value].sort(compareVersions)),
      ]),
    ),
    referencesByAssetId: new Map(
      [...referencesByAssetId.entries()].map(([key, value]) => [
        key,
        Object.freeze([...value].sort(compareReferences)),
      ]),
    ),
    variantsByAssetId: new Map(
      [...variantsByAssetId.entries()].map(([key, value]) => [
        key,
        Object.freeze([...value].sort(compareVariants)),
      ]),
    ),
    publicationsByAssetId: new Map(
      [...publicationsByAssetId.entries()].map(([key, value]) => [
        key,
        Object.freeze([...value].sort(comparePublications)),
      ]),
    ),
    freshnessByKey,
    assetsByArtifactKey: new Map(
      [...assetsByArtifactKey.entries()].map(([key, value]) => [
        key,
        Object.freeze(
          [...new Map(value.map((asset) => [asset.assetId, asset])).values()].sort(
            compareAssets,
          ),
        ),
      ]),
    ),
  });
}

function readBooleanApprovalFromMetadata(
  metadata: CoordinationJsonObject,
): boolean | undefined {
  const sourceApproved = metadata.sourceApproved;
  if (typeof sourceApproved === "boolean") {
    return sourceApproved;
  }

  const approved = metadata.approved;
  if (typeof approved === "boolean") {
    return approved;
  }

  const approvalState = metadata.approvalState;
  if (typeof approvalState === "string") {
    const normalized = approvalState.trim().toLowerCase();
    if (
      normalized === "approved" ||
      normalized === "internal_approved" ||
      normalized === "published"
    ) {
      return true;
    }
    if (
      normalized === "pending" ||
      normalized === "pending_review" ||
      normalized === "rejected" ||
      normalized === "suppressed"
    ) {
      return false;
    }
  }

  return undefined;
}

function buildAvailableLocalesByAssetId(
  indexes: RegistryIndexes,
  assetIds: readonly string[],
): Readonly<Record<string, readonly string[]>> {
  const result: Record<string, readonly string[]> = {};

  for (const assetId of assetIds) {
    const asset = indexes.assetById.get(assetId);
    if (asset == null) {
      continue;
    }

    const variantLocales = (indexes.variantsByAssetId.get(assetId) ?? []).map(
      (variant) => variant.locale,
    );
    const publicationLocales = (
      indexes.publicationsByAssetId.get(assetId) ?? []
    ).map((publication) => publication.locale);

    result[assetId] = uniqueSortedStrings([
      ...asset.availableLocales,
      ...variantLocales,
      ...publicationLocales,
      asset.defaultLocale,
    ]);
  }

  return Object.freeze(result);
}

function buildAvailableChannelsByAssetId(
  indexes: RegistryIndexes,
  assetIds: readonly string[],
): Readonly<Record<string, readonly string[]>> {
  const result: Record<string, readonly string[]> = {};

  for (const assetId of assetIds) {
    const asset = indexes.assetById.get(assetId);
    if (asset == null) {
      continue;
    }

    const variantChannels = (indexes.variantsByAssetId.get(assetId) ?? []).map(
      (variant) => variant.channel,
    );
    const publicationChannels = (
      indexes.publicationsByAssetId.get(assetId) ?? []
    ).map((publication) => publication.channel);

    result[assetId] = uniqueSortedStrings([
      ...asset.availableChannels,
      ...variantChannels,
      ...publicationChannels,
    ]);
  }

  return Object.freeze(result);
}

function buildCurrentFingerprintsAndApprovalStates(
  references: readonly RegistryArtifactReference[],
): Readonly<{
  currentFingerprints: Readonly<Record<string, string>>;
  currentApprovalStates?: Readonly<Record<string, boolean>>;
}> {
  const currentFingerprints: Record<string, string> = {};
  const currentApprovalStates: Record<string, boolean> = {};

  for (const reference of references) {
    if (reference.artifactType === "policy") {
      continue;
    }

    const key = buildPublicationEventSubjectKey(
      reference.artifactType,
      reference.artifactId,
    );

    const existingFingerprint = currentFingerprints[key];
    if (
      existingFingerprint != null &&
      existingFingerprint !== reference.artifactFingerprint
    ) {
      throw new RegistryAdapterError({
        code: "invalid_lineage",
        message: `Conflicting fingerprints for lineage subject ${key}.`,
        entityType: "artifact_reference",
        entityId: reference.referenceId,
      });
    }
    currentFingerprints[key] = reference.artifactFingerprint;

    const approval = readBooleanApprovalFromMetadata(reference.metadata);
    if (approval != null) {
      const existingApproval = currentApprovalStates[key];
      if (
        Object.prototype.hasOwnProperty.call(currentApprovalStates, key) &&
        existingApproval !== approval
      ) {
        throw new RegistryAdapterError({
          code: "invalid_lineage",
          message: `Conflicting approval states for lineage subject ${key}.`,
          entityType: "artifact_reference",
          entityId: reference.referenceId,
        });
      }
      currentApprovalStates[key] = approval;
    }
  }

  return Object.freeze({
    currentFingerprints: Object.freeze(
      Object.fromEntries(
        Object.entries(currentFingerprints).sort((left, right) =>
          compareStrings(left[0], right[0]),
        ),
      ),
    ),
    currentApprovalStates:
      Object.keys(currentApprovalStates).length === 0
        ? undefined
        : Object.freeze(
            Object.fromEntries(
              Object.entries(currentApprovalStates).sort((left, right) =>
                compareStrings(left[0], right[0]),
              ),
            ),
          ),
  });
}

function resolveTarget(
  input: BuildImpactResolutionContextFromRegistryInput,
): { subjectType: RegistryArtifactType; subjectId: string } | null {
  if (input.event != null) {
    return {
      subjectType: input.event.subjectType as RegistryArtifactType,
      subjectId: input.event.subjectId,
    };
  }

  if (
    input.targetSubject != null &&
    isNonEmptyString(input.targetSubject.subjectId)
  ) {
    return {
      subjectType: input.targetSubject.subjectType,
      subjectId: input.targetSubject.subjectId.trim(),
    };
  }

  return null;
}

function resolveImpactedAssetIdsFromTarget(
  indexes: RegistryIndexes,
  target: { subjectType: RegistryArtifactType; subjectId: string } | null,
): readonly string[] {
  if (target == null) {
    return Object.freeze([...indexes.assetById.keys()].sort(compareStrings));
  }

  switch (target.subjectType) {
    case "asset": {
      return indexes.assetById.has(target.subjectId)
        ? Object.freeze([target.subjectId])
        : Object.freeze<string[]>([]);
    }
    case "asset_version": {
      const version = indexes.assetVersionById.get(target.subjectId);
      return version == null ? Object.freeze<string[]>([]) : Object.freeze([version.assetId]);
    }
    case "template": {
      return Object.freeze(
        [...indexes.assetById.values()]
          .filter((asset) => asset.templateId === target.subjectId)
          .map((asset) => asset.assetId)
          .sort(compareStrings),
      );
    }
    case "policy":
    case "benchmark":
    case "public_overview": {
      const key = buildPublicationEventSubjectKey(
        target.subjectType === "policy" ? "policy" : target.subjectType,
        target.subjectId,
      );
      return Object.freeze(
        (indexes.assetsByArtifactKey.get(key) ?? [])
          .map((asset) => asset.assetId)
          .sort(compareStrings),
      );
    }
  }
}

function mapRegistryAssetToImpactResolverAsset(
  asset: RegistryAsset,
): ImpactResolverAsset {
  return Object.freeze({
    assetId: asset.assetId,
    assetType: asset.assetType,
    templateId: asset.templateId,
    visibility: asset.visibility,
    confidenceAffectsVisibleContent: asset.confidenceAffectsVisibleContent,
    policyChangeAffectsVisibleContent: asset.policyChangeAffectsVisibleContent,
    freshnessExpiryBehavior: asset.freshnessExpiryBehavior,
  });
}

function mapRegistryVersionToImpactResolverVersion(
  version: RegistryAssetVersion,
): ImpactResolverAssetVersion {
  return Object.freeze({
    assetVersionId: version.assetVersionId,
    assetId: version.assetId,
  });
}

function mapRegistryReferenceToImpactResolverReference(
  reference: RegistryArtifactReference,
): ImpactResolverArtifactReference {
  return Object.freeze({
    assetId: reference.assetId,
    assetVersionId: reference.assetVersionId,
    referenceType:
      reference.artifactType === "policy" ? "policy" : "source_subject",
    subjectType:
      reference.artifactType === "policy"
        ? "policy"
        : reference.artifactType,
    subjectId: reference.artifactId,
  });
}

export function getRegistryAsset(
  snapshot: RegistrySnapshot,
  assetId: string,
): RegistryAsset | null {
  return buildRegistryIndexes(snapshot).assetById.get(assetId.trim()) ?? null;
}

export function getRegistryAssetVersion(
  snapshot: RegistrySnapshot,
  assetVersionId: string,
): RegistryAssetVersion | null {
  return (
    buildRegistryIndexes(snapshot).assetVersionById.get(assetVersionId.trim()) ??
    null
  );
}

export function getActiveRegistryVersion(
  snapshot: RegistrySnapshot,
  assetId: string,
): RegistryAssetVersion | null {
  const asset = getRegistryAsset(snapshot, assetId);
  if (asset?.activeVersionId == null) {
    return null;
  }
  return getRegistryAssetVersion(snapshot, asset.activeVersionId);
}

export function findRegistryAssetsByArtifact(
  snapshot: RegistrySnapshot,
  subjectType: RegistryArtifactType,
  subjectId: string,
): readonly RegistryAsset[] {
  const indexes = buildRegistryIndexes(snapshot);
  const key = buildPublicationEventSubjectKey(
    subjectType === "policy" ? "policy" : subjectType,
    subjectId.trim(),
  );
  return indexes.assetsByArtifactKey.get(key) ?? Object.freeze<RegistryAsset[]>([]);
}

export function listRegistryVersionsForAsset(
  snapshot: RegistrySnapshot,
  assetId: string,
): readonly RegistryAssetVersion[] {
  return (
    buildRegistryIndexes(snapshot).versionsByAssetId.get(assetId.trim()) ??
    Object.freeze<RegistryAssetVersion[]>([])
  );
}

export function listRegistryVariantsForAsset(
  snapshot: RegistrySnapshot,
  assetId: string,
  assetVersionId?: string | null,
): readonly RegistryChannelVariant[] {
  const variants =
    buildRegistryIndexes(snapshot).variantsByAssetId.get(assetId.trim()) ??
    Object.freeze<RegistryChannelVariant[]>([]);
  if (assetVersionId == null) {
    return variants;
  }
  return Object.freeze(
    variants.filter((variant) => variant.assetVersionId === assetVersionId),
  );
}

export function listRegistryPublicationsForAsset(
  snapshot: RegistrySnapshot,
  assetId: string,
  assetVersionId?: string | null,
): readonly RegistryPublicationState[] {
  const publications =
    buildRegistryIndexes(snapshot).publicationsByAssetId.get(assetId.trim()) ??
    Object.freeze<RegistryPublicationState[]>([]);
  if (assetVersionId == null) {
    return publications;
  }
  return Object.freeze(
    publications.filter(
      (publication) => publication.assetVersionId === assetVersionId,
    ),
  );
}

export function getRegistryFreshnessState(
  snapshot: RegistrySnapshot,
  assetId: string,
  assetVersionId?: string | null,
): RegistryFreshnessState | null {
  const indexes = buildRegistryIndexes(snapshot);
  const exactKey = `${assetId.trim()}|${assetVersionId?.trim() ?? ""}`;
  const exact = indexes.freshnessByKey.get(exactKey);
  if (exact != null) {
    return exact;
  }
  return indexes.freshnessByKey.get(`${assetId.trim()}|`) ?? null;
}

export function isRegistryAssetPublishable(
  snapshot: RegistrySnapshot,
  assetId: string,
): boolean {
  const asset = getRegistryAsset(snapshot, assetId);
  if (asset == null) {
    return false;
  }

  if (
    asset.status === "archived" ||
    asset.status === "deprecated" ||
    asset.status === "suppressed"
  ) {
    return false;
  }

  const activeVersion = getActiveRegistryVersion(snapshot, assetId);
  if (activeVersion == null || !isRegistryVersionApproved(snapshot, activeVersion.assetVersionId)) {
    return false;
  }

  const freshness = getRegistryFreshnessState(
    snapshot,
    assetId,
    activeVersion.assetVersionId,
  );
  return freshness?.isPublishable === true && freshness.isExpired === false;
}

export function isRegistryVersionApproved(
  snapshot: RegistrySnapshot,
  assetVersionId: string,
): boolean {
  const version = getRegistryAssetVersion(snapshot, assetVersionId);
  if (version == null) {
    return false;
  }

  return (
    (version.status === "approved" || version.status === "active") &&
    version.approvedAt != null
  );
}

export function hasPublishedRegistryVariant(
  snapshot: RegistrySnapshot,
  input: Readonly<{
    assetId: string;
    assetVersionId?: string | null;
    locale?: string | null;
    channel?: string | null;
  }>,
): boolean {
  return listRegistryVariantsForAsset(
    snapshot,
    input.assetId,
    input.assetVersionId,
  ).some(
    (variant) =>
      variant.status === "published" &&
      (input.locale == null || variant.locale === input.locale) &&
      (input.channel == null || variant.channel === input.channel),
  );
}

export function getRegistryArtifactLineage(
  snapshot: RegistrySnapshot,
  assetId: string,
): readonly RegistryArtifactReference[] {
  return (
    buildRegistryIndexes(snapshot).referencesByAssetId.get(assetId.trim()) ??
    Object.freeze<RegistryArtifactReference[]>([])
  );
}

export function buildRegistrySnapshotFingerprint(
  snapshot: RegistrySnapshot,
): string {
  const normalized = normalizeRegistrySnapshot(snapshot);

  const businessProjection = {
    snapshotVersion: normalized.snapshotVersion,
    policyVersions: normalized.policyVersions,
    assets: normalized.assets.map((asset) => ({
      assetId: asset.assetId,
      canonicalId: asset.canonicalId,
      assetType: asset.assetType,
      status: asset.status,
      visibility: asset.visibility,
      defaultLocale: asset.defaultLocale,
      availableLocales: asset.availableLocales,
      availableChannels: asset.availableChannels,
      activeVersionId: asset.activeVersionId,
      templateId: asset.templateId,
      confidenceAffectsVisibleContent: asset.confidenceAffectsVisibleContent,
      policyChangeAffectsVisibleContent: asset.policyChangeAffectsVisibleContent,
      freshnessExpiryBehavior: asset.freshnessExpiryBehavior,
      metadata: asset.metadata,
    })),
    assetVersions: normalized.assetVersions.map((version) => ({
      assetVersionId: version.assetVersionId,
      assetId: version.assetId,
      versionNumber: version.versionNumber,
      status: version.status,
      contentFingerprint: version.contentFingerprint,
      sourceFingerprint: version.sourceFingerprint,
      templateFingerprint: version.templateFingerprint,
      rendererFingerprint: version.rendererFingerprint,
      policyVersions: version.policyVersions,
      confidenceBand: version.confidenceBand,
      approvedAt: version.approvedAt,
      publishedAt: version.publishedAt,
      supersededAt: version.supersededAt,
      metadata: version.metadata,
    })),
    artifactReferences: normalized.artifactReferences.map((reference) => ({
      assetId: reference.assetId,
      assetVersionId: reference.assetVersionId,
      artifactType: reference.artifactType,
      artifactId: reference.artifactId,
      artifactFingerprint: reference.artifactFingerprint,
      relationshipType: reference.relationshipType,
      policyVersions: reference.policyVersions,
      metadata: reference.metadata,
    })),
    channelVariants: normalized.channelVariants.map((variant) => ({
      assetId: variant.assetId,
      assetVersionId: variant.assetVersionId,
      locale: variant.locale,
      channel: variant.channel,
      status: variant.status,
      contentFingerprint: variant.contentFingerprint,
      destinationKey: variant.destinationKey,
      metadata: variant.metadata,
    })),
    freshnessStates: normalized.freshnessStates.map((freshnessState) => ({
      assetId: freshnessState.assetId,
      assetVersionId: freshnessState.assetVersionId,
      publishableUntil: freshnessState.publishableUntil,
      staleAfter: freshnessState.staleAfter,
      expiredAfter: freshnessState.expiredAfter,
      isPublishable: freshnessState.isPublishable,
      isStale: freshnessState.isStale,
      isExpired: freshnessState.isExpired,
    })),
    publicationStates: normalized.publicationStates.map((publication) => ({
      assetId: publication.assetId,
      assetVersionId: publication.assetVersionId,
      locale: publication.locale,
      channel: publication.channel,
      status: publication.status,
      destinationKey: publication.destinationKey,
      publicationFingerprint: publication.publicationFingerprint,
      publishedAt: publication.publishedAt,
      suppressedAt: publication.suppressedAt,
      metadata: publication.metadata,
    })),
  };

  return createHash("sha256")
    .update(JSON.stringify(businessProjection))
    .digest("hex");
}

export function buildImpactResolutionContextFromRegistry(
  input: BuildImpactResolutionContextFromRegistryInput,
): ImpactResolutionContext {
  const indexes = buildRegistryIndexes(input.snapshot);
  const target = resolveTarget(input);
  const assetIds = resolveImpactedAssetIdsFromTarget(indexes, target);

  const assets = Object.freeze(
    assetIds
      .map((assetId) => indexes.assetById.get(assetId))
      .filter((asset): asset is RegistryAsset => asset != null)
      .map(mapRegistryAssetToImpactResolverAsset),
  );

  const assetVersions = Object.freeze(
    assetIds.flatMap((assetId) =>
      (indexes.versionsByAssetId.get(assetId) ?? []).map(
        mapRegistryVersionToImpactResolverVersion,
      ),
    ),
  );

  const artifactReferences = Object.freeze(
    assetIds.flatMap((assetId) =>
      (indexes.referencesByAssetId.get(assetId) ?? []).map(
        mapRegistryReferenceToImpactResolverReference,
      ),
    ),
  );

  const filteredRegistryReferences = Object.freeze(
    assetIds.flatMap(
      (assetId) => indexes.referencesByAssetId.get(assetId) ?? [],
    ),
  );

  const activeVersions = Object.freeze(
    Object.fromEntries(
      assetIds
        .map((assetId) => {
          const asset = indexes.assetById.get(assetId);
          return asset?.activeVersionId == null
            ? null
            : ([assetId, asset.activeVersionId] as const);
        })
        .filter((entry): entry is readonly [string, string] => entry != null)
        .sort((left, right) => compareStrings(left[0], right[0])),
    ),
  );

  const availableLocales = buildAvailableLocalesByAssetId(indexes, assetIds);
  const availableChannels = buildAvailableChannelsByAssetId(indexes, assetIds);

  const referencedPolicyIds = new Set<string>();
  for (const reference of filteredRegistryReferences) {
    if (reference.artifactType === "policy") {
      referencedPolicyIds.add(reference.artifactId);
    }
  }
  if (target?.subjectType === "policy") {
    referencedPolicyIds.add(target.subjectId);
  }

  const currentPolicyVersions =
    referencedPolicyIds.size === 0 && target == null
      ? indexes.snapshot.policyVersions
      : Object.freeze(
          Object.fromEntries(
            [...referencedPolicyIds]
              .filter((policyId) => policyId in indexes.snapshot.policyVersions)
              .sort(compareStrings)
              .map((policyId) => [
                policyId,
                indexes.snapshot.policyVersions[policyId],
              ]),
          ),
        );

  const { currentFingerprints, currentApprovalStates } =
    buildCurrentFingerprintsAndApprovalStates(filteredRegistryReferences);

  return Object.freeze({
    assets,
    assetVersions,
    artifactReferences,
    activeVersions,
    availableLocales,
    availableChannels,
    currentPolicyVersions,
    currentFingerprints,
    ...(currentApprovalStates == null ? {} : { currentApprovalStates }),
    now: input.now ?? (() => indexes.snapshot.generatedAt),
  });
}

export function buildJobExpansionContextFromRegistry(
  input: BuildJobExpansionContextFromRegistryInput,
): ExpandImpactActionIntoJobsContext {
  const indexes = buildRegistryIndexes(input.snapshot);
  const assetIds = uniqueSortedStrings(input.impactPlan.impactedAssets);

  const localesByAssetId = buildAvailableLocalesByAssetId(indexes, assetIds);
  const channelsByAssetId = buildAvailableChannelsByAssetId(indexes, assetIds);
  const activeAssetVersionIdsByAssetId = Object.freeze(
    Object.fromEntries(
      assetIds
        .map((assetId) => {
          const asset = indexes.assetById.get(assetId);
          return [assetId, asset?.activeVersionId ?? null] as const;
        })
        .sort((left, right) => compareStrings(left[0], right[0])),
    ),
  );

  return Object.freeze({
    runId: input.runId,
    now: input.now,
    localesByAssetId,
    channelsByAssetId,
    activeAssetVersionIdsByAssetId,
    ...(input.dependencyJobIdsByTargetKey == null
      ? {}
      : { dependencyJobIdsByTargetKey: input.dependencyJobIdsByTargetKey }),
    ...(input.dependentJobIdsByTargetKey == null
      ? {}
      : { dependentJobIdsByTargetKey: input.dependentJobIdsByTargetKey }),
    ...(input.maxAttemptsByJobType == null
      ? {}
      : { maxAttemptsByJobType: input.maxAttemptsByJobType }),
    ...(input.estimatedCostByJobType == null
      ? {}
      : { estimatedCostByJobType: input.estimatedCostByJobType }),
    ...(input.metadataByJobType == null
      ? {}
      : { metadataByJobType: input.metadataByJobType }),
  });
}
