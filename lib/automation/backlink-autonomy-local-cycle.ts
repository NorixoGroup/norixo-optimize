import { claimNextAutomationTask, completeAutomationTask, failAutomationTask } from "./task-service";
import type { AutomationTask, AutomationTaskDependencies } from "./types";
import type { Json } from "@/types/database.types";
import { dispatchBacklinkAutonomyTask, type BacklinkAutonomyDispatcherControl, type BacklinkAutonomyDispatcherDependencies, type BacklinkAutonomyDispatchMode, type BacklinkAutonomyDispatchState } from "./backlink-autonomy-dispatcher";
import { runBacklinkAutonomyOrchestrator, type BacklinkMasterAutonomyOrchestratorResult } from "./backlink-master-autonomy-orchestrator";

export type BacklinkAutonomyLocalCycleResult = {
  outcome: "empty" | "execution_pending" | "blocked" | "manual_review" | "dead_letter" | "max_steps" | "rejected";
  reasonCodes: readonly string[];
  steps: number;
  taskIds: readonly string[];
  readyTransitionRequired: boolean;
};

function terminal(result: BacklinkMasterAutonomyOrchestratorResult, steps: number, taskIds: readonly string[]): BacklinkAutonomyLocalCycleResult | null {
  if (result.outcome === "execution_pending" || result.outcome === "blocked" || result.outcome === "manual_review" || result.outcome === "dead_letter") {
    return { outcome: result.outcome, reasonCodes: result.reasonCodes, steps, taskIds, readyTransitionRequired: result.readyTransitionRequired };
  }
  return null;
}

/**
 * Bounded composition harness, not a daemon or production worker. The caller
 * supplies canonical task-lifecycle adapters and all business handlers.
 */
