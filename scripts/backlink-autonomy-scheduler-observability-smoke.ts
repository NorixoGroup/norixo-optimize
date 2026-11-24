import assert from "node:assert/strict";

import {
  runBacklinkAutonomyProductionTick,
  summarizeBacklinkAutonomySchedulerObservability,
} from "@/lib/automation/backlink-autonomy-production-composition";
import { runBacklinkAutonomyScheduler } from "@/lib/automation/backlink-autonomy-scheduler";
import type { AppliedBacklinkPromotion } from "@/lib/automation/backlink-promotion-resolution-entry";
import type { AutomationRun, AutomationWorkspaceControl } from "@/lib/automation/types";

const ids = {
  workspace: "00000000-0000-4000-8000-000000000001",
  run: "00000000-0000-4000-8000-000000000002",
  promotionTask: "00000000-0000-4000-8000-000000000003",
  domain: "00000000-0000-4000-8000-000000000004",
  opportunity: "00000000-0000-4000-8000-000000000005",
  actor: "00000000-0000-4000-8000-000000000006",
};
const at = "2026-11-21T00:00:00.000Z";
const control: AutomationWorkspaceControl = {
  workspaceId: ids.workspace,
  backlinksEnabled: true,
  backlinkAutonomyEnabled: true,
  backlinkOutreachScheduleApplyEnabled: false,
  dryRunOnly: false,
  disabledReason: null,
};
const promotion: AppliedBacklinkPromotion = {
  applicationId: "application-1",
  workspaceId: ids.workspace,
  runId: ids.run,
  promotionTaskId: ids.promotionTask,
  promotionTaskKind: "backlinks.promotion.preview",
  promotionTaskStatus: "completed",
  domainId: ids.domain,
  opportunityId: ids.opportunity,
  actorUserId: ids.actor,
  applied: true,
};

function automationRun(status: AutomationRun["status"] = "queued"): AutomationRun {
  return {
    id: ids.run, workspaceId: ids.workspace, system: "backlinks", runKind: "backlinks.autonomy",
    idempotencyKey: "backlinks-autonomy:promotion:application-1", status, mode: "dry_run", triggerSource: "internal",
    requestedBy: ids.actor, scheduledAt: at, startedAt: null, completedAt: null, failedAt: null, cancelledAt: null,
    heartbeatAt: null, leaseExpiresAt: null, workerId: null, attemptCount: 0, maxAttempts: 1,
    input: { version: 1 }, summary: null, errorCode: null, errorMessage: null, createdAt: at, updatedAt: at,
  };
}

function schedulerDependencies(input: {
  controls?: readonly AutomationWorkspaceControl[];
  promotions?: readonly AppliedBacklinkPromotion[];
  hostname?: string;
  runStatus?: AutomationRun["status"];
}) {
  return {
    runtimeConfig: () => ({ autonomyEnabled: true }),
    listWorkspaceControls: async () => input.controls ?? [control],
    listAppliedPromotions: async () => input.promotions ?? [promotion],
    getDomain: async () => ({ id: ids.domain, workspaceId: ids.workspace, hostname: input.hostname ?? "candidate.example.org" }),
    getOpportunity: async () => ({ id: ids.opportunity, workspaceId: ids.workspace, domainId: ids.domain }),
    createOrGetRun: async () => ({ kind: "created" as const, run: automationRun(input.runStatus) }),
    createOrGetTask: async () => ({ kind: "created" as const, task: { id: "task-1" } }),
  } as Parameters<typeof runBacklinkAutonomyScheduler>[0];
}

