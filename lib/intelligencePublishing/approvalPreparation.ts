import { createHash } from "node:crypto";

import {
  INTELLIGENCE_PUBLISHING_BATCH_ACTIONS,
  INTELLIGENCE_PUBLISHING_BATCH_MODES,
  type IntelligencePublishingBatchAction,
  type IntelligencePublishingBatchCandidate,
  type IntelligencePublishingBatchMode,
} from "./batchPlanning";
import {
  buildIntelligencePublishingExecutionApprovalPolicyFingerprint,
  buildIntelligencePublishingExecutionApprovalRequest,
  validateIntelligencePublishingExecutionApprovalRequest,
  type IntelligencePublishingExecutionApprovalPolicySnapshot,
  type IntelligencePublishingExecutionApprovalRequest,
} from "./approvalGrant";
import {
  buildIntelligencePublishingPublicationPlanCandidateFingerprint,
  validateIntelligencePublishingPublicationPlan,
  type IntelligencePublishingPublicationPlan,
  type IntelligencePublishingPublicationPlanItem,
} from "./campaignPlanning";
import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";
import {
  assertRegistrySnapshotPublicSafe,
  buildRegistrySnapshotFingerprint,
  parseRegistrySnapshot,
  type RegistrySnapshot,
} from "./registryAdapter";
import { buildRegistryBatchCandidatesFromSnapshot } from "./registryBatchRuntime";

export const INTELLIGENCE_PUBLISHING_EXECUTION_REQUEST_SCHEMA_VERSION =
  "ipp_execution_request_v1" as const;
export const INTELLIGENCE_PUBLISHING_EXECUTION_REQUEST_VERSION =
  "ipp_execution_request_contract_v1" as const;

export const INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_SCHEMA_VERSION =
  "ipp_approval_preparation_bundle_v1" as const;
export const INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_VERSION =
  "ipp_approval_preparation_bundle_contract_v1" as const;

export const INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_WARNING_CODES =
  Object.freeze([
    "optional_canonical_path_missing",
    "optional_metadata_ignored",
    "no_candidates_planned",
  ] as const);

export type IntelligencePublishingApprovalPreparationWarningCode =
  (typeof INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_WARNING_CODES)[number];

export const INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_DIAGNOSTIC_CODES =
  Object.freeze([
    "publication_plan_parsed",
    "publication_plan_validated",
    "registry_snapshot_parsed",
    "registry_snapshot_validated",
    "registry_fingerprint_verified",
    "registry_candidates_materialized",
    "plan_items_matched",
    "candidate_order_verified",
    "execution_request_created",
    "execution_request_fingerprint_verified",
    "gate_policy_fingerprint_resolved",
    "approval_request_created",
    "approval_request_validated",
    "approval_preparation_bundle_materialized",
    "bundle_fingerprint_verified",
  ] as const);

export type IntelligencePublishingApprovalPreparationDiagnosticCode =
  (typeof INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_DIAGNOSTIC_CODES)[number];

export type IntelligencePublishingApprovalPreparationDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export const INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_ERROR_CODES =
  Object.freeze([
    "invalid_publication_plan",
    "invalid_registry_snapshot",
    "registry_fingerprint_mismatch",
    "empty_publication_plan_not_executable",
    "plan_item_candidate_not_found",
    "ambiguous_plan_item_candidate",
    "candidate_fingerprint_mismatch",
    "source_fingerprint_mismatch",
    "report_key_mismatch",
    "locale_mismatch",
    "requested_action_mismatch",
    "candidate_order_mismatch",
    "execution_request_invalid",
    "execution_request_fingerprint_mismatch",
    "approval_request_invalid",
    "approval_request_scope_mismatch",
    "gate_policy_fingerprint_mismatch",
    "bundle_fingerprint_mismatch",
    "privacy_validation_failed",
  ] as const);

export type IntelligencePublishingApprovalPreparationErrorCode =
  (typeof INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_ERROR_CODES)[number];

export type IntelligencePublishingApprovalPreparationWarning = Readonly<{
  code: IntelligencePublishingApprovalPreparationWarningCode;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type IntelligencePublishingApprovalPreparationDiagnostic = Readonly<{
  code: IntelligencePublishingApprovalPreparationDiagnosticCode;
  severity: IntelligencePublishingApprovalPreparationDiagnosticSeverity;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type IntelligencePublishingExecutionRequest = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_EXECUTION_REQUEST_SCHEMA_VERSION;
  requestVersion: typeof INTELLIGENCE_PUBLISHING_EXECUTION_REQUEST_VERSION;
  campaignKey: string;
  publicationPlanFingerprint: string;
  campaignSpecificationFingerprint: string;
  registryFingerprint: string;
  requestedAction: IntelligencePublishingBatchAction;
  mode: IntelligencePublishingBatchMode;
  gatePolicy: IntelligencePublishingExecutionApprovalPolicySnapshot;
  gatePolicyFingerprint: string;
  candidateCount: number;
  reportKeysInOrder: readonly string[];
  candidateFingerprintsInOrder: readonly string[];
  orderedCandidatesFingerprint: string;
  candidates: readonly IntelligencePublishingBatchCandidate[];
  executionRequestFingerprint: string;
}>;

export type IntelligencePublishingApprovalPreparationSummary = Readonly<{
  publicationPlanItemCount: number;
  materializedCandidateCount: number;
  requestedActionCount: number;
  uniqueReportKeyCount: number;
}>;

export type IntelligencePublishingApprovalPreparationBundle = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_SCHEMA_VERSION;
  bundleVersion: typeof INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_VERSION;
  campaignKey: string;
  publicationPlanFingerprint: string;
  campaignSpecificationFingerprint: string;
  registryFingerprint: string;
  requestedAction: IntelligencePublishingBatchAction;
  executionMode: IntelligencePublishingBatchMode;
  executionRequest: IntelligencePublishingExecutionRequest;
  executionApprovalRequest: IntelligencePublishingExecutionApprovalRequest;
  candidates: readonly IntelligencePublishingBatchCandidate[];
  summary: IntelligencePublishingApprovalPreparationSummary;
  warnings: readonly IntelligencePublishingApprovalPreparationWarning[];
  diagnostics: readonly IntelligencePublishingApprovalPreparationDiagnostic[];
  bundleFingerprint: string;
  createdAt: string;
}>;

export type BuildIntelligencePublishingApprovalPreparationBundleInput = Readonly<{
  publicationPlan: unknown;
  registrySnapshot: unknown;
  requestedAction: IntelligencePublishingBatchAction;
  executionMode: IntelligencePublishingBatchMode;
  gatePolicy: IntelligencePublishingExecutionApprovalPolicySnapshot;
  createdAt: string;
}>;

export type IntelligencePublishingExecutionRequestValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type IntelligencePublishingExecutionRequestValidationResult =
  | Readonly<{
      ok: true;
      executionRequest: IntelligencePublishingExecutionRequest;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingExecutionRequestValidationIssue[];
    }>;

export type IntelligencePublishingApprovalPreparationBundleValidationIssue =
  Readonly<{
    path: string;
    message: string;
  }>;

export type IntelligencePublishingApprovalPreparationBundleValidationResult =
  | Readonly<{
      ok: true;
      bundle: IntelligencePublishingApprovalPreparationBundle;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingApprovalPreparationBundleValidationIssue[];
    }>;

type MaterializedCandidate = Readonly<{
  candidate: IntelligencePublishingBatchCandidate;
  reportKey: string;
  locale: string;
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  requestedAction: IntelligencePublishingBatchAction;
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

const EXECUTION_REQUEST_ALLOWED_KEYS = new Set([
  "schemaVersion",
  "requestVersion",
  "campaignKey",
  "publicationPlanFingerprint",
  "campaignSpecificationFingerprint",
  "registryFingerprint",
  "requestedAction",
  "mode",
  "gatePolicy",
  "gatePolicyFingerprint",
  "candidateCount",
  "reportKeysInOrder",
  "candidateFingerprintsInOrder",
  "orderedCandidatesFingerprint",
  "candidates",
  "executionRequestFingerprint",
]);

const BUNDLE_ALLOWED_KEYS = new Set([
  "schemaVersion",
  "bundleVersion",
  "campaignKey",
  "publicationPlanFingerprint",
  "campaignSpecificationFingerprint",
  "registryFingerprint",
  "requestedAction",
  "executionMode",
  "executionRequest",
  "executionApprovalRequest",
  "candidates",
  "summary",
  "warnings",
  "diagnostics",
  "bundleFingerprint",
  "createdAt",
]);

export class IntelligencePublishingApprovalPreparationError extends Error {
  readonly code: IntelligencePublishingApprovalPreparationErrorCode;
  readonly diagnostics: readonly IntelligencePublishingApprovalPreparationDiagnostic[];

  constructor(
    input: Readonly<{
      code: IntelligencePublishingApprovalPreparationErrorCode;
      message: string;
      diagnostics?: readonly IntelligencePublishingApprovalPreparationDiagnostic[];
    }>,
  ) {
    super(input.message);
    this.name = "IntelligencePublishingApprovalPreparationError";
    this.code = input.code;
    this.diagnostics = Object.freeze([...(input.diagnostics ?? [])]);
  }
}

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

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
  );
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
    const result = Object.values(value as Record<string, unknown>).every((entry) =>
      isJsonSafe(entry, seen),
    );
    seen.delete(value);
    return result;
  }
  return false;
}

