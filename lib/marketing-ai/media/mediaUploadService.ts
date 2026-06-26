import type { MediaBinary } from "./mediaBinary";
import type {
  MediaStorageAdapter,
  MediaStorageUploadResult,
} from "./mediaStorageAdapter";

export type MediaUploadResult = {
  binary: MediaBinary;
  upload: MediaStorageUploadResult;
};

export async function uploadMediaBinary(
  binary: MediaBinary,
  storage: MediaStorageAdapter,
): Promise<MediaUploadResult> {
  const upload = await storage.upload(binary);

  return {
    binary,
    upload,
  };
}

export async function uploadMediaBinaries(
  binaries: MediaBinary[],
  storage: MediaStorageAdapter,
): Promise<MediaUploadResult[]> {
  const results: MediaUploadResult[] = [];

  for (const binary of binaries) {
    results.push(await uploadMediaBinary(binary, storage));
  }

  return results;
}
