import type { BacklinkDiscoveryPreviewOutputV1 } from "./backlink-discovery-handler-types";
import type { BacklinkQualificationPreviewOutputV1 } from "./backlink-qualification-types";
import type { BacklinkPromotionPreviewOutputV1 } from "./backlink-promotion-types";
import type {
  AutomationExecutionIssue,
  BacklinksDryRunStopReason,
  ExecuteBacklinksDryRunOrchestratorDependencies,
  ExecuteBacklinksDryRunOrchestratorInput,
  ExecuteBacklinksDryRunOrchestratorResult,
} from "./orchestrator-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validate(input: ExecuteBacklinksDryRunOrchestratorInput): void {
  if (!UUID.test(input.workspaceId) || !UUID.test(input.runId)) {
    throw new Error("workspaceId and runId must be valid UUIDs");
  }
  if (!input.workerId.trim()) {
    throw new Error("workerId must not be empty");
  }
  for (const value of [
    input.startedAt,
    input.attemptedAt,
    input.completedAt,
    input.failedAt,
  ]) {
    if (!Number.isFinite(Date.parse(value))) {
      throw new Error("orchestrator dates must be valid");
    }
  }
  if (
    !Number.isInteger(input.leaseDurationSeconds) ||
    input.leaseDurationSeconds < 30 ||
    input.leaseDurationSeconds > 3600
  ) {
    throw new Error("leaseDurationSeconds must be an integer between 30 and 3600");
  }
  if (
    !Number.isInteger(input.maxWorkerInvocations) ||
    input.maxWorkerInvocations < 1 ||
    input.maxWorkerInvocations > 100
  ) {
    throw new Error("maxWorkerInvocations must be an integer between 1 and 100");
  }
}

function workerMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message.slice(0, 500)
    : "Automation worker failed";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBacklinkDiscoveryPreviewOutput(
  value: unknown,
): value is BacklinkDiscoveryPreviewOutputV1 {
  if (!isObject(value) || !isObject(value.summary)) {
    return false;
  }

  return (
    value.version === 1 &&
    value.kind === "backlinks.discovery.preview" &&
    value.dryRun === true &&
    Array.isArray(value.candidates)
  );
}

function isBacklinkQualificationPreviewOutput(
  value: unknown,
): value is BacklinkQualificationPreviewOutputV1 {
  return (
    isObject(value) &&
    value.version === 1 &&
    value.kind === "backlinks.qualification.preview" &&
    value.dryRun === true &&
    value.policyVersion === "backlink-qualification-v1" &&
    isObject(value.summary) &&
    Array.isArray(value.results)
  );
}

function isBacklinkPromotionPreviewOutput(
  value: unknown,
): value is BacklinkPromotionPreviewOutputV1 {
  return (
    isObject(value) &&
    value.version === 1 &&
    value.kind === "backlinks.promotion.preview" &&
    value.dryRun === true &&
    value.policyVersion === "backlink-promotion-v1" &&
    isObject(value.summary) &&
    Array.isArray(value.proposals) &&
    Array.isArray(value.skippedItems)
  );
}

function boundedText(value: string | null, maximumLength: number): string | null {
  const normalized = value?.trim().slice(0, maximumLength) ?? "";
  return normalized.length === 0 ? null : normalized;
}

function issueFromTask(task: { taskKind: string; errorCode: string | null; errorMessage: string | null }): AutomationExecutionIssue {
  return {
    taskKind: boundedText(task.taskKind, 100) ?? "automation",
    code: boundedText(task.errorCode, 100) ?? "AUTOMATION_TASK_EXECUTION_FAILED",
    message:
      boundedText(task.errorMessage, 300) ??
      "La tâche Automation n’a pas pu être exécutée.",
  };
}

