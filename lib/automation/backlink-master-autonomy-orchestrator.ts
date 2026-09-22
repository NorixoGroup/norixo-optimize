import type { CreateAutomationTaskInput } from "./types";
import { buildContactValidationTask, buildMailboxVerificationTask } from "./backlink-autonomy-foundation";
import { buildNextDownstreamTask, type BacklinkAutonomyDecisionResult } from "./backlink-autonomy-pipeline";
import type { BacklinkContactValidationTaskResult } from "./backlink-contact-validation-task-handler";
import type { BacklinkMailboxVerificationTaskResult } from "./backlink-mailbox-verification-task-handler";

export type BacklinkAutonomyMode = "disabled" | "preview" | "apply" | "live";
export type BacklinkAutonomyStage = "contact_resolution" | "contact_validation" | "mailbox_verification" | "campaign_prepare" | "draft_prepare" | "outreach_decision" | "execution_boundary" | "completed" | "manual_review" | "blocked" | "dead_letter";

export type BacklinkAutonomyControl = {
  backlinksEnabled: boolean;
  disabledReason: string | null;
  dryRunOnly: boolean;
  backlinkAutonomyEnabled?: boolean;
  liveExecutionAuthorized?: boolean;
  campaignApplyAuthorized?: boolean;
};

export type BacklinkAutonomyProgress = {
  stage: Exclude<BacklinkAutonomyStage, "execution_boundary" | "completed" | "manual_review" | "blocked">;
  completedTaskId: string;
  completedTaskKind: string;
  contactIds?: readonly string[];
  decision?: BacklinkAutonomyDecisionResult;
  validation?: BacklinkContactValidationTaskResult;
  mailboxVerification?: BacklinkMailboxVerificationTaskResult;
};

export type BacklinkMasterAutonomyOrchestratorInput = {
  workspaceId: string;
  runId: string;
  domainId: string;
  opportunityId: string;
  scheduledAt: string;
  mode: BacklinkAutonomyMode;
  control: BacklinkAutonomyControl;
  progress: BacklinkAutonomyProgress;
};

export type BacklinkMasterAutonomyOrchestratorDependencies = {
  createOrGetTask?: (input: CreateAutomationTaskInput) => Promise<{ kind: "created" | "existing"; task: { id: string } }>;
};

export type BacklinkMasterAutonomyOrchestratorResult = {
  outcome: "disabled" | "preview" | "task_created" | "task_existing" | "blocked" | "manual_review" | "execution_pending" | "dead_letter";
  stage: BacklinkAutonomyStage;
  reasonCodes: readonly string[];
  task: CreateAutomationTaskInput | null;
  taskId: string | null;
  readyTransitionRequired: boolean;
};

function stopped(outcome: Extract<BacklinkMasterAutonomyOrchestratorResult["outcome"], "disabled" | "blocked" | "manual_review" | "dead_letter">, stage: BacklinkAutonomyStage, reason: string): BacklinkMasterAutonomyOrchestratorResult {
  return { outcome, stage, reasonCodes: [reason], task: null, taskId: null, readyTransitionRequired: false };
}

function controlStop(input: BacklinkMasterAutonomyOrchestratorInput): BacklinkMasterAutonomyOrchestratorResult | null {
  if (input.mode === "disabled") return stopped("disabled", "blocked", "AUTONOMY_MODE_DISABLED");
  if (input.control.backlinksEnabled !== true) return stopped("disabled", "blocked", "BACKLINKS_DISABLED");
  if (input.control.disabledReason != null) return stopped("disabled", "blocked", "AUTOMATION_DISABLED_REASON");
  if (input.control.backlinkAutonomyEnabled !== true) return stopped("disabled", "blocked", "BACKLINK_AUTONOMY_DISABLED");
  if (input.mode === "live" && input.control.liveExecutionAuthorized !== true) return stopped("disabled", "blocked", "LIVE_EXECUTION_NOT_AUTHORIZED");
  return null;
}

function oneContact(contactIds: readonly string[] | undefined): { contactId: string } | BacklinkMasterAutonomyOrchestratorResult {
  const values = [...new Set(contactIds ?? [])].sort();
  if (values.length === 0) return stopped("blocked", "blocked", "NO_CONTACT_FOUND");
  if (values.length !== 1) return stopped("manual_review", "manual_review", "CONTACT_SELECTION_REQUIRED");
  return { contactId: values[0]! };
}

