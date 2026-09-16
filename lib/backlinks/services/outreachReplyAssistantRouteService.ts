import { getBacklinkAssetById } from "../repositories/assetsRepository";
import { getBacklinkCampaignById } from "../repositories/campaignsRepository";
import { getBacklinkContactById } from "../repositories/contactsRepository";
import { getBacklinkDomainById } from "../repositories/domainsRepository";
import { getBacklinkOpportunityById } from "../repositories/opportunitiesRepository";
import { getBacklinkOutreachById } from "../repositories/outreachRepository";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import {
  generateBacklinkOutreachReplyAssistantProposal,
  type BacklinkOutreachReplyAssistantChannel,
  type BacklinkOutreachReplyAssistantContext,
  type BacklinkOutreachReplyAssistantExecutionResult,
} from "./outreachReplyAssistant";

export type BacklinkOutreachReplyAssistantInbound = {
  sender: string | null;
  subject: string | null;
  textBody: string;
};

export type BacklinkOutreachReplyAssistantRouteInput = {
  workspaceId: string;
  outreachId: string;
  inbound: BacklinkOutreachReplyAssistantInbound;
};

export type BacklinkOutreachReplyAssistantRouteDependencies = {
  getOutreach: typeof getBacklinkOutreachById;
  getCampaign: typeof getBacklinkCampaignById;
  getContact: typeof getBacklinkContactById;
  getDomain: typeof getBacklinkDomainById;
  getOpportunity: typeof getBacklinkOpportunityById;
  getAsset: typeof getBacklinkAssetById;
  generateProposal: (
    input: BacklinkOutreachReplyAssistantContext,
  ) => Promise<BacklinkOutreachReplyAssistantExecutionResult>;
};

export function createBacklinkOutreachReplyAssistantRouteService(
  client: BacklinkRepositoryClient,
  overrides: Partial<BacklinkOutreachReplyAssistantRouteDependencies> = {},
) {
  const dependencies: BacklinkOutreachReplyAssistantRouteDependencies = {
    getOutreach: getBacklinkOutreachById,
    getCampaign: getBacklinkCampaignById,
    getContact: getBacklinkContactById,
    getDomain: getBacklinkDomainById,
    getOpportunity: getBacklinkOpportunityById,
    getAsset: getBacklinkAssetById,
    generateProposal: generateBacklinkOutreachReplyAssistantProposal,
    ...overrides,
  };

  return async function proposeBacklinkOutreachReply(
    input: BacklinkOutreachReplyAssistantRouteInput,
  ): Promise<BacklinkOutreachReplyAssistantExecutionResult> {
    const outreach = await dependencies.getOutreach(
      client,
      input.workspaceId,
      input.outreachId,
    );

    if (outreach.channel !== "email" && outreach.channel !== "linkedin") {
      throw new Error("Backlink outreach reply assistant channel unsupported.");
    }

    const channel: BacklinkOutreachReplyAssistantChannel = outreach.channel;

    const [campaign, contact, opportunity] = await Promise.all([
      dependencies.getCampaign(
        client,
        input.workspaceId,
        outreach.campaign_id,
      ),
      dependencies.getContact(
        client,
        input.workspaceId,
        outreach.contact_id,
      ),
      dependencies.getOpportunity(
        client,
        input.workspaceId,
        outreach.opportunity_id,
      ),
    ]);

    const [domain, asset] = await Promise.all([
      dependencies.getDomain(
        client,
        input.workspaceId,
        opportunity.domain_id,
      ),
      dependencies.getAsset(
        client,
        input.workspaceId,
        opportunity.asset_id,
      ),
    ]);

    const context: BacklinkOutreachReplyAssistantContext = {
      channel,
      campaign: {
        name: campaign.name,
        objective: campaign.objective,
      },
      contact: {
        fullName: contact.full_name,
        roleTitle: contact.role_title,
      },
      domain: {
        hostname: domain.hostname,
      },
      opportunity: {
        targetPageTitle: opportunity.target_page_title,
        targetPageUrl: opportunity.target_page_url,
        opportunityType: opportunity.opportunity_type,
        pageType: opportunity.page_type,
        evidenceSummary: opportunity.evidence_summary,
      },
      asset: {
        displayName: asset.display_name,
        canonicalUrl: asset.canonical_url,
      },
      inbound: input.inbound,
    };

    return dependencies.generateProposal(context);
  };
}
