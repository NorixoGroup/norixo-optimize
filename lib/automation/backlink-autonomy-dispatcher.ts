import type { AutomationTask } from "./types";
import {
  executeBacklinkContactResolutionTask,
  type BacklinkContactResolutionTaskDependencies,
  type BacklinkContactResolutionTaskResult,
} from "./backlink-contact-resolution-task-handler";
import {
  executeBacklinkContactValidationTask,
  type BacklinkContactValidationTaskDependencies,
  type BacklinkContactValidationTaskResult,
} from "./backlink-contact-validation-task-handler";
import {
  executeBacklinkCampaignPrepareTask,
  executeBacklinkDraftPrepareTask,
  executeBacklinkOutreachDecisionTask,
  type CampaignPrepareTaskDependencies,
  type CampaignPrepareTaskResult,
  type DraftPrepareTaskDependencies,
  type DraftPrepareTaskResult,
  type OutreachDecisionTaskDependencies,
} from "./backlink-downstream-task-handlers";
import type { BacklinkAutonomyDecisionResult } from "./backlink-autonomy-pipeline";

export type BacklinkAutonomyDispatchMode = "preview" | "apply" | "live";
export type BacklinkAutonomyDispatcherControl = {
  backlinksEnabled: boolean;
  disabledReason: string | null;
  backlinkAutonomyEnabled: boolean;
  liveExecutionAuthorized?: boolean;
  campaignApplyAuthorized?: boolean;
};
export type BacklinkAutonomyDispatcherDependencies = {
  resolution: BacklinkContactResolutionTaskDependencies;
  validation: BacklinkContactValidationTaskDependencies;
  campaign: CampaignPrepareTaskDependencies;
  draft: DraftPrepareTaskDependencies;
  decision: OutreachDecisionTaskDependencies;
};
export type BacklinkAutonomyDispatchState = { actorUserId: string; campaignId?: string; outreachId?: string; channel?: "email" | "contact_form" | "linkedin" };
export type BacklinkAutonomyDispatchResult =
  | { kind: "executed"; taskKind: "backlinks.contact_resolution"; output: BacklinkContactResolutionTaskResult }
  | { kind: "executed"; taskKind: "backlinks.contact_validation"; output: BacklinkContactValidationTaskResult }
  | { kind: "executed"; taskKind: "backlinks.campaign_prepare"; output: CampaignPrepareTaskResult }
  | { kind: "executed"; taskKind: "backlinks.draft_prepare"; output: DraftPrepareTaskResult }
  | { kind: "executed"; taskKind: "backlinks.outreach_decision"; output: BacklinkAutonomyDecisionResult }
  | { kind: "rejected"; reason: string };

function fields(task: AutomationTask): Record<string, unknown> | null {
  return typeof task.input === "object" && task.input != null && !Array.isArray(task.input) ? task.input as Record<string, unknown> : null;
}
function text(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }
function base(task: AutomationTask): { workspaceId: string; domainId: string; opportunityId: string; contactId?: string } | null {
  const input = fields(task); if (input == null) return null;
  const domainId = text(input.domainId), opportunityId = text(input.opportunityId), contactId = text(input.contactId);
  if (domainId == null || opportunityId == null) return null;
  return { workspaceId: task.workspaceId, domainId, opportunityId, ...(contactId == null ? {} : { contactId }) };
}
function gate(mode: BacklinkAutonomyDispatchMode, control: BacklinkAutonomyDispatcherControl): string | null {
  if (mode === "preview") return "PREVIEW_DISPATCH_FORBIDDEN";
  if (mode !== "apply" && mode !== "live") return "AUTONOMY_MODE_DISABLED";
  if (control.backlinksEnabled !== true) return "BACKLINKS_DISABLED";
  if (control.disabledReason != null) return "AUTOMATION_DISABLED_REASON";
  if (control.backlinkAutonomyEnabled !== true) return "BACKLINK_AUTONOMY_DISABLED";
  if (mode === "live" && control.liveExecutionAuthorized !== true) return "LIVE_EXECUTION_NOT_AUTHORIZED";
  return null;
}

/** Executes only a previously claimed task. It never claims, persists task lifecycle, or imports an outreach executor. */
export async function dispatchBacklinkAutonomyTask(
  deps: BacklinkAutonomyDispatcherDependencies,
  input: { task: AutomationTask; mode: BacklinkAutonomyDispatchMode; control: BacklinkAutonomyDispatcherControl; state: BacklinkAutonomyDispatchState },
): Promise<BacklinkAutonomyDispatchResult> {
  const stopped = gate(input.mode, input.control); if (stopped != null) return { kind: "rejected", reason: stopped };
  const value = base(input.task); if (value == null) return { kind: "rejected", reason: "TASK_INPUT_INVALID" };
  if (input.task.taskKind === "backlinks.contact_resolution") {
    const actorUserId = text(fields(input.task)?.actorUserId); if (actorUserId == null) return { kind: "rejected", reason: "TASK_INPUT_INVALID" };
    return { kind: "executed", taskKind: input.task.taskKind, output: await executeBacklinkContactResolutionTask(deps.resolution, { ...value, actorUserId }) };
  }
  if (value.contactId == null) return { kind: "rejected", reason: "TASK_INPUT_INVALID" };
  if (input.task.taskKind === "backlinks.contact_validation") return { kind: "executed", taskKind: input.task.taskKind, output: await executeBacklinkContactValidationTask(deps.validation, { ...value, contactId: value.contactId }) };
  if (input.task.taskKind === "backlinks.campaign_prepare") return { kind: "executed", taskKind: input.task.taskKind, output: await executeBacklinkCampaignPrepareTask(deps.campaign, { ...value, contactId: value.contactId, actorUserId: input.state.actorUserId, campaignPreparationConfirmed: input.control.campaignApplyAuthorized === true }) };
  if (input.task.taskKind === "backlinks.draft_prepare") {
    if (input.state.campaignId == null || input.state.channel == null) return { kind: "rejected", reason: "DRAFT_CONTEXT_MISSING" };
    return { kind: "executed", taskKind: input.task.taskKind, output: await executeBacklinkDraftPrepareTask(deps.draft, { ...value, contactId: value.contactId, campaignId: input.state.campaignId, channel: input.state.channel, actorUserId: input.state.actorUserId }) };
  }
  if (input.task.taskKind === "backlinks.outreach_decision") {
    if (input.state.outreachId == null) return { kind: "rejected", reason: "OUTREACH_CONTEXT_MISSING" };
    return { kind: "executed", taskKind: input.task.taskKind, output: await executeBacklinkOutreachDecisionTask(deps.decision, { workspaceId: value.workspaceId, outreachId: input.state.outreachId }) };
  }
  return { kind: "rejected", reason: "TASK_KIND_UNSUPPORTED" };
}
