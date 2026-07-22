import { createHash } from "node:crypto";

import type {
  IntelligencePublishingBatchCandidate,
  IntelligencePublishingBatchMode,
} from "./batchPlanning";
import {
  validateIntelligencePublishingExecutionApprovalRequest,
  verifyIntelligencePublishingApprovalGrant,
  type IntelligencePublishingApprovalGrantReasonCode,
  type IntelligencePublishingExecutionApprovalPolicySnapshot,
  type VerifyIntelligencePublishingApprovalGrantOptions,
} from "./approvalGrant";
import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";

export const INTELLIGENCE_PUBLISHING_EXECUTION_GATE_SCHEMA_VERSION =
  "ipp_execution_gate_decision_v1" as const;
export const INTELLIGENCE_PUBLISHING_EXECUTION_GATE_VERSION =
  "ipp_execution_gate_v1" as const;

export const INTELLIGENCE_PUBLISHING_EXECUTION_GATE_DECISIONS = Object.freeze([
  "allowed",
  "blocked",
  "approval_required",
] as const);

export type IntelligencePublishingExecutionGateDecisionValue =
  (typeof INTELLIGENCE_PUBLISHING_EXECUTION_GATE_DECISIONS)[number];

export const INTELLIGENCE_PUBLISHING_EXECUTION_GATE_REASON_CODES =
  Object.freeze([
    "dry_run_allowed",
    "execute_allowed",
    "execution_disabled",
    "kill_switch_enabled",
    "batch_size_exceeded",
    "allowlist_passed",
    "allowlist_blocked",
    "read_only_mode",
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

export type IntelligencePublishingExecutionGateReasonCode =
  | (typeof INTELLIGENCE_PUBLISHING_EXECUTION_GATE_REASON_CODES)[number]
  | IntelligencePublishingApprovalGrantReasonCode;

export const INTELLIGENCE_PUBLISHING_EXECUTION_GATE_DIAGNOSTIC_CODES =
  Object.freeze([
    "config_validated",
    "dry_run_auto_allowed",
    "execute_allowed",
    "execution_disabled",
    "kill_switch_enabled",
    "batch_size_exceeded",
    "allowlist_passed",
    "allowlist_blocked",
    "read_only_mode",
    "approval_request_built",
    "approval_grant_missing",
    "approval_grant_received",
    "approval_grant_structure_validated",
    "approval_grant_signature_verified",
    "approval_grant_time_validated",
    "approval_grant_scope_validated",
    "approval_grant_rejected",
    "approval_grant_accepted",
    "approval_grant_ignored",
    "fingerprint_computed",
  ] as const);

export type IntelligencePublishingExecutionGateDiagnosticCode =
  (typeof INTELLIGENCE_PUBLISHING_EXECUTION_GATE_DIAGNOSTIC_CODES)[number];

export type IntelligencePublishingExecutionGateDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export type IntelligencePublishingExecutionGateDiagnostic = Readonly<{
  code: IntelligencePublishingExecutionGateDiagnosticCode;
  severity: IntelligencePublishingExecutionGateDiagnosticSeverity;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type IntelligencePublishingExecutionGateConfig = Readonly<{
  executionEnabled?: boolean;
  killSwitchEnabled?: boolean;
  approvalRequired?: boolean;
  maxExecuteBatchSize?: number | null;
  allowlistReportKeys?: readonly string[] | null;
  readOnly?: boolean;
}>;

export type NormalizedIntelligencePublishingExecutionGateConfig = Readonly<{
  executionEnabled: boolean;
  killSwitchEnabled: boolean;
  approvalRequired: boolean;
  maxExecuteBatchSize: number | null;
  allowlistReportKeys: readonly string[] | null;
  readOnly: boolean;
}>;

export type IntelligencePublishingExecutionGateApprovalVerification = Readonly<{
  secret: string;
  maxGrantLifetimeSeconds?: number;
  allowedClockSkewSeconds?: number;
}>;

export type IntelligencePublishingExecutionGateInput = Readonly<{
  mode: IntelligencePublishingBatchMode;
  evaluatedAt: string;
  candidates: readonly IntelligencePublishingBatchCandidate[];
  config?: IntelligencePublishingExecutionGateConfig;
  approvalRequest?: unknown;
  approvalGrant?: unknown;
  approvalVerification?: IntelligencePublishingExecutionGateApprovalVerification | null;
  metadata?: CoordinationJsonObject;
}>;

export type IntelligencePublishingExecutionGateDecision = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_EXECUTION_GATE_SCHEMA_VERSION;
  gateVersion: typeof INTELLIGENCE_PUBLISHING_EXECUTION_GATE_VERSION;
  decision: IntelligencePublishingExecutionGateDecisionValue;
  reasonCodes: readonly IntelligencePublishingExecutionGateReasonCode[];
  warnings: readonly string[];
  diagnostics: readonly IntelligencePublishingExecutionGateDiagnostic[];
  evaluatedAt: string;
  fingerprint: string;
}>;

export type IntelligencePublishingExecutionGateValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type IntelligencePublishingExecutionGateValidationResult =
  | Readonly<{
      ok: true;
      decision: IntelligencePublishingExecutionGateDecision;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingExecutionGateValidationIssue[];
    }>;

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString() === value;
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
  return deepFreeze(sortJsonValue(value ?? {}) as CoordinationJsonObject);
}

function buildStableHash(prefix: string, value: unknown): string {
  return `${prefix}${createHash("sha256")
    .update(JSON.stringify(sortJsonValue(value)))
    .digest("hex")}`;
}

function buildDiagnostic(
  input: Readonly<{
    code: IntelligencePublishingExecutionGateDiagnosticCode;
    severity: IntelligencePublishingExecutionGateDiagnosticSeverity;
    message: string;
    metadata?: CoordinationJsonObject;
  }>,
): IntelligencePublishingExecutionGateDiagnostic {
  return deepFreeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    metadata: freezeMetadata(input.metadata),
  });
}

