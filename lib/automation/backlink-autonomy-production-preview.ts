import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getBacklinkDomainById } from "@/lib/backlinks/repositories/domainsRepository";
import { getBacklinkOpportunityById } from "@/lib/backlinks/repositories/opportunitiesRepository";
import { getAutomationTaskByIdInRun } from "./repositories/automationTasksRepository";
import { listAutomationWorkspaceControlsForBacklinkAutonomy } from "./repositories/automationWorkspaceControlsRepository";
import { readBacklinkAutonomyRuntimeConfig } from "./backlink-autonomy-runtime-config";
import { runBacklinkAutonomyScheduler, type BacklinkAutonomySchedulerResult } from "./backlink-autonomy-scheduler";
import type { AppliedBacklinkPromotion } from "./backlink-promotion-resolution-entry";
import type { AutomationWorkspaceControl } from "./types";
import type { BacklinkAutonomyRuntimeConfig } from "./backlink-autonomy-runtime-config";

type PreviewClient = ReturnType<typeof createSupabaseAdminClient>;

async function listCanonicalAppliedPromotions(client: PreviewClient, workspaceId: string, limit: number): Promise<readonly AppliedBacklinkPromotion[]> {
  const { data, error } = await client.from("backlink_promotion_applications")
    .select("id, workspace_id, run_id, promotion_task_id, domain_id, opportunity_id, promoted_by")
    .eq("workspace_id", workspaceId).order("promoted_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
  if (error != null) throw new Error("BACKLINK_AUTONOMY_PREVIEW_PROMOTION_READ_FAILED");
  const valid: AppliedBacklinkPromotion[] = [];
  for (const application of data ?? []) {
    try {
      if (application.workspace_id !== workspaceId) continue;
      const [task, domain, opportunity] = await Promise.all([
        getAutomationTaskByIdInRun(client, { workspaceId, runId: application.run_id, taskId: application.promotion_task_id }),
        getBacklinkDomainById(client, workspaceId, application.domain_id),
        getBacklinkOpportunityById(client, workspaceId, application.opportunity_id),
      ]);
      if (task == null || task.taskKind !== "backlinks.promotion.preview" || task.status !== "completed" || domain.id !== application.domain_id || opportunity.id !== application.opportunity_id || opportunity.domain_id !== domain.id || domain.archived_at != null || opportunity.archived_at != null) continue;
      valid.push({ applicationId: application.id, workspaceId, runId: application.run_id, promotionTaskId: application.promotion_task_id, promotionTaskKind: "backlinks.promotion.preview", promotionTaskStatus: "completed", domainId: application.domain_id, opportunityId: application.opportunity_id, actorUserId: application.promoted_by, applied: true });
    } catch { /* A missing/invalid canonical relation is intentionally omitted. */ }
  }
  return valid;
}

export type BacklinkAutonomyProductionPreviewReads = {
  runtimeConfig: () => BacklinkAutonomyRuntimeConfig;
  listWorkspaceControls: (limit: number) => Promise<readonly AutomationWorkspaceControl[]>;
  listAppliedPromotions: (workspaceId: string, limit: number) => Promise<readonly AppliedBacklinkPromotion[]>;
  getDomain: (workspaceId: string, domainId: string) => Promise<{ id: string; workspaceId?: string; archivedAt?: string | null }>;
  getOpportunity: (workspaceId: string, opportunityId: string) => Promise<{ id: string; workspaceId?: string; domainId: string; archivedAt?: string | null }>;
};
/** Preview composition deliberately accepts only read adapters; it has no task-write surface. */
export function createBacklinkAutonomyProductionPreviewRunner(reads: BacklinkAutonomyProductionPreviewReads) {
  return (input: { workspaceLimit?: number; promotionLimitPerWorkspace?: number; now?: string } = {}) => runBacklinkAutonomyScheduler(reads, { mode: "preview", scheduledAt: input.now ?? new Date().toISOString(), workspaceLimit: input.workspaceLimit, promotionLimitPerWorkspace: input.promotionLimitPerWorkspace });
}

/** The only production-shaped autonomy entry point in G2A. */
export async function runBacklinkAutonomyProductionPreview(input: { workspaceLimit?: number; promotionLimitPerWorkspace?: number; now?: string } = {}): Promise<BacklinkAutonomySchedulerResult> {
  const client = createSupabaseAdminClient();
  return createBacklinkAutonomyProductionPreviewRunner({
    runtimeConfig: readBacklinkAutonomyRuntimeConfig,
    listWorkspaceControls: (limit) => listAutomationWorkspaceControlsForBacklinkAutonomy(client, limit),
    listAppliedPromotions: (workspaceId, limit) => listCanonicalAppliedPromotions(client, workspaceId, limit),
    getDomain: async (workspaceId, domainId) => { const row = await getBacklinkDomainById(client, workspaceId, domainId); return { id: row.id, workspaceId: row.workspace_id, archivedAt: row.archived_at }; },
    getOpportunity: async (workspaceId, opportunityId) => { const row = await getBacklinkOpportunityById(client, workspaceId, opportunityId); return { id: row.id, workspaceId: row.workspace_id, domainId: row.domain_id, archivedAt: row.archived_at }; },
  })(input);
}
