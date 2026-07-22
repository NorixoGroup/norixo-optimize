import { createHash } from "node:crypto";

import {
  buildRegistryBatchCandidatesFromSnapshot,
  executeRegistrySnapshotBatch,
  type ExecuteRegistrySnapshotBatchInput,
  type RegistryBatchRuntimeChannel,
} from "./registryBatchRuntime";
import {
  assertRegistrySnapshotPublicSafe,
  buildRegistrySnapshotFingerprint,
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
  type RegistrySnapshot,
} from "./registryAdapter";
import {
  INTELLIGENCE_PUBLISHING_BATCH_MODES,
  INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION,
  INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION,
  validateIntelligencePublishingBatchPlan,
  type IntelligencePublishingBatchAction,
  type IntelligencePublishingBatchDiagnostic,
  type IntelligencePublishingBatchMode,
  type IntelligencePublishingBatchPlan,
  type IntelligencePublishingBatchResult,
  type IntelligencePublishingBatchStatus,
} from "./batchPlanning";
import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";
import type {
  PublicationEventPriority,
  PublicationEventVisibility,
} from "./eventContracts";
import {
  evaluateIntelligencePublishingExecutionGate,
  validateIntelligencePublishingExecutionGateDecision,
  type IntelligencePublishingExecutionGateConfig,
  type IntelligencePublishingExecutionGateDecision,
} from "./executionGate";

export const INTELLIGENCE_PUBLISHING_ORCHESTRATION_SCHEMA_VERSION =
  "ipp_orchestration_result_v2" as const;
export const INTELLIGENCE_PUBLISHING_ORCHESTRATOR_VERSION =
  "ipp_orchestrator_v2" as const;

export const INTELLIGENCE_PUBLISHING_ORCHESTRATION_DIAGNOSTIC_CODES =
  Object.freeze([
    "snapshot_loaded",
    "privacy_validated",
    "registry_empty",
    "gate_evaluated",
    "gate_blocked",
    "gate_approval_required",
    "batch_plan_validated",
    "batch_result_validated",
    "fingerprint_verified",
    "orchestration_completed",
  ] as const);

export type IntelligencePublishingOrchestrationDiagnosticCode =
  (typeof INTELLIGENCE_PUBLISHING_ORCHESTRATION_DIAGNOSTIC_CODES)[number];

export type IntelligencePublishingOrchestrationDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export type IntelligencePublishingOrchestrationDiagnostic = Readonly<{
  code: IntelligencePublishingOrchestrationDiagnosticCode;
  severity: IntelligencePublishingOrchestrationDiagnosticSeverity;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type IntelligencePublishingOrchestrationSummary = Readonly<{
  gateDecision: IntelligencePublishingExecutionGateDecision["decision"];
  batchStatus: IntelligencePublishingBatchStatus | null;
  channel: RegistryBatchRuntimeChannel | null;
  registryAssetCount: number;
  candidateCount: number;
  itemCount: number | null;
  executableItemCount: number | null;
  duplicateCount: number | null;
  succeededItems: number;
  failedItems: number;
  blockedItems: number;
  skippedItems: number;
  dryRunItems: number;
  durationMs: number | null;
}>;

export type IntelligencePublishingOrchestrationResult = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_ORCHESTRATION_SCHEMA_VERSION;
  orchestratorVersion: typeof INTELLIGENCE_PUBLISHING_ORCHESTRATOR_VERSION;
  mode: IntelligencePublishingBatchMode;
  registryFingerprint: string;
  planFingerprint: string | null;
  resultFingerprint: string | null;
  createdAt: string;
  gateDecision: IntelligencePublishingExecutionGateDecision;
  batchPlan: IntelligencePublishingBatchPlan | null;
  batchResult: IntelligencePublishingBatchResult | null;
  summary: IntelligencePublishingOrchestrationSummary;
  diagnostics: readonly IntelligencePublishingOrchestrationDiagnostic[];
}>;

export type IntelligencePublishingOrchestrationValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type IntelligencePublishingOrchestrationValidationResult =
  | Readonly<{
      ok: true;
      result: IntelligencePublishingOrchestrationResult;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingOrchestrationValidationIssue[];
    }>;

