import type { AutomationTask, CreateAutomationTaskInput } from "./types";
import { dispatchBacklinkAutonomyTask, type BacklinkAutonomyDispatcherDependencies } from "./backlink-autonomy-dispatcher";
import { enterPromotedOpportunityContactResolution, type AppliedBacklinkPromotion, type BacklinkPromotionResolutionEntryDependencies } from "./backlink-promotion-resolution-entry";
import { normalizeBacklinkAutonomyRuntimeControl, type BacklinkAutonomyRuntimeControl } from "./backlink-autonomy-runtime-controls";
import { readBacklinkAutonomyRuntimeConfig, type BacklinkAutonomyRuntimeConfig } from "./backlink-autonomy-runtime-config";
import type { AutomationWorkspaceControl } from "./types";

export type ClosedBacklinkAutonomyMode = "preview" | "apply" | "live";
export type ClosedBacklinkAutonomyRuntimeDependencies = {
  getWorkspaceControl: (workspaceId: string) => Promise<AutomationWorkspaceControl | null>;
  entry: BacklinkPromotionResolutionEntryDependencies;
  handlers: BacklinkAutonomyDispatcherDependencies;
  runtimeConfig?: () => BacklinkAutonomyRuntimeConfig;
};
export type ClosedBacklinkAutonomyRuntime = {
  getControl: (workspaceId: string, campaignApplyAuthorized?: boolean) => Promise<BacklinkAutonomyRuntimeControl>;
  previewPromotionEntry: (input: { promotion: AppliedBacklinkPromotion; scheduledAt: string }) => Promise<{ control: BacklinkAutonomyRuntimeControl; task: CreateAutomationTaskInput | null; reasons: readonly string[] }>;
  dispatchClaimedTask: (input: { task: AutomationTask; mode: Exclude<ClosedBacklinkAutonomyMode, "preview">; actorUserId: string; campaignId?: string; outreachId?: string; channel?: "email" | "contact_form" | "linkedin"; campaignApplyAuthorized?: boolean }) => Promise<{ kind: "rejected"; reason: string } | { kind: "executed"; taskKind: string; output: unknown }>;
};

/**
 * Closed composition only. It is intentionally not imported by the active
 * worker, production composition, route, or scheduler. Legacy schedule-apply
 * remains a separate dry_run_only=true mechanism.
 */
export function createClosedBacklinkAutonomyRuntime(deps: ClosedBacklinkAutonomyRuntimeDependencies): ClosedBacklinkAutonomyRuntime {
  const runtimeConfig = deps.runtimeConfig ?? readBacklinkAutonomyRuntimeConfig;
  const getControl = async (workspaceId: string, campaignApplyAuthorized?: boolean) => normalizeBacklinkAutonomyRuntimeControl({ runtime: runtimeConfig(), workspace: await deps.getWorkspaceControl(workspaceId), campaignApplyAuthorized });
  return {
    getControl,
    async previewPromotionEntry(input) {
      const control = await getControl(input.promotion.workspaceId);
      const result = await enterPromotedOpportunityContactResolution(deps.entry, { promotion: input.promotion, autonomyRunId: `preview:${input.promotion.applicationId}`, control, mode: "preview", scheduledAt: input.scheduledAt });
      return { control, task: result.task, reasons: result.reasons };
    },
    async dispatchClaimedTask(input) {
      const control = await getControl(input.task.workspaceId, input.campaignApplyAuthorized);
      const result = await dispatchBacklinkAutonomyTask(deps.handlers, { task: input.task, mode: input.mode, control, state: { actorUserId: input.actorUserId, campaignId: input.campaignId, outreachId: input.outreachId, channel: input.channel } });
      return result.kind === "rejected" ? result : { kind: "executed", taskKind: result.taskKind, output: result.output };
    },
  };
}
