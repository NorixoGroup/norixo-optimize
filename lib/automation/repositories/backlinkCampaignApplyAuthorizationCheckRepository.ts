import type { Database } from "@/types/database.types";

type CheckRpcName = "is_backlink_campaign_apply_authorized";
type CheckRpcArgs = Database["public"]["Functions"][CheckRpcName]["Args"];

type CheckRpcClient = {
  rpc: (
    functionName: CheckRpcName,
    args: CheckRpcArgs,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Unattended, read-only, never-cached authorization check. A malformed
 * workspaceId or any RPC-level failure fails closed (false) — never throws —
 * so a transient error can only ever stop campaign preparation, never
 * silently allow it.
 */
export async function isBacklinkCampaignApplyAuthorized(
  client: CheckRpcClient,
  workspaceId: string,
): Promise<boolean> {
  if (typeof workspaceId !== "string" || !UUID_PATTERN.test(workspaceId)) return false;

  const { data, error } = await client.rpc("is_backlink_campaign_apply_authorized", {
    p_workspace_id: workspaceId,
  });

  if (error !== null) return false;
  return data === true;
}
