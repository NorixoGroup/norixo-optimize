import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { marketReports } from "@/data/marketReports";

import type { CoordinationJsonObject } from "./distributedCoordination";
import {
  buildMarketReportBundleFromPublicMarketSource,
  validatePublicMarketSource,
} from "./publicMarketSourceAdapter";
import {
  generateMarketReportDocument,
  validateMarketReportArtifactBundle,
  type MarketReportArtifactBundle,
} from "./marketReportGeneration";
import {
  assertRegistrySnapshotPublicSafe,
  buildRegistrySnapshotFingerprint,
  parseRegistrySnapshot,
  validateRegistrySnapshot,
  type RegistrySnapshot,
} from "./registryAdapter";
import {
  WEB_ROUTE_ALIAS_TYPES,
  buildDefaultWebPublicationPolicy,
  buildWebPublicationManifest,
  validateWebPublicationManifest,
  type WebPublicationManifest,
  type WebPublicationPolicy,
  type WebPublicationTarget,
} from "./webPublisher";
import {
  buildWebManifestCatalogIndexes,
  normalizeWebManifestCatalogPath,
  type WebManifestCatalogIndexes,
  type WebManifestCatalogAliasIndexEntry,
} from "./webManifestCatalogIndexes";

export const DEFAULT_WEB_MANIFEST_CATALOG_OUTPUT_PATH =
  "data/intelligencePublishing/generated/webPublicationManifests.generated.json";

export const WEB_MANIFEST_CATALOG_SCHEMA_VERSION = 2 as const;
export const WEB_MANIFEST_GENERATOR_VERSION = "ipp-web-materializer-v1";

export const WEB_MANIFEST_MATERIALIZATION_SOURCE_TYPES = Object.freeze([
  "empty",
  "registry_snapshot",
  "market_report_bundle",
  "web_publication_manifest",
  "mixed_collection",
  "catalog_envelope",
] as const);

export type WebManifestMaterializationSourceType =
  (typeof WEB_MANIFEST_MATERIALIZATION_SOURCE_TYPES)[number];

export const WEB_MANIFEST_MATERIALIZATION_OUTPUT_FORMATS = Object.freeze([
  "json",
] as const);

export type WebManifestMaterializationOutputFormat =
  (typeof WEB_MANIFEST_MATERIALIZATION_OUTPUT_FORMATS)[number];

export const WEB_MANIFEST_MATERIALIZATION_DIAGNOSTIC_CODES = Object.freeze([
  "materialization_started",
  "materialization_source_loaded",
  "materialization_source_empty",
  "materialization_candidate_created",
  "materialization_candidate_excluded",
  "materialization_manifest_included",
  "materialization_manifest_excluded",
  "materialization_conflict_detected",
  "materialization_privacy_blocked",
  "materialization_catalog_created",
  "materialization_catalog_unchanged",
  "materialization_catalog_updated",
  "materialization_output_written",
  "materialization_output_skipped",
  "materialization_dry_run_completed",
  "materialization_invalid_source",
  "materialization_invalid_manifest",
  "materialization_strict_failure",
] as const);

export type WebManifestMaterializationDiagnosticCode =
  (typeof WEB_MANIFEST_MATERIALIZATION_DIAGNOSTIC_CODES)[number];

export type WebManifestMaterializationDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export type WebManifestMaterializationDiagnostic = Readonly<{
  code: WebManifestMaterializationDiagnosticCode;
  severity: WebManifestMaterializationDiagnosticSeverity;
  message: string;
  sourcePath: string | null;
  candidateId: string | null;
  reportId: string | null;
  manifestId: string | null;
  outputPath: string | null;
  metadata: CoordinationJsonObject;
}>;

export type WebManifestMaterializationSource = Readonly<{
  sourceType: WebManifestMaterializationSourceType;
  sourcePath: string | null;
  sourceFingerprint: string;
  generatedAt: string | null;
  registrySnapshots: readonly RegistrySnapshot[];
  bundles: readonly MarketReportArtifactBundle[];
  manifests: readonly WebPublicationManifest[];
  metadata: CoordinationJsonObject;
}>;

export type WebManifestMaterializationPolicy = Readonly<{
  allowEmptyCatalog: boolean;
  allowPartialReports: boolean;
  allowStaleReports: boolean;
  allowWarnings: boolean;
  failOnConflict: boolean;
  failOnPrivacyViolation: boolean;
  includeUnchangedManifests: boolean;
  supportedLocales: readonly string[];
  supportedPlatforms: readonly string[];
  outputFormat: WebManifestMaterializationOutputFormat;
  siteOrigin: string;
  defaultLocale: string;
  generatedAt: string | null;
  metadata: CoordinationJsonObject;
}>;

export type WebManifestMaterializationCandidate = Readonly<{
  candidateId: string;
  sourceType: WebManifestMaterializationSourceType;
  reportId: string | null;
  manifestId: string | null;
  registrySnapshot: RegistrySnapshot | null;
  reportBundle: MarketReportArtifactBundle | null;
  publicationManifest: WebPublicationManifest | null;
  decision: WebPublicationManifest["decision"]["decisionType"] | null;
  diagnostics: readonly WebManifestMaterializationDiagnostic[];
  fingerprint: string;
}>;

export type WebManifestCatalogChangeType =
  | "new_catalog"
  | "unchanged_catalog"
  | "updated_catalog";

export type WebManifestCatalogChange = Readonly<{
  changeType: WebManifestCatalogChangeType;
  previousFingerprint: string | null;
  nextFingerprint: string;
  addedManifestIds: readonly string[];
  removedManifestIds: readonly string[];
  updatedManifestIds: readonly string[];
  unchangedManifestIds: readonly string[];
  changedComponents: readonly string[];
  diagnostics: readonly WebManifestMaterializationDiagnostic[];
}>;

export type WebManifestCatalogEnvelope = Readonly<{
  schemaVersion: typeof WEB_MANIFEST_CATALOG_SCHEMA_VERSION;
  generatorVersion: string;
  policyFingerprint: string;
  catalogFingerprint: string;
  generatedAt: string;
  sourceFingerprint: string;
  manifestCount: number;
  manifests: readonly WebPublicationManifest[];
  indexes: WebManifestCatalogIndexes;
  diagnosticsSummary: Readonly<{
    infoCount: number;
    warningCount: number;
    errorCount: number;
    codes: readonly WebManifestMaterializationDiagnosticCode[];
  }>;
  policyVersions: Readonly<Record<string, string>>;
  metadata: CoordinationJsonObject;
}>;

export type WebManifestMaterializationConflict = Readonly<{
  conflictType:
    | "canonical_duplicate"
    | "slug_duplicate"
    | "pathname_duplicate"
    | "alias_self"
    | "alias_circular"
    | "alias_ambiguous"
    | "legacy_route_collision"
    | "canonical_claim_conflict"
    | "non_indexable_in_sitemap"
    | "skip_manifest_public";
  path: string;
  keptManifestId: string | null;
  rejectedManifestId: string | null;
  message: string;
}>;

export type WebManifestMaterializationResult = Readonly<{
  materializationId: string;
  status: "ok" | "empty";
  source: WebManifestMaterializationSource;
  policy: WebManifestMaterializationPolicy;
  candidates: readonly WebManifestMaterializationCandidate[];
  includedManifests: readonly WebPublicationManifest[];
  excludedManifests: readonly WebPublicationManifest[];
  conflicts: readonly WebManifestMaterializationConflict[];
  diagnostics: readonly WebManifestMaterializationDiagnostic[];
  catalogFingerprint: string;
  generatedAt: string;
  outputPath: string | null;
  outputFingerprint: string | null;
  change: WebManifestCatalogChange;
  envelope: WebManifestCatalogEnvelope;
}>;

export type LoadWebManifestMaterializationSourceInput = Readonly<{
  sourcePath?: string | null;
  metadata?: CoordinationJsonObject;
}>;

export type MaterializeWebPublicationManifestsInput = Readonly<{
  source: WebManifestMaterializationSource;
  policy?: Partial<WebManifestMaterializationPolicy>;
  previousCatalog?: WebManifestCatalogEnvelope | null;
  outputPath?: string | null;
}>;

export type WriteWebManifestCatalogInput = Readonly<{
  envelope: WebManifestCatalogEnvelope;
  outputPath: string;
  previousCatalog?: WebManifestCatalogEnvelope | null;
}>;

export class WebManifestMaterializationError extends Error {
  readonly code:
    | "invalid_input"
    | "invalid_source"
    | "invalid_snapshot"
    | "invalid_bundle"
    | "invalid_manifest"
    | "invalid_catalog"
    | "privacy_violation"
    | "route_conflict"
    | "strict_failure"
    | "serialization_error"
    | "io_error";
  readonly operation: string;
  readonly sourcePath?: string;
  readonly candidateId?: string;
  readonly reportId?: string;
  readonly manifestId?: string;
  readonly outputPath?: string;
  readonly cause?: unknown;

  constructor(
    input: Readonly<{
      code:
        | "invalid_input"
        | "invalid_source"
        | "invalid_snapshot"
        | "invalid_bundle"
        | "invalid_manifest"
        | "invalid_catalog"
        | "privacy_violation"
        | "route_conflict"
        | "strict_failure"
        | "serialization_error"
        | "io_error";
      operation: string;
      message: string;
      sourcePath?: string;
      candidateId?: string;
      reportId?: string;
      manifestId?: string;
      outputPath?: string;
      cause?: unknown;
    }>,
  ) {
    super(input.message);
    this.name = "WebManifestMaterializationError";
    this.code = input.code;
    this.operation = input.operation;
    this.sourcePath = input.sourcePath;
    this.candidateId = input.candidateId;
    this.reportId = input.reportId;
    this.manifestId = input.manifestId;
    this.outputPath = input.outputPath;
    this.cause = input.cause;
  }
}

