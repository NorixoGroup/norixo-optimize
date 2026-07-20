import type { PublicationEventEnvelope, PublicationEventPriority } from "./eventContracts";
import type { ImpactAction, ImpactPlan } from "./impactResolver";

export const ORCHESTRATION_RUN_STATUSES = Object.freeze([
  "queued",
  "planning",
  "planned",
  "executing",
  "waiting_review",
  "publishing",
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
  "superseded",
  "abandoned",
] as const);

export type OrchestrationRunStatus =
  (typeof ORCHESTRATION_RUN_STATUSES)[number];

export const ORCHESTRATION_TERMINAL_RUN_STATUSES = Object.freeze([
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
  "superseded",
  "abandoned",
] as const);

export const ORCHESTRATION_ACTIVE_RUN_STATUSES = Object.freeze([
  "queued",
  "planning",
  "planned",
  "executing",
  "waiting_review",
  "publishing",
] as const);

export const ORCHESTRATION_STEPS = Object.freeze([
  "receive_event",
  "validate_event",
  "resolve_impact",
  "plan_actions",
  "governance_check",
  "prepare_execution",
  "execute_actions",
  "wait_for_review",
  "publish",
  "finalize",
  "done",
] as const);

export type OrchestrationStep = (typeof ORCHESTRATION_STEPS)[number];

export type OrchestrationRunMetadata = Readonly<Record<string, unknown>>;

export type OrchestrationRun = Readonly<{
  runId: string;
  eventId: string;
  eventIdempotencyKey: string;
  impactPlanId: string;
  status: OrchestrationRunStatus;
  currentStep: OrchestrationStep;
  priority: PublicationEventPriority;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastHeartbeatAt: string | null;
  runEpoch: number;
  attempt: number;
  allPlannedActions: readonly ImpactAction[];
  completedActions: readonly ImpactAction[];
  pendingActions: readonly ImpactAction[];
  failedActions: readonly ImpactAction[];
  skippedActions: readonly ImpactAction[];
  cancellationReason: string | null;
  failureReason: string | null;
  partialCompletionReason: string | null;
  supersededByRunId: string | null;
  abandonedReason: string | null;
  estimatedCost: number;
  actualCost: number;
  metadata: OrchestrationRunMetadata;
}>;

export type OrchestrationRunValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type OrchestrationRunValidationResult =
  | Readonly<{
      ok: true;
      run: OrchestrationRun;
    }>
  | Readonly<{
      ok: false;
      issues: readonly OrchestrationRunValidationIssue[];
    }>;

export type OrchestrationRunTransitionErrorCode =
  | "invalid_transition"
  | "terminal_run"
  | "invalid_action_transition"
  | "unknown_action"
  | "missing_reason"
  | "missing_superseding_run"
  | "invalid_timestamp";

export class OrchestrationRunTransitionError extends Error {
  readonly code: OrchestrationRunTransitionErrorCode;
  readonly fromStatus: OrchestrationRunStatus;
  readonly toStatus: OrchestrationRunStatus;
  readonly runId: string;

  constructor(input: Readonly<{
    code: OrchestrationRunTransitionErrorCode;
    fromStatus: OrchestrationRunStatus;
    toStatus: OrchestrationRunStatus;
    runId: string;
    message: string;
  }>) {
    super(input.message);
    this.name = "OrchestrationRunTransitionError";
    this.code = input.code;
    this.fromStatus = input.fromStatus;
    this.toStatus = input.toStatus;
    this.runId = input.runId;
  }
}

export type CreateOrchestrationRunInput = Readonly<{
  runId: string;
  event: PublicationEventEnvelope;
  eventIdempotencyKey: string;
  impactPlan: ImpactPlan;
  now: () => string;
  runEpoch?: number;
  attempt?: number;
  metadata?: OrchestrationRunMetadata;
}>;

