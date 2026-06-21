import { runContentPlanner } from "./agents/contentPlanner";
import { runSocialContent } from "./agents/socialContent";
import { runCreativeDirector } from "./agents/creativeDirector";
import { runVideoScript } from "./agents/videoScript";

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

  const planner = await runContentPlanner({
    marketingBrief:
      "Préparer une campagne marketing pour Norixo.io uniquement.",
    objective: input.objective,
    language: input.language,
    timeframe,
    channels,
    context:
      "Norixo Optimize aide les hôtes et conciergeries à identifier les points de friction d'une annonce et à clarifier les priorités d'amélioration.",
  });

  const social = await runSocialContent({
    channel: "instagram",
    format: "carousel",
    topic: "Identifier les points de friction d'une annonce",
    goal: "awareness",
    audience,
    cta: "Découvrir Norixo.io",
    language: input.language,
  });

  const creative = await runCreativeDirector({
    contentTitle: "Identifier les points de friction d'une annonce",
    hook: "Voir plus clairement ce qui peut freiner une annonce",
    channel: "instagram",
    format: "carousel",
    visualGoal:
      "Créer une direction visuelle premium pour un carrousel Instagram Norixo.io",
    language: input.language,
  });

  const video = await runVideoScript({
    title: "Voir plus clairement ce qui peut freiner une annonce",
    hook: "Et si vous pouviez identifier vos priorités plus facilement ?",
    topic:
      "Présenter Norixo Optimize comme outil pour identifier les points de friction et clarifier les priorités",
    audience,
    cta: "Découvrir Norixo.io",
    language: input.language,
    duration: "30 secondes",
    format: "reel",
  });

  return {
    planner,
    social,
    creative,
    video,
  };
}
