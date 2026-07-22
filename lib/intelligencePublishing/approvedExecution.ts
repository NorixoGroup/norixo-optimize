import { createHash } from "node:crypto";

import type {
  IntelligencePublishingBatchAction,
  IntelligencePublishingBatchCandidate,
} from "./batchPlanning";
import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";
import {
  buildIntelligencePublishingExecutionApprovalPolicyFingerprint,
  validateIntelligencePublishingApprovalGrant,
  validateIntelligencePublishingExecutionApprovalRequest,
  verifyIntelligencePublishingApprovalGrant,
  type IntelligencePublishingApprovalGrant,
  type IntelligencePublishingExecutionApprovalPolicySnapshot,
  type IntelligencePublishingExecutionApprovalRequest,
  type VerifyIntelligencePublishingApprovalGrantOptions,
} from "./approvalGrant";
import {
  evaluateIntelligencePublishingExecutionGate,
  validateIntelligencePublishingExecutionGateDecision,
  type IntelligencePublishingExecutionGateApprovalVerification,
  type IntelligencePublishingExecutionGateConfig,
  type IntelligencePublishingExecutionGateDecision,
} from "./executionGate";
import {
  validateIntelligencePublishingApprovalPreparationBundle,
  validateIntelligencePublishingExecutionRequest,
  type IntelligencePublishingApprovalPreparationBundle,
  type IntelligencePublishingExecutionRequest,
} from "./approvalPreparation";

export const INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_SCHEMA_VERSION =
  "ipp_approved_execution_bundle_v1" as const;
export const INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_VERSION =
  "ipp_approved_execution_bundle_contract_v1" as const;

export const INTELLIGENCE_PUBLISHING_APPROVED_ORCHESTRATOR_INPUT_SCHEMA_VERSION =
  "ipp_approved_orchestrator_input_v1" as const;
export const INTELLIGENCE_PUBLISHING_APPROVED_ORCHESTRATOR_INPUT_VERSION =
  "ipp_approved_orchestrator_input_contract_v1" as const;

export const INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_DIAGNOSTIC_CODES =
  Object.freeze([
    "approval_preparation_bundle_validated",
    "approval_preparation_bundle_fingerprint_verified",
    "approval_grant_validated",
    "approval_grant_fingerprint_verified",
    "approval_grant_preflight_verified",
    "gate_policy_fingerprint_verified",
    "candidate_scope_verified",
    "execution_request_scope_verified",
    "execution_gate_evaluated",
    "execution_gate_blocked",
    "approved_orchestrator_input_materialized",
    "approved_execution_bundle_materialized",
    "approved_execution_bundle_fingerprint_verified",
  ] as const);

export type IntelligencePublishingApprovedExecutionDiagnosticCode =
  (typeof INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_DIAGNOSTIC_CODES)[number];

export type IntelligencePublishingApprovedExecutionDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export type IntelligencePublishingApprovedExecutionDiagnostic = Readonly<{
  code: IntelligencePublishingApprovedExecutionDiagnosticCode;
  severity: IntelligencePublishingApprovedExecutionDiagnosticSeverity;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export const INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_ERROR_CODES =
  Object.freeze([
    "invalid_approval_preparation_bundle",
    "invalid_approval_grant",
    "invalid_gate_decision",
    "invalid_created_at",
    "invalid_evaluated_at",
    "unsupported_execution_mode",
    "gate_policy_fingerprint_mismatch",
    "candidate_count_mismatch",
    "requested_actions_mismatch",
    "report_keys_mismatch",
    "candidate_order_mismatch",
    "execution_request_fingerprint_mismatch",
    "approval_grant_fingerprint_mismatch",
    "approved_execution_bundle_fingerprint_mismatch",
  ] as const);

export type IntelligencePublishingApprovedExecutionErrorCode =
  (typeof INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_ERROR_CODES)[number];

export class IntelligencePublishingApprovedExecutionError extends Error {
  readonly code: IntelligencePublishingApprovedExecutionErrorCode;
  readonly diagnostics: readonly IntelligencePublishingApprovedExecutionDiagnostic[];

  constructor(
    input: Readonly<{
      code: IntelligencePublishingApprovedExecutionErrorCode;
      message: string;
      diagnostics?: readonly IntelligencePublishingApprovedExecutionDiagnostic[];
    }>,
  ) {
    super(input.message);
    this.name = "IntelligencePublishingApprovedExecutionError";
    this.code = input.code;
    this.diagnostics = Object.freeze([...(input.diagnostics ?? [])]);
  }
}

export type IntelligencePublishingApprovedOrchestratorInput = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_APPROVED_ORCHESTRATOR_INPUT_SCHEMA_VERSION;
  inputVersion: typeof INTELLIGENCE_PUBLISHING_APPROVED_ORCHESTRATOR_INPUT_VERSION;
  mode: "execute";
  createdAt: string;
  campaignKey: string;
  requestedAction: IntelligencePublishingBatchAction;
  registryFingerprint: string;
  publicationPlanFingerprint: string;
  campaignSpecificationFingerprint: string;
  executionRequestFingerprint: string;
  approvalGrantFingerprint: string;
  gatePolicy: IntelligencePublishingExecutionApprovalPolicySnapshot;
  gatePolicyFingerprint: string;
  gateConfig: Readonly<{
    executionEnabled: boolean;
    killSwitchEnabled: boolean;
    approvalRequired: boolean;
    maxExecuteBatchSize: number | null;
    allowlistReportKeys: readonly string[] | null;
    readOnly: boolean;
  }>;
  candidateCount: number;
  requestedActions: readonly IntelligencePublishingBatchAction[];
  reportKeys: readonly string[];
  reportKeysInOrder: readonly string[];
  candidateFingerprintsInOrder: readonly string[];
  orderedCandidatesFingerprint: string;
  candidates: readonly IntelligencePublishingBatchCandidate[];
  approvalRequest: IntelligencePublishingExecutionApprovalRequest;
  orchestratorInputFingerprint: string;
}>;

