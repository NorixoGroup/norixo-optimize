import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import { cancelAutomationTask, claimNextAutomationTask, completeAutomationTask, createOrGetAutomationTask, failAutomationTask, getAutomationTaskByIdInRun, heartbeatAutomationTask, reclaimExpiredAutomationTasks } from "./repositories/automationTasksRepository";
import { cancelAutomationRun, completeAutomationRun, createOrGetAutomationRun, failAutomationRun, getAutomationWorkspaceControl, startAutomationRun } from "./repositories/automationRunsRepository";
import { createDryRunAutomationTaskHandlers } from "./dry-run-handlers";
import { createBraveBacklinkDiscoveryProvider } from "./brave-backlink-discovery-provider";
import { readBraveBacklinkDiscoveryRuntimeConfig } from "./brave-backlink-discovery-config";
import { createMockBacklinkDiscoveryProvider } from "./mock-backlink-discovery-provider";
import type { BacklinkDiscoveryProviderRegistry } from "./backlink-discovery-provider-types";
import { demoBacklinkDiscoveryFixtures } from "./demo-backlink-discovery-fixtures";
import { isBacklinkDiscoveryDemoProviderEnabled } from "./backlink-discovery-feature-flags";
import { DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1 } from "./backlink-qualification-policy";
import { DEFAULT_BACKLINK_PROMOTION_POLICY_V1 } from "./backlink-promotion-policy";
import { DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1 } from "./backlink-campaign-engine-policy";
import { buildBacklinkCampaignEnginePreviewInput } from "./backlink-campaign-engine-input-builder";
import { prepareBacklinksAutomationRun } from "./preparation-service";
import { getBacklinkCampaignById } from "@/lib/backlinks/repositories/campaignsRepository";
import { getBacklinkDomainById } from "@/lib/backlinks/repositories/domainsRepository";
import { getBacklinkOpportunityById } from "@/lib/backlinks/repositories/opportunitiesRepository";
import { createAutomationRun } from "./run-service";
import { completeAutomationRun as completeRunService, failAutomationRun as failRunService, startAutomationRun as startRunService } from "./transition-service";
import { executeBacklinksDryRunOrchestrator } from "./orchestrator";
import { runBacklinksAutomationSchedulerTick } from "./scheduler-tick";
import type { AutomationTaskDependencies, CreateAutomationRunDependencies } from "./types";
import { executeAutomationWorkerOnce } from "./worker";
import type { ExecuteAutomationWorkerOnceInput, ExecuteAutomationWorkerOnceResult } from "./worker-types";
import type { ExecuteAutomationTaskHandlerInput, ExecuteAutomationTaskHandlerResult } from "./handler-types";
import type { ExecuteBacklinksDryRunOrchestratorInput, ExecuteBacklinksDryRunOrchestratorResult } from "./orchestrator-types";
import type { PrepareBacklinksAutomationRunInput, PrepareBacklinksAutomationRunResult } from "./preparation-types";
import type { RunBacklinksAutomationSchedulerTickInput, RunBacklinksAutomationSchedulerTickResult } from "./scheduler-tick-types";
import type {
  PrepareBacklinkCampaignPreviewRunInput,
  PrepareBacklinkCampaignPreviewRunResult,
  PrepareBacklinkCampaignPreviewRunDependencies,
} from "./backlink-campaign-run-preparation-types";
import type {
  ExecuteBacklinkCampaignPreviewRunInput,
  ExecuteBacklinkCampaignPreviewRunResult,
  ExecuteBacklinkCampaignPreviewRunDependencies,
} from "./backlink-campaign-run-executor-types";

