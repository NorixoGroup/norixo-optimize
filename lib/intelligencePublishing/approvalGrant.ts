import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  INTELLIGENCE_PUBLISHING_BATCH_ACTIONS,
  type IntelligencePublishingBatchAction,
  type IntelligencePublishingBatchCandidate,
} from "./batchPlanning";
import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";

export const INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_SCHEMA_VERSION =
  "ipp_execution_approval_request_v1" as const;
export const INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_VERSION =
  "ipp_execution_approval_request_contract_v1" as const;

export const INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SCHEMA_VERSION =
  "ipp_approval_grant_v1" as const;
export const INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_VERSION =
  "ipp_approval_grant_contract_v1" as const;

export const INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SIGNATURE_ALGORITHMS =
  Object.freeze(["hmac_sha256"] as const);

export type IntelligencePublishingApprovalGrantSignatureAlgorithm =
  (typeof INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SIGNATURE_ALGORITHMS)[number];

export const DEFAULT_APPROVAL_GRANT_MAX_LIFETIME_SECONDS = 900 as const;
export const DEFAULT_APPROVAL_GRANT_ALLOWED_CLOCK_SKEW_SECONDS = 60 as const;
export const MIN_APPROVAL_GRANT_SECRET_LENGTH_BYTES = 16 as const;

export type IntelligencePublishingExecutionApprovalPolicySnapshot = Readonly<{
  approvalRequired: boolean;
  maxExecuteBatchSize: number | null;
  allowlistReportKeys: readonly string[] | null;
}>;

export type IntelligencePublishingExecutionApprovalRequest = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_SCHEMA_VERSION;
  requestVersion: typeof INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_VERSION;
  registryFingerprint: string;
  mode: "execute";
  candidateCount: number;
  candidatesFingerprint: string;
  requestedActions: readonly IntelligencePublishingBatchAction[];
  reportKeys: readonly string[];
  gatePolicyFingerprint: string;
  requestFingerprint: string;
}>;

export type IntelligencePublishingExecutionApprovalRequestValidationIssue =
  Readonly<{
    path: string;
    message: string;
  }>;

export type IntelligencePublishingExecutionApprovalRequestValidationResult =
  | Readonly<{
      ok: true;
      request: IntelligencePublishingExecutionApprovalRequest;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingExecutionApprovalRequestValidationIssue[];
    }>;

export type BuildIntelligencePublishingExecutionApprovalRequestInput = Readonly<{
  registryFingerprint: string;
  mode: "execute";
  candidates: readonly IntelligencePublishingBatchCandidate[];
  gatePolicy: IntelligencePublishingExecutionApprovalPolicySnapshot;
}>;

export type IntelligencePublishingApprovalGrant = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SCHEMA_VERSION;
  grantVersion: typeof INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_VERSION;
  grantId: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  executionRequestFingerprint: string;
  registryFingerprint: string;
  mode: "execute";
  approvedActions: readonly IntelligencePublishingBatchAction[];
  approvedReportKeys: readonly string[];
  approvedCandidateCount: number;
  maxApprovedBatchSize: number;
  metadata: CoordinationJsonObject;
  signatureAlgorithm: IntelligencePublishingApprovalGrantSignatureAlgorithm;
  signature: string;
}>;

export type IntelligencePublishingApprovalGrantValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type IntelligencePublishingApprovalGrantValidationResult =
  | Readonly<{
      ok: true;
      grant: IntelligencePublishingApprovalGrant;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingApprovalGrantValidationIssue[];
    }>;

export type IssueIntelligencePublishingApprovalGrantInput = Readonly<{
  approvalRequest: unknown;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  secret: string;
  metadata?: CoordinationJsonObject;
  approvedActions?: readonly IntelligencePublishingBatchAction[];
  approvedReportKeys?: readonly string[];
  approvedCandidateCount?: number;
  maxApprovedBatchSize?: number;
  signatureAlgorithm?: IntelligencePublishingApprovalGrantSignatureAlgorithm;
  maxGrantLifetimeSeconds?: number;
}>;

export const INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_REASON_CODES =
  Object.freeze([
    "approval_grant_missing",
    "approval_grant_invalid",
    "approval_grant_expired",
    "approval_grant_not_yet_valid",
    "approval_grant_signature_invalid",
    "approval_grant_schema_unsupported",
    "approval_grant_version_unsupported",
    "approval_grant_algorithm_unsupported",
    "approval_grant_registry_mismatch",
    "approval_grant_request_mismatch",
    "approval_grant_scope_mismatch",
    "approval_grant_action_not_allowed",
    "approval_grant_report_not_allowed",
    "approval_grant_candidate_count_mismatch",
    "approval_grant_batch_size_exceeded",
    "approval_grant_id_mismatch",
    "approval_grant_verified",
  ] as const);

export type IntelligencePublishingApprovalGrantReasonCode =
  (typeof INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_REASON_CODES)[number];

export type IntelligencePublishingApprovalGrantPublicSummary = Readonly<{
  grantId: string | null;
  issuer: string | null;
  schemaVersion: string | null;
  grantVersion: string | null;
  signatureAlgorithm: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  executionRequestFingerprint: string | null;
  registryFingerprint: string | null;
  approvedCandidateCount: number | null;
  maxApprovedBatchSize: number | null;
}>;

