import assert from "node:assert/strict";

import { runBacklinkAutonomyProductionTick } from "../lib/automation/backlink-autonomy-production-composition";
import { reconcileBacklinkAutonomyRunLifecycle } from "../lib/automation/backlink-autonomy-run-lifecycle";

const ids = { workspaceId: "00000000-0000-4000-8000-000000000001", runId: "00000000-0000-4000-8000-000000000002" };

function run(status: "queued" | "running" | "completed" | "failed" | "cancelled" = "queued"): any {
  return { id: ids.runId, workspaceId: ids.workspaceId, status, attemptCount: status === "queued" ? 0 : 1 };
}
function task(status: "queued" | "running" | "completed" | "failed" | "dead_letter" | "cancelled"): any {
  return { id: "task", workspaceId: ids.workspaceId, runId: ids.runId, status };
}

function fixture(initialRun: ReturnType<typeof run>, initialTasks: any[]) {
  let currentRun = initialRun;
  let currentTasks = initialTasks;
  const calls: string[] = [];
  return {
    calls,
    dependencies: {
      getRun: async () => currentRun,
      listTasks: async () => currentTasks,
      startRun: async (input: any) => {
        calls.push(`start:${input.startedAt}`);
        if (currentRun.status !== "queued") return null;
        currentRun = { ...currentRun, status: "running", startedAt: input.startedAt, attemptCount: 1 };
        return currentRun;
      },
      completeRun: async (input: any) => {
        calls.push(`complete:${input.completedAt}`);
        if (currentRun.status !== "running") return null;
        currentRun = { ...currentRun, status: "completed", completedAt: input.completedAt, summary: input.summary };
        return currentRun;
      },
      failRun: async (input: any) => {
        calls.push(`fail:${input.failedAt}:${input.errorCode}`);
        if (currentRun.status !== "running") return null;
        currentRun = { ...currentRun, status: "failed", failedAt: input.failedAt };
        return currentRun;
      },
    },
    status: () => currentRun.status,
    value: () => currentRun,
    tasks: () => currentTasks,
    concurrentStart: () => { currentRun = { ...currentRun, status: "running", attemptCount: 1 }; },
  };
}

async function main() {
  // A new run starts only after a task exists, and closes when all tasks complete.
  {
    const f = fixture(run("queued"), [task("completed")]);
    const result = await reconcileBacklinkAutonomyRunLifecycle(f.dependencies, { ...ids, at: "2026-11-09T06:38:05.000Z" });
    assert.equal(result.kind, "completed");
    assert.equal(f.status(), "completed");
    assert.deepEqual(f.calls, ["start:2026-11-09T06:38:05.000Z", "complete:2026-11-09T06:38:05.000Z"]);
    assert.deepEqual(f.value().summary, { version: 1, taskCounts: { queued: 0, running: 0, completed: 1, failed: 0, deadLetter: 0, cancelled: 0 } });
  }

  // Retried or still-running work leaves the parent running.
  for (const status of ["queued", "running"] as const) {
    const f = fixture(run("running"), [task(status)]);
    const result = await reconcileBacklinkAutonomyRunLifecycle(f.dependencies, { ...ids, at: "2026-11-09T06:38:06.000Z" });
    assert.equal(result.kind, "active");
    assert.equal(f.status(), "running");
    assert.deepEqual(f.calls, []);
  }

  // Any terminal non-completed task fails the parent without retrying it.
  for (const status of ["failed", "dead_letter", "cancelled"] as const) {
    const f = fixture(run("running"), [task(status)]);
    const result = await reconcileBacklinkAutonomyRunLifecycle(f.dependencies, { ...ids, at: "2026-11-09T06:38:07.000Z" });
    assert.equal(result.kind, "failed");
    assert.equal(f.status(), "failed");
    assert.match(f.calls[0]!, /BACKLINK_AUTONOMY_TASK_TERMINAL_FAILURE/);
  }

  // A concurrent starter is benign: re-read state, then finalize exactly once.
  {
    const f = fixture(run("queued"), [task("completed")]);
    const start = f.dependencies.startRun;
    f.dependencies.startRun = async (input: any) => { f.concurrentStart(); return start(input); };
    const result = await reconcileBacklinkAutonomyRunLifecycle(f.dependencies, { ...ids, at: "2026-11-09T06:38:08.000Z" });
    assert.equal(result.kind, "completed");
    assert.equal(f.calls.filter((call) => call.startsWith("complete:")).length, 1);
  }

  // A run without a persisted task remains queued; it is never fabricated or completed.
  {
    const f = fixture(run("queued"), []);
    const result = await reconcileBacklinkAutonomyRunLifecycle(f.dependencies, { ...ids, at: "2026-11-09T06:38:09.000Z" });
    assert.equal(result.kind, "not_started");
    assert.equal(f.status(), "queued");
    assert.deepEqual(f.calls, []);
  }

  // The scheduler's autonomyRuns list includes existing idempotent runs. A legacy
  // queued parent with a completed task is repaired without a worker claim.
  {
    const f = fixture(run("queued"), [task("completed")]);
    let workerCalls = 0;
    const times = ["2026-11-09T06:38:10.000Z", "2026-11-09T06:38:11.000Z", "2026-11-09T06:38:12.000Z"];
    const result = await runBacklinkAutonomyProductionTick({
      runtimeConfig: () => ({ autonomyEnabled: true }),
      scheduler: async () => ({ outcome: "applied", workspacesScanned: 1, promotionsScanned: 1, proposed: [], autonomyRunIds: [ids.runId], autonomyRuns: [{ workspaceId: ids.workspaceId, runId: ids.runId }], created: 0, existing: 1, skipped: [] }),
      runWorker: async () => { workerCalls += 1; return { kind: "empty" as const, reasonCodes: [], taskId: null, nextTaskId: null }; },
      reclaimAutonomyTasks: async () => [],
      lifecycle: f.dependencies,
      schedulerDependencies: {} as never,
      workerDependencies: {} as never,
      now: () => times.shift() ?? "2026-11-09T06:38:13.000Z",
    }, { at: "2026-11-09T06:37:59.643Z", workerId: "test" });
    assert.equal(result.workerSteps, 1);
    assert.equal(workerCalls, 1, "a completed legacy task is never claimed");
    assert.equal(f.status(), "completed");
    assert.equal(f.calls[0], "start:2026-11-09T06:38:10.000Z", "lifecycle timestamps are fresh, not the tick's scheduled timestamp");
  }

  console.log("PASS — Backlink autonomy run lifecycle smoke");
}

void main();
