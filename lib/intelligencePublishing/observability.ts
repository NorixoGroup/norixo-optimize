import { createHash } from "node:crypto";

import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";
import {
  validateExecutionPlan,
  type ExecutionPlan,
} from "./executionEngine";
import {
  validateWebPublicationBatch,
  type WebPublicationBatch,
} from "./webPublisher";

export const EXECUTION_JOURNAL_STATUSES = Object.freeze([
  "planned",
  "in_progress",
  "completed",
  "failed",
  "rolled_back",
] as const);

export type ExecutionJournalStatus =
  (typeof EXECUTION_JOURNAL_STATUSES)[number];

export const EXECUTION_JOURNAL_PHASES = Object.freeze([
  "planning",
  "publication_batching",
  "governance",
  "rollback",
  "summary",
] as const);

export type ExecutionJournalPhase =
  (typeof EXECUTION_JOURNAL_PHASES)[number];

export const EXECUTION_ENTRY_SEVERITIES = Object.freeze([
  "info",
  "warning",
  "error",
  "critical",
] as const);

export type ExecutionEntrySeverity =
  (typeof EXECUTION_ENTRY_SEVERITIES)[number];

export const EXECUTION_EVENT_TYPES = Object.freeze([
  "plan_created",
  "job_planned",
  "command_planned",
  "review_required",
  "suppression_required",
  "rollback_prepared",
  "execution_completed",
] as const);

export type ExecutionEventType = (typeof EXECUTION_EVENT_TYPES)[number];

export const ROLLBACK_ACTION_TYPES = Object.freeze([
  "restore_publication_state",
  "restore_variant",
  "restore_version",
  "restore_metadata",
  "restore_freshness",
] as const);

export type RollbackActionType = (typeof ROLLBACK_ACTION_TYPES)[number];

export const EXECUTION_DIAGNOSTIC_SEVERITIES = Object.freeze([
  "info",
  "warning",
  "error",
  "critical",
] as const);

export type ExecutionDiagnosticSeverity =
  (typeof EXECUTION_DIAGNOSTIC_SEVERITIES)[number];

export const EXECUTION_DIAGNOSTIC_CATEGORIES = Object.freeze([
  "governance",
  "publication",
  "rollback",
  "freshness",
  "policy",
  "consistency",
  "cost",
] as const);

export type ExecutionDiagnosticCategory =
  (typeof EXECUTION_DIAGNOSTIC_CATEGORIES)[number];

export type ExecutionJournalEntry = Readonly<{
  entryId: string;
  timestamp: string;
  phase: ExecutionJournalPhase;
  entityType: string;
  entityId: string;
  action: string;
  severity: ExecutionEntrySeverity;
  message: string;
  structuredData: CoordinationJsonObject;
  metadata: CoordinationJsonObject;
}>;

export type ExecutionDiagnosticEntity = Readonly<{
  entityType: string;
  entityId: string;
}>;

export type ExecutionDiagnostic = Readonly<{
  code: string;
  severity: ExecutionDiagnosticSeverity;
  category: ExecutionDiagnosticCategory;
  entity: ExecutionDiagnosticEntity;
  recommendation: string;
  metadata: CoordinationJsonObject;
}>;

export type ExecutionJournal = Readonly<{
  journalId: string;
  executionPlanId: string;
  runId: string;
  eventId: string;
  registrySnapshotFingerprint: string;
  startedAt: string;
  finishedAt: string | null;
  status: ExecutionJournalStatus;
  entries: readonly ExecutionJournalEntry[];
  diagnostics: readonly ExecutionDiagnostic[];
  metadata: CoordinationJsonObject;
}>;

export type ExecutionEvent = Readonly<{
  eventType: ExecutionEventType;
  occurredAt: string;
  executionPlanId: string;
  runId: string;
  jobId: string | null;
  payload: CoordinationJsonObject;
  metadata: CoordinationJsonObject;
}>;

export type RollbackAction = Readonly<{
  actionId: string;
  type: RollbackActionType;
  entityType: string;
  entityId: string;
  reason: string;
  restoreFrom: CoordinationJsonObject;
  metadata: CoordinationJsonObject;
}>;

export type RollbackPlan = Readonly<{
  rollbackPlanId: string;
  executionPlanId: string;
  rollbackActions: readonly RollbackAction[];
  rollbackFingerprint: string;
  createdAt: string;
  metadata: CoordinationJsonObject;
}>;

export type ExecutionSummary = Readonly<{
  jobsPlanned: number;
  publicationCommands: number;
  suppressions: number;
  reviews: number;
  estimatedCost: number;
  deterministicFingerprint: string;
  executionPlanId: string;
  rollbackPlanId: string | null;
  metadata: CoordinationJsonObject;
}>;

export type ExecutionJournalValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type ExecutionJournalValidationResult =
  | Readonly<{
      ok: true;
      journal: ExecutionJournal;
    }>
  | Readonly<{
      ok: false;
      issues: readonly ExecutionJournalValidationIssue[];
    }>;

export type RollbackPlanValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type RollbackPlanValidationResult =
  | Readonly<{
      ok: true;
      rollbackPlan: RollbackPlan;
    }>
  | Readonly<{
      ok: false;
      issues: readonly RollbackPlanValidationIssue[];
    }>;

export type ExecutionSummaryValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type ExecutionSummaryValidationResult =
  | Readonly<{
      ok: true;
      summary: ExecutionSummary;
    }>
  | Readonly<{
      ok: false;
      issues: readonly ExecutionSummaryValidationIssue[];
    }>;

export type ExecutionEventValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type ExecutionEventValidationResult =
  | Readonly<{
      ok: true;
      executionEvent: ExecutionEvent;
    }>
  | Readonly<{
      ok: false;
      issues: readonly ExecutionEventValidationIssue[];
    }>;

