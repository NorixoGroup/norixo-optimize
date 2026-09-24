import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getBacklinkDomainById } from "@/lib/backlinks/repositories/domainsRepository";
import { getBacklinkOpportunityById } from "@/lib/backlinks/repositories/opportunitiesRepository";
import { getBacklinkContactById, listBacklinkContactsByDomain } from "@/lib/backlinks/repositories/contactsRepository";
import { getBacklinkCampaignById } from "@/lib/backlinks/repositories/campaignsRepository";
import { listBacklinkCampaigns } from "@/lib/backlinks/repositories/campaignsRepository";
import { listCampaignOpportunities } from "@/lib/backlinks/repositories/campaignOpportunitiesRepository";
import { createBacklinkOutreachDraftRouteServices } from "@/lib/backlinks/services/outreachDraftRouteService";
import { getActiveBacklinkOutreachByIdentity } from "@/lib/backlinks/repositories/outreachRepository";
import { createContact } from "@/lib/backlinks/services/contactService";
import { resolveBacklinkContacts } from "@/lib/backlinks/services/contactResolutionService";
import { getConfiguredMailboxVerificationProvider } from "@/lib/backlinks/providers/zeroBounceMailboxVerificationProvider";
import { recordMailboxVerificationAndMaybePromote } from "@/lib/backlinks/repositories/mailboxVerificationsRepository";
import { getLatestContactFormApprovalCandidate, listCurrentVerifiedContactFormEvidenceContactIds, queueContactFormRun } from "@/lib/backlinks/repositories/contactFormAutomationRepository";
import { getBacklinkOutreachById } from "@/lib/backlinks/repositories/outreachRepository";
import { getOpenBacklinkOutreachAttemptForOutreach, listBacklinkOutreachAttemptSendWindowRows } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { hasBacklinkOutreachInboundReplyStopEffect } from "@/lib/backlinks/repositories/outreachInboundEffectsRepository";
import { listBacklinkOutreachDeliveryEventsForOutreach } from "@/lib/backlinks/repositories/outreachDeliveryEventsRepository";
import { getBacklinkOutreachDeliveryEffectByDeliveryEventId } from "@/lib/backlinks/repositories/outreachDeliveryEffectsRepository";
import { assembleBacklinkAutonomyDecisionFacts } from "./backlink-autonomy-decision-facts";
import { createOrGetAutomationRun, getAutomationWorkspaceControl } from "./repositories/automationRunsRepository";
import { claimNextBacklinkAutonomyTask, completeAutomationTask, createOrGetAutomationTask, failAutomationTask, getAutomationTaskByIdInRun, heartbeatAutomationTask, reclaimExpiredBacklinkAutonomyTasks } from "./repositories/automationTasksRepository";
import { listAutomationWorkspaceControlsForBacklinkAutonomy } from "./repositories/automationWorkspaceControlsRepository";
import { listCanonicalAppliedPromotions } from "./backlink-autonomy-production-preview";
import { readBacklinkAutonomyRuntimeConfig, type BacklinkAutonomyRuntimeConfig } from "./backlink-autonomy-runtime-config";
import { runBacklinkAutonomyScheduler } from "./backlink-autonomy-scheduler";
import { runOneBacklinkAutonomyWorkerTask } from "./backlink-autonomy-worker";
import type { BacklinkAutonomyDispatcherDependencies } from "./backlink-autonomy-dispatcher";

export const BACKLINK_AUTONOMY_CRON_WORKSPACE_LIMIT = 5;
export const BACKLINK_AUTONOMY_CRON_PROMOTION_LIMIT = 10;
export const BACKLINK_AUTONOMY_CRON_WORKER_STEPS_PER_RUN = 3;
export const BACKLINK_AUTONOMY_CRON_RECLAIM_LIMIT = 3;

export type BacklinkAutonomyProductionTickResult = {
  disposition: "disabled" | "completed";
  seededRuns: number;
  tasksCreated: number;
  tasksExisting: number;
  reclaimedTasks: number;
  workerSteps: number;
  workerTerminal: number;
};

