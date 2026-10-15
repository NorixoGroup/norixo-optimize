import type { ExecuteAutomationWorkerOnceInput, ExecuteAutomationWorkerOnceResult } from "./worker-types";
import type {
  AutomationRun,
  AutomationTask,
  CompleteAutomationRunInput,
  FailAutomationRunInput,
  ReclaimExpiredAutomationTasksInput,
} from "./types";

/**
 * Guarded continuation of an existing, already running dry-run preview run.
 *
 * It never prepares, creates or restarts anything: it only executes the QUEUED qualification and
 * promotion-preview tasks that already exist, once their dependencies are complete and their retry
 * delay has elapsed. The discovery task must already be completed, so no search provider (Brave) can
 * be reached. Promotion here is the existing preview task only: nothing is promoted, no contact is
 * resolved and nothing is sent.
 */

export const RESUMABLE_RUN_KIND = "backlinks.daily_preview";
const DISCOVERY_KIND = "backlinks.discovery.preview";
const QUALIFICATION_KIND = "backlinks.qualification.preview";
const PROMOTION_KIND = "backlinks.promotion.preview";
const ALLOWED_TASK_KINDS: readonly string[] = [DISCOVERY_KIND, QUALIFICATION_KIND, PROMOTION_KIND];
export const RESUME_MAX_WORKER_INVOCATIONS = 6;
const RECLAIM_LIMIT = 10;

export type ResumeRejectionReason =
  | "run_not_found"
  | "run_not_running"
  | "run_kind_unsupported"
  | "unsupported_tasks"
  | "discovery_not_completed"
  | "dead_letter_present"
  | "cancelled_task_present"
  | "resume_in_progress";

export type ResumeBacklinksDryRunResult =
  | { kind: "rejected"; reason: ResumeRejectionReason }
  | { kind: "completed"; workerInvocations: number; completedTasks: number }
  | {
      kind: "pending_retry";
      workerInvocations: number;
      completedTasks: number;
      waitingFor: "retry_delay" | "dependency" | "claim";
      retryAt: string | null;
    }
  | { kind: "failed"; workerInvocations: number; completedTasks: number };

export type ResumeBacklinksDryRunDependencies = {
  getRun: (input: { workspaceId: string; runId: string }) => Promise<AutomationRun | null>;
  listTasks: (input: { workspaceId: string; runId: string }) => Promise<readonly AutomationTask[]>;
  reclaimExpiredTasks: (input: ReclaimExpiredAutomationTasksInput) => Promise<readonly AutomationTask[]>;
  executeWorkerOnce: (input: ExecuteAutomationWorkerOnceInput) => Promise<ExecuteAutomationWorkerOnceResult>;
  completeRun: (input: CompleteAutomationRunInput) => Promise<{ kind: "transitioned" | "rejected" }>;
  failRun: (input: FailAutomationRunInput) => Promise<{ kind: "transitioned" | "rejected" }>;
};

export type ResumeBacklinksDryRunInput = {
  workspaceId: string;
  runId: string;
  workerId: string;
  /** One reference instant for claims, retry-delay checks and lease expiry. */
  now: string;
  leaseDurationSeconds: number;
  maxWorkerInvocations?: number;
};

function reject(reason: ResumeRejectionReason): ResumeBacklinksDryRunResult {
  return { kind: "rejected", reason };
}

/** Mirrors claim_next_automation_task ordering: priority, available_at, scheduled_at, created_at. */
function byClaimOrder(a: AutomationTask, b: AutomationTask): number {
  return (
    a.priority - b.priority ||
    Date.parse(a.availableAt) - Date.parse(b.availableAt) ||
    Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) ||
    Date.parse(a.createdAt) - Date.parse(b.createdAt)
  );
}

function isUnexpiredRunning(task: AutomationTask, nowMs: number): boolean {
  return task.status === "running" && (task.leaseExpiresAt === null || Date.parse(task.leaseExpiresAt) > nowMs);
}

function checkEligibility(run: AutomationRun | null, tasks: readonly AutomationTask[], input: ResumeBacklinksDryRunInput): ResumeRejectionReason | null {
  if (run === null || run.id !== input.runId || run.workspaceId !== input.workspaceId) return "run_not_found";
  if (run.status !== "running") return "run_not_running";
  if (run.runKind !== RESUMABLE_RUN_KIND || run.mode !== "dry_run") return "run_kind_unsupported";
  if (tasks.some((task) => task.runId !== input.runId || task.workspaceId !== input.workspaceId || !ALLOWED_TASK_KINDS.includes(task.taskKind))) {
    return "unsupported_tasks";
  }
  const discovery = tasks.find((task) => task.taskKind === DISCOVERY_KIND);
  if (discovery === undefined || discovery.status !== "completed") return "discovery_not_completed";
  if (tasks.some((task) => task.status === "dead_letter")) return "dead_letter_present";
  if (tasks.some((task) => task.status === "cancelled" || task.status === "failed")) return "cancelled_task_present";
  return null;
}

// Same-instance guard: a double submit that lands on this server instance runs once. Across instances the
// protection is the live-lease check below plus the atomic task claim in the database (a task is never
// executed twice); it is not a database-level mutual exclusion for the whole run.
const activeResumes = new Set<string>();

