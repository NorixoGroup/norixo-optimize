import type { AutomationRun, AutomationTask, CreateAutomationRunInput, CreateAutomationTaskInput } from "./types";
import { runBacklinkAutonomyOrchestrator, type BacklinkAutonomyControl } from "./backlink-master-autonomy-orchestrator";
import type { BacklinkContactValidationTaskResult } from "./backlink-contact-validation-task-handler";
import { isUuid } from "@/lib/backlinks/services/contactSelectionReviewService";

/**
 * BL-AUTO: resumes a `completed` backlinks autonomy run whose downstream
 * progress stalled purely because a business/control gate (e.g.
 * campaignApplyAuthorized) was not yet satisfied at the time — never because
 * the underlying business outcome itself was a stop (CONTACT_SUPPRESSED,
 * CONTACT_VALIDATION_INVALID, etc.), which this module re-derives live and
 * respects unchanged.
 *
 * It never reopens or mutates the source run: a new, idempotently-keyed
 * sibling run instead carries exactly one freshly computed next task,
 * reusing the orchestrator's own transition logic (`runBacklinkAutonomyOrchestrator`)
 * so this module can never diverge from the pipeline's real decision rules.
 *
 * Only `contact_validation` is resumable for now (BL-AUTO-06 Jalon 1 scope).
 *
 * Access control is mandatory and fail-closed via `deps.isAuthorizedOperator`
 * (never inferred from `requestedBy` alone); the idempotency key for the
 * sibling run is derived internally from `sourceRunId` + `stage`, never
 * accepted from the caller. This module has no API route or RPC wired to it
 * and performs no Production write of its own beyond the automation_runs/
 * automation_tasks rows it creates through the injected dependencies.
 */
export const BACKLINK_AUTONOMY_TERMINAL_RESUME_RUN_KIND = "backlinks.autonomy";

export const RESUMABLE_BACKLINK_AUTONOMY_STAGES = ["contact_validation"] as const;
export type ResumableBacklinkAutonomyStage = (typeof RESUMABLE_BACKLINK_AUTONOMY_STAGES)[number];

export type BacklinkAutonomyTerminalRunResumeInput = {
  workspaceId: string;
  sourceRunId: string;
  stage: ResumableBacklinkAutonomyStage;
  /**
   * The operator claiming to trigger this resume. This is never trusted as
   * proof of authorization by itself — it is only an identity to check via
   * `deps.isAuthorizedOperator`, and is rejected outright if empty or not a
   * well-formed UUID.
   */
  requestedBy: string;
  scheduledAt: string;
};

export type BacklinkAutonomyTerminalRunResumeResult = {
  outcome: "resumed" | "not_eligible";
  reasonCodes: readonly string[];
  sourceRunId: string;
  sourceTaskId: string | null;
  runId: string | null;
  taskId: string | null;
};

export type BacklinkAutonomyTerminalRunResumeContact = {
  id: string;
  workspaceId?: string;
  contactStatus: string;
};

export type BacklinkAutonomyTerminalRunResumeDependencies = {
  getRun: (input: { workspaceId: string; runId: string }) => Promise<AutomationRun | null>;
  listTasks: (input: { workspaceId: string; runId: string }) => Promise<readonly AutomationTask[]>;
  getContact: (input: { workspaceId: string; contactId: string }) => Promise<BacklinkAutonomyTerminalRunResumeContact | null>;
  /**
   * Fail-closed identity check. The intended server-side contract is "is a
   * NORIXO private admin AND an admin/owner of this workspace" (mirroring
   * `is_backlink_campaign_apply_authorized`'s own double-authorization
   * check), but this module never assumes that contract itself — it only
   * calls this dependency and rejects on `false`, and rejects just as hard
   * if this dependency throws. `requestedBy` is never treated as proof of
   * authorization on its own.
   */
  isAuthorizedOperator: (input: { workspaceId: string; requestedBy: string }) => Promise<boolean>;
  /** Re-read live at resume time; never cached or trusted from the source run's era. */
  getControl: () => Promise<BacklinkAutonomyControl>;
  createOrGetRun: (input: CreateAutomationRunInput) => Promise<{ kind: "created" | "existing"; run: { id: string } }>;
  createOrGetTask: (input: CreateAutomationTaskInput) => Promise<{ kind: "created" | "existing"; task: { id: string } }>;
};

