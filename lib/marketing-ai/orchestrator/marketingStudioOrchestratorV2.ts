import type {
  CreateMarketingCampaignBundleInput,
  MarketingCampaignBundle,
} from "../bundle/marketingCampaignBundle";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import type { MediaAsset, MediaBinary, MediaInternalBinary } from "../media";
import { buildMarketingCampaignBundle } from "../bundle/campaignBundleBuilder";
import { createDefaultMarketingCampaign } from "../campaigns/campaignModel";
import { createCampaignMemoryFromCampaign } from "../campaigns/campaignMemory";
import type {
  PlannerItem,
  PlannerOutput,
  SocialOutput,
} from "../contracts/agentContracts";
import type { PublisherAssetReferences } from "../publication/assetReferences";
import { createPublicationPack } from "../publication/publicationPack";

export type MarketingStudioOrchestratorV2Input = {
  name?: string;
  objective: string;
  audience?: string;
  language?: string;
  channels?: string[];
  tone?: string;
  cta?: string;
  durationDays?: number;
};

export type MarketingStudioOrchestratorV2Result = {
  planner: MarketingAiExecutionResult;
  social: MarketingAiExecutionResult | null;
  creative: MarketingAiExecutionResult | null;
  video: MarketingAiExecutionResult | null;
  localization: Record<string, MarketingAiExecutionResult | null>;
  bundle: MarketingCampaignBundle;
  approvalRequired: true;
};

const LOCALIZATION_TARGETS = [
  { language: "fr", country: "France" },
  { language: "en", country: "United States" },
  { language: "es", country: "Spain" },
  { language: "de", country: "Germany" },
  { language: "it", country: "Italy" },
  { language: "pt", country: "Portugal" },
  { language: "nl", country: "Netherlands" },
  { language: "ja", country: "Japan" },
  { language: "zh", country: "China" },
  { language: "ko", country: "South Korea" },
  { language: "ar", country: "United Arab Emirates" },
] as const;

const PUBLISHER_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
] as const;

type PublisherPlatform = (typeof PUBLISHER_PLATFORMS)[number];

function resolveCommunityDiscoveryCountry(language: string | undefined): string {
  const normalizedLanguage = language?.trim().toLowerCase();

  switch (normalizedLanguage) {
    case "en":
      return "United States";
    case "es":
      return "Spain";
    case "de":
      return "Germany";
    case "it":
      return "Italy";
    case "pt":
      return "Portugal";
    case "nl":
      return "Netherlands";
    case "ja":
      return "Japan";
    case "zh":
      return "China";
    case "ko":
      return "South Korea";
    case "ar":
      return "United Arab Emirates";
    case "fr":
    default:
      return "France";
  }
}

function resolveCreativeChannel(
  value: string | undefined,
): "instagram" | "facebook" | "linkedin" {
  const normalizedValue = value?.trim().toLowerCase();

  if (
    normalizedValue === "instagram" ||
    normalizedValue === "facebook" ||
    normalizedValue === "linkedin"
  ) {
    return normalizedValue;
  }

  return "facebook";
}

function supportsTikTok(campaignPlatforms: string[]) {
  return campaignPlatforms.includes("tiktok");
}

function buildPublisherCopy(
  platform: (typeof PUBLISHER_PLATFORMS)[number],
  campaignName: string,
  socialTitle: string,
  socialCaption: string,
): string {
  if (platform === "linkedin") {
    return `${campaignName}: ${socialTitle}. ${socialCaption}`;
  }

  return `${socialTitle}. ${socialCaption}`;
}

function buildMissingAssetReferences(
  imagePrompt: string,
  videoPrompt: string,
): PublisherAssetReferences {
  return {
    image: {
      id: "hero-image",
      kind: "image",
      status: "missing",
      prompt: imagePrompt,
    },
    video: {
      id: "main-video",
      kind: "video",
      status: "missing",
      prompt: videoPrompt,
    },
  };
}

function normalizePlannerItemChannel(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();

  return normalized ? normalized : null;
}

export function resolvePlannerItemForPlatform(
  plannerOutput: PlannerOutput | null | undefined,
  platform: PublisherPlatform,
): PlannerItem | null {
  if (!plannerOutput?.items.length) {
    return null;
  }

  return (
    plannerOutput.items.find(
      (item) => normalizePlannerItemChannel(item.channel) === platform,
    ) ??
    plannerOutput.items[0] ??
    null
  );
}

