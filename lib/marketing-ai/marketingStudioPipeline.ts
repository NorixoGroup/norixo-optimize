import {
  buildMarketingBrainBrief,
  runMarketingBrain,
} from "./agents/marketingBrain";
import {
  parsePlannerOutput,
  runContentPlanner,
} from "./agents/contentPlanner";
import {
  parseSocialOutput,
  runSocialContent,
} from "./agents/socialContent";
import {
  parseCreativeOutput,
  runCreativeDirector,
} from "./agents/creativeDirector";
import {
  parseVideoOutput,
  runVideoScript,
} from "./agents/videoScript";
import {
  createDefaultMarketingCampaign,
} from "./campaigns/campaignModel";
import {
  addCampaignGeneratedVariant,
  addCampaignMemoryWarning,
  createCampaignMemoryFromCampaign,
} from "./campaigns/campaignMemory";
import {
  addQualityImprovement,
  addQualityIssue,
  addQualityWarning,
  createEmptyQualityGateResult,
} from "./quality/qualityGate";
import { applyPlannerPipelineQuality } from "./pipeline/plannerPipelineQuality";
import type {
  MarketingCampaign,
  MarketingCampaignFormat,
  MarketingCampaignPlatform,
} from "./campaigns/campaignModel";
import type {
  CreativeInput,
  CreativeOutput,
  MarketingBrainBrief,
  PlannerInput,
  PlannerOutput,
  SocialInput,
  SocialOutput,
  VideoInput,
  VideoOutput,
} from "./contracts/agentContracts";

export type MarketingStudioPipelineInput = {
  name?: string;
  objective: string;
  language: string;
  audience?: string;
  timeframe?: string;
  channels?: string[];
};

function resolveCampaignDurationDays(timeframe: string): number {
  const normalizedTimeframe = timeframe.trim().toLowerCase();

  if (normalizedTimeframe === "7 jours") {
    return 7;
  }

  if (normalizedTimeframe === "14 jours") {
    return 14;
  }

  if (normalizedTimeframe === "30 jours") {
    return 30;
  }

  return 7;
}

function resolveCampaignPlatforms(
  channels: string[],
): MarketingCampaignPlatform[] {
  const platforms = channels
    .map((channel) => channel.trim().toLowerCase())
    .flatMap((channel): MarketingCampaignPlatform[] => {
      if (channel === "instagram") {
        return ["instagram"];
      }

      if (channel === "facebook") {
        return ["facebook"];
      }

      if (channel === "linkedin") {
        return ["linkedin"];
      }

      return [];
    });

  return platforms.length ? Array.from(new Set(platforms)) : ["instagram"];
}

function resolveMemoryPlatform(
  value: string | null | undefined,
): MarketingCampaignPlatform | null {
  const normalizedValue = value?.trim().toLowerCase();

  if (
    normalizedValue === "instagram" ||
    normalizedValue === "facebook" ||
    normalizedValue === "linkedin"
  ) {
    return normalizedValue;
  }

  return null;
}

