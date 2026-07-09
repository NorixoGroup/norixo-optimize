import type { MediaAsset } from "./mediaAsset";
import type { MediaAssetRequest } from "./mediaAssetRequest";
import type { MediaBinary } from "./mediaBinary";
import {
  getMediaConfiguration,
  type MediaConfiguration,
} from "./mediaConfiguration";
import type { MediaGenerationJob } from "./mediaGenerationJob";
import { runMediaGenerationPipeline } from "./mediaGenerationPipeline";

export type MediaEngineResult = {
  configuration: MediaConfiguration;
  assets: MediaAsset[];
  executedJobs: MediaGenerationJob[];
};

function inferMediaBinaryExtension(job: MediaGenerationJob): string {
  if (job.request.kind === "video" || job.request.kind === "reel") {
    return "mp4";
  }

  return "png";
}

function inferMediaBinaryMimeType(job: MediaGenerationJob): string {
  if (job.request.kind === "video" || job.request.kind === "reel") {
    return "video/mp4";
  }

  return "image/png";
}

function mapProviderToBinarySourceProvider(
  provider: string | undefined,
): MediaBinary["provider"] {
  if (
    provider === "fake" ||
    provider === "openai" ||
    provider === "runway" ||
    provider === "fal" ||
    provider === "replicate"
  ) {
    return provider;
  }

  return "unknown";
}

async function buildMediaBinaryFromJob(
  job: MediaGenerationJob,
): Promise<MediaBinary | null> {
  const internalBinary = job.result?.internalBinary;

  if (internalBinary) {
    return {
      id: job.request.id,
      kind: job.request.kind as MediaBinary["kind"],
      provider: mapProviderToBinarySourceProvider(job.result?.provider),
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

  const sourceUrl =
    typeof job.result?.asset?.downloadUrl === "string" &&
    job.result.asset.downloadUrl.trim().length > 0
      ? job.result.asset.downloadUrl.trim()
      : typeof job.result?.asset?.previewUrl === "string" &&
          job.result.asset.previewUrl.trim().length > 0
        ? job.result.asset.previewUrl.trim()
        : null;

  if (!sourceUrl) {
    return null;
  }

  const response = await fetch(sourceUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Media binary download failed: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType =
    response.headers.get("content-type") || inferMediaBinaryMimeType(job);
  const extension = inferMediaBinaryExtension(job);
  const filename =
    job.result?.asset?.metadata &&
    typeof (job.result.asset.metadata as { binaryFilename?: unknown }).binaryFilename ===
      "string"
      ? ((job.result.asset.metadata as { binaryFilename: string }).binaryFilename)
      : `${job.result?.provider ?? "unknown"}/${job.request.id}.${extension}`;

  return {
    id: job.request.id,
    kind: job.request.kind as MediaBinary["kind"],
    provider: mapProviderToBinarySourceProvider(job.result?.provider),
    mimeType,
    extension,
    filename,
    encoding: "base64",
    base64: buffer.toString("base64"),
    buffer: null,
    sourceUrl,
    sizeBytes: buffer.byteLength,
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
      configuration: mediaConfiguration,
      assets: pipeline.assets,
      executedJobs: pipeline.executedJobs,
    };
  }

  const binaries = (
    await Promise.all(
      pipeline.executedJobs.map((job) => buildMediaBinaryFromJob(job)),
    )
  ).filter((binary): binary is MediaBinary => binary !== null);

  if (binaries.length === 0) {
    return {
      configuration: mediaConfiguration,
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
        configuration: mediaConfiguration,
        assets: pipeline.assets,
        executedJobs: pipeline.executedJobs,
      };
    }

    const uploadedAssetsById = new Map(
      uploadResults.map((result) => [result.asset.id, result.asset]),
    );

    return {
      configuration: mediaConfiguration,
      assets: pipeline.assets.map(
        (asset) => uploadedAssetsById.get(asset.id) ?? asset,
      ),
      executedJobs: pipeline.executedJobs,
    };
  } catch {
    return {
      configuration: mediaConfiguration,
      assets: pipeline.assets,
      executedJobs: pipeline.executedJobs,
    };
  }
}
