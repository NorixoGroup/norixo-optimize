import type { MediaAsset } from "./mediaAsset";
import type { MediaAssetRequest } from "./mediaAssetRequest";
import type { MediaGenerationJob } from "./mediaGenerationJob";
import { runMediaGenerationPipeline } from "./mediaGenerationPipeline";

export type MediaEngineResult = {
  assets: MediaAsset[];
  executedJobs: MediaGenerationJob[];
};

export async function runMediaEngine(params: {
  requests: MediaAssetRequest[];
  assets: MediaAsset[];
}): Promise<MediaEngineResult> {
  const pipeline = await runMediaGenerationPipeline(
    params.requests,
    params.assets,
  );

  return {
    assets: pipeline.assets,
    executedJobs: pipeline.executedJobs,
  };
}
