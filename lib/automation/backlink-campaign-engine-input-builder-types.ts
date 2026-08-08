import type { BacklinkCampaignRow } from "@/lib/backlinks/repositories/campaignsRepository";
import type { BacklinkDomainRow } from "@/lib/backlinks/repositories/domainsRepository";
import type { BacklinkOpportunityRow } from "@/lib/backlinks/repositories/opportunitiesRepository";
import type {
  BacklinkCampaignEnginePreviewInputV1,
  BacklinkCampaignEngineSource,
} from "./backlink-campaign-engine-types";

type BacklinkCampaign = BacklinkCampaignRow;
type BacklinkOpportunity = BacklinkOpportunityRow;
type BacklinkDomain = BacklinkDomainRow;

export type BuildBacklinkCampaignEnginePreviewInput = {
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

export type BuildBacklinkCampaignEnginePreviewInputDependencies = {
  getCampaignById(input: {
    workspaceId: string;
    campaignId: string;
  }): Promise<BacklinkCampaign | null>;
  getOpportunityById(input: {
    workspaceId: string;
    opportunityId: string;
  }): Promise<BacklinkOpportunity | null>;
  getDomainById(input: {
    workspaceId: string;
    domainId: string;
  }): Promise<BacklinkDomain | null>;
};

export type BuildBacklinkCampaignEnginePreviewInputResult = {
  campaign: BacklinkCampaign;
  opportunities: BacklinkOpportunity[];
  domains: BacklinkDomain[];
  previewInput: BacklinkCampaignEnginePreviewInputV1;
};

export type BacklinkCampaignEngineInputBuilderErrorCode =
  | "INVALID_CAMPAIGN_ENGINE_BUILDER_INPUT"
  | "CAMPAIGN_ENGINE_DUPLICATE_OPPORTUNITY_ID"
  | "CAMPAIGN_ENGINE_TOO_MANY_OPPORTUNITIES"
  | "CAMPAIGN_ENGINE_CAMPAIGN_NOT_FOUND"
  | "CAMPAIGN_ENGINE_CAMPAIGN_SCOPE_MISMATCH"
  | "CAMPAIGN_ENGINE_OPPORTUNITY_NOT_FOUND"
  | "CAMPAIGN_ENGINE_OPPORTUNITY_SCOPE_MISMATCH"
  | "CAMPAIGN_ENGINE_DOMAIN_NOT_FOUND"
  | "CAMPAIGN_ENGINE_DOMAIN_SCOPE_MISMATCH"
  | "CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED";

export class BacklinkCampaignEngineInputBuilderError extends Error {
  readonly code: BacklinkCampaignEngineInputBuilderErrorCode;

  constructor(code: BacklinkCampaignEngineInputBuilderErrorCode) {
    super("Backlink campaign engine input builder failed");
    this.name = "BacklinkCampaignEngineInputBuilderError";
    this.code = code;
  }
}
