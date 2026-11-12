import type { CreateAutomationRunInput, CreateAutomationTaskInput } from "./types";
import { buildContactValidationTask } from "./backlink-autonomy-foundation";
import type { BacklinkPromotionResolutionControl } from "./backlink-promotion-resolution-entry";

export const BACKLINK_CONTACT_SELECTION_RESUME_RUN_KIND = "backlinks.autonomy";

export type ContactSelectedDecisionForResume = {
  id: string;
  workspaceId: string;
  promotionApplicationId: string;
  sourceAutonomyRunId: string;
  sourceResolutionTaskId: string;
  selectedContactId: string | null;
  decisionStatus: "contact_selected" | "promotion_rejected";
  decidedBy: string;
};

export type ContactResolutionTaskRecord = {
  taskKind: string;
  status: string;
  input: unknown;
};

export type ContactResolutionTaskScope = {
  domainId: string;
  opportunityId: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The resolution task's input is historical data written during an earlier,
 * already-completed run; re-validate its shape defensively instead of
 * trusting it as-is, mirroring the same UUID checks the decision-recording
 * RPC itself performs.
 */
export function extractContactResolutionTaskScope(input: unknown): ContactResolutionTaskScope | null {
  if (typeof input !== "object" || input == null || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const { domainId, opportunityId } = record;
  if (typeof domainId !== "string" || typeof opportunityId !== "string") return null;
  if (!UUID_PATTERN.test(domainId) || !UUID_PATTERN.test(opportunityId)) return null;
  return { domainId, opportunityId };
}

export type ContactSelectionResumeDependencies = {
  getResolutionTask: (workspaceId: string, runId: string, taskId: string) => Promise<ContactResolutionTaskRecord | null>;
  createOrGetRun: (input: CreateAutomationRunInput) => Promise<{ kind: "created" | "existing"; run: { id: string } }>;
  createOrGetTask: (input: CreateAutomationTaskInput) => Promise<{ kind: "created" | "existing"; task: { id: string } }>;
};

export type ContactSelectionResumeOutcome = "disabled" | "blocked" | "run_created" | "run_existing";

export type ContactSelectionResumeResult = {
  decisionId: string;
  outcome: ContactSelectionResumeOutcome;
  reason: string;
  runId: string | null;
  taskId: string | null;
};

function stopped(outcome: "disabled" | "blocked", decisionId: string, reason: string): ContactSelectionResumeResult {
  return { decisionId, outcome, reason, runId: null, taskId: null };
}

/**
 * Bridges exactly one immutable, already-recorded `contact_selected` decision
 * into a sibling autonomy run — mirroring how `enterPromotedOpportunityContactResolution`
 * bridges an applied promotion into the pipeline by calling a task builder
 * directly, not the generic orchestrator (whose `nextTask()` hardcodes a
 * same-run `dependsOnTaskId`, which a cross-run dependency can never satisfy).
 *
 * The original, now-`completed` run is never reopened or mutated: reopening
 * it would require a new state transition this codebase does not expose, and
 * the claim RPC only ever claims tasks from a `queued`/`running` run anyway.
 * A new sibling run instead carries the resumed work forward, deterministically
 * keyed by the decision id so that concurrent or repeated resume attempts
 * never create more than one sibling run or task (the same race-safe
 * create-or-get pattern already used throughout this pipeline).
 *
 * `promotion_rejected` decisions, and any decision without a selected
 * contact, are never read past the first check — no ambiguity is ever
 * resolved automatically here.
 */
export async function resumeBacklinkContactSelectionDecision(
  deps: ContactSelectionResumeDependencies,
  input: { decision: ContactSelectedDecisionForResume; control: BacklinkPromotionResolutionControl; scheduledAt: string },
): Promise<ContactSelectionResumeResult> {
  const { decision, control } = input;
  if (control.backlinksEnabled !== true) return stopped("disabled", decision.id, "BACKLINKS_DISABLED");
  if (control.disabledReason != null) return stopped("disabled", decision.id, "AUTOMATION_DISABLED_REASON");
  if (control.backlinkAutonomyEnabled !== true) return stopped("disabled", decision.id, "BACKLINK_AUTONOMY_DISABLED");
  if (decision.decisionStatus !== "contact_selected" || decision.selectedContactId == null) {
    return stopped("blocked", decision.id, "DECISION_NOT_CONTACT_SELECTED");
  }

  const task = await deps.getResolutionTask(decision.workspaceId, decision.sourceAutonomyRunId, decision.sourceResolutionTaskId);
  const scope = task == null ? null : extractContactResolutionTaskScope(task.input);
  if (task == null || task.taskKind !== "backlinks.contact_resolution" || task.status !== "completed" || scope == null) {
    return stopped("blocked", decision.id, "SOURCE_TASK_INVALID");
  }

  const run = await deps.createOrGetRun({
    workspaceId: decision.workspaceId,
    system: "backlinks",
    runKind: BACKLINK_CONTACT_SELECTION_RESUME_RUN_KIND,
    // Deterministic per decision: a repeated or concurrent resume attempt for
    // the same decision always resolves to the same single sibling run.
    idempotencyKey: `backlinks-autonomy:contact-selection-resume:${decision.id}`,
    mode: "dry_run",
    triggerSource: "internal",
    requestedBy: decision.decidedBy,
    scheduledAt: input.scheduledAt,
    input: {
      version: 1,
      sourceAutonomyRunId: decision.sourceAutonomyRunId,
      sourceResolutionTaskId: decision.sourceResolutionTaskId,
      contactSelectionDecisionId: decision.id,
      promotionApplicationId: decision.promotionApplicationId,
      domainId: scope.domainId,
      opportunityId: scope.opportunityId,
    },
  });

  const validationTask = buildContactValidationTask({
    workspaceId: decision.workspaceId,
    runId: run.run.id,
    dependsOnTaskId: null,
    domainId: scope.domainId,
    opportunityId: scope.opportunityId,
    contactId: decision.selectedContactId,
    scheduledAt: input.scheduledAt,
  });
  const created = await deps.createOrGetTask(validationTask);

  return {
    decisionId: decision.id,
    outcome: run.kind === "created" ? "run_created" : "run_existing",
    reason: "OK",
    runId: run.run.id,
    taskId: created.task.id,
  };
}

export type BacklinkContactSelectionResumeDependencies = ContactSelectionResumeDependencies & {
  listWorkspaceControls: (limit: number) => Promise<readonly (BacklinkPromotionResolutionControl & { workspaceId: string })[]>;
  listDecisions: (workspaceId: string, limit: number) => Promise<readonly ContactSelectedDecisionForResume[]>;
};

export type BacklinkContactSelectionResumeTickResult = {
  decisionsScanned: number;
  resumedRuns: readonly { workspaceId: string; runId: string }[];
  results: readonly ContactSelectionResumeResult[];
};

/**
 * Bounded, multi-workspace sweep, mirroring the shape of the existing
 * promotion scheduler's own workspace × candidate double loop. It never
 * widens eligibility beyond what `listWorkspaceControls` already enforces at
 * the same gate the rest of the autonomy pipeline uses.
 */
export async function runBacklinkContactSelectionResumeTick(
  deps: BacklinkContactSelectionResumeDependencies,
  input: { workspaceLimit: number; decisionLimitPerWorkspace: number; scheduledAt: string },
): Promise<BacklinkContactSelectionResumeTickResult> {
  const controls = (await deps.listWorkspaceControls(input.workspaceLimit)).slice().sort((a, b) => a.workspaceId.localeCompare(b.workspaceId));
  const results: ContactSelectionResumeResult[] = [];
  const resumedRuns: { workspaceId: string; runId: string }[] = [];
  for (const control of controls) {
    const decisions = (await deps.listDecisions(control.workspaceId, input.decisionLimitPerWorkspace)).slice().sort((a, b) => a.id.localeCompare(b.id));
    for (const decision of decisions) {
      const result = await resumeBacklinkContactSelectionDecision(
        { getResolutionTask: deps.getResolutionTask, createOrGetRun: deps.createOrGetRun, createOrGetTask: deps.createOrGetTask },
        { decision, control, scheduledAt: input.scheduledAt },
      );
      results.push(result);
      if (result.runId != null) resumedRuns.push({ workspaceId: control.workspaceId, runId: result.runId });
    }
  }
  return { decisionsScanned: results.length, resumedRuns, results };
}
