import { validateBacklinkCampaignEnginePreviewOutput } from "./backlink-campaign-engine-validation";
import { BacklinkCampaignRunExecutionError, type ExecuteBacklinkCampaignPreviewRunDependencies, type ExecuteBacklinkCampaignPreviewRunInput, type ExecuteBacklinkCampaignPreviewRunResult } from "./backlink-campaign-run-executor-types";
import { BacklinkCampaignEnginePreviewOutputV1 } from "./backlink-campaign-engine-types";

function assertInput(i: ExecuteBacklinkCampaignPreviewRunInput): void {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID.test(i.workspaceId) || !UUID.test(i.runId)) throw new Error("workspaceId and runId must be valid UUIDs");
  if (!i.workerId || i.workerId.trim().length === 0) throw new Error("workerId must be present");
  if (!Number.isFinite(Date.parse(i.startedAt)) || !Number.isFinite(Date.parse(i.attemptedAt))) throw new Error("dates must be valid");
  if (!Number.isInteger(i.leaseDurationSeconds) || i.leaseDurationSeconds < 30 || i.leaseDurationSeconds > 3600) throw new Error("leaseDurationSeconds out of range");
  if (!Number.isInteger(i.maxWorkerInvocations) || i.maxWorkerInvocations < 1 || i.maxWorkerInvocations > 100) throw new Error("maxWorkerInvocations out of range");
}

export async function executeBacklinkCampaignPreviewRun(
  d: ExecuteBacklinkCampaignPreviewRunDependencies,
  input: ExecuteBacklinkCampaignPreviewRunInput,
): Promise<ExecuteBacklinkCampaignPreviewRunResult> {
  assertInput(input);

  const started = await d.startRun({ workspaceId: input.workspaceId, runId: input.runId, startedAt: input.startedAt });
  if (started.kind === "rejected") {
    return { kind: "rejected", reason: "run_not_started" };
  }

  let preview: BacklinkCampaignEnginePreviewOutputV1 | null = null;
  let lastTask: any = null;
  let invocations = 0;

  for (let i = 0; i < input.maxWorkerInvocations; i++) {
    invocations += 1;
    const res = await d.executeWorkerOnce({
      workspaceId: input.workspaceId,
      runId: input.runId,
      workerId: input.workerId,
      claimedAt: input.attemptedAt,
      attemptedAt: input.attemptedAt,
      leaseDurationSeconds: input.leaseDurationSeconds,
    });

    if (res.kind === "empty") {
      // no task claimed
      return { kind: "pending_retry", run: started.run, task: lastTask ?? null, preview, workerInvocations: invocations };
    }

    if (res.kind === "retried" || res.kind === "dead_letter") {
      lastTask = res.task;
      // Determine terminal state
      if (res.kind === "dead_letter") {
        // try to extract safe error
        const code = "AUTOMATION_TASK_EXECUTION_FAILED";
        const message = "Task entered dead letter";
        await d.failRun({ workspaceId: input.workspaceId, runId: input.runId, failedAt: input.failedAt, errorCode: code, errorMessage: message });
        return { kind: "failed", run: started.run, task: res.task, preview: null, workerInvocations: invocations, lastIssue: { taskKind: res.task.taskKind, code, message } };
      }
      // retried -> pending_retry
      return { kind: "pending_retry", run: started.run, task: res.task, preview: null, workerInvocations: invocations };
    }

    if (res.kind === "completed") {
      lastTask = res.task;
      // validate task kind and run/workspace
      if (res.task.taskKind !== "backlinks.campaign.preview" || res.task.workspaceId !== input.workspaceId || res.task.runId !== input.runId) {
        throw new BacklinkCampaignRunExecutionError();
      }
      if (res.output == null) {
        // Completed without output -> treat as pending
        return {
          kind: "pending_retry",
          run: started.run,
          task: res.task,
          preview: null,
          workerInvocations: invocations,
        };
      }

      // Validate the output returned directly by the Worker.
      try {
        validateBacklinkCampaignEnginePreviewOutput(res.output);
        preview = res.output as BacklinkCampaignEnginePreviewOutputV1;
      } catch (e) {
        // invalid preview -> fail run
        const code = "INVALID_CAMPAIGN_PREVIEW_OUTPUT";
        const message = e instanceof Error ? e.message.slice(0, 300) : "Invalid preview output";
        await d.failRun({ workspaceId: input.workspaceId, runId: input.runId, failedAt: input.failedAt, errorCode: code, errorMessage: message });
        return { kind: "failed", run: started.run, task: res.task, preview: null, workerInvocations: invocations, lastIssue: { taskKind: res.task.taskKind, code, message } };
      }

      // completed with valid preview -> complete run
      await d.completeRun({ workspaceId: input.workspaceId, runId: input.runId, completedAt: input.completedAt, summary: { campaignPreview: preview } });
      return { kind: "completed", run: started.run, task: res.task, preview, workerInvocations: invocations };
    }
  }

  // reached invocation limit
  return { kind: "pending_retry", run: started.run, task: lastTask, preview, workerInvocations: invocations };
}
