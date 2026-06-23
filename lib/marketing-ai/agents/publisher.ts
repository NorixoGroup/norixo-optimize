import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import type {
  PublisherInput,
  PublisherOutput,
} from "../contracts/agentContracts";
import { validateMarketingOutput } from "../outputValidator";
import { buildPublisherPrompt } from "../prompts/publisher.prompt";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parsePublisherOutput(
  output: string | null | undefined,
): PublisherOutput | null {
  if (!isNonEmptyString(output)) {
    return null;
  }

  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;

    if (
      typeof parsed.finalTitle !== "string" ||
      typeof parsed.finalCaption !== "string" ||
      typeof parsed.finalCta !== "string" ||
      !isStringArray(parsed.finalHashtags) ||
      !isStringArray(parsed.platformNotes) ||
      !isStringArray(parsed.manualPublishChecklist) ||
      !isStringArray(parsed.warnings) ||
      parsed.approvalRequired !== true
    ) {
      return null;
    }

    return {
      finalTitle: parsed.finalTitle,
      finalCaption: parsed.finalCaption,
      finalCta: parsed.finalCta,
      finalHashtags: parsed.finalHashtags,
      platformNotes: parsed.platformNotes,
      manualPublishChecklist: parsed.manualPublishChecklist,
      warnings: parsed.warnings,
      approvalRequired: true,
    };
  } catch {
    return null;
  }
}

export async function runPublisher(
  input: PublisherInput,
): Promise<MarketingAiExecutionResult> {
  const result = await executeMarketingAiRequest({
    agentId: "publication",
    providerId: "openai",
    model: null,
    input: buildPublisherPrompt(input),
    capabilities: ["chat"],
    metadata: input as Record<string, unknown>,
  });

  const validation = validateMarketingOutput(result.output);
  const typedOutput = parsePublisherOutput(validation.cleanedOutput);
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
