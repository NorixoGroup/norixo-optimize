import {
  applyBacklinkCampaignPreviewMemberships,
} from "../lib/automation/backlink-campaign-membership-apply-service";
import {
  BacklinkCampaignMembershipApplyServiceError,
  type ApplyBacklinkCampaignPreviewMembershipsDependencies,
} from "../lib/automation/backlink-campaign-membership-apply-service-types";
import type {
  BacklinkCampaignOpportunityRow,
} from "../lib/backlinks/repositories/campaignOpportunitiesRepository";
import type {
  BacklinkCampaignEnginePreviewOutputV1,
} from "../lib/automation/backlink-campaign-engine-types";
import type {
  AutomationTask,
} from "../lib/automation/types";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const workspaceId = "00000000-0000-4000-8000-000000000001";
const actorUserId = "00000000-0000-4000-8000-000000000002";
const runId = "00000000-0000-4000-8000-000000000003";
const taskId = "00000000-0000-4000-8000-000000000004";
const campaignId = "00000000-0000-4000-8000-000000000005";
const opportunityOne = "00000000-0000-4000-8000-000000000011";
const opportunityTwo = "00000000-0000-4000-8000-000000000012";
const opportunityThree = "00000000-0000-4000-8000-000000000013";

function preview(): BacklinkCampaignEnginePreviewOutputV1 {
  return {
    version: 1,
    policyVersion: "backlink-campaign-engine-v1",
    workspaceId,
    runId,
    campaignId,
    mode: "preview",
    source: "manual_dashboard",
    summary: {
      inputOpportunities: 3,
      selected: 2,
      review: 1,
      skipped: 0,
      eligible: 2,
      duplicateOpportunities: 0,
      duplicateTargets: 0,
      domainLimited: 0,
      campaignLimited: 0,
    },
    results: [
      {
        opportunityId: opportunityOne,
        opportunityKey: "opportunity-one",
        decision: "selected",
        reasons: ["ELIGIBLE"],
        proposedMembershipStatus: "planned",
        proposedPriority: "Tier A",
      },
      {
        opportunityId: opportunityTwo,
        opportunityKey: "opportunity-two",
        decision: "review",
        reasons: ["OPPORTUNITY_NOT_QUALIFIED"],
        proposedMembershipStatus: null,
        proposedPriority: null,
      },
      {
        opportunityId: opportunityThree,
        opportunityKey: "opportunity-three",
        decision: "selected",
        reasons: ["ELIGIBLE"],
        proposedMembershipStatus: "planned",
        proposedPriority: "Tier C",
      },
    ],
  };
}

function task(
  overrides: Partial<AutomationTask> = {},
): AutomationTask {
  return {
    id: taskId,
    workspaceId,
    runId,
    dependsOnTaskId: null,
    system: "backlinks",
    taskKind: "backlinks.campaign.preview",
    taskKey: "campaign-preview",
    status: "completed",
    priority: 100,
    scheduledAt: "2026-08-06T12:00:00.000Z",
    availableAt: "2026-08-06T12:00:00.000Z",
    claimedAt: "2026-08-06T12:00:00.000Z",
    startedAt: "2026-08-06T12:00:00.000Z",
    heartbeatAt: null,
    leaseExpiresAt: null,
    completedAt: "2026-08-06T12:00:01.000Z",
    failedAt: null,
    cancelledAt: null,
    workerId: "worker",
    attemptCount: 1,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: {},
    output: preview(),
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-06T12:00:00.000Z",
    updatedAt: "2026-08-06T12:00:01.000Z",
    ...overrides,
  };
}

function membership(
  opportunityId: string,
  priority: number,
): BacklinkCampaignOpportunityRow {
  return {
    workspace_id: workspaceId,
    campaign_id: campaignId,
    opportunity_id: opportunityId,
    campaign_priority: priority,
    membership_status: "planned",
    added_by: actorUserId,
    added_at: "2026-08-06T12:00:00.000Z",
    removed_at: null,
    removal_reason: null,
  };
}