function resolveMemoryFormat(
  value: string | null | undefined,
): MarketingCampaignFormat | null {
  const normalizedValue = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (
    normalizedValue === "post" ||
    normalizedValue === "carousel" ||
    normalizedValue === "reel" ||
    normalizedValue === "story" ||
    normalizedValue === "short_video"
  ) {
    return normalizedValue;
  }

  return null;
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

export async function runMarketingStudioPipeline(input: MarketingStudioPipelineInput) {
  const audience =
    input.audience ?? "Conciergeries et hôtes professionnels";
  const timeframe = input.timeframe ?? "7 jours";
  const channels = input.channels ?? ["Instagram", "Facebook", "LinkedIn", "SEO"];
  const context =
    "Norixo Optimize aide les hôtes et conciergeries à identifier les points de friction d'une annonce et à clarifier les priorités d'amélioration.";
  const brief: MarketingBrainBrief = buildMarketingBrainBrief({
    objective: input.objective,
    audience,
    language: input.language,
    timeframe,
    channels,
    context,
  });
  const plannerInput: PlannerInput = {
    brief,
    channels,
    timeframe,
    language: input.language,
  };
  const campaign: MarketingCampaign = createDefaultMarketingCampaign({
    name: input.name?.trim() || "Campagne Norixo",
    objective: input.objective,
    audience,
    tone: brief.tone,
    cta: "Découvrir Norixo.io",
    websiteUrl: "https://norixo.io",
    language: input.language,
    platforms: resolveCampaignPlatforms(channels),
    formats: ["carousel", "reel"],
    durationDays: resolveCampaignDurationDays(timeframe),
    hashtags: [],
    status: "draft",
  });
  let campaignMemory = createCampaignMemoryFromCampaign(campaign);
  let qualityGate = createEmptyQualityGateResult();

  const brain = await runMarketingBrain({
    objective: input.objective,
    audience,
    language: input.language,
    timeframe,
    channels,
    context,
  });

  const brainContext =
    typeof brain.output === "string" && brain.output.trim()
      ? brain.output.trim()
      : "Brief stratégique Norixo non disponible.";

  const planner = await runContentPlanner({
    ...plannerInput,
    marketingBrief: brainContext,
    objective: input.objective,
    context,
  });
  const plannerOutput: PlannerOutput | null = parsePlannerOutput(planner.output);
  ({ campaignMemory, qualityGate } = applyPlannerPipelineQuality({
    plannerOutput,
    campaignMemory,
    qualityGate,
  }));
  const targetPlatform = "instagram";
  const socialInput: SocialInput | null = plannerOutput
    ? {
        brief,
        planning: plannerOutput,
        language: input.language,
        targetPlatform,
      }
    : null;

  const social = await runSocialContent({
    ...(socialInput ?? {}),
    channel: "instagram",
    format: "carousel",
    topic: "Identifier les points de friction d'une annonce",
    goal: "awareness",
    audience,
    cta: "Découvrir Norixo.io",
    language: input.language,
  });
  const socialOutput: SocialOutput | null = parseSocialOutput(social.output);
  if (socialOutput) {
    const socialPlatform = resolveMemoryPlatform(socialOutput.targetPlatform);

    campaignMemory = addCampaignGeneratedVariant(campaignMemory, {
      id: `social-${new Date().toISOString()}`,
      source: "social",
      platform: socialPlatform ?? undefined,
      topic: socialOutput.title,
      contentRef: socialOutput.hook,
      createdAt: new Date().toISOString(),
    });

    if (isBlank(socialOutput.caption)) {
      qualityGate = addQualityIssue(qualityGate, {
        type: "clarity",
        severity: "error",
        message: "Social output contains an empty caption.",
        scoreImpact: 20,
      });
    }

    if (isBlank(socialOutput.hook)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Social output contains an empty hook.",
      });
    }

    if (isBlank(socialOutput.cta)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "cta",
        message: "Social output contains an empty CTA.",
      });
    }

    if (socialOutput.hashtags.length === 0) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "platform_fit",
        message: "Social output contains no hashtags.",
      });
    }

    if (isBlank(socialOutput.imagePrompt)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Social output contains an empty image prompt.",
      });
    }

    if (isBlank(socialOutput.videoPrompt)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Social output contains an empty video prompt.",
      });
    }

    if (socialOutput.approvalChecklist.length === 0) {
      qualityGate = addQualityImprovement(qualityGate, {
        type: "compliance",
        message: "Social output could include an approval checklist.",
      });
    }
  } else {
    campaignMemory = addCampaignMemoryWarning(campaignMemory, {
      code: "social_output_unparsed",
      message: "Social output could not be parsed.",
      severity: "warning",
      createdAt: new Date().toISOString(),
    });
    qualityGate = addQualityIssue(qualityGate, {
      type: "clarity",
      severity: "error",
      message: "Social output could not be parsed.",
      scoreImpact: 20,
    });
  }
  const creativeInput: CreativeInput | null =
    plannerOutput && socialOutput
      ? {
          brief,
          planning: plannerOutput,
          social: socialOutput,
          language: input.language,
        }
      : null;

  const creative = await runCreativeDirector({
    ...(creativeInput ?? {}),
    contentTitle: "Identifier les points de friction d'une annonce",
    hook: "Voir plus clairement ce qui peut freiner une annonce",
    channel: "instagram",
    format: "carousel",
    visualGoal:
      "Créer une direction visuelle premium pour un carrousel Instagram Norixo.io",
    language: input.language,
  });
  const creativeOutput: CreativeOutput | null = parseCreativeOutput(
    creative.output,
  );
  if (creativeOutput) {
    const creativeFormat = resolveMemoryFormat(creativeOutput.assetFormat);

    campaignMemory = addCampaignGeneratedVariant(campaignMemory, {
      id: `creative-${new Date().toISOString()}`,
      source: "creative",
      format: creativeFormat ?? undefined,
      topic: creativeOutput.mainTextOverlay || creativeOutput.creativeConcept,
      contentRef: creativeOutput.creativeConcept,
      createdAt: new Date().toISOString(),
    });

    if (isBlank(creativeOutput.gptImagePrompt)) {
      qualityGate = addQualityIssue(qualityGate, {
        type: "clarity",
        severity: "error",
        message: "Creative output contains an empty GPT image prompt.",
        scoreImpact: 20,
      });
    }

    if (isBlank(creativeOutput.creativeConcept)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Creative output contains an empty creative concept.",
      });
    }

    if (isBlank(creativeOutput.mainTextOverlay)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Creative output contains an empty main text overlay.",
      });
    }

    if (isBlank(creativeOutput.secondaryTextOverlay)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Creative output contains an empty secondary text overlay.",
      });
    }

    if (isBlank(creativeOutput.assetFormat)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "platform_fit",
        message: "Creative output contains an empty asset format.",
      });
    }

    if (creativeOutput.brandChecklist.length === 0) {
      qualityGate = addQualityImprovement(qualityGate, {
        type: "compliance",
        message: "Creative output could include a brand checklist.",
      });
    }
  } else {
    campaignMemory = addCampaignMemoryWarning(campaignMemory, {
      code: "creative_output_unparsed",
      message: "Creative output could not be parsed.",
      severity: "warning",
      createdAt: new Date().toISOString(),
    });
    qualityGate = addQualityIssue(qualityGate, {
      type: "clarity",
      severity: "error",
      message: "Creative output could not be parsed.",
      scoreImpact: 20,
    });
  }
  const videoDuration = "30 secondes";
  const videoFormat = "reel";
  const videoInput: VideoInput | null =
    plannerOutput && socialOutput && creativeOutput
      ? {
          brief,
          planning: plannerOutput,
          social: socialOutput,
          creative: creativeOutput,
          language: input.language,
          duration: videoDuration,
          format: videoFormat,
        }
      : null;

  const video = await runVideoScript({
    ...(videoInput ?? {}),
    title: "Voir plus clairement ce qui peut freiner une annonce",
    hook: "Et si vous pouviez identifier vos priorités plus facilement ?",
    topic:
      "Présenter Norixo Optimize comme outil pour identifier les points de friction et clarifier les priorités",
    audience,
    cta: "Découvrir Norixo.io",
    language: input.language,
    duration: videoDuration,
    format: videoFormat,
  });
  const videoOutput: VideoOutput | null = parseVideoOutput(video.output);
  if (videoOutput) {
    const resolvedVideoFormat = resolveMemoryFormat(videoOutput.format);

    campaignMemory = addCampaignGeneratedVariant(campaignMemory, {
      id: `video-${new Date().toISOString()}`,
      source: "video",
      format: resolvedVideoFormat ?? undefined,
      topic: videoOutput.videoTitle || videoOutput.hook,
      contentRef: videoOutput.hook,
      createdAt: new Date().toISOString(),
    });

    if (videoOutput.scenes.length === 0) {
      qualityGate = addQualityIssue(qualityGate, {
        type: "clarity",
        severity: "error",
        message: "Video output contains no scenes.",
        scoreImpact: 20,
      });
    }

    if (isBlank(videoOutput.videoTitle)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Video output contains an empty title.",
      });
    }

    if (isBlank(videoOutput.hook)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Video output contains an empty hook.",
      });
    }

    if (isBlank(videoOutput.cta)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "cta",
        message: "Video output contains an empty CTA.",
      });
    }

    if (isBlank(videoOutput.caption)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Video output contains an empty caption.",
      });
    }

    if (
      videoOutput.scenes.some(
        (scene) =>
          isBlank(scene.visual) ||
          isBlank(scene.onScreenText) ||
          isBlank(scene.voiceOver),
      )
    ) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Video output contains incomplete scene details.",
      });
    }

    if (videoOutput.assetChecklist.length === 0) {
      qualityGate = addQualityImprovement(qualityGate, {
        type: "compliance",
        message: "Video output could include an asset checklist.",
      });
    }
  } else {
    campaignMemory = addCampaignMemoryWarning(campaignMemory, {
      code: "video_output_unparsed",
      message: "Video output could not be parsed.",
      severity: "warning",
      createdAt: new Date().toISOString(),
    });
    qualityGate = addQualityIssue(qualityGate, {
      type: "clarity",
      severity: "error",
      message: "Video output could not be parsed.",
      scoreImpact: 20,
    });
  }
  void campaignMemory;
  void qualityGate;

  return {
    brain,
    planner,
    social,
    creative,
    video,
  };
}
