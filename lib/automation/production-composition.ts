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
import { getBacklinkAssetById } from "@/lib/backlinks/repositories/assetsRepository";
import { getBacklinkContactById } from "@/lib/backlinks/repositories/contactsRepository";
import { getBacklinkDomainById } from "@/lib/backlinks/repositories/domainsRepository";
import { getBacklinkOpportunityById } from "@/lib/backlinks/repositories/opportunitiesRepository";
import { getBacklinkOutreachById, reconcileBacklinkOutreachFollowUpSchedule as reconcileBacklinkOutreachFollowUpScheduleRepository } from "@/lib/backlinks/repositories/outreachRepository";
import { applyBacklinkOutreachFollowUpAccepted, cancelBacklinkOutreachPreparedFollowUpAttempt, getBacklinkOutreachAttemptById, getLatestBacklinkOutreachAttemptForOutreach, getOpenBacklinkOutreachAttemptForOutreach, listBacklinkOutreachAttemptsForOutreach, markBacklinkOutreachFollowUpAttemptRequested, reserveBacklinkOutreachFollowUpAttempt, updateBacklinkOutreachAttemptState } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { hasBacklinkOutreachInboundReplyStopEffect } from "@/lib/backlinks/repositories/outreachInboundEffectsRepository";
import { getBacklinkOutreachFollowUpDraftByAttemptId, prepareBacklinkOutreachFollowUpDraft as prepareBacklinkOutreachFollowUpDraftRpc } from "@/lib/backlinks/repositories/outreachFollowUpDraftsRepository";
import { createEnvironmentOutreachEmailProvider } from "@/lib/backlinks/providers/outreachEmailProvider";
import { markBacklinkOutreachAttemptFailed, markBacklinkOutreachAttemptUnknown } from "@/lib/backlinks/services/outreachAttemptService";
import { sendBacklinkOutreachFollowUpEmail } from "@/lib/backlinks/services/outreachFollowUpEmailSendService";
import { evaluateBacklinkOutreachFollowUpEligibility } from "@/lib/backlinks/services/outreachFollowUpEligibilityService";
import { prepareBacklinkOutreachFollowUp } from "@/lib/backlinks/services/outreachFollowUpPreparationService";
import { prepareBacklinkOutreachFollowUpDraft } from "@/lib/backlinks/services/outreachFollowUpDraftService";
import { getBacklinkOutreachReplyTokenKeyring } from "@/lib/backlinks/services/outreachReplyCorrelationIdentity";
import { reconcileBacklinkOutreachFollowUpSchedule as createBacklinkOutreachFollowUpScheduler } from "@/lib/backlinks/services/outreachFollowUpSchedulingService";
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
import { BacklinkOutreachLiveFollowUpError, runBacklinkOutreachLiveFollowUp, type BacklinkOutreachLiveFollowUpInput, type BacklinkOutreachLiveFollowUpResult } from "./backlink-outreach-live-follow-up-service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LiveFollowUpControl = {
  backlinksEnabled: boolean;
  backlinkOutreachScheduleApplyEnabled: boolean;
  dryRunOnly: boolean;
  disabledReason: string | null;
};

type LiveFollowUpTaskHandlerDependencies = {
  getWorkspaceControl: (workspaceId: string) => Promise<LiveFollowUpControl | null>;
  getLatestAttempt: (workspaceId: string, outreachId: string) => Promise<{ actor_user_id: string | null } | null>;
  runLiveFollowUp: (input: BacklinkOutreachLiveFollowUpInput) => Promise<BacklinkOutreachLiveFollowUpResult>;
};

function liveFollowUpOutput(
  outreachId: string | null,
  disposition: string,
  attemptId: string | null = null,
  eligibilityReason: string | null = null,
): ExecuteAutomationTaskHandlerResult {
  return {
    output: {
      kind: "backlinks.outreach.follow_up_due",
      dryRun: false,
      outreachId,
      disposition,
      attemptId,
      eligibilityReason,
    },
  };
}

/**
 * Automatic follow-ups may only inherit actor provenance from the latest
 * persisted attempt for the same workspace and outreach.
 */