export function createAutomationProductionComposition(): {
  executeWorkerOnce: (input: ExecuteAutomationWorkerOnceInput) => Promise<ExecuteAutomationWorkerOnceResult>;
  prepareBacklinksDryRun: (input: PrepareBacklinksAutomationRunInput) => Promise<PrepareBacklinksAutomationRunResult>;
  executeBacklinksDryRun: (input: ExecuteBacklinksDryRunOrchestratorInput) => Promise<ExecuteBacklinksDryRunOrchestratorResult>;
  prepareBacklinkCampaignPreviewRun: (input: PrepareBacklinkCampaignPreviewRunInput) => Promise<PrepareBacklinkCampaignPreviewRunResult>;
  executeBacklinkCampaignPreviewRun: (input: ExecuteBacklinkCampaignPreviewRunInput) => Promise<ExecuteBacklinkCampaignPreviewRunResult>;
  runBacklinksSchedulerTick: (input: RunBacklinksAutomationSchedulerTickInput) => Promise<RunBacklinksAutomationSchedulerTickResult>;
} {
  const braveConfig = readBraveBacklinkDiscoveryRuntimeConfig();
  const client = createSupabaseAdminClient();
  const discoveryProviders: BacklinkDiscoveryProviderRegistry = Object.freeze({
    ...(isBacklinkDiscoveryDemoProviderEnabled()
      ? { mock: createMockBacklinkDiscoveryProvider(demoBacklinkDiscoveryFixtures) }
      : {}),
    ...(braveConfig.enabled
      ? {
          brave_search: createBraveBacklinkDiscoveryProvider({
            subscriptionToken: braveConfig.subscriptionToken,
            fetchImplementation: fetch,
          }),
        }
      : {}),
  });
  const buildCampaignPreviewInput = async (input: {
    workspaceId: string;
    runId: string;
    campaignId: string;
    source: "manual_dashboard" | "automation_campaign";
    opportunityIds: string[];
    requestedLimits: {
      maxSelectedOpportunities: number;
      maxPerDomain: number;
    };
  }) => {
    return buildBacklinkCampaignEnginePreviewInput(input, {
      getCampaignById: ({ workspaceId, campaignId }) => getBacklinkCampaignById(client, workspaceId, campaignId),
      getOpportunityById: ({ workspaceId, opportunityId }) => getBacklinkOpportunityById(client, workspaceId, opportunityId),
      getDomainById: ({ workspaceId, domainId }) => getBacklinkDomainById(client, workspaceId, domainId),
    });
  };
  const dryRunHandlers = createDryRunAutomationTaskHandlers({
    providers: discoveryProviders,
    getTaskByIdInRun: (input) => getAutomationTaskByIdInRun(client, input),
    qualificationPolicy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
    promotionPolicy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
    buildCampaignPreviewInput,
    campaignPolicy: DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
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
  const executeHandler = (
    handlerInput: ExecuteAutomationTaskHandlerInput,
  ): Promise<ExecuteAutomationTaskHandlerResult> => {
    if (
      braveConfig.enabled &&
      handlerInput.taskKind === "backlinks.discovery.preview" &&
      handlerInput.input.provider === "brave_search" &&
      (Array.isArray(handlerInput.input.searches) &&
        handlerInput.input.searches.length > braveConfig.maxSearchesPerRun ||
        typeof handlerInput.input.maxResultsPerSearch === "number" &&
          handlerInput.input.maxResultsPerSearch > braveConfig.maxResultsPerSearch)
    ) {
      throw new Error("BACKLINK_DISCOVERY_BRAVE_LIMIT_EXCEEDED");
    }

    return dryRunHandlers.execute(handlerInput);
  };
  const executeWorkerOnce = (input: ExecuteAutomationWorkerOnceInput) =>
    executeAutomationWorkerOnce(
      { ...taskDependencies, executeHandler },
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
    prepareBacklinkCampaignPreviewRun: (input: PrepareBacklinkCampaignPreviewRunInput) => {
      // Lazy require with typed module to avoid circular import and implicit any.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("./backlink-campaign-run-preparation") as typeof import("./backlink-campaign-run-preparation");
      const deps: PrepareBacklinkCampaignPreviewRunDependencies = {
        createRun: (runInput) => createAutomationRun(runInput, runDependencies),
        createTask: (taskInput) => createOrGetAutomationTask(client, taskInput),
      };
      return mod.prepareBacklinkCampaignPreviewRun(deps, input);
    },
    executeBacklinkCampaignPreviewRun: (input: ExecuteBacklinkCampaignPreviewRunInput) => {
      // Lazy require with typed module to avoid circular import and implicit any.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("./backlink-campaign-run-executor") as typeof import("./backlink-campaign-run-executor");
      const deps: ExecuteBacklinkCampaignPreviewRunDependencies = {
        startRun: (i) => startRunService({ startRun: (t) => startAutomationRun(client, t), completeRun: (t) => completeAutomationRun(client, t), failRun: (t) => failAutomationRun(client, t), cancelRun: (t) => cancelAutomationRun(client, t) }, i),
        executeWorkerOnce,
        completeRun: (i) => completeRunService({ startRun: (t) => startAutomationRun(client, t), completeRun: (t) => completeAutomationRun(client, t), failRun: (t) => failAutomationRun(client, t), cancelRun: (t) => cancelAutomationRun(client, t) }, i),
        failRun: (i) => failRunService({ startRun: (t) => startAutomationRun(client, t), completeRun: (t) => completeAutomationRun(client, t), failRun: (t) => failAutomationRun(client, t), cancelRun: (t) => cancelAutomationRun(client, t) }, i),
      };
      return mod.executeBacklinkCampaignPreviewRun(deps, input);
    },
    runBacklinksSchedulerTick: (input) =>
      runBacklinksAutomationSchedulerTick(
        { prepareBacklinksDryRun, executeBacklinksDryRun },
        input,
      ),
  };
}
