import type { MediaAsset } from "./mediaAsset";
import type { MediaAssetRequest } from "./mediaAssetRequest";
import type { MediaBinary } from "./mediaBinary";
import { getMediaConfiguration } from "./mediaConfiguration";
import type { MediaGenerationJob } from "./mediaGenerationJob";
import { runMediaGenerationPipeline } from "./mediaGenerationPipeline";

export type MediaEngineResult = {
  assets: MediaAsset[];
  executedJobs: MediaGenerationJob[];
};

function buildMediaBinaryFromJob(job: MediaGenerationJob): MediaBinary | null {
  const internalBinary = job.result?.internalBinary;

  if (!internalBinary) {
    return null;
  }

  return {
    id: job.request.id,
    kind: job.request.kind as MediaBinary["kind"],
    provider: "openai",
    mimeType: internalBinary.mimeType,
    extension: internalBinary.extension,
    filename: internalBinary.filename,
    encoding: "base64",
    base64: internalBinary.base64,
    buffer: null,
    sourceUrl: null,
    sizeBytes: null,
    createdAt: new Date().toISOString(),
  };
}

export async function runMediaEngine(params: {
  requests: MediaAssetRequest[];
  assets: MediaAsset[];
}): Promise<MediaEngineResult> {
  const pipeline = await runMediaGenerationPipeline(
    params.requests,
    params.assets,
  );
  const mediaConfiguration = getMediaConfiguration();

  if (!mediaConfiguration.uploadEnabled) {
    return {
      assets: pipeline.assets,
      executedJobs: pipeline.executedJobs,
    };
  }

  const binaries = pipeline.executedJobs
    .map((job) => buildMediaBinaryFromJob(job))
    .filter((binary): binary is MediaBinary => binary !== null);

  if (binaries.length === 0) {
    return {
      assets: pipeline.assets,
      executedJobs: pipeline.executedJobs,
    };
  }

  try {
    const [
      { uploadMediaBinariesForAssets },
      { supabaseMediaStorageAdapter },
    ] = await Promise.all([
      import("./mediaBinaryUploadPipeline"),
      import("./providers/supabaseMediaStorageAdapter"),
    ]);

    const uploadResults = await uploadMediaBinariesForAssets({
      binaries,
      assets: pipeline.assets,
      storage: supabaseMediaStorageAdapter,
    });

    if (uploadResults.length === 0) {
      return {
        assets: pipeline.assets,
        executedJobs: pipeline.executedJobs,
      };
    }

    const uploadedAssetsById = new Map(
      uploadResults.map((result) => [result.asset.id, result.asset]),
    );

    return {
      assets: pipeline.assets.map(
        (asset) => uploadedAssetsById.get(asset.id) ?? asset,
      ),
      executedJobs: pipeline.executedJobs,
    };
  } catch {
    return {
      assets: pipeline.assets,
      executedJobs: pipeline.executedJobs,
    };
  }
}