export type TransitionOrchestrationRunInput = Readonly<{
  toStatus: OrchestrationRunStatus;
  toStep: OrchestrationStep;
  now: string;
  cancellationReason?: string;
  failureReason?: string;
  partialCompletionReason?: string;
  supersededByRunId?: string;
  abandonedReason?: string;
}>;

const RUN_STATUS_TO_ALLOWED_TRANSITIONS: Readonly<
  Record<OrchestrationRunStatus, readonly OrchestrationRunStatus[]>
> = Object.freeze({
  queued: Object.freeze([
    "queued",
    "planning",
    "failed",
    "cancelled",
    "superseded",
    "abandoned",
  ] as const),
  planning: Object.freeze([
    "planning",
    "planned",
    "failed",
    "cancelled",
    "superseded",
    "abandoned",
  ] as const),
  planned: Object.freeze([
    "planned",
    "executing",
    "failed",
    "cancelled",
    "superseded",
    "abandoned",
  ] as const),
  executing: Object.freeze([
    "executing",
    "waiting_review",
    "publishing",
    "completed",
    "partially_completed",
    "failed",
    "cancelled",
    "superseded",
    "abandoned",
  ] as const),
  waiting_review: Object.freeze([
    "waiting_review",
    "publishing",
    "failed",
    "cancelled",
    "superseded",
    "abandoned",
  ] as const),
  publishing: Object.freeze([
    "publishing",
    "completed",
    "partially_completed",
    "failed",
    "cancelled",
    "superseded",
    "abandoned",
  ] as const),
  completed: Object.freeze(["completed"] as const),
  partially_completed: Object.freeze(["partially_completed"] as const),
  failed: Object.freeze(["failed"] as const),
  cancelled: Object.freeze(["cancelled"] as const),
  superseded: Object.freeze(["superseded"] as const),
  abandoned: Object.freeze(["abandoned"] as const),
});

const ACTION_ORDER_INDEX: Readonly<Record<ImpactAction, number>> = Object.freeze({
  skip: 0,
  update_metadata: 1,
  update_freshness: 2,
  generate_asset_version: 3,
  regenerate_variant: 4,
  request_review: 5,
  publish: 6,
  republish: 7,
  suppress: 8,
  rollback: 9,
});

function compareActions(left: ImpactAction, right: ImpactAction): number {
  return ACTION_ORDER_INDEX[left] - ACTION_ORDER_INDEX[right];
}

