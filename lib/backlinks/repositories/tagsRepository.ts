import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, BacklinkUpdate, WorkspaceId } from "./types";

export type BacklinkTagRow = BacklinkRow<"backlink_tags">;
type BacklinkTagInsert = BacklinkInsert<"backlink_tags">;
type BacklinkTagUpdate = BacklinkUpdate<"backlink_tags">;

type BacklinkTagSystemColumns =
  | "id"
  | "workspace_id"
  | "created_by"
  | "created_at"
  | "updated_at";

export type CreateBacklinkTagInput = Omit<BacklinkTagInsert, BacklinkTagSystemColumns> & {
  createdBy: string;
};

export type UpdateBacklinkTagInput = Omit<BacklinkTagUpdate, BacklinkTagSystemColumns>;

export interface ListBacklinkTagsInput {
  workspaceId: WorkspaceId;
  pagination?: RepositoryPageRequest;
}

function assertNonEmptyUpdate(
  operation: string,
  input: UpdateBacklinkTagInput,
): void {
  if (Object.keys(input).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one field must be provided for update.",
    });
  }
}

function throwNotFound(operation: string, tagId: string): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: { entity: "backlink_tag", resourceId: tagId },
  });
}

export async function getBacklinkTagById(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  tagId: string,
): Promise<BacklinkTagRow> {
  const operation = "getBacklinkTagById";
  const { data, error } = await client
    .from("backlink_tags")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", tagId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, tagId);
  }

  return data;
}

export async function listBacklinkTags(
  client: BacklinkRepositoryClient,
  input: ListBacklinkTagsInput,
): Promise<RepositoryPage<BacklinkTagRow>> {
  const operation = "listBacklinkTags";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_tags")
    .select("*", { count: "exact" })
    .eq("workspace_id", input.workspaceId)
    .order("display_name", { ascending: true })
    .order("id", { ascending: true })
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

export async function createBacklinkTag(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkTagInput,
): Promise<BacklinkTagRow> {
  const operation = "createBacklinkTag";
  const { createdBy, ...tag } = input;
  const payload: BacklinkTagInsert = {
    ...tag,
    workspace_id: workspaceId,
    created_by: createdBy,
  };
  const { data, error } = await client
    .from("backlink_tags")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function updateBacklinkTag(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  tagId: string,
  input: UpdateBacklinkTagInput,
): Promise<BacklinkTagRow> {
  const operation = "updateBacklinkTag";
  assertNonEmptyUpdate(operation, input);

  const { data, error } = await client
    .from("backlink_tags")
    .update(input)
    .eq("workspace_id", workspaceId)
    .eq("id", tagId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, tagId);
  }

  return data;
}