export type IntelligencePublishingApprovedExecutionBundle = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_SCHEMA_VERSION;
  bundleVersion: typeof INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_VERSION;
  approvalPreparationBundleFingerprint: string;
  executionRequestFingerprint: string;
  approvalGrantFingerprint: string | null;
  gateDecision: IntelligencePublishingExecutionGateDecision;
  executionRequest: IntelligencePublishingExecutionRequest;
  approvalGrant: IntelligencePublishingApprovalGrant | null;
  orchestratorInput: IntelligencePublishingApprovedOrchestratorInput | null;
  diagnostics: readonly IntelligencePublishingApprovedExecutionDiagnostic[];
  warnings: readonly string[];
  approvedExecutionBundleFingerprint: string;
  createdAt: string;
}>;

export type BuildIntelligencePublishingApprovedExecutionBundleInput = Readonly<{
  approvalPreparationBundle: unknown;
  approvalGrant?: unknown;
  evaluatedAt: string;
  createdAt?: string;
  gateConfig?: IntelligencePublishingExecutionGateConfig;
  approvalVerification?: IntelligencePublishingExecutionGateApprovalVerification | null;
  metadata?: CoordinationJsonObject;
}>;

export type IntelligencePublishingApprovedExecutionBundleValidationIssue =
  Readonly<{
    path: string;
    message: string;
  }>;

export type IntelligencePublishingApprovedExecutionBundleValidationResult =
  | Readonly<{
      ok: true;
      bundle: IntelligencePublishingApprovedExecutionBundle;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingApprovedExecutionBundleValidationIssue[];
    }>;

type NormalizedGateConfig = Readonly<{
  executionEnabled: boolean;
  killSwitchEnabled: boolean;
  approvalRequired: boolean;
  maxExecuteBatchSize: number | null;
  allowlistReportKeys: readonly string[] | null;
  readOnly: boolean;
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

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
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
  return deepFreeze(sortJsonValue(value ?? {}) as CoordinationJsonObject);
}

function buildStableHash(prefix: string, value: unknown): string {
  return `${prefix}${createHash("sha256")
    .update(JSON.stringify(sortJsonValue(value)))
    .digest("hex")}`;
}

function freezeDiagnostic(
  diagnostic: IntelligencePublishingApprovedExecutionDiagnostic,
): IntelligencePublishingApprovedExecutionDiagnostic {
  return deepFreeze({
    ...diagnostic,
    metadata: freezeMetadata(diagnostic.metadata),
  });
}

function createError(
  code: IntelligencePublishingApprovedExecutionErrorCode,
  message: string,
  diagnostics: readonly IntelligencePublishingApprovedExecutionDiagnostic[],
): IntelligencePublishingApprovedExecutionError {
  return new IntelligencePublishingApprovedExecutionError({
    code,
    message,
    diagnostics,
  });
}

function normalizeStringArray(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values.map((value) => normalizeText(value)))].sort(compareStrings),
  );
}

