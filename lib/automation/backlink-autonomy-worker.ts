import { completeAutomationTask, failAutomationTask } from "./task-service";
import type { AutomationTask, AutomationTaskDependencies } from "./types";
import { dispatchBacklinkAutonomyTask, type BacklinkAutonomyDispatcherDependencies } from "./backlink-autonomy-dispatcher";
import { normalizeBacklinkAutonomyRuntimeControl } from "./backlink-autonomy-runtime-controls";
import type { BacklinkAutonomyRuntimeConfig } from "./backlink-autonomy-runtime-config";
import { runBacklinkAutonomyOrchestrator } from "./backlink-master-autonomy-orchestrator";
import type { Json } from "@/types/database.types";

export const BACKLINK_AUTONOMY_TASK_KINDS = ["backlinks.contact_resolution", "backlinks.contact_validation", "backlinks.campaign_prepare", "backlinks.draft_prepare", "backlinks.outreach_decision"] as const;
export type BacklinkAutonomyWorkerDependencies = AutomationTaskDependencies & BacklinkAutonomyDispatcherDependencies & {
  runtimeConfig: () => BacklinkAutonomyRuntimeConfig;
  getWorkspaceControl: (workspaceId: string) => Promise<import("./types").AutomationWorkspaceControl | null>;
  /** Must apply the allowed-kind SQL filter before claiming; never use generic global claim. */
  claimNextAllowedTask: (input: { workspaceId: string; runId: string; workerId: string; claimedAt: string; leaseDurationSeconds: number; taskKinds: readonly string[] }) => Promise<AutomationTask | null>;
  getDependencyOutput: (task: AutomationTask) => Promise<Record<string, unknown> | null>;
  /** Canonical trusted actor resolution; no synthetic actor is permitted. */
  getActorUserId: (input: { workspaceId: string; task: AutomationTask }) => Promise<string | null>;
  campaignApplyAuthorized?: (input: { workspaceId: string; task: AutomationTask }) => Promise<boolean>;
};
export type BacklinkAutonomyWorkerResult = { kind: "disabled" | "empty" | "completed" | "retried" | "dead_letter" | "terminal"; reasonCodes: readonly string[]; taskId: string | null; nextTaskId: string | null };
function record(value: unknown): Record<string, unknown> | null { return typeof value === "object" && value != null && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function string(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }

/** Claims at most one pre-filtered autonomy task; it never invokes outbound executors. */
export async function runOneBacklinkAutonomyWorkerTask(deps: BacklinkAutonomyWorkerDependencies, input: { workspaceId: string; runId: string; workerId: string; at: string }): Promise<BacklinkAutonomyWorkerResult> {
  if (deps.runtimeConfig().autonomyEnabled !== true) return { kind: "disabled", reasonCodes: ["BACKLINK_AUTONOMY_DISABLED"], taskId: null, nextTaskId: null };
  const task = await deps.claimNextAllowedTask({ workspaceId: input.workspaceId, runId: input.runId, workerId: input.workerId, claimedAt: input.at, leaseDurationSeconds: 30, taskKinds: BACKLINK_AUTONOMY_TASK_KINDS });
  if (task == null) return { kind: "empty", reasonCodes: [], taskId: null, nextTaskId: null };
  const control = normalizeBacklinkAutonomyRuntimeControl({ runtime: deps.runtimeConfig(), workspace: await deps.getWorkspaceControl(task.workspaceId), campaignApplyAuthorized: await deps.campaignApplyAuthorized?.({ workspaceId: task.workspaceId, task }) === true });
  if (control.backlinkAutonomyEnabled !== true) {
    const failed = await failAutomationTask(deps, { workspaceId: task.workspaceId, taskId: task.id, workerId: input.workerId, failedAt: input.at, errorCode: "BACKLINK_AUTONOMY_DISABLED", errorMessage: "Backlink autonomy is disabled." });
    return { kind: failed.kind === "rejected" ? "terminal" : failed.kind, reasonCodes: ["BACKLINK_AUTONOMY_DISABLED"], taskId: task.id, nextTaskId: null };
  }
  try {
    const dependency = await deps.getDependencyOutput(task);
    const actorUserId = string(record(task.input)?.actorUserId) ?? await deps.getActorUserId({ workspaceId: task.workspaceId, task });
    if (actorUserId == null) return { kind: "terminal", reasonCodes: ["AUTONOMY_ACTOR_MISSING"], taskId: task.id, nextTaskId: null };
    const dispatched = await dispatchBacklinkAutonomyTask(deps, { task, mode: "apply", control, state: { actorUserId, campaignId: string(dependency?.campaignId) ?? undefined, outreachId: string(dependency?.outreachId) ?? undefined, channel: (dependency?.channel === "email" || dependency?.channel === "contact_form" || dependency?.channel === "linkedin") ? dependency.channel : "email" } });
    if (dispatched.kind === "rejected") return { kind: "terminal", reasonCodes: [dispatched.reason], taskId: task.id, nextTaskId: null };
    const output = record(dispatched.output) ?? {};
    const contactIds = dispatched.taskKind === "backlinks.contact_resolution" ? [...new Set([...(dispatched.output.createdContactIds), ...(dispatched.output.existingContactIds)])] : [string(record(task.input)?.contactId)].filter((id): id is string => id != null);
    const stage = dispatched.taskKind.replace("backlinks.", "") as "contact_resolution" | "contact_validation" | "campaign_prepare" | "draft_prepare" | "outreach_decision";
    const decision = dispatched.taskKind === "backlinks.outreach_decision" ? dispatched.output : undefined;
    const next = await runBacklinkAutonomyOrchestrator({ createOrGetTask: deps.createOrGetTask }, { workspaceId: task.workspaceId, runId: task.runId, domainId: string(record(task.input)?.domainId) ?? "", opportunityId: string(record(task.input)?.opportunityId) ?? "", scheduledAt: input.at, mode: "apply", control, progress: { stage, completedTaskId: task.id, completedTaskKind: task.taskKind, contactIds, decision } });
    if (next.outcome === "task_created" || next.outcome === "task_existing") {
      await completeAutomationTask(deps, { workspaceId: task.workspaceId, taskId: task.id, workerId: input.workerId, completedAt: input.at, output: JSON.parse(JSON.stringify(dispatched.output)) as Json });
      return { kind: "completed", reasonCodes: [], taskId: task.id, nextTaskId: next.taskId };
    }
    await completeAutomationTask(deps, { workspaceId: task.workspaceId, taskId: task.id, workerId: input.workerId, completedAt: input.at, output: JSON.parse(JSON.stringify(dispatched.output)) as Json });
    return { kind: "terminal", reasonCodes: next.reasonCodes, taskId: task.id, nextTaskId: null };
  } catch (error) {
    const failed = await failAutomationTask(deps, { workspaceId: task.workspaceId, taskId: task.id, workerId: input.workerId, failedAt: input.at, errorCode: "BACKLINK_AUTONOMY_HANDLER_FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Backlink autonomy worker failed." });
    return { kind: failed.kind === "rejected" ? "terminal" : failed.kind, reasonCodes: ["BACKLINK_AUTONOMY_HANDLER_FAILED"], taskId: task.id, nextTaskId: null };
  }
}
