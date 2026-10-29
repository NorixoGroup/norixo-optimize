import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
const migration = await readFile("supabase/migrations/20261028110000_add_backlink_v3_pilot_admin_control.sql", "utf8");
const route = await readFile("app/api/backlinks/production-pilot-eligibility/route.ts", "utf8");
const followUp = await readFile("supabase/migrations/20260811161000_add_backlink_outreach_follow_up_pre_send_rpc.sql", "utf8");
for (const required of [
  "backlink_production_eligibility_one_active_pilot_per_workspace_idx",
  "pg_advisory_xact_lock",
  "BACKLINK_PILOT_ELIGIBILITY_RECIPIENT_PREVIOUSLY_ATTEMPTED",
  "BACKLINK_PILOT_ELIGIBILITY_TEST_CONTACT",
  "BACKLINK_PILOT_ELIGIBILITY_FOLLOW_UP_ALREADY_REQUESTED",
  "BACKLINK_PILOT_ELIGIBILITY_MAILBOX_NOT_DELIVERABLE",
  "BACKLINK_PILOT_FOLLOW_UPS_BLOCKED",
  "mark_backlink_outreach_follow_up_attempt_requested",
  "backlink_production_pilot:",
  "BACKLINK_PRODUCTION_ELIGIBILITY_AUDIT_IMMUTABLE",
  "revoke_backlink_production_pilot_eligibility",
]) assert.match(migration, new RegExp(required));

assert.match(route, /getRequestUserAndWorkspace/);
assert.match(route, /isAdminPrivateEmail/);
assert.match(route, /createSupabaseAdminClient/);
assert.match(route, /status: 401/);
assert.match(route, /status: 403/);
assert.match(route, /confirm !== true/);
assert.doesNotMatch(route, /RESEND_API_KEY|createEnvironmentOutreachEmailProvider|BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED/);
assert.match(followUp, /mark_backlink_outreach_follow_up_attempt_requested/);
console.log("PASS backlink production pilot eligibility safety smoke");
}
void main();