function normalizeGateConfig(
  bundle: IntelligencePublishingApprovalPreparationBundle,
  config?: IntelligencePublishingExecutionGateConfig,
): NormalizedGateConfig {
  const gatePolicy = bundle.executionRequest.gatePolicy;
  const allowlistSource =
    config?.allowlistReportKeys ?? gatePolicy.allowlistReportKeys ?? null;
  const allowlist =
    allowlistSource == null ? null : normalizeStringArray(allowlistSource);
  const maxExecuteBatchSize =
    config?.maxExecuteBatchSize ?? gatePolicy.maxExecuteBatchSize ?? null;
  if (
    maxExecuteBatchSize != null &&
    (!isFiniteNonNegativeInteger(maxExecuteBatchSize) || maxExecuteBatchSize < 0)
  ) {
    throw new Error("maxExecuteBatchSize must be null or a non-negative integer.");
  }
  return deepFreeze({
    executionEnabled: config?.executionEnabled ?? true,
    killSwitchEnabled: config?.killSwitchEnabled ?? false,
    approvalRequired: config?.approvalRequired ?? gatePolicy.approvalRequired,
    maxExecuteBatchSize,
    allowlistReportKeys: allowlist,
    readOnly: config?.readOnly ?? false,
  });
}

function buildApprovalPolicySnapshot(
  config: NormalizedGateConfig,
): IntelligencePublishingExecutionApprovalPolicySnapshot {
  return deepFreeze({
    approvalRequired: config.approvalRequired,
    maxExecuteBatchSize: config.maxExecuteBatchSize,
    allowlistReportKeys: config.allowlistReportKeys,
  });
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

function buildApprovalGrantFingerprint(
  grant: IntelligencePublishingApprovalGrant,
): string {
  return buildStableHash("ipp_approval_grant_fingerprint_", grant);
}

function buildApprovedOrchestratorInputFingerprint(
  input: Omit<
    IntelligencePublishingApprovedOrchestratorInput,
    "orchestratorInputFingerprint"
  >,
): string {
  const { createdAt: _createdAt, ...stableInput } = input;
  return buildStableHash("ipp_approved_orchestrator_input_", stableInput);
}

function buildApprovedExecutionBundleFingerprint(input: Readonly<{
  approvalPreparationBundleFingerprint: string;
  executionRequestFingerprint: string;
  approvalGrantFingerprint: string | null;
  gateDecisionFingerprint: string;
  orchestratorInputFingerprint: string | null;
}>): string {
  return buildStableHash("ipp_approved_execution_bundle_", input);
}

function buildAllowedOrchestratorInput(input: Readonly<{
  bundle: IntelligencePublishingApprovalPreparationBundle;
  approvalGrant: IntelligencePublishingApprovalGrant;
  approvalGrantFingerprint: string;
  gateConfig: NormalizedGateConfig;
  createdAt: string;
}>): IntelligencePublishingApprovedOrchestratorInput {
  const executionRequest = input.bundle.executionRequest;
  const approvalPolicy = buildApprovalPolicySnapshot(input.gateConfig);
  const orchestratorBase = deepFreeze({
    schemaVersion:
      INTELLIGENCE_PUBLISHING_APPROVED_ORCHESTRATOR_INPUT_SCHEMA_VERSION,
    inputVersion: INTELLIGENCE_PUBLISHING_APPROVED_ORCHESTRATOR_INPUT_VERSION,
    mode: "execute" as const,
    createdAt: input.createdAt,
    campaignKey: input.bundle.campaignKey,
    requestedAction: executionRequest.requestedAction,
    registryFingerprint: executionRequest.registryFingerprint,
    publicationPlanFingerprint: input.bundle.publicationPlanFingerprint,
    campaignSpecificationFingerprint:
      input.bundle.campaignSpecificationFingerprint,
    executionRequestFingerprint: executionRequest.executionRequestFingerprint,
    approvalGrantFingerprint: input.approvalGrantFingerprint,
    gatePolicy: approvalPolicy,
    gatePolicyFingerprint:
      buildIntelligencePublishingExecutionApprovalPolicyFingerprint(
        approvalPolicy,
      ),
    gateConfig: input.gateConfig,
    candidateCount: executionRequest.candidateCount,
    requestedActions: input.bundle.executionApprovalRequest.requestedActions,
    reportKeys: input.bundle.executionApprovalRequest.reportKeys,
    reportKeysInOrder: executionRequest.reportKeysInOrder,
    candidateFingerprintsInOrder:
      executionRequest.candidateFingerprintsInOrder,
    orderedCandidatesFingerprint: executionRequest.orderedCandidatesFingerprint,
    candidates: executionRequest.candidates,
    approvalRequest: input.bundle.executionApprovalRequest,
  });
  const orchestratorInputFingerprint =
    buildApprovedOrchestratorInputFingerprint(orchestratorBase);
  return deepFreeze({
    ...orchestratorBase,
    orchestratorInputFingerprint,
  });
}

export function validateIntelligencePublishingApprovedExecutionBundle(
  input: unknown,
): IntelligencePublishingApprovedExecutionBundleValidationResult {
  const issues: IntelligencePublishingApprovedExecutionBundleValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle",
          message: "Expected a plain approved execution bundle object.",
        },
      ]),
    };
  }

  if (
    input.schemaVersion !==
    INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_SCHEMA_VERSION
  ) {
    issues.push({
      path: "bundle.schemaVersion",
      message: "Unsupported approved execution schemaVersion.",
    });
  }
  if (
    input.bundleVersion !== INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_VERSION
  ) {
    issues.push({
      path: "bundle.bundleVersion",
      message: "Unsupported approved execution bundleVersion.",
    });
  }
  if (!isCanonicalIsoTimestamp(String(input.createdAt ?? ""))) {
    issues.push({
      path: "bundle.createdAt",
      message: "createdAt must be a canonical ISO timestamp.",
    });
  }
  if (!isNonEmptyString(input.approvalPreparationBundleFingerprint)) {
    issues.push({
      path: "bundle.approvalPreparationBundleFingerprint",
      message: "approvalPreparationBundleFingerprint must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(input.executionRequestFingerprint)) {
    issues.push({
      path: "bundle.executionRequestFingerprint",
      message: "executionRequestFingerprint must be a non-empty string.",
    });
  }
  if (
    input.approvalGrantFingerprint != null &&
    !isNonEmptyString(input.approvalGrantFingerprint)
  ) {
    issues.push({
      path: "bundle.approvalGrantFingerprint",
      message: "approvalGrantFingerprint must be null or a non-empty string.",
    });
  }
  if (!Array.isArray(input.diagnostics)) {
    issues.push({
      path: "bundle.diagnostics",
      message: "diagnostics must be an array.",
    });
  }
  if (!Array.isArray(input.warnings)) {
    issues.push({
      path: "bundle.warnings",
      message: "warnings must be an array.",
    });
  }
  if (!isNonEmptyString(input.approvedExecutionBundleFingerprint)) {
    issues.push({
      path: "bundle.approvedExecutionBundleFingerprint",
      message: "approvedExecutionBundleFingerprint must be a non-empty string.",
    });
  }

  const gateValidation = validateIntelligencePublishingExecutionGateDecision(
    input.gateDecision,
  );
  if (!gateValidation.ok) {
    issues.push(
      ...gateValidation.issues.map((issue) => ({
        path: `bundle.gateDecision.${issue.path}`,
        message: issue.message,
      })),
    );
  }

  const executionRequestValidation = validateIntelligencePublishingExecutionRequest(
    input.executionRequest,
  );
  if (!executionRequestValidation.ok) {
    issues.push(
      ...executionRequestValidation.issues.map((issue) => ({
        path: `bundle.executionRequest.${issue.path}`,
        message: issue.message,
      })),
    );
  }

  if (input.approvalGrant != null) {
    const approvalGrantValidation = validateIntelligencePublishingApprovalGrant(
      input.approvalGrant,
    );
    if (!approvalGrantValidation.ok) {
      issues.push(
        ...approvalGrantValidation.issues.map((issue) => ({
          path: `bundle.approvalGrant.${issue.path}`,
          message: issue.message,
        })),
      );
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const gateDecision = gateValidation.ok ? gateValidation.decision : null;
  const executionRequest = executionRequestValidation.ok
    ? executionRequestValidation.executionRequest
    : null;
  if (gateDecision == null || executionRequest == null) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle",
          message: "gateDecision or executionRequest could not be normalized.",
        },
      ]),
    };
  }

  const diagnostics = deepFreeze(
    (input.diagnostics as unknown[]).map((entry) => {
      if (!isPlainObject(entry)) {
        throw new Error("Invalid diagnostic entry.");
      }
      return freezeDiagnostic({
        code:
          entry.code as IntelligencePublishingApprovedExecutionDiagnosticCode,
        severity:
          entry.severity as IntelligencePublishingApprovedExecutionDiagnosticSeverity,
        message: String(entry.message ?? ""),
        metadata: freezeMetadata(
          isPlainObject(entry.metadata)
            ? (entry.metadata as CoordinationJsonObject)
            : {},
        ),
      });
    }),
  );
  const warnings = deepFreeze((input.warnings as unknown[]).map((entry) => String(entry)));

  const approvalGrant =
    input.approvalGrant == null
      ? null
      : deepFreeze(input.approvalGrant as IntelligencePublishingApprovalGrant);
  if (
    executionRequest.executionRequestFingerprint !== input.executionRequestFingerprint
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle.executionRequestFingerprint",
          message:
            "executionRequestFingerprint must match the normalized executionRequest payload.",
        },
      ]),
    };
  }

  if (
    approvalGrant == null
      ? input.approvalGrantFingerprint != null
      : buildApprovalGrantFingerprint(approvalGrant) !== input.approvalGrantFingerprint
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle.approvalGrantFingerprint",
          message:
            "approvalGrantFingerprint must match the normalized approvalGrant payload.",
        },
      ]),
    };
  }

  let orchestratorInput: IntelligencePublishingApprovedOrchestratorInput | null =
    null;
  if (input.orchestratorInput != null) {
    if (!isPlainObject(input.orchestratorInput)) {
      return {
        ok: false,
        issues: Object.freeze([
          {
            path: "bundle.orchestratorInput",
            message: "orchestratorInput must be a plain object when present.",
          },
        ]),
      };
    }
    const candidate =
      deepFreeze(
        input.orchestratorInput as IntelligencePublishingApprovedOrchestratorInput,
      );
    if (
      candidate.schemaVersion !==
        INTELLIGENCE_PUBLISHING_APPROVED_ORCHESTRATOR_INPUT_SCHEMA_VERSION ||
      candidate.inputVersion !==
        INTELLIGENCE_PUBLISHING_APPROVED_ORCHESTRATOR_INPUT_VERSION ||
      candidate.mode !== "execute" ||
      !isCanonicalIsoTimestamp(candidate.createdAt)
    ) {
      return {
        ok: false,
        issues: Object.freeze([
          {
            path: "bundle.orchestratorInput",
            message: "orchestratorInput carries an unsupported contract shape.",
          },
        ]),
      };
    }
    const approvalRequestValidation =
      validateIntelligencePublishingExecutionApprovalRequest(
        candidate.approvalRequest,
      );
    if (!approvalRequestValidation.ok) {
      return {
        ok: false,
        issues: Object.freeze(
          approvalRequestValidation.issues.map((issue) => ({
            path: `bundle.orchestratorInput.approvalRequest.${issue.path}`,
            message: issue.message,
          })),
        ),
      };
    }
    if (
      candidate.executionRequestFingerprint !==
        executionRequest.executionRequestFingerprint ||
      candidate.gatePolicyFingerprint !== executionRequest.gatePolicyFingerprint ||
      candidate.candidateCount !== executionRequest.candidateCount ||
      !hasExactStringArrayMatch(
        candidate.reportKeysInOrder,
        executionRequest.reportKeysInOrder,
      ) ||
      !hasExactStringArrayMatch(
        candidate.candidateFingerprintsInOrder,
        executionRequest.candidateFingerprintsInOrder,
      ) ||
      candidate.orderedCandidatesFingerprint !==
        executionRequest.orderedCandidatesFingerprint
    ) {
      return {
        ok: false,
        issues: Object.freeze([
          {
            path: "bundle.orchestratorInput",
            message:
              "orchestratorInput must remain aligned with the executionRequest scope.",
          },
        ]),
      };
    }
    const { orchestratorInputFingerprint, ...orchestratorBase } = candidate;
    if (
      orchestratorInputFingerprint !==
      buildApprovedOrchestratorInputFingerprint(orchestratorBase)
    ) {
      return {
        ok: false,
        issues: Object.freeze([
          {
            path: "bundle.orchestratorInput.orchestratorInputFingerprint",
            message:
              "orchestratorInputFingerprint does not match the normalized orchestrator input payload.",
          },
        ]),
      };
    }
    orchestratorInput = candidate;
  }

  if (gateDecision.decision === "allowed" && orchestratorInput == null) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle.orchestratorInput",
          message:
            "An allowed gateDecision requires a materialized orchestratorInput.",
        },
      ]),
    };
  }
  if (gateDecision.decision !== "allowed" && orchestratorInput != null) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle.orchestratorInput",
          message:
            "A blocked or approval_required gateDecision must not expose an orchestratorInput.",
        },
      ]),
    };
  }

  const approvedExecutionBundleFingerprint =
    buildApprovedExecutionBundleFingerprint({
      approvalPreparationBundleFingerprint: String(
        input.approvalPreparationBundleFingerprint,
      ).trim(),
      executionRequestFingerprint: executionRequest.executionRequestFingerprint,
      approvalGrantFingerprint:
        approvalGrant == null ? null : buildApprovalGrantFingerprint(approvalGrant),
      gateDecisionFingerprint: gateDecision.fingerprint,
      orchestratorInputFingerprint:
        orchestratorInput?.orchestratorInputFingerprint ?? null,
    });
  if (
    approvedExecutionBundleFingerprint !== input.approvedExecutionBundleFingerprint
  ) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "bundle.approvedExecutionBundleFingerprint",
          message:
            "approvedExecutionBundleFingerprint does not match the normalized bundle payload.",
        },
      ]),
    };
  }

  return {
    ok: true,
    bundle: deepFreeze({
      schemaVersion:
        INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_SCHEMA_VERSION,
      bundleVersion: INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_VERSION,
      approvalPreparationBundleFingerprint: String(
        input.approvalPreparationBundleFingerprint,
      ).trim(),
      executionRequestFingerprint: executionRequest.executionRequestFingerprint,
      approvalGrantFingerprint:
        approvalGrant == null ? null : buildApprovalGrantFingerprint(approvalGrant),
      gateDecision,
      executionRequest,
      approvalGrant,
      orchestratorInput,
      diagnostics,
      warnings,
      approvedExecutionBundleFingerprint,
      createdAt: String(input.createdAt).trim(),
    }),
  };
}

