import type { MediaAsset } from "./mediaAsset";
import type { MediaAssetRequest } from "./mediaAssetRequest";
import type { MediaGenerationJob } from "./mediaGenerationJob";
import { applyMediaGenerationJobsToAssets } from "./mediaAssetUpdatePipeline";
import { buildMediaGenerationJobs } from "./mediaGenerationJobBuilder";
import { executeMediaGenerationJobs } from "./mediaGenerationJobExecutor";

export type MediaGenerationPipelineResult = {
  jobs: MediaGenerationJob[];
  executedJobs: MediaGenerationJob[];
  assets: MediaAsset[];
};

export async function runMediaGenerationPipeline(
  requests: MediaAssetRequest[],
  assets: MediaAsset[],
): Promise<MediaGenerationPipelineResult> {
  const jobs = buildMediaGenerationJobs(requests);
  const executedJobs = await executeMediaGenerationJobs(jobs);
  const updatedAssets = applyMediaGenerationJobsToAssets(executedJobs, assets);

  return {
    jobs,
    executedJobs,
    assets: updatedAssets,
  };
}
