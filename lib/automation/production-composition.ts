import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import { cancelAutomationTask, claimNextAutomationTask, completeAutomationTask, createOrGetAutomationTask, failAutomationTask, heartbeatAutomationTask, reclaimExpiredAutomationTasks } from "./repositories/automationTasksRepository";
import { cancelAutomationRun, completeAutomationRun, createOrGetAutomationRun, failAutomationRun, getAutomationWorkspaceControl, startAutomationRun } from "./repositories/automationRunsRepository";
import { createDryRunAutomationTaskHandlers } from "./dry-run-handlers";
import { createMockBacklinkDiscoveryProvider } from "./mock-backlink-discovery-provider";
import type { BacklinkDiscoveryProviderRegistry } from "./backlink-discovery-provider-types";
import { demoBacklinkDiscoveryFixtures } from "./demo-backlink-discovery-fixtures";
import { isBacklinkDiscoveryDemoProviderEnabled } from "./backlink-discovery-feature-flags";
import { prepareBacklinksAutomationRun } from "./preparation-service";
import { createAutomationRun } from "./run-service";
import { completeAutomationRun as completeRunService, failAutomationRun as failRunService, startAutomationRun as startRunService } from "./transition-service";
import { executeBacklinksDryRunOrchestrator } from "./orchestrator";
import { runBacklinksAutomationSchedulerTick } from "./scheduler-tick";
import type { AutomationTaskDependencies, CreateAutomationRunDependencies } from "./types";
import { executeAutomationWorkerOnce } from "./worker";
import type { ExecuteAutomationWorkerOnceInput, ExecuteAutomationWorkerOnceResult } from "./worker-types";
import type { ExecuteBacklinksDryRunOrchestratorInput, ExecuteBacklinksDryRunOrchestratorResult } from "./orchestrator-types";
import type { PrepareBacklinksAutomationRunInput, PrepareBacklinksAutomationRunResult } from "./preparation-types";
import type { RunBacklinksAutomationSchedulerTickInput, RunBacklinksAutomationSchedulerTickResult } from "./scheduler-tick-types";

export function createAutomationProductionComposition(): {
  executeWorkerOnce: (
    input: ExecuteAutomationWorkerOnceInput,
  ) => Promise<ExecuteAutomationWorkerOnceResult>;
  prepareBacklinksDryRun: (
    input: PrepareBacklinksAutomationRunInput,
  ) => Promise<PrepareBacklinksAutomationRunResult>;
  executeBacklinksDryRun: (
    input: ExecuteBacklinksDryRunOrchestratorInput,
  ) => Promise<ExecuteBacklinksDryRunOrchestratorResult>;
  runBacklinksSchedulerTick: (
    input: RunBacklinksAutomationSchedulerTickInput,
  ) => Promise<RunBacklinksAutomationSchedulerTickResult>;
} {
  const client = createSupabaseAdminClient();
  const discoveryProviders: BacklinkDiscoveryProviderRegistry =
    isBacklinkDiscoveryDemoProviderEnabled()
      ? Object.freeze({
          mock: createMockBacklinkDiscoveryProvider(demoBacklinkDiscoveryFixtures),
        })
      : Object.freeze({});
  const dryRunHandlers = createDryRunAutomationTaskHandlers({
    providers: discoveryProviders,
  });
  const taskDependencies: AutomationTaskDependencies = {
    createOrGetTask: (input) => createOrGetAutomationTask(client, input),
    claimNextTask: (input) => claimNextAutomationTask(client, input),
    heartbeatTask: (input) => heartbeatAutomationTask(client, input),
    completeTask: (input) => completeAutomationTask(client, input),
    failTask: (input) => failAutomationTask(client, input),
    reclaimExpiredTasks: (input) => reclaimExpiredAutomationTasks(client, input),
    cancelTask: (input) => cancelAutomationTask(client, input),
  };
  const runDependencies: CreateAutomationRunDependencies = {
    getWorkspaceControl: (workspaceId) => getAutomationWorkspaceControl(client, workspaceId),
    createOrGetRun: (input) => createOrGetAutomationRun(client, input),
  };
  const executeWorkerOnce = (input: ExecuteAutomationWorkerOnceInput) =>
    executeAutomationWorkerOnce(
      { ...taskDependencies, executeHandler: dryRunHandlers.execute },
      input,
    );
  const prepareBacklinksDryRun = (input: PrepareBacklinksAutomationRunInput) =>
    prepareBacklinksAutomationRun(
      {
        createRun: (runInput) => createAutomationRun(runInput, runDependencies),
        createTask: (taskInput) => createOrGetAutomationTask(client, taskInput),
      },
      input,
    );
  const executeBacklinksDryRun = (input: ExecuteBacklinksDryRunOrchestratorInput) =>
    executeBacklinksDryRunOrchestrator(
      {
        startRun: (runInput) =>
          startRunService({ startRun: (transitionInput) => startAutomationRun(client, transitionInput), completeRun: (transitionInput) => completeAutomationRun(client, transitionInput), failRun: (transitionInput) => failAutomationRun(client, transitionInput), cancelRun: (transitionInput) => cancelAutomationRun(client, transitionInput) }, runInput),
        executeWorkerOnce,
        completeRun: (runInput) =>
          completeRunService({ startRun: (transitionInput) => startAutomationRun(client, transitionInput), completeRun: (transitionInput) => completeAutomationRun(client, transitionInput), failRun: (transitionInput) => failAutomationRun(client, transitionInput), cancelRun: (transitionInput) => cancelAutomationRun(client, transitionInput) }, runInput),
        failRun: (runInput) =>
          failRunService({ startRun: (transitionInput) => startAutomationRun(client, transitionInput), completeRun: (transitionInput) => completeAutomationRun(client, transitionInput), failRun: (transitionInput) => failAutomationRun(client, transitionInput), cancelRun: (transitionInput) => cancelAutomationRun(client, transitionInput) }, runInput),
      }, input);

  return {
    prepareBacklinksDryRun,
    executeWorkerOnce,
    executeBacklinksDryRun,
    runBacklinksSchedulerTick: (input) =>
      runBacklinksAutomationSchedulerTick(
        { prepareBacklinksDryRun, executeBacklinksDryRun },
        input,
      ),
  };
}
