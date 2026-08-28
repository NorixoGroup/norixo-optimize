import { createHash } from "node:crypto";

import type { CoordinationJsonObject, CoordinationJsonValue } from "./distributedCoordination";
import type { ExecutionCoordinationRequirement, ExecutionPlan } from "./executionEngine";
import {
  buildExecutionGraph,
  buildExecutionPlan as buildRuntimeExecutionPlan,
  type ExecutionGraph as RuntimeExecutionGraph,
  type ExecutionPlan as RuntimeExecutionPlan,
} from "./executionRuntime";
import {
  validateMarketReportArtifactBundle,
  type MarketReportArtifactBundle,
  type MarketReportChangeType,
  type MarketReportContentArtifact,
  type MarketReportGenerationDiagnostic,
  type MarketReportMetadataArtifact,
  type MarketReportSection,
} from "./marketReportGeneration";
import type { MarketReportDefinition } from "./marketReportPilot";
import {
  assertRegistrySnapshotPublicSafe,
  getRegistryAsset,
  getRegistryAssetVersion,
  isRegistryAssetPublishable,
  isRegistryVersionApproved,
  listRegistryPublicationsForAsset,
  listRegistryVariantsForAsset,
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
  type RegistryAsset,
  type RegistryAssetVersion,
  type RegistryChannelVariant,
  type RegistryConfidenceBand,
  type RegistryPublicationState,
  type RegistryPublicationStatus,
  type RegistrySnapshot,
} from "./registryAdapter";
import { parseJob, type Job } from "./jobModel";

export const WEB_OUTPUT_KINDS = Object.freeze([
  "page",
  "json",
  "metadata",
  "sitemap_entry",
  "structured_data",
] as const);

export type WebOutputKind = (typeof WEB_OUTPUT_KINDS)[number];

export const WEB_DEPLOYMENT_TARGETS = Object.freeze([
  "next_app",
  "static_export",
  "edge_content",
  "external_cms",
  "other",
] as const);

export type WebDeploymentTarget = (typeof WEB_DEPLOYMENT_TARGETS)[number];

export const LOCALIZED_ROUTE_STRATEGIES = Object.freeze([
  "default_unprefixed",
  "always_prefixed",
] as const);

export type LocalizedRouteStrategy =
  (typeof LOCALIZED_ROUTE_STRATEGIES)[number];

export type WebPublisherConfiguration = Readonly<{
  siteOrigin: string;
  defaultLocale: string;
  localizedRouteStrategy: LocalizedRouteStrategy;
  marketReportRoutePattern: string;
  deploymentTarget: WebDeploymentTarget;
  rendererVersion: string;
  supportedLocales: readonly string[];
  metadata: CoordinationJsonObject;
}>;

export type WebPublicationDestination = Readonly<{
  destinationId: string;
  channel: "web";
  locale: string;
  route: string;
  canonicalUrl: string;
  siteOrigin: string;
  outputKind: WebOutputKind;
  templateId: string;
  rendererVersion: string;
  deploymentTarget: WebDeploymentTarget;
  metadata: CoordinationJsonObject;
}>;

export type WebContentDescriptor = Readonly<{
  assetId: string;
  assetVersionId: string;
  assetType: string;
  locale: string;
  title: string;
  slug: string;
  route: string;
  templateId: string;
  contentFingerprint: string;
  sourceFingerprint: string;
  rendererFingerprint: string;
  policyVersions: Readonly<Record<string, string>>;
  publicationStatus: RegistryPublicationStatus;
  publishedAt: string | null;
  metadata: CoordinationJsonObject;
}>;

export const WEB_PUBLICATION_ACTIONS = Object.freeze([
  "publish",
  "republish",
  "suppress",
  "rollback",
  "update_metadata",
  "update_freshness",
] as const);

export type WebPublicationAction =
  (typeof WEB_PUBLICATION_ACTIONS)[number];

export type WebPublicationFencingRequirement = Readonly<{
  lockKey: string;
  resourceType: string;
  resourceId: string;
  requiredOwnerScope: string;
  minimumFencingToken: number;
  validationRequiredBeforeWrite: boolean;
}>;

export const WEB_PUBLICATION_PRECONDITION_TYPES = Object.freeze([
  "asset_exists",
  "version_exists",
  "version_is_active",
  "version_is_approved",
  "asset_is_publishable",
  "destination_matches_locale",
  "destination_matches_channel",
  "publication_fingerprint_matches",
  "no_newer_version_active",
  "fencing_token_valid",
  "human_review_completed",
  "immediate_suppression_required",
] as const);

export type WebPublicationPreconditionType =
  (typeof WEB_PUBLICATION_PRECONDITION_TYPES)[number];

export type WebPublicationPrecondition = Readonly<{
  type: WebPublicationPreconditionType;
  required: boolean;
  expectedValue: string | number | boolean | null;
  source: "registry" | "execution_plan" | "destination" | "coordination";
  reason: string;
  metadata: CoordinationJsonObject;
}>;

export const WEB_INVALIDATION_HINT_TYPES = Object.freeze([
  "route",
  "canonical_url",
  "sitemap",
  "structured_data",
  "locale_index",
  "market_index",
  "rss",
  "cache_tag",
] as const);

export type WebInvalidationHintType =
  (typeof WEB_INVALIDATION_HINT_TYPES)[number];

export type WebInvalidationHint = Readonly<{
  type: WebInvalidationHintType;
  key: string;
  reason: string;
}>;

export type WebPublicationCommand = Readonly<{
  commandId: string;
  commandVersion: number;
  action: WebPublicationAction;
  jobId: string;
  runId: string;
  executionPlanId: string;
  idempotencyKey: string;
  fencingRequirement: WebPublicationFencingRequirement;
  assetId: string;
  assetVersionId: string;
  destination: WebPublicationDestination;
  contentDescriptor: WebContentDescriptor | null;
  expectedCurrentPublicationFingerprint: string | null;
  targetPublicationFingerprint: string | null;
  previousPublicationState: RegistryPublicationState | null;
  nextPublicationState: RegistryPublicationState;
  preconditions: readonly WebPublicationPrecondition[];
  invalidationHints: readonly WebInvalidationHint[];
  createdAt: string;
  metadata: CoordinationJsonObject;
}>;

export type WebPublicationBatch = Readonly<{
  batchId: string;
  batchVersion: number;
  executionPlanId: string;
  commandIds: readonly string[];
  commands: readonly WebPublicationCommand[];
  executionOrder: readonly string[];
  estimatedWriteCount: number;
  requiresReviewCompletion: boolean;
  containsImmediateSuppression: boolean;
  createdAt: string;
  metadata: CoordinationJsonObject;
}>;

export type WebPublicationResult = Readonly<{
  status: "planned" | "applied" | "rejected" | "rolled_back";
  destination: WebPublicationDestination;
  publicationFingerprint: string | null;
  deployedAt: string | null;
  diagnostics: CoordinationJsonObject;
}>;

export interface WebPublishingAdapter {
  inspectDestination(
    command: WebPublicationCommand,
  ): Promise<CoordinationJsonObject>;
  validatePreconditions(
    command: WebPublicationCommand,
    fencingContext: CoordinationJsonObject,
  ): Promise<CoordinationJsonObject>;
  applyCommand(
    command: WebPublicationCommand,
    fencingContext: CoordinationJsonObject,
  ): Promise<WebPublicationResult>;
  invalidate(
    hints: readonly WebInvalidationHint[],
  ): Promise<CoordinationJsonObject>;
  readPublicationFingerprint(
    destination: WebPublicationDestination,
  ): Promise<string | null>;
  rollback(
    command: WebPublicationCommand,
    fencingContext: CoordinationJsonObject,
  ): Promise<WebPublicationResult>;
}

export type WebPublicationDestinationValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type WebPublicationDestinationValidationResult =
  | Readonly<{
      ok: true;
      destination: WebPublicationDestination;
    }>
  | Readonly<{
      ok: false;
      issues: readonly WebPublicationDestinationValidationIssue[];
    }>;

export type WebContentDescriptorValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type WebContentDescriptorValidationResult =
  | Readonly<{
      ok: true;
      descriptor: WebContentDescriptor;
    }>
  | Readonly<{
      ok: false;
      issues: readonly WebContentDescriptorValidationIssue[];
    }>;

export type WebPublicationCommandValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type WebPublicationCommandValidationResult =
  | Readonly<{
      ok: true;
      command: WebPublicationCommand;
    }>
  | Readonly<{
      ok: false;
      issues: readonly WebPublicationCommandValidationIssue[];
    }>;

export type WebPublicationBatchValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type WebPublicationBatchValidationResult =
  | Readonly<{
      ok: true;
      batch: WebPublicationBatch;
    }>
  | Readonly<{
      ok: false;
      issues: readonly WebPublicationBatchValidationIssue[];
    }>;

export type PlanWebPublicationCommandInput = Readonly<{
  executionPlan: ExecutionPlan;
  job: Job;
  registrySnapshot: RegistrySnapshot;
  publisherConfiguration: WebPublisherConfiguration;
  now: () => string;
  marketReportDefinitionsByAssetId?: Readonly<Record<string, MarketReportDefinition>>;
  metadata?: CoordinationJsonObject;
}>;

export type PlanWebPublicationBatchFilters = Readonly<{
  jobIds?: readonly string[];
  actions?: readonly WebPublicationAction[];
  assetIds?: readonly string[];
}>;

export type PlanWebPublicationBatchInput = Readonly<{
  executionPlan: ExecutionPlan;
  registrySnapshot: RegistrySnapshot;
  publisherConfiguration: WebPublisherConfiguration;
  now: () => string;
  filters?: PlanWebPublicationBatchFilters;
  marketReportDefinitionsByAssetId?: Readonly<Record<string, MarketReportDefinition>>;
  metadata?: CoordinationJsonObject;
}>;

export type WebPublisherErrorCode =
  | "incompatible_job"
  | "job_not_in_execution_plan"
  | "unsupported_channel"
  | "invalid_input"
  | "invalid_bundle"
  | "invalid_page_model"
  | "invalid_seo_model"
  | "invalid_manifest"
  | "missing_asset"
  | "missing_version"
  | "inconsistent_asset_version"
  | "unsupported_locale"
  | "invalid_destination"
  | "invalid_route"
  | "invalid_canonical_url"
  | "missing_publication_state"
  | "invalid_state_transition"
  | "missing_coordination_requirement"
  | "invalid_fencing_requirement"
  | "fingerprint_conflict"
  | "duplicate_command_conflict"
  | "private_field_detected"
  | "invalid_command"
  | "invalid_batch";

export class WebPublisherError extends Error {
  readonly code: WebPublisherErrorCode;
  readonly commandId?: string;
  readonly executionPlanId?: string;
  readonly jobId?: string;
  readonly assetId?: string;
  readonly assetVersionId?: string;
  readonly destinationId?: string;
  readonly operation?: string;
  readonly reportId?: string;
  readonly routeKey?: string;
  readonly path?: string;
  readonly cause?: unknown;

  constructor(
    input: Readonly<{
      code: WebPublisherErrorCode;
      message: string;
      commandId?: string;
      executionPlanId?: string;
      jobId?: string;
      assetId?: string;
      assetVersionId?: string;
      destinationId?: string;
      operation?: string;
      reportId?: string;
      routeKey?: string;
      path?: string;
      cause?: unknown;
    }>,
  ) {
    super(input.message);
    this.name = "WebPublisherError";
    this.code = input.code;
    this.commandId = input.commandId;
    this.executionPlanId = input.executionPlanId;
    this.jobId = input.jobId;
    this.assetId = input.assetId;
    this.assetVersionId = input.assetVersionId;
    this.destinationId = input.destinationId;
    this.operation = input.operation;
    this.reportId = input.reportId;
    this.routeKey = input.routeKey;
    this.path = input.path;
    this.cause = input.cause;
  }
}

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

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function compareNullableStrings(
  left: string | null,
  right: string | null,
): number {
  return compareStrings(left ?? "", right ?? "");
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

function isAbsoluteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return isNonEmptyString(parsed.protocol) && isNonEmptyString(parsed.host);
  } catch {
    return false;
  }
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

function freezeMetadata(metadata: CoordinationJsonObject | undefined): CoordinationJsonObject {
  return Object.freeze({ ...(metadata ?? {}) });
}

function normalizeJsonMetadata<T extends CoordinationJsonObject | undefined>(
  metadata: T,
): CoordinationJsonObject {
  const frozen = freezeMetadata(metadata);
  assertNoForbiddenPrivateKeys(frozen, "metadata");
  if (!isJsonSafe(frozen)) {
    throw new WebPublisherError({
      code: "invalid_command",
      path: "metadata",
      message: "Expected JSON-safe metadata.",
    });
  }
  return frozen;
}

function buildStableHash(parts: readonly string[], prefix: string): string {
  const hash = createHash("sha256")
    .update(parts.join("||"))
    .digest("hex");
  return `${prefix}${hash}`;
}

function canonicalizeForComparison(value: unknown): string {
  return JSON.stringify(value);
}

function assertNoForbiddenPrivateKeys(value: unknown, path: string): void {
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
      throw new WebPublisherError({
        code: "private_field_detected",
        path: nextPath,
        message: `Forbidden private field detected at ${nextPath}.`,
      });
    }
    assertNoForbiddenPrivateKeys(child, nextPath);
  }
}

function slugifySegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRoute(route: string): string {
  const collapsed = route.replace(/\/{2,}/g, "/");
  const trimmed =
    collapsed.length > 1 && collapsed.endsWith("/")
      ? collapsed.slice(0, -1)
      : collapsed;
  return trimmed === "" ? "/" : trimmed;
}

function replaceRouteTokens(
  pattern: string,
  tokens: Readonly<Record<string, string>>,
): string {
  return pattern.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, token) =>
    encodeURIComponent(tokens[token] ?? ""),
  );
}

function validateSupportedLocale(
  locale: string,
  configuration: WebPublisherConfiguration,
): void {
  if (!configuration.supportedLocales.includes(locale)) {
    throw new WebPublisherError({
      code: "unsupported_locale",
      message: `Locale ${locale} is not supported by the Web Publisher configuration.`,
    });
  }
}

function resolveMarketReportRoute(
  asset: RegistryAsset,
  definition: MarketReportDefinition | null,
  locale: string,
  configuration: WebPublisherConfiguration,
): string {
  const metadata = asset.metadata as Record<string, unknown>;
  const slug =
    definition?.slug ??
    (isNonEmptyString(asset.canonicalId) ? asset.canonicalId : asset.assetId);
  const country =
    definition?.country ??
    (isNonEmptyString(metadata.country) ? String(metadata.country) : "unknown");
  const city =
    definition?.city ??
    (isNonEmptyString(metadata.city) ? String(metadata.city) : "unknown");

  const baseRoute = replaceRouteTokens(configuration.marketReportRoutePattern, {
    country: slugifySegment(country),
    city: slugifySegment(city),
    slug: slugifySegment(slug),
    locale: slugifySegment(locale),
  });
  const normalizedBase = normalizeRoute(baseRoute.startsWith("/") ? baseRoute : `/${baseRoute}`);
  const shouldPrefixLocale =
    configuration.localizedRouteStrategy === "always_prefixed" ||
    locale !== configuration.defaultLocale;

  if (!shouldPrefixLocale) {
    return normalizedBase;
  }

  return normalizeRoute(`/${slugifySegment(locale)}${normalizedBase}`);
}

function resolveOutputKind(asset: RegistryAsset): WebOutputKind {
  switch (asset.assetType) {
    case "market_report":
      return "page";
    default:
      return "page";
  }
}

function resolveCurrentLocale(
  job: Job,
  asset: RegistryAsset,
  variants: readonly RegistryChannelVariant[],
  publications: readonly RegistryPublicationState[],
  configuration: WebPublisherConfiguration,
): string {
  if (job.locale != null) {
    validateSupportedLocale(job.locale, configuration);
    return job.locale;
  }

  const webLocales = uniqueSortedStrings(
    [
      ...variants.filter((variant) => variant.channel === "web").map((variant) => variant.locale),
      ...publications
        .filter((publication) => publication.channel === "web")
        .map((publication) => publication.locale),
    ].filter(isNonEmptyString),
  );

  if (webLocales.length === 1) {
    validateSupportedLocale(webLocales[0]!, configuration);
    return webLocales[0]!;
  }

  validateSupportedLocale(asset.defaultLocale, configuration);
  if (webLocales.length > 1 && !webLocales.includes(asset.defaultLocale)) {
    throw new WebPublisherError({
      code: "unsupported_locale",
      assetId: asset.assetId,
      jobId: job.jobId,
      message:
        "The job locale is ambiguous and the asset defaultLocale is not available for the web channel.",
    });
  }

  return asset.defaultLocale;
}

function resolveMatchingVariant(
  variants: readonly RegistryChannelVariant[],
  assetVersionId: string,
  locale: string,
): RegistryChannelVariant | null {
  return (
    variants.find(
      (variant) =>
        variant.assetVersionId === assetVersionId &&
        variant.locale === locale &&
        variant.channel === "web",
    ) ?? null
  );
}

function resolveMatchingPublication(
  publications: readonly RegistryPublicationState[],
  assetVersionId: string,
  locale: string,
): RegistryPublicationState | null {
  return (
    publications.find(
      (publication) =>
        publication.assetVersionId === assetVersionId &&
        publication.locale === locale &&
        publication.channel === "web",
    ) ?? null
  );
}

function buildRendererFingerprint(input: Readonly<{
  templateId: string;
  rendererVersion: string;
  locale: string;
  assetType: string;
}>): string {
  return buildStableHash(
    [
      input.templateId,
      input.rendererVersion,
      input.locale,
      input.assetType,
      "web_renderer_contract_v1",
    ],
    "ipp_web_renderer_",
  );
}

function freezeDestination(destination: WebPublicationDestination): WebPublicationDestination {
  return Object.freeze({
    ...destination,
    metadata: freezeMetadata(destination.metadata),
  });
}

function freezeDescriptor(descriptor: WebContentDescriptor): WebContentDescriptor {
  return Object.freeze({
    ...descriptor,
    policyVersions: sortStringRecord(descriptor.policyVersions),
    metadata: freezeMetadata(descriptor.metadata),
  });
}

function freezePrecondition(
  precondition: WebPublicationPrecondition,
): WebPublicationPrecondition {
  return Object.freeze({
    ...precondition,
    metadata: freezeMetadata(precondition.metadata),
  });
}

function freezeHint(hint: WebInvalidationHint): WebInvalidationHint {
  return Object.freeze({ ...hint });
}

function freezeFencingRequirement(
  requirement: WebPublicationFencingRequirement,
): WebPublicationFencingRequirement {
  return Object.freeze({ ...requirement });
}