type JsonLike =
  | null
  | boolean
  | number
  | string
  | readonly JsonLike[]
  | { readonly [key: string]: JsonLike };

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
  "cookie",
  "rawpayload",
  "privatecomparablesignature",
  "secret",
  "secrets",
]);

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

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

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.entries(value)
      .sort((left, right) => compareStrings(left[0], right[0]))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashFingerprint(prefix: string, value: unknown): string {
  return `${prefix}${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function freezeMetadata(
  metadata?: CoordinationJsonObject,
): CoordinationJsonObject {
  return deepFreeze({ ...(metadata ?? {}) });
}

function assertNoForbiddenPrivateKeys(value: unknown, pathLabel: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoForbiddenPrivateKeys(entry, `${pathLabel}[${index}]`),
    );
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const nextPath = `${pathLabel}.${key}`;
    if (FORBIDDEN_PRIVATE_KEYS.has(normalizedKey)) {
      throw new WebManifestMaterializationError({
        code: "privacy_violation",
        operation: "assertNoForbiddenPrivateKeys",
        message: `Forbidden private field detected at ${nextPath}.`,
      });
    }
    assertNoForbiddenPrivateKeys(child, nextPath);
  }
}

function normalizeDiagnosticsMetadata(
  metadata?: CoordinationJsonObject,
): CoordinationJsonObject {
  const normalized = freezeMetadata(metadata);
  assertNoForbiddenPrivateKeys(normalized, "diagnostic.metadata");
  JSON.stringify(normalized);
  return normalized;
}

function buildDiagnostic(
  input: Readonly<{
    code: WebManifestMaterializationDiagnosticCode;
    severity: WebManifestMaterializationDiagnosticSeverity;
    message: string;
    sourcePath?: string | null;
    candidateId?: string | null;
    reportId?: string | null;
    manifestId?: string | null;
    outputPath?: string | null;
    metadata?: CoordinationJsonObject;
  }>,
): WebManifestMaterializationDiagnostic {
  return deepFreeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    sourcePath: input.sourcePath ?? null,
    candidateId: input.candidateId ?? null,
    reportId: input.reportId ?? null,
    manifestId: input.manifestId ?? null,
    outputPath: input.outputPath ?? null,
    metadata: normalizeDiagnosticsMetadata(input.metadata),
  });
}

function buildDefaultPolicy(
  overrides: Partial<WebManifestMaterializationPolicy> = {},
): WebManifestMaterializationPolicy {
  const generatedAt =
    overrides.generatedAt === undefined ? null : overrides.generatedAt;
  if (generatedAt != null && !isCanonicalIsoTimestamp(generatedAt)) {
    throw new WebManifestMaterializationError({
      code: "invalid_input",
      operation: "buildDefaultPolicy",
      message: "policy.generatedAt must be a canonical ISO timestamp when present.",
    });
  }
  const basePolicy = {
    allowEmptyCatalog: true,
    allowPartialReports: true,
    allowStaleReports: true,
    allowWarnings: true,
    failOnConflict: false,
    failOnPrivacyViolation: true,
    includeUnchangedManifests: true,
    supportedLocales: deepFreeze(["en"]),
    supportedPlatforms: deepFreeze([]),
    outputFormat: "json",
    siteOrigin: "https://norixo.io",
    defaultLocale: "en",
    generatedAt,
    metadata: freezeMetadata({}),
    ...overrides,
  } satisfies Omit<WebManifestMaterializationPolicy, "supportedLocales" | "supportedPlatforms" | "metadata"> &
    Partial<
      Pick<
        WebManifestMaterializationPolicy,
        "supportedLocales" | "supportedPlatforms" | "metadata"
      >
    >;

  return deepFreeze({
    ...basePolicy,
    supportedLocales: deepFreeze([
      ...new Set(basePolicy.supportedLocales ?? ["en"]),
    ].sort(compareStrings)),
    supportedPlatforms: deepFreeze([
      ...new Set(basePolicy.supportedPlatforms ?? []),
    ].sort(compareStrings)),
    metadata: freezeMetadata(basePolicy.metadata),
  });
}

function buildKnownLegacyRoutes(): readonly string[] {
  return deepFreeze(
    marketReports
      .map((report) => `/reports/${report.slug}`)
      .sort(compareStrings),
  );
}

function buildTarget(locale: string, policy: WebManifestMaterializationPolicy): WebPublicationTarget {
  return deepFreeze({
    channel: "web",
    baseUrl: policy.siteOrigin,
    locale,
    environment: "next_app",
    publicationMode: "canonical_with_legacy_alias",
    defaultLocale: policy.defaultLocale,
    localizedRouteStrategy: "default_unprefixed",
    metadata: freezeMetadata({
      materializedAtBuildTime: true,
    }),
  });
}

function sortManifests(
  manifests: readonly WebPublicationManifest[],
): readonly WebPublicationManifest[] {
  return deepFreeze(
    [...manifests].sort((left, right) => {
      const byPath = compareStrings(
        left.route.canonical.pathname,
        right.route.canonical.pathname,
      );
      if (byPath !== 0) return byPath;
      const byLocale = compareStrings(left.target.locale, right.target.locale);
      if (byLocale !== 0) return byLocale;
      return compareStrings(left.manifestId, right.manifestId);
    }),
  );
}

function normalizePath(pathname: string): string {
  return normalizeWebManifestCatalogPath(pathname);
}

function manifestIsRenderable(
  manifest: WebPublicationManifest,
): boolean {
  return manifest.publication.renderable;
}

function validatePrivacyForValue(
  value: unknown,
  operation: string,
): void {
  try {
    assertNoForbiddenPrivateKeys(value, operation);
  } catch (error) {
    if (error instanceof WebManifestMaterializationError) {
      throw error;
    }
    throw new WebManifestMaterializationError({
      code: "privacy_violation",
      operation,
      message: "A privacy violation was detected.",
      cause: error,
    });
  }
}

function summarizeDiagnostics(
  diagnostics: readonly WebManifestMaterializationDiagnostic[],
): WebManifestCatalogEnvelope["diagnosticsSummary"] {
  return deepFreeze({
    infoCount: diagnostics.filter((diagnostic) => diagnostic.severity === "info")
      .length,
    warningCount: diagnostics.filter(
      (diagnostic) => diagnostic.severity === "warning",
    ).length,
    errorCount: diagnostics.filter((diagnostic) => diagnostic.severity === "error")
      .length,
    codes: deepFreeze(
      [...new Set(diagnostics.map((diagnostic) => diagnostic.code))].sort(
        compareStrings,
      ) as readonly WebManifestMaterializationDiagnosticCode[],
    ),
  });
}

function buildPersistedDiagnosticsSummary(
  diagnostics: readonly WebManifestMaterializationDiagnostic[],
): WebManifestCatalogEnvelope["diagnosticsSummary"] {
  return summarizeDiagnostics(
    diagnostics.filter(
      (diagnostic) =>
        diagnostic.code !== "materialization_catalog_created" &&
        diagnostic.code !== "materialization_catalog_unchanged" &&
        diagnostic.code !== "materialization_catalog_updated" &&
        diagnostic.code !== "materialization_output_written" &&
        diagnostic.code !== "materialization_output_skipped",
    ),
  );
}

function detectManifestPolicyVersions(
  manifests: readonly WebPublicationManifest[],
): Readonly<Record<string, string>> {
  const entries = new Map<string, string>();
  for (const manifest of manifests) {
    for (const [key, value] of Object.entries(manifest.policyVersions)) {
      if (!entries.has(key)) {
        entries.set(key, value);
      }
    }
  }
  return deepFreeze(
    Object.fromEntries(
      [...entries.entries()].sort((left, right) =>
        compareStrings(left[0], right[0]),
      ),
    ),
  );
}

function detectManifestPolicyFingerprint(
  manifests: readonly WebPublicationManifest[],
  policyVersions: Readonly<Record<string, string>>,
): string {
  const fingerprints = [...new Set(
    manifests
      .map((manifest) => manifest.publication.policyFingerprint)
      .filter((entry): entry is string => isNonEmptyString(entry)),
  )].sort(compareStrings);

  if (fingerprints.length === 1) {
    return fingerprints[0]!;
  }

  return hashFingerprint("ipp_web_manifest_policy_", {
    policyFingerprints: fingerprints,
    policyVersions,
  });
}

function buildCatalogFingerprint(input: Readonly<{
  schemaVersion: typeof WEB_MANIFEST_CATALOG_SCHEMA_VERSION;
  policyFingerprint: string;
  manifests: readonly WebPublicationManifest[];
  indexes: WebManifestCatalogIndexes;
}>): string {
  return hashFingerprint("ipp_web_manifest_catalog_", {
    schemaVersion: input.schemaVersion,
    policyFingerprint: input.policyFingerprint,
    manifestCount: input.manifests.length,
    manifests: input.manifests.map((manifest) => ({
      manifestId: manifest.manifestId,
      publicationFingerprint: manifest.publicationFingerprint,
      canonicalPath: manifest.publication.canonicalPath,
    })),
    indexes: input.indexes,
  });
}

function resolveGeneratedAt(
  source: WebManifestMaterializationSource,
  policy: WebManifestMaterializationPolicy,
  previousCatalog?: WebManifestCatalogEnvelope | null,
): string {
  const explicit = policy.generatedAt;
  if (explicit != null) {
    return explicit;
  }
  if (source.generatedAt != null) {
    return source.generatedAt;
  }
  if (previousCatalog != null) {
    return previousCatalog.generatedAt;
  }
  throw new WebManifestMaterializationError({
    code: "invalid_input",
    operation: "resolveGeneratedAt",
    message:
      "generatedAt must be provided explicitly when the source does not include one.",
  });
}

function validateJsonSerializable(
  value: unknown,
  operation: string,
): void {
  try {
    JSON.stringify(value);
  } catch (error) {
    throw new WebManifestMaterializationError({
      code: "serialization_error",
      operation,
      message: "Expected a JSON-serializable value.",
      cause: error,
    });
  }
}

function parseCatalogEnvelopeCandidate(
  input: unknown,
): WebManifestCatalogEnvelope | null {
  if (!isPlainObject(input)) {
    return null;
  }
  if (
    input.schemaVersion !== WEB_MANIFEST_CATALOG_SCHEMA_VERSION ||
    !Array.isArray(input.manifests)
  ) {
    return null;
  }
  const validation = validateWebManifestCatalogEnvelope(input);
  return validation.ok ? validation.envelope : null;
}

function buildPolicyOverridesFromSourceMetadata(
  source: WebManifestMaterializationSource,
): Partial<WebManifestMaterializationPolicy> {
  const metadata = source.metadata as Record<string, unknown>;
  const defaultLocale =
    typeof metadata.defaultLocale === "string" && metadata.defaultLocale.trim().length > 0
      ? metadata.defaultLocale.trim().toLowerCase()
      : null;
  const siteOrigin =
    typeof metadata.siteOrigin === "string" && metadata.siteOrigin.trim().length > 0
      ? metadata.siteOrigin.trim()
      : null;
  const supportedLocales = Array.isArray(metadata.supportedLocales)
    ? metadata.supportedLocales
        .map((entry) =>
          typeof entry === "string" ? entry.trim().toLowerCase() : "",
        )
        .filter((entry) => entry.length > 0)
    : [];

  return deepFreeze({
    ...(defaultLocale == null ? {} : { defaultLocale }),
    ...(siteOrigin == null ? {} : { siteOrigin }),
    ...(supportedLocales.length === 0 ? {} : { supportedLocales }),
  });
}

function parseSourceDocument(
  input: unknown,
  sourcePath: string | null,
): WebManifestMaterializationSource {
  if (input == null) {
    return deepFreeze({
      sourceType: "empty",
      sourcePath,
      sourceFingerprint: hashFingerprint("ipp_web_source_", { empty: true }),
      generatedAt: null,
      registrySnapshots: deepFreeze([]),
      bundles: deepFreeze([]),
      manifests: deepFreeze([]),
      metadata: freezeMetadata({
        empty: true,
      }),
    });
  }

  const envelope = parseCatalogEnvelopeCandidate(input);
  if (envelope != null) {
    return deepFreeze({
      sourceType: "catalog_envelope",
      sourcePath,
      sourceFingerprint: envelope.sourceFingerprint,
      generatedAt: envelope.generatedAt,
      registrySnapshots: deepFreeze([]),
      bundles: deepFreeze([]),
      manifests: sortManifests(envelope.manifests),
      metadata: freezeMetadata({
        schemaVersion: envelope.schemaVersion,
        generatorVersion: envelope.generatorVersion,
        policyFingerprint: envelope.policyFingerprint,
        manifestCount: envelope.manifestCount,
      }),
    });
  }

  const publicSourceValidation = validatePublicMarketSource(input);
  if (publicSourceValidation.ok) {
    const built = buildMarketReportBundleFromPublicMarketSource(
      publicSourceValidation.source,
    );
    validatePrivacyForValue(built.bundle, "source.publicMarket.bundle");
    return deepFreeze({
      sourceType: "market_report_bundle",
      sourcePath,
      sourceFingerprint: built.sourceFingerprint,
      generatedAt: built.source.generatedAt,
      registrySnapshots: deepFreeze([]),
      bundles: deepFreeze([built.bundle]),
      manifests: deepFreeze([]),
      metadata: freezeMetadata({
        sourceKind: built.source.sourceKind,
        snapshotFingerprint: built.snapshotFingerprint,
        defaultLocale: built.source.publication.defaultLocale,
        siteOrigin: built.source.publication.siteOrigin,
        supportedLocales: [built.source.publication.primaryLocale],
        canonicalSlug: built.source.publication.canonicalSlug,
        knownStaticRoutes: [...built.source.publication.knownStaticRoutes],
        requiredMetrics: [...built.source.publication.requiredMetrics],
        optionalMetrics: [...built.source.publication.optionalMetrics],
      }),
    });
  }
  if (
    isPlainObject(input) &&
    (input.sourceKind === "public_market_report_source" ||
      input.sourceVersion === "ipp_public_market_source_v1")
  ) {
    throw new WebManifestMaterializationError({
      code: "invalid_source",
      operation: "parseSourceDocument",
      sourcePath: sourcePath ?? undefined,
      message: publicSourceValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | "),
    });
  }

  const manifestValidation = validateWebPublicationManifest(input);
  if (manifestValidation.ok) {
    validatePrivacyForValue(manifestValidation.manifest, "source.manifest");
    return deepFreeze({
      sourceType: "web_publication_manifest",
      sourcePath,
      sourceFingerprint: hashFingerprint("ipp_web_source_", {
        manifestId: manifestValidation.manifest.manifestId,
        publicationFingerprint:
          manifestValidation.manifest.publicationFingerprint,
      }),
      generatedAt: manifestValidation.manifest.generatedAt,
      registrySnapshots: deepFreeze([]),
      bundles: deepFreeze([]),
      manifests: deepFreeze([manifestValidation.manifest]),
      metadata: freezeMetadata({ manifestCount: 1 }),
    });
  }
  if (
    isPlainObject(input) &&
    ("manifestId" in input || "publicationFingerprint" in input || "route" in input)
  ) {
    const message = manifestValidation.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join(" | ");
    throw new WebManifestMaterializationError({
      code: message.toLowerCase().includes("private field")
        ? "privacy_violation"
        : "invalid_manifest",
      operation: "parseSourceDocument",
      sourcePath: sourcePath ?? undefined,
      message,
    });
  }

  const bundleValidation = validateMarketReportArtifactBundle(input);
  if (bundleValidation.ok) {
    validatePrivacyForValue(bundleValidation.bundle, "source.bundle");
    return deepFreeze({
      sourceType: "market_report_bundle",
      sourcePath,
      sourceFingerprint: hashFingerprint("ipp_web_source_", {
        bundleId: bundleValidation.bundle.bundleId,
        reportFingerprint: bundleValidation.bundle.reportFingerprint,
      }),
      generatedAt: bundleValidation.bundle.document.generatedAt,
      registrySnapshots: deepFreeze([]),
      bundles: deepFreeze([bundleValidation.bundle]),
      manifests: deepFreeze([]),
      metadata: freezeMetadata({ bundleCount: 1 }),
    });
  }
  if (
    isPlainObject(input) &&
    ("bundleId" in input || "document" in input || "metadataArtifact" in input)
  ) {
    throw new WebManifestMaterializationError({
      code: "invalid_bundle",
      operation: "parseSourceDocument",
      sourcePath: sourcePath ?? undefined,
      message: bundleValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | "),
    });
  }

  const snapshotValidation = validateRegistrySnapshot(input);
  if (snapshotValidation.ok) {
    assertRegistrySnapshotPublicSafe(snapshotValidation.snapshot);
    return deepFreeze({
      sourceType: "registry_snapshot",
      sourcePath,
      sourceFingerprint: buildRegistrySnapshotFingerprint(
        snapshotValidation.snapshot,
      ),
      generatedAt: snapshotValidation.snapshot.generatedAt,
      registrySnapshots: deepFreeze([snapshotValidation.snapshot]),
      bundles: deepFreeze([]),
      manifests: deepFreeze([]),
      metadata: freezeMetadata({ snapshotCount: 1 }),
    });
  }
  if (
    isPlainObject(input) &&
    ("snapshotId" in input || "assets" in input || "assetVersions" in input)
  ) {
    throw new WebManifestMaterializationError({
      code: "invalid_snapshot",
      operation: "parseSourceDocument",
      sourcePath: sourcePath ?? undefined,
      message: snapshotValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | "),
    });
  }

  if (isPlainObject(input)) {
    const registrySnapshots = Array.isArray(input.registrySnapshots)
      ? input.registrySnapshots.map((entry) => {
          const validation = validateRegistrySnapshot(entry);
          if (!validation.ok) {
            throw new WebManifestMaterializationError({
              code: "invalid_snapshot",
              operation: "parseSourceDocument",
              sourcePath: sourcePath ?? undefined,
              message: validation.issues
                .map((issue) => `${issue.path}: ${issue.message}`)
                .join(" | "),
            });
          }
          assertRegistrySnapshotPublicSafe(validation.snapshot);
          return validation.snapshot;
        })
      : [];
    const bundles = Array.isArray(input.bundles)
      ? input.bundles.map((entry) => {
          const validation = validateMarketReportArtifactBundle(entry);
          if (!validation.ok) {
            throw new WebManifestMaterializationError({
              code: "invalid_bundle",
              operation: "parseSourceDocument",
              sourcePath: sourcePath ?? undefined,
              message: validation.issues
                .map((issue) => `${issue.path}: ${issue.message}`)
                .join(" | "),
            });
          }
          validatePrivacyForValue(validation.bundle, "source.bundles");
          return validation.bundle;
        })
      : [];
    const manifests = Array.isArray(input.manifests)
      ? input.manifests.map((entry) => {
          const validation = validateWebPublicationManifest(entry);
          if (!validation.ok) {
            throw new WebManifestMaterializationError({
              code: "invalid_manifest",
              operation: "parseSourceDocument",
              sourcePath: sourcePath ?? undefined,
              message: validation.issues
                .map((issue) => `${issue.path}: ${issue.message}`)
                .join(" | "),
            });
          }
          validatePrivacyForValue(validation.manifest, "source.manifests");
          return validation.manifest;
        })
      : [];
    if (
      registrySnapshots.length > 0 ||
      bundles.length > 0 ||
      manifests.length > 0
    ) {
      const sortedRegistrySnapshots = [...registrySnapshots].sort((left, right) =>
        compareStrings(
          buildRegistrySnapshotFingerprint(left),
          buildRegistrySnapshotFingerprint(right),
        ),
      );
      const sortedBundles = [...bundles].sort((left, right) =>
        compareStrings(left.reportId, right.reportId),
      );
      const sortedManifests = sortManifests(manifests);
      const generatedAtCandidate =
        typeof input.generatedAt === "string" && isCanonicalIsoTimestamp(input.generatedAt)
          ? input.generatedAt
          : sortedRegistrySnapshots[0]?.generatedAt ??
            sortedBundles[0]?.document.generatedAt ??
            sortedManifests[0]?.generatedAt ??
            null;
      return deepFreeze({
        sourceType: "mixed_collection",
        sourcePath,
        sourceFingerprint: hashFingerprint("ipp_web_source_", {
          registrySnapshots: sortedRegistrySnapshots.map((snapshot) =>
            buildRegistrySnapshotFingerprint(snapshot),
          ),
          bundles: sortedBundles.map((bundle) => bundle.reportFingerprint),
          manifests: sortedManifests.map((manifest) => manifest.publicationFingerprint),
        }),
        generatedAt: generatedAtCandidate,
        registrySnapshots: deepFreeze(sortedRegistrySnapshots),
        bundles: deepFreeze(sortedBundles),
        manifests: sortedManifests,
        metadata: freezeMetadata({
          snapshotCount: registrySnapshots.length,
          bundleCount: bundles.length,
          manifestCount: manifests.length,
        }),
      });
    }
  }

  throw new WebManifestMaterializationError({
    code: "invalid_source",
    operation: "parseSourceDocument",
    sourcePath: sourcePath ?? undefined,
    message:
      "Unsupported source document. Expected a RegistrySnapshot, MarketReportArtifactBundle, WebPublicationManifest, catalog envelope, or mixed collection.",
  });
}

export async function loadWebManifestMaterializationSource(
  input: LoadWebManifestMaterializationSourceInput = {},
): Promise<WebManifestMaterializationSource> {
  if (!isNonEmptyString(input.sourcePath ?? "")) {
    return parseSourceDocument(null, null);
  }
  const sourcePath = path.normalize(input.sourcePath!.trim());
  let raw: string;
  try {
    raw = await readFile(sourcePath, "utf8");
  } catch (error) {
    throw new WebManifestMaterializationError({
      code: "io_error",
      operation: "loadWebManifestMaterializationSource",
      sourcePath,
      message: "Unable to read the materialization source file.",
      cause: error,
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as JsonLike;
  } catch (error) {
    throw new WebManifestMaterializationError({
      code: "invalid_source",
      operation: "loadWebManifestMaterializationSource",
      sourcePath,
      message: "Source file is not valid JSON.",
      cause: error,
    });
  }
  return parseSourceDocument(parsed, sourcePath);
}

export function validateWebManifestMaterializationSource(
  source: WebManifestMaterializationSource,
): Readonly<{ ok: true; source: WebManifestMaterializationSource }> {
  validatePrivacyForValue(source, "materialization.source");
  validateJsonSerializable(source, "validateWebManifestMaterializationSource");
  return { ok: true, source };
}

function buildCandidatesFromManifests(
  manifests: readonly WebPublicationManifest[],
  sourceType: WebManifestMaterializationSourceType,
): readonly WebManifestMaterializationCandidate[] {
  return deepFreeze(
    manifests.map((manifest) =>
      deepFreeze({
        candidateId: hashFingerprint("ipp_web_candidate_", {
          manifestId: manifest.manifestId,
          publicationFingerprint: manifest.publicationFingerprint,
          sourceType,
        }),
        sourceType,
        reportId: manifest.reportId,
        manifestId: manifest.manifestId,
        registrySnapshot: null,
        reportBundle: null,
        publicationManifest: manifest,
        decision: manifest.decision.decisionType,
        diagnostics: deepFreeze([]),
        fingerprint: hashFingerprint("ipp_web_candidate_fp_", {
          manifestId: manifest.manifestId,
          publicationFingerprint: manifest.publicationFingerprint,
        }),
      }),
    ),
  );
}

function buildBundlesFromSnapshots(
  snapshots: readonly RegistrySnapshot[],
  policy: WebManifestMaterializationPolicy,
): Readonly<{
  bundles: readonly MarketReportArtifactBundle[];
  diagnostics: readonly WebManifestMaterializationDiagnostic[];
}> {
  const bundles: MarketReportArtifactBundle[] = [];
  const diagnostics: WebManifestMaterializationDiagnostic[] = [];
  for (const snapshot of snapshots) {
    const reportAssets = snapshot.assets
      .filter((asset) => asset.assetType === "market_report")
      .sort((left, right) => compareStrings(left.assetId, right.assetId));
    for (const asset of reportAssets) {
      const locales = (asset.availableLocales.length > 0
        ? asset.availableLocales
        : [asset.defaultLocale]
      )
        .filter((locale) =>
          policy.supportedLocales.length === 0
            ? true
            : policy.supportedLocales.includes(locale),
        )
        .sort(compareStrings);
      for (const locale of locales) {
        try {
          const bundle = generateMarketReportDocument({
            registrySnapshot: snapshot,
            reportAssetKey: asset.assetId,
            locale,
            generatedAt: resolveGeneratedAt(
              deepFreeze({
                sourceType: "registry_snapshot",
                sourcePath: null,
                sourceFingerprint: buildRegistrySnapshotFingerprint(snapshot),
                generatedAt: snapshot.generatedAt,
                registrySnapshots: deepFreeze([snapshot]),
                bundles: deepFreeze([]),
                manifests: deepFreeze([]),
                metadata: freezeMetadata({}),
              }),
              policy,
              null,
            ),
            canonicalBaseUrl: policy.siteOrigin,
          });
          validatePrivacyForValue(bundle, "candidate.bundle");
          bundles.push(bundle);
          diagnostics.push(
            buildDiagnostic({
              code: "materialization_candidate_created",
              severity: "info",
              reportId: bundle.reportId,
              message: "A market report bundle candidate was generated from a registry snapshot.",
              metadata: freezeMetadata({
                sourceType: "registry_snapshot",
                locale,
                assetId: asset.assetId,
              }),
            }),
          );
        } catch (error) {
          diagnostics.push(
            buildDiagnostic({
              code: "materialization_candidate_excluded",
              severity: "warning",
              reportId: asset.assetId,
              message:
                error instanceof Error
                  ? error.message
                  : "A registry snapshot candidate could not be materialized.",
              metadata: freezeMetadata({
                sourceType: "registry_snapshot",
                locale,
                assetId: asset.assetId,
              }),
            }),
          );
        }
      }
    }
  }
  return deepFreeze({
    bundles: deepFreeze(bundles.sort((left, right) => compareStrings(left.reportId, right.reportId))),
    diagnostics: deepFreeze(diagnostics),
  });
}

function buildManifestsFromBundles(
  bundles: readonly MarketReportArtifactBundle[],
  policy: WebManifestMaterializationPolicy,
): Readonly<{
  manifests: readonly WebPublicationManifest[];
  diagnostics: readonly WebManifestMaterializationDiagnostic[];
}> {
  const manifests: WebPublicationManifest[] = [];
  const diagnostics: WebManifestMaterializationDiagnostic[] = [];
  const sortedBundles = [...bundles].sort((left, right) =>
    compareStrings(left.reportId, right.reportId),
  );
  for (const bundle of sortedBundles) {
    try {
      const platform = bundle.document.identity.platform;
      if (
        policy.supportedPlatforms.length > 0 &&
        !policy.supportedPlatforms.includes(platform)
      ) {
        diagnostics.push(
          buildDiagnostic({
            code: "materialization_candidate_excluded",
            severity: "info",
            reportId: bundle.reportId,
            message:
              "A bundle was excluded because its platform is not in the supported platforms policy.",
            metadata: freezeMetadata({
              platform,
            }),
          }),
        );
        continue;
      }

      const manifest = buildWebPublicationManifest({
        bundle,
        target: buildTarget(bundle.document.identity.locale, policy),
        generatedAt: resolveGeneratedAt(
          deepFreeze({
            sourceType: "market_report_bundle",
            sourcePath: null,
            sourceFingerprint: hashFingerprint("ipp_web_source_", {
              bundleId: bundle.bundleId,
              reportFingerprint: bundle.reportFingerprint,
            }),
            generatedAt: bundle.document.generatedAt,
            registrySnapshots: deepFreeze([]),
            bundles: deepFreeze([bundle]),
            manifests: deepFreeze([]),
            metadata: freezeMetadata({}),
          }),
          policy,
          null,
        ),
        policy: buildDefaultWebPublicationPolicy({
          allowPartialReports: policy.allowPartialReports,
          allowStaleReports: policy.allowStaleReports,
        }),
        existingManifests: manifests,
        siblingBundles: sortedBundles,
        knownStaticRoutes: buildKnownLegacyRoutes(),
      });
      validatePrivacyForValue(manifest, "candidate.manifest");
      manifests.push(manifest);
      diagnostics.push(
        buildDiagnostic({
          code: "materialization_candidate_created",
          severity: "info",
          reportId: manifest.reportId,
          manifestId: manifest.manifestId,
          message: "A publication manifest candidate was generated from a market report bundle.",
          metadata: freezeMetadata({
            sourceType: "market_report_bundle",
            decisionType: manifest.decision.decisionType,
          }),
        }),
      );
    } catch (error) {
      diagnostics.push(
        buildDiagnostic({
          code: "materialization_invalid_manifest",
          severity: "warning",
          reportId: bundle.reportId,
          message:
            error instanceof Error
              ? error.message
              : "A bundle could not be converted into a valid publication manifest.",
          metadata: freezeMetadata({
            sourceType: "market_report_bundle",
          }),
        }),
      );
    }
  }
  return deepFreeze({
    manifests: sortManifests(manifests),
    diagnostics: deepFreeze(diagnostics),
  });
}

export function buildWebManifestMaterializationCandidates(
  source: WebManifestMaterializationSource,
  policy: WebManifestMaterializationPolicy,
): Readonly<{
  candidates: readonly WebManifestMaterializationCandidate[];
  diagnostics: readonly WebManifestMaterializationDiagnostic[];
}> {
  validateWebManifestMaterializationSource(source);
  const diagnostics: WebManifestMaterializationDiagnostic[] = [];
  const snapshotResult = buildBundlesFromSnapshots(source.registrySnapshots, policy);
  diagnostics.push(...snapshotResult.diagnostics);

  const directBundles = [...source.bundles, ...snapshotResult.bundles].sort(
    (left, right) => compareStrings(left.reportId, right.reportId),
  );
  const manifestBuild = buildManifestsFromBundles(directBundles, policy);
  diagnostics.push(...manifestBuild.diagnostics);

  const directCandidates = buildCandidatesFromManifests(
    source.manifests,
    source.sourceType === "catalog_envelope"
      ? "catalog_envelope"
      : "web_publication_manifest",
  );
  const builtCandidates = buildCandidatesFromManifests(
    manifestBuild.manifests,
    source.registrySnapshots.length > 0 && source.bundles.length === 0
      ? "registry_snapshot"
      : "market_report_bundle",
  );

  return deepFreeze({
    candidates: deepFreeze(
      [...directCandidates, ...builtCandidates].sort((left, right) =>
        compareStrings(left.candidateId, right.candidateId),
      ),
    ),
    diagnostics: deepFreeze(diagnostics),
  });
}

function detectConflicts(
  manifests: readonly WebPublicationManifest[],
): readonly WebManifestMaterializationConflict[] {
  const conflicts: WebManifestMaterializationConflict[] = [];
  const canonicalOwners = new Map<string, WebPublicationManifest>();
  const slugOwners = new Map<string, WebPublicationManifest>();
  const aliasOwners = new Map<string, WebPublicationManifest>();
  const legacyRoutes = new Set(buildKnownLegacyRoutes());

  for (const manifest of manifests) {
    const canonicalPath = normalizePath(manifest.route.canonical.pathname);
    const slug = manifest.route.canonical.slug;
    const existingCanonical = canonicalOwners.get(canonicalPath);
    if (existingCanonical && existingCanonical.manifestId !== manifest.manifestId) {
      conflicts.push(
        deepFreeze({
          conflictType: "canonical_duplicate",
          path: canonicalPath,
          keptManifestId: existingCanonical.manifestId,
          rejectedManifestId: manifest.manifestId,
          message: "Multiple manifests claim the same canonical pathname.",
        }),
      );
    } else {
      canonicalOwners.set(canonicalPath, manifest);
    }

    const existingSlug = slugOwners.get(slug);
    if (existingSlug && existingSlug.manifestId !== manifest.manifestId) {
      conflicts.push(
        deepFreeze({
          conflictType: "slug_duplicate",
          path: slug,
          keptManifestId: existingSlug.manifestId,
          rejectedManifestId: manifest.manifestId,
          message: "Multiple manifests claim the same canonical slug.",
        }),
      );
    } else {
      slugOwners.set(slug, manifest);
    }

    if (!manifest.publication.indexable && manifest.sitemapEntry != null) {
      conflicts.push(
        deepFreeze({
          conflictType: "non_indexable_in_sitemap",
          path: canonicalPath,
          keptManifestId: null,
          rejectedManifestId: manifest.manifestId,
          message: "A non-indexable manifest cannot remain in the public sitemap.",
        }),
      );
    }

    if (!manifest.publication.renderable) {
      conflicts.push(
        deepFreeze({
          conflictType: "skip_manifest_public",
          path: canonicalPath,
          keptManifestId: null,
          rejectedManifestId: manifest.manifestId,
          message: "A non-renderable manifest must not be included in the public catalog.",
        }),
      );
    }

    if (legacyRoutes.has(canonicalPath) && !manifest.route.canonical.isLegacySlug) {
      conflicts.push(
        deepFreeze({
          conflictType: "legacy_route_collision",
          path: canonicalPath,
          keptManifestId: null,
          rejectedManifestId: manifest.manifestId,
          message: "A canonical IPP route collides with a preserved legacy route.",
        }),
      );
    }

    for (const alias of manifest.aliases) {
      const fromPath = normalizePath(alias.fromPath);
      const toPath = normalizePath(alias.toPath);
      if (fromPath === toPath) {
        conflicts.push(
          deepFreeze({
            conflictType: "alias_self",
            path: fromPath,
            keptManifestId: null,
            rejectedManifestId: manifest.manifestId,
            message: "An alias cannot point to itself.",
          }),
        );
      }
      if (
        legacyRoutes.has(fromPath) &&
        alias.aliasType !== "historical_static_route"
      ) {
        conflicts.push(
          deepFreeze({
            conflictType: "legacy_route_collision",
            path: fromPath,
            keptManifestId: null,
            rejectedManifestId: manifest.manifestId,
            message: "An alias collides with a preserved legacy route.",
          }),
        );
      }
      const existingAlias = aliasOwners.get(fromPath);
      if (existingAlias && existingAlias.manifestId !== manifest.manifestId) {
        conflicts.push(
          deepFreeze({
            conflictType: "alias_ambiguous",
            path: fromPath,
            keptManifestId: existingAlias.manifestId,
            rejectedManifestId: manifest.manifestId,
            message: "Multiple manifests claim the same alias path.",
          }),
        );
      } else {
        aliasOwners.set(fromPath, manifest);
      }
      if (aliasOwners.has(toPath) && aliasOwners.get(toPath)?.manifestId === manifest.manifestId) {
        conflicts.push(
          deepFreeze({
            conflictType: "alias_circular",
            path: fromPath,
            keptManifestId: null,
            rejectedManifestId: manifest.manifestId,
            message: "Aliases must not create circular path ownership.",
          }),
        );
      }
    }
  }

  return deepFreeze(
    conflicts.sort((left, right) => {
      const byType = compareStrings(left.conflictType, right.conflictType);
      if (byType !== 0) return byType;
      return compareStrings(left.path, right.path);
    }),
  );
}

export function detectWebManifestCatalogChange(
  previousCatalog: WebManifestCatalogEnvelope | null,
  nextCatalog: WebManifestCatalogEnvelope,
): WebManifestCatalogChange {
  const previousManifests = new Map(
    (previousCatalog?.manifests ?? []).map((manifest) => [
      manifest.manifestId,
      manifest,
    ]),
  );
  const nextManifests = new Map(
    nextCatalog.manifests.map((manifest) => [manifest.manifestId, manifest]),
  );

  const addedManifestIds: string[] = [];
  const removedManifestIds: string[] = [];
  const updatedManifestIds: string[] = [];
  const unchangedManifestIds: string[] = [];

  for (const [manifestId, nextManifest] of nextManifests.entries()) {
    const previousManifest = previousManifests.get(manifestId);
    if (!previousManifest) {
      addedManifestIds.push(manifestId);
      continue;
    }
    if (
      previousManifest.publicationFingerprint !==
      nextManifest.publicationFingerprint
    ) {
      updatedManifestIds.push(manifestId);
      continue;
    }
    unchangedManifestIds.push(manifestId);
  }
  for (const manifestId of previousManifests.keys()) {
    if (!nextManifests.has(manifestId)) {
      removedManifestIds.push(manifestId);
    }
  }

  const changedComponents = new Set<string>();
  if (addedManifestIds.length > 0 || removedManifestIds.length > 0) {
    changedComponents.add("manifests");
    changedComponents.add("routes");
  }
  if (updatedManifestIds.length > 0) {
    changedComponents.add("manifests");
    changedComponents.add("content");
    changedComponents.add("seo");
  }
  if (
    previousCatalog != null &&
    previousCatalog.sourceFingerprint !== nextCatalog.sourceFingerprint
  ) {
    changedComponents.add("source");
  }
  if (
    previousCatalog != null &&
    stableStringify(previousCatalog.policyVersions) !==
      stableStringify(nextCatalog.policyVersions)
  ) {
    changedComponents.add("policy");
  }
  if (
    previousCatalog != null &&
    stableStringify(previousCatalog.indexes) !== stableStringify(nextCatalog.indexes)
  ) {
    changedComponents.add("indexes");
  }

  const changeType: WebManifestCatalogChangeType =
    previousCatalog == null
      ? "new_catalog"
      : previousCatalog.catalogFingerprint === nextCatalog.catalogFingerprint
        ? "unchanged_catalog"
        : "updated_catalog";

  const diagnostics = [
    buildDiagnostic({
      code:
        changeType === "new_catalog"
          ? "materialization_catalog_created"
          : changeType === "unchanged_catalog"
            ? "materialization_catalog_unchanged"
            : "materialization_catalog_updated",
      severity: "info",
      message:
        changeType === "new_catalog"
          ? "A new web manifest catalog was created."
          : changeType === "unchanged_catalog"
            ? "The web manifest catalog is unchanged."
            : "The web manifest catalog was updated.",
      metadata: freezeMetadata({
        addedManifestCount: addedManifestIds.length,
        removedManifestCount: removedManifestIds.length,
        updatedManifestCount: updatedManifestIds.length,
      }),
    }),
  ];

  return deepFreeze({
    changeType,
    previousFingerprint: previousCatalog?.catalogFingerprint ?? null,
    nextFingerprint: nextCatalog.catalogFingerprint,
    addedManifestIds: deepFreeze(addedManifestIds.sort(compareStrings)),
    removedManifestIds: deepFreeze(removedManifestIds.sort(compareStrings)),
    updatedManifestIds: deepFreeze(updatedManifestIds.sort(compareStrings)),
    unchangedManifestIds: deepFreeze(unchangedManifestIds.sort(compareStrings)),
    changedComponents: deepFreeze([...changedComponents].sort(compareStrings)),
    diagnostics: deepFreeze(diagnostics),
  });
}

function parseCatalogAliasIndexEntry(
  key: string,
  value: unknown,
  manifestCount: number,
  issues: string[],
): WebManifestCatalogAliasIndexEntry | null {
  if (!isPlainObject(value)) {
    issues.push(`indexes.aliases.${key} must be an object.`);
    return null;
  }
  if (
    typeof value.manifestIndex !== "number" ||
    !Number.isInteger(value.manifestIndex)
  ) {
    issues.push(`indexes.aliases.${key}.manifestIndex must be an integer.`);
    return null;
  }
  if (value.manifestIndex < 0 || value.manifestIndex >= manifestCount) {
    issues.push(`indexes.aliases.${key}.manifestIndex is out of range.`);
    return null;
  }
  if (!isNonEmptyString(value.toPath)) {
    issues.push(`indexes.aliases.${key}.toPath must be a non-empty string.`);
    return null;
  }
  if (value.statusCode !== 308) {
    issues.push(`indexes.aliases.${key}.statusCode must be 308.`);
    return null;
  }
  if (
    !isNonEmptyString(value.aliasType) ||
    !WEB_ROUTE_ALIAS_TYPES.includes(value.aliasType as (typeof WEB_ROUTE_ALIAS_TYPES)[number])
  ) {
    issues.push(`indexes.aliases.${key}.aliasType is invalid.`);
    return null;
  }
  return deepFreeze({
    manifestIndex: value.manifestIndex,
    toPath: normalizePath(value.toPath),
    statusCode: 308,
    aliasType: value.aliasType as WebManifestCatalogAliasIndexEntry["aliasType"],
  });
}

function parseCatalogIndexesInput(
  input: unknown,
  manifestCount: number,
): Readonly<
  | { ok: true; indexes: WebManifestCatalogIndexes }
  | { ok: false; issues: readonly string[] }
> {
  const issues: string[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: deepFreeze(["indexes must be an object."]),
    };
  }

  const byManifestIdRaw = input.byManifestId;
  const byCanonicalPathRaw = input.byCanonicalPath;
  const bySlugRaw = input.bySlug;
  const aliasesRaw = input.aliases;
  const sitemapManifestIdsRaw = input.sitemapManifestIds;
  const hubManifestIdsRaw = input.hubManifestIds;

  if (!isPlainObject(byManifestIdRaw)) {
    issues.push("indexes.byManifestId must be an object.");
  }
  if (!isPlainObject(byCanonicalPathRaw)) {
    issues.push("indexes.byCanonicalPath must be an object.");
  }
  if (!isPlainObject(bySlugRaw)) {
    issues.push("indexes.bySlug must be an object.");
  }
  if (!isPlainObject(aliasesRaw)) {
    issues.push("indexes.aliases must be an object.");
  }
  if (!Array.isArray(sitemapManifestIdsRaw)) {
    issues.push("indexes.sitemapManifestIds must be an array.");
  }
  if (!Array.isArray(hubManifestIdsRaw)) {
    issues.push("indexes.hubManifestIds must be an array.");
  }
  if (issues.length > 0) {
    return { ok: false, issues: deepFreeze(issues) };
  }
  const byManifestIdRecord = byManifestIdRaw as Record<string, unknown>;
  const byCanonicalPathRecord = byCanonicalPathRaw as Record<string, unknown>;
  const bySlugRecord = bySlugRaw as Record<string, unknown>;
  const aliasesRecord = aliasesRaw as Record<string, unknown>;
  const sitemapManifestIdsArray = sitemapManifestIdsRaw as readonly unknown[];
  const hubManifestIdsArray = hubManifestIdsRaw as readonly unknown[];

  const byManifestId = Object.fromEntries(
    Object.entries(byManifestIdRecord)
      .map(([manifestId, manifestIndex]) => {
        if (!isNonEmptyString(manifestId)) {
          issues.push("indexes.byManifestId keys must be non-empty strings.");
          return null;
        }
        if (typeof manifestIndex !== "number" || !Number.isInteger(manifestIndex)) {
          issues.push(`indexes.byManifestId.${manifestId} must be an integer.`);
          return null;
        }
        if (manifestIndex < 0 || manifestIndex >= manifestCount) {
          issues.push(`indexes.byManifestId.${manifestId} is out of range.`);
          return null;
        }
        return [manifestId, manifestIndex] as const;
      })
      .filter((entry): entry is readonly [string, number] => entry != null)
      .sort((left, right) => compareStrings(left[0], right[0])),
  );

  const byCanonicalPath = Object.fromEntries(
    Object.entries(byCanonicalPathRecord)
      .map(([canonicalPath, manifestIndex]) => {
        if (!isNonEmptyString(canonicalPath)) {
          issues.push("indexes.byCanonicalPath keys must be non-empty strings.");
          return null;
        }
        const normalizedPath = normalizePath(canonicalPath);
        if (normalizedPath !== canonicalPath) {
          issues.push(
            `indexes.byCanonicalPath.${canonicalPath} must already be normalized.`,
          );
          return null;
        }
        if (typeof manifestIndex !== "number" || !Number.isInteger(manifestIndex)) {
          issues.push(
            `indexes.byCanonicalPath.${canonicalPath} must be an integer.`,
          );
          return null;
        }
        if (manifestIndex < 0 || manifestIndex >= manifestCount) {
          issues.push(`indexes.byCanonicalPath.${canonicalPath} is out of range.`);
          return null;
        }
        return [canonicalPath, manifestIndex] as const;
      })
      .filter((entry): entry is readonly [string, number] => entry != null)
      .sort((left, right) => compareStrings(left[0], right[0])),
  );

  const aliases = Object.fromEntries(
    Object.entries(aliasesRecord)
      .map(([fromPath, entry]) => {
        if (!isNonEmptyString(fromPath)) {
          issues.push("indexes.aliases keys must be non-empty strings.");
          return null;
        }
        const normalizedPath = normalizePath(fromPath);
        if (normalizedPath !== fromPath) {
          issues.push(`indexes.aliases.${fromPath} must already be normalized.`);
          return null;
        }
        const parsed = parseCatalogAliasIndexEntry(
          fromPath,
          entry,
          manifestCount,
          issues,
        );
        if (parsed == null) {
          return null;
        }
        return [fromPath, parsed] as const;
      })
      .filter(
        (
          entry,
        ): entry is readonly [string, WebManifestCatalogAliasIndexEntry] =>
          entry != null,
      )
      .sort((left, right) => compareStrings(left[0], right[0])),
  );

  const bySlug = Object.fromEntries(
    Object.entries(bySlugRecord)
      .map(([slug, manifestIndex]) => {
        if (!isNonEmptyString(slug)) {
          issues.push("indexes.bySlug keys must be non-empty strings.");
          return null;
        }
        if (typeof manifestIndex !== "number" || !Number.isInteger(manifestIndex)) {
          issues.push(`indexes.bySlug.${slug} must be an integer.`);
          return null;
        }
        if (manifestIndex < 0 || manifestIndex >= manifestCount) {
          issues.push(`indexes.bySlug.${slug} is out of range.`);
          return null;
        }
        return [slug, manifestIndex] as const;
      })
      .filter((entry): entry is readonly [string, number] => entry != null)
      .sort((left, right) => compareStrings(left[0], right[0])),
  );

  const parseManifestIdList = (
    value: readonly unknown[],
    label: "sitemapManifestIds" | "hubManifestIds",
  ): string[] =>
    value
      .map((entry) => {
        if (!isNonEmptyString(entry)) {
          issues.push(`indexes.${label} must contain only non-empty strings.`);
          return null;
        }
        return entry;
      })
      .filter((entry): entry is string => entry != null)
      .sort(compareStrings);

  const sitemapManifestIds = parseManifestIdList(
    sitemapManifestIdsArray,
    "sitemapManifestIds",
  );
  const hubManifestIds = parseManifestIdList(
    hubManifestIdsArray,
    "hubManifestIds",
  );

  if (issues.length > 0) {
    return { ok: false, issues: deepFreeze(issues) };
  }

  return {
    ok: true,
    indexes: deepFreeze({
      byManifestId: deepFreeze(byManifestId),
      byCanonicalPath: deepFreeze(byCanonicalPath),
      bySlug: deepFreeze(bySlug),
      aliases: deepFreeze(aliases),
      sitemapManifestIds: deepFreeze(sitemapManifestIds),
      hubManifestIds: deepFreeze(hubManifestIds),
    }),
  };
}

export function validateWebManifestCatalogEnvelope(
  input: unknown,
): Readonly<
  | { ok: true; envelope: WebManifestCatalogEnvelope }
  | { ok: false; issues: readonly string[] }
> {
  const issues: string[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: deepFreeze(["Expected a web publication catalog envelope object."]),
    };
  }
  if (input.schemaVersion !== WEB_MANIFEST_CATALOG_SCHEMA_VERSION) {
    issues.push(
      `Unsupported web publication catalog schemaVersion. Expected ${WEB_MANIFEST_CATALOG_SCHEMA_VERSION}, received ${String(input.schemaVersion)}.`,
    );
  }
  if (!isNonEmptyString(input.generatorVersion)) {
    issues.push("generatorVersion must be a non-empty string.");
  }
  if (!isNonEmptyString(input.policyFingerprint)) {
    issues.push("policyFingerprint must be a non-empty string.");
  }
  if (!isNonEmptyString(input.catalogFingerprint)) {
    issues.push("catalogFingerprint must be a non-empty string.");
  }
  if (
    !isNonEmptyString(input.generatedAt) ||
    !isCanonicalIsoTimestamp(input.generatedAt)
  ) {
    issues.push("generatedAt must be a canonical ISO timestamp.");
  }
  if (!isNonEmptyString(input.sourceFingerprint)) {
    issues.push("sourceFingerprint must be a non-empty string.");
  }
  if (typeof input.manifestCount !== "number" || !Number.isInteger(input.manifestCount)) {
    issues.push("manifestCount must be an integer.");
  }
  if (!Array.isArray(input.manifests)) {
    issues.push("manifests must be an array.");
  }
  const indexesValidation = parseCatalogIndexesInput(
    input.indexes,
    Array.isArray(input.manifests) ? input.manifests.length : 0,
  );
  if (!indexesValidation.ok) {
    issues.push(...indexesValidation.issues);
  }
  if (issues.length > 0) {
    return { ok: false, issues: deepFreeze(issues) };
  }
  const parsedIndexes = indexesValidation.ok
    ? indexesValidation.indexes
    : buildWebManifestCatalogIndexes([]);
  const manifests = (input.manifests as readonly unknown[]).map((entry) => {
    const validation = validateWebPublicationManifest(entry);
    if (!validation.ok) {
      issues.push(
        validation.issues
          .map((issue) => `manifest.${issue.path}: ${issue.message}`)
          .join(" | "),
      );
      return null;
    }
    return validation.manifest;
  });
  if (issues.length > 0) {
    return { ok: false, issues: deepFreeze(issues) };
  }
  const envelope: WebManifestCatalogEnvelope = deepFreeze({
    schemaVersion: WEB_MANIFEST_CATALOG_SCHEMA_VERSION,
    generatorVersion: String(input.generatorVersion),
    policyFingerprint: String(input.policyFingerprint),
    catalogFingerprint: String(input.catalogFingerprint),
    generatedAt: String(input.generatedAt),
    sourceFingerprint: String(input.sourceFingerprint),
    manifestCount: Number(input.manifestCount),
    manifests: sortManifests(manifests.filter(Boolean) as WebPublicationManifest[]),
    indexes: parsedIndexes,
    diagnosticsSummary: deepFreeze(
      isPlainObject(input.diagnosticsSummary)
        ? {
            infoCount:
              typeof input.diagnosticsSummary.infoCount === "number"
                ? input.diagnosticsSummary.infoCount
                : 0,
            warningCount:
              typeof input.diagnosticsSummary.warningCount === "number"
                ? input.diagnosticsSummary.warningCount
                : 0,
            errorCount:
              typeof input.diagnosticsSummary.errorCount === "number"
                ? input.diagnosticsSummary.errorCount
                : 0,
            codes: deepFreeze(
              Array.isArray(input.diagnosticsSummary.codes)
                ? (input.diagnosticsSummary.codes.filter((entry): entry is WebManifestMaterializationDiagnosticCode =>
                    typeof entry === "string" &&
                    WEB_MANIFEST_MATERIALIZATION_DIAGNOSTIC_CODES.includes(
                      entry as WebManifestMaterializationDiagnosticCode,
                    ),
                  ) as WebManifestMaterializationDiagnosticCode[])
                : [],
            ),
          }
        : {
            infoCount: 0,
            warningCount: 0,
            errorCount: 0,
            codes: deepFreeze([]),
          },
    ),
    policyVersions: deepFreeze(
      isPlainObject(input.policyVersions)
        ? Object.fromEntries(
            Object.entries(input.policyVersions)
              .filter((entry): entry is [string, string] => typeof entry[1] === "string")
              .sort((left, right) => compareStrings(left[0], right[0])),
          )
        : {},
    ),
    metadata: freezeMetadata(
      isPlainObject(input.metadata)
        ? (input.metadata as CoordinationJsonObject)
        : {},
    ),
  });
  validatePrivacyForValue(envelope, "catalog.envelope");
  validateJsonSerializable(envelope, "validateWebManifestCatalogEnvelope");
  if (envelope.manifestCount !== envelope.manifests.length) {
    issues.push("manifestCount must match the number of manifests.");
  }
  const manifestIds = new Set<string>();
  const canonicalPaths = new Set<string>();
  for (const manifest of envelope.manifests) {
    if (manifestIds.has(manifest.manifestId)) {
      issues.push(`Duplicate manifestId detected: ${manifest.manifestId}.`);
    }
    manifestIds.add(manifest.manifestId);

    const canonicalPath = manifest.publication.canonicalPath;
    if (canonicalPaths.has(canonicalPath)) {
      issues.push(`Duplicate canonical path detected: ${canonicalPath}.`);
    }
    canonicalPaths.add(canonicalPath);
  }

  const expectedPolicyFingerprint = detectManifestPolicyFingerprint(
    envelope.manifests,
    envelope.policyVersions,
  );
  let expectedIndexes: WebManifestCatalogIndexes | null = null;
  try {
    expectedIndexes = buildWebManifestCatalogIndexes(envelope.manifests);
  } catch (error) {
    issues.push(
      error instanceof Error
        ? error.message
        : "indexes could not be rebuilt from the manifests.",
    );
  }
  if (envelope.policyFingerprint !== expectedPolicyFingerprint) {
    issues.push(
      "policyFingerprint does not match the manifests in the web publication catalog.",
    );
  }
  if (
    expectedIndexes != null &&
    stableStringify(envelope.indexes.byManifestId) !==
      stableStringify(expectedIndexes.byManifestId)
  ) {
    issues.push("indexes.byManifestId does not match the manifests.");
  }
  if (
    expectedIndexes != null &&
    stableStringify(envelope.indexes.byCanonicalPath) !==
      stableStringify(expectedIndexes.byCanonicalPath)
  ) {
    issues.push("indexes.byCanonicalPath does not match the manifests.");
  }
  if (
    expectedIndexes != null &&
    stableStringify(envelope.indexes.bySlug) !==
      stableStringify(expectedIndexes.bySlug)
  ) {
    issues.push("indexes.bySlug does not match the manifests.");
  }
  if (
    expectedIndexes != null &&
    stableStringify(envelope.indexes.aliases) !==
      stableStringify(expectedIndexes.aliases)
  ) {
    issues.push("indexes.aliases does not match the manifests.");
  }
  if (
    expectedIndexes != null &&
    stableStringify(envelope.indexes.sitemapManifestIds) !==
      stableStringify(expectedIndexes.sitemapManifestIds)
  ) {
    issues.push("indexes.sitemapManifestIds does not match the manifests.");
  }
  if (
    expectedIndexes != null &&
    stableStringify(envelope.indexes.hubManifestIds) !==
      stableStringify(expectedIndexes.hubManifestIds)
  ) {
    issues.push("indexes.hubManifestIds does not match the manifests.");
  }

  const expectedCatalogFingerprint = buildCatalogFingerprint({
    schemaVersion: envelope.schemaVersion,
    policyFingerprint: envelope.policyFingerprint,
    manifests: envelope.manifests,
    indexes: expectedIndexes ?? envelope.indexes,
  });
  if (envelope.catalogFingerprint !== expectedCatalogFingerprint) {
    issues.push(
      "catalogFingerprint does not match the web publication catalog contents.",
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues: deepFreeze(issues) };
  }

  return { ok: true, envelope };
}

export function serializeWebManifestCatalog(
  envelope: WebManifestCatalogEnvelope,
): string {
  const validation = validateWebManifestCatalogEnvelope(envelope);
  if (!validation.ok) {
    throw new WebManifestMaterializationError({
      code: "invalid_catalog",
      operation: "serializeWebManifestCatalog",
      message: validation.issues.join(" | "),
    });
  }
  return `${stableStringify(validation.envelope)}\n`;
}

export async function writeWebManifestCatalog(
  input: WriteWebManifestCatalogInput,
): Promise<Readonly<{ status: "written" | "skipped"; content: string }>> {
  const nextContent = serializeWebManifestCatalog(input.envelope);
  const previousContent =
    input.previousCatalog == null
      ? null
      : serializeWebManifestCatalog(input.previousCatalog);
  if (previousContent === nextContent) {
    return { status: "skipped", content: nextContent };
  }
  try {
    await writeFile(input.outputPath, nextContent, "utf8");
  } catch (error) {
    throw new WebManifestMaterializationError({
      code: "io_error",
      operation: "writeWebManifestCatalog",
      outputPath: input.outputPath,
      message: "Unable to write the web manifest catalog output file.",
      cause: error,
    });
  }
  return { status: "written", content: nextContent };
}

export function materializeWebPublicationManifests(
  input: MaterializeWebPublicationManifestsInput,
): WebManifestMaterializationResult {
  const policy = buildDefaultPolicy(input.policy);
  const sourceValidation = validateWebManifestMaterializationSource(input.source);
  const source = sourceValidation.source;
  const generatedAt = resolveGeneratedAt(source, policy, input.previousCatalog);

  const diagnostics: WebManifestMaterializationDiagnostic[] = [
    buildDiagnostic({
      code: "materialization_started",
      severity: "info",
      sourcePath: source.sourcePath,
      outputPath: input.outputPath ?? null,
      message: "Web publication manifest materialization started.",
    }),
    buildDiagnostic({
      code:
        source.registrySnapshots.length === 0 &&
        source.bundles.length === 0 &&
        source.manifests.length === 0
          ? "materialization_source_empty"
          : "materialization_source_loaded",
      severity: "info",
      sourcePath: source.sourcePath,
      message:
        source.registrySnapshots.length === 0 &&
        source.bundles.length === 0 &&
        source.manifests.length === 0
          ? "The materialization source is empty."
          : "The materialization source was loaded successfully.",
      metadata: freezeMetadata({
        sourceType: source.sourceType,
        registrySnapshotCount: source.registrySnapshots.length,
        bundleCount: source.bundles.length,
        manifestCount: source.manifests.length,
      }),
    }),
  ];

  const candidateBuild = buildWebManifestMaterializationCandidates(source, policy);
  diagnostics.push(...candidateBuild.diagnostics);

  const included: WebPublicationManifest[] = [];
  const excluded: WebPublicationManifest[] = [];

  for (const candidate of candidateBuild.candidates) {
    const manifest = candidate.publicationManifest;
    if (manifest == null) {
      continue;
    }
    const renderable = manifestIsRenderable(manifest);
    if (!renderable) {
      excluded.push(manifest);
      diagnostics.push(
        buildDiagnostic({
          code: "materialization_manifest_excluded",
          severity: "info",
          candidateId: candidate.candidateId,
          manifestId: manifest.manifestId,
          reportId: manifest.reportId,
          message:
            "A manifest was excluded because its publication decision is not renderable under the current policy.",
          metadata: freezeMetadata({
            decisionType: manifest.decision.decisionType,
          }),
        }),
      );
      continue;
    }
    included.push(manifest);
    diagnostics.push(
      buildDiagnostic({
        code: "materialization_manifest_included",
        severity: "info",
        candidateId: candidate.candidateId,
        manifestId: manifest.manifestId,
        reportId: manifest.reportId,
        message: "A manifest was included in the public catalog.",
        metadata: freezeMetadata({
          decisionType: manifest.decision.decisionType,
        }),
      }),
    );
  }

  const initiallyIncluded = sortManifests(included);
  const initialConflicts = detectConflicts(initiallyIncluded);
  for (const conflict of initialConflicts) {
    diagnostics.push(
      buildDiagnostic({
        code: "materialization_conflict_detected",
        severity: "warning",
        manifestId: conflict.rejectedManifestId,
        reportId: null,
        message: conflict.message,
        metadata: freezeMetadata({
          conflictType: conflict.conflictType,
          path: conflict.path,
          keptManifestId: conflict.keptManifestId,
          rejectedManifestId: conflict.rejectedManifestId,
        }),
      }),
    );
  }

  if (initialConflicts.length > 0 && policy.failOnConflict) {
    throw new WebManifestMaterializationError({
      code: "strict_failure",
      operation: "materializeWebPublicationManifests",
      message:
        "Manifest materialization encountered blocking conflicts under strict mode.",
    });
  }

  const rejectedManifestIds = new Set(
    initialConflicts
      .map((conflict) => conflict.rejectedManifestId)
      .filter((entry): entry is string => isNonEmptyString(entry)),
  );
  const sortedIncluded = sortManifests(
    initiallyIncluded.filter(
      (manifest) => !rejectedManifestIds.has(manifest.manifestId),
    ),
  );
  const conflicts = detectConflicts(sortedIncluded);

  for (const manifestId of rejectedManifestIds) {
    const rejectedManifest = initiallyIncluded.find(
      (manifest) => manifest.manifestId === manifestId,
    );
    if (!rejectedManifest) {
      continue;
    }
    excluded.push(rejectedManifest);
    diagnostics.push(
      buildDiagnostic({
        code: "materialization_manifest_excluded",
        severity: "warning",
        manifestId,
        reportId: rejectedManifest.reportId,
        message:
          "A manifest was excluded from the public catalog because of a detected route or SEO conflict.",
        metadata: freezeMetadata({
          conflict: true,
        }),
      }),
    );
  }

  if (sortedIncluded.length === 0 && !policy.allowEmptyCatalog) {
    throw new WebManifestMaterializationError({
      code: "strict_failure",
      operation: "materializeWebPublicationManifests",
      message:
        "Manifest materialization produced an empty catalog but allowEmptyCatalog=false.",
    });
  }

  const envelopeBase = deepFreeze({
    schemaVersion: WEB_MANIFEST_CATALOG_SCHEMA_VERSION,
    generatorVersion: WEB_MANIFEST_GENERATOR_VERSION,
    generatedAt,
    sourceFingerprint: source.sourceFingerprint,
    manifests: sortedIncluded,
    manifestCount: sortedIncluded.length,
    policyVersions: detectManifestPolicyVersions(sortedIncluded),
    metadata: freezeMetadata({
      sourceType: source.sourceType,
      conflictCount: conflicts.length,
      outputFormat: policy.outputFormat,
      allowEmptyCatalog: policy.allowEmptyCatalog,
    }),
  });
  const policyFingerprint = detectManifestPolicyFingerprint(
    envelopeBase.manifests,
    envelopeBase.policyVersions,
  );

  const diagnosticsSummary = buildPersistedDiagnosticsSummary(
    deepFreeze([...diagnostics]),
  );
  const indexes = buildWebManifestCatalogIndexes(envelopeBase.manifests);
  const catalogFingerprint = buildCatalogFingerprint({
    schemaVersion: envelopeBase.schemaVersion,
    policyFingerprint,
    manifests: envelopeBase.manifests,
    indexes,
  });

  const envelope = deepFreeze({
    schemaVersion: WEB_MANIFEST_CATALOG_SCHEMA_VERSION,
    generatorVersion: envelopeBase.generatorVersion,
    policyFingerprint,
    catalogFingerprint,
    generatedAt: envelopeBase.generatedAt,
    sourceFingerprint: envelopeBase.sourceFingerprint,
    manifestCount: envelopeBase.manifestCount,
    manifests: envelopeBase.manifests,
    indexes,
    diagnosticsSummary,
    policyVersions: envelopeBase.policyVersions,
    metadata: envelopeBase.metadata,
  });

  const envelopeValidation = validateWebManifestCatalogEnvelope(envelope);
  if (!envelopeValidation.ok) {
    throw new WebManifestMaterializationError({
      code: "invalid_catalog",
      operation: "materializeWebPublicationManifests",
      message: envelopeValidation.issues.join(" | "),
    });
  }

  const change = detectWebManifestCatalogChange(
    input.previousCatalog ?? null,
    envelope,
  );
  diagnostics.push(...change.diagnostics);

  const outputFingerprint = hashFingerprint("ipp_web_manifest_output_", envelope);
  return deepFreeze({
    materializationId: hashFingerprint("ipp_web_materialization_", {
      sourceFingerprint: source.sourceFingerprint,
      catalogFingerprint,
    }),
    status: sortedIncluded.length === 0 ? "empty" : "ok",
    source,
    policy,
    candidates: candidateBuild.candidates,
    includedManifests: sortedIncluded,
    excludedManifests: sortManifests(excluded),
    conflicts,
    diagnostics: deepFreeze(diagnostics),
    catalogFingerprint,
    generatedAt,
    outputPath: input.outputPath ?? null,
    outputFingerprint,
    change,
    envelope,
  });
}

function readFlagValue(args: readonly string[], flag: string): string | null {
  const direct = args.find((entry) => entry.startsWith(`${flag}=`));
  if (direct) {
    return direct.slice(flag.length + 1);
  }
  const index = args.findIndex((entry) => entry === flag);
  if (index === -1 || index === args.length - 1) {
    return null;
  }
  return args[index + 1] ?? null;
}

function hasFlag(args: readonly string[], flag: string): boolean {
  return args.includes(flag) || args.some((entry) => entry.startsWith(`${flag}=`));
}

function toCliSummary(result: WebManifestMaterializationResult): CoordinationJsonObject {
  return freezeMetadata({
    status: result.status,
    sourceType: result.source.sourceType,
    manifestCount: result.envelope.manifestCount,
    conflictCount: result.conflicts.length,
    changeType: result.change.changeType,
    catalogFingerprint: result.catalogFingerprint,
    outputPath: result.outputPath,
  });
}

export async function runWebManifestMaterializationCli(
  argv: readonly string[],
): Promise<void> {
  const dryRun = hasFlag(argv, "--dry-run") || !hasFlag(argv, "--write");
  const strict = hasFlag(argv, "--strict");
  const sourcePath = readFlagValue(argv, "--source");
  const allowEmpty =
    hasFlag(argv, "--allow-empty") || !isNonEmptyString(sourcePath ?? "");
  const outputPath =
    readFlagValue(argv, "--output") ??
    DEFAULT_WEB_MANIFEST_CATALOG_OUTPUT_PATH;
  const generatedAt = readFlagValue(argv, "--generated-at");

  const source = await loadWebManifestMaterializationSource({
    sourcePath,
  });

  let previousCatalog: WebManifestCatalogEnvelope | null = null;
  try {
    const previousRaw = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(previousRaw) as unknown;
    const validation = validateWebManifestCatalogEnvelope(parsed);
    if (validation.ok) {
      previousCatalog = validation.envelope;
    }
  } catch {
    previousCatalog = null;
  }

  const result = materializeWebPublicationManifests({
    source,
    previousCatalog,
    outputPath,
    policy: {
      ...buildPolicyOverridesFromSourceMetadata(source),
      allowEmptyCatalog: allowEmpty,
      failOnConflict: strict,
      generatedAt,
    },
  });

  if (strict && result.status === "empty") {
    throw new WebManifestMaterializationError({
      code: "strict_failure",
      operation: "runWebManifestMaterializationCli",
      sourcePath: sourcePath ?? undefined,
      outputPath,
      message: "Strict mode does not allow an empty catalog result.",
    });
  }

  if (dryRun) {
    console.info(
      JSON.stringify(
        {
          mode: "dry-run",
          ...toCliSummary(result),
        },
        null,
        2,
      ),
    );
    return;
  }

  const writeResult = await writeWebManifestCatalog({
    envelope: result.envelope,
    outputPath,
    previousCatalog,
  });
  console.info(
    JSON.stringify(
      {
        mode: "write",
        writeStatus: writeResult.status,
        ...toCliSummary(result),
      },
      null,
      2,
    ),
  );
}
