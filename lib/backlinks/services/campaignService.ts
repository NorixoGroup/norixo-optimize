import {
  createBacklinkCampaign,
  getBacklinkCampaignById,
  listBacklinkCampaigns,
  updateBacklinkCampaign,
  type CreateBacklinkCampaignInput,
  type ListBacklinkCampaignsInput,
  type UpdateBacklinkCampaignInput,
} from "../repositories/campaignsRepository";
import {
  addOpportunityToCampaign as addCampaignOpportunity,
  listCampaignOpportunities as listCampaignOpportunityMemberships,
  removeOpportunityFromCampaign as removeCampaignOpportunity,
  updateCampaignOpportunity as updateCampaignMembership,
  type AddOpportunityToCampaignInput,
  type ListCampaignOpportunitiesInput,
  type RemoveOpportunityFromCampaignInput,
  type UpdateCampaignOpportunityInput,
} from "../repositories/campaignOpportunitiesRepository";
import type { RepositoryPage } from "../repositories/pagination";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import type { BacklinkCampaignRow } from "../repositories/campaignsRepository";
import type { BacklinkCampaignOpportunityRow } from "../repositories/campaignOpportunitiesRepository";
import type { WorkspaceId } from "../repositories/types";

export type ListCampaignsInput = Omit<ListBacklinkCampaignsInput, "workspaceId">;
export type CreateCampaignInput = Omit<CreateBacklinkCampaignInput, "createdBy" | "owner_id">;
export type UpdateCampaignInput = UpdateBacklinkCampaignInput;
export type AddOpportunityToCampaignServiceInput = Omit<
  AddOpportunityToCampaignInput,
  "addedBy"
>;
export type UpdateCampaignOpportunityServiceInput = UpdateCampaignOpportunityInput;
export type RemoveOpportunityFromCampaignServiceInput = RemoveOpportunityFromCampaignInput;
export type ListCampaignOpportunitiesServiceInput = Omit<
  ListCampaignOpportunitiesInput,
  "workspaceId"
>;

export async function listCampaigns(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: ListCampaignsInput = {},
): Promise<RepositoryPage<BacklinkCampaignRow>> {
  return listBacklinkCampaigns(client, { ...input, workspaceId });
}

export async function getCampaign(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  campaignId: string,
): Promise<BacklinkCampaignRow> {
  return getBacklinkCampaignById(client, workspaceId, campaignId);
}

export async function listCampaignOpportunities(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  campaignId: string,
  input: Omit<ListCampaignOpportunitiesServiceInput, "campaignId"> = {},
): Promise<RepositoryPage<BacklinkCampaignOpportunityRow>> {
  return listCampaignOpportunityMemberships(client, { ...input, workspaceId, campaignId });
}

export async function createCampaign(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  actorUserId: string,
  input: CreateCampaignInput,
): Promise<BacklinkCampaignRow> {
  return createBacklinkCampaign(client, workspaceId, {
    ...input,
    owner_id: actorUserId,
    createdBy: actorUserId,
  });
}

export async function updateCampaign(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  campaignId: string,
  input: UpdateCampaignInput,
): Promise<BacklinkCampaignRow> {
  return updateBacklinkCampaign(client, workspaceId, campaignId, input);
}

export async function addOpportunityToCampaign(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  actorUserId: string,
  campaignId: string,
  opportunityId: string,
  input: AddOpportunityToCampaignServiceInput,
): Promise<BacklinkCampaignOpportunityRow> {
  return addCampaignOpportunity(client, workspaceId, campaignId, opportunityId, {
    ...input,
    addedBy: actorUserId,
  });
}

export async function updateCampaignOpportunity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  campaignId: string,
  opportunityId: string,
  input: UpdateCampaignOpportunityServiceInput,
): Promise<BacklinkCampaignOpportunityRow> {
  return updateCampaignMembership(client, workspaceId, campaignId, opportunityId, input);
}

export async function removeOpportunityFromCampaign(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  campaignId: string,
  opportunityId: string,
  input: RemoveOpportunityFromCampaignServiceInput,
): Promise<BacklinkCampaignOpportunityRow> {
  return removeCampaignOpportunity(client, workspaceId, campaignId, opportunityId, input);
}
