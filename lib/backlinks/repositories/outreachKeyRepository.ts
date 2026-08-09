import type { Database } from "@/types/database.types";

type Client = { rpc: (name: "reserve_backlink_outreach_key", args: Database["public"]["Functions"]["reserve_backlink_outreach_key"]["Args"]) => PromiseLike<{ data: string | null; error: unknown }> };

export async function reserveBacklinkOutreachKey(client: Client, workspaceId: string): Promise<string> {
  const { data, error } = await client.rpc("reserve_backlink_outreach_key", { p_workspace_id: workspaceId });
  if (error !== null || typeof data !== "string" || !/^BL-OUT-[0-9]{4}-[0-9]{3,}$/.test(data)) throw new Error("BACKLINK_OUTREACH_KEY_RESERVATION_FAILED");
  return data;
}
