import { resumeBacklinksDryRun, type ResumeBacklinksDryRunDependencies } from "../lib/automation/run-resume";
import type { AutomationRun, AutomationTask } from "../lib/automation/types";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ids = {
  workspace: "00000000-0000-4000-8000-000000000001",
  run: "00000000-0000-4000-8000-000000000002",
  discovery: "00000000-0000-4000-8000-000000000003",
  qualification: "00000000-0000-4000-8000-000000000004",
  promotion: "00000000-0000-4000-8000-000000000005",
};
const now = "2026-10-11T12:00:00.000Z";

function run(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: ids.run,
    workspaceId: ids.workspace,
    system: "backlinks",
    runKind: "backlinks.daily_preview",
    idempotencyKey: "manual-ui:test",
    status: "running",
    mode: "dry_run",
    triggerSource: "manual",
    requestedBy: null,
    scheduledAt: now,
    startedAt: now,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    heartbeatAt: null,
    leaseExpiresAt: null,
    workerId: null,
    attemptCount: 1,
    maxAttempts: 1,
    input: {},
    summary: null,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function task(
  id: string,
  taskKind: string,
  status: AutomationTask["status"],
  overrides: Partial<AutomationTask> = {},
): AutomationTask {
  return {
    id,
    workspaceId: ids.workspace,
    runId: ids.run,
    dependsOnTaskId: null,
    system: "backlinks",
    taskKind,
    taskKey: taskKind,
    status,
    priority: taskKind === "backlinks.discovery.preview" ? 10 : taskKind === "backlinks.qualification.preview" ? 20 : 30,
    scheduledAt: now,
    availableAt: now,
    claimedAt: null,
    startedAt: status === "completed" ? now : null,
    heartbeatAt: null,
    leaseExpiresAt: null,
    completedAt: status === "completed" ? now : null,
    failedAt: null,
    cancelledAt: null,
    workerId: null,
    attemptCount: status === "completed" ? 1 : 1,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: {},
    output: status === "completed" ? {} : null,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function input() {
  return {
    workspaceId: ids.workspace,
    runId: ids.run,
    workerId: "resume-test",
    now,
    leaseDurationSeconds: 120,
  };
}

function dependencies(tasks: AutomationTask[]): {
  deps: ResumeBacklinksDryRunDependencies;
  workerKinds: string[];
  completedRuns: number;
} {
  const workerKinds: string[] = [];
  let completedRuns = 0;
  const deps: ResumeBacklinksDryRunDependencies = {
    getRun: async () => run(),
    listTasks: async () => tasks.map((value) => ({ ...value })),
    reclaimExpiredTasks: async () => [],
    executeWorkerOnce: async () => {
      const next = tasks
        .filter((value) => value.status === "queued")
        .sort((a, b) => a.priority - b.priority)[0];
      if (next === undefined) return { kind: "empty" };
      workerKinds.push(next.taskKind);
      next.status = "completed";
      next.startedAt = now;
      next.completedAt = now;
      next.output = {};
      return { kind: "completed", task: { ...next }, output: {} };
    },
    completeRun: async () => {
      completedRuns += 1;
      return { kind: "transitioned" };
    },
    failRun: async () => ({ kind: "transitioned" }),
  };
  return { deps, workerKinds, get completedRuns() { return completedRuns; } };
}

async function main(): Promise<void> {
  const discovery = task(ids.discovery, "backlinks.discovery.preview", "completed");
  const qualification = task(ids.qualification, "backlinks.qualification.preview", "queued", {
    dependsOnTaskId: ids.discovery,
    attemptCount: 1,
  });
  const promotion = task(ids.promotion, "backlinks.promotion.preview", "queued", {
    dependsOnTaskId: ids.qualification,
    attemptCount: 0,
  });
  const nominal = dependencies([discovery, qualification, promotion]);
  const result = await resumeBacklinksDryRun(nominal.deps, input());
  assert(result.kind === "completed" && result.completedTasks === 2, "Resume must complete only qualification and promotion previews");
  assert(
    JSON.stringify(nominal.workerKinds) === JSON.stringify(["backlinks.qualification.preview", "backlinks.promotion.preview"]),
    "Resume must never re-run discovery or reach Brave",
  );
  assert(nominal.completedRuns === 1, "Resume must complete the existing run once all tasks are complete");

  const delayedQualification = task(ids.qualification, "backlinks.qualification.preview", "queued", {
    dependsOnTaskId: ids.discovery,
    availableAt: "2026-10-11T12:01:00.000Z",
  });
  const delayed = dependencies([task(ids.discovery, "backlinks.discovery.preview", "completed"), delayedQualification]);
  const delayedResult = await resumeBacklinksDryRun(delayed.deps, input());
  assert(
    delayedResult.kind === "pending_retry" && delayedResult.waitingFor === "retry_delay" && delayed.workerKinds.length === 0,
    "Resume before available_at must not invoke a worker",
  );

  const unsafe = dependencies([task(ids.discovery, "backlinks.discovery.preview", "queued")]);
  const unsafeResult = await resumeBacklinksDryRun(unsafe.deps, input());
  assert(
    unsafeResult.kind === "rejected" && unsafeResult.reason === "discovery_not_completed" && unsafe.workerKinds.length === 0,
    "Resume must reject runs whose discovery is not completed",
  );

  console.log("PASS — Automation backlink run resume smoke");
}

void main();