function normalizeConfig(
  config: IntelligencePublishingExecutionGateConfig | undefined,
): NormalizedIntelligencePublishingExecutionGateConfig {
  const allowlist =
    config?.allowlistReportKeys == null
      ? null
      : Object.freeze(
          [...new Set(config.allowlistReportKeys.map((value) => value.trim().toLowerCase()))]
            .filter((value) => value.length > 0)
            .sort(compareStrings),
        );
  return deepFreeze({
    executionEnabled: config?.executionEnabled ?? true,
    killSwitchEnabled: config?.killSwitchEnabled ?? false,
    approvalRequired: config?.approvalRequired ?? false,
    maxExecuteBatchSize: config?.maxExecuteBatchSize ?? null,
    allowlistReportKeys: allowlist,
    readOnly: config?.readOnly ?? false,
  });
}

function buildApprovalPolicySnapshot(
  config: NormalizedIntelligencePublishingExecutionGateConfig,
): IntelligencePublishingExecutionApprovalPolicySnapshot {
  return deepFreeze({
    approvalRequired: config.approvalRequired,
    maxExecuteBatchSize: config.maxExecuteBatchSize,
    allowlistReportKeys: config.allowlistReportKeys,
  });
}

function fingerprintCandidates(
  candidates: readonly IntelligencePublishingBatchCandidate[],
): readonly Readonly<Record<string, string | number | null>>[] {
  return Object.freeze(
    [...candidates]
      .map((candidate) => ({
        reportKey: candidate.reportKey.trim().toLowerCase(),
        locale: candidate.locale.trim().toLowerCase(),
        country: candidate.country.trim().toLowerCase(),
        city: candidate.city.trim().toLowerCase(),
        platform: candidate.platform.trim().toLowerCase(),
        propertyType: candidate.propertyType.trim().toLowerCase(),
        requestedAction:
          candidate.requestedAction == null
            ? null
            : candidate.requestedAction.trim().toLowerCase(),
        priority: candidate.priority ?? null,
      }))
      .sort((left, right) => {
        const reportKeyOrder = compareStrings(left.reportKey, right.reportKey);
        if (reportKeyOrder !== 0) {
          return reportKeyOrder;
        }
        const localeOrder = compareStrings(left.locale, right.locale);
        if (localeOrder !== 0) {
          return localeOrder;
        }
        return compareStrings(left.propertyType, right.propertyType);
      }),
  );
}

