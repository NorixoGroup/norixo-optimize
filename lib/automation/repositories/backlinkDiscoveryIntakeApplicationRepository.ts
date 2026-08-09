import type { Database } from "@/types/database.types";

type RpcName = "record_backlink_discovery_intake_application";
type RpcClient = { rpc: (name: RpcName, args: Database["public"]["Functions"][RpcName]["Args"]) => PromiseLike<{ data: unknown; error: unknown }> };

export type BacklinkDiscoveryIntakeApplicationInput = { workspaceId: string; discoveryTaskId: string; candidateKey: string; assetId: string; opportunityId: string };
export type BacklinkDiscoveryIntakeApplication = { applicationId: string; opportunityId: string };
export class BacklinkDiscoveryIntakeApplicationRepositoryError extends Error {
  constructor(readonly code: "MISMATCH" | "FAILED") { super("The discovery intake application could not be recorded."); }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export async function recordBacklinkDiscoveryIntakeApplication(client: RpcClient, input: BacklinkDiscoveryIntakeApplicationInput): Promise<BacklinkDiscoveryIntakeApplication> {
  const { data, error } = await client.rpc("record_backlink_discovery_intake_application", {
    p_workspace_id: input.workspaceId,
    p_discovery_task_id: input.discoveryTaskId,
    p_candidate_key: input.candidateKey,
    p_asset_id: input.assetId,
    p_opportunity_id: input.opportunityId,
  });
  if (error !== null) {
    const code = isRecord(error) && (error.code === "DISCOVERY_INTAKE_APPLICATION_MISMATCH" || error.message === "DISCOVERY_INTAKE_APPLICATION_MISMATCH") ? "MISMATCH" : "FAILED";
    throw new BacklinkDiscoveryIntakeApplicationRepositoryError(code);
  }
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0]) || typeof data[0].application_id !== "string" || typeof data[0].opportunity_id !== "string") {
    throw new BacklinkDiscoveryIntakeApplicationRepositoryError("FAILED");
  }
  return { applicationId: data[0].application_id, opportunityId: data[0].opportunity_id };
}
