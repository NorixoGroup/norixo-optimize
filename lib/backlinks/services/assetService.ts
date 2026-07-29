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

export type AssetInput = {
  asset_key: string;
  display_name: string;
  asset_type: string;
  description?: string | null;
  canonical_url?: string | null;
  lifecycle_status?: string;
};

export type AssetUpdateInput = Omit<Partial<AssetInput>, "asset_key">;

export async function listAssets(client: BacklinkRepositoryClient, workspaceId: WorkspaceId): Promise<RepositoryPage<BacklinkAssetRow>> {
  return listBacklinkAssets(client, { workspaceId });
}

export async function getAsset(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, assetId: string): Promise<BacklinkAssetRow> {
  return getBacklinkAssetById(client, workspaceId, assetId);
}

export async function createAsset(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, actorUserId: string, input: AssetInput): Promise<BacklinkAssetRow> {
  return createBacklinkAsset(client, workspaceId, { ...input, createdBy: actorUserId });
}

export async function updateAsset(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, assetId: string, input: AssetUpdateInput): Promise<BacklinkAssetRow> {
  return updateBacklinkAsset(client, workspaceId, assetId, input);
}
