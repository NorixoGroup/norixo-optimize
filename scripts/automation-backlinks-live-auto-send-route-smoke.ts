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
  const repo = await readFile(
    "lib/backlinks/repositories/outreachAttemptsRepository.ts",
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
    "sendApprovedBacklinkOutreachEmail(",
    "getCandidateById:",
    "runBacklinkOutreachLiveAutoSend(",
    "BacklinkOutreachLiveAutoSendError",
  ]) {
    assert(route.includes(required) || service.includes(required), `Missing ${required}`);
  }

  // G4-M1: outreachId must be mandatory end to end. The route must never be able to scan for a
  // candidate, and the service's input type must no longer accept a null/optional outreachId.
  assert(!route.includes("listBacklinkOutreachLiveAutoSendCandidates("), "The route must never list candidates to select one implicitly.");
  assert(!service.includes("listCandidates"), "The service must not retain any candidate-scanning dependency.");
  assert(!service.includes("outreachId?:"), "outreachId must not be optional on the service's input type.");
  assert(!route.includes("body.outreachId ?? null"), "The route must never fall back to a null outreachId.");

  assert(
    repo.includes("reserve_backlink_approved_initial_attempt_v3"),
    "Missing reserve_backlink_approved_initial_attempt_v3",
  );
  assert(!repo.includes("reserve_backlink_outreach_initial_attempt_for_approved_auto_send"), "The app must not use the truncated long RPC name.");
  assert(!repo.includes("reserve_backlink_outreach_initial_attempt_for_approved_auto_sen"), "The app must not use the truncated database RPC name directly.");

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
