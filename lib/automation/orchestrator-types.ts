import type { BacklinkDiscoveryPreviewOutputV1 } from "./backlink-discovery-handler-types";
import type { BacklinkQualificationPreviewOutputV1 } from "./backlink-qualification-types";
import type {
  CompleteAutomationRunInput,
  CompleteAutomationRunResult,
  FailAutomationRunInput,
  FailAutomationRunResult,
  StartAutomationRunInput,
  StartAutomationRunResult,
} from "./types";
import type {
  ExecuteAutomationWorkerOnceInput,
  ExecuteAutomationWorkerOnceResult,
} from "./worker-types";

export type ExecuteBacklinksDryRunOrchestratorInput = {
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

export type ExecuteBacklinksDryRunOrchestratorDependencies = {
  startRun: (input: StartAutomationRunInput) => Promise<StartAutomationRunResult>;
  executeWorkerOnce: (
    input: ExecuteAutomationWorkerOnceInput,
  ) => Promise<ExecuteAutomationWorkerOnceResult>;
  completeRun: (
    input: CompleteAutomationRunInput,
  ) => Promise<CompleteAutomationRunResult>;
  failRun: (input: FailAutomationRunInput) => Promise<FailAutomationRunResult>;
};

export type BacklinksDryRunStopReason = "empty" | "max_worker_invocations";

export type AutomationExecutionIssue = {
  taskKind: string;
  code: string;
  message: string;
};

type ExecuteBacklinksDryRunOrchestratorBaseResult = {
  workerInvocations: number;
  completedTasks: number;
  retriedTasks: number;
  deadLetterTasks: number;
  stoppedBecause: BacklinksDryRunStopReason;
  discoveryPreview: BacklinkDiscoveryPreviewOutputV1 | null;
  qualificationPreview: BacklinkQualificationPreviewOutputV1 | null;
  lastIssue: AutomationExecutionIssue | null;
};

export type ExecuteBacklinksDryRunOrchestratorResult =
  | (ExecuteBacklinksDryRunOrchestratorBaseResult & {
      kind: "completed";
    })
  | (ExecuteBacklinksDryRunOrchestratorBaseResult & {
      kind: "pending_retry";
      deadLetterTasks: 0;
    })
  | (ExecuteBacklinksDryRunOrchestratorBaseResult & {
      kind: "failed";
    });
