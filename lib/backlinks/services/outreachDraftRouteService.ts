import { getBacklinkAssetById } from "../repositories/assetsRepository";
import { getBacklinkCampaignById } from "../repositories/campaignsRepository";
import { getCampaignOpportunity } from "../repositories/campaignOpportunitiesRepository";
import { getBacklinkContactById, listBacklinkContactsByDomain } from "../repositories/contactsRepository";
import { getBacklinkDomainById } from "../repositories/domainsRepository";
import { getBacklinkOpportunityById } from "../repositories/opportunitiesRepository";
import { createBacklinkOutreach, getActiveBacklinkOutreachByIdentity, listBacklinkOutreachByOpportunity } from "../repositories/outreachRepository";
import { reserveBacklinkOutreachKey } from "../repositories/outreachKeyRepository";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import { createBacklinkOutreachDraftPreviewService, createBacklinkOutreachDraftService } from "./outreachDraftService";

export function createBacklinkOutreachDraftRouteServices(client: BacklinkRepositoryClient) {
  const dependencies = {
    eligibility: {
      getMembership: (input: { workspaceId: string; campaignId: string; opportunityId: string }) => getCampaignOpportunity(client, input.workspaceId, input.campaignId, input.opportunityId),
      getOpportunity: (workspaceId: string, opportunityId: string) => getBacklinkOpportunityById(client, workspaceId, opportunityId),
      listContactsByDomain: (workspaceId: string, domainId: string) => listBacklinkContactsByDomain(client, workspaceId, domainId),
      listOutreachByOpportunity: (workspaceId: string, opportunityId: string) => listBacklinkOutreachByOpportunity(client, workspaceId, opportunityId),
    },
    getCampaign: (workspaceId: string, campaignId: string) => getBacklinkCampaignById(client, workspaceId, campaignId),
    getContact: (workspaceId: string, contactId: string) => getBacklinkContactById(client, workspaceId, contactId),
    getDomain: (workspaceId: string, domainId: string) => getBacklinkDomainById(client, workspaceId, domainId),
    getOpportunity: (workspaceId: string, opportunityId: string) => getBacklinkOpportunityById(client, workspaceId, opportunityId),
    getAsset: (workspaceId: string, assetId: string) => getBacklinkAssetById(client, workspaceId, assetId),
    getActiveOutreach: (input: { workspaceId: string; opportunityId: string; contactId: string; channel: "email" | "linkedin" | "contact_form" }) => getActiveBacklinkOutreachByIdentity(client, input),
    reserveOutreachKey: (workspaceId: string) => reserveBacklinkOutreachKey(client, workspaceId),
    createOutreach: (input: { workspaceId: string; actorUserId: string; campaignId: string; opportunityId: string; contactId: string; outreachKey: string; channel: "email" | "linkedin" | "contact_form"; status: "draft"; subject: string | null; body: string }) => createBacklinkOutreach(client, input.workspaceId, { campaign_id: input.campaignId, opportunity_id: input.opportunityId, contact_id: input.contactId, outreach_key: input.outreachKey, channel: input.channel, status: input.status, subject: input.subject, body: input.body, createdBy: input.actorUserId }),
  };
  return { create: createBacklinkOutreachDraftService(dependencies), preview: createBacklinkOutreachDraftPreviewService(dependencies), eligibility: dependencies.eligibility };
}
