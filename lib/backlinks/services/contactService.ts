import {
  createBacklinkContact,
  getBacklinkContactById,
  listBacklinkContacts,
  updateBacklinkContact,
  type BacklinkContactRow,
} from "../repositories/contactsRepository";
import type { RepositoryPage } from "../repositories/pagination";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import type { WorkspaceId } from "../repositories/types";

export type ContactInput = {
  domain_id: string;
  contact_key: string;
  full_name?: string | null;
  role_title?: string | null;
  email_normalized?: string | null;
  linkedin_url?: string | null;
  contact_form_url?: string | null;
  contact_status?: string;
  source_type?: string | null;
  source_reference?: string | null;
  consent_or_basis_note?: string | null;
};

export type ContactUpdateInput = Omit<Partial<ContactInput>, "domain_id" | "contact_key">;

export async function listContacts(client: BacklinkRepositoryClient, workspaceId: WorkspaceId): Promise<RepositoryPage<BacklinkContactRow>> {
  return listBacklinkContacts(client, { workspaceId });
}

export async function getContact(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, contactId: string): Promise<BacklinkContactRow> {
  return getBacklinkContactById(client, workspaceId, contactId);
}

export async function createContact(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, actorUserId: string, input: ContactInput): Promise<BacklinkContactRow> {
  return createBacklinkContact(client, workspaceId, { ...input, createdBy: actorUserId });
}

export async function updateContact(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, contactId: string, input: ContactUpdateInput): Promise<BacklinkContactRow> {
  return updateBacklinkContact(client, workspaceId, contactId, input);
}
