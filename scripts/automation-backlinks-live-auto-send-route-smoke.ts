import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const route = await readFile(
    "app/api/internal/automation/backlinks/outreach/send-one/route.ts",
    "utf8",
  );
  const service = await readFile(
    "lib/automation/backlink-outreach-live-auto-send-service.ts",
    "utf8",
  );

  for (const required of [
    "export async function POST(request: NextRequest)",
    "WORKSPACE_ID_HEADER = \"X-Norixo-Workspace-Id\"",
    "getRequestUserAndWorkspace(request)",
    "isAdminPrivateEmail(auth.user.email)",
    "createSupabaseAdminClient()",
    "automation_workspace_controls",
    "backlinks_enabled",
    "backlink_outreach_schedule_apply_enabled",
    "dry_run_only",
    "disabled_reason",
    "LIVE_AUTO_SEND_NOT_ENABLED",
    "confirm: true",
    "outreachId",
    "createEnvironmentOutreachEmailProvider()",
    "getBacklinkOutreachReplyTokenKeyring()",
    "sendBacklinkOutreachEmail(",
    "getCandidateById:",
    "listBacklinkOutreachLiveAutoSendCandidates(",
    "runBacklinkOutreachLiveAutoSend(",
    "BacklinkOutreachLiveAutoSendError",
  ]) {
    assert(route.includes(required) || service.includes(required), `Missing ${required}`);
  }

  for (const forbidden of [
    "vercel.json",
    "runBacklinksSchedulerTick(",
    "schedule/apply",
    "follow-up-send",
    "sendBacklinkOutreachFollowUpEmail",
    "tick/route",
    "prepare/route",
    "draft-preview",
    "backlink_outreach_schedule_apply_enabled && dryRunOnly",
  ]) {
    assert(!route.includes(forbidden), `Forbidden ${forbidden}`);
  }

  assert(route.includes("BacklinkOutreachLiveAutoSendError"), "The route must map live auto-send errors.");
  assert(route.includes("LIVE_AUTO_SEND_NOT_ENABLED"), "The route must refuse when live auto-send is disabled.");

  console.log("PASS — Automation backlinks live auto-send route smoke");
}

void main();