function sortActions(values: readonly ImpactAction[]): readonly ImpactAction[] {
  return Object.freeze([...new Set(values)].sort(compareActions));
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString() === value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isImpactAction(value: unknown): value is ImpactAction {
  return typeof value === "string" && value in ACTION_ORDER_INDEX;
}

function isOrchestrationRunStatus(value: unknown): value is OrchestrationRunStatus {
  return (
    typeof value === "string" &&
    (ORCHESTRATION_RUN_STATUSES as readonly string[]).includes(value)
  );
}

function isOrchestrationStep(value: unknown): value is OrchestrationStep {
  return (
    typeof value === "string" &&
    (ORCHESTRATION_STEPS as readonly string[]).includes(value)
  );
}

function freezeMetadata(metadata: OrchestrationRunMetadata | undefined): OrchestrationRunMetadata {
  return Object.freeze({ ...(metadata ?? {}) });
}

function freezeRun(run: OrchestrationRun): OrchestrationRun {
  return Object.freeze({
    ...run,
    allPlannedActions: Object.freeze([...run.allPlannedActions]),
    completedActions: Object.freeze([...run.completedActions]),
    pendingActions: Object.freeze([...run.pendingActions]),
    failedActions: Object.freeze([...run.failedActions]),
    skippedActions: Object.freeze([...run.skippedActions]),
    metadata: freezeMetadata(run.metadata),
  });
}

function ensureValidTimestamp(
  timestamp: string,
  code: OrchestrationRunTransitionErrorCode,
  run: Pick<OrchestrationRun, "runId" | "status">,
  toStatus: OrchestrationRunStatus,
): void {
  if (!isCanonicalIsoTimestamp(timestamp)) {
    throw new OrchestrationRunTransitionError({
      code,
      fromStatus: run.status,
      toStatus,
      runId: run.runId,
      message: `Invalid canonical timestamp: ${timestamp}`,
    });
  }
}

function dedupeAndValidateActionBuckets(input: Readonly<{
  allPlannedActions: readonly ImpactAction[];
  completedActions: readonly ImpactAction[];
  pendingActions: readonly ImpactAction[];
  failedActions: readonly ImpactAction[];
  skippedActions: readonly ImpactAction[];
}>): Readonly<{
  allPlannedActions: readonly ImpactAction[];
  completedActions: readonly ImpactAction[];
  pendingActions: readonly ImpactAction[];
  failedActions: readonly ImpactAction[];
  skippedActions: readonly ImpactAction[];
}> {
  const allPlannedActions = sortActions(input.allPlannedActions);
  const allowed = new Set(allPlannedActions);

  const normalize = (values: readonly ImpactAction[]): readonly ImpactAction[] => {
    const sorted = sortActions(values);
    for (const action of sorted) {
      if (!allowed.has(action)) {
        throw new Error(`Unknown planned action bucket member: ${action}`);
      }
    }
    return sorted;
  };

  const completedActions = normalize(input.completedActions);
  const pendingActions = normalize(input.pendingActions);
  const failedActions = normalize(input.failedActions);
  const skippedActions = normalize(input.skippedActions);

  const membership = new Map<ImpactAction, string>();
  for (const [bucketName, actions] of [
    ["completedActions", completedActions],
    ["pendingActions", pendingActions],
    ["failedActions", failedActions],
    ["skippedActions", skippedActions],
  ] as const) {
    for (const action of actions) {
      const existing = membership.get(action);
      if (existing != null) {
        throw new Error(
          `Action ${action} cannot belong to both ${existing} and ${bucketName}.`,
        );
      }
      membership.set(action, bucketName);
    }
  }

  return Object.freeze({
    allPlannedActions,
    completedActions,
    pendingActions,
    failedActions,
    skippedActions,
  });
}

function buildUpdatedRun(
  run: OrchestrationRun,
  changes: Partial<OrchestrationRun>,
): OrchestrationRun {
  const candidate = {
    ...run,
    ...changes,
  } as OrchestrationRun;

  const buckets = dedupeAndValidateActionBuckets({
    allPlannedActions: candidate.allPlannedActions,
    completedActions: candidate.completedActions,
    pendingActions: candidate.pendingActions,
    failedActions: candidate.failedActions,
    skippedActions: candidate.skippedActions,
  });

  return freezeRun({
    ...candidate,
    allPlannedActions: buckets.allPlannedActions,
    completedActions: buckets.completedActions,
    pendingActions: buckets.pendingActions,
    failedActions: buckets.failedActions,
    skippedActions: buckets.skippedActions,
    metadata: freezeMetadata(candidate.metadata),
  });
}

function hasRunChanged(left: OrchestrationRun, right: OrchestrationRun): boolean {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function validateReasonPresence(
  reason: string | undefined,
  fieldName:
    | "cancellationReason"
    | "failureReason"
    | "partialCompletionReason"
    | "abandonedReason",
  run: OrchestrationRun,
  toStatus: OrchestrationRunStatus,
): string {
  if (!isNonEmptyString(reason)) {
    throw new OrchestrationRunTransitionError({
      code: "missing_reason",
      fromStatus: run.status,
      toStatus,
      runId: run.runId,
      message: `${fieldName} is required for status ${toStatus}.`,
    });
  }

  return reason.trim();
}

export function isTerminalRunStatus(
  status: OrchestrationRunStatus,
): boolean {
  return (
    ORCHESTRATION_TERMINAL_RUN_STATUSES as readonly string[]
  ).includes(status);
}

export function isActiveRunStatus(status: OrchestrationRunStatus): boolean {
  return (
    ORCHESTRATION_ACTIVE_RUN_STATUSES as readonly string[]
  ).includes(status);
}

export function canTransitionRun(
  from: OrchestrationRunStatus,
  to: OrchestrationRunStatus,
): boolean {
  return RUN_STATUS_TO_ALLOWED_TRANSITIONS[from].includes(to);
}

export function createOrchestrationRun(
  input: CreateOrchestrationRunInput,
): OrchestrationRun {
  const now = input.now();
  if (!isCanonicalIsoTimestamp(now)) {
    throw new Error(`Invalid canonical timestamp for createOrchestrationRun: ${now}`);
  }
  if (!isNonEmptyString(input.runId)) {
    throw new Error("runId must be a non-empty string.");
  }
  const runEpoch = input.runEpoch ?? 1;
  const attempt = input.attempt ?? 1;
  if (!Number.isInteger(runEpoch) || runEpoch < 1) {
    throw new Error("runEpoch must be an integer >= 1.");
  }
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error("attempt must be an integer >= 1.");
  }

  const allPlannedActions = sortActions([
    ...input.impactPlan.requiredActions,
    ...input.impactPlan.skippedActions,
  ]);

  return buildUpdatedRun(
    {
      runId: input.runId.trim(),
      eventId: input.event.eventId,
      eventIdempotencyKey: input.eventIdempotencyKey,
      impactPlanId: input.impactPlan.planId,
      status: "queued",
      currentStep: "receive_event",
      priority: input.impactPlan.priority,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
      runEpoch,
      attempt,
      allPlannedActions,
      completedActions: Object.freeze([]),
      pendingActions: sortActions(input.impactPlan.requiredActions),
      failedActions: Object.freeze([]),
      skippedActions: sortActions(input.impactPlan.skippedActions),
      cancellationReason: null,
      failureReason: null,
      partialCompletionReason: null,
      supersededByRunId: null,
      abandonedReason: null,
      estimatedCost: input.impactPlan.estimatedCost,
      actualCost: 0,
      metadata: freezeMetadata(input.metadata),
    },
    {},
  );
}

export function transitionOrchestrationRun(
  run: OrchestrationRun,
  input: TransitionOrchestrationRunInput,
): OrchestrationRun {
  ensureValidTimestamp(input.now, "invalid_timestamp", run, input.toStatus);

  const sameStatus = run.status === input.toStatus;
  const sameStep = run.currentStep === input.toStep;

  if (sameStatus && sameStep) {
    return run;
  }

  if (isTerminalRunStatus(run.status)) {
    throw new OrchestrationRunTransitionError({
      code: "terminal_run",
      fromStatus: run.status,
      toStatus: input.toStatus,
      runId: run.runId,
      message: `Cannot transition terminal run ${run.runId} from ${run.status} to ${input.toStatus}.`,
    });
  }

  if (!canTransitionRun(run.status, input.toStatus)) {
    throw new OrchestrationRunTransitionError({
      code: "invalid_transition",
      fromStatus: run.status,
      toStatus: input.toStatus,
      runId: run.runId,
      message: `Invalid run transition from ${run.status} to ${input.toStatus}.`,
    });
  }

  let cancellationReason = run.cancellationReason;
  let failureReason = run.failureReason;
  let partialCompletionReason = run.partialCompletionReason;
  let supersededByRunId = run.supersededByRunId;
  let abandonedReason = run.abandonedReason;

  if (input.toStatus === "cancelled") {
    cancellationReason = validateReasonPresence(
      input.cancellationReason,
      "cancellationReason",
      run,
      input.toStatus,
    );
  }

  if (input.toStatus === "failed") {
    failureReason = validateReasonPresence(
      input.failureReason,
      "failureReason",
      run,
      input.toStatus,
    );
  }

  if (input.toStatus === "partially_completed") {
    partialCompletionReason = validateReasonPresence(
      input.partialCompletionReason,
      "partialCompletionReason",
      run,
      input.toStatus,
    );
  }

  if (input.toStatus === "abandoned") {
    abandonedReason = validateReasonPresence(
      input.abandonedReason,
      "abandonedReason",
      run,
      input.toStatus,
    );
  }

  if (input.toStatus === "superseded") {
    if (!isNonEmptyString(input.supersededByRunId)) {
      throw new OrchestrationRunTransitionError({
        code: "missing_superseding_run",
        fromStatus: run.status,
        toStatus: input.toStatus,
        runId: run.runId,
        message: "supersededByRunId is required for superseded runs.",
      });
    }
    supersededByRunId = input.supersededByRunId.trim();
  }

  const nextStartedAt =
    run.startedAt == null && input.toStatus === "planning"
      ? input.now
      : run.startedAt;
  const nextFinishedAt = isTerminalRunStatus(input.toStatus)
    ? input.now
    : null;

  return buildUpdatedRun(run, {
    status: input.toStatus,
    currentStep: input.toStep,
    updatedAt: input.now,
    startedAt: nextStartedAt,
    finishedAt: nextFinishedAt,
    cancellationReason,
    failureReason,
    partialCompletionReason,
    supersededByRunId,
    abandonedReason,
  });
}

export function startOrchestrationRun(
  run: OrchestrationRun,
  now: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "planning",
    toStep: "validate_event",
    now,
  });
}

