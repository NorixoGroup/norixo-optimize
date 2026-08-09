import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, BacklinkUpdate, WorkspaceId } from "./types";

export type BacklinkOutreachRow = BacklinkRow<"backlink_outreach">;
type BacklinkOutreachInsert = BacklinkInsert<"backlink_outreach">;
type BacklinkOutreachUpdate = BacklinkUpdate<"backlink_outreach">;

type BacklinkOutreachSystemColumns =
  | "id"
  | "workspace_id"
  | "created_by"
  | "created_at"
  | "updated_at";

export type CreateBacklinkOutreachInput = Omit<
  BacklinkOutreachInsert,
  BacklinkOutreachSystemColumns
> & {
  createdBy: string;
};

export type UpdateBacklinkOutreachInput = Omit<
  BacklinkOutreachUpdate,
  BacklinkOutreachSystemColumns
>;

export interface ListBacklinkOutreachInput {
  workspaceId: WorkspaceId;
  pagination?: RepositoryPageRequest;
}

function assertNonEmptyUpdate(operation: string, input: UpdateBacklinkOutreachInput): void {
  if (Object.keys(input).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one field must be provided for update.",
    });
  }
}

function throwNotFound(operation: string, outreachId: string): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: { entity: "backlink_outreach", resourceId: outreachId },
  });
}

export async function getBacklinkOutreachById(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
): Promise<BacklinkOutreachRow> {
  const operation = "getBacklinkOutreachById";
  const { data, error } = await client
    .from("backlink_outreach")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", outreachId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, outreachId);
  }

  return data;
}

export async function listBacklinkOutreach(
  client: BacklinkRepositoryClient,
  input: ListBacklinkOutreachInput,
): Promise<RepositoryPage<BacklinkOutreachRow>> {
  const operation = "listBacklinkOutreach";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_outreach")
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

export async function listBacklinkOutreachByOpportunity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  opportunityId: string,
): Promise<BacklinkOutreachRow[]> {
  const operation = "listBacklinkOutreachByOpportunity";
  const { data, error } = await client.from("backlink_outreach").select("*").eq("workspace_id", workspaceId).eq("opportunity_id", opportunityId);
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return data ?? [];
}

export async function createBacklinkOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkOutreachInput,
): Promise<BacklinkOutreachRow> {
  const operation = "createBacklinkOutreach";
  const { createdBy, ...outreach } = input;
  const payload: BacklinkOutreachInsert = {
    ...outreach,
    workspace_id: workspaceId,
    created_by: createdBy,
  };
  const { data, error } = await client
    .from("backlink_outreach")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function updateBacklinkOutreach(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  outreachId: string,
  input: UpdateBacklinkOutreachInput,
): Promise<BacklinkOutreachRow> {
  const operation = "updateBacklinkOutreach";
  assertNonEmptyUpdate(operation, input);

  const { data, error } = await client
    .from("backlink_outreach")
    .update(input)
    .eq("workspace_id", workspaceId)
    .eq("id", outreachId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, outreachId);
  }

  return data;
}
