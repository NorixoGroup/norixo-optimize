import type { MediaAsset } from "./mediaAsset";
import type { MediaGenerationJob } from "./mediaGenerationJob";

export function applyMediaGenerationJobToAsset(
  job: MediaGenerationJob,
  asset: MediaAsset,
): MediaAsset {
  const now = new Date().toISOString();

  if (job.status !== "completed" || !job.result?.asset) {
    return {
      ...asset,
      status: job.status === "failed" ? "failed" : asset.status,
      warnings:
        job.status === "failed"
          ? [job.error ?? "Media generation failed."]
          : asset.warnings,
      updatedAt: now,
    };
  }

  const generatedAsset = job.result.asset;

  return {
    ...asset,
    ...generatedAsset,
    id: asset.id,
    status: "generated",
    generationProvider:
      generatedAsset.generationProvider ?? job.providerId ?? asset.generationProvider ?? null,
    providerJobId:
      generatedAsset.providerJobId ?? job.externalJobId ?? asset.providerJobId ?? null,
    warnings: generatedAsset.warnings ?? [],
    createdAt: asset.createdAt,
    updatedAt: now,
  };
}

export function applyMediaGenerationJobsToAssets(
  jobs: MediaGenerationJob[],
  assets: MediaAsset[],
): MediaAsset[] {
  return assets.map((asset) => {
    const matchingJob = jobs.find((job) => job.request.id === asset.id);

    return matchingJob
      ? applyMediaGenerationJobToAsset(matchingJob, asset)
      : asset;
  });
}
