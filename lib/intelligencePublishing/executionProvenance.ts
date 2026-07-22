import { createHash } from "node:crypto";

import {
  INTELLIGENCE_PUBLISHING_BATCH_ACTIONS,
  type IntelligencePublishingBatchAction,
} from "./batchPlanning";
import {
  validateIntelligencePublishingApprovedExecutionBundle,
  type IntelligencePublishingApprovedExecutionBundle,
} from "./approvedExecution";
import {
  buildIntelligencePublishingOrchestrationFingerprint,
  validateIntelligencePublishingOrchestrationResult,
  type IntelligencePublishingOrchestrationResult,
} from "./orchestrator";
import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";

export const INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_SCHEMA_VERSION =
  "ipp_execution_provenance_v1" as const;
export const INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_VERSION =
  "ipp_execution_provenance_builder_v1" as const;

export const INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_DIAGNOSTIC_CODES =
  Object.freeze([
    "approved_execution_bundle_validated",
    "orchestration_result_validated",
    "execution_mode_verified",
    "approval_grant_verified",
    "gate_decision_fingerprint_verified",
    "registry_fingerprint_verified",
    "candidate_count_verified",
    "report_keys_verified",
    "requested_actions_verified",
    "execution_duration_computed",
    "provenance_fingerprint_verified",
  ] as const);

export type IntelligencePublishingExecutionProvenanceDiagnosticCode =
  (typeof INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_DIAGNOSTIC_CODES)[number];

export type IntelligencePublishingExecutionProvenanceDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export type IntelligencePublishingExecutionProvenanceDiagnostic = Readonly<{
  code: IntelligencePublishingExecutionProvenanceDiagnosticCode;
  severity: IntelligencePublishingExecutionProvenanceDiagnosticSeverity;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type IntelligencePublishingExecutionProvenance = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_SCHEMA_VERSION;
  provenanceVersion: typeof INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_VERSION;
  campaignKey: string;
  publicationPlanFingerprint: string;
  approvalPreparationBundleFingerprint: string;
  approvalGrantFingerprint: string;
  executionRequestFingerprint: string;
  approvedExecutionBundleFingerprint: string;
  registryFingerprint: string;
  gateDecisionFingerprint: string;
  orchestrationResultFingerprint: string;
  candidateCount: number;
  reportKeys: readonly string[];
  requestedActions: readonly IntelligencePublishingBatchAction[];
  executionStartedAt: string;
  executionFinishedAt: string;
  executionDurationMs: number;
  warnings: readonly string[];
  diagnostics: readonly IntelligencePublishingExecutionProvenanceDiagnostic[];
  provenanceFingerprint: string;
  createdAt: string;
}>;

export type BuildIntelligencePublishingExecutionProvenanceInput = Readonly<{
  approvedExecutionBundle: unknown;
  orchestrationResult: unknown;
  executionStartedAt: string;
  executionFinishedAt: string;
  createdAt?: string;
}>;

export type IntelligencePublishingExecutionProvenanceValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type IntelligencePublishingExecutionProvenanceValidationResult =
  | Readonly<{
      ok: true;
      provenance: IntelligencePublishingExecutionProvenance;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingExecutionProvenanceValidationIssue[];
    }>;

const FORBIDDEN_PRIVATE_KEYS = new Set([
  "userid",
  "workspaceid",
  "auditid",
  "listingurl",
  "rawpayload",
  "rawobservation",
  "secret",
  "token",
  "localpath",
  "filepath",
  "pathname",
]);

const PROVENANCE_ALLOWED_KEYS = Object.freeze([
  "schemaVersion",
  "provenanceVersion",
  "campaignKey",
  "publicationPlanFingerprint",
  "approvalPreparationBundleFingerprint",
  "approvalGrantFingerprint",
  "executionRequestFingerprint",
  "approvedExecutionBundleFingerprint",
  "registryFingerprint",
  "gateDecisionFingerprint",
  "orchestrationResultFingerprint",
  "candidateCount",
  "reportKeys",
  "requestedActions",
  "executionStartedAt",
  "executionFinishedAt",
  "executionDurationMs",
  "warnings",
  "diagnostics",
  "provenanceFingerprint",
  "createdAt",
] as const);