export function buildIntelligencePublishingApprovedExecutionBundle(
  input: BuildIntelligencePublishingApprovedExecutionBundleInput,
): IntelligencePublishingApprovedExecutionBundle {
  const diagnostics: IntelligencePublishingApprovedExecutionDiagnostic[] = [];

  if (!isCanonicalIsoTimestamp(input.evaluatedAt)) {
    throw createError(
      "invalid_evaluated_at",
      "evaluatedAt must be a canonical ISO timestamp.",
      diagnostics,
    );
  }

  const createdAt = input.createdAt ?? input.evaluatedAt;
  if (!isCanonicalIsoTimestamp(createdAt)) {
    throw createError(
      "invalid_created_at",
      "createdAt must be a canonical ISO timestamp.",
      diagnostics,
    );
  }

  const bundleValidation = validateIntelligencePublishingApprovalPreparationBundle(
    input.approvalPreparationBundle,
  );
  if (!bundleValidation.ok) {
    throw createError(
      "invalid_approval_preparation_bundle",
      `Approval preparation bundle validation failed: ${bundleValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
      diagnostics,
    );
  }
  const bundle = bundleValidation.bundle;
  diagnostics.push(
    freezeDiagnostic({
      code: "approval_preparation_bundle_validated",
      severity: "info",
      message: "Approval preparation bundle validated successfully.",
      metadata: {
        bundleFingerprint: bundle.bundleFingerprint,
        candidateCount: bundle.executionRequest.candidateCount,
      },
    }),
  );
  diagnostics.push(
    freezeDiagnostic({
      code: "approval_preparation_bundle_fingerprint_verified",
      severity: "info",
      message: "Approval preparation bundle fingerprint verified successfully.",
      metadata: {
        bundleFingerprint: bundle.bundleFingerprint,
      },
    }),
  );

  if (bundle.executionMode !== "execute" || bundle.executionRequest.mode !== "execute") {
    throw createError(
      "unsupported_execution_mode",
      "Approved execution bundles support execute mode only.",
      diagnostics,
    );
  }

  const gateConfig = normalizeGateConfig(bundle, input.gateConfig);
  const gatePolicy = buildApprovalPolicySnapshot(gateConfig);
  const gatePolicyFingerprint =
    buildIntelligencePublishingExecutionApprovalPolicyFingerprint(gatePolicy);
  if (gatePolicyFingerprint !== bundle.executionRequest.gatePolicyFingerprint) {
    throw createError(
      "gate_policy_fingerprint_mismatch",
      "The execution gate policy fingerprint does not match the approved bundle scope.",
      diagnostics,
    );
  }
  diagnostics.push(
    freezeDiagnostic({
      code: "gate_policy_fingerprint_verified",
      severity: "info",
      message: "Gate policy fingerprint verified successfully.",
      metadata: {
        gatePolicyFingerprint,
      },
    }),
  );

  const expectedRequestedActions = bundle.executionApprovalRequest.requestedActions;
  const expectedReportKeys = bundle.executionApprovalRequest.reportKeys;
  if (
    bundle.executionApprovalRequest.candidateCount !==
      bundle.executionRequest.candidateCount ||
    !hasExactStringArrayMatch(
      bundle.executionApprovalRequest.requestedActions,
      expectedRequestedActions,
    )
  ) {
    throw createError(
      "requested_actions_mismatch",
      "The approval request requestedActions do not match the execution request scope.",
      diagnostics,
    );
  }
  if (
    !hasExactStringArrayMatch(
      bundle.executionApprovalRequest.reportKeys,
      expectedReportKeys,
    )
  ) {
    throw createError(
      "report_keys_mismatch",
      "The approval request reportKeys do not match the execution request scope.",
      diagnostics,
    );
  }
  diagnostics.push(
    freezeDiagnostic({
      code: "execution_request_scope_verified",
      severity: "info",
      message: "Execution request scope verified successfully.",
      metadata: {
        executionRequestFingerprint:
          bundle.executionRequest.executionRequestFingerprint,
        candidateCount: bundle.executionRequest.candidateCount,
        requestedActions: expectedRequestedActions,
        reportKeys: expectedReportKeys,
      },
    }),
  );

  if (
    bundle.executionRequest.candidateCount !== bundle.summary.materializedCandidateCount ||
    bundle.executionRequest.candidateCount !== bundle.candidates.length
  ) {
    throw createError(
      "candidate_count_mismatch",
      "The approved candidate scope is internally inconsistent.",
      diagnostics,
    );
  }
  diagnostics.push(
    freezeDiagnostic({
      code: "candidate_scope_verified",
      severity: "info",
      message: "Candidate scope verified successfully.",
      metadata: {
        candidateCount: bundle.executionRequest.candidateCount,
        reportKeysInOrder: bundle.executionRequest.reportKeysInOrder,
        orderedCandidatesFingerprint:
          bundle.executionRequest.orderedCandidatesFingerprint,
      },
    }),
  );

  let approvalGrant: IntelligencePublishingApprovalGrant | null = null;
  let approvalGrantFingerprint: string | null = null;
  if (input.approvalGrant != null) {
    const grantValidation = validateIntelligencePublishingApprovalGrant(
      input.approvalGrant,
    );
    if (!grantValidation.ok) {
      throw createError(
        "invalid_approval_grant",
        `Approval grant validation failed: ${grantValidation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join(" | ")}`,
        diagnostics,
      );
    }
    approvalGrant = grantValidation.grant;
    approvalGrantFingerprint = buildApprovalGrantFingerprint(approvalGrant);
    diagnostics.push(
      freezeDiagnostic({
        code: "approval_grant_validated",
        severity: "info",
        message: "Approval grant validated successfully.",
        metadata: {
          grantId: approvalGrant.grantId,
          issuer: approvalGrant.issuer,
          approvedCandidateCount: approvalGrant.approvedCandidateCount,
        },
      }),
    );
    diagnostics.push(
      freezeDiagnostic({
        code: "approval_grant_fingerprint_verified",
        severity: "info",
        message: "Approval grant fingerprint verified successfully.",
        metadata: {
          approvalGrantFingerprint,
        },
      }),
    );

    const preflight = verifyIntelligencePublishingApprovalGrant({
      approvalRequest: bundle.executionApprovalRequest,
      approvalGrant,
      options: {
        secret: input.approvalVerification?.secret ?? "",
        now: input.evaluatedAt,
        maxGrantLifetimeSeconds:
          input.approvalVerification?.maxGrantLifetimeSeconds,
        allowedClockSkewSeconds:
          input.approvalVerification?.allowedClockSkewSeconds,
      } satisfies VerifyIntelligencePublishingApprovalGrantOptions,
    });
    diagnostics.push(
      freezeDiagnostic({
        code: "approval_grant_preflight_verified",
        severity: preflight.ok ? "info" : "warning",
        message: preflight.ok
          ? "Approval grant preflight verification succeeded."
          : `Approval grant preflight verification returned ${preflight.reasonCode}.`,
        metadata: {
          reasonCode: preflight.reasonCode,
          structureValidated: preflight.structureValidated,
          signatureValidated: preflight.signatureValidated,
          timeValidated: preflight.timeValidated,
          scopeValidated: preflight.scopeValidated,
        },
      }),
    );
  }

  const gateDecision = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: input.evaluatedAt,
    candidates: bundle.executionRequest.candidates,
    config: gateConfig,
    approvalRequest: bundle.executionApprovalRequest,
    approvalGrant,
    approvalVerification: input.approvalVerification,
    metadata: input.metadata,
  });
  const gateValidation = validateIntelligencePublishingExecutionGateDecision(
    gateDecision,
  );
  if (!gateValidation.ok) {
    throw createError(
      "invalid_gate_decision",
      `Execution gate decision validation failed: ${gateValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
      diagnostics,
    );
  }
  diagnostics.push(
    freezeDiagnostic({
      code: "execution_gate_evaluated",
      severity:
        gateDecision.decision === "allowed"
          ? "info"
          : gateDecision.decision === "approval_required"
            ? "warning"
            : "error",
      message: `Execution gate evaluated with decision ${gateDecision.decision}.`,
      metadata: {
        fingerprint: gateDecision.fingerprint,
        reasonCodes: gateDecision.reasonCodes,
      },
    }),
  );

  let orchestratorInput: IntelligencePublishingApprovedOrchestratorInput | null =
    null;
  if (gateDecision.decision === "allowed") {
    if (approvalGrant == null || approvalGrantFingerprint == null) {
      throw createError(
        "invalid_approval_grant",
        "An allowed execution decision requires a validated approval grant.",
        diagnostics,
      );
    }
    orchestratorInput = buildAllowedOrchestratorInput({
      bundle,
      approvalGrant,
      approvalGrantFingerprint,
      gateConfig,
      createdAt,
    });
    diagnostics.push(
      freezeDiagnostic({
        code: "approved_orchestrator_input_materialized",
        severity: "info",
        message:
          "The deterministic approved orchestrator input was materialized without executing the orchestrator.",
        metadata: {
          orchestratorInputFingerprint:
            orchestratorInput.orchestratorInputFingerprint,
          candidateCount: orchestratorInput.candidateCount,
        },
      }),
    );
  } else {
    diagnostics.push(
      freezeDiagnostic({
        code: "execution_gate_blocked",
        severity: gateDecision.decision === "blocked" ? "error" : "warning",
        message:
          "The execution gate did not allow execution, so no orchestrator input was materialized.",
        metadata: {
          decision: gateDecision.decision,
          reasonCodes: gateDecision.reasonCodes,
        },
      }),
    );
  }

  const warnings = deepFreeze([
    ...gateDecision.warnings,
    ...(gateDecision.decision === "allowed"
      ? []
      : [
          `Execution gate returned ${gateDecision.decision}; no execution will be prepared beyond the decision envelope.`,
        ]),
  ]);

  const approvedExecutionBundleFingerprint =
    buildApprovedExecutionBundleFingerprint({
      approvalPreparationBundleFingerprint: bundle.bundleFingerprint,
      executionRequestFingerprint:
        bundle.executionRequest.executionRequestFingerprint,
      approvalGrantFingerprint,
      gateDecisionFingerprint: gateDecision.fingerprint,
      orchestratorInputFingerprint:
        orchestratorInput?.orchestratorInputFingerprint ?? null,
    });
  diagnostics.push(
    freezeDiagnostic({
      code: "approved_execution_bundle_materialized",
      severity: "info",
      message: "Approved execution bundle materialized successfully.",
      metadata: {
        approvedExecutionBundleFingerprint,
        decision: gateDecision.decision,
      },
    }),
  );
  diagnostics.push(
    freezeDiagnostic({
      code: "approved_execution_bundle_fingerprint_verified",
      severity: "info",
      message:
        "Approved execution bundle fingerprint verified successfully.",
      metadata: {
        approvedExecutionBundleFingerprint,
      },
    }),
  );

  const finalBundle = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_SCHEMA_VERSION,
    bundleVersion: INTELLIGENCE_PUBLISHING_APPROVED_EXECUTION_VERSION,
    approvalPreparationBundleFingerprint: bundle.bundleFingerprint,
    executionRequestFingerprint:
      bundle.executionRequest.executionRequestFingerprint,
    approvalGrantFingerprint,
    gateDecision,
    executionRequest: bundle.executionRequest,
    approvalGrant,
    orchestratorInput,
    diagnostics: deepFreeze(diagnostics),
    warnings,
    approvedExecutionBundleFingerprint,
    createdAt,
  });

  const finalValidation =
    validateIntelligencePublishingApprovedExecutionBundle(finalBundle);
  if (!finalValidation.ok) {
    throw createError(
      "approved_execution_bundle_fingerprint_mismatch",
      `Approved execution bundle validation failed after construction: ${finalValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
      diagnostics,
    );
  }

  return finalBundle;
}
