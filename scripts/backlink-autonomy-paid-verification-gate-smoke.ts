import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildBacklinkAutonomyRun } from "@/lib/automation/backlink-promotion-resolution-entry";
import { readBacklinkAutonomyRuntimeConfig } from "@/lib/automation/backlink-autonomy-runtime-config";
import { normalizeBacklinkAutonomyRuntimeControl } from "@/lib/automation/backlink-autonomy-runtime-controls";

async function main(): Promise<void> {
  // The production runtime is closed by default and accepts only an exact opt-in.
  assert.equal(readBacklinkAutonomyRuntimeConfig({ BACKLINK_AUTONOMY_ENABLED: "true" }).paidMailboxVerificationAuthorized, false);
  assert.equal(readBacklinkAutonomyRuntimeConfig({ BACKLINK_ZEROBOUNCE_PAID_VERIFICATION_ENABLED: "TRUE" }).paidMailboxVerificationAuthorized, false);
  assert.equal(readBacklinkAutonomyRuntimeConfig({ BACKLINK_ZEROBOUNCE_PAID_VERIFICATION_ENABLED: "true" }).paidMailboxVerificationAuthorized, true);

  const workspace = {
    workspaceId: "00000000-0000-4000-8000-000000000001", backlinksEnabled: true, backlinkAutonomyEnabled: true,
    backlinkOutreachScheduleApplyEnabled: false, dryRunOnly: true, disabledReason: null,
    lastScheduleApplyAttemptAt: null, createdAt: "2026-11-07T00:00:00.000Z", updatedAt: "2026-11-07T00:00:00.000Z",
  };
  const closedControl = normalizeBacklinkAutonomyRuntimeControl({
    runtime: readBacklinkAutonomyRuntimeConfig({ BACKLINK_AUTONOMY_ENABLED: "true" }), workspace,
  });
  assert.equal(closedControl.paidMailboxVerificationAuthorized, false);

  const dispatcher = await readFile("lib/automation/backlink-autonomy-dispatcher.ts", "utf8");
  const paidGate = dispatcher.indexOf("MAILBOX_VERIFICATION_PAID_AUTHORIZATION_REQUIRED");
  const providerHandler = dispatcher.lastIndexOf("executeBacklinkMailboxVerificationTask");
  assert(paidGate !== -1, "the paid mailbox authorization gate must be explicit");
  assert(providerHandler !== -1 && paidGate < providerHandler, "the authorization gate must run before the mailbox provider handler");
  assert(dispatcher.includes("input.control.paidMailboxVerificationAuthorized !== true"), "the gate must fail closed");

  const manualRoute = await readFile("app/api/backlinks/contacts/[id]/mailbox-verification/route.ts", "utf8");
  const manualGate = manualRoute.indexOf("MAILBOX_VERIFICATION_PAID_AUTHORIZATION_REQUIRED");
  const reservation = manualRoute.lastIndexOf("reserveBacklinkZeroBounceVerification");
  assert(manualGate !== -1, "manual verification must expose the same explicit paid-authorization state");
  assert(reservation !== -1 && manualGate < reservation, "manual verification must stop before a budget reservation");

  // A separate explicit operational authorization permits the existing budgeted path;
  // it does not alter dry-run or the independent email-execution authorization.
  const authorizedControl = normalizeBacklinkAutonomyRuntimeControl({
    runtime: readBacklinkAutonomyRuntimeConfig({ BACKLINK_AUTONOMY_ENABLED: "true", BACKLINK_ZEROBOUNCE_PAID_VERIFICATION_ENABLED: "true" }), workspace,
  });
  assert.equal(authorizedControl.dryRunOnly, true, "paid verification authorization cannot enable email delivery");
  assert.equal(authorizedControl.liveExecutionAuthorized, false, "email delivery remains independently blocked");

  const promotion = {
    applicationId: "application", workspaceId: workspace.workspaceId, runId: "run", promotionTaskId: "task",
    promotionTaskKind: "backlinks.promotion.preview" as const, promotionTaskStatus: "completed" as const,
    domainId: "domain", opportunityId: "opportunity", actorUserId: "actor", applied: true as const,
  };
  const blockedRun = buildBacklinkAutonomyRun({ promotion, scheduledAt: "2026-11-07T00:00:00.000Z" });
  const sameBlockedRun = buildBacklinkAutonomyRun({ promotion, scheduledAt: "2026-11-08T00:00:00.000Z" });
  const authorizedRun = buildBacklinkAutonomyRun({ promotion, scheduledAt: "2026-11-08T00:00:00.000Z", paidMailboxVerificationAuthorized: true });
  assert.equal(blockedRun.idempotencyKey, sameBlockedRun.idempotencyKey, "closed authorization must not create retry runs");
  assert.notEqual(blockedRun.idempotencyKey, authorizedRun.idempotencyKey, "an explicit paid authorization must permit exactly one fresh resumable run");

  console.log("PASS — Backlink paid mailbox verification gate smoke (structural gate only, no email/network)");
}

void main();
