import { createHash } from "node:crypto";

import type { CoordinationJsonObject, CoordinationJsonValue } from "./distributedCoordination";
import type { ExecutionCoordinationRequirement, ExecutionPlan } from "./executionEngine";
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
  readonly path?: string;

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
      path?: string;
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
    this.path = input.path;
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
