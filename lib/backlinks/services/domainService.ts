import {
  createBacklinkDomain,
  getBacklinkDomainById,
  listBacklinkDomains,
  updateBacklinkDomain,
  type BacklinkDomainRow,
} from "../repositories/domainsRepository";
import type { RepositoryPage } from "../repositories/pagination";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import type { WorkspaceId } from "../repositories/types";

export type DomainInput = {
  domain_key: string;
  hostname: string;
  display_name?: string | null;
  country_code?: string | null;
  region?: string | null;
  primary_language?: string | null;
  editorial_category?: string | null;
  editorial_compatibility?: string | null;
  estimated_difficulty?: string | null;
  lifecycle_status?: string;
};

export type DomainUpdateInput = Omit<Partial<DomainInput>, "domain_key">;

export async function listDomains(client: BacklinkRepositoryClient, workspaceId: WorkspaceId): Promise<RepositoryPage<BacklinkDomainRow>> {
  return listBacklinkDomains(client, { workspaceId });
}

export async function getDomain(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, domainId: string): Promise<BacklinkDomainRow> {
  return getBacklinkDomainById(client, workspaceId, domainId);
}

export async function createDomain(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, actorUserId: string, input: DomainInput): Promise<BacklinkDomainRow> {
  return createBacklinkDomain(client, workspaceId, { ...input, createdBy: actorUserId });
}

export async function updateDomain(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, domainId: string, input: DomainUpdateInput): Promise<BacklinkDomainRow> {
  return updateBacklinkDomain(client, workspaceId, domainId, input);
}
