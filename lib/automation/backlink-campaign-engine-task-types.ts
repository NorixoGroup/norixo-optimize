import type { AutomationTask } from "./types";
import type {
  BacklinkCampaignEnginePreviewOutputV1,
  BacklinkCampaignEngineSource,
} from "./backlink-campaign-engine-types";
import type {
  ExecuteBacklinkCampaignEnginePreviewHandlerDependencies,
} from "./backlink-campaign-engine-handler-types";

export type BacklinkCampaignEngineTaskInputV1 = {
  version: 1;
  campaignId: string;
  source: BacklinkCampaignEngineSource;
  opportunityIds: string[];
  requestedLimits: {
    maxSelectedOpportunities: number;
    maxPerDomain: number;
  };
};

export type BacklinkCampaignEngineTaskInput =
  BacklinkCampaignEngineTaskInputV1;

export type BacklinkCampaignEngineTaskHandlerInput = {
  workspaceId: string;
  runId: string;
  task: AutomationTask;
};

export type BacklinkCampaignEngineTaskHandlerDependencies =
  ExecuteBacklinkCampaignEnginePreviewHandlerDependencies;

export type BacklinkCampaignEngineTaskHandlerResult =
  BacklinkCampaignEnginePreviewOutputV1;

export type BacklinkCampaignEngineTaskValidationErrorCode =
  | "INVALID_CAMPAIGN_ENGINE_TASK_INPUT";

export class BacklinkCampaignEngineTaskValidationError extends Error {
  readonly code: BacklinkCampaignEngineTaskValidationErrorCode;

  constructor(code: BacklinkCampaignEngineTaskValidationErrorCode) {
    super("Backlink campaign engine task input is invalid");
    this.name = "BacklinkCampaignEngineTaskValidationError";
    this.code = code;
  }
}
