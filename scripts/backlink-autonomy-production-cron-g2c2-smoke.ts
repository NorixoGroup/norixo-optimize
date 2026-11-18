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
import { BacklinkRepositoryError } from "../lib/backlinks/repositories/errors";

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
const activeLifecycle = {
  getRun: async () => ({ status: "running" }),
  listTasks: async () => [{ status: "queued" }],
  startRun: async () => null,
  completeRun: async () => null,
  failRun: async () => null,
} as never;

async function main() {
  let schedulerCalls = 0;
  let workerCalls = 0;
  let reclaimCalls = 0;
  const disabled = await runBacklinkAutonomyProductionTick({
    runtimeConfig: off,
    scheduler: async () => { schedulerCalls += 1; return schedulerResult(); },
    runWorker: async () => { workerCalls += 1; throw new Error("must not run"); },
    reclaimAutonomyTasks: async () => { reclaimCalls += 1; throw new Error("must not reclaim"); },
    lifecycle: activeLifecycle,
    schedulerDependencies: {} as never,
    workerDependencies: {} as never,
    now: () => at,
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
    lifecycle: activeLifecycle,
    schedulerDependencies: {} as never,
    workerDependencies: {} as never,
    now: () => at,
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
    lifecycle: activeLifecycle,
    schedulerDependencies: {} as never,
    workerDependencies: {} as never,
    now: () => at,
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

  // N8N-AUTH-02: the alternative n8n secret is additive, never a bypass of the global flag gate.
  const n8nHandler = createBacklinkAutonomyCronHandler({
    cronSecret: () => "test-secret",
    n8nCronSecret: () => "n8n-s3cret",
    runtimeConfig: off,
    createProductionDependencies: () => { dependenciesCreated += 1; return {} as never; },
    runTick: async () => { tickCalls += 1; throw new Error("must not tick"); },
    now: () => at,
  });
  const requestWith = (authorization?: string) =>
    new NextRequest("https://example.test/api/internal/cron/backlinks/autonomy", {
      headers: authorization === undefined ? {} : { authorization },
    });
  assert.equal((await n8nHandler(requestWith("Bearer test-secret"))).status, 200, "legacy secret still accepted");
  const n8nAuthorized = await n8nHandler(requestWith("Bearer n8n-s3cret"));
  assert.equal(n8nAuthorized.status, 200, "new n8n secret accepted");
  assert.deepEqual(await n8nAuthorized.json(), { disposition: "disabled", reason: "BACKLINK_AUTONOMY_DISABLED" }, "n8n secret does not bypass the global flag gate");
  assert.equal((await n8nHandler(requestWith("Bearer wrong"))).status, 401, "incorrect secret refused");
  assert.equal((await n8nHandler(requestWith())).status, 401, "absent secret refused");
  assert.equal(
    (await createBacklinkAutonomyCronHandler({
      cronSecret: () => "",
      runtimeConfig: off,
      createProductionDependencies: () => { throw new Error("must not build"); },
      runTick: async () => { throw new Error("must not tick"); },
      now: () => at,
    })(requestWith("Bearer anything")))!.status,
    401,
    "unconfigured secrets (legacy and n8n both absent) never authorize",
  );
  assert.equal(dependenciesCreated, 0, "no authorized-and-enabled call occurred in this block");

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

  // BL-AUTONOMY-500 fix: a reclaim exception on one run must not drop every other run from this tick.
  {
    const runA = { workspaceId: "workspace-isolation-a", runId: "autonomy-run-isolation-a" };
    const runB = { workspaceId: "workspace-isolation-b", runId: "autonomy-run-isolation-b" };
    const workerCallsByRun: string[] = [];
    const result = await runBacklinkAutonomyProductionTick({
      runtimeConfig: on,
      scheduler: async () => schedulerResult([runA, runB]),
      reclaimAutonomyTasks: async (input) => {
        if (input.runId === runB.runId) throw new Error("simulated reclaim failure");
        return [];
      },
      runWorker: async (_deps, input) => {
        workerCallsByRun.push(input.runId);
        return { kind: "completed" as const, reasonCodes: [], taskId: "task", nextTaskId: null };
      },
      lifecycle: activeLifecycle,
      schedulerDependencies: {} as never,
      workerDependencies: {} as never,
      now: () => at,
    }, { at, workerId: "test" });
    assert.equal(result.disposition, "completed", "a per-run exception must not fail the whole tick");
    assert.equal(result.runsFailed, 1, "exactly the one throwing run must be counted as failed");
    assert.equal(result.workerSteps, BACKLINK_AUTONOMY_CRON_WORKER_STEPS_PER_RUN, "the healthy run's worker steps must still run and count");
    assert.deepEqual(workerCallsByRun, Array.from({ length: BACKLINK_AUTONOMY_CRON_WORKER_STEPS_PER_RUN }, () => runA.runId), "the throwing run's worker loop must never start; the other run proceeds");
    assert.equal(result.runFailures.length, 1, "exactly one bounded failure record must identify the failed run");
    assert.deepEqual(result.runFailures[0], { workspaceId: runB.workspaceId, runId: runB.runId, errorType: "Error", errorCode: "UNKNOWN" }, "the failure record must name the run concerned and a bounded error type/code only");
  }

  // BL-AUTONOMY-500 fix: a runWorker exception on one run must not prevent a later run from being processed.
  {
    const runA = { workspaceId: "workspace-isolation-c", runId: "autonomy-run-isolation-c" };
    const runB = { workspaceId: "workspace-isolation-d", runId: "autonomy-run-isolation-d" };
    const reclaimCallsByRun: string[] = [];
    const workerCallsByRun: string[] = [];
    const result = await runBacklinkAutonomyProductionTick({
      runtimeConfig: on,
      scheduler: async () => schedulerResult([runA, runB]),
      reclaimAutonomyTasks: async (input) => { reclaimCallsByRun.push(input.runId); return []; },
      runWorker: async (_deps, input) => {
        if (input.runId === runA.runId) throw new Error("simulated worker failure");
        workerCallsByRun.push(input.runId);
        return { kind: "completed" as const, reasonCodes: [], taskId: "task", nextTaskId: null };
      },
      lifecycle: activeLifecycle,
      schedulerDependencies: {} as never,
      workerDependencies: {} as never,
      now: () => at,
    }, { at, workerId: "test" });
    assert.equal(result.disposition, "completed");
    assert.equal(result.runsFailed, 1, "exactly the one throwing run must be counted as failed");
    assert.deepEqual(reclaimCallsByRun, [runA.runId, runB.runId], "reclaim for the later run must still execute after the earlier run's worker failure");
    assert.equal(result.workerSteps, BACKLINK_AUTONOMY_CRON_WORKER_STEPS_PER_RUN, "only the healthy run's completed steps are counted");
    assert.deepEqual(workerCallsByRun, Array.from({ length: BACKLINK_AUTONOMY_CRON_WORKER_STEPS_PER_RUN }, () => runB.runId), "the later run must still be fully processed");
    assert.equal(result.runFailures.length, 1, "exactly one bounded failure record must identify the failed run");
    assert.deepEqual(result.runFailures[0], { workspaceId: runA.workspaceId, runId: runA.runId, errorType: "Error", errorCode: "UNKNOWN" }, "the failure record must name the run concerned and a bounded error type/code only");
  }

  // PR #88 last check: a run throwing an Error with an attacker/data-controllable dynamic .name must never
  // surface that raw name in runFailures — it must be normalized to a bounded, non-disclosing placeholder.
  {
    const runA = { workspaceId: "workspace-isolation-e", runId: "autonomy-run-isolation-e" };
    const result = await runBacklinkAutonomyProductionTick({
      runtimeConfig: on,
      scheduler: async () => schedulerResult([runA]),
      reclaimAutonomyTasks: async () => {
        const sensitiveNamedError = new Error("generic message");
        sensitiveNamedError.name = "Bearer sk_live_do-not-leak-this-name user@example.com";
        throw sensitiveNamedError;
      },
      runWorker: async () => { throw new Error("must not run"); },
      lifecycle: activeLifecycle,
      schedulerDependencies: {} as never,
      workerDependencies: {} as never,
      now: () => at,
    }, { at, workerId: "test" });
    assert.equal(result.runsFailed, 1);
    assert.equal(result.runFailures.length, 1);
    assert.deepEqual(result.runFailures[0], { workspaceId: runA.workspaceId, runId: runA.runId, errorType: "UnrecognizedErrorType", errorCode: "UNKNOWN" }, "a dynamic/unrecognized Error.name must be normalized, never surfaced as-is");
  }

  // BL-AUTONOMY-500 fix: when the whole tick still throws (e.g. during scheduling, outside the per-run loop),
  // the route must keep returning a generic 500 and must log only a safe type/code, never a raw message.
  {
    const capturedLogs: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => { capturedLogs.push(args); };
    try {
      const secretLookingMessage = "Bearer sk_live_do-not-leak-this https://internal.example.com/secret?token=abc123 user@example.com";
      const handler = createBacklinkAutonomyCronHandler({
        cronSecret: () => "test-secret",
        runtimeConfig: on,
        createProductionDependencies: () => ({} as never),
        runTick: async () => { throw new Error(secretLookingMessage); },
        now: () => at,
      });
      const response = await handler(new NextRequest("https://example.test/api/internal/cron/backlinks/autonomy", { headers: { authorization: "Bearer test-secret" } }));
      assert.equal(response.status, 500, "an unrecoverable tick failure must still return a generic 500");
      assert.deepEqual(await response.json(), { error: "Unable to run backlink autonomy cron" }, "the 500 body contract must be unchanged");
      assert.equal(capturedLogs.length, 1, "exactly one error log must be emitted");
      const loggedPayload = JSON.stringify(capturedLogs[0]);
      assert.doesNotMatch(loggedPayload, /sk_live_do-not-leak-this/, "a raw secret-looking token must never be logged");
      assert.doesNotMatch(loggedPayload, /internal\.example\.com/, "a raw internal URL must never be logged");
      assert.doesNotMatch(loggedPayload, /user@example\.com/, "a raw email address must never be logged");
      assert.match(loggedPayload, /"errorType":"Error"/, "the error's type must be logged");
      assert.match(loggedPayload, /"errorCode":"UNKNOWN"/, "a bounded fallback code must be logged for a plain Error");

      capturedLogs.length = 0;
      const repositoryErrorHandler = createBacklinkAutonomyCronHandler({
        cronSecret: () => "test-secret",
        runtimeConfig: on,
        createProductionDependencies: () => ({} as never),
        runTick: async () => { throw new BacklinkRepositoryError({ code: "DATABASE", operation: "getAutomationWorkspaceControl", message: "The database operation could not be completed." }); },
        now: () => at,
      });
      const repositoryErrorResponse = await repositoryErrorHandler(new NextRequest("https://example.test/api/internal/cron/backlinks/autonomy", { headers: { authorization: "Bearer test-secret" } }));
      assert.equal(repositoryErrorResponse.status, 500);
      const repositoryLoggedPayload = JSON.stringify(capturedLogs[0]);
      assert.match(repositoryLoggedPayload, /"errorType":"BacklinkRepositoryError"/, "a known repository error's type must be logged");
      assert.match(repositoryLoggedPayload, /"errorCode":"DATABASE"/, "a known repository error's bounded code must be logged");

      // PR #88 last check: Error.name is not a closed enum in the language — any thrown object can set it
      // to anything, including attacker- or data-influenced text. It must be normalized before logging.
      capturedLogs.length = 0;
      const sensitiveNameHandler = createBacklinkAutonomyCronHandler({
        cronSecret: () => "test-secret",
        runtimeConfig: on,
        createProductionDependencies: () => ({} as never),
        runTick: async () => {
          const sensitiveNamedError = new Error("generic message");
          sensitiveNamedError.name = "Bearer sk_live_do-not-leak-this-name user@example.com";
          throw sensitiveNamedError;
        },
        now: () => at,
      });
      const sensitiveNameResponse = await sensitiveNameHandler(new NextRequest("https://example.test/api/internal/cron/backlinks/autonomy", { headers: { authorization: "Bearer test-secret" } }));
      assert.equal(sensitiveNameResponse.status, 500);
      const sensitiveNameLoggedPayload = JSON.stringify(capturedLogs[0]);
      assert.doesNotMatch(sensitiveNameLoggedPayload, /sk_live_do-not-leak-this-name/, "a dynamic, attacker-settable Error.name must never be logged verbatim");
      assert.doesNotMatch(sensitiveNameLoggedPayload, /user@example\.com/, "a dynamic Error.name must never leak an email address into the log");
      assert.match(sensitiveNameLoggedPayload, /"errorType":"UnrecognizedErrorType"/, "an unrecognized Error.name must be normalized to a bounded placeholder, not logged as-is");
    } finally {
      console.error = originalConsoleError;
    }
  }

  // BL-AUTONOMY-500 prepublication: a degraded-but-completed tick (HTTP 200) must still be
  // operationally detectable via a log line, naming the failed runs, not only via the JSON body.
  {
    const capturedWarnings: unknown[][] = [];
    const originalConsoleWarn = console.warn;
    console.warn = (...args: unknown[]) => { capturedWarnings.push(args); };
    try {
      const degradedResult = {
        disposition: "completed" as const,
        seededRuns: 2, tasksCreated: 0, tasksExisting: 0, reclaimedTasks: 0,
        workerSteps: 3, workerTerminal: 0, contactSelectionResumedRuns: 0, promotionAutoApplied: 0,
        runsFailed: 1,
        runFailures: [{ workspaceId: "workspace-degraded", runId: "autonomy-run-degraded", errorType: "Error", errorCode: "UNKNOWN" }],
      };
      const handler = createBacklinkAutonomyCronHandler({
        cronSecret: () => "test-secret",
        runtimeConfig: on,
        createProductionDependencies: () => ({} as never),
        runTick: async () => degradedResult,
        now: () => at,
      });
      const response = await handler(new NextRequest("https://example.test/api/internal/cron/backlinks/autonomy", { headers: { authorization: "Bearer test-secret" } }));
      assert.equal(response.status, 200, "a degraded-but-completed tick must still return 200");
      assert.deepEqual(await response.json(), degradedResult, "the response body must carry runFailures unchanged");
      assert.equal(capturedWarnings.length, 1, "a degraded tick must emit exactly one log line even though the status is 200");
      const loggedPayload = JSON.stringify(capturedWarnings[0]);
      assert.match(loggedPayload, /"runsFailed":1/, "the log line must carry the failure count");
      assert.match(loggedPayload, /"workspaceId":"workspace-degraded"/, "the log line must identify the failed run");
      assert.match(loggedPayload, /"errorCode":"UNKNOWN"/, "the log line must carry the bounded error code");

      capturedWarnings.length = 0;
      const healthyResult = { ...degradedResult, runsFailed: 0, runFailures: [] };
      const healthyHandler = createBacklinkAutonomyCronHandler({
        cronSecret: () => "test-secret",
        runtimeConfig: on,
        createProductionDependencies: () => ({} as never),
        runTick: async () => healthyResult,
        now: () => at,
      });
      await healthyHandler(new NextRequest("https://example.test/api/internal/cron/backlinks/autonomy", { headers: { authorization: "Bearer test-secret" } }));
      assert.equal(capturedWarnings.length, 0, "a fully healthy tick must never emit the degraded-tick log line");
    } finally {
      console.warn = originalConsoleWarn;
    }
  }

  console.log("PASS — Backlink autonomy production cron G2C.2 smoke");
}

void main();
