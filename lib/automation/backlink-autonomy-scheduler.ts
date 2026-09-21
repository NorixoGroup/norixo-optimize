import type { AutomationRun, AutomationWorkspaceControl, CreateAutomationRunInput, CreateAutomationTaskInput } from "./types";
import type { AppliedBacklinkPromotion, BacklinkPromotionResolutionEntryDependencies } from "./backlink-promotion-resolution-entry";
import { buildBacklinkAutonomyRun, enterPromotedOpportunityContactResolution } from "./backlink-promotion-resolution-entry";
import { normalizeBacklinkAutonomyRuntimeControl } from "./backlink-autonomy-runtime-controls";
import type { BacklinkAutonomyRuntimeConfig } from "./backlink-autonomy-runtime-config";

export type BacklinkAutonomySchedulerMode = "preview" | "apply" | "live";
export type BacklinkAutonomySchedulerDependencies = Omit<BacklinkPromotionResolutionEntryDependencies, "createOrGetTask"> & {
  createOrGetTask?: BacklinkPromotionResolutionEntryDependencies["createOrGetTask"];
  createOrGetRun?: (input: CreateAutomationRunInput) => Promise<{ kind: "created" | "existing"; run: AutomationRun }>;
  runtimeConfig: () => BacklinkAutonomyRuntimeConfig;
  listWorkspaceControls: (limit: number) => Promise<readonly AutomationWorkspaceControl[]>;
  listAppliedPromotions: (workspaceId: string, limit: number) => Promise<readonly AppliedBacklinkPromotion[]>;
};
export type BacklinkAutonomySchedulerResult = {
  outcome: "disabled" | "preview" | "applied" | "live_unsupported";
  workspacesScanned: number;
  promotionsScanned: number;
  proposed: readonly CreateAutomationTaskInput[];
  autonomyRunIds: readonly string[];
  autonomyRuns: readonly { workspaceId: string; runId: string }[];
  created: number;
  existing: number;
  skipped: readonly string[];
};

/** Bounded task seeder only. It never claims or executes a task. */
export async function runBacklinkAutonomyScheduler(
  deps: BacklinkAutonomySchedulerDependencies,
  input: { mode?: BacklinkAutonomySchedulerMode; scheduledAt: string; workspaceLimit?: number; promotionLimitPerWorkspace?: number },
): Promise<BacklinkAutonomySchedulerResult> {
  const empty = (outcome: BacklinkAutonomySchedulerResult["outcome"]): BacklinkAutonomySchedulerResult => ({ outcome, workspacesScanned: 0, promotionsScanned: 0, proposed: [], autonomyRunIds: [], autonomyRuns: [], created: 0, existing: 0, skipped: [] });
  const mode = input.mode ?? "preview";
  if (mode === "live") return empty("live_unsupported");
  if (deps.runtimeConfig().autonomyEnabled !== true) return empty("disabled");
  const workspaceLimit = input.workspaceLimit ?? 25, promotionLimit = input.promotionLimitPerWorkspace ?? 25;
  if (!Number.isInteger(workspaceLimit) || workspaceLimit < 1 || workspaceLimit > 100 || !Number.isInteger(promotionLimit) || promotionLimit < 1 || promotionLimit > 100) throw new Error("BACKLINK_AUTONOMY_SCHEDULER_LIMIT_INVALID");
  const controls = (await deps.listWorkspaceControls(workspaceLimit)).slice().sort((a, b) => a.workspaceId.localeCompare(b.workspaceId));
  const proposed: CreateAutomationTaskInput[] = [], autonomyRunIds: string[] = [], autonomyRuns: { workspaceId: string; runId: string }[] = [], skipped: string[] = []; let promotionsScanned = 0, created = 0, existing = 0;
  for (const workspace of controls) {
    const control = normalizeBacklinkAutonomyRuntimeControl({ runtime: deps.runtimeConfig(), workspace });
    if (control.backlinkAutonomyEnabled !== true) { skipped.push(`WORKSPACE_DISABLED:${workspace.workspaceId}`); continue; }
    const promotions = (await deps.listAppliedPromotions(workspace.workspaceId, promotionLimit)).slice().sort((a, b) => a.applicationId.localeCompare(b.applicationId));
    for (const promotion of promotions) {
      promotionsScanned += 1;
      if (promotion.applied !== true || promotion.promotionTaskKind !== "backlinks.promotion.preview" || promotion.promotionTaskStatus !== "completed") {
        skipped.push(`PROMOTION_APPLICATION_NOT_COMPLETED:${promotion.applicationId}`);
        continue;
      }
      if (mode === "apply" && deps.createOrGetRun == null) {
        skipped.push(`RUN_PERSISTENCE_NOT_CONFIGURED:${promotion.applicationId}`);
        continue;
      }
      const run = mode === "preview"
        ? null
        : await deps.createOrGetRun!(buildBacklinkAutonomyRun({ promotion, scheduledAt: input.scheduledAt }));
      const autonomyRunId = run?.run.id ?? `preview:${promotion.applicationId}`;
      if (run != null) { autonomyRunIds.push(run.run.id); autonomyRuns.push({ workspaceId: promotion.workspaceId, runId: run.run.id }); }
      const result = await enterPromotedOpportunityContactResolution(deps, { promotion, autonomyRunId, control, mode, scheduledAt: input.scheduledAt });
      if (result.task != null) proposed.push(result.task);
      if (result.outcome === "task_created") created += 1;
      if (result.outcome === "task_existing") existing += 1;
      if (result.outcome === "blocked" || result.outcome === "disabled") skipped.push(`${result.reasons.join(",")}:${promotion.applicationId}`);
    }
  }
  const uniqueRuns = [...new Map(autonomyRuns.map((value) => [`${value.workspaceId}:${value.runId}`, value])).values()];
  return { outcome: mode === "preview" ? "preview" : "applied", workspacesScanned: controls.length, promotionsScanned, proposed, autonomyRunIds: [...new Set(autonomyRunIds)], autonomyRuns: uniqueRuns, created, existing, skipped };
}
