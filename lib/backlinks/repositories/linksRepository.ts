import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, BacklinkUpdate, WorkspaceId } from "./types";

export type BacklinkLinkRow = BacklinkRow<"backlink_links">;
type BacklinkLinkInsert = BacklinkInsert<"backlink_links">;
type BacklinkLinkUpdate = BacklinkUpdate<"backlink_links">;

type BacklinkLinkSystemColumns =
  | "id"
  | "workspace_id"
  | "created_by"
  | "created_at"
  | "updated_at";

export type CreateBacklinkLinkInput = Omit<BacklinkLinkInsert, BacklinkLinkSystemColumns> & {
  createdBy: string;
};

export type UpdateBacklinkLinkInput = Omit<BacklinkLinkUpdate, BacklinkLinkSystemColumns>;

export interface ListBacklinkLinksInput {
  workspaceId: WorkspaceId;
  pagination?: RepositoryPageRequest;
}

function assertNonEmptyUpdate(operation: string, input: UpdateBacklinkLinkInput): void {
  if (Object.keys(input).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one field must be provided for update.",
    });
  }
}

function throwNotFound(operation: string, linkId: string): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: { entity: "backlink_link", resourceId: linkId },
  });
}

export async function getBacklinkLinkById(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  linkId: string,
): Promise<BacklinkLinkRow> {
  const operation = "getBacklinkLinkById";
  const { data, error } = await client
    .from("backlink_links")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", linkId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, linkId);
  }

  return data;
}

export async function listBacklinkLinks(
  client: BacklinkRepositoryClient,
  input: ListBacklinkLinksInput,
): Promise<RepositoryPage<BacklinkLinkRow>> {
  const operation = "listBacklinkLinks";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_links")
    .select("*", { count: "exact" })
    .eq("workspace_id", input.workspaceId)
    .order("acquired_at", { ascending: false })
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

export async function createBacklinkLink(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkLinkInput,
): Promise<BacklinkLinkRow> {
  const operation = "createBacklinkLink";
  const { createdBy, ...link } = input;
  const payload: BacklinkLinkInsert = {
    ...link,
    workspace_id: workspaceId,
    created_by: createdBy,
  };
  const { data, error } = await client
    .from("backlink_links")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function updateBacklinkLink(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  linkId: string,
  input: UpdateBacklinkLinkInput,
): Promise<BacklinkLinkRow> {
  const operation = "updateBacklinkLink";
  assertNonEmptyUpdate(operation, input);

  const { data, error } = await client
    .from("backlink_links")
    .update(input)
    .eq("workspace_id", workspaceId)
    .eq("id", linkId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, linkId);
  }

  return data;
}
