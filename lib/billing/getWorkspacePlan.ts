import { supabase } from "../supabase";
import { ensureWorkspaceSubscription } from "./ensureWorkspaceSubscription";

export type WorkspacePlan = {
  planCode: string;
  status: string;
};

export async function getWorkspacePlan(workspaceId: string, client = supabase): Promise<WorkspacePlan> {
  if (!workspaceId) {
    return { planCode: "free", status: "active" };
  }

  const subscription = await ensureWorkspaceSubscription(workspaceId, client);

  if (!subscription) {
    return { planCode: "free", status: "active" };
  }

  return {
    planCode: subscription.plan_code ?? "free",
    status: subscription.status ?? "active",
  };
}
