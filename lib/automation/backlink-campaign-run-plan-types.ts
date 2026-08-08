import type { Json } from "@/types/database.types";
import type { BacklinkCampaignEngineTaskInputV1 } from "./backlink-campaign-engine-task-types";

export const BACKLINK_CAMPAIGN_RUN_KIND = "backlinks.campaign.preview" as const;

export type BacklinkCampaignRunPlannedTaskKind = typeof BACKLINK_CAMPAIGN_RUN_KIND;
export type BacklinkCampaignRunPlannedTaskKey = "campaign-preview";

export type BacklinkCampaignRunPlannedTask = {
  workspaceId: string;
  runId: string;
  system: "backlinks";
  taskKind: BacklinkCampaignRunPlannedTaskKind;
  taskKey: BacklinkCampaignRunPlannedTaskKey;
  priority: 100;
  scheduledAt: string;
  availableAt: string;
  input: BacklinkCampaignEngineTaskInputV1;
  dependsOnTaskKey: null;
};

export type BacklinkCampaignRunPlan = {
  tasks: readonly BacklinkCampaignRunPlannedTask[];
};

export type BuildBacklinkCampaignRunPlanInput = {
  workspaceId: string;
  runId: string;
  scheduledAt: string;
  campaignTaskInput: BacklinkCampaignEngineTaskInputV1;
};
