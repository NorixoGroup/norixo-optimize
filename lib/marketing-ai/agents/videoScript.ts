import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import type {
  VideoInput,
  VideoOutput,
  VideoScene,
} from "../contracts/agentContracts";
import { validateMarketingOutput } from "../outputValidator";
import { buildPrompt } from "../prompts/video.prompt";

export type VideoScriptInput = {
  title: string;
  hook: string;
  topic: string;
  audience: string;
  cta: string;
  language: string;
  duration?: string;
  format?: "reel" | "story" | "linkedin-video" | "facebook-video" | "demo";
  context?: string;
};

type VideoScriptContractInput = VideoInput & Partial<VideoScriptInput>;

type VideoScriptRunInput = VideoScriptInput | VideoScriptContractInput;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveLegacyFormat(
  format: string | undefined,
): NonNullable<VideoScriptInput["format"]> {
  const normalizedFormat = format?.trim().toLowerCase();

  if (
    normalizedFormat === "reel" ||
    normalizedFormat === "story" ||
    normalizedFormat === "linkedin-video" ||
    normalizedFormat === "facebook-video" ||
    normalizedFormat === "demo"
  ) {
    return normalizedFormat;
  }

  return "reel";
}

function resolveVideoPromptInput(input: VideoScriptRunInput): VideoScriptInput {
  const brief = "brief" in input ? input.brief : null;
  const planning = "planning" in input ? input.planning : null;
  const social = "social" in input ? input.social : null;
  const creative = "creative" in input ? input.creative : null;
  const legacyTitle =
    "title" in input && isNonEmptyString(input.title) ? input.title : undefined;
  const legacyHook =
    "hook" in input && isNonEmptyString(input.hook) ? input.hook : undefined;
  const legacyTopic =
    "topic" in input && isNonEmptyString(input.topic) ? input.topic : undefined;
  const legacyAudience =
    "audience" in input && isNonEmptyString(input.audience)
      ? input.audience
      : undefined;
  const legacyCta =
    "cta" in input && isNonEmptyString(input.cta) ? input.cta : undefined;
  const legacyContext =
    "context" in input && isNonEmptyString(input.context)
      ? input.context
      : undefined;
  const legacyDuration =
    "duration" in input && isNonEmptyString(input.duration)
      ? input.duration
      : undefined;
  const legacyFormat =
    "format" in input ? resolveLegacyFormat(input.format) : undefined;
  const plannerItem =
    planning?.items.find((item) =>
      item.channel.trim().toLowerCase().includes("video"),
    ) ??
    planning?.items.find((item) =>
      item.format.trim().toLowerCase().includes("video"),
    ) ??
    planning?.items[0];

  return {
    title:
      legacyTitle ??
      social?.title ??
      creative?.mainTextOverlay ??
      plannerItem?.topic ??
      brief?.campaignGoal ??
      "Voir plus clairement ce qui peut freiner une annonce",
    hook:
      legacyHook ??
      social?.hook ??
      creative?.secondaryTextOverlay ??
      brief?.valueProposition ??
      "Et si vous pouviez identifier vos priorités plus facilement ?",
    topic:
      legacyTopic ??
      social?.videoPrompt ??
      plannerItem?.angle ??
      brief?.keyMessages[0] ??
      "Présenter Norixo Optimize comme outil pour identifier les points de friction et clarifier les priorités",
    audience:
      legacyAudience ??
      brief?.targetAudience ??
      "Conciergeries et hôtes professionnels",
    cta:
      legacyCta ??
      social?.cta ??
      plannerItem?.cta ??
      "Découvrir Norixo.io",
    language: input.language,
    duration: legacyDuration ?? ("duration" in input ? input.duration : undefined),
    format: legacyFormat ?? ("format" in input ? resolveLegacyFormat(input.format) : undefined),
    context: legacyContext,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isVideoScene(value: unknown): value is VideoScene {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.scene === "number" &&
    typeof candidate.duration === "string" &&
    typeof candidate.visual === "string" &&
    typeof candidate.onScreenText === "string" &&
    typeof candidate.voiceOver === "string" &&
    typeof candidate.transition === "string"
  );
}

export function parseVideoOutput(
  output: string | null | undefined,
): VideoOutput | null {
  if (!isNonEmptyString(output)) {
    return null;
  }

  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;

    if (
      typeof parsed.videoTitle !== "string" ||
      typeof parsed.duration !== "string" ||
      typeof parsed.format !== "string" ||
      typeof parsed.hook !== "string" ||
      typeof parsed.voiceOver !== "string" ||
      !Array.isArray(parsed.scenes) ||
      !parsed.scenes.every(isVideoScene) ||
      typeof parsed.musicDirection !== "string" ||
      typeof parsed.caption !== "string" ||
      typeof parsed.cta !== "string" ||
      typeof parsed.editingNotes !== "string" ||
      !isStringArray(parsed.assetChecklist)
    ) {
      return null;
    }

    return {
      videoTitle: parsed.videoTitle,
      duration: parsed.duration,
      format: parsed.format,
      hook: parsed.hook,
      voiceOver: parsed.voiceOver,
      scenes: parsed.scenes,
      musicDirection: parsed.musicDirection,
      caption: parsed.caption,
      cta: parsed.cta,
      editingNotes: parsed.editingNotes,
      assetChecklist: parsed.assetChecklist,
      qualityScore: 0,
      warnings: [],
      improvements: [],
    };
  } catch {
    return null;
  }
}

export async function runVideoScript(
  input: VideoScriptRunInput,
): Promise<MarketingAiExecutionResult> {
  const resolvedInput = resolveVideoPromptInput(input);
  const result = await executeMarketingAiRequest({
    agentId: "video",
    providerId: "openai",
    model: null,
    input: buildPrompt(resolvedInput),
    capabilities: ["chat"],
    metadata: resolvedInput,
  });

  const validation = validateMarketingOutput(result.output);
  const typedOutput = parseVideoOutput(validation.cleanedOutput);
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