export function moveRunToPlanning(
  run: OrchestrationRun,
  now: string,
): OrchestrationRun {
  return startOrchestrationRun(run, now);
}

export function markRunPlanned(
  run: OrchestrationRun,
  now: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "planned",
    toStep: "prepare_execution",
    now,
  });
}

export function startRunExecution(
  run: OrchestrationRun,
  now: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "executing",
    toStep: "execute_actions",
    now,
  });
}

export function waitForRunReview(
  run: OrchestrationRun,
  now: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "waiting_review",
    toStep: "wait_for_review",
    now,
  });
}

export function resumeRunAfterReview(
  run: OrchestrationRun,
  now: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "publishing",
    toStep: "publish",
    now,
  });
}

export function startRunPublishing(
  run: OrchestrationRun,
  now: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "publishing",
    toStep: "publish",
    now,
  });
}

export function completeOrchestrationRun(
  run: OrchestrationRun,
  now: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "completed",
    toStep: "done",
    now,
  });
}

export function partiallyCompleteOrchestrationRun(
  run: OrchestrationRun,
  now: string,
  reason: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "partially_completed",
    toStep: "done",
    now,
    partialCompletionReason: reason,
  });
}

export function failOrchestrationRun(
  run: OrchestrationRun,
  now: string,
  reason: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "failed",
    toStep: "done",
    now,
    failureReason: reason,
  });
}