async function main(): Promise<void> {
  const appliedOpportunityIds: string[] = [];
  const dependencies: ApplyBacklinkCampaignPreviewMembershipsDependencies = {
    async getTaskByIdInRun() {
      return task();
    },
    async applyMembership(input) {
      appliedOpportunityIds.push(input.opportunityId);

      if (input.opportunityId === opportunityOne) {
        return {
          disposition: "created",
          membership: membership(opportunityOne, 1),
        };
      }

      return {
        disposition: "reactivated",
        membership: membership(opportunityThree, 3),
      };
    },
  };

  const result = await applyBacklinkCampaignPreviewMemberships(
    dependencies,
    {
      workspaceId,
      actorUserId,
      runId,
      taskId,
      campaignId,
    },
  );

  assert(result.summary.selected === 2, "Two selected results expected");
  assert(result.summary.created === 1, "One created expected");
  assert(result.summary.existing === 0, "No existing expected");
  assert(result.summary.reactivated === 1, "One reactivated expected");
  assert(result.memberships.length === 2, "Two memberships expected");
  assert(
    appliedOpportunityIds.join(",") ===
      [opportunityOne, opportunityThree].join(","),
    "Only selected results must be applied in preview order",
  );

  let missingTaskRejected = false;

  try {
    await applyBacklinkCampaignPreviewMemberships(
      {
        ...dependencies,
        async getTaskByIdInRun() {
          return null;
        },
      },
      {
        workspaceId,
        actorUserId,
        runId,
        taskId,
        campaignId,
      },
    );
  } catch (error) {
    missingTaskRejected =
      error instanceof BacklinkCampaignMembershipApplyServiceError &&
      error.code === "CAMPAIGN_PREVIEW_TASK_NOT_FOUND";
  }

  assert(missingTaskRejected, "Missing task must be rejected");

  let incompleteTaskRejected = false;

  try {
    await applyBacklinkCampaignPreviewMemberships(
      {
        ...dependencies,
        async getTaskByIdInRun() {
          return task({
            status: "running",
            output: null,
          });
        },
      },
      {
        workspaceId,
        actorUserId,
        runId,
        taskId,
        campaignId,
      },
    );
  } catch (error) {
    incompleteTaskRejected =
      error instanceof BacklinkCampaignMembershipApplyServiceError &&
      error.code === "CAMPAIGN_PREVIEW_TASK_NOT_COMPLETED";
  }

  assert(incompleteTaskRejected, "Incomplete task must be rejected");

  let campaignMismatchRejected = false;

  try {
    await applyBacklinkCampaignPreviewMemberships(
      {
        ...dependencies,
        async getTaskByIdInRun() {
          return task({
            output: {
              ...preview(),
              campaignId: "00000000-0000-4000-8000-000000000099",
            },
          });
        },
      },
      {
        workspaceId,
        actorUserId,
        runId,
        taskId,
        campaignId,
      },
    );
  } catch (error) {
    campaignMismatchRejected =
      error instanceof BacklinkCampaignMembershipApplyServiceError &&
      error.code === "CAMPAIGN_PREVIEW_CAMPAIGN_MISMATCH";
  }

  assert(campaignMismatchRejected, "Campaign mismatch must be rejected");

  let invalidSelectedRejected = false;

  try {
    await applyBacklinkCampaignPreviewMemberships(
      {
        ...dependencies,
        async getTaskByIdInRun() {
          const invalidPreview = preview();
          invalidPreview.results[0] = {
            ...invalidPreview.results[0],
            proposedMembershipStatus: null,
            proposedPriority: null,
          };
          return task({ output: invalidPreview });
        },
      },
      {
        workspaceId,
        actorUserId,
        runId,
        taskId,
        campaignId,
      },
    );
  } catch (error) {
    invalidSelectedRejected =
      error instanceof BacklinkCampaignMembershipApplyServiceError;
  }

  assert(
    invalidSelectedRejected,
    "Selected result without proposals must be rejected",
  );

  console.log("PASS — Campaign membership apply service smoke");
}

void main();