function freezeCommand(command: WebPublicationCommand): WebPublicationCommand {
  return Object.freeze({
    ...command,
    destination: freezeDestination(command.destination),
    contentDescriptor:
      command.contentDescriptor == null
        ? null
        : freezeDescriptor(command.contentDescriptor),
    previousPublicationState:
      command.previousPublicationState == null
        ? null
        : Object.freeze({
            ...command.previousPublicationState,
            metadata: freezeMetadata(command.previousPublicationState.metadata),
          }),
    nextPublicationState: Object.freeze({
      ...command.nextPublicationState,
      metadata: freezeMetadata(command.nextPublicationState.metadata),
    }),
    preconditions: Object.freeze(command.preconditions.map(freezePrecondition)),
    invalidationHints: Object.freeze(command.invalidationHints.map(freezeHint)),
    fencingRequirement: freezeFencingRequirement(command.fencingRequirement),
    metadata: freezeMetadata(command.metadata),
  });
}

function freezeBatch(batch: WebPublicationBatch): WebPublicationBatch {
  return Object.freeze({
    ...batch,
    commandIds: Object.freeze([...batch.commandIds]),
    commands: Object.freeze(batch.commands.map(freezeCommand)),
    executionOrder: Object.freeze([...batch.executionOrder]),
    metadata: freezeMetadata(batch.metadata),
  });
}

function normalizeConfiguration(
  configuration: WebPublisherConfiguration,
): WebPublisherConfiguration {
  if (!isAbsoluteUrl(configuration.siteOrigin)) {
    throw new WebPublisherError({
      code: "invalid_destination",
      path: "publisherConfiguration.siteOrigin",
      message: "siteOrigin must be an absolute URL.",
    });
  }
  const parsed = new URL(configuration.siteOrigin);
  if (parsed.search !== "" || parsed.hash !== "") {
    throw new WebPublisherError({
      code: "invalid_destination",
      path: "publisherConfiguration.siteOrigin",
      message: "siteOrigin cannot contain a query string or hash.",
    });
  }
  if (!isNonEmptyString(configuration.defaultLocale)) {
    throw new WebPublisherError({
      code: "unsupported_locale",
      path: "publisherConfiguration.defaultLocale",
      message: "defaultLocale must be a non-empty string.",
    });
  }
  if (
    !LOCALIZED_ROUTE_STRATEGIES.includes(
      configuration.localizedRouteStrategy,
    )
  ) {
    throw new WebPublisherError({
      code: "invalid_destination",
      path: "publisherConfiguration.localizedRouteStrategy",
      message: "Unsupported localizedRouteStrategy.",
    });
  }
  if (!configuration.supportedLocales.includes(configuration.defaultLocale)) {
    throw new WebPublisherError({
      code: "unsupported_locale",
      path: "publisherConfiguration.supportedLocales",
      message: "defaultLocale must be part of supportedLocales.",
    });
  }
  if (!isNonEmptyString(configuration.marketReportRoutePattern)) {
    throw new WebPublisherError({
      code: "invalid_route",
      path: "publisherConfiguration.marketReportRoutePattern",
      message: "marketReportRoutePattern must be a non-empty string.",
    });
  }
  if (
    !WEB_DEPLOYMENT_TARGETS.includes(configuration.deploymentTarget)
  ) {
    throw new WebPublisherError({
      code: "invalid_destination",
      path: "publisherConfiguration.deploymentTarget",
      message: "Unsupported deploymentTarget.",
    });
  }
  if (!isNonEmptyString(configuration.rendererVersion)) {
    throw new WebPublisherError({
      code: "invalid_destination",
      path: "publisherConfiguration.rendererVersion",
      message: "rendererVersion must be a non-empty string.",
    });
  }
  assertNoForbiddenPrivateKeys(configuration.metadata, "publisherConfiguration.metadata");
  if (!isJsonSafe(configuration.metadata)) {
    throw new WebPublisherError({
      code: "invalid_destination",
      path: "publisherConfiguration.metadata",
      message: "publisherConfiguration.metadata must be JSON-safe.",
    });
  }

  return Object.freeze({
    ...configuration,
    siteOrigin: parsed.origin,
    defaultLocale: configuration.defaultLocale.trim(),
    supportedLocales: uniqueSortedStrings(configuration.supportedLocales),
    metadata: freezeMetadata(configuration.metadata),
  });
}

