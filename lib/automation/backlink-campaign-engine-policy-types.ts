import type {
  BacklinkCampaignLifecycleStatus,
  BacklinkCampaignMembershipStatus,
} from "./backlink-campaign-engine-types";
import { BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION } from "./backlink-campaign-engine-types";

export type BacklinkCampaignEngineDuplicateTargetPolicy = "skip";

export type BacklinkCampaignEnginePolicyV1 = {
  version: typeof BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION;
  eligibleCampaignStatuses: readonly BacklinkCampaignLifecycleStatus[];
  eligibleOpportunityLifecycleStatuses: readonly string[];
  eligibleQualificationStatuses: readonly string[];
  eligibleEditorialStatuses: readonly string[];
  maxSelectedOpportunities: number;
  maxPerDomain: number;
  duplicateTargetPolicy: BacklinkCampaignEngineDuplicateTargetPolicy;
  initialMembershipStatus: Extract<BacklinkCampaignMembershipStatus, "planned">;
};
