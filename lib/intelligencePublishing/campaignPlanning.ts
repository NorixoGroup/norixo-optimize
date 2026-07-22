import { createHash } from "node:crypto";

import {
  INTELLIGENCE_PUBLISHING_BATCH_ACTIONS,
  type IntelligencePublishingBatchAction,
  type IntelligencePublishingBatchCandidate,
} from "./batchPlanning";
import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";
import {
  assertRegistrySnapshotPublicSafe,
  buildRegistrySnapshotFingerprint,
  getActiveRegistryVersion,
  getRegistryAsset,
  getRegistryAssetVersion,
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
  type RegistryAsset,
  type RegistrySnapshot,
} from "./registryAdapter";
import { buildRegistryBatchCandidatesFromSnapshot } from "./registryBatchRuntime";

export const INTELLIGENCE_PUBLISHING_CAMPAIGN_SPECIFICATION_SCHEMA_VERSION =
  "ipp_campaign_specification_v1" as const;
export const INTELLIGENCE_PUBLISHING_CAMPAIGN_SPECIFICATION_VERSION =
  "ipp_campaign_contract_v1" as const;
export const INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_SCHEMA_VERSION =
  "ipp_publication_plan_v1" as const;
export const INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_VERSION =
  "ipp_publication_plan_contract_v1" as const;

export const INTELLIGENCE_PUBLISHING_CAMPAIGN_ORDERING_STRATEGIES =
  Object.freeze([
    "registry_order",
    "canonical_path",
    "report_key",
    "market_then_locale",
  ] as const);

export type IntelligencePublishingCampaignOrderingStrategy =
  (typeof INTELLIGENCE_PUBLISHING_CAMPAIGN_ORDERING_STRATEGIES)[number];

export const INTELLIGENCE_PUBLISHING_CAMPAIGN_FILTER_DIMENSIONS =
  Object.freeze([
    "reportKeys",
    "locales",
    "countries",
    "cities",
    "platforms",
    "propertyTypes",
  ] as const);

export type IntelligencePublishingCampaignFilterDimension =
  (typeof INTELLIGENCE_PUBLISHING_CAMPAIGN_FILTER_DIMENSIONS)[number];

export const INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_WARNING_CODES =
  Object.freeze([
    "selection_matched_nothing",
    "unknown_priority_report_key",
    "excluded_selected_item",
    "duplicate_registry_entry_ignored",
    "max_reports_applied",
    "unsupported_entry_skipped",
    "missing_optional_dimension",
    "empty_registry",
  ] as const);

export type IntelligencePublishingPublicationPlanWarningCode =
  (typeof INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_WARNING_CODES)[number];

export const INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_DIAGNOSTIC_CODES =
  Object.freeze([
    "campaign_specification_parsed",
    "campaign_specification_normalized",
    "campaign_specification_validated",
    "registry_snapshot_loaded",
    "registry_privacy_validated",
    "candidate_selection_completed",
    "exclusions_applied",
    "eligibility_checked",
    "priorities_applied",
    "ordering_applied",
    "limits_applied",
    "publication_plan_materialized",
    "fingerprint_verified",
  ] as const);

export type IntelligencePublishingPublicationPlanDiagnosticCode =
  (typeof INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_DIAGNOSTIC_CODES)[number];

export type IntelligencePublishingPublicationPlanDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export type IntelligencePublishingCampaignFilter = Readonly<
  Partial<Record<IntelligencePublishingCampaignFilterDimension, readonly string[]>>
>;

export type IntelligencePublishingCampaignOrdering = Readonly<{
  strategy: IntelligencePublishingCampaignOrderingStrategy;
  priorityReportKeys?: readonly string[];
}>;

export type IntelligencePublishingCampaignLimits = Readonly<{
  maxReports: number;
}>;

export type IntelligencePublishingCampaignSpecification = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_CAMPAIGN_SPECIFICATION_SCHEMA_VERSION;
  campaignVersion: typeof INTELLIGENCE_PUBLISHING_CAMPAIGN_SPECIFICATION_VERSION;
  campaignKey: string;
  name: string;
  requestedAction: IntelligencePublishingBatchAction;
  selection: IntelligencePublishingCampaignFilter;
  exclusions: IntelligencePublishingCampaignFilter;
  ordering: Readonly<{
    strategy: IntelligencePublishingCampaignOrderingStrategy;
    priorityReportKeys: readonly string[];
  }>;
  limits: IntelligencePublishingCampaignLimits;
  metadata: CoordinationJsonObject;
  campaignSpecificationFingerprint: string;
}>;

export type IntelligencePublishingPublicationPlanWarning = Readonly<{
  code: IntelligencePublishingPublicationPlanWarningCode;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type IntelligencePublishingPublicationPlanDiagnostic = Readonly<{
  code: IntelligencePublishingPublicationPlanDiagnosticCode;
  severity: IntelligencePublishingPublicationPlanDiagnosticSeverity;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type IntelligencePublishingPublicationPlanItem = Readonly<{
  index: number;
  reportKey: string;
  requestedAction: IntelligencePublishingBatchAction;
  locale: string;
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  canonicalPath: string | null;
  sourceFingerprint: string | null;
  candidateFingerprint: string;
  priorityRank: number | null;
  isPriority: boolean;
  planItemFingerprint: string;
}>;

export type IntelligencePublishingPublicationPlan = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_SCHEMA_VERSION;
  planVersion: typeof INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_VERSION;
  campaignKey: string;
  requestedAction: IntelligencePublishingBatchAction;
  campaignSpecificationFingerprint: string;
  registryFingerprint: string;
  planFingerprint: string;
  createdAt: string;
  summary: Readonly<{
    registryEntryCount: number;
    selectedCountBeforeExclusions: number;
    excludedCount: number;
    eligibleCount: number;
    plannedCount: number;
    truncatedCount: number;
  }>;
  items: readonly IntelligencePublishingPublicationPlanItem[];
  warnings: readonly IntelligencePublishingPublicationPlanWarning[];
  diagnostics: readonly IntelligencePublishingPublicationPlanDiagnostic[];
}>;

export type IntelligencePublishingCampaignSpecificationValidationIssue =
  Readonly<{
    path: string;
    message: string;
  }>;

export type IntelligencePublishingCampaignSpecificationValidationResult =
  | Readonly<{
      ok: true;
      specification: IntelligencePublishingCampaignSpecification;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingCampaignSpecificationValidationIssue[];
    }>;

export type IntelligencePublishingPublicationPlanValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type IntelligencePublishingPublicationPlanValidationResult =
  | Readonly<{
      ok: true;
      plan: IntelligencePublishingPublicationPlan;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingPublicationPlanValidationIssue[];
    }>;

export const MAX_INTELLIGENCE_PUBLISHING_CAMPAIGN_REPORTS = 1000 as const;

type NormalizedPlanCandidate = Readonly<{
  registryOrder: number;
  candidateId: string;
  reportKey: string;
  requestedAction: IntelligencePublishingBatchAction;
  locale: string;
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  canonicalPath: string | null;
  sourceFingerprint: string | null;
  candidateFingerprint: string;
}>;

const FORBIDDEN_PRIVATE_KEYS = new Set([
  "userid",
  "workspaceid",
  "auditid",
  "listingurl",
  "rawlisting",
  "customer",
  "email",
  "phone",
  "token",
  "password",
  "secret",
  "apikey",
  "authorization",
  "cookie",
  "localpath",
]);

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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

function normalizePrivateKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
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
    if (FORBIDDEN_PRIVATE_KEYS.has(normalizePrivateKey(key))) {
      throw new Error(`Forbidden private field detected at ${path}.${key}`);
    }
    assertNoForbiddenPrivateKeys(child, `${path}.${key}`);
  }
}