export type IntelligencePublishingOrchestrationInput = Readonly<{
  mode: IntelligencePublishingBatchMode;
  createdAt: string;
  now: () => string;
  registrySnapshot?: unknown;
  getRegistrySnapshot?: () => unknown | Promise<unknown>;
  assetTypes?: ExecuteRegistrySnapshotBatchInput["assetTypes"];
  channel?: RegistryBatchRuntimeChannel;
  requestedAction?: IntelligencePublishingBatchAction;
  priority?: number;
  executeItem?: ExecuteRegistrySnapshotBatchInput["executeItem"];
  sourceSystem?: string;
  eventPriority?: PublicationEventPriority;
  eventVisibility?: PublicationEventVisibility;
  requestedBy?: string;
  reason?: string;
  gateConfig?: IntelligencePublishingExecutionGateConfig;
  metadata?: CoordinationJsonObject;
}>;

type BatchResultValidationResult =
  | Readonly<{
      ok: true;
      result: IntelligencePublishingBatchResult;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingOrchestrationValidationIssue[];
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
    code: IntelligencePublishingOrchestrationDiagnosticCode;
    severity: IntelligencePublishingOrchestrationDiagnosticSeverity;
    message: string;
    metadata?: CoordinationJsonObject;
  }>,
): IntelligencePublishingOrchestrationDiagnostic {
  return deepFreeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    metadata: freezeMetadata(input.metadata),
  });
}

async function loadRegistrySnapshot(
  input: IntelligencePublishingOrchestrationInput,
): Promise<RegistrySnapshot> {
  if (input.registrySnapshot != null && input.getRegistrySnapshot != null) {
    throw new Error(
      "Provide either registrySnapshot or getRegistrySnapshot, but not both.",
    );
  }
  if (input.registrySnapshot == null && input.getRegistrySnapshot == null) {
    throw new Error(
      "An orchestration run requires a registrySnapshot or getRegistrySnapshot source.",
    );
  }
  const raw =
    input.registrySnapshot ??
    (await input.getRegistrySnapshot!());
  return normalizeRegistrySnapshot(parseRegistrySnapshot(raw));
}

