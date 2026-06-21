import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import { validateMarketingOutput } from "../outputValidator";

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

Return ONLY a valid JSON object. Do not wrap it in markdown or code fences, without markdown, with this structure:

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

Common Norixo rules:
- Work only for Norixo.io.
- Do not create content for customer listings.
- Do not rewrite Airbnb, Booking, Vrbo or Expedia listings.
- Do not invent testimonials, case studies, customer names, statistics, revenue, rankings or performance results.
- Do not promise more bookings, revenue, guaranteed ranking, guaranteed visibility or guaranteed conversion.
- Prefer careful wording: "identifier", "prioriser", "mieux comprendre", "points de friction", "pistes d'amélioration".
- Keep all output useful for a human review before publication.


Strict content guardrails:
- Do not mention free guides, webinars, testimonials, case studies, customer stories, statistics, graphs, surveys or downloadable resources unless explicitly provided in the input.
- Avoid words like "boost", "transform", "maximize", "guarantee", "more bookings", "increase revenue", "improve ranking", "performance".
- Do not say Norixo will improve bookings or revenue.
- Say Norixo helps identify friction points, clarify priorities and prepare improvement actions.
- Keep all claims cautious and product-focused.

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
- Keep the plan practical and ready to execute.
- Do not create items about testimonials, webinars, free guides, downloads or customer stories unless explicitly provided.
- Do not use topics like "témoignages utilisateurs", "webinaire", "guide gratuit" or "étude de cas".
- Do not use "conversion" as a goal unless the topic is strictly product discovery. Prefer awareness, education, trust or traffic.
- Avoid telling users how to correct listings step by step. Focus on explaining how Norixo helps identify and prioritize friction points.`;
}

export async function runContentPlanner(
  input: ContentPlannerInput,
): Promise<MarketingAiExecutionResult> {
  const result = await executeMarketingAiRequest({
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

  const validation = validateMarketingOutput(result.output);

  return {
    ...result,
    output: validation.cleanedOutput,
    error: validation.ok
      ? result.error
      : JSON.stringify({
          originalError: result.error,
          validationIssues: validation.issues,
        }),
  };
}