export type ExecutionJournalEntryInput = Readonly<{
  entryId?: string;
  timestamp: string;
  phase: ExecutionJournalPhase;
  entityType: string;
  entityId: string;
  action: string;
  severity: ExecutionEntrySeverity;
  message: string;
  structuredData?: CoordinationJsonObject;
  metadata?: CoordinationJsonObject;
}>;

export type BuildExecutionJournalInput = Readonly<{
  executionPlan: ExecutionPlan;
  startedAt?: string;
  finishedAt?: string | null;
  status: ExecutionJournalStatus;
  entries?: readonly (ExecutionJournalEntry | ExecutionJournalEntryInput)[];
  diagnostics?: readonly ExecutionDiagnostic[];
  metadata?: CoordinationJsonObject;
}>;

export type BuildExecutionDiagnosticsInput = Readonly<{
  executionPlan: ExecutionPlan;
  publicationBatch?: WebPublicationBatch | null;
  rollbackPlan?: RollbackPlan | null;
  metadata?: CoordinationJsonObject;
}>;

export type BuildRollbackPlanInput = Readonly<{
  executionPlan: ExecutionPlan;
  publicationBatch?: WebPublicationBatch | null;
  createdAt?: string;
  metadata?: CoordinationJsonObject;
}>;

export type BuildExecutionSummaryInput = Readonly<{
  executionPlan: ExecutionPlan;
  publicationBatch?: WebPublicationBatch | null;
  rollbackPlan?: RollbackPlan | null;
  diagnostics?: readonly ExecutionDiagnostic[];
  metadata?: CoordinationJsonObject;
}>;

const ENTRY_SEVERITY_ORDER: Readonly<Record<ExecutionEntrySeverity, number>> =
  Object.freeze({
    info: 0,
    warning: 1,
    error: 2,
    critical: 3,
  });

const DIAGNOSTIC_SEVERITY_ORDER: Readonly<
  Record<ExecutionDiagnosticSeverity, number>
> = Object.freeze({
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
});

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

function normalizeJsonValue(value: CoordinationJsonValue): CoordinationJsonValue {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => normalizeJsonValue(entry)));
  }

  if (value != null && typeof value === "object") {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value)
          .sort((left, right) => compareStrings(left[0], right[0]))
          .map(([key, entry]) => [key, normalizeJsonValue(entry)]),
      ),
    );
  }

  return value;
}

function normalizeJsonObject(
  metadata: CoordinationJsonObject | undefined,
): CoordinationJsonObject {
  const candidate = metadata ?? {};
  if (!isJsonSafe(candidate)) {
    throw new Error("Expected a JSON-safe object.");
  }
  return normalizeJsonValue(candidate) as CoordinationJsonObject;
}

function stableStringify(value: unknown): string {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort(compareStrings)
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }

  throw new Error("Expected a JSON-safe value.");
}

function buildStableHash(prefix: string, value: unknown): string {
  return `${prefix}${createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")}`;
}

function ensureValidExecutionPlan(executionPlan: ExecutionPlan): ExecutionPlan {
  const validation = validateExecutionPlan(executionPlan);
  if (!validation.ok) {
    throw new Error(
      `Invalid ExecutionPlan: ${validation.issues
        .map((issue) => `${issue.path}:${issue.message}`)
        .join(", ")}`,
    );
  }

  return validation.executionPlan;
}

function ensureValidPublicationBatch(
  publicationBatch: WebPublicationBatch | null | undefined,
): WebPublicationBatch | null {
  if (publicationBatch == null) {
    return null;
  }

  const validation = validateWebPublicationBatch(publicationBatch);
  if (!validation.ok) {
    throw new Error(
      `Invalid WebPublicationBatch: ${validation.issues
        .map((issue) => `${issue.path}:${issue.message}`)
        .join(", ")}`,
    );
  }

  return publicationBatch;
}

function sortJournalEntries(
  entries: readonly ExecutionJournalEntry[],
): readonly ExecutionJournalEntry[] {
  return Object.freeze(
    [...entries].sort((left, right) => {
      return (
        compareStrings(left.timestamp, right.timestamp) ||
        compareStrings(left.phase, right.phase) ||
        compareStrings(left.entityType, right.entityType) ||
        compareStrings(left.entityId, right.entityId) ||
        compareStrings(left.action, right.action) ||
        ENTRY_SEVERITY_ORDER[left.severity] -
          ENTRY_SEVERITY_ORDER[right.severity] ||
        compareStrings(left.message, right.message) ||
        compareStrings(left.entryId, right.entryId)
      );
    }),
  );
}

function sortDiagnostics(
  diagnostics: readonly ExecutionDiagnostic[],
): readonly ExecutionDiagnostic[] {
  return Object.freeze(
    [...diagnostics].sort((left, right) => {
      return (
        DIAGNOSTIC_SEVERITY_ORDER[left.severity] -
          DIAGNOSTIC_SEVERITY_ORDER[right.severity] ||
        compareStrings(left.category, right.category) ||
        compareStrings(left.code, right.code) ||
        compareStrings(left.entity.entityType, right.entity.entityType) ||
        compareStrings(left.entity.entityId, right.entity.entityId) ||
        compareStrings(left.recommendation, right.recommendation)
      );
    }),
  );
}

function sortRollbackActions(
  actions: readonly RollbackAction[],
): readonly RollbackAction[] {
  return Object.freeze(
    [...actions].sort((left, right) => {
      return (
        compareStrings(left.type, right.type) ||
        compareStrings(left.entityType, right.entityType) ||
        compareStrings(left.entityId, right.entityId) ||
        compareStrings(left.reason, right.reason) ||
        compareStrings(left.actionId, right.actionId)
      );
    }),
  );
}

