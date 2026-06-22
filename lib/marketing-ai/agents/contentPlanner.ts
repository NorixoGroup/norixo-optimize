import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import type {
  MarketingBrainBrief,
  PlannerInput,
  PlannerItem,
  PlannerOutput,
} from "../contracts/agentContracts";
import { validateMarketingOutput } from "../outputValidator";
import { buildContentPlannerPrompt } from "../prompts/planner.prompt";

export type LegacyContentPlannerInput = {
  marketingBrief: string;
  language: string;
  timeframe?: string;
  channels?: string[];
  objective?: string;
  context?: string;
  brief?: MarketingBrainBrief;
};

export type ContentPlannerInput = PlannerInput & {
  marketingBrief?: string;
  objective?: string;
  context?: string;
};

export type ContentPlannerRunInput =
  | ContentPlannerInput
  | LegacyContentPlannerInput;

function isPlannerItem(value: unknown): value is PlannerItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.day === "number" &&
    typeof candidate.channel === "string" &&
    typeof candidate.format === "string" &&
    typeof candidate.topic === "string" &&
    typeof candidate.goal === "string" &&
    typeof candidate.angle === "string" &&
    typeof candidate.cta === "string" &&
    typeof candidate.target === "string" &&
    typeof candidate.notes === "string"
  );
}

export function parsePlannerOutput(output: string | null | undefined): PlannerOutput | null {
  if (typeof output !== "string" || !output.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;

    if (
      typeof parsed.campaign !== "string" ||
      typeof parsed.timeframe !== "string" ||
      typeof parsed.objective !== "string" ||
      !Array.isArray(parsed.items) ||
      !parsed.items.every(isPlannerItem)
    ) {
      return null;
    }

    return {
      campaign: parsed.campaign,
      timeframe: parsed.timeframe,
      objective: parsed.objective,
      items: parsed.items,
      qualityScore: 0,
      warnings: [],
      improvements: [],
    };
  } catch {
    return null;
  }
}

export async function runContentPlanner(
  input: ContentPlannerRunInput,
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
  const typedOutput = parsePlannerOutput(validation.cleanedOutput);
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
