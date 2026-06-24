import { runContentPlanner, parsePlannerOutput } from "../agents/contentPlanner";
import {
  runCommunityDiscovery,
  parseCommunityDiscoveryOutput,
} from "../agents/communityDiscovery";
import { runCreativeDirector, parseCreativeOutput } from "../agents/creativeDirector";
import {
  runLocalization,
  parseLocalizationOutput,
} from "../agents/localization";
import { runSocialContent, parseSocialOutput } from "../agents/socialContent";
import { runVideoScript, parseVideoOutput } from "../agents/videoScript";
import {
  buildMarketingCampaignBundle,
  createCampaignMemoryFromCampaign,
  createDefaultMarketingCampaign,
} from "../index";
import type { MarketingCampaignBundle } from "../bundle/marketingCampaignBundle";

export type MarketingStudioOrchestratorV2Input = {
  name?: string;
  objective: string;
  audience?: string;
  language?: string;
  channels?: string[];
};

export type MarketingStudioOrchestratorV2Result = {
  planner: Awaited<ReturnType<typeof runContentPlanner>>;
  social: Awaited<ReturnType<typeof runSocialContent>> | null;
  creative: Awaited<ReturnType<typeof runCreativeDirector>> | null;
  video: Awaited<ReturnType<typeof runVideoScript>> | null;
  localization: Record<
    string,
    Awaited<ReturnType<typeof runLocalization>> | null
  >;
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
] as const;

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

export async function runMarketingStudioOrchestratorV2(
  input: MarketingStudioOrchestratorV2Input,
): Promise<MarketingStudioOrchestratorV2Result> {
  const campaign = createDefaultMarketingCampaign({
    name: input.name?.trim() || "Campagne Norixo V2",
    objective: input.objective,
    audience: input.audience ?? "Hôtes et conciergeries",
    tone: "professional",
    cta: "Découvrir Norixo.io",
    websiteUrl: "https://norixo.io",
    language: input.language ?? "fr",
    platforms: input.channels ?? ["facebook", "instagram"],
    formats: ["post", "reel"],
    durationDays: 7,
    hashtags: ["#Norixo"],
    status: "draft",
  });
  const campaignMemory = createCampaignMemoryFromCampaign(campaign);

  const planner = await runContentPlanner({
    marketingBrief: campaign.name,
    objective: `${campaign.objective} without downloads, lead magnets or external assets`,
    language: campaign.language,
    timeframe: `${campaign.durationDays} jours`,
    channels: campaign.platforms,
    context: "Marketing Studio Orchestrator V2 isolated planner run.",
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

  const social =
    parsedPlannerOutput && !plannerResult.error
      ? await runSocialContent({
          channel: "facebook",
          format: parsedPlannerOutput.items[0]?.format ?? "post",
          topic: parsedPlannerOutput.items[0]?.topic ?? campaign.name,
          goal: parsedPlannerOutput.items[0]?.goal ?? campaign.objective,
          audience: campaign.audience,
          cta: parsedPlannerOutput.items[0]?.cta ?? campaign.cta,
          language: campaign.language,
          context: "Marketing Studio Orchestrator V2 isolated social run.",
        })
      : null;
  const socialOutput = parseSocialOutput(social?.output);
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
          visualGoal: `Créer une direction visuelle premium pour ${campaign.name}.`,
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
          topic: socialOutput.videoPrompt,
          audience: campaign.audience,
          cta: socialOutput.cta,
          language: campaign.language,
          duration: "30 secondes",
          format: "reel",
          context: `Créer une video Norixo pour ${campaign.name}.`,
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
                `Campaign: ${campaign.name}. Objective: ${campaign.objective}. Audience: ${campaign.audience}.`,
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
  const publisherChannels = Object.fromEntries(
    PUBLISHER_PLATFORMS.map((platform) => [
      platform,
      {
        platform,
        status: "draft",
        copy: buildPublisherCopy(
          platform,
          campaign.name,
          socialOutput?.title ?? campaign.name,
          socialOutput?.caption ?? campaign.objective,
        ),
        caption: socialOutput?.caption ?? campaign.objective,
        hashtags: socialOutput?.hashtags ?? campaign.hashtags,
        assetPrompt: defaultAssetPrompt,
        videoPrompt: defaultVideoPrompt,
        localizedVariants: publisherLocalizedVariants,
        approvalRequired: true,
        publishAction: "manual_review_required",
      },
    ]),
  ) as {
    facebook: {
      platform: "facebook";
      status: "draft";
      copy: string;
      caption: string;
      hashtags: string[];
      assetPrompt: string;
      videoPrompt: string;
      localizedVariants: typeof publisherLocalizedVariants;
      approvalRequired: true;
      publishAction: "manual_review_required";
    };
    instagram: {
      platform: "instagram";
      status: "draft";
      copy: string;
      caption: string;
      hashtags: string[];
      assetPrompt: string;
      videoPrompt: string;
      localizedVariants: typeof publisherLocalizedVariants;
      approvalRequired: true;
      publishAction: "manual_review_required";
    };
    linkedin: {
      platform: "linkedin";
      status: "draft";
      copy: string;
      caption: string;
      hashtags: string[];
      assetPrompt: string;
      videoPrompt: string;
      localizedVariants: typeof publisherLocalizedVariants;
      approvalRequired: true;
      publishAction: "manual_review_required";
    };
  };

  const bundle = buildMarketingCampaignBundle({
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
    ],
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