function notEligible(reasonCode: string, sourceRunId: string, sourceTaskId: string | null = null): BacklinkAutonomyTerminalRunResumeResult {
  return { outcome: "not_eligible", reasonCodes: [reasonCode], sourceRunId, sourceTaskId, runId: null, taskId: null };
}

type TaskScope = { domainId: string; opportunityId: string; contactId: string };

/**
 * The source task's input is historical data written during an earlier,
 * already-completed run; re-validate its shape defensively instead of
 * trusting it as-is (mirrors extractContactResolutionTaskScope in
 * backlink-contact-selection-resume-service.ts).
 */
function extractContactValidationTaskScope(input: unknown): TaskScope | null {
  if (typeof input !== "object" || input == null || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const { domainId, opportunityId, contactId } = record;
  if (!isUuid(domainId) || !isUuid(opportunityId) || !isUuid(contactId)) return null;
  return { domainId, opportunityId, contactId };
}

const VALIDATION_DISPOSITIONS = ["verified", "unverified", "invalid", "manual_review", "manual_action_required"] as const;
const VALIDATION_STATUSES = [...VALIDATION_DISPOSITIONS, "blocked"] as const;

function isDisposition(value: unknown): value is BacklinkContactValidationTaskResult["email"] {
  return value === null || (typeof value === "string" && (VALIDATION_DISPOSITIONS as readonly string[]).includes(value));
}

const STATUS_TRANSITIONS = ["preserved", "none"] as const;

/**
 * Defensive re-parse of a persisted `backlinks.contact_validation` task
 * output into the exact shape `runBacklinkAutonomyOrchestrator` expects for
 * `progress.validation`. Every field is re-validated rather than cast, and
 * `domainId`/`opportunityId`/`contactId` must match the source task's own
 * scope, so a corrupted or foreign record can never be fed back into the
 * orchestrator.
 */
function extractContactValidationOutput(output: unknown, scope: TaskScope): BacklinkContactValidationTaskResult | null {
  if (typeof output !== "object" || output == null || Array.isArray(output)) return null;
  const record = output as Record<string, unknown>;
  const { status, contactStatus, suppressed, email, contactForm, linkedin, currentNormalizedEmail, statusTransition, manualReviewRequired, reasons, domainId, opportunityId, contactId } = record;
  if (typeof status !== "string" || !(VALIDATION_STATUSES as readonly string[]).includes(status)) return null;
  if (contactStatus !== null && typeof contactStatus !== "string") return null;
  if (typeof suppressed !== "boolean") return null;
  if (!isDisposition(email) || !isDisposition(contactForm) || !isDisposition(linkedin)) return null;
  if (currentNormalizedEmail !== null && typeof currentNormalizedEmail !== "string") return null;
  if (typeof statusTransition !== "string" || !(STATUS_TRANSITIONS as readonly string[]).includes(statusTransition)) return null;
  if (typeof manualReviewRequired !== "boolean") return null;
  if (!Array.isArray(reasons) || !reasons.every((reason) => typeof reason === "string")) return null;
  if (domainId !== scope.domainId || opportunityId !== scope.opportunityId || contactId !== scope.contactId) return null;
  return {
    status: status as BacklinkContactValidationTaskResult["status"],
    domainId: scope.domainId,
    opportunityId: scope.opportunityId,
    contactId: scope.contactId,
    contactStatus: contactStatus as string | null,
    currentNormalizedEmail: currentNormalizedEmail as string | null,
    suppressed,
    email: email as BacklinkContactValidationTaskResult["email"],
    contactForm: contactForm as BacklinkContactValidationTaskResult["contactForm"],
    linkedin: linkedin as BacklinkContactValidationTaskResult["linkedin"],
    statusTransition: statusTransition as "preserved" | "none",
    manualReviewRequired,
    reasons: reasons as readonly string[],
  };
}

export async function resumeBacklinkAutonomyCompletedRun(
  deps: BacklinkAutonomyTerminalRunResumeDependencies,
  input: BacklinkAutonomyTerminalRunResumeInput,
): Promise<BacklinkAutonomyTerminalRunResumeResult> {
  if (!RESUMABLE_BACKLINK_AUTONOMY_STAGES.includes(input.stage)) {
    return notEligible("STAGE_NOT_RESUMABLE", input.sourceRunId);
  }
  if (input.workspaceId === "" || input.sourceRunId === "") {
    return notEligible("RESUME_INPUT_INVALID", input.sourceRunId);
  }
  if (!isUuid(input.requestedBy)) {
    return notEligible("OPERATOR_IDENTITY_INVALID", input.sourceRunId);
  }

  // Fail-closed: a thrown exception from the authorization dependency is
  // treated identically to an explicit `false`, never allowed to propagate
  // as if it meant "authorized". `requestedBy` is never itself trusted.
  let authorized: boolean;
  try {
    authorized = await deps.isAuthorizedOperator({ workspaceId: input.workspaceId, requestedBy: input.requestedBy });
  } catch {
    authorized = false;
  }
  if (authorized !== true) {
    return notEligible("OPERATOR_NOT_AUTHORIZED", input.sourceRunId);
  }

  const run = await deps.getRun({ workspaceId: input.workspaceId, runId: input.sourceRunId });
  if (run == null || run.id !== input.sourceRunId || run.workspaceId !== input.workspaceId) {
    return notEligible("SOURCE_RUN_NOT_FOUND", input.sourceRunId);
  }
  if (run.status !== "completed") {
    return notEligible("SOURCE_RUN_NOT_TERMINAL_COMPLETED", input.sourceRunId);
  }

  const expectedTaskKind = `backlinks.${input.stage}`;
  const tasks = await deps.listTasks({ workspaceId: input.workspaceId, runId: input.sourceRunId });
  const candidates = tasks.filter((task) => task.taskKind === expectedTaskKind && task.status === "completed");
  const sourceTask = candidates.slice().sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? "")).at(-1) ?? null;
  if (sourceTask == null) {
    return notEligible("SOURCE_TASK_NOT_FOUND_OR_NOT_COMPLETED", input.sourceRunId);
  }

  const scope = extractContactValidationTaskScope(sourceTask.input);
  if (scope == null) {
    return notEligible("SOURCE_TASK_SCOPE_INVALID", input.sourceRunId, sourceTask.id);
  }

  const validation = extractContactValidationOutput(sourceTask.output, scope);
  if (validation == null) {
    return notEligible("SOURCE_TASK_OUTPUT_INVALID", input.sourceRunId, sourceTask.id);
  }

  const contact = await deps.getContact({ workspaceId: input.workspaceId, contactId: scope.contactId });
  if (contact == null || contact.id !== scope.contactId || (contact.workspaceId != null && contact.workspaceId !== input.workspaceId)) {
    return notEligible("CONTACT_SCOPE_INVALID", input.sourceRunId, sourceTask.id);
  }
  if (contact.contactStatus === "do_not_contact" || contact.contactStatus === "archived") {
    return notEligible("CONTACT_NO_LONGER_ELIGIBLE", input.sourceRunId, sourceTask.id);
  }

  const control = await deps.getControl();

  // Phase A: decide, without persisting anything, whether the orchestrator's
  // own transition rules would now produce a creatable next task. No run or
  // task is created unless this confirms eligibility (mission requirement:
  // "si les conditions ne sont pas satisfaites, retourner un motif explicite
  // sans créer de run").
  const preview = await runBacklinkAutonomyOrchestrator({}, {
    workspaceId: input.workspaceId,
    runId: input.sourceRunId,
    domainId: scope.domainId,
    opportunityId: scope.opportunityId,
    scheduledAt: input.scheduledAt,
    mode: "preview",
    control,
    progress: {
      stage: input.stage,
      completedTaskId: sourceTask.id,
      completedTaskKind: sourceTask.taskKind,
      contactIds: [contact.id],
      validation,
    },
  });
  if (preview.outcome !== "preview" || preview.task == null) {
    return { outcome: "not_eligible", reasonCodes: preview.reasonCodes, sourceRunId: input.sourceRunId, sourceTaskId: sourceTask.id, runId: null, taskId: null };
  }

  // Phase B: eligibility confirmed — create the sibling run (never the
  // source run), keyed deterministically from the source run and stage alone
  // so a repeated or concurrent call for the same logical resume can never
  // create a second sibling run, regardless of what any caller supplies.
  const siblingRunIdempotencyKey = `backlinks-autonomy:terminal-resume:${input.sourceRunId}:${input.stage}`;
  const siblingRun = await deps.createOrGetRun({
    workspaceId: input.workspaceId,
    system: "backlinks",
    runKind: BACKLINK_AUTONOMY_TERMINAL_RESUME_RUN_KIND,
    idempotencyKey: siblingRunIdempotencyKey,
    mode: "dry_run",
    triggerSource: "manual",
    requestedBy: input.requestedBy,
    scheduledAt: input.scheduledAt,
    input: {
      version: 1,
      sourceAutonomyRunId: input.sourceRunId,
      sourceTaskId: sourceTask.id,
      resumedStage: input.stage,
      domainId: scope.domainId,
      opportunityId: scope.opportunityId,
      contactId: contact.id,
    },
  });

  // Re-read the control live, immediately before the persisting call, so an
  // authorization revoked after the Phase A preview is honored. This closes
  // most of the staleness window but is NOT a transactional guarantee: a
  // revocation landing in the instant between this read and the
  // orchestrator's own createOrGetTask call below would still slip through.
  // No amount of re-reading from this layer can remove that residual window
  // without the write path itself being made transactional with the read.
  const freshControl = await deps.getControl();

  // The orchestrator's shared nextTask() always sets the new task's
  // dependsOnTaskId to progress.completedTaskId — correct for the normal
  // same-run worker flow, but here completedTaskId (sourceTask.id) belongs
  // to the SOURCE run while the new task belongs to the sibling run.
  // trg_automation_tasks_dependency_integrity (migration 20260803030000)
  // requires depends_on_task_id to share both workspace_id AND run_id with
  // the task that carries it, and raises AUTOMATION_TASK_DEPENDENCY_SCOPE_MISMATCH
  // otherwise. Source-run provenance is already fully preserved in the
  // sibling run's own `input` (sourceAutonomyRunId/sourceTaskId/resumedStage,
  // set above) — dependsOnTaskId is a same-run claim-ordering mechanism, not
  // an audit trail, so clearing it loses no traceability.
  const createSiblingRunTask: typeof deps.createOrGetTask = (task) => deps.createOrGetTask({ ...task, dependsOnTaskId: null });

  let created: Awaited<ReturnType<typeof runBacklinkAutonomyOrchestrator>>;
  try {
    created = await runBacklinkAutonomyOrchestrator({ createOrGetTask: createSiblingRunTask }, {
      workspaceId: input.workspaceId,
      runId: siblingRun.run.id,
      domainId: scope.domainId,
      opportunityId: scope.opportunityId,
      scheduledAt: input.scheduledAt,
      mode: "apply",
      control: freshControl,
      progress: {
        stage: input.stage,
        completedTaskId: sourceTask.id,
        completedTaskKind: sourceTask.taskKind,
        contactIds: [contact.id],
        validation,
      },
    });
  } catch {
    // Infrastructure failure after the sibling run was already created: fail
    // closed, surface the existing sibling run id so a retry with the same
    // (internally-derived, deterministic) key safely completes the missing
    // task instead of creating a duplicate run. No automatic retry here.
    return { outcome: "not_eligible", reasonCodes: ["SIBLING_TASK_CREATION_FAILED"], sourceRunId: input.sourceRunId, sourceTaskId: sourceTask.id, runId: siblingRun.run.id, taskId: null };
  }

  if (created.outcome !== "task_created" && created.outcome !== "task_existing") {
    // The authorization re-read above denied what the Phase A preview
    // allowed (e.g. revoked in between): fail closed, report why, create no
    // task. The sibling run (now taskless) is left as an inert,
    // idempotently-keyed record rather than retried implicitly.
    return { outcome: "not_eligible", reasonCodes: created.reasonCodes, sourceRunId: input.sourceRunId, sourceTaskId: sourceTask.id, runId: siblingRun.run.id, taskId: null };
  }

  return {
    outcome: "resumed",
    reasonCodes: [],
    sourceRunId: input.sourceRunId,
    sourceTaskId: sourceTask.id,
    runId: siblingRun.run.id,
    taskId: created.taskId,
  };
}
