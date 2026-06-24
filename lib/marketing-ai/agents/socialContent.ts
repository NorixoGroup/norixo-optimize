import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import type { SocialInput, SocialOutput } from "../contracts/agentContracts";
import { validateMarketingOutput } from "../outputValidator";
import { buildPrompt } from "../prompts/social.prompt";

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

type SocialContentContractInput = SocialInput & Partial<SocialContentInput>;

type SocialContentRunInput = SocialContentInput | SocialContentContractInput;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveChannel(targetPlatform: string | undefined): SocialContentInput["channel"] {
  const normalizedTarget = targetPlatform?.trim().toLowerCase();

  if (
    normalizedTarget === "instagram" ||
    normalizedTarget === "facebook" ||
    normalizedTarget === "linkedin"
  ) {
    return normalizedTarget;
  }

  return "instagram";
}

function resolveSocialPromptInput(input: SocialContentRunInput): SocialContentInput {
  const brief = "brief" in input ? input.brief : null;
  const planning = "planning" in input ? input.planning : null;
  const targetPlatform =
    "targetPlatform" in input && isNonEmptyString(input.targetPlatform)
      ? input.targetPlatform
      : undefined;
  const legacyChannel =
    "channel" in input && isNonEmptyString(input.channel)
      ? input.channel
      : undefined;
  const legacyFormat =
    "format" in input && isNonEmptyString(input.format)
      ? input.format
      : undefined;
  const legacyTopic =
    "topic" in input && isNonEmptyString(input.topic)
      ? input.topic
      : undefined;
  const legacyGoal =
    "goal" in input && isNonEmptyString(input.goal)
      ? input.goal
      : undefined;
  const legacyAudience =
    "audience" in input && isNonEmptyString(input.audience)
      ? input.audience
      : undefined;
  const legacyCta =
    "cta" in input && isNonEmptyString(input.cta)
      ? input.cta
      : undefined;
  const legacyContext =
    "context" in input && isNonEmptyString(input.context)
      ? input.context
      : undefined;
  const resolvedChannel = legacyChannel
    ? legacyChannel
    : resolveChannel(targetPlatform);
  const plannerItem =
    planning?.items.find(
      (item) => item.channel.trim().toLowerCase() === resolvedChannel,
    ) ?? planning?.items[0];

  return {
    channel: resolvedChannel,
    format:
      legacyFormat ?? plannerItem?.format ?? brief?.recommendedFormats[0] ?? "carousel",
    topic:
      legacyTopic ??
        plannerItem?.topic ??
          brief?.keyMessages[0] ??
          brief?.campaignGoal ??
          "Identifier les points de friction d'une annonce",
    goal:
      legacyGoal ?? plannerItem?.goal ?? "awareness",
    audience:
      legacyAudience ?? brief?.targetAudience ?? "Conciergeries et hôtes professionnels",
    cta:
      legacyCta ?? plannerItem?.cta ?? "Découvrir Norixo.io",
    language: input.language,
    context: legacyContext,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseSocialOutput(
  output: string | null | undefined,
): SocialOutput | null {
  if (!isNonEmptyString(output)) {
    return null;
  }

  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;

    if (
      typeof parsed.title !== "string" ||
      typeof parsed.hook !== "string" ||
      typeof parsed.caption !== "string" ||
      !isStringArray(parsed.hashtags) ||
      typeof parsed.cta !== "string" ||
      typeof parsed.imageIdea !== "string" ||
      typeof parsed.imagePrompt !== "string" ||
      typeof parsed.videoPrompt !== "string" ||
      typeof parsed.recommendedPublishTime !== "string" ||
      typeof parsed.targetPlatform !== "string" ||
      !isStringArray(parsed.approvalChecklist)
    ) {
      return null;
    }

    return {
      title: parsed.title,
      hook: parsed.hook,
      caption: parsed.caption,
      hashtags: parsed.hashtags,
      cta: parsed.cta,
      imageIdea: parsed.imageIdea,
      imagePrompt: parsed.imagePrompt,
      videoPrompt: parsed.videoPrompt,
      recommendedPublishTime: parsed.recommendedPublishTime,
      targetPlatform: parsed.targetPlatform,
      approvalChecklist: parsed.approvalChecklist,
      qualityScore: 0,
      warnings: [],
      improvements: [],
    };
  } catch {
    return null;
  }
}

export async function runSocialContent(
  input: SocialContentRunInput,
): Promise<MarketingAiExecutionResult> {
  const resolvedInput = resolveSocialPromptInput(input);
  const result = await executeMarketingAiRequest({
    agentId: "content",
    providerId: "openai",
    model: null,
    input: buildPrompt(resolvedInput),
    capabilities: ["chat"],
    metadata: resolvedInput,
  });

  const sanitizedOutput =
    result.output
      ?.replace(/performances/gi, "résultats")
      .replace(/performance/gi, "résultat") ?? result.output;

  const validation = validateMarketingOutput(sanitizedOutput);
  const typedOutput = parseSocialOutput(validation.cleanedOutput);
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