const DIAGNOSTIC_ALLOWED_KEYS = Object.freeze([
  "code",
  "severity",
  "message",
  "metadata",
] as const);

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
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

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString() === value;
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

function assertJsonSafe(
  value: unknown,
  path: string,
  seen: WeakSet<object> = new WeakSet(),
): void {
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

function freezeMetadata(value: CoordinationJsonObject): CoordinationJsonObject {
  if (!isJsonSafe(value)) {
    throw new Error("Expected metadata to be JSON-safe.");
  }
  assertNoForbiddenPrivateKeys(value, "metadata");
  return deepFreeze(sortJsonValue(value) as CoordinationJsonObject);
}

function buildStableHash(prefix: string, value: unknown): string {
  return `${prefix}${createHash("sha256")
    .update(JSON.stringify(sortJsonValue(value)))
    .digest("hex")}`;
}

function validateExactKeys(
  candidate: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
): readonly string[] {
  const allowed = new Set(allowedKeys);
  return Object.keys(candidate)
    .filter((key) => !allowed.has(key))
    .map((key) => `${path}.${key}`)
    .sort(compareStrings);
}

function normalizeAction(
  value: unknown,
): IntelligencePublishingBatchAction | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  return INTELLIGENCE_PUBLISHING_BATCH_ACTIONS.includes(
    value as IntelligencePublishingBatchAction,
  )
    ? (value as IntelligencePublishingBatchAction)
    : null;
}

function hasExactStringArrayMatch(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function hasExactActionArrayMatch(
  left: readonly IntelligencePublishingBatchAction[],
  right: readonly IntelligencePublishingBatchAction[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function buildDiagnostic(input: Readonly<{
  code: IntelligencePublishingExecutionProvenanceDiagnosticCode;
  severity: IntelligencePublishingExecutionProvenanceDiagnosticSeverity;
  message: string;
  metadata?: CoordinationJsonObject;
}>): IntelligencePublishingExecutionProvenanceDiagnostic {
  return deepFreeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    metadata: freezeMetadata(input.metadata ?? {}),
  });
}

function buildDerivedRequestedActions(
  result: IntelligencePublishingOrchestrationResult,
): readonly IntelligencePublishingBatchAction[] {
  if (result.batchPlan == null) {
    return Object.freeze([]);
  }
  const requestedActions: IntelligencePublishingBatchAction[] = [];
  for (const item of [...result.batchPlan.items].sort(
    (left, right) => left.sequence - right.sequence,
  )) {
    if (!requestedActions.includes(item.requestedAction)) {
      requestedActions.push(item.requestedAction);
    }
  }
  return Object.freeze(requestedActions);
}

function buildDerivedReportKeys(
  result: IntelligencePublishingOrchestrationResult,
): readonly string[] {
  if (result.batchPlan == null) {
    return Object.freeze([]);
  }
  return Object.freeze(
    [...result.batchPlan.items]
      .sort((left, right) => left.sequence - right.sequence)
      .map((item) => item.candidate.reportKey),
  );
}

function buildExecutionDurationMs(
  executionStartedAt: string,
  executionFinishedAt: string,
): number {
  const startedAt = new Date(executionStartedAt).getTime();
  const finishedAt = new Date(executionFinishedAt).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) {
    throw new Error("Execution timestamps must be canonical ISO timestamps.");
  }
  if (finishedAt < startedAt) {
    throw new Error("executionFinishedAt must be greater than or equal to executionStartedAt.");
  }
  return finishedAt - startedAt;
}

