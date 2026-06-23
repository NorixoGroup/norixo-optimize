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
  createCampaignMemoryFromCampaign,
} from "./campaigns/campaignMemory";
import {
  createEmptyQualityGateResult,
} from "./quality/qualityGate";
import {
  resolveCampaignDurationDays,
  resolveCampaignPlatforms,
} from "./pipeline/campaignPipelineHelpers";
import { applyCreativePipelineQuality } from "./pipeline/creativePipelineQuality";
import { applyPlannerPipelineQuality } from "./pipeline/plannerPipelineQuality";
import { applySocialPipelineQuality } from "./pipeline/socialPipelineQuality";
import { applyVideoPipelineQuality } from "./pipeline/videoPipelineQuality";
import type {
  MarketingCampaign,
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
  const socialPlannerItem =
    plannerOutput?.items.find(
      (item) => item.channel.trim().toLowerCase() === "instagram",
    ) ??
    plannerOutput?.items.find((item) => {
      const channel = item.channel.trim().toLowerCase();

      return channel === "facebook" || channel === "linkedin";
    }) ??
    plannerOutput?.items.find((item) => {
      const format = item.format.trim().toLowerCase();

      return (
        format === "carousel" ||
        format === "post" ||
        format === "story" ||
        format === "reel"
      );
    }) ??
    plannerOutput?.items[0] ??
    null;

  const social = await runSocialContent({
    ...(socialInput ?? {}),
    channel: "instagram",
    format: socialPlannerItem?.format ?? "carousel",
    topic:
      socialPlannerItem?.topic ??
      "Identifier les points de friction d'une annonce",
    goal: socialPlannerItem?.goal ?? "awareness",
    audience,
    cta: socialPlannerItem?.cta ?? "Découvrir Norixo.io",
    language: input.language,
  });
  const socialOutput: SocialOutput | null = parseSocialOutput(social.output);
  ({ campaignMemory, qualityGate } = applySocialPipelineQuality({
    socialOutput,
    campaignMemory,
    qualityGate,
  }));
  const creativeInput: CreativeInput | null =
    plannerOutput && socialOutput
      ? {
          brief,
          planning: plannerOutput,
          social: socialOutput,
          language: input.language,
        }
      : null;
  const creativeContentTitle =
    socialOutput?.title ?? "Identifier les points de friction d'une annonce";
  const creativeHook =
    socialOutput?.hook ?? "Voir plus clairement ce qui peut freiner une annonce";

  const creative = await runCreativeDirector({
    ...(creativeInput ?? {}),
    contentTitle: creativeContentTitle,
    hook: creativeHook,
    channel: "instagram",
    format: "carousel",
    visualGoal:
      "Créer une direction visuelle premium pour un carrousel Instagram Norixo.io",
    language: input.language,
  });
  const creativeOutput: CreativeOutput | null = parseCreativeOutput(
    creative.output,
  );
  ({ campaignMemory, qualityGate } = applyCreativePipelineQuality({
    creativeOutput,
    campaignMemory,
    qualityGate,
  }));
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
  const resolvedVideoTitle =
    socialOutput?.title ?? "Voir plus clairement ce qui peut freiner une annonce";
  const resolvedVideoHook =
    socialOutput?.hook ??
    "Et si vous pouviez identifier vos priorités plus facilement ?";
  const resolvedVideoCta =
    socialOutput?.cta ?? "Découvrir Norixo.io";

  const video = await runVideoScript({
    ...(videoInput ?? {}),
    title: resolvedVideoTitle,
    hook: resolvedVideoHook,
    topic:
      "Présenter Norixo Optimize comme outil pour identifier les points de friction et clarifier les priorités",
    audience,
    cta: resolvedVideoCta,
    language: input.language,
    duration: videoDuration,
    format: videoFormat,
  });
  const videoOutput: VideoOutput | null = parseVideoOutput(video.output);
  ({ campaignMemory, qualityGate } = applyVideoPipelineQuality({
    videoOutput,
    campaignMemory,
    qualityGate,
  }));
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