export function cancelOrchestrationRun(
  run: OrchestrationRun,
  now: string,
  reason: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "cancelled",
    toStep: "done",
    now,
    cancellationReason: reason,
  });
}

export function supersedeOrchestrationRun(
  run: OrchestrationRun,
  now: string,
  supersededByRunId: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "superseded",
    toStep: "done",
    now,
    supersededByRunId,
  });
}

export function abandonOrchestrationRun(
  run: OrchestrationRun,
  now: string,
  reason: string,
): OrchestrationRun {
  return transitionOrchestrationRun(run, {
    toStatus: "abandoned",
    toStep: "done",
    now,
    abandonedReason: reason,
  });
}

export function heartbeatOrchestrationRun(
  run: OrchestrationRun,
  now: string,
): OrchestrationRun {
  ensureValidTimestamp(now, "invalid_timestamp", run, run.status);
  if (run.lastHeartbeatAt === now) {
    return run;
  }
  if (!isActiveRunStatus(run.status)) {
    throw new OrchestrationRunTransitionError({
      code: "terminal_run",
      fromStatus: run.status,
      toStatus: run.status,
      runId: run.runId,
      message: `Cannot heartbeat a terminal run ${run.runId}.`,
    });
  }
  return buildUpdatedRun(run, {
    updatedAt: now,
    lastHeartbeatAt: now,
  });
}

