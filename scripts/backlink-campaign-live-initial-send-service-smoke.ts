import { readFile } from "node:fs/promises";

async function main() {
  const source = await readFile("lib/backlinks/services/campaignService.ts", "utf8");
  const start = source.indexOf("export async function setCampaignLiveInitialSendEnabled");
  const end = source.indexOf("export async function addOpportunityToCampaign", start);
  if (start < 0 || end <= start) throw new Error("Narrow campaign gate service missing");
  const service = source.slice(start, end);
  for (const value of ["client: BacklinkRepositoryClient", "workspaceId: WorkspaceId", "campaignId: string", "enabled: boolean", "live_initial_send_enabled: enabled"]) if (!service.includes(value)) throw new Error(`Missing ${value}`);
  for (const forbidden of ["createBacklinkOutreachAttempt", "reserveBacklink", "sendBacklink", "outreachEmail", "provider", "autoSend"]) if (service.includes(forbidden)) throw new Error(`Forbidden ${forbidden}`);
  console.log("PASS — Backlink campaign live initial send service smoke");
}
main();
