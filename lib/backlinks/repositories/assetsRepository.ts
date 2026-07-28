import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, BacklinkUpdate, WorkspaceId } from "./types";

export type BacklinkAssetRow = BacklinkRow<"backlink_assets">;
type BacklinkAssetInsert = BacklinkInsert<"backlink_assets">;
type BacklinkAssetUpdate = BacklinkUpdate<"backlink_assets">;

type BacklinkAssetSystemColumns =
  | "id"
  | "workspace_id"
  | "created_by"
  | "created_at"
  | "updated_at";

export type CreateBacklinkAssetInput = Omit<BacklinkAssetInsert, BacklinkAssetSystemColumns> & {
  createdBy: string;
};

export type UpdateBacklinkAssetInput = Omit<BacklinkAssetUpdate, BacklinkAssetSystemColumns>;

export interface ListBacklinkAssetsInput {
  workspaceId: WorkspaceId;
  pagination?: RepositoryPageRequest;
}

function assertNonEmptyUpdate(
  operation: string,
  input: UpdateBacklinkAssetInput,
): void {
  if (Object.keys(input).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one field must be provided for update.",
    });
  }
}

function throwNotFound(operation: string, assetId: string): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: { entity: "backlink_asset", resourceId: assetId },
  });
}

export async function getBacklinkAssetById(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  assetId: string,
): Promise<BacklinkAssetRow> {
  const operation = "getBacklinkAssetById";
  const { data, error } = await client
    .from("backlink_assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", assetId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, assetId);
  }

  return data;
}

export async function listBacklinkAssets(
  client: BacklinkRepositoryClient,
  input: ListBacklinkAssetsInput,
): Promise<RepositoryPage<BacklinkAssetRow>> {
  const operation = "listBacklinkAssets";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_assets")
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

export async function createBacklinkAsset(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkAssetInput,
): Promise<BacklinkAssetRow> {
  const operation = "createBacklinkAsset";
  const { createdBy, ...asset } = input;
  const payload: BacklinkAssetInsert = {
    ...asset,
    workspace_id: workspaceId,
    created_by: createdBy,
  };
  const { data, error } = await client
    .from("backlink_assets")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function updateBacklinkAsset(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  assetId: string,
  input: UpdateBacklinkAssetInput,
): Promise<BacklinkAssetRow> {
  const operation = "updateBacklinkAsset";
  assertNonEmptyUpdate(operation, input);

  const { data, error } = await client
    .from("backlink_assets")
    .update(input)
    .eq("workspace_id", workspaceId)
    .eq("id", assetId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, assetId);
  }

  return data;
}