export async function executeBacklinksDryRunOrchestrator(
  dependencies: ExecuteBacklinksDryRunOrchestratorDependencies,
  input: ExecuteBacklinksDryRunOrchestratorInput,
): Promise<ExecuteBacklinksDryRunOrchestratorResult> {
  validate(input);

  const started = await dependencies.startRun({
    workspaceId: input.workspaceId,
    runId: input.runId,
    startedAt: input.startedAt,
  });
  if (started.kind === "rejected") {
    throw new Error("AUTOMATION_RUN_START_REJECTED");
  }

  let workerInvocations = 0;
  let completedTasks = 0;
  let retriedTasks = 0;
  let deadLetterTasks = 0;
  let discoveryPreview: BacklinkDiscoveryPreviewOutputV1 | null = null;
  let discoveryPreviewTaskId: string | null = null;
  let qualificationPreview: BacklinkQualificationPreviewOutputV1 | null = null;
  let qualificationPreviewTaskId: string | null = null;
  let promotionPreview: BacklinkPromotionPreviewOutputV1 | null = null;
  let lastIssue: AutomationExecutionIssue | null = null;
  let stoppedBecause: BacklinksDryRunStopReason = "max_worker_invocations";

  for (let index = 0; index < input.maxWorkerInvocations; index += 1) {
    let result;
    workerInvocations += 1;

    try {
      result = await dependencies.executeWorkerOnce({
        workspaceId: input.workspaceId,
        runId: input.runId,
        workerId: input.workerId,
        claimedAt: input.attemptedAt,
        attemptedAt: input.attemptedAt,
        leaseDurationSeconds: input.leaseDurationSeconds,
      });
    } catch (error) {
      const failed = await dependencies.failRun({
        workspaceId: input.workspaceId,
        runId: input.runId,
        failedAt: input.failedAt,
        errorCode: "AUTOMATION_RUN_WORKER_FAILED",
        errorMessage: workerMessage(error),
      });
      if (failed.kind === "rejected") {
        throw new Error("AUTOMATION_RUN_FAILURE_REJECTED");
      }
      throw error;
    }

    if (result.kind === "empty") {
      stoppedBecause = "empty";
      break;
    }
    if (result.kind === "completed") {
      completedTasks += 1;
      if (
        result.task.taskKind === "backlinks.discovery.preview" &&
        isBacklinkDiscoveryPreviewOutput(result.output)
      ) {
        discoveryPreview = result.output;
        discoveryPreviewTaskId = result.task.id;
      }
      if (
        result.task.taskKind === "backlinks.qualification.preview" &&
        isBacklinkQualificationPreviewOutput(result.output)
      ) {
        qualificationPreview = result.output;
        qualificationPreviewTaskId = result.task.id;
      }
      if (
        result.task.taskKind === "backlinks.promotion.preview" &&
        isBacklinkPromotionPreviewOutput(result.output)
      ) {
        promotionPreview = result.output;
      }
    }
    if (result.kind === "retried") {
      retriedTasks += 1;
      lastIssue = issueFromTask(result.task);
    }
    if (result.kind === "dead_letter") {
      deadLetterTasks += 1;
      lastIssue = issueFromTask(result.task);
    }
  }

  const summary = {
    workerInvocations,
    completedTasks,
    retriedTasks,
    deadLetterTasks,
    stoppedBecause,
  };
  const execution = { ...summary, discoveryPreview, discoveryPreviewTaskId, qualificationPreview, qualificationPreviewTaskId, promotionPreview, lastIssue };

  if (retriedTasks > 0 && deadLetterTasks === 0) {
    return { ...execution, kind: "pending_retry", deadLetterTasks: 0 };
  }

  if (deadLetterTasks > 0) {
    const failed = await dependencies.failRun({
      workspaceId: input.workspaceId,
      runId: input.runId,
      failedAt: input.failedAt,
      errorCode: "AUTOMATION_RUN_TASKS_DEAD_LETTERED",
      errorMessage: "One or more automation tasks reached dead-letter status",
    });
    if (failed.kind === "rejected") {
      throw new Error("AUTOMATION_RUN_FAILURE_REJECTED");
    }
    return { ...execution, kind: "failed" };
  }

  const completed = await dependencies.completeRun({
    workspaceId: input.workspaceId,
    runId: input.runId,
    completedAt: input.completedAt,
    summary,
  });
  if (completed.kind === "rejected") {
    throw new Error("AUTOMATION_RUN_COMPLETION_REJECTED");
  }
  return { ...execution, kind: "completed", lastIssue: null };
}