export type VerifyIntelligencePublishingApprovalGrantOptions = Readonly<{
  secret: string;
  now: string;
  maxGrantLifetimeSeconds?: number;
  allowedClockSkewSeconds?: number;
}>;

export type VerifyIntelligencePublishingApprovalGrantInput = Readonly<{
  approvalRequest: unknown;
  approvalGrant: unknown;
  options: VerifyIntelligencePublishingApprovalGrantOptions;
}>;

export type VerifyIntelligencePublishingApprovalGrantResult =
  | Readonly<{
      ok: true;
      reasonCode: "approval_grant_verified";
      publicSummary: IntelligencePublishingApprovalGrantPublicSummary;
      request: IntelligencePublishingExecutionApprovalRequest;
      grant: IntelligencePublishingApprovalGrant;
      structureValidated: true;
      signatureValidated: true;
      timeValidated: true;
      scopeValidated: true;
    }>
  | Readonly<{
      ok: false;
      reasonCode: Exclude<
        IntelligencePublishingApprovalGrantReasonCode,
        "approval_grant_verified" | "approval_grant_missing"
      >;
      publicSummary: IntelligencePublishingApprovalGrantPublicSummary;
      request: IntelligencePublishingExecutionApprovalRequest | null;
      grant: IntelligencePublishingApprovalGrant | null;
      structureValidated: boolean;
      signatureValidated: boolean;
      timeValidated: boolean;
      scopeValidated: boolean;
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

const REQUEST_ALLOWED_KEYS = new Set([
  "schemaVersion",
  "requestVersion",
  "registryFingerprint",
  "mode",
  "candidateCount",
  "candidatesFingerprint",
  "requestedActions",
  "reportKeys",
  "gatePolicyFingerprint",
  "requestFingerprint",
]);

const GRANT_ALLOWED_KEYS = new Set([
  "schemaVersion",
  "grantVersion",
  "grantId",
  "issuer",
  "issuedAt",
  "expiresAt",
  "executionRequestFingerprint",
  "registryFingerprint",
  "mode",
  "approvedActions",
  "approvedReportKeys",
  "approvedCandidateCount",
  "maxApprovedBatchSize",
  "metadata",
  "signatureAlgorithm",
  "signature",
]);

type NormalizedApprovalCandidate = Readonly<{
  reportKey: string;
  locale: string;
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  requestedAction: IntelligencePublishingBatchAction;
}>;

type ApprovalGrantUnsignedPayload = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SCHEMA_VERSION;
  grantVersion: typeof INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_VERSION;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  executionRequestFingerprint: string;
  registryFingerprint: string;
  mode: "execute";
  approvedActions: readonly IntelligencePublishingBatchAction[];
  approvedReportKeys: readonly string[];
  approvedCandidateCount: number;
  maxApprovedBatchSize: number;
  metadata: CoordinationJsonObject;
  signatureAlgorithm: IntelligencePublishingApprovalGrantSignatureAlgorithm;
}>;

