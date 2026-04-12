import { supabase } from "../supabase";

export type WorkspaceAuditCredits = {
  granted: number;
  consumed: number;
  available: number;
};

function normalizeCredits(granted: number, consumed: number): WorkspaceAuditCredits {
  return {
    granted,
    consumed,
    available: Math.max(granted - consumed, 0),
  };
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return "code" in error && String((error as { code?: unknown }).code) === "42P01";
}

async function getUsageEventCredits(
  workspaceId: string,
  client = supabase
): Promise<WorkspaceAuditCredits | null> {
  const { data, error } = await client
    .from("usage_events")
    .select("event_type, quantity")
    .eq("workspace_id", workspaceId)
    .in("event_type", [
      "audit_test_purchased",
      "audit_credit_granted",
      "audit_credit_consumed",
    ]);

  if (error) {
    console.warn("getWorkspaceAuditCredits usage_events query error", {
      workspaceId,
      error,
    });
    return null;
  }

  const granted = (data ?? []).reduce((sum, row) => {
    return row.event_type === "audit_test_purchased" || row.event_type === "audit_credit_granted"
      ? sum + (row.quantity ?? 1)
      : sum;
  }, 0);

  const consumed = (data ?? []).reduce((sum, row) => {
    return row.event_type === "audit_credit_consumed" ? sum + (row.quantity ?? 1) : sum;
  }, 0);

  return normalizeCredits(granted, consumed);
}

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

  const { data: lotsData, error: lotsError } = await client
    .from("audit_credit_lots")
    .select("granted_quantity, consumed_quantity")
    .eq("workspace_id", workspaceId);

  if (lotsError) {
    if (!isMissingRelationError(lotsError)) {
      console.warn("getWorkspaceAuditCredits audit_credit_lots query error", {
        workspaceId,
        error: lotsError,
      });
    }

    const usageCredits = await getUsageEventCredits(workspaceId, client);
    return usageCredits ?? normalizeCredits(0, 0);
  }

  const lotGranted = (lotsData ?? []).reduce(
    (sum, row) => sum + Math.max(row.granted_quantity ?? 0, 0),
    0
  );
  const lotConsumed = (lotsData ?? []).reduce(
    (sum, row) => sum + Math.max(row.consumed_quantity ?? 0, 0),
    0
  );
  const lotCredits = normalizeCredits(lotGranted, lotConsumed);

  const usageCredits = await getUsageEventCredits(workspaceId, client);

  if (!usageCredits) {
    return lotCredits;
  }

  const shouldFallbackToUsage =
    (lotCredits.granted === 0 && lotCredits.consumed === 0) ||
    lotCredits.granted < usageCredits.granted ||
    lotCredits.consumed < usageCredits.consumed;

  if (shouldFallbackToUsage) {
    console.info("getWorkspaceAuditCredits fallback to usage_events", {
      workspaceId,
      lotGranted: lotCredits.granted,
      lotConsumed: lotCredits.consumed,
      usageGranted: usageCredits.granted,
      usageConsumed: usageCredits.consumed,
    });
    return usageCredits;
  }

  return lotCredits;
}