export type BacklinkAutonomyProductionDependencies = {
  runtimeConfig: () => BacklinkAutonomyRuntimeConfig;
  scheduler: typeof runBacklinkAutonomyScheduler;
  runWorker: typeof runOneBacklinkAutonomyWorkerTask;
  schedulerDependencies: Parameters<typeof runBacklinkAutonomyScheduler>[0];
  workerDependencies: Parameters<typeof runOneBacklinkAutonomyWorkerTask>[0];
  reclaimAutonomyTasks: (input: { workspaceId: string; runId: string; reclaimedAt: string; limit: number }) => Promise<readonly import("./types").AutomationTask[]>;
};

/** A bounded, closed tick. It owns no outbound executor and never scans outreach rows. */
export async function runBacklinkAutonomyProductionTick(
  deps: BacklinkAutonomyProductionDependencies,
  input: { at: string; workerId: string },
): Promise<BacklinkAutonomyProductionTickResult> {
  if (deps.runtimeConfig().autonomyEnabled !== true) {
    return { disposition: "disabled", seededRuns: 0, tasksCreated: 0, tasksExisting: 0, reclaimedTasks: 0, workerSteps: 0, workerTerminal: 0 };
  }
  const seeded = await deps.scheduler(deps.schedulerDependencies, {
    mode: "apply",
    scheduledAt: input.at,
    workspaceLimit: BACKLINK_AUTONOMY_CRON_WORKSPACE_LIMIT,
    promotionLimitPerWorkspace: BACKLINK_AUTONOMY_CRON_PROMOTION_LIMIT,
  });
  let reclaimedTasks = 0;
  let workerSteps = 0;
  let workerTerminal = 0;
  for (const run of seeded.autonomyRuns) {
    reclaimedTasks += (await deps.reclaimAutonomyTasks({ workspaceId: run.workspaceId, runId: run.runId, reclaimedAt: input.at, limit: BACKLINK_AUTONOMY_CRON_RECLAIM_LIMIT })).length;
    for (let step = 0; step < BACKLINK_AUTONOMY_CRON_WORKER_STEPS_PER_RUN; step += 1) {
      const result = await deps.runWorker(deps.workerDependencies, {
        workspaceId: run.workspaceId, runId: run.runId, workerId: input.workerId, at: input.at,
      });
      workerSteps += 1;
      if (result.kind === "empty" || result.kind === "disabled") break;
      if (result.kind === "terminal" || result.kind === "dead_letter") workerTerminal += 1;
    }
  }
  return { disposition: "completed", seededRuns: seeded.autonomyRunIds.length, tasksCreated: seeded.created, tasksExisting: seeded.existing, reclaimedTasks, workerSteps, workerTerminal };
}

