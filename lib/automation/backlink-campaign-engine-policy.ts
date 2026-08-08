import { BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION } from "./backlink-campaign-engine-types";
import type { BacklinkCampaignEnginePolicyV1 } from "./backlink-campaign-engine-policy-types";

const eligibleCampaignStatuses: ["draft"] = ["draft"];
const eligibleOpportunityLifecycleStatuses: ["active"] = ["active"];
const eligibleQualificationStatuses: ["Qualified"] = ["Qualified"];
const eligibleEditorialStatuses: ["Not Started", "Ready for Contact"] = [
  "Not Started",
  "Ready for Contact",
];

export const DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1: BacklinkCampaignEnginePolicyV1 =
  Object.freeze({
    version: BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION,
    eligibleCampaignStatuses: Object.freeze(eligibleCampaignStatuses),
    eligibleOpportunityLifecycleStatuses: Object.freeze(
      eligibleOpportunityLifecycleStatuses,
    ),
    eligibleQualificationStatuses: Object.freeze(eligibleQualificationStatuses),
    eligibleEditorialStatuses: Object.freeze(eligibleEditorialStatuses),
    maxSelectedOpportunities: 50,
    maxPerDomain: 3,
    duplicateTargetPolicy: "skip",
    initialMembershipStatus: "planned",
  });