function normalizeJournalEntry(
  input: ExecutionJournalEntry | ExecutionJournalEntryInput,
): ExecutionJournalEntry {
  const structuredData = normalizeJsonObject(input.structuredData);
  const metadata = normalizeJsonObject(input.metadata);
  const entryId =
    "entryId" in input && isNonEmptyString(input.entryId)
      ? input.entryId
      : buildStableHash("ipp_execution_journal_entry_", {
          timestamp: input.timestamp,
          phase: input.phase,
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          severity: input.severity,
          message: input.message,
          structuredData,
          metadata,
        });

  return Object.freeze({
    entryId,
    timestamp: input.timestamp,
    phase: input.phase,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    severity: input.severity,
    message: input.message,
    structuredData,
    metadata,
  });
}

function normalizeDiagnostic(
  diagnostic: ExecutionDiagnostic,
): ExecutionDiagnostic {
  return Object.freeze({
    code: diagnostic.code,
    severity: diagnostic.severity,
    category: diagnostic.category,
    entity: Object.freeze({
      entityType: diagnostic.entity.entityType,
      entityId: diagnostic.entity.entityId,
    }),
    recommendation: diagnostic.recommendation,
    metadata: normalizeJsonObject(diagnostic.metadata),
  });
}

function normalizeRollbackAction(action: RollbackAction): RollbackAction {
  return Object.freeze({
    actionId: action.actionId,
    type: action.type,
    entityType: action.entityType,
    entityId: action.entityId,
    reason: action.reason,
    restoreFrom: normalizeJsonObject(action.restoreFrom),
    metadata: normalizeJsonObject(action.metadata),
  });
}

function uniqueEntries(
  entries: readonly ExecutionJournalEntry[],
): readonly ExecutionJournalEntry[] {
  const seen = new Map<string, string>();
  const deduped: ExecutionJournalEntry[] = [];

  for (const entry of entries) {
    const canonical = stableStringify(entry);
    const existing = seen.get(entry.entryId);
    if (existing == null) {
      seen.set(entry.entryId, canonical);
      deduped.push(entry);
      continue;
    }
    if (existing !== canonical) {
      throw new Error(
        `Journal entry ${entry.entryId} was produced multiple times with conflicting content.`,
      );
    }
  }

  return sortJournalEntries(deduped);
}

function uniqueDiagnostics(
  diagnostics: readonly ExecutionDiagnostic[],
): readonly ExecutionDiagnostic[] {
  const seen = new Set<string>();
  const deduped: ExecutionDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const fingerprint = stableStringify(diagnostic);
    if (seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);
    deduped.push(diagnostic);
  }

  return sortDiagnostics(deduped);
}

function uniqueRollbackActions(
  actions: readonly RollbackAction[],
): readonly RollbackAction[] {
  const seen = new Map<string, string>();
  const deduped: RollbackAction[] = [];

  for (const action of actions) {
    const canonical = stableStringify(action);
    const existing = seen.get(action.actionId);
    if (existing == null) {
      seen.set(action.actionId, canonical);
      deduped.push(action);
      continue;
    }
    if (existing !== canonical) {
      throw new Error(
        `Rollback action ${action.actionId} was produced multiple times with conflicting content.`,
      );
    }
  }

  return sortRollbackActions(deduped);
}

function buildJournalId(executionPlan: ExecutionPlan): string {
  return buildStableHash("ipp_execution_journal_", {
    executionPlanId: executionPlan.executionPlanId,
    runId: executionPlan.orchestrationRun.runId,
    eventId: executionPlan.event.eventId,
    registrySnapshotFingerprint: executionPlan.registrySnapshotFingerprint,
  });
}

function finalizeExecutionJournal(candidate: ExecutionJournal): ExecutionJournal {
  const validation = validateExecutionJournal(candidate);
  if (!validation.ok) {
    throw new Error(
      `Invalid ExecutionJournal: ${validation.issues
        .map((issue) => `${issue.path}:${issue.message}`)
        .join(", ")}`,
    );
  }

  return validation.journal;
}

function buildExecutionEventPayloadHash(event: ExecutionEvent): string {
  return buildStableHash("ipp_execution_event_", event);
}

function buildRollbackActionId(
  action: Omit<RollbackAction, "actionId">,
): string {
  return buildStableHash("ipp_execution_rollback_action_", action);
}

function buildRollbackFingerprint(
  executionPlan: ExecutionPlan,
  rollbackActions: readonly RollbackAction[],
): string {
  return buildStableHash("ipp_execution_rollback_fp_", {
    executionPlanId: executionPlan.executionPlanId,
    rollbackActions,
  });
}

export function validateExecutionEvent(
  input: unknown,
): ExecutionEventValidationResult {
  const issues: ExecutionEventValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected an ExecutionEvent object.",
        }),
      ]),
    };
  }

  const candidate = input as Partial<ExecutionEvent>;
  if (!EXECUTION_EVENT_TYPES.includes(candidate.eventType as ExecutionEventType)) {
    issues.push({
      path: "eventType",
      message: "Expected a supported execution event type.",
    });
  }
  if (
    !isNonEmptyString(candidate.occurredAt) ||
    !isCanonicalIsoTimestamp(candidate.occurredAt)
  ) {
    issues.push({
      path: "occurredAt",
      message: "occurredAt must be a canonical ISO timestamp.",
    });
  }
  if (!isNonEmptyString(candidate.executionPlanId)) {
    issues.push({
      path: "executionPlanId",
      message: "Expected a non-empty executionPlanId.",
    });
  }
  if (!isNonEmptyString(candidate.runId)) {
    issues.push({
      path: "runId",
      message: "Expected a non-empty runId.",
    });
  }
  if (
    candidate.jobId !== null &&
    candidate.jobId !== undefined &&
    !isNonEmptyString(candidate.jobId)
  ) {
    issues.push({
      path: "jobId",
      message: "jobId must be null or a non-empty string.",
    });
  }
  if (!isJsonSafe(candidate.payload ?? {})) {
    issues.push({
      path: "payload",
      message: "payload must be JSON-safe.",
    });
  }
  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
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
    executionEvent: Object.freeze({
      eventType: candidate.eventType as ExecutionEventType,
      occurredAt: candidate.occurredAt!,
      executionPlanId: candidate.executionPlanId!,
      runId: candidate.runId!,
      jobId: candidate.jobId ?? null,
      payload: normalizeJsonObject(candidate.payload as CoordinationJsonObject),
      metadata: normalizeJsonObject(candidate.metadata as CoordinationJsonObject),
    }),
  };
}

