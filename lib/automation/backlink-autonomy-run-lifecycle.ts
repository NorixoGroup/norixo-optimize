import type { AutomationRun, AutomationTask, CompleteAutomationRunInput, FailAutomationRunInput, StartAutomationRunInput } from "./types";

export type BacklinkAutonomyRunLifecycleDependencies = {
  getRun: (input: { workspaceId: string; runId: string }) => Promise<AutomationRun | null>;
  listTasks: (input: { workspaceId: string; runId: string }) => Promise<readonly AutomationTask[]>;
  startRun: (input: StartAutomationRunInput) => Promise<AutomationRun | null>;
  completeRun: (input: CompleteAutomationRunInput) => Promise<AutomationRun | null>;
  failRun: (input: FailAutomationRunInput) => Promise<AutomationRun | null>;
};

export type BacklinkAutonomyRunLifecycleResult =
  | { kind: "missing" | "not_started" | "active" | "already_terminal"; runStatus: AutomationRun["status"] | null }
  | { kind: "completed" | "failed"; runStatus: AutomationRun["status"] };

function summary(tasks: readonly AutomationTask[]) {
  return {
    version: 1,
    taskCounts: {
      queued: tasks.filter((task) => task.status === "queued").length,
      running: tasks.filter((task) => task.status === "running").length,
      completed: tasks.filter((task) => task.status === "completed").length,
      failed: tasks.filter((task) => task.status === "failed").length,
      deadLetter: tasks.filter((task) => task.status === "dead_letter").length,
      cancelled: tasks.filter((task) => task.status === "cancelled").length,
    },
  };
}

/**
 * Starts only runs that have persisted work, then closes a run only once every
 * task is terminal. It deliberately never claims or creates a task.
 */
export async function reconcileBacklinkAutonomyRunLifecycle(
  deps: BacklinkAutonomyRunLifecycleDependencies,
  input: { workspaceId: string; runId: string; at: string },
): Promise<BacklinkAutonomyRunLifecycleResult> {
  let run = await deps.getRun({ workspaceId: input.workspaceId, runId: input.runId });
  if (run == null) return { kind: "missing", runStatus: null };
  if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
    return { kind: "already_terminal", runStatus: run.status };
  }

  let tasks = await deps.listTasks({ workspaceId: input.workspaceId, runId: input.runId });
  if (tasks.length === 0) return { kind: "not_started", runStatus: run.status };

  if (run.status === "queued") {
    const started = await deps.startRun({ workspaceId: input.workspaceId, runId: input.runId, startedAt: input.at });
    // A concurrent tick may have won the state transition. Re-read rather
    // than treating that benign conflict as a failed lifecycle.
    run = started ?? await deps.getRun({ workspaceId: input.workspaceId, runId: input.runId });
    if (run == null) return { kind: "missing", runStatus: null };
    if (run.status !== "running") {
      return run.status === "completed" || run.status === "failed" || run.status === "cancelled"
        ? { kind: "already_terminal", runStatus: run.status }
        : { kind: "not_started", runStatus: run.status };
    }
  }

  tasks = await deps.listTasks({ workspaceId: input.workspaceId, runId: input.runId });
  if (tasks.some((task) => task.status === "queued" || task.status === "running")) {
    return { kind: "active", runStatus: "running" };
  }

  const taskSummary = summary(tasks);
  if (tasks.some((task) => task.status === "failed" || task.status === "dead_letter" || task.status === "cancelled")) {
    const failed = await deps.failRun({
      workspaceId: input.workspaceId,
      runId: input.runId,
      failedAt: input.at,
      errorCode: "BACKLINK_AUTONOMY_TASK_TERMINAL_FAILURE",
      errorMessage: "A backlink autonomy task reached a terminal non-completed state.",
    });
    return failed == null ? { kind: "active", runStatus: "running" } : { kind: "failed", runStatus: failed.status };
  }

  const completed = await deps.completeRun({
    workspaceId: input.workspaceId,
    runId: input.runId,
    completedAt: input.at,
    summary: taskSummary,
  });
  return completed == null ? { kind: "active", runStatus: "running" } : { kind: "completed", runStatus: completed.status };
}