function buildDecisionFingerprint(input: Readonly<{
  decision: IntelligencePublishingExecutionGateDecisionValue;
  reasonCodes: readonly IntelligencePublishingExecutionGateReasonCode[];
  warnings: readonly string[];
  config: NormalizedIntelligencePublishingExecutionGateConfig;
  candidates: readonly IntelligencePublishingBatchCandidate[];
  approvalRequestFingerprint: string | null;
  approvalGrantSummary: CoordinationJsonObject | null;
  metadata: CoordinationJsonObject;
}>): string {
  return buildStableHash("ipp_execution_gate_", {
    decision: input.decision,
    reasonCodes: input.reasonCodes,
    warnings: input.warnings,
    config: input.config,
    candidates: fingerprintCandidates(input.candidates),
    approvalRequestFingerprint: input.approvalRequestFingerprint,
    approvalGrantSummary: input.approvalGrantSummary,
    metadata: input.metadata,
  });
}

export function evaluateIntelligencePublishingExecutionGate(
  input: IntelligencePublishingExecutionGateInput,
): IntelligencePublishingExecutionGateDecision {
  if (!isCanonicalIsoTimestamp(input.evaluatedAt)) {
    throw new Error("evaluatedAt must be a canonical ISO timestamp.");
  }
  if (!Array.isArray(input.candidates)) {
    throw new Error("candidates must be an array.");
  }

  const normalizedConfig = normalizeConfig(input.config);
  if (
    normalizedConfig.maxExecuteBatchSize != null &&
    !isFiniteNonNegativeInteger(normalizedConfig.maxExecuteBatchSize)
  ) {
    throw new Error("maxExecuteBatchSize must be null or a non-negative integer.");
  }

  const diagnostics: IntelligencePublishingExecutionGateDiagnostic[] = [
    buildDiagnostic({
      code: "config_validated",
      severity: "info",
      message: "Execution gate configuration validated successfully.",
      metadata: {
        executionEnabled: normalizedConfig.executionEnabled,
        killSwitchEnabled: normalizedConfig.killSwitchEnabled,
        approvalRequired: normalizedConfig.approvalRequired,
        maxExecuteBatchSize: normalizedConfig.maxExecuteBatchSize,
        hasAllowlist: normalizedConfig.allowlistReportKeys != null,
        readOnly: normalizedConfig.readOnly,
        candidateCount: input.candidates.length,
      },
    }),
  ];

  const reasonCodes: IntelligencePublishingExecutionGateReasonCode[] = [];
  const warnings: string[] = [];
  const gatePolicy = buildApprovalPolicySnapshot(normalizedConfig);
  const metadata = freezeMetadata(input.metadata);

  const approvalRequestValidation =
    input.mode === "execute" && input.approvalRequest != null
      ? validateIntelligencePublishingExecutionApprovalRequest(input.approvalRequest)
      : null;
  const approvalRequest =
    approvalRequestValidation?.ok === true ? approvalRequestValidation.request : null;

  if (approvalRequest != null) {
    diagnostics.push(
      buildDiagnostic({
        code: "approval_request_built",
        severity: "info",
        message: "A public-safe execution approval request was supplied for this execute run.",
        metadata: {
          registryFingerprint: approvalRequest.registryFingerprint,
          requestFingerprint: approvalRequest.requestFingerprint,
          candidateCount: approvalRequest.candidateCount,
          reportKeys: approvalRequest.reportKeys,
          requestedActions: approvalRequest.requestedActions,
          gatePolicyFingerprint: approvalRequest.gatePolicyFingerprint,
        },
      }),
    );
  }

  if (input.mode === "dry_run") {
    if (input.approvalGrant != null) {
      warnings.push(
        "Dry-run mode ignores any provided approval grant because approval applies to execute mode only.",
      );
      diagnostics.push(
        buildDiagnostic({
          code: "approval_grant_ignored",
          severity: "info",
          message: "Dry-run mode ignored the provided approval grant.",
          metadata: freezeMetadata({}),
        }),
      );
    }
    reasonCodes.push("dry_run_allowed");
    diagnostics.push(
      buildDiagnostic({
        code: "dry_run_auto_allowed",
        severity: "info",
        message: "Dry-run mode is always allowed by the execution gate.",
        metadata: {
          candidateCount: input.candidates.length,
        },
      }),
    );

    const fingerprint = buildDecisionFingerprint({
      decision: "allowed",
      reasonCodes: Object.freeze(reasonCodes),
      warnings: Object.freeze(warnings),
      config: normalizedConfig,
      candidates: input.candidates,
      approvalRequestFingerprint: null,
      approvalGrantSummary: null,
      metadata,
    });
    const finalDiagnostics = Object.freeze([
      ...diagnostics,
      buildDiagnostic({
        code: "fingerprint_computed",
        severity: "info",
        message: "Execution gate fingerprint computed successfully.",
        metadata: {
          fingerprint,
        },
      }),
    ]);
    return deepFreeze({
      schemaVersion: INTELLIGENCE_PUBLISHING_EXECUTION_GATE_SCHEMA_VERSION,
      gateVersion: INTELLIGENCE_PUBLISHING_EXECUTION_GATE_VERSION,
      decision: "allowed",
      reasonCodes: Object.freeze(reasonCodes),
      warnings: Object.freeze(warnings),
      diagnostics: finalDiagnostics,
      evaluatedAt: input.evaluatedAt,
      fingerprint,
    });
  }

  const allowlist = normalizedConfig.allowlistReportKeys
    ? new Set(normalizedConfig.allowlistReportKeys)
    : null;
  const deniedReportKeys =
    allowlist == null
      ? []
      : input.candidates
          .map((candidate) => candidate.reportKey.trim().toLowerCase())
          .filter((reportKey) => !allowlist.has(reportKey))
          .sort(compareStrings);

  let decision: IntelligencePublishingExecutionGateDecisionValue = "allowed";
  let approvalGrantSummary: CoordinationJsonObject | null = null;

  if (normalizedConfig.killSwitchEnabled) {
    decision = "blocked";
    reasonCodes.push("kill_switch_enabled");
    diagnostics.push(
      buildDiagnostic({
        code: "kill_switch_enabled",
        severity: "error",
        message: "Execution is blocked because the kill switch is enabled.",
      }),
    );
  } else if (!normalizedConfig.executionEnabled) {
    decision = "blocked";
    reasonCodes.push("execution_disabled");
    diagnostics.push(
      buildDiagnostic({
        code: "execution_disabled",
        severity: "error",
        message: "Execution is blocked because execute mode is disabled.",
      }),
    );
  } else if (normalizedConfig.readOnly) {
    decision = "blocked";
    reasonCodes.push("read_only_mode");
    diagnostics.push(
      buildDiagnostic({
        code: "read_only_mode",
        severity: "error",
        message: "Execution is blocked because the gate is in read-only mode.",
      }),
    );
  } else if (
    normalizedConfig.maxExecuteBatchSize != null &&
    input.candidates.length > normalizedConfig.maxExecuteBatchSize
  ) {
    decision = "blocked";
    reasonCodes.push("batch_size_exceeded");
    diagnostics.push(
      buildDiagnostic({
        code: "batch_size_exceeded",
        severity: "error",
        message:
          "Execution is blocked because the batch exceeds the configured maximum size.",
        metadata: {
          candidateCount: input.candidates.length,
          maxExecuteBatchSize: normalizedConfig.maxExecuteBatchSize,
        },
      }),
    );
  } else if (allowlist != null && deniedReportKeys.length > 0) {
    decision = "blocked";
    reasonCodes.push("allowlist_blocked");
    diagnostics.push(
      buildDiagnostic({
        code: "allowlist_blocked",
        severity: "error",
        message:
          "Execution is blocked because one or more report keys are not allowlisted.",
        metadata: {
          deniedCount: deniedReportKeys.length,
          deniedReportKeys,
        },
      }),
    );
  } else {
    if (allowlist != null) {
      reasonCodes.push("allowlist_passed");
      diagnostics.push(
        buildDiagnostic({
          code: "allowlist_passed",
          severity: "info",
          message: "All report keys matched the configured allowlist.",
          metadata: {
            allowedCount: input.candidates.length,
          },
        }),
      );
    }

    if (!normalizedConfig.approvalRequired) {
      decision = "allowed";
      reasonCodes.push("execute_allowed");
      diagnostics.push(
        buildDiagnostic({
          code: "execute_allowed",
          severity: "info",
          message: "Execute mode is allowed by the execution gate.",
          metadata: {
            candidateCount: input.candidates.length,
          },
        }),
      );
      if (input.approvalGrant != null) {
        warnings.push(
          "An approval grant was provided but is not required by the current gate configuration.",
        );
        diagnostics.push(
          buildDiagnostic({
            code: "approval_grant_ignored",
            severity: "info",
            message:
              "The provided approval grant was ignored because this execution does not require approval.",
            metadata: freezeMetadata({}),
          }),
        );
      }
    } else if (input.approvalGrant == null) {
      decision = "approval_required";
      reasonCodes.push("approval_grant_missing");
      diagnostics.push(
        buildDiagnostic({
          code: "approval_grant_missing",
          severity: "warning",
          message:
            "Execution requires explicit approval and no approval grant was provided.",
          metadata: {
            requestFingerprint: approvalRequest?.requestFingerprint ?? null,
          },
        }),
      );
    } else if (approvalRequest == null) {
      decision = "blocked";
      reasonCodes.push("approval_grant_request_mismatch");
      diagnostics.push(
        buildDiagnostic({
          code: "approval_grant_rejected",
          severity: "error",
          message:
            "Execution is blocked because the approval grant could not be matched to a valid execution approval request.",
          metadata: freezeMetadata({}),
        }),
      );
    } else {
      const verification = verifyIntelligencePublishingApprovalGrant({
        approvalRequest,
        approvalGrant: input.approvalGrant,
        options: {
          secret: input.approvalVerification?.secret ?? "",
          now: input.evaluatedAt,
          maxGrantLifetimeSeconds:
            input.approvalVerification?.maxGrantLifetimeSeconds,
          allowedClockSkewSeconds:
            input.approvalVerification?.allowedClockSkewSeconds,
        },
      });

      approvalGrantSummary = freezeMetadata({
        grantId: verification.publicSummary.grantId,
        issuer: verification.publicSummary.issuer,
        schemaVersion: verification.publicSummary.schemaVersion,
        grantVersion: verification.publicSummary.grantVersion,
        signatureAlgorithm: verification.publicSummary.signatureAlgorithm,
        issuedAt: verification.publicSummary.issuedAt,
        expiresAt: verification.publicSummary.expiresAt,
        executionRequestFingerprint:
          verification.publicSummary.executionRequestFingerprint,
        registryFingerprint: verification.publicSummary.registryFingerprint,
        approvedCandidateCount:
          verification.publicSummary.approvedCandidateCount,
        maxApprovedBatchSize: verification.publicSummary.maxApprovedBatchSize,
      });

      diagnostics.push(
        buildDiagnostic({
          code: "approval_grant_received",
          severity: "info",
          message: "An approval grant was received for verification.",
          metadata: approvalGrantSummary,
        }),
      );
      if (verification.structureValidated) {
        diagnostics.push(
          buildDiagnostic({
            code: "approval_grant_structure_validated",
            severity: "info",
            message: "Approval grant structure validated successfully.",
            metadata: approvalGrantSummary,
          }),
        );
      }
      if (verification.signatureValidated) {
        diagnostics.push(
          buildDiagnostic({
            code: "approval_grant_signature_verified",
            severity: "info",
            message: "Approval grant signature verified successfully.",
            metadata: approvalGrantSummary,
          }),
        );
      }
      if (verification.timeValidated) {
        diagnostics.push(
          buildDiagnostic({
            code: "approval_grant_time_validated",
            severity: "info",
            message: "Approval grant timing constraints validated successfully.",
            metadata: approvalGrantSummary,
          }),
        );
      }
      if (verification.scopeValidated) {
        diagnostics.push(
          buildDiagnostic({
            code: "approval_grant_scope_validated",
            severity: "info",
            message: "Approval grant scope validated successfully.",
            metadata: approvalGrantSummary,
          }),
        );
      }

      if (verification.ok) {
        decision = "allowed";
        reasonCodes.push("approval_grant_verified");
        diagnostics.push(
          buildDiagnostic({
            code: "approval_grant_accepted",
            severity: "info",
            message:
              "The approval grant was verified successfully and satisfies the approval requirement.",
            metadata: approvalGrantSummary,
          }),
        );
      } else {
        decision = "blocked";
        reasonCodes.push(
          verification.reasonCode as IntelligencePublishingExecutionGateReasonCode,
        );
        diagnostics.push(
          buildDiagnostic({
            code: "approval_grant_rejected",
            severity: "error",
            message: `The approval grant was rejected with reason ${verification.reasonCode}.`,
            metadata: freezeMetadata({
              ...approvalGrantSummary,
              reasonCode: verification.reasonCode,
            }),
          }),
        );
      }
    }
  }

  const fingerprint = buildDecisionFingerprint({
    decision,
    reasonCodes: Object.freeze(reasonCodes),
    warnings: Object.freeze(warnings),
    config: normalizedConfig,
    candidates: input.candidates,
    approvalRequestFingerprint: approvalRequest?.requestFingerprint ?? null,
    approvalGrantSummary,
    metadata,
  });

  const finalDiagnostics = Object.freeze([
    ...diagnostics,
    buildDiagnostic({
      code: "fingerprint_computed",
      severity: "info",
      message: "Execution gate fingerprint computed successfully.",
      metadata: {
        fingerprint,
      },
    }),
  ]);

  return deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_EXECUTION_GATE_SCHEMA_VERSION,
    gateVersion: INTELLIGENCE_PUBLISHING_EXECUTION_GATE_VERSION,
    decision,
    reasonCodes: Object.freeze(reasonCodes),
    warnings: Object.freeze(warnings),
    diagnostics: finalDiagnostics,
    evaluatedAt: input.evaluatedAt,
    fingerprint,
  });
}