function assertJsonSafe(value: unknown, path: string, seen: WeakSet<object> = new WeakSet()): void {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Expected ${path} to contain only finite numbers.`);
    }
    return;
  }
  if (typeof value === "undefined") {
    throw new Error(`Expected ${path} to avoid undefined values.`);
  }
  if (
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    throw new Error(`Expected ${path} to contain only JSON-safe values.`);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonSafe(entry, `${path}[${index}]`, seen));
    return;
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      throw new Error(`Expected ${path} to avoid circular references.`);
    }
    seen.add(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`Expected ${path} to be a plain JSON-safe object.`);
    }
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertJsonSafe(entry, `${path}.${key}`, seen);
    }
    seen.delete(value);
    return;
  }
  throw new Error(`Expected ${path} to contain only JSON-safe values.`);
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

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAction(value: unknown): IntelligencePublishingBatchAction | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  const normalized = normalizeText(value);
  return INTELLIGENCE_PUBLISHING_BATCH_ACTIONS.includes(
    normalized as IntelligencePublishingBatchAction,
  )
    ? (normalized as IntelligencePublishingBatchAction)
    : null;
}

function normalizeMode(value: unknown): IntelligencePublishingBatchMode | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  const normalized = normalizeText(value);
  return INTELLIGENCE_PUBLISHING_BATCH_MODES.includes(
    normalized as IntelligencePublishingBatchMode,
  )
    ? (normalized as IntelligencePublishingBatchMode)
    : null;
}

function normalizeUniqueSortedStringArray(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values.map((value) => normalizeText(value)))]
      .filter((value) => value.length > 0)
      .sort(compareStrings),
  );
}

function hasExactStringArrayMatch(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function freezeWarning(
  input: Readonly<{
    code: IntelligencePublishingApprovalPreparationWarningCode;
    message: string;
    metadata?: CoordinationJsonObject;
  }>,
): IntelligencePublishingApprovalPreparationWarning {
  return deepFreeze({
    code: input.code,
    message: input.message,
    metadata: freezeMetadata(input.metadata),
  });
}

function freezeDiagnostic(
  input: Readonly<{
    code: IntelligencePublishingApprovalPreparationDiagnosticCode;
    severity: IntelligencePublishingApprovalPreparationDiagnosticSeverity;
    message: string;
    metadata?: CoordinationJsonObject;
  }>,
): IntelligencePublishingApprovalPreparationDiagnostic {
  return deepFreeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    metadata: freezeMetadata(input.metadata),
  });
}

function validateExactKeys(
  input: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
): readonly string[] {
  return Object.keys(input)
    .filter((key) => !allowed.has(key))
    .sort(compareStrings)
    .map((key) => `${path}.${key}`);
}

function buildOrderedCandidatesFingerprint(
  candidateFingerprintsInOrder: readonly string[],
): string {
  return buildStableHash(
    "ipp_execution_request_ordered_candidates_",
    candidateFingerprintsInOrder,
  );
}

function buildExecutionRequestFingerprint(
  input: Omit<IntelligencePublishingExecutionRequest, "executionRequestFingerprint">,
): string {
  return buildStableHash("ipp_execution_request_", {
    schemaVersion: input.schemaVersion,
    requestVersion: input.requestVersion,
    campaignKey: input.campaignKey,
    publicationPlanFingerprint: input.publicationPlanFingerprint,
    campaignSpecificationFingerprint: input.campaignSpecificationFingerprint,
    registryFingerprint: input.registryFingerprint,
    requestedAction: input.requestedAction,
    mode: input.mode,
    gatePolicyFingerprint: input.gatePolicyFingerprint,
    candidateCount: input.candidateCount,
    reportKeysInOrder: input.reportKeysInOrder,
    candidateFingerprintsInOrder: input.candidateFingerprintsInOrder,
    orderedCandidatesFingerprint: input.orderedCandidatesFingerprint,
  });
}

function buildBundleFingerprint(
  input: Readonly<{
    campaignKey: string;
    publicationPlanFingerprint: string;
    campaignSpecificationFingerprint: string;
    registryFingerprint: string;
    requestedAction: IntelligencePublishingBatchAction;
    executionMode: IntelligencePublishingBatchMode;
    executionRequestFingerprint: string;
    approvalRequestFingerprint: string;
    candidateFingerprintsInOrder: readonly string[];
    summary: IntelligencePublishingApprovalPreparationSummary;
    warnings: readonly IntelligencePublishingApprovalPreparationWarning[];
  }>,
): string {
  return buildStableHash("ipp_approval_preparation_bundle_", {
    schemaVersion: INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_SCHEMA_VERSION,
    bundleVersion: INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_VERSION,
    campaignKey: input.campaignKey,
    publicationPlanFingerprint: input.publicationPlanFingerprint,
    campaignSpecificationFingerprint: input.campaignSpecificationFingerprint,
    registryFingerprint: input.registryFingerprint,
    requestedAction: input.requestedAction,
    executionMode: input.executionMode,
    executionRequestFingerprint: input.executionRequestFingerprint,
    approvalRequestFingerprint: input.approvalRequestFingerprint,
    candidateFingerprintsInOrder: input.candidateFingerprintsInOrder,
    summary: input.summary,
    warnings: input.warnings.map((warning) => ({
      code: warning.code,
      message: warning.message,
      metadata: warning.metadata,
    })),
  });
}

function assertPublicSafe(value: unknown, path: string): void {
  assertJsonSafe(value, path);
  assertNoForbiddenPrivateKeys(value, path);
}

function normalizeGatePolicy(
  input: unknown,
): IntelligencePublishingExecutionApprovalPolicySnapshot {
  if (!isPlainObject(input)) {
    throw new Error("gatePolicy must be a plain object.");
  }
  if (typeof input.approvalRequired !== "boolean") {
    throw new Error("gatePolicy.approvalRequired must be a boolean.");
  }
  if (
    input.maxExecuteBatchSize != null &&
    !isFiniteNonNegativeInteger(input.maxExecuteBatchSize)
  ) {
    throw new Error(
      "gatePolicy.maxExecuteBatchSize must be null or a non-negative integer.",
    );
  }
  if (
    input.allowlistReportKeys != null &&
    (!Array.isArray(input.allowlistReportKeys) ||
      !input.allowlistReportKeys.every(isNonEmptyString))
  ) {
    throw new Error(
      "gatePolicy.allowlistReportKeys must be null or an array of non-empty strings.",
    );
  }
  return deepFreeze({
    approvalRequired: input.approvalRequired,
    maxExecuteBatchSize:
      input.maxExecuteBatchSize == null ? null : input.maxExecuteBatchSize,
    allowlistReportKeys:
      input.allowlistReportKeys == null
        ? null
        : normalizeUniqueSortedStringArray(
            input.allowlistReportKeys as readonly string[],
          ),
  });
}

function normalizeCandidate(
  candidate: IntelligencePublishingBatchCandidate,
): MaterializedCandidate {
  const requestedAction = normalizeAction(candidate.requestedAction);
  if (
    !isNonEmptyString(candidate.candidateId) ||
    !isNonEmptyString(candidate.reportKey) ||
    !isNonEmptyString(candidate.locale) ||
    !isNonEmptyString(candidate.country) ||
    !isNonEmptyString(candidate.city) ||
    !isNonEmptyString(candidate.platform) ||
    !isNonEmptyString(candidate.propertyType) ||
    requestedAction == null
  ) {
    throw new Error("Cannot normalize an incomplete batch candidate.");
  }

  const normalized = deepFreeze({
    candidate: deepFreeze({
      candidateId: candidate.candidateId.trim(),
      reportKey: normalizeText(candidate.reportKey),
      locale: normalizeText(candidate.locale),
      country: normalizeText(candidate.country),
      city: normalizeText(candidate.city),
      platform: normalizeText(candidate.platform),
      propertyType: normalizeText(candidate.propertyType),
      ...(typeof candidate.priority === "number" && Number.isFinite(candidate.priority)
        ? { priority: candidate.priority }
        : {}),
      requestedAction,
      sourceFingerprint:
        candidate.sourceFingerprint == null
          ? null
          : String(candidate.sourceFingerprint).trim(),
    }),
    reportKey: normalizeText(candidate.reportKey),
    locale: normalizeText(candidate.locale),
    country: normalizeText(candidate.country),
    city: normalizeText(candidate.city),
    platform: normalizeText(candidate.platform),
    propertyType: normalizeText(candidate.propertyType),
    requestedAction,
    sourceFingerprint:
      candidate.sourceFingerprint == null
        ? null
        : String(candidate.sourceFingerprint).trim(),
    candidateFingerprint:
      buildIntelligencePublishingPublicationPlanCandidateFingerprint({
        reportKey: candidate.reportKey,
        requestedAction,
        locale: candidate.locale,
        country: candidate.country,
        city: candidate.city,
        platform: candidate.platform,
        propertyType: candidate.propertyType,
        sourceFingerprint:
          candidate.sourceFingerprint == null
            ? null
            : String(candidate.sourceFingerprint),
      }),
  });

  return normalized;
}

function buildScopeKey(input: Readonly<{
  reportKey: string;
  locale: string;
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  requestedAction: IntelligencePublishingBatchAction;
}>): string {
  return [
    normalizeText(input.reportKey),
    normalizeText(input.locale),
    normalizeText(input.country),
    normalizeText(input.city),
    normalizeText(input.platform),
    normalizeText(input.propertyType),
    input.requestedAction,
  ].join("|");
}

function buildReportKeyKey(reportKey: string): string {
  return normalizeText(reportKey);
}

function buildReportLocaleKey(reportKey: string, locale: string): string {
  return `${normalizeText(reportKey)}|${normalizeText(locale)}`;
}

function freezeCandidates(
  candidates: readonly IntelligencePublishingBatchCandidate[],
): readonly IntelligencePublishingBatchCandidate[] {
  return deepFreeze(
    candidates.map((candidate) =>
      deepFreeze({
        candidateId: candidate.candidateId.trim(),
        reportKey: normalizeText(candidate.reportKey),
        locale: normalizeText(candidate.locale),
        country: normalizeText(candidate.country),
        city: normalizeText(candidate.city),
        platform: normalizeText(candidate.platform),
        propertyType: normalizeText(candidate.propertyType),
        ...(typeof candidate.priority === "number" && Number.isFinite(candidate.priority)
          ? { priority: candidate.priority }
          : {}),
        requestedAction: normalizeAction(candidate.requestedAction)!,
        sourceFingerprint:
          candidate.sourceFingerprint == null
            ? null
            : String(candidate.sourceFingerprint).trim(),
      }),
    ),
  );
}

function validateCandidateShape(
  candidate: unknown,
  path: string,
): readonly IntelligencePublishingExecutionRequestValidationIssue[] {
  const issues: IntelligencePublishingExecutionRequestValidationIssue[] = [];
  if (!isPlainObject(candidate)) {
    return Object.freeze([
      {
        path,
        message: "Candidate must be a plain object.",
      },
    ]);
  }
  if (!isNonEmptyString(candidate.candidateId)) {
    issues.push({
      path: `${path}.candidateId`,
      message: "candidateId must be a non-empty string.",
    });
  }
  for (const field of [
    "reportKey",
    "locale",
    "country",
    "city",
    "platform",
    "propertyType",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: `${path}.${field}`,
        message: `${field} must be a non-empty string.`,
      });
    }
  }
  if (
    candidate.requestedAction != null &&
    normalizeAction(candidate.requestedAction) == null
  ) {
    issues.push({
      path: `${path}.requestedAction`,
      message: "requestedAction must be generate, publish or refresh.",
    });
  }
  if (
    candidate.sourceFingerprint != null &&
    !isNonEmptyString(candidate.sourceFingerprint)
  ) {
    issues.push({
      path: `${path}.sourceFingerprint`,
      message: "sourceFingerprint must be null or a non-empty string.",
    });
  }
  return Object.freeze(issues);
}

function buildSummary(
  plan: IntelligencePublishingPublicationPlan,
  candidates: readonly IntelligencePublishingBatchCandidate[],
): IntelligencePublishingApprovalPreparationSummary {
  return deepFreeze({
    publicationPlanItemCount: plan.items.length,
    materializedCandidateCount: candidates.length,
    requestedActionCount: new Set(
      candidates.map((candidate) => normalizeAction(candidate.requestedAction) ?? "publish"),
    ).size,
    uniqueReportKeyCount: new Set(
      candidates.map((candidate) => normalizeText(candidate.reportKey)),
    ).size,
  });
}

function buildMaterializationIndexes(
  candidates: readonly MaterializedCandidate[],
): Readonly<{
  byCandidateFingerprint: ReadonlyMap<string, readonly MaterializedCandidate[]>;
  byScope: ReadonlyMap<string, readonly MaterializedCandidate[]>;
  byReportKey: ReadonlyMap<string, readonly MaterializedCandidate[]>;
  byReportLocale: ReadonlyMap<string, readonly MaterializedCandidate[]>;
}> {
  const byCandidateFingerprint = new Map<string, MaterializedCandidate[]>();
  const byScope = new Map<string, MaterializedCandidate[]>();
  const byReportKey = new Map<string, MaterializedCandidate[]>();
  const byReportLocale = new Map<string, MaterializedCandidate[]>();

  for (const candidate of candidates) {
    const candidateFingerprintGroup =
      byCandidateFingerprint.get(candidate.candidateFingerprint) ?? [];
    candidateFingerprintGroup.push(candidate);
    byCandidateFingerprint.set(
      candidate.candidateFingerprint,
      candidateFingerprintGroup,
    );

    const scopeKey = buildScopeKey(candidate);
    const scopeGroup = byScope.get(scopeKey) ?? [];
    scopeGroup.push(candidate);
    byScope.set(scopeKey, scopeGroup);

    const reportKeyGroup = byReportKey.get(buildReportKeyKey(candidate.reportKey)) ?? [];
    reportKeyGroup.push(candidate);
    byReportKey.set(buildReportKeyKey(candidate.reportKey), reportKeyGroup);

    const reportLocaleGroup =
      byReportLocale.get(buildReportLocaleKey(candidate.reportKey, candidate.locale)) ??
      [];
    reportLocaleGroup.push(candidate);
    byReportLocale.set(
      buildReportLocaleKey(candidate.reportKey, candidate.locale),
      reportLocaleGroup,
    );
  }

  return deepFreeze({
    byCandidateFingerprint: new Map(
      [...byCandidateFingerprint.entries()].map(([key, value]) => [
        key,
        Object.freeze([...value]),
      ]),
    ),
    byScope: new Map(
      [...byScope.entries()].map(([key, value]) => [key, Object.freeze([...value])]),
    ),
    byReportKey: new Map(
      [...byReportKey.entries()].map(([key, value]) => [key, Object.freeze([...value])]),
    ),
    byReportLocale: new Map(
      [...byReportLocale.entries()].map(([key, value]) => [key, Object.freeze([...value])]),
    ),
  });
}

function createError(
  code: IntelligencePublishingApprovalPreparationErrorCode,
  message: string,
  diagnostics: readonly IntelligencePublishingApprovalPreparationDiagnostic[],
  metadata?: CoordinationJsonObject,
): IntelligencePublishingApprovalPreparationError {
  return new IntelligencePublishingApprovalPreparationError({
    code,
    message,
    diagnostics: [
      ...diagnostics,
      freezeDiagnostic({
        code: "approval_preparation_bundle_materialized",
        severity: "error",
        message,
        metadata: {
          code,
          ...(metadata ?? {}),
        },
      }),
    ],
  });
}

function matchPlanItemCandidate(
  item: IntelligencePublishingPublicationPlanItem,
  indexes: ReturnType<typeof buildMaterializationIndexes>,
  diagnostics: readonly IntelligencePublishingApprovalPreparationDiagnostic[],
): MaterializedCandidate {
  const exactMatches = indexes.byCandidateFingerprint.get(item.candidateFingerprint) ?? [];
  if (exactMatches.length === 1) {
    return exactMatches[0]!;
  }
  if (exactMatches.length > 1) {
    throw createError(
      "ambiguous_plan_item_candidate",
      "A publication plan item matched multiple registry candidates.",
      diagnostics,
      {
        reportKey: item.reportKey,
        locale: item.locale,
        candidateFingerprint: item.candidateFingerprint,
        matches: exactMatches.length,
      },
    );
  }

  const reportKeyMatches =
    indexes.byReportKey.get(buildReportKeyKey(item.reportKey)) ?? [];
  if (reportKeyMatches.length === 0) {
    throw createError(
      "report_key_mismatch",
      "A publication plan item report key does not exist in the registry snapshot.",
      diagnostics,
      {
        reportKey: item.reportKey,
      },
    );
  }

  const localeMatches =
    indexes.byReportLocale.get(buildReportLocaleKey(item.reportKey, item.locale)) ?? [];
  if (localeMatches.length === 0) {
    throw createError(
      "locale_mismatch",
      "A publication plan item locale does not match the registry snapshot candidate.",
      diagnostics,
      {
        reportKey: item.reportKey,
        locale: item.locale,
      },
    );
  }

  const scopeKey = buildScopeKey({
    reportKey: item.reportKey,
    locale: item.locale,
    country: item.country,
    city: item.city,
    platform: item.platform,
    propertyType: item.propertyType,
    requestedAction: item.requestedAction,
  });
  const scopeMatches = indexes.byScope.get(scopeKey) ?? [];
  if (scopeMatches.length === 0) {
    if (localeMatches.every((candidate) => candidate.requestedAction !== item.requestedAction)) {
      throw createError(
        "requested_action_mismatch",
        "A publication plan item action does not match the registry candidate action.",
        diagnostics,
        {
          reportKey: item.reportKey,
          locale: item.locale,
          requestedAction: item.requestedAction,
        },
      );
    }
    throw createError(
      "plan_item_candidate_not_found",
      "A publication plan item could not be found in the registry snapshot.",
      diagnostics,
      {
        reportKey: item.reportKey,
        locale: item.locale,
        requestedAction: item.requestedAction,
      },
    );
  }

  const sourceMatches = scopeMatches.filter(
    (candidate) => candidate.sourceFingerprint === item.sourceFingerprint,
  );
  if (sourceMatches.length === 0) {
    throw createError(
      "source_fingerprint_mismatch",
      "A publication plan item source fingerprint does not match the registry snapshot.",
      diagnostics,
      {
        reportKey: item.reportKey,
        locale: item.locale,
        sourceFingerprint: item.sourceFingerprint,
      },
    );
  }

  const candidateFingerprintMatches = sourceMatches.filter(
    (candidate) => candidate.candidateFingerprint === item.candidateFingerprint,
  );
  if (candidateFingerprintMatches.length === 0) {
    throw createError(
      "candidate_fingerprint_mismatch",
      "A publication plan item fingerprint does not match the registry candidate.",
      diagnostics,
      {
        reportKey: item.reportKey,
        locale: item.locale,
        candidateFingerprint: item.candidateFingerprint,
      },
    );
  }

  if (candidateFingerprintMatches.length > 1) {
    throw createError(
      "ambiguous_plan_item_candidate",
      "A publication plan item matched multiple registry candidates after source filtering.",
      diagnostics,
      {
        reportKey: item.reportKey,
        locale: item.locale,
        candidateFingerprint: item.candidateFingerprint,
        matches: candidateFingerprintMatches.length,
      },
    );
  }

  return candidateFingerprintMatches[0]!;
}

function buildExecutionRequest(
  input: Readonly<{
    plan: IntelligencePublishingPublicationPlan;
    candidates: readonly IntelligencePublishingBatchCandidate[];
    requestedAction: IntelligencePublishingBatchAction;
    mode: IntelligencePublishingBatchMode;
    gatePolicy: IntelligencePublishingExecutionApprovalPolicySnapshot;
  }>,
): IntelligencePublishingExecutionRequest {
  const frozenCandidates = freezeCandidates(input.candidates);
  const reportKeysInOrder = Object.freeze(
    frozenCandidates.map((candidate) => normalizeText(candidate.reportKey)),
  );
  const candidateFingerprintsInOrder = Object.freeze(
    frozenCandidates.map((candidate) =>
      buildIntelligencePublishingPublicationPlanCandidateFingerprint({
        reportKey: candidate.reportKey,
        requestedAction: normalizeAction(candidate.requestedAction)!,
        locale: candidate.locale,
        country: candidate.country,
        city: candidate.city,
        platform: candidate.platform,
        propertyType: candidate.propertyType,
        sourceFingerprint: candidate.sourceFingerprint ?? null,
      }),
    ),
  );
  const gatePolicyFingerprint =
    buildIntelligencePublishingExecutionApprovalPolicyFingerprint(input.gatePolicy);
  const orderedCandidatesFingerprint = buildOrderedCandidatesFingerprint(
    candidateFingerprintsInOrder,
  );
  const requestBase = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_EXECUTION_REQUEST_SCHEMA_VERSION,
    requestVersion: INTELLIGENCE_PUBLISHING_EXECUTION_REQUEST_VERSION,
    campaignKey: input.plan.campaignKey,
    publicationPlanFingerprint: input.plan.planFingerprint,
    campaignSpecificationFingerprint: input.plan.campaignSpecificationFingerprint,
    registryFingerprint: input.plan.registryFingerprint,
    requestedAction: input.requestedAction,
    mode: input.mode,
    gatePolicy: input.gatePolicy,
    gatePolicyFingerprint,
    candidateCount: frozenCandidates.length,
    reportKeysInOrder,
    candidateFingerprintsInOrder,
    orderedCandidatesFingerprint,
    candidates: frozenCandidates,
  });
  const executionRequestFingerprint = buildExecutionRequestFingerprint(requestBase);
  return deepFreeze({
    ...requestBase,
    executionRequestFingerprint,
  });
}

export function validateIntelligencePublishingExecutionRequest(
  input: unknown,
): IntelligencePublishingExecutionRequestValidationResult {
  const issues: IntelligencePublishingExecutionRequestValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "executionRequest",
          message: "Expected a plain execution request object.",
        },
      ]),
    };
  }

  assertNoForbiddenPrivateKeys(input, "executionRequest");

  for (const path of validateExactKeys(
    input,
    EXECUTION_REQUEST_ALLOWED_KEYS,
    "executionRequest",
  )) {
    issues.push({
      path,
      message: "Unexpected key in execution request.",
    });
  }

  if (
    input.schemaVersion !== INTELLIGENCE_PUBLISHING_EXECUTION_REQUEST_SCHEMA_VERSION
  ) {
    issues.push({
      path: "executionRequest.schemaVersion",
      message: "Unsupported execution request schemaVersion.",
    });
  }
  if (input.requestVersion !== INTELLIGENCE_PUBLISHING_EXECUTION_REQUEST_VERSION) {
    issues.push({
      path: "executionRequest.requestVersion",
      message: "Unsupported execution request requestVersion.",
    });
  }
  for (const field of [
    "campaignKey",
    "publicationPlanFingerprint",
    "campaignSpecificationFingerprint",
    "registryFingerprint",
    "gatePolicyFingerprint",
    "orderedCandidatesFingerprint",
    "executionRequestFingerprint",
  ] as const) {
    if (!isNonEmptyString(input[field])) {
      issues.push({
        path: `executionRequest.${field}`,
        message: `${field} must be a non-empty string.`,
      });
    }
  }

  const requestedAction = normalizeAction(input.requestedAction);
  if (requestedAction == null) {
    issues.push({
      path: "executionRequest.requestedAction",
      message: "requestedAction must be generate, publish or refresh.",
    });
  }

  const mode = normalizeMode(input.mode);
  if (mode == null) {
    issues.push({
      path: "executionRequest.mode",
      message: "mode must be dry_run or execute.",
    });
  }

  if (!isFiniteNonNegativeInteger(input.candidateCount)) {
    issues.push({
      path: "executionRequest.candidateCount",
      message: "candidateCount must be a non-negative integer.",
    });
  }

  if (!Array.isArray(input.reportKeysInOrder)) {
    issues.push({
      path: "executionRequest.reportKeysInOrder",
      message: "reportKeysInOrder must be an array.",
    });
  }

  if (!Array.isArray(input.candidateFingerprintsInOrder)) {
    issues.push({
      path: "executionRequest.candidateFingerprintsInOrder",
      message: "candidateFingerprintsInOrder must be an array.",
    });
  }

  if (!Array.isArray(input.candidates)) {
    issues.push({
      path: "executionRequest.candidates",
      message: "candidates must be an array.",
    });
  }

  let gatePolicy: IntelligencePublishingExecutionApprovalPolicySnapshot | null = null;
  try {
    gatePolicy = normalizeGatePolicy(input.gatePolicy);
  } catch (error) {
    issues.push({
      path: "executionRequest.gatePolicy",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const candidateIssues = Array.isArray(input.candidates)
    ? input.candidates.flatMap((candidate, index) =>
        validateCandidateShape(candidate, `executionRequest.candidates[${index}]`),
      )
    : [];
  issues.push(...candidateIssues);

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const normalizedCandidates = freezeCandidates(
    input.candidates as readonly IntelligencePublishingBatchCandidate[],
  );
  const normalizedReportKeysInOrder = Object.freeze(
    (input.reportKeysInOrder as unknown[]).map((value) => normalizeText(String(value))),
  );
  const normalizedCandidateFingerprintsInOrder = Object.freeze(
    (input.candidateFingerprintsInOrder as unknown[]).map((value) => String(value).trim()),
  );

  const actualReportKeysInOrder = Object.freeze(
    normalizedCandidates.map((candidate) => normalizeText(candidate.reportKey)),
  );
  const actualCandidateFingerprintsInOrder = Object.freeze(
    normalizedCandidates.map((candidate) =>
      buildIntelligencePublishingPublicationPlanCandidateFingerprint({
        reportKey: candidate.reportKey,
        requestedAction: normalizeAction(candidate.requestedAction)!,
        locale: candidate.locale,
        country: candidate.country,
        city: candidate.city,
        platform: candidate.platform,
        propertyType: candidate.propertyType,
        sourceFingerprint: candidate.sourceFingerprint ?? null,
      }),
    ),
  );
  const orderedCandidatesFingerprint = buildOrderedCandidatesFingerprint(
    actualCandidateFingerprintsInOrder,
  );
  const gatePolicyFingerprint =
    buildIntelligencePublishingExecutionApprovalPolicyFingerprint(gatePolicy!);

  if (
    (input.candidateCount as number) !== normalizedCandidates.length ||
    normalizedReportKeysInOrder.length !== normalizedCandidates.length ||
    normalizedCandidateFingerprintsInOrder.length !== normalizedCandidates.length
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "executionRequest.candidateCount",
          message:
            "candidateCount, reportKeysInOrder and candidateFingerprintsInOrder must match candidates length.",
        },
      ]),
    };
  }

  if (!hasExactStringArrayMatch(actualReportKeysInOrder, normalizedReportKeysInOrder)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "executionRequest.reportKeysInOrder",
          message: "reportKeysInOrder must match the candidate order exactly.",
        },
      ]),
    };
  }

  if (
    !hasExactStringArrayMatch(
      actualCandidateFingerprintsInOrder,
      normalizedCandidateFingerprintsInOrder,
    )
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "executionRequest.candidateFingerprintsInOrder",
          message:
            "candidateFingerprintsInOrder must match the candidate order exactly.",
        },
      ]),
    };
  }

  if (orderedCandidatesFingerprint !== input.orderedCandidatesFingerprint) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "executionRequest.orderedCandidatesFingerprint",
          message:
            "orderedCandidatesFingerprint does not match the ordered candidate fingerprints.",
        },
      ]),
    };
  }

  if (gatePolicyFingerprint !== input.gatePolicyFingerprint) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "executionRequest.gatePolicyFingerprint",
          message: "gatePolicyFingerprint does not match the normalized gate policy.",
        },
      ]),
    };
  }

  if (
    !normalizedCandidates.every(
      (candidate) => normalizeAction(candidate.requestedAction) === requestedAction,
    )
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "executionRequest.candidates",
          message: "Every candidate must use the execution request requestedAction.",
        },
      ]),
    };
  }

  const requestBase = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_EXECUTION_REQUEST_SCHEMA_VERSION,
    requestVersion: INTELLIGENCE_PUBLISHING_EXECUTION_REQUEST_VERSION,
    campaignKey: String(input.campaignKey).trim(),
    publicationPlanFingerprint: String(input.publicationPlanFingerprint).trim(),
    campaignSpecificationFingerprint: String(
      input.campaignSpecificationFingerprint,
    ).trim(),
    registryFingerprint: String(input.registryFingerprint).trim(),
    requestedAction: requestedAction!,
    mode: mode!,
    gatePolicy: gatePolicy!,
    gatePolicyFingerprint,
    candidateCount: normalizedCandidates.length,
    reportKeysInOrder: actualReportKeysInOrder,
    candidateFingerprintsInOrder: actualCandidateFingerprintsInOrder,
    orderedCandidatesFingerprint,
    candidates: normalizedCandidates,
  });
  const executionRequestFingerprint = buildExecutionRequestFingerprint(requestBase);
  if (executionRequestFingerprint !== input.executionRequestFingerprint) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "executionRequest.executionRequestFingerprint",
          message:
            "executionRequestFingerprint does not match the normalized execution request payload.",
        },
      ]),
    };
  }

  return {
    ok: true,
    executionRequest: deepFreeze({
      ...requestBase,
      executionRequestFingerprint,
    }),
  };
}

export function validateIntelligencePublishingApprovalPreparationBundle(
  input: unknown,
): IntelligencePublishingApprovalPreparationBundleValidationResult {
  const issues: IntelligencePublishingApprovalPreparationBundleValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle",
          message: "Expected a plain approval preparation bundle object.",
        },
      ]),
    };
  }

  assertNoForbiddenPrivateKeys(input, "bundle");

  for (const path of validateExactKeys(input, BUNDLE_ALLOWED_KEYS, "bundle")) {
    issues.push({
      path,
      message: "Unexpected key in approval preparation bundle.",
    });
  }

  if (
    input.schemaVersion !==
    INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_SCHEMA_VERSION
  ) {
    issues.push({
      path: "bundle.schemaVersion",
      message: "Unsupported approval preparation bundle schemaVersion.",
    });
  }
  if (
    input.bundleVersion !==
    INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_VERSION
  ) {
    issues.push({
      path: "bundle.bundleVersion",
      message: "Unsupported approval preparation bundle bundleVersion.",
    });
  }
  if (!isCanonicalIsoTimestamp(String(input.createdAt ?? ""))) {
    issues.push({
      path: "bundle.createdAt",
      message: "createdAt must be a canonical ISO timestamp.",
    });
  }
  if (!isNonEmptyString(input.bundleFingerprint)) {
    issues.push({
      path: "bundle.bundleFingerprint",
      message: "bundleFingerprint must be a non-empty string.",
    });
  }

  const requestedAction = normalizeAction(input.requestedAction);
  if (requestedAction == null) {
    issues.push({
      path: "bundle.requestedAction",
      message: "requestedAction must be generate, publish or refresh.",
    });
  }
  const executionMode = normalizeMode(input.executionMode);
  if (executionMode == null) {
    issues.push({
      path: "bundle.executionMode",
      message: "executionMode must be dry_run or execute.",
    });
  }

  if (!Array.isArray(input.candidates)) {
    issues.push({
      path: "bundle.candidates",
      message: "candidates must be an array.",
    });
  }
  if (!Array.isArray(input.warnings)) {
    issues.push({
      path: "bundle.warnings",
      message: "warnings must be an array.",
    });
  }
  if (!Array.isArray(input.diagnostics)) {
    issues.push({
      path: "bundle.diagnostics",
      message: "diagnostics must be an array.",
    });
  }
  if (!isPlainObject(input.summary)) {
    issues.push({
      path: "bundle.summary",
      message: "summary must be a plain object.",
    });
  }

  const executionRequestValidation = validateIntelligencePublishingExecutionRequest(
    input.executionRequest,
  );
  if (!executionRequestValidation.ok) {
    issues.push(
      ...executionRequestValidation.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    );
  }

  const approvalRequestValidation = validateIntelligencePublishingExecutionApprovalRequest(
    input.executionApprovalRequest,
  );
  if (!approvalRequestValidation.ok) {
    issues.push(
      ...approvalRequestValidation.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    );
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  if (!executionRequestValidation.ok || !approvalRequestValidation.ok) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle",
          message:
            "Bundle validation reached an inconsistent narrowing state for execution request or approval request.",
        },
      ]),
    };
  }

  const executionRequest = executionRequestValidation.executionRequest;
  const executionApprovalRequest = approvalRequestValidation.request;
  const candidates = freezeCandidates(
    input.candidates as readonly IntelligencePublishingBatchCandidate[],
  );

  if (
    !hasExactStringArrayMatch(
      candidates.map((candidate) =>
        buildIntelligencePublishingPublicationPlanCandidateFingerprint({
          reportKey: candidate.reportKey,
          requestedAction: normalizeAction(candidate.requestedAction)!,
          locale: candidate.locale,
          country: candidate.country,
          city: candidate.city,
          platform: candidate.platform,
          propertyType: candidate.propertyType,
          sourceFingerprint: candidate.sourceFingerprint ?? null,
        }),
      ),
      executionRequest.candidateFingerprintsInOrder,
    )
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle.candidates",
          message:
            "bundle candidates must match the execution request candidate order exactly.",
        },
      ]),
    };
  }

  const expectedApprovalRequest =
    executionRequest.mode === "execute"
      ? buildIntelligencePublishingExecutionApprovalRequest({
          registryFingerprint: executionRequest.registryFingerprint,
          mode: "execute",
          candidates: executionRequest.candidates,
          gatePolicy: executionRequest.gatePolicy,
        })
      : null;

  if (expectedApprovalRequest == null) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle.executionMode",
          message:
            "Approval preparation bundles support execute mode only because approval requests are execute-only.",
        },
      ]),
    };
  }

  if (
    JSON.stringify(expectedApprovalRequest) !== JSON.stringify(executionApprovalRequest)
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle.executionApprovalRequest",
          message:
            "executionApprovalRequest does not match the official approval request helper output.",
        },
      ]),
    };
  }

  if (
    executionApprovalRequest.registryFingerprint !== executionRequest.registryFingerprint ||
    executionApprovalRequest.candidateCount !== executionRequest.candidateCount ||
    executionApprovalRequest.gatePolicyFingerprint !==
      executionRequest.gatePolicyFingerprint
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle.executionApprovalRequest",
          message:
            "executionApprovalRequest scope must match the execution request scope exactly.",
        },
      ]),
    };
  }

  if (
    requestedAction !== executionRequest.requestedAction ||
    executionMode !== executionRequest.mode
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle",
          message:
            "Bundle requestedAction and executionMode must match the execution request.",
        },
      ]),
    };
  }

  const summary = deepFreeze({
    publicationPlanItemCount: Number((input.summary as Record<string, unknown>).publicationPlanItemCount),
    materializedCandidateCount: Number(
      (input.summary as Record<string, unknown>).materializedCandidateCount,
    ),
    requestedActionCount: Number((input.summary as Record<string, unknown>).requestedActionCount),
    uniqueReportKeyCount: Number((input.summary as Record<string, unknown>).uniqueReportKeyCount),
  });

  if (
    !Object.values(summary).every((value) => isFiniteNonNegativeInteger(value)) ||
    summary.materializedCandidateCount !== executionRequest.candidateCount ||
    summary.publicationPlanItemCount !== executionRequest.candidateCount ||
    summary.requestedActionCount !== 1 ||
    summary.uniqueReportKeyCount !==
      new Set(executionRequest.reportKeysInOrder).size
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle.summary",
          message: "summary must be coherent with the execution request.",
        },
      ]),
    };
  }

  const warningIssues: IntelligencePublishingApprovalPreparationBundleValidationIssue[] = [];
  const warnings = deepFreeze(
    (input.warnings as unknown[])
      .map((warning, index) => {
        if (!isPlainObject(warning)) {
          warningIssues.push({
            path: `bundle.warnings[${index}]`,
            message: "Warning must be a plain object.",
          });
          return null;
        }
        if (
          !INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_WARNING_CODES.includes(
            warning.code as IntelligencePublishingApprovalPreparationWarningCode,
          )
        ) {
          warningIssues.push({
            path: `bundle.warnings[${index}].code`,
            message: "Warning code is unsupported.",
          });
          return null;
        }
        try {
          return freezeWarning({
            code: warning.code as IntelligencePublishingApprovalPreparationWarningCode,
            message: String(warning.message ?? ""),
            metadata: freezeMetadata(
              isPlainObject(warning.metadata)
                ? (warning.metadata as CoordinationJsonObject)
                : {},
            ),
          });
        } catch (error) {
          warningIssues.push({
            path: `bundle.warnings[${index}]`,
            message: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      })
      .filter(
        (
          warning,
        ): warning is IntelligencePublishingApprovalPreparationWarning =>
          warning != null,
      ),
  );

  const diagnosticIssues: IntelligencePublishingApprovalPreparationBundleValidationIssue[] = [];
  const diagnostics = deepFreeze(
    (input.diagnostics as unknown[])
      .map((diagnostic, index) => {
        if (!isPlainObject(diagnostic)) {
          diagnosticIssues.push({
            path: `bundle.diagnostics[${index}]`,
            message: "Diagnostic must be a plain object.",
          });
          return null;
        }
        if (
          !INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_DIAGNOSTIC_CODES.includes(
            diagnostic.code as IntelligencePublishingApprovalPreparationDiagnosticCode,
          )
        ) {
          diagnosticIssues.push({
            path: `bundle.diagnostics[${index}].code`,
            message: "Diagnostic code is unsupported.",
          });
          return null;
        }
        if (
          !["info", "warning", "error"].includes(String(diagnostic.severity ?? ""))
        ) {
          diagnosticIssues.push({
            path: `bundle.diagnostics[${index}].severity`,
            message: "Diagnostic severity is unsupported.",
          });
          return null;
        }
        try {
          return freezeDiagnostic({
            code:
              diagnostic.code as IntelligencePublishingApprovalPreparationDiagnosticCode,
            severity:
              diagnostic.severity as IntelligencePublishingApprovalPreparationDiagnosticSeverity,
            message: String(diagnostic.message ?? ""),
            metadata: freezeMetadata(
              isPlainObject(diagnostic.metadata)
                ? (diagnostic.metadata as CoordinationJsonObject)
                : {},
            ),
          });
        } catch (error) {
          diagnosticIssues.push({
            path: `bundle.diagnostics[${index}]`,
            message: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      })
      .filter(
        (
          diagnostic,
        ): diagnostic is IntelligencePublishingApprovalPreparationDiagnostic =>
          diagnostic != null,
      ),
  );

  if (warningIssues.length > 0 || diagnosticIssues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze([...warningIssues, ...diagnosticIssues]),
    };
  }

  const expectedBundleFingerprint = buildBundleFingerprint({
    campaignKey: String(input.campaignKey).trim(),
    publicationPlanFingerprint: String(input.publicationPlanFingerprint).trim(),
    campaignSpecificationFingerprint: String(
      input.campaignSpecificationFingerprint,
    ).trim(),
    registryFingerprint: String(input.registryFingerprint).trim(),
    requestedAction: requestedAction!,
    executionMode: executionMode!,
    executionRequestFingerprint: executionRequest.executionRequestFingerprint,
    approvalRequestFingerprint: executionApprovalRequest.requestFingerprint,
    candidateFingerprintsInOrder: executionRequest.candidateFingerprintsInOrder,
    summary,
    warnings,
  });

  if (expectedBundleFingerprint !== input.bundleFingerprint) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle.bundleFingerprint",
          message:
            "bundleFingerprint does not match the normalized approval preparation bundle payload.",
        },
      ]),
    };
  }

  const bundle = deepFreeze({
    schemaVersion:
      INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_SCHEMA_VERSION,
    bundleVersion: INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_VERSION,
    campaignKey: String(input.campaignKey).trim(),
    publicationPlanFingerprint: String(input.publicationPlanFingerprint).trim(),
    campaignSpecificationFingerprint: String(
      input.campaignSpecificationFingerprint,
    ).trim(),
    registryFingerprint: String(input.registryFingerprint).trim(),
    requestedAction: requestedAction!,
    executionMode: executionMode!,
    executionRequest,
    executionApprovalRequest,
    candidates,
    summary,
    warnings,
    diagnostics,
    bundleFingerprint: expectedBundleFingerprint,
    createdAt: String(input.createdAt).trim(),
  });

  try {
    assertPublicSafe(bundle, "bundle");
  } catch (error) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle",
          message: error instanceof Error ? error.message : String(error),
        },
      ]),
    };
  }

  return {
    ok: true,
    bundle,
  };
}

export function assertValidIntelligencePublishingApprovalPreparationBundle(
  input: unknown,
): IntelligencePublishingApprovalPreparationBundle {
  const validation = validateIntelligencePublishingApprovalPreparationBundle(input);
  if (!validation.ok) {
    throw new Error(
      `Invalid approval preparation bundle: ${validation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }
  return validation.bundle;
}

