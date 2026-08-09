import { readFile } from "node:fs/promises";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function main(): Promise<void> {
  const source = await readFile("app/api/internal/automation/backlinks/discovery/apply/route.ts", "utf8");
  for (const required of ["export async function POST", "getRequestUserAndWorkspace(request)", 'context.status === "unauthenticated"', 'context.status === "workspace_forbidden"', "isAdminPrivateEmail(context.user.email)", '["runId", "taskId", "candidateKey", "assetId"]', "Object.keys(record).length !== keys.length", "intakeBacklinkDiscoveryOpportunity", "workspaceId: context.workspace.id", "requestedBy: context.user.id", "readBacklinkDiscoveryCandidate", "getBacklinkAssetById", "resolveBacklinkDomainOpportunityTransaction", "BacklinkDiscoveryCandidateReaderError", "DiscoveryOpportunityIntakeError", "RUN_NOT_FOUND", "return NextResponse.json({ ok: true, result })"]) assert(source.includes(required), `Missing ${required}.`);
  for (const forbidden of ["body.workspaceId", "body.requestedBy", "createBacklinkDomain", "createBacklinkOpportunity", "fetch(", "stack", "error.message", "createSupabaseAdminClient"]) assert(!source.includes(forbidden), `Forbidden ${forbidden}.`);
  console.log("PASS — Automation backlink discovery opportunity intake route smoke");
}
void main();