export function resolvePlatformMediaPrompts(params: {
  platformSocialOutput?: SocialOutput | null;
  defaultAssetPrompt: string;
  defaultVideoPrompt: string;
}) {
  return {
    assetPrompt:
      params.platformSocialOutput?.imagePrompt ?? params.defaultAssetPrompt,
    videoPrompt:
      params.platformSocialOutput?.videoPrompt ?? params.defaultVideoPrompt,
  };
}

function isNarratedReelCandidate(asset: MediaAsset): boolean {
  return asset.kind === "reel" && asset.status === "generated";
}

function buildSharedTikTokFinalAsset(params: {
  bundleId: string;
  sourceAsset: MediaAsset;
}): MediaAsset {
  const now = new Date().toISOString();

  return {
    ...params.sourceAsset,
    id: `${params.bundleId}-tiktok-reel`,
    platform: "tiktok",
    title: "TikTok reel",
    variant: "shared-final-reel",
    updatedAt: now,
  };
}

function ensureTikTokFinalAsset(params: {
  bundleId: string;
  campaignPlatforms: string[];
  assets: MediaAsset[];
}): MediaAsset[] {
  if (!supportsTikTok(params.campaignPlatforms)) {
    return params.assets;
  }

  const hasTikTokFinalAsset = params.assets.some(
    (asset) =>
      asset.platform === "tiktok" &&
      asset.kind === "reel" &&
      asset.status === "generated",
  );

  if (hasTikTokFinalAsset) {
    return params.assets;
  }

  const sharedSourceAsset =
    params.assets.find(
      (asset) =>
        asset.platform === "instagram" &&
        asset.kind === "reel" &&
        asset.status === "generated" &&
        asset.metadata?.hasMuxedNarration === true,
    ) ?? null;

  if (!sharedSourceAsset) {
    return params.assets;
  }

  return [
    ...params.assets,
    buildSharedTikTokFinalAsset({
      bundleId: params.bundleId,
      sourceAsset: sharedSourceAsset,
    }),
  ];
}

function appendAssetWarning(asset: MediaAsset, warning: string): MediaAsset {
  return {
    ...asset,
    warnings: [...(asset.warnings ?? []), warning],
    updatedAt: new Date().toISOString(),
  };
}

function markNarrationFailedAsset(
  asset: MediaAsset,
  warning: string,
): MediaAsset {
  return {
    ...asset,
    status: "failed",
    warnings: [
      ...(asset.warnings ?? []).filter(
        (entry) => entry !== "Media asset has not been generated yet.",
      ),
      `Narration échouée / vidéo non prête. ${warning}`,
    ],
    updatedAt: new Date().toISOString(),
  };
}

function buildMediaBinaryFromInternalBinary(params: {
  asset: MediaAsset;
  provider: MediaBinary["provider"];
  internalBinary: MediaInternalBinary;
}): MediaBinary {
  return {
    id: params.asset.id,
    kind: params.asset.kind as MediaBinary["kind"],
    provider: params.provider,
    mimeType: params.internalBinary.mimeType,
    extension: params.internalBinary.extension,
    filename: params.internalBinary.filename,
    encoding: "base64",
    base64: params.internalBinary.base64,
    buffer: null,
    sourceUrl: null,
    sizeBytes: Buffer.from(params.internalBinary.base64, "base64").byteLength,
    createdAt: new Date().toISOString(),
  };
}