type ApprovalGrantSignablePayload = ApprovalGrantUnsignedPayload &
  Readonly<{
    grantId: string;
  }>;

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
    Number.isFinite(value) &&
    Number.isInteger(value) &&
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
  if (typeof value === "undefined") {
    throw new Error("Undefined values are not JSON-safe.");
  }
  if (typeof value === "number") {
    return value;
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

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function assertSecretStrength(secret: string): void {
  if (Buffer.byteLength(secret, "utf8") < MIN_APPROVAL_GRANT_SECRET_LENGTH_BYTES) {
    throw new Error(
      `Approval grant secret must be at least ${MIN_APPROVAL_GRANT_SECRET_LENGTH_BYTES} bytes.`,
    );
  }
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAction(
  value: unknown,
): IntelligencePublishingBatchAction | null {
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

function normalizeUniqueSortedStringArray(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values.map((value) => value.trim().toLowerCase()))]
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

function normalizeRequestedActions(
  values: readonly IntelligencePublishingBatchAction[],
): readonly IntelligencePublishingBatchAction[] {
  return Object.freeze(
    [...new Set(values.map((value) => normalizeText(value) as IntelligencePublishingBatchAction))]
      .sort(compareStrings)
      .filter((value) =>
        INTELLIGENCE_PUBLISHING_BATCH_ACTIONS.includes(
          value as IntelligencePublishingBatchAction,
        ),
      ) as IntelligencePublishingBatchAction[],
  );
}

function normalizeGatePolicy(
  input: IntelligencePublishingExecutionApprovalPolicySnapshot,
): IntelligencePublishingExecutionApprovalPolicySnapshot {
  return deepFreeze({
    approvalRequired: input.approvalRequired,
    maxExecuteBatchSize: input.maxExecuteBatchSize,
    allowlistReportKeys:
      input.allowlistReportKeys == null
        ? null
        : normalizeUniqueSortedStringArray(input.allowlistReportKeys),
  });
}

function normalizeApprovalCandidates(
  candidates: readonly IntelligencePublishingBatchCandidate[],
): readonly NormalizedApprovalCandidate[] {
  const normalized = candidates.map((candidate) => {
    const requestedAction =
      candidate.requestedAction == null
        ? "publish"
        : normalizeAction(candidate.requestedAction);
    if (
      !isNonEmptyString(candidate.reportKey) ||
      !isNonEmptyString(candidate.locale) ||
      !isNonEmptyString(candidate.country) ||
      !isNonEmptyString(candidate.city) ||
      !isNonEmptyString(candidate.platform) ||
      !isNonEmptyString(candidate.propertyType) ||
      requestedAction == null
    ) {
      throw new Error("Every approval candidate must contain a complete public-safe scope.");
    }
    return deepFreeze({
      reportKey: normalizeText(candidate.reportKey),
      locale: normalizeText(candidate.locale),
      country: normalizeText(candidate.country),
      city: normalizeText(candidate.city),
      platform: normalizeText(candidate.platform),
      propertyType: normalizeText(candidate.propertyType),
      requestedAction,
    });
  });
  return Object.freeze(
    [...normalized].sort((left, right) => {
      const reportKeyOrder = compareStrings(left.reportKey, right.reportKey);
      if (reportKeyOrder !== 0) {
        return reportKeyOrder;
      }
      const localeOrder = compareStrings(left.locale, right.locale);
      if (localeOrder !== 0) {
        return localeOrder;
      }
      const countryOrder = compareStrings(left.country, right.country);
      if (countryOrder !== 0) {
        return countryOrder;
      }
      const cityOrder = compareStrings(left.city, right.city);
      if (cityOrder !== 0) {
        return cityOrder;
      }
      const platformOrder = compareStrings(left.platform, right.platform);
      if (platformOrder !== 0) {
        return platformOrder;
      }
      const propertyTypeOrder = compareStrings(left.propertyType, right.propertyType);
      if (propertyTypeOrder !== 0) {
        return propertyTypeOrder;
      }
      return compareStrings(left.requestedAction, right.requestedAction);
    }),
  );
}

function buildApprovalCandidatesFingerprint(
  candidates: readonly NormalizedApprovalCandidate[],
): string {
  return buildStableHash("ipp_execution_approval_candidates_", candidates);
}

function buildApprovalGatePolicyFingerprint(
  gatePolicy: IntelligencePublishingExecutionApprovalPolicySnapshot,
): string {
  return buildStableHash("ipp_execution_approval_policy_", gatePolicy);
}

export function buildIntelligencePublishingExecutionApprovalPolicyFingerprint(
  input: IntelligencePublishingExecutionApprovalPolicySnapshot,
): string {
  return buildApprovalGatePolicyFingerprint(normalizeGatePolicy(input));
}

function buildExecutionApprovalRequestFingerprint(input: Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_SCHEMA_VERSION;
  requestVersion: typeof INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_VERSION;
  registryFingerprint: string;
  mode: "execute";
  candidateCount: number;
  candidatesFingerprint: string;
  requestedActions: readonly IntelligencePublishingBatchAction[];
  reportKeys: readonly string[];
  gatePolicyFingerprint: string;
}>): string {
  return buildStableHash("ipp_execution_approval_request_", input);
}

function buildApprovalGrantId(
  payload: ApprovalGrantUnsignedPayload,
): string {
  return buildStableHash("ipp_approval_grant_", payload);
}

function buildGrantSignablePayload(
  unsignedPayload: ApprovalGrantUnsignedPayload,
): ApprovalGrantSignablePayload {
  const grantId = buildApprovalGrantId(unsignedPayload);
  return deepFreeze({
    ...unsignedPayload,
    grantId,
  });
}

function signApprovalGrantPayload(
  payload: ApprovalGrantSignablePayload,
  secret: string,
  algorithm: IntelligencePublishingApprovalGrantSignatureAlgorithm,
): string {
  if (algorithm !== "hmac_sha256") {
    throw new Error(`Unsupported approval grant signature algorithm: ${algorithm}.`);
  }
  assertSecretStrength(secret);
  return createHmac("sha256", secret)
    .update(stableStringify(payload))
    .digest("hex");
}

function isHexString(value: string): boolean {
  return /^[0-9a-f]+$/i.test(value) && value.length % 2 === 0;
}

function timingSafeHexEquals(left: string, right: string): boolean {
  if (!isHexString(left) || !isHexString(right) || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function buildGrantPublicSummary(input: unknown): IntelligencePublishingApprovalGrantPublicSummary {
  if (!isPlainObject(input)) {
    return deepFreeze({
      grantId: null,
      issuer: null,
      schemaVersion: null,
      grantVersion: null,
      signatureAlgorithm: null,
      issuedAt: null,
      expiresAt: null,
      executionRequestFingerprint: null,
      registryFingerprint: null,
      approvedCandidateCount: null,
      maxApprovedBatchSize: null,
    });
  }
  return deepFreeze({
    grantId: isNonEmptyString(input.grantId) ? input.grantId : null,
    issuer: isNonEmptyString(input.issuer) ? input.issuer : null,
    schemaVersion: isNonEmptyString(input.schemaVersion) ? input.schemaVersion : null,
    grantVersion: isNonEmptyString(input.grantVersion) ? input.grantVersion : null,
    signatureAlgorithm: isNonEmptyString(input.signatureAlgorithm)
      ? input.signatureAlgorithm
      : null,
    issuedAt: isNonEmptyString(input.issuedAt) ? input.issuedAt : null,
    expiresAt: isNonEmptyString(input.expiresAt) ? input.expiresAt : null,
    executionRequestFingerprint: isNonEmptyString(input.executionRequestFingerprint)
      ? input.executionRequestFingerprint
      : null,
    registryFingerprint: isNonEmptyString(input.registryFingerprint)
      ? input.registryFingerprint
      : null,
    approvedCandidateCount: isFiniteNonNegativeInteger(input.approvedCandidateCount)
      ? input.approvedCandidateCount
      : null,
    maxApprovedBatchSize: isFiniteNonNegativeInteger(input.maxApprovedBatchSize)
      ? input.maxApprovedBatchSize
      : null,
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

export function buildIntelligencePublishingExecutionApprovalRequest(
  input: BuildIntelligencePublishingExecutionApprovalRequestInput,
): IntelligencePublishingExecutionApprovalRequest {
  if (!isNonEmptyString(input.registryFingerprint)) {
    throw new Error("registryFingerprint must be a non-empty string.");
  }
  if (input.mode !== "execute") {
    throw new Error("Execution approval requests support execute mode only.");
  }
  const normalizedCandidates = normalizeApprovalCandidates(input.candidates);
  const normalizedGatePolicy = normalizeGatePolicy(input.gatePolicy);
  const requestedActions = normalizeRequestedActions(
    normalizedCandidates.map((candidate) => candidate.requestedAction),
  );
  const reportKeys = normalizeUniqueSortedStringArray(
    normalizedCandidates.map((candidate) => candidate.reportKey),
  );
  const candidatesFingerprint = buildApprovalCandidatesFingerprint(normalizedCandidates);
  const gatePolicyFingerprint = buildApprovalGatePolicyFingerprint(
    normalizedGatePolicy,
  );
  const requestBase = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_SCHEMA_VERSION,
    requestVersion: INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_VERSION,
    registryFingerprint: input.registryFingerprint.trim(),
    mode: "execute" as const,
    candidateCount: normalizedCandidates.length,
    candidatesFingerprint,
    requestedActions,
    reportKeys,
    gatePolicyFingerprint,
  });
  const requestFingerprint = buildExecutionApprovalRequestFingerprint(requestBase);
  return deepFreeze({
    ...requestBase,
    requestFingerprint,
  });
}

export function validateIntelligencePublishingExecutionApprovalRequest(
  input: unknown,
): IntelligencePublishingExecutionApprovalRequestValidationResult {
  const issues: IntelligencePublishingExecutionApprovalRequestValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "request",
          message: "Expected a plain execution approval request object.",
        },
      ]),
    };
  }
  assertNoForbiddenPrivateKeys(input, "request");

  for (const path of validateExactKeys(input, REQUEST_ALLOWED_KEYS, "request")) {
    issues.push({
      path,
      message: "Unexpected key in execution approval request.",
    });
  }

  if (
    input.schemaVersion !==
    INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_SCHEMA_VERSION
  ) {
    issues.push({
      path: "request.schemaVersion",
      message: "Unsupported execution approval request schemaVersion.",
    });
  }
  if (
    input.requestVersion !==
    INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_VERSION
  ) {
    issues.push({
      path: "request.requestVersion",
      message: "Unsupported execution approval request version.",
    });
  }
  if (!isNonEmptyString(input.registryFingerprint)) {
    issues.push({
      path: "request.registryFingerprint",
      message: "registryFingerprint must be a non-empty string.",
    });
  }
  if (input.mode !== "execute") {
    issues.push({
      path: "request.mode",
      message: "Execution approval requests support execute mode only.",
    });
  }
  if (!isFiniteNonNegativeInteger(input.candidateCount)) {
    issues.push({
      path: "request.candidateCount",
      message: "candidateCount must be a non-negative integer.",
    });
  }
  if (!isNonEmptyString(input.candidatesFingerprint)) {
    issues.push({
      path: "request.candidatesFingerprint",
      message: "candidatesFingerprint must be a non-empty string.",
    });
  }
  if (!Array.isArray(input.requestedActions)) {
    issues.push({
      path: "request.requestedActions",
      message: "requestedActions must be an array.",
    });
  }
  if (!Array.isArray(input.reportKeys)) {
    issues.push({
      path: "request.reportKeys",
      message: "reportKeys must be an array.",
    });
  }
  if (!isNonEmptyString(input.gatePolicyFingerprint)) {
    issues.push({
      path: "request.gatePolicyFingerprint",
      message: "gatePolicyFingerprint must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(input.requestFingerprint)) {
    issues.push({
      path: "request.requestFingerprint",
      message: "requestFingerprint must be a non-empty string.",
    });
  }

  const requestedActions = Array.isArray(input.requestedActions)
    ? input.requestedActions.map((value) => normalizeAction(value)).filter(Boolean)
    : [];
  if (
    Array.isArray(input.requestedActions) &&
    requestedActions.length !== input.requestedActions.length
  ) {
    issues.push({
      path: "request.requestedActions",
      message: "requestedActions must contain only supported batch actions.",
    });
  }
  const normalizedRequestedActions = normalizeRequestedActions(
    requestedActions as IntelligencePublishingBatchAction[],
  );
  if (
    Array.isArray(input.requestedActions) &&
    !hasExactStringArrayMatch(
      normalizedRequestedActions,
      input.requestedActions as string[],
    )
  ) {
    issues.push({
      path: "request.requestedActions",
      message: "requestedActions must be unique and sorted.",
    });
  }

  const normalizedReportKeys = Array.isArray(input.reportKeys)
    ? normalizeUniqueSortedStringArray(
        (input.reportKeys as unknown[]).filter(isNonEmptyString),
      )
    : [];
  if (
    Array.isArray(input.reportKeys) &&
    normalizedReportKeys.length !== input.reportKeys.length
  ) {
    issues.push({
      path: "request.reportKeys",
      message: "reportKeys must contain only non-empty strings.",
    });
  }
  if (
    Array.isArray(input.reportKeys) &&
    !hasExactStringArrayMatch(normalizedReportKeys, input.reportKeys as string[])
  ) {
    issues.push({
      path: "request.reportKeys",
      message: "reportKeys must be unique and sorted.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const requestBase = deepFreeze({
    schemaVersion:
      INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_SCHEMA_VERSION,
    requestVersion: INTELLIGENCE_PUBLISHING_EXECUTION_APPROVAL_REQUEST_VERSION,
    registryFingerprint: (input.registryFingerprint as string).trim(),
    mode: "execute" as const,
    candidateCount: input.candidateCount as number,
    candidatesFingerprint: (input.candidatesFingerprint as string).trim(),
    requestedActions: normalizedRequestedActions,
    reportKeys: normalizedReportKeys,
    gatePolicyFingerprint: (input.gatePolicyFingerprint as string).trim(),
  });
  const requestFingerprint = buildExecutionApprovalRequestFingerprint(requestBase);
  if (requestFingerprint !== input.requestFingerprint) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "request.requestFingerprint",
          message: "requestFingerprint does not match the normalized request payload.",
        },
      ]),
    };
  }
  return {
    ok: true,
    request: deepFreeze({
      ...requestBase,
      requestFingerprint,
    }),
  };
}