function nextTask(input: BacklinkMasterAutonomyOrchestratorInput): CreateAutomationTaskInput | BacklinkMasterAutonomyOrchestratorResult {
  if (input.progress.stage === "dead_letter") return stopped("dead_letter", "dead_letter", "DEPENDENCY_DEAD_LETTER");
  const expectedTaskKind: Record<Exclude<BacklinkAutonomyProgress["stage"], "dead_letter">, string> = {
    contact_resolution: "backlinks.contact_resolution",
    contact_validation: "backlinks.contact_validation",
    mailbox_verification: "backlinks.mailbox_verification",
    campaign_prepare: "backlinks.campaign_prepare",
    draft_prepare: "backlinks.draft_prepare",
    outreach_decision: "backlinks.outreach_decision",
  };
  if (input.progress.completedTaskKind !== expectedTaskKind[input.progress.stage]) {
    return stopped("blocked", "blocked", "ILLEGAL_STAGE_TRANSITION");
  }
  const selected = oneContact(input.progress.contactIds);
  if ("outcome" in selected) return selected;
  const common = { workspaceId: input.workspaceId, runId: input.runId, completedTaskId: input.progress.completedTaskId, domainId: input.domainId, opportunityId: input.opportunityId, contactId: selected.contactId, scheduledAt: input.scheduledAt };
  if (input.progress.stage === "contact_resolution") {
    return buildContactValidationTask({ ...common, dependsOnTaskId: input.progress.completedTaskId });
  }
  if (input.progress.stage === "contact_validation") {
    const validation = input.progress.validation;
    if (validation == null) return stopped("blocked", "blocked", "VALIDATION_RESULT_MISSING");
    if (validation.suppressed || validation.contactStatus === "do_not_contact" || validation.contactStatus === "archived") return stopped("blocked", "blocked", "CONTACT_SUPPRESSED");
    if (validation.status === "blocked") return stopped("blocked", "blocked", validation.reasons[0] ?? "CONTACT_VALIDATION_BLOCKED");
    if (validation.status === "manual_review") return stopped("manual_review", "manual_review", "CONTACT_VALIDATION_MANUAL_REVIEW");
    if (validation.status === "invalid") return stopped("blocked", "blocked", "CONTACT_VALIDATION_INVALID");
    if (validation.email === "unverified" && validation.currentNormalizedEmail != null && validation.contactStatus === "unverified" && validation.status === "unverified") {
      return buildMailboxVerificationTask({ ...common, dependsOnTaskId: input.progress.completedTaskId, currentNormalizedEmail: validation.currentNormalizedEmail });
    }
    if (validation.email != null && validation.status !== "verified") return stopped("blocked", "blocked", "EMAIL_VALIDATION_NOT_ELIGIBLE");
    if (input.control.campaignApplyAuthorized !== true) return stopped("manual_review", "manual_review", "CAMPAIGN_APPLY_AUTHORIZATION_REQUIRED");
    return buildNextDownstreamTask({ ...common, stage: "campaign_prepare" });
  }
  if (input.progress.stage === "mailbox_verification") {
    const verification = input.progress.mailboxVerification;
    if (verification == null) return stopped("blocked", "blocked", "MAILBOX_VERIFICATION_RESULT_MISSING");
    if (verification.outcome !== "verified" || verification.contactStatus !== "verified") return stopped("blocked", "blocked", verification.reason);
    if (input.control.campaignApplyAuthorized !== true) return stopped("manual_review", "manual_review", "CAMPAIGN_APPLY_AUTHORIZATION_REQUIRED");
    return buildNextDownstreamTask({ ...common, stage: "campaign_prepare" });
  }
  if (input.progress.stage === "campaign_prepare") return buildNextDownstreamTask({ ...common, stage: "draft_prepare" });
  if (input.progress.stage === "draft_prepare") return buildNextDownstreamTask({ ...common, stage: "outreach_decision" });
  const decision = input.progress.decision;
  if (decision == null) return stopped("blocked", "blocked", "DECISION_RESULT_MISSING");
  if (decision.outcome === "execution_eligible") return { outcome: "execution_pending", stage: "execution_boundary", reasonCodes: [decision.execution?.kind === "email_sender" ? "EMAIL_EXECUTION_PENDING" : "CONTACT_FORM_EXECUTION_PENDING"], task: null, taskId: null, readyTransitionRequired: true };
  if (decision.outcome === "manual_action_required" || decision.outcome === "manual_review") return { outcome: "manual_review", stage: "manual_review", reasonCodes: decision.reasons, task: null, taskId: null, readyTransitionRequired: false };
  return { outcome: "blocked", stage: "blocked", reasonCodes: decision.reasons, task: null, taskId: null, readyTransitionRequired: false };
}

/** Coordinates deterministic task creation only; it never claims work or invokes handlers/executors. */
export async function runBacklinkAutonomyOrchestrator(deps: BacklinkMasterAutonomyOrchestratorDependencies, input: BacklinkMasterAutonomyOrchestratorInput): Promise<BacklinkMasterAutonomyOrchestratorResult> {
  const blocked = controlStop(input);
  if (blocked != null) return blocked;
  const planned = nextTask(input);
  if ("outcome" in planned) return planned;
  if (input.mode === "preview") return { outcome: "preview", stage: input.progress.stage, reasonCodes: [], task: planned, taskId: null, readyTransitionRequired: false };
  if (input.mode !== "apply" && input.mode !== "live") return stopped("disabled", "blocked", "AUTONOMY_MODE_DISABLED");
  if (deps.createOrGetTask == null) return stopped("blocked", "blocked", "TASK_PERSISTENCE_NOT_CONFIGURED");
  const created = await deps.createOrGetTask(planned);
  return { outcome: created.kind === "created" ? "task_created" : "task_existing", stage: input.progress.stage, reasonCodes: [], task: planned, taskId: created.task.id, readyTransitionRequired: false };
}
