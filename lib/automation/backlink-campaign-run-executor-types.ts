import type { Json } from "@/types/database.types";
import type { AutomationRun, AutomationTask, StartAutomationRunResult, CompleteAutomationRunResult, FailAutomationRunResult } from "./types";
import type { ExecuteAutomationWorkerOnceInput, ExecuteAutomationWorkerOnceResult } from "./worker-types";
import type { BacklinkCampaignEnginePreviewOutputV1 } from "./backlink-campaign-engine-types";

export type ExecuteBacklinkCampaignPreviewRunInput = {
  workspaceId: string;
  runId: string;
  workerId: string;
  startedAt: string;
  attemptedAt: string;
  completedAt: string;
  failedAt: string;
  leaseDurationSeconds: number;
  maxWorkerInvocations: number;
};

export type ExecuteBacklinkCampaignPreviewRunDependencies = {
  startRun(input: { workspaceId: string; runId: string; startedAt: string }): Promise<StartAutomationRunResult>;
  executeWorkerOnce(input: ExecuteAutomationWorkerOnceInput): Promise<ExecuteAutomationWorkerOnceResult>;
  completeRun(input: { workspaceId: string; runId: string; completedAt: string; summary: Json | null }): Promise<CompleteAutomationRunResult>;
  failRun(input: { workspaceId: string; runId: string; failedAt: string; errorCode: string; errorMessage: string; }): Promise<FailAutomationRunResult>;
};

export type ExecuteBacklinkCampaignPreviewRunResult =
  | {
      kind: "completed";
      run: AutomationRun;
      task: AutomationTask;
      preview: BacklinkCampaignEnginePreviewOutputV1;
      workerInvocations: number;
    }
  | {
      kind: "pending_retry";
      run: AutomationRun;
      task: AutomationTask | null;
      preview: BacklinkCampaignEnginePreviewOutputV1 | null;
      workerInvocations: number;
    }
  | {
      kind: "failed";
      run: AutomationRun;
      task: AutomationTask | null;
      preview: BacklinkCampaignEnginePreviewOutputV1 | null;
      workerInvocations: number;
      lastIssue: { taskKind: string; code: string; message: string };
    }
  | {
      kind: "rejected";
      reason: "run_not_started";
    };

export class BacklinkCampaignRunExecutionError extends Error {
  readonly code: "BACKLINK_CAMPAIGN_RUN_EXECUTION_INVARIANT";
  constructor() {
    super("Backlink campaign run execution invariant failed");
    this.name = "BacklinkCampaignRunExecutionError";
    this.code = "BACKLINK_CAMPAIGN_RUN_EXECUTION_INVARIANT";
  }
}
