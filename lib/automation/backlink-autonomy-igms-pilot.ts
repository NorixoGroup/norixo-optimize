import { enterPromotedOpportunityContactResolution, type AppliedBacklinkPromotion, type BacklinkPromotionResolutionEntryDependencies, BACKLINK_AUTONOMY_RUN_KIND } from "./backlink-promotion-resolution-entry";
import { normalizeBacklinkAutonomyRuntimeControl } from "./backlink-autonomy-runtime-controls";
import type { AutomationRun, AutomationWorkspaceControl, CreateAutomationRunInput } from "./types";

/** This is deliberately a single, non-general-purpose pilot contract. */
export const BACKLINK_AUTONOMY_IGMS_PILOT_WORKSPACE_ID = "4e0c9c85-52f8-4432-887d-6cba524e561f";
export const BACKLINK_AUTONOMY_IGMS_PILOT_HOSTNAME = "www.igms.com";

export type BacklinkAutonomyIgmsPilotConfig = { enabled: boolean; promotionApplicationId: string | null };
export type BacklinkAutonomyIgmsPilotPromotion = AppliedBacklinkPromotion & {
  domain: { id: string; workspaceId: string; hostname: string; archivedAt: string | null };
  opportunity: { id: string; workspaceId: string; domainId: string; archivedAt: string | null };
};
export type BacklinkAutonomyIgmsPilotDependencies = BacklinkPromotionResolutionEntryDependencies & {
  getWorkspaceControl: (workspaceId: string) => Promise<AutomationWorkspaceControl | null>;
  loadPromotion: (promotionApplicationId: string) => Promise<BacklinkAutonomyIgmsPilotPromotion | null>;
  createOrGetRun: (input: CreateAutomationRunInput) => Promise<{ kind: "created" | "existing"; run: AutomationRun }>;
  runWorker: (input: { workspaceId: string; runId: string; workerId: string; at: string }) => Promise<{ kind: string }>;
};
export type BacklinkAutonomyIgmsPilotResult = {
  disposition: "disabled" | "rejected" | "already_consumed" | "completed";
  reason: string | null;
  runId: string | null;
  taskCreated: boolean;
  workerSteps: number;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Creates at most one durable run for the exact approved promotion application.
 * Existing runs are intentionally never seeded, reclaimed, or claimed here.
 */
export async function runBacklinkAutonomyIgmsPilot(
  deps: BacklinkAutonomyIgmsPilotDependencies,
  input: { config: BacklinkAutonomyIgmsPilotConfig; at: string; workerId: string },
): Promise<BacklinkAutonomyIgmsPilotResult> {
  const selector = input.config.promotionApplicationId;
  if (input.config.enabled !== true) return { disposition: "disabled", reason: "IGMS_PILOT_DISABLED", runId: null, taskCreated: false, workerSteps: 0 };
  if (selector == null || !uuid.test(selector)) return { disposition: "rejected", reason: "PROMOTION_APPLICATION_ID_INVALID", runId: null, taskCreated: false, workerSteps: 0 };

  const promotion = await deps.loadPromotion(selector);
  if (
    promotion == null || promotion.applicationId !== selector ||
    promotion.workspaceId !== BACKLINK_AUTONOMY_IGMS_PILOT_WORKSPACE_ID ||
    promotion.domain.workspaceId !== promotion.workspaceId || promotion.opportunity.workspaceId !== promotion.workspaceId ||
    promotion.domain.id !== promotion.domainId || promotion.opportunity.id !== promotion.opportunityId ||
    promotion.opportunity.domainId !== promotion.domainId || promotion.domain.hostname !== BACKLINK_AUTONOMY_IGMS_PILOT_HOSTNAME ||
    promotion.domain.archivedAt != null || promotion.opportunity.archivedAt != null ||
    promotion.applied !== true || promotion.promotionTaskKind !== "backlinks.promotion.preview" || promotion.promotionTaskStatus !== "completed"
  ) return { disposition: "rejected", reason: "PROMOTION_APPLICATION_NOT_IGMS_PILOT_ELIGIBLE", runId: null, taskCreated: false, workerSteps: 0 };

  const control = normalizeBacklinkAutonomyRuntimeControl({
    runtime: { autonomyEnabled: true, paidMailboxVerificationAuthorized: false },
    workspace: await deps.getWorkspaceControl(promotion.workspaceId),
  });
  if (control.backlinkAutonomyEnabled !== true) return { disposition: "rejected", reason: "WORKSPACE_AUTONOMY_DISABLED", runId: null, taskCreated: false, workerSteps: 0 };
  if (control.dryRunOnly !== true) return { disposition: "rejected", reason: "PILOT_DRY_RUN_REQUIRED", runId: null, taskCreated: false, workerSteps: 0 };

  const run = await deps.createOrGetRun({
    workspaceId: promotion.workspaceId, system: "backlinks", runKind: BACKLINK_AUTONOMY_RUN_KIND,
    // The database uniqueness constraint makes this claim atomic across concurrent invocations.
    idempotencyKey: `backlinks-autonomy:igms-pilot:${promotion.applicationId}:once`,
    mode: "dry_run", triggerSource: "manual", requestedBy: promotion.actorUserId, scheduledAt: input.at,
    input: { version: 1, pilot: "igms-once", promotionApplicationId: promotion.applicationId, promotionRunId: promotion.runId, promotionTaskId: promotion.promotionTaskId, opportunityId: promotion.opportunityId, domainId: promotion.domainId },
  });
  // Most important pilot invariant: the loser (and every later caller) touches no task or worker.
  if (run.kind !== "created") return { disposition: "already_consumed", reason: "IGMS_PILOT_RUN_ALREADY_EXISTS", runId: run.run.id, taskCreated: false, workerSteps: 0 };

  const seeded = await enterPromotedOpportunityContactResolution(deps, { promotion, autonomyRunId: run.run.id, control, mode: "apply", scheduledAt: input.at });
  if (seeded.outcome !== "task_created") return { disposition: "completed", reason: seeded.reasons[0] ?? "PILOT_TASK_NOT_CREATED", runId: run.run.id, taskCreated: false, workerSteps: 0 };
  let workerSteps = 0;
  // Fixed local bound; unlike the general tick there is no reclaim path.
  for (let step = 0; step < 3; step += 1) {
    const result = await deps.runWorker({ workspaceId: promotion.workspaceId, runId: run.run.id, workerId: input.workerId, at: input.at });
    workerSteps += 1;
    if (result.kind === "empty" || result.kind === "disabled") break;
  }
  return { disposition: "completed", reason: null, runId: run.run.id, taskCreated: true, workerSteps };
}