export function resolveWebPublicationDestination(input: Readonly<{
  asset: RegistryAsset;
  assetVersion: RegistryAssetVersion;
  locale: string;
  configuration: WebPublisherConfiguration;
  variant?: RegistryChannelVariant | null;
  publicationState?: RegistryPublicationState | null;
  marketReportDefinition?: MarketReportDefinition | null;
}>): WebPublicationDestination {
  const configuration = normalizeConfiguration(input.configuration);
  validateSupportedLocale(input.locale, configuration);

  const variantChannel = input.variant?.channel ?? "web";
  const publicationChannel = input.publicationState?.channel ?? "web";
  if (variantChannel !== "web" || publicationChannel !== "web") {
    throw new WebPublisherError({
      code: "unsupported_channel",
      assetId: input.asset.assetId,
      assetVersionId: input.assetVersion.assetVersionId,
      message: "Web Publisher only supports channel=web.",
    });
  }

  const route =
    input.asset.assetType === "market_report"
      ? resolveMarketReportRoute(
          input.asset,
          input.marketReportDefinition ?? null,
          input.locale,
          configuration,
        )
      : normalizeRoute(`/${slugifySegment(input.asset.canonicalId)}`);

  if (!route.startsWith("/")) {
    throw new WebPublisherError({
      code: "invalid_route",
      assetId: input.asset.assetId,
      assetVersionId: input.assetVersion.assetVersionId,
      message: `Resolved route must start with "/", received ${route}.`,
    });
  }
  if (route.includes("?") || route.includes("#")) {
    throw new WebPublisherError({
      code: "invalid_route",
      assetId: input.asset.assetId,
      assetVersionId: input.assetVersion.assetVersionId,
      message: "Resolved route cannot contain a query string or hash.",
    });
  }
  if (route.includes("//")) {
    throw new WebPublisherError({
      code: "invalid_route",
      assetId: input.asset.assetId,
      assetVersionId: input.assetVersion.assetVersionId,
      message: "Resolved route cannot contain double slashes.",
    });
  }

  const canonicalUrl = new URL(route, configuration.siteOrigin).toString();
  const destination = freezeDestination({
    destinationId: buildStableHash(
      [
        "web",
        input.locale,
        route,
        configuration.siteOrigin,
        configuration.deploymentTarget,
      ],
      "ipp_web_dest_",
    ),
    channel: "web",
    locale: input.locale,
    route,
    canonicalUrl,
    siteOrigin: configuration.siteOrigin,
    outputKind: resolveOutputKind(input.asset),
    templateId: input.asset.templateId ?? "unknown_template",
    rendererVersion: configuration.rendererVersion,
    deploymentTarget: configuration.deploymentTarget,
    metadata: freezeMetadata({
      assetType: input.asset.assetType,
      assetId: input.asset.assetId,
      ...(input.marketReportDefinition == null
        ? {}
        : { reportId: input.marketReportDefinition.reportId }),
      ...configuration.metadata,
    }),
  });

  const validation = validateWebPublicationDestination(destination);
  if (!validation.ok) {
    throw new WebPublisherError({
      code: "invalid_destination",
      destinationId: destination.destinationId,
      assetId: input.asset.assetId,
      assetVersionId: input.assetVersion.assetVersionId,
      message: validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }

  return validation.destination;
}

export function buildWebContentDescriptor(input: Readonly<{
  asset: RegistryAsset;
  assetVersion: RegistryAssetVersion;
  snapshot: RegistrySnapshot;
  destination: WebPublicationDestination;
  configuration: WebPublisherConfiguration;
  marketReportDefinition?: MarketReportDefinition | null;
}>): WebContentDescriptor {
  const title =
    input.marketReportDefinition?.title ??
    (isNonEmptyString((input.assetVersion.metadata as Record<string, unknown>).title)
      ? String((input.assetVersion.metadata as Record<string, unknown>).title)
      : input.asset.assetId);
  const slug =
    input.marketReportDefinition?.slug ??
    (isNonEmptyString(input.asset.canonicalId) ? input.asset.canonicalId : input.asset.assetId);
  const rendererFingerprint = buildRendererFingerprint({
    templateId: input.asset.templateId ?? "unknown_template",
    rendererVersion: input.configuration.rendererVersion,
    locale: input.destination.locale,
    assetType: input.asset.assetType,
  });
  const currentPublication =
    resolveMatchingPublication(
      listRegistryPublicationsForAsset(
        input.snapshot,
        input.asset.assetId,
        input.assetVersion.assetVersionId,
      ),
      input.assetVersion.assetVersionId,
      input.destination.locale,
    ) ?? null;

  const descriptor = freezeDescriptor({
    assetId: input.asset.assetId,
    assetVersionId: input.assetVersion.assetVersionId,
    assetType: input.asset.assetType,
    locale: input.destination.locale,
    title,
    slug,
    route: input.destination.route,
    templateId: input.asset.templateId ?? "unknown_template",
    contentFingerprint: input.assetVersion.contentFingerprint,
    sourceFingerprint: input.assetVersion.sourceFingerprint,
    rendererFingerprint,
    policyVersions: sortStringRecord(input.assetVersion.policyVersions),
    publicationStatus: currentPublication?.status ?? "unpublished",
    publishedAt: currentPublication?.publishedAt ?? null,
    metadata: freezeMetadata({
      marketCellKey:
        input.marketReportDefinition?.marketCellKey ??
        ((input.asset.metadata as Record<string, unknown>).marketCellKey as string | undefined) ??
        null,
      country:
        input.marketReportDefinition?.country ??
        ((input.asset.metadata as Record<string, unknown>).country as string | undefined) ??
        null,
      city:
        input.marketReportDefinition?.city ??
        ((input.asset.metadata as Record<string, unknown>).city as string | undefined) ??
        null,
      platform:
        input.marketReportDefinition?.platform ??
        ((input.asset.metadata as Record<string, unknown>).platform as string | undefined) ??
        null,
      propertyType:
        input.marketReportDefinition?.propertyType ??
        ((input.asset.metadata as Record<string, unknown>).propertyType as string | undefined) ??
        null,
    }),
  });

  const validation = validateWebContentDescriptor(descriptor);
  if (!validation.ok) {
    throw new WebPublisherError({
      code: "invalid_command",
      assetId: descriptor.assetId,
      assetVersionId: descriptor.assetVersionId,
      message: validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }

  return validation.descriptor;
}

export function buildTargetWebPublicationFingerprint(input: Readonly<{
  assetId: string;
  assetVersionId: string;
  contentFingerprint: string;
  rendererFingerprint: string;
  locale: string;
  route: string;
  templateId: string;
  policyVersions: Readonly<Record<string, string>>;
}>): string {
  return buildStableHash(
    [
      input.assetId,
      input.assetVersionId,
      input.contentFingerprint,
      input.rendererFingerprint,
      input.locale,
      input.route,
      input.templateId,
      JSON.stringify(sortStringRecord(input.policyVersions)),
    ],
    "ipp_web_pub_fp_",
  );
}

export function deriveNextWebPublicationState(input: Readonly<{
  action: WebPublicationAction;
  current: RegistryPublicationState | null;
  assetVersionId: string;
  locale: string;
  destination: WebPublicationDestination;
  targetPublicationFingerprint: string | null;
  now: string;
}>): RegistryPublicationState {
  const current = input.current;
  const base = {
    assetId: current?.assetId ?? "",
    assetVersionId: input.assetVersionId,
    locale: input.locale,
    channel: input.destination.channel,
    destinationKey: input.destination.canonicalUrl,
    publishedAt: current?.publishedAt ?? null,
    suppressedAt: current?.suppressedAt ?? null,
    metadata: freezeMetadata({
      plannedAction: input.action,
    }),
  };

  switch (input.action) {
    case "publish":
    case "republish":
      return Object.freeze({
        ...base,
        status: "publishing" as const,
        publicationFingerprint: input.targetPublicationFingerprint,
        suppressedAt: null,
      });
    case "suppress":
      return Object.freeze({
        ...base,
        status: "suppressed" as const,
        publicationFingerprint: current?.publicationFingerprint ?? null,
      });
    case "rollback":
      return Object.freeze({
        ...base,
        status: "rolled_back" as const,
        publicationFingerprint:
          input.targetPublicationFingerprint ??
          current?.publicationFingerprint ??
          null,
      });
    case "update_metadata":
      return Object.freeze({
        ...base,
        status: current?.status ?? "unpublished",
        publicationFingerprint:
          input.targetPublicationFingerprint ??
          current?.publicationFingerprint ??
          null,
      });
    case "update_freshness":
      return Object.freeze({
        ...base,
        status: current?.status ?? "unpublished",
        publicationFingerprint:
          current?.publicationFingerprint ??
          input.targetPublicationFingerprint ??
          null,
      });
  }
}

function buildWebPublicationCommandId(input: Readonly<{
  executionPlanId: string;
  jobId: string;
  action: WebPublicationAction;
  assetId: string;
  assetVersionId: string;
  destinationId: string;
  targetPublicationFingerprint: string | null;
  commandVersion: number;
}>): string {
  return buildStableHash(
    [
      input.executionPlanId,
      input.jobId,
      input.action,
      input.assetId,
      input.assetVersionId,
      input.destinationId,
      input.targetPublicationFingerprint ?? "",
      String(input.commandVersion),
    ],
    "ipp_web_cmd_",
  );
}

function buildWebPublicationIdempotencyKey(input: Readonly<{
  executionPlanId: string;
  jobId: string;
  action: WebPublicationAction;
  destinationId: string;
  targetPublicationFingerprint: string | null;
}>): string {
  return buildStableHash(
    [
      input.executionPlanId,
      input.jobId,
      input.action,
      input.destinationId,
      input.targetPublicationFingerprint ?? "",
    ],
    "ipp_web_idem_",
  );
}

function selectCoordinationRequirement(
  executionPlan: ExecutionPlan,
  job: Job,
): ExecutionCoordinationRequirement {
  const relevant = executionPlan.coordinationRequirements.filter(
    (requirement) =>
      requirement.requiredBeforeJobIds.includes(job.jobId) ||
      requirement.releaseAfterJobIds.includes(job.jobId),
  );

  const preferred = relevant.find(
    (requirement) => requirement.resourceType === "publication_destination",
  );
  const fallback =
    preferred ??
    relevant.find((requirement) => requirement.resourceType === "asset_version") ??
    relevant.find((requirement) => requirement.resourceType === "asset") ??
    relevant.find((requirement) => requirement.resourceType === "job") ??
    null;

  if (fallback == null) {
    throw new WebPublisherError({
      code: "missing_coordination_requirement",
      executionPlanId: executionPlan.executionPlanId,
      jobId: job.jobId,
      assetId: job.assetId ?? undefined,
      assetVersionId: job.assetVersionId ?? undefined,
      message: `No coordination requirement was found for job ${job.jobId}.`,
    });
  }

  return fallback;
}

function buildFencingRequirement(
  coordinationRequirement: ExecutionCoordinationRequirement,
): WebPublicationFencingRequirement {
  const requirement = freezeFencingRequirement({
    lockKey: coordinationRequirement.lockKey,
    resourceType: coordinationRequirement.resourceType,
    resourceId: coordinationRequirement.resourceId,
    requiredOwnerScope: coordinationRequirement.ownerScope,
    minimumFencingToken: 1,
    validationRequiredBeforeWrite: true,
  });

  if (!isNonEmptyString(requirement.lockKey) || !isNonEmptyString(requirement.resourceId)) {
    throw new WebPublisherError({
      code: "invalid_fencing_requirement",
      message: "The derived fencing requirement is invalid.",
    });
  }

  return requirement;
}

function buildPreconditions(input: Readonly<{
  action: WebPublicationAction;
  executionPlan: ExecutionPlan;
  asset: RegistryAsset;
  assetVersion: RegistryAssetVersion;
  locale: string;
  destination: WebPublicationDestination;
  currentPublicationState: RegistryPublicationState | null;
}>): readonly WebPublicationPrecondition[] {
  const assetIsPublishable = isRegistryAssetPublishable(
    normalizeRegistrySnapshot(
      parseRegistrySnapshot({
        snapshotId: "tmp",
        snapshotVersion: 1,
        generatedAt: input.executionPlan.createdAt,
        assets: [input.asset],
        assetVersions: [input.assetVersion],
        artifactReferences: [],
        channelVariants: [],
        freshnessStates: [],
        publicationStates: input.currentPublicationState == null ? [] : [input.currentPublicationState],
        policyVersions: input.assetVersion.policyVersions,
        metadata: {},
      }),
    ),
    input.asset.assetId,
  );

  const preconditions: WebPublicationPrecondition[] = [
    {
      type: "asset_exists",
      required: true,
      expectedValue: true,
      source: "registry",
      reason: "The asset must exist before a web publication command can run.",
      metadata: {},
    },
    {
      type: "version_exists",
      required: true,
      expectedValue: true,
      source: "registry",
      reason: "The asset version must exist before publishing.",
      metadata: {},
    },
    {
      type: "version_is_active",
      required: true,
      expectedValue: true,
      source: "registry",
      reason: "The targeted asset version must remain active.",
      metadata: {
        activeVersionId: input.asset.activeVersionId,
      },
    },
    {
      type: "version_is_approved",
      required: input.action !== "suppress" && input.action !== "rollback",
      expectedValue: true,
      source: "registry",
      reason: "Only approved versions may be published or refreshed on the web.",
      metadata: {},
    },
    {
      type: "asset_is_publishable",
      required: input.action !== "suppress" && input.action !== "rollback",
      expectedValue: true,
      source: "registry",
      reason: "The asset must remain publishable for web writes.",
      metadata: {
        currentValue: assetIsPublishable,
      },
    },
    {
      type: "destination_matches_locale",
      required: true,
      expectedValue: input.locale,
      source: "destination",
      reason: "The resolved destination locale must match the planned locale.",
      metadata: {},
    },
    {
      type: "destination_matches_channel",
      required: true,
      expectedValue: "web",
      source: "destination",
      reason: "This publisher only handles the web channel.",
      metadata: {},
    },
    {
      type: "publication_fingerprint_matches",
      required:
        input.currentPublicationState?.publicationFingerprint != null &&
        ["republish", "suppress", "rollback", "update_metadata"].includes(
          input.action,
        ),
      expectedValue: input.currentPublicationState?.publicationFingerprint ?? null,
      source: "registry",
      reason:
        "The current publication fingerprint must still match before applying the command.",
      metadata: {},
    },
    {
      type: "no_newer_version_active",
      required: true,
      expectedValue: true,
      source: "registry",
      reason:
        "A newer active version must not replace the target between planning and write time.",
      metadata: {
        activeVersionId: input.asset.activeVersionId,
      },
    },
    {
      type: "fencing_token_valid",
      required: true,
      expectedValue: true,
      source: "coordination",
      reason:
        "A future infrastructure adapter must validate the fencing token before writing.",
      metadata: {},
    },
    {
      type: "human_review_completed",
      required: input.executionPlan.governanceSummary.blockedUntilReview,
      expectedValue: true,
      source: "execution_plan",
      reason:
        "Human review must be completed before web publication may proceed.",
      metadata: {},
    },
    {
      type: "immediate_suppression_required",
      required:
        input.action === "suppress" &&
        input.executionPlan.governanceSummary.requiresImmediateSuppression,
      expectedValue: true,
      source: "execution_plan",
      reason:
        "This command exists because the execution plan requires immediate suppression.",
      metadata: {},
    },
  ];

  return Object.freeze(preconditions.map(freezePrecondition));
}

function buildInvalidationHints(input: Readonly<{
  asset: RegistryAsset;
  destination: WebPublicationDestination;
}>): readonly WebInvalidationHint[] {
  const metadata = input.asset.metadata as Record<string, unknown>;
  const hints: WebInvalidationHint[] = [
    {
      type: "route",
      key: input.destination.route,
      reason: "The canonical route may need revalidation after a planned write.",
    },
    {
      type: "canonical_url",
      key: input.destination.canonicalUrl,
      reason: "The canonical URL may need cache invalidation.",
    },
    {
      type: "sitemap",
      key: "sitemap:web",
      reason: "Sitemaps may need updating after a web publication change.",
    },
    {
      type: "structured_data",
      key: input.destination.route,
      reason: "Structured data associated with the route may change.",
    },
    {
      type: "locale_index",
      key: input.destination.locale,
      reason: "Locale indexes may reference the route.",
    },
    {
      type: "cache_tag",
      key: input.asset.assetId,
      reason: "The asset cache tag should be invalidated by future adapters.",
    },
  ];

  if (isNonEmptyString(metadata.marketCellKey)) {
    hints.push({
      type: "market_index",
      key: String(metadata.marketCellKey),
      reason: "Market indexes may include the published asset.",
    });
  }

  return Object.freeze(
    hints
      .map(freezeHint)
      .sort((left, right) =>
        compareStrings(`${left.type}:${left.key}`, `${right.type}:${right.key}`),
      ),
  );
}

function ensureCompatibleJob(job: Job): WebPublicationAction {
  const action = job.action as string;
  if (!WEB_PUBLICATION_ACTIONS.includes(action as WebPublicationAction)) {
    throw new WebPublisherError({
      code: "incompatible_job",
      jobId: job.jobId,
      assetId: job.assetId ?? undefined,
      assetVersionId: job.assetVersionId ?? undefined,
      message: `Job action ${job.action} is not compatible with the Web Publisher.`,
    });
  }
  return action as WebPublicationAction;
}

function commandJobIsInPlan(executionPlan: ExecutionPlan, jobId: string): boolean {
  return executionPlan.jobs.some((candidate) => candidate.jobId === jobId);
}

function resolveMarketReportDefinition(
  assetId: string,
  definitionsByAssetId:
    | Readonly<Record<string, MarketReportDefinition>>
    | undefined,
): MarketReportDefinition | null {
  return definitionsByAssetId?.[assetId] ?? null;
}

function validateCommandActionStateCompatibility(
  action: WebPublicationAction,
  currentState: RegistryPublicationState | null,
): void {
  if (
    (action === "suppress" || action === "rollback") &&
    currentState == null
  ) {
    throw new WebPublisherError({
      code: "missing_publication_state",
      message: `Action ${action} requires an existing publication state.`,
    });
  }
}

export function planWebPublicationCommand(
  input: PlanWebPublicationCommandInput,
): WebPublicationCommand {
  const registrySnapshot = normalizeRegistrySnapshot(
    parseRegistrySnapshot(input.registrySnapshot),
  );
  assertRegistrySnapshotPublicSafe(registrySnapshot);
  const job = parseJob(input.job);
  const action = ensureCompatibleJob(job);

  if (!commandJobIsInPlan(input.executionPlan, job.jobId)) {
    throw new WebPublisherError({
      code: "job_not_in_execution_plan",
      executionPlanId: input.executionPlan.executionPlanId,
      jobId: job.jobId,
      assetId: job.assetId ?? undefined,
      assetVersionId: job.assetVersionId ?? undefined,
      message: `Job ${job.jobId} does not belong to execution plan ${input.executionPlan.executionPlanId}.`,
    });
  }

  if (job.channel != null && job.channel !== "web") {
    throw new WebPublisherError({
      code: "unsupported_channel",
      executionPlanId: input.executionPlan.executionPlanId,
      jobId: job.jobId,
      assetId: job.assetId ?? undefined,
      assetVersionId: job.assetVersionId ?? undefined,
      message: `Job ${job.jobId} targets channel ${job.channel}, but the Web Publisher only supports web.`,
    });
  }

  if (job.assetId == null) {
    throw new WebPublisherError({
      code: "missing_asset",
      executionPlanId: input.executionPlan.executionPlanId,
      jobId: job.jobId,
      message: `Job ${job.jobId} does not reference an asset.`,
    });
  }

  const asset = getRegistryAsset(registrySnapshot, job.assetId);
  if (asset == null) {
    throw new WebPublisherError({
      code: "missing_asset",
      executionPlanId: input.executionPlan.executionPlanId,
      jobId: job.jobId,
      assetId: job.assetId,
      message: `Asset ${job.assetId} was not found in the registry snapshot.`,
    });
  }

  const assetVersionId = job.assetVersionId ?? asset.activeVersionId;
  if (!isNonEmptyString(assetVersionId)) {
    throw new WebPublisherError({
      code: "missing_version",
      executionPlanId: input.executionPlan.executionPlanId,
      jobId: job.jobId,
      assetId: asset.assetId,
      message: `No assetVersionId could be resolved for asset ${asset.assetId}.`,
    });
  }

  const assetVersion = getRegistryAssetVersion(registrySnapshot, assetVersionId);
  if (assetVersion == null) {
    throw new WebPublisherError({
      code: "missing_version",
      executionPlanId: input.executionPlan.executionPlanId,
      jobId: job.jobId,
      assetId: asset.assetId,
      assetVersionId,
      message: `Asset version ${assetVersionId} was not found in the registry snapshot.`,
    });
  }

  if (assetVersion.assetId !== asset.assetId) {
    throw new WebPublisherError({
      code: "inconsistent_asset_version",
      executionPlanId: input.executionPlan.executionPlanId,
      jobId: job.jobId,
      assetId: asset.assetId,
      assetVersionId: assetVersion.assetVersionId,
      message:
        `Asset version ${assetVersion.assetVersionId} does not belong to asset ${asset.assetId}.`,
    });
  }

  const variants = listRegistryVariantsForAsset(
    registrySnapshot,
    asset.assetId,
    assetVersion.assetVersionId,
  );
  const publications = listRegistryPublicationsForAsset(
    registrySnapshot,
    asset.assetId,
    assetVersion.assetVersionId,
  );
  const configuration = normalizeConfiguration(input.publisherConfiguration);
  const locale = resolveCurrentLocale(
    job,
    asset,
    variants,
    publications,
    configuration,
  );
  const variant = resolveMatchingVariant(variants, assetVersion.assetVersionId, locale);
  const currentPublicationState = resolveMatchingPublication(
    publications,
    assetVersion.assetVersionId,
    locale,
  );

  validateCommandActionStateCompatibility(action, currentPublicationState);

  const marketReportDefinition = resolveMarketReportDefinition(
    asset.assetId,
    input.marketReportDefinitionsByAssetId,
  );
  const destination = resolveWebPublicationDestination({
    asset,
    assetVersion,
    locale,
    configuration,
    variant,
    publicationState: currentPublicationState,
    marketReportDefinition,
  });

  const contentDescriptor =
    action === "suppress"
      ? null
      : buildWebContentDescriptor({
          asset,
          assetVersion,
          snapshot: registrySnapshot,
          destination,
          configuration,
          marketReportDefinition,
        });

  const targetPublicationFingerprint =
    contentDescriptor == null
      ? action === "rollback"
        ? currentPublicationState?.publicationFingerprint ?? null
        : null
      : buildTargetWebPublicationFingerprint({
          assetId: contentDescriptor.assetId,
          assetVersionId: contentDescriptor.assetVersionId,
          contentFingerprint: contentDescriptor.contentFingerprint,
          rendererFingerprint: contentDescriptor.rendererFingerprint,
          locale: contentDescriptor.locale,
          route: contentDescriptor.route,
          templateId: contentDescriptor.templateId,
          policyVersions: contentDescriptor.policyVersions,
        });

  const now = input.now();
  if (!isCanonicalIsoTimestamp(now)) {
    throw new WebPublisherError({
      code: "invalid_command",
      executionPlanId: input.executionPlan.executionPlanId,
      jobId: job.jobId,
      message: `Expected a canonical ISO timestamp, received ${now}.`,
    });
  }

  const nextPublicationState = deriveNextWebPublicationState({
    action,
    current: currentPublicationState,
    assetVersionId: assetVersion.assetVersionId,
    locale,
    destination,
    targetPublicationFingerprint,
    now,
  });

  const coordinationRequirement = selectCoordinationRequirement(
    input.executionPlan,
    job,
  );
  const fencingRequirement = buildFencingRequirement(coordinationRequirement);
  const preconditions = buildPreconditions({
    action,
    executionPlan: input.executionPlan,
    asset,
    assetVersion,
    locale,
    destination,
    currentPublicationState,
  });
  const invalidationHints = buildInvalidationHints({
    asset,
    destination,
  });

  const commandVersion = 1;
  const commandId = buildWebPublicationCommandId({
    executionPlanId: input.executionPlan.executionPlanId,
    jobId: job.jobId,
    action,
    assetId: asset.assetId,
    assetVersionId: assetVersion.assetVersionId,
    destinationId: destination.destinationId,
    targetPublicationFingerprint,
    commandVersion,
  });
  const idempotencyKey = buildWebPublicationIdempotencyKey({
    executionPlanId: input.executionPlan.executionPlanId,
    jobId: job.jobId,
    action,
    destinationId: destination.destinationId,
    targetPublicationFingerprint,
  });

  const command = freezeCommand({
    commandId,
    commandVersion,
    action,
    jobId: job.jobId,
    runId: job.runId,
    executionPlanId: input.executionPlan.executionPlanId,
    idempotencyKey,
    fencingRequirement,
    assetId: asset.assetId,
    assetVersionId: assetVersion.assetVersionId,
    destination,
    contentDescriptor,
    expectedCurrentPublicationFingerprint:
      currentPublicationState?.publicationFingerprint ?? null,
    targetPublicationFingerprint,
    previousPublicationState: currentPublicationState,
    nextPublicationState,
    preconditions,
    invalidationHints,
    createdAt: now,
    metadata: normalizeJsonMetadata({
      marketReportId: marketReportDefinition?.reportId ?? null,
      assetType: asset.assetType,
      ...(input.metadata ?? {}),
    }),
  });

  const validation = validateWebPublicationCommand(command);
  if (!validation.ok) {
    throw new WebPublisherError({
      code: "invalid_command",
      commandId: command.commandId,
      executionPlanId: command.executionPlanId,
      jobId: command.jobId,
      assetId: command.assetId,
      assetVersionId: command.assetVersionId,
      destinationId: command.destination.destinationId,
      message: validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }

  return validation.command;
}

export function planWebPublicationBatch(
  input: PlanWebPublicationBatchInput,
): WebPublicationBatch {
  const registrySnapshot = normalizeRegistrySnapshot(
    parseRegistrySnapshot(input.registrySnapshot),
  );
  assertRegistrySnapshotPublicSafe(registrySnapshot);
  const configuration = normalizeConfiguration(input.publisherConfiguration);
  const now = input.now();
  if (!isCanonicalIsoTimestamp(now)) {
    throw new WebPublisherError({
      code: "invalid_batch",
      executionPlanId: input.executionPlan.executionPlanId,
      message: `Expected a canonical ISO timestamp, received ${now}.`,
    });
  }

  const filters = input.filters;
  const allowedJobIds =
    filters?.jobIds == null ? null : new Set(filters.jobIds);
  const allowedActions =
    filters?.actions == null ? null : new Set(filters.actions);
  const allowedAssetIds =
    filters?.assetIds == null ? null : new Set(filters.assetIds);

  const orderedJobs = input.executionPlan.executionOrder
    .map((jobId) =>
      input.executionPlan.jobs.find((job) => job.jobId === jobId) ?? null,
    )
    .filter((job): job is Job => job != null);

  const commandsById = new Map<string, WebPublicationCommand>();
  const executionOrder: string[] = [];

  for (const rawJob of orderedJobs) {
    const action = rawJob.action as string;
    const isCompatible =
      WEB_PUBLICATION_ACTIONS.includes(action as WebPublicationAction) &&
      (rawJob.channel == null || rawJob.channel === "web");
    if (!isCompatible) {
      continue;
    }
    if (allowedJobIds != null && !allowedJobIds.has(rawJob.jobId)) {
      continue;
    }
    if (
      allowedActions != null &&
      !allowedActions.has(action as WebPublicationAction)
    ) {
      continue;
    }
    if (allowedAssetIds != null && rawJob.assetId != null && !allowedAssetIds.has(rawJob.assetId)) {
      continue;
    }

    const command = planWebPublicationCommand({
      executionPlan: input.executionPlan,
      job: rawJob,
      registrySnapshot,
      publisherConfiguration: configuration,
      now: () => now,
      marketReportDefinitionsByAssetId: input.marketReportDefinitionsByAssetId,
      metadata: input.metadata,
    });

    const existing = commandsById.get(command.commandId);
    if (existing != null) {
      if (
        canonicalizeForComparison(existing) !==
        canonicalizeForComparison(command)
      ) {
        throw new WebPublisherError({
          code: "duplicate_command_conflict",
          commandId: command.commandId,
          executionPlanId: command.executionPlanId,
          jobId: command.jobId,
          assetId: command.assetId,
          assetVersionId: command.assetVersionId,
          destinationId: command.destination.destinationId,
          message:
            `Command ${command.commandId} was produced multiple times with conflicting content.`,
        });
      }
      continue;
    }

    commandsById.set(command.commandId, command);
    executionOrder.push(command.commandId);
  }

  const commands = executionOrder.map((commandId) => commandsById.get(commandId)!);
  const batchVersion = 1;
  const batchId = buildStableHash(
    [
      input.executionPlan.executionPlanId,
      String(batchVersion),
      executionOrder.join(","),
    ],
    "ipp_web_batch_",
  );

  const batch = freezeBatch({
    batchId,
    batchVersion,
    executionPlanId: input.executionPlan.executionPlanId,
    commandIds: Object.freeze([...executionOrder]),
    commands: Object.freeze(commands),
    executionOrder: Object.freeze([...executionOrder]),
    estimatedWriteCount: commands.length,
    requiresReviewCompletion:
      commands.length > 0 &&
      input.executionPlan.governanceSummary.blockedUntilReview,
    containsImmediateSuppression:
      commands.some((command) => command.action === "suppress") ||
      (commands.length > 0 &&
        input.executionPlan.governanceSummary.requiresImmediateSuppression),
    createdAt: now,
    metadata: normalizeJsonMetadata({
      ...configuration.metadata,
      ...(input.metadata ?? {}),
    }),
  });

  const validation = validateWebPublicationBatch(batch);
  if (!validation.ok) {
    throw new WebPublisherError({
      code: "invalid_batch",
      executionPlanId: batch.executionPlanId,
      message: validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }

  return validation.batch;
}

export function validateWebPublicationDestination(
  input: unknown,
): WebPublicationDestinationValidationResult {
  const issues: WebPublicationDestinationValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a WebPublicationDestination object.",
        }),
      ]),
    };
  }

  const candidate = input as Partial<WebPublicationDestination>;
  for (const field of [
    "destinationId",
    "locale",
    "route",
    "canonicalUrl",
    "siteOrigin",
    "templateId",
    "rendererVersion",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected a non-empty string.",
      });
    }
  }
  if (candidate.channel !== "web") {
    issues.push({
      path: "channel",
      message: "Expected channel=web.",
    });
  }
  if (
    candidate.outputKind == null ||
    !WEB_OUTPUT_KINDS.includes(candidate.outputKind)
  ) {
    issues.push({
      path: "outputKind",
      message: `Expected one of: ${WEB_OUTPUT_KINDS.join(", ")}.`,
    });
  }
  if (
    candidate.deploymentTarget == null ||
    !WEB_DEPLOYMENT_TARGETS.includes(candidate.deploymentTarget)
  ) {
    issues.push({
      path: "deploymentTarget",
      message: `Expected one of: ${WEB_DEPLOYMENT_TARGETS.join(", ")}.`,
    });
  }
  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
    });
  } else {
    try {
      assertNoForbiddenPrivateKeys(candidate.metadata ?? {}, "metadata");
    } catch (error) {
      issues.push({
        path: "metadata",
        message: error instanceof Error ? error.message : "Forbidden private metadata.",
      });
    }
  }
  if (isNonEmptyString(candidate.route)) {
    if (!candidate.route.startsWith("/")) {
      issues.push({
        path: "route",
        message: "route must start with '/'.",
      });
    }
    if (candidate.route.includes("?") || candidate.route.includes("#")) {
      issues.push({
        path: "route",
        message: "route cannot include a query string or hash.",
      });
    }
    if (candidate.route !== normalizeRoute(candidate.route)) {
      issues.push({
        path: "route",
        message: "route must be normalized without double slashes or trailing slash.",
      });
    }
  }
  if (isNonEmptyString(candidate.canonicalUrl)) {
    if (!isAbsoluteUrl(candidate.canonicalUrl)) {
      issues.push({
        path: "canonicalUrl",
        message: "canonicalUrl must be absolute.",
      });
    } else {
      const parsed = new URL(candidate.canonicalUrl);
      if (parsed.search !== "" || parsed.hash !== "") {
        issues.push({
          path: "canonicalUrl",
          message: "canonicalUrl cannot include a query string or hash.",
        });
      }
      if (isNonEmptyString(candidate.route) && parsed.pathname !== candidate.route) {
        issues.push({
          path: "canonicalUrl",
          message: "canonicalUrl pathname must match route.",
        });
      }
    }
  }
  if (isNonEmptyString(candidate.siteOrigin)) {
    if (!isAbsoluteUrl(candidate.siteOrigin)) {
      issues.push({
        path: "siteOrigin",
        message: "siteOrigin must be absolute.",
      });
    } else {
      const parsed = new URL(candidate.siteOrigin);
      if (parsed.origin !== candidate.siteOrigin) {
        issues.push({
          path: "siteOrigin",
          message: "siteOrigin must be an origin without path, search or hash.",
        });
      }
      if (isNonEmptyString(candidate.canonicalUrl)) {
        const canonical = new URL(candidate.canonicalUrl);
        if (canonical.origin !== candidate.siteOrigin) {
          issues.push({
            path: "canonicalUrl",
            message: "canonicalUrl must share the same origin as siteOrigin.",
          });
        }
      }
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    destination: freezeDestination(candidate as WebPublicationDestination),
  };
}

