import type { MediaAsset } from "./mediaAsset";
import type { MediaBinary } from "./mediaBinary";
import type { MediaStorageAdapter } from "./mediaStorageAdapter";
import type { MediaUploadResult } from "./mediaUploadService";
import { uploadMediaBinary } from "./mediaUploadService";

export type MediaBinaryAssetUploadResult = {
  binary: MediaBinary;
  asset: MediaAsset;
  upload: MediaUploadResult["upload"];
};

export async function uploadMediaBinaryForAsset(params: {
  binary: MediaBinary;
  asset: MediaAsset;
  storage: MediaStorageAdapter;
}): Promise<MediaBinaryAssetUploadResult> {
  const uploadResult = await uploadMediaBinary(params.binary, params.storage);

  return {
    binary: params.binary,
    upload: uploadResult.upload,
    asset: {
      ...params.asset,
      previewUrl: uploadResult.upload.previewUrl,
      downloadUrl: uploadResult.upload.downloadUrl,
      metadata: {
        ...(params.asset.metadata ?? {}),
        storageProvider: uploadResult.upload.provider,
        storagePath: uploadResult.upload.path,
        sizeBytes: params.binary.sizeBytes ?? params.asset.metadata?.sizeBytes,
      } as MediaAsset["metadata"],
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function uploadMediaBinariesForAssets(params: {
  binaries: MediaBinary[];
  assets: MediaAsset[];
  storage: MediaStorageAdapter;
}): Promise<MediaBinaryAssetUploadResult[]> {
  const results: MediaBinaryAssetUploadResult[] = [];

  for (const binary of params.binaries) {
    const asset = params.assets.find((candidate) => candidate.id === binary.id);

    if (!asset) {
      continue;
    }

    results.push(
      await uploadMediaBinaryForAsset({
        binary,
        asset,
        storage: params.storage,
      }),
    );
  }

  return results;
}
