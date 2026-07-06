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

function isVideoLikeKind(kind: string) {
  return kind === "video" || kind === "reel";
}

function assertExpectedProviderResult(
  input: {
    kind: string;
    provider: string | null | undefined;
    status: string;
    error: string | null | undefined;
    expectedImageProvider: string;
  },
  label: string,
) {
  const expectedProvider = isVideoLikeKind(input.kind)
    ? "fake"
    : input.expectedImageProvider;

  assert(
    input.provider === expectedProvider,
    `${label} should use ${expectedProvider} for kind ${input.kind}.`,
  );

  if (expectedProvider === "fake") {
    assert(
      input.status === "generated" || input.status === "completed",
      `${label} should complete with fake provider for kind ${input.kind}.`,
    );
    return;
  }

  assert(
    input.status === "generated" ||
      input.status === "completed" ||
      input.status === "failed",
    `${label} should resolve to generated/completed or failed for kind ${input.kind}.`,
  );

  if (input.status === "failed") {
    assertNonEmptyString(input.error, `${label}.error`);
  }
}

async function main() {
  const objective = "education";
  const openAiImageEnabled =
    process.env.OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED === "true";
  const supabaseMediaStorageEnabled =
    process.env.SUPABASE_MEDIA_STORAGE_ENABLED === "true";
  const expectedImageProvider = openAiImageEnabled ? "openai" : "fake";
  const expectedStorageProvider = supabaseMediaStorageEnabled
    ? "supabase"
    : "none";
  const expectedUploadEnabled =
    openAiImageEnabled && supabaseMediaStorageEnabled;

  const mediaConfiguration = getMediaConfiguration();
  assert(
    mediaConfiguration.imageProvider === expectedImageProvider,
    `Expected media image provider to be ${expectedImageProvider}.`,
  );
  assert(
    mediaConfiguration.storageProvider === expectedStorageProvider,
    `Expected media storage provider to be ${expectedStorageProvider}.`,
  );
  assert(
    mediaConfiguration.uploadEnabled === expectedUploadEnabled,
    `Expected media uploadEnabled to be ${expectedUploadEnabled}.`,
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
    providerStatusById.get("openai") ===
      (openAiImageEnabled ? "available" : "unconfigured"),
    `Expected openai media provider to be ${
      openAiImageEnabled ? "available" : "unconfigured"
    }.`,
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
    openAiImageEnabled
      ? listMediaProvidersByCapability("image").some(
          (provider) => provider.id === "openai",
        )
      : !listMediaProvidersByCapability("image").some(
          (provider) => provider.id === "openai",
        ),
    openAiImageEnabled
      ? "Expected openai media provider to support image capability when enabled."
      : "Expected openai media provider to be excluded from image capability when disabled.",
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
    objective,
    audience: "Hôtes et conciergeries",
    language: "fr",
    channels: ["facebook", "instagram", "linkedin"],
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

  const heroRequest = rebuiltRequests.find((request) => request.id.endsWith("-hero-image"));
  const facebookRequest = rebuiltRequests.find((request) =>
    request.id.endsWith("-facebook-post-image"),
  );
  const linkedInRequest = rebuiltRequests.find((request) =>
    request.id.endsWith("-linkedin-cover-image"),
  );
  const thumbnailRequest = rebuiltRequests.find((request) =>
    request.id.endsWith("-video-thumbnail"),
  );

  assert(heroRequest, "Hero media request is missing.");
  assert(facebookRequest, "Facebook media request is missing.");
  assert(linkedInRequest, "LinkedIn media request is missing.");
  assert(thumbnailRequest, "Thumbnail media request is missing.");

  const promptOrderChecks = [
    {
      request: heroRequest,
      role: "Asset role: premium hero image for the campaign.",
    },
    {
      request: facebookRequest,
      role: "Asset role: scroll-stopping Facebook post image.",
    },
    {
      request: linkedInRequest,
      role: "Asset role: professional LinkedIn cover image.",
    },
    {
      request: thumbnailRequest,
      role: "Asset role: high-impact video thumbnail.",
    },
  ] as const;

  for (const item of promptOrderChecks) {
    assert(
      item.request.prompt.includes(item.role),
      `Expected media prompt to include asset role: ${item.role}`,
    );
    const roleIndex = item.request.prompt.indexOf(item.role);
    const creativeDirectionIndex = item.request.prompt.indexOf(
      "Supporting campaign creative direction:",
    );

    assert(
      roleIndex !== -1 && creativeDirectionIndex !== -1 && roleIndex < creativeDirectionIndex,
      `Expected asset role to appear before supporting creative direction for ${item.request.id}.`,
    );
  }

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
    executedJobs.every((job) =>
      isVideoLikeKind(job.request.kind)
        ? job.status === "completed"
        : openAiImageEnabled
          ? job.status === "completed" || job.status === "failed"
          : job.status === "completed",
    ),
    "Expected executed media generation jobs to resolve to the correct final state per asset kind.",
  );

  assert(
    executedJobs.every((job) => {
      const expectedProvider = isVideoLikeKind(job.request.kind)
        ? "fake"
        : expectedImageProvider;

      return (
        job.providerId === expectedProvider && job.result?.provider === expectedProvider
      );
    }),
    "Expected executed media generation jobs to use the correct provider per asset kind.",
  );

  for (const job of executedJobs) {
    assertExpectedProviderResult(
      {
        kind: job.request.kind,
        provider: job.result?.provider ?? job.providerId,
        status: job.result?.status ?? job.status,
        error: job.error,
        expectedImageProvider,
      },
      "executedJob",
    );
  }

  const pollResults = await pollMediaGenerationJobsStatus(executedJobs);

  assert(
    pollResults.length === executedJobs.length,
    "Media status poll results length is invalid.",
  );

  assert(
    pollResults.every((item) => {
      if (item.job.status === "failed") {
        return item.providerStatus == null;
      }

      const expectedProvider = isVideoLikeKind(item.job.request.kind)
        ? "fake"
        : expectedImageProvider;

      return item.providerStatus?.provider === expectedProvider;
    }),
    "Expected all media status poll results to use the correct provider per asset kind.",
  );

  assert(
    pollResults.every((item) =>
      isVideoLikeKind(item.job.request.kind)
        ? item.job.status === "completed"
        : openAiImageEnabled
          ? item.job.status === "completed" || item.job.status === "failed"
          : item.job.status === "completed",
    ),
    "Expected all polled media generation jobs to resolve to the correct final state per asset kind.",
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
    updatedAssetsWithJobs.every((asset) =>
      isVideoLikeKind(asset.kind)
        ? asset.status === "generated"
        : openAiImageEnabled
          ? asset.status === "generated" || asset.status === "failed"
          : asset.status === "generated",
    ),
    "Expected updated media assets with jobs to resolve to generated or failed depending on the provider outcome.",
  );

  assert(
    updatedAssetsWithJobs.every((asset) => {
      const matchingJob = executedJobs.find((job) => job.request.id === asset.id);
      const expectedProvider = isVideoLikeKind(asset.kind)
        ? "fake"
        : expectedImageProvider;

      if (matchingJob?.status === "failed") {
        return asset.status === "failed" && asset.generationProvider == null;
      }

      return asset.generationProvider === expectedProvider;
    }),
    "Expected updated media assets with jobs to preserve the correct provider, or remain provider-less when the real generation fails.",
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
    pipelineResult.executedJobs.every((job) =>
      isVideoLikeKind(job.request.kind)
        ? job.status === "completed"
        : openAiImageEnabled
          ? job.status === "completed" || job.status === "failed"
          : job.status === "completed",
    ),
    "Expected media generation pipeline executed jobs to resolve to the correct final state per asset kind.",
  );

  assert(
    pipelineResult.assets.every((asset) =>
      isVideoLikeKind(asset.kind)
        ? asset.status === "generated"
        : openAiImageEnabled
          ? asset.status === "generated" || asset.status === "failed"
          : asset.status === "generated",
    ),
    "Expected media generation pipeline assets to resolve to generated or failed depending on the provider outcome.",
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
    engineResult.executedJobs.every((job) =>
      isVideoLikeKind(job.request.kind)
        ? job.status === "completed"
        : openAiImageEnabled
          ? job.status === "completed" || job.status === "failed"
          : job.status === "completed",
    ),
    "Expected all media engine executed jobs to resolve to the correct final state per asset kind.",
  );

  const selections = selectMediaProvidersForRequests(mediaRequests);

  assert(
    selections.length === mediaRequests.length,
    "Media provider selections length is invalid.",
  );

  assert(
    selections.every((selection) => {
      const expectedProvider = isVideoLikeKind(selection.capability)
        ? "fake"
        : expectedImageProvider;

      return selection.provider?.id === expectedProvider;
    }),
    "Expected media provider selections to resolve to the correct provider per capability.",
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
    selectedResults.every((item, index) => {
      const request = mediaRequests[index];
      const expectedProvider = request && isVideoLikeKind(request.kind)
        ? "fake"
        : expectedImageProvider;

      return item.provider === expectedProvider;
    }),
    "Expected selected media provider results to use the correct provider per request kind.",
  );

  assert(
    selectedResults.every((item, index) => {
      const request = mediaRequests[index];

      if (request && isVideoLikeKind(request.kind)) {
        return item.status === "generated";
      }

      return openAiImageEnabled
        ? item.status === "generated" || item.status === "failed"
        : item.status === "generated";
    }),
    "Expected selected media provider results to resolve to generated or failed depending on the provider outcome.",
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
        openAiImageEnabled,
        supabaseMediaStorageEnabled,
        expectedImageProvider,
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
