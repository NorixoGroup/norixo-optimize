import { executeMarketingAiRequest } from "../execution/executionEngine";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";

export type MarketingBrainInput = {
  listingUrl: string;
  platform: "airbnb" | "booking" | "vrbo" | "expedia" | "unknown";
  language: string;
  market: string;
};

function buildMarketingBrainPrompt(input: MarketingBrainInput) {
  return `Analyze this short-term rental listing from a marketing perspective.

Listing URL: ${input.listingUrl}
Platform: ${input.platform}
Language: ${input.language}
Market: ${input.market}

Return a concise structured marketing plan with:
1. Strengths
2. Weaknesses
3. Opportunities
4. Priority actions
5. Suggested positioning

Do not publish anything. Do not invent unavailable listing details. If information is missing, say what should be checked.`;
}

export async function runMarketingBrain(
  input: MarketingBrainInput,
): Promise<MarketingAiExecutionResult> {
  return executeMarketingAiRequest({
    agentId: "marketing-manager",
    providerId: "openai",
    model: null,
    input: buildMarketingBrainPrompt(input),
    capabilities: ["chat", "analytics"],
    metadata: {
      listingUrl: input.listingUrl,
      platform: input.platform,
      language: input.language,
      market: input.market,
    },
  });
}
