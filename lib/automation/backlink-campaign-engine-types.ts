export const BACKLINK_CAMPAIGN_ENGINE_INPUT_VERSION = 1;
export const BACKLINK_CAMPAIGN_ENGINE_OUTPUT_VERSION = 1;
export const BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION =
  "backlink-campaign-engine-v1";
export const BACKLINK_CAMPAIGN_ENGINE_MAX_OPPORTUNITIES = 100;
export const BACKLINK_CAMPAIGN_ENGINE_MAX_INPUT_BYTES = 128 * 1024;
export const BACKLINK_CAMPAIGN_ENGINE_MAX_OUTPUT_BYTES = 128 * 1024;

export type BacklinkCampaignLifecycleStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "archived";

export type BacklinkCampaignMembershipStatus =
  | "planned"
  | "active"
  | "paused"
  | "completed"
  | "removed";

export type BacklinkCampaignOpportunityPriority = "Tier A" | "Tier B" | "Tier C";

export type BacklinkCampaignEngineMode = "preview";

export type BacklinkCampaignEngineSource =
  | "manual_dashboard"
  | "automation_campaign";

export type BacklinkCampaignAutomationTaskKind = "backlinks.campaign.preview";

export type BacklinkCampaignEngineDecision = "selected" | "review" | "skipped";

export type BacklinkCampaignEngineReason =
  | "CAMPAIGN_NOT_DRAFT"
  | "OPPORTUNITY_NOT_ACTIVE"
  | "OPPORTUNITY_NOT_QUALIFIED"
  | "OPPORTUNITY_EDITORIAL_NOT_READY"
  | "DOMAIN_LIMIT_REACHED"
  | "CAMPAIGN_LIMIT_REACHED"
  | "DUPLICATE_OPPORTUNITY"
  | "DUPLICATE_TARGET"
  | "ELIGIBLE";

export type BacklinkCampaignEngineCampaignInputV1 = {
  campaignId: string;
  campaignKey: string;
  name: string;
  objective: string | null;
  status: BacklinkCampaignLifecycleStatus;
};

export type BacklinkCampaignEngineOpportunityInputV1 = {
  opportunityId: string;
  opportunityKey: string;
  domainId: string;
  domain: string;
  targetPageUrl: string;
  title: string | null;
  priority: BacklinkCampaignOpportunityPriority;
  qualificationStatus: string;
  editorialStatus: string;
  lifecycleStatus: string;
};

export type BacklinkCampaignEnginePreviewInputV1 = {
  version: typeof BACKLINK_CAMPAIGN_ENGINE_INPUT_VERSION;
  workspaceId: string;
  runId: string;
  mode: BacklinkCampaignEngineMode;
  source: BacklinkCampaignEngineSource;
  campaign: BacklinkCampaignEngineCampaignInputV1;
  opportunities: BacklinkCampaignEngineOpportunityInputV1[];
  requestedLimits: {
    maxSelectedOpportunities: number;
    maxPerDomain: number;
  };
};

export type BacklinkCampaignEngineResultV1 = {
  opportunityId: string;
  opportunityKey: string;
  decision: BacklinkCampaignEngineDecision;
  reasons: BacklinkCampaignEngineReason[];
  proposedMembershipStatus: BacklinkCampaignMembershipStatus | null;
  proposedPriority: BacklinkCampaignOpportunityPriority | null;
};

export type BacklinkCampaignEnginePreviewOutputV1 = {
  version: typeof BACKLINK_CAMPAIGN_ENGINE_OUTPUT_VERSION;
  policyVersion: typeof BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION;
  workspaceId: string;
  runId: string;
  campaignId: string;
  mode: BacklinkCampaignEngineMode;
  source: BacklinkCampaignEngineSource;
  summary: {
    inputOpportunities: number;
    selected: number;
    review: number;
    skipped: number;
    eligible: number;
    duplicateOpportunities: number;
    duplicateTargets: number;
    domainLimited: number;
    campaignLimited: number;
  };
  results: BacklinkCampaignEngineResultV1[];
};