export function validateExecutionJournal(
  input: unknown,
): ExecutionJournalValidationResult {
  const issues: ExecutionJournalValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected an ExecutionJournal object.",
        }),
      ]),
    };
  }

  const candidate = input as Partial<ExecutionJournal>;
  for (const field of [
    "journalId",
    "executionPlanId",
    "runId",
    "eventId",
    "registrySnapshotFingerprint",
    "startedAt",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected a non-empty string.",
      });
    }
  }

  if (
    !isNonEmptyString(candidate.startedAt) ||
    !isCanonicalIsoTimestamp(candidate.startedAt)
  ) {
    issues.push({
      path: "startedAt",
      message: "startedAt must be a canonical ISO timestamp.",
    });
  }
  if (
    candidate.finishedAt !== null &&
    candidate.finishedAt !== undefined &&
    (!isNonEmptyString(candidate.finishedAt) ||
      !isCanonicalIsoTimestamp(candidate.finishedAt))
  ) {
    issues.push({
      path: "finishedAt",
      message: "finishedAt must be null or a canonical ISO timestamp.",
    });
  }
  if (
    !EXECUTION_JOURNAL_STATUSES.includes(
      candidate.status as ExecutionJournalStatus,
    )
  ) {
    issues.push({
      path: "status",
      message: "Expected a supported journal status.",
    });
  }
  if (!Array.isArray(candidate.entries)) {
    issues.push({
      path: "entries",
      message: "Expected an entries array.",
    });
  }
  if (!Array.isArray(candidate.diagnostics)) {
    issues.push({
      path: "diagnostics",
      message: "Expected a diagnostics array.",
    });
  }
  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
    });
  }

  if (Array.isArray(candidate.entries)) {
    candidate.entries.forEach((entry, index) => {
      if (typeof entry !== "object" || entry == null || Array.isArray(entry)) {
        issues.push({
          path: `entries.${index}`,
          message: "Expected an ExecutionJournalEntry object.",
        });
        return;
      }

      const typed = entry as Partial<ExecutionJournalEntry>;
      for (const field of [
        "entryId",
        "timestamp",
        "entityType",
        "entityId",
        "action",
        "message",
      ] as const) {
        if (!isNonEmptyString(typed[field])) {
          issues.push({
            path: `entries.${index}.${field}`,
            message: "Expected a non-empty string.",
          });
        }
      }
      if (
        !isNonEmptyString(typed.timestamp) ||
        !isCanonicalIsoTimestamp(typed.timestamp)
      ) {
        issues.push({
          path: `entries.${index}.timestamp`,
          message: "timestamp must be a canonical ISO timestamp.",
        });
      }
      if (
        !EXECUTION_JOURNAL_PHASES.includes(
          typed.phase as ExecutionJournalPhase,
        )
      ) {
        issues.push({
          path: `entries.${index}.phase`,
          message: "Expected a supported journal phase.",
        });
      }
      if (
        !EXECUTION_ENTRY_SEVERITIES.includes(
          typed.severity as ExecutionEntrySeverity,
        )
      ) {
        issues.push({
          path: `entries.${index}.severity`,
          message: "Expected a supported entry severity.",
        });
      }
      if (!isJsonSafe(typed.structuredData ?? {})) {
        issues.push({
          path: `entries.${index}.structuredData`,
          message: "structuredData must be JSON-safe.",
        });
      }
      if (!isJsonSafe(typed.metadata ?? {})) {
        issues.push({
          path: `entries.${index}.metadata`,
          message: "metadata must be JSON-safe.",
        });
      }
    });
  }

  if (Array.isArray(candidate.diagnostics)) {
    candidate.diagnostics.forEach((diagnostic, index) => {
      if (
        typeof diagnostic !== "object" ||
        diagnostic == null ||
        Array.isArray(diagnostic)
      ) {
        issues.push({
          path: `diagnostics.${index}`,
          message: "Expected an ExecutionDiagnostic object.",
        });
        return;
      }

      const typed = diagnostic as Partial<ExecutionDiagnostic>;
      if (!isNonEmptyString(typed.code)) {
        issues.push({
          path: `diagnostics.${index}.code`,
          message: "Expected a non-empty code.",
        });
      }
      if (
        !EXECUTION_DIAGNOSTIC_SEVERITIES.includes(
          typed.severity as ExecutionDiagnosticSeverity,
        )
      ) {
        issues.push({
          path: `diagnostics.${index}.severity`,
          message: "Expected a supported diagnostic severity.",
        });
      }
      if (
        !EXECUTION_DIAGNOSTIC_CATEGORIES.includes(
          typed.category as ExecutionDiagnosticCategory,
        )
      ) {
        issues.push({
          path: `diagnostics.${index}.category`,
          message: "Expected a supported diagnostic category.",
        });
      }
      if (!isNonEmptyString(typed.recommendation)) {
        issues.push({
          path: `diagnostics.${index}.recommendation`,
          message: "Expected a non-empty recommendation.",
        });
      }
      if (
        typeof typed.entity !== "object" ||
        typed.entity == null ||
        Array.isArray(typed.entity)
      ) {
        issues.push({
          path: `diagnostics.${index}.entity`,
          message: "Expected an entity object.",
        });
      } else {
        if (!isNonEmptyString(typed.entity.entityType)) {
          issues.push({
            path: `diagnostics.${index}.entity.entityType`,
            message: "Expected a non-empty entityType.",
          });
        }
        if (!isNonEmptyString(typed.entity.entityId)) {
          issues.push({
            path: `diagnostics.${index}.entity.entityId`,
            message: "Expected a non-empty entityId.",
          });
        }
      }
      if (!isJsonSafe(typed.metadata ?? {})) {
        issues.push({
          path: `diagnostics.${index}.metadata`,
          message: "metadata must be JSON-safe.",
        });
      }
    });
  }

  if (
    isNonEmptyString(candidate.startedAt) &&
    candidate.finishedAt != null &&
    isNonEmptyString(candidate.finishedAt) &&
    isCanonicalIsoTimestamp(candidate.startedAt) &&
    isCanonicalIsoTimestamp(candidate.finishedAt) &&
    candidate.finishedAt < candidate.startedAt
  ) {
    issues.push({
      path: "finishedAt",
      message: "finishedAt cannot be earlier than startedAt.",
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
    journal: Object.freeze({
      journalId: candidate.journalId!,
      executionPlanId: candidate.executionPlanId!,
      runId: candidate.runId!,
      eventId: candidate.eventId!,
      registrySnapshotFingerprint: candidate.registrySnapshotFingerprint!,
      startedAt: candidate.startedAt!,
      finishedAt: candidate.finishedAt ?? null,
      status: candidate.status as ExecutionJournalStatus,
      entries: sortJournalEntries(
        (candidate.entries as readonly ExecutionJournalEntry[]).map((entry) =>
          normalizeJournalEntry(entry),
        ),
      ),
      diagnostics: sortDiagnostics(
        (candidate.diagnostics as readonly ExecutionDiagnostic[]).map(
          (diagnostic) => normalizeDiagnostic(diagnostic),
        ),
      ),
      metadata: normalizeJsonObject(candidate.metadata as CoordinationJsonObject),
    }),
  };
}

export function validateRollbackPlan(
  input: unknown,
): RollbackPlanValidationResult {
  const issues: RollbackPlanValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a RollbackPlan object.",
        }),
      ]),
    };
  }

  const candidate = input as Partial<RollbackPlan>;
  for (const field of [
    "rollbackPlanId",
    "executionPlanId",
    "rollbackFingerprint",
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
    !isNonEmptyString(candidate.createdAt) ||
    !isCanonicalIsoTimestamp(candidate.createdAt)
  ) {
    issues.push({
      path: "createdAt",
      message: "createdAt must be a canonical ISO timestamp.",
    });
  }
  if (!Array.isArray(candidate.rollbackActions)) {
    issues.push({
      path: "rollbackActions",
      message: "Expected a rollbackActions array.",
    });
  }
  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
    });
  }

  if (Array.isArray(candidate.rollbackActions)) {
    candidate.rollbackActions.forEach((action, index) => {
      if (typeof action !== "object" || action == null || Array.isArray(action)) {
        issues.push({
          path: `rollbackActions.${index}`,
          message: "Expected a RollbackAction object.",
        });
        return;
      }

      const typed = action as Partial<RollbackAction>;
      for (const field of [
        "actionId",
        "entityType",
        "entityId",
        "reason",
      ] as const) {
        if (!isNonEmptyString(typed[field])) {
          issues.push({
            path: `rollbackActions.${index}.${field}`,
            message: "Expected a non-empty string.",
          });
        }
      }
      if (!ROLLBACK_ACTION_TYPES.includes(typed.type as RollbackActionType)) {
        issues.push({
          path: `rollbackActions.${index}.type`,
          message: "Expected a supported rollback action type.",
        });
      }
      if (!isJsonSafe(typed.restoreFrom ?? {})) {
        issues.push({
          path: `rollbackActions.${index}.restoreFrom`,
          message: "restoreFrom must be JSON-safe.",
        });
      }
      if (!isJsonSafe(typed.metadata ?? {})) {
        issues.push({
          path: `rollbackActions.${index}.metadata`,
          message: "metadata must be JSON-safe.",
        });
      }
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
    rollbackPlan: Object.freeze({
      rollbackPlanId: candidate.rollbackPlanId!,
      executionPlanId: candidate.executionPlanId!,
      rollbackActions: sortRollbackActions(
        (candidate.rollbackActions as readonly RollbackAction[]).map((action) =>
          normalizeRollbackAction(action),
        ),
      ),
      rollbackFingerprint: candidate.rollbackFingerprint!,
      createdAt: candidate.createdAt!,
      metadata: normalizeJsonObject(candidate.metadata as CoordinationJsonObject),
    }),
  };
}

export function validateExecutionSummary(
  input: unknown,
): ExecutionSummaryValidationResult {
  const issues: ExecutionSummaryValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected an ExecutionSummary object.",
        }),
      ]),
    };
  }

  const candidate = input as Partial<ExecutionSummary>;
  for (const field of [
    "executionPlanId",
    "deterministicFingerprint",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected a non-empty string.",
      });
    }
  }
  if (
    candidate.rollbackPlanId !== null &&
    candidate.rollbackPlanId !== undefined &&
    !isNonEmptyString(candidate.rollbackPlanId)
  ) {
    issues.push({
      path: "rollbackPlanId",
      message: "rollbackPlanId must be null or a non-empty string.",
    });
  }
  for (const field of [
    "jobsPlanned",
    "publicationCommands",
    "suppressions",
    "reviews",
    "estimatedCost",
  ] as const) {
    const value = candidate[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      issues.push({
        path: field,
        message: "Expected a finite number >= 0.",
      });
    }
  }
  if (!isJsonSafe(candidate.metadata ?? {})) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
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
    summary: Object.freeze({
      jobsPlanned: candidate.jobsPlanned!,
      publicationCommands: candidate.publicationCommands!,
      suppressions: candidate.suppressions!,
      reviews: candidate.reviews!,
      estimatedCost: candidate.estimatedCost!,
      deterministicFingerprint: candidate.deterministicFingerprint!,
      executionPlanId: candidate.executionPlanId!,
      rollbackPlanId: candidate.rollbackPlanId ?? null,
      metadata: normalizeJsonObject(candidate.metadata as CoordinationJsonObject),
    }),
  };
}

