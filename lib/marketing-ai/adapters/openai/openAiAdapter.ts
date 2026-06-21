import { openai } from "../../../openai";
import type {
  MarketingAiExecutionRequest,
  MarketingAiExecutionResult,
  MarketingAiProviderHealth,
} from "../base/adapterTypes";
import type { MarketingAiProviderAdapter } from "../base/providerAdapter";

const DEFAULT_OPENAI_MARKETING_AI_MODEL =
  process.env.OPENAI_MARKETING_AI_MODEL ?? "gpt-4o-mini";

function hasOpenAiApiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export class OpenAiAdapter implements MarketingAiProviderAdapter {
  readonly providerId = "openai";

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async health(): Promise<MarketingAiProviderHealth> {
    const hasKey = hasOpenAiApiKey();

    return {
      providerId: this.providerId,
      status: hasKey ? "connected" : "simulation",
      isAvailable: hasKey,
      message: hasKey
        ? "OpenAI API key detected. Real execution remains disabled in Phase 1."
        : "OpenAI API key missing. Falling back to simulation.",
    };
  }

  async execute(
    request: MarketingAiExecutionRequest,
  ): Promise<MarketingAiExecutionResult> {
    return {
      providerId: request.providerId,
      model: request.model,
      status: "simulation",
      output: null,
      error: null,
      costEur: 0,
      durationMs: 0,
    };
  }
}
