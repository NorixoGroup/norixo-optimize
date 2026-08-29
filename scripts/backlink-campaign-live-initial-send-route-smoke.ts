import { readFile } from "node:fs/promises";

async function main() {
  const source = await readFile("app/api/backlinks/campaigns/[id]/live-initial-send/route.ts", "utf8");
  for (const value of ["export async function PATCH", "getRequestUserAndWorkspace", "isAdminPrivateEmail", "Object.keys(body).length !== 1", "typeof body.liveInitialSendEnabled !== \"boolean\"", "setCampaignLiveInitialSendEnabled", "auth.workspace.id", "liveInitialSendEnabled"]) if (!source.includes(value)) throw new Error(`Missing ${value}`);
  for (const forbidden of ["createSupabaseAdminClient", "reserve_", "sendBacklink", "outreachEmail", "Resend", "workspaceId:"]) if (source.includes(forbidden)) throw new Error(`Forbidden ${forbidden}`);
  console.log("PASS — Backlink campaign live initial send route smoke");
}
main();
