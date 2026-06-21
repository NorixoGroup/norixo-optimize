import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import { validateMarketingOutput } from "../outputValidator";

export type CreativeDirectorInput = {
  contentTitle: string;
  hook: string;
  channel: "instagram" | "facebook" | "linkedin";
  format: string;
  visualGoal: string;
  language: string;
  brandContext?: string;
};

function buildPrompt(input: CreativeDirectorInput) {
  const brandContext =
    input.brandContext ??
    "Norixo.io is a modern SaaS for short-term rental hosts and conciergeries. Visual style: clean, premium, SaaS dashboard, blue/cyan accents, professional, trustworthy.";

  return `You are the Creative Director of Norixo Marketing Studio.

Create the visual direction for ONE social media asset for Norixo.io.

Content title:
${input.contentTitle}

Hook:
${input.hook}

Channel:
${input.channel}

Format:
${input.format}

Visual goal:
${input.visualGoal}

Language:
${input.language}

Brand context:
${brandContext}

Return ONLY a valid JSON object. Do not wrap it in markdown or code fences with:

{
  "creativeConcept":"",
  "visualStyle":"",
  "layout":"",
  "mainTextOverlay":"",
  "secondaryTextOverlay":"",
  "assetFormat":"",
  "gptImagePrompt":"",
  "negativePrompt":"",
  "brandChecklist":[]
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
- Only create visuals for Norixo.io.
- Do not show real Airbnb, Booking, Vrbo or Expedia logos.
- Do not use copyrighted platform UI.
- Do not invent customer screenshots or customer results.
- Avoid showing fake analytics numbers.
- Use a premium SaaS product feel.
- Make the prompt ready for GPT Image.
- Keep text overlays short and readable on mobile.
- Do not ask to use the Norixo logo unless the logo asset is explicitly provided.
- Prefer abstract SaaS dashboard shapes, neutral UI cards and product-style visuals.`;
}

export async function runCreativeDirector(
  input: CreativeDirectorInput,
): Promise<MarketingAiExecutionResult> {
  const result = await executeMarketingAiRequest({
    agentId: "image",
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
