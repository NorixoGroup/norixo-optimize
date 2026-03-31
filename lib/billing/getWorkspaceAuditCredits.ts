import { supabase } from "../supabase";

export type WorkspaceAuditCredits = {
  granted: number;
  consumed: number;
  available: number;
};

export async function getWorkspaceAuditCredits(
  workspaceId: string,
  client = supabase
): Promise<WorkspaceAuditCredits> {
  if (!workspaceId) {
    return {
      granted: 0,
      consumed: 0,
      available: 0,
    };
  }

  const { data, error } = await client
    .from("usage_events")
    .select("event_type, quantity")
    .eq("workspace_id", workspaceId)
    .in("event_type", ["audit_test_purchased", "audit_credit_consumed"]);

  if (error) {
    console.warn("getWorkspaceAuditCredits query error", {
      workspaceId,
      error,
    });
    return {
      granted: 0,
      consumed: 0,
      available: 0,
    };
  }

  const granted = (data ?? []).reduce((sum, row) => {
    return row.event_type === "audit_test_purchased" ? sum + (row.quantity ?? 1) : sum;
  }, 0);

  const consumed = (data ?? []).reduce((sum, row) => {
    return row.event_type === "audit_credit_consumed" ? sum + (row.quantity ?? 1) : sum;
  }, 0);

  return {
    granted,
    consumed,
    available: Math.max(granted - consumed, 0),
  };
}
