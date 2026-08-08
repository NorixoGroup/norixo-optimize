import type {
  BacklinkCampaignEngineOpportunityInputV1,
  BacklinkCampaignEnginePreviewInputV1,
  BacklinkCampaignEngineReason,
  BacklinkCampaignOpportunityPriority,
} from "./backlink-campaign-engine-types";
import type { BacklinkCampaignEnginePolicyV1 } from "./backlink-campaign-engine-policy-types";

export type EvaluateBacklinkCampaignOpportunityInput = {
  campaign: BacklinkCampaignEnginePreviewInputV1["campaign"];
  opportunity: BacklinkCampaignEngineOpportunityInputV1;
  policy: BacklinkCampaignEnginePolicyV1;
  context: {
    selectedCount: number;
    selectedForDomainCount: number;
    duplicateOpportunity: boolean;
    duplicateTarget: boolean;
  };
};

export type BacklinkCampaignOpportunityEligibilityResult =
  | {
      decision: "selected";
      reasons: ["ELIGIBLE"];
      proposedMembershipStatus: "planned";
      proposedPriority: BacklinkCampaignOpportunityPriority;
    }
  | {
      decision: "review";
      reasons: [BacklinkCampaignEngineReason];
      proposedMembershipStatus: null;
      proposedPriority: null;
    }
  | {
      decision: "skipped";
      reasons: [BacklinkCampaignEngineReason];
      proposedMembershipStatus: null;
      proposedPriority: null;
    };

export type BacklinkCampaignEngineEligibilityErrorCode =
  | "INVALID_CAMPAIGN_ELIGIBILITY_INPUT"
  | "CAMPAIGN_ELIGIBILITY_INVARIANT_FAILED";

export class BacklinkCampaignEngineEligibilityError extends Error {
  readonly code: BacklinkCampaignEngineEligibilityErrorCode;

  constructor(code: BacklinkCampaignEngineEligibilityErrorCode) {
    super(
      code === "CAMPAIGN_ELIGIBILITY_INVARIANT_FAILED"
        ? "Backlink campaign eligibility invariant failed"
        : "Backlink campaign eligibility input is invalid",
    );
    this.name = "BacklinkCampaignEngineEligibilityError";
    this.code = code;
  }
}