export function buildIntelligencePublishingApprovalPreparationBundle(
  input: BuildIntelligencePublishingApprovalPreparationBundleInput,
): IntelligencePublishingApprovalPreparationBundle {
  const diagnostics: IntelligencePublishingApprovalPreparationDiagnostic[] = [];

  const planValidation = validateIntelligencePublishingPublicationPlan(
    input.publicationPlan,
  );
  diagnostics.push(
    freezeDiagnostic({
      code: "publication_plan_parsed",
      severity: planValidation.ok ? "info" : "error",
      message: planValidation.ok
        ? "Publication plan parsed successfully."
        : "Publication plan parsing failed.",
      metadata: {
        ok: planValidation.ok,
        issueCount: planValidation.ok ? 0 : planValidation.issues.length,
      },
    }),
  );
  if (!planValidation.ok) {
    throw createError(
      "invalid_publication_plan",
      "Publication plan validation failed.",
      diagnostics,
      {
        issueCount: planValidation.issues.length,
      },
    );
  }

  const plan = planValidation.plan;
  diagnostics.push(
    freezeDiagnostic({
      code: "publication_plan_validated",
      severity: "info",
      message: "Publication plan validated successfully.",
      metadata: {
        campaignKey: plan.campaignKey,
        itemCount: plan.items.length,
        requestedAction: plan.requestedAction,
        planFingerprint: plan.planFingerprint,
      },
    }),
  );

  try {
    assertPublicSafe(plan, "publicationPlan");
  } catch (error) {
    throw createError(
      "privacy_validation_failed",
      "Publication plan privacy validation failed.",
      diagnostics,
      {
        target: "publicationPlan",
        message: error instanceof Error ? error.message : String(error),
      },
    );
  }

  let snapshot: RegistrySnapshot;
  try {
    snapshot = parseRegistrySnapshot(input.registrySnapshot);
  } catch (error) {
    diagnostics.push(
      freezeDiagnostic({
        code: "registry_snapshot_parsed",
        severity: "error",
        message: "Registry snapshot parsing failed.",
        metadata: {
          message: error instanceof Error ? error.message : String(error),
        },
      }),
    );
    throw createError(
      "invalid_registry_snapshot",
      "Registry snapshot parsing failed.",
      diagnostics,
    );
  }

  diagnostics.push(
    freezeDiagnostic({
      code: "registry_snapshot_parsed",
      severity: "info",
      message: "Registry snapshot parsed successfully.",
      metadata: {
        assetCount: snapshot.assets.length,
      },
    }),
  );

  try {
    assertRegistrySnapshotPublicSafe(snapshot);
    assertPublicSafe(snapshot, "registrySnapshot");
  } catch (error) {
    throw createError(
      "privacy_validation_failed",
      "Registry snapshot privacy validation failed.",
      diagnostics,
      {
        target: "registrySnapshot",
        message: error instanceof Error ? error.message : String(error),
      },
    );
  }

  diagnostics.push(
    freezeDiagnostic({
      code: "registry_snapshot_validated",
      severity: "info",
      message: "Registry snapshot validated successfully.",
      metadata: {
        assetCount: snapshot.assets.length,
      },
    }),
  );

  const normalizedRequestedAction = normalizeAction(input.requestedAction);
  if (normalizedRequestedAction == null) {
    throw createError(
      "requested_action_mismatch",
      "requestedAction must be generate, publish or refresh.",
      diagnostics,
    );
  }
  if (normalizedRequestedAction !== plan.requestedAction) {
    throw createError(
      "requested_action_mismatch",
      "requestedAction must match the publication plan requestedAction exactly.",
      diagnostics,
      {
        requestedAction: normalizedRequestedAction,
        planRequestedAction: plan.requestedAction,
      },
    );
  }
  if (
    !plan.items.every((item) => item.requestedAction === plan.requestedAction)
  ) {
    throw createError(
      "requested_action_mismatch",
      "Every publication plan item must use the publication plan requestedAction.",
      diagnostics,
      {
        planRequestedAction: plan.requestedAction,
      },
    );
  }

  const mode = normalizeMode(input.executionMode);
  if (mode == null) {
    throw createError(
      "execution_request_invalid",
      "executionMode must be dry_run or execute.",
      diagnostics,
    );
  }
  if (mode !== "execute") {
    throw createError(
      "execution_request_invalid",
      "Approval preparation supports execute mode only because approval requests are execute-only.",
      diagnostics,
      {
        executionMode: mode,
      },
    );
  }

  if (!isCanonicalIsoTimestamp(input.createdAt)) {
    throw createError(
      "execution_request_invalid",
      "createdAt must be a canonical ISO timestamp.",
      diagnostics,
    );
  }

  if (plan.items.length === 0) {
    throw createError(
      "empty_publication_plan_not_executable",
      "A publication plan with zero items cannot produce an executable approval request.",
      diagnostics,
      {
        campaignKey: plan.campaignKey,
      },
    );
  }

  const gatePolicy = (() => {
    try {
      const normalized = normalizeGatePolicy(input.gatePolicy);
      assertPublicSafe(normalized, "gatePolicy");
      return normalized;
    } catch (error) {
      throw createError(
        "execution_request_invalid",
        "gatePolicy validation failed.",
        diagnostics,
        {
          message: error instanceof Error ? error.message : String(error),
        },
      );
    }
  })();

  const recalculatedRegistryFingerprint = buildRegistrySnapshotFingerprint(snapshot);
  if (recalculatedRegistryFingerprint !== plan.registryFingerprint) {
    throw createError(
      "registry_fingerprint_mismatch",
      "Registry fingerprint does not match the publication plan fingerprint.",
      diagnostics,
      {
        publicationPlanRegistryFingerprint: plan.registryFingerprint,
        recalculatedRegistryFingerprint,
      },
    );
  }

  diagnostics.push(
    freezeDiagnostic({
      code: "registry_fingerprint_verified",
      severity: "info",
      message: "Registry fingerprint verified successfully.",
      metadata: {
        registryFingerprint: recalculatedRegistryFingerprint,
      },
    }),
  );

  const registryCandidatesResult = buildRegistryBatchCandidatesFromSnapshot({
    registrySnapshot: snapshot,
    channel: "web",
    requestedAction: plan.requestedAction,
  });

  const normalizedRegistryCandidates = registryCandidatesResult.candidates.map((candidate) =>
    normalizeCandidate(candidate),
  );
  const indexes = buildMaterializationIndexes(normalizedRegistryCandidates);

  diagnostics.push(
    freezeDiagnostic({
      code: "registry_candidates_materialized",
      severity: "info",
      message: "Registry batch candidates materialized successfully.",
      metadata: {
        candidateCount: normalizedRegistryCandidates.length,
        registryFingerprint: registryCandidatesResult.snapshotFingerprint,
      },
    }),
  );

  const matchedCandidates: IntelligencePublishingBatchCandidate[] = [];
  for (const item of plan.items) {
    const matched = matchPlanItemCandidate(item, indexes, diagnostics);
    matchedCandidates.push(matched.candidate);
  }

  diagnostics.push(
    freezeDiagnostic({
      code: "plan_items_matched",
      severity: "info",
      message: "Publication plan items matched registry candidates successfully.",
      metadata: {
        itemCount: plan.items.length,
      },
    }),
  );

  const candidateFingerprintsInOrder = Object.freeze(
    matchedCandidates.map((candidate) =>
      buildIntelligencePublishingPublicationPlanCandidateFingerprint({
        reportKey: candidate.reportKey,
        requestedAction: normalizeAction(candidate.requestedAction)!,
        locale: candidate.locale,
        country: candidate.country,
        city: candidate.city,
        platform: candidate.platform,
        propertyType: candidate.propertyType,
        sourceFingerprint: candidate.sourceFingerprint ?? null,
      }),
    ),
  );

  if (
    !hasExactStringArrayMatch(
      candidateFingerprintsInOrder,
      plan.items.map((item) => item.candidateFingerprint),
    )
  ) {
    throw createError(
      "candidate_order_mismatch",
      "The materialized candidate order does not match the publication plan order.",
      diagnostics,
      {
        itemCount: plan.items.length,
      },
    );
  }

  diagnostics.push(
    freezeDiagnostic({
      code: "candidate_order_verified",
      severity: "info",
      message: "Publication plan order preserved successfully.",
      metadata: {
        itemCount: plan.items.length,
      },
    }),
  );

  const gatePolicyFingerprint =
    buildIntelligencePublishingExecutionApprovalPolicyFingerprint(gatePolicy);
  diagnostics.push(
    freezeDiagnostic({
      code: "gate_policy_fingerprint_resolved",
      severity: "info",
      message: "Gate policy fingerprint resolved successfully.",
      metadata: {
        gatePolicyFingerprint,
      },
    }),
  );

  const executionRequest = buildExecutionRequest({
    plan,
    candidates: matchedCandidates,
    requestedAction: plan.requestedAction,
    mode,
    gatePolicy,
  });
  const executionRequestValidation =
    validateIntelligencePublishingExecutionRequest(executionRequest);
  if (!executionRequestValidation.ok) {
    throw createError(
      "execution_request_invalid",
      "Execution request validation failed.",
      diagnostics,
      {
        issueCount: executionRequestValidation.issues.length,
      },
    );
  }

  diagnostics.push(
    freezeDiagnostic({
      code: "execution_request_created",
      severity: "info",
      message: "Execution request created successfully.",
      metadata: {
        executionRequestFingerprint: executionRequest.executionRequestFingerprint,
        candidateCount: executionRequest.candidateCount,
        executionMode: executionRequest.mode,
      },
    }),
  );
  diagnostics.push(
    freezeDiagnostic({
      code: "execution_request_fingerprint_verified",
      severity: "info",
      message: "Execution request fingerprint verified successfully.",
      metadata: {
        executionRequestFingerprint: executionRequest.executionRequestFingerprint,
      },
    }),
  );

  if (executionRequest.gatePolicyFingerprint !== gatePolicyFingerprint) {
    throw createError(
      "gate_policy_fingerprint_mismatch",
      "Execution request gatePolicyFingerprint does not match the normalized gate policy.",
      diagnostics,
      {
        executionRequestGatePolicyFingerprint:
          executionRequest.gatePolicyFingerprint,
        gatePolicyFingerprint,
      },
    );
  }

  const executionApprovalRequest =
    buildIntelligencePublishingExecutionApprovalRequest({
      registryFingerprint: executionRequest.registryFingerprint,
      mode: "execute",
      candidates: executionRequest.candidates,
      gatePolicy: executionRequest.gatePolicy,
    });
  const approvalRequestValidation =
    validateIntelligencePublishingExecutionApprovalRequest(
      executionApprovalRequest,
    );
  if (!approvalRequestValidation.ok) {
    throw createError(
      "approval_request_invalid",
      "Approval request validation failed.",
      diagnostics,
      {
        issueCount: approvalRequestValidation.issues.length,
      },
    );
  }

  diagnostics.push(
    freezeDiagnostic({
      code: "approval_request_created",
      severity: "info",
      message: "Approval request created successfully.",
      metadata: {
        requestFingerprint: executionApprovalRequest.requestFingerprint,
        candidateCount: executionApprovalRequest.candidateCount,
      },
    }),
  );
  diagnostics.push(
    freezeDiagnostic({
      code: "approval_request_validated",
      severity: "info",
      message: "Approval request validated successfully.",
      metadata: {
        requestFingerprint: executionApprovalRequest.requestFingerprint,
      },
    }),
  );

  const expectedReportKeys = normalizeUniqueSortedStringArray(
    executionRequest.reportKeysInOrder,
  );
  if (
    executionApprovalRequest.candidateCount !== plan.items.length ||
    executionApprovalRequest.registryFingerprint !== plan.registryFingerprint ||
    executionApprovalRequest.gatePolicyFingerprint !== gatePolicyFingerprint ||
    !hasExactStringArrayMatch(
      executionApprovalRequest.requestedActions,
      Object.freeze([plan.requestedAction]),
    ) ||
    !hasExactStringArrayMatch(
      executionApprovalRequest.reportKeys,
      expectedReportKeys,
    )
  ) {
    throw createError(
      "approval_request_scope_mismatch",
      "Approval request scope does not match the execution request scope.",
      diagnostics,
      {
        candidateCount: executionApprovalRequest.candidateCount,
        expectedCandidateCount: plan.items.length,
        registryFingerprint: executionApprovalRequest.registryFingerprint,
        expectedRegistryFingerprint: plan.registryFingerprint,
      },
    );
  }

  const warnings: IntelligencePublishingApprovalPreparationWarning[] = [];
  const missingCanonicalPathCount = plan.items.filter(
    (item) => item.canonicalPath == null,
  ).length;
  if (missingCanonicalPathCount > 0) {
    warnings.push(
      freezeWarning({
        code: "optional_canonical_path_missing",
        message:
          "Some publication plan items do not expose an optional canonicalPath.",
        metadata: {
          count: missingCanonicalPathCount,
        },
      }),
    );
  }

  const summary = buildSummary(plan, matchedCandidates);
  const frozenWarnings = deepFreeze(warnings);
  const bundleFingerprint = buildBundleFingerprint({
    campaignKey: plan.campaignKey,
    publicationPlanFingerprint: plan.planFingerprint,
    campaignSpecificationFingerprint: plan.campaignSpecificationFingerprint,
    registryFingerprint: plan.registryFingerprint,
    requestedAction: plan.requestedAction,
    executionMode: mode,
    executionRequestFingerprint: executionRequest.executionRequestFingerprint,
    approvalRequestFingerprint: executionApprovalRequest.requestFingerprint,
    candidateFingerprintsInOrder: executionRequest.candidateFingerprintsInOrder,
    summary,
    warnings: frozenWarnings,
  });
  diagnostics.push(
    freezeDiagnostic({
      code: "approval_preparation_bundle_materialized",
      severity: "info",
      message: "Approval preparation bundle materialized successfully.",
      metadata: {
        bundleFingerprint,
        itemCount: plan.items.length,
      },
    }),
  );
  diagnostics.push(
    freezeDiagnostic({
      code: "bundle_fingerprint_verified",
      severity: "info",
      message: "Approval preparation bundle fingerprint verified successfully.",
      metadata: {
        bundleFingerprint,
      },
    }),
  );

  const bundleBase = deepFreeze({
    schemaVersion:
      INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_SCHEMA_VERSION,
    bundleVersion: INTELLIGENCE_PUBLISHING_APPROVAL_PREPARATION_BUNDLE_VERSION,
    campaignKey: plan.campaignKey,
    publicationPlanFingerprint: plan.planFingerprint,
    campaignSpecificationFingerprint: plan.campaignSpecificationFingerprint,
    registryFingerprint: plan.registryFingerprint,
    requestedAction: plan.requestedAction,
    executionMode: mode,
    executionRequest,
    executionApprovalRequest,
    candidates: executionRequest.candidates,
    summary,
    warnings: frozenWarnings,
    diagnostics: deepFreeze(diagnostics),
    createdAt: input.createdAt,
  });

  const finalBundle = deepFreeze({
    ...bundleBase,
    bundleFingerprint,
  });

  try {
    assertPublicSafe(finalBundle, "bundle");
  } catch (error) {
    throw createError(
      "privacy_validation_failed",
      "Approval preparation bundle privacy validation failed.",
      diagnostics,
      {
        target: "bundle",
        message: error instanceof Error ? error.message : String(error),
      },
    );
  }

  const finalValidation =
    validateIntelligencePublishingApprovalPreparationBundle(finalBundle);
  if (!finalValidation.ok) {
    throw createError(
      "bundle_fingerprint_mismatch",
      "Approval preparation bundle validation failed after construction.",
      diagnostics,
      {
        issueCount: finalValidation.issues.length,
      },
    );
  }

  return finalValidation.bundle;
}
