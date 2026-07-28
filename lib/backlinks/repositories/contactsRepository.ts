import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, BacklinkUpdate, WorkspaceId } from "./types";

export type BacklinkContactRow = BacklinkRow<"backlink_contacts">;
type BacklinkContactInsert = BacklinkInsert<"backlink_contacts">;
type BacklinkContactUpdate = BacklinkUpdate<"backlink_contacts">;

type BacklinkContactSystemColumns =
  | "id"
  | "workspace_id"
  | "created_by"
  | "created_at"
  | "updated_at";

export type CreateBacklinkContactInput = Omit<
  BacklinkContactInsert,
  BacklinkContactSystemColumns
> & {
  createdBy: string;
};

export type UpdateBacklinkContactInput = Omit<
  BacklinkContactUpdate,
  BacklinkContactSystemColumns
>;

export interface ListBacklinkContactsInput {
  workspaceId: WorkspaceId;
  pagination?: RepositoryPageRequest;
}

function assertNonEmptyUpdate(
  operation: string,
  input: UpdateBacklinkContactInput,
): void {
  if (Object.keys(input).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one field must be provided for update.",
    });
  }
}

function throwNotFound(operation: string, contactId: string): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: { entity: "backlink_contact", resourceId: contactId },
  });
}

export async function getBacklinkContactById(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  contactId: string,
): Promise<BacklinkContactRow> {
  const operation = "getBacklinkContactById";
  const { data, error } = await client
    .from("backlink_contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, contactId);
  }

  return data;
}

export async function listBacklinkContacts(
  client: BacklinkRepositoryClient,
  input: ListBacklinkContactsInput,
): Promise<RepositoryPage<BacklinkContactRow>> {
  const operation = "listBacklinkContacts";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_contacts")
    .select("*", { count: "exact" })
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page.from, page.to);

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  const total = count ?? 0;
  return {
    items: data ?? [],
    page: page.page,
    pageSize: page.pageSize,
    total,
    hasNextPage: page.to + 1 < total,
  };
}

export async function createBacklinkContact(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkContactInput,
): Promise<BacklinkContactRow> {
  const operation = "createBacklinkContact";
  const { createdBy, ...contact } = input;
  const payload: BacklinkContactInsert = {
    ...contact,
    workspace_id: workspaceId,
    created_by: createdBy,
  };
  const { data, error } = await client
    .from("backlink_contacts")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function updateBacklinkContact(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  contactId: string,
  input: UpdateBacklinkContactInput,
): Promise<BacklinkContactRow> {
  const operation = "updateBacklinkContact";
  assertNonEmptyUpdate(operation, input);

  const { data, error } = await client
    .from("backlink_contacts")
    .update(input)
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, contactId);
  }

  return data;
}
