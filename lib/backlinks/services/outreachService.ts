import {
  createBacklinkContact,
  type CreateBacklinkContactInput,
} from "../repositories/contactsRepository";
import {
  createBacklinkOutreach,
  getBacklinkOutreachById,
  listBacklinkOutreach,
  updateBacklinkOutreach,
  type CreateBacklinkOutreachInput,
  type ListBacklinkOutreachInput,
  type UpdateBacklinkOutreachInput,
} from "../repositories/outreachRepository";
import type { RepositoryPage } from "../repositories/pagination";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import type { BacklinkContactRow } from "../repositories/contactsRepository";
import type { BacklinkOutreachRow } from "../repositories/outreachRepository";
import type { WorkspaceId } from "../repositories/types";
import { listBacklinkOutreachAttemptSummariesForOutreachIds, type BacklinkOutreachAttemptSummary } from "../repositories/outreachAttemptsRepository";

export type ListOutreachInput = Omit<ListBacklinkOutreachInput, "workspaceId">;
export type CreateOutreachInput = Omit<CreateBacklinkOutreachInput, "createdBy">;
export type UpdateOutreachInput = UpdateBacklinkOutreachInput;
export type CreateContactInput = Omit<CreateBacklinkContactInput, "createdBy">;
export type RecordOutreachResponseInput = Pick<
  UpdateBacklinkOutreachInput,
  "status" | "last_response_type" | "closed_at" | "stop_reason"
>;
export type BacklinkOutreachWithAttemptSummary = BacklinkOutreachRow & { attemptSummary: BacklinkOutreachAttemptSummary };

export async function listOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: ListOutreachInput = {},
): Promise<RepositoryPage<BacklinkOutreachWithAttemptSummary>> {
  const page = await listBacklinkOutreach(client, { ...input, workspaceId });
  const summaries = await listBacklinkOutreachAttemptSummariesForOutreachIds(client, workspaceId, page.items.map((outreach) => outreach.id));
  return { ...page, items: page.items.map((outreach) => ({ ...outreach, attemptSummary: summaries.get(outreach.id) ?? { latestStatus: null, hasOpenAttempt: false } })) };
}

export async function getOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
): Promise<BacklinkOutreachRow> {
  return getBacklinkOutreachById(client, workspaceId, outreachId);
}

export async function createOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  actorUserId: string,
  input: CreateOutreachInput,
): Promise<BacklinkOutreachRow> {
  return createBacklinkOutreach(client, workspaceId, {
    ...input,
    createdBy: actorUserId,
  });
}

export async function updateOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
  input: UpdateOutreachInput,
): Promise<BacklinkOutreachRow> {
  return updateBacklinkOutreach(client, workspaceId, outreachId, input);
}

export async function recordOutreachResponse(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
  input: RecordOutreachResponseInput,
): Promise<BacklinkOutreachRow> {
  return updateBacklinkOutreach(client, workspaceId, outreachId, input);
}

export async function createContact(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  actorUserId: string,
  input: CreateContactInput,
): Promise<BacklinkContactRow> {
  return createBacklinkContact(client, workspaceId, {
    ...input,
    createdBy: actorUserId,
  });
}
