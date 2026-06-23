import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import {
  createMarketingCommunity,
  type MarketingCommunity,
} from "../community/communityModel";
import {
  buildCommunityDiscoveryPrompt,
  type CommunityDiscoveryPromptInput,
} from "../prompts/communityDiscovery.prompt";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export type CommunityDiscoveryOutput = {
  communities: MarketingCommunity[];
  warnings: string[];
};

export function parseCommunityDiscoveryOutput(
  output: string | null | undefined,
): CommunityDiscoveryOutput | null {
  if (!isNonEmptyString(output)) {
    return null;
  }

  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;

    if (!Array.isArray(parsed.communities) || !isStringArray(parsed.warnings)) {
      return null;
    }

    const communities = parsed.communities
      .filter(isPlainObject)
      .map((community) =>
        createMarketingCommunity({
          country:
            typeof community.country === "string"
              ? community.country
              : undefined,
          name: typeof community.name === "string" ? community.name : undefined,
          platform:
            typeof community.platform === "string"
              ? community.platform
              : undefined,
          language:
            typeof community.language === "string"
              ? community.language
              : undefined,
          type: typeof community.type === "string" ? community.type : undefined,
          approximateSize:
            typeof community.approximateSize === "string"
              ? community.approximateSize
              : undefined,
          estimatedActivity:
            typeof community.estimatedActivity === "string"
              ? community.estimatedActivity
              : undefined,
          audience:
            typeof community.audience === "string"
              ? community.audience
              : undefined,
          relevance:
            typeof community.relevance === "string"
              ? community.relevance
              : undefined,
          recommendationReason:
            typeof community.recommendationReason === "string"
              ? community.recommendationReason
              : undefined,
          url: typeof community.url === "string" ? community.url : undefined,
          notes:
            typeof community.notes === "string" ? community.notes : undefined,
        }),
      );

    return {
      communities,
      warnings: parsed.warnings,
    };
  } catch {
    return null;
  }
}

export async function runCommunityDiscovery(
  input: CommunityDiscoveryPromptInput,
): Promise<MarketingAiExecutionResult> {
  const result = await executeMarketingAiRequest({
    agentId: "publication",
    providerId: "openai",
    model: null,
    input: buildCommunityDiscoveryPrompt(input),
    capabilities: ["chat"],
    metadata: input as Record<string, unknown>,
  });

  const typedOutput = parseCommunityDiscoveryOutput(result.output);
  void typedOutput;

  return result;
}
