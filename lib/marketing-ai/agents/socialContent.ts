import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import { validateMarketingOutput } from "../outputValidator";

export type SocialContentInput = {
  channel: "instagram" | "facebook" | "linkedin";
  format: string;
  topic: string;
  goal: string;
  audience: string;
  cta: string;
  language: string;
  context?: string;
};

function buildPrompt(input: SocialContentInput) {
  const context =
    input.context ??
    "Norixo Optimize est un SaaS qui aide les hôtes et conciergeries à améliorer leurs annonces de location courte durée.";

  return `You are the Social Content Agent of Norixo Marketing Studio.

Create ONE social media publication for Norixo.io.

Context:
${context}

Channel:
${input.channel}

Format:
${input.format}

Topic:
${input.topic}

Goal:
${input.goal}

Audience:
${input.audience}

Call to action:
${input.cta}

Language:
${input.language}

Return ONLY a valid JSON object. Do not wrap it in markdown or code fences with:

{
"title":"",
"hook":"",
"caption":"",
"hashtags":[],
"cta":"",
"imageIdea":"",
"imagePrompt":"",
"videoPrompt":"",
"recommendedPublishTime":"",
"targetPlatform":"",
"approvalChecklist":[]
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

- Only promote Norixo.io.
- Never rewrite Airbnb or Booking listings.
- Never generate listing optimisation advice or step-by-step correction tips.
- Do not make the content sound like a free audit.
- Do not promise bookings, revenue, rankings or guaranteed results.
- Never use #Airbnb, #Booking, #Vrbo or #Expedia hashtags unless explicitly requested.
- Never invent testimonials.
- Never invent statistics.
- Never invent customer results.
- The post must promote Norixo.io only.
- Position Norixo as a tool that helps identify friction points and prioritize improvements.
- Keep the caption focused on awareness, curiosity and product discovery.
- Avoid titles and hooks like "5 erreurs à éviter", "booster", "ne convertit pas", "freinent vos réservations".
- Do not include ISO dates or fake calendar dates in recommendedPublishTime. Use broad suggestions like "matin", "début de semaine", "fin d'après-midi".
- Do not put hashtags inside the caption if the hashtags array already exists.
- Write naturally.
- Optimize for engagement.
- The imagePrompt must be suitable for GPT Image.
- The videoPrompt must be suitable for Veo/Sora later.`;
}

export async function runSocialContent(
  input: SocialContentInput,
): Promise<MarketingAiExecutionResult> {
  const result = await executeMarketingAiRequest({
    agentId: "content",
    providerId: "openai",
    model: null,
    input: buildPrompt(input),
    capabilities: ["chat"],
    metadata: input,
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
