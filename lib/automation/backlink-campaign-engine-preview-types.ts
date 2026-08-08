import type { BacklinkCampaignEnginePreviewInputV1 } from "./backlink-campaign-engine-types";
import type { BacklinkCampaignEnginePolicyV1 } from "./backlink-campaign-engine-policy-types";

export type ExecuteBacklinkCampaignEnginePreviewInput = {
  input: BacklinkCampaignEnginePreviewInputV1;
  policy: BacklinkCampaignEnginePolicyV1;
};

export type BacklinkCampaignEnginePreviewErrorCode =
  "CAMPAIGN_ENGINE_INTERNAL_INVARIANT";

export class BacklinkCampaignEnginePreviewError extends Error {
  readonly code: BacklinkCampaignEnginePreviewErrorCode;

  constructor(code: BacklinkCampaignEnginePreviewErrorCode) {
    super("Backlink campaign preview invariant failed");
    this.name = "BacklinkCampaignEnginePreviewError";
    this.code = code;
  }
}