export function validateIntelligencePublishingExecutionGateDecision(
  input: unknown,
): IntelligencePublishingExecutionGateValidationResult {
  const issues: IntelligencePublishingExecutionGateValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "decision",
          message: "Expected a plain execution gate decision object.",
        },
      ]),
    };
  }
  if (input.schemaVersion !== INTELLIGENCE_PUBLISHING_EXECUTION_GATE_SCHEMA_VERSION) {
    issues.push({
      path: "schemaVersion",
      message: "Unsupported execution gate schemaVersion.",
    });
  }
  if (input.gateVersion !== INTELLIGENCE_PUBLISHING_EXECUTION_GATE_VERSION) {
    issues.push({
      path: "gateVersion",
      message: "Unsupported execution gate version.",
    });
  }
  if (
    !isNonEmptyString(input.decision) ||
    !INTELLIGENCE_PUBLISHING_EXECUTION_GATE_DECISIONS.includes(
      input.decision as IntelligencePublishingExecutionGateDecisionValue,
    )
  ) {
    issues.push({
      path: "decision",
      message: "decision must be allowed, blocked or approval_required.",
    });
  }
  if (!Array.isArray(input.reasonCodes)) {
    issues.push({
      path: "reasonCodes",
      message: "reasonCodes must be an array.",
    });
  }
  if (!Array.isArray(input.warnings)) {
    issues.push({
      path: "warnings",
      message: "warnings must be an array.",
    });
  }
  if (!Array.isArray(input.diagnostics)) {
    issues.push({
      path: "diagnostics",
      message: "diagnostics must be an array.",
    });
  }
  if (!isNonEmptyString(input.evaluatedAt) || !isCanonicalIsoTimestamp(input.evaluatedAt)) {
    issues.push({
      path: "evaluatedAt",
      message: "evaluatedAt must be a canonical ISO timestamp.",
    });
  }
  if (!isNonEmptyString(input.fingerprint)) {
    issues.push({
      path: "fingerprint",
      message: "fingerprint must be a non-empty string.",
    });
  }
  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }
  return {
    ok: true,
    decision: input as IntelligencePublishingExecutionGateDecision,
  };
}