function validateBatchResult(
  plan: IntelligencePublishingBatchPlan,
  result: unknown,
): BatchResultValidationResult {
  const issues: IntelligencePublishingOrchestrationValidationIssue[] = [];

  if (!isPlainObject(result)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "batchResult",
          message: "batchResult must be a plain object.",
        },
      ]),
    };
  }

  const itemResults = Array.isArray(result.itemResults) ? result.itemResults : null;
  const summary = isPlainObject(result.summary) ? result.summary : null;

  if (result.schemaVersion !== INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION) {
    issues.push({
      path: "batchResult.schemaVersion",
      message: "Unsupported batchResult.schemaVersion.",
    });
  }
  if (result.plannerVersion !== INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION) {
    issues.push({
      path: "batchResult.plannerVersion",
      message: "Unsupported batchResult.plannerVersion.",
    });
  }
  if (!isNonEmptyString(result.planFingerprint)) {
    issues.push({
      path: "batchResult.planFingerprint",
      message: "batchResult.planFingerprint must be a non-empty string.",
    });
  } else if (result.planFingerprint !== plan.planFingerprint) {
    issues.push({
      path: "batchResult.planFingerprint",
      message: "batchResult.planFingerprint must match batchPlan.planFingerprint.",
    });
  }
  if (!isNonEmptyString(result.resultFingerprint)) {
    issues.push({
      path: "batchResult.resultFingerprint",
      message: "batchResult.resultFingerprint must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(result.createdAt) || !isCanonicalIsoTimestamp(result.createdAt)) {
    issues.push({
      path: "batchResult.createdAt",
      message: "batchResult.createdAt must be a canonical ISO timestamp.",
    });
  }
  if (result.mode !== plan.mode) {
    issues.push({
      path: "batchResult.mode",
      message: "batchResult.mode must match batchPlan.mode.",
    });
  }
  if (itemResults == null) {
    issues.push({
      path: "batchResult.itemResults",
      message: "batchResult.itemResults must be an array.",
    });
  } else if (itemResults.length !== plan.itemCount) {
    issues.push({
      path: "batchResult.itemResults",
      message: "batchResult.itemResults length must match batchPlan.itemCount.",
    });
  }
  if (summary == null) {
    issues.push({
      path: "batchResult.summary",
      message: "batchResult.summary must be a plain object.",
    });
  } else {
    if (!isFiniteNumber(summary.totalItems) || summary.totalItems !== plan.itemCount) {
      issues.push({
        path: "batchResult.summary.totalItems",
        message: "batchResult.summary.totalItems must match batchPlan.itemCount.",
      });
    }
    if (!isFiniteNumber(summary.executableItems)) {
      issues.push({
        path: "batchResult.summary.executableItems",
        message: "batchResult.summary.executableItems must be a finite number.",
      });
    }
    if (!isFiniteNumber(summary.succeededItems)) {
      issues.push({
        path: "batchResult.summary.succeededItems",
        message: "batchResult.summary.succeededItems must be a finite number.",
      });
    }
    if (!isFiniteNumber(summary.failedItems)) {
      issues.push({
        path: "batchResult.summary.failedItems",
        message: "batchResult.summary.failedItems must be a finite number.",
      });
    }
    if (!isFiniteNumber(summary.blockedItems)) {
      issues.push({
        path: "batchResult.summary.blockedItems",
        message: "batchResult.summary.blockedItems must be a finite number.",
      });
    }
    if (!isFiniteNumber(summary.skippedItems)) {
      issues.push({
        path: "batchResult.summary.skippedItems",
        message: "batchResult.summary.skippedItems must be a finite number.",
      });
    }
    if (!isFiniteNumber(summary.dryRunItems)) {
      issues.push({
        path: "batchResult.summary.dryRunItems",
        message: "batchResult.summary.dryRunItems must be a finite number.",
      });
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  return {
    ok: true,
    result: result as IntelligencePublishingBatchResult,
  };
}

function buildSummary(
  input: Readonly<{
    snapshot: RegistrySnapshot;
    gateDecision: IntelligencePublishingExecutionGateDecision;
    channel: RegistryBatchRuntimeChannel | null;
    plan: IntelligencePublishingBatchPlan | null;
    result: IntelligencePublishingBatchResult | null;
    candidateCount: number;
  }>,
): IntelligencePublishingOrchestrationSummary {
  const executableItemCount =
    input.plan == null
      ? null
      : input.plan.items.filter((item) => item.executable).length;
  return deepFreeze({
    gateDecision: input.gateDecision.decision,
    batchStatus: input.result?.status ?? null,
    channel: input.channel,
    registryAssetCount: input.snapshot.assets.length,
    candidateCount: input.candidateCount,
    itemCount: input.plan?.itemCount ?? null,
    executableItemCount,
    duplicateCount: input.plan?.duplicateCount ?? null,
    succeededItems: input.result?.summary.succeededItems ?? 0,
    failedItems: input.result?.summary.failedItems ?? 0,
    blockedItems: input.result?.summary.blockedItems ?? 0,
    skippedItems: input.result?.summary.skippedItems ?? 0,
    dryRunItems: input.result?.summary.dryRunItems ?? 0,
    durationMs: input.result?.summary.durationMs ?? null,
  });
}

export function validateIntelligencePublishingOrchestrationResult(
  input: unknown,
): IntelligencePublishingOrchestrationValidationResult {
  const issues: IntelligencePublishingOrchestrationValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "result",
          message: "Expected a plain orchestration result object.",
        },
      ]),
    };
  }

  if (
    input.schemaVersion !== INTELLIGENCE_PUBLISHING_ORCHESTRATION_SCHEMA_VERSION
  ) {
    issues.push({
      path: "schemaVersion",
      message: "Unsupported orchestration schemaVersion.",
    });
  }
  if (input.orchestratorVersion !== INTELLIGENCE_PUBLISHING_ORCHESTRATOR_VERSION) {
    issues.push({
      path: "orchestratorVersion",
      message: "Unsupported orchestratorVersion.",
    });
  }
  if (
    !isNonEmptyString(input.mode) ||
    !INTELLIGENCE_PUBLISHING_BATCH_MODES.includes(
      input.mode as IntelligencePublishingBatchMode,
    )
  ) {
    issues.push({
      path: "mode",
      message: "mode must be dry_run or execute.",
    });
  }
  if (!isNonEmptyString(input.registryFingerprint)) {
    issues.push({
      path: "registryFingerprint",
      message: "registryFingerprint must be a non-empty string.",
    });
  }
  if (input.planFingerprint !== null && !isNonEmptyString(input.planFingerprint)) {
    issues.push({
      path: "planFingerprint",
      message: "planFingerprint must be null or a non-empty string.",
    });
  }
  if (input.resultFingerprint !== null && !isNonEmptyString(input.resultFingerprint)) {
    issues.push({
      path: "resultFingerprint",
      message: "resultFingerprint must be null or a non-empty string.",
    });
  }
  if (!isNonEmptyString(input.createdAt) || !isCanonicalIsoTimestamp(input.createdAt)) {
    issues.push({
      path: "createdAt",
      message: "createdAt must be a canonical ISO timestamp.",
    });
  }
  if (!isPlainObject(input.gateDecision)) {
    issues.push({
      path: "gateDecision",
      message: "gateDecision must be a plain object.",
    });
  }
  if (input.batchPlan !== null && !isPlainObject(input.batchPlan)) {
    issues.push({
      path: "batchPlan",
      message: "batchPlan must be null or a plain object.",
    });
  }
  if (input.batchResult !== null && !isPlainObject(input.batchResult)) {
    issues.push({
      path: "batchResult",
      message: "batchResult must be null or a plain object.",
    });
  }
  if (!isPlainObject(input.summary)) {
    issues.push({
      path: "summary",
      message: "summary must be a plain object.",
    });
  }
  if (!Array.isArray(input.diagnostics)) {
    issues.push({
      path: "diagnostics",
      message: "diagnostics must be an array.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const gateValidation = validateIntelligencePublishingExecutionGateDecision(
    input.gateDecision,
  );
  if (!gateValidation.ok) {
    issues.push(
      ...gateValidation.issues.map((issue) => ({
        path: `gateDecision.${issue.path}`,
        message: issue.message,
      })),
    );
  }

  let validatedPlan: IntelligencePublishingBatchPlan | null = null;
  if (input.batchPlan != null) {
    const planValidation = validateIntelligencePublishingBatchPlan(input.batchPlan);
    if (!planValidation.ok) {
      issues.push(
        ...planValidation.issues.map((issue) => ({
          path: `batchPlan.${issue.path}`,
          message: issue.message,
        })),
      );
    } else {
      validatedPlan = planValidation.plan;
    }
  }

  if (input.batchResult != null) {
    if (validatedPlan == null) {
      issues.push({
        path: "batchResult",
        message: "batchResult requires a validated batchPlan.",
      });
    } else {
      const resultValidation = validateBatchResult(validatedPlan, input.batchResult);
      if (!resultValidation.ok) {
        issues.push(...resultValidation.issues);
      }
    }
  } else if (validatedPlan != null) {
    issues.push({
      path: "batchResult",
      message: "batchResult must be present when batchPlan is present.",
    });
  }

  const batchPlanObject = isPlainObject(input.batchPlan)
    ? (input.batchPlan as Partial<IntelligencePublishingBatchPlan>)
    : null;
  const batchResultObject = isPlainObject(input.batchResult)
    ? (input.batchResult as Partial<IntelligencePublishingBatchResult>)
    : null;

  if (
    isNonEmptyString(input.planFingerprint) &&
    batchPlanObject != null &&
    input.planFingerprint !== batchPlanObject.planFingerprint
  ) {
    issues.push({
      path: "planFingerprint",
      message: "planFingerprint must match batchPlan.planFingerprint.",
    });
  }
  if (
    isNonEmptyString(input.resultFingerprint) &&
    batchResultObject != null &&
    input.resultFingerprint !== batchResultObject.resultFingerprint
  ) {
    issues.push({
      path: "resultFingerprint",
      message: "resultFingerprint must match batchResult.resultFingerprint.",
    });
  }
  if (input.planFingerprint === null && input.batchPlan != null) {
    issues.push({
      path: "planFingerprint",
      message: "planFingerprint cannot be null when batchPlan is present.",
    });
  }
  if (input.resultFingerprint === null && input.batchResult != null) {
    issues.push({
      path: "resultFingerprint",
      message: "resultFingerprint cannot be null when batchResult is present.",
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
    result: input as IntelligencePublishingOrchestrationResult,
  };
}

export async function orchestrateIntelligencePublishing(
  input: IntelligencePublishingOrchestrationInput,
): Promise<IntelligencePublishingOrchestrationResult> {
  if (!isCanonicalIsoTimestamp(input.createdAt)) {
    throw new Error("createdAt must be a canonical ISO timestamp.");
  }

  const snapshot = await loadRegistrySnapshot(input);
  assertRegistrySnapshotPublicSafe(snapshot);
  const registryFingerprint = buildRegistrySnapshotFingerprint(snapshot);
  const candidatePreview = buildRegistryBatchCandidatesFromSnapshot({
    registrySnapshot: snapshot,
    assetTypes: input.assetTypes,
    channel: input.channel,
    requestedAction: input.requestedAction,
    priority: input.priority,
  });
  const gateDecision = evaluateIntelligencePublishingExecutionGate({
    mode: input.mode,
    evaluatedAt: input.createdAt,
    candidates: candidatePreview.candidates,
    config: input.gateConfig,
    metadata: input.metadata,
  });
  const gateValidation = validateIntelligencePublishingExecutionGateDecision(
    gateDecision,
  );
  if (!gateValidation.ok) {
    throw new Error(
      `Invalid execution gate decision: ${gateValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }
  const diagnostics: IntelligencePublishingOrchestrationDiagnostic[] = [
    buildDiagnostic({
      code: "snapshot_loaded",
      severity: "info",
      message: "Registry snapshot loaded for orchestration.",
      metadata: {
        snapshotId: snapshot.snapshotId,
        snapshotVersion: snapshot.snapshotVersion,
        assetCount: snapshot.assets.length,
      },
    }),
    buildDiagnostic({
      code: "privacy_validated",
      severity: "info",
      message: "Registry snapshot passed the public-safe privacy boundary.",
      metadata: {
        registryFingerprint,
      },
    }),
    buildDiagnostic({
      code: "gate_evaluated",
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
  ];

  if (snapshot.assets.length === 0) {
    diagnostics.push(
      buildDiagnostic({
        code: "registry_empty",
        severity: "warning",
        message: "Registry snapshot is empty; the batch plan will contain no items.",
        metadata: {
          registryFingerprint,
        },
      }),
    );
  }

  if (gateDecision.decision !== "allowed") {
    diagnostics.push(
      buildDiagnostic({
        code:
          gateDecision.decision === "blocked"
            ? "gate_blocked"
            : "gate_approval_required",
        severity: gateDecision.decision === "blocked" ? "error" : "warning",
        message:
          gateDecision.decision === "blocked"
            ? "Orchestration stopped before batch execution because the execution gate blocked the run."
            : "Orchestration stopped before batch execution because the execution gate requires approval.",
        metadata: {
          fingerprint: gateDecision.fingerprint,
          reasonCodes: gateDecision.reasonCodes,
        },
      }),
    );

    const blockedResult = deepFreeze({
      schemaVersion: INTELLIGENCE_PUBLISHING_ORCHESTRATION_SCHEMA_VERSION,
      orchestratorVersion: INTELLIGENCE_PUBLISHING_ORCHESTRATOR_VERSION,
      mode: input.mode,
      registryFingerprint,
      planFingerprint: null,
      resultFingerprint: null,
      createdAt: input.createdAt,
      gateDecision,
      batchPlan: null,
      batchResult: null,
      summary: buildSummary({
        snapshot,
        gateDecision,
        channel: candidatePreview.channel,
        plan: null,
        result: null,
        candidateCount: candidatePreview.candidates.length,
      }),
      diagnostics: Object.freeze(diagnostics),
    });

    const validation = validateIntelligencePublishingOrchestrationResult(
      blockedResult,
    );
    if (!validation.ok) {
      throw new Error(
        `Invalid orchestration result: ${validation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join(" | ")}`,
      );
    }
    return blockedResult;
  }

  const batchExecution = await executeRegistrySnapshotBatch({
    registrySnapshot: snapshot,
    mode: input.mode,
    createdAt: input.createdAt,
    now: input.now,
    assetTypes: input.assetTypes,
    channel: input.channel,
    requestedAction: input.requestedAction,
    priority: input.priority,
    executeItem: input.executeItem,
    sourceSystem: input.sourceSystem,
    eventPriority: input.eventPriority,
    eventVisibility: input.eventVisibility,
    requestedBy: input.requestedBy,
    reason: input.reason,
    metadata: input.metadata,
  });

  if (batchExecution.snapshotFingerprint !== registryFingerprint) {
    throw new Error(
      "Registry fingerprint mismatch between the orchestrator and the batch runtime adapter.",
    );
  }

  const planValidation = validateIntelligencePublishingBatchPlan(batchExecution.plan);
  if (!planValidation.ok) {
    throw new Error(
      `Invalid batch plan: ${planValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }
  diagnostics.push(
    buildDiagnostic({
      code: "batch_plan_validated",
      severity: "info",
      message: "Batch plan validated successfully.",
      metadata: {
        planFingerprint: batchExecution.plan.planFingerprint,
        candidateCount: batchExecution.plan.candidateCount,
        itemCount: batchExecution.plan.itemCount,
        duplicateCount: batchExecution.plan.duplicateCount,
      },
    }),
  );

  const resultValidation = validateBatchResult(
    batchExecution.plan,
    batchExecution.result,
  );
  if (!resultValidation.ok) {
    throw new Error(
      `Invalid batch result: ${resultValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }
  diagnostics.push(
    buildDiagnostic({
      code: "batch_result_validated",
      severity: "info",
      message: "Batch result validated successfully.",
      metadata: {
        resultFingerprint: batchExecution.result.resultFingerprint,
        status: batchExecution.result.status,
      },
    }),
  );
  diagnostics.push(
    buildDiagnostic({
      code: "fingerprint_verified",
      severity: "info",
      message: "Registry, plan and result fingerprints are internally coherent.",
      metadata: {
        registryFingerprint,
        planFingerprint: batchExecution.plan.planFingerprint,
        resultFingerprint: batchExecution.result.resultFingerprint,
      },
      }),
  );

  const summary = buildSummary({
    snapshot,
    gateDecision,
    channel: batchExecution.channel,
    plan: batchExecution.plan,
    result: batchExecution.result,
    candidateCount: batchExecution.plan.candidateCount,
  });

  diagnostics.push(
    buildDiagnostic({
      code: "orchestration_completed",
      severity:
        batchExecution.result.status === "completed_with_failures" ||
        batchExecution.result.status === "blocked"
          ? "warning"
          : "info",
      message: `Orchestration completed in mode ${input.mode} with batch status ${batchExecution.result.status}.`,
      metadata: {
        registryFingerprint,
        planFingerprint: batchExecution.plan.planFingerprint,
        resultFingerprint: batchExecution.result.resultFingerprint,
        candidateCount: summary.candidateCount,
        itemCount: summary.itemCount,
        executableItemCount: summary.executableItemCount,
      },
    }),
  );

  const orchestrationResult = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_ORCHESTRATION_SCHEMA_VERSION,
    orchestratorVersion: INTELLIGENCE_PUBLISHING_ORCHESTRATOR_VERSION,
    mode: input.mode,
    registryFingerprint,
    planFingerprint: batchExecution.plan.planFingerprint,
    resultFingerprint: batchExecution.result.resultFingerprint,
    createdAt: input.createdAt,
    gateDecision,
    batchPlan: batchExecution.plan,
    batchResult: batchExecution.result,
    summary,
    diagnostics: Object.freeze(diagnostics),
  });

  const validation = validateIntelligencePublishingOrchestrationResult(
    orchestrationResult,
  );
  if (!validation.ok) {
    throw new Error(
      `Invalid orchestration result: ${validation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }

  return orchestrationResult;
}

export function buildIntelligencePublishingOrchestrationFingerprint(
  result: IntelligencePublishingOrchestrationResult,
): string {
  const validation = validateIntelligencePublishingOrchestrationResult(result);
  if (!validation.ok) {
    throw new Error(
      `Cannot fingerprint an invalid orchestration result: ${validation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }
  return buildStableHash("ipp_orchestration_", {
    schemaVersion: result.schemaVersion,
    orchestratorVersion: result.orchestratorVersion,
      mode: result.mode,
      registryFingerprint: result.registryFingerprint,
      gateDecision: result.gateDecision,
      planFingerprint: result.planFingerprint,
      resultFingerprint: result.resultFingerprint,
      summary: result.summary,
    diagnostics: result.diagnostics,
  });
}
