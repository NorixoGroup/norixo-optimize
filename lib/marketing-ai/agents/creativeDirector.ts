import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import type { MarketingCampaignMemory } from "../campaigns/campaignMemory";
import type { MarketingCampaign } from "../campaigns/campaignModel";
import type { CreativeInput, CreativeOutput } from "../contracts/agentContracts";
import { validateMarketingOutput } from "../outputValidator";
import { buildPrompt } from "../prompts/creative.prompt";

export type CreativeDirectorInput = {
  contentTitle: string;
  hook: string;
  channel: "instagram" | "facebook" | "linkedin";
  format: string;
  visualGoal: string;
  language: string;
  brandContext?: string;
};

type CreativeDirectorRunInput = Partial<CreativeInput> &
  Partial<CreativeDirectorInput> & {
    language: string;
    campaign?: MarketingCampaign;
    campaignMemory?: MarketingCampaignMemory;
  };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const NORIXO_PRODUCT_CAPABILITIES_CONTEXT = [
  "Norixo helps short-term rental hosts and professionals analyze and improve their listings.",
  "Real product capabilities that can inform the creative direction include: AI listing audit, Listing Quality Index / quality score, title optimization, description optimization, photo analysis and photo optimization, friction point identification, prioritized recommendations, Airbnb listing optimization, Booking listing optimization, conversion optimization, and listing performance improvement.",
  "This context is only for creative direction. Do not imply guaranteed revenue growth, booking growth, ranking gains, or any fictional performance metric.",
].join(" ");

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
  const campaign = "campaign" in input ? input.campaign : undefined;
  const campaignMemory =
    "campaignMemory" in input ? input.campaignMemory : undefined;
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
    brandContext: (() => {
      if (legacyBrandContext) {
        return legacyBrandContext;
      }

      const derivedBrandContext = [
        NORIXO_PRODUCT_CAPABILITIES_CONTEXT,
        campaign
          ? `Campaign: ${campaign.name}. Objective: ${campaign.objective}. Audience: ${campaign.audience}. CTA: ${campaign.cta}.`
          : null,
        campaign?.platforms.length
          ? `Platforms: ${campaign.platforms.join(", ")}. Formats: ${campaign.formats.join(", ")}.`
          : null,
        campaignMemory?.usedFormats.length
          ? `Previously used formats: ${campaignMemory.usedFormats.join(", ")}.`
          : null,
        campaignMemory?.hashtags.length
          ? `Brand hashtags: ${campaignMemory.hashtags.join(", ")}.`
          : null,
      ]
        .filter((value): value is string => isNonEmptyString(value))
        .join(" ");

      return derivedBrandContext || undefined;
    })(),
  };
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
    metadata: {
      ...resolvedInput,
      campaign: input.campaign,
      campaignMemory: input.campaignMemory,
      planning: input.planning,
      social: input.social,
    },
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
