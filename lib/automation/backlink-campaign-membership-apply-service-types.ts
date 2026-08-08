import type { AutomationTask } from "./types";
import type {
  ApplyBacklinkCampaignMembershipResult,
} from "./backlink-campaign-membership-application-types";
import type {
  BacklinkCampaignEnginePreviewOutputV1,
} from "./backlink-campaign-engine-types";

export type ApplyBacklinkCampaignPreviewMembershipsInput = {
  workspaceId: string;
  actorUserId: string;
  runId: string;
  taskId: string;
  campaignId: string;
};

export type AppliedBacklinkCampaignMembershipResult = {
  opportunityId: string;
  disposition: ApplyBacklinkCampaignMembershipResult["disposition"];
  membership: ApplyBacklinkCampaignMembershipResult["membership"];
};

export type ApplyBacklinkCampaignPreviewMembershipsResult = {
  campaignId: string;
  runId: string;
  taskId: string;
  preview: BacklinkCampaignEnginePreviewOutputV1;
  summary: {
    selected: number;
    created: number;
    existing: number;
    reactivated: number;
  };
  memberships: AppliedBacklinkCampaignMembershipResult[];
};

export type ApplyBacklinkCampaignPreviewMembershipsDependencies = {
  getTaskByIdInRun(input: {
    workspaceId: string;
    runId: string;
    taskId: string;
  }): Promise<AutomationTask | null>;

  applyMembership(input: {
    workspaceId: string;
    actorUserId: string;
    campaignId: string;
    opportunityId: string;
    proposedMembershipStatus: "planned";
    proposedPriority: "Tier A" | "Tier B" | "Tier C";
  }): Promise<ApplyBacklinkCampaignMembershipResult>;
};

export type BacklinkCampaignMembershipApplyServiceErrorCode =
  | "INVALID_CAMPAIGN_MEMBERSHIP_APPLY_INPUT"
  | "CAMPAIGN_PREVIEW_TASK_NOT_FOUND"
  | "CAMPAIGN_PREVIEW_TASK_SCOPE_MISMATCH"
  | "CAMPAIGN_PREVIEW_TASK_NOT_COMPLETED"
  | "CAMPAIGN_PREVIEW_OUTPUT_MISSING"
  | "CAMPAIGN_PREVIEW_OUTPUT_INVALID"
  | "CAMPAIGN_PREVIEW_CAMPAIGN_MISMATCH"
  | "CAMPAIGN_PREVIEW_SELECTED_RESULT_INVALID";

export class BacklinkCampaignMembershipApplyServiceError extends Error {
  readonly code: BacklinkCampaignMembershipApplyServiceErrorCode;

  constructor(code: BacklinkCampaignMembershipApplyServiceErrorCode) {
    super("Backlink campaign membership apply service failed");
    this.name = "BacklinkCampaignMembershipApplyServiceError";
    this.code = code;
  }
}