export function createBacklinkOutreachLiveFollowUpTaskHandler(
  dependencies: LiveFollowUpTaskHandlerDependencies,
) {
  return async (
    input: ExecuteAutomationTaskHandlerInput,
  ): Promise<ExecuteAutomationTaskHandlerResult> => {
    const rawOutreachId = input.input.outreachId;
    if (
      input.taskKind !== "backlinks.outreach.follow_up_due" ||
      typeof rawOutreachId !== "string" ||
      !UUID_PATTERN.test(rawOutreachId.trim())
    ) {
      return liveFollowUpOutput(null, "invalid_task_input");
    }

    const outreachId = rawOutreachId.trim();
    const latestAttempt = await dependencies.getLatestAttempt(
      input.workspaceId,
      outreachId,
    );
    const actorUserId = latestAttempt?.actor_user_id?.trim() || null;
    if (actorUserId == null) {
      return liveFollowUpOutput(outreachId, "actor_missing");
    }

    const workspaceControl = await dependencies.getWorkspaceControl(
      input.workspaceId,
    );
    try {
      const result = await dependencies.runLiveFollowUp({
        workspaceId: input.workspaceId,
        outreachId,
        workspaceControl,
      });
      return liveFollowUpOutput(
        result.outreachId,
        result.disposition,
        result.attemptId,
        result.eligibilityReason,
      );
    } catch (error) {
      if (
        error instanceof BacklinkOutreachLiveFollowUpError &&
        error.code === "LIVE_FOLLOW_UP_NOT_ENABLED"
      ) {
        return liveFollowUpOutput(outreachId, "not_enabled");
      }
      throw error;
    }
  };
}

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
  const followUpTaskHandler = createBacklinkOutreachLiveFollowUpTaskHandler({
    getWorkspaceControl: async (workspaceId) => {
      const control = await getAutomationWorkspaceControl(client, workspaceId);
      return control == null
        ? null
        : {
            backlinksEnabled: control.backlinksEnabled,
            backlinkOutreachScheduleApplyEnabled:
              control.backlinkOutreachScheduleApplyEnabled,
            dryRunOnly: control.dryRunOnly,
            disabledReason: control.disabledReason,
          };
    },
    getLatestAttempt: (workspaceId, outreachId) =>
      getLatestBacklinkOutreachAttemptForOutreach(
        client,
        workspaceId,
        outreachId,
      ),
    runLiveFollowUp: async (input) => {
      const replyTokenKeyring = getBacklinkOutreachReplyTokenKeyring();
      const getTemplateData = async (
        workspaceId: string,
        outreach: {
          campaign_id: string;
          contact_id: string;
          opportunity_id: string;
          subject: string | null;
          body: string | null;
        },
      ) => {
        const [campaign, contact, opportunity] = await Promise.all([
          getBacklinkCampaignById(client, workspaceId, outreach.campaign_id),
          getBacklinkContactById(client, workspaceId, outreach.contact_id),
          getBacklinkOpportunityById(
            client,
            workspaceId,
            outreach.opportunity_id,
          ),
        ]);
        const [domain, asset] = await Promise.all([
          getBacklinkDomainById(client, workspaceId, contact.domain_id),
          getBacklinkAssetById(client, workspaceId, opportunity.asset_id),
        ]);
        return {
          campaign: { name: campaign.name, objective: campaign.objective },
          contact: { fullName: contact.full_name, roleTitle: contact.role_title },
          domain: { hostname: domain.hostname },
          opportunity: {
            targetPageTitle: opportunity.target_page_title,
            targetPageUrl: opportunity.target_page_url,
            opportunityType: opportunity.opportunity_type,
            pageType: opportunity.page_type,
            evidenceSummary: opportunity.evidence_summary,
          },
          asset: {
            displayName: asset.display_name,
            canonicalUrl: asset.canonical_url,
          },
        };
      };
      const prepareDraft = prepareBacklinkOutreachFollowUpDraft({
        getAttempt: (workspaceId, attemptId) =>
          getBacklinkOutreachAttemptById(client, workspaceId, attemptId),
        getOutreach: (workspaceId, outreachId) =>
          getBacklinkOutreachById(client, workspaceId, outreachId),
        listAttempts: (workspaceId, outreachId) =>
          listBacklinkOutreachAttemptsForOutreach(
            client,
            workspaceId,
            outreachId,
          ),
        getTemplateData,
        getDraft: async (workspaceId, attemptId) => {
          const draft = await getBacklinkOutreachFollowUpDraftByAttemptId(
            client,
            workspaceId,
            attemptId,
          );
          return draft == null
            ? null
            : {
                id: draft.id,
                outreachId: draft.outreach_id,
                attemptId: draft.attempt_id,
                followUpNumber: draft.follow_up_number,
                subject: draft.subject,
                body: draft.body,
                preparedAt: draft.prepared_at,
                updatedAt: draft.updated_at,
                updatedBy: draft.updated_by,
              };
        },
        prepare: (value) => prepareBacklinkOutreachFollowUpDraftRpc(client, value),
      });
      const prepareFollowUp = prepareBacklinkOutreachFollowUp({
        reserveAttempt: (value) =>
          reserveBacklinkOutreachFollowUpAttempt(client, value),
        cancelAttempt: (value) =>
          cancelBacklinkOutreachPreparedFollowUpAttempt(client, value),
        prepareDraft,
        replyTokenKeyring,
      });
      const reconcileSchedule = createBacklinkOutreachFollowUpScheduler({
        getOutreach: (workspaceId, outreachId) =>
          getBacklinkOutreachById(client, workspaceId, outreachId),
        getLatestAttempt: async (workspaceId, outreachId) => {
          const attempt = await getLatestBacklinkOutreachAttemptForOutreach(
            client,
            workspaceId,
            outreachId,
          );
          return attempt == null ? null : { status: attempt.status };
        },
        getOpenAttempt: async (workspaceId, outreachId) => {
          const attempt = await getOpenBacklinkOutreachAttemptForOutreach(
            client,
            workspaceId,
            outreachId,
          );
          return attempt == null ? null : { status: attempt.status };
        },
        getContact: async (workspaceId, contactId) => {
          const contact = await getBacklinkContactById(
            client,
            workspaceId,
            contactId,
          );
          return {
            contact_status: contact.contact_status,
            email_normalized: contact.email_normalized,
          };
        },
        hasInboundReplyStopEffect: (workspaceId, outreachId) =>
          hasBacklinkOutreachInboundReplyStopEffect(
            client,
            workspaceId,
            outreachId,
          ),
        reconcileSchedule: (workspaceId, outreachId, schedule) =>
          reconcileBacklinkOutreachFollowUpScheduleRepository(
            client,
            workspaceId,
            outreachId,
            schedule,
          ),
      });
      const transitions = {
        getAttempt: (workspaceId: string, attemptId: string) =>
          getBacklinkOutreachAttemptById(client, workspaceId, attemptId),
        updateAttempt: (
          workspaceId: string,
          attemptId: string,
          patch: Parameters<typeof updateBacklinkOutreachAttemptState>[3],
        ) =>
          updateBacklinkOutreachAttemptState(
            client,
            workspaceId,
            attemptId,
            patch,
          ),
      };
      const sendFollowUpEmail = sendBacklinkOutreachFollowUpEmail({
        getAttempt: transitions.getAttempt,
        markRequested: (value) =>
          markBacklinkOutreachFollowUpAttemptRequested(client, value),
        markAccepted: (value) =>
          applyBacklinkOutreachFollowUpAccepted(client, value),
        markFailed: markBacklinkOutreachAttemptFailed(transitions),
        markUnknown: markBacklinkOutreachAttemptUnknown(transitions),
        sendEmail: createEnvironmentOutreachEmailProvider(),
        inboundReplyDomain: process.env.OUTREACH_INBOUND_REPLY_DOMAIN,
        reconcileSchedule: ({ workspaceId, outreachId }) =>
          reconcileSchedule({ workspaceId, outreachId }),
        replyTokenKeyring,
      });
      return runBacklinkOutreachLiveFollowUp(
        {
          resolveActorUserId: async ({ workspaceId, outreachId }) => {
            const attempt = await getLatestBacklinkOutreachAttemptForOutreach(
              client,
              workspaceId,
              outreachId,
            );
            return attempt?.actor_user_id?.trim() || null;
          },
          evaluateEligibility: evaluateBacklinkOutreachFollowUpEligibility({
            getOutreach: (workspaceId, outreachId) =>
              getBacklinkOutreachById(client, workspaceId, outreachId),
            getContact: async (workspaceId, contactId) => {
              const contact = await getBacklinkContactById(
                client,
                workspaceId,
                contactId,
              );
              return {
                contact_status: contact.contact_status,
                email_normalized: contact.email_normalized,
              };
            },
            getOpenAttemptForOutreach: async (workspaceId, outreachId) => {
              const attempt = await getOpenBacklinkOutreachAttemptForOutreach(
                client,
                workspaceId,
                outreachId,
              );
              return attempt == null ? null : { status: attempt.status };
            },
            hasInboundReplyStopEffect: (workspaceId, outreachId) =>
              hasBacklinkOutreachInboundReplyStopEffect(
                client,
                workspaceId,
                outreachId,
              ),
          }),
          prepareFollowUp,
          sendFollowUpEmail,
        },
        input,
      );
    },
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
    if (handlerInput.taskKind === "backlinks.outreach.follow_up_due") {
      return followUpTaskHandler(handlerInput);
    }

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