async function main() {
  const noWorkspace = await runBacklinkAutonomyScheduler(schedulerDependencies({ controls: [] }), { mode: "apply", scheduledAt: at });
  assert.deepEqual(summarizeBacklinkAutonomySchedulerObservability(noWorkspace), { workspacesScanned: 0, promotionsScanned: 0, skipped: {} });

  const noPromotion = await runBacklinkAutonomyScheduler(schedulerDependencies({ promotions: [] }), { mode: "apply", scheduledAt: at });
  assert.deepEqual(summarizeBacklinkAutonomySchedulerObservability(noPromotion), { workspacesScanned: 1, promotionsScanned: 0, skipped: {} });

  const fixturePromotion = await runBacklinkAutonomyScheduler(schedulerDependencies({ hostname: "host-resources.example" }), { mode: "apply", scheduledAt: at });
  assert.deepEqual(summarizeBacklinkAutonomySchedulerObservability(fixturePromotion), {
    workspacesScanned: 1, promotionsScanned: 1, skipped: { PROMOTION_DOMAIN_TEST_FIXTURE_EXCLUDED: 1 },
  });

  const acceptedPromotion = await runBacklinkAutonomyScheduler(schedulerDependencies({}), { mode: "apply", scheduledAt: at });
  assert.equal(acceptedPromotion.created, 1);
  assert.deepEqual(summarizeBacklinkAutonomySchedulerObservability(acceptedPromotion), { workspacesScanned: 1, promotionsScanned: 1, skipped: {} });

  const terminalRun = await runBacklinkAutonomyScheduler(schedulerDependencies({ runStatus: "completed" }), { mode: "apply", scheduledAt: at });
  assert.deepEqual(summarizeBacklinkAutonomySchedulerObservability(terminalRun), {
    workspacesScanned: 1, promotionsScanned: 1, skipped: { AUTONOMY_RUN_ALREADY_TERMINAL: 1 },
  });

  const disabled = await runBacklinkAutonomyProductionTick({
    runtimeConfig: () => ({ autonomyEnabled: false, source: "environment" as const }),
    scheduler: async () => { throw new Error("scheduler must not run"); },
    runWorker: async () => { throw new Error("worker must not run"); },
    schedulerDependencies: {} as never,
    workerDependencies: {} as never,
    reclaimAutonomyTasks: async () => { throw new Error("reclaim must not run"); },
    lifecycle: {} as never,
  }, { at, workerId: "test" });
  assert.deepEqual(disabled, {
    disposition: "disabled", seededRuns: 0, tasksCreated: 0, tasksExisting: 0, reclaimedTasks: 0,
    workerSteps: 0, workerTerminal: 0, supervision: { completed: 0, blocked: 0, rejected: 0, retried: 0, deadLetter: 0, reasonCodes: {} }, contactSelectionResumedRuns: 0, promotionAutoApplied: 0,
    runsFailed: 0, runFailures: [], workspacesScanned: 0, promotionsScanned: 0, skipped: {},
  });

  const completed = await runBacklinkAutonomyProductionTick({
    runtimeConfig: () => ({ autonomyEnabled: true, source: "environment" as const }),
    scheduler: async () => ({
      outcome: "applied" as const, workspacesScanned: 1, promotionsScanned: 2, proposed: [], autonomyRunIds: [], autonomyRuns: [],
      created: 0, existing: 0, skipped: ["PROMOTION_DOMAIN_TEST_FIXTURE_EXCLUDED:internal-promotion-id", "CONTACT_MISSING,CONTACT_UNVERIFIED:internal-promotion-id"],
    }),
    runWorker: async () => { throw new Error("worker must not run"); },
    schedulerDependencies: {} as never,
    workerDependencies: {} as never,
    reclaimAutonomyTasks: async () => { throw new Error("reclaim must not run"); },
    lifecycle: {} as never,
  }, { at, workerId: "test" });
  assert.deepEqual({
    workspacesScanned: completed.workspacesScanned,
    promotionsScanned: completed.promotionsScanned,
    skipped: completed.skipped,
  }, {
    workspacesScanned: 1,
    promotionsScanned: 2,
    skipped: { CONTACT_MISSING: 1, CONTACT_UNVERIFIED: 1, PROMOTION_DOMAIN_TEST_FIXTURE_EXCLUDED: 1 },
  });

  console.log("PASS — Backlink autonomy scheduler observability smoke");
}

void main();