export function validateWebContentDescriptor(
  input: unknown,
): WebContentDescriptorValidationResult {
  const issues: WebContentDescriptorValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a WebContentDescriptor object.",
        }),
      ]),
    };
  }
  const candidate = input as Partial<WebContentDescriptor>;
  for (const field of [
    "assetId",
    "assetVersionId",
    "assetType",
    "locale",
    "title",
    "slug",
    "route",
    "templateId",
    "contentFingerprint",
    "sourceFingerprint",
    "rendererFingerprint",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected a non-empty string.",
      });
    }
  }
  if (!isNonEmptyString(candidate.route) || !candidate.route.startsWith("/")) {
    issues.push({
      path: "route",
      message: "route must start with '/'.",
    });
  }
  if (
    candidate.publicationStatus == null ||
    ![
      "unpublished",
      "scheduled",
      "publishing",
      "published",
      "failed",
      "suppressed",
      "rolled_back",
    ].includes(candidate.publicationStatus)
  ) {
    issues.push({
      path: "publicationStatus",
      message: "Invalid publicationStatus.",
    });
  }
  if (
    candidate.publishedAt != null &&
    (!isNonEmptyString(candidate.publishedAt) ||
      !isCanonicalIsoTimestamp(candidate.publishedAt))
  ) {
    issues.push({
      path: "publishedAt",
      message: "publishedAt must be a canonical ISO timestamp when present.",
    });
  }
  if (
    typeof candidate.policyVersions !== "object" ||
    candidate.policyVersions == null ||
    Array.isArray(candidate.policyVersions)
  ) {
    issues.push({
      path: "policyVersions",
      message: "Expected a policyVersions object.",
    });
  }
  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
    });
  } else {
    try {
      assertNoForbiddenPrivateKeys(candidate.metadata ?? {}, "metadata");
    } catch (error) {
      issues.push({
        path: "metadata",
        message: error instanceof Error ? error.message : "Forbidden private metadata.",
      });
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    descriptor: freezeDescriptor(candidate as WebContentDescriptor),
  };
}

export function validateWebPublicationCommand(
  input: unknown,
): WebPublicationCommandValidationResult {
  const issues: WebPublicationCommandValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a WebPublicationCommand object.",
        }),
      ]),
    };
  }

  const candidate = input as Partial<WebPublicationCommand>;
  for (const field of [
    "commandId",
    "jobId",
    "runId",
    "executionPlanId",
    "idempotencyKey",
    "assetId",
    "assetVersionId",
    "createdAt",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected a non-empty string.",
      });
    }
  }
  if (
    !Number.isInteger(candidate.commandVersion) ||
    Number(candidate.commandVersion) < 1
  ) {
    issues.push({
      path: "commandVersion",
      message: "Expected commandVersion >= 1.",
    });
  }
  if (
    candidate.action == null ||
    !WEB_PUBLICATION_ACTIONS.includes(candidate.action)
  ) {
    issues.push({
      path: "action",
      message: `Expected one of: ${WEB_PUBLICATION_ACTIONS.join(", ")}.`,
    });
  }
  if (
    !isNonEmptyString(candidate.createdAt) ||
    !isCanonicalIsoTimestamp(candidate.createdAt)
  ) {
    issues.push({
      path: "createdAt",
      message: "createdAt must be a canonical ISO timestamp.",
    });
  }
  const destinationValidation = validateWebPublicationDestination(
    candidate.destination,
  );
  if (!destinationValidation.ok) {
    for (const issue of destinationValidation.issues) {
      issues.push({
        path: `destination.${issue.path}`,
        message: issue.message,
      });
    }
  }
  if (candidate.contentDescriptor != null) {
    const descriptorValidation = validateWebContentDescriptor(
      candidate.contentDescriptor,
    );
    if (!descriptorValidation.ok) {
      for (const issue of descriptorValidation.issues) {
        issues.push({
          path: `contentDescriptor.${issue.path}`,
          message: issue.message,
        });
      }
    } else {
      if (descriptorValidation.descriptor.assetId !== candidate.assetId) {
        issues.push({
          path: "contentDescriptor.assetId",
          message: "contentDescriptor.assetId must match command.assetId.",
        });
      }
      if (
        descriptorValidation.descriptor.assetVersionId !==
        candidate.assetVersionId
      ) {
        issues.push({
          path: "contentDescriptor.assetVersionId",
          message:
            "contentDescriptor.assetVersionId must match command.assetVersionId.",
        });
      }
      if (
        destinationValidation.ok &&
        descriptorValidation.descriptor.locale !== destinationValidation.destination.locale
      ) {
        issues.push({
          path: "contentDescriptor.locale",
          message: "contentDescriptor.locale must match destination.locale.",
        });
      }
    }
  }
  if (
    candidate.fencingRequirement == null ||
    typeof candidate.fencingRequirement !== "object" ||
    Array.isArray(candidate.fencingRequirement)
  ) {
    issues.push({
      path: "fencingRequirement",
      message: "Expected a fencingRequirement object.",
    });
  } else {
    const fencing = candidate.fencingRequirement as WebPublicationFencingRequirement;
    for (const field of [
      "lockKey",
      "resourceType",
      "resourceId",
      "requiredOwnerScope",
    ] as const) {
      if (!isNonEmptyString(fencing[field])) {
        issues.push({
          path: `fencingRequirement.${field}`,
          message: "Expected a non-empty string.",
        });
      }
    }
    if (
      !Number.isInteger(fencing.minimumFencingToken) ||
      fencing.minimumFencingToken < 1
    ) {
      issues.push({
        path: "fencingRequirement.minimumFencingToken",
        message: "minimumFencingToken must be an integer >= 1.",
      });
    }
  }
  if (!Array.isArray(candidate.preconditions)) {
    issues.push({
      path: "preconditions",
      message: "Expected a preconditions array.",
    });
  } else {
    for (let index = 0; index < candidate.preconditions.length; index += 1) {
      const precondition = candidate.preconditions[index] as WebPublicationPrecondition;
      if (
        precondition == null ||
        typeof precondition !== "object" ||
        Array.isArray(precondition)
      ) {
        issues.push({
          path: `preconditions.${index}`,
          message: "Expected a precondition object.",
        });
        continue;
      }
      if (!WEB_PUBLICATION_PRECONDITION_TYPES.includes(precondition.type)) {
        issues.push({
          path: `preconditions.${index}.type`,
          message: "Invalid precondition type.",
        });
      }
      if (typeof precondition.required !== "boolean") {
        issues.push({
          path: `preconditions.${index}.required`,
          message: "required must be a boolean.",
        });
      }
      if (!isNonEmptyString(precondition.reason)) {
        issues.push({
          path: `preconditions.${index}.reason`,
          message: "reason must be a non-empty string.",
        });
      }
      if (!isJsonSafe(precondition.metadata)) {
        issues.push({
          path: `preconditions.${index}.metadata`,
          message: "metadata must be JSON-safe.",
        });
      }
    }
  }
  if (!Array.isArray(candidate.invalidationHints)) {
    issues.push({
      path: "invalidationHints",
      message: "Expected an invalidationHints array.",
    });
  } else {
    for (let index = 0; index < candidate.invalidationHints.length; index += 1) {
      const hint = candidate.invalidationHints[index] as WebInvalidationHint;
      if (hint == null || typeof hint !== "object" || Array.isArray(hint)) {
        issues.push({
          path: `invalidationHints.${index}`,
          message: "Expected an invalidation hint object.",
        });
        continue;
      }
      if (!WEB_INVALIDATION_HINT_TYPES.includes(hint.type)) {
        issues.push({
          path: `invalidationHints.${index}.type`,
          message: "Invalid invalidation hint type.",
        });
      }
      if (!isNonEmptyString(hint.key)) {
        issues.push({
          path: `invalidationHints.${index}.key`,
          message: "key must be a non-empty string.",
        });
      }
      if (!isNonEmptyString(hint.reason)) {
        issues.push({
          path: `invalidationHints.${index}.reason`,
          message: "reason must be a non-empty string.",
        });
      }
    }
  }
  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
    });
  } else {
    try {
      assertNoForbiddenPrivateKeys(candidate.metadata ?? {}, "metadata");
    } catch (error) {
      issues.push({
        path: "metadata",
        message: error instanceof Error ? error.message : "Forbidden private metadata.",
      });
    }
  }
  if (candidate.action === "suppress" && candidate.contentDescriptor != null) {
    issues.push({
      path: "contentDescriptor",
      message: "contentDescriptor must be null for suppress commands.",
    });
  }
  if (
    candidate.action !== "suppress" &&
    candidate.contentDescriptor == null
  ) {
    issues.push({
      path: "contentDescriptor",
      message: "contentDescriptor is required for non-suppress commands.",
    });
  }
  if (
    candidate.action === "publish" ||
    candidate.action === "republish"
  ) {
    if (candidate.nextPublicationState?.status !== "publishing") {
      issues.push({
        path: "nextPublicationState.status",
        message: "publish/republish commands must target status=publishing.",
      });
    }
  }
  if (
    candidate.action === "suppress" &&
    candidate.nextPublicationState?.status !== "suppressed"
  ) {
    issues.push({
      path: "nextPublicationState.status",
      message: "suppress commands must target status=suppressed.",
    });
  }
  if (
    candidate.action === "rollback" &&
    candidate.nextPublicationState?.status !== "rolled_back"
  ) {
    issues.push({
      path: "nextPublicationState.status",
      message: "rollback commands must target status=rolled_back.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    command: freezeCommand(candidate as WebPublicationCommand),
  };
}

export function validateWebPublicationBatch(
  input: unknown,
): WebPublicationBatchValidationResult {
  const issues: WebPublicationBatchValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a WebPublicationBatch object.",
        }),
      ]),
    };
  }
  const candidate = input as Partial<WebPublicationBatch>;
  for (const field of ["batchId", "executionPlanId", "createdAt"] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected a non-empty string.",
      });
    }
  }
  if (
    !Number.isInteger(candidate.batchVersion) ||
    Number(candidate.batchVersion) < 1
  ) {
    issues.push({
      path: "batchVersion",
      message: "Expected batchVersion >= 1.",
    });
  }
  if (
    !isNonEmptyString(candidate.createdAt) ||
    !isCanonicalIsoTimestamp(candidate.createdAt)
  ) {
    issues.push({
      path: "createdAt",
      message: "createdAt must be a canonical ISO timestamp.",
    });
  }
  if (!Array.isArray(candidate.commands)) {
    issues.push({
      path: "commands",
      message: "Expected a commands array.",
    });
  }
  if (!Array.isArray(candidate.commandIds)) {
    issues.push({
      path: "commandIds",
      message: "Expected a commandIds array.",
    });
  }
  if (!Array.isArray(candidate.executionOrder)) {
    issues.push({
      path: "executionOrder",
      message: "Expected an executionOrder array.",
    });
  }
  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
    });
  }

  const commands = Array.isArray(candidate.commands)
    ? candidate.commands.map((command) => validateWebPublicationCommand(command))
    : [];
  commands.forEach((result, index) => {
    if (!result.ok) {
      result.issues.forEach((issue) =>
        issues.push({
          path: `commands.${index}.${issue.path}`,
          message: issue.message,
        }),
      );
    }
  });

  if (
    Array.isArray(candidate.commands) &&
    Array.isArray(candidate.commandIds) &&
    Array.isArray(candidate.executionOrder)
  ) {
    const validCommands = commands
      .filter((result): result is Extract<typeof result, { ok: true }> => result.ok)
      .map((result) => result.command);
    const commandIds = validCommands.map((command) => command.commandId);
    if (candidate.commandIds.length !== validCommands.length) {
      issues.push({
        path: "commandIds",
        message: "commandIds length must match commands length.",
      });
    }
    const uniqueCommandIds = new Set(candidate.commandIds);
    if (uniqueCommandIds.size !== candidate.commandIds.length) {
      issues.push({
        path: "commandIds",
        message: "commandIds cannot contain duplicates.",
      });
    }
    if (JSON.stringify(candidate.commandIds) !== JSON.stringify(commandIds)) {
      issues.push({
        path: "commandIds",
        message: "commandIds must match commands order.",
      });
    }
    if (JSON.stringify(candidate.executionOrder) !== JSON.stringify(commandIds)) {
      issues.push({
        path: "executionOrder",
        message: "executionOrder must match the canonical command order.",
      });
    }
    if (candidate.estimatedWriteCount !== validCommands.length) {
      issues.push({
        path: "estimatedWriteCount",
        message: "estimatedWriteCount must equal commands.length.",
      });
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    batch: freezeBatch(candidate as WebPublicationBatch),
  };
}

export const WEB_PUBLICATION_MODES = Object.freeze([
  "canonical_only",
  "canonical_with_legacy_alias",
] as const);

export type WebPublicationMode = (typeof WEB_PUBLICATION_MODES)[number];

export type WebPublicationTarget = Readonly<{
  channel: "web";
  baseUrl: string;
  locale: string;
  environment: WebDeploymentTarget;
  publicationMode: WebPublicationMode;
  defaultLocale: string;
  localizedRouteStrategy: LocalizedRouteStrategy;
  metadata: CoordinationJsonObject;
}>;

export type WebPublicationPolicy = Readonly<{
  allowPartialReports: boolean;
  allowStaleReports: boolean;
  includeInSitemap: boolean;
  enableLegacyAliases: boolean;
  requireCanonicalUrl: boolean;
  allowedChangeTypes: readonly MarketReportChangeType[];
  minimumConfidence: RegistryConfidenceBand | "unknown";
  indexPartialReports: boolean;
  indexStaleReports: boolean;
  metadata: CoordinationJsonObject;
}>;

export const WEB_ROUTE_ALIAS_TYPES = Object.freeze([
  "legacy_short_slug",
  "historical_static_route",
  "preferred_market_report",
  "redirect_candidate",
] as const);

export type WebRouteAliasType = (typeof WEB_ROUTE_ALIAS_TYPES)[number];

export const WEB_ROUTE_ALIAS_STATUSES = Object.freeze([
  "candidate",
  "blocked",
  "legacy_static",
] as const);

export type WebRouteAliasStatus = (typeof WEB_ROUTE_ALIAS_STATUSES)[number];

export type WebRouteIdentity = Readonly<{
  routeKey: string;
  slug: string;
  pathname: string;
  absoluteUrl: string;
  canonicalPath: string;
  canonicalUrl: string;
  locale: string;
  platform: string;
  city: string;
  propertyType: string;
  isLegacySlug: boolean;
  fingerprint: string;
}>;

export type WebRouteAlias = Readonly<{
  aliasKey: string;
  fromPath: string;
  toPath: string;
  aliasType: WebRouteAliasType;
  status: WebRouteAliasStatus;
  reason: string;
  fingerprint: string;
}>;

export type WebRouteConflict = Readonly<{
  path: string;
  conflictingReportId: string | null;
  reason: string;
}>;

export const WEB_PUBLICATION_DIAGNOSTIC_CODES = Object.freeze([
  "publication_created",
  "publication_unchanged",
  "publication_updated",
  "publication_skipped",
  "route_resolved",
  "legacy_alias_created",
  "legacy_alias_conflict",
  "canonical_missing",
  "canonical_conflict",
  "route_conflict",
  "partial_report_blocked",
  "stale_report_blocked",
  "invalid_report_blocked",
  "sitemap_entry_created",
  "sitemap_entry_skipped",
  "noindex_applied",
  "unsupported_locale",
  "private_field_detected",
  "invalid_page_model",
  "invalid_seo_model",
  "invalid_manifest",
  "runtime_job_created",
] as const);

export type WebPublicationDiagnosticCode =
  (typeof WEB_PUBLICATION_DIAGNOSTIC_CODES)[number];

export type WebPublicationDiagnosticSeverity = "info" | "warning" | "error";

export type WebPublicationDiagnostic = Readonly<{
  code: WebPublicationDiagnosticCode;
  severity: WebPublicationDiagnosticSeverity;
  message: string;
  reportId: string | null;
  routeKey: string | null;
  path: string | null;
  metadata: CoordinationJsonObject;
}>;

export type WebRouteResolution = Readonly<{
  canonical: WebRouteIdentity;
  aliases: readonly WebRouteAlias[];
  conflict: WebRouteConflict | null;
  diagnostics: readonly WebPublicationDiagnostic[];
}>;

export const WEB_PUBLICATION_DECISION_TYPES = Object.freeze([
  "publish",
  "publish_with_warning",
  "skip_unchanged",
  "skip_partial",
  "skip_stale",
  "skip_invalid",
  "alias_candidate",
  "route_conflict",
] as const);

export type WebPublicationDecisionType =
  (typeof WEB_PUBLICATION_DECISION_TYPES)[number];

export type WebPublicationDecision = Readonly<{
  decisionType: WebPublicationDecisionType;
  reason: string;
  allowsPublication: boolean;
  requiresNoindex: boolean;
  diagnostics: readonly WebPublicationDiagnostic[];
}>;

export const WEB_MANIFEST_PUBLICATION_MODES = Object.freeze([
  "publish",
  "publish_with_warning",
  "block",
] as const);

export type WebManifestPublicationMode =
  (typeof WEB_MANIFEST_PUBLICATION_MODES)[number];

export const WEB_MANIFEST_COMPLETENESS_STATES = Object.freeze([
  "complete_report",
  "partial_report",
] as const);

export type WebManifestCompletenessState =
  (typeof WEB_MANIFEST_COMPLETENESS_STATES)[number];

export const WEB_MANIFEST_ROUTE_EXPOSURES = Object.freeze([
  "canonical",
  "none",
] as const);

export type WebManifestRouteExposure =
  (typeof WEB_MANIFEST_ROUTE_EXPOSURES)[number];

export type WebPublicationContract = Readonly<{
  publicationMode: WebManifestPublicationMode;
  completeness: WebManifestCompletenessState;
  renderable: boolean;
  indexable: boolean;
  sitemapEligible: boolean;
  routeExposure: WebManifestRouteExposure;
  canonicalPath: string;
  canonicalUrl: string;
  blockedReasons: readonly string[];
  warningReasons: readonly string[];
  policyFingerprint: string;
}>;

