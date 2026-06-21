import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";

export type MarketingBrainInput = {
  objective: string;
  audience?: string;
  language: string;
  market?: string;
  channels?: string[];
  timeframe?: string;
  context?: string;
};

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
