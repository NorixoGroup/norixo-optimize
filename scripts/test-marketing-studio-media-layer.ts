import { buildMediaAssetRequestsFromBundle } from "../lib/marketing-ai/media/mediaAssetRequestBuilder";
import {
  fakeMediaProvider,
  getMediaProviderById,
  listMediaProviders,
  listMediaProvidersByCapability,
  selectMediaProvidersForRequests,
  buildMediaGenerationJobs,
  executeMediaGenerationJobs,
  startMediaGenerationJob,
  completeMediaGenerationJob,
  failMediaGenerationJob,
  cancelMediaGenerationJob,
  pollMediaGenerationJobsStatus,
  applyMediaGenerationJobsToAssets,
  runMediaGenerationPipeline,
} from "../lib/marketing-ai/media";
import {
  runMediaProviderForRequests,
  runMediaProviderSelectionForRequests,
} from "../lib/marketing-ai/media/mediaProviderRunner";
import { runMarketingStudioOrchestratorV2 } from "../lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNonEmptyString(value: string | null | undefined, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is empty.`);
  }
}

async function main() {
  const registeredProviders = listMediaProviders();
  assert(
    registeredProviders.length > 0,
    "Expected at least one registered media provider.",
  );

  const fakeProviderEntry = getMediaProviderById("fake");
  assert(fakeProviderEntry, "Expected fake media provider to be registered.");

  assert(
    listMediaProvidersByCapability("image").some((provider) => provider.id === "fake"),
    "Expected fake media provider to support image capability.",
  );

  assert(
    listMediaProvidersByCapability("video").some((provider) => provider.id === "fake"),
    "Expected fake media provider to support video capability.",
  );

  const result = await runMarketingStudioOrchestratorV2({
    name: "Campagne media layer smoke test",
    objective: "awareness",
    audience: "Hôtes et conciergeries",
    language: "fr",
    channels: ["facebook", "instagram"],
  });

  const bundle = result.bundle;
  const bundleMedia = bundle.media;

  assert(bundleMedia, "bundle.media is missing.");
  assert(Array.isArray(bundleMedia.requests), "bundle.media.requests is invalid.");
  assert(Array.isArray(bundleMedia.assets), "bundle.media.assets is invalid.");
  assert(bundleMedia.requests.length > 0, "bundle.media.requests is empty.");
  assert(bundleMedia.assets.length > 0, "bundle.media.assets is empty.");

  const rebuiltRequests = buildMediaAssetRequestsFromBundle(bundle);

  assert(rebuiltRequests.length > 0, "buildMediaAssetRequestsFromBundle() returned no requests.");

  const mediaRequests = bundleMedia.requests;

  assert(mediaRequests.length > 0, "bundle.media.requests is empty.");

  const jobs = buildMediaGenerationJobs(mediaRequests);

  assert(
    jobs.length === mediaRequests.length,
    "Media generation jobs length is invalid.",
  );

  assert(
    jobs.every((job) => job.status === "queued"),
    "Expected all media generation jobs to be queued.",
  );

  assert(
    jobs.every((job) => job.attempts === 0 && job.maxAttempts === 3),
    "Expected media generation job attempts to be initialized.",
  );

  const baseJob = jobs[0];
  assert(baseJob, "Expected at least one media generation job for state machine checks.");

  const startedJob = startMediaGenerationJob(baseJob);
  assert(startedJob.status === "running", "Expected started media generation job to be running.");
  assert(startedJob.error === null, "Expected started media generation job error to be null.");
  assert(startedJob.createdAt === baseJob.createdAt, "Expected started media generation job to preserve createdAt.");
  assert(startedJob.request.id === baseJob.request.id, "Expected started media generation job to preserve request.id.");

  const fakeCompletedResult = {
    provider: "fake",
    externalJobId: `fake-status-${baseJob.request.id}`,
    status: "generated" as const,
  };

  const completedJob = completeMediaGenerationJob(baseJob, fakeCompletedResult);
  assert(completedJob.status === "completed", "Expected completed media generation job to be completed.");
  assert(completedJob.providerId === "fake", "Expected completed media generation job providerId to be fake.");
  assert(completedJob.externalJobId === fakeCompletedResult.externalJobId, "Expected completed media generation job to preserve externalJobId.");
  assert(completedJob.createdAt === baseJob.createdAt, "Expected completed media generation job to preserve createdAt.");
  assert(completedJob.request.id === baseJob.request.id, "Expected completed media generation job to preserve request.id.");

  const failedJob = failMediaGenerationJob(baseJob, "Manual failure");
  assert(failedJob.status === "failed", "Expected failed media generation job to be failed.");
  assert(failedJob.error === "Manual failure", "Expected failed media generation job error to match input.");
  assert(failedJob.createdAt === baseJob.createdAt, "Expected failed media generation job to preserve createdAt.");
  assert(failedJob.request.id === baseJob.request.id, "Expected failed media generation job to preserve request.id.");

  const cancelledJob = cancelMediaGenerationJob(baseJob, "Manual cancel");
  assert(cancelledJob.status === "cancelled", "Expected cancelled media generation job to be cancelled.");
  assert(cancelledJob.error === "Manual cancel", "Expected cancelled media generation job error to match input.");
  assert(cancelledJob.createdAt === baseJob.createdAt, "Expected cancelled media generation job to preserve createdAt.");
  assert(cancelledJob.request.id === baseJob.request.id, "Expected cancelled media generation job to preserve request.id.");

  const executedJobs = await executeMediaGenerationJobs(jobs);

  assert(
    executedJobs.length === jobs.length,
    "Executed media generation jobs length is invalid.",
  );

  assert(
    executedJobs.every((job) => job.status === "completed"),
    "Expected all executed media generation jobs to be completed.",
  );

  assert(
    executedJobs.every((job) => job.providerId === "fake" && job.result?.provider === "fake"),
    "Expected all executed media generation jobs to use fake provider.",
  );

  const pollResults = await pollMediaGenerationJobsStatus(executedJobs);

  assert(
    pollResults.length === executedJobs.length,
    "Media status poll results length is invalid.",
  );

  assert(
    pollResults.every((item) => item.providerStatus?.provider === "fake"),
    "Expected all media status poll results to use fake provider.",
  );

  assert(
    pollResults.every((item) => item.job.status === "completed"),
    "Expected all polled media generation jobs to be completed.",
  );

  const updatedAssets = applyMediaGenerationJobsToAssets(
    executedJobs,
    bundleMedia.assets,
  );

  assert(
    updatedAssets.length === bundleMedia.assets.length,
    "Updated media assets length is invalid.",
  );

  const updatedAssetsWithJobs = updatedAssets.filter((asset) =>
    executedJobs.some((job) => job.request.id === asset.id),
  );

  assert(
    updatedAssetsWithJobs.length === executedJobs.length,
    "Updated media assets with jobs length is invalid.",
  );

  assert(
    updatedAssetsWithJobs.every((asset) => asset.status === "generated"),
    "Expected all updated media assets with jobs to be generated.",
  );

  assert(
    updatedAssetsWithJobs.every((asset) => asset.generationProvider === "fake"),
    "Expected all updated media assets with jobs to keep fake generation provider.",
  );

  const pipelineResult = await runMediaGenerationPipeline(
    mediaRequests,
    bundleMedia.assets,
  );

  assert(
    pipelineResult.jobs.length === mediaRequests.length,
    "Media generation pipeline jobs length is invalid.",
  );

  assert(
    pipelineResult.executedJobs.every((job) => job.status === "completed"),
    "Expected media generation pipeline executed jobs to be completed.",
  );

  assert(
    pipelineResult.assets.every((asset) => asset.status === "generated"),
    "Expected media generation pipeline assets to be generated.",
  );

  const selections = selectMediaProvidersForRequests(mediaRequests);

  assert(
    selections.length === mediaRequests.length,
    "Media provider selections length is invalid.",
  );

  assert(
    selections.every((selection) => selection.provider?.id === "fake"),
    "Expected all media provider selections to resolve to fake provider.",
  );

  assert(
    selections.every((selection) => selection.reason === "matched_capability"),
    "Expected all media provider selections to match capability.",
  );

  const selectedResults =
    await runMediaProviderSelectionForRequests(mediaRequests);

  assert(
    selectedResults.length === mediaRequests.length,
    "Selected media provider results length is invalid.",
  );

  assert(
    selectedResults.every((item) => item.provider === "fake"),
    "Expected selected media provider results to use fake provider.",
  );

  assert(
    selectedResults.every((item) => item.status === "generated"),
    "Expected selected media provider results to be generated.",
  );

  const results = await runMediaProviderForRequests(
    mediaRequests,
    fakeMediaProvider,
  );

  assert(results.length === rebuiltRequests.length, "Media provider results length is invalid.");
  assert(results.every((item) => item.provider === "fake"), "A media provider result is not from the fake provider.");
  assert(results.every((item) => item.status === "generated"), "A media provider result is not generated.");

  for (const item of results) {
    assertNonEmptyString(item.externalJobId, "mediaProviderResult.externalJobId");
    assert(item.asset, "mediaProviderResult.asset is missing.");
    assert(item.asset?.generationProvider === "fake", "mediaProviderResult.asset.generationProvider is invalid.");
    assert(item.asset?.previewUrl === null, "mediaProviderResult.asset.previewUrl should be null.");
    assert(item.asset?.downloadUrl === null, "mediaProviderResult.asset.downloadUrl should be null.");
    assert(item.asset?.thumbnailUrl === null, "mediaProviderResult.asset.thumbnailUrl should be null.");
  }

  console.log(
    JSON.stringify(
      {
        bundleId: bundle.id,
        campaignId: bundle.campaign.id,
        campaignName: bundle.campaign.name,
        requestCount: mediaRequests.length,
        rebuiltRequestCount: rebuiltRequests.length,
        bundleRequestCount: bundleMedia.requests.length,
        bundleAssetCount: bundleMedia.assets.length,
        providerId: fakeMediaProvider.id,
        providerLabel: fakeMediaProvider.label,
        capabilities: fakeMediaProvider.capabilities,
        jobCount: jobs.length,
        executedJobCount: executedJobs.length,
        polledJobCount: pollResults.length,
        updatedAssetCount: updatedAssets.length,
        updatedAssetsWithJobsCount: updatedAssetsWithJobs.length,
        pipelineJobCount: pipelineResult.jobs.length,
        pipelineAssetCount: pipelineResult.assets.length,
        selectionCount: selections.length,
        selectedProviderIds: selections.map((selection) => selection.provider?.id ?? null),
        selectedResultsCount: selectedResults.length,
        resultsCount: results.length,
        allProvidersFake: results.every((item) => item.provider === "fake"),
        allGenerated: results.every((item) => item.status === "generated"),
        noExternalAssetUrls: results.every(
          (item) =>
            item.asset?.previewUrl === null &&
            item.asset?.downloadUrl === null &&
            item.asset?.thumbnailUrl === null,
        ),
        requestIds: mediaRequests.map((request) => request.id),
        rebuiltRequestIds: rebuiltRequests.map((request) => request.id),
        resultJobs: results.map((item) => ({
          provider: item.provider,
          externalJobId: item.externalJobId ?? null,
          status: item.status,
          kind: item.asset?.kind ?? null,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