export type WebPageModel = Readonly<{
  route: string;
  title: string;
  description: string;
  heading: string;
  introduction: string;
  sections: readonly MarketReportSection[];
  facts: readonly Readonly<Record<string, unknown>>[];
  tables: readonly CoordinationJsonObject[];
  chartsData: readonly CoordinationJsonObject[];
  methodology: Readonly<Record<string, unknown>> | null;
  sources: readonly string[];
  disclaimers: readonly string[];
  callouts: readonly string[];
  freshness: Readonly<Record<string, unknown>> | null;
  confidence: Readonly<Record<string, unknown>> | null;
  generatedAt: string;
  modifiedAt: string;
  contentFingerprint: string;
  metadata: CoordinationJsonObject;
}>;

export type WebSeoModel = Readonly<{
  title: string;
  description: string;
  canonical: string | null;
  alternates: Readonly<Record<string, string>>;
  robots: CoordinationJsonObject;
  openGraph: CoordinationJsonObject;
  structuredData: CoordinationJsonObject;
  datePublished: string;
  dateModified: string;
  contentFingerprint: string;
}>;

export const WEB_SITEMAP_CHANGE_FREQUENCIES = Object.freeze([
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const);

export type WebSitemapChangeFrequency =
  (typeof WEB_SITEMAP_CHANGE_FREQUENCIES)[number];

export type WebSitemapEntry = Readonly<{
  url: string;
  lastModified: string;
  changeFrequency: WebSitemapChangeFrequency;
  priority: number;
  locale: string;
  contentFingerprint: string;
}>;

export const WEB_PUBLICATION_CHANGE_TYPES = Object.freeze([
  "new_publication",
  "unchanged_publication",
  "updated_publication",
  "route_changed",
  "seo_changed",
  "content_changed",
  "policy_changed",
  "skipped_publication",
] as const);

export type WebPublicationChangeType =
  (typeof WEB_PUBLICATION_CHANGE_TYPES)[number];

export type WebPublicationChangedComponent =
  | "route"
  | "seo"
  | "content"
  | "aliases"
  | "policy"
  | "decision"
  | "sitemap";

export type WebPublicationChange = Readonly<{
  changeType: WebPublicationChangeType;
  previousFingerprint: string | null;
  nextFingerprint: string;
  changedComponents: readonly WebPublicationChangedComponent[];
  unchangedComponents: readonly WebPublicationChangedComponent[];
  diagnostics: readonly WebPublicationDiagnostic[];
}>;

export type WebPublicationManifest = Readonly<{
  manifestId: string;
  reportId: string;
  reportFingerprint: string;
  publicationFingerprint: string;
  target: WebPublicationTarget;
  policy: WebPublicationPolicy;
  decision: WebPublicationDecision;
  publication: WebPublicationContract;
  route: WebRouteResolution;
  page: WebPageModel;
  seo: WebSeoModel;
  sitemapEntry: WebSitemapEntry | null;
  aliases: readonly WebRouteAlias[];
  diagnostics: readonly WebPublicationDiagnostic[];
  lineage: CoordinationJsonObject | null;
  policyVersions: Readonly<Record<string, string>>;
  generatedAt: string;
  change: WebPublicationChange;
}>;

export type WebPageModelValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type WebPageModelValidationResult =
  | Readonly<{ ok: true; page: WebPageModel }>
  | Readonly<{
      ok: false;
      issues: readonly WebPageModelValidationIssue[];
    }>;

export type WebSeoModelValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type WebSeoModelValidationResult =
  | Readonly<{ ok: true; seo: WebSeoModel }>
  | Readonly<{
      ok: false;
      issues: readonly WebSeoModelValidationIssue[];
    }>;

export type WebPublicationManifestValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type WebPublicationManifestValidationResult =
  | Readonly<{ ok: true; manifest: WebPublicationManifest }>
  | Readonly<{
      ok: false;
      issues: readonly WebPublicationManifestValidationIssue[];
    }>;

export type BuildWebPublicationManifestInput = Readonly<{
  bundle: MarketReportArtifactBundle;
  target: WebPublicationTarget;
  generatedAt: string;
  policy?: Partial<WebPublicationPolicy>;
  previousManifest?: WebPublicationManifest | null;
  existingManifests?: readonly WebPublicationManifest[];
  siblingBundles?: readonly MarketReportArtifactBundle[];
  knownStaticRoutes?: readonly string[];
  legacySlugOverride?: string | null;
  metadata?: CoordinationJsonObject;
}>;

export type BuildWebPublisherRuntimePlanInput = Readonly<{
  bundle: MarketReportArtifactBundle;
  target: WebPublicationTarget;
  generatedAt: string;
  metadata?: CoordinationJsonObject;
}>;

export type WebPublisherRuntimePlan = Readonly<{
  graph: RuntimeExecutionGraph;
  plan: RuntimeExecutionPlan;
  diagnostics: readonly WebPublicationDiagnostic[];
}>;

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((entry) => deepFreeze(entry));
    return Object.freeze(value);
  }

  if (typeof value === "object" && value != null) {
    Object.values(value as Record<string, unknown>).forEach((entry) => {
      deepFreeze(entry);
    });
    return Object.freeze(value);
  }

  return value;
}

function buildWebPublicationDiagnostic(
  input: Readonly<{
    code: WebPublicationDiagnosticCode;
    severity: WebPublicationDiagnosticSeverity;
    message: string;
    reportId?: string | null;
    routeKey?: string | null;
    path?: string | null;
    metadata?: CoordinationJsonObject;
  }>,
): WebPublicationDiagnostic {
  return deepFreeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    reportId: input.reportId ?? null,
    routeKey: input.routeKey ?? null,
    path: input.path ?? null,
    metadata: normalizeJsonMetadata(input.metadata),
  });
}

function mapMarketReportDiagnostics(
  reportId: string,
  diagnostics: readonly MarketReportGenerationDiagnostic[],
): readonly WebPublicationDiagnostic[] {
  return deepFreeze(
    diagnostics.map((diagnostic) =>
      buildWebPublicationDiagnostic({
        code:
          diagnostic.code === "private_field_detected"
            ? "private_field_detected"
            : "publication_skipped",
        severity: diagnostic.severity,
        message: diagnostic.message,
        reportId,
        metadata: freezeMetadata({
          sourceDiagnosticCode: diagnostic.code,
          sectionType: diagnostic.sectionType,
        }),
      }),
    ),
  );
}

function normalizeBaseUrl(baseUrl: string): string {
  if (!isAbsoluteUrl(baseUrl)) {
    throw new WebPublisherError({
      code: "invalid_input",
      operation: "normalizeBaseUrl",
      path: "target.baseUrl",
      message: "target.baseUrl must be an absolute URL.",
    });
  }

  return baseUrl.replace(/\/$/, "");
}

function freezeTarget(target: WebPublicationTarget): WebPublicationTarget {
  return deepFreeze({
    ...target,
    metadata: normalizeJsonMetadata(target.metadata),
  });
}

function normalizeWebPublicationTarget(
  input: WebPublicationTarget,
): WebPublicationTarget {
  if (input.channel !== "web") {
    throw new WebPublisherError({
      code: "unsupported_channel",
      operation: "normalizeWebPublicationTarget",
      path: "target.channel",
      message: "Web publication target must use channel=web.",
    });
  }
  if (!WEB_PUBLICATION_MODES.includes(input.publicationMode)) {
    throw new WebPublisherError({
      code: "invalid_input",
      operation: "normalizeWebPublicationTarget",
      path: "target.publicationMode",
      message: "Unsupported publicationMode for WebPublicationTarget.",
    });
  }
  if (!LOCALIZED_ROUTE_STRATEGIES.includes(input.localizedRouteStrategy)) {
    throw new WebPublisherError({
      code: "invalid_input",
      operation: "normalizeWebPublicationTarget",
      path: "target.localizedRouteStrategy",
      message: "Unsupported localizedRouteStrategy for WebPublicationTarget.",
    });
  }
  if (!isNonEmptyString(input.locale) || !isNonEmptyString(input.defaultLocale)) {
    throw new WebPublisherError({
      code: "invalid_input",
      operation: "normalizeWebPublicationTarget",
      path: "target.locale",
      message: "target.locale and target.defaultLocale must be non-empty strings.",
    });
  }

  return freezeTarget({
    ...input,
    baseUrl: normalizeBaseUrl(input.baseUrl),
    locale: input.locale.trim().toLowerCase(),
    defaultLocale: input.defaultLocale.trim().toLowerCase(),
  });
}

export function buildDefaultWebPublicationPolicy(
  overrides: Partial<WebPublicationPolicy> = {},
): WebPublicationPolicy {
  const policy: WebPublicationPolicy = {
    allowPartialReports: true,
    allowStaleReports: true,
    includeInSitemap: true,
    enableLegacyAliases: true,
    requireCanonicalUrl: true,
    allowedChangeTypes: deepFreeze([
      "new_report",
      "updated_report",
      "unchanged_report",
      "partial_report",
      "stale_report",
      "invalid_report",
      "missing_required_asset",
    ]),
    minimumConfidence: "unknown",
    indexPartialReports: false,
    indexStaleReports: false,
    metadata: freezeMetadata({}),
    ...overrides,
  };

  if (
    !["unknown", "low", "moderate", "high"].includes(policy.minimumConfidence)
  ) {
    throw new WebPublisherError({
      code: "invalid_input",
      operation: "buildDefaultWebPublicationPolicy",
      path: "policy.minimumConfidence",
      message: "policy.minimumConfidence must be unknown, low, moderate or high.",
    });
  }

  return deepFreeze({
    ...policy,
    allowedChangeTypes: deepFreeze(
      [...new Set(policy.allowedChangeTypes)].sort(compareStrings),
    ),
    metadata: normalizeJsonMetadata(policy.metadata),
  });
}

function buildLocalizedReportPath(
  slug: string,
  target: WebPublicationTarget,
): string {
  const route = normalizeRoute(`/reports/${slug}`);
  const shouldPrefixLocale =
    target.localizedRouteStrategy === "always_prefixed" ||
    target.locale !== target.defaultLocale;
  if (!shouldPrefixLocale) {
    return route;
  }
  return normalizeRoute(`/${slugifySegment(target.locale)}${route}`);
}

function buildDetailedReportSlug(bundle: MarketReportArtifactBundle): string {
  const identity = bundle.document.identity;
  return [
    slugifySegment(identity.platform),
    "market",
    "report",
    slugifySegment(identity.citySlug),
    slugifySegment(identity.propertyType),
  ]
    .filter((segment) => segment.length > 0)
    .join("-");
}

function buildLegacyReportSlug(
  bundle: MarketReportArtifactBundle,
  override: string | null | undefined,
): string {
  if (isNonEmptyString(override)) {
    return slugifySegment(override);
  }
  const identity = bundle.document.identity;
  return [
    slugifySegment(identity.platform),
    "market",
    "report",
    slugifySegment(identity.citySlug),
  ]
    .filter((segment) => segment.length > 0)
    .join("-");
}

function buildRouteIdentity(input: Readonly<{
  slug: string;
  pathname: string;
  locale: string;
  platform: string;
  city: string;
  propertyType: string;
  isLegacySlug: boolean;
  baseUrl: string;
}>): WebRouteIdentity {
  const absoluteUrl = new URL(input.pathname, input.baseUrl).toString();
  return deepFreeze({
    routeKey: buildStableHash(
      [input.locale, input.pathname, input.platform, input.city, input.propertyType],
      "ipp_web_route_",
    ),
    slug: input.slug,
    pathname: input.pathname,
    absoluteUrl,
    canonicalPath: input.pathname,
    canonicalUrl: absoluteUrl,
    locale: input.locale,
    platform: input.platform,
    city: input.city,
    propertyType: input.propertyType,
    isLegacySlug: input.isLegacySlug,
    fingerprint: buildStableHash(
      [
        input.slug,
        input.pathname,
        absoluteUrl,
        input.locale,
        input.platform,
        input.city,
        input.propertyType,
        input.isLegacySlug ? "legacy" : "canonical",
      ],
      "ipp_web_route_fp_",
    ),
  });
}

function resolveAliasType(
  path: string,
  knownStaticRoutes: readonly string[],
): WebRouteAliasType {
  return knownStaticRoutes.includes(path)
    ? "historical_static_route"
    : "legacy_short_slug";
}

function countSiblingPrincipalReports(
  bundle: MarketReportArtifactBundle,
  siblingBundles: readonly MarketReportArtifactBundle[],
): number {
  const identity = bundle.document.identity;
  const matches = siblingBundles.filter((candidate) => {
    const other = candidate.document.identity;
    return (
      slugifySegment(other.platform) === slugifySegment(identity.platform) &&
      slugifySegment(other.citySlug) === slugifySegment(identity.citySlug) &&
      slugifySegment(other.locale) === slugifySegment(identity.locale)
    );
  });
  return new Set(matches.map((candidate) => candidate.reportId)).size;
}

function compareConfidenceBand(
  left: RegistryConfidenceBand | "unknown",
  right: RegistryConfidenceBand | "unknown",
): number {
  const rank = (value: RegistryConfidenceBand | "unknown"): number => {
    switch (value) {
      case "high":
        return 3;
      case "moderate":
        return 2;
      case "low":
        return 1;
      default:
        return 0;
    }
  };

  return rank(left) - rank(right);
}

function detectConfidenceBand(bundle: MarketReportArtifactBundle): RegistryConfidenceBand | "unknown" {
  return bundle.document.confidence?.band ?? "unknown";
}

function buildSeoFingerprint(input: Readonly<{
  title: string;
  description: string;
  canonical: string | null;
  alternates: Readonly<Record<string, string>>;
  robots: CoordinationJsonObject;
  openGraph: CoordinationJsonObject;
  structuredData: CoordinationJsonObject;
  datePublished: string;
  dateModified: string;
}>): string {
  return buildStableHash(
    [
      input.title,
      input.description,
      input.canonical ?? "null",
      canonicalizeForComparison(input.alternates),
      canonicalizeForComparison(input.robots),
      canonicalizeForComparison(input.openGraph),
      canonicalizeForComparison(input.structuredData),
      input.datePublished,
      input.dateModified,
    ],
    "ipp_web_seo_fp_",
  );
}

function buildPageFingerprint(
  content: MarketReportContentArtifact,
  route: WebRouteIdentity,
  bundle: MarketReportArtifactBundle,
): string {
  return buildStableHash(
    [
      route.pathname,
      bundle.reportFingerprint,
      bundle.document.generatedAt,
      canonicalizeForComparison(content.sections),
      canonicalizeForComparison(content.tables),
      canonicalizeForComparison(content.chartsData),
      canonicalizeForComparison(content.callouts),
      canonicalizeForComparison(content.disclaimers),
    ],
    "ipp_web_page_fp_",
  );
}

function buildAliasFingerprint(alias: Omit<WebRouteAlias, "fingerprint">): string {
  return buildStableHash(
    [
      alias.aliasKey,
      alias.fromPath,
      alias.toPath,
      alias.aliasType,
      alias.status,
      alias.reason,
    ],
    "ipp_web_alias_fp_",
  );
}

function normalizeAlternateUrl(
  value: string,
  baseUrl: string,
): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  if (isAbsoluteUrl(value)) {
    return value;
  }
  if (!value.startsWith("/")) {
    return null;
  }
  return new URL(value, baseUrl).toString();
}

