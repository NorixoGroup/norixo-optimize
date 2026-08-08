import {
  createBacklinkAsset,
  getBacklinkAssetById,
  listBacklinkAssets,
  updateBacklinkAsset,
  type BacklinkAssetRow,
} from "../repositories/assetsRepository";
import type { RepositoryPage } from "../repositories/pagination";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import type { WorkspaceId } from "../repositories/types";

export const BACKLINK_ASSET_LIFECYCLE_STATUSES = [
  "draft",
  "eligible",
  "active",
  "paused",
  "archived",
] as const;
export type BacklinkAssetLifecycleStatus =
  (typeof BACKLINK_ASSET_LIFECYCLE_STATUSES)[number];

export type AssetInput = {
  asset_key: string;
  display_name: string;
  asset_type: string;
  description?: string | null;
  canonical_url?: string | null;
  lifecycle_status?: BacklinkAssetLifecycleStatus;
};

export type AssetUpdateInput = Omit<Partial<AssetInput>, "asset_key">;

function assertLifecycleStatus(
  lifecycleStatus: unknown,
): asserts lifecycleStatus is BacklinkAssetLifecycleStatus {
  if (
    typeof lifecycleStatus !== "string" ||
    !BACKLINK_ASSET_LIFECYCLE_STATUSES.some(
      (status) => status === lifecycleStatus,
    )
  ) {
    throw new Error("Invalid asset lifecycle status");
  }
}

export async function listAssets(client: BacklinkRepositoryClient, workspaceId: WorkspaceId): Promise<RepositoryPage<BacklinkAssetRow>> {
  return listBacklinkAssets(client, { workspaceId });
}

export async function getAsset(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, assetId: string): Promise<BacklinkAssetRow> {
  return getBacklinkAssetById(client, workspaceId, assetId);
}

export async function createAsset(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, actorUserId: string, input: AssetInput): Promise<BacklinkAssetRow> {
  const lifecycleStatus = input.lifecycle_status ?? "draft";
  assertLifecycleStatus(lifecycleStatus);
  return createBacklinkAsset(client, workspaceId, {
    ...input,
    lifecycle_status: lifecycleStatus,
    archived_at: lifecycleStatus === "archived" ? new Date().toISOString() : null,
    createdBy: actorUserId,
  });
}

export async function updateAsset(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, assetId: string, input: AssetUpdateInput): Promise<BacklinkAssetRow> {
  if (input.lifecycle_status === undefined) {
    return updateBacklinkAsset(client, workspaceId, assetId, input);
  }
  assertLifecycleStatus(input.lifecycle_status);
  return updateBacklinkAsset(client, workspaceId, assetId, {
    ...input,
    archived_at:
      input.lifecycle_status === "archived" ? new Date().toISOString() : null,
  });
}
