import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import {
  createMarketingLocalization,
  type MarketingLocalization,
} from "../localization/localizationModel";
import {
  buildLocalizationPrompt,
  type LocalizationPromptInput,
} from "../prompts/localization.prompt";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export type LocalizationOutput = {
  localization: MarketingLocalization;
};

export function parseLocalizationOutput(
  output: string | null | undefined,
): LocalizationOutput | null {
  if (!isNonEmptyString(output)) {
    return null;
  }

  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;

    if (!isPlainObject(parsed) || parsed.approvalRequired !== true) {
      return null;
    }

    const localization = createMarketingLocalization({
      sourcePackId:
        typeof parsed.sourcePackId === "string" ? parsed.sourcePackId : undefined,
      targetCountry:
        typeof parsed.targetCountry === "string" ? parsed.targetCountry : undefined,
      targetLanguage:
        typeof parsed.targetLanguage === "string"
          ? parsed.targetLanguage
          : undefined,
      targetPlatform:
        typeof parsed.targetPlatform === "string"
          ? parsed.targetPlatform
          : undefined,
      targetCommunityType:
        typeof parsed.targetCommunityType === "string"
          ? parsed.targetCommunityType
          : undefined,
      tone: typeof parsed.tone === "string" ? parsed.tone : undefined,
      length: typeof parsed.length === "string" ? parsed.length : undefined,
      emojiStyle:
        typeof parsed.emojiStyle === "string" ? parsed.emojiStyle : undefined,
      adaptedTitle:
        typeof parsed.adaptedTitle === "string" ? parsed.adaptedTitle : undefined,
      adaptedCaption:
        typeof parsed.adaptedCaption === "string"
          ? parsed.adaptedCaption
          : undefined,
      adaptedCta:
        typeof parsed.adaptedCta === "string" ? parsed.adaptedCta : undefined,
      adaptedHashtags: isStringArray(parsed.adaptedHashtags)
        ? parsed.adaptedHashtags
        : [],
      vocabularyNotes: isStringArray(parsed.vocabularyNotes)
        ? parsed.vocabularyNotes
        : [],
      culturalNotes: isStringArray(parsed.culturalNotes)
        ? parsed.culturalNotes
        : [],
      warnings: isStringArray(parsed.warnings) ? parsed.warnings : [],
    });

    return { localization };
  } catch {
    return null;
  }
}

export async function runLocalization(
  input: LocalizationPromptInput,
): Promise<MarketingAiExecutionResult> {
  const result = await executeMarketingAiRequest({
    agentId: "publication",
    providerId: "openai",
    model: null,
    input: buildLocalizationPrompt(input),
    capabilities: ["chat"],
    metadata: input as Record<string, unknown>,
  });

  const typedOutput = parseLocalizationOutput(result.output);
  void typedOutput;

  return result;
}