function ensureKnownPlannedAction(run: OrchestrationRun, action: ImpactAction): void {
  if (!run.allPlannedActions.includes(action)) {
    throw new OrchestrationRunTransitionError({
      code: "unknown_action",
      fromStatus: run.status,
      toStatus: run.status,
      runId: run.runId,
      message: `Unknown planned action ${action} for run ${run.runId}.`,
    });
  }
}

function updateActionState(
  run: OrchestrationRun,
  action: ImpactAction,
  now: string,
  mode: "completed" | "failed" | "skipped" | "pending",
): OrchestrationRun {
  ensureValidTimestamp(now, "invalid_timestamp", run, run.status);
  ensureKnownPlannedAction(run, action);

  const nextCompleted = new Set(run.completedActions);
  const nextPending = new Set(run.pendingActions);
  const nextFailed = new Set(run.failedActions);
  const nextSkipped = new Set(run.skippedActions);

  const alreadyInTarget =
    (mode === "completed" && nextCompleted.has(action)) ||
    (mode === "failed" && nextFailed.has(action)) ||
    (mode === "skipped" && nextSkipped.has(action)) ||
    (mode === "pending" && nextPending.has(action));

  if (alreadyInTarget) {
    return run;
  }

  nextCompleted.delete(action);
  nextPending.delete(action);
  nextFailed.delete(action);
  nextSkipped.delete(action);

  switch (mode) {
    case "completed":
      nextCompleted.add(action);
      break;
    case "failed":
      nextFailed.add(action);
      break;
    case "skipped":
      nextSkipped.add(action);
      break;
    case "pending":
      nextPending.add(action);
      break;
  }

  return buildUpdatedRun(run, {
    updatedAt: now,
    completedActions: sortActions([...nextCompleted]),
    pendingActions: sortActions([...nextPending]),
    failedActions: sortActions([...nextFailed]),
    skippedActions: sortActions([...nextSkipped]),
  });
}

export function markActionCompleted(
  run: OrchestrationRun,
  action: ImpactAction,
  now: string,
): OrchestrationRun {
  return updateActionState(run, action, now, "completed");
}

export function markActionFailed(
  run: OrchestrationRun,
  action: ImpactAction,
  now: string,
  _reason?: string,
): OrchestrationRun {
  return updateActionState(run, action, now, "failed");
}

export function markActionSkipped(
  run: OrchestrationRun,
  action: ImpactAction,
  now: string,
): OrchestrationRun {
  return updateActionState(run, action, now, "skipped");
}

export function resetActionToPending(
  run: OrchestrationRun,
  action: ImpactAction,
  now: string,
): OrchestrationRun {
  return updateActionState(run, action, now, "pending");
}