function sortJsonValue(value: unknown): CoordinationJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "undefined") {
    throw new Error("Undefined values are not JSON-safe.");
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => sortJsonValue(entry)));
  }
  if (!isPlainObject(value)) {
    throw new Error("Expected a plain JSON-safe object.");
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value)
        .sort((left, right) => compareStrings(left[0], right[0]))
        .map(([key, entry]) => [key, sortJsonValue(entry)]),
    ),
  );
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

function freezeMetadata(value: CoordinationJsonObject | undefined): CoordinationJsonObject {
  if (!isJsonSafe(value ?? {})) {
    throw new Error("Expected JSON-safe metadata.");
  }
  assertNoForbiddenPrivateKeys(value ?? {}, "metadata");
  return deepFreeze(sortJsonValue(value ?? {}) as CoordinationJsonObject);
}

function buildStableHash(prefix: string, value: unknown): string {
  return `${prefix}${createHash("sha256")
    .update(JSON.stringify(sortJsonValue(value)))
    .digest("hex")}`;
}

function normalizeDimensionValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeReportKey(value: string): string {
  return normalizeDimensionValue(value);
}

function normalizeCanonicalPath(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  return value.trim();
}

function hasExactStringArrayMatch(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function freezeWarning(
  input: Readonly<{
    code: IntelligencePublishingPublicationPlanWarningCode;
    message: string;
    metadata?: CoordinationJsonObject;
  }>,
): IntelligencePublishingPublicationPlanWarning {
  return deepFreeze({
    code: input.code,
    message: input.message,
    metadata: freezeMetadata(input.metadata),
  });
}

function freezeDiagnostic(
  input: Readonly<{
    code: IntelligencePublishingPublicationPlanDiagnosticCode;
    severity: IntelligencePublishingPublicationPlanDiagnosticSeverity;
    message: string;
    metadata?: CoordinationJsonObject;
  }>,
): IntelligencePublishingPublicationPlanDiagnostic {
  return deepFreeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    metadata: freezeMetadata(input.metadata),
  });
}

function normalizeFilter(
  input: unknown,
  path: "selection" | "exclusions",
): Readonly<{
  ok: true;
  filter: IntelligencePublishingCampaignFilter;
}> | Readonly<{
  ok: false;
  issues: readonly IntelligencePublishingCampaignSpecificationValidationIssue[];
}> {
  if (input == null) {
    return {
      ok: true,
      filter: deepFreeze({}),
    };
  }
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path,
          message: `${path} must be a plain object when provided.`,
        },
      ]),
    };
  }

  const issues: IntelligencePublishingCampaignSpecificationValidationIssue[] = [];
  for (const key of Object.keys(input).sort(compareStrings)) {
    if (
      !INTELLIGENCE_PUBLISHING_CAMPAIGN_FILTER_DIMENSIONS.includes(
        key as IntelligencePublishingCampaignFilterDimension,
      )
    ) {
      issues.push({
        path: `${path}.${key}`,
        message: `Unsupported ${path} dimension ${key}.`,
      });
    }
  }

  const normalized: Partial<Record<IntelligencePublishingCampaignFilterDimension, readonly string[]>> =
    {};
  for (const dimension of INTELLIGENCE_PUBLISHING_CAMPAIGN_FILTER_DIMENSIONS) {
    const raw = input[dimension];
    if (raw == null) {
      continue;
    }
    if (!Array.isArray(raw)) {
      issues.push({
        path: `${path}.${dimension}`,
        message: `${path}.${dimension} must be an array when provided.`,
      });
      continue;
    }
    if (raw.length === 0) {
      issues.push({
        path: `${path}.${dimension}`,
        message: `${path}.${dimension} cannot be an empty array.`,
      });
      continue;
    }
    const normalizedValues = raw
      .filter(isNonEmptyString)
      .map((value) =>
        dimension === "reportKeys"
          ? normalizeReportKey(value)
          : normalizeDimensionValue(value),
      );
    if (normalizedValues.length !== raw.length) {
      issues.push({
        path: `${path}.${dimension}`,
        message: `${path}.${dimension} must contain only non-empty strings.`,
      });
      continue;
    }
    normalized[dimension] = Object.freeze(
      [...new Set(normalizedValues)].sort(compareStrings),
    );
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  return {
    ok: true,
    filter: deepFreeze(normalized as IntelligencePublishingCampaignFilter),
  };
}

function buildCampaignSpecificationFingerprint(
  specification: Omit<
    IntelligencePublishingCampaignSpecification,
    "campaignSpecificationFingerprint"
  >,
): string {
  return buildStableHash("ipp_campaign_specification_", {
    schemaVersion: specification.schemaVersion,
    campaignVersion: specification.campaignVersion,
    campaignKey: specification.campaignKey,
    name: specification.name,
    requestedAction: specification.requestedAction,
    selection: specification.selection,
    exclusions: specification.exclusions,
    ordering: specification.ordering,
    limits: specification.limits,
    metadata: specification.metadata,
  });
}

function buildPlanCandidateFingerprint(input: Readonly<{
  reportKey: string;
  requestedAction: IntelligencePublishingBatchAction;
  locale: string;
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  sourceFingerprint: string | null;
}>): string {
  return buildStableHash("ipp_publication_candidate_", input);
}

function buildPublicationPlanItemFingerprint(
  item: Omit<IntelligencePublishingPublicationPlanItem, "planItemFingerprint">,
): string {
  return buildStableHash("ipp_publication_plan_item_", item);
}

function buildPublicationPlanFingerprint(
  plan: Omit<IntelligencePublishingPublicationPlan, "planFingerprint">,
): string {
  return buildStableHash("ipp_publication_plan_", {
    schemaVersion: plan.schemaVersion,
    planVersion: plan.planVersion,
    campaignKey: plan.campaignKey,
    requestedAction: plan.requestedAction,
    campaignSpecificationFingerprint: plan.campaignSpecificationFingerprint,
    registryFingerprint: plan.registryFingerprint,
    summary: plan.summary,
    items: plan.items.map((item) => ({
      index: item.index,
      reportKey: item.reportKey,
      requestedAction: item.requestedAction,
      locale: item.locale,
      country: item.country,
      city: item.city,
      platform: item.platform,
      propertyType: item.propertyType,
      canonicalPath: item.canonicalPath,
      sourceFingerprint: item.sourceFingerprint,
      candidateFingerprint: item.candidateFingerprint,
      priorityRank: item.priorityRank,
      isPriority: item.isPriority,
      planItemFingerprint: item.planItemFingerprint,
    })),
    warnings: plan.warnings.map((warning) => ({
      code: warning.code,
      message: warning.message,
      metadata: warning.metadata,
    })),
  });
}

