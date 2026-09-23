import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";

import {
  BACKLINK_AUTONOMY_CRON_PROMOTION_LIMIT,
  BACKLINK_AUTONOMY_CRON_RECLAIM_LIMIT,
  BACKLINK_AUTONOMY_CRON_WORKER_STEPS_PER_RUN,
  BACKLINK_AUTONOMY_CRON_WORKSPACE_LIMIT,
  runBacklinkAutonomyProductionTick,
} from "../lib/automation/backlink-autonomy-production-composition";
import { createBacklinkAutonomyCronHandler } from "../app/api/internal/cron/backlinks/autonomy/route";

const at = "2026-09-22T00:00:00.000Z";
const off = () => ({ autonomyEnabled: false, source: "environment" as const });
const on = () => ({ autonomyEnabled: true, source: "environment" as const });
const schedulerResult = (runs: readonly { workspaceId: string; runId: string }[] = []) => ({
  outcome: "applied" as const,
  workspacesScanned: 1,
  promotionsScanned: runs.length,
  proposed: [],
  autonomyRunIds: runs.map((run) => run.runId),
  autonomyRuns: runs,
  created: runs.length,
  existing: 0,
  skipped: [],
});

async function main() {
  let schedulerCalls = 0;
  let workerCalls = 0;
  let reclaimCalls = 0;
  const disabled = await runBacklinkAutonomyProductionTick({
    runtimeConfig: off,
    scheduler: async () => { schedulerCalls += 1; return schedulerResult(); },
    runWorker: async () => { workerCalls += 1; throw new Error("must not run"); },
    reclaimAutonomyTasks: async () => { reclaimCalls += 1; throw new Error("must not reclaim"); },
    schedulerDependencies: {} as never,
    workerDependencies: {} as never,
  }, { at, workerId: "test" });
  assert.equal(disabled.disposition, "disabled");
  assert.equal(schedulerCalls, 0, "global OFF must avoid scheduler reads/writes");
  assert.equal(workerCalls, 0, "global OFF must avoid claims");
  assert.equal(reclaimCalls, 0, "global OFF must avoid reclaim");

  const seen: { workspaceId: string; runId: string }[] = [];
  const lifecycle: string[] = [];
  const bounded = await runBacklinkAutonomyProductionTick({
    runtimeConfig: on,
    scheduler: async () => schedulerResult([{ workspaceId: "workspace-a", runId: "autonomy-run-a" }]),
    reclaimAutonomyTasks: async (input) => { lifecycle.push(`reclaim:${input.workspaceId}:${input.runId}`); return []; },
    runWorker: async (_deps, input) => {
      lifecycle.push(`claim:${input.workspaceId}:${input.runId}`);
      seen.push({ workspaceId: input.workspaceId, runId: input.runId });
      return { kind: "completed" as const, reasonCodes: [], taskId: "task", nextTaskId: null };
    },
    schedulerDependencies: {} as never,
    workerDependencies: {} as never,
  }, { at, workerId: "test" });
  assert.equal(bounded.workerSteps, BACKLINK_AUTONOMY_CRON_WORKER_STEPS_PER_RUN, "worker loop must be fixed and bounded");
  assert.deepEqual(seen, Array.from({ length: BACKLINK_AUTONOMY_CRON_WORKER_STEPS_PER_RUN }, () => ({ workspaceId: "workspace-a", runId: "autonomy-run-a" })));
  assert.equal(lifecycle[0], "reclaim:workspace-a:autonomy-run-a", "filtered reclaim must precede filtered claim");

  type SimulatedTask = { id: string; workspaceId: string; runId: string; taskKind: string; status: "running" | "queued" | "dead_letter" | "completed"; attemptCount: number; maxAttempts: number; expired: boolean };
  const tasks: SimulatedTask[] = [
    { id: "autonomy-retry", workspaceId: "workspace-a", runId: "autonomy-run-a", taskKind: "backlinks.contact_resolution", status: "running", attemptCount: 1, maxAttempts: 3, expired: true },
    { id: "autonomy-dead", workspaceId: "workspace-a", runId: "autonomy-run-a", taskKind: "backlinks.contact_validation", status: "running", attemptCount: 3, maxAttempts: 3, expired: true },
    { id: "non-autonomy", workspaceId: "workspace-a", runId: "autonomy-run-a", taskKind: "backlinks.discovery.preview", status: "running", attemptCount: 1, maxAttempts: 3, expired: true },
    { id: "other-workspace", workspaceId: "workspace-b", runId: "autonomy-run-a", taskKind: "backlinks.contact_resolution", status: "running", attemptCount: 1, maxAttempts: 3, expired: true },
    { id: "other-run", workspaceId: "workspace-a", runId: "autonomy-run-b", taskKind: "backlinks.contact_resolution", status: "running", attemptCount: 1, maxAttempts: 3, expired: true },
  ];
  const allowedKinds = new Set(["backlinks.contact_resolution", "backlinks.contact_validation", "backlinks.campaign_prepare", "backlinks.draft_prepare", "backlinks.outreach_decision"]);
  const recoveredClaims: string[] = [];
  const recovery = await runBacklinkAutonomyProductionTick({
    runtimeConfig: on,
    scheduler: async () => schedulerResult([{ workspaceId: "workspace-a", runId: "autonomy-run-a" }]),
    reclaimAutonomyTasks: async (input) => tasks.filter((task) => task.workspaceId === input.workspaceId && task.runId === input.runId && task.status === "running" && task.expired && allowedKinds.has(task.taskKind)).slice(0, input.limit).map((task) => {
      task.status = task.attemptCount < task.maxAttempts ? "queued" : "dead_letter";
      return task as never;
    }),
    runWorker: async (_deps, input) => {
      const task = tasks.find((candidate) => candidate.workspaceId === input.workspaceId && candidate.runId === input.runId && candidate.status === "queued" && allowedKinds.has(candidate.taskKind));
      if (task == null) return { kind: "empty" as const, reasonCodes: [], taskId: null, nextTaskId: null };
      task.status = "completed";
      recoveredClaims.push(task.id);
      return { kind: "completed" as const, reasonCodes: [], taskId: task.id, nextTaskId: null };
    },
    schedulerDependencies: {} as never,
    workerDependencies: {} as never,
  }, { at, workerId: "recovery" });
  assert.equal(recovery.reclaimedTasks, 2, "only expired autonomy tasks in this run are reclaimed");
  assert.deepEqual(recoveredClaims, ["autonomy-retry"], "requeued task is reclaimed then claimed exactly once");
  assert.equal(tasks.find((task) => task.id === "autonomy-dead")?.status, "dead_letter", "max-attempt task dead-letters and is not claimed");
  for (const id of ["non-autonomy", "other-workspace", "other-run"]) assert.equal(tasks.find((task) => task.id === id)?.status, "running", `${id} must remain untouched`);

  let dependenciesCreated = 0;
  let tickCalls = 0;
  const handler = createBacklinkAutonomyCronHandler({
    cronSecret: () => "test-secret",
    runtimeConfig: off,
    createProductionDependencies: () => { dependenciesCreated += 1; return {} as never; },
    runTick: async () => { tickCalls += 1; throw new Error("must not tick"); },
    now: () => at,
  });
  const unauthorized = await handler(new NextRequest("https://example.test/api/internal/cron/backlinks/autonomy"));
  assert.equal(unauthorized.status, 401, "cron rejects invalid authentication");
  const globallyDisabled = await handler(new NextRequest("https://example.test/api/internal/cron/backlinks/autonomy", { headers: { authorization: "Bearer test-secret" } }));
  assert.equal(globallyDisabled.status, 200);
  assert.deepEqual(await globallyDisabled.json(), { disposition: "disabled", reason: "BACKLINK_AUTONOMY_DISABLED" });
  assert.equal(dependenciesCreated, 0, "global OFF must not build production adapters");
  assert.equal(tickCalls, 0, "global OFF must not invoke a tick");

  const composition = await readFile(new URL("../lib/automation/backlink-autonomy-production-composition.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/internal/cron/backlinks/autonomy/route.ts", import.meta.url), "utf8");
  assert.match(composition, /claimNextBacklinkAutonomyTask/, "production worker must use the filtered claim adapter");
  assert.doesNotMatch(composition, /claimNextAutomationTask\(/, "production worker must not use generic claim");
  assert.match(composition, /reclaimExpiredBacklinkAutonomyTasks/, "production worker must use the filtered reclaim adapter");
  assert.doesNotMatch(composition, /reclaimExpiredAutomationTasks\(/, "production worker must not use generic reclaim");
  assert.doesNotMatch(composition, /backlink_outreach|resend|linkedin/i, "production composition must not scan or execute outbound workflows");
  assert.match(composition, /resolve: resolveBacklinkContacts/, "production composition must wire the canonical bounded resolver");
  assert.doesNotMatch(composition, /CONTACT_RESOLUTION_PRODUCTION_NOT_AUTHORIZED/, "production composition must not retain the discovery blocking stub");
  assert.match(route, /if \(deps\.runtimeConfig\(\)\.autonomyEnabled !== true\)/, "cron has a global fail-closed gate before production composition");
  assert.equal(BACKLINK_AUTONOMY_CRON_WORKSPACE_LIMIT, 5);
  assert.equal(BACKLINK_AUTONOMY_CRON_PROMOTION_LIMIT, 10);
  assert.equal(BACKLINK_AUTONOMY_CRON_WORKER_STEPS_PER_RUN, 3);
  assert.equal(BACKLINK_AUTONOMY_CRON_RECLAIM_LIMIT, 3);
  console.log("PASS — Backlink autonomy production cron G2C.2 smoke");
}

void main();