function blockedHandlers(client: ReturnType<typeof createSupabaseAdminClient>): BacklinkAutonomyDispatcherDependencies {
  const unavailable = async () => { throw new Error("BACKLINK_AUTONOMY_DOWNSTREAM_NOT_CONFIGURED"); };
  return {
    resolution: {
      getDomain: async (workspaceId, domainId) => getBacklinkDomainById(client, workspaceId, domainId),
      getOpportunity: async (workspaceId, opportunityId) => getBacklinkOpportunityById(client, workspaceId, opportunityId),
      listContactsByDomain: async (workspaceId, domainId) => listBacklinkContactsByDomain(client, workspaceId, domainId),
      createContact: (workspaceId, actorUserId, input) => createContact(client, workspaceId, actorUserId, input),
      resolve: resolveBacklinkContacts,
    },
    validation: {
      getDomain: async (workspaceId, domainId) => getBacklinkDomainById(client, workspaceId, domainId),
      getOpportunity: async (workspaceId, opportunityId) => getBacklinkOpportunityById(client, workspaceId, opportunityId),
      getContact: async (workspaceId, contactId) => getBacklinkContactById(client, workspaceId, contactId),
      hasMxRecords: async () => null,
    },
    mailbox: {
      getContact: async (workspaceId, contactId) => getBacklinkContactById(client, workspaceId, contactId),
      getProvider: () => getConfiguredMailboxVerificationProvider(),
      record: (input) => recordMailboxVerificationAndMaybePromote(client, input),
    },
    campaign: {
      getDomain: async (workspaceId, domainId) =>
        getBacklinkDomainById(client, workspaceId, domainId),

      getOpportunity: async (workspaceId, opportunityId) =>
        getBacklinkOpportunityById(client, workspaceId, opportunityId),

      getContact: async (workspaceId, contactId) =>
        getBacklinkContactById(client, workspaceId, contactId),

      findCampaignMembership: async ({ workspaceId, opportunityId }) => {
        const campaigns = await listBacklinkCampaigns(client, {
          workspaceId,
          pagination: { page: 1, pageSize: 100 },
        });

        for (const campaign of campaigns.items) {
          const memberships = await listCampaignOpportunities(client, {
            workspaceId,
            campaignId: campaign.id,
            pagination: { page: 1, pageSize: 100 },
          });

          const membership = memberships.items.find(
            (item) =>
              item.opportunity_id === opportunityId &&
              item.membership_status !== "removed",
          );

          if (membership != null) {
            return {
              campaignId: membership.campaign_id,
              membershipStatus: membership.membership_status,
            };
          }
        }

        return null;
      },

      /*
       * Campaign creation/membership preparation intentionally remains
       * fail-closed here. Existing campaign memberships can proceed
       * idempotently; autonomous creation is not introduced by this patch.
       */
      prepareCampaign: unavailable,
    },

    draft: {
      getDomain: async (workspaceId, domainId) =>
        getBacklinkDomainById(client, workspaceId, domainId),

      getOpportunity: async (workspaceId, opportunityId) =>
        getBacklinkOpportunityById(client, workspaceId, opportunityId),

      getContact: async (workspaceId, contactId) =>
        getBacklinkContactById(client, workspaceId, contactId),

      getCampaign: async (workspaceId, campaignId) =>
        getBacklinkCampaignById(client, workspaceId, campaignId),

      getActiveOutreach: ({ workspaceId, opportunityId, contactId, channel }) =>
        getActiveBacklinkOutreachByIdentity(client, {
          workspaceId,
          opportunityId,
          contactId,
          channel,
        }),

      createDraft: async (input) => {
        const result =
          await createBacklinkOutreachDraftRouteServices(client, client).create(
            input,
          );

        return {
          outreachId: result.outreachId,
          disposition: result.disposition,
          status: result.status,
        };
      },
    },

    decision: { getFacts: assembleBacklinkAutonomyDecisionFacts({
      getOutreach: (workspaceId, outreachId) => getBacklinkOutreachById(client, workspaceId, outreachId),
      getDomain: (workspaceId, domainId) => getBacklinkDomainById(client, workspaceId, domainId),
      getOpportunity: (workspaceId, opportunityId) => getBacklinkOpportunityById(client, workspaceId, opportunityId),
      getContact: (workspaceId, contactId) => getBacklinkContactById(client, workspaceId, contactId),
      getCampaign: (workspaceId, campaignId) => getBacklinkCampaignById(client, workspaceId, campaignId),
      getMembership: async (workspaceId, campaignId, opportunityId) => {
        const page = await listCampaignOpportunities(client, { workspaceId, campaignId, pagination: { page: 1, pageSize: 100 } });
        return page.items.find((item) => item.opportunity_id === opportunityId) ?? null;
      },
      hasCurrentContactFormEvidence: async (workspaceId, contact) => (await listCurrentVerifiedContactFormEvidenceContactIds(client, workspaceId, [contact])).has(contact.id),
      hasInboundReplyStop: (workspaceId, outreachId) => hasBacklinkOutreachInboundReplyStopEffect(client, workspaceId, outreachId),
      hasComplaintOrBounceStop: async (workspaceId, outreachId) => {
        const events = await listBacklinkOutreachDeliveryEventsForOutreach(client, workspaceId, outreachId);
        for (const event of events) {
          if (event.event_type !== "email.complained" && !(event.event_type === "email.bounced" && event.bounce_type === "permanent")) continue;
          const effect = await getBacklinkOutreachDeliveryEffectByDeliveryEventId(client as never, event.id);
          if (effect?.status === "applied" && effect.workspace_id === workspaceId && effect.outreach_id === outreachId) return true;
        }
        return false;
      },
      getOpenAttempt: (workspaceId, outreachId) => getOpenBacklinkOutreachAttemptForOutreach(client, workspaceId, outreachId),
      getWorkspaceControl: (workspaceId) => getAutomationWorkspaceControl(client, workspaceId),
      rateEligibility: {
        listAttemptSummariesSince: (workspaceId, since) => listBacklinkOutreachAttemptSendWindowRows(client, workspaceId, since),
        getOutreach: (workspaceId, outreachId) => getBacklinkOutreachById(client, workspaceId, outreachId),
        getOpportunity: (workspaceId, opportunityId) => getBacklinkOpportunityById(client, workspaceId, opportunityId),
      },
    }) },
    contactForm: {
      getLatestApprovalCandidate: (input) =>
        getLatestContactFormApprovalCandidate(client, input),
      queueExistingApproval: (input) =>
        queueContactFormRun(client, input),
    },
  } as BacklinkAutonomyDispatcherDependencies;
}

