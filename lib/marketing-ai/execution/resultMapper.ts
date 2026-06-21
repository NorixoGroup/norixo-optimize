import type { ChatCompletion } from "openai/resources/chat/completions";
import type { MarketingAiExecutionResult } from "../adapters/base/adapterTypes";
import type { ProviderId } from "../providerTypes";

export function mapOpenAiChatCompletionResult(input: {
  providerId: ProviderId;
  model: string;
  completion: ChatCompletion;
  durationMs: number;
}): MarketingAiExecutionResult {
  return {
    providerId: input.providerId,
    model: input.model,
    status: "success",
    output: input.completion.choices[0]?.message?.content ?? null,
    error: null,
    costEur: 0,
    durationMs: input.durationMs,
  };
}