function buildFingerprintBase(
  provenance: Omit<
    IntelligencePublishingExecutionProvenance,
    "provenanceFingerprint" | "createdAt"
  >,
) {
  return {
    schemaVersion: provenance.schemaVersion,
    provenanceVersion: provenance.provenanceVersion,
    campaignKey: provenance.campaignKey,
    publicationPlanFingerprint: provenance.publicationPlanFingerprint,
    approvalPreparationBundleFingerprint:
      provenance.approvalPreparationBundleFingerprint,
    approvalGrantFingerprint: provenance.approvalGrantFingerprint,
    executionRequestFingerprint: provenance.executionRequestFingerprint,
    approvedExecutionBundleFingerprint:
      provenance.approvedExecutionBundleFingerprint,
    registryFingerprint: provenance.registryFingerprint,
    gateDecisionFingerprint: provenance.gateDecisionFingerprint,
    orchestrationResultFingerprint: provenance.orchestrationResultFingerprint,
    candidateCount: provenance.candidateCount,
    reportKeys: provenance.reportKeys,
    requestedActions: provenance.requestedActions,
    executionStartedAt: provenance.executionStartedAt,
    executionFinishedAt: provenance.executionFinishedAt,
    executionDurationMs: provenance.executionDurationMs,
    warnings: provenance.warnings,
    diagnostics: provenance.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      metadata: diagnostic.metadata,
    })),
  };
}

export function buildIntelligencePublishingExecutionProvenanceFingerprint(
  provenance: Omit<
    IntelligencePublishingExecutionProvenance,
    "provenanceFingerprint" | "createdAt"
  >,
): string {
  return buildStableHash(
    "ipp_execution_provenance_",
    buildFingerprintBase(provenance),
  );
}

