import { supabase } from "../supabase";
import type { WorkspacePlan } from "./getWorkspacePlan";
import { getWorkspacePlan } from "./getWorkspacePlan";

export type CanCreateAuditResult = {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  limit: number | null;
  planCode: string;
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
      limit: 3,
      planCode: plan.planCode,
    };
  }

  const currentCount = count ?? 0;
  const limit = 3;

  if (currentCount >= limit) {
    return {
      allowed: false,
      reason:
        "Vous avez atteint la limite du plan gratuit. Passez au Pro pour débloquer des audits illimités.",
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