function parseRegistryBatchCandidateId(
  candidateId: string,
): Readonly<{
  assetId: string;
  assetVersionId: string;
  locale: string;
  channel: string;
}> | null {
  const parts = candidateId.split("|");
  if (parts.length !== 5 || parts[0] !== "registry_batch_candidate") {
    return null;
  }
  return deepFreeze({
    assetId: parts[1]!,
    assetVersionId: parts[2]!,
    locale: parts[3]!,
    channel: parts[4]!,
  });
}

function readAssetMetadataString(asset: RegistryAsset, key: string): string | null {
  const value = asset.metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveCanonicalPath(asset: RegistryAsset): string | null {
  return normalizeCanonicalPath(
    asset.metadata.canonicalPath ??
      asset.metadata.routePath ??
      asset.metadata.path ??
      null,
  );
}

function comparePlanCandidatesByRegistryOrder(
  left: NormalizedPlanCandidate,
  right: NormalizedPlanCandidate,
): number {
  if (left.registryOrder !== right.registryOrder) {
    return left.registryOrder - right.registryOrder;
  }
  return compareStrings(left.candidateId, right.candidateId);
}

function comparePlanCandidatesByReportKey(
  left: NormalizedPlanCandidate,
  right: NormalizedPlanCandidate,
): number {
  return (
    compareStrings(left.reportKey, right.reportKey) ||
    compareStrings(left.locale, right.locale) ||
    compareStrings(left.country, right.country) ||
    compareStrings(left.city, right.city) ||
    compareStrings(left.platform, right.platform) ||
    compareStrings(left.propertyType, right.propertyType) ||
    compareStrings(left.sourceFingerprint ?? "", right.sourceFingerprint ?? "") ||
    compareStrings(left.candidateId, right.candidateId)
  );
}

function comparePlanCandidatesByCanonicalPath(
  left: NormalizedPlanCandidate,
  right: NormalizedPlanCandidate,
): number {
  return (
    compareStrings(left.canonicalPath ?? "", right.canonicalPath ?? "") ||
    comparePlanCandidatesByReportKey(left, right)
  );
}

function comparePlanCandidatesByMarketThenLocale(
  left: NormalizedPlanCandidate,
  right: NormalizedPlanCandidate,
): number {
  return (
    compareStrings(left.country, right.country) ||
    compareStrings(left.city, right.city) ||
    compareStrings(left.platform, right.platform) ||
    compareStrings(left.propertyType, right.propertyType) ||
    compareStrings(left.locale, right.locale) ||
    compareStrings(left.reportKey, right.reportKey) ||
    compareStrings(left.sourceFingerprint ?? "", right.sourceFingerprint ?? "") ||
    compareStrings(left.candidateId, right.candidateId)
  );
}

function comparePlanCandidatesForStrategy(
  strategy: IntelligencePublishingCampaignOrderingStrategy,
  left: NormalizedPlanCandidate,
  right: NormalizedPlanCandidate,
): number {
  switch (strategy) {
    case "registry_order":
      return comparePlanCandidatesByRegistryOrder(left, right);
    case "canonical_path":
      return comparePlanCandidatesByCanonicalPath(left, right);
    case "report_key":
      return comparePlanCandidatesByReportKey(left, right);
    case "market_then_locale":
      return comparePlanCandidatesByMarketThenLocale(left, right);
  }
}

function matchesFilterValue(
  dimension: IntelligencePublishingCampaignFilterDimension,
  candidate: NormalizedPlanCandidate,
): string {
  switch (dimension) {
    case "reportKeys":
      return candidate.reportKey;
    case "locales":
      return candidate.locale;
    case "countries":
      return candidate.country;
    case "cities":
      return candidate.city;
    case "platforms":
      return candidate.platform;
    case "propertyTypes":
      return candidate.propertyType;
  }
}

function matchesFilter(
  filter: IntelligencePublishingCampaignFilter,
  candidate: NormalizedPlanCandidate,
): boolean {
  for (const dimension of INTELLIGENCE_PUBLISHING_CAMPAIGN_FILTER_DIMENSIONS) {
    const allowed = filter[dimension];
    if (allowed == null) {
      continue;
    }
    if (!allowed.includes(matchesFilterValue(dimension, candidate))) {
      return false;
    }
  }
  return true;
}

function isEmptyFilter(filter: IntelligencePublishingCampaignFilter): boolean {
  return INTELLIGENCE_PUBLISHING_CAMPAIGN_FILTER_DIMENSIONS.every(
    (dimension) => filter[dimension] == null,
  );
}

function validateCampaignKey(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120;
}

export function validateIntelligencePublishingCampaignSpecification(
  input: unknown,
): IntelligencePublishingCampaignSpecificationValidationResult {
  const issues: IntelligencePublishingCampaignSpecificationValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "specification",
          message: "Expected a plain campaign specification object.",
        },
      ]),
    };
  }
  try {
    assertNoForbiddenPrivateKeys(input, "specification");
  } catch (error) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "specification",
          message: error instanceof Error ? error.message : String(error),
        },
      ]),
    };
  }

  const allowedKeys = new Set([
    "schemaVersion",
    "campaignVersion",
    "campaignKey",
    "name",
    "requestedAction",
    "selection",
    "exclusions",
    "ordering",
    "limits",
    "metadata",
    "campaignSpecificationFingerprint",
  ]);

  for (const key of Object.keys(input).sort(compareStrings)) {
    if (!allowedKeys.has(key)) {
      issues.push({
        path: `specification.${key}`,
        message: "Unexpected key in campaign specification.",
      });
    }
  }

  if (
    input.schemaVersion !==
    INTELLIGENCE_PUBLISHING_CAMPAIGN_SPECIFICATION_SCHEMA_VERSION
  ) {
    issues.push({
      path: "specification.schemaVersion",
      message: "Unsupported campaign specification schemaVersion.",
    });
  }
  if (
    input.campaignVersion !==
    INTELLIGENCE_PUBLISHING_CAMPAIGN_SPECIFICATION_VERSION
  ) {
    issues.push({
      path: "specification.campaignVersion",
      message: "Unsupported campaign specification version.",
    });
  }
  if (!isNonEmptyString(input.campaignKey) || !validateCampaignKey(input.campaignKey)) {
    issues.push({
      path: "specification.campaignKey",
      message:
        "campaignKey must be lowercase kebab-case, public-safe and at most 120 characters.",
    });
  }
  if (!isNonEmptyString(input.name) || input.name.trim().length > 160) {
    issues.push({
      path: "specification.name",
      message: "name must be a non-empty string of at most 160 characters.",
    });
  }
  if (
    !isNonEmptyString(input.requestedAction) ||
    !INTELLIGENCE_PUBLISHING_BATCH_ACTIONS.includes(
      normalizeDimensionValue(input.requestedAction) as IntelligencePublishingBatchAction,
    )
  ) {
    issues.push({
      path: "specification.requestedAction",
      message: "requestedAction must be generate, publish or refresh.",
    });
  }

  const selectionResult = normalizeFilter(input.selection, "selection");
  if (!selectionResult.ok) {
    issues.push(...selectionResult.issues);
  }
  const exclusionsResult = normalizeFilter(input.exclusions, "exclusions");
  if (!exclusionsResult.ok) {
    issues.push(...exclusionsResult.issues);
  }

  let ordering: IntelligencePublishingCampaignSpecification["ordering"] | null = null;
  if (input.ordering == null) {
    ordering = deepFreeze({
      strategy: "registry_order",
      priorityReportKeys: Object.freeze([]),
    });
  } else if (!isPlainObject(input.ordering)) {
    issues.push({
      path: "specification.ordering",
      message: "ordering must be a plain object when provided.",
    });
  } else {
    const rawStrategy = input.ordering.strategy;
    if (
      !isNonEmptyString(rawStrategy) ||
      !INTELLIGENCE_PUBLISHING_CAMPAIGN_ORDERING_STRATEGIES.includes(
        normalizeDimensionValue(
          rawStrategy,
        ) as IntelligencePublishingCampaignOrderingStrategy,
      )
    ) {
      issues.push({
        path: "specification.ordering.strategy",
        message: "ordering.strategy is not supported.",
      });
    }
    const priorityRaw = input.ordering.priorityReportKeys;
    let priorityReportKeys: readonly string[] = Object.freeze([]);
    if (priorityRaw != null) {
      if (!Array.isArray(priorityRaw)) {
        issues.push({
          path: "specification.ordering.priorityReportKeys",
          message: "priorityReportKeys must be an array when provided.",
        });
      } else {
        const normalized = priorityRaw
          .filter(isNonEmptyString)
          .map((value) => normalizeReportKey(value));
        if (normalized.length !== priorityRaw.length) {
          issues.push({
            path: "specification.ordering.priorityReportKeys",
            message: "priorityReportKeys must contain only non-empty strings.",
          });
        }
        if (new Set(normalized).size !== normalized.length) {
          issues.push({
            path: "specification.ordering.priorityReportKeys",
            message: "priorityReportKeys must not contain duplicates.",
          });
        }
        priorityReportKeys = Object.freeze(normalized);
      }
    }
    if (issues.length === 0) {
      ordering = deepFreeze({
        strategy: normalizeDimensionValue(
          rawStrategy as string,
        ) as IntelligencePublishingCampaignOrderingStrategy,
        priorityReportKeys,
      });
    }
  }

  let limits: IntelligencePublishingCampaignLimits | null = null;
  if (!isPlainObject(input.limits)) {
    issues.push({
      path: "specification.limits",
      message: "limits must be a plain object.",
    });
  } else {
    const maxReports = input.limits.maxReports;
    if (
      typeof maxReports !== "number" ||
      !Number.isInteger(maxReports) ||
      maxReports <= 0 ||
      maxReports > MAX_INTELLIGENCE_PUBLISHING_CAMPAIGN_REPORTS
    ) {
      issues.push({
        path: "specification.limits.maxReports",
        message: `maxReports must be a positive integer <= ${MAX_INTELLIGENCE_PUBLISHING_CAMPAIGN_REPORTS}.`,
      });
    } else {
      limits = deepFreeze({
        maxReports,
      });
    }
  }

  let metadata: CoordinationJsonObject | null = null;
  try {
    metadata = freezeMetadata(
      isPlainObject(input.metadata)
        ? (input.metadata as CoordinationJsonObject)
        : input.metadata == null
          ? {}
          : undefined,
    );
    if (input.metadata != null && !isPlainObject(input.metadata)) {
      issues.push({
        path: "specification.metadata",
        message: "metadata must be a plain JSON-safe object when provided.",
      });
    }
  } catch (error) {
    issues.push({
      path: "specification.metadata",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  if (!selectionResult.ok || !exclusionsResult.ok) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "specification",
          message:
            "Campaign specification normalization produced an unexpected invalid filter state.",
        },
      ]),
    };
  }

  const specificationBase = deepFreeze({
    schemaVersion:
      INTELLIGENCE_PUBLISHING_CAMPAIGN_SPECIFICATION_SCHEMA_VERSION,
    campaignVersion: INTELLIGENCE_PUBLISHING_CAMPAIGN_SPECIFICATION_VERSION,
    campaignKey: (input.campaignKey as string).trim(),
    name: (input.name as string).trim(),
    requestedAction: normalizeDimensionValue(
      input.requestedAction as string,
    ) as IntelligencePublishingBatchAction,
    selection: selectionResult.filter,
    exclusions: exclusionsResult.filter,
    ordering: ordering!,
    limits: limits!,
    metadata: metadata!,
  });
  const campaignSpecificationFingerprint =
    buildCampaignSpecificationFingerprint(specificationBase);

  if (
    input.campaignSpecificationFingerprint != null &&
    input.campaignSpecificationFingerprint !== campaignSpecificationFingerprint
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "specification.campaignSpecificationFingerprint",
          message:
            "campaignSpecificationFingerprint does not match the normalized specification payload.",
        },
      ]),
    };
  }

  return {
    ok: true,
    specification: deepFreeze({
      ...specificationBase,
      campaignSpecificationFingerprint,
    }),
  };
}

