import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";

export type ContentPlannerInput = {
  marketingBrief: string;
  language: string;
  timeframe?: string;
  channels?: string[];
  objective?: string;
  context?: string;
};

function buildContentPlannerPrompt(input: ContentPlannerInput) {
  const channels = input.channels?.length
    ? input.channels.join(", ")
    : "Instagram, Facebook, LinkedIn, SEO";
  const timeframe = input.timeframe?.trim() || "7 jours";
  const objective =
    input.objective?.trim() || "développer la visibilité et les conversions de Norixo.io";
  const context =
    input.context?.trim() ||
    "Norixo Optimize est un SaaS pour hôtes, conciergeries et gestionnaires de locations courte durée.";

  return `You are the Content Planner of Norixo Marketing Studio.

Your job is to transform a marketing brief into a concrete editorial calendar for Norixo.io.

Marketing brief:
${input.marketingBrief}

Objective:
${objective}

Preferred language:
${input.language}

Timeframe:
${timeframe}

Channels:
${channels}

Context:
${context}

Return ONLY a valid JSON object, without markdown, with this structure:

{
  "campaign": "string",
  "timeframe": "string",
  "objective": "string",
  "items": [
    {
      "day": 1,
      "channel": "instagram | facebook | linkedin | seo | newsletter | video",
      "format": "reel | post | carousel | story | article | email | video",
      "topic": "string",
      "goal": "awareness | traffic | conversion | trust | education",
      "angle": "string",
      "cta": "string",
      "target": "string",
      "notes": "string"
    }
  ]
}

Rules:
- Create content only for Norixo.io.
- Do not create or rewrite Airbnb, Booking, Vrbo or Expedia listings.
- Do not produce listing titles or listing descriptions.
- Prefer Instagram, Facebook, LinkedIn and SEO.
- Include at least one Instagram item.
- Include at least one Facebook item.
- Include at least one LinkedIn item.
- Include at least one SEO item if SEO is listed in channels.
- Make the calendar useful for the next Social Content agent.
- Do not invent customer testimonials, numbers or performance claims.
- Keep the plan practical and ready to execute.`;
}

export async function runContentPlanner(
  input: ContentPlannerInput,
): Promise<MarketingAiExecutionResult> {
  return executeMarketingAiRequest({
    agentId: "campaign",
    providerId: "openai",
    model: null,
    input: buildContentPlannerPrompt(input),
    capabilities: ["chat"],
    metadata: {
      objective: input.objective ?? null,
      language: input.language,
      timeframe: input.timeframe ?? null,
      channels: input.channels ?? [],
    },
  });
}
