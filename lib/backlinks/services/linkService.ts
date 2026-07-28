import {
  createBacklinkLink,
  getBacklinkLinkById,
  listBacklinkLinks,
  updateBacklinkLink,
  type CreateBacklinkLinkInput,
  type ListBacklinkLinksInput,
  type UpdateBacklinkLinkInput,
} from "../repositories/linksRepository";
import type { RepositoryPage } from "../repositories/pagination";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import type { BacklinkLinkRow } from "../repositories/linksRepository";
import type { WorkspaceId } from "../repositories/types";

export type ListLinksInput = Omit<ListBacklinkLinksInput, "workspaceId">;
export type CreateLinkInput = Omit<CreateBacklinkLinkInput, "createdBy">;
export type UpdateLinkInput = UpdateBacklinkLinkInput;
export type UpdateLinkVerificationInput = Pick<
  UpdateBacklinkLinkInput,
  | "status"
  | "first_verified_at"
  | "last_verified_at"
  | "last_seen_at"
  | "verification_source"
  | "verification_evidence"
>;

export async function listLinks(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: ListLinksInput = {},
): Promise<RepositoryPage<BacklinkLinkRow>> {
  return listBacklinkLinks(client, { ...input, workspaceId });
}

export async function getLink(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  linkId: string,
): Promise<BacklinkLinkRow> {
  return getBacklinkLinkById(client, workspaceId, linkId);
}

export async function createLink(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  actorUserId: string,
  input: CreateLinkInput,
): Promise<BacklinkLinkRow> {
  return createBacklinkLink(client, workspaceId, {
    ...input,
    createdBy: actorUserId,
  });
}

export async function updateLink(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  linkId: string,
  input: UpdateLinkInput,
): Promise<BacklinkLinkRow> {
  return updateBacklinkLink(client, workspaceId, linkId, input);
}

export async function updateLinkVerification(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  linkId: string,
  input: UpdateLinkVerificationInput,
): Promise<BacklinkLinkRow> {
  return updateBacklinkLink(client, workspaceId, linkId, input);
}
