import { supabase } from "../supabase";

export type WorkspaceSubscription = {
  id: string;
  workspace_id: string;
  plan_code: string | null;
  status: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
} | null;

export async function ensureWorkspaceSubscription(
  workspaceId: string,
  client = supabase
): Promise<WorkspaceSubscription> {
  if (!workspaceId) {
    return null;
  }

  const { data, error } = await client
    .from("subscriptions")
    .select(
      "id,workspace_id,plan_code,status,stripe_subscription_id,current_period_end,created_at,updated_at"
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.warn("ensureWorkspaceSubscription select error", error);
    return null;
  }

  if (data) {
    return data as WorkspaceSubscription;
  }

  const { data: inserted, error: insertError } = await client
    .from("subscriptions")
    .insert({
      workspace_id: workspaceId,
      plan_code: "free",
      status: "active",
    })
    .select(
      "id,workspace_id,plan_code,status,stripe_subscription_id,current_period_end,created_at,updated_at"
    )
    .single();

  if (insertError) {
    console.warn("ensureWorkspaceSubscription insert error", insertError);
    return null;
  }

  return inserted as WorkspaceSubscription;
}