export function buildExecutionJournal(
  input: BuildExecutionJournalInput,
): ExecutionJournal {
  const executionPlan = ensureValidExecutionPlan(input.executionPlan);
  const startedAt = input.startedAt ?? executionPlan.createdAt;
  if (!isCanonicalIsoTimestamp(startedAt)) {
    throw new Error(`Expected a canonical ISO timestamp, received ${startedAt}.`);
  }
  if (
    input.finishedAt != null &&
    !isCanonicalIsoTimestamp(input.finishedAt)
  ) {
    throw new Error(
      `Expected a canonical ISO timestamp, received ${input.finishedAt}.`,
    );
  }

  const entries = uniqueEntries(
    (input.entries ?? []).map((entry) => normalizeJournalEntry(entry)),
  );
  const diagnostics = uniqueDiagnostics(
    (input.diagnostics ?? []).map((diagnostic) =>
      normalizeDiagnostic(diagnostic),
    ),
  );

  const journal = {
    journalId: buildJournalId(executionPlan),
    executionPlanId: executionPlan.executionPlanId,
    runId: executionPlan.orchestrationRun.runId,
    eventId: executionPlan.event.eventId,
    registrySnapshotFingerprint: executionPlan.registrySnapshotFingerprint,
    startedAt,
    finishedAt: input.finishedAt ?? null,
    status: input.status,
    entries,
    diagnostics,
    metadata: normalizeJsonObject({
      executionPlanVersion: executionPlan.executionPlanVersion,
      runEpoch: executionPlan.orchestrationRun.runEpoch,
      orchestrationAttempt: executionPlan.orchestrationRun.attempt,
      ...normalizeJsonObject(input.metadata),
    }),
  } satisfies ExecutionJournal;

  return finalizeExecutionJournal(journal);
}

