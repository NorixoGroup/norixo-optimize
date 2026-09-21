import type { CreateAutomationTaskInput } from "./types";
import { buildContactResolutionTask } from "./backlink-autonomy-foundation";

export type BacklinkPromotionResolutionMode = "preview" | "apply" | "live";

/**
 * This is the durable result of the canonical promotion-apply transaction.
 * A preview, an opportunity row, or an uncommitted proposal is deliberately
 * insufficient to enter autonomous contact resolution.
 */
export type AppliedBacklinkPromotion = {
  applicationId: string;
  workspaceId: string;
  runId: string;
  promotionTaskId: string;
  promotionTaskKind: "backlinks.promotion.preview";
  promotionTaskStatus: "completed";
  domainId: string;
  opportunityId: string;
  actorUserId: string;
  applied: true;
};

export type BacklinkPromotionResolutionControl = {
  backlinksEnabled: boolean;
  disabledReason: string | null;
  backlinkAutonomyEnabled: boolean;
};

export type BacklinkPromotionResolutionEntryDependencies = {
  getDomain: (workspaceId: string, domainId: string) => Promise<{ id: string; workspaceId?: string; archivedAt?: string | null }>;
  getOpportunity: (workspaceId: string, opportunityId: string) => Promise<{ id: string; workspaceId?: string; domainId: string; archivedAt?: string | null }>;
  createOrGetTask?: (input: CreateAutomationTaskInput) => Promise<{ kind: "created" | "existing"; task: { id: string } }>;
};

export type BacklinkPromotionResolutionEntryResult = {
  outcome: "disabled" | "blocked" | "preview" | "task_created" | "task_existing";
  reasons: readonly string[];
  task: CreateAutomationTaskInput | null;
  taskId: string | null;
};

function stopped(outcome: "disabled" | "blocked", reason: string): BacklinkPromotionResolutionEntryResult {
  return { outcome, reasons: [reason], task: null, taskId: null };
}

/**
 * Closed bridge from a committed promotion application to an idempotent
 * resolution task. It is intentionally unreferenced by production composition.
 */
export async function enterPromotedOpportunityContactResolution(
  deps: BacklinkPromotionResolutionEntryDependencies,
  input: { promotion: AppliedBacklinkPromotion; control: BacklinkPromotionResolutionControl; mode: BacklinkPromotionResolutionMode; scheduledAt: string },
): Promise<BacklinkPromotionResolutionEntryResult> {
  const { promotion, control } = input;
  if (control.backlinksEnabled !== true) return stopped("disabled", "BACKLINKS_DISABLED");
  if (control.disabledReason != null) return stopped("disabled", "AUTOMATION_DISABLED_REASON");
  if (control.backlinkAutonomyEnabled !== true) return stopped("disabled", "BACKLINK_AUTONOMY_DISABLED");
  if (promotion.applied !== true || promotion.promotionTaskKind !== "backlinks.promotion.preview" || promotion.promotionTaskStatus !== "completed") {
    return stopped("blocked", "PROMOTION_APPLICATION_NOT_COMPLETED");
  }
  const [domain, opportunity] = await Promise.all([
    deps.getDomain(promotion.workspaceId, promotion.domainId),
    deps.getOpportunity(promotion.workspaceId, promotion.opportunityId),
  ]);
  if (
    domain.id !== promotion.domainId || opportunity.id !== promotion.opportunityId || opportunity.domainId !== domain.id ||
    domain.workspaceId !== undefined && domain.workspaceId !== promotion.workspaceId ||
    opportunity.workspaceId !== undefined && opportunity.workspaceId !== promotion.workspaceId ||
    domain.archivedAt != null || opportunity.archivedAt != null
  ) return stopped("blocked", "PROMOTION_DOMAIN_OPPORTUNITY_SCOPE_INVALID");

  const task = buildContactResolutionTask({
    workspaceId: promotion.workspaceId,
    runId: promotion.runId,
    dependsOnTaskId: promotion.promotionTaskId,
    domainId: promotion.domainId,
    opportunityId: promotion.opportunityId,
    actorUserId: promotion.actorUserId,
    scheduledAt: input.scheduledAt,
  });
  if (input.mode === "preview") return { outcome: "preview", reasons: [], task, taskId: null };
  if (input.mode !== "apply" && input.mode !== "live") return stopped("disabled", "AUTONOMY_MODE_DISABLED");
  if (deps.createOrGetTask == null) return stopped("blocked", "TASK_PERSISTENCE_NOT_CONFIGURED");
  const result = await deps.createOrGetTask(task);
  return { outcome: result.kind === "created" ? "task_created" : "task_existing", reasons: [], task, taskId: result.task.id };
}
