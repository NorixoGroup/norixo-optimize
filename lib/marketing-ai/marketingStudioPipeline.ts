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
  void videoOutput;

  return {
    brain,
    planner,
    social,
    creative,
    video,
  };
}