export async function runMarketingStudioOrchestratorV2(
  input: MarketingStudioOrchestratorV2Input,
): Promise<MarketingStudioOrchestratorV2Result> {
  const [
    { buildMarketingBrainBrief },
    { runContentPlanner, parsePlannerOutput },
    { runCommunityDiscovery, parseCommunityDiscoveryOutput },
    { runCreativeDirector, parseCreativeOutput },
    { runLocalization, parseLocalizationOutput },
    { runPublisher, parsePublisherOutput },
    { runSocialContent, parseSocialOutput },
    { runVideoScript, parseVideoOutput },
    { buildMediaAssets },
    { runMediaEngine },
    { buildMediaAssetRequestsFromBundle },
    {
      runNarratedVideoAssembly,
      falKokoroFrenchNarrationProvider,
      ffmpegMediaMuxer,
      uploadMediaBinaryForAsset,
      supabaseMediaStorageAdapter,
      isSupabaseMediaStorageEnabled,
    },
  ] = await Promise.all([
    import("../agents/marketingBrain"),
    import("../agents/contentPlanner"),
    import("../agents/communityDiscovery"),
    import("../agents/creativeDirector"),
    import("../agents/localization"),
    import("../agents/publisher"),
    import("../agents/socialContent"),
    import("../agents/videoScript"),
    import("../media/mediaAssetBuilder"),
    import("../media/mediaEngine"),
    import("../media/mediaAssetRequestBuilder"),
    import("../media"),
  ]);
  const campaignObjectiveSource = input.objective.trim() || "awareness";
  const durationDays =
    typeof input.durationDays === "number" && Number.isFinite(input.durationDays)
      ? Math.max(1, Math.trunc(input.durationDays))
      : 7;
  const campaign = createDefaultMarketingCampaign({
    name: input.name?.trim() || "Campagne Norixo V2",
    objective: campaignObjectiveSource,
    audience: input.audience ?? "Hôtes et conciergeries",
    tone: input.tone?.trim() || "professional",
    cta: input.cta?.trim() || "Découvrir Norixo.io",
    websiteUrl: "https://norixo.io",
    language: input.language ?? "fr",
    platforms: input.channels ?? ["facebook", "instagram"],
    formats: ["post", "reel"],
    durationDays,
    hashtags: ["#Norixo"],
    status: "draft",
  });
  const campaignMemory = createCampaignMemoryFromCampaign(campaign);
  const timeframe = `${campaign.durationDays} jours`;
  const brief = buildMarketingBrainBrief({
    objective: campaignObjectiveSource,
    audience: campaign.audience,
    language: campaign.language,
    timeframe,
    channels: campaign.platforms,
    context:
      "Norixo Optimize helps short-term rental hosts and conciergeries identify listing friction points, clarify priorities, and prepare realistic improvement actions before publication.",
  });

  const planner = await runContentPlanner({
    brief,
    channels: campaign.platforms,
    timeframe,
    objective: campaignObjectiveSource,
    language: campaign.language,
    context: [
      "Marketing Studio Orchestrator V2 isolated planner run.",
      "Keep the user-provided campaign objective as the product source of truth.",
      "Do not rely on downloads, lead magnets or external assets.",
    ].join(" "),
  });

  const plannerOutput =
    planner.output
      ?.replace(/Téléchargez/gi, "Consultez")
      .replace(/performances/gi, "résultats")
      .replace(/performance/gi, "résultat") ?? planner.output;
  const plannerError =
    planner.error &&
    (planner.error.includes("Téléchargez") || planner.error.includes("performances"))
      ? null
      : planner.error;
  const plannerResult = {
    ...planner,
    output: plannerOutput,
    error: plannerError,
  };

  const parsedPlannerOutput = parsePlannerOutput(plannerResult.output);
  const activePublisherPlatforms = PUBLISHER_PLATFORMS.filter((platform) =>
    campaign.platforms.includes(platform),
  );
  const socialEntries = parsedPlannerOutput && !plannerResult.error
    ? await Promise.all(
        activePublisherPlatforms.map(async (platform) => {
          const plannerItem = resolvePlannerItemForPlatform(
            parsedPlannerOutput,
            platform,
          );
          const socialResult = await runSocialContent({
            brief,
            planning: parsedPlannerOutput,
            targetPlatform: platform,
            channel: platform,
            format: plannerItem?.format ?? "post",
            topic: plannerItem?.topic ?? campaign.name,
            goal: plannerItem?.goal ?? campaignObjectiveSource,
            angle: plannerItem?.angle,
            audience: campaign.audience,
            cta: plannerItem?.cta ?? campaign.cta,
            language: campaign.language,
            context: [
              "Marketing Studio Orchestrator V2 isolated social run.",
              `Campaign objective (source of truth): ${campaignObjectiveSource}`,
              "The user-provided campaign objective remains authoritative even if the planner simplifies or reframes the angle.",
              "Do not invent unsupported business benefits, bookings, revenue, ranking, visibility, conversion or performance outcomes.",
            ].join(" "),
          });

          return [
            platform,
            {
              result: socialResult,
              output: parseSocialOutput(socialResult.output),
            },
          ] as const;
        }),
      )
    : [];
  const socialByPlatform = Object.fromEntries(socialEntries) as Partial<
    Record<
      PublisherPlatform,
      {
        result: Awaited<ReturnType<typeof runSocialContent>>;
        output: ReturnType<typeof parseSocialOutput>;
      }
    >
  >;
  const anchorSocialPlatform =
    (activePublisherPlatforms.includes("facebook")
      ? "facebook"
      : activePublisherPlatforms[0]) ?? null;
  const social = anchorSocialPlatform
    ? (socialByPlatform[anchorSocialPlatform]?.result ?? null)
    : null;
  const socialOutput = anchorSocialPlatform
    ? (socialByPlatform[anchorSocialPlatform]?.output ?? null)
    : null;
  const creative =
    parsedPlannerOutput && socialOutput
      ? await runCreativeDirector({
          campaign,
          campaignMemory,
          planning: parsedPlannerOutput,
          social: socialOutput,
          contentTitle: socialOutput.title,
          hook: socialOutput.hook,
          channel: resolveCreativeChannel(socialOutput.targetPlatform),
          format: parsedPlannerOutput.items[0]?.format ?? "post",
          visualGoal: `Create a premium visual direction for ${campaign.name} while preserving the specific Norixo capability or product action described in this campaign objective: ${campaignObjectiveSource}.`,
          brandContext: [
            `Campaign objective (source of truth): ${campaignObjectiveSource}.`,
            "Preserve the specific Norixo capability or action described in that objective.",
            "Social output is creative support only and must not replace the product source of truth.",
            "Norixo.io is a modern SaaS for short-term rental hosts and conciergeries. Visual identity: clean, premium, professional, trustworthy, with blue/cyan accents used as secondary brand cues rather than the main visual subject.",
          ].join(" "),
          language: campaign.language,
        })
      : null;
  const creativeOutput = parseCreativeOutput(creative?.output);
  const video =
    parsedPlannerOutput && socialOutput && creativeOutput
      ? await runVideoScript({
          campaign,
          campaignMemory,
          planning: parsedPlannerOutput,
          social: socialOutput,
          creative: creativeOutput,
          title: socialOutput.title,
          hook: socialOutput.hook,
          topic: campaignObjectiveSource,
          audience: campaign.audience,
          cta: socialOutput.cta,
          language: campaign.language,
          duration: "30 secondes",
          format: "reel",
          context: [
            `Create a Norixo video for ${campaign.name}.`,
            `Campaign objective (source of truth): ${campaignObjectiveSource}.`,
            `Secondary social angle: ${socialOutput.videoPrompt}.`,
            "Keep the campaign objective as the priority for the hook, scenes, on-screen text and voice-over.",
            "Use the social video prompt only as supporting creative inspiration.",
          ].join(" "),
        })
      : null;
  const videoOutput = parseVideoOutput(video?.output);
  const localizationEntries = await Promise.all(
    LOCALIZATION_TARGETS.map(async ({ language, country }) => {
      const localization =
        parsedPlannerOutput &&
        socialOutput &&
        creativeOutput &&
        videoOutput
          ? await runLocalization({
              sourcePackId: campaign.id,
              title: socialOutput.title,
              caption: socialOutput.caption,
              cta: socialOutput.cta,
              hashtags: socialOutput.hashtags,
              targetCountry: country,
              targetLanguage: language,
              targetPlatform: socialOutput.targetPlatform,
              targetCommunityType: "hosts_and_conciergeries",
              tone: "professional",
              length: "medium",
              emojiStyle: "light",
              notes: [
                `Campaign: ${campaign.name}. Objective: ${campaignObjectiveSource}. Audience: ${campaign.audience}.`,
                `Campaign memory formats: ${campaignMemory.usedFormats.join(", ")}.`,
                `Planner topic: ${parsedPlannerOutput.items[0]?.topic ?? campaign.name}.`,
                `Creative concept: ${creativeOutput.creativeConcept}.`,
                `Video title: ${videoOutput.videoTitle}. Video caption: ${videoOutput.caption}.`,
              ].join(" "),
            })
          : null;

      return [language, localization] as const;
    }),
  );
  const localization = Object.fromEntries(localizationEntries);
  const localizationOutput = Object.fromEntries(
    localizationEntries.flatMap(([language, result]) => {
      const parsedOutput = parseLocalizationOutput(result?.output);

      return parsedOutput ? [[language, parsedOutput.localization] as const] : [];
    }),
  );
  const communityDiscovery =
    parsedPlannerOutput &&
    socialOutput &&
    creativeOutput &&
    videoOutput
      ? await runCommunityDiscovery({
          country: resolveCommunityDiscoveryCountry(campaign.language),
          language: campaign.language,
          audience: campaign.audience,
          platforms: campaign.platforms,
          communityTypes: [
            "airbnb_hosts",
            "short_term_rental",
            "property_management",
            "concierge",
          ],
          notes: [
            `Campaign: ${campaign.name}. Objective: ${campaign.objective}.`,
            `Planner topic: ${parsedPlannerOutput.items[0]?.topic ?? campaign.name}.`,
            `Social title: ${socialOutput.title}.`,
            `Creative concept: ${creativeOutput.creativeConcept}.`,
            `Video title: ${videoOutput.videoTitle}.`,
          ].join(" "),
        })
      : null;
  const communityDiscoveryOutput = parseCommunityDiscoveryOutput(
    communityDiscovery?.output,
  );
  const reviewSummaryParts = [
    campaign.name,
    parsedPlannerOutput ? "planner ready" : "planner missing",
    socialOutput ? "social ready" : "social missing",
    creativeOutput ? "creative ready" : "creative missing",
    videoOutput ? "video ready" : "video missing",
    Object.keys(localizationOutput).length > 0
      ? "localization ready"
      : "localization missing",
    communityDiscoveryOutput?.communities.length
      ? "community discovery ready"
      : "community discovery missing",
  ];
  const publisherLocalizedVariants = Object.fromEntries(
    Object.entries(localizationOutput).map(([language, localization]) => [
      language,
      {
        title: localization.adaptedTitle,
        caption: localization.adaptedCaption,
        cta: localization.adaptedCta,
        hashtags: localization.adaptedHashtags,
      },
    ]),
  );
  const defaultAssetPrompt =
    creativeOutput?.gptImagePrompt ??
    socialOutput?.imagePrompt ??
    "Manual asset review required.";
  const defaultVideoPrompt =
    videoOutput?.caption
      ? `${socialOutput?.videoPrompt ?? ""} ${videoOutput.caption}`.trim()
      : socialOutput?.videoPrompt ?? "";
  const publisherEntries = await Promise.all(
    PUBLISHER_PLATFORMS.map(async (platform) => {
      const platformPlannerItem = resolvePlannerItemForPlatform(
        parsedPlannerOutput,
        platform,
      );
      const platformSocialOutput = socialByPlatform[platform]?.output ?? null;
      const platformMediaPrompts = resolvePlatformMediaPrompts({
        platformSocialOutput,
        defaultAssetPrompt,
        defaultVideoPrompt,
      });
      const platformAssetReferences = buildMissingAssetReferences(
        platformMediaPrompts.assetPrompt,
        platformMediaPrompts.videoPrompt,
      );
      const publicationPack = createPublicationPack({
        campaignId: campaign.id,
        platform,
        format: platformPlannerItem?.format ?? parsedPlannerOutput?.items[0]?.format ?? "post",
        language: campaign.language,
        status: "draft",
          title: platformSocialOutput?.title ?? campaign.name,
          hook: platformSocialOutput?.hook,
          caption: platformSocialOutput?.caption ?? campaign.objective,
        cta: platformSocialOutput?.cta ?? campaign.cta,
        hashtags: platformSocialOutput?.hashtags ?? campaign.hashtags,
        visualBrief: creativeOutput?.creativeConcept,
        imagePrompt: platformMediaPrompts.assetPrompt,
        videoPrompt: platformMediaPrompts.videoPrompt,
        assetReferences: platformAssetReferences,
        approvalRequired: true,
        notes: [
          `Campaign: ${campaign.name}.`,
          `Audience: ${campaign.audience}.`,
          `Platform draft: ${platform}.`,
        ].join(" "),
        sourceStage: "marketing_studio_orchestrator_v2",
        communityTarget:
          communityDiscoveryOutput?.communities[0]?.audience ?? campaign.audience,
        qualitySummary: reviewSummaryParts.join(" | "),
      });
      const publisherResult =
        platformSocialOutput
          ? await runPublisher({
              pack: publicationPack,
            })
          : null;
      const publisherOutput = parsePublisherOutput(publisherResult?.output);
      const draftCaption =
        publisherOutput?.finalCaption ??
        platformSocialOutput?.caption ??
        campaign.objective;
      const draftHashtags =
        publisherOutput?.finalHashtags ??
        platformSocialOutput?.hashtags ??
        campaign.hashtags;

      return [
        platform,
        {
          platform,
          status: "draft" as const,
          copy:
            publisherOutput?.finalCaption ??
            buildPublisherCopy(
              platform,
              campaign.name,
              platformSocialOutput?.title ?? campaign.name,
              platformSocialOutput?.caption ?? campaign.objective,
            ),
          caption: draftCaption,
          hashtags: draftHashtags,
          assetPrompt: platformMediaPrompts.assetPrompt,
          videoPrompt: platformMediaPrompts.videoPrompt,
          assetReferences: platformAssetReferences,
          localizedVariants: publisherLocalizedVariants,
          publisherOutput: publisherOutput ?? undefined,
          approvalRequired: true as const,
          publishAction: "manual_review_required" as const,
          publishProvider:
            platform === "facebook"
              ? "meta"
              : platform === "linkedin"
                ? "linkedin"
                : platform === "tiktok"
                  ? "tiktok"
                  : undefined,
        },
      ] as const;
    }),
  );
  const publisherChannels = Object.fromEntries(
    publisherEntries,
  ) as NonNullable<MarketingCampaignBundle["publisher"]>["channels"];

  const bundleDraftInput: CreateMarketingCampaignBundleInput = {
    campaign,
    campaignMemory,
    planning: parsedPlannerOutput ?? undefined,
    social: socialOutput ?? undefined,
    creative: creativeOutput
      ? {
          creativeConcept: creativeOutput.creativeConcept,
          visualStyle: creativeOutput.visualStyle,
          layout: creativeOutput.layout,
          overlays: [
            creativeOutput.mainTextOverlay,
            creativeOutput.secondaryTextOverlay,
          ].filter((value) => value.trim().length > 0),
          imagePrompt: creativeOutput.gptImagePrompt,
          negativePrompt: creativeOutput.negativePrompt,
          videoPrompt: socialOutput?.videoPrompt ?? "",
          brandChecklist: creativeOutput.brandChecklist,
        }
      : undefined,
    video: videoOutput
      ? {
          storyboard: videoOutput.scenes
            .map(
              (scene) =>
                `Scene ${scene.scene}: ${scene.visual} | ${scene.onScreenText}`,
            )
            .join("\n"),
          script: videoOutput.voiceOver,
          timeline: videoOutput.scenes
            .map(
              (scene) =>
                `Scene ${scene.scene}: ${scene.duration} | ${scene.transition}`,
            )
            .join("\n"),
          scenes: videoOutput.scenes,
          voice: videoOutput.voiceOver,
          transitions: videoOutput.scenes.map((scene) => scene.transition),
          captions: videoOutput.caption,
          videoPrompt: socialOutput?.videoPrompt ?? "",
        }
      : undefined,
    localization:
      Object.keys(localizationOutput).length > 0 ? localizationOutput : undefined,
    communityDiscovery: communityDiscoveryOutput
      ? {
          communities: communityDiscoveryOutput.communities,
          warnings: communityDiscoveryOutput.warnings,
        }
      : undefined,
    review: {
      status: "ready_for_review",
      approvalRequired: true,
      summary: reviewSummaryParts.join(" | "),
      notes: [
        "Campaign bundle assembled for manual review.",
        "No auto-publication is enabled.",
      ],
      updatedAt: new Date().toISOString(),
    },
    approval: {
      status: "pending_review",
      requiredApprover: "Mohamed",
      requiresHumanValidation: true,
      approvedAt: null,
      approvedBy: null,
      publisherReady: false,
      notes: [
        "Human approval is required before any publishing step.",
        "No automatic publication is enabled.",
      ],
    },
    publisher: {
      mode: "draft_only",
      canPublish: false,
      requiresApproval: true,
      channels: publisherChannels,
    },
    notes: [
      "Marketing Studio Orchestrator V2 draft bundle.",
      plannerResult.error ? "Planner returned an error." : "Planner completed.",
      social?.error ? "Social returned an error." : social ? "Social completed." : "Social skipped.",
      creative?.error
        ? "Creative returned an error."
        : creative
        ? "Creative completed."
        : "Creative skipped.",
      video?.error
        ? "Video returned an error."
        : video
          ? "Video completed."
          : "Video skipped.",
      Object.values(localization).some(
        (result) => result && result.error,
      )
        ? "Localization returned an error."
        : Object.values(localization).some(Boolean)
          ? "Localization completed."
          : "Localization skipped.",
      communityDiscovery?.error
        ? "Community discovery returned an error."
        : communityDiscovery
          ? "Community discovery completed."
          : "Community discovery skipped.",
      publisherEntries.some(([, draft]) => draft.publisherOutput)
        ? "Publisher completed."
        : "Publisher skipped.",
    ],
  };
  const bundleDraft = buildMarketingCampaignBundle(bundleDraftInput);
  const mediaRequests = buildMediaAssetRequestsFromBundle(bundleDraft);
  const mediaAssets = buildMediaAssets(mediaRequests);
  const mediaEngineResult = await runMediaEngine({
    requests: mediaRequests,
    assets: mediaAssets,
  });
  const mediaAssetsById = new Map(
    mediaEngineResult.assets.map((asset) => [asset.id, asset]),
  );

  for (const asset of mediaEngineResult.assets.filter(isNarratedReelCandidate)) {
    const matchingJob = mediaEngineResult.executedJobs.find(
      (job) => job.request.id === asset.id,
    );
    const sourceVideoBinary = matchingJob?.result?.internalBinary ?? null;
    const narrationPipeline = await runNarratedVideoAssembly({
      bundle: bundleDraft,
      videoAsset: asset,
      sourceVideoBinary,
      narrationProvider: falKokoroFrenchNarrationProvider,
      muxer: ffmpegMediaMuxer,
    });

    if (
      narrationPipeline.muxResult?.status === "generated" &&
      narrationPipeline.finalAsset &&
      narrationPipeline.muxResult.internalBinary
    ) {
      let finalAsset = narrationPipeline.finalAsset;

      if (isSupabaseMediaStorageEnabled()) {
        try {
          const finalBinary = buildMediaBinaryFromInternalBinary({
            asset: finalAsset,
            provider: "ffmpeg",
            internalBinary: narrationPipeline.muxResult.internalBinary,
          });
          const uploadResult = await uploadMediaBinaryForAsset({
            binary: finalBinary,
            asset: finalAsset,
            storage: supabaseMediaStorageAdapter,
          });
          finalAsset = uploadResult.asset;
        } catch (error) {
          mediaAssetsById.set(
            asset.id,
            appendAssetWarning(
              asset,
              error instanceof Error
                ? `Narration mux upload failed: ${error.message}`
                : "Narration mux upload failed.",
            ),
          );
          continue;
        }
      }

      mediaAssetsById.set(asset.id, finalAsset);
      continue;
    }

    const failureReason =
      narrationPipeline.muxResult?.error ??
      narrationPipeline.narrationResult?.error ??
      "Narrated video assembly failed.";

    mediaAssetsById.set(asset.id, markNarrationFailedAsset(asset, failureReason));
  }

  const finalMediaAssets = ensureTikTokFinalAsset({
    bundleId: bundleDraft.id,
    campaignPlatforms: bundleDraft.campaign.platforms,
    assets: mediaEngineResult.assets.map(
      (asset) => mediaAssetsById.get(asset.id) ?? asset,
    ),
  });
  const bundle = buildMarketingCampaignBundle({
    ...bundleDraftInput,
    id: bundleDraft.id,
    createdAt: bundleDraft.createdAt,
    media: {
      configuration: mediaEngineResult.configuration,
      requests: mediaRequests,
      assets: finalMediaAssets,
    },
  });

  return {
    planner: plannerResult,
    social,
    creative,
    video,
    localization,
    bundle,
    approvalRequired: true,
  };
}