export function validateIntelligencePublishingExecutionProvenance(
  input: unknown,
): IntelligencePublishingExecutionProvenanceValidationResult {
  const issues: IntelligencePublishingExecutionProvenanceValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "provenance",
          message: "Expected a plain execution provenance object.",
        },
      ]),
    };
  }

  assertNoForbiddenPrivateKeys(input, "provenance");
  for (const path of validateExactKeys(
    input,
    PROVENANCE_ALLOWED_KEYS,
    "provenance",
  )) {
    issues.push({
      path,
      message: "Unexpected key in execution provenance.",
    });
  }

  if (
    input.schemaVersion !==
    INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_SCHEMA_VERSION
  ) {
    issues.push({
      path: "provenance.schemaVersion",
      message: "Unsupported execution provenance schemaVersion.",
    });
  }
  if (
    input.provenanceVersion !==
    INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_VERSION
  ) {
    issues.push({
      path: "provenance.provenanceVersion",
      message: "Unsupported execution provenance provenanceVersion.",
    });
  }

  for (const field of [
    "campaignKey",
    "publicationPlanFingerprint",
    "approvalPreparationBundleFingerprint",
    "approvalGrantFingerprint",
    "executionRequestFingerprint",
    "approvedExecutionBundleFingerprint",
    "registryFingerprint",
    "gateDecisionFingerprint",
    "orchestrationResultFingerprint",
    "provenanceFingerprint",
  ] as const) {
    if (!isNonEmptyString(input[field])) {
      issues.push({
        path: `provenance.${field}`,
        message: `${field} must be a non-empty string.`,
      });
    }
  }

  for (const field of [
    "executionStartedAt",
    "executionFinishedAt",
    "createdAt",
  ] as const) {
    if (
      !isNonEmptyString(input[field]) ||
      !isCanonicalIsoTimestamp(String(input[field]))
    ) {
      issues.push({
        path: `provenance.${field}`,
        message: `${field} must be a canonical ISO timestamp.`,
      });
    }
  }

  if (!isFiniteNonNegativeInteger(input.candidateCount)) {
    issues.push({
      path: "provenance.candidateCount",
      message: "candidateCount must be a non-negative integer.",
    });
  }
  if (!isFiniteNonNegativeInteger(input.executionDurationMs)) {
    issues.push({
      path: "provenance.executionDurationMs",
      message: "executionDurationMs must be a non-negative integer.",
    });
  }
  if (!Array.isArray(input.reportKeys)) {
    issues.push({
      path: "provenance.reportKeys",
      message: "reportKeys must be an array.",
    });
  }
  if (!Array.isArray(input.requestedActions)) {
    issues.push({
      path: "provenance.requestedActions",
      message: "requestedActions must be an array.",
    });
  }
  if (!Array.isArray(input.warnings)) {
    issues.push({
      path: "provenance.warnings",
      message: "warnings must be an array.",
    });
  }
  if (!Array.isArray(input.diagnostics)) {
    issues.push({
      path: "provenance.diagnostics",
      message: "diagnostics must be an array.",
    });
  }

  const reportKeys = Array.isArray(input.reportKeys)
    ? (input.reportKeys as unknown[]).map((value) => String(value).trim())
    : [];
  if (
    Array.isArray(input.reportKeys) &&
    reportKeys.some((value) => value.length === 0)
  ) {
    issues.push({
      path: "provenance.reportKeys",
      message: "reportKeys must contain only non-empty strings.",
    });
  }

  const requestedActions = Array.isArray(input.requestedActions)
    ? (input.requestedActions as unknown[])
        .map((value) => normalizeAction(value))
        .filter((value): value is IntelligencePublishingBatchAction => value != null)
    : [];
  if (
    Array.isArray(input.requestedActions) &&
    requestedActions.length !== input.requestedActions.length
  ) {
    issues.push({
      path: "provenance.requestedActions",
      message:
        "requestedActions must contain only supported batch actions.",
    });
  }

  const warnings = Array.isArray(input.warnings)
    ? (input.warnings as unknown[]).map((value) => String(value))
    : [];
  if (
    Array.isArray(input.warnings) &&
    warnings.some((value) => value.trim().length === 0)
  ) {
    issues.push({
      path: "provenance.warnings",
      message: "warnings must contain only non-empty strings.",
    });
  }

  const diagnostics = Array.isArray(input.diagnostics)
    ? input.diagnostics
    : [];
  const normalizedDiagnostics: IntelligencePublishingExecutionProvenanceDiagnostic[] = [];
  diagnostics.forEach((diagnostic, index) => {
    const path = `provenance.diagnostics[${index}]`;
    if (!isPlainObject(diagnostic)) {
      issues.push({
        path,
        message: "Each diagnostic must be a plain object.",
      });
      return;
    }
    assertNoForbiddenPrivateKeys(diagnostic, path);
    for (const invalidPath of validateExactKeys(
      diagnostic,
      DIAGNOSTIC_ALLOWED_KEYS,
      path,
    )) {
      issues.push({
        path: invalidPath,
        message: "Unexpected key in execution provenance diagnostic.",
      });
    }
    const code = diagnostic.code;
    if (
      !isNonEmptyString(code) ||
      !INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_DIAGNOSTIC_CODES.includes(
        code as IntelligencePublishingExecutionProvenanceDiagnosticCode,
      )
    ) {
      issues.push({
        path: `${path}.code`,
        message: "Diagnostic code is unsupported.",
      });
    }
    const severity = diagnostic.severity;
    if (
      severity !== "info" &&
      severity !== "warning" &&
      severity !== "error"
    ) {
      issues.push({
        path: `${path}.severity`,
        message: "Diagnostic severity must be info, warning or error.",
      });
    }
    if (!isNonEmptyString(diagnostic.message)) {
      issues.push({
        path: `${path}.message`,
        message: "Diagnostic message must be a non-empty string.",
      });
    }
    const metadata = isPlainObject(diagnostic.metadata)
      ? (diagnostic.metadata as CoordinationJsonObject)
      : null;
    if (metadata == null) {
      issues.push({
        path: `${path}.metadata`,
        message: "Diagnostic metadata must be a plain object.",
      });
      return;
    }
    try {
      assertJsonSafe(metadata, `${path}.metadata`);
      assertNoForbiddenPrivateKeys(metadata, `${path}.metadata`);
    } catch (error) {
      issues.push({
        path: `${path}.metadata`,
        message: error instanceof Error ? error.message : "Invalid diagnostic metadata.",
      });
      return;
    }
    normalizedDiagnostics.push(
      deepFreeze({
        code: code as IntelligencePublishingExecutionProvenanceDiagnosticCode,
        severity:
          severity as IntelligencePublishingExecutionProvenanceDiagnosticSeverity,
        message: String(diagnostic.message),
        metadata: freezeMetadata(metadata),
      }),
    );
  });

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const executionStartedAt = String(input.executionStartedAt).trim();
  const executionFinishedAt = String(input.executionFinishedAt).trim();
  const createdAt = String(input.createdAt).trim();
  const executionDurationMs = Number(input.executionDurationMs);
  if (buildExecutionDurationMs(executionStartedAt, executionFinishedAt) !== executionDurationMs) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "provenance.executionDurationMs",
          message:
            "executionDurationMs must match the executionStartedAt/executionFinishedAt window exactly.",
        },
      ]),
    };
  }

  const provenanceBase = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_SCHEMA_VERSION,
    provenanceVersion: INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_VERSION,
    campaignKey: String(input.campaignKey).trim(),
    publicationPlanFingerprint: String(input.publicationPlanFingerprint).trim(),
    approvalPreparationBundleFingerprint: String(
      input.approvalPreparationBundleFingerprint,
    ).trim(),
    approvalGrantFingerprint: String(input.approvalGrantFingerprint).trim(),
    executionRequestFingerprint: String(input.executionRequestFingerprint).trim(),
    approvedExecutionBundleFingerprint: String(
      input.approvedExecutionBundleFingerprint,
    ).trim(),
    registryFingerprint: String(input.registryFingerprint).trim(),
    gateDecisionFingerprint: String(input.gateDecisionFingerprint).trim(),
    orchestrationResultFingerprint: String(
      input.orchestrationResultFingerprint,
    ).trim(),
    candidateCount: Number(input.candidateCount),
    reportKeys: Object.freeze(reportKeys),
    requestedActions: Object.freeze(requestedActions),
    executionStartedAt,
    executionFinishedAt,
    executionDurationMs,
    warnings: Object.freeze(warnings),
    diagnostics: Object.freeze(normalizedDiagnostics),
  });

  const expectedFingerprint =
    buildIntelligencePublishingExecutionProvenanceFingerprint(provenanceBase);
  if (expectedFingerprint !== input.provenanceFingerprint) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "provenance.provenanceFingerprint",
          message:
            "provenanceFingerprint does not match the normalized execution provenance payload.",
        },
      ]),
    };
  }

  return {
    ok: true,
    provenance: deepFreeze({
      ...provenanceBase,
      provenanceFingerprint: expectedFingerprint,
      createdAt,
    }),
  };
}