export function validateOrchestrationRun(
  input: unknown,
): OrchestrationRunValidationResult {
  const issues: OrchestrationRunValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected an orchestration run object.",
        }),
      ]),
    };
  }

  const candidate = input as Record<string, unknown>;

  const runId = candidate.runId;
  if (!isNonEmptyString(runId)) {
    issues.push({ path: "runId", message: "Expected a non-empty string." });
  }

  const eventId = candidate.eventId;
  if (!isNonEmptyString(eventId)) {
    issues.push({ path: "eventId", message: "Expected a non-empty string." });
  }

  const impactPlanId = candidate.impactPlanId;
  if (!isNonEmptyString(impactPlanId)) {
    issues.push({
      path: "impactPlanId",
      message: "Expected a non-empty string.",
    });
  }

  const status = candidate.status;
  if (!isOrchestrationRunStatus(status)) {
    issues.push({
      path: "status",
      message: `Expected one of: ${ORCHESTRATION_RUN_STATUSES.join(", ")}.`,
    });
  }

  const currentStep = candidate.currentStep;
  if (!isOrchestrationStep(currentStep)) {
    issues.push({
      path: "currentStep",
      message: `Expected one of: ${ORCHESTRATION_STEPS.join(", ")}.`,
    });
  }

  for (const field of [
    "createdAt",
    "updatedAt",
  ] as const) {
    const value = candidate[field];
    if (!isNonEmptyString(value) || !isCanonicalIsoTimestamp(value)) {
      issues.push({
        path: field,
        message: "Expected a canonical ISO timestamp.",
      });
    }
  }

  for (const field of [
    "startedAt",
    "finishedAt",
    "lastHeartbeatAt",
  ] as const) {
    const value = candidate[field];
    if (
      value != null &&
      (!isNonEmptyString(value) || !isCanonicalIsoTimestamp(value))
    ) {
      issues.push({
        path: field,
        message: "Expected null or a canonical ISO timestamp.",
      });
    }
  }

  const attempt = candidate.attempt;
  if (!Number.isInteger(attempt) || Number(attempt) < 1) {
    issues.push({
      path: "attempt",
      message: "Expected an integer >= 1.",
    });
  }

  const runEpoch = candidate.runEpoch;
  if (!Number.isInteger(runEpoch) || Number(runEpoch) < 1) {
    issues.push({
      path: "runEpoch",
      message: "Expected an integer >= 1.",
    });
  }

  const readActionArray = (field: string): ImpactAction[] => {
    const value = candidate[field];
    if (!Array.isArray(value)) {
      issues.push({
        path: field,
        message: "Expected an array of known impact actions.",
      });
      return [];
    }

    const actions: ImpactAction[] = [];
    for (const action of value) {
      if (!isImpactAction(action)) {
        issues.push({
          path: field,
          message: `Unknown impact action: ${String(action)}.`,
        });
        continue;
      }
      actions.push(action);
    }
    return actions;
  };

  const allPlannedActions = readActionArray("allPlannedActions");
  const completedActions = readActionArray("completedActions");
  const pendingActions = readActionArray("pendingActions");
  const failedActions = readActionArray("failedActions");
  const skippedActions = readActionArray("skippedActions");

  try {
    dedupeAndValidateActionBuckets({
      allPlannedActions,
      completedActions,
      pendingActions,
      failedActions,
      skippedActions,
    });
  } catch (error) {
    issues.push({
      path: "actions",
      message: error instanceof Error ? error.message : "Invalid action buckets.",
    });
  }

  if (status != null && isOrchestrationRunStatus(status)) {
    if (isTerminalRunStatus(status)) {
      if (candidate.finishedAt == null) {
        issues.push({
          path: "finishedAt",
          message: "finishedAt is required for terminal statuses.",
        });
      }
    } else if (candidate.finishedAt != null) {
      issues.push({
        path: "finishedAt",
        message: "finishedAt must be null for active statuses.",
      });
    }

    if (status === "superseded" && !isNonEmptyString(candidate.supersededByRunId)) {
      issues.push({
        path: "supersededByRunId",
        message: "supersededByRunId is required for superseded runs.",
      });
    }

    if (status === "failed" && !isNonEmptyString(candidate.failureReason)) {
      issues.push({
        path: "failureReason",
        message: "failureReason is required for failed runs.",
      });
    }

    if (status === "cancelled" && !isNonEmptyString(candidate.cancellationReason)) {
      issues.push({
        path: "cancellationReason",
        message: "cancellationReason is required for cancelled runs.",
      });
    }

    if (
      status === "abandoned" &&
      !isNonEmptyString(candidate.abandonedReason)
    ) {
      issues.push({
        path: "abandonedReason",
        message: "abandonedReason is required for abandoned runs.",
      });
    }

    if (
      status === "partially_completed" &&
      !isNonEmptyString(candidate.partialCompletionReason)
    ) {
      issues.push({
        path: "partialCompletionReason",
        message: "partialCompletionReason is required for partially completed runs.",
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
    run: freezeRun(candidate as OrchestrationRun),
  };
}

export function parseOrchestrationRun(input: unknown): OrchestrationRun {
  const result = validateOrchestrationRun(input);
  if (!result.ok) {
    throw new Error(
      result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | "),
    );
  }
  return result.run;
}
