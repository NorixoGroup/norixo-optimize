import { buildMediaAssetRequestsFromBundle } from "../lib/marketing-ai/media/mediaAssetRequestBuilder";
import { buildMediaAssets } from "../lib/marketing-ai/media/mediaAssetBuilder";
import {
  fakeMediaProvider,
  getMediaConfiguration,
  getMediaProviderById,
  listMediaProviders,
  listMediaProvidersByCapability,
  selectMediaProvidersForRequests,
  buildMediaGenerationJobs,
  executeMediaGenerationJobs,
  pollMediaGenerationJobsStatus,
  applyMediaGenerationJobsToAssets,
  runMediaEngine,
  runMediaGenerationPipeline,
} from "../lib/marketing-ai/media";
import {
  runMediaProviderForRequests,
  runMediaProviderSelectionForRequests,
} from "../lib/marketing-ai/media/mediaProviderRunner";

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

function buildTestBundle() {
  return {
    id: "marketing-studio-media-layer-test-bundle",
    campaign: {
      id: "marketing-studio-media-layer-test-campaign",
      name: "Campagne media layer smoke test",
      objective: "education",
      audience: "Hôtes et conciergeries",
      tone: "professional",
      cta: "Découvrir Norixo.io",
      websiteUrl: "https://norixo.io",
      language: "fr",
      platforms: ["facebook", "instagram", "linkedin"],
      formats: ["post", "reel"],
      durationDays: 30,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      hashtags: ["#Norixo"],
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    creative: {
      creativeConcept:
        "Mettre en scène un audit concret d'annonce courte durée avec analyse photo, friction points et priorités d'amélioration.",
      visualStyle: "premium saas editorial",
      layout: "single-focus composition",
      overlays: [],
      imagePrompt:
        "Create a premium Norixo campaign visual showing a short-term rental listing audit with clear photo analysis, friction points and prioritized recommendations.",
      negativePrompt: "No watermarks. No unreadable text.",
      videoPrompt:
        "Show a short-term rental listing being analyzed and improved with one strong visual progression from friction to clarity.",
      brandChecklist: ["Norixo", "premium", "audit"],
    },
    video: {
      storyboard:
        "Scene 1: listing photos audit. Scene 2: friction points highlighted. Scene 3: prioritized improvements.",
      script:
        "Norixo helps hosts identify weak listing photos and turn friction into clear improvement actions.",
      timeline: "0-5s hook | 5-10s improvements",
      scenes: [
        {
          scene: 1,
          duration: "0-5s",
          visual: "Audit photo d'annonce courte durée",
          onScreenText: "Audit photo",
          voiceOver: "Repérez les photos qui freinent la réservation.",
          transition: "cut",
        },
        {
          scene: 2,
          duration: "5-10s",
          visual: "Recommandations Norixo priorisées",
          onScreenText: "Priorités claires",
          voiceOver: "Passez des frictions aux actions prioritaires.",
          transition: "fade",
        },
      ],
      voice: "professional",
      transitions: ["cut", "fade"],
      captions: "Audit listing photos with Norixo",
      videoPrompt:
        "Vertical reel showing a short-term rental listing photo audit, visible friction points and clear improvement priorities for hosts.",
    },
    publisher: {
      mode: "draft_only",
      canPublish: false,
      requiresApproval: true,
      channels: {
        facebook: {
          platform: "facebook",
          status: "draft",
          copy: "Analysez vos photos d'annonce avec Norixo.",
          caption:
            "Identifiez les visuels faibles, les points de friction et les actions à prioriser.",
          hashtags: ["#Norixo", "#AirbnbHost"],
          assetPrompt:
            "Create a Facebook visual showing a listing photo audit and prioritized recommendations.",
          videoPrompt:
            "Short reel about listing photo audit and actionable recommendations.",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
        instagram: {
          platform: "instagram",
          status: "draft",
          copy: "Passez d'une annonce moyenne à une annonce plus claire.",
          caption:
            "Montrez visuellement comment Norixo détecte les frictions photo et les priorités d'amélioration.",
          hashtags: ["#Norixo", "#ShortTermRental"],
          assetPrompt:
            "Create an Instagram visual showing photo friction points and clearer listing presentation.",
          videoPrompt:
            "Vertical reel about photo audit, friction points and improved listing clarity.",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
        linkedin: {
          platform: "linkedin",
          status: "draft",
          copy: "Structurez l'analyse qualité de vos annonces avec Norixo.",
          caption:
            "Mettre en avant une lecture plus analytique des photos, des frictions et des recommandations.",
          hashtags: ["#Norixo", "#PropertyManagement"],
          assetPrompt:
            "Create a LinkedIn cover showing structured listing analysis and prioritized improvements.",
          videoPrompt:
            "Professional reel angle about listing analysis and optimization priorities.",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
      },
    },
  } as const;
}

function installFalFetchMock() {
  const originalFetch = globalThis.fetch;
  let generationStatusCalls = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (
      url ===
        "https://queue.fal.run/fal-ai/minimax/hailuo-02/standard/text-to-video" &&
      method === "POST"
    ) {
      return new Response(
        JSON.stringify({
          request_id: "fal-generation-test-id",
          status: "IN_QUEUE",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (
      url ===
        "https://queue.fal.run/fal-ai/minimax/hailuo-02/standard/text-to-video/requests/fal-generation-test-id/status" &&
      method === "GET"
    ) {
      generationStatusCalls += 1;

      if (generationStatusCalls === 1) {
        return new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          status: "COMPLETED",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (
      url ===
        "https://queue.fal.run/fal-ai/minimax/hailuo-02/standard/text-to-video/requests/fal-generation-test-id" &&
      method === "GET"
    ) {
      return new Response(
        JSON.stringify({
          status: "COMPLETED",
          video: {
            url: "https://cdn.fal.test/reel.mp4",
          },
          thumbnail: {
            url: "https://cdn.fal.test/reel.jpg",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (url === "https://cdn.fal.test/reel.mp4" && method === "GET") {
      return new Response(Buffer.from("fake-fal-mp4-binary"), {
        status: 200,
        headers: { "content-type": "video/mp4" },
      });
    }

    if (typeof originalFetch === "function") {
      return originalFetch(input, init);
    }

    throw new Error(`Unhandled fetch mock request: ${method} ${url}`);
  }) as typeof globalThis.fetch;

  return {
    restore() {
      globalThis.fetch = originalFetch;
    },
    getGenerationStatusCalls() {
      return generationStatusCalls;
    },
  };
}

function withTemporaryEnv<T>(
  values: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  const previousEntries = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return run().finally(() => {
    for (const [key, value] of Object.entries(previousEntries)) {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

async function main() {
  const bundle = buildTestBundle();
  const rebuiltRequests = buildMediaAssetRequestsFromBundle(bundle as never);
  const bundleAssets = buildMediaAssets(rebuiltRequests);

  assert(rebuiltRequests.length > 0, "buildMediaAssetRequestsFromBundle() returned no requests.");
  assert(bundleAssets.length === rebuiltRequests.length, "buildMediaAssets() length is invalid.");

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
  const reelRequest = rebuiltRequests.find((request) =>
    request.id.endsWith("-instagram-reel"),
  );

  assert(heroRequest, "Hero media request is missing.");
  assert(facebookRequest, "Facebook media request is missing.");
  assert(linkedInRequest, "LinkedIn media request is missing.");
  assert(thumbnailRequest, "Thumbnail media request is missing.");
  assert(reelRequest, "Reel media request is missing.");
  const reelRequestId = reelRequest.id;

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

  const videoRequests = rebuiltRequests.filter((request) => isVideoLikeKind(request.kind));
  const videoAssets = bundleAssets.filter((asset) => isVideoLikeKind(asset.kind));

  assert(videoRequests.length === 1, "Expected exactly one reel request in the test bundle.");
  assert(videoAssets.length === 1, "Expected exactly one reel asset in the test bundle.");

  await withTemporaryEnv(
    {
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: "true",
      FAL_VIDEO_PROVIDER_ENABLED: undefined,
      FAL_KEY: undefined,
      FAL_VIDEO_MODEL: undefined,
      MEDIA_POLL_INTERVAL_MS: "0",
      MEDIA_MAX_POLL_ATTEMPTS: "2",
    },
    async () => {
      const fallbackConfiguration = getMediaConfiguration();
      assert(
        fallbackConfiguration.imageProvider === "openai",
        "Expected image provider to remain openai in fallback mode.",
      );
      assert(
        fallbackConfiguration.videoProvider === "fake",
        "Expected video provider to remain fake when fal is disabled.",
      );
      assert(
        fallbackConfiguration.storageProvider === "none",
        "Expected storage provider to be none when Supabase storage is not enabled in fallback mode.",
      );

      const fallbackProviders = listMediaProviders();
      const fallbackProviderStatusById = new Map(
        fallbackProviders.map((provider) => [provider.id, provider.status]),
      );
      assert(
        fallbackProviderStatusById.get("openai") === "available",
        "Expected openai media provider to stay available in fallback mode.",
      );
      assert(
        fallbackProviderStatusById.get("fal") === "unconfigured",
        "Expected fal media provider to be unconfigured in fallback mode.",
      );

      const fallbackSelections = selectMediaProvidersForRequests(rebuiltRequests);
      assert(
        fallbackSelections.some((selection) => selection.provider?.id === "fake"),
        "Expected fake provider fallback to remain available for video requests.",
      );
      assert(
        fallbackSelections.some(
          (selection) =>
            !isVideoLikeKind(selection.requestId) && selection.provider?.id === "openai",
        ) || fallbackSelections.some((selection) => selection.provider?.id === "openai"),
        "Expected openai to remain selectable for image requests in fallback mode.",
      );

      const fallbackSelectedResults =
        await runMediaProviderSelectionForRequests(videoRequests);
      assert(
        fallbackSelectedResults.every(
          (item) => item.provider === "fake" && item.status === "generated",
        ),
        "Expected video requests to resolve through fake provider when fal is disabled.",
      );
    },
  );

  await withTemporaryEnv(
    {
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: "true",
      SUPABASE_MEDIA_STORAGE_ENABLED: "false",
      FAL_VIDEO_PROVIDER_ENABLED: "true",
      FAL_KEY: "test-fal-key",
      FAL_VIDEO_MODEL: "fal-ai/minimax/hailuo-02/standard/text-to-video",
      MEDIA_POLL_INTERVAL_MS: "0",
      MEDIA_MAX_POLL_ATTEMPTS: "3",
    },
    async () => {
      const fetchMock = installFalFetchMock();

      try {
        const mediaConfiguration = getMediaConfiguration();
        assert(
          mediaConfiguration.imageProvider === "openai",
          "Expected image provider to remain openai when enabled.",
        );
        assert(
          mediaConfiguration.videoProvider === "fal",
          "Expected video provider to switch to fal when enabled and configured.",
        );
        assert(
          mediaConfiguration.pollingEnabled === true,
          "Expected media polling to be enabled for async fal video generation.",
        );
        assert(
          mediaConfiguration.uploadEnabled === false,
          "Expected media upload to remain disabled in the test to avoid real storage calls.",
        );

        const registeredProviders = listMediaProviders();
        const providerStatusById = new Map(
          registeredProviders.map((provider) => [provider.id, provider.status]),
        );

        assert(
          providerStatusById.get("fake") === "available",
          "Expected fake media provider to remain available.",
        );
        assert(
          providerStatusById.get("openai") === "available",
          "Expected openai media provider to stay available.",
        );
        assert(
          providerStatusById.get("fal") === "available",
          "Expected fal media provider to be available.",
        );

        const falProvider = getMediaProviderById("fal");
        assert(falProvider, "Expected fal provider to be registered.");
        assert(
          listMediaProvidersByCapability("video").some(
            (provider) => provider.id === "fal",
          ),
          "Expected fal provider to be available for video capability.",
        );

        const selections = selectMediaProvidersForRequests(rebuiltRequests);
        const reelSelection = selections.find(
          (selection) => selection.requestId === reelRequestId,
        );
        assert(reelSelection, "Expected a provider selection for the reel request.");
        assert(
          reelSelection.provider?.id === "fal",
          "Expected reel request to select fal provider.",
        );

        const jobs = buildMediaGenerationJobs(videoRequests);
        assert(jobs.length === videoRequests.length, "Media generation jobs length is invalid.");
        assert(
          jobs.every((job) => job.status === "queued"),
          "Expected all video generation jobs to start queued.",
        );

        const executedJobs = await executeMediaGenerationJobs(jobs);
        assert(
          executedJobs.every(
            (job) =>
              job.providerId === "fal" &&
              job.result?.provider === "fal" &&
              job.status === "running" &&
              (job.result?.status === "queued" || job.result?.status === "generating"),
          ),
          "Expected initial fal execution to stay async and running.",
        );

        const firstPollResults = await pollMediaGenerationJobsStatus(executedJobs);
        assert(
          firstPollResults.every(
            (item) =>
              item.providerStatus?.provider === "fal" &&
              item.job.status === "running",
          ),
          "Expected first fal poll to remain in running state.",
        );

        const pipelineResult = await runMediaGenerationPipeline(
          videoRequests,
          videoAssets,
        );
        assert(
          pipelineResult.executedJobs.every(
            (job) =>
              job.providerId === "fal" &&
              job.result?.provider === "fal" &&
              job.status === "completed" &&
              job.result?.status === "generated",
          ),
          "Expected video pipeline jobs to resolve to generated through fal.",
        );
        assert(
          pipelineResult.assets.every(
            (asset) =>
              asset.status === "generated" &&
              asset.generationProvider === "fal" &&
              typeof asset.previewUrl === "string" &&
              typeof asset.downloadUrl === "string",
          ),
          "Expected pipeline video assets to expose preview and download URLs from fal.",
        );

        const updatedAssets = applyMediaGenerationJobsToAssets(
          pipelineResult.executedJobs,
          videoAssets,
        );
        assert(
          updatedAssets.every(
            (asset) =>
              asset.generationProvider === "fal" &&
              asset.status === "generated",
          ),
          "Expected updated video assets to preserve the fal provider.",
        );

        const engineResult = await runMediaEngine({
          requests: videoRequests,
          assets: videoAssets,
        });
        assert(
          engineResult.executedJobs.every(
            (job) =>
              job.providerId === "fal" &&
              job.result?.provider === "fal" &&
              job.status === "completed",
          ),
          "Expected media engine to complete the fal reel job.",
        );
        assert(
          engineResult.assets.every(
            (asset) =>
              asset.status === "generated" &&
              asset.generationProvider === "fal" &&
              typeof asset.previewUrl === "string" &&
              asset.previewUrl.trim().length > 0 &&
              typeof asset.downloadUrl === "string" &&
              asset.downloadUrl.trim().length > 0,
          ),
          "Expected media engine reel asset to expose previewUrl/downloadUrl and the correct provider.",
        );

        const selectedResults =
          await runMediaProviderSelectionForRequests(videoRequests);
        assert(
          selectedResults.every(
            (item) =>
              item.provider === "fal" &&
              (item.status === "queued" || item.status === "generating"),
          ),
          "Expected provider selection runner to return async fal video results.",
        );

        const fakeResults = await runMediaProviderForRequests(
          videoRequests,
          fakeMediaProvider,
        );
        assert(
          fakeResults.every((item) => item.provider === "fake" && item.status === "generated"),
          "Expected fake provider direct execution to remain stable.",
        );

        assert(
          fetchMock.getGenerationStatusCalls() >= 2,
          "Expected mocked fal polling to reach completion through repeated status checks.",
        );

        console.log(
          JSON.stringify(
            {
              bundleId: bundle.id,
              requestCount: rebuiltRequests.length,
              videoRequestIds: videoRequests.map((request) => request.id),
              falProviderAvailable: providerStatusById.get("fal") === "available",
              selectedProviderIds: selections.map(
                (selection) => selection.provider?.id ?? null,
              ),
              executedJobStatuses: executedJobs.map((job) => ({
                id: job.id,
                providerId: job.providerId ?? null,
                status: job.status,
                providerStatus: job.result?.status ?? null,
              })),
              finalPipelineStatuses: pipelineResult.executedJobs.map((job) => ({
                id: job.id,
                providerId: job.providerId ?? null,
                status: job.status,
                providerStatus: job.result?.status ?? null,
              })),
              engineAssets: engineResult.assets.map((asset) => ({
                id: asset.id,
                kind: asset.kind,
                status: asset.status,
                generationProvider: asset.generationProvider,
                hasPreview: Boolean(asset.previewUrl),
                hasDownload: Boolean(asset.downloadUrl),
              })),
            },
            null,
            2,
          ),
        );
      } finally {
        fetchMock.restore();
      }
    },
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