function buildNormalizedPlanCandidates(
  snapshot: RegistrySnapshot,
  requestedAction: IntelligencePublishingBatchAction,
): Readonly<{
  registryEntryCount: number;
  candidates: readonly NormalizedPlanCandidate[];
  unsupportedSkippedCount: number;
  missingOptionalDimensionCount: number;
}> {
  const batchResult = buildRegistryBatchCandidatesFromSnapshot({
    registrySnapshot: snapshot,
    channel: "web",
    requestedAction,
  });

  const candidates = batchResult.candidates.map((candidate, index) => {
    const parsed = parseRegistryBatchCandidateId(candidate.candidateId);
    const asset =
      parsed == null ? null : getRegistryAsset(snapshot, parsed.assetId);
    const assetVersion =
      parsed == null ? null : getRegistryAssetVersion(snapshot, parsed.assetVersionId);
    const canonicalPath = asset == null ? null : resolveCanonicalPath(asset);

    return deepFreeze({
      registryOrder: index,
      candidateId: candidate.candidateId,
      reportKey: normalizeReportKey(candidate.reportKey),
      requestedAction,
      locale: normalizeDimensionValue(candidate.locale),
      country: normalizeDimensionValue(candidate.country),
      city: normalizeDimensionValue(candidate.city),
      platform: normalizeDimensionValue(candidate.platform),
      propertyType: normalizeDimensionValue(candidate.propertyType),
      canonicalPath,
      sourceFingerprint:
        typeof candidate.sourceFingerprint === "string" &&
        candidate.sourceFingerprint.trim().length > 0
          ? candidate.sourceFingerprint.trim()
          : assetVersion?.sourceFingerprint ?? null,
      candidateFingerprint: buildPlanCandidateFingerprint({
        reportKey: normalizeReportKey(candidate.reportKey),
        requestedAction,
        locale: normalizeDimensionValue(candidate.locale),
        country: normalizeDimensionValue(candidate.country),
        city: normalizeDimensionValue(candidate.city),
        platform: normalizeDimensionValue(candidate.platform),
        propertyType: normalizeDimensionValue(candidate.propertyType),
        sourceFingerprint:
          typeof candidate.sourceFingerprint === "string" &&
          candidate.sourceFingerprint.trim().length > 0
            ? candidate.sourceFingerprint.trim()
            : assetVersion?.sourceFingerprint ?? null,
      }),
    });
  });

  const unsupportedSkippedCount = batchResult.diagnostics.filter((diagnostic) =>
    [
      "unsupported_asset_type",
      "missing_active_version",
      "missing_market_metadata",
      "missing_locale",
    ].includes(diagnostic.code),
  ).length;

  const missingOptionalDimensionCount = candidates.filter(
    (candidate) => candidate.canonicalPath == null,
  ).length;

  return deepFreeze({
    registryEntryCount: snapshot.assets.length,
    candidates: Object.freeze(candidates),
    unsupportedSkippedCount,
    missingOptionalDimensionCount,
  });
}

