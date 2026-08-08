import type {
  BacklinkCampaignEngineSource,
  BacklinkCampaignEnginePreviewOutputV1,
} from "./backlink-campaign-engine-types";
import type { BacklinkCampaignEnginePolicyV1 } from "./backlink-campaign-engine-policy-types";
import type {
  BuildBacklinkCampaignEnginePreviewInput,
  BuildBacklinkCampaignEnginePreviewInputResult,
} from "./backlink-campaign-engine-input-builder-types";

export type ExecuteBacklinkCampaignEnginePreviewHandlerInput = {
  workspaceId: string;
  runId: string;
  campaignId: string;
  source: BacklinkCampaignEngineSource;
  opportunityIds: string[];
  requestedLimits: {
    maxSelectedOpportunities: number;
    maxPerDomain: number;
  };
};

export type ExecuteBacklinkCampaignEnginePreviewHandlerDependencies = {
  buildPreviewInput(
    input: BuildBacklinkCampaignEnginePreviewInput,
  ): Promise<BuildBacklinkCampaignEnginePreviewInputResult>;
  policy: BacklinkCampaignEnginePolicyV1;
};

export type ExecuteBacklinkCampaignEnginePreviewHandlerResult =
  BacklinkCampaignEnginePreviewOutputV1;

export type BacklinkCampaignEngineHandlerErrorCode =
  "CAMPAIGN_ENGINE_HANDLER_NOT_CONFIGURED";

export class BacklinkCampaignEngineHandlerError extends Error {
  readonly code: BacklinkCampaignEngineHandlerErrorCode;

  constructor() {
    super("Backlink campaign engine handler is not configured");
    this.name = "BacklinkCampaignEngineHandlerError";
    this.code = "CAMPAIGN_ENGINE_HANDLER_NOT_CONFIGURED";
  }
}
