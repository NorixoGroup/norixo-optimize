import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readBacklinkAutonomyRuntimeConfig } from "@/lib/automation/backlink-autonomy-runtime-config";
import { normalizeBacklinkAutonomyRuntimeControl } from "@/lib/automation/backlink-autonomy-runtime-controls";
import { createClosedBacklinkAutonomyRuntime } from "@/lib/automation/backlink-autonomy-closed-runtime";
import type { AutomationTask } from "@/lib/automation/types";

const id = { workspace: "00000000-0000-4000-8000-000000000001", run: "00000000-0000-4000-8000-000000000002", promotion: "00000000-0000-4000-8000-000000000003", domain: "00000000-0000-4000-8000-000000000004", opportunity: "00000000-0000-4000-8000-000000000005", actor: "00000000-0000-4000-8000-000000000006" };
const workspace = { workspaceId: id.workspace, backlinksEnabled: true, backlinkAutonomyEnabled: true, backlinkOutreachScheduleApplyEnabled: false, dryRunOnly: false, disabledReason: null };
function task(): AutomationTask { return { id: "00000000-0000-4000-8000-000000000007", workspaceId: id.workspace, runId: id.run, dependsOnTaskId: id.promotion, system: "backlinks", taskKind: "backlinks.contact_resolution", taskKey: "contact-resolution", status: "running", priority: 1, scheduledAt: "2026-09-21T00:00:00.000Z", availableAt: "2026-09-21T00:00:00.000Z", claimedAt: null, startedAt: null, heartbeatAt: null, leaseExpiresAt: null, completedAt: null, failedAt: null, cancelledAt: null, workerId: "test", attemptCount: 1, maxAttempts: 3, backoffBaseSeconds: 60, input: { version: 1, domainId: id.domain, opportunityId: id.opportunity, actorUserId: id.actor }, output: null, errorCode: null, errorMessage: null, createdAt: "2026-09-21T00:00:00.000Z", updatedAt: "2026-09-21T00:00:00.000Z" }; }

async function main() {
  assert.equal(readBacklinkAutonomyRuntimeConfig({}).autonomyEnabled, false);
  assert.equal(readBacklinkAutonomyRuntimeConfig({ BACKLINK_AUTONOMY_ENABLED: "false" }).autonomyEnabled, false);
  assert.equal(readBacklinkAutonomyRuntimeConfig({ BACKLINK_AUTONOMY_ENABLED: "TRUE" }).autonomyEnabled, false);
  assert.equal(readBacklinkAutonomyRuntimeConfig({ BACKLINK_AUTONOMY_ENABLED: "true" }).autonomyEnabled, true);
  const disabledWorkspace = normalizeBacklinkAutonomyRuntimeControl({ runtime: { autonomyEnabled: true }, workspace: { ...workspace, backlinkAutonomyEnabled: false } });
  assert.equal(disabledWorkspace.backlinkAutonomyEnabled, false);
  const enabled = normalizeBacklinkAutonomyRuntimeControl({ runtime: { autonomyEnabled: true }, workspace, campaignApplyAuthorized: true });
  assert.equal(enabled.backlinkAutonomyEnabled, true); assert.equal(enabled.campaignApplyAuthorized, true); assert.equal(enabled.liveExecutionAuthorized, false);
  assert.equal(normalizeBacklinkAutonomyRuntimeControl({ runtime: { autonomyEnabled: true }, workspace: { ...workspace, disabledReason: "paused" } }).backlinkAutonomyEnabled, false);
  assert.equal(normalizeBacklinkAutonomyRuntimeControl({ runtime: { autonomyEnabled: true }, workspace: undefined }).backlinkAutonomyEnabled, false);

  const counters = { taskWrites: 0, handlerCalls: 0, contactCreates: 0, campaignCreates: 0, draftCreates: 0, fetches: 0, sends: 0, forms: 0, linkedin: 0, ready: 0 };
  const entry = {
    getDomain: async () => ({ id: id.domain, workspaceId: id.workspace }),
    getOpportunity: async () => ({ id: id.opportunity, workspaceId: id.workspace, domainId: id.domain }),
    createOrGetTask: async () => { counters.taskWrites++; throw new Error("preview must not persist"); },
  };
  const runtime = createClosedBacklinkAutonomyRuntime({
    getWorkspaceControl: async () => workspace,
    runtimeConfig: () => ({ autonomyEnabled: true }),
    entry,
    handlers: {
      resolution: { getDomain: async () => { counters.handlerCalls++; throw new Error("disabled registry must not call"); } },
      validation: {}, campaign: {}, draft: {}, decision: {},
    } as any,
  });
  const preview = await runtime.previewPromotionEntry({ promotion: { applicationId: "application", workspaceId: id.workspace, runId: id.run, promotionTaskId: id.promotion, promotionTaskKind: "backlinks.promotion.preview", promotionTaskStatus: "completed", domainId: id.domain, opportunityId: id.opportunity, actorUserId: id.actor, applied: true }, scheduledAt: "2026-09-21T00:00:00.000Z" });
  assert.equal(preview.control.backlinkAutonomyEnabled, true); assert.equal(preview.task?.taskKind, "backlinks.contact_resolution"); assert.deepEqual(counters, { taskWrites: 0, handlerCalls: 0, contactCreates: 0, campaignCreates: 0, draftCreates: 0, fetches: 0, sends: 0, forms: 0, linkedin: 0, ready: 0 });
  const closed = createClosedBacklinkAutonomyRuntime({
    getWorkspaceControl: async () => ({ ...workspace, backlinkAutonomyEnabled: false }), runtimeConfig: () => ({ autonomyEnabled: true }), entry,
    handlers: { resolution: { getDomain: async () => { counters.handlerCalls++; throw new Error("must not run"); } }, validation: {}, campaign: {}, draft: {}, decision: {} } as any,
  });
  const rejected = await closed.dispatchClaimedTask({ task: task(), mode: "apply", actorUserId: id.actor });
  assert.deepEqual(rejected, { kind: "rejected", reason: "BACKLINK_AUTONOMY_DISABLED" }); assert.equal(counters.handlerCalls, 0);
  const scheduleSource = await readFile("lib/automation/backlink-outreach-schedule-apply-runner.ts", "utf8");
  assert(scheduleSource.includes("control.dry_run_only !== true"), "Legacy schedule apply dry_run_only=true behavior must remain unchanged");
  console.log("PASS — Backlink autonomy runtime controls smoke");
}
void main();