export function issueIntelligencePublishingApprovalGrant(
  input: IssueIntelligencePublishingApprovalGrantInput,
): IntelligencePublishingApprovalGrant {
  const requestValidation = validateIntelligencePublishingExecutionApprovalRequest(
    input.approvalRequest,
  );
  if (!requestValidation.ok) {
    throw new Error(
      requestValidation.issues.map((issue) => issue.message).join(" | "),
    );
  }
  if (!isNonEmptyString(input.issuer)) {
    throw new Error("issuer must be a non-empty string.");
  }
  if (!isCanonicalIsoTimestamp(input.issuedAt) || !isCanonicalIsoTimestamp(input.expiresAt)) {
    throw new Error("issuedAt and expiresAt must be canonical ISO timestamps.");
  }
  const issuedAtMs = Date.parse(input.issuedAt);
  const expiresAtMs = Date.parse(input.expiresAt);
  if (expiresAtMs <= issuedAtMs) {
    throw new Error("expiresAt must be later than issuedAt.");
  }
  const maxGrantLifetimeSeconds =
    input.maxGrantLifetimeSeconds ?? DEFAULT_APPROVAL_GRANT_MAX_LIFETIME_SECONDS;
  if (!isFiniteNonNegativeInteger(maxGrantLifetimeSeconds) || maxGrantLifetimeSeconds <= 0) {
    throw new Error("maxGrantLifetimeSeconds must be a positive integer.");
  }
  if ((expiresAtMs - issuedAtMs) / 1000 > maxGrantLifetimeSeconds) {
    throw new Error("Approval grant lifetime exceeds the configured maximum.");
  }
  assertSecretStrength(input.secret);

  const request = requestValidation.request;
  const approvedActions = normalizeRequestedActions(
    (input.approvedActions ?? request.requestedActions) as readonly IntelligencePublishingBatchAction[],
  );
  const approvedReportKeys = normalizeUniqueSortedStringArray(
    (input.approvedReportKeys ?? request.reportKeys) as readonly string[],
  );
  const approvedCandidateCount =
    input.approvedCandidateCount ?? request.candidateCount;
  const maxApprovedBatchSize =
    input.maxApprovedBatchSize ?? request.candidateCount;
  if (
    !hasExactStringArrayMatch(approvedActions, request.requestedActions) ||
    !hasExactStringArrayMatch(approvedReportKeys, request.reportKeys) ||
    approvedCandidateCount !== request.candidateCount
  ) {
    throw new Error(
      "Approval grants currently support only exact request scope issuance.",
    );
  }
  if (!isFiniteNonNegativeInteger(maxApprovedBatchSize) || maxApprovedBatchSize < approvedCandidateCount) {
    throw new Error(
      "maxApprovedBatchSize must be a non-negative integer greater than or equal to approvedCandidateCount.",
    );
  }
  const signatureAlgorithm =
    input.signatureAlgorithm ?? ("hmac_sha256" as const);
  if (
    !INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SIGNATURE_ALGORITHMS.includes(
      signatureAlgorithm,
    )
  ) {
    throw new Error(`Unsupported approval grant signature algorithm: ${signatureAlgorithm}.`);
  }
  const metadata = freezeMetadata(input.metadata);
  const unsignedPayload = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SCHEMA_VERSION,
    grantVersion: INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_VERSION,
    issuer: input.issuer.trim(),
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    executionRequestFingerprint: request.requestFingerprint,
    registryFingerprint: request.registryFingerprint,
    mode: "execute" as const,
    approvedActions,
    approvedReportKeys,
    approvedCandidateCount,
    maxApprovedBatchSize,
    metadata,
    signatureAlgorithm,
  });
  const signablePayload = buildGrantSignablePayload(unsignedPayload);
  const signature = signApprovalGrantPayload(
    signablePayload,
    input.secret,
    signatureAlgorithm,
  );
  const grant = deepFreeze({
    ...signablePayload,
    signature,
  });
  const validation = validateIntelligencePublishingApprovalGrant(grant);
  if (!validation.ok) {
    throw new Error(validation.issues.map((issue) => issue.message).join(" | "));
  }
  return grant;
}

