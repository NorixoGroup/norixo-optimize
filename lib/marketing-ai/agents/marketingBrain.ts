import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import type { MarketingBrainBrief } from "../contracts/agentContracts";
import { buildMarketingBrainPrompt } from "../prompts/marketingBrain.prompt";

export type MarketingBrainInput = {
  objective: string;
  audience?: string;
  language: string;
  market?: string;
  channels?: string[];
  timeframe?: string;
  context?: string;
};

function normalizeNorixoBrand(value: string) {
  return value
    .replace(/Norixo Optimize/g, "Norixo")
    .replace(/Listing Conversion Optimizer/g, "Norixo");
}

function getDefaultMarketingChannels() {
  return ["Instagram", "Facebook", "LinkedIn", "SEO", "email", "vidéo"];
}

function getRecommendedFormats(channels: string[]) {
  const formats = new Set<string>();

  for (const channel of channels) {
    const normalizedChannel = channel.trim().toLowerCase();

    if (normalizedChannel.includes("instagram")) {
      formats.add("carousel");
      formats.add("reel");
      continue;
    }

    if (normalizedChannel.includes("facebook")) {
      formats.add("post");
      continue;
    }

    if (normalizedChannel.includes("linkedin")) {
      formats.add("post");
      formats.add("article");
      continue;
    }

    if (normalizedChannel.includes("seo")) {
      formats.add("article");
      continue;
    }

    if (normalizedChannel.includes("email")) {
      formats.add("email");
      continue;
    }

    if (normalizedChannel.includes("vidéo") || normalizedChannel.includes("video")) {
      formats.add("video");
    }
  }

  return formats.size ? Array.from(formats) : ["post"];
}

export function buildMarketingBrainBrief(
  input: MarketingBrainInput,
): MarketingBrainBrief {
  const channels = input.channels?.length
    ? input.channels
    : getDefaultMarketingChannels();
  const audience =
    input.audience?.trim() ||
    "hôtes, conciergeries et gestionnaires de locations courte durée";
  const timeframe = input.timeframe?.trim() || "7 jours";
  const market = input.market?.trim() || "marché SaaS international";
  const context = normalizeNorixoBrand(
    input.context?.trim() ||
      "Norixo est un SaaS qui aide à analyser et améliorer les annonces Airbnb, Booking et autres plateformes de location courte durée.",
  );

  return {
    campaignGoal: input.objective,
    targetAudience: audience,
    personas: [audience],
    pains: [
      "Difficulté à identifier les points de friction prioritaires.",
      "Manque de clarté sur les actions marketing à prioriser.",
    ],
    desires: [
      "Mieux comprendre les points de friction.",
      "Clarifier les priorités d'amélioration.",
      "Préparer des actions marketing actionnables.",
    ],
    positioning: `Norixo comme SaaS marketing pour ${market}.`,
    valueProposition: context,
    keyMessages: [
      "Norixo aide à identifier les points de friction.",
      "Norixo aide à clarifier les priorités d'amélioration.",
      "Une validation humaine reste nécessaire avant publication.",
    ],
    objections: [
      "Le contexte marketing disponible peut être incomplet.",
      "Les priorités doivent être confirmées par une revue humaine.",
    ],
    tone:
      input.language === "fr"
        ? "clair, prudent et actionnable"
        : "clear, cautious and actionable",
    channels,
    funnelStage: "consideration",
    recommendedFormats: getRecommendedFormats(channels),
    recommendedCadence: timeframe,
    seoTopics: channels.some((channel) => channel.trim().toLowerCase() === "seo")
      ? [
          "points de friction annonce",
          "priorités d'amélioration annonce",
          "audit annonce location courte durée",
        ]
      : [],
    ctaStrategy: "Inviter à découvrir Norixo avant toute validation humaine.",
    successMetrics: [
      `Plan marketing structuré sur ${timeframe}.`,
      "Contenus prêts pour revue humaine.",
    ],
  };
}

export async function runMarketingBrain(
  input: MarketingBrainInput,
): Promise<MarketingAiExecutionResult> {
  const normalizedInput = {
    ...input,
    context: input.context ? normalizeNorixoBrand(input.context) : input.context,
  };

  return executeMarketingAiRequest({
    agentId: "marketing-manager",
    providerId: "openai",
    model: null,
    input: buildMarketingBrainPrompt(normalizedInput),
    capabilities: ["chat", "analytics"],
    metadata: {
      objective: input.objective,
      audience: input.audience ?? null,
      language: input.language,
      market: input.market ?? null,
      channels: input.channels ?? [],
      timeframe: input.timeframe ?? null,
    },
  });
}
