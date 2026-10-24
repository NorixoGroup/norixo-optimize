import { supabase } from "../supabase";
import type { WorkspacePlan } from "./getWorkspacePlan";
import { getWorkspacePlan } from "./getWorkspacePlan";
import { getWorkspaceAuditCredits } from "./getWorkspaceAuditCredits";

export type CanCreateAuditResult = {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  limit: number | null;
  planCode: string;
  /**
   * True when the free-plan allowance is used up but the workspace holds purchased credits. The credit reservation still
   * consumes one credit per audit (and refuses when none is left), so this never grants a free audit.
   */
  hasAvailableCredits?: boolean;
};

export async function canCreateAudit(workspaceId: string, client = supabase): Promise<CanCreateAuditResult> {
  if (!workspaceId) {
    return {
      allowed: true,
      reason: undefined,
      currentCount: 0,
      limit: null,
      planCode: "free",
    };
  }

  const plan: WorkspacePlan = await getWorkspacePlan(workspaceId, client);

  if (plan.planCode !== "free") {
    return {
      allowed: true,
      reason: undefined,
      currentCount: 0,
      limit: null,
      planCode: plan.planCode,
    };
  }

  const { count, error } = await client
    .from("audits")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (error) {
    console.warn("canCreateAudit count error", error);
    return {
      allowed: true,
      reason: undefined,
      currentCount: 0,
      limit: 1,
      planCode: plan.planCode,
    };
  }

  const currentCount = count ?? 0;
  const limit = 1;

  console.log("[canCreateAudit DEBUG]", {
    workspaceId,
    planCode: plan.planCode,
    auditCount: currentCount,
    limit,
    canCreate: currentCount < limit,
  });

  if (currentCount >= limit) {
    // A purchased credit must stay usable on the free plan. Each audit still needs (and consumes) one credit.
    const credits = await getWorkspaceAuditCredits(workspaceId, client);
    if (credits.available > 0) {
      return {
        allowed: true,
        reason: undefined,
        currentCount,
        limit,
        planCode: plan.planCode,
        hasAvailableCredits: true,
      };
    }

    return {
      allowed: false,
      reason:
        "Votre audit Découverte a déjà été utilisé. Passez au Pro ou à Scale pour continuer.",
      currentCount,
      limit,
      planCode: plan.planCode,
    };
  }

  return {
    allowed: true,
    reason: undefined,
    currentCount,
    limit,
    planCode: plan.planCode,
  };
}