function dedupePlanCandidates(
  candidates: readonly NormalizedPlanCandidate[],
): Readonly<{
  candidates: readonly NormalizedPlanCandidate[];
  ignoredDuplicateCount: number;
}> {
  const byLogicalKey = new Map<string, readonly NormalizedPlanCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.reportKey}|${candidate.locale}|${candidate.requestedAction}`;
    const current = byLogicalKey.get(key) ?? [];
    byLogicalKey.set(key, [...current, candidate]);
  }

  const deduped: NormalizedPlanCandidate[] = [];
  let ignoredDuplicateCount = 0;
  for (const [logicalKey, group] of [...byLogicalKey.entries()].sort((left, right) =>
    compareStrings(left[0], right[0]),
  )) {
    const sorted = [...group].sort(comparePlanCandidatesByRegistryOrder);
    deduped.push(sorted[0]!);
    ignoredDuplicateCount += sorted.length - 1;
  }

  return deepFreeze({
    candidates: Object.freeze(deduped),
    ignoredDuplicateCount,
  });
}

export function buildIntelligencePublishingPublicationPlan(input: Readonly<{
  registrySnapshot: unknown;
  specification: unknown;
  createdAt: string;
}>): IntelligencePublishingPublicationPlan {
  if (!isCanonicalIsoTimestamp(input.createdAt)) {
    throw new Error("createdAt must be a canonical ISO timestamp.");
  }

  const specValidation =
    validateIntelligencePublishingCampaignSpecification(input.specification);
  if (!specValidation.ok) {
    throw new Error(specValidation.issues.map((issue) => issue.message).join(" | "));
  }

  const snapshot = normalizeRegistrySnapshot(parseRegistrySnapshot(input.registrySnapshot));
  assertRegistrySnapshotPublicSafe(snapshot);
  const registryFingerprint = buildRegistrySnapshotFingerprint(snapshot);

  const warnings: IntelligencePublishingPublicationPlanWarning[] = [];
  const diagnostics: IntelligencePublishingPublicationPlanDiagnostic[] = [
    freezeDiagnostic({
      code: "campaign_specification_parsed",
      severity: "info",
      message: "Campaign specification parsed successfully.",
      metadata: {
        campaignKey: specValidation.specification.campaignKey,
      },
    }),
    freezeDiagnostic({
      code: "campaign_specification_normalized",
      severity: "info",
      message: "Campaign specification normalized successfully.",
      metadata: {
        campaignSpecificationFingerprint:
          specValidation.specification.campaignSpecificationFingerprint,
      },
    }),
    freezeDiagnostic({
      code: "campaign_specification_validated",
      severity: "info",
      message: "Campaign specification validated successfully.",
      metadata: {
        requestedAction: specValidation.specification.requestedAction,
      },
    }),
    freezeDiagnostic({
      code: "registry_snapshot_loaded",
      severity: "info",
      message: "Registry snapshot loaded successfully.",
      metadata: {
        snapshotId: snapshot.snapshotId,
        snapshotVersion: snapshot.snapshotVersion,
        registryFingerprint,
      },
    }),
    freezeDiagnostic({
      code: "registry_privacy_validated",
      severity: "info",
      message: "Registry snapshot passed public-safe validation.",
      metadata: {
        assetCount: snapshot.assets.length,
      },
    }),
  ];

  const candidateResolution = buildNormalizedPlanCandidates(
    snapshot,
    specValidation.specification.requestedAction,
  );

  if (snapshot.assets.length === 0) {
    warnings.push(
      freezeWarning({
        code: "empty_registry",
        message: "The registry snapshot contains no assets.",
        metadata: {},
      }),
    );
  }
  if (candidateResolution.unsupportedSkippedCount > 0) {
    warnings.push(
      freezeWarning({
        code: "unsupported_entry_skipped",
        message:
          "One or more registry entries were skipped because they are structurally incompatible with campaign planning.",
        metadata: {
          skippedCount: candidateResolution.unsupportedSkippedCount,
        },
      }),
    );
  }
  if (candidateResolution.missingOptionalDimensionCount > 0) {
    warnings.push(
      freezeWarning({
        code: "missing_optional_dimension",
        message:
          "Some selected entries do not currently expose an explicit canonicalPath in the registry.",
        metadata: {
          missingCount: candidateResolution.missingOptionalDimensionCount,
        },
      }),
    );
  }

  diagnostics.push(
    freezeDiagnostic({
      code: "candidate_selection_completed",
      severity: "info",
      message: "Registry candidates were materialized for campaign planning.",
      metadata: {
        candidateCount: candidateResolution.candidates.length,
      },
    }),
  );

  const selectedBeforeExclusions = candidateResolution.candidates.filter((candidate) =>
    matchesFilter(specValidation.specification.selection, candidate),
  );

  if (selectedBeforeExclusions.length === 0) {
    warnings.push(
      freezeWarning({
        code: "selection_matched_nothing",
        message: "The normalized selection matched no registry entries.",
        metadata: {
          campaignKey: specValidation.specification.campaignKey,
        },
      }),
    );
  }

  const selectedAfterExclusions = selectedBeforeExclusions.filter((candidate) => {
    const isExcluded =
      !isEmptyFilter(specValidation.specification.exclusions) &&
      matchesFilter(specValidation.specification.exclusions, candidate);
    if (isExcluded) {
      warnings.push(
        freezeWarning({
          code: "excluded_selected_item",
          message:
            "A selected item was excluded by an explicit exclusion filter and removed from the campaign scope.",
          metadata: {
            reportKey: candidate.reportKey,
            locale: candidate.locale,
          },
        }),
      );
    }
    return !isExcluded;
  });

  diagnostics.push(
    freezeDiagnostic({
      code: "exclusions_applied",
      severity: "info",
      message: "Campaign exclusions were applied.",
      metadata: {
        selectedCountBeforeExclusions: selectedBeforeExclusions.length,
        selectedCountAfterExclusions: selectedAfterExclusions.length,
      },
    }),
  );

  const deduped = dedupePlanCandidates(selectedAfterExclusions);
  if (deduped.ignoredDuplicateCount > 0) {
    warnings.push(
      freezeWarning({
        code: "duplicate_registry_entry_ignored",
        message:
          "Duplicate logical registry entries were collapsed deterministically during campaign planning.",
        metadata: {
          ignoredDuplicateCount: deduped.ignoredDuplicateCount,
        },
      }),
    );
  }

  diagnostics.push(
    freezeDiagnostic({
      code: "eligibility_checked",
      severity: "info",
      message: "Structural eligibility and duplicate handling were applied.",
      metadata: {
        eligibleCount: deduped.candidates.length,
      },
    }),
  );

  const priorityRanks = new Map<string, number>();
  specValidation.specification.ordering.priorityReportKeys.forEach((reportKey, index) => {
    priorityRanks.set(reportKey, index);
  });

  for (const reportKey of specValidation.specification.ordering.priorityReportKeys) {
    if (!deduped.candidates.some((candidate) => candidate.reportKey === reportKey)) {
      warnings.push(
        freezeWarning({
          code: "unknown_priority_report_key",
          message:
            "A priority report key did not match any eligible registry entry for this campaign.",
          metadata: {
            reportKey,
          },
        }),
      );
    }
  }

  diagnostics.push(
    freezeDiagnostic({
      code: "priorities_applied",
      severity: "info",
      message: "Priority report keys were applied to the campaign ordering.",
      metadata: {
        priorityCount:
          specValidation.specification.ordering.priorityReportKeys.length,
      },
    }),
  );

  const orderedCandidates = [...deduped.candidates].sort((left, right) => {
    const leftPriority = priorityRanks.get(left.reportKey);
    const rightPriority = priorityRanks.get(right.reportKey);
    if (leftPriority != null || rightPriority != null) {
      if (leftPriority == null) {
        return 1;
      }
      if (rightPriority == null) {
        return -1;
      }
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
    }
    return comparePlanCandidatesForStrategy(
      specValidation.specification.ordering.strategy,
      left,
      right,
    );
  });

  diagnostics.push(
    freezeDiagnostic({
      code: "ordering_applied",
      severity: "info",
      message: "Deterministic campaign ordering was applied.",
      metadata: {
        strategy: specValidation.specification.ordering.strategy,
      },
    }),
  );

  const limitedCandidates = orderedCandidates.slice(
    0,
    specValidation.specification.limits.maxReports,
  );
  const truncatedCount = orderedCandidates.length - limitedCandidates.length;
  if (truncatedCount > 0) {
    warnings.push(
      freezeWarning({
        code: "max_reports_applied",
        message:
          "The publication plan was truncated after deterministic ordering because maxReports was reached.",
        metadata: {
          maxReports: specValidation.specification.limits.maxReports,
          truncatedCount,
        },
      }),
    );
  }

  diagnostics.push(
    freezeDiagnostic({
      code: "limits_applied",
      severity: "info",
      message: "Campaign limits were applied.",
      metadata: {
        maxReports: specValidation.specification.limits.maxReports,
        plannedCount: limitedCandidates.length,
        truncatedCount,
      },
    }),
  );

  const items = limitedCandidates.map((candidate, index) => {
    const priorityRank = priorityRanks.get(candidate.reportKey) ?? null;
    const itemBase = deepFreeze({
      index,
      reportKey: candidate.reportKey,
      requestedAction: candidate.requestedAction,
      locale: candidate.locale,
      country: candidate.country,
      city: candidate.city,
      platform: candidate.platform,
      propertyType: candidate.propertyType,
      canonicalPath: candidate.canonicalPath,
      sourceFingerprint: candidate.sourceFingerprint,
      candidateFingerprint: candidate.candidateFingerprint,
      priorityRank,
      isPriority: priorityRank != null,
    });
    return deepFreeze({
      ...itemBase,
      planItemFingerprint: buildPublicationPlanItemFingerprint(itemBase),
    });
  });

  const summary = deepFreeze({
    registryEntryCount: candidateResolution.registryEntryCount,
    selectedCountBeforeExclusions: selectedBeforeExclusions.length,
    excludedCount:
      selectedBeforeExclusions.length - selectedAfterExclusions.length,
    eligibleCount: deduped.candidates.length,
    plannedCount: items.length,
    truncatedCount,
  });

  const planBase = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_SCHEMA_VERSION,
    planVersion: INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_VERSION,
    campaignKey: specValidation.specification.campaignKey,
    requestedAction: specValidation.specification.requestedAction,
    campaignSpecificationFingerprint:
      specValidation.specification.campaignSpecificationFingerprint,
    registryFingerprint,
    createdAt: input.createdAt,
    summary,
    items: Object.freeze(items),
    warnings: Object.freeze(warnings),
    diagnostics: Object.freeze([
      ...diagnostics,
      freezeDiagnostic({
        code: "publication_plan_materialized",
        severity: "info",
        message: "The publication plan was materialized successfully.",
        metadata: {
          plannedCount: items.length,
        },
      }),
    ]),
  });

  const planFingerprint = buildPublicationPlanFingerprint(planBase);
  const plan = deepFreeze({
    ...planBase,
    planFingerprint,
    diagnostics: Object.freeze([
      ...planBase.diagnostics,
      freezeDiagnostic({
        code: "fingerprint_verified",
        severity: "info",
        message: "Publication plan fingerprint computed successfully.",
        metadata: {
          planFingerprint,
        },
      }),
    ]),
  });

  const validation = validateIntelligencePublishingPublicationPlan(plan);
  if (!validation.ok) {
    throw new Error(validation.issues.map((issue) => issue.message).join(" | "));
  }
  return plan;
}

export function validateIntelligencePublishingPublicationPlan(
  input: unknown,
): IntelligencePublishingPublicationPlanValidationResult {
  const issues: IntelligencePublishingPublicationPlanValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "plan",
          message: "Expected a plain publication plan object.",
        },
      ]),
    };
  }
  try {
    assertNoForbiddenPrivateKeys(input, "plan");
  } catch (error) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "plan",
          message: error instanceof Error ? error.message : String(error),
        },
      ]),
    };
  }

  if (
    input.schemaVersion !== INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_SCHEMA_VERSION
  ) {
    issues.push({
      path: "plan.schemaVersion",
      message: "Unsupported publication plan schemaVersion.",
    });
  }
  if (
    input.planVersion !== INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_VERSION
  ) {
    issues.push({
      path: "plan.planVersion",
      message: "Unsupported publication plan version.",
    });
  }
  if (!isNonEmptyString(input.campaignKey) || !validateCampaignKey(input.campaignKey)) {
    issues.push({
      path: "plan.campaignKey",
      message: "Invalid campaignKey in publication plan.",
    });
  }
  if (
    !isNonEmptyString(input.requestedAction) ||
    !INTELLIGENCE_PUBLISHING_BATCH_ACTIONS.includes(
      normalizeDimensionValue(input.requestedAction) as IntelligencePublishingBatchAction,
    )
  ) {
    issues.push({
      path: "plan.requestedAction",
      message: "Invalid requestedAction in publication plan.",
    });
  }
  if (!isNonEmptyString(input.campaignSpecificationFingerprint)) {
    issues.push({
      path: "plan.campaignSpecificationFingerprint",
      message: "campaignSpecificationFingerprint must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(input.registryFingerprint)) {
    issues.push({
      path: "plan.registryFingerprint",
      message: "registryFingerprint must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(input.planFingerprint)) {
    issues.push({
      path: "plan.planFingerprint",
      message: "planFingerprint must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(input.createdAt) || !isCanonicalIsoTimestamp(input.createdAt)) {
    issues.push({
      path: "plan.createdAt",
      message: "createdAt must be a canonical ISO timestamp.",
    });
  }
  if (!isPlainObject(input.summary)) {
    issues.push({
      path: "plan.summary",
      message: "summary must be a plain object.",
    });
  }
  if (!Array.isArray(input.items)) {
    issues.push({
      path: "plan.items",
      message: "items must be an array.",
    });
  }
  if (!Array.isArray(input.warnings)) {
    issues.push({
      path: "plan.warnings",
      message: "warnings must be an array.",
    });
  }
  if (!Array.isArray(input.diagnostics)) {
    issues.push({
      path: "plan.diagnostics",
      message: "diagnostics must be an array.",
    });
  }
  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const summary = input.summary as Record<string, unknown>;
  for (const field of [
    "registryEntryCount",
    "selectedCountBeforeExclusions",
    "excludedCount",
    "eligibleCount",
    "plannedCount",
    "truncatedCount",
  ] as const) {
    if (
      typeof summary[field] !== "number" ||
      !Number.isInteger(summary[field]) ||
      summary[field] < 0
    ) {
      issues.push({
        path: `plan.summary.${field}`,
        message: `${field} must be a non-negative integer.`,
      });
    }
  }

  const items = (input.items as unknown[]).map((item, index) => {
    if (!isPlainObject(item)) {
      issues.push({
        path: `plan.items[${index}]`,
        message: "Each item must be a plain object.",
      });
      return null;
    }
    return item;
  });

  const seenIndexes = new Set<number>();
  const seenLogicalKeys = new Set<string>();
  items.forEach((item, index) => {
    if (item == null) {
      return;
    }
    if (
      typeof item.index !== "number" ||
      !Number.isInteger(item.index) ||
      item.index < 0
    ) {
      issues.push({
        path: `plan.items[${index}].index`,
        message: "Item index must be a non-negative integer.",
      });
    } else if (seenIndexes.has(item.index)) {
      issues.push({
        path: `plan.items[${index}].index`,
        message: "Item indexes must be unique.",
      });
    } else {
      seenIndexes.add(item.index);
    }
    for (const field of [
      "reportKey",
      "locale",
      "country",
      "city",
      "platform",
      "propertyType",
      "candidateFingerprint",
      "planItemFingerprint",
    ] as const) {
      if (!isNonEmptyString(item[field])) {
        issues.push({
          path: `plan.items[${index}].${field}`,
          message: `${field} must be a non-empty string.`,
        });
      }
    }
    if (
      !isNonEmptyString(item.requestedAction) ||
      !INTELLIGENCE_PUBLISHING_BATCH_ACTIONS.includes(
        normalizeDimensionValue(
          item.requestedAction,
        ) as IntelligencePublishingBatchAction,
      )
    ) {
      issues.push({
        path: `plan.items[${index}].requestedAction`,
        message: "requestedAction must be supported.",
      });
    }
    if (
      item.sourceFingerprint != null &&
      !isNonEmptyString(item.sourceFingerprint)
    ) {
      issues.push({
        path: `plan.items[${index}].sourceFingerprint`,
        message: "sourceFingerprint must be null or a non-empty string.",
      });
    }
    if (
      item.canonicalPath != null &&
      !isNonEmptyString(item.canonicalPath)
    ) {
      issues.push({
        path: `plan.items[${index}].canonicalPath`,
        message: "canonicalPath must be null or a non-empty string.",
      });
    }
    if (typeof item.isPriority !== "boolean") {
      issues.push({
        path: `plan.items[${index}].isPriority`,
        message: "isPriority must be a boolean.",
      });
    }
    if (
      item.priorityRank != null &&
      (typeof item.priorityRank !== "number" ||
        !Number.isInteger(item.priorityRank) ||
        item.priorityRank < 0)
    ) {
      issues.push({
        path: `plan.items[${index}].priorityRank`,
        message: "priorityRank must be null or a non-negative integer.",
      });
    }

    if (
      isNonEmptyString(item.reportKey) &&
      isNonEmptyString(item.locale) &&
      isNonEmptyString(item.requestedAction)
    ) {
      const logicalKey = [
        normalizeReportKey(item.reportKey),
        normalizeDimensionValue(item.locale),
        normalizeDimensionValue(item.requestedAction),
      ].join("|");
      if (seenLogicalKeys.has(logicalKey)) {
        issues.push({
          path: `plan.items[${index}]`,
          message:
            "Logical plan items must be unique by reportKey, locale and requestedAction.",
        });
      } else {
        seenLogicalKeys.add(logicalKey);
      }
    }
  });

  const orderedIndexes = [...seenIndexes].sort((left, right) => left - right);
  orderedIndexes.forEach((sequence, index) => {
    if (sequence !== index) {
      issues.push({
        path: "plan.items",
        message: "Item indexes must be contiguous and start at zero.",
      });
    }
  });

  if (
    typeof summary.plannedCount === "number" &&
    Array.isArray(input.items) &&
    summary.plannedCount !== input.items.length
  ) {
    issues.push({
      path: "plan.summary.plannedCount",
      message: "plannedCount must match items.length.",
    });
  }

  if (
    typeof summary.eligibleCount === "number" &&
    typeof summary.truncatedCount === "number" &&
    typeof summary.plannedCount === "number" &&
    summary.eligibleCount - summary.plannedCount !== summary.truncatedCount
  ) {
    issues.push({
      path: "plan.summary",
      message:
        "eligibleCount - plannedCount must equal truncatedCount in the publication plan summary.",
    });
  }

  if (
    typeof summary.selectedCountBeforeExclusions === "number" &&
    typeof summary.excludedCount === "number" &&
    typeof summary.eligibleCount === "number" &&
    summary.selectedCountBeforeExclusions - summary.excludedCount <
      summary.eligibleCount
  ) {
    issues.push({
      path: "plan.summary",
      message:
        "eligibleCount cannot exceed selectedCountBeforeExclusions - excludedCount.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const normalizedItems = (items as Record<string, unknown>[]).map((item) => {
    const base = deepFreeze({
      index: item.index as number,
      reportKey: normalizeReportKey(item.reportKey as string),
      requestedAction: normalizeDimensionValue(
        item.requestedAction as string,
      ) as IntelligencePublishingBatchAction,
      locale: normalizeDimensionValue(item.locale as string),
      country: normalizeDimensionValue(item.country as string),
      city: normalizeDimensionValue(item.city as string),
      platform: normalizeDimensionValue(item.platform as string),
      propertyType: normalizeDimensionValue(item.propertyType as string),
      canonicalPath: normalizeCanonicalPath(item.canonicalPath),
      sourceFingerprint:
        item.sourceFingerprint == null ? null : String(item.sourceFingerprint).trim(),
      candidateFingerprint: String(item.candidateFingerprint).trim(),
      priorityRank:
        item.priorityRank == null ? null : (item.priorityRank as number),
      isPriority: item.isPriority as boolean,
    });
    const candidateFingerprint = buildPlanCandidateFingerprint({
      reportKey: base.reportKey,
      requestedAction: base.requestedAction,
      locale: base.locale,
      country: base.country,
      city: base.city,
      platform: base.platform,
      propertyType: base.propertyType,
      sourceFingerprint: base.sourceFingerprint,
    });
    if (candidateFingerprint !== base.candidateFingerprint) {
      issues.push({
        path: `plan.items[${base.index}].candidateFingerprint`,
        message:
          "candidateFingerprint does not match the normalized publication plan item payload.",
      });
    }
    const expectedPlanItemFingerprint = buildPublicationPlanItemFingerprint(base);
    if (expectedPlanItemFingerprint !== item.planItemFingerprint) {
      issues.push({
        path: `plan.items[${base.index}].planItemFingerprint`,
        message:
          "planItemFingerprint does not match the normalized publication plan item payload.",
      });
    }
    return deepFreeze({
      ...base,
      candidateFingerprint,
      planItemFingerprint: expectedPlanItemFingerprint,
    });
  });

  const warnings = (input.warnings as unknown[]).map((warning, index) => {
    if (!isPlainObject(warning)) {
      issues.push({
        path: `plan.warnings[${index}]`,
        message: "Each warning must be a plain object.",
      });
      return null;
    }
    if (
      !isNonEmptyString(warning.code) ||
      !INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_WARNING_CODES.includes(
        warning.code as IntelligencePublishingPublicationPlanWarningCode,
      )
    ) {
      issues.push({
        path: `plan.warnings[${index}].code`,
        message: "warning.code is not supported.",
      });
    }
    if (!isNonEmptyString(warning.message)) {
      issues.push({
        path: `plan.warnings[${index}].message`,
        message: "warning.message must be a non-empty string.",
      });
    }
    let metadata: CoordinationJsonObject;
    try {
      metadata = freezeMetadata(
        isPlainObject(warning.metadata)
          ? (warning.metadata as CoordinationJsonObject)
          : {},
      );
    } catch (error) {
      issues.push({
        path: `plan.warnings[${index}].metadata`,
        message: error instanceof Error ? error.message : String(error),
      });
      metadata = freezeMetadata({});
    }
    return freezeWarning({
      code: warning.code as IntelligencePublishingPublicationPlanWarningCode,
      message: String(warning.message),
      metadata,
    });
  });

  const diagnostics = (input.diagnostics as unknown[]).map((diagnostic, index) => {
    if (!isPlainObject(diagnostic)) {
      issues.push({
        path: `plan.diagnostics[${index}]`,
        message: "Each diagnostic must be a plain object.",
      });
      return null;
    }
    if (
      !isNonEmptyString(diagnostic.code) ||
      !INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_DIAGNOSTIC_CODES.includes(
        diagnostic.code as IntelligencePublishingPublicationPlanDiagnosticCode,
      )
    ) {
      issues.push({
        path: `plan.diagnostics[${index}].code`,
        message: "diagnostic.code is not supported.",
      });
    }
    if (!["info", "warning", "error"].includes(String(diagnostic.severity))) {
      issues.push({
        path: `plan.diagnostics[${index}].severity`,
        message: "diagnostic.severity is not supported.",
      });
    }
    if (!isNonEmptyString(diagnostic.message)) {
      issues.push({
        path: `plan.diagnostics[${index}].message`,
        message: "diagnostic.message must be a non-empty string.",
      });
    }
    let metadata: CoordinationJsonObject;
    try {
      metadata = freezeMetadata(
        isPlainObject(diagnostic.metadata)
          ? (diagnostic.metadata as CoordinationJsonObject)
          : {},
      );
    } catch (error) {
      issues.push({
        path: `plan.diagnostics[${index}].metadata`,
        message: error instanceof Error ? error.message : String(error),
      });
      metadata = freezeMetadata({});
    }
    return freezeDiagnostic({
      code: diagnostic.code as IntelligencePublishingPublicationPlanDiagnosticCode,
      severity:
        diagnostic.severity as IntelligencePublishingPublicationPlanDiagnosticSeverity,
      message: String(diagnostic.message),
      metadata,
    });
  });

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const normalizedPlanBase = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_SCHEMA_VERSION,
    planVersion: INTELLIGENCE_PUBLISHING_PUBLICATION_PLAN_VERSION,
    campaignKey: (input.campaignKey as string).trim(),
    requestedAction: normalizeDimensionValue(
      input.requestedAction as string,
    ) as IntelligencePublishingBatchAction,
    campaignSpecificationFingerprint: String(
      input.campaignSpecificationFingerprint,
    ).trim(),
    registryFingerprint: String(input.registryFingerprint).trim(),
    createdAt: String(input.createdAt),
    summary: deepFreeze({
      registryEntryCount: summary.registryEntryCount as number,
      selectedCountBeforeExclusions:
        summary.selectedCountBeforeExclusions as number,
      excludedCount: summary.excludedCount as number,
      eligibleCount: summary.eligibleCount as number,
      plannedCount: summary.plannedCount as number,
      truncatedCount: summary.truncatedCount as number,
    }),
    items: Object.freeze(
      normalizedItems.sort((left, right) => left.index - right.index),
    ),
    warnings: Object.freeze(
      warnings.filter(Boolean) as readonly IntelligencePublishingPublicationPlanWarning[],
    ),
    diagnostics: Object.freeze(
      diagnostics.filter(Boolean) as readonly IntelligencePublishingPublicationPlanDiagnostic[],
    ),
  });

  const expectedPlanFingerprint = buildPublicationPlanFingerprint(
    normalizedPlanBase,
  );
  if (expectedPlanFingerprint !== input.planFingerprint) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "plan.planFingerprint",
          message:
            "planFingerprint does not match the normalized publication plan payload.",
        },
      ]),
    };
  }

  return {
    ok: true,
    plan: deepFreeze({
      ...normalizedPlanBase,
      planFingerprint: expectedPlanFingerprint,
    }),
  };
}