export function validateIntelligencePublishingApprovalGrant(
  input: unknown,
): IntelligencePublishingApprovalGrantValidationResult {
  const issues: IntelligencePublishingApprovalGrantValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "grant",
          message: "Expected a plain approval grant object.",
        },
      ]),
    };
  }
  assertNoForbiddenPrivateKeys(input, "grant");

  for (const path of validateExactKeys(input, GRANT_ALLOWED_KEYS, "grant")) {
    issues.push({
      path,
      message: "Unexpected key in approval grant.",
    });
  }

  if (input.schemaVersion !== INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SCHEMA_VERSION) {
    issues.push({
      path: "grant.schemaVersion",
      message: "Unsupported approval grant schemaVersion.",
    });
  }
  if (input.grantVersion !== INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_VERSION) {
    issues.push({
      path: "grant.grantVersion",
      message: "Unsupported approval grant version.",
    });
  }
  if (!isNonEmptyString(input.grantId)) {
    issues.push({
      path: "grant.grantId",
      message: "grantId must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(input.issuer)) {
    issues.push({
      path: "grant.issuer",
      message: "issuer must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(input.issuedAt) || !isCanonicalIsoTimestamp(input.issuedAt)) {
    issues.push({
      path: "grant.issuedAt",
      message: "issuedAt must be a canonical ISO timestamp.",
    });
  }
  if (!isNonEmptyString(input.expiresAt) || !isCanonicalIsoTimestamp(input.expiresAt)) {
    issues.push({
      path: "grant.expiresAt",
      message: "expiresAt must be a canonical ISO timestamp.",
    });
  }
  if (!isNonEmptyString(input.executionRequestFingerprint)) {
    issues.push({
      path: "grant.executionRequestFingerprint",
      message: "executionRequestFingerprint must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(input.registryFingerprint)) {
    issues.push({
      path: "grant.registryFingerprint",
      message: "registryFingerprint must be a non-empty string.",
    });
  }
  if (input.mode !== "execute") {
    issues.push({
      path: "grant.mode",
      message: "Approval grants support execute mode only.",
    });
  }
  if (!Array.isArray(input.approvedActions)) {
    issues.push({
      path: "grant.approvedActions",
      message: "approvedActions must be an array.",
    });
  }
  if (!Array.isArray(input.approvedReportKeys)) {
    issues.push({
      path: "grant.approvedReportKeys",
      message: "approvedReportKeys must be an array.",
    });
  }
  if (!isFiniteNonNegativeInteger(input.approvedCandidateCount)) {
    issues.push({
      path: "grant.approvedCandidateCount",
      message: "approvedCandidateCount must be a non-negative integer.",
    });
  }
  if (!isFiniteNonNegativeInteger(input.maxApprovedBatchSize)) {
    issues.push({
      path: "grant.maxApprovedBatchSize",
      message: "maxApprovedBatchSize must be a non-negative integer.",
    });
  }
  if (!isPlainObject(input.metadata) || !isJsonSafe(input.metadata)) {
    issues.push({
      path: "grant.metadata",
      message: "metadata must be a JSON-safe plain object.",
    });
  }
  if (
    !isNonEmptyString(input.signatureAlgorithm) ||
    !INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SIGNATURE_ALGORITHMS.includes(
      input.signatureAlgorithm as IntelligencePublishingApprovalGrantSignatureAlgorithm,
    )
  ) {
    issues.push({
      path: "grant.signatureAlgorithm",
      message: "Unsupported approval grant signature algorithm.",
    });
  }
  if (!isNonEmptyString(input.signature) || !isHexString(input.signature)) {
    issues.push({
      path: "grant.signature",
      message: "signature must be a non-empty hex string.",
    });
  }

  const approvedActions = Array.isArray(input.approvedActions)
    ? input.approvedActions.map((value) => normalizeAction(value)).filter(Boolean)
    : [];
  if (
    Array.isArray(input.approvedActions) &&
    approvedActions.length !== input.approvedActions.length
  ) {
    issues.push({
      path: "grant.approvedActions",
      message: "approvedActions must contain only supported batch actions.",
    });
  }
  const normalizedApprovedActions = normalizeRequestedActions(
    approvedActions as IntelligencePublishingBatchAction[],
  );
  if (
    Array.isArray(input.approvedActions) &&
    !hasExactStringArrayMatch(
      normalizedApprovedActions,
      input.approvedActions as string[],
    )
  ) {
    issues.push({
      path: "grant.approvedActions",
      message: "approvedActions must be unique and sorted.",
    });
  }

  const normalizedApprovedReportKeys = Array.isArray(input.approvedReportKeys)
    ? normalizeUniqueSortedStringArray(
        (input.approvedReportKeys as unknown[]).filter(isNonEmptyString),
      )
    : [];
  if (
    Array.isArray(input.approvedReportKeys) &&
    normalizedApprovedReportKeys.length !== input.approvedReportKeys.length
  ) {
    issues.push({
      path: "grant.approvedReportKeys",
      message: "approvedReportKeys must contain only non-empty strings.",
    });
  }
  if (
    Array.isArray(input.approvedReportKeys) &&
    !hasExactStringArrayMatch(
      normalizedApprovedReportKeys,
      input.approvedReportKeys as string[],
    )
  ) {
    issues.push({
      path: "grant.approvedReportKeys",
      message: "approvedReportKeys must be unique and sorted.",
    });
  }

  if (
    isFiniteNonNegativeInteger(input.approvedCandidateCount) &&
    isFiniteNonNegativeInteger(input.maxApprovedBatchSize) &&
    input.maxApprovedBatchSize < input.approvedCandidateCount
  ) {
    issues.push({
      path: "grant.maxApprovedBatchSize",
      message:
        "maxApprovedBatchSize must be greater than or equal to approvedCandidateCount.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const metadata = freezeMetadata(input.metadata as CoordinationJsonObject);
  const unsignedPayload = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SCHEMA_VERSION,
    grantVersion: INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_VERSION,
    issuer: (input.issuer as string).trim(),
    issuedAt: input.issuedAt as string,
    expiresAt: input.expiresAt as string,
    executionRequestFingerprint: (input.executionRequestFingerprint as string).trim(),
    registryFingerprint: (input.registryFingerprint as string).trim(),
    mode: "execute" as const,
    approvedActions: normalizedApprovedActions,
    approvedReportKeys: normalizedApprovedReportKeys,
    approvedCandidateCount: input.approvedCandidateCount as number,
    maxApprovedBatchSize: input.maxApprovedBatchSize as number,
    metadata,
    signatureAlgorithm:
      input.signatureAlgorithm as IntelligencePublishingApprovalGrantSignatureAlgorithm,
  });
  const signablePayload = buildGrantSignablePayload(unsignedPayload);
  if (signablePayload.grantId !== input.grantId) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "grant.grantId",
          message: "grantId does not match the normalized grant payload.",
        },
      ]),
    };
  }
  return {
    ok: true,
    grant: deepFreeze({
      ...signablePayload,
      signature: (input.signature as string).toLowerCase(),
    }),
  };
}

export function verifyIntelligencePublishingApprovalGrant(
  input: VerifyIntelligencePublishingApprovalGrantInput,
): VerifyIntelligencePublishingApprovalGrantResult {
  const summary = buildGrantPublicSummary(input.approvalGrant);
  const requestValidation = validateIntelligencePublishingExecutionApprovalRequest(
    input.approvalRequest,
  );
  if (!requestValidation.ok) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_request_mismatch",
      publicSummary: summary,
      request: null,
      grant: null,
      structureValidated: false,
      signatureValidated: false,
      timeValidated: false,
      scopeValidated: false,
    });
  }
  const request = requestValidation.request;

  if (!isCanonicalIsoTimestamp(input.options.now)) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_invalid",
      publicSummary: summary,
      request,
      grant: null,
      structureValidated: false,
      signatureValidated: false,
      timeValidated: false,
      scopeValidated: false,
    });
  }

  if (!isPlainObject(input.approvalGrant)) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_invalid",
      publicSummary: summary,
      request,
      grant: null,
      structureValidated: false,
      signatureValidated: false,
      timeValidated: false,
      scopeValidated: false,
    });
  }

  const rawGrant = input.approvalGrant;
  if (rawGrant.schemaVersion !== INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SCHEMA_VERSION) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_schema_unsupported",
      publicSummary: summary,
      request,
      grant: null,
      structureValidated: false,
      signatureValidated: false,
      timeValidated: false,
      scopeValidated: false,
    });
  }
  if (rawGrant.grantVersion !== INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_VERSION) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_version_unsupported",
      publicSummary: summary,
      request,
      grant: null,
      structureValidated: false,
      signatureValidated: false,
      timeValidated: false,
      scopeValidated: false,
    });
  }
  if (
    rawGrant.signatureAlgorithm !== "hmac_sha256" ||
    !INTELLIGENCE_PUBLISHING_APPROVAL_GRANT_SIGNATURE_ALGORITHMS.includes(
      rawGrant.signatureAlgorithm,
    )
  ) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_algorithm_unsupported",
      publicSummary: summary,
      request,
      grant: null,
      structureValidated: false,
      signatureValidated: false,
      timeValidated: false,
      scopeValidated: false,
    });
  }
  if (rawGrant.mode !== "execute") {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_scope_mismatch",
      publicSummary: summary,
      request,
      grant: null,
      structureValidated: false,
      signatureValidated: false,
      timeValidated: false,
      scopeValidated: false,
    });
  }

  const grantValidation = validateIntelligencePublishingApprovalGrant(rawGrant);
  if (!grantValidation.ok) {
    const hasGrantIdIssue = grantValidation.issues.some(
      (issue) => issue.path === "grant.grantId",
    );
    return deepFreeze({
      ok: false,
      reasonCode: hasGrantIdIssue
        ? "approval_grant_id_mismatch"
        : "approval_grant_invalid",
      publicSummary: summary,
      request,
      grant: null,
      structureValidated: false,
      signatureValidated: false,
      timeValidated: false,
      scopeValidated: false,
    });
  }
  const grant = grantValidation.grant;

  try {
    assertSecretStrength(input.options.secret);
  } catch {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_signature_invalid",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: false,
      timeValidated: false,
      scopeValidated: false,
    });
  }

  const signablePayload = buildGrantSignablePayload({
    schemaVersion: grant.schemaVersion,
    grantVersion: grant.grantVersion,
    issuer: grant.issuer,
    issuedAt: grant.issuedAt,
    expiresAt: grant.expiresAt,
    executionRequestFingerprint: grant.executionRequestFingerprint,
    registryFingerprint: grant.registryFingerprint,
    mode: grant.mode,
    approvedActions: grant.approvedActions,
    approvedReportKeys: grant.approvedReportKeys,
    approvedCandidateCount: grant.approvedCandidateCount,
    maxApprovedBatchSize: grant.maxApprovedBatchSize,
    metadata: grant.metadata,
    signatureAlgorithm: grant.signatureAlgorithm,
  });
  const expectedSignature = signApprovalGrantPayload(
    signablePayload,
    input.options.secret,
    grant.signatureAlgorithm,
  );
  if (!timingSafeHexEquals(expectedSignature, grant.signature)) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_signature_invalid",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: false,
      timeValidated: false,
      scopeValidated: false,
    });
  }

  const maxGrantLifetimeSeconds =
    input.options.maxGrantLifetimeSeconds ??
    DEFAULT_APPROVAL_GRANT_MAX_LIFETIME_SECONDS;
  const allowedClockSkewSeconds =
    input.options.allowedClockSkewSeconds ??
    DEFAULT_APPROVAL_GRANT_ALLOWED_CLOCK_SKEW_SECONDS;
  if (
    !isFiniteNonNegativeInteger(maxGrantLifetimeSeconds) ||
    maxGrantLifetimeSeconds <= 0 ||
    !isFiniteNonNegativeInteger(allowedClockSkewSeconds)
  ) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_invalid",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: false,
      scopeValidated: false,
    });
  }

  const issuedAtMs = Date.parse(grant.issuedAt);
  const expiresAtMs = Date.parse(grant.expiresAt);
  const nowMs = Date.parse(input.options.now);
  if (expiresAtMs <= issuedAtMs) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_invalid",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: false,
      scopeValidated: false,
    });
  }
  if ((expiresAtMs - issuedAtMs) / 1000 > maxGrantLifetimeSeconds) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_invalid",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: false,
      scopeValidated: false,
    });
  }
  if (issuedAtMs - nowMs > allowedClockSkewSeconds * 1000) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_not_yet_valid",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: false,
      scopeValidated: false,
    });
  }
  if (nowMs - expiresAtMs > allowedClockSkewSeconds * 1000) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_expired",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: false,
      scopeValidated: false,
    });
  }

  if (grant.registryFingerprint !== request.registryFingerprint) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_registry_mismatch",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: true,
      scopeValidated: false,
    });
  }
  if (grant.mode !== request.mode) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_scope_mismatch",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: true,
      scopeValidated: false,
    });
  }
  if (request.candidateCount > grant.maxApprovedBatchSize) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_batch_size_exceeded",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: true,
      scopeValidated: false,
    });
  }
  if (request.candidateCount !== grant.approvedCandidateCount) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_candidate_count_mismatch",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: true,
      scopeValidated: false,
    });
  }
  if (
    request.requestedActions.some(
      (action) => !grant.approvedActions.includes(action),
    )
  ) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_action_not_allowed",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: true,
      scopeValidated: false,
    });
  }
  if (request.reportKeys.some((reportKey) => !grant.approvedReportKeys.includes(reportKey))) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_report_not_allowed",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: true,
      scopeValidated: false,
    });
  }
  if (grant.executionRequestFingerprint !== request.requestFingerprint) {
    return deepFreeze({
      ok: false,
      reasonCode: "approval_grant_request_mismatch",
      publicSummary: summary,
      request,
      grant,
      structureValidated: true,
      signatureValidated: true,
      timeValidated: true,
      scopeValidated: false,
    });
  }

  return deepFreeze({
    ok: true,
    reasonCode: "approval_grant_verified",
    publicSummary: summary,
    request,
    grant,
    structureValidated: true,
    signatureValidated: true,
    timeValidated: true,
    scopeValidated: true,
  });
}