export function resolveWebRoute(input: Readonly<{
  bundle: MarketReportArtifactBundle;
  target: WebPublicationTarget;
  existingManifests?: readonly WebPublicationManifest[];
  siblingBundles?: readonly MarketReportArtifactBundle[];
  knownStaticRoutes?: readonly string[];
  legacySlugOverride?: string | null;
}>): WebRouteResolution {
  const validation = validateMarketReportArtifactBundle(input.bundle);
  if (!validation.ok) {
    throw new WebPublisherError({
      code: "invalid_bundle",
      operation: "resolveWebRoute",
      reportId: input.bundle.reportId,
      message: validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }

  const bundle = validation.bundle;
  assertNoForbiddenPrivateKeys(bundle, "bundle");
  const target = normalizeWebPublicationTarget(input.target);
  const diagnostics: WebPublicationDiagnostic[] = [];
  const knownStaticRoutes = deepFreeze(
    [...new Set((input.knownStaticRoutes ?? []).map((path) => normalizeRoute(path)))].sort(
      compareStrings,
    ),
  );
  const siblingBundles = input.siblingBundles ?? deepFreeze([bundle]);
  const detailedSlug = buildDetailedReportSlug(bundle);
  const legacySlug = buildLegacyReportSlug(bundle, input.legacySlugOverride);
  const canonicalPath = buildLocalizedReportPath(detailedSlug, target);
  const preservedLegacyPath =
    knownStaticRoutes.find((path) => {
      const slug = path.split("/").filter(Boolean).pop() ?? "";
      return slug === legacySlug;
    }) ?? null;
  const legacyPath =
    preservedLegacyPath ?? buildLocalizedReportPath(legacySlug, target);
  const identity = bundle.document.identity;
  const canonical = buildRouteIdentity({
    slug: detailedSlug,
    pathname: canonicalPath,
    locale: target.locale,
    platform: slugifySegment(identity.platform),
    city: slugifySegment(identity.citySlug),
    propertyType: slugifySegment(identity.propertyType),
    isLegacySlug: false,
    baseUrl: target.baseUrl,
  });
  let conflict: WebRouteConflict | null = null;

  for (const manifest of input.existingManifests ?? []) {
    if (
      manifest.route.canonical.pathname === canonical.pathname &&
      manifest.reportId !== bundle.reportId
    ) {
      conflict = deepFreeze({
        path: canonical.pathname,
        conflictingReportId: manifest.reportId,
        reason: "Another manifest already claims the canonical route.",
      });
      diagnostics.push(
        buildWebPublicationDiagnostic({
          code: "route_conflict",
          severity: "error",
          message: "The canonical route conflicts with an existing manifest.",
          reportId: bundle.reportId,
          routeKey: canonical.routeKey,
          path: canonical.pathname,
          metadata: freezeMetadata({
            conflictingReportId: manifest.reportId,
          }),
        }),
      );
      break;
    }
  }

  if (conflict == null && knownStaticRoutes.includes(canonical.pathname)) {
    conflict = deepFreeze({
      path: canonical.pathname,
      conflictingReportId: null,
      reason: "The canonical route collides with a known static route.",
    });
    diagnostics.push(
      buildWebPublicationDiagnostic({
        code: "canonical_conflict",
        severity: "error",
        message: "The canonical route collides with an existing static route.",
        reportId: bundle.reportId,
        routeKey: canonical.routeKey,
        path: canonical.pathname,
      }),
    );
  }

  const aliases: WebRouteAlias[] = [];
  if (legacyPath === canonical.pathname) {
    aliases.push(
      deepFreeze({
        aliasKey: buildStableHash(
          [bundle.reportId, target.locale, legacyPath, canonical.pathname],
          "ipp_web_alias_",
        ),
        fromPath: legacyPath,
        toPath: canonical.pathname,
        aliasType: "legacy_short_slug" as const,
        status: "blocked" as const,
        reason: "Legacy alias path resolves to the canonical path itself.",
        fingerprint: buildAliasFingerprint({
          aliasKey: buildStableHash(
            [bundle.reportId, target.locale, legacyPath, canonical.pathname],
            "ipp_web_alias_",
          ),
          fromPath: legacyPath,
          toPath: canonical.pathname,
          aliasType: "legacy_short_slug",
          status: "blocked",
          reason: "Legacy alias path resolves to the canonical path itself.",
        }),
      }),
    );
    diagnostics.push(
      buildWebPublicationDiagnostic({
        code: "legacy_alias_conflict",
        severity: "warning",
        message: "The legacy alias path would be self-referential and was blocked.",
        reportId: bundle.reportId,
        routeKey: canonical.routeKey,
        path: legacyPath,
      }),
    );
  } else {
    const principalCount = countSiblingPrincipalReports(bundle, siblingBundles);
    const aliasInUse =
      (input.existingManifests ?? []).find(
        (manifest) =>
          manifest.route.canonical.pathname === legacyPath &&
          manifest.reportId !== bundle.reportId,
      ) ?? null;
    if (principalCount > 1) {
      aliases.push(
        deepFreeze({
          aliasKey: buildStableHash(
            [bundle.reportId, target.locale, legacyPath, canonical.pathname],
            "ipp_web_alias_",
          ),
          fromPath: legacyPath,
          toPath: canonical.pathname,
          aliasType: "preferred_market_report" as const,
          status: "blocked" as const,
          reason: "Multiple reports exist for the same market and legacy alias is ambiguous.",
          fingerprint: buildAliasFingerprint({
            aliasKey: buildStableHash(
              [bundle.reportId, target.locale, legacyPath, canonical.pathname],
              "ipp_web_alias_",
            ),
            fromPath: legacyPath,
            toPath: canonical.pathname,
            aliasType: "preferred_market_report",
            status: "blocked",
            reason: "Multiple reports exist for the same market and legacy alias is ambiguous.",
          }),
        }),
      );
      diagnostics.push(
        buildWebPublicationDiagnostic({
          code: "legacy_alias_conflict",
          severity: "warning",
          message: "The legacy alias is ambiguous because several principal reports exist.",
          reportId: bundle.reportId,
          routeKey: canonical.routeKey,
          path: legacyPath,
        }),
      );
    } else if (aliasInUse != null) {
      aliases.push(
        deepFreeze({
          aliasKey: buildStableHash(
            [bundle.reportId, target.locale, legacyPath, canonical.pathname],
            "ipp_web_alias_",
          ),
          fromPath: legacyPath,
          toPath: canonical.pathname,
          aliasType: "redirect_candidate" as const,
          status: "blocked" as const,
          reason: "Another manifest already claims the legacy alias path.",
          fingerprint: buildAliasFingerprint({
            aliasKey: buildStableHash(
              [bundle.reportId, target.locale, legacyPath, canonical.pathname],
              "ipp_web_alias_",
            ),
            fromPath: legacyPath,
            toPath: canonical.pathname,
            aliasType: "redirect_candidate",
            status: "blocked",
            reason: "Another manifest already claims the legacy alias path.",
          }),
        }),
      );
      diagnostics.push(
        buildWebPublicationDiagnostic({
          code: "legacy_alias_conflict",
          severity: "warning",
          message: "The legacy alias path conflicts with another manifest.",
          reportId: bundle.reportId,
          routeKey: canonical.routeKey,
          path: legacyPath,
          metadata: freezeMetadata({
            conflictingReportId: aliasInUse.reportId,
          }),
        }),
      );
    } else {
      const aliasType = resolveAliasType(legacyPath, knownStaticRoutes);
      aliases.push(
        deepFreeze({
          aliasKey: buildStableHash(
            [bundle.reportId, target.locale, legacyPath, canonical.pathname],
            "ipp_web_alias_",
          ),
          fromPath: legacyPath,
          toPath: canonical.pathname,
          aliasType,
          status: knownStaticRoutes.includes(legacyPath) ? "legacy_static" : "candidate",
          reason:
            aliasType === "historical_static_route"
              ? "A historical short report route can point to the canonical detailed report."
              : "A unique principal report exists and can own the short legacy route.",
          fingerprint: buildAliasFingerprint({
            aliasKey: buildStableHash(
              [bundle.reportId, target.locale, legacyPath, canonical.pathname],
              "ipp_web_alias_",
            ),
            fromPath: legacyPath,
            toPath: canonical.pathname,
            aliasType,
            status: knownStaticRoutes.includes(legacyPath) ? "legacy_static" : "candidate",
            reason:
              aliasType === "historical_static_route"
                ? "A historical short report route can point to the canonical detailed report."
                : "A unique principal report exists and can own the short legacy route.",
          }),
        }),
      );
      diagnostics.push(
        buildWebPublicationDiagnostic({
          code: "legacy_alias_created",
          severity: "info",
          message: "A legacy alias candidate was resolved for the report.",
          reportId: bundle.reportId,
          routeKey: canonical.routeKey,
          path: legacyPath,
          metadata: freezeMetadata({
            aliasType,
          }),
        }),
      );
    }
  }

  diagnostics.unshift(
    buildWebPublicationDiagnostic({
      code: "route_resolved",
      severity: conflict == null ? "info" : "warning",
      message: "A deterministic canonical route was resolved for the market report.",
      reportId: bundle.reportId,
      routeKey: canonical.routeKey,
      path: canonical.pathname,
      metadata: freezeMetadata({
        slug: detailedSlug,
        legacySlug,
      }),
    }),
  );

  return deepFreeze({
    canonical,
    aliases: aliases.sort((left, right) => compareStrings(left.fromPath, right.fromPath)),
    conflict,
    diagnostics: diagnostics.sort((left, right) =>
      compareNullableStrings(left.path, right.path),
    ),
  });
}

function buildDecisionDiagnostics(
  bundle: MarketReportArtifactBundle,
  route: WebRouteResolution,
  code: WebPublicationDiagnosticCode,
  severity: WebPublicationDiagnosticSeverity,
  message: string,
): readonly WebPublicationDiagnostic[] {
  return deepFreeze([
    ...mapMarketReportDiagnostics(bundle.reportId, bundle.diagnostics),
    ...route.diagnostics,
    buildWebPublicationDiagnostic({
      code,
      severity,
      message,
      reportId: bundle.reportId,
      routeKey: route.canonical.routeKey,
      path: route.canonical.pathname,
    }),
  ]);
}

export function resolveWebPublicationDecision(input: Readonly<{
  bundle: MarketReportArtifactBundle;
  target: WebPublicationTarget;
  policy?: Partial<WebPublicationPolicy>;
  route: WebRouteResolution;
  previousManifest?: WebPublicationManifest | null;
}>): WebPublicationDecision {
  const validation = validateMarketReportArtifactBundle(input.bundle);
  const target = normalizeWebPublicationTarget(input.target);
  const policy = buildDefaultWebPublicationPolicy(input.policy);
  if (!validation.ok) {
    return deepFreeze({
      decisionType: "skip_invalid",
      reason: "The market report bundle is structurally invalid.",
      allowsPublication: false,
      requiresNoindex: true,
      diagnostics: deepFreeze([
        buildWebPublicationDiagnostic({
          code: "invalid_report_blocked",
          severity: "error",
          message: "The market report bundle is structurally invalid and cannot be published.",
          reportId: input.bundle.reportId ?? null,
          metadata: freezeMetadata({
            issues: validation.issues.map((issue) => `${issue.path}: ${issue.message}`),
          }),
        }),
      ]),
    });
  }

  const bundle = validation.bundle;
  assertNoForbiddenPrivateKeys(bundle, "bundle");
  assertNoForbiddenPrivateKeys(input.route, "route");
  const confidenceBand = detectConfidenceBand(bundle);

  if (input.route.conflict != null) {
    return deepFreeze({
      decisionType: "route_conflict",
      reason: input.route.conflict.reason,
      allowsPublication: false,
      requiresNoindex: true,
      diagnostics: buildDecisionDiagnostics(
        bundle,
        input.route,
        "route_conflict",
        "error",
        "The publication route is in conflict and cannot become canonical.",
      ),
    });
  }

  if (policy.requireCanonicalUrl && !isAbsoluteUrl(input.route.canonical.canonicalUrl)) {
    return deepFreeze({
      decisionType: "skip_invalid",
      reason: "A canonical URL is required but missing.",
      allowsPublication: false,
      requiresNoindex: true,
      diagnostics: buildDecisionDiagnostics(
        bundle,
        input.route,
        "canonical_missing",
        "error",
        "The publication was blocked because the canonical URL is missing.",
      ),
    });
  }

  if (!policy.allowedChangeTypes.includes(bundle.change.changeType)) {
    return deepFreeze({
      decisionType: "skip_invalid",
      reason: `Change type ${bundle.change.changeType} is not publishable under the current policy.`,
      allowsPublication: false,
      requiresNoindex: true,
      diagnostics: buildDecisionDiagnostics(
        bundle,
        input.route,
        "publication_skipped",
        "warning",
        "The current policy blocks this report change type.",
      ),
    });
  }

  if (compareConfidenceBand(confidenceBand, policy.minimumConfidence) < 0) {
    return deepFreeze({
      decisionType: "skip_invalid",
      reason: "The report confidence is below the publication policy threshold.",
      allowsPublication: false,
      requiresNoindex: true,
      diagnostics: buildDecisionDiagnostics(
        bundle,
        input.route,
        "invalid_report_blocked",
        "warning",
        "The report confidence is below the minimum threshold for publication.",
      ),
    });
  }

  switch (bundle.change.changeType) {
    case "new_report":
    case "updated_report":
      return deepFreeze({
        decisionType: "publish",
        reason: "The report is publishable and has new web content.",
        allowsPublication: true,
        requiresNoindex: false,
        diagnostics: buildDecisionDiagnostics(
          bundle,
          input.route,
          bundle.change.changeType === "new_report"
            ? "publication_created"
            : "publication_updated",
          "info",
          "The report is ready for canonical publication.",
        ),
      });
    case "unchanged_report":
      return deepFreeze({
        decisionType: "skip_unchanged",
        reason: "The report is unchanged relative to the previous published state.",
        allowsPublication: false,
        requiresNoindex: false,
        diagnostics: buildDecisionDiagnostics(
          bundle,
          input.route,
          "publication_unchanged",
          "info",
          "The report was skipped because its publication output is unchanged.",
        ),
      });
    case "partial_report":
      if (!policy.allowPartialReports) {
        return deepFreeze({
          decisionType: "skip_partial",
          reason: "Partial reports are blocked by policy.",
          allowsPublication: false,
          requiresNoindex: true,
          diagnostics: buildDecisionDiagnostics(
            bundle,
            input.route,
            "partial_report_blocked",
            "warning",
            "The report is partial and publication is disabled by policy.",
          ),
        });
      }
      return deepFreeze({
        decisionType: "publish_with_warning",
        reason: "The report is partial but publication is allowed with warnings.",
        allowsPublication: true,
        requiresNoindex: !policy.indexPartialReports,
        diagnostics: buildDecisionDiagnostics(
          bundle,
          input.route,
          policy.indexPartialReports ? "publication_updated" : "noindex_applied",
          policy.indexPartialReports ? "warning" : "info",
          policy.indexPartialReports
            ? "The partial report is publishable with visible limitations."
            : "The partial report is publishable but marked noindex by policy.",
        ),
      });
    case "stale_report":
      if (!policy.allowStaleReports) {
        return deepFreeze({
          decisionType: "skip_stale",
          reason: "Stale reports are blocked by policy.",
          allowsPublication: false,
          requiresNoindex: true,
          diagnostics: buildDecisionDiagnostics(
            bundle,
            input.route,
            "stale_report_blocked",
            "warning",
            "The report is stale and publication is disabled by policy.",
          ),
        });
      }
      return deepFreeze({
        decisionType: "publish_with_warning",
        reason: "The report is stale but publication is allowed with warnings.",
        allowsPublication: true,
        requiresNoindex: !policy.indexStaleReports,
        diagnostics: buildDecisionDiagnostics(
          bundle,
          input.route,
          policy.indexStaleReports ? "publication_updated" : "noindex_applied",
          policy.indexStaleReports ? "warning" : "info",
          policy.indexStaleReports
            ? "The stale report remains publishable with a freshness warning."
            : "The stale report remains publishable but is marked noindex by policy.",
        ),
      });
    case "invalid_report":
    case "missing_required_asset":
      return deepFreeze({
        decisionType: "skip_invalid",
        reason: "The report is invalid or missing required assets.",
        allowsPublication: false,
        requiresNoindex: true,
        diagnostics: buildDecisionDiagnostics(
          bundle,
          input.route,
          "invalid_report_blocked",
          "error",
          "The report cannot be published because it is invalid or incomplete.",
        ),
      });
  }

  return deepFreeze({
    decisionType: "skip_invalid",
    reason: "Unsupported market report change type.",
    allowsPublication: false,
    requiresNoindex: true,
    diagnostics: buildDecisionDiagnostics(
      bundle,
      input.route,
      "invalid_report_blocked",
      "error",
      "The report change type is unsupported for web publication.",
    ),
  });
}

export function buildWebPageModel(input: Readonly<{
  bundle: MarketReportArtifactBundle;
  route: WebRouteResolution;
}>): WebPageModel {
  const validation = validateMarketReportArtifactBundle(input.bundle);
  if (!validation.ok) {
    throw new WebPublisherError({
      code: "invalid_bundle",
      operation: "buildWebPageModel",
      reportId: input.bundle.reportId,
      message: validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }

  const bundle = validation.bundle;
  assertNoForbiddenPrivateKeys(bundle, "bundle");
  const content = bundle.contentArtifact;
  const page = deepFreeze({
    route: input.route.canonical.pathname,
    title: bundle.metadataArtifact.title,
    description: bundle.metadataArtifact.description,
    heading: content.heading,
    introduction: content.introduction,
    sections: deepFreeze([...content.sections]),
    facts: deepFreeze(bundle.document.facts.map((fact) => deepFreeze({ ...fact }))),
    tables: deepFreeze(content.tables.map((table) => deepFreeze({ ...table }))),
    chartsData: deepFreeze(content.chartsData.map((chart) => deepFreeze({ ...chart }))),
    methodology:
      bundle.document.methodology == null
        ? null
        : deepFreeze({ ...bundle.document.methodology }),
    sources: deepFreeze([...content.sourceNotes]),
    disclaimers: deepFreeze([...content.disclaimers]),
    callouts: deepFreeze([...content.callouts]),
    freshness:
      bundle.document.freshness == null
        ? null
        : deepFreeze({ ...bundle.document.freshness }),
    confidence:
      bundle.document.confidence == null
        ? null
        : deepFreeze({ ...bundle.document.confidence }),
    generatedAt: bundle.document.generatedAt,
    modifiedAt: bundle.metadataArtifact.modifiedAt,
    contentFingerprint: buildPageFingerprint(content, input.route.canonical, bundle),
    metadata: freezeMetadata({
      reportId: bundle.reportId,
      marketCellKey: bundle.document.identity.marketCellKey,
      locale: bundle.document.identity.locale,
      canonicalPath: input.route.canonical.pathname,
      sourceCapturedAt: bundle.document.sourceCapturedAt,
      sectionCount: content.sections.length,
    }),
  });
  const result = validateWebPageModel(page);
  if (!result.ok) {
    throw new WebPublisherError({
      code: "invalid_page_model",
      operation: "buildWebPageModel",
      reportId: bundle.reportId,
      routeKey: input.route.canonical.routeKey,
      message: result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }
  return result.page;
}

function buildRobotsModel(
  metadataArtifact: MarketReportMetadataArtifact,
  noindex: boolean,
): CoordinationJsonObject {
  return deepFreeze({
    ...(metadataArtifact.robots ?? {}),
    index: !noindex,
    follow: true,
  });
}

export function buildWebSeoModel(input: Readonly<{
  bundle: MarketReportArtifactBundle;
  route: WebRouteResolution;
  decision: WebPublicationDecision;
  target: WebPublicationTarget;
  policy?: Partial<WebPublicationPolicy>;
}>): WebSeoModel {
  const validation = validateMarketReportArtifactBundle(input.bundle);
  if (!validation.ok) {
    throw new WebPublisherError({
      code: "invalid_bundle",
      operation: "buildWebSeoModel",
      reportId: input.bundle.reportId,
      message: validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }

  const bundle = validation.bundle;
  const target = normalizeWebPublicationTarget(input.target);
  const policy = buildDefaultWebPublicationPolicy(input.policy);
  const noindex = input.decision.requiresNoindex;
  const alternates = Object.fromEntries(
    Object.entries({
      ...bundle.metadataArtifact.alternates,
      [target.locale]: input.route.canonical.canonicalUrl,
    })
      .map(([key, value]) => [key, normalizeAlternateUrl(value, target.baseUrl)])
      .filter((entry): entry is [string, string] => entry[1] != null)
      .sort((left, right) => compareStrings(left[0], right[0])),
  );
  const structuredDataMainEntity =
    typeof bundle.structuredData.mainEntity === "object" &&
    bundle.structuredData.mainEntity != null &&
    !Array.isArray(bundle.structuredData.mainEntity)
      ? deepFreeze({
          ...(bundle.structuredData.mainEntity as CoordinationJsonObject),
          ...(input.route.canonical.canonicalUrl == null
            ? {}
            : { "@id": `${input.route.canonical.canonicalUrl}#dataset` }),
          canonicalUrl: input.route.canonical.canonicalUrl,
        })
      : bundle.structuredData.mainEntity;
  const structuredDataDataset =
    typeof bundle.structuredData.dataset === "object" &&
    bundle.structuredData.dataset != null &&
    !Array.isArray(bundle.structuredData.dataset)
      ? deepFreeze({
          ...(bundle.structuredData.dataset as CoordinationJsonObject),
          ...(input.route.canonical.canonicalUrl == null
            ? {}
            : {
                "@id": `${input.route.canonical.canonicalUrl}#dataset`,
                isPartOf: { "@id": `${input.route.canonical.canonicalUrl}#webpage` },
              }),
        })
      : bundle.structuredData.dataset;
  const structuredData: CoordinationJsonObject = deepFreeze({
    ...(bundle.structuredData as CoordinationJsonObject),
    ...(input.route.canonical.canonicalUrl == null
      ? {}
      : {
          "@id": `${input.route.canonical.canonicalUrl}#webpage`,
          url: input.route.canonical.canonicalUrl,
        }),
    canonicalUrl: input.route.canonical.canonicalUrl,
    ...(structuredDataMainEntity == null
      ? {}
      : { mainEntity: structuredDataMainEntity }),
    ...(structuredDataDataset == null ? {} : { dataset: structuredDataDataset }),
  });
  const seo = deepFreeze({
    title: bundle.metadataArtifact.title,
    description: bundle.metadataArtifact.description,
    canonical: policy.requireCanonicalUrl
      ? input.route.canonical.canonicalUrl
      : input.route.canonical.canonicalUrl ?? null,
    alternates: deepFreeze(alternates),
    robots: buildRobotsModel(bundle.metadataArtifact, noindex),
    openGraph: deepFreeze({
      ...(bundle.metadataArtifact.openGraph ?? {}),
      title: bundle.metadataArtifact.title,
      description: bundle.metadataArtifact.description,
      url: input.route.canonical.canonicalUrl,
    }),
    structuredData,
    datePublished: bundle.metadataArtifact.publishedAt,
    dateModified: bundle.metadataArtifact.modifiedAt,
    contentFingerprint: buildSeoFingerprint({
      title: bundle.metadataArtifact.title,
      description: bundle.metadataArtifact.description,
      canonical: input.route.canonical.canonicalUrl,
      alternates,
      robots: buildRobotsModel(bundle.metadataArtifact, noindex),
      openGraph: deepFreeze({
        ...(bundle.metadataArtifact.openGraph ?? {}),
        title: bundle.metadataArtifact.title,
        description: bundle.metadataArtifact.description,
        url: input.route.canonical.canonicalUrl,
      }),
      structuredData,
      datePublished: bundle.metadataArtifact.publishedAt,
      dateModified: bundle.metadataArtifact.modifiedAt,
    }),
  });
  const result = validateWebSeoModel(seo);
  if (!result.ok) {
    throw new WebPublisherError({
      code: "invalid_seo_model",
      operation: "buildWebSeoModel",
      reportId: bundle.reportId,
      routeKey: input.route.canonical.routeKey,
      message: result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }
  return result.seo;
}

function deriveSitemapChangeFrequency(
  bundle: MarketReportArtifactBundle,
): WebSitemapChangeFrequency {
  switch (bundle.document.freshness?.status) {
    case "fresh":
    case "aging":
      return "weekly";
    case "stale":
    case "expired":
      return "monthly";
    default:
      return "monthly";
  }
}

function deriveSitemapPriority(
  bundle: MarketReportArtifactBundle,
  decision: WebPublicationDecision,
): number {
  if (decision.decisionType === "publish_with_warning") {
    return 0.5;
  }
  if (bundle.document.freshness?.status === "fresh") {
    return 0.7;
  }
  return 0.6;
}

export function buildWebSitemapEntry(input: Readonly<{
  bundle: MarketReportArtifactBundle;
  route: WebRouteResolution;
  decision: WebPublicationDecision;
  seo: WebSeoModel;
  policy?: Partial<WebPublicationPolicy>;
}>): WebSitemapEntry | null {
  const policy = buildDefaultWebPublicationPolicy(input.policy);
  const robotsIndex = input.seo.robots.index;
  if (
    !policy.includeInSitemap ||
    input.decision.decisionType === "skip_unchanged" ||
    input.decision.decisionType === "skip_partial" ||
    input.decision.decisionType === "skip_stale" ||
    input.decision.decisionType === "skip_invalid" ||
    input.decision.decisionType === "route_conflict" ||
    input.seo.canonical == null ||
    robotsIndex === false
  ) {
    return null;
  }

  return deepFreeze({
    url: input.seo.canonical,
    lastModified: input.seo.dateModified,
    changeFrequency: deriveSitemapChangeFrequency(input.bundle),
    priority: deriveSitemapPriority(input.bundle, input.decision),
    locale: input.route.canonical.locale,
    contentFingerprint: buildStableHash(
      [
        input.seo.canonical,
        input.seo.dateModified,
        input.route.canonical.locale,
        input.seo.contentFingerprint,
      ],
      "ipp_web_sitemap_fp_",
    ),
  });
}

function resolveManifestPublicationMode(
  decision: WebPublicationDecision,
): WebManifestPublicationMode {
  switch (decision.decisionType) {
    case "publish_with_warning":
      return "publish_with_warning";
    case "skip_partial":
    case "skip_stale":
    case "skip_invalid":
    case "route_conflict":
      return "block";
    case "publish":
    case "skip_unchanged":
    case "alias_candidate":
    default:
      return "publish";
  }
}

function resolveManifestCompleteness(
  bundle: MarketReportArtifactBundle,
): WebManifestCompletenessState {
  return bundle.change.changeType === "partial_report"
    ? "partial_report"
    : "complete_report";
}

function buildManifestPolicyFingerprint(input: Readonly<{
  policy: WebPublicationPolicy;
  policyVersions: Readonly<Record<string, string>>;
}>): string {
  return buildStableHash(
    [
      canonicalizeForComparison(input.policy),
      JSON.stringify(sortStringRecord(input.policyVersions)),
    ],
    "ipp_web_policy_fp_",
  );
}

function buildManifestPublicationReasons(input: Readonly<{
  bundle: MarketReportArtifactBundle;
  decision: WebPublicationDecision;
}>): Readonly<{
  blockedReasons: readonly string[];
  warningReasons: readonly string[];
}> {
  const blockedReasons: string[] = [];
  const warningReasons: string[] = [];

  switch (input.decision.decisionType) {
    case "route_conflict":
      blockedReasons.push("route_conflict");
      break;
    case "skip_partial":
      blockedReasons.push("partial_report_blocked");
      break;
    case "skip_stale":
      blockedReasons.push("stale_report_blocked");
      break;
    case "skip_invalid":
      blockedReasons.push("invalid_report_blocked");
      break;
    case "publish_with_warning":
      warningReasons.push(
        input.bundle.change.changeType === "stale_report"
          ? "stale_report"
          : "partial_report",
      );
      if (input.decision.requiresNoindex) {
        warningReasons.push("noindex_applied");
      }
      break;
    default:
      break;
  }

  return deepFreeze({
    blockedReasons: deepFreeze([...new Set(blockedReasons)].sort(compareStrings)),
    warningReasons: deepFreeze([...new Set(warningReasons)].sort(compareStrings)),
  });
}

function buildWebPublicationContract(input: Readonly<{
  bundle: MarketReportArtifactBundle;
  decision: WebPublicationDecision;
  route: WebRouteResolution;
  seo: WebSeoModel;
  sitemapEntry: WebSitemapEntry | null;
  policy: WebPublicationPolicy;
  policyVersions: Readonly<Record<string, string>>;
}>): WebPublicationContract {
  const publicationMode = resolveManifestPublicationMode(input.decision);
  const completeness = resolveManifestCompleteness(input.bundle);
  const renderable = publicationMode !== "block";
  const indexable = input.decision.requiresNoindex === false && renderable;
  const sitemapEligible = input.sitemapEntry != null;
  const reasons = buildManifestPublicationReasons({
    bundle: input.bundle,
    decision: input.decision,
  });

  return deepFreeze({
    publicationMode,
    completeness,
    renderable,
    indexable,
    sitemapEligible,
    routeExposure: renderable ? "canonical" : "none",
    canonicalPath: input.route.canonical.pathname,
    canonicalUrl: input.route.canonical.canonicalUrl,
    blockedReasons: reasons.blockedReasons,
    warningReasons: reasons.warningReasons,
    policyFingerprint: buildManifestPolicyFingerprint({
      policy: input.policy,
      policyVersions: input.policyVersions,
    }),
  });
}

function buildPublicationFingerprint(input: Readonly<{
  bundle: MarketReportArtifactBundle;
  target: WebPublicationTarget;
  policy: WebPublicationPolicy;
  decision: WebPublicationDecision;
  publication: WebPublicationContract;
  route: WebRouteResolution;
  page: WebPageModel;
  seo: WebSeoModel;
  sitemapEntry: WebSitemapEntry | null;
  aliases: readonly WebRouteAlias[];
}>): string {
  return buildStableHash(
    [
      input.bundle.reportFingerprint,
      canonicalizeForComparison(input.target),
      canonicalizeForComparison(input.policy),
      canonicalizeForComparison(input.decision),
      canonicalizeForComparison(input.publication),
      canonicalizeForComparison(input.route),
      canonicalizeForComparison(input.page),
      canonicalizeForComparison(input.seo),
      canonicalizeForComparison(input.sitemapEntry),
      canonicalizeForComparison(input.aliases),
    ],
    "ipp_web_publication_fp_",
  );
}

function applyLegacyAliasPolicy(
  aliases: readonly WebRouteAlias[],
  policy: WebPublicationPolicy,
): readonly WebRouteAlias[] {
  if (policy.enableLegacyAliases) {
    return deepFreeze([...aliases]);
  }

  return deepFreeze(
    aliases.map((alias) =>
      alias.status === "candidate" || alias.status === "legacy_static"
        ? deepFreeze({
            ...alias,
            status: "blocked" as const,
            reason: "Legacy aliases are disabled by publication policy.",
            fingerprint: buildAliasFingerprint({
              aliasKey: alias.aliasKey,
              fromPath: alias.fromPath,
              toPath: alias.toPath,
              aliasType: alias.aliasType,
              status: "blocked",
              reason: "Legacy aliases are disabled by publication policy.",
            }),
          })
        : alias,
    ),
  );
}

function normalizePageForChangeDetection(
  page: WebPageModel,
): Readonly<Record<string, unknown>> {
  const metadata = { ...page.metadata };
  delete metadata.canonicalPath;
  return deepFreeze({
    ...page,
    route: "__route__",
    contentFingerprint: "__content_fingerprint__",
    metadata,
  });
}

export function buildWebPublicationChange(input: Readonly<{
  previousManifest?: WebPublicationManifest | null;
  nextManifest: Omit<WebPublicationManifest, "change">;
}>): WebPublicationChange {
  const previous = input.previousManifest ?? null;
  const next = input.nextManifest;
  const components: readonly WebPublicationChangedComponent[] = deepFreeze([
    "route",
    "seo",
    "content",
    "aliases",
    "policy",
    "decision",
    "sitemap",
  ]);
  if (previous == null) {
    return deepFreeze({
      changeType: "new_publication",
      previousFingerprint: null,
      nextFingerprint: next.publicationFingerprint,
      changedComponents: components,
      unchangedComponents: deepFreeze([]),
      diagnostics: deepFreeze([
        buildWebPublicationDiagnostic({
          code: "publication_created",
          severity: "info",
          message: "A new web publication manifest was created.",
          reportId: next.reportId,
          routeKey: next.route.canonical.routeKey,
        }),
      ]),
    });
  }

  const changedComponents: WebPublicationChangedComponent[] = [];
  const routeChanged =
    canonicalizeForComparison(previous.route) !== canonicalizeForComparison(next.route);
  const seoChanged =
    canonicalizeForComparison(previous.seo) !== canonicalizeForComparison(next.seo);
  const contentChanged =
    canonicalizeForComparison(normalizePageForChangeDetection(previous.page)) !==
    canonicalizeForComparison(normalizePageForChangeDetection(next.page));
  const aliasesChanged =
    canonicalizeForComparison(previous.aliases) !== canonicalizeForComparison(next.aliases);
  const policyChanged =
    canonicalizeForComparison(previous.policy) !== canonicalizeForComparison(next.policy);
  const decisionChanged =
    canonicalizeForComparison(previous.decision) !== canonicalizeForComparison(next.decision);
  const sitemapChanged =
    canonicalizeForComparison(previous.sitemapEntry) !==
    canonicalizeForComparison(next.sitemapEntry);

  if (routeChanged) changedComponents.push("route");
  if (seoChanged) changedComponents.push("seo");
  if (contentChanged) changedComponents.push("content");
  if (aliasesChanged) changedComponents.push("aliases");
  if (policyChanged) changedComponents.push("policy");
  if (decisionChanged) changedComponents.push("decision");
  if (sitemapChanged) changedComponents.push("sitemap");

  const unchangedComponents = components.filter(
    (component) => !changedComponents.includes(component),
  );

  let changeType: WebPublicationChangeType;
  if (
    next.decision.decisionType === "skip_partial" ||
    next.decision.decisionType === "skip_stale" ||
    next.decision.decisionType === "skip_invalid" ||
    next.decision.decisionType === "route_conflict"
  ) {
    changeType = "skipped_publication";
  } else if (changedComponents.length === 0) {
    changeType = "unchanged_publication";
  } else if (
    changedComponents.includes("route") &&
    changedComponents.every((component) =>
      ["route", "seo", "sitemap", "aliases"].includes(component),
    )
  ) {
    changeType = "route_changed";
  } else if (
    changedComponents.includes("seo") &&
    changedComponents.every((component) =>
      ["seo", "sitemap"].includes(component),
    )
  ) {
    changeType = "seo_changed";
  } else if (
    changedComponents.length === 1 &&
    changedComponents[0] === "content"
  ) {
    changeType = "content_changed";
  } else if (
    changedComponents.includes("policy") &&
    changedComponents.every((component) =>
      ["policy", "decision", "seo", "sitemap", "aliases"].includes(component),
    )
  ) {
    changeType = "policy_changed";
  } else {
    changeType = "updated_publication";
  }

  const changeCode: WebPublicationDiagnosticCode =
    changeType === "unchanged_publication"
      ? "publication_unchanged"
      : changeType === "skipped_publication"
        ? "publication_skipped"
        : "publication_updated";

  return deepFreeze({
    changeType,
    previousFingerprint: previous.publicationFingerprint,
    nextFingerprint: next.publicationFingerprint,
    changedComponents: deepFreeze(changedComponents),
    unchangedComponents: deepFreeze(unchangedComponents),
    diagnostics: deepFreeze([
      buildWebPublicationDiagnostic({
        code: changeCode,
        severity: changeType === "skipped_publication" ? "warning" : "info",
        message:
          changeType === "unchanged_publication"
            ? "The publication manifest is identical to the previous version."
            : changeType === "skipped_publication"
              ? "The publication manifest is skipped under the current decision policy."
              : "The publication manifest has changed and requires an update.",
        reportId: next.reportId,
        routeKey: next.route.canonical.routeKey,
        metadata: freezeMetadata({
          changedComponents,
        }),
      }),
    ]),
  });
}

export function buildWebPublicationManifest(
  input: BuildWebPublicationManifestInput,
): WebPublicationManifest {
  if (!isCanonicalIsoTimestamp(input.generatedAt)) {
    throw new WebPublisherError({
      code: "invalid_input",
      operation: "buildWebPublicationManifest",
      path: "generatedAt",
      message: "generatedAt must be a canonical ISO timestamp.",
    });
  }

  const validation = validateMarketReportArtifactBundle(input.bundle);
  if (!validation.ok) {
    throw new WebPublisherError({
      code: "invalid_bundle",
      operation: "buildWebPublicationManifest",
      reportId: input.bundle.reportId,
      message: validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }

  const bundle = validation.bundle;
  assertNoForbiddenPrivateKeys(bundle, "bundle");
  const target = normalizeWebPublicationTarget(input.target);
  const policy = buildDefaultWebPublicationPolicy(input.policy);
  const route = resolveWebRoute({
    bundle,
    target,
    existingManifests: input.existingManifests,
    siblingBundles: input.siblingBundles,
    knownStaticRoutes: input.knownStaticRoutes,
    legacySlugOverride: input.legacySlugOverride,
  });
  const decision = resolveWebPublicationDecision({
    bundle,
    target,
    policy,
    route,
    previousManifest: input.previousManifest,
  });
  const page = buildWebPageModel({ bundle, route });
  const seo = buildWebSeoModel({
    bundle,
    route,
    decision,
    target,
    policy,
  });
  const aliases = applyLegacyAliasPolicy(route.aliases, policy);
  const sitemapEntry = buildWebSitemapEntry({
    bundle,
    route,
    decision,
    seo,
    policy,
  });
  const publication = buildWebPublicationContract({
    bundle,
    decision,
    route,
    seo,
    sitemapEntry,
    policy,
    policyVersions: bundle.policyVersions,
  });

  const baseManifest = deepFreeze({
    manifestId: buildStableHash(
      [bundle.reportId, target.locale, route.canonical.pathname],
      "ipp_web_manifest_",
    ),
    reportId: bundle.reportId,
    reportFingerprint: bundle.reportFingerprint,
    publicationFingerprint: buildPublicationFingerprint({
      bundle,
      target,
      policy,
      decision,
      publication,
      route,
      page,
      seo,
      sitemapEntry,
      aliases,
    }),
    target,
    policy,
    decision,
    publication,
    route,
    page,
    seo,
    sitemapEntry,
    aliases,
    diagnostics: deepFreeze([
      ...route.diagnostics,
      ...decision.diagnostics,
      ...(sitemapEntry == null
        ? [
            buildWebPublicationDiagnostic({
              code: "sitemap_entry_skipped",
              severity: "info",
              message: "No sitemap entry was generated for this manifest.",
              reportId: bundle.reportId,
              routeKey: route.canonical.routeKey,
              path: route.canonical.pathname,
            }),
          ]
        : [
            buildWebPublicationDiagnostic({
              code: "sitemap_entry_created",
              severity: "info",
              message: "A sitemap entry was generated for this manifest.",
              reportId: bundle.reportId,
              routeKey: route.canonical.routeKey,
              path: route.canonical.pathname,
            }),
          ]),
    ]),
    lineage:
      bundle.lineageArtifact == null
        ? null
        : deepFreeze({ ...(bundle.lineageArtifact as CoordinationJsonObject) }),
    policyVersions: sortStringRecord(bundle.policyVersions),
    generatedAt: input.generatedAt,
  });

  const change = buildWebPublicationChange({
    previousManifest: input.previousManifest,
    nextManifest: baseManifest,
  });
  const manifest = deepFreeze({
    ...baseManifest,
    change,
    diagnostics: deepFreeze([
      ...baseManifest.diagnostics,
      ...change.diagnostics,
      ...(decision.requiresNoindex
        ? [
            buildWebPublicationDiagnostic({
              code: "noindex_applied",
              severity: "info",
              message: "The manifest is marked noindex under the current publication decision.",
              reportId: bundle.reportId,
              routeKey: route.canonical.routeKey,
              path: route.canonical.pathname,
            }),
          ]
        : []),
    ]),
  });
  const result = validateWebPublicationManifest(manifest);
  if (!result.ok) {
    throw new WebPublisherError({
      code: "invalid_manifest",
      operation: "buildWebPublicationManifest",
      reportId: bundle.reportId,
      routeKey: route.canonical.routeKey,
      message: result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }
  return result.manifest;
}

export function validateWebPageModel(input: unknown): WebPageModelValidationResult {
  const issues: WebPageModelValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: deepFreeze([
        {
          path: "",
          message: "Expected a WebPageModel object.",
        },
      ]),
    };
  }

  const candidate = input as Partial<WebPageModel>;
  if (!isNonEmptyString(candidate.route) || !String(candidate.route).startsWith("/")) {
    issues.push({
      path: "route",
      message: "route must be a non-empty path starting with '/'.",
    });
  }
  if (!isNonEmptyString(candidate.title)) {
    issues.push({
      path: "title",
      message: "title must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(candidate.heading)) {
    issues.push({
      path: "heading",
      message: "heading must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(candidate.generatedAt) || !isCanonicalIsoTimestamp(candidate.generatedAt)) {
    issues.push({
      path: "generatedAt",
      message: "generatedAt must be a canonical ISO timestamp.",
    });
  }
  if (!isNonEmptyString(candidate.modifiedAt) || !isCanonicalIsoTimestamp(candidate.modifiedAt)) {
    issues.push({
      path: "modifiedAt",
      message: "modifiedAt must be a canonical ISO timestamp.",
    });
  }
  if (!isNonEmptyString(candidate.contentFingerprint)) {
    issues.push({
      path: "contentFingerprint",
      message: "contentFingerprint must be a non-empty string.",
    });
  }
  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
    });
  }
  try {
    assertNoForbiddenPrivateKeys(candidate, "page");
  } catch (error) {
    issues.push({
      path: "page",
      message: (error as Error).message,
    });
  }
  if (issues.length > 0) {
    return {
      ok: false,
      issues: deepFreeze(issues),
    };
  }
  return {
    ok: true,
    page: deepFreeze(candidate as WebPageModel),
  };
}

export function validateWebSeoModel(input: unknown): WebSeoModelValidationResult {
  const issues: WebSeoModelValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: deepFreeze([
        {
          path: "",
          message: "Expected a WebSeoModel object.",
        },
      ]),
    };
  }

  const candidate = input as Partial<WebSeoModel>;
  if (!isNonEmptyString(candidate.title)) {
    issues.push({
      path: "title",
      message: "title must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(candidate.description)) {
    issues.push({
      path: "description",
      message: "description must be a non-empty string.",
    });
  }
  if (candidate.canonical != null && !isAbsoluteUrl(candidate.canonical)) {
    issues.push({
      path: "canonical",
      message: "canonical must be absolute when present.",
    });
  }
  if (!isNonEmptyString(candidate.datePublished) || !isCanonicalIsoTimestamp(candidate.datePublished)) {
    issues.push({
      path: "datePublished",
      message: "datePublished must be a canonical ISO timestamp.",
    });
  }
  if (!isNonEmptyString(candidate.dateModified) || !isCanonicalIsoTimestamp(candidate.dateModified)) {
    issues.push({
      path: "dateModified",
      message: "dateModified must be a canonical ISO timestamp.",
    });
  }
  if (!isNonEmptyString(candidate.contentFingerprint)) {
    issues.push({
      path: "contentFingerprint",
      message: "contentFingerprint must be a non-empty string.",
    });
  }
  if (
    candidate.alternates != null &&
    !Object.values(candidate.alternates).every((value) => isAbsoluteUrl(value))
  ) {
    issues.push({
      path: "alternates",
      message: "alternates must contain absolute URLs only.",
    });
  }
  if (!isJsonSafe(candidate.robots ?? {})) {
    issues.push({
      path: "robots",
      message: "robots must be JSON-safe.",
    });
  }
  if (!isJsonSafe(candidate.openGraph ?? {})) {
    issues.push({
      path: "openGraph",
      message: "openGraph must be JSON-safe.",
    });
  }
  if (!isJsonSafe(candidate.structuredData ?? {})) {
    issues.push({
      path: "structuredData",
      message: "structuredData must be JSON-safe.",
    });
  }
  try {
    assertNoForbiddenPrivateKeys(candidate, "seo");
  } catch (error) {
    issues.push({
      path: "seo",
      message: (error as Error).message,
    });
  }
  if (issues.length > 0) {
    return {
      ok: false,
      issues: deepFreeze(issues),
    };
  }
  return {
    ok: true,
    seo: deepFreeze(candidate as WebSeoModel),
  };
}

export function validateWebPublicationManifest(
  input: unknown,
): WebPublicationManifestValidationResult {
  const issues: WebPublicationManifestValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: deepFreeze([
        {
          path: "",
          message: "Expected a WebPublicationManifest object.",
        },
      ]),
    };
  }

  const candidate = input as Partial<WebPublicationManifest>;
  if (!isNonEmptyString(candidate.manifestId)) {
    issues.push({
      path: "manifestId",
      message: "manifestId must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(candidate.reportId)) {
    issues.push({
      path: "reportId",
      message: "reportId must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(candidate.reportFingerprint)) {
    issues.push({
      path: "reportFingerprint",
      message: "reportFingerprint must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(candidate.publicationFingerprint)) {
    issues.push({
      path: "publicationFingerprint",
      message: "publicationFingerprint must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(candidate.generatedAt) || !isCanonicalIsoTimestamp(candidate.generatedAt)) {
    issues.push({
      path: "generatedAt",
      message: "generatedAt must be a canonical ISO timestamp.",
    });
  }
  const pageResult = validateWebPageModel(candidate.page);
  if (!pageResult.ok) {
    pageResult.issues.forEach((issue) =>
      issues.push({
        path: `page.${issue.path}`,
        message: issue.message,
      }),
    );
  }
  const seoResult = validateWebSeoModel(candidate.seo);
  if (!seoResult.ok) {
    seoResult.issues.forEach((issue) =>
      issues.push({
        path: `seo.${issue.path}`,
        message: issue.message,
      }),
    );
  }
  if (candidate.sitemapEntry != null) {
    if (!isAbsoluteUrl(candidate.sitemapEntry.url)) {
      issues.push({
        path: "sitemapEntry.url",
        message: "sitemapEntry.url must be absolute.",
      });
    }
    if (!isCanonicalIsoTimestamp(candidate.sitemapEntry.lastModified)) {
      issues.push({
        path: "sitemapEntry.lastModified",
        message: "sitemapEntry.lastModified must be a canonical ISO timestamp.",
      });
    }
  }
  if (typeof candidate.publication !== "object" || candidate.publication == null) {
    issues.push({
      path: "publication",
      message: "publication must be an object.",
    });
  } else {
    if (
      !WEB_MANIFEST_PUBLICATION_MODES.includes(
        candidate.publication.publicationMode as WebManifestPublicationMode,
      )
    ) {
      issues.push({
        path: "publication.publicationMode",
        message: "Invalid publication.publicationMode.",
      });
    }
    if (
      !WEB_MANIFEST_COMPLETENESS_STATES.includes(
        candidate.publication.completeness as WebManifestCompletenessState,
      )
    ) {
      issues.push({
        path: "publication.completeness",
        message: "Invalid publication.completeness.",
      });
    }
    if (typeof candidate.publication.renderable !== "boolean") {
      issues.push({
        path: "publication.renderable",
        message: "publication.renderable must be a boolean.",
      });
    }
    if (typeof candidate.publication.indexable !== "boolean") {
      issues.push({
        path: "publication.indexable",
        message: "publication.indexable must be a boolean.",
      });
    }
    if (typeof candidate.publication.sitemapEligible !== "boolean") {
      issues.push({
        path: "publication.sitemapEligible",
        message: "publication.sitemapEligible must be a boolean.",
      });
    }
    if (
      !WEB_MANIFEST_ROUTE_EXPOSURES.includes(
        candidate.publication.routeExposure as WebManifestRouteExposure,
      )
    ) {
      issues.push({
        path: "publication.routeExposure",
        message: "Invalid publication.routeExposure.",
      });
    }
    if (!isNonEmptyString(candidate.publication.canonicalPath)) {
      issues.push({
        path: "publication.canonicalPath",
        message: "publication.canonicalPath must be a non-empty string.",
      });
    }
    if (!isAbsoluteUrl(candidate.publication.canonicalUrl)) {
      issues.push({
        path: "publication.canonicalUrl",
        message: "publication.canonicalUrl must be absolute.",
      });
    }
    if (!Array.isArray(candidate.publication.blockedReasons)) {
      issues.push({
        path: "publication.blockedReasons",
        message: "publication.blockedReasons must be an array.",
      });
    }
    if (!Array.isArray(candidate.publication.warningReasons)) {
      issues.push({
        path: "publication.warningReasons",
        message: "publication.warningReasons must be an array.",
      });
    }
    if (!isNonEmptyString(candidate.publication.policyFingerprint)) {
      issues.push({
        path: "publication.policyFingerprint",
        message: "publication.policyFingerprint must be a non-empty string.",
      });
    }

    const routeCanonicalPath = candidate.route?.canonical?.pathname;
    const routeCanonicalUrl = candidate.route?.canonical?.canonicalUrl;
    const robotsIndex = candidate.seo?.robots?.index;
    const decisionType = candidate.decision?.decisionType;
    const expectedPublicationMode =
      decisionType === "publish_with_warning"
        ? "publish_with_warning"
        : decisionType === "skip_partial" ||
            decisionType === "skip_stale" ||
            decisionType === "skip_invalid" ||
            decisionType === "route_conflict"
          ? "block"
          : "publish";

    if (candidate.publication.publicationMode !== expectedPublicationMode) {
      issues.push({
        path: "publication.publicationMode",
        message: "publication.publicationMode must match decision.decisionType.",
      });
    }
    if (
      isNonEmptyString(routeCanonicalPath) &&
      candidate.publication.canonicalPath !== routeCanonicalPath
    ) {
      issues.push({
        path: "publication.canonicalPath",
        message: "publication.canonicalPath must match route.canonical.pathname.",
      });
    }
    if (
      typeof routeCanonicalUrl === "string" &&
      isAbsoluteUrl(routeCanonicalUrl) &&
      candidate.publication.canonicalUrl !== routeCanonicalUrl
    ) {
      issues.push({
        path: "publication.canonicalUrl",
        message: "publication.canonicalUrl must match route.canonical.canonicalUrl.",
      });
    }
    if (
      candidate.publication.indexable !== (robotsIndex === true)
    ) {
      issues.push({
        path: "publication.indexable",
        message: "publication.indexable must match seo.robots.index.",
      });
    }
    if (
      candidate.publication.sitemapEligible !== (candidate.sitemapEntry != null)
    ) {
      issues.push({
        path: "publication.sitemapEligible",
        message: "publication.sitemapEligible must match sitemapEntry presence.",
      });
    }
    if (
      candidate.decision?.requiresNoindex === true &&
      candidate.publication.indexable
    ) {
      issues.push({
        path: "publication.indexable",
        message: "publication.indexable cannot be true when decision.requiresNoindex is true.",
      });
    }
    if (
      candidate.publication.routeExposure === "canonical" &&
      candidate.publication.renderable !== true
    ) {
      issues.push({
        path: "publication.routeExposure",
        message: "publication.routeExposure=canonical requires publication.renderable=true.",
      });
    }
    if (
      candidate.publication.routeExposure === "none" &&
      candidate.publication.renderable !== false
    ) {
      issues.push({
        path: "publication.routeExposure",
        message: "publication.routeExposure=none requires publication.renderable=false.",
      });
    }
    if (
      candidate.publication.publicationMode === "block" &&
      candidate.publication.renderable
    ) {
      issues.push({
        path: "publication.renderable",
        message: "Blocked publications cannot be renderable.",
      });
    }
    if (
      candidate.publication.renderable === false &&
      candidate.publication.indexable === true
    ) {
      issues.push({
        path: "publication.indexable",
        message: "A non-renderable publication cannot be indexable.",
      });
    }
    if (
      candidate.publication.sitemapEligible &&
      (candidate.publication.renderable === false ||
        candidate.publication.indexable === false)
    ) {
      issues.push({
        path: "publication.sitemapEligible",
        message: "A sitemap-eligible publication must be renderable and indexable.",
      });
    }
    if (
      candidate.publication.publicationMode === "block" &&
      candidate.publication.blockedReasons.length === 0
    ) {
      issues.push({
        path: "publication.blockedReasons",
        message: "Blocked publications must expose at least one blocked reason.",
      });
    }
    if (
      candidate.publication.publicationMode === "publish_with_warning" &&
      candidate.publication.warningReasons.length === 0
    ) {
      issues.push({
        path: "publication.warningReasons",
        message: "publish_with_warning publications must expose at least one warning reason.",
      });
    }
  }
  if (!isJsonSafe(candidate.lineage ?? {})) {
    issues.push({
      path: "lineage",
      message: "lineage must be JSON-safe when present.",
    });
  }
  try {
    assertNoForbiddenPrivateKeys(candidate, "manifest");
  } catch (error) {
    issues.push({
      path: "manifest",
      message: (error as Error).message,
    });
  }
  if (issues.length > 0) {
    return {
      ok: false,
      issues: deepFreeze(issues),
    };
  }
  return {
    ok: true,
    manifest: deepFreeze(candidate as WebPublicationManifest),
  };
}

function buildWebPublisherRuntimeJobId(
  bundle: MarketReportArtifactBundle,
  target: WebPublicationTarget,
  step: string,
): string {
  return buildStableHash(
    [bundle.reportId, bundle.reportFingerprint, target.locale, step],
    "ipp_web_runtime_job_",
  );
}

export function buildWebPublisherRuntimePlan(
  input: BuildWebPublisherRuntimePlanInput,
): WebPublisherRuntimePlan {
  if (!isCanonicalIsoTimestamp(input.generatedAt)) {
    throw new WebPublisherError({
      code: "invalid_input",
      operation: "buildWebPublisherRuntimePlan",
      path: "generatedAt",
      message: "generatedAt must be a canonical ISO timestamp.",
    });
  }

  const validation = validateMarketReportArtifactBundle(input.bundle);
  if (!validation.ok) {
    throw new WebPublisherError({
      code: "invalid_bundle",
      operation: "buildWebPublisherRuntimePlan",
      reportId: input.bundle.reportId,
      message: validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }

  const bundle = validation.bundle;
  const target = normalizeWebPublicationTarget(input.target);
  const graph = buildExecutionGraph({
    registrySnapshotId: bundle.bundleId,
    registrySnapshotFingerprint: bundle.reportFingerprint,
    createdAt: input.generatedAt,
    jobs: deepFreeze([
      {
        id: buildWebPublisherRuntimeJobId(bundle, target, "validate_market_report_bundle"),
        type: "validate_market_report_bundle",
        dependencies: deepFreeze([]),
        inputs: freezeMetadata({
          reportId: bundle.reportId,
          locale: target.locale,
        }),
        outputs: freezeMetadata({}),
        metadata: freezeMetadata({
          stage: "web_publisher",
        }),
      },
      {
        id: buildWebPublisherRuntimeJobId(bundle, target, "resolve_web_publication_decision"),
        type: "resolve_web_publication_decision",
        dependencies: deepFreeze([
          buildWebPublisherRuntimeJobId(bundle, target, "validate_market_report_bundle"),
        ]),
        inputs: freezeMetadata({
          reportId: bundle.reportId,
          locale: target.locale,
        }),
        outputs: freezeMetadata({}),
        metadata: freezeMetadata({
          stage: "web_publisher",
        }),
      },
      {
        id: buildWebPublisherRuntimeJobId(bundle, target, "resolve_web_route"),
        type: "resolve_web_route",
        dependencies: deepFreeze([
          buildWebPublisherRuntimeJobId(bundle, target, "resolve_web_publication_decision"),
        ]),
        inputs: freezeMetadata({
          reportId: bundle.reportId,
          locale: target.locale,
        }),
        outputs: freezeMetadata({}),
        metadata: freezeMetadata({
          stage: "web_publisher",
        }),
      },
      {
        id: buildWebPublisherRuntimeJobId(bundle, target, "build_web_page_model"),
        type: "build_web_page_model",
        dependencies: deepFreeze([
          buildWebPublisherRuntimeJobId(bundle, target, "resolve_web_route"),
        ]),
        inputs: freezeMetadata({
          reportId: bundle.reportId,
          locale: target.locale,
        }),
        outputs: freezeMetadata({}),
        metadata: freezeMetadata({
          stage: "web_publisher",
        }),
      },
      {
        id: buildWebPublisherRuntimeJobId(bundle, target, "build_web_seo_model"),
        type: "build_web_seo_model",
        dependencies: deepFreeze([
          buildWebPublisherRuntimeJobId(bundle, target, "build_web_page_model"),
        ]),
        inputs: freezeMetadata({
          reportId: bundle.reportId,
          locale: target.locale,
        }),
        outputs: freezeMetadata({}),
        metadata: freezeMetadata({
          stage: "web_publisher",
        }),
      },
      {
        id: buildWebPublisherRuntimeJobId(bundle, target, "build_web_sitemap_entry"),
        type: "build_web_sitemap_entry",
        dependencies: deepFreeze([
          buildWebPublisherRuntimeJobId(bundle, target, "build_web_seo_model"),
        ]),
        inputs: freezeMetadata({
          reportId: bundle.reportId,
          locale: target.locale,
        }),
        outputs: freezeMetadata({}),
        metadata: freezeMetadata({
          stage: "web_publisher",
        }),
      },
      {
        id: buildWebPublisherRuntimeJobId(bundle, target, "validate_web_publication_manifest"),
        type: "validate_web_publication_manifest",
        dependencies: deepFreeze([
          buildWebPublisherRuntimeJobId(bundle, target, "build_web_sitemap_entry"),
        ]),
        inputs: freezeMetadata({
          reportId: bundle.reportId,
          locale: target.locale,
        }),
        outputs: freezeMetadata({}),
        metadata: freezeMetadata({
          stage: "web_publisher",
        }),
      },
    ]),
    metadata: freezeMetadata({
      reportId: bundle.reportId,
      locale: target.locale,
      ...(input.metadata ?? {}),
    }),
  });
  const plan = buildRuntimeExecutionPlan({
    graph,
    createdAt: input.generatedAt,
    metadata: freezeMetadata({
      reportId: bundle.reportId,
      locale: target.locale,
    }),
  });
  return deepFreeze({
    graph,
    plan,
    diagnostics: deepFreeze([
      buildWebPublicationDiagnostic({
        code: "runtime_job_created",
        severity: "info",
        message: "A runtime graph was created for deterministic web publication planning.",
        reportId: bundle.reportId,
        metadata: freezeMetadata({
          locale: target.locale,
        }),
      }),
    ]),
  });
}
