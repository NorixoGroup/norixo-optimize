import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import type { MarketingBrainBrief } from "../contracts/agentContracts";

export type MarketingBrainInput = {
  objective: string;
  audience?: string;
  language: string;
  market?: string;
  channels?: string[];
  timeframe?: string;
  context?: string;
};

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
  const context =
    input.context?.trim() ||
    "Norixo Optimize est un SaaS qui aide à analyser et améliorer les annonces Airbnb, Booking et autres plateformes de location courte durée.";

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
    positioning: `Norixo Optimize comme SaaS marketing pour ${market}.`,
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
    ctaStrategy: "Inviter à découvrir Norixo Optimize avant toute validation humaine.",
    successMetrics: [
      `Plan marketing structuré sur ${timeframe}.`,
      "Contenus prêts pour revue humaine.",
    ],
  };
}

function buildMarketingBrainPrompt(input: MarketingBrainInput) {
  const channels = input.channels?.length ? input.channels.join(", ") : "Instagram, Facebook, LinkedIn, SEO, email, vidéo";
  const market = input.market?.trim() || "marché SaaS international";
  const audience = input.audience?.trim() || "hôtes, conciergeries et gestionnaires de locations courte durée";
  const timeframe = input.timeframe?.trim() || "7 jours";
  const context = input.context?.trim() || "Norixo Optimize est un SaaS qui aide à analyser et améliorer les annonces Airbnb, Booking et autres plateformes de location courte durée.";

  return `You are the Marketing Manager of Norixo.

Norixo is a SaaS product for short-term rental hosts, property managers and conciergeries.
Your job is not to rewrite listings.
Your job is to define the marketing strategy that will grow Norixo.

Business objective:
${input.objective}

Target audience:
${audience}

Market:
${market}

Preferred language:
${input.language}

Timeframe:
${timeframe}

Channels to consider:
${channels}

Context:
${context}

Return a concise but actionable SaaS marketing plan with these exact sections:

1. Strategic diagnosis
2. Main marketing angle
3. Target audience and pain points
4. Channel strategy
5. Editorial calendar for the timeframe
6. Tasks to delegate to future agents
7. Priority actions for the next 48 hours
8. Risks or missing information

Important rules:
- Do not analyze or rewrite an Airbnb, Booking, Vrbo or Expedia listing.
- Do not generate listing titles or listing descriptions.
- Do not duplicate Norixo Optimize audit features.
- Focus only on marketing Norixo as a SaaS product.
- Do not publish anything automatically.
- If information is missing, state what should be checked instead of inventing it.`;
}

export async function runMarketingBrain(
  input: MarketingBrainInput,
): Promise<MarketingAiExecutionResult> {
  return executeMarketingAiRequest({
    agentId: "marketing-manager",
    providerId: "openai",
    model: null,
    input: buildMarketingBrainPrompt(input),
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
