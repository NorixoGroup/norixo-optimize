import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function main(): Promise<void> {
  const [eligibility, preview, apply] = await Promise.all([
    readFile("app/api/backlinks/campaigns/[campaignId]/opportunities/[opportunityId]/outreach-eligibility/route.ts", "utf8"),
    readFile("app/api/internal/automation/backlinks/outreach/draft-preview/route.ts", "utf8"),
    readFile("app/api/internal/automation/backlinks/outreach/drafts/apply/route.ts", "utf8"),
  ]);
  for (const source of [eligibility, preview, apply]) {
    assert(source.includes("getRequestUserAndWorkspace(request)"), "Every route must authenticate.");
    assert(source.includes('auth.status === "unauthenticated"'), "Unauthenticated requests must return 401.");
    assert(source.includes('auth.status === "workspace_forbidden"'), "Forbidden workspaces must return 403.");
    assert(source.includes("isAdminPrivateEmail(auth.user.email)"), "Routes must be admin scoped.");
    assert(!source.includes("fetch("), "Routes must not call external providers.");
    assert(!source.includes("send") && !source.includes("follow-up") && !source.includes('status: "ready"') && !source.includes('status: "active"'), "Routes must not send or advance outreach.");
  }
  assert(eligibility.includes("export async function GET") && eligibility.includes("getBacklinkOutreachDraftEligibilityForMembership") && eligibility.includes("workspaceId: auth.workspace.id"), "Eligibility must be workspace-scoped read-side data.");
  assert(!eligibility.includes("createOutreach"), "Eligibility must not mutate outreach.");
  for (const source of [preview, apply]) {
    assert(source.includes('const keys = Object.keys(record)'), "Request body must be strict.");
    assert(source.includes('"campaignId", "opportunityId", "contactId", "channel"'), "Draft identity is required.");
    assert(!source.includes("record.subject") && !source.includes("record.body") && !source.includes("record.outreachKey"), "Client draft content and keys are forbidden.");
  }
  assert(preview.includes("keys.length !== 4") && preview.includes(".preview({ ...input, workspaceId: auth.workspace.id })"), "Preview must be pure and server-scoped.");
  assert(apply.includes("keys.length !== 5") && apply.includes("record.confirm === true") && apply.includes("actorUserId: auth.user.id") && apply.includes(".create({ ...input"), "Apply must require confirmation and derive actor server-side.");
  console.log("PASS — Backlink outreach draft routes smoke");
}
void main();