export function appendJournalEntry(
  journal: ExecutionJournal,
  entry: ExecutionJournalEntry | ExecutionJournalEntryInput,
): ExecutionJournal {
  const normalizedJournal = validateExecutionJournal(journal);
  if (!normalizedJournal.ok) {
    throw new Error(
      `Invalid ExecutionJournal: ${normalizedJournal.issues
        .map((issue) => `${issue.path}:${issue.message}`)
        .join(", ")}`,
    );
  }

  const normalizedEntry = normalizeJournalEntry(entry);
  return finalizeExecutionJournal({
    ...normalizedJournal.journal,
    entries: Object.freeze([
      ...normalizedJournal.journal.entries,
      normalizedEntry,
    ]),
  });
}

export function buildExecutionDiagnostics(
  input: BuildExecutionDiagnosticsInput,
): readonly ExecutionDiagnostic[] {
  const executionPlan = ensureValidExecutionPlan(input.executionPlan);
  const publicationBatch = ensureValidPublicationBatch(input.publicationBatch);
  const rollbackPlan =
    input.rollbackPlan == null
      ? null
      : validateRollbackPlan(input.rollbackPlan);
  if (rollbackPlan != null && !rollbackPlan.ok) {
    throw new Error(
      `Invalid RollbackPlan: ${rollbackPlan.issues
        .map((issue) => `${issue.path}:${issue.message}`)
        .join(", ")}`,
    );
  }

  const diagnostics: ExecutionDiagnostic[] = [];
  const entity = Object.freeze({
    entityType: "execution_plan",
    entityId: executionPlan.executionPlanId,
  });

  if (executionPlan.governanceSummary.requiresHumanReview) {
    diagnostics.push(
      Object.freeze({
        code: "review_required",
        severity: "warning",
        category: "governance",
        entity,
        recommendation:
          "Complete human review before allowing publication side effects.",
        metadata: normalizeJsonObject({
          reviewJobIds: executionPlan.governanceSummary.reviewJobIds,
          reasons: executionPlan.governanceSummary.reasons,
        }),
      }),
    );
  }

  if (executionPlan.governanceSummary.requiresImmediateSuppression) {
    diagnostics.push(
      Object.freeze({
        code: "suppression_required",
        severity: "critical",
        category: "publication",
        entity,
        recommendation:
          "Prepare suppression before any new publication is considered.",
        metadata: normalizeJsonObject({
          suppressionJobIds: executionPlan.governanceSummary.suppressionJobIds,
          reasons: executionPlan.governanceSummary.reasons,
        }),
      }),
    );
  }

  if (publicationBatch?.requiresReviewCompletion) {
    diagnostics.push(
      Object.freeze({
        code: "batch_blocked_until_review",
        severity: "warning",
        category: "publication",
        entity,
        recommendation:
          "Keep the publication batch pending until governance review is complete.",
        metadata: normalizeJsonObject({
          batchId: publicationBatch.batchId,
          commandIds: publicationBatch.commandIds,
        }),
      }),
    );
  }

  if (publicationBatch?.containsImmediateSuppression) {
    diagnostics.push(
      Object.freeze({
        code: "batch_contains_suppression",
        severity: "critical",
        category: "publication",
        entity,
        recommendation:
          "Ensure suppression commands are ordered before non-suppression writes.",
        metadata: normalizeJsonObject({
          batchId: publicationBatch.batchId,
          suppressionCommands: publicationBatch.commands
            .filter((command) => command.action === "suppress")
            .map((command) => command.commandId),
        }),
      }),
    );
  }

  if (rollbackPlan != null && rollbackPlan.ok && rollbackPlan.rollbackPlan.rollbackActions.length > 0) {
    diagnostics.push(
      Object.freeze({
        code: "rollback_prepared",
        severity: "info",
        category: "rollback",
        entity,
        recommendation:
          "Retain the declarative rollback plan alongside the execution summary for deterministic recovery.",
        metadata: normalizeJsonObject({
          rollbackPlanId: rollbackPlan.rollbackPlan.rollbackPlanId,
          rollbackActionCount:
            rollbackPlan.rollbackPlan.rollbackActions.length,
        }),
      }),
    );
  }

  if (executionPlan.estimatedCost > 0) {
    diagnostics.push(
      Object.freeze({
        code: "estimated_cost_recorded",
        severity: "info",
        category: "cost",
        entity,
        recommendation:
          "Track estimated cost in summaries so plan replay stays explainable.",
        metadata: normalizeJsonObject({
          estimatedCost: executionPlan.estimatedCost,
          ...(input.metadata ?? {}),
        }),
      }),
    );
  }

  return uniqueDiagnostics(diagnostics);
}

