import { buildMediaAssetRequestsFromBundle } from "../lib/marketing-ai/media/mediaAssetRequestBuilder";
import {
  fakeMediaProvider,
  fakeMediaStorageAdapter,
  uploadMediaBinaryForAsset,
  uploadMediaBinariesForAssets,
  uploadMediaBinaries,
  getMediaConfiguration,
  getMediaProviderById,
  listMediaProviders,
  listMediaProvidersByCapability,
  createMediaBinaryFilename,
  isMediaBinary,
  selectMediaProvidersForRequests,
  buildMediaGenerationJobs,
  executeMediaGenerationJobs,
  startMediaGenerationJob,
  completeMediaGenerationJob,
  failMediaGenerationJob,
  cancelMediaGenerationJob,
  pollMediaGenerationJobsStatus,
  applyMediaGenerationJobsToAssets,
  runMediaEngine,
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
  const mediaConfiguration = getMediaConfiguration();
  assert(
    mediaConfiguration.imageProvider === "fake",
    "Expected default media image provider to be fake.",
  );
  assert(
    mediaConfiguration.storageProvider === "none",
    "Expected default media storage provider to be none.",
  );
  assert(
    mediaConfiguration.uploadEnabled === false,
    "Expected default media upload to be disabled.",
  );

  const registeredProviders = listMediaProviders();
  assert(
    registeredProviders.length > 0,
    "Expected at least one registered media provider.",
  );

  const providerStatusById = new Map(
    registeredProviders.map((provider) => [provider.id, provider.status]),
  );

  assert(
    providerStatusById.get("fake") === "available",
    "Expected fake media provider to be available.",
  );
  assert(
    providerStatusById.get("openai") === "unconfigured",
    "Expected openai media provider to be unconfigured.",
  );
  assert(
    providerStatusById.get("runway") === "unconfigured",
    "Expected runway media provider to be unconfigured.",
  );
  assert(
    providerStatusById.get("fal") === "unconfigured",
    "Expected fal media provider to be unconfigured.",
  );
  assert(
    providerStatusById.get("replicate") === "unconfigured",
    "Expected replicate media provider to be unconfigured.",
  );

  const fakeProviderEntry = getMediaProviderById("fake");
  assert(fakeProviderEntry, "Expected fake media provider to be registered.");

  assert(
    listMediaProvidersByCapability("image").some((provider) => provider.id === "fake"),
    "Expected fake media provider to support image capability.",
  );
  assert(
    listMediaProvidersByCapability("image").every((provider) => provider.status === "available"),
    "Expected image capability listing to exclude unconfigured providers.",
  );

  assert(
    listMediaProvidersByCapability("video").some((provider) => provider.id === "fake"),
    "Expected fake media provider to support video capability.",
  );
  assert(
    listMediaProvidersByCapability("video").every((provider) => provider.status === "available"),
    "Expected video capability listing to exclude unconfigured providers.",
  );

  const fakeBinary = {
    id: "manual-openai-image-test",
    kind: "image" as const,
    provider: "openai" as const,
    mimeType: "image/png",
    extension: "png",
    filename: createMediaBinaryFilename({
      id: "manual-openai-image-test",
      provider: "openai",
      extension: "png",
    }),
    encoding: "base64" as const,
    base64: null,
    createdAt: new Date().toISOString(),
  };

  assert(
    fakeBinary.filename.includes("openai/"),
    "Expected media binary filename to contain openai/.",
  );
  assert(
    fakeBinary.filename.endsWith(".png"),
    "Expected media binary filename to end with .png.",
  );
  assert(isMediaBinary(fakeBinary), "Expected fake binary to satisfy isMediaBinary().");
  assert(!isMediaBinary({}), "Expected empty object to fail isMediaBinary().");

  const upload = await fakeMediaStorageAdapter.upload(fakeBinary);
  assert(
    upload.provider === "fake-storage",
    "Fake media storage provider is invalid.",
  );
  assert(
    upload.path.startsWith("fake/"),
    "Fake media storage path is invalid.",
  );
  assert(
    upload.previewUrl === null,
    "Fake media storage previewUrl should be null.",
  );
  assert(
    upload.downloadUrl === null,
    "Fake media storage downloadUrl should be null.",
  );

  await fakeMediaStorageAdapter.delete(upload.path);

  const uploadBinaries = [
    fakeBinary,
    {
      ...fakeBinary,
      id: "manual-openai-image-test-2",
      filename: createMediaBinaryFilename({
        id: "manual-openai-image-test-2",
        provider: "openai",
        extension: "png",
      }),
    },
  ];

  const uploadResults = await uploadMediaBinaries(
    uploadBinaries,
    fakeMediaStorageAdapter,
  );

  assert(
    uploadResults.length === uploadBinaries.length,
    "Media upload results length is invalid.",
  );
  assert(
    uploadResults.every((result) => result.upload.provider === "fake-storage"),
    "Expected all media upload results to use fake storage.",
  );
  assert(
    uploadResults.every((result) => result.upload.path.startsWith("fake/")),
    "Expected all media upload paths to start with fake/.",
  );
  assert(
    uploadResults.every((result) => result.binary.filename.length > 0),
    "Expected all uploaded media binaries to have a filename.",
  );

  const fakeAssets = [
    {
      id: uploadBinaries[0].id,
      kind: "image" as const,
      status: "generated" as const,
      platform: "generic" as const,
      ratio: "1:1" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: uploadBinaries[1].id,
      kind: "image" as const,
      status: "generated" as const,
      platform: "generic" as const,
      ratio: "1:1" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const singleUploadResult = await uploadMediaBinaryForAsset({
    binary: uploadBinaries[0],
    asset: fakeAssets[0],
    storage: fakeMediaStorageAdapter,
  });

  assert(
    singleUploadResult.asset.id === fakeAssets[0].id,
    "Expected single uploaded media asset id to be preserved.",
  );
  assert(
    singleUploadResult.asset.createdAt === fakeAssets[0].createdAt,
    "Expected single uploaded media asset createdAt to be preserved.",
  );

  const assetUploadResults = await uploadMediaBinariesForAssets({
    binaries: uploadBinaries,
    assets: fakeAssets,
    storage: fakeMediaStorageAdapter,
  });

  assert(
    assetUploadResults.length === 2,
    "Expected media binary asset upload results length to be 2.",
  );
  assert(
    assetUploadResults.every((result) => result.upload.provider === "fake-storage"),
    "Expected media binary asset uploads to use fake storage.",
  );
  assert(
    assetUploadResults.every(
      (result) =>
        (result.asset.metadata as { storageProvider?: string } | undefined)
          ?.storageProvider === "fake-storage",
    ),
    "Expected uploaded media asset metadata storageProvider to be fake-storage.",
  );
  assert(
    assetUploadResults.every(
      (result) =>
        ((result.asset.metadata as { storagePath?: string } | undefined)?.storagePath ?? "").startsWith(
          "fake/",
        ),
    ),
    "Expected uploaded media asset metadata storagePath to start with fake/.",
  );
  assert(
    assetUploadResults.every((result) => result.asset.id === result.binary.id),
    "Expected uploaded media asset id to be preserved.",
  );
  assert(
    assetUploadResults.every((result) => {
      const originalAsset = fakeAssets.find((asset) => asset.id === result.asset.id);
      return originalAsset?.createdAt === result.asset.createdAt;
    }),
    "Expected uploaded media asset createdAt to be preserved.",
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

  const engineResult = await runMediaEngine({
    requests: mediaRequests,
    assets: bundleMedia.assets,
  });

  assert(
    engineResult.assets.length === bundleMedia.assets.length,
    "Media engine assets length is invalid.",
  );
  assert(
    engineResult.executedJobs.length === mediaRequests.length,
    "Media engine executed jobs length is invalid.",
  );
  assert(
    engineResult.executedJobs.every((job) => job.status === "completed"),
    "Expected all media engine executed jobs to be completed.",
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
