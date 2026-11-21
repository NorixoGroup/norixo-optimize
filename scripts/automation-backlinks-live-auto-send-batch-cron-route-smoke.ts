import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  hasValidBacklinkOutreachLiveAutoSendCronAuthorization,
  isBacklinkOutreachLiveAutoSendBatchCronEnabled,
} from "../lib/automation/backlink-outreach-live-auto-send-cron-config";

async function main(): Promise<void> {
  const environment = { CRON_SECRET: "test-secret", BACKLINK_LIVE_AUTO_SEND_BATCH_CRON_ENABLED: "true" };
  assert.equal(hasValidBacklinkOutreachLiveAutoSendCronAuthorization("Bearer test-secret", environment), true);
  assert.equal(hasValidBacklinkOutreachLiveAutoSendCronAuthorization("Bearer wrong", environment), false);
  assert.equal(isBacklinkOutreachLiveAutoSendBatchCronEnabled(environment), true);
  assert.equal(isBacklinkOutreachLiveAutoSendBatchCronEnabled({}), false);

  const route = await readFile("app/api/internal/cron/backlinks/outreach/live-auto-send-batch/route.ts", "utf8");
  const runner = await readFile("lib/automation/backlink-outreach-live-auto-send-batch-cron-runner.ts", "utf8");
  for (const required of [
    "hasValidBacklinkOutreachLiveAutoSendCronAuthorization",
    "hasValidBacklinkN8nCronAuthorization",
    "BACKLINK_LIVE_AUTO_SEND_BATCH_CRON_ENABLED",
    "runBacklinkOutreachLiveAutoSendBatchCron",
  ]) assert(route.includes(required), `missing route protection: ${required}`);
  for (const required of [
    "tryAcquireBacklinkOutreachScheduleApplyLock",
    "runBacklinkOutreachLiveAutoSendCron",
    "pauseAutomationWorkspaceControlBacklinkLiveAutoSend",
  ]) assert(runner.includes(required), `missing batch protection: ${required}`);
  console.log("PASS — Backlink live auto-send batch cron route smoke");
}

void main();
