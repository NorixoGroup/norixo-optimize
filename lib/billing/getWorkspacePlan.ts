import { supabase } from "../supabase";
import { ensureWorkspaceSubscription } from "./ensureWorkspaceSubscription";

export type WorkspacePlan = {
  planCode: string;
  status: string;
};

export async function getWorkspacePlan(workspaceId: string, client = supabase): Promise<WorkspacePlan> {
  if (!workspaceId) {
    console.log("[getWorkspacePlan DEBUG]", {
      workspaceId,
      subscriptionRow: null,
      planCode: "free",
      resolvedPlan: { planCode: "free", status: "active" },
    });
    return { planCode: "free", status: "active" };
  }

  const subscription = await ensureWorkspaceSubscription(workspaceId, client);

  if (!subscription) {
    console.log("[getWorkspacePlan DEBUG]", {
      workspaceId,
      subscriptionRow: null,
      planCode: "free",
      resolvedPlan: { planCode: "free", status: "active" },
    });
    return { planCode: "free", status: "active" };
  }

  const planCode = subscription.plan_code ?? "free";
  const status = subscription.status ?? "active";

  const resolvedPlan: WorkspacePlan = {
    planCode,
    status,
  };

  console.log("[getWorkspacePlan DEBUG]", {
    workspaceId,
    subscriptionRow: subscription,
    planCode,
    resolvedPlan,
  });

  return resolvedPlan;
}