/** Production adapters resolve, validate, and verify mailboxes; no outbound executor is wired here. */
export function createBacklinkAutonomyProductionDependencies(): BacklinkAutonomyProductionDependencies {
  const client = createSupabaseAdminClient();
  const handlers = blockedHandlers(client);
  const schedulerDependencies = {
    runtimeConfig: readBacklinkAutonomyRuntimeConfig,
    listWorkspaceControls: (limit: number) => listAutomationWorkspaceControlsForBacklinkAutonomy(client, limit),
    listAppliedPromotions: (workspaceId: string, limit: number) => listCanonicalAppliedPromotions(client, workspaceId, limit),
    getDomain: async (workspaceId: string, domainId: string) => { const row = await getBacklinkDomainById(client, workspaceId, domainId); return { id: row.id, workspaceId: row.workspace_id, archivedAt: row.archived_at }; },
    getOpportunity: async (workspaceId: string, opportunityId: string) => { const row = await getBacklinkOpportunityById(client, workspaceId, opportunityId); return { id: row.id, workspaceId: row.workspace_id, domainId: row.domain_id, archivedAt: row.archived_at }; },
    createOrGetRun: (input: any) => createOrGetAutomationRun(client, input),
    createOrGetTask: (input: any) => createOrGetAutomationTask(client, input),
  };
  const workerDependencies = {
    ...handlers,
    runtimeConfig: readBacklinkAutonomyRuntimeConfig,
    getWorkspaceControl: (workspaceId: string) => getAutomationWorkspaceControl(client, workspaceId),
    // The worker calls claimNextAllowedTask exclusively. This required base adapter is fail-closed.
    claimNextTask: async () => { throw new Error("BACKLINK_AUTONOMY_GENERIC_CLAIM_FORBIDDEN"); },
    claimNextAllowedTask: (input: any) => claimNextBacklinkAutonomyTask(client, input),
    getDependencyOutput: async (task: { workspaceId: string; runId: string; dependsOnTaskId: string | null }) => {
      if (task.dependsOnTaskId == null) return null;
      const dependency = await getAutomationTaskByIdInRun(client, { workspaceId: task.workspaceId, runId: task.runId, taskId: task.dependsOnTaskId });
      return dependency?.output != null && typeof dependency.output === "object" && !Array.isArray(dependency.output) ? dependency.output as Record<string, unknown> : null;
    },
    getActorUserId: async () => null,
    createOrGetTask: (input: any) => createOrGetAutomationTask(client, input),
    completeTask: (input: any) => completeAutomationTask(client, input),
    failTask: (input: any) => failAutomationTask(client, input),
    heartbeatTask: (input: any) => heartbeatAutomationTask(client, input),
    reclaimExpiredTasks: async () => { throw new Error("BACKLINK_AUTONOMY_GENERIC_RECLAIM_FORBIDDEN"); },
    cancelTask: async () => null,
  };
  return { runtimeConfig: readBacklinkAutonomyRuntimeConfig, scheduler: runBacklinkAutonomyScheduler, runWorker: runOneBacklinkAutonomyWorkerTask, schedulerDependencies, workerDependencies, reclaimAutonomyTasks: (input) => reclaimExpiredBacklinkAutonomyTasks(client, input) } as BacklinkAutonomyProductionDependencies;
}
