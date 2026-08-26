import type { RunBacklinkVerificationSchedulerTickResult } from "./scheduler-types";
import {
  runBacklinkReverificationProducer,
  type BacklinkReverificationProducerDependencies,
  type BacklinkReverificationProducerInput,
  type BacklinkReverificationProducerSummary,
} from "./reverification-producer";
import type { BacklinkReverificationRuntimeConfig } from "./reverification-config";

export type BacklinkReverificationAutomationDependencies =
  BacklinkReverificationProducerDependencies & {
    runSchedulerTick: (
      input: {
        workspaceId: string;
        workerId: string;
        scheduledAt: string;
        leaseDurationSeconds: number;
        maxIterations: number;
      },
    ) => Promise<RunBacklinkVerificationSchedulerTickResult>;
  };

export type BacklinkReverificationAutomationInput = {
  workspaceLimit?: number;
  candidateLimitPerWorkspace?: number;
  schedulerMaxIterations?: number;
  workerId: string;
  leaseDurationSeconds: number;
  now?: string;
  config: BacklinkReverificationRuntimeConfig;
};

export type BacklinkReverificationAutomationWorkspaceResult = {
  workspaceId: string;
  producer: BacklinkReverificationProducerSummary["workspaces"][number];
  scheduler: RunBacklinkVerificationSchedulerTickResult;
};

export type BacklinkReverificationAutomationResult =
  | {
      disposition: "disabled";
      reason: "BACKLINK_REVERIFICATION_DISABLED";
      producer: null;
      scheduler: null;
    }
  | {
      disposition: "completed";
      producer: BacklinkReverificationProducerSummary;
      scheduler: {
        workspacesScanned: number;
        workspacesSucceeded: number;
        workspacesFailed: number;
        empty: number;
        maxIterationsReached: number;
        workspaces: BacklinkReverificationAutomationWorkspaceResult[];
      };
    };

const DEFAULT_SCHEDULER_MAX_ITERATIONS = 10;

export async function runBacklinkReverificationAutomation(
  dependencies: BacklinkReverificationAutomationDependencies,
  input: BacklinkReverificationAutomationInput,
): Promise<BacklinkReverificationAutomationResult> {
  if (!input.config.enabled) {
    return {
      disposition: "disabled",
      reason: "BACKLINK_REVERIFICATION_DISABLED",
      producer: null,
      scheduler: null,
    };
  }

  const producer = await runBacklinkReverificationProducer(dependencies, {
    workspaceLimit: input.workspaceLimit,
    candidateLimitPerWorkspace: input.candidateLimitPerWorkspace,
    cadenceDays: input.config.cadenceDays,
    now: input.now,
  });

  const schedulerMaxIterations = input.schedulerMaxIterations ?? DEFAULT_SCHEDULER_MAX_ITERATIONS;
  const schedulerResults: BacklinkReverificationAutomationWorkspaceResult[] = [];
  let schedulerWorkspacesSucceeded = 0;
  let schedulerWorkspacesFailed = 0;
  let empty = 0;
  let maxIterationsReached = 0;

  for (const workspace of producer.workspaces) {
    try {
      const scheduler = await dependencies.runSchedulerTick({
        workspaceId: workspace.workspaceId,
        workerId: input.workerId,
        scheduledAt: input.now ?? new Date().toISOString(),
        leaseDurationSeconds: input.leaseDurationSeconds,
        maxIterations: schedulerMaxIterations,
      });

      schedulerResults.push({
        workspaceId: workspace.workspaceId,
        producer: workspace,
        scheduler,
      });

      schedulerWorkspacesSucceeded += 1;
      if (scheduler.kind === "empty") {
        empty += 1;
      } else if (scheduler.kind === "max_iterations_reached") {
        maxIterationsReached += 1;
      }
    } catch {
      schedulerWorkspacesFailed += 1;
    }
  }

  return {
    disposition: "completed",
    producer,
    scheduler: {
      workspacesScanned: producer.workspaces.length,
      workspacesSucceeded: schedulerWorkspacesSucceeded,
      workspacesFailed: schedulerWorkspacesFailed,
      empty,
      maxIterationsReached,
      workspaces: schedulerResults,
    },
  };
}