export async function runBacklinkAutonomyCycle(input: {
  taskDependencies: AutomationTaskDependencies;
  handlers: BacklinkAutonomyDispatcherDependencies;
  workspaceId: string;
  runId: string;
  workerId: string;
  actorUserId: string;
  domainId: string;
  opportunityId: string;
  scheduledAt: string;
  mode: BacklinkAutonomyDispatchMode;
  control: BacklinkAutonomyDispatcherControl & { dryRunOnly: boolean };
  channel: "email" | "contact_form" | "linkedin";
  maxSteps?: number;
}): Promise<BacklinkAutonomyLocalCycleResult> {
  const maxSteps = input.maxSteps ?? 8;
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 8) throw new Error("BACKLINK_AUTONOMY_CYCLE_MAX_STEPS_INVALID");
  if (input.mode === "preview" || input.control.backlinksEnabled !== true || input.control.disabledReason != null || input.control.backlinkAutonomyEnabled !== true) {
    return { outcome: "rejected", reasonCodes: [input.mode === "preview" ? "PREVIEW_DISPATCH_FORBIDDEN" : "AUTONOMY_DISABLED"], steps: 0, taskIds: [], readyTransitionRequired: false };
  }
  let state: BacklinkAutonomyDispatchState = { actorUserId: input.actorUserId, channel: input.channel };
  const taskIds: string[] = [];
  for (let steps = 0; steps < maxSteps; steps += 1) {
    const claimed = await claimNextAutomationTask(input.taskDependencies, { workspaceId: input.workspaceId, runId: input.runId, workerId: input.workerId, claimedAt: input.scheduledAt, leaseDurationSeconds: 30 });
    if (claimed.kind === "empty") return { outcome: steps === 0 ? "empty" : "blocked", reasonCodes: ["NEXT_TASK_MISSING"], steps, taskIds, readyTransitionRequired: false };
    const task = claimed.task;
    taskIds.push(task.id);
    let dispatched;
    try {
      dispatched = await dispatchBacklinkAutonomyTask(input.handlers, { task, mode: input.mode, control: input.control, state });
    } catch (error) {
      const failed = await failAutomationTask(input.taskDependencies, { workspaceId: input.workspaceId, taskId: task.id, workerId: input.workerId, failedAt: input.scheduledAt, errorCode: "BACKLINK_AUTONOMY_HANDLER_FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Backlink autonomy handler failed" });
      return { outcome: failed.kind === "dead_letter" ? "dead_letter" : "rejected", reasonCodes: ["BACKLINK_AUTONOMY_HANDLER_FAILED"], steps: steps + 1, taskIds, readyTransitionRequired: false };
    }
    if (dispatched.kind === "rejected") return { outcome: "rejected", reasonCodes: [dispatched.reason], steps: steps + 1, taskIds, readyTransitionRequired: false };
    const output = JSON.parse(JSON.stringify(dispatched.output)) as Json;
    const completed = await completeAutomationTask(input.taskDependencies, { workspaceId: input.workspaceId, taskId: task.id, workerId: input.workerId, completedAt: input.scheduledAt, output });
    if (completed.kind === "rejected") return { outcome: "rejected", reasonCodes: ["TASK_COMPLETION_REJECTED"], steps: steps + 1, taskIds, readyTransitionRequired: false };

    if (dispatched.taskKind === "backlinks.contact_resolution") {
      const contacts = [...new Set([...dispatched.output.createdContactIds, ...dispatched.output.existingContactIds])];
      if (dispatched.output.status !== "resolved" && dispatched.output.status !== "partial") return { outcome: dispatched.output.manualReviewRequired ? "manual_review" : "blocked", reasonCodes: dispatched.output.reasons, steps: steps + 1, taskIds, readyTransitionRequired: false };
      const next = await runBacklinkAutonomyOrchestrator({ createOrGetTask: input.taskDependencies.createOrGetTask }, { workspaceId: input.workspaceId, runId: input.runId, domainId: input.domainId, opportunityId: input.opportunityId, scheduledAt: input.scheduledAt, mode: input.mode, control: input.control, progress: { stage: "contact_resolution", completedTaskId: task.id, completedTaskKind: task.taskKind, contactIds: contacts } });
      const stopped = terminal(next, steps + 1, taskIds); if (stopped != null) return stopped;
      continue;
    }
    if (dispatched.taskKind === "backlinks.contact_validation") {
      if (dispatched.output.status !== "verified") return { outcome: dispatched.output.manualReviewRequired ? "manual_review" : "blocked", reasonCodes: dispatched.output.reasons, steps: steps + 1, taskIds, readyTransitionRequired: false };
      const next = await runBacklinkAutonomyOrchestrator({ createOrGetTask: input.taskDependencies.createOrGetTask }, { workspaceId: input.workspaceId, runId: input.runId, domainId: input.domainId, opportunityId: input.opportunityId, scheduledAt: input.scheduledAt, mode: input.mode, control: input.control, progress: { stage: "contact_validation", completedTaskId: task.id, completedTaskKind: task.taskKind, contactIds: [dispatched.output.contactId] } });
      const stopped = terminal(next, steps + 1, taskIds); if (stopped != null) return stopped;
      continue;
    }
    if (dispatched.taskKind === "backlinks.campaign_prepare") {
      if (dispatched.output.outcome !== "completed" || dispatched.output.campaignId == null) return { outcome: dispatched.output.outcome === "manual_review" ? "manual_review" : "blocked", reasonCodes: dispatched.output.reasons, steps: steps + 1, taskIds, readyTransitionRequired: false };
      state = { ...state, campaignId: dispatched.output.campaignId };
      const next = await runBacklinkAutonomyOrchestrator({ createOrGetTask: input.taskDependencies.createOrGetTask }, { workspaceId: input.workspaceId, runId: input.runId, domainId: input.domainId, opportunityId: input.opportunityId, scheduledAt: input.scheduledAt, mode: input.mode, control: input.control, progress: { stage: "campaign_prepare", completedTaskId: task.id, completedTaskKind: task.taskKind, contactIds: [String((task.input as Record<string, unknown>).contactId)] } });
      const stopped = terminal(next, steps + 1, taskIds); if (stopped != null) return stopped;
      continue;
    }
    if (dispatched.taskKind === "backlinks.draft_prepare") {
      if (dispatched.output.outcome !== "completed" || dispatched.output.outreachId == null) return { outcome: "blocked", reasonCodes: dispatched.output.reasons, steps: steps + 1, taskIds, readyTransitionRequired: false };
      state = { ...state, outreachId: dispatched.output.outreachId };
      const next = await runBacklinkAutonomyOrchestrator({ createOrGetTask: input.taskDependencies.createOrGetTask }, { workspaceId: input.workspaceId, runId: input.runId, domainId: input.domainId, opportunityId: input.opportunityId, scheduledAt: input.scheduledAt, mode: input.mode, control: input.control, progress: { stage: "draft_prepare", completedTaskId: task.id, completedTaskKind: task.taskKind, contactIds: [String((task.input as Record<string, unknown>).contactId)] } });
      const stopped = terminal(next, steps + 1, taskIds); if (stopped != null) return stopped;
      continue;
    }
    const next = await runBacklinkAutonomyOrchestrator({ createOrGetTask: input.taskDependencies.createOrGetTask }, { workspaceId: input.workspaceId, runId: input.runId, domainId: input.domainId, opportunityId: input.opportunityId, scheduledAt: input.scheduledAt, mode: input.mode, control: input.control, progress: { stage: "outreach_decision", completedTaskId: task.id, completedTaskKind: task.taskKind, contactIds: [String((task.input as Record<string, unknown>).contactId)], decision: dispatched.output } });
    const stopped = terminal(next, steps + 1, taskIds); if (stopped != null) return stopped;
  }
  return { outcome: "max_steps", reasonCodes: ["AUTONOMY_CYCLE_MAX_STEPS_REACHED"], steps: maxSteps, taskIds, readyTransitionRequired: false };
}
