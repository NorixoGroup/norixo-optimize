import {
  createBacklinkOpportunity,
  getBacklinkOpportunityById,
  listBacklinkOpportunities,
  updateBacklinkOpportunity,
  type CreateBacklinkOpportunityInput,
  type ListBacklinkOpportunitiesInput,
  type UpdateBacklinkOpportunityInput,
} from "../repositories/opportunitiesRepository";
import type { RepositoryPage } from "../repositories/pagination";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import type { BacklinkOpportunityRow } from "../repositories/opportunitiesRepository";
import type { WorkspaceId } from "../repositories/types";

export type ListOpportunitiesInput = Omit<ListBacklinkOpportunitiesInput, "workspaceId">;
export type CreateOpportunityInput = Omit<CreateBacklinkOpportunityInput, "createdBy">;
export type UpdateOpportunityInput = UpdateBacklinkOpportunityInput;

export async function listOpportunities(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: ListOpportunitiesInput = {},
): Promise<RepositoryPage<BacklinkOpportunityRow>> {
  return listBacklinkOpportunities(client, { ...input, workspaceId });
}

export async function getOpportunity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  opportunityId: string,
): Promise<BacklinkOpportunityRow> {
  return getBacklinkOpportunityById(client, workspaceId, opportunityId);
}

export async function createOpportunity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  actorUserId: string,
  input: CreateOpportunityInput,
): Promise<BacklinkOpportunityRow> {
  return createBacklinkOpportunity(client, workspaceId, {
    ...input,
    createdBy: actorUserId,
  });
}

export async function updateOpportunity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  opportunityId: string,
  input: UpdateOpportunityInput,
): Promise<BacklinkOpportunityRow> {
  return updateBacklinkOpportunity(client, workspaceId, opportunityId, input);
}

export async function qualifyOpportunity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  opportunityId: string,
): Promise<BacklinkOpportunityRow> {
  return updateBacklinkOpportunity(client, workspaceId, opportunityId, {
    qualification_status: "Qualified",
  });
}
