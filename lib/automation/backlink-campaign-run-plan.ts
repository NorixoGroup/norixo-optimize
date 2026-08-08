import type { BacklinkCampaignRunPlan, BuildBacklinkCampaignRunPlanInput } from "./backlink-campaign-run-plan-types";

const CAMPAIGN_RUN_PLAN_TASK_KEY = "campaign-preview" as const;
const CAMPAIGN_RUN_PLAN_TASK_KIND = "backlinks.campaign.preview" as const;

export function buildBacklinkCampaignRunPlan(
  input: BuildBacklinkCampaignRunPlanInput,
): BacklinkCampaignRunPlan {
  return {
    tasks: [
      {
        workspaceId: input.workspaceId,
        runId: input.runId,
        system: "backlinks",
        taskKind: CAMPAIGN_RUN_PLAN_TASK_KIND,
        taskKey: CAMPAIGN_RUN_PLAN_TASK_KEY,
        priority: 100,
        scheduledAt: input.scheduledAt,
        availableAt: input.scheduledAt,
        input: input.campaignTaskInput,
        dependsOnTaskKey: null,
      },
    ] as const,
  };
}