export function buildRollbackPlan(input: BuildRollbackPlanInput): RollbackPlan {
  const executionPlan = ensureValidExecutionPlan(input.executionPlan);
  const publicationBatch = ensureValidPublicationBatch(input.publicationBatch);
  const createdAt = input.createdAt ?? executionPlan.createdAt;
  if (!isCanonicalIsoTimestamp(createdAt)) {
    throw new Error(`Expected a canonical ISO timestamp, received ${createdAt}.`);
  }

  const rollbackActions: RollbackAction[] = [];

  for (const command of publicationBatch?.commands ?? []) {
    const baseMetadata = normalizeJsonObject({
      commandId: command.commandId,
      destinationId: command.destination.destinationId,
      action: command.action,
      locale: command.destination.locale,
      channel: command.destination.channel,
    });

    if (
      command.action === "publish" ||
      command.action === "republish" ||
      command.action === "suppress" ||
      command.action === "rollback"
    ) {
      const publicationStateAction = {
        type: "restore_publication_state" as const,
        entityType: "publication",
        entityId: command.destination.destinationId,
        reason: `Restore publication state after planned ${command.action}.`,
        restoreFrom: normalizeJsonObject({
          previousPublicationState: command.previousPublicationState,
          expectedCurrentPublicationFingerprint:
            command.expectedCurrentPublicationFingerprint,
        }),
        metadata: baseMetadata,
      };
      rollbackActions.push(
        Object.freeze({
          actionId: buildRollbackActionId(publicationStateAction),
          ...publicationStateAction,
        }),
      );

      const versionAction = {
        type: "restore_version" as const,
        entityType: "asset_version",
        entityId: command.assetVersionId,
        reason: `Restore active version expectations after ${command.action}.`,
        restoreFrom: normalizeJsonObject({
          previousPublicationAssetVersionId:
            command.previousPublicationState?.assetVersionId ?? null,
          targetPublicationFingerprint: command.targetPublicationFingerprint,
        }),
        metadata: baseMetadata,
      };
      rollbackActions.push(
        Object.freeze({
          actionId: buildRollbackActionId(versionAction),
          ...versionAction,
        }),
      );

      if (command.contentDescriptor != null) {
        const variantAction = {
          type: "restore_variant" as const,
          entityType: "channel_variant",
          entityId: `${command.assetId}:${command.destination.locale}:${command.destination.channel}`,
          reason: `Restore rendered variant expectations after ${command.action}.`,
          restoreFrom: normalizeJsonObject({
            contentFingerprint: command.contentDescriptor.contentFingerprint,
            sourceFingerprint: command.contentDescriptor.sourceFingerprint,
            rendererFingerprint: command.contentDescriptor.rendererFingerprint,
          }),
          metadata: baseMetadata,
        };
        rollbackActions.push(
          Object.freeze({
            actionId: buildRollbackActionId(variantAction),
            ...variantAction,
          }),
        );
      }
    }

    if (command.action === "update_metadata") {
      const metadataAction = {
        type: "restore_metadata" as const,
        entityType: "publication",
        entityId: command.destination.destinationId,
        reason: "Restore metadata after a metadata-only publication change.",
        restoreFrom: normalizeJsonObject({
          previousPublicationState: command.previousPublicationState,
          nextPublicationState: command.nextPublicationState,
        }),
        metadata: baseMetadata,
      };
      rollbackActions.push(
        Object.freeze({
          actionId: buildRollbackActionId(metadataAction),
          ...metadataAction,
        }),
      );
    }

    if (command.action === "update_freshness") {
      const freshnessAction = {
        type: "restore_freshness" as const,
        entityType: "asset_version",
        entityId: command.assetVersionId,
        reason: "Restore freshness state after a freshness-only publication change.",
        restoreFrom: normalizeJsonObject({
          previousPublicationState: command.previousPublicationState,
          nextPublicationState: command.nextPublicationState,
        }),
        metadata: baseMetadata,
      };
      rollbackActions.push(
        Object.freeze({
          actionId: buildRollbackActionId(freshnessAction),
          ...freshnessAction,
        }),
      );
    }
  }

  const normalizedActions = uniqueRollbackActions(rollbackActions);
  const rollbackFingerprint = buildRollbackFingerprint(
    executionPlan,
    normalizedActions,
  );
  const rollbackPlan = {
    rollbackPlanId: buildStableHash("ipp_execution_rollback_plan_", {
      executionPlanId: executionPlan.executionPlanId,
      rollbackFingerprint,
    }),
    executionPlanId: executionPlan.executionPlanId,
    rollbackActions: normalizedActions,
    rollbackFingerprint,
    createdAt,
    metadata: normalizeJsonObject({
      runId: executionPlan.orchestrationRun.runId,
      eventId: executionPlan.event.eventId,
      ...(input.metadata ?? {}),
    }),
  } satisfies RollbackPlan;

  const validation = validateRollbackPlan(rollbackPlan);
  if (!validation.ok) {
    throw new Error(
      `Invalid RollbackPlan: ${validation.issues
        .map((issue) => `${issue.path}:${issue.message}`)
        .join(", ")}`,
    );
  }

  return validation.rollbackPlan;
}