export async function resumeBacklinksDryRun(
  deps: ResumeBacklinksDryRunDependencies,
  input: ResumeBacklinksDryRunInput,
): Promise<ResumeBacklinksDryRunResult> {
  const key = `${input.workspaceId}:${input.runId}`;
  if (activeResumes.has(key)) return reject("resume_in_progress");
  activeResumes.add(key);
  try {
    return await resumeBacklinksDryRunUnguarded(deps, input);
  } finally {
    activeResumes.delete(key);
  }
}

async function resumeBacklinksDryRunUnguarded(
  deps: ResumeBacklinksDryRunDependencies,
  input: ResumeBacklinksDryRunInput,
): Promise<ResumeBacklinksDryRunResult> {
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error("now must be a valid date");
  const maxInvocations = Math.min(input.maxWorkerInvocations ?? RESUME_MAX_WORKER_INVOCATIONS, RESUME_MAX_WORKER_INVOCATIONS);
  const scope = { workspaceId: input.workspaceId, runId: input.runId };

  const run = await deps.getRun(scope);
  let tasks = await deps.listTasks(scope);
  const rejection = checkEligibility(run, tasks, input);
  if (rejection !== null) return reject(rejection);

  // Crash recovery with the existing primitive: only tasks whose lease already expired are re-queued
  // (and dead-lettered if out of attempts). Tasks with a live lease are never touched.
  if (tasks.some((task) => task.status === "running" && !isUnexpiredRunning(task, nowMs))) {
    await deps.reclaimExpiredTasks({ ...scope, reclaimedAt: input.now, limit: RECLAIM_LIMIT });
    tasks = await deps.listTasks(scope);
    const afterReclaim = checkEligibility(run, tasks, input);
    if (afterReclaim !== null) return reject(afterReclaim);
  }

  // Another resume (or a worker) is executing a task right now: do not start a second one.
  if (tasks.some((task) => isUnexpiredRunning(task, nowMs))) return reject("resume_in_progress");

  let workerInvocations = 0;
  let completedTasks = 0;
  let waitingFor: "retry_delay" | "dependency" | "claim" | null = null;

  for (let index = 0; index < maxInvocations; index += 1) {
    tasks = await deps.listTasks(scope);
    if (tasks.some((task) => task.status === "dead_letter")) break;
    if (tasks.some((task) => isUnexpiredRunning(task, nowMs))) {
      waitingFor = "claim";
      break;
    }

    const queued = tasks.filter((task) => task.status === "queued" && task.attemptCount < task.maxAttempts).sort(byClaimOrder);
    if (queued.length === 0) break;
    const claimable = queued.filter((task) => Date.parse(task.availableAt) <= nowMs);
    if (claimable.length === 0) {
      waitingFor = "retry_delay";
      break;
    }

    // claim_next_automation_task does not check dependencies, so it would hand out a task whose
    // dependency is unfinished (and burn one of its attempts). Only invoke the worker when the task it
    // is about to claim is ready.
    const next = claimable[0]!;
    const dependency = next.dependsOnTaskId === null ? null : tasks.find((task) => task.id === next.dependsOnTaskId) ?? null;
    if (next.dependsOnTaskId !== null && (dependency === null || dependency.status !== "completed")) {
      // Report the root cause: a dependency that is merely waiting out its retry delay is a retry delay.
      waitingFor =
        dependency !== null && dependency.status === "queued" && Date.parse(dependency.availableAt) > nowMs
          ? "retry_delay"
          : "dependency";
      break;
    }

    workerInvocations += 1;
    const result = await deps.executeWorkerOnce({
      workspaceId: input.workspaceId,
      runId: input.runId,
      workerId: input.workerId,
      claimedAt: input.now,
      attemptedAt: input.now,
      leaseDurationSeconds: input.leaseDurationSeconds,
    });
    if (result.kind === "empty") {
      waitingFor = "claim";
      break;
    }
    if (result.kind === "completed") completedTasks += 1;
    if (result.kind === "dead_letter") break;
  }

  tasks = await deps.listTasks(scope);
  if (tasks.some((task) => task.status === "dead_letter")) {
    await deps.failRun({
      ...scope,
      failedAt: input.now,
      errorCode: "AUTOMATION_RUN_TASKS_DEAD_LETTERED",
      errorMessage: "One or more automation tasks reached dead-letter status",
    });
    return { kind: "failed", workerInvocations, completedTasks };
  }

  const allCompleted = tasks.length > 0 && tasks.every((task) => task.status === "completed");
  if (allCompleted) {
    const completed = await deps.completeRun({
      ...scope,
      completedAt: input.now,
      summary: { workerInvocations, completedTasks, resumed: true },
    });
    if (completed.kind === "rejected") {
      // A concurrent resume may have completed the run first; anything else is unexpected.
      const current = await deps.getRun(scope);
      if (current === null || current.status !== "completed") throw new Error("AUTOMATION_RUN_COMPLETION_REJECTED");
    }
    return { kind: "completed", workerInvocations, completedTasks };
  }

  const retryTimes = tasks
    .filter((task) => task.status === "queued" && task.attemptCount < task.maxAttempts)
    .map((task) => Date.parse(task.availableAt))
    .filter((time) => time > nowMs);
  return {
    kind: "pending_retry",
    workerInvocations,
    completedTasks,
    waitingFor: waitingFor ?? (retryTimes.length > 0 ? "retry_delay" : "claim"),
    retryAt: retryTimes.length > 0 ? new Date(Math.min(...retryTimes)).toISOString() : null,
  };
}
