import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import type { CreativeInput, CreativeOutput } from "../contracts/agentContracts";
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

type CreativeDirectorContractInput = CreativeInput & Partial<CreativeDirectorInput>;

type CreativeDirectorRunInput = CreativeDirectorInput | CreativeDirectorContractInput;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveLegacyChannel(
  socialTargetPlatform: string | undefined,
): CreativeDirectorInput["channel"] {
  const normalizedTarget = socialTargetPlatform?.trim().toLowerCase();

  if (
    normalizedTarget === "instagram" ||
    normalizedTarget === "facebook" ||
    normalizedTarget === "linkedin"
  ) {
    return normalizedTarget;
  }

  return "instagram";
}

function resolveCreativePromptInput(
  input: CreativeDirectorRunInput,
): CreativeDirectorInput {
  const brief = "brief" in input ? input.brief : null;
  const planning = "planning" in input ? input.planning : null;
  const social = "social" in input ? input.social : null;
  const legacyContentTitle =
    "contentTitle" in input && isNonEmptyString(input.contentTitle)
      ? input.contentTitle
      : undefined;
  const legacyHook =
    "hook" in input && isNonEmptyString(input.hook)
      ? input.hook
      : undefined;
  const legacyChannel =
    "channel" in input && isNonEmptyString(input.channel)
      ? input.channel
      : undefined;
  const legacyFormat =
    "format" in input && isNonEmptyString(input.format)
      ? input.format
      : undefined;
  const legacyVisualGoal =
    "visualGoal" in input && isNonEmptyString(input.visualGoal)
      ? input.visualGoal
      : undefined;
  const legacyBrandContext =
    "brandContext" in input && isNonEmptyString(input.brandContext)
      ? input.brandContext
      : undefined;
  const resolvedChannel = legacyChannel
    ? legacyChannel
    : resolveLegacyChannel(social?.targetPlatform);
  const plannerItem =
    planning?.items.find(
      (item) => item.channel.trim().toLowerCase() === resolvedChannel,
    ) ?? planning?.items[0];
  const socialTitle =
    social?.title ?? social?.imageIdea ?? social?.cta;
  const socialHook =
    social?.hook ?? social?.caption;

  return {
    contentTitle:
      legacyContentTitle ??
      socialTitle ??
      plannerItem?.topic ??
      brief?.keyMessages[0] ??
      brief?.campaignGoal ??
      "Identifier les points de friction d'une annonce",
    hook:
      legacyHook ??
      socialHook ??
      brief?.valueProposition ??
      "Voir plus clairement ce qui peut freiner une annonce",
    channel: resolvedChannel,
    format:
      legacyFormat ??
      plannerItem?.format ??
      social?.targetPlatform ??
      brief?.recommendedFormats[0] ??
      "carousel",
    visualGoal:
      legacyVisualGoal ??
      "Créer une direction visuelle premium pour un carrousel Instagram Norixo.io",
    language: input.language,
    brandContext: legacyBrandContext,
  };
}

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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseCreativeOutput(
  output: string | null | undefined,
): CreativeOutput | null {
  if (!isNonEmptyString(output)) {
    return null;
  }

  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;

    if (
      typeof parsed.creativeConcept !== "string" ||
      typeof parsed.visualStyle !== "string" ||
      typeof parsed.layout !== "string" ||
      typeof parsed.mainTextOverlay !== "string" ||
      typeof parsed.secondaryTextOverlay !== "string" ||
      typeof parsed.assetFormat !== "string" ||
      typeof parsed.gptImagePrompt !== "string" ||
      typeof parsed.negativePrompt !== "string" ||
      !isStringArray(parsed.brandChecklist)
    ) {
      return null;
    }

    return {
      creativeConcept: parsed.creativeConcept,
      visualStyle: parsed.visualStyle,
      layout: parsed.layout,
      mainTextOverlay: parsed.mainTextOverlay,
      secondaryTextOverlay: parsed.secondaryTextOverlay,
      assetFormat: parsed.assetFormat,
      gptImagePrompt: parsed.gptImagePrompt,
      negativePrompt: parsed.negativePrompt,
      brandChecklist: parsed.brandChecklist,
      qualityScore: 0,
      warnings: [],
      improvements: [],
    };
  } catch {
    return null;
  }
}

export async function runCreativeDirector(
  input: CreativeDirectorRunInput,
): Promise<MarketingAiExecutionResult> {
  const resolvedInput = resolveCreativePromptInput(input);
  const result = await executeMarketingAiRequest({
    agentId: "image",
    providerId: "openai",
    model: null,
    input: buildPrompt(resolvedInput),
    capabilities: ["chat"],
    metadata: resolvedInput,
  });

  const validation = validateMarketingOutput(result.output);
  const typedOutput = parseCreativeOutput(validation.cleanedOutput);
  void typedOutput;

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