export function buildExecutionSummary(
  input: BuildExecutionSummaryInput,
): ExecutionSummary {
  const executionPlan = ensureValidExecutionPlan(input.executionPlan);
  const publicationBatch = ensureValidPublicationBatch(input.publicationBatch);
  const rollbackPlan =
    input.rollbackPlan == null ? null : validateRollbackPlan(input.rollbackPlan);
  if (rollbackPlan != null && !rollbackPlan.ok) {
    throw new Error(
      `Invalid RollbackPlan: ${rollbackPlan.issues
        .map((issue) => `${issue.path}:${issue.message}`)
        .join(", ")}`,
    );
  }

  const diagnostics = uniqueDiagnostics(
    (input.diagnostics ?? []).map((diagnostic) =>
      normalizeDiagnostic(diagnostic),
    ),
  );
  const summary = {
    jobsPlanned: executionPlan.jobs.length,
    publicationCommands: publicationBatch?.commands.length ?? 0,
    suppressions:
      publicationBatch?.commands.filter((command) => command.action === "suppress")
        .length ?? executionPlan.governanceSummary.suppressionJobIds.length,
    reviews: executionPlan.governanceSummary.reviewJobIds.length,
    estimatedCost: executionPlan.estimatedCost,
    deterministicFingerprint: buildStableHash("ipp_execution_summary_", {
      executionPlanId: executionPlan.executionPlanId,
      publicationBatchId: publicationBatch?.batchId ?? null,
      rollbackPlanId: rollbackPlan?.ok ? rollbackPlan.rollbackPlan.rollbackPlanId : null,
      diagnostics: diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        category: diagnostic.category,
        severity: diagnostic.severity,
        entityType: diagnostic.entity.entityType,
        entityId: diagnostic.entity.entityId,
      })),
    }),
    executionPlanId: executionPlan.executionPlanId,
    rollbackPlanId: rollbackPlan?.ok
      ? rollbackPlan.rollbackPlan.rollbackPlanId
      : null,
    metadata: normalizeJsonObject({
      runId: executionPlan.orchestrationRun.runId,
      eventType: executionPlan.event.eventType,
      diagnosticsCount: diagnostics.length,
      ...(input.metadata ?? {}),
    }),
  } satisfies ExecutionSummary;

  const validation = validateExecutionSummary(summary);
  if (!validation.ok) {
    throw new Error(
      `Invalid ExecutionSummary: ${validation.issues
        .map((issue) => `${issue.path}:${issue.message}`)
        .join(", ")}`,
    );
  }

  return validation.summary;
}

export function buildExecutionEventsFromJournal(
  journal: ExecutionJournal,
): readonly ExecutionEvent[] {
  const validation = validateExecutionJournal(journal);
  if (!validation.ok) {
    throw new Error(
      `Invalid ExecutionJournal: ${validation.issues
        .map((issue) => `${issue.path}:${issue.message}`)
        .join(", ")}`,
    );
  }

  const events = validation.journal.entries.map((entry) => {
    const eventType: ExecutionEventType =
      entry.action === "plan_created"
        ? "plan_created"
        : entry.action === "job_planned"
          ? "job_planned"
          : entry.action === "command_planned"
            ? "command_planned"
            : entry.action === "review_required"
              ? "review_required"
              : entry.action === "suppression_required"
                ? "suppression_required"
                : entry.action === "rollback_prepared"
                  ? "rollback_prepared"
                  : "execution_completed";

    const executionEvent: ExecutionEvent = Object.freeze({
      eventType,
      occurredAt: entry.timestamp,
      executionPlanId: validation.journal.executionPlanId,
      runId: validation.journal.runId,
      jobId:
        entry.entityType === "job" && isNonEmptyString(entry.entityId)
          ? entry.entityId
          : null,
      payload: normalizeJsonObject({
        phase: entry.phase,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        severity: entry.severity,
        message: entry.message,
        structuredData: entry.structuredData,
        entryFingerprint: buildExecutionEventPayloadHash(
          Object.freeze({
            eventType,
            occurredAt: entry.timestamp,
            executionPlanId: validation.journal.executionPlanId,
            runId: validation.journal.runId,
            jobId:
              entry.entityType === "job" && isNonEmptyString(entry.entityId)
                ? entry.entityId
                : null,
            payload: entry.structuredData,
            metadata: entry.metadata,
          }),
        ),
      }),
      metadata: normalizeJsonObject(entry.metadata),
    });

    const eventValidation = validateExecutionEvent(executionEvent);
    if (!eventValidation.ok) {
      throw new Error(
        `Invalid ExecutionEvent: ${eventValidation.issues
          .map((issue) => `${issue.path}:${issue.message}`)
          .join(", ")}`,
      );
    }

    return eventValidation.executionEvent;
  });

  return Object.freeze(events);
}