export function buildIntelligencePublishingExecutionProvenance(
  input: BuildIntelligencePublishingExecutionProvenanceInput,
): IntelligencePublishingExecutionProvenance {
  if (!isCanonicalIsoTimestamp(input.executionStartedAt)) {
    throw new Error("executionStartedAt must be a canonical ISO timestamp.");
  }
  if (!isCanonicalIsoTimestamp(input.executionFinishedAt)) {
    throw new Error("executionFinishedAt must be a canonical ISO timestamp.");
  }
  const createdAt = input.createdAt ?? input.executionFinishedAt;
  if (!isCanonicalIsoTimestamp(createdAt)) {
    throw new Error("createdAt must be a canonical ISO timestamp.");
  }

  const bundleValidation = validateIntelligencePublishingApprovedExecutionBundle(
    input.approvedExecutionBundle,
  );
  if (!bundleValidation.ok) {
    throw new Error(
      `approvedExecutionBundle validation failed: ${bundleValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }
  const bundle = bundleValidation.bundle;

  const orchestrationValidation = validateIntelligencePublishingOrchestrationResult(
    input.orchestrationResult,
  );
  if (!orchestrationValidation.ok) {
    throw new Error(
      `orchestrationResult validation failed: ${orchestrationValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }
  const orchestrationResult = orchestrationValidation.result;

  if (bundle.executionRequest.mode !== "execute") {
    throw new Error("Approved execution provenance supports execute mode only.");
  }
  if (orchestrationResult.mode !== "execute") {
    throw new Error("Execution provenance requires an execute orchestration result.");
  }
  if (bundle.gateDecision.decision !== "allowed") {
    throw new Error(
      `Execution provenance requires an allowed gateDecision, received ${bundle.gateDecision.decision}.`,
    );
  }
  if (bundle.approvalGrant == null || bundle.approvalGrantFingerprint == null) {
    throw new Error(
      "Execution provenance requires a validated approvalGrant and approvalGrantFingerprint.",
    );
  }
  if (bundle.orchestratorInput == null) {
    throw new Error(
      "Execution provenance requires a materialized orchestratorInput.",
    );
  }
  if (bundle.orchestratorInput.mode !== "execute") {
    throw new Error("Execution provenance requires an execute orchestratorInput.");
  }
  if (orchestrationResult.batchPlan == null || orchestrationResult.planFingerprint == null) {
    throw new Error("Execution provenance requires a materialized batchPlan.");
  }
  if (
    orchestrationResult.batchResult == null ||
    orchestrationResult.resultFingerprint == null
  ) {
    throw new Error("Execution provenance requires a materialized batchResult.");
  }
  if (orchestrationResult.gateDecision.decision !== "allowed") {
    throw new Error(
      `Execution provenance requires an allowed orchestration gateDecision, received ${orchestrationResult.gateDecision.decision}.`,
    );
  }

  const diagnostics: IntelligencePublishingExecutionProvenanceDiagnostic[] = [
    buildDiagnostic({
      code: "approved_execution_bundle_validated",
      severity: "info",
      message: "Approved execution bundle validated successfully.",
      metadata: {
        approvedExecutionBundleFingerprint:
          bundle.approvedExecutionBundleFingerprint,
      },
    }),
    buildDiagnostic({
      code: "orchestration_result_validated",
      severity: "info",
      message: "Orchestration result validated successfully.",
      metadata: {
        planFingerprint: orchestrationResult.planFingerprint,
        resultFingerprint: orchestrationResult.resultFingerprint,
      },
    }),
  ];

  diagnostics.push(
    buildDiagnostic({
      code: "execution_mode_verified",
      severity: "info",
      message: "Approved bundle and orchestration result both target execute mode.",
      metadata: {
        bundleMode: bundle.executionRequest.mode,
        orchestrationMode: orchestrationResult.mode,
      },
    }),
  );

  diagnostics.push(
    buildDiagnostic({
      code: "approval_grant_verified",
      severity: "info",
      message: "Approval grant and approved orchestrator scope are present.",
      metadata: {
        approvalGrantFingerprint: bundle.approvalGrantFingerprint,
        grantId: bundle.approvalGrant.grantId,
      },
    }),
  );

  if (bundle.gateDecision.fingerprint !== orchestrationResult.gateDecision.fingerprint) {
    throw new Error(
      "Execution provenance cannot be built because the gateDecision fingerprint does not match the orchestration result.",
    );
  }
  diagnostics.push(
    buildDiagnostic({
      code: "gate_decision_fingerprint_verified",
      severity: "info",
      message: "Gate decision fingerprint matches between approval and orchestration.",
      metadata: {
        gateDecisionFingerprint: bundle.gateDecision.fingerprint,
      },
    }),
  );

  if (
    bundle.orchestratorInput.registryFingerprint !==
    orchestrationResult.registryFingerprint
  ) {
    throw new Error(
      "Execution provenance cannot be built because the registryFingerprint does not match the orchestration result.",
    );
  }
  diagnostics.push(
    buildDiagnostic({
      code: "registry_fingerprint_verified",
      severity: "info",
      message: "Registry fingerprint matches between approval and orchestration.",
      metadata: {
        registryFingerprint: orchestrationResult.registryFingerprint,
      },
    }),
  );

  const derivedReportKeys = buildDerivedReportKeys(orchestrationResult);
  const derivedRequestedActions =
    buildDerivedRequestedActions(orchestrationResult);

  if (
    bundle.orchestratorInput.candidateCount !==
      orchestrationResult.summary.candidateCount ||
    bundle.orchestratorInput.candidateCount !==
      orchestrationResult.batchPlan.candidateCount
  ) {
    throw new Error(
      "Execution provenance cannot be built because candidateCount diverged between approval and orchestration.",
    );
  }
  diagnostics.push(
    buildDiagnostic({
      code: "candidate_count_verified",
      severity: "info",
      message: "Candidate count matches between approval and orchestration.",
      metadata: {
        candidateCount: bundle.orchestratorInput.candidateCount,
      },
    }),
  );

  if (
    !hasExactStringArrayMatch(
      bundle.orchestratorInput.reportKeysInOrder,
      derivedReportKeys,
    )
  ) {
    throw new Error(
      "Execution provenance cannot be built because reportKeysInOrder diverged between approval and orchestration.",
    );
  }
  diagnostics.push(
    buildDiagnostic({
      code: "report_keys_verified",
      severity: "info",
      message: "Report key order matches between approval and orchestration.",
      metadata: {
        reportKeys: derivedReportKeys,
      },
    }),
  );

  if (
    !hasExactActionArrayMatch(
      bundle.orchestratorInput.requestedActions,
      derivedRequestedActions,
    )
  ) {
    throw new Error(
      "Execution provenance cannot be built because requestedActions diverged between approval and orchestration.",
    );
  }
  diagnostics.push(
    buildDiagnostic({
      code: "requested_actions_verified",
      severity: "info",
      message: "Requested actions match between approval and orchestration.",
      metadata: {
        requestedActions: derivedRequestedActions,
      },
    }),
  );

  const executionDurationMs = buildExecutionDurationMs(
    input.executionStartedAt,
    input.executionFinishedAt,
  );
  diagnostics.push(
    buildDiagnostic({
      code: "execution_duration_computed",
      severity: "info",
      message: "Execution duration computed successfully.",
      metadata: {
        executionDurationMs,
      },
    }),
  );

  diagnostics.push(
    buildDiagnostic({
      code: "provenance_fingerprint_verified",
      severity: "info",
      message: "Execution provenance fingerprint payload assembled deterministically.",
      metadata: {},
    }),
  );

  const orchestrationResultFingerprint =
    buildIntelligencePublishingOrchestrationFingerprint(orchestrationResult);

  const warnings = deepFreeze(
    [...new Set([...bundle.warnings, ...orchestrationResult.gateDecision.warnings])].filter(
      (warning) => warning.trim().length > 0,
    ),
  );

  const provenanceBase = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_SCHEMA_VERSION,
    provenanceVersion: INTELLIGENCE_PUBLISHING_EXECUTION_PROVENANCE_VERSION,
    campaignKey: bundle.orchestratorInput.campaignKey,
    publicationPlanFingerprint: bundle.orchestratorInput.publicationPlanFingerprint,
    approvalPreparationBundleFingerprint:
      bundle.approvalPreparationBundleFingerprint,
    approvalGrantFingerprint: bundle.approvalGrantFingerprint,
    executionRequestFingerprint: bundle.executionRequestFingerprint,
    approvedExecutionBundleFingerprint:
      bundle.approvedExecutionBundleFingerprint,
    registryFingerprint: orchestrationResult.registryFingerprint,
    gateDecisionFingerprint: orchestrationResult.gateDecision.fingerprint,
    orchestrationResultFingerprint,
    candidateCount: bundle.orchestratorInput.candidateCount,
    reportKeys: derivedReportKeys,
    requestedActions: derivedRequestedActions,
    executionStartedAt: input.executionStartedAt,
    executionFinishedAt: input.executionFinishedAt,
    executionDurationMs,
    warnings,
    diagnostics: deepFreeze(diagnostics),
  });

  const provenanceFingerprint =
    buildIntelligencePublishingExecutionProvenanceFingerprint(provenanceBase);
  const finalProvenance = deepFreeze({
    ...provenanceBase,
    provenanceFingerprint,
    createdAt,
  });

  const finalValidation =
    validateIntelligencePublishingExecutionProvenance(finalProvenance);
  if (!finalValidation.ok) {
    throw new Error(
      `Execution provenance validation failed after construction: ${finalValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }

  return finalValidation.provenance;
}
