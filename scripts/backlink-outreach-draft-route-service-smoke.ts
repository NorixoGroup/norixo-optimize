import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const source = await readFile("lib/backlinks/services/outreachDraftRouteService.ts", "utf8");
  assert(source.includes("createBacklinkOutreachDraftRouteServices"), "Route service factory must exist.");
  assert(source.includes("reserveBacklinkOutreachKey(keyReservationClient"), "Reserve key must use the privileged client.");
  assert(source.includes("createBacklinkOutreach(client, input.workspaceId"), "Ordinary draft creation must keep the authenticated client.");
  assert(source.includes("createBacklinkOutreachDraftService(dependencies)"), "Draft service composition must remain intact.");
  assert(source.includes("createBacklinkOutreachDraftPreviewService(dependencies)"), "Preview service composition must remain intact.");
  console.log("PASS — Backlink outreach draft route service smoke");
}

void main();
