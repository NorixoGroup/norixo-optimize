import {
  BacklinkDiscoveryIntakeApplicationRepositoryError,
  recordBacklinkDiscoveryIntakeApplication,
} from "../lib/automation/repositories/backlinkDiscoveryIntakeApplicationRepository";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

const input = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  discoveryTaskId: "00000000-0000-4000-8000-000000000002",
  candidateKey: "discovery:one",
  assetId: "00000000-0000-4000-8000-000000000003",
  opportunityId: "00000000-0000-4000-8000-000000000004",
};

async function main(): Promise<void> {
  const calls: unknown[] = [];
  const client = {
    async rpc(_name: "record_backlink_discovery_intake_application", args: unknown) {
      calls.push(args);
      return { data: [{ application_id: "00000000-0000-4000-8000-000000000005", opportunity_id: input.opportunityId }], error: null };
    },
  };
  const first = await recordBacklinkDiscoveryIntakeApplication(client, input);
  const second = await recordBacklinkDiscoveryIntakeApplication(client, input);
  assert(first.applicationId === second.applicationId && first.opportunityId === input.opportunityId, "Same identity must return the canonical mapping.");
  assert(JSON.stringify(calls[0]) === JSON.stringify({ p_workspace_id: input.workspaceId, p_discovery_task_id: input.discoveryTaskId, p_candidate_key: input.candidateKey, p_asset_id: input.assetId, p_opportunity_id: input.opportunityId }), "RPC identity must be exact.");
  const differentAsset = await recordBacklinkDiscoveryIntakeApplication(client, { ...input, assetId: "00000000-0000-4000-8000-000000000006" });
  assert(differentAsset.opportunityId === input.opportunityId, "A different asset identity remains independently valid.");
  try {
    await recordBacklinkDiscoveryIntakeApplication({ async rpc() { return { data: null, error: { code: "DISCOVERY_INTAKE_APPLICATION_MISMATCH" } }; } }, input);
  } catch (error) {
    assert(error instanceof BacklinkDiscoveryIntakeApplicationRepositoryError && error.code === "MISMATCH", "Conflicting opportunity mapping must be explicit.");
    console.log("PASS — Automation backlink discovery intake application repository smoke");
    return;
  }
  throw new Error("Expected mapping conflict.");
}

void main();
